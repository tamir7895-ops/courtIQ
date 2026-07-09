# פרומפטים לקוד קלוד — CourtIQ (יוני 2026)

פרומפטים אוטונומיים סביב הפיצ'רים החדשים של קוד קלוד, מעודכנים לפי `docs/STATE-REPORT-2026-06.md` (15.06.2026).

**המיקוד:** המודל וההתנהגות שלו. לא UI. הזיהוי עצמו (סל/כדור/שחקן) טוב — הבעיה היא **שכבת הזריקה שמעליו**: לספור כל זריקה, להבדיל הקלעה מהחטאה, ולדעת מאיפה נזרקה. לכן **אין אימון מחדש של המודל** — כל העבודה ב-pipeline ב-JavaScript.

## איך הפיצ'רים החדשים עובדים

1. **`/goal`** — מגדיר תנאי-סיום שקלוד עובד לעברו לאורך תורות עד שמתקיים.
2. **`/workflow`** — מפזר את העבודה ל-subagents מקבילים ברקע.
3. **`ultrathink`** — מבקש חשיבה עמוקה יותר לאותו תור.

מריצים קודם `/goal` עם תנאי הסיום, ואז מדביקים את גוף הפרומפט (`ultrathink`).

---

## פרומפט 1 — סריקת מצב מלאה ✅ הורץ

הורץ 15.06.2026 → `docs/STATE-REPORT-2026-06.md`. **הצמד אותו לכל הפרומפטים הבאים.**

---

## פרומפט 2 — דיוק שכבת הזריקה (המיקוד העיקרי)

תוכנית בת 3 שלבים שרשרתיים, **מדידה-תחילה**: אי אפשר לתקן "ספירה לא מושלמת" בלי לדעת קודם, במספרים, איפה ובאילו מצבים זה נשבר.

**רקע מהקוד (מה קיים היום):**
- State machine: `idle → shot_started → near_hoop → cooldown` — `shotDetection.js:567`, `:2777`
- ספירה/החלטה: `createRimZone` (`:272`), `isInApproachZone` (`:291`), rim-transit detector, `DEBOUNCE_MS=400` (`:44`), `MADE_MAX_FRAMES=22`, `MIN_TRAJECTORY_PTS=3`, evidence-gated counting (L30–L34)
- made/miss: `TrajectoryLearner` KNN `k=5` על trajectory+rimZone — `adaptiveLearning.js:241-349`, `:922`
- טריגרי זריקה מ-pose: `detectShootingMotion`, `detectSetPointMotion` — `poseDetector.js:176-322`
- שמירה: `shot_x/y`, `launch_x/y`, `shot_zone`, `shot_result` — `shotService.js:144-152`. היסטוריית אזורים מכירה **4 אזורים** (`:323-327`) בעוד ה-UI מציג **7/11** → אי-התאמה לאיחוד.

**פרויקט / cd (לכל שלושת השלבים):**
```
cd C:\projects\Personal\CourtIQ\CourtIQ
```
**קבצים להצמיד:** `docs/STATE-REPORT-2026-06.md`, `features/shot-tracking/shotDetection.js`, `features/shot-tracking/adaptiveLearning.js`, `features/shot-tracking/poseDetector.js`, `features/shot-tracking/shotService.js`. קליפים: `Download.mp4`, `scratch/annotated_v1.mp4`, `scratch/annotated_v3.mp4`, `scratch/det_v1.csv`, `scratch/det_v3.csv`, `scratch/det_summary.json`, `scratch/yolo-report-2026-06-11.md`, `_eval/screenrec/`, `_eval/screenrec2/`.

---

### שלב 2A — מדידה כנה (read-only, חובה ראשונה)

