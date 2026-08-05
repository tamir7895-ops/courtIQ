# CourtIQ — Shot Accuracy Baseline 2026-06

> ⚠️ **מסמך היסטורי — לא מתאר את המצב הנוכחי.**
> מדידות מ-2026-06-15, **מלפני מודל M6** (נפרס 2026-07-23, `108ffda`). המספרים מתארים מנוע אחר; המתודולוגיה וקבצי ה-GT עדיין רלוונטיים.
> למצב העדכני: [`docs/STATE-2026-08.md`](STATE-2026-08.md).
> התוכן להלן נשמר כפי שנכתב, בכוונה.

> קו בסיס כמותי של דיוק זיהוי זריקות במצב הקוד הנוכחי (post-L30/L31/L31.2/L32/L33).
> 3 מדדים על קבוצת קליפים בעלי ⁨ground truth⁩: ספירת ניסיונות, ⁨confusion matrix⁩ made/miss, ודיוק מיקום.
> כל כשל ממופה לקטגוריית מצב.

**הקשר:** דוח זה נסמך על [STATE-REPORT-2026-06.md](STATE-REPORT-2026-06.md) ועל [yolo-report-2026-06-11.md](../scratch/yolo-report-2026-06-11.md) (האחרון מתאר את הבייסליין הקודם **pre-fix**).

---

## תקציר ביצועים

| מדד | v1 (outdoor pan) | v3 (TikTok indoor) | מטרה (per yolo-report §7) |
|------|-------------------|---------------------|-----|
| ⁨GT⁩ — סה״כ rim events | 10 | 11 | — |
| Engine — שזרקות נספרו | 3 | 9 | — |
| **Recall (attempts)** | **10%** | **64%** | ≥ 80% |
| **Precision (attempts)** | **33%** | **78%** | ≥ 80% |
| **Made/Miss accuracy** (על matched) | 0% (1/1 שגוי) | **86%** (6/7) | ≥ 80% |
| Rim-lock distance error | 0.044 (קמפ׳ X) | 0.013 | < 0.02 |
| Rim lost/recovered cycles | 2 (כולל hard-lost) | 1 | 0 |

**הסיכום בלי מילים:** v3 קרוב למטרה (recall 64%, accuracy 86%); v1 רחוק מאוד (recall 10%, precision 33%, accuracy 0%) — סוגיית ⁨outdoor⁩ + ⁨camera pan⁩ + multi-shooter.

---

## 1. Provenance + הסתייגויות

### קבצים בשימוש
| Asset | תיאור |
|------|-------|
| `scratch/gt/ground_truth.json` | Ground truth ידני — frame-level review + contact sheets |
| `scratch/runs/run_v1.json` | ריצה על v1 @ 2026-06-11 15:01:13 UTC (post-L30+, WebGPU on) |
| `scratch/runs/run_v3.json` | ריצה על v3 @ 2026-06-11 15:02:30 UTC (post-L30+, WebGPU on) |
| `scratch/runs/run_v3_L33a.json` | אינטרמדיט L33a (12 דקות לפני run_v3.json) |
| `scratch/yolo-report-2026-06-11.md` | דוח קודם — pre-fix baseline + הצעות התיקון |

### הסתייגויות
1. **L34 (preload model) נוסף לאחר היריצות** — אך משפיע רק על טעינה ולא על דיוק זיהוי, כך שהבייסליין רלוונטי.
2. **רק v1 ו-v3 נכללים** — אין GT ל-⁨_eval/v2.mp4⁩, ⁨_eval/screenrec3/user-test{1,2,3}.mp4⁩, ⁨_eval/screenrec4/user-test4.mp4⁩, ולכן נדרש תיוג ידני לפני שאפשר להוסיף אותם לבייסליין. ראה §5.
3. **`Download.mp4` ≡ `_eval/v3.mp4`** (בייט-זהה) — לא מוסיף מידע חדש.
4. **Desktop CPU** (לא טלפון) — ביצועים בפועל על מובייל יהיו פחותים יותר.
5. **שתי דגימות בלבד**: ה-CIs רחבים. כל ייעוץ שיפור צריך לעבור eval חוזרת על קבוצה רחבה יותר.

