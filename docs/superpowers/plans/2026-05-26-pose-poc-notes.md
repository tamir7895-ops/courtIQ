# Pose POC Notes — 2026-05-26

## What was verified

MediaPipe Pose Lite (via `@mediapipe/tasks-vision@0.10.14`) runs end-to-end
in the CourtIQ dev environment and detects the shooter's body in our test
videos at high recall.

## Key correction

**`_eval/v2.mp4` IS the 25-shot indoor video** ("20 STRAIGHT NBA THREES!" caption,
Red Bull shooter, indoor gym, ball cart with multiple red basketballs).
Previous session summaries incorrectly described it as "outdoor portrait" —
that was wrong. This is the same video where ball-only detection scored 12%
recall.

## Run results

### POC harness on v2 (the 25-shot indoor video)
- Source: `_eval/v2.mp4`
- Resolution: 480×848 (portrait)
- Duration: 55.92 s
- Model load time: **7.8 s** (first time; subsequent loads cached)
- Wall-clock playback: **58.9 s** (~real-time)
- Total frames processed: **3,355**
- Frames with pose detected: **3,282**
- **Pose detection rate: 98%** ✅
- Effective FPS: **57**
- Browser: Chromium (preview server)
- Backend: GPU delegate

### Single-frame spot checks at known shot moments
| Video time | Pose detected | Landmarks |
|---|---|---|
| t=1.5 s | ✅ | 33 |
| t=2.5 s | ✅ | 33 |
| t=4.0 s | ✅ | 33 |
| t=6.0 s | ✅ | 33 |
| t=8.0 s | ✅ | 33 |
| t=12.0 s | ❌ | 0 (likely off-frame moment) |

### Visual verification
Saved sample frame with skeleton overlay at `_eval/pose_sample_v2_t1500.jpg`.
Skeleton correctly tracks the shooter (left side of frame, Red Bull shirt).

## What this proves

1. **MediaPipe loads and runs in our environment** — no integration problems.
2. **Pose detection works on the hardest test video** (red ball, multiple balls,
   indoor lighting, fast cadence, moving camera). 98% recall vs the 12% YOLOX-only
   recall demonstrates pose is the right primary signal.
3. **Performance is real-time** — 57 fps with GPU delegate on a desktop Chromium.
   Mobile performance still to verify (Chunk 5 Task 5.3).
4. **Standard 33-keypoint model** delivers full upper-body coverage needed for
   shooting-motion detection (wrists, elbows, shoulders, hips, head).

## Quirks observed

- **Timestamps must be monotonically increasing.** Seeking backwards then calling
  `detectForVideo` returns empty landmarks. The state-machine integration handles
  this by always passing `videoEl.currentTime * 1000` which only increases during
  normal playback.
- **VIDEO running mode needs an active playback context** — seeking to a frame
  while paused and calling detect can return empty. Either keep playback running
  or use `IMAGE` mode for ad-hoc single frames.
- **Auto-rerun via .click() while a previous loop is still alive races** —
  visible bug in the POC harness (the new run's results get clobbered by the
  old loop's stale state). Not a problem for the production integration because
  the engine only runs one detection loop at a time.

## Open follow-ups

- Test on a static-camera outdoor session with clear orange ball — see if pose
  detection holds up on completely different environment.
- Run the Pose Heavy variant (`pose_landmarker_heavy.task`, ~26 MB) to see if
  it picks up landmarks in the t=12s edge case where Lite gave nothing.
- Mobile (Android Capacitor WebView) — does the GPU delegate path still work?

## Files added in Chunk 1

- `dashboard.html` — ESM bridge for `window.__MP`
- `debug-pose-poc.html` — standalone POC page (gitignored via `debug-*.html`)
- `_eval/pose_sample_v2_t1500.jpg` — visual proof (gitignored via `_eval/`)
