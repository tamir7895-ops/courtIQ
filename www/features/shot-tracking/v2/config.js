/**
 * Shot Tracker v2 — Feature Flag Config
 *
 * Staged rollout. Each screen flips on independently after reaching
 * parity with the existing flow. Flag reads happen once in
 * ShotTrackingScreen.buildHTML(); when a flag is false the old
 * UI renders unchanged.
 *
 * Phase 1 (this commit): all flags OFF. CSS is loaded but inert.
 * Phase 3 will flip ACTIVE_SCREEN=true after browser verification.
 */
window.SHOT_TRACKER_V2 = {
  /** Screen 2 — live broadcast overlay (hero). */
  ACTIVE_SCREEN: false,
  /** Screen 1 — rim-lock tap setup. */
  SETUP_SCREEN:  false,
  /** Screen 3 — per-shot replay modal. */
  REPLAY_SCREEN: false,
  /** Screen 4 — end-of-session summary. Must not flip until
   *  XP / alerts / zone breakdown parity verified. */
  SUMMARY:       false,
};
