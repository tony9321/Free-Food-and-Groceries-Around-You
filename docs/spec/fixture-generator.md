# Gate 0 fixture generator

**Purpose:** Produce a small, car-shaped MCAP for L1 ingest and clip unit tests — no robot-lab topics, no external dataset dependency.

## Script

```
tools/fixtures/generate_car_l1_spike_mcap.py
```

## Usage

```bash
python tools/fixtures/generate_car_l1_spike_mcap.py \
  -o tests/fixtures/car_l1_spike.mcap
```

## Output

| Property | Value |
|----------|-------|
| Path | `tests/fixtures/car_l1_spike.mcap` |
| Size | ~1 MB (target) |
| Compression | zstd |
| Commit | Check in once generated; CI/L1 only — never marketing (D17) |

## Topics

| Topic | Message type | Rate |
|-------|--------------|------|
| `/imu/data` | `sensor_msgs/Imu` | ~100 Hz |
| `/gps/fix` | `sensor_msgs/NavSatFix` | 10 Hz |
| `/camera/front/compressed` | `sensor_msgs/CompressedImage` | 5 Hz |

**Duration:** ~10 s wall-clock span in log time.

## Encoding

- **Format:** MCAP with ROS2 CDR message encoding
- **Libraries:** Python `mcap` + `mcap-ros2-support`
- **Schema:** Register ROS2 message definitions per channel; write CDR payloads with monotonic `log_time` / `publish_time` in nanoseconds

## Synthetic patterns (golden tests)

Design signals so L1 and downstream golden diffs are deterministic:

1. **IMU** — baseline cruise accel (~0 m/s² longitudinal), then a **hard-brake spike** at t ≈ 5 s (longitudinal ≤ −3.5 m/s² for ≥ 200 ms) and a brief **high-jerk** edge for jerk threshold tests
2. **GPS** — smooth speed ramp with a **>15% speed delta** segment aligned to the brake window
3. **Camera** — synthetic JPEG frames (solid color + frame counter); ensure at least one frame inside default clip window `[trigger − 5 s, trigger + 2 s]` for video-gated heuristics at Gate 1

Strip timestamps and UUIDs in `tests/fixtures/expected/` when diffing records; bag content hashes are stable given fixed generator seed.

## Gate scope

| Gate | Uses this fixture? | Heuristics? |
|------|-------------------|-------------|
| **0** | Yes — L1 ingest, channel index, clip cut | No |
| **1+** | Regression only | Real car data via comma2k19 |
