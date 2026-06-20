# Research: Continuous Data Engine for Embodied AI

> Status: **Ready to prototype; GTM/financial assumptions unvalidated.**  
> Last updated: 2026-06-20 (synced with `plan.md` §16 for autonomous Gate 0)  
> **Scope:** Passenger cars, robotaxi, ADAS, self-driving **delivery trucks** — **not** sidewalk bots.

> **Agent implementation authority:** On conflicts, **`plan.md` §16 wins**. **Gate 0 = E2 only** (L1 on `car_l1_spike.mcap`; heuristics at Gate 1).

---

## One-paragraph summary

Build a **processed edge-case intelligence layer** for FSD and robotics companies: machine-detected events from fleet logs become structured **edge-case records** (scenario signatures + metadata, not raw crown-jewel logs). Subscribers who want access to the shared index **must contribute**. Each company keeps its own stack — this is data and advisory intelligence, not remote driving control. Near-term wedge: **less preprocessing + regression-ready artifacts**. Long-term vision: neutral exchange before the industry fully gatekeeps fleet intelligence in silos (Mobileye REM pattern applied to edge-case scenarios, not maps).

---

## The problem

- Hardware teams (robotaxi, ADAS, autonomous trucks, passenger AV) drown in petabyte-scale sensor logs.
- When a vehicle fails in the field, engineers manually scrub video/LiDAR to find the failure moment, label it, and turn it into a regression test.
- Large players (Tesla, Waymo, NVIDIA ecosystem OEMs) built this internally. Mid-size players cannot afford 30–50 person data infra teams.
- No neutral **commercial** layer exists for **field-derived processed edge cases** across competing companies. Safety Pool covers abstract regulatory scenarios (free). Applied Intuition / Cosmos Curator cover **siloed** per-customer curation.

---

## The product (concept)

### Three layers (long-term)

| Layer | Name | Description |
|-------|------|-------------|
| **L1** | Ingestion engine | High-throughput MCAP parsing, zero-copy clip extraction (**C++ mcap-cpp from Phase 0**, D1/D13) |
| **L2** | Edge-case records | Machine-detected, processed artifacts: trigger, window, metadata, optional clip pointer |
| **L3** | Shared pool | Cross-company index; mandatory upload to consume; advisory intelligence only |

### What we are NOT doing (v1)

- Forcing other companies' cars to follow our driving commands
- Pooling raw sensor logs as the default row (legal/IP nightmare)
- Competing with Tesla/Waymo internal flywheels for Tier-1 customers
- Replacing Safety Pool for regulatory homologation scenarios

### Club rule (core principle)

**Subscribe + mandatory upload of processed edge cases → access shared index.**  
No upload, no pool. Contribution can be phased in for customer #1 (silo first, pool upsell).

### What gets uploaded (conceptual)

**Default:** Processed edge-case records — machine-detected event, timestamps, heuristic/VLM tags, scenario descriptor, optional anonymized clip pointer.

**Optional tier:** Richer attachments (OpenSCENARIO export, embeddings, clips).

**Not default:** Raw MCAP/video as the shared row.

---

## Value propositions (all three apply)

| Label | Value | When it matters |
|-------|-------|-----------------|
| **Value-A** | Less preprocessing — find the 0.1% that matters | Day 1, even with small pool |
| **Value-B** | Pool becomes industry standard — FOMO if others join | Year 2+ |
| **Value-C** | Cheaper than building 50-person data infra in-house | Budget conversation |

**Sequencing:** Value-A + Value-C close customer #1. Value-B pays off as the club grows.

> **Note:** Phase names (P1/P2/P3 below) are separate from Value-A/B/C labels.

---

## Target customers

### Realistic buyer pool

~**50–65 companies globally** might ever pay voluntarily. Tesla, Waymo, Zoox likely never join.

### Customer #1 archetype (founder scope: cars + trucks)

**Founder choice (Q2): Platform / passenger AV first — Nuro or Wayve** (outreach **hypothesis** — validate before betting GTM).

