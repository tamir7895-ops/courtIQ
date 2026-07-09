# CourtIQ — State Report 2026-06

> סריקת מצב read-only של חמשת התחומים, עם ציטוטי `file:line` מהקוד החי.
> נסרק 2026-06-15 על ידי 5 ⁨subagents⁩ מקבילים.

---

## תוכן עניינים
1. [זיהוי ומודל](#1-זיהוי-ומודל-detection--model)
2. [UI](#2-ui)
3. [נתונים ו-Backend](#3-נתונים-ו-backend)
4. [Build ו-Deploy](#4-build-ו-deploy)
5. [בריאות קוד](#5-בריאות-קוד-code-health)

---

## 1. זיהוי ומודל (Detection & Model)

### תמונת אמת
שכבת הזיהוי משתמשת ב-⁨YOLOX-tiny v6_polished⁩ (3 מחלקות) שרץ עם cadence מותאם backend, בשילוב ⁨MediaPipe Pose Full⁩ עד 3 אנשים. ה-state machine פועל ב-4 מצבים עם מעל 30 ⁨L-patches⁩ פעילים.

### מודל ⁨ONNX⁩ נטען בפועל
- **קובץ:** `basketball_yolox_tiny_v6_polished.onnx` — [`features/shot-tracking/shotDetection.js:661`](features/shot-tracking/shotDetection.js#L661)
- **מחלקות:** 3 — `Basketball=0, Hoop=1, Player=2` — [`shotDetection.js:66-69`](features/shot-tracking/shotDetection.js#L66)
- **Stride:** 8 — [`shotDetection.js:70`](features/shot-tracking/shotDetection.js#L70)

### Cadence ועיבוד
| מדד | ערך | מיקום |
|------|-----|-------|
| Frame interval (~30 FPS) | 33 ms | [`shotDetection.js:51`](features/shot-tracking/shotDetection.js#L51) |
| ⁨YOLOX⁩ — WASM | כל 6 frames | [`shotDetection.js:1276`](features/shot-tracking/shotDetection.js#L1276) |
| ⁨YOLOX⁩ — WebGPU | כל 3 frames | [`shotDetection.js:1276`](features/shot-tracking/shotDetection.js#L1276) |
| Color fallback | כל frame | [`shotDetection.js:1276`](features/shot-tracking/shotDetection.js#L1276) |

### קבועי זיהוי
| קבוע | ערך | מיקום |
|------|-----|-------|
| `DEBOUNCE_MS` | 400 (היה 700 לפני L14.A) | [`shotDetection.js:44`](features/shot-tracking/shotDetection.js#L44) |
| `BALL_HOT_WINDOW_MS` | 600 | [`shotDetection.js:1177`](features/shot-tracking/shotDetection.js#L1177) |
| `POSE_HARD_TIMEOUT_MS` | 3200 | [`shotDetection.js:1178`](features/shot-tracking/shotDetection.js#L1178) |
| Ball confidence threshold | 0.05 | [`shotDetection.js:49`](features/shot-tracking/shotDetection.js#L49) |

### State Machine
4 מצבים: `idle → shot_started → near_hoop → cooldown` — [`shotDetection.js:567`](features/shot-tracking/shotDetection.js#L567), [`shotDetection.js:2777-2778`](features/shot-tracking/shotDetection.js#L2777)

### Pose Detection
- **Variant:** ⁨MediaPipe Pose Full⁩ (לא Lite) — [`poseDetector.js:44`](features/shot-tracking/poseDetector.js#L44), [`poseDetector.js:363`](features/shot-tracking/poseDetector.js#L363)
- **numPoses:** 3 (multi-person עם shooter selection)
- **Triggers:** `detectShootingMotion` ו-`detectSetPointMotion` — [`poseDetector.js:176-225`](features/shot-tracking/poseDetector.js#L176), [`poseDetector.js:248-322`](features/shot-tracking/poseDetector.js#L248)

### תומכי-זיהוי
- **⁨SORT Tracker⁩:** IoU + distance hybrid, `maxAge=30, minHits=2` — [`sortTracker.js:24-33`](features/shot-tracking/sortTracker.js#L24)
- **Adaptive color learning:** 200 דגימות מקס׳, אחוזונים 10-90 — [`adaptiveLearning.js:38`](features/shot-tracking/adaptiveLearning.js#L38), [`adaptiveLearning.js:157-158`](features/shot-tracking/adaptiveLearning.js#L157)
- **Trajectory KNN (made/miss):** `k=5` — [`adaptiveLearning.js:275`](features/shot-tracking/adaptiveLearning.js#L275)
- **⁨YOLOX⁩ preprocessing:** BGR swap (כי אומן עם `cv2.imread`) — [`yoloxWorker.js:37-45`](features/shot-tracking/yoloxWorker.js#L37)

### L-Patches פעילים בקוד
`L14.A, L14.B/C, L15, L23, L26, L30, L31, L31.2, L32, L33, L34` — פזורים ב-[`shotDetection.js:44`](features/shot-tracking/shotDetection.js#L44), `:249`, `:803`, `:806`, `:1084`, `:1114-1125`, `:1239`, `:1270`, `:1375`, `:1646`.

### מודלים בתיקיית ⁨models/⁩
5 קבצי `.onnx`: `v6, v6_polished, v7, v71, base tiny`
- **רק `v6_polished` בשימוש** — היתר ⁨orphans⁩.

### ⚠️ פערים (Discrepancies)
1. **כותרת `shotDetection.js` (שורות 5-6) טוענת v10 + 2 מחלקות**, אך הקוד מטעין `v6_polished` עם 3 מחלקות — header lines 5-6 vs [`shotDetection.js:66-69`](features/shot-tracking/shotDetection.js#L66).
2. **כותרת אומרת "cadence frame 3"**, אך WASM מריץ כל 6 (רק WebGPU כל 3) — header line 9 vs [`shotDetection.js:1276`](features/shot-tracking/shotDetection.js#L1276).
3. **הערה על stride לא עקבית** — [`shotDetection.js:57-70`](features/shot-tracking/shotDetection.js#L57) מתאר v6_polished כ-2 מחלקות בטעות.

---

## 2. UI

### תמונת אמת
שתי יוזמות עיצוב פעילות במקביל: **⁨CourtIQ UI v2⁩** (חי ב-production מ-Phase 7, 2026-04-20, כל הדגלים ON), ו-**⁨Shot Tracker v2⁩** (Phase 1 הושלם, CSS+config staged, אבל כל הדגלים OFF). ⁨dashboard.html⁩ הוא ה-entry point.

### ⁨UI v2⁩ — Production מ-Phase 7
**כל הדגלים ברירת מחדל ON:**
- `SHELL_ACTIVE, HOME_TAB, TRACK_TAB, TRAIN_TAB, COACH_TAB, ME_TAB` — [`features/ui-v2/config.js:25-32`](features/ui-v2/config.js#L25)

### Phase 8 Restoration Units (10 פיצ׳רים, כולם ON, מ-2026-04-28)
`COACH_RECS, ME_TROPHIES, ME_SETTINGS, TRAIN_DRILL_GEN, TRAIN_PLAYER, TRACK_HEATMAP, TRACK_ZONES, TRACK_SESSIONS, HOME_CALENDAR, ME_SOCIAL` — [`features/ui-v2/config.js:34-44`](features/ui-v2/config.js#L34)

### Rollback Mechanism
- `?ui=core` → מבטל **רק** Phase 8 (לדיבוג) — [`features/ui-v2/config.js:8-12`](features/ui-v2/config.js#L8), [`:47-52`](features/ui-v2/config.js#L47)
- `?ui=v1` → **לא נתמך יותר**, אך קוד מת קיים — [`features/ui-v2/config.js:84`](features/ui-v2/config.js#L84)
- 18 מודולי ⁨UI v2⁩ נטענים מ-`dashboard.html:2840-2876+`; כל אחד בודק את הדגל הרלוונטי (למשל [`features/ui-v2/tabs/home.js:13`](features/ui-v2/tabs/home.js#L13))

### ⁨Shot Tracker v2⁩ — Phase 1 בלבד
- **MIGRATION.md אומר:** Phase 1 הושלם, "Zero JS changes" — [`features/shot-tracking/v2/MIGRATION.md:9, 28-30`](features/shot-tracking/v2/MIGRATION.md#L9)
- **בפועל:** `window.SHOT_TRACKER_V2` מוגדר עם **כל הדגלים false**: `ACTIVE_SCREEN, SETUP_SCREEN, REPLAY_SCREEN, SUMMARY` — [`features/shot-tracking/v2/config.js:12-22`](features/shot-tracking/v2/config.js#L12)
- CSS files מ-`shot-tracker-v2.css, shot-tracker-v2-type.css` **commented out** — [`dashboard.html:44-45`](dashboard.html#L44), [`www/dashboard.html:44-45`](www/dashboard.html#L44)
- אבל `features/shot-tracking/v2/config.js` **כן נטען** — [`dashboard.html:2829`](dashboard.html#L2829)

### ⚠️ פערים (Discrepancies)
1. **MIGRATION.md טוען "Zero JS changes"** אבל `ShotTrackingScreen.js` **אף פעם לא קורא** את `SHOT_TRACKER_V2` flags. Grep מצא רק 2 הזכרות (שתיהן בהערות) — [`features/shot-tracking/v2/MIGRATION.md:28-30`](features/shot-tracking/v2/MIGRATION.md#L28).
2. **`config.js` נטען אבל לא נצרך** → ⁨dead weight⁩ של ~1-2KB — [`dashboard.html:2829`](dashboard.html#L2829).
3. **`me-shop.css` נטען** ([`dashboard.html:82`](dashboard.html#L82)) אבל אין מודול ⁨JS⁩ תואם.
4. **קוד מת ל-`?ui=v1`** למרות שההערה אומרת "v1 fallback removed" — [`features/ui-v2/config.js:70-79, 84`](features/ui-v2/config.js#L70).

---

## 3. נתונים ו-Backend

### תמונת אמת
⁨CourtIQ⁩ משתמש ב-⁨Supabase⁩ עם anon key **hardcoded בקוד** (CRITICAL). 6 טבלאות בשימוש בקוד client, אך **רק migration אחד** קיים. AI דרך edge function `claude-proxy` עם ⁨Claude Sonnet 4⁩ (`claude-sonnet-4-20250514`).

### ⁨Supabase⁩ — Connection
- **URL:** `https://txnsuzlgfafjdipfqkqe.supabase.co` — [`js/supabase-client.js:4`](js/supabase-client.js#L4)
- **Anon key:** **hardcoded** ב-3 מיקומים (⚠️ critical):
  - [`js/supabase-client.js:5`](js/supabase-client.js#L5)
  - `android/app/src/main/assets/public/js/supabase-client.js:2`
  - [`www/js/supabase-client.js:5`](www/js/supabase-client.js#L5)

### טבלאות בשימוש (client code)
| טבלה | שימוש | מיקום |
|------|--------|-------|
| `profiles` | קריאה/כתיבה user_data ⁨JSONB⁩ | [`js/data-service.js:10, 20, 100, 117`](js/data-service.js#L10) |
| `training_weeks` | nested select עם `training_sessions` | [`js/data-service.js:31-34`](js/data-service.js#L31) |
| `training_sessions` | sub-query | [`js/data-service.js:31-34`](js/data-service.js#L31) |
| `ai_shot_sessions` | TEXT id, פורמט `ai_<epoch>_<rand>` | [`features/shot-tracking/shotService.js:82`](features/shot-tracking/shotService.js#L82) |
| `ai_shots` | UNIQUE `(session_id, shot_number)` | [`features/shot-tracking/shotService.js:104, 131, 161`](features/shot-tracking/shotService.js#L104) |
| `shot_sessions` (legacy) | תאימות לאחור | [`features/shot-tracking/shotService.js:104-113`](features/shot-tracking/shotService.js#L104) |

### Migrations — חוסר מהותי
**רק קובץ migration אחד:** [`supabase/migrations/save_ai_session_atomic.sql`](supabase/migrations/save_ai_session_atomic.sql)
- מגדיר RPC לאטומיות session+shots
- UNIQUE constraint על `ai_shots`: `ai_shots_session_shot_unique (session_id, shot_number)` — [`save_ai_session_atomic.sql:40-42`](supabase/migrations/save_ai_session_atomic.sql#L40)
- `ai_shot_sessions.id` הוא TEXT — [`save_ai_session_atomic.sql:14-16`](supabase/migrations/save_ai_session_atomic.sql#L14)

### Edge Function — `claude-proxy`
- **מודל:** `claude-sonnet-4-20250514` — [`js/ai-coach.js:133`](js/ai-coach.js#L133), [`js/ai-coach.js:471`](js/ai-coach.js#L471)
- **Endpoint:** `https://txnsuzlgfafjdipfqkqe.supabase.co/functions/v1/claude-proxy` (hardcoded) — [`js/ai-coach.js:129, 467`](js/ai-coach.js#L129)
- **Auth:** ⁨Supabase Bearer token⁩ → x-api-key לקלוד עם `ANTHROPIC_API_KEY` מ-`Deno.env` — [`supabase/functions/claude-proxy/index.ts:38-52`](supabase/functions/claude-proxy/index.ts#L38)
- **אין rate limit נראה לעין.**

### ⚠️ פערים (Discrepancies)
1. **`profiles`, `training_weeks`, `training_sessions` נצרכות בקוד** אבל **אין migrations** ליצירתן — [`js/data-service.js:10, 31`](js/data-service.js#L10) vs `supabase/migrations/`.
2. **`weekly_schedules` מופיע בדוח ישן** ([`docs/COURTIQ-FULL-AUDIT.md:331`](docs/COURTIQ-FULL-AUDIT.md#L331)) אבל **לא נמצא בקוד** (grep מחזיר 0).
3. **`ai_shot_sessions` אין constraint מפורש** ב-migration — קיים רק INSERT implicit ([`save_ai_session_atomic.sql:73`](supabase/migrations/save_ai_session_atomic.sql#L73)).

---

## 4. Build ו-Deploy

### תמונת אמת
**`root/` הוא מקור האמת היחיד.** `build.js` מעתיק 10 יעדים ל-⁨www/⁩ ללא טרנספורמציות. ⁨GitHub Actions⁩ מחליף את `CACHE_VERSION` אוטומטית ב-git commit hash בכל push למאסטר. ⁨Capacitor⁩ משתמש ב-⁨www/⁩ ישירות.

### build.js
- **10 יעדים** מועתקים: `dashboard.html, shared.css, manifest.json, sw.js, js, styles, features, models, assets, icons` — [`build.js:16-27`](build.js#L16)
- **Recursive file copy ללא טרנספורמציה** — [`build.js:29-41`](build.js#L29) משתמש ב-`fs.copyFileSync`
- **⁨www/index.html⁩ נוצר בבילד כ-redirect ל-`dashboard.html`** — [`build.js:58-81`](build.js#L58)

### אמת — root vs www
**Byte-identical** (אומת ב-MD5):
- `dashboard.html`: `f29f8318a83da62f00c6b956da0512d1` (root ו-www זהים)
- `data-service.js`: `d06893788693a68bbdc02df6e26b532f`

### Cache Busting
- **שורש sw.js:** `CACHE_VERSION = 65` — [`sw.js:8`](sw.js#L8)
- **⁨CI⁩ מחליף ב-commit hash בכל push למאסטר:**
  - `COMMIT=$(git rev-parse --short HEAD)` — `.github/workflows/deploy-pages.yml:31`
  - `sed 's/const CACHE_VERSION = [^;]*/const CACHE_VERSION = '$COMMIT'/'` — `deploy-pages.yml:32`

### CI/CD Workflows
- **`deploy-pages.yml`** → trigger על push למאסטר, מבצע build + replace CACHE_VERSION
- **`auto-merge.yml`** → יוצר ⁨PRs⁩ ל-branches `claude/**, tracking-**, feature/**, fix/**` וממזג למאסטר — `auto-merge.yml:3-10, 77-82`

### ⁨Capacitor⁩
- **`webDir: "www"`** — [`capacitor.config.json:4`](capacitor.config.json#L4)
- ⁨Android assets⁩ מסונכרנים ב-`android/app/src/main/assets/public/` (788 קבצים זהים ל-www/)

### package.json — Scripts
- `npm run build` → `node build.js`
- `npm run sync` → `node build.js && npx cap sync android`
- `npm run open` → `npx cap open android`
- **אין `test` או `lint` scripts** — [`package.json:6-8`](package.json#L6)

### ⚠️ פערים (Discrepancies)
1. **`STATIC_ASSETS` ב-`sw.js` מיושן** — [`sw.js:36-66`](sw.js#L36) מצהיר 29 ⁨JS⁩, 19 CSS, אך בפועל יש 41 ⁨JS⁩ ו-23 CSS בתיקיות. חסרים: `avatar-bridge.js, court-heatmap.js, night-training.js, notifications.js, player-analysis.js, redesign-wiring.js, shot-analysis.js, video-review.js, workout-timer.js, avatar-3d.css, badges.css, feature-heroes.css`.
2. **`README.md` אומר "Simply open index.html"** אבל אין `index.html` בשורש — [`README.md:39`](README.md#L39).
3. **`android/app/src/main/assets/public/` הוא mirror של www/** — דורש `npm run sync` ידני; אין post-build hook אוטומטי.

---

## 5. בריאות קוד (Code Health)

### תמונת אמת
⁨CourtIQ⁩ סובל מ-3 עותקים של רוב הקוד (root, www/, android/assets/), 382 ⁨MB⁩ של `scratch/` untracked, **אפס קבצי טסט**, ו-197 `console.log` מפוזרים. עיקר ה-TODO/FIXME ב-⁨UI v2⁩ tabs.

### Top Duplications — 3x Sources of Truth
| קובץ | שורות | מיקומים |
|------|-------|---------|
| `drill-engine.js` | **4041** | js/, www/js, android/, _design-import, worktree → **9 עותקים!** |
| `shotDetection.js` | **2911** | features/, www/, android/, _design-import → 5 עותקים |
| `ShotTrackingScreen.js`, `poseDetector.js`, `adaptiveLearning.js`, `index.js` | — | features/ + www/ + android/ (3 כל אחד) |

### גדלים חריגים
| נתיב | גודל | סטטוס |
|------|------|--------|
| `scratch/` | **382 MB** | Untracked. כולל `annotated/`, `annotated_v1.mp4, annotated_v3.mp4, eval-harness.html, yolo-report-2026-06-11.md, frames/, runs/` |
| `android/app/src/main/assets/public/` | **169 MB** | Mirror של www/ |
| ⁨ONNX⁩ models (4 קבצים) | **76 MB** | tracked ב-git: v6, v6_polished, v7, v71 |
| `.claude/worktrees/bold-hawking-ab4b7d` | **51 MB** | Stale (May 14). אמור להיות ב-`.gitignore:2` |
| `_design-import/` | **2.33 MB** | Figma exports — סטטוס לא ברור |

### Test Coverage
- **0 קבצי `.test.js`** ב-`features/`, `js/`, `www/` (glob על `**/*.test.js` מחזיר רק `node_modules/`).

### Logging
- **197 console statements** ב-50 קבצים.
- `shotDetection.js` עושה זאת נכון עם ⁨debug flag⁩ — [`shotDetection.js:23-26`](features/shot-tracking/shotDetection.js#L23) (gated ב-`window.ShotDetectionDebug`).
- שאר הקבצים — לא gated.

### TODO/FIXME/HACK
**29 open** מרוכזים ב-`features/ui-v2/tabs/`:
- [`features/ui-v2/tabs/train.js`](features/ui-v2/tabs/train.js) — 5 TODOs
- [`coach.js`](features/ui-v2/tabs/coach.js), [`track.js`](features/ui-v2/tabs/track.js) — 2 כל אחד
- [`me.js`](features/ui-v2/tabs/me.js), [`home.js`](features/ui-v2/tabs/home.js), [`avatar-customizer.js`](features/ui-v2/tabs/avatar-customizer.js) — 1-2 כל אחד

### debug-*.html — Untracked אבל קיימים בשורש
- `debug-auto-rim-eval.html` (6/11/2026)
- `debug-eval-run.html` (6/11/2026)
- `debug-pose-poc.html` (5/26/2026)
- `debug-pose-shot-bench.html` (5/26/2026)

(כולם ב-`.gitignore:34`, לא tracked — אבל מלכלכים את השורש.)

### ⚠️ פערים (Discrepancies)
1. **`.gitignore:2` מתעלם `.claude/`**, אבל `.claude/worktrees/bold-hawking-ab4b7d` (51 MB, מ-14 במאי) קיים — ייתכן commit לפני שהכלל נוסף.
2. **`debug-*.html` ב-`.gitignore:34`** — נכון, אבל הקבצים מצטברים בשורש ללא ניקוי תקופתי.
3. **`SCRIPT_BASE` fallback** ב-[`shotDetection.js:29-41`](features/shot-tracking/shotDetection.js#L29) מטפל ב-deployment משתי-נתיבים אך לא מתועד.

---

## הערות מתודולוגיה
- כל ממצא בדוח זה אומת על ידי קריאת קוד חי (`Read`, `Grep`, `Glob`) **ולא** מדוחות ישנים.
- 5 ⁨subagents⁩ קוראים-בלבד פעלו במקביל (~4.6 דקות, 338K טוקנים, 190 קריאות-כלים).
- כל קישור file:line שמיש ב-IDE / GitHub UI כדי לקפוץ ישירות לציטוט.
