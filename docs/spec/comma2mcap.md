# Gate 1: comma2k19 → MCAP converter

**Purpose:** Unify comma2k19 native layout into MCAP so L1 C++ ingest and L2 heuristics share one bag format (D4, D5).

## Script (planned)

```
tools/convert/comma2mcap.py
```

## Input

**Segment path (comma2k19 repo):**

```
data/raw/comma2k19/Example_1/b0c9d2329ad1606b|2018-08-02--08-34-47/40/
```

Segment **40** of comma2k19 `Example_1` (~500 MB): forward camera HEVC, IMU, GNSS/GPS, CAN (speed, steering, wheel speed, forward radar via CAN). **Not MCAP on disk** — `video.hevc`, `processed_log/*.npy`, `raw_log.bz2`.

### `processed_log/` numpy layout (read paths)

| File under segment | Use in converter |
|--------------------|------------------|
| `processed_log/IMU/acceleration` | `/imu/data` linear accel (forward/right/down frame) |
| `processed_log/IMU/gyro` | `/imu/data` angular velocity |
| `processed_log/GNSS/live_gnss_qcom` | `/gps/fix` (primary; fallback `live_gnss_ublox` if missing) |
| `video.hevc` | `/camera/front/compressed` via HEVC → JPEG in `sensor_msgs/CompressedImage` |

Sync camera frames to IMU using comma `frame_times` (from openpilot utils or segment metadata); IMU/GNSS arrays are boot-time seconds → convert to Unix ns per anchor below.

### Fetch (git LFS)

```bash
cd data/raw/comma2k19
git lfs install
git lfs pull
```

Verify `video.hevc` and `processed_log/` exist under the Example_1 segment path before conversion.

## Topic mapping

| comma2k19 source | MCAP topic | ROS2 type (v0.1) |
|------------------|------------|------------------|
| IMU (`processed_log`) | `/imu/data` | `sensor_msgs/Imu` |
| GNSS / GPS | `/gps/fix` | `sensor_msgs/NavSatFix` |
| Forward camera HEVC | `/camera/front/compressed` | `sensor_msgs/CompressedImage` |

CAN and radar topics are **out of scope for Gate 1**; add when CAN path lands (plan §9.2).

## Timestamps

- comma2k19 log time is **boot-relative**
- Converter must emit MCAP `log_time` / `publish_time` as **Unix epoch nanoseconds**
- Anchor: use segment metadata or first GPS fix to map boot offset → wall clock; document offset in converter stdout for audit

## Output

```
data/mcap/comma2k19_example_1.mcap
```

ROS2 CDR encoding via `mcap` + `mcap-ros2-support`; zstd compression recommended.

## Gate 1 scope

| Layer | Gate 1 behavior |
|-------|-------------------|
| **L1** | Ingest, channel index, clip extraction on unified MCAP |
| **L2** | D6 heuristics only (IMU jerk, GPS speed anomaly, **video-gated**) |
| **Enrichment** | Deferred — DINO/SAM2 optional after records validate |

### Video decode (optional)

HEVC → JPEG/PNG for enrichment or preview:

- **ffmpeg** — standalone transcode of `video.hevc` frames
- **openpilot FrameReader** — git submodule optional for frame-accurate decode aligned with comma timestamps

Gate 1 pass criteria: `cde detect data/mcap/comma2k19_example_1.mcap` emits at least one `edge-case-record.v0.1.json` with `trigger.type=heuristic` and `window.topics` including `/camera/front/compressed`.

## Example run

```bash
python tools/convert/comma2mcap.py \
  --input "data/raw/comma2k19/Example_1/b0c9d2329ad1606b|2018-08-02--08-34-47/40/" \
  --output data/mcap/comma2k19_example_1.mcap

cde detect data/mcap/comma2k19_example_1.mcap
```