| Company | Why target | Caveat |
|---------|------------|--------|
| **Nuro** | Nuro Driver on Lucid/Uber robotaxi validation (~100-vehicle test fleet, SF/Houston). Platform may want scenario index for partners. | Operator-adjacent, not passive licensor only |
| **Wayve** | Embodied AI on NVIDIA/Uber (Nissan Tokyo pilot). **Buy vs build** speed for partner scale — not “can’t afford infra” ($1B+ raised). | May build internally or via NVIDIA stack |

**Fallback #1 if Nuro/Wayve pass:** May Mobility or Motional (shorter security review, clearer silo pilot).

**Secondary:** May Mobility, Motional (robotaxi operators); Gatik, Plus.ai (self-driving trucks).

**Out of scope:** Sidewalk bots (Serve, Starship, Cartken).

### Outreach rank (when demo exists) — updated for Q2: D

| Priority | Company | Type |
|----------|---------|------|
| **1** | **Nuro** | AV platform / passenger validation |
| **2** | **Wayve** | Hyperion ecosystem, embodied AI |
| 3 | May Mobility | L4 robotaxi (operator) |
| 4 | Motional | L4 robotaxi (operator) |
| 5 | Gatik | L4 delivery trucking |
| 6 | Plus.ai | L4 freight trucking |
| Parallel | NVIDIA Inception | Channel, month 4–6 |

**Do not lead with:** Tesla, Waymo, Zoox, Momenta, DeepRoute, Aurora, BYD/Geely OEM programs.

### Cars/trucks vs sidewalk bots (tradeoff)

| | Sidewalk bots (rejected) | Cars/trucks (chosen) |
|--|--------------------------|----------------------|
| Vision fit | ❌ | ✅ |
| Sales cycle | Faster | 3–9 months |
| Share willingness | Higher | Lower (safety data = moat) |
| Pool formation | Easier | Harder — plan **18–24 mo** not 6 mo |
| Budget per logo | Lower | $150K–$500K+ |
| Edge-case value | High volume, lower severity | Higher severity per record |

**GTM implication:** Phase 1 must sell **siloed preprocessing + regression cards** (Value-A + Value-C). Pool (Value-B) is a longer bet on cars/trucks — acceptable given founder scope.

---

## Competitive landscape

| Player | What they do | Overlap / gap |
|--------|--------------|---------------|
| **Safety Pool** | 250k+ scenarios, free, UK gov-backed, **credit-based mandatory contribution** | Regulatory + failure-oriented scenarios — **not** processed fleet-log exchange for CI. Overlaps on exchange mechanics; we differ on **field-derived records + regression workflow** |
| **Applied Intuition** | Full physical AI platform, siloed per customer, large private platform (~$830M ARR est.) | Platform, not cross-OEM exchange |
| **NVIDIA Cosmos Curator** | Open GPU curation pipeline, per-customer | Preprocessing commoditized; **no** cross-OEM pool |
| **Foretellix** | Scenario V&V, ODD coverage (~$26M ARR est.) | Coverage measurement, not shared fleet failures |
| **Deepen AI** | Tools + Safety Pool operator (~$22M ARR est.) | Annotation/validation; siloed tools overlap L1/L2 |
| **Semantic-Drive** | NuScenes VLM long-tail mining (MIT; AGPL YOLOE) | Borrow taxonomy + symbolic verify only — **not** MCAP/fleet/CI |
| **rosbag-resurrector** | Python MCAP bag analysis + health checks (MIT) | Borrow health QC spec → `cde doctor`; **not** runtime dep |
| **Flightcase** | ROS2 incident evidence + signed manifests (Apache 2.0 RC) | Borrow provenance patterns for record v0.2 |
| **Foxglove Data Platform** | Commercial raw bag hosting + search | Partner connector P2+; CDE owns processed records |
| **Mobileye REM** | Crowdsourced map tokens (~10 KB/km), mandatory via EyeQ | **Proves exchange model** — maps not scenarios |
| **HERE Hazard** | Multi-OEM coarse hazard events | Advisory infrastructure, not training pool |
| **Roboto / Alloy** | Per-fleet analytics and search | Siloed, no cross-competitor sharing |