---

## 2. ⁨v1⁩ — outdoor, pan, multi-shooter

### Setup
- 832×464 @ 60 fps, 35.06s, ⁨outdoor⁩
- 3 שחקנים (right-wing, left-block, third)
- 2+ כדורים בו-זמנית (אחד מונח על המגרש)
- פרחי גדר אדומים בגובה הטבעת (FP risk לכדור)
- **המצלמה panit** — `cx_rim` נע 0.30–0.37

### GT (10 rim events + 2 non-rim)
| GT | t | תוצאה | זורק | הערה |
|----|---|-------|------|------|
| E1 | 0.9 | made | unknown | בטיסה בתחילת הוידאו |
| E2 | 7.0 | miss | left toss | rim hit, יוצא שמאלה |
| E3 | 9.3 | made | left toss | — |
| E4 | 11.0 | non-rim | — | זריקה קצרה, לא הגיעה לטבעת |
| E5 | 14.1 | non-rim | — | זריקה נמוכה ליד הטבעת, לא הגיעה לרים |
| E6 | 18.4 | miss | right wing | off rim, יוצא ימינה |
| E7 | 19.45 | made | left block | — |
| E8 | 20.8 | made | left block | — |
| E9a | 21.47 | miss | left block | front rim, חזרה אחורה |
| E9b | 22.55 | miss | right wing | wide-right airball |
| E10 | 28.7 | miss | right wing | בנק, מתחלק על הטבעת |
| E11 | 33.1 | made | right wing | back-rim kill |

### ריצת המנוע — 3 ניסיונות נספרו
| Engine t | Trigger | Result | Zone | מיפוי ל-GT |
|----------|---------|--------|------|------------|
| 14.22 | pose (conf 0.28) | made | paint | **FP** — נופל על E5 non-rim (toss) |
| 15.05 | rim-event | made | midrange | **FP** — אותו חלון של E5, רעש rim-event |
| 35.06 | rim-event (flush) | missed | threePoint | E11 made (t=33.1, ∆=1.96s) — סווג **שגוי** כ-missed |

### 2.1 ⁨Attempt accuracy⁩ — v1
| מטריקה | ערך |
|--------|-----|
| Engine counted total | 3 |
| Correctly matched (engine→GT rim event) | **1** (E11) |
| Missed attempts (GT ללא engine) | **9** (E1, E2, E3, E6, E7, E8, E9a, E9b, E10) |
| Double-counted | 0 |
| False positives (engine ללא GT rim) | **2** (engine t=14.22, t=15.05 — שניהם נפלו על E5 non-rim) |
| **Recall** | 1/10 = **10%** |
| **Precision** | 1/3 = **33%** |

### 2.2 ⁨Made/Miss confusion⁩ — v1
רק זוג מתואם אחד (E11):

| | Pred made | Pred miss |
|--|-----------|-----------|
| **True made** | 0 | **1 (E11)** |
| **True miss** | 0 | 0 |

**Accuracy: 0%** (1/1 שגוי) — Engine flushed את E11 בסוף הוידאו עם `triggerSrc:rim-event` אבל `ballThroughRim:false`, ועלה במסלול ה-`_processNoBall`/timeout שלא חוצה דרך upgrade chain → ⁨false miss⁩.

### 2.3 ⁨Location accuracy⁩ — v1
- **Rim lock**: ב-t=6.2 ב-(0.347, 0.356) — vs GT cx=0.373, cy=0.358 (ממוצע ה-pan). שגיאה ≈ **0.026** ב-cx (≈ חצי רוחב טבעת).
- **Rim lost cycles**: 2 (lost @ 10.67, recovered @ 12.4; lost-hard @ 18.06, relock-start @ 24.1). **בין 18.06 ל-24.1 הרים היה פתוח לחלוטין** — וזה כיסה את E6, E7, E8, E9a, E9b (5 ניסיונות אבודים בגלל זה).
- **Shot X/Y per shot**: 2 מ-3 ב-rim-locked center (0.368, 0.391). אחד (engine t=35.06) ב-(0.357, 0.372) — relock פרשני.
- **Zone accuracy**: לא ניתן להעריך — GT לא מציינת אזורים.

