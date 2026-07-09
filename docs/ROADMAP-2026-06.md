# CourtIQ — Roadmap 2026-06

> רשימת פעולות מתועדפת בעקבות [STATE-REPORT-2026-06.md](STATE-REPORT-2026-06.md).
> כל פעולה עם ציטוט file:line מהקוד החי.

---

## איך לקרוא את הדוח

**עדיפות:**
- 🔴 **דחוף** — אבטחה / השפעה גבוהה ומאמץ נמוך / בלוקרים לפיתוח
- 🟡 **חשוב** — השפעה גבוהה־בינונית, מאמץ סביר
- 🟢 **לטווח** — niceties, ניקיון, תיעוד

**קטגוריות:**
- 🎯 **מודל** — דטקציה, אינפרנס, training pipeline, schema של נתונים
- 🎨 **UI** — frontend, dashboard, tabs, feature flags
- 🔧 **קוד** — אבטחה, build/deploy, refactoring, ניקיון

---

## 🔴 דחוף

### 🔧 קוד — אבטחה

| # | פעולה | השפעה / מאמץ | למה | מקור |
|---|--------|----------------|-----|------|
| **R1** | להעביר ⁨Supabase URL + anon key⁩ מ-hardcoded ל-environment / build-time injection | 🔴 high / 🟢 low | Anon key חשוף ב-3 קבצי source חיים. גם אם RLS מגן, חשיפת keys = best-practice violation לפני release. | [`js/supabase-client.js:4-5`](js/supabase-client.js#L4), `android/.../js/supabase-client.js:2`, [`www/js/supabase-client.js:5`](www/js/supabase-client.js#L5) |
| **R2** | לבדוק שהמפתח ⁨Anthropic API⁩ לא דולף בלוגים/הודעות שגיאה מ-`claude-proxy` | 🔴 high / 🟢 low | Edge function משתמש ב-`Deno.env.ANTHROPIC_API_KEY` אך לא וידאנו שאין `console.log(err)` שיחזיר את ה-key ללקוח. | [`supabase/functions/claude-proxy/index.ts:38-52`](supabase/functions/claude-proxy/index.ts#L38) |
| **R3** | לעשות audit ל-⁨RLS policies⁩ על `profiles, ai_shot_sessions, ai_shots, shot_sessions, training_weeks, training_sessions` | 🔴 high / 🟡 medium | Anon key חשוף → RLS הוא קו ההגנה היחיד. אין לנו ראיה שכל הטבלאות מוגנות. | טבלאות בשימוש ב-[`js/data-service.js`](js/data-service.js) ו-[`features/shot-tracking/shotService.js`](features/shot-tracking/shotService.js) |

### 🎯 מודל — תיקון schema חסר

| # | פעולה | השפעה / מאמץ | למה | מקור |
|---|--------|----------------|-----|------|
| **R4** | ליצור migration files עבור `profiles, training_weeks, training_sessions` (CREATE TABLE + RLS) | 🔴 high / 🟡 medium | הטבלאות נצרכות בקוד אבל אין migration ליצירתן → לא ניתן ל-restore או ל-bootstrap project חדש. | קוד צורך ב-[`js/data-service.js:10, 31`](js/data-service.js#L10); migrations: רק [`supabase/migrations/save_ai_session_atomic.sql`](supabase/migrations/save_ai_session_atomic.sql) |

---

## 🟡 חשוב

### 🎯 מודל

| # | פעולה | השפעה / מאמץ | למה | מקור |
|---|--------|----------------|-----|------|
| **R5** | לתקן את ה-header banner ב-`shotDetection.js` כך שישקף **v6_polished 3-class** במקום v10 2-class | 🟡 high / 🟢 low | Documentation drift אקטיבי — ההערה אומרת דבר אחד, הקוד מטעין משהו אחר. בלבול מובטח למפתחים עתידיים. | header lines 5-6, 9, 57 vs [`shotDetection.js:66-69`](features/shot-tracking/shotDetection.js#L66), [`:1276`](features/shot-tracking/shotDetection.js#L1276) |
| **R6** | למרכז את לוגיקת ה-cadence (WASM=6, WebGPU=3) בקבוע אחד | 🟡 medium / 🟡 medium | הערך מפוזר בין `shotDetection.js:51` (תיאור) לבין `shotDetection.js:1276` (קוד). שינוי בעתיד יכול לפספס מיקום. | [`shotDetection.js:51`](features/shot-tracking/shotDetection.js#L51), [`shotDetection.js:1276`](features/shot-tracking/shotDetection.js#L1276) |
| **R7** | להוסיף validation runtime שווידא שטוענים ⁨MediaPipe Pose Full⁩ ולא Lite | 🟡 medium / 🟡 medium | אם CDN מחזיר Lite, המערכת תרוץ עם candidateCount=1 ותדרדר ביצועים שקטה. | [`poseDetector.js:39-43`](features/shot-tracking/poseDetector.js#L39) |
| **R8** | להוסיף rate-limit / quota ל-`claude-proxy` edge function | 🟡 medium / 🟡 medium | אין הגנה מפני שימוש לרעה במפתח ⁨Anthropic⁩. user-bug או botnet יכול לרוקן quota. | [`supabase/functions/claude-proxy/index.ts:38-52`](supabase/functions/claude-proxy/index.ts#L38) |

### 🎨 UI

| # | פעולה | השפעה / מאמץ | למה | מקור |
|---|--------|----------------|-----|------|
| **R9** | להחליט: למחוק את הקוד המת ל-`?ui=v1` rollback **או** להחזיר את התמיכה | 🟡 low / 🟢 low | קוד unreachable בקובץ קונפיגורציה גלוי. ההערה אומרת "removed" אבל הקוד נשאר. | [`features/ui-v2/config.js:70-79, 84`](features/ui-v2/config.js#L70) |
| **R10** | לעדכן `MIGRATION.md` ל-`features/shot-tracking/v2/` שיציין: Phase 2 **יחייב** שינוי `ShotTrackingScreen.buildHTML()` לקריאת `SHOT_TRACKER_V2` flags | 🟡 medium / 🟢 low | המסמך טוען "Zero JS changes" כשהמציאות העתידית דורשת אחרת. ינעל את הצוות בהפתעה. | [`features/shot-tracking/v2/MIGRATION.md:28-30`](features/shot-tracking/v2/MIGRATION.md#L28) |

### 🔧 קוד

| # | פעולה | השפעה / מאמץ | למה | מקור |
|---|--------|----------------|-----|------|
| **R11** | לעדכן את `STATIC_ASSETS` ב-`sw.js` שיכלול את כל 41 ה-JS ו-23 ה-CSS בפועל | 🟡 high / 🟡 medium | קבצים חדשים (`night-training.js, badges.css` וכו') לא נכנסים ל-cache → דליפת רשת מתמדת על PWA offline. שווה לאוטמט ב-`build.js`. | [`sw.js:36-66`](sw.js#L36) מצהיר 29 JS+19 CSS; בפועל יש 41+23 |
| **R12** | להפחית את שלוש העותקים של הקוד (root, www/, android/) למקור אמת יחיד | 🟡 high / 🟡 medium | `drill-engine.js` (4041 שורות) ב-9 מיקומים, `shotDetection.js` ב-5. כל שינוי דורש sync ידני; risk גבוה לדריפט. | `js/drill-engine.js` ↔ www/ ↔ android/ ↔ _design-import |
| **R13** | להוסיף test infrastructure (לפחות smoke tests ל-`shotDetection` ו-`drill-engine`) | 🟡 high / 🔴 high | אפס קבצי `.test.js` בפרויקט. שני המודולים הכי גדולים = הכי קריטיים והכי חסרי כיסוי. | Glob `**/*.test.js` → רק node_modules |

---

## 🟢 לטווח

### 🎯 מודל

| # | פעולה | השפעה / מאמץ | למה | מקור |
|---|--------|----------------|-----|------|
| **R14** | להעביר ⁨ONNX⁩ models orphan (v6, v7, v71, base) ל-`models/legacy/` או למחוק | 🟢 low / 🟢 low | רק `v6_polished` בשימוש; היתר תופסים 57 MB ב-git ומבלבלים. | `www/models/` — 5 קבצי `.onnx`; שימוש רק ב-[`shotDetection.js:661`](features/shot-tracking/shotDetection.js#L661) |
| **R15** | לתעד את סכמת מספור ה-`L-patches` (L1-L34) במקום אחד | 🟢 low / 🟢 low | 30+ patches פעילים ללא מפתח קריאה. תיעוד = patches בעתיד יעקבו אחר הקונבנציה. | פזורים ב-[`shotDetection.js`](features/shot-tracking/shotDetection.js) |
| **R16** | לתעד את `ai_shots` UNIQUE constraint בהערה ב-`shotService.js` | 🟢 low / 🟢 low | Constraint קיים אבל לא ברור למפתחים שמשנים את `shotService`. | [`supabase/migrations/save_ai_session_atomic.sql:40-42`](supabase/migrations/save_ai_session_atomic.sql#L40) ↔ [`shotService.js:200-202`](features/shot-tracking/shotService.js#L200) |

### 🎨 UI

| # | פעולה | השפעה / מאמץ | למה | מקור |
|---|--------|----------------|-----|------|
| **R17** | להסיר `features/shot-tracking/v2/config.js` מ-`dashboard.html` עד Phase 2 | 🟢 low / 🟢 low | נטען לחינם — אף קוד לא צורך את ה-flags. | [`dashboard.html:2829`](dashboard.html#L2829) |
| **R18** | להחליט: ליצור `me-shop.js` או למחוק את `me-shop.css` | 🟢 low / 🟢 low | CSS orphan — מבלבל לגבי קיום הפיצ׳ר. TODO ב-[`avatar-customizer.js:201`](features/ui-v2/tabs/avatar-customizer.js#L201) מציע שזה תלוי. | [`dashboard.html:82`](dashboard.html#L82) |
| **R19** | לאחד את ה-29 TODO/FIXME ב-`features/ui-v2/tabs/` למפה מרכזית או למספרים | 🟢 medium / 🟡 medium | TODOs מפוזרים ב-`train.js, coach.js, track.js, me.js, home.js, avatar-customizer.js`. מפתחים מפספסים. | `features/ui-v2/tabs/*.js` |

### 🔧 קוד

| # | פעולה | השפעה / מאמץ | למה | מקור |
|---|--------|----------------|-----|------|
| **R20** | לעדכן `README.md` לציין "run `npm run build` before opening" | 🟢 low / 🟢 low | טוען "Simply open index.html" אבל אין `index.html` בשורש; משתמש מתבלבל. | [`README.md:39`](README.md#L39) |
| **R21** | להוסיף post-build hook שמסנכרן `android/app/src/main/assets/public/` עם `www/` אוטומטית | 🟢 medium / 🟡 medium | `npm run sync` ידני; קל לפספס. גורם לדריפט מובייל ↔ web. | [`package.json:6-8`](package.json#L6) |
| **R22** | לתעד את אסטרטגיית cache-busting (hardcoded value → CI sed) ב-`sw.js` כהערה | 🟢 low / 🟢 low | אם מישהו ישנה את ה-CI logic, יכול לפסטר את ה-flow. | [`sw.js:8`](sw.js#L8) + `.github/workflows/deploy-pages.yml:31-32` |
| **R23** | לארגן `scratch/` (382 MB) — לדחוס לארכיון או לתעד ב-README | 🟢 medium / 🟢 low | 382 MB untracked של ML eval artifacts. בלי מבנה ברור = יצמח עוד יותר. | `scratch/` — eval-harness, annotated MP4s, frames/, runs/ |
| **R24** | לפנות `debug-*.html` מהשורש לתיקיית `_debug/` או למחוק ישנים | 🟢 low / 🟢 low | מלכלכים שורש פרויקט. ב-.gitignore אבל עדיין שם. | `debug-auto-rim-eval.html, debug-eval-run.html, debug-pose-poc.html, debug-pose-shot-bench.html` |
| **R25** | להסיר `.claude/worktrees/bold-hawking-ab4b7d` (51 MB, May 14) | 🟢 low / 🟢 low | Worktree ישן שלא נוקה. `.gitignore:2` אמור להתעלם, אבל קיים על דיסק. | `.claude/worktrees/bold-hawking-ab4b7d` |
| **R26** | לעטוף את 197 ה-`console.log` ב-debug flag (כמו `shotDetection.js:23-26`) או להסיר | 🟢 low / 🟡 medium | 50 קבצים עם ⁨logging spam⁩ ב-production. `shotDetection.js` עושה זאת נכון — להעתיק את הדפוס. | 197 instances; הפתרון: [`shotDetection.js:23-26`](features/shot-tracking/shotDetection.js#L23) |
| **R27** | לתעד או לארכב את `_design-import/` (2.33 MB) | 🟢 low / 🟢 low | Figma exports ממחזורים קודמים — לא ברור אם רלוונטיים. | `_design-import/v2, _design-import/shot-tracker-v2, _design-import/mobile-app` |
| **R28** | להסיר `weekly_schedules` מ-[`docs/COURTIQ-FULL-AUDIT.md:331`](docs/COURTIQ-FULL-AUDIT.md#L331) — לא בשימוש | 🟢 low / 🟢 low | תיעוד שגוי — מציין טבלה שלא קיימת בקוד. | [`docs/COURTIQ-FULL-AUDIT.md:331`](docs/COURTIQ-FULL-AUDIT.md#L331) vs grep `.from('weekly_schedules')` → 0 |

---

## סדר עבודה מומלץ

### ספרינט 1 — אבטחה ויסודות (1-2 שבועות)
1. **R1** — Supabase keys ל-env
2. **R2** — Audit log leaks ב-`claude-proxy`
3. **R3** — RLS audit על כל הטבלאות
4. **R4** — Migrations חסרים (`profiles, training_weeks, training_sessions`)
5. **R5** — תיקון header `shotDetection.js`

### ספרינט 2 — refactoring כבד (2-3 שבועות)
6. **R11** — `STATIC_ASSETS` ב-`sw.js`
7. **R12** — single source of truth (root → www/android via build)
8. **R13** — test infrastructure

### ספרינט 3 — בריאות UI (1-2 שבועות)
9. **R6, R7** — cadence + MediaPipe validation
10. **R8** — rate-limit ל-`claude-proxy`
11. **R9, R10, R17, R18, R19** — ניקוי UI v2 ו-Shot Tracker v2

### תחזוקה רציפה (לטווח)
- **R14-R16** — תיעוד מודל
- **R20-R28** — ניקיון קוד והפחתת drift

---

## הערות מתודולוגיה
- 28 פעולות בסך הכל, מתועדפות לפי impact × effort.
- כל פעולה מתבססת על ממצא מ-[STATE-REPORT-2026-06.md](STATE-REPORT-2026-06.md), עם ציטוט file:line מהקוד החי.
- אומדני מאמץ הם דיווח-מקור-יחיד — נדרש refining ע״י המפתח בפועל.
- אם פעולה R# מסומנת ⚠️ אבטחה — לא לדחות.