**Our gap:** Field-derived **processed edge-case records** + optional **shared index** + **preprocessing pipeline**. Safety Pool = what regulators might test. We = what fleets actually hit last Tuesday.

**Pitch line (locked):** *"Safety Pool is what regulators test. CDE is what your fleet hit last Tuesday."*

### Competitive positioning matrix

```
                    Siloed tooling          Cross-OEM exchange
Regulatory scenarios   Safety Pool                 —
Fleet failures + CI    CDE (P1)                   CDE (P3)
```

---

## Competitive code study (June 2026 — locked)

Six-agent deep dive on projects recommended for study before Gate 0. **Executive verdict:** build CDE on top of **one runtime dependency only — Foxglove `mcap-cpp`** (already locked in D1/D13). Everything else is **borrow patterns**, **optional customer-driven adapters**, or **ignore for v0.1**.

### Build / borrow / ignore matrix

| Project | Build on top? | What to actually do |
|---------|---------------|---------------------|
| **Foxglove `mcap-cpp`** | **Yes — core dependency** | L1 read, clip write, future `cde-ring-writer` (§19). MIT license — OK as Apache 2.0 dep. |
| **Foxglove MCAP CLI** | **Yes — tooling only** | `convert`, `doctor`, `filter` for comma/PandaSet bootstrap + CI golden tests — **not** runtime. |
| **Foxglove `nuscenes2mcap`** | **Yes — internal eval only** | Gate 4 P/R (D17); never marketing. Skip Platform upload scripts. |
| **Semantic-Drive** | **No** | Borrow WOD-E2E taxonomy enums + symbolic VLM verification (~1–2 wk post-M1). |
| **Cosmos Curator** | **No** | Borrow multi-sensor alignment ideas. Optional Cosmos-Embed1 connector year 2. |
| **rosbag-resurrector** | **No** | Borrow health-check spec (~200 lines L2 QC). Keep in venv for dev comparison only. |
| **Hephaes** | **No** | Ignore M0. Topic-fallback mapping patterns at P2 if needed. |
| **Flightcase** | **No** | Borrow `declared_gaps`, clock uncertainty, signed integrity → record v0.2. |
| **Roboticks SDK** | **No** | Borrow requirement-style IDs on cards; `cde card export --format roboticks` if pilot asks. |
| **Safety Pool** | **No (complement)** | Borrow club/credit mechanics for P3. Read-only coverage adapter later. Never auto-publish to SP. |
| **Foxglove SDK** | **No** | Roll own `cde-ring-writer` on mcap-cpp — SDK adds Platform/Studio coupling without ring buffer. |
| **Foxglove Data Platform** | **No as foundation** | Future partner connector if customer already on Foxglove BYOS (P2+). |

### Stack layer (only thing to build on)

```
MCAP spec
  └── foxglove/mcap (mcap-cpp)     ← L1: index, clip cutter, sidecar write
        └── libcde_l1 + pybind11   ← boundary (D1/D13 locked)
              └── Python L2        ← heuristics, DINO/SAM2, records, cards
                    └── FastAPI+HTMX pool → Fly.io geo pool (P3)
```

**Pull in now (non-runtime):** MCAP CLI; `nuscenes2mcap` (internal eval).

**Do not adopt as spine:** Foxglove SDK, Agent, Edge Sites, Data Platform APIs; Resurrector-as-library; Hephaes Converter; Cosmos Curator + Xenna/Ray; Safety Pool database.

### Per-project findings

#### Semantic-Drive — borrow, don't fork