### 2.4 ⁨Rim lock⁩ — v1
```
locked: true @ t=6.2 → (0.347, 0.356)
GT: (0.373, 0.358) — שגיאה 0.026
events: lock → lost → recovered → lost → lost-hard → relock-start
```

---

## 3. ⁨v3⁩ — TikTok indoor, single shooter

### Setup
- 576×1024 @ 30 fps, 31.98s, ⁨indoor⁩
- שחקן יחיד, מגרש נקי
- כתובית TikTok מעל לרים (FP risk להופ)
- רשת לבן/אדום, לוגו ⁨Oregon "O"⁩ מתחת לטבעת (FP risk לכדור)
- **GT verified_empty_spans**: [8.45,10.05], [12.0,13.6], [16.0,18.1], [19.7,21.9], [23.25,25.35], [27.35,30.05]

### GT (11 attempts: 8 made / 3 miss)
מספרים ב-`gt/ground_truth.json` v3.attempts.

### 3.1 ⁨Attempt accuracy⁩ — v3
| מטריקה | ערך |
|--------|-----|
| Engine counted total | 9 |
| Correctly matched | **7** |
| Missed attempts | **4** (GT#1 miss @1.0; GT#3 made @4.25; GT#4 made @5.0; GT#10 miss @30.45) |
| Double-counted | 0 |
| False positives | **1** (engine t=18.68, ⁨rim-event⁩, סווג ⁨rebound⁩ — נפל בין GT#7 made @14.8 ל-GT#8 miss @22.1) |
| **Recall** | 7/11 = **63.6%** |
| **Precision** | 7/9 = **77.8%** |

### 3.2 ⁨Made/Miss confusion⁩ — v3
על 7 הזוגות המתואמים:

| | Pred made | Pred miss |
|--|-----------|-----------|
| **True made** | **6** | 0 |
| **True miss** | **1** | 0 |

**Accuracy: 86%** (6/7) — שגיאה אחת: **GT#8 @22.1 (miss) → engine @22.31 made**. ה-engine ירה על rim-event (ה-ball פגע ברים והתנדף החוצה), ושרשרת ה-upgrade החזירה אותו ל-made. **שום זריקה לא סווגה כ-miss על ידי המנוע**, מה שמרמז על ה-upgrade chain עדיין דומיננטי גם כשהמטרה ⁨evidence-gated counting⁩ הופעלה.

### 3.3 ⁨Location accuracy⁩ — v3
- **Rim lock**: ב-t=0.35 ב-(0.463, 0.356) — vs GT (0.475, 0.352). שגיאה ≈ **0.013** (פחות מחצי רוחב טבעת ✓).
- **Rim lost cycles**: 1 (lost+recovered @ 7.16).
- **Shot X/Y per shot**: כל 9 הזריקות באותו (0.463, 0.356) — engine מייחס את הזריקה ל-rim center, לא למיקום השחקן.
- **Zone accuracy**: ~33% (2/6 מתואמות) — מוגבל בכך שה-GT לא מגדיר אזורים; ה-engine העריך paint יתר על המידה ב-step-back (GT#6) וב-put-backs (GT#9, GT#11).

### 3.4 ⁨Rim lock⁩ — v3
```
locked: true @ t=0.35 → (0.463, 0.356)
GT: (0.475, 0.352) — שגיאה 0.013
events: lock → stabilized → lost@7.16 → recovered@7.16
```

---

## 4. מיפוי כשלים לקטגוריות מצב

### v1 — 12 כשלים (9 missed + 2 FP + 1 misclass)
| קטגוריה | מספר | אירועים |
|---------|------|---------|
| **rim_drift** | 6 | E3 (rim still locked but pose missed); E6, E7, E8, E9a, E9b (rim היה lost ב-18.06-24.1) |
| **angle/distance** | 2 | E2 @7.0 (left toss, רחוק מהמצלמה); E10 @28.7 (פעולת בנק, ⁨rim deflection⁩ ולא transit) |
| **other** (timing/pose) | 2 | E1 (לפני rim-lock @6.2); E11 (סיווג שגוי בסוף סשן — `_processNoBall` flush) |
| **phantom_no_ball** | 1 | engine t=14.22 — pose ירה על E5 non-rim toss |
| **rebound/rim_event_noise** | 1 | engine t=15.05 — rim-event רעש שני מאותו חלון של E5 |
| occlusion | 0 | — |
| lighting | 0 | — |
| speed | 0 | — |

### v3 — 6 כשלים (4 missed + 1 FP + 1 misclass)
| קטגוריה | מספר | אירועים |
|---------|------|---------|
| **speed** | 1 | GT#1 @1.0 — pose-init לקח עד 2.477s, ה-attempt קרה לפני |
| **rebound** | 1 | engine t=18.68 (FP) — rebound של GT#7 שפגע ברים |
| **other** (composite motion / upgrade chain) | 3 | GT#3 & GT#4 (אותו חלון shot_started 3.149-7.16s — pose לא ירה פעמיים); GT#10 (engine קישר את t=31.71 ל-GT#11 במקום); GT#8 misclassified כ-made |
| **occlusion** | 0 | — |
| **lighting** | 0 | — |
| **angle** | 0 | — |
| **rim_drift** | 0 | — |

### סיכום קטגוריות (אגרגציה)
| קטגוריה | סה״כ v1+v3 |
|---------|------------|
| rim_drift | **6** |
| other (timing/pose/upgrade chain) | **5** |
| angle/distance | **2** |
| rebound | **2** |
| phantom_no_ball | **1** |
| speed | **1** |
| occlusion | 0 |
| lighting | 0 |

---

## 5. פערים — קליפים ללא GT שצריכים תיוג

לפי הקריטריון שהמשתמש קבע ("אל תמציא ground truth"), הקליפים הבאים **לא** נכנסו לבייסליין:

| קליפ | משך משוער | סטטוס GT | הערה |
|------|------------|----------|------|
| `_eval/v2.mp4` | indoor | **חסר** | היה ב-eval set היסטורי |
| `_eval/screenrec3/user-test.mp4` | unknown | **חסר** | מסיבוב v8.5+ |
| `_eval/screenrec3/user-test2.mp4` | unknown | **חסר** | — |
| `_eval/screenrec3/user-test3.mp4` | unknown | **חסר** | — |
| `_eval/screenrec4/user-test4.mp4` | unknown | **חסר** | — |
| `Download.mp4` (root) | 32s | זהה ל-v3 ✓ | byte-identical |

**אם נרצה להרחיב את הבייסליין**, צריך:
1. לתייג ידנית כל קליפ — כמה זריקות בוצעו, כמה נכנסו, מאיפה.
2. להריץ את ה-harness (⁨scratch/eval-harness.html⁩) על כל קליפ ולשמור `run_<vid>.json`.
3. להוסיף לדוח זה בלוק חדש (§6, §7…) על אותו פורמט של §2, §3.

---

## 6. תובנות לפעולה (התואמות ל-roadmap)

### v3 — 86% accuracy אבל recall 64%
- **3 missed (GT#3, GT#4, GT#10)** קשורים לשרשרת קצרה של זריקות תוך פחות מ-2 שניות — ה-pose state machine לא יורה פעמיים בתוך אותו `shot_started` cycle.
- **GT#1 @ 1.0** — pose model לא נטען בזמן (init לקח 0.45s + מתחיל ב-2.477s). **L34 (preload)** אמור לפתור את זה אבל לא היה פעיל בריצה הזו.
- **GT#8 (miss → made)** — דוגמה ברורה ל-upgrade chain עדיין עובד. ⁨evidence-gated counting⁩ L31 אמור היה לעצור את זה אבל לא הצליח כשה-rim-event ירה עם `ballThroughRim:true`.

### v1 — recall 10% catastrophic
- **6 מתוך 9 missed** הם בגלל ⁨rim lost⁩ במשך 6.04 שניות (18.06-24.1). זה כיסה 5 ניסיונות.
- שאר ה-missed הם pose שלא ירה — multi-shooter outdoor distance.
- **2 FPs** מ-E5 (low toss non-rim) מראים שה-pose trigger רגיש מדי לתנועות שאינן זריקה לסל.
- ⁨Rim lock⁩ במיקום צריך טיפול נקודתי — pan-aware rim tracking.

### עדיפויות תיקון מומלצות (לפי תוצאות עצמן)
1. **חזק את ה-rim-lost recovery** — האירוע ב-v1 מ-18.06 עד 24.1 מחק 5 ניסיונות. דרוש: גישה של ⁨warm-start⁩ מהמיקום האחרון לפני lost, או lock רך עם expiry יותר ארוך.
2. **Pose retrigger בתוך `shot_started`** — בלי זה, GT#3 ו-GT#4 (זריקות עוקבות במהירות) ייעלמו. כרגע יש cooldown של 400ms שלא מאפשר זה.
3. **Defer pose triggers בלי ⁨rim-lock⁩** — FPs ב-v1 (engine t=14.22) קרו לפני שהיה rim-lock יציב (lock @ 6.2). היה צריך לדחוס triggers עד אחרי `RIM_STABILIZATION_MS` (2s).
4. **השלמת ⁨evidence-gated counting⁩ L31** — GT#8 קליפ קלאסי: ה-engine ראה ⁨ballThroughRim:true⁩ ולא תפס את זה בתור miss. ⁨ballThroughRim⁩ לא מספיק — צריך לבדוק גם `belowAfter` ⁨motion⁩.

---

## 7. מתודולוגיה

### ⁨Matching tolerance⁩
- כל engine shot מתואם לאירוע GT הקרוב ביותר תוך **±2.5 שניות**.
- engine shot ללא GT בטווח = **FP**.
- אירוע GT ללא engine shot בטווח = **missed**.

### Recall ו-Precision
- **Recall** = `correctly_matched / GT_total × 100`
- **Precision** = `correctly_matched / engine_total × 100`

### ⁨Confusion matrix made/miss⁩
- מחושב **רק** על ה-`correctly_matched` subset.
- ⁨FPs⁩ לא נכללים (לא מתאימים ל-GT, אין True label).

### Location accuracy
- **Rim lock distance**: ⁨Euclidean⁩ בין `(lock_cx, lock_cy)` ל-GT `(true_rim.cx, true_rim.cy)`. כשהמצלמה panit (v1) — לפי הממוצע של ה-pan.
- **Shot X/Y**: מציין האם המנוע מייחס מיקום שונה לכל זריקה (לפי מיקום שחקן) או תמיד את ה-⁨rim center⁩ הנעול.
- **Zone accuracy**: מוגבל — GT לא מספק אזורי court. הוערך באומדן לפי הקשר (layup=paint, jumper מהקשת=⁨3pt⁩).

### Categorization scheme
8 קטגוריות: `lighting`, `angle`, `speed`, `occlusion`, `rebound`, `rim_drift`, `phantom_no_ball`, `other`. כל כשל נמדד דרך `transitions` + `detFrames` + `engineShotLog` payload בקובץ run.

---

## 8. סטטוס סוף הריצה

- **v3 baseline (current state)**: recall 64%, precision 78%, made/miss accuracy 86%. **קרוב למטרה (80%) אבל לא שם.**
- **v1 baseline (current state)**: recall 10%, precision 33%, made/miss accuracy 0% (sample size 1). **רחוק מאוד מהמטרה.** עיקר הבעיה — ⁨outdoor rim tracking⁩ ו-multi-shooter pose.
- **GT לא קיים** ל-⁨v2⁩ ו-⁨screenrec/user-test⁩ — אלה צריכים תיוג לפני שיתווספו לבייסליין.

**זהו קו הבסיס. כל שיפור עתידי (refactor של ⁨upgrade chain⁩, ⁨pose retrigger⁩, ⁨rim-warm-start⁩) חייב להציג מדידה מול ⁨run_v1.json⁩ ו-⁨run_v3.json⁩ ולהראות שיפור.**
