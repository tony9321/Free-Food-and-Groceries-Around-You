# Plan: Continuous Data Engine for Embodied AI

> **Status:** Production architecture plan — **decision tree complete** (53/53 locked: 46 decision IDs + §16.5 agent defaults; F-series dependency study added 2026-06-19)  
> **Last updated:** 2026-06-20 (Gate 0 doc/spec readiness locked)  
> **D1 locked:** Py+C++ hybrid (mcap-cpp L1) from Phase 0 — production grade, not MVP rewrite path
> **Scope:** Passenger cars, robotaxi, ADAS, self-driving delivery trucks — **not** sidewalk bots.

---

> **Agent implementation authority:** `plan.md` §16 decision tree overrides `research.md` on conflicts. **Gate 0 scope = E2 only:** L1 ingest + clip on `car_l1_spike.mcap`; no heuristics, records, pool, or cloud until Gate 1+.

## 1. Executive summary

We are building a **continuous data engine** for embodied AI: a production-grade pipeline that turns fleet-scale sensor logs into **processed edge-case records** — structured scenario signatures with metadata and optional clip pointers, not raw crown-jewel MCAP dumps. The wedge is **regression-ready intelligence** (CI cards + preprocessing) on siloed fleet data; the long-term vision is a **gated cross-OEM exchange** where subscribers who want the shared index must contribute processed records (REM-style club rule, phased in after customer #1).

**Architecture thesis:** A **Python + C++ hybrid** designed for fleet scale from day one, not an MVP that must be rewritten. **C++ (mcap-cpp, C++20)** owns L1 ingestion — zero-copy MCAP parsing, channel indexing, clip extraction at sustained throughput. **Python (3.12)** owns L2 orchestration, ML self-annotation, CLI, and pool UI. **L2 enrichment:** Colab GPU first (auto max tier, downgrade on OOM); Mac Mini MPS fallback (Tiny+Tiny). The boundary is **pybind11** for hot-path clip/index handoff; **subprocess + Arrow IPC** (optional) for batch isolation and crash containment on long-running fleet jobs.

**Bootstrap without customer #1:** Open datasets + founder car (phone → MCAP) on Mac Mini prove the pipeline. **Demo (D21):** deploy pool API to cloud (Fly.io/Railway); founder car uploads annotated records; second browser shows geo-subscribe / nearby advisory — the FSD fleet loop in miniature.

**GTM sequence (locked Q1):** P1 (0–12 mo) regression cards + thin preprocessing on siloed data → P2 (12–24 mo) hosted ingestion + SLAs → P3 (24+ mo) gated exchange. Revenue year 1 = silo pilot/support; pool subscription year 2+.

**Production targets (not promises):** L1 sustained **≥50k msgs/sec** per ingestion worker on representative AV MCAP; clip extraction **p99 &lt;200 ms** for a 10 s window; end-to-end laptop demo **&lt;60 s** MCAP → ranked records on 5 min log; fleet worker **≥1 TB/day** per 8-core node at steady state.

---

## 2. Goals, non-goals, locked strategic decisions

### 2.1 Goals

| Goal | Definition of done |
|------|-------------------|
| **G1 — L1 ingestion at fleet scale** | C++ mcap-cpp ingestion core; horizontal scaling; deterministic channel schema registry; clip cutter with byte-range pointers into source bags |
| **G2 — L2 edge-case records** | Machine-detected events → edge-case record JSON (schema v0.1+); heuristic triggers + Grounding DINO + SAM2 self-annotation; ranked, regression-card export |
| **G3 — Silo-first revenue** | Paid pilot processing real customer bags weekly; CLI + local pool UI sufficient for P1 (Q4) |
| **G4 — OSS credibility** | Full OSS day 1 (Q5): CLI, record schema, heuristics, ingestion bindings; hosted pool + governance paid later (Q6) |
| **G5 — Vertical slice → production path** | Same record schema and L1 API from laptop demo to multi-tenant hosted ingestion; no format fork between bootstrap and fleet |
| **G6 — Cars/trucks ODD** | Passenger AV, robotaxi, ADAS, autonomous delivery trucks; edge cases tuned for road severity, not sidewalk volume |

### 2.2 Non-goals

| Non-goal | Rationale |
|----------|-----------|
| **Remote driving / command injection** | Advisory intelligence only; not a teleop or fleet control plane |
| **Raw log pooling as default row** | Legal/IP nightmare; processed records + optional clip tier only |
| **Tier-1 internal flywheel competition** | Do not lead with Tesla, Waymo, Zoox, Momenta, DeepRoute |
| **Safety Pool replacement** | Regulatory homologation scenarios stay with Safety Pool; we cover field-derived failures |
| **Full Cosmos Curator clone day one** | Preprocessing wedge, not petabyte curation platform pitch |
| **Sidewalk bots** | Out of founder scope (Serve, Starship, Cartken) |
| **Pool-first GTM** | Club exchange is P3; P1 sells siloed preprocessing + CI cards |
| **Mandatory upload on customer #1** | Q3 = B: silo first, pool upsell later |

### 2.3 Locked strategic decisions (from research)

| ID | Decision | Implication for engineering |
|----|----------|----------------------------|
| **Q1** | **D** — CI cards → preprocessing → shared pool | Ship regression-card export in P1; pool index is a module, not the first deployable |
| **Q2** | **D** — Outreach Nuro / Wayve first | MCAP + multi-sensor fusion (LiDAR+camera) in bootstrap data; platform/partner scale narrative |
| **Q3** | **B** — No mandatory upload on customer #1 | L3 APIs and governance stubs only; no upload gate in v1 hosted stack |
| **Q4** | **B** — CLI + self-annotation + local pool UI | No enterprise SSO/dashboard blocker for M0; web pool UI can be local-first |
| **Q5** | **A** — Full OSS from day 1 | Public repo: ingestion bindings, schema, heuristics, CLI; commercial hosted layer separate |
| **Q6** | **C + D** — Tooling/protocol public; exchange endgame + hosted pool later | Protocol + record schema open; multi-tenant pool, credits, governance = paid year 2+ |
| **Data path** | Open source → founder car (wk 4+) → fleet (mo 4+) | No customer data dependency for M0 demo |
| **Hardware** | Mac Mini + school Colab GPU + personal car | L1/heuristics/CLI on Mac; enrichment Colab-first (D7); Mac MPS fallback |

### 2.4 Success metrics (targets)

| Metric | Target | Phase |
|--------|--------|-------|
| MCAP ingestion throughput | ≥50k msgs/sec sustained per worker | L1 production |
| Clip extraction latency | p99 &lt;200 ms (10 s window) | L1 |
| Laptop vertical slice | &lt;60 s for ~5 min MCAP → ranked records | M0 |
| Fleet ingestion density | ≥1 TB/day per 8-core ingestion node | P2 |
| Design partner | 1 logo uploading real bags | Month 4–6 |
| Paid silo pilot | 1 contract | M1 |
| Pool contributors | 2+ logos exchanging records | M2 (12–18 mo realistic) |

---

## 3. System architecture (L1 / L2 / L3)

### 3.1 Layer overview

| Layer | Name | Runtime | Responsibility |
|-------|------|---------|----------------|
| **L1** | Ingestion engine | **C++** (mcap-cpp) + thin Python launcher | MCAP read, channel index, schema registry, clip byte-range extraction, optional Arrow IPC export |
| **L2** | Edge-case intelligence | **Python** | Orchestration, heuristic triggers, ML self-annotation, record assembly, regression cards, CLI |
| **L3** | Shared pool | **Python** (hosted, multi-tenant later) | Cross-company index, upload/consume APIs, advisory query, governance — **P3 gate** |

**Data unit:** Processed **edge-case record** (JSON, schema-versioned): trigger type, timestamps, window, heuristic/VLM tags, scenario descriptor, optional clip pointer or embedding attachment tier.

### 3.2 Production architecture diagram (description)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         DATA SOURCES (§6)                                   │
│  Open MCAP (PandaSet/ZOD) │ Founder car MCAP │ Customer fleet bags (S3/GCS) │
└───────────────────────────────┬─────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  L1 — INGESTION ENGINE (C++20, mcap-cpp)                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐  │
│  │ MCAP Reader  │→ │ Channel Index│→ │ Schema       │→ │ Clip Extractor  │  │
│  │ (zero-copy)  │  │ (time-ordered)│  │ Registry     │  │ (byte ranges)   │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  └────────┬────────┘  │
│                                                                  │          │
│  Boundary: pybind11 `IngestSession` / `ClipView`  OR  subprocess + Arrow IPC   │
└──────────────────────────────────────────────────┬──────────────────────────┘
                                                   │
                                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  L2 — EDGE-CASE INTELLIGENCE (Python 3.12)                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌──────────────────┐  │
│  │ Orchestrator│→ │ Heuristics  │→ │ ML Worker   │→ │ Record Builder   │  │
│  │ (job queue) │  │ CAN/IMU/GPS │  │ DINO+SAM2   │  │ JSON + cards     │  │
│  └─────────────┘  └─────────────┘  │ (PyTorch)   │  └────────┬─────────┘  │
│                                      └─────────────┘           │            │
│  ┌─────────────┐  ┌─────────────┐                            │            │
│  │ CLI         │  │ Local Pool  │◄───────────────────────────┘            │
│  │ `cde ingest`│  │ UI (browse) │                                         │
│  └─────────────┘  └─────────────┘                                         │
└──────────────────────────────────────────────────┬──────────────────────────┘
                                                   │  (P3, year 2+)
                                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  L3 — SHARED POOL (hosted, gated)                                           │
│  Upload API │ Record index (scenario signatures) │ Query │ Advisory intel   │
│  Club rule: contribute processed records → consume shared index             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.3 Component boundaries

**L1 ingestion worker (C++):**
- Opens MCAP (local path or streaming adapter); builds per-channel timestamp index.
- Registers ROS 2 / protobuf / custom schemas; normalizes time base (nanoseconds).
- On trigger callback or time range request: returns `ClipView` — metadata + pointers to message byte ranges (no full-bag copy).
- Exposes pybind11 module `cde_l1` for in-process use; optional `cde_l1_worker` subprocess for fleet jobs.

**L2 orchestrator (Python):**
- Owns job lifecycle: `ingest → index → trigger scan → clip → annotate → emit`.
- Schedules ML on clipped windows only (not full bag decode in Python).
- Writes edge-case records to local store (SQLite/JSONL) and exports regression cards (CI artifact format).

**L3 pool service (deferred multi-tenant):**
- v0: local pool UI reads same JSON schema from disk.
- Production: object store for optional clip tier; Postgres or similar for record index; upload gate enforced only when club rule is active (not customer #1).

### 3.4 Scaling path (vertical slice → fleet)

| Stage | Deployment | L1 | L2 | L3 |
|-------|------------|----|----|-----|
| **M0 — Laptop** | Single Mac Mini | pybind11 in-process | Same machine, MPS | Local JSON dir + static UI |
| **P1 — Design partner** | 1 VM + customer S3 | 1 C++ worker | Python orchestrator co-located | Silo-only; no upload gate |
| **P2 — Hosted ingestion** | K8s / VM fleet | N ingestion pods (horizontal) | M ML workers (queue-driven) | Per-tenant silo index |
| **P3 — Exchange** | Multi-tenant SaaS | Shared ingestion plane | Shared ML pool (GPU nodes) | Gated global index + governance |

**Horizontal scaling rule:** L1 workers are **embarrassingly parallel per bag**; L2 ML workers scale on **clip queue depth**; L3 scales on **index query QPS** (read-heavy).

### 3.5 Failure and isolation

- L1 crash: subprocess boundary per bag prevents Python orchestrator death.
- ML OOM: clip-level retry with smaller model tier (SAM2 base → mobile).
- Partial bag: emit records for decoded windows; mark bag `partial` in provenance.
- Idempotency: `bag_id + trigger_id` deterministic keys for record upsert.

---

## 4. Technology stack

### 4.1 Languages and runtimes

| Component | Choice | Notes |
|-----------|--------|-------|
| L1 core | **C++20** | `std::span`, constexpr, structured bindings; no legacy C++11 paths |
| L2 / tooling | **Python 3.12** | `asyncio` orchestration; `typing`; E1 locked interpreter |
| Binding | **pybind11** | Primary L1↔L2 boundary for clip handoff and index queries |
| Batch isolation | **subprocess** + optional **Arrow IPC** | Fleet jobs; crash containment; columnar clip batches to ML |

### 4.2 L1 dependencies

| Library | Role |
|---------|------|
| **mcap-cpp** | MCAP read, summary parsing, chunked zero-copy access — **sole runtime build-on-top dependency (F1)** |
| **lz4 / zstd** | MCAP compression handlers |
| **fmt** | Logging |
| **Google Benchmark** | Ingestion perf regression tests |
| **Google Test** | Unit tests for index + clip logic |

**Dev/CI tooling only (not runtime deps — F1):**

| Tool | Role |
|------|------|
| **MCAP CLI** (`mcap convert`, `doctor`, `filter`, `info`) | comma/PandaSet bootstrap, CI golden tests, bag normalization |
| **Foxglove `nuscenes2mcap`** | Gate 4 internal P/R only (D17); skip Platform upload scripts |
| **Foxglove Studio** | Optional engineer viz for sidecar clips — zero runtime dependency |

### 4.3 L2 dependencies

| Library | Role |
|---------|------|
| **PyTorch 2.x** | ML runtime; **MPS** on Apple Silicon (Mac Mini); CUDA in cloud GPU workers |
| **Grounding DINO** | 2D detection on clip frames (Apache 2.0) |
| **SAM2** | Masks on detected regions |
| **OpenCV / Pillow** | Image decode from L1 clip bytes |
| **Pydantic** | Edge-case record schema validation |
| **Typer** | CLI |
| **FastAPI** (later) | Hosted ingestion API (P2) |

### 4.4 Data formats

| Format | Use |
|--------|-----|
| **MCAP** | Primary ingestion container (ROS 2 default) |
| **Edge-case record JSON** | Canonical L2/L3 exchange unit (schema-versioned) |
| **Regression card JSON/YAML** | CI artifact for P1 wedge |
| **Arrow IPC** (optional) | Columnar handoff L1→L2 for batched sensor columns |
| **nuScenes** (converter, later) | Secondary import path; not bootstrap |

### 4.5 Infrastructure (production trajectory)

| Concern | M0 | P2 production |
|---------|-----|----------------|
| Object storage | Local disk | S3 / GCS customer buckets |
| Queue | In-process | Redis / SQS / Pub/Sub |
| Metadata DB | SQLite | Postgres |
| GPU | Mac Mini MPS | NVIDIA L4/A10 cloud |
| CI | GitHub Actions | Same + ingestion benchmark gate |
| Observability | structlog | OpenTelemetry + metrics (msgs/sec, clip latency) |

### 4.6 Build and packaging

- **CMake** + **scikit-build-core** for `cde_l1` wheel (§16.5 locked).
- Monorepo layout: `native/` (L1), `python/cde/` (L2), `schemas/`, `ui/` (D11 / §16.5 locked).
- OSS release: wheels for macOS arm64 (MPS) + linux x86_64 (CUDA); C++ symbols via manylinux.

### 4.7 Performance targets (engineering targets, not SLAs)

| Workload | Target | Measurement |
|----------|--------|-------------|
| L1 decode + index | ≥50k msgs/sec sustained | Benchmark on PandaSet-scale MCAP, 8-core |
| L1 clip extract (10 s window) | p99 &lt;200 ms | After index built |
| L2 heuristic scan (5 min bag) | &lt;5 s | Python, indexed L1 callbacks |
| L2 ML per clip (7 frames, DINO+SAM2 base) | &lt;3 s on MPS | Mac Mini M2 Pro class |
| End-to-end laptop slice | &lt;60 s | 5 min MCAP → ranked records |
| Fleet worker throughput | ≥1 TB/day | Per 8-core ingestion node, steady bags |

---

## 5. C++ vs Python responsibility matrix

| Concern | C++ (L1) | Python (L2/L3) |
|---------|----------|----------------|
| MCAP open/read/summary | **Owner** | Never parse MCAP directly in hot path |
| Channel time indexing | **Owner** | Query via binding |
| Schema / message definition registry | **Owner** | Deserialize selected fields via binding or Arrow |
| Zero-copy message access | **Owner** | Receive spans / Arrow columns |
| Clip window extraction (byte ranges) | **Owner** | Request windows by timestamp |
| Image/video decode for ML | Optional native decode | **Owner** (PyTorch pipeline) |
| Heuristic triggers (IMU jerk, brake) | Optional native pre-scan | **Owner** (orchestration + rules) |
| Grounding DINO / SAM2 | — | **Owner** |
| VLM scene tagging (Qwen2.5-VL local) | — | **Owner** (optional tier) |
| Edge-case record assembly | — | **Owner** |
| Regression card export | — | **Owner** |
| CLI (`cde ingest`, `cde detect`, `cde pool`) | — | **Owner** |
| Local pool UI | — | **Owner** (static or lightweight web) |
| Job orchestration / retries | Worker process only | **Owner** |
| S3/GCS bag listing | — | **Owner** |
| Multi-tenant pool API + upload gate | — | **Owner** (L3, P3) |
| Auth / billing | — | **Owner** (hosted) |

### 5.1 Boundary selection rules

| Use **pybind11** when | Use **subprocess + IPC** when |
|-------------------------|-------------------------------|
| Laptop demo, low latency clip fetch | Fleet bag job, fault isolation |
| Single bag, interactive CLI | Parallel bag workers on one host |
| Index already in memory | Memory cap per worker enforced |
| Profiling ingestion + ML together | ML worker separate GPU machine |

### 5.2 Anti-patterns (explicitly forbidden)

- Python `mcap` reader on multi-GB fleet bags in production path.
- Duplicating edge-case schema in C++ and Python (single JSON schema source).
- Uploading raw MCAP to L3 index by default.
- Building L3 upload gate before customer #1 silo validation.
- **`rosbag-resurrector` / Hephaes / Cosmos Curator / Flightcase as runtime dependencies (F2).**
- **Foxglove SDK, Agent, Edge Sites, or Data Platform APIs as L1/L3 spine (F2/F4).**
- **Safety Pool auto-publish pipeline or SDL as canonical exchange row (F3).**
- **Semantic-Drive fork or YOLOE/Ultralytics (AGPL) in shipped CDE (F2).**

---

## 6. Data sources & bootstrap path

### 6.1 Bootstrap sequence (locked)

```
Week 1:    **car_l1_spike.mcap** (Gate 0 / E2)  →  L1 ingest + clip only
Week 2:    comma2k19 Example_1 (Gate 1)  →  heuristics + edge-case record JSON
Week 3:    PandaSet / ZOD        →  ML self-annotation on Mac Mini (MPS)
Week 4+:   Founder car MCAP      →  Real ODD + demo video + OSS release
Month 4+:  Customer fleet bags   →  Nuro / Wayve silo pilot (outreach)
```

No customer data required for M0. Customer fleet is **validation and revenue**, not **build blocker**.

### 6.2 Track 1 — Open datasets

| Dataset | License | Use in build | Commercial demo (YC, sales)? |
|---------|---------|--------------|--------------------------------|
| **`tests/fixtures/car_l1_spike.mcap`** (repo-generated, car topics only) | MIT (ours) | Gate 0 L1 ingest + clip unit tests | ❌ engineering only |
| **comma2k19** `Example_1` | MIT | Gate 1+ heuristics, real car IMU/GPS/camera | ⚠️ dev; marketing prefers PandaSet/ZOD/self |
| **PandaSet** | CC BY | LiDAR+camera fusion, MCAP experiments | ✅ |
| **ZOD / Zenseact** | CC BY-SA | Anomalies, weather, EU roads | ✅ (derivatives SA) |
| **nuScenes mini / CODA** | NC | Internal precision/recall benchmarks | ❌ Not in marketing until licensed |
| **Waymo / Argoverse** | Non-commercial | Skip | ❌ |

**License rule:** YC video, sales calls, SaaS demos → **PandaSet, ZOD, self-recorded MCAP only**.

### 6.3 Track 2 — Founder car (Mac Mini + personal vehicle)

| Tier | Hardware | Cost | Signals |
|------|----------|------|---------|
| Minimum | Phone (Arvos / CouchVision → MCAP) | $0 | Camera, IMU, GPS |
| Better | Phone + OBD-II dongle | ~$50 | + coarse speed |
| Best DIY | comma Panda / comma 3X | $200–1,250 | CAN: steering, wheel speed, brakes |

**Recording stack:** Phone mount → Arvos (iOS) or Sensor Logger → sync to Mac Mini → MCAP. Manual driving on Bay Area roads; IMU+GPS heuristic triggers; **disable cabin audio** (CA two-party consent); blur faces/plates in public demos.

**Mac Mini:** Apple Silicon, 16 GB+ RAM; PyTorch `mps` for DINO/SAM2; start with SAM2 base + DINO-T before larger models.

### 6.4 Week-by-week build alignment

| Week | Data | Engineering deliverable |
|------|------|-------------------------|
| **1** | `car_l1_spike.mcap` only (Gate 0 / E2) | C++ mcap-cpp reader; channel index; pybind11 `IngestSession` / `ClipView`; clip cutter — **no heuristics, no comma2k19** |
| **2** | comma2k19 Example_1 (Gate 1) | D6 heuristics → edge-case record JSON v0.1; CLI `cde detect` |
| **3** | PandaSet or ZOD | Grounding DINO + SAM2 on MPS; record enrichment |
| **4** | Founder car MCAP | Real ODD clips; local pool UI; demo video |
| **5+** | Mix open + self | OSS release; polish CLI; outreach prep (Nuro/Wayve) |

### 6.5 Customer fleet path (month 4+)

| Step | Action |
|------|--------|
| 1 | Demo video on public/self data only |
| 2 | Outreach tier 1: **Nuro**, **Wayve** (Q2) |
| 3 | Fallback: May Mobility, Motional |
| 4 | Secondary trucks: Gatik, Plus.ai |
| 5 | Parallel month 4–6: NVIDIA Inception (channel, not customer #1) |
| 6 | Pilot: weekly bag processing; silo-only contract (Q3: no mandatory upload) |

**Connector requirements for fleet bags:** S3/GCS read-only IAM; optional ROS 2 bag → MCAP normalization job (Python orchestrated, L1 compatible); provenance fields on every record (`source_fleet`, `bag_uri`, `schema_version`).

### 6.6 What bootstrap proves vs does not prove

| Proves (M0) | Does NOT prove (requires M1+) |
|-------------|-------------------------------|
| MCAP → records → pool UI pipeline | Petabyte fleet throughput at production SLAs |
| Self-annotation quality (benchmark CODA internally) | Cross-OEM pool network effects |
| Credible "we drove in the Bay" demo | Data moat vs Tesla/Waymo internal flywheels |
| OSS adoption potential | WTP until paid silo pilot |

### 6.7 Proof milestones

| Milestone | Criteria |
|-----------|----------|
| **M0** | OSS CLI on open data + founder car; YC-ready demo |
| **M1** | Paid silo pilot; 1 logo; real bags weekly |
| **M2** | 2+ logos contributing records; pool mechanics testable |

---

## 7. Core schemas

### 7.1 Design principles

- **Exchange unit (default row):** processed **edge-case record** — not raw MCAP, not full bag pointers as the shared artifact.
- **CI unit (P1 wedge):** **regression test card** — human- and machine-readable eval artifact derived from one or more edge-case records.
- **Versioning:** every artifact carries `schema_version`; readers must reject unknown major versions and warn on unknown minors.
- **Immutability:** records and cards are append-only; corrections create a new `record_id` / `card_id` with `supersedes` linkage.
- **Privacy default:** no PII in shared fields; clip pointers are optional, anonymized sidecars; faces/plates blurred before any pool upload.

Canonical JSON Schema files (repo):

| File | Purpose |
|------|---------|
| `schemas/edge-case-record.v0.1.schema.json` | Atomic detection + enrichment unit |
| `schemas/regression-test-card.v0.1.schema.json` | CI-facing eval artifact |
| `schemas/pool-index-entry.v0.1.schema.json` | L3 index row (future; metadata-only) |

### 7.2 Edge-case record v0.1 — field list

**Top-level (required unless noted)**

| Field | Type | Description |
|-------|------|-------------|
| `schema_version` | string | `"0.1"` |
| `record_id` | string (UUID v4) | Stable primary key |
| `created_at` | string (ISO 8601 UTC) | Record creation time |
| `source` | object | Provenance (see below) |
| `trigger` | object | What fired detection |
| `window` | object | Temporal (and optional spatial) bounds |
| `scenario` | object | Normalized scenario descriptor |
| `signals` | object | Raw + derived signal snapshots at trigger |
| `enrichment` | object | Heuristic tags, 2D detections, optional VLM |
| `ranking` | object | Score, priority tier, dedup signature |
| `attachments` | object (optional) | Clip pointer, embeddings, exports |
| `supersedes` | string (optional) | Prior `record_id` if corrected |
| `license_tag` | string (optional) | e.g. `commercial_demo_ok`, `internal_only` |

**`source`**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `bag_uri` | string | yes | Local path, `s3://`, or content-addressed hash URI |
| `bag_fingerprint` | string | yes | SHA256 of first 1 MB + size (fast) or full hash |
| `fleet_id` | string | no | Customer / founder fleet slug |
| `vehicle_id` | string | no | Anonymized vehicle ID |
| `run_id` | string | no | Drive session ID |
| `odds` | string[] | no | ODD tags: `urban`, `highway`, `rain`, etc. |
| `recorder` | string | no | e.g. `ros2`, `arvos`, `comma` |

**`trigger`**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | enum | yes | `heuristic`, `vision`, `vlm`, `manual`, `composite` |
| `name` | string | yes | e.g. `hard_brake`, `high_jerk`, `construction_zone` |
| `confidence` | float [0,1] | yes | Detector confidence |
| `trigger_time_ns` | int64 | yes | Log-time of trigger event (nanoseconds) |
| `detector_version` | string | yes | e.g. `heuristics/0.1.0` |

**`window`**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `start_time_ns` | int64 | yes | Clip start (default: trigger − 5 s) |
| `end_time_ns` | int64 | yes | Clip end (default: trigger + 2 s) |
| `topics` | string[] | yes | MCAP channels included in clip |
| `frame_anchor` | object | no | `{ "topic": "/camera/front", "frame_index": 42 }` |

**`scenario`**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `summary` | string | yes | One-line human description |
| `taxonomy` | string[] | no | Controlled vocab: `pedestrian_near_miss`, `debris`, `cut_in`, … |
| `severity` | enum | no | `info`, `low`, `medium`, `high`, `critical` |
| `weather` | string | no | From tags or VLM |
| `road_type` | string | no | `urban`, `highway`, `parking_lot`, … |

**`signals`** (snapshot at trigger — not full time series)

| Field | Type | Description |
|-------|------|-------------|
| `longitudinal_accel_mps2` | float | IMU/CAN-derived |
| `lateral_accel_mps2` | float | |
| `speed_mps` | float | GPS/OBD/CAN |
| `steering_angle_deg` | float | if available |
| `jerk_mps3` | float | derived |
| `gps` | object | `{ lat, lon, accuracy_m }` — coarse, optional |

**`enrichment`**

| Field | Type | Description |
|-------|------|-------------|
| `heuristic_tags` | string[] | Rule outputs |
| `detections_2d` | array | DINO boxes: `{ frame_index, label, score, bbox_xyxy }` |
| `masks_2d` | array | SAM2 refs or RLE paths |
| `vlm` | object | optional: `{ model, scene_tags[], rationale, confidence }` |
| `embedding_ref` | string | optional URI to vector (not inline by default) |

**`ranking`**

| Field | Type | Description |
|-------|------|-------------|
| `score` | float | Composite rank within run |
| `priority` | enum | `P0`–`P3` |
| `dedup_key` | string | Hash of (trigger type + taxonomy + ~1 s time bucket + geo cell) |
| `is_duplicate_of` | string | optional `record_id` |

**`attachments` (optional tier)**

| Field | Type | Description |
|-------|------|-------------|
| `clip_uri` | string | Sidecar MCAP (local or object store) |
| `clip_fingerprint` | string | Content hash |
| `preview_uri` | string | MP4 for pool UI `<video>` (D9) |
| `thumbnail_uri` | string | Single-frame JPG preview |

### 7.3 Regression test card v0.1 — field list

Cards are **downstream CI artifacts**. One card typically references **one primary edge-case record**; composite scenarios may reference multiple.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `schema_version` | string | yes | `"0.1"` |
| `card_id` | string (UUID) | yes | CI artifact ID |
| `title` | string | yes | e.g. `"Hard brake — pedestrian near crosswalk"` |
| `record_refs` | string[] | yes | One or more `record_id`s |
| `eval_spec` | object | yes | What sim/stack must reproduce |
| `acceptance` | object | yes | Pass/fail criteria |
| `stack_context` | object | no | Perception/planning version pins |
| `exports` | object | no | OpenSCENARIO, pytest marker, GitHub Actions snippet |
| `status` | enum | yes | `draft`, `approved`, `regression`, `flaky`, `retired` |
| `created_at` | string | yes | ISO 8601 |

**`eval_spec` (minimal v0.1)**

```json
{
  "type": "replay_window",
  "window_ref": "primary_record.window",
  "required_topics": ["/camera/front", "/imu"],
  "inject_at_time_ns": "<trigger_time_ns>",
  "tags": ["regression", "edge-case", "hard_brake"]
}
```

**`acceptance`**

```json
{
  "metrics": [
    { "name": "max_decel_mps2", "op": "<=", "value": -3.5 },
    { "name": "collision", "op": "==", "value": false }
  ],
  "human_review_required": false
}
```

### 7.4 Relationship: edge-case record ↔ regression test card

```
MCAP bag
  └─► L1 clip extraction
        └─► L2 detection → edge-case record(s)     [atomic, machine-generated]
              └─► card builder (manual or auto)    [CI-facing, curated]
                    └─► regression test card
                          └─► CI / sim harness (customer stack)
```

| Concept | Edge-case record | Regression test card |
|---------|------------------|----------------------|
| **Purpose** | Capture *what happened* in the fleet | Define *how to re-test* it |
| **Granularity** | One trigger event | One eval scenario (may merge records) |
| **Mutability** | Immutable; supersede on fix | Versioned workflow (`draft` → `approved`) |
| **Sharing default** | Processed metadata (+ optional clip) | Card JSON + eval spec; rarely raw sensor |
| **P1 wedge** | Always produced by pipeline | Primary customer deliverable |

**Cardinality rules**

- **1 record → 0..1 card** at ingest (auto-card only for high-confidence P0/P1).
- **1 card → 1..N records** when composite (e.g. cut-in followed by hard brake).
- **Card without record** forbidden in v0.1 — cards must anchor to at least one record for traceability.
- **CI export (D15):** card copies `clip_uri`, `preview_uri`, and `clip_fingerprint` from primary record so CI tarball needs no pool DB lookup.

### 7.5 Planned schema v0.2 (F2 — borrow patterns, post-M1)

Not implemented in Gate 0. Fields inspired by competitive code study — no external schema dependency.

**Edge-case record v0.2 additions (Flightcase + Safety Pool alignment):**

| Field | Source inspiration | Purpose |
|-------|-------------------|---------|
| `window.clock_domain_id` | Flightcase | Multi-sensor sync honesty |
| `window.uncertainty_ns` | Flightcase | Trigger/window boundary confidence |
| `declared_gaps[]` | Flightcase | Topics/time ranges missing from clip — credibility on partial AV bags |
| `integrity.catalog_hash` | Flightcase | Optional content hash for P3 exchange |
| `integrity.signature` | Flightcase | Optional signed manifest tier (P3) |
| `scenario.taxonomy.*` | Safety Pool / PAS 1883 | OpenLABEL-compatible ODD tags for pool search + SP coverage diff |

**Regression test card v0.2 additions (Roboticks — F5):**

| Field | Purpose |
|-------|---------|
| `requirement_refs[]` | Stable IDs e.g. `CDE-REG-hard-brake-001` for traceability |
| `exports.roboticks_stub` | Optional generated pytest when customer uses Roboticks |
| `exports.openscenario_ref` | Tier-2 sim export attachment — labeled *sim export, not homologation scenario* |

---

## 8. L1 C++ MCAP ingestion & clip pipeline

L1 is **C++-first** for throughput. Python orchestrates jobs; it does not parse multi-GB bags in the hot path.

### 8.1 Components

| Component | Language | Responsibility |
|-----------|----------|----------------|
| `cde-ingest` | C++20 | MCAP read, index, decompress, scan |
| `cde-clip` | C++20 | Time-window extraction → sidecar MCAP |
| `cde-index` | C++20 | Chunk/summary index for seek |
| `cde_py.bindings` | pybind11 | Python API: `IngestSession`, `ClipRequest`, `MessageView` |
| Job runner | Python | Batch orchestration, config, progress |

### 8.2 mcap-cpp integration

- **Library:** [foxglove/mcap](https://github.com/foxglove/mcap) C++ headers (`mcap/reader.hpp`, `mcap/writer.hpp`).
- **Build:** CMake + FetchContent or submodule; static link into `libcde_l1`.
- **Reader lifecycle:** `open` → `readSummary()` → iterate with `ReadMessageOptions`.

**Read order (`ReadOrder`)**

| Mode | Use in CDE |
|------|------------|
| `FileOrder` | **Default for full-bag scan** — sequential I/O, best cache behavior |
| `LogTimeOrder` | Clip extraction and frame-accurate ML after index built |
| `ReverseLogTimeOrder` | Debugging only |

Production rule: **first pass = `FileOrder`**; **second pass = `LogTimeOrder`** over `[window.start, window.end]`.

### 8.3 Compression handling

| Concern | Production approach |
|---------|---------------------|
| Decompress | mcap-cpp transparent dechunk in reader |
| Write (clip output) | `Zstd` + Fast level for sidecars; `Lz4` for local dev |
| CRC | Enable chunk CRC on write for fleet durability |

**Target SLOs (engineering targets, not customer SLAs)**

| Metric | Laptop (Mac Mini) | Fleet worker (16 vCPU) |
|--------|-------------------|------------------------|
| Sequential read (uncompressed) | ≥ 200 MB/s | ≥ 800 MB/s |
| Zstd decompress + parse | ≥ 80 MB/s | ≥ 400 MB/s |
| Message dispatch | ≥ 50k msg/s | ≥ 250k msg/s |
| Clip extract (7 s window, 3 topics) | ≤ 500 ms | ≤ 150 ms |

### 8.4 Clip cutter

**Input:** `ClipRequest { bag_uri, start_time_ns, end_time_ns, topics[], copy_schemas=true }`

**Algorithm:** resolve chunk indexes → seek per topic → filter by `logTime` → copy schemas once → stream to `McapWriter` → emit `clip_manifest.json`.

**Output layout:** `artifacts/clips/{record_id}.mcap` + `{record_id}.manifest.json` + `{record_id}.preview.mp4` (camera topic) + `{record_id}.thumb.jpg`

### 8.5 Python ↔ C++ boundary

| Approach | When |
|----------|------|
| **pybind11** (default) | In-process: `IngestSession.open()`, `IngestSession.clip()` |
| **subprocess CLI** | Crash isolation: `cde-clip --json-spec req.json` |
| **Arrow IPC** (optional) | Zero-copy image batches to PyTorch (Phase 4+) |

---

## 9. L2 Detection & enrichment

L2 stays **Python** (orchestration, PyTorch, rules). Inputs are L1 `MessageView` or clip sidecars.

### 9.1 Pipeline stages

```
L1 scan (FileOrder) → signal extractors → heuristic triggers → window builder
  → L1 clip (C++) → enrichment queue (DINO+SAM2, optional VLM) → edge-case record JSON
  → optional auto regression card
```

### 9.2 Heuristic triggers v0.1 (D6 locked)

**Signal sources:** IMU (accel/jerk) + GPS (speed anomalies). **Video gate:** trigger fires only when at least one camera frame exists in the clip window — ensures DINO/SAM2 always has input (D10).

| Trigger | Condition | Default threshold |
|---------|-----------|-------------------|
| `hard_brake` | longitudinal accel | ≤ −3.5 m/s² for ≥ 200 ms |
| `harsh_corner` | lateral accel | ≥ 2.5 m/s² |
| `high_jerk` | d(accel)/dt | ≥ 5 m/s³ |
| `speed_anomaly` | GPS vs prior speed delta | > 15% for ≥ 1 s |
| `topic_gap` | inter-message gap on camera | > 3× median interval |

**CAN triggers** (hard brake from wheel speed): add when comma2k19 or nuScenes CAN path lands (post Gate 1).

**Hysteresis:** 3 consecutive samples above threshold; 2 s cooldown per trigger type per run. Config: `config/heuristics.v0.1.yaml`.

### 9.3 Grounding DINO + SAM2 (D7 locked — auto tier)

**Strategy:** Auto-detect GPU at enrich time; use max tier that fits; downgrade on OOM. **Single-frame inference only** (no SAM2 video tracking — avoids linear VRAM growth).

| GPU detected | DINO | SAM2 | VLM | Notes |
|--------------|------|------|-----|-------|
| **A100 40GB** | Base | Large | Qwen2.5-VL-7B 4-bit (optional) | Best demo quality |
| **T4/L4 16GB** | Base | Small → Tiny on OOM | Off | Colab default |
| **Mac MPS** | Tiny | Tiny | Off | Fallback when Colab unavailable |
| **CPU only** | Skip enrichment; mark record `enrichment_pending` | | | Retry on Colab |

**Colab workflow:** Mac runs `cde detect` → clip sidecars → `scripts/colab_enrich_backfill.ipynb` (or `cde enrich --backend colab`) uploads clips, merges enrichment JSON back.

### 9.7 Ranking & dedup (D16 locked)

**Local ranking (within run):**

```
score = w1 * severity + w2 * trigger_confidence + w3 * enrichment_richness
```

- Severity weights: `critical=1.0`, `high=0.8`, `medium=0.5`, `low=0.2`.
- Enrichment richness: +0.1 per detection above threshold, cap +0.3.
- Output `ranking.score` and `ranking.priority` (`P0`–`P3` from score tiers).

**Local dedup (within run):** same `dedup_key` within 30 s → keep highest score.

**`dedup_key`:** `hash(trigger_name + taxonomy + floor(trigger_time_ns / 1e9) + geo_cell_6)`  
(`geo_cell_6` = ~1 km H3/geohash cell from GPS at trigger)

**Cloud dedup (D21 publish API):** reject insert if same `dedup_key` already indexed within **24 h** and **same geo cell** — prevents pool spam at same intersection. Return `409 Conflict` + existing `record_id` for client merge.

### 9.4 Optional VLM enrichment

- **Model:** Qwen2.5-VL-7B-Instruct (local, off by default).
- **Not in hot path:** async after record creation; `--vlm` flag to enable.
- **Borrow from Semantic-Drive (F2 — patterns only, no fork):** WOD-E2E taxonomy enums → `scenario.taxonomy`; symbolic grounding verifier (VLM claims vs DINO boxes); optional scout/judge consensus tier. Post-M1 only — too slow for `<60 s` laptop slice default path.

### 9.5 Compute placement (D2/D7 locked)

| Environment | Role |
|-------------|------|
| **Mac Mini** | L1 C++ ingest, heuristics, CLI, pool UI, clip cutting; MPS fallback enrich (Tiny+Tiny) |
| **School Colab GPU (primary for enrichment)** | Auto max tier: Base+Small (T4) → Base+Large (+ VLM on A100); batch clip enrichment |
| **Colab TPU** | **Not used** — PyTorch/CUDA stack; no porting benefit |

---

## 10. CLI & local pool UI

### 10.1 CLI (`cde` — Typer + Rich)

| Command | Purpose |
|---------|---------|
| `cde doctor` | Check C++ ext, GPU/MPS, schema, disk; **bag health QC** (borrowed from Resurrector categories — F2) |
| `cde ingest <path>` | L1 scan bag(s); write manifest |
| `cde detect <bag\|manifest>` | L2 heuristics → edge-case records |
| `cde enrich <record.json>` | DINO+SAM2 (+ optional VLM) on clip |
| `cde clip <record.json>` | Re-cut clip from source bag |
| `cde card create <record.json>` | Build regression card |
| `cde card export <card.json>` | Emit GH Actions / pytest stub |
| `cde pool init` | Create local pool DB under `~/.cde/pool/` |
| `cde pool add <records/>` | Index records into local pool |
| `cde pool search` | Filter by taxonomy, severity, date |
| `cde pool serve` | Start local pool UI (FastAPI) — dev only |
| `cde publish <record.json>` | Upload record + clip tier to **cloud pool** (D21) |
| `cde subscribe` | Geo-filtered advisory feed from cloud pool (demo: second browser) |
| `cde run <bag>` | ingest → detect → enrich → pool add → auto-card; `--publish` pushes to cloud |

**Example:** `cde run ~/data/mcap/comma2k19/example_1.mcap --enrich --open-ui`

### 10.2 Local pool UI (D8 locked)

**Stack:** FastAPI + HTMX (server-rendered) + SQLite index. No React build for v0.1.

**Views:** record list (filter/search), record detail (JSON + enrichment), card detail, clip preview (`<video>` or frame thumbnails).

**Phase B (hosted):** same REST routes on Postgres + S3; Fly.io/Railway deploy for D21 demo; OIDC later for design partners.

---

## 10.3 Distributed demo — cloud pool stub (D21 locked)

**Demo pitch:** fast edge annotation → upload processed record → **nearby vehicles subscribe via geo query**. Mirrors FSD fleet loops (trigger → clip → annotate → upload → fleet learn / warn) without raw bag pooling.

**Architecture (v0.1 demo):**

```
Founder phone/car (Car A)          Cloud pool (Fly.io / Railway)       Demo viewer (Car B)
─────────────────────────          ─────────────────────────────       ───────────────────
MCAP → cde run --publish     ──►   POST /records + clip upload   ──►   GET /subscribe?lat=&lon&mode=same_cell
Colab enrichment                   Postgres + S3 (clips/previews)    HTMX poll: advisories in same geo_cell_6
```

**Geo routing (D23/D27):** publish computes `geo_cell_6` (~1 km geohash). Only subscribers in the **same cell** receive the advisory — not cars in adjacent cells (v1). Same field used for D16 dedup.

**Deploy target:** Fly.io or Railway — FastAPI + managed Postgres + S3-compatible bucket. Shared API key for demo (D25).

**Demo script (YC / VC / OEM — 90 s):**
1. `cde run --publish` with latency overlay (annotate in N seconds).
2. Tab 1 — cloud pool: record + DINO boxes + MP4 preview.
3. Tab 2 — **same geohash cell**: advisory list updates ("hard_brake near crosswalk").

**Liability (all pitches):** *Advisory intelligence only — engineering triage, not vehicle control.*

**Explicitly OUT of D21 stub:** MQTT mesh, V2V radio, stack-integrated maneuvering, multi-OEM governance, mandatory upload gate.

See **§17** for phased infrastructure; **§18** for pitch scripts.

**Phase 3 deliverable:** cloud URL live + demo video recorded against it.

## 11. Implementation phases

Production-grade **Py+C++ hybrid from Phase 0** — not a Python-only MVP with deferred native code.

| Phase | Timeline | Deliverables |
|-------|----------|--------------|
| **0 — Spikes (Gate 0 / E2)** | Week 1 | mcap-cpp + pybind11 hello; `car_l1_spike.mcap` L1 ingest + clip; benchmark harness — **no heuristics, no records** |
| **1 — L1 + thin L2 (Gate 1)** | Week 2 | `comma2mcap.py`; schema v0.1 JSON files; `cde ingest`, `cde detect` → records; `cde clip` |
| **2 — Enrichment** | Weeks 3–4 | DINO+SAM2 on MPS; PandaSet/ZOD path; Colab backfill script |
| **3 — Founder car + cloud demo** | Week 5 | Phone→MCAP; **Fly.io/Railway pool deploy**; `cde publish` + subscribe demo; demo video; OSS v0.1.0 |
| **4 — Design partner** | Months 2–4 | ≥50 GB bag scale; hosted ingestion stub; nuScenes internal eval |
| **5 — Production hardening** | Months 4–12 | Horizontal workers; SLAs; pool governance draft; security review |

---

## 12. C++ migration / production hardening criteria

C++ L1 ships in Phase 0 (D1/D13 locked). **Expand native surface** when metrics demand it.

### 12.1 Expand C++ when ANY trigger fires

| Trigger | Action |
|---------|--------|
| Sustained ingest < 100 MB/s on fleet worker | Profile decompress; add thread pool |
| Python bag scan > 2× C++ benchmark | Move remaining parse path to C++ |
| Clip latency p99 > 2 s | Optimize seek + parallel topic writers |
| Memory > 8 GB for single-worker ingest | Streaming-only pipeline |
| Customer requires ROS 2 node | Ship `cde_ingest_node` C++ component |

### 12.2 Keep in Python

Heuristic config, PyTorch enrichment, CLI, pool API, card workflow, ranking/dedup.

### 12.3 L1 production "done" definition

1. Resume after crash without duplicate clips.
2. Index-only read when summary present.
3. Compression matrix tested: None, Lz4, Zstd.
4. pybind ABI stable across patch releases.
5. Benchmark CI regression gate: >10% slowdown fails build.

---

## 13. Repo layout, testing, OSS license (D11 locked)

**Public repo name:** `cde` (Apache 2.0 monorepo — CLI name matches repo).

```
cde/
├── LICENSE                 # Apache-2.0
├── pyproject.toml          # Python package `cde`
├── CMakeLists.txt
├── schemas/
├── native/cde_l1/          # mcap-cpp ingest, clip, index
├── native/bindings/        # pybind11
├── python/cde/             # cli, l2, pool, cards, jobs
├── ui/                     # HTMX templates
├── deploy/                 # Fly.io / Railway Dockerfile + fly.toml
├── config/heuristics.v0.1.yaml
├── benchmarks/
├── tests/native/ + tests/python/ + tests/integration/
├── examples/records/
├── scripts/colab_enrich_backfill.ipynb
└── data/                   # gitignored; see §15
```

**Testing (D18 locked):**

| Layer | Tooling | Gate |
|-------|---------|------|
| C++ L1 | GoogleTest + golden MCAPs | Reader, decompress, clip byte-exact |
| Schemas | `jsonschema` in CI | Every example record/card validates |
| L2 heuristics | pytest + synthetic signals | Threshold edge cases |
| Enrichment | smoke (skip if no GPU) | One frame DINO+SAM2 |
| Integration | `cde run` golden diff | End-to-end on `car_l1_spike.mcap` (L1) + comma2k19 (L2) |
| Benchmark | CTest | >10% ingest slowdown fails build |
| Cloud API | Fly.io/Railway preview deploy in CI | `publish` + geo `subscribe` integration test |
| License | CI grep | Block NC datasets in `examples/` |

**Golden files:** `tests/fixtures/expected/` — strip timestamps/UUIDs for stable diff.

**License:** Apache 2.0 (Q5). Monetization boundary (Q6): OSS = CLI/schemas/heuristics; paid = hosted ingestion, connectors, multi-tenant pool.

---

## 14. Risks, metrics, open questions

### 14.1 Top risks

| # | Risk | Mitigation |
|---|------|------------|
| R1 | NVIDIA Cosmos commoditizes L1/L2 | Wedge on regression cards + CI + exchange protocol; **do not build on Curator (F2)** — own record/card schema |
| R2 | Safety Pool overlap | Fleet-log-derived CI artifacts, not homologation; **F3** complement framing + PAS 1883 tag alignment |
| R3 | Customers never share | Silo-first revenue (Q3); pool is P3 |
| R4 | Schema churn | Strict versioning; 6 mo deprecation window |
| R5 | Enrichment too slow | Colab GPU backfill; tiered models; async VLM |
| R6 | MCAP variance | L1 rebuild index pass; `topic_gap` QC trigger |
| R7 | License contamination | CI allowlist (§15, D17) |
| R8 | Solo bandwidth C++ + ML | Phase gates; don't expand native until triggers fire |

### 14.2 Metrics

| Metric | Vertical slice target | Fleet worker target |
|--------|----------------------|---------------------|
| Ingest throughput | ≥ 80 MB/s | ≥ 400 MB/s |
| `cde run` latency (demo bag) | ≤ 60 s | ≤ 30 s |
| Clip extract p99 | ≤ 500 ms | ≤ 150 ms |

### 14.3 Success gates

1. **M0:** OSS `cde run` + **cloud publish/subscribe demo** + demo video (D21).
2. **M1:** One paying silo pilot processing real bags weekly.
3. **M2:** Two logos contributing records under written data agreement.

### 14.4 Open questions

All planning blockers resolved — see **§16 Decision Tree Log** (Q/D/E/F-series + §16.5 agent defaults; decision tree complete).

---

## 15. Dataset Bootstrap Manifest

Production vertical slice = **MCAP in → L1 C++ ingest + clip → L2 heuristics + Colab enrichment → edge-case record → `cde publish` → cloud pool → geo subscribe (D21)**.

**Directory layout:** `/Users/tonychen/Desktop/yc/data/` with `mcap/`, `raw/`, `clips/`, `records/`.

**Bootstrap sequence (D5 + E2 locked):** No robot-lab or off-ODD fixtures. Gate 0 uses a **car-shaped MCAP** checked into the repo; real car data from comma2k19 onward.

```
Gate 0: tests/fixtures/car_l1_spike.mcap → L1 ingest + clip only (~1 MB, car topic names)
Gate 1: comma2k19 Example_1 (git lfs) → full D6 heuristics + records
Gate 2: PandaSet 3 seq → enrichment + commercial demo
Gate 3: ZOD mini → anomaly/weather coverage
Gate 4: nuScenes mini → internal P/R only
Gate 5: Founder car MCAP → real ODD demo
```

**Gate 0 fixture (generate once, commit to repo):**

```bash
python tools/fixtures/generate_car_l1_spike_mcap.py \
  -o tests/fixtures/car_l1_spike.mcap
```

Car topics only: `/imu/data`, `/camera/front/compressed`, `/gps/fix` (NavSatFix). No robot arm, no joint states, no resurrector dependency.

**Gate 0 spec:** `docs/spec/fixture-generator.md` (generator contract, rates, encoding).

**P1:** `data/raw/comma2k19` (`git lfs pull` required); `tools/convert/comma2mcap.py` — spec: `docs/spec/comma2mcap.md`.

**P2:** Hugging Face `georghess/pandaset` → `pandaset2bag` → `mcap convert`.

**P3:** Email opendataset@zenseact.com → `zod download --subset sequences --version mini`.

**P4:** nuScenes mini S3 + Foxglove `nuscenes2mcap` (Docker); never in marketing.

**Demo allowlist (D17 locked):** PandaSet, ZOD, self-MCAP only. **`car_l1_spike.mcap` is CI/L1 only — never in marketing.**

---

## 16. Decision Tree Log

### 16.1 Strategic (LOCKED)

| ID | Locked value |
|----|--------------|
| **Q1** | D — CI cards → preprocessing → shared pool |
| **Q2** | D — Nuro / Wayve first |
| **Q3** | B — No mandatory upload on customer #1 |
| **Q4** | B — CLI + self-annotation + local pool UI |
| **Q5** | A — Full OSS from day 1 |
| **Q6** | C+D — Tooling public; exchange + hosted pool paid later |

### 16.2 Technical decisions

| ID | Status | Locked value / next action |
|----|--------|----------------------------|
| **D1** | **LOCKED** | **C** — Py+C++ hybrid (mcap-cpp L1) from Phase 0; production grade |
| **D2** | **LOCKED** | Mac Mini = L1 + heuristics + CLI + pool UI; **Colab GPU = primary enrichment**; Mac MPS fallback |
| **D2b** | **LOCKED** | Reject Colab TPU |
| **D3** | **LOCKED** | **C** — always emit record; auto-card for P0/P1; card references `record_id` |
| **D4** | **LOCKED** | MCAP only for vertical slice |
| **D5** | **LOCKED** | **A** — Gate 0 = car-shaped L1 fixture in repo; then comma2k19 → PandaSet → ZOD → nuScenes one at a time |
| **D6** | **LOCKED** | **D** — IMU + GPS heuristics, **video-gated** (trigger only when camera frame in window; ensures enrichment has frames for D10) |
| **D7** | **LOCKED** | **D** — auto max GPU tier (A100: Base+Large+VLM; T4: Base+Small; Mac: Tiny+Tiny); downgrade on OOM; single-frame only |
| **D8** | **LOCKED** | **A** — FastAPI + HTMX server-rendered UI + SQLite; same REST shapes for production later |
| **D9** | **LOCKED** | **D** — sidecar clip MCAP (default) + auto-generated MP4/thumbnail for HTMX pool UI |
| **D10** | **LOCKED** | **D** — Demo-ready: fast annotation + enrichment + auto-cards + **cloud demo (D21)** + demo video; OUT: production fleet scale, multi-tenant auth |
| **D11** | **LOCKED** | **`cde` monorepo**, Apache 2.0, layout §13 (`native/` + `python/cde/` + `deploy/`) |
| **D12** | **LOCKED** | Demo bag → records + pool UI < 60 s |
| **D13** | **LOCKED** | mcap-cpp ingest + clip cutter in Phase 0; no Python hot-path MCAP |
| **D14** | **LOCKED** | **iPhone + Arvos** → MCAP (E6); week 5 Gate 5; CA: no cabin audio, blur faces/plates in demos |
| **D15** | **LOCKED** | **C** — card holds `record_refs[]` + copies `clip_uri` / `preview_uri` for self-contained CI export |
| **D16** | **LOCKED** | **C** — composite score locally; cloud publish rejects duplicate `dedup_key` within 24 h + same geo cell |
| **D17** | **LOCKED** | Demo allowlist: PandaSet, ZOD, self only (`car_l1_spike` = L1 tests only) |
| **D18** | **LOCKED** | **D** — C++ + pytest + golden integration + benchmark gate + **Fly.io/Railway preview API tests** (`publish`/`subscribe`) |
| **D19** | **LOCKED** | Colab GPU = primary enrichment dev path; Mac MPS = fallback when Colab unavailable |
| **D20** | **LOCKED** | **CDE** — *"GitHub Actions for AV failures — fleet logs to regression-ready edge-case records."* Repo/CLI: `cde` |
| **D21** | **LOCKED** | **C** — Real cloud stub (Fly.io/Railway): founder upload via `cde publish`; geo subscribe in second browser; FSD-style fleet loop demo |
| **D22** | **LOCKED** | Cloud DB = managed **Postgres** (local = SQLite per D8); same schema migrations |
| **D23** | **LOCKED** | Geo index = **`geo_cell_6` geohash** (same cell subscribe v1); migrate to **H3 res 7** before design partner; Redis GEO mirror Phase 2 |
| **D24** | **LOCKED** | Advisory delivery = **HTTP poll (Phase 0 demo) → SSE (Phase 1–2) → WebSocket (Phase 3 fleet SDK)** |
| **D25** | **LOCKED** | Auth = shared API key (demo) → per-tenant API keys (P1) → OIDC dashboard (P2) → mTLS OEM publish (P3) |
| **D26** | **LOCKED** | Clips in **S3-compatible storage** from Phase 0; never DB blob columns |
| **D27** | **LOCKED** | v1 subscribe scope = **`same_cell` only** (geohash-6); `radius_km` = H3 k-ring expansion in Phase 2 |

**Lock progress:** 53 LOCKED / 0 PENDING — **decision tree complete** (46 decision IDs: Q1–Q6, D1–D27 incl. D2b, E1–E7, F1–F5; + 7 agent implementation defaults in §16.5)

### 16.3 Implementation blockers (E-series)

| ID | Status | Locked value |
|----|--------|--------------|
| **E1** | **LOCKED** | **A** — Recreate project venv on **Python 3.12** (`/usr/local/bin/python3.12`); **Colab GPU = primary runtime for enrichment** (D2/D7); Mac 3.12 venv for L1 orchestration, CLI, tests, and MPS fallback only |
| **E2** | **LOCKED** | **A** — Gate 0 = L1 on **`car_l1_spike.mcap`** (car topics, no robot lab data); heuristics at Gate 1 (comma2k19) |
| **E3** | **LOCKED** | **C** — **Local pool first** (`cde pool serve`); deploy Fly.io when demo week arrives; Fly.io preferred when cloud lands |
| **E4** | **LOCKED** | **B** — School Colab GPU **sometimes available**; **Mac MPS Tiny+Tiny fallback required** when Colab has no GPU or session dies |
| **E5** | **LOCKED** | **C** — Build/test on **comma2k19** (Gate 1); **re-shoot final pitch video** on PandaSet or founder car before wide outreach |
| **E6** | **LOCKED** | **A** — **iPhone + Arvos** → MCAP on Mac Mini (Gate 5 / final demo re-shoot); iOS 16+, mount while driving manually |
| **E7** | **LOCKED** | **A** — Mac Mini **16 GB+ RAM**; MPS Tiny+Tiny fallback viable when Colab unavailable (E4) |

**E-series complete.** Planning blockers resolved — ready to start Gate 0 implementation.

### 16.4 Dependency / build-on-top decisions (F-series — locked 2026-06-19)

Competitive code study (see §22, `research.md` competitive code study). **Only one runtime build-on-top dependency.**

| ID | Status | Locked value |
|----|--------|--------------|
| **F1** | **LOCKED** | **Build on top of Foxglove `mcap-cpp` only** for L1 runtime. **MCAP CLI** + **`nuscenes2mcap`** = dev/CI tooling only — not production hot path. |
| **F2** | **LOCKED** | **No** runtime deps on Resurrector, Hephaes, Cosmos Curator/Xenna, Flightcase, Foxglove SDK, Semantic-Drive fork, or YOLOE/Ultralytics (AGPL). **Borrow patterns only** — health checks → `cde doctor`; taxonomy/symbolic verify → §9.4; provenance gaps → record v0.2. Resurrector stays in venv for dev comparison. |
| **F3** | **LOCKED** | **Safety Pool = complement**, not competitor P1. Borrow club/credit mechanics for P3 (§17.9). Align `scenario.taxonomy` with PAS 1883/OpenLABEL. Optional `cde sp pull` P2+ (read-only). **Never** auto-publish CDE records to SP. Pitch: *"Safety Pool is what regulators test. CDE is what your fleet hit last Tuesday."* |
| **F4** | **LOCKED** | **Foxglove Data Platform** = optional P2+ partner connector (customer already on BYOS); **not** L3 pool foundation. Roll own `cde-ring-writer` on mcap-cpp for §19 — not Foxglove SDK. |
| **F5** | **LOCKED** | **Optional export adapters P2+ only**, customer-driven: `--format roboticks`, tier-2 OpenSCENARIO on cards, Foxglove events API, Cosmos-Embed1 connector, Curator export adapter. Do not build unless paying pilot names the tool. |

**F-series complete.** Dependency strategy locked alongside E-series implementation blockers.

### 16.5 Agent implementation defaults (locked)

Autonomous Gate 0 agents MUST use these values; they override ambiguous alternatives elsewhere in this doc.

| Default | Locked value |
|---------|--------------|
| Python runtime | **3.12 only** — `/usr/local/bin/python3.12` per E1 |
| Repo layout | **`native/`** not `cpp/` (D11) |
| C++ unit tests | **Google Test** (not Catch2) |
| Python packaging | **scikit-build-core** (not meson-python) |
| CLI framework | **Typer** (not Click) |
| pybind11 API names | **`IngestSession`**, **`ClipRequest`**, **`ClipView`**, **`MessageView`** — replace any `L1Session` references |
| L2 trigger CLI | **`cde detect`** only — not `cde scan` |
| Gate 0 spec doc | **`docs/spec/fixture-generator.md`** — fixture generator contract |
| Gate 1 spec doc | **`docs/spec/comma2mcap.md`** — comma2k19 converter contract |
| JSON schemas | **`schemas/*.v0.1.schema.json`** — already authored; validate with `python3 -m json.tool` |

---

---

## 17. Distributed System Design (geo pool)

> Locked D22–D27. Phased from D21 cloud demo → silo pilot → multi-fleet → gated exchange.

### 17.1 Principles

- **Same REST API** locally (D8 SQLite) and hosted (Postgres + S3) — no format fork
- **Geohash cell = routing + dedup** — one `geo_cell_6` field for D16 dedup and D27 subscribe
- **Metadata hot, clips cold** — index in Postgres; clips in S3/R2 with signed URLs
- **Silo before exchange** — Q3: no upload gate until Phase 3 club rule
- **Advisory only** — HMI / data-ops feed; never planner or control injection

### 17.2 Phased infrastructure

| | Phase 0 Demo | Phase 1 Silo | Phase 2 Multi-fleet | Phase 3 Exchange |
|---|-------------|--------------|---------------------|------------------|
| **Deploy** | Fly.io / Railway | + customer S3 ingest | Horizontal workers | Multi-tenant SaaS |
| **Database** | Postgres (small) | Postgres + `tenant_id` RLS | Postgres + Redis | + governance tables |
| **Geo index** | `geo_cell_6` B-tree | + tenant composite | + Redis GEO mirror | + optional PostGIS analytics |
| **Delivery** | HTTP poll (HTMX 5 s) | + SSE stream | SSE default, WS optional | WS primary for fleet SDK |
| **Auth** | Shared API key | Per-tenant API keys | + OIDC dashboard | + mTLS OEM publish |
| **Upload gate** | None | None (Q3) | None | **Hard gate (club rule)** |
| **$/mo (infra)** | ~$15–30 | ~$300–800 | ~$2k–6k | ~$15k–45k |

### 17.3 Geo index algorithm (locked)

```python
geo_cell_6 = geohash.encode(lat, lon, precision=6)  # ~1 km cell
dedup_key = hash(trigger_name + taxonomy + floor(trigger_time_ns / 1e9) + geo_cell_6)
```

**Subscribe (v1, same cell):** subscriber at `(lat, lon)` → compute cell → `WHERE geo_cell_6 = :cell AND visibility IN (:allowed)`.

**Phase 2 radius:** expand via H3 k-ring or geohash neighbors for `radius_km=2`; canonical cell migrates to H3 res 7 before first OEM pilot.

**Cloud dedup:** unique constraint on `(dedup_key, geo_cell_6)` within 24 h → `409 Conflict` + existing `record_id`.

### 17.4 Internal fanout (Phase 2+)

```
POST /v1/records → dedup gate → Postgres insert → Redis PUBLISH advisory:{tenant}:{geo_cell}
                                                      → SSE/WS subscribers in that cell
```

Phase 0 skips Redis — HTMX polls Postgres every 5 s.

### 17.5 Tenancy (Phase 1+)

Every row: `tenant_id`, `visibility=silo|exchange`. Customer #1: silo only, no cross-tenant reads. Phase 3: `share_to_pool=true` + credits for exchange visibility.

### 17.6 Latency targets (advisory, not V2V)

| Segment | Target |
|---------|--------|
| D21 demo E2E | Trigger → second tab advisory **< 30 s** (ideal < 10 s) |
| Cloud index + fanout | p95 **< 500 ms** after publish accepted |
| Subscribe delivery | p95 **< 2 s** after index (SSE) |
| Production metadata advisory | p95 **< 15 s** from vehicle trigger (LTE upload) |
| **Not a target** | < 100 ms (that is V2V safety — out of scope) |

### 17.7 Migration triggers

| Trigger | Advance to |
|---------|------------|
| D21 demo + CI green | Phase 0 complete |
| 1 paid silo pilot + S3 ingest | Phase 1 |
| ≥3 tenants OR >10k records/day | Phase 2 (+ Redis) |
| 2+ OEMs signed exchange agreement | Phase 3 (+ upload gate) |

### 17.8 FSD fleet loop → CDE layer mapping

How deployed FSD stacks (Tesla, Waymo, etc.) handle field data — and where CDE sits. Public pattern, simplified; CDE uses **processed records**, not raw crown-jewel logs.

| FSD fleet stage | What incumbents do | CDE layer | CDE artifact |
|-----------------|-------------------|-----------|--------------|
| **1. Continuous log** | Ring buffer on vehicle; multi-camera + IMU/CAN at high rate | **L1** | MCAP index + byte-range clip pointers |
| **2. Trigger** | Shadow disagreement, hard maneuver, disengagement, model uncertainty | **L2 heuristics** | `trigger.type`, `trigger.name`, `confidence` |
| **3. Local clip** | Extract short window; often H.264 + metadata, not full trip | **L1 clip cutter** | Sidecar MCAP + MP4 preview (D9) |
| **4. Upload queue** | WiFi/charging/LTE prioritized; bandwidth-aware | **`cde publish`** | `POST /v1/records` + clip multipart |
| **5. Cloud label / enrich** | Auto-label, human review, training curation | **L2 enrichment** (Colab GPU) | DINO+SAM2 boxes, optional VLM tags |
| **6. Structured event** | Internal scenario DB row | **L2 record builder** | `edge-case-record.v0.1.json` |
| **7. Cloud dedup** | De-dupe same intersection / same failure mode | **L3 D16** | `409` on duplicate `dedup_key` + `geo_cell_6` |
| **8. Fleet-wide signal** | Internal map / hazard index | **L3 geo subscribe** | Advisory to same geohash cell (v1) |
| **9. Regression / training** | Sim replay, OTA model update | **P1 wedge** (separate from advisory) | Regression test card → customer CI |

**Pitch line:** Same pipeline shape as internal FSD loops; exchange unit is a **processed record**, making cross-OEM sharing legally and technically viable (P3).

**Deployment variants:**

| Mode | Where L1/L2 run | Upload timing |
|------|-----------------|---------------|
| Founder demo | Mac Mini batch | Immediate after `cde run --publish` |
| Design partner P1 | Customer VM or hosted worker on **their S3** | Weekly batch; no mandatory L3 (Q3) |
| Hosted ingestion P2 | K8s workers | Near-real-time after bag lands in tenant bucket |
| Future edge | Vehicle or depot (C++ L1 only) | Metadata first, clip async |

### 17.9 Cloud pool API reference (v0.1)

Base URL: `https://pool.cde.example/v1` (Fly.io/Railway in Phase 0).  
Auth: `Authorization: Bearer {CDE_POOL_API_KEY}` (D25).

**Local dev:** `cde pool serve` exposes identical routes against SQLite.

#### Publish record (D16 dedup)

```http
POST /v1/records
Content-Type: application/json
Idempotency-Key: {record_id}

{
  "schema_version": "0.1",
  "record_id": "550e8400-e29b-41d4-a716-446655440000",
  "source": { "fleet_id": "founder", "bag_fingerprint": "sha256:..." },
  "trigger": {
    "type": "heuristic",
    "name": "hard_brake",
    "confidence": 0.91,
    "trigger_time_ns": 1718800000000000000,
    "detector_version": "heuristics/0.1.0"
  },
  "signals": { "gps": { "lat": 37.7749, "lon": -122.4194, "accuracy_m": 8 } },
  "scenario": { "summary": "Hard brake near crosswalk", "severity": "high" },
  "ranking": { "dedup_key": "a1b2c3...", "priority": "P1", "score": 0.87 },
  "window": { "start_time_ns": "...", "end_time_ns": "...", "topics": ["/camera/front"] }
}
```

**Responses:**

| Code | Body |
|------|------|
| `201 Created` | `{ "record_id", "geo": { "cell": "9q8yyk", "geo_cell_6": "9q8yyk" } }` |
| `409 Conflict` | `{ "existing_record_id", "dedup_key" }` — D16 duplicate within 24 h + same cell |
| `422` | Schema validation errors |

**Clip upload (second step or multipart):**

```http
PUT /v1/records/{record_id}/attachments
Content-Type: multipart/form-data

  preview_mp4=@preview.mp4
  clip_mcap=@clip.mcap        # optional tier
  thumbnail_jpg=@thumb.jpg
```

#### Query records (pull)

```http
GET /v1/records?cell=9q8yyk&since=2026-06-19T00:00:00Z&limit=50
GET /v1/records?lat=37.7749&lon=-122.4194&mode=same_cell
GET /v1/records/{record_id}
GET /v1/records/{record_id}/preview.mp4          # signed URL redirect or stream
```

**Phase 2 radius (not v1 default):**

```http
GET /v1/records?lat=37.7749&lon=-122.4194&radius_km=2
```

Server expands geohash neighbors or H3 k-ring; post-filters haversine distance.

#### Subscribe — HTTP poll (Phase 0 demo, D24)

```http
GET /v1/subscribe?lat=37.7749&lon=-122.4194&mode=same_cell&since=2026-06-19T12:00:00Z
```

**Response:**

```json
{
  "subscriber_cell": "9q8yyk",
  "mode": "same_cell",
  "advisories": [
    {
      "record_id": "550e8400-...",
      "severity": "high",
      "summary": "Hard brake near crosswalk",
      "trigger": "hard_brake",
      "distance_m": 0,
      "preview_url": "/v1/records/550e8400-.../preview.mp4",
      "published_at": "2026-06-19T12:01:03Z"
    }
  ]
}
```

HTMX: `hx-get="/v1/subscribe?..." hx-trigger="every 5s"`.

#### Subscribe — SSE (Phase 1+)

```http
GET /v1/advisory/stream?lat=37.7749&lon=-122.4194&mode=same_cell
Accept: text/event-stream
Last-Event-ID: adv-019a2b3c
```

**Events:**

```
event: advisory
id: adv-019a2b3c
data: {"record_id":"...","severity":"high","summary":"Hard brake near crosswalk","trigger":"hard_brake","cell":"9q8yyk","distance_m":0,"preview_url":"...","published_at":"..."}

event: heartbeat
data: {"ts":"2026-06-19T12:00:00Z"}
```

HTMX: `hx-ext="sse" sse-connect="/v1/advisory/stream?..." sse-swap="advisory"`.

#### Subscribe — WebSocket (Phase 2 fleet SDK, Phase 3 primary)

```
WS /v1/advisory/ws

→ { "type": "subscribe", "tenant_id": "...", "lat": 37.77, "lon": -122.42, "mode": "same_cell" }
← { "type": "advisory", "record_id": "...", "severity": "high", ... }
→ { "type": "location", "lat": 37.771, "lon": -122.418, "ts": "..." }   // every 5–10 s
← { "type": "cell_changed", "old": "9q8yyk", "new": "9q8yyy" }            // rebind on move
```

#### CLI mapping

```bash
cde publish record.json --clip preview.mp4 [--clip-mcap clip.mcap]
cde subscribe --lat 37.7749 --lon -122.4194 --mode same_cell [--follow]  # --follow → SSE
cde run bag.mcap --enrich --publish --pool-url https://pool.cde.example
```

#### Geo index: Geohash vs H3 vs S2 (design rationale)

| Criterion | Geohash | H3 | S2 |
|-----------|---------|----|----|
| ~1 km cell | precision 6 | res 7 | level 13 |
| Cell shape | Rectangle | Uniform hex | Spherical quad |
| Neighbor / radius | 8 adjacent; edge ambiguity | `grid_disk(k)` clean | `GetCovering` |
| Ecosystem | Redis GEO, trivial | Uber fleet standard | Maps-scale |
| **CDE pick** | **Phase 0 demo (D21)** | **Canonical before OEM pilot (D23)** | Not used |

**Why not PostGIS on hot subscribe path:** subscribe is point-in-cell, not corridor polygon. Geohash/H3 B-tree queries are O(cells) with no extension deps. PostGIS reserved for Phase 3 **analytics** (route polyline, ODD polygon filters) — not live advisory fanout.

#### Phase 3 governance primitives (exchange)

| Entity | Purpose |
|--------|---------|
| `data_agreement` | Legal scope: metadata-only vs clip tier; retention; OEM ID |
| `contribution_ledger` | Records uploaded vs consumed; credit mint/burn |
| `record.visibility` | `silo` \| `exchange` \| `revoked` |
| `anonymization_profile` | Strip `vehicle_id`, coarse GPS, face/plate policy |

**Upload gate (Phase 3):** no `visibility=exchange` reads unless `contributions.credit_balance > 0` and active `data_agreement`. Processed records only — clip tier optional per agreement.

---

## 18. Pitch guide (YC · VC · OEM)

### 18.1 Brand (D20 locked)

| Field | Value |
|-------|-------|
| **Name** | **CDE** (Continuous Data Engine) |
| **One-liner** | GitHub Actions for AV failures — fleet logs to regression-ready edge-case records. |
| **CLI / repo** | `cde` (Apache 2.0) |

**Audience taglines:**

- **AV startup:** "Stop scrubbing petabytes. Ship regression cards from fleet logs."
- **VC:** "Open-source fleet intelligence — silo tooling today, REM-style exchange tomorrow."
- **OEM technical:** "MCAP-native edge-case records: C++ ingest, ML enrichment, CI export."

### 18.2 Pitch structures

**30 seconds:** Problem (manual scrub) → wedge (regression cards from MCAP) → silo pilot ask. Do **not** lead with pool or V2V.

**2 minutes:** + L1/L2/L3 architecture → business model (silo Year 1, pool Year 2+) → M0/M1/M2 gates → design partner ask.

**OEM 45 min:** Architecture → S3 integration → performance targets → record schema walkthrough → silo contract (Q3: no mandatory upload) → advisory as future module.

### 18.3 Demo script (90 s — all audiences)

**Final pitch video (E5):** record on **PandaSet or founder car** — not comma2k19. comma2k19 is for engineering validation only.

1. Terminal: `cde run founder.mcap --enrich --publish` (latency overlay)
2. Tab 1: cloud pool — record + DINO boxes + MP4 preview
3. Tab 2: **same geohash cell** — advisory list updates ("hard_brake 0.8 km")
4. Flash regression card export (CI wedge)

Frame as: *"This is the FSD fleet loop — trigger, annotate, upload, warn nearby engineers — on processed records, not raw logs."*

### 18.4 Proof points by audience

| Proof | AV startup | VC / angel | OEM technical |
|-------|------------|------------|---------------|
| Latency / throughput | High (`< 60 s` demo) | Medium (roadmap) | Critical (50k msg/s L1) |
| OSS `cde` CLI | High | High | Medium |
| Paid silo pilot (M1) | Critical | Critical | High |
| Pool contributors (M2) | Low early | Medium upside | Low in P1 |
| Regression card quality | Critical | Medium | High |

### 18.5 Competitive one-liners

| Competitor | CDE positioning |
|------------|-----------------|
| **NVIDIA Cosmos** | "Cosmos curates *your* data. CDE ships failures into CI." |
| **Safety Pool** | "Safety Pool is what regulators test. CDE is what your fleet hit last Tuesday." |
| **Mobileye REM** | "REM proved contribute-to-consume for maps. CDE does it for failure intelligence." |
| **HERE Hazard** | "HERE warns drivers. CDE gives your sim team the exact re-test." |

### 18.6 Geo broadcast — safe framing

**Say:** geo-indexed **advisory feed** for engineering triage; same geohash cell only (v1); minutes-scale fleet learning loop.

**Never say:** V2V, cooperative driving, prevents accidents, stack auto-reacts.

### 18.7 Full pitch scripts & deck outline

#### 30-second pitch (elevator / cold intro)

> AV teams drown in sensor logs. When something fails in the field, engineers manually scrub video to find the moment and turn it into a regression test. Tesla and Waymo built 50-person data ops teams for this — mid-size AV can't.
>
> **CDE** is an open-source pipeline: drop an MCAP bag, get ranked **edge-case records** and **regression test cards** in under a minute — the CI artifact your stack already wants, not another annotation platform.
>
> We're piloting with platform AV companies on **siloed fleet data** first. Long-term: a gated exchange of *processed* scenario records, not raw logs.
>
> **[Ask]:** 20 minutes with your data ops lead, or a weekly bag pilot.

**Do not lead with:** neutral pool, cross-OEM sharing, geo broadcast, or "industry standard."

---

#### 2-minute pitch (design partner / angel / first VC call)

| Beat | Script |
|------|--------|
| **Problem** | Petabyte logs; 0.1% matters; manual scrub → label → sim is the bottleneck. Mid-size AV can't replicate Tesla's internal flywheel. |
| **Product** | Three layers: **L1** C++ MCAP ingest (fleet-scale); **L2** heuristics + DINO/SAM2 → **edge-case record JSON** + **regression cards**; **L3** (later) gated shared index — contribute processed records to consume others'. |
| **Wedge (P1)** | "GitHub Actions for AV failures." Paid silo pilot: weekly bag processing, CI-ready cards. **No mandatory upload on customer #1.** |
| **Differentiation** | Safety Pool = regulatory scenarios (free). Cosmos = siloed curation per customer. REM = maps, not failures. CDE = **field-derived processed records + CI workflow**. |
| **Business** | ~50–65 global logos; platform fee + per-vehicle/month; Year 1 = silo support; pool subscription Year 2+. Realistic $5–20M ARR; acquisition path with design partners. |
| **Proof** | OSS `cde` CLI; cloud publish + geo advisory demo; M1 = paid silo pilot; M2 = 2+ logos exchanging records. |
| **Ask** | Design partner (Nuro/Wayve archetype) or intro to physical-AI / mobility fund. |

**Live demo beat:** `cde run bag.mcap --publish` → record in pool → second browser same geohash cell shows advisory — *"fleet learning loop in miniature, not production V2V."*

---

#### OEM / platform technical opener (first 5 minutes)

> We're not asking you to pool crown-jewel logs. We're shipping a **regression-ready record format** and ingestion pipeline you can run siloed today. MCAP-native L1, ML enrichment, CI export. Geo advisory is a module you can turn on later — HMI intelligence only, not control plane.

**45-minute agenda:** Problem → L1/L2/L3 architecture → S3 read-only IAM integration → performance targets → record schema walkthrough → silo contract → Q&A (IP, privacy, neutrality).

---

#### Recommended deck order (all audiences)

1. **Problem** — regression debt from fleet miles  
2. **Wedge** — edge-case record + regression card (live demo or screenshot)  
3. **Architecture** — L1/L2 solid; L3 as roadmap footnote  
4. **Differentiation** — 2×2 vs Safety Pool / Cosmos (see matrix below)  
5. **Distributed demo** — publish → same geohash cell subscribe (90 s video)  
6. **Business model** — silo pilot → hosted → exchange  
7. **Traction** — M0 → M1 → M2 gates  
8. **Ask** — design partner / check size / intro  

**Appendix only:** REM club rule detail, Year 5 ARR scenarios, full API spec (§17.9).

#### Positioning matrix (slide-ready)

```
                    Siloed tooling          Cross-OEM exchange
                    ──────────────          ──────────────────
Regulatory scenarios   Safety Pool                 —
Map / ODD tokens       Mobileye REM               HERE Hazard
Fleet curation         Cosmos, Applied            —
Fleet failures + CI    CDE (P1)                   CDE (P3)
```

#### Audience-specific sequencing

| Audience | Lead with | Save for meeting 2+ | Avoid |
|----------|-----------|---------------------|-------|
| **Nuro / Wayve** | Less scrubbing, regression cards, silo pilot | Pool upsell, geo as "future module" | Mandatory upload, neutral exchange operator |
| **May / Motional** | Faster security path, silo weekly bags | Pool | Tier-1 comparison |
| **Angels (mobility / devtools)** | OSS + demo video + M0 | TAM ceiling honesty (~50 logos) | $50M+ ARR fantasy |
| **VCs** | Wedge ARR path, Foretellix/Deepen comps, REM analog | Pool network effects after M2 | Pool-first TAM story |
| **YC** | Demo (D21), OSS, 10-week path to M1 | Governance foundation | Overclaiming fleet scale |
| **NVIDIA channel** | Complement Data Factory | Shared index without NVIDIA as broker | NVIDIA as customer #1 |

#### Liability slide (use verbatim)

> **Advisory intelligence only.** CDE does not issue driving commands, modify vehicle behavior, or certify safety outcomes. Published records are **processed artifacts for offline regression and engineering triage**. Any use in on-road systems requires the operator's independent validation. Not a substitute for homologation scenarios (Safety Pool) or OEM safety case sign-off.

---

## 19. On-Fleet System Design

> How CDE runs **on or near the vehicle** before records reach the cloud pool (§17/§20). Advisory only — no stack control.

### 19.1 Locked recommendations (OF-series)

> **Note:** On-fleet IDs **OF1–OF5** are distinct from dependency **F1–F5** in §16.4.

| ID | Decision | **Locked pick** |
|----|----------|-----------------|
| **OF1** | Where compute runs | **Hybrid (C)** — trigger + clip on vehicle/depot (C++ L1); enrichment on Colab/depot GPU |
| **OF2** | Ring buffer / triggers | **Ring + daemon (B)** → add stack triggers (C) for OEM fleet |
| **OF3** | Upload payload | **Tiered (C)** — LTE: metadata JSON; WiFi: preview MP4; depot: sidecar MCAP |
| **OF4** | LTE policy | **WiFi clips / LTE metadata (B)** → adaptive caps (C) at ≥50 vehicles |
| **OF5** | Stack integration | **Sidecar (A)** for bootstrap → **ROS 2 composable node (B)** for customer fleet |

### 19.2 On-fleet component diagram

```
Sensors → cde-ring-writer (C++ MCAP ring)
       → cde-edge-trigger (heuristics, video-gated D6)
       → cde-clip (C++ sidecar MCAP + preview MP4)
       → local spool (~/.cde/spool/)
       → cde-upload (Python: LTE/WiFi policy, retry, D16 dedup)
       → POST /v1/records (§17.9)
```

**Fail-open:** CDE crash must not affect driving stack — separate process, CPU quota ≤15%.

### 19.3 Ring buffer defaults

| Parameter | Phone (T0) | Comma (T1) | OEM (T3) |
|-----------|------------|------------|----------|
| Pre-roll | 15 s | 30 s | 30–60 s |
| Post-roll | 10 s | 15 s | 15–30 s |
| Ring depth | 2 min | 5 min | 10 min |
| Topics | camera, IMU, GPS | + CAN speed/brake | per agreement |

### 19.4 Upload tiers (OF3)

| Priority | LTE (immediate) | WiFi / depot | Never default |
|----------|-----------------|--------------|---------------|
| **P0** | Record JSON + thumb | Preview MP4 + clip MCAP | Full trip bag |
| **P1** | Record JSON | Preview MP4 | Sidecar MCAP unless opted in |

### 19.5 Hardware tiers

| Tier | Platform | CDE role |
|------|----------|----------|
| **T0** | iPhone + Arvos → Mac sync | Post-drive batch; **no on-car daemon in v0.1** |
| **T1** | comma Panda + phone/RPi | Optional live ring + CAN heuristics |
| **T2** | Mac Mini depot | Full L1+L2; Colab enrich |
| **T3** | Jetson Orin / drive AGX | Ring + trigger + clip; metadata upload |
| **T4** | Customer cloud K8s | Hosted ingest — not on-vehicle |

### 19.6 On-fleet latency targets

| Segment | Target |
|---------|--------|
| Trigger → clip closed | p99 **< 200 ms** |
| Trigger → metadata POST (LTE) | p95 **< 15 s** |
| Trigger → enriched record | **< 5 min** (Colab OK) |
| Trigger → advisory visible | p95 **< 20 s** |
| **Not a target** | **< 100 ms** (V2V — out of scope) |

### 19.7 Phased rollout (OR-series — hardware milestones)

> **Note:** **OR0–OR4** are rollout phases (hardware targets). Distinct from on-fleet **decision** IDs **OF1–OF5** (§19.1) and dependency **F1–F5** (§16.4).

| Phase | Hardware | On-fleet mode | v0.1? |
|-------|----------|---------------|-------|
| **OR0** | Founder phone | Depot batch on Mac | ✅ ship |
| **OR1** | comma Panda | Ring stub + CAN | Month 2–3 |
| **OR2** | comma 3X / RPi | Hybrid live + upload daemon | Month 3–4 |
| **OR3** | Design partner S3 | Hybrid or depot per contract | Month 4–6 |
| **OR4** | OEM fleet | Full hybrid + fleet policy | Month 6–12 |

**v0.1 ships:** C++ batch L1+clip, heuristics, `cde publish`, Colab enrich. **Defer:** ring writer prod, upload daemon, ROS node.

---

## 20. Distributed System Design (full)

> Extends §17 for cloud scale. API routes stay in §17.9.

### 20.1 Three planes

| Plane | Responsibility |
|-------|----------------|
| **On-fleet (§19)** | Ring → trigger → clip → metadata-first upload |
| **Ingest** | S3 bags → queue → L1/L2 workers → publish |
| **Cloud pool (L3)** | Control plane (index, dedup, auth) + data plane (S3, CDN, SSE/WS) |

### 20.2 Control vs data plane

| Control plane | Data plane |
|---------------|------------|
| Postgres index, dedup, tenancy RLS | S3/R2 clip bytes |
| Auth (D25), governance (P3) | CDN for preview MP4 |
| Fanout coordinator (Redis P2+) | SSE/WS connection hubs |

**E3 locked:** local `cde pool serve` first; **Fly.io** when demo week (~$15–30/mo).

### 20.3 Geo fanout evolution

```
Phase 0: geohash-6 same_cell, HTMX poll 5s
Phase 1: + SSE, per-tenant keys
Phase 2: H3 res 7 canonical, Redis PUBLISH, optional radius_km k-ring
Phase 3: WS primary for fleet SDK; MQTT = optional OEM sidecar only
```

### 20.4 Publish consistency

- **Idempotency:** `Idempotency-Key: {record_id}` → replay same `201` within 24 h
- **Semantic dedup:** `dedup_key` + `geo_cell_6` → `409` (D16) — different from idempotency
- **Metadata-first:** advisory can fanout before clip lands; preview URL may 404 until attachment ready

### 20.5 Fleet ingest queue (P1+)

```
S3 ObjectCreated → SQS/Redis → L1 worker → L2 enrich (Colab) → internal publish
```

On-fleet direct `POST /v1/records` bypasses bag queue for P0 metadata.

### 20.6 Security phases (D25)

| Phase | Publish | Subscribe |
|-------|---------|-----------|
| Demo | Shared API key | Same or public read (demo only) |
| Silo | Per-tenant API key | Tenant-scoped |
| Multi-fleet | + OIDC dashboard | SSE/WS with token |
| Exchange | + mTLS OEM publish | WS + governance |

### 20.7 Cost model (CDE-hosted infra)

| Scale | ~$/mo | Phase |
|-------|-------|-------|
| **Demo** | $15–30 | D21 local-first until deploy |
| **1 fleet** | $150–400 | P1 silo |
| **10 fleets** | $2k–5k | P2 |
| **100 fleets** | $15k–45k | P3 |

Assumes ~50 vehicles/fleet, ~20 records/vehicle/day, ~2 MB preview avg.

### 20.8 On-fleet ↔ cloud handoff

```
Vehicle: trigger → clip → record.json → LTE POST metadata
       → WiFi PUT preview.mp4 + clip.mcap
Cloud: dedup → index → fanout same_cell → subscribe (poll/SSE/WS)
```

**Offline:** local outbox retains N days; reconnect uses same `record_id` (idempotent).

### 20.9 Distributed decision table (locked)

See §17 D22–D27 + §20.2–20.8. Key locks: split control/data, metadata-first upload, poll→SSE→WS, single region until P2, no PostGIS on hot path, no MQTT core.

---

## 21. Current Data Inventory (as of plan lock)

What is **actually on disk** in `/Users/tonychen/Desktop/yc/data/` today:

| Dataset | Status | Sensors available | LiDAR? | Radar? | Notes |
|---------|--------|-------------------|--------|--------|-------|
| **`car_l1_spike.mcap`** | ❌ Not generated yet | Will be: IMU, camera, GPS (NavSatFix) | ❌ | ❌ | Gate 0 L1 tests only; run `python tools/fixtures/generate_car_l1_spike_mcap.py` (§15) |
| **comma2k19 `Example_1` seg 40** | ⚠️ Clone only (LFS not pulled) | **Forward camera** (`video.hevc`), **IMU**, **GNSS/GPS**, **CAN** (speed, steering, wheel speed), **forward radar via CAN** | ❌ | ✅ (CAN radar tracks) | Not MCAP yet — numpy + HEVC; run `git lfs pull` in `data/raw/comma2k19` to fetch seg 40; needs `comma2mcap.py` |
| **PandaSet** | ❌ Not downloaded | Camera + **spinning LiDAR** | ✅ | ❌ | Gate 2; ~6–10 GB |
| **ZOD** | ❌ Not downloaded | Camera + LiDAR + OXTS | ✅ | varies | Gate 3; requires Zenseact access |
| **Founder car** | ❌ Not recorded | Phone: camera + IMU + GPS (Arvos) | ❌ | ❌ | Gate 5 |
| **nuScenes mini** | ❌ Not downloaded | Camera + LiDAR + radar + CAN | ✅ | ✅ | Internal only (NC license) |

**Answer:** **Gate 0 fixture `car_l1_spike.mcap` is not generated yet.** comma2k19 repo is cloned but **LFS objects are not pulled** — run `git lfs pull` in `data/raw/comma2k19` to fetch Example_1 seg 40 (~500 MB). Once pulled: **camera + IMU + GPS + CAN including forward radar**. **No LiDAR.** LiDAR arrives with PandaSet (Gate 2) or nuScenes (internal).

**Format note:** comma2k19 is **not MCAP** on disk — it's `video.hevc` + `processed_log/*.npy` + `raw_log.bz2`. Gate 1 needs conversion to MCAP for unified L1.

---

## 22. Competitive Code Map (locked 2026-06-19)

Six-agent study of recommended OSS/commercial projects before Gate 0. Full narrative in `research.md` § Competitive code study.

### 22.1 Executive verdict

**Build on top of one thing only:** Foxglove **`mcap-cpp`**. Everything else = borrow patterns, optional customer adapters, or ignore for v0.1.

### 22.2 Build / borrow / ignore matrix

| Project | Build on top? | Action |
|---------|---------------|--------|
| Foxglove `mcap-cpp` | **Yes — core** | L1 read, clip write, `cde-ring-writer` (§19) |
| Foxglove MCAP CLI | **Yes — tooling** | Bootstrap + CI only |
| Foxglove `nuscenes2mcap` | **Yes — eval** | Gate 4 internal (D17) |
| Semantic-Drive | No | Borrow taxonomy + symbolic VLM verify (§9.4) |
| Cosmos Curator | No | Borrow alignment ideas; year-2 connector optional |
| rosbag-resurrector | No | Borrow health-check spec → `cde doctor` |
| Hephaes | No | Ignore M0 |
| Flightcase | No | Borrow gaps/clock/signing → record v0.2 |
| Roboticks SDK | No | Borrow `CDE-REG-*` IDs; export adapter if pilot asks |
| Safety Pool | No (complement) | Borrow P3 club/credit; `cde sp pull` P2+ |
| Foxglove SDK | No | Own ring writer on mcap-cpp |
| Foxglove Data Platform | No (foundation) | P2+ partner connector only |

### 22.3 Stack layer

```
MCAP spec
  └── foxglove/mcap (mcap-cpp)
        └── libcde_l1 + pybind11
              └── Python L2 (heuristics, DINO/SAM2, records, cards)
                    └── FastAPI+HTMX pool → Fly.io geo pool (P3)
```

### 22.4 What CDE builds vs borrows inspiration

| Layer | Own | Inspired by (not depended on) |
|-------|-----|--------------------------------|
| L1 | `libcde_l1`, `ClipView` byte ranges | Resurrector health; Flightcase gaps |
| L2 | Heuristics → DINO/SAM2 → record | Semantic-Drive taxonomy + verify |
| P1 | Regression card + `cde card export` | Roboticks `@confirms` patterns |
| Pool UI | FastAPI + HTMX | — (ignore Resurrector/Hephaes React) |
| P3 | Geo pool + contribution ledger | Safety Pool club/credit |
| §19 | `cde-ring-writer` on mcap-cpp | Flightcase windows; Foxglove chunk docs |
| P2+ adapters | Customer-driven only | Roboticks, OpenSCENARIO, SP pull, Foxglove events |

### 22.5 Do not build

- Curator/Xenna wrapper as CDE foundation
- Resurrector or Hephaes as library/runtime dep
- Safety Pool auto-upload
- Foxglove SDK / Agent / Edge Sites as L1/L3 spine

### 22.6 Locked decisions

See **F1–F5** (§16.4). Study confirms **Gate 0** path unchanged: native C++ L1 spike on `car_l1_spike.mcap` only — no new runtime deps. **M0 bootstrap path:** Gate 0 → Gate 1 (comma2k19) → enrichment → pool demo.

---