NuScenes-only Python VLM long-tail mining (MIT repo; YOLOE/Ultralytics **AGPL** — do not ship in Apache 2.0 CDE). No MCAP, no fleet, no CI cards. ~60 s/frame on 24 GB GPU vs CDE `<60 s` on 5 min bag target.

**Worth porting post-M1:** WOD-E2E taxonomy enums → `scenario.taxonomy`; `SymbolicVerifier`-style grounding (VLM claims vs DINO boxes); scout/judge consensus for optional VLM tier (§9.4).

#### Cosmos Curator — borrow ideas, never foundation

Petabyte training curation (Ray, CUDA, Docker, Linux-only). Wrong product atom (training clips + WebDataset vs regression cards). Would rebuild ~80% of CDE anyway; commoditizes into NVIDIA stack (R2 risk).

**Year 2 optional:** one-way export adapter for customers already on Curator; Cosmos-Embed1 enrichment tier with "Built on NVIDIA Cosmos" attribution.

**NVIDIA relationship:** integration/complement story ("Curator prepares training data; CDE ships failures into CI") — not platform dependency.

#### rosbag-resurrector — borrow health checks only

MIT; already in project venv. Strong streaming health/QC (gaps, rate drops, completeness, 0–100 score). Wrong ingest (Python full-bag scan), bag-centric React UI, CLIP search vs DINO triggers.

**Action:** Port health-check categories into `cde doctor` fed by L1 stats. Side-by-side dev on comma2k19 — **not** a runtime dependency (plan §15 Gate 0 explicitly excludes resurrector).

#### Hephaes — ignore for vertical slice

Python `rosbags` indexing → Parquet/TFRecord training datasets. Tauri+React workspace. Wrong abstraction (training rows, not edge-case records). Full-bag scans conflict with C++ L1.

#### Flightcase — provenance patterns only

Apache 2.0 RC; warehouse ROS 2 evidence sidecar. **`declared_gaps`**, clock uncertainty, signed manifests align with honest AV partial-bag handling. No L2 intelligence, no regression cards.

**Action:** Add 3–4 fields to edge-case record v0.2; implement ring buffer natively in C++ (§19) — do not depend on Flightcase runtime.

#### Roboticks SDK — CI export ergonomics only

Opposite data flow: requirement → synthetic test → MCAP proof vs fleet MCAP → record → card. JUnit wire format couples to closed platform.

**Action:** Stable `CDE-REG-*` IDs on cards; thin pytest stub export only when design partner names Roboticks.

#### Safety Pool — complement, not competitor (P1)

Regulatory **logical** scenarios (WMG SDL L2, OpenSCENARIO). API is **read-only** today; no programmatic upload. Human publication + WMG rights transfer.

**P1–P2:** Ignore SP database; align `scenario.taxonomy` with PAS 1883 / OpenLABEL tags (cheap interoperability).

**P2 late:** optional `cde sp pull` for coverage diff ("fleet hit 47 cut-ins; SP ALKS library has 312 you never regression-tested").

**P3:** Own exchange on edge-case records; borrow club/credit mechanics (already in plan §17.9) — never compete on 250k regulatory corpus. Do **not** build CDE → SP auto-publish (wrong format, no write API).

#### Foxglove commercial stack — partner, not platform

Data Platform = raw bag hosting/search. CDE = processed failure intelligence. Optional dual-stack: CDE triggers as Foxglove events metadata pointing at sidecar clips (P2+ if customer on BYOS).

### What CDE builds itself (inspired by, not depended on)

| Layer | Build yourself | Inspired by |
|-------|----------------|-------------|
| **L1** | `libcde_l1` index + `ClipView` byte ranges | Resurrector health categories; Flightcase gap honesty |
| **L2** | Heuristics → DINO/SAM2 → edge-case record | Semantic-Drive taxonomy + symbolic verify |
| **P1 wedge** | Regression test card schema + `cde card export` | Roboticks `@confirms` / scoped capture patterns |
| **Pool UI** | FastAPI + HTMX on records | Ignore Resurrector/Hephaes React dashboards |
| **P3 exchange** | Geo pool + contribution ledger | Safety Pool club/credit model |
| **§19 on-fleet** | `cde-ring-writer` on mcap-cpp | Flightcase window/gap semantics; Foxglove chunk-size docs |
| **Optional adapters (P2+)** | `--format roboticks`, `--format openscenario`, Foxglove events API, `cde sp pull` | Customer-driven only |