קודם הרץ:
```
/goal קיים docs/SHOT-ACCURACY-BASELINE-2026-06.md עם שלושה מדדים על קבוצת קליפים בעלי ground truth: (1) דיוק ספירת ניסיונות — כמה זריקות פוספסו, נספרו פעמיים, או false-positive (ריבאונד/העברה שנספרו כזריקה); (2) confusion matrix של made מול missed; (3) דיוק האזור/מיקום. כל כשל ממופה לקטגוריית מצב (תאורה / זווית / מהירות / הסתרה / ריבאונד). אף קובץ קוד לא שונה.
```
ואז:
```
ultrathink

מטרה: למדוד במספרים מדויקים איפה שכבת הזריקה נשברת — ספירה, made/miss, ומיקום. בלי זה אי אפשר לתקן. הצמדתי את docs/STATE-REPORT-2026-06.md.

שלב 1 — אסוף קליפים: Download.mp4, scratch/annotated_v1.mp4, annotated_v3.mp4, _eval/screenrec*, וכל קליפ נוסף. בדוק מה כבר קיים ב-scratch/ (det_v1.csv, det_v3.csv, det_summary.json, yolo-report-2026-06-11.md) — אולי יש שם eval קודם שמיש.

שלב 2 — ground truth: לכל קליפ צריך אמת מדידה — כמה זריקות בוצעו, כמה נכנסו, ומאיפה כל אחת. אם אין תיוג קיים — עצור ובקש ממני לספק אותו (אספור ידנית: מספר זריקות, הקלעות, ומיקום בכל קליפ). אל תמציא ground truth.

שלב 3 — הרץ את ה-pipeline הקיים (shotDetection.js + adaptiveLearning.js + poseDetector.js) על הקליפים והשווה לאמת. דווח בנפרד: זריקות שפוספסו, זריקות שנספרו פעמיים, false-positives (ריבאונד/העברה/דריבל שנספרו), confusion matrix של made/miss, ושגיאות אזור. פזר subagent לכל קליפ לריצה מקבילה.

שלב 4 — מפה כל כשל לקטגוריית מצב, וכתוב docs/SHOT-ACCURACY-BASELINE-2026-06.md עם הטבלאות והמספרים. זהו קו הבסיס שכל שיפור יימדד מולו.

אל תשנה אף קובץ קוד. בסיום הרץ git status וודא שאין שינויים פרט לדוח.
```

---

### שלב 2B — ספירת זריקות + הקלעות/החטאות (טען וירה, לפי 2A)

תוצאות 2A נתנו שלושה גורמי-שורש מדויקים. הפרומפט כבר ממוקד בהם — לא צריך לאבחן מחדש.

**קו בסיס מ-2A (היעד: לעבור):**
| מדד | v1 (outdoor) | v3 (TikTok) | יעד |
|---|---|---|---|
| Recall (attempts) | 10% | 64% | ≥80% |
| Precision (attempts) | 33% | 78% | ≥80% |
| Made/Miss accuracy | 0% (n=1) | 86% (n=7) | ≥80% |
| Rim-lock error | 0.026 | 0.013 | <0.02 |

(אחרי 2A; הצמד את `docs/SHOT-ACCURACY-BASELINE-2026-06.md`)

קודם הרץ:
```
/goal שלושת גורמי-השורש מ-2A תוקנו ונמדדו: (1) v1 recall עלה ל-≥80% אחרי תיקון אובדן ה-rim; (2) v3 made/miss הגיע ל-100% אחרי ש-GT#8 (החטאה אמיתית) מסווג נכון; (3) v3 recall עלה ל-~82% אחרי שזריקות עוקבות תוך 0.75s נספרות. כל שינוי ב-root/ בלבד; www/ נבנה מחדש דרך node build.js; האפליקציה עולה בלי שגיאות קונסול; לפני כל עריכה בקוד פרודקשן עצרת לאישור; ואף מדד אחר בקו הבסיס לא נסוג.
```
ואז:
```
ultrathink

מטרה: לתקן את שלושת גורמי-השורש שזוהו ב-docs/SHOT-ACCURACY-BASELINE-2026-06.md (הצמדתי), ולהוכיח שיפור מול קו הבסיס. אמת כל גורם מול הקוד לפני שאתה נוגע.

תיקון 1 — אובדן rim (מפיל את v1): ב-v1 ה-rim אבד ל-6.04 שניות (18.06s–24.1s) והפיל 5 ניסיונות עוקבים (E6,E7,E8,E9a,E9b). הסל סטטי — אין סיבה לאבד אותו. הוסף rim warm-start / נעילה (cache של מיקום ה-rim האחרון + השהיית "lost" ארוכה בהרבה לפני שמוותרים). ראה createRimZone (shotDetection.js:272) ו-isInApproachZone (:291). יעד: v1 recall ≥80%.

תיקון 2 — סיווג made שגוי (v3 GT#8): זריקה שהחטיאה אמיתית סווגה כ-made כי ballThroughRim:true שלט, בעוד שהכדור פגע ברים והתנדף החוצה. חזק את ה-evidence-gated counting (L31) כך שייבדק גם belowAfter-motion (שהכדור המשיך מטה דרך הרשת) ולא רק ballThroughRim. ראה rim-transit ב-shotDetection.js. יעד: v3 made/miss = 100%.

תיקון 3 — retrigger חסום (v3): שתי זריקות עוקבות תוך 0.75s לא נספרו כי cooldown של 400ms חסם את shot_started מלירות שוב. אפשר pose retrigger בתוך shot_started (GT#3, GT#4) — כשטריגר set-point/shooting-motion חדש מ-poseDetector (:176-322) מופיע, גובר על ה-cooldown. שמור על DEBOUNCE_MS (:44) להגנה מפני ספירה כפולה אמיתית. יעד: v3 recall ~82% (+2 זריקות).

לכל תיקון: הצג מה אתה משנה ולמה, וחכה לאישור מפורש שלי (plan mode) לפני נגיעה בקוד פרודקשן. אחרי אישור: יישם ב-root/ בלבד, node build.js, ומדוד שוב מול קו הבסיס — הוכח שכל יעד הושג ושאף מדד אחר לא נסוג.

הערה: אם תייגתי בינתיים קליפים נוספים (v2, screenrec3, screenrec4), מדוד גם עליהם. עריכות ב-root/ בלבד, לעולם לא ב-www/ או android/assets/.
```