**Explicitly do not build:** wrappers around Curator; Resurrector-as-library; Hephaes Converter spine; Safety Pool auto-upload pipeline.

**Study confirms locked plan:** Gate 0 = L1 on `car_l1_spike.mcap` only (E2) → Gate 1 comma2k19 heuristics → enriched record → HTMX pool + D21 cloud demo. No new runtime dependencies beyond `mcap-cpp` + MCAP CLI.

---

## Business model (assumptions for now)

| Decision | Locked assumption |
|----------|-------------------|
| Pricing shape | Platform fee + per-vehicle/month |
| Mandatory upload | Bundled into subscription (REM-style) |
| Credits / tiers | Year 2+ if fleet-size asymmetry appears |
| Exact $ amounts | **Open** — validate after discovery calls |

### Profitability (research estimate — **ASSUMPTIONS ONLY**, not validated)

| Scenario | Year 5 customers | Year 5 ARR |
|----------|------------------|------------|
| Pessimistic | ~18 | ~$3M |
| **Base (revised)** | **~20–25** | **~$6–10M** |
| Optimistic | ~50–58 | ~$18–32M |

- TAM ceiling ~50–65 logos → optimistic case must stay **≤65**
- Gross margin: **TBD** — model after 1 pilot ($/GB ingested, support load)
- Break-even: function of burn + ACV, not logo count alone (~35–45 logos at prior model)
- Most likely outcome: **real $5–20M/year business**; $50M+ needs regulatory mandate or full V&V platform bundling
- Realistic exit: **acquisition** ($30–150M range is speculative) if L1/L2 + design partners

---

## NVIDIA analogy (what holds, what breaks)

| Holds | Breaks |
|-------|--------|
| Many competing OEMs pay one platform vendor | NVIDIA pools OEM fleet logs across customers |
| Standardization creates industry dynamics | "All pay us for the same shared intelligence" |
| Complement: help each OEM on NVIDIA stack | Pitch NVIDIA as customer #1 or data aggregator |

**NVIDIA pitch (month 4–6):** Optional shared scenario index on top of siloed Data Factories — anonymized, ASAM-compatible — without NVIDIA becoming data broker.

---

## Product wedge (canonical — Q1 = D)

**Do not confuse with Value-A/B/C above.**

| Phase | Wedge | Pitch |
|-------|-------|-------|
| **P1 (0–12 mo)** | **Regression cards + thin preprocessing** on siloed fleet data | "GitHub Actions for AV failures" — CI cards + log→record pipeline; **no pool required** |
| **P2 (12–24 mo)** | Deeper preprocessing at scale | Fleet connectors, hosted ingestion, SLAs |
| **P3 (24+ mo)** | Gated exchange | Mandatory upload to consume shared index |

**Avoid as day-one lead:** Neutral pool-first pitch, full petabyte Curator clone, HERE-style ODD intelligence.

---

## MVP debate (agent consensus — locked per `plan.md` §16)

| Choice | Locked recommendation |
|--------|----------------------|
| Language | **Py+C++ hybrid from Phase 0** — `mcap-cpp` L1 + pybind11; not Python-only deferred rewrite (D1) |
| Format | **MCAP only** (nuScenes converter internal eval only) |
| Detection | **Heuristics at Gate 1** (comma2k19); DINO/SAM2 enrichment post-M1 (Q4) |
| Surface | **CLI + FastAPI+HTMX local pool** + **D21 cloud publish/subscribe demo** (Fly.io/Railway — real geo advisory, not mock) |
| Brand | **CDE** (Continuous Data Engine) — D20 locked |
| Output | **Edge-case record JSON v0.1** |

**MVP promise:** Drop an MCAP log → ranked edge-case records + local pool UI; **`cde publish`** → cloud pool → second browser geo-subscribes (FSD fleet loop in miniature).

Schema: `schemas/edge-case-record.v0.1.schema.json`.

---

## GTM sequence (months 0–6)

| Month | Focus |
|-------|-------|
| 0–1 | Lock research; MCAP ingestion spike; demo data |
| 1–2 | Heuristics → edge-case JSON export |
| 2–3 | Demo video; accept **silo-only first deal** if needed |
| 3–4 | Outreach tier 1; YC application (demo + calls) |
| 4–5 | Pilot: process customer bags weekly |
| 5–6 | Member #2 same ODD (**stretch: 12–18 mo** realistic for cars/trucks); RTC spec v0.1 draft; NVIDIA parallel intro |

**GTM rule:** Revenue path is **siloed curation → club pool**, not pool-first.

---

## Top risks (ranked)

1. **Safety Pool + regulatory preemption** — free cooperative layer for abstract scenarios  
2. **NVIDIA Cosmos commoditizes preprocessing** — L1/L2 becomes a feature  
3. **Adverse selection** — big fleets won't join undifferentiated pool  
4. **Neutrality credibility** — solo founder as "neutral exchange operator" is hard at L3 scale  
5. **Buyer pool ceiling** — ~50 logos globally without regulatory mandate  

## Top reasons to pursue anyway

1. **L1/L2 valuable without pool** — Foretellix/Deepen prove ~$20–30M ARR tooling businesses  
2. **Safety Pool gap** — scenarios ≠ processed fleet failure records  
3. **Physical AI expansion** — mining, industrial AV as future wedges (cars/trucks first per scope)
4. **Acquisition exit realistic** at L1/L2 + design partners  
5. **Timing window** — industry still siloed; exchange layer not owned yet  

---

## What must be true for the vision to win

1. Ship **L1/L2 in weeks**, not years  
2. **One design partner** uploading real data within ~6 months  
3. **Processed records** as exchange unit, not raw logs  
4. **10+ contributors** before pool network effects dominate pitch  
5. **Governance** (foundation, multi-stakeholder board) by ~month 24 if L3 scales  
6. Mandatory upload as **steady-state club rule** — can soften for customer #1  

---

## Decisions log — research complete

| # | Decision |
|---|----------|
| Q1 | **D** — CI cards → preprocessing → shared pool |
| Q2 | **D** — Outreach: Nuro / Wayve first |
| Q3 | **B** — No mandatory upload on customer #1 |
| Q4 | **B** — CLI + self-annotation + local pool UI |
| Q5 | **A** — Full OSS from day 1 |
| Q6 | **C + D** — Tooling/protocol publicly; exchange endgame + hosted pool later |
| Data | Open source → founder car (wk 5+) → fleet (mo 4+) |
| Hardware | Mac Mini GPU + personal car |
| **F1** | **LOCKED** — **Build on top of `mcap-cpp` only** for runtime; MCAP CLI + nuscenes2mcap = dev/CI only |
| **F2** | **LOCKED** — **No** Resurrector/Hephaes/Curator/Flightcase/SDK as dependencies; borrow patterns only |
| **F3** | **LOCKED** — Safety Pool = complement; borrow club/credit for P3; never auto-publish to SP |
| **F4** | **LOCKED** — Foxglove Data Platform = P2+ partner connector only, not L3 foundation |
| **F5** | **LOCKED** — Optional adapters (Roboticks export, OpenSCENARIO tier-2, `cde sp pull`) = customer-driven P2+ |
| **D20** | **LOCKED** — **CDE** — *"GitHub Actions for AV failures — fleet logs to regression-ready edge-case records."* Repo/CLI: `cde` |
| **D21** | **LOCKED** — Real cloud pool stub (Fly.io/Railway): `cde publish` + geo subscribe demo for M0 |