---

### שלב 2C — מאיפה נזרקה (כיול מגרש)

קודם הרץ:
```
/goal כל זריקה מקבלת אזור מדויק (דיוק גבוה, לא ברמת הסנטימטר) ממיקום רגלי השחקן ברגע השחרור, דרך כיול מגרש (homography); סכמת האזורים אוחדה למקור-אמת אחד בין shotService לבין ה-UI (פתרון אי-ההתאמה 4↔11); www/ נבנה מחדש; ולפני שינוי סכמה או קוד פרודקשן עצרת לאישור. דיוק האזור נמדד מול ה-ground truth מ-2A.
```
ואז:
```
ultrathink

מטרה: לדעת מאיפה כל זריקה נזרקה ברמת דיוק גבוהה. היום launch_x/y ו-shot_zone הם image-space (shotService.js:145-149), ויש אי-התאמה: האחסון מכיר 4 אזורים (:323-327) וה-UI מציג 7/11.

גישה:
1. כיול מגרש: הוסף שלב כיול עם 4 נקודות ייחוס ידניות (פינות הצבע / קשת ה-3) → חישוב מטריצת homography.
2. מיקום שחקן: קח את נקודת רגלי השחקן (תחתית ה-bbox של class Player=2) בפריים השחרור (סנכרן עם רגע ה-shot_started / set-point מ-poseDetector).
3. מיפוי: העבר את נקודת הרגליים דרך ה-homography לקואורדינטות מגרש אמיתיות → אזור.
4. אחד את סכמת האזורים: בחר מקור-אמת אחד (למשל 11 אזורי ה-UI) ועדכן את shotService + fetchZoneHistory בהתאם.

הצג את הגישה, נקודות הכיול, וסכמת האזורים המאוחדת — וחכה לאישור לפני יישום. אחרי אישור: יישם ב-root/, הרץ node build.js, ומדוד דיוק אזור מול ה-ground truth מ-2A.

עריכות ב-root/ בלבד. שינוי סכמת אחסון דורש אישור מפורש.
```

---

## Tracks נפרדים (לא במיקוד הנוכחי)

נשמרים כאן להמשך — לא חלק מתוכנית המודל.

### בריאות קוד וארכיטקטורה
מתוך הדוח: `drill-engine.js` ב-9 עותקים, `scratch/` 382MB untracked, `.claude/worktrees/` 51MB stale, **באג ב-`sw.js`** (STATIC_ASSETS מיושן — caching offline שבור ל-12 קבצים), 0 טסטים, 197 console לא-gated. נקודת התחלה מומלצת: תיקון `sw.js` (סיכון-נמוך/תועלת-גבוהה).

### נתונים ו-backend
`profiles`, `training_weeks`, `training_sessions` נצרכות בקוד אך **ללא migrations** → סכמה ו-RLS חיות רק ב-Supabase ולא ב-git. שווה reverse-engineer ל-migrations + לוודא ש-RLS מופעל (ה-anon key הציבורי תקין בעיצוב — הסיכון הוא רק טבלה בלי RLS).

---

## הערות

- כל פרומפטי המודל read-first ועוצרים לאישור לפני שינוי פרודקשן (plan mode).
- הצמד תמיד את `docs/STATE-REPORT-2026-06.md`, ואחרי 2A גם את `docs/SHOT-ACCURACY-BASELINE-2026-06.md`.
- שווה לשקול `/init` ל-`CLAUDE.md` בהמשך — עדיין אין קובץ הקשר בפרויקט.