**Still open:** YC after demo video (~month 3–4).

### OSS vs revenue (Q5 + Q6)

| OSS (day 1) | Paid (year 1) | Paid (year 2+) |
|-------------|---------------|----------------|
| CLI, record schema, heuristics | Hosted ingestion, fleet connectors, support contracts | Multi-tenant pool, governance, premium features |

Year 1 revenue = **silo pilot/support**, not pool subscription. Pre-revenue until first paid pilot is OK.

### Facts vs assumptions

| **Fact** | **Assumption (validate)** |
|----------|---------------------------|
| Safety Pool free + credit exchange exists | 50–65 logo TAM |
| MCAP is ROS 2 default container | Nuro/Wayve buy external preprocessing |
| NC licenses on nuScenes/Waymo/CODA | Mandatory upload works cross-OEM |
| Large AV players built internal data ops | Year 5 base ARR without bottom-up ACV math |

---

## Key references

- [MCAP](https://mcap.dev) — container format (ROS 2 default)
- [Foxglove mcap-cpp](https://github.com/foxglove/mcap) — **CDE L1 core dependency (F1)**
- [MCAP CLI](https://github.com/foxglove/mcap/tree/main/go/cli/mcap) — dev/CI convert, doctor, filter
- [Foxglove nuscenes2mcap](https://github.com/foxglove/nuscenes2mcap) — Gate 4 internal eval only
- [Safety Pool](https://www.safetypool.ai/) + [API docs](https://docs.safetypooldb.ai) — complement; read-only integration later
- [Semantic-Drive](https://github.com/AntonioAlgaida/Semantic-Drive) — borrow taxonomy + symbolic VLM verify (not fork)
- [NVIDIA Cosmos Curator](https://github.com/NVIDIA/cosmos-curator) — borrow alignment ideas; optional year-2 connector
- [rosbag-resurrector](https://github.com/vikramnagashoka/rosbag-resurrector) — borrow health-check spec; dev comparison only
- [Hephaes](https://github.com/hephaes-ai/hephaes) — ignore M0
- [Flightcase](https://github.com/marouane53/Flightcase) — borrow provenance patterns for record v0.2
- [Roboticks SDK](https://roboticks.io/sdk) — borrow CI ID patterns; optional export adapter
- [Applied Intuition Physical AI](https://www.appliedintuition.com/physical-ai)
- [NVIDIA Physical AI Data Factory Blueprint](https://nvidianews.nvidia.com/)
- [nuScenes CAN bus](https://github.com/nutonomy/nuscenes-devkit/blob/master/python-sdk/nuscenes/can_bus/README.md)

---

## Bootstrap path: open data + DIY car (before customer #1)

**You do NOT need Nuro/Wayve data to build the MVP.** Recommended two-track approach:

### Track 1 — Open datasets (development + benchmarks)

| Dataset | Use | Commercial demo? |
|---------|-----|------------------|
| **PandaSet** (CC BY) | LiDAR+camera fusion, MCAP experiments | ✅ Yes |
| **ZOD / Zenseact** (CC BY-SA) | Anomalies, weather, EU roads | ✅ Yes (derivatives SA) |
| **comma2k19** | CAN+IMU+camera, Gate 1 heuristics | ✅ MIT — clone exists; **`git lfs pull` required** for `Example_1` seg 40; **marketing demos:** prefer PandaSet/ZOD/self-MCAP |
| **nuScenes mini / CODA** | Best edge-case benchmarks internally | ❌ NC only — **not in marketing** until licensed |
| **Waymo / Argoverse** | Skip for commercial demo | ❌ Non-commercial |

**License rule:** YC video, sales calls, and SaaS demos → only **PandaSet, ZOD, self-recorded MCAP**. Use nuScenes/CODA **internally** for precision/recall; email `nuScenes@motional.com` for startup commercial license later.

### Track 2 — DIY founder car (demo authenticity)

Mount camera + record while **you drive manually** — valid bootstrap (comma.ai I-280 commutes, Wayve garage Twizy precedent).

| Tier | Hardware | Cost | Signals |
|------|----------|------|---------|
| **Minimum** | Phone (Arvos / CouchVision → MCAP) | $0 | Camera, IMU, GPS |
| **Better** | Phone + OBD-II dongle | ~$50 | + coarse vehicle speed |
| **Best DIY** | comma Panda / comma 3X | $200–1,250 | CAN: steering, wheel speed, brakes |

**Edge-case triggers from manual driving:**
- **IMU + GPS:** hard brake, harsh corner, sudden accel (heuristics — same as nuScenes CAN logic)
- **Video:** construction, debris, pedestrians — use **after** IMU clips a 5s window, then auto-label
- **OBD alone:** weak (~1 Hz integer speed); fine as sanity check only

**California basics:** forward video on public roads OK; **disable cabin audio** (two-party consent); mount per CVC §26708; blur faces/plates in public demos.

### Self-annotation model stack (MVP)

```
MCAP in
  → heuristic triggers (hard brake, jerk, etc.)
  → clip window (5s before / 2s after)
  → Grounding DINO + SAM2 (2D boxes/masks, Apache 2.0)
  → optional Qwen2.5-VL-7B local (scene tags / "why unusual?")
  → edge-case record JSON out
```

Skip for v0: Alpamayo, full Cosmos Curator cluster, cloud-only VLMs in hot path.

**Open-source MVP alignment:** OSS CLI + card schema + demo on public/self data = **customer #0** before Nuro/Wayve. First paying customer still silo-first (Q3).

### What DIY + open data proves vs doesn't

| Proves | Does NOT prove |
|--------|----------------|
| Pipeline works (MCAP → records → pool UI) | Fleet-scale petabyte throughput |
| Self-annotation quality (benchmark on CODA internally) | Cross-OEM pool network effects |
| Credible demo: "we collected this driving in the Bay" | Data moat vs Tesla/Waymo miles |

### Revised prototype sequence (founder setup: Mac Mini GPU + car)

| Week | Data | Build |
|------|------|-------|
| **1** | **`car_l1_spike.mcap`** only (Gate 0 / E2) | C++ mcap-cpp reader, channel index, pybind11 `ClipView`, clip cutter |
| **2** | **comma2k19** `Example_1` (Gate 1) | Heuristic triggers → edge-case JSON records |
| **3** | **PandaSet** or ZOD (commercial-safe) | Enrichment pipeline + regression cards |
| **4** | Same + **Grounding DINO + SAM2** on Mac Mini (MPS/CUDA) | Self-annotation on clipped windows |
| **5** | **Founder car** (phone → MCAP via Arvos/CouchVision) | Real ODD clips + D21 cloud publish/subscribe demo + demo video |
| **6+** | Mix open + self-car | Polish CLI, OSS release, outreach prep |

**Mac Mini notes:** Apple Silicon → PyTorch `mps` device for DINO/SAM2; 16GB+ RAM recommended; use smaller models first (SAM2 base, DINO-T). Intel Mac Mini with discrete GPU → CUDA if NVIDIA (rare on Mini).

**Car setup (week 5):** Phone mount + Arvos (iOS) or Sensor Logger → export/sync to Mac → MCAP. IMU+GPS triggers while you drive manually; disable audio if recording in CA.

Customer fleet logs (Nuro/Wayve) → month 4+ outreach, not MVP blocker.

---

### Proof milestones (demo vs company)

| Milestone | Proves | Does NOT prove |
|-----------|--------|----------------|
| **M0:** OSS CLI on open data + founder car | Pipeline, YC demo | Fleet WTP, pool value |
| **M1:** Paid silo pilot (1 logo, real bags) | WTP for P1 | Cross-OEM pool |
| **M2:** 2+ logos contributing records | Pool testable | Industry standard |

---
