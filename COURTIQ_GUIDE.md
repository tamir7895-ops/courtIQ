# CourtIQ — חוברת מקצועית מלאה
### סיכום הפרויקט · הסברים מעמיקים · מפת דרכים לאפליקציה המושלמת

---

## תוכן עניינים

1. [מה בנינו — סקירה כללית](#1-מה-בנינו)
2. [הסטאק הטכנולוגי — כל טכנולוגיה מוסברת](#2-הסטאק-הטכנולוגי)
3. [מבנה הפרויקט — קבצים ותפקידיהם](#3-מבנה-הפרויקט)
4. [מסד הנתונים — הטבלאות והמשמעות שלהן](#4-מסד-הנתונים)
5. [האינטגרציה עם Claude AI](#5-אינטגרציית-ה-ai)
6. [כל תכונה שנבנתה — הסבר מפורט](#6-תכונות-האפליקציה)
7. [מה חסר — ניתוח מלא](#7-מה-חסר)
8. [מפת דרכים לאפליקציה המושלמת](#8-מפת-דרכים)
9. [מושגי מפתח — מילון מונחים](#9-מילון-מונחים)

---

## 1. מה בנינו

**CourtIQ** היא פלטפורמת אימון כדורסל מבוססת בינה מלאכותית.

### המטרה
לתת לשחקני כדורסל בכל הרמות תוכנית אימון אישית, מעקב אחר התקדמות, וניתוח ביצועים — הכל דרך AI.

### מה הבנינו מבחינה מעשית:

| מה | תיאור |
|---|---|
| **דף נחיתה שיווקי** | `index.html` — דף שמוכר את המוצר, כולל תמחור, תכונות, ו-CTA |
| **דשבורד ראשי** | `app.html` — האפליקציה עצמה, 10 פאנלים שונים |
| **Backend ב-Supabase** | מסד נתונים, אימות משתמשים, Edge Function |
| **AI Coach** | Claude API מחובר דרך Edge Function מאובטחת |

### שלבי הפיתוח (לפי Git)

```
שלב 1: Initial release — CourtIQ הגרסה הראשונה
שלב 2: UX redesign — פיצול לindex/app, עיצוב מלא, תמחור
שלב 3: Supabase integration — DB, Auth, Edge Function
שלב 4: SQL helpers — כלי עזר להקמת מסד הנתונים
```

---

## 2. הסטאק הטכנולוגי

### Frontend — צד הלקוח

#### HTML5
**מה זה:** שפת המבנה של כל דף ווב. כמו שלד של בניין.
**איך השתמשנו:** כל האפליקציה נמצאת בשני קבצי HTML גדולים — index.html ו-app.html.
**למה ללא Framework:** בחרנו Vanilla JS (ללא React/Vue) כי רצינו להתחיל מהיר ללא כלי build מורכבים.

#### CSS3
**מה זה:** שפת העיצוב — צבעים, פונטים, פריסה, אנימציות.
**איך השתמשנו:**
- CSS Variables (משתנים גלובליים) לניהול צבעים:
  ```css
  --c-bg: #0c0d0f          /* רקע כהה */
  --c-accent: #f5a623      /* כתום-ענבר */
  --c-text: #f0ede6        /* טקסט בהיר */
  --c-surface: #17191d     /* משטח כרטיסים */
  ```
- Flexbox ו-Grid לפריסה רספונסיבית
- Animations ו-Transitions לחווית משתמש חלקה
- Breakpoints: Desktop 1024px+ / Tablet 768px / Mobile <768px

#### JavaScript (Vanilla)
**מה זה:** שפת התכנות שמביאה את הדף לחיים — לוגיקה, אירועים, קריאות API.
**איך השתמשנו:**
- State management דרך Object גלובלי: `const APP = { user, profile, currentWeek }`
- Event listeners על כפתורים ותפריטים
- Async/Await לקריאות רשת
- DOM Manipulation לשינוי התצוגה

#### Chart.js
**מה זה:** ספריית גרפים מוכנה לשימוש.
**איך השתמשנו:** 4 גרפים בפאנל Analytics:
1. **קו** — אחוז זריקה לאורך הזמן
2. **עמודות** — השוואה בין שבועות
3. **קו** — קפיצה אנכית
4. **קו** — זמן ספרינט

---

### Backend — צד השרת

#### Supabase
**מה זה:** Backend-as-a-Service — שירות שנותן לך מסד נתונים, אימות, ו-API תוך דקות, ללא צורך לכתוב שרת.
**למה Supabase ולא Firebase/custom server:**
- PostgreSQL "אמיתי" (לא NoSQL)
- Row Level Security מובנה
- Edge Functions מבוסס Deno
- חינמי לפרויקטים קטנים
- דאשבורד ויזואלי לנהל הכל

**שלושת השירותים שהשתמשנו:**

| שירות | מה זה | מה עשינו |
|---|---|---|
| **Supabase Auth** | ניהול משתמשים | הרשמה, כניסה, session |
| **Supabase Database** | PostgreSQL בענן | שמירת פרופילים, אימונים, שבועות |
| **Supabase Edge Functions** | שרת קוד בענן | Proxy לClaude API |

#### Supabase Auth — איך זה עובד
```
משתמש → מזין email/password → Supabase Auth → מחזיר JWT Token
JWT Token → נשמר ב-Browser → נשלח בכל בקשה → Supabase מאמת
```
**JWT Token:** מחרוזת מוצפנת שמזהה את המשתמש — כמו תעודת זהות דיגיטלית.

#### Row Level Security (RLS)
**מה זה:** מדיניות אבטחה ישירות במסד הנתונים.
**הבעיה שהיא פותרת:** בלי RLS, אם יש bug בקוד, משתמש יכול לראות נתוני משתמשים אחרים.
**איך עובד:**
```sql
-- המדיניות שכתבנו:
create policy "sessions: select own"
  on training_sessions
  for select
  using (auth.uid() = user_id);
-- = "משתמש יכול לראות רק שורות שה-user_id שלהן שווה ל-ID שלו"
```

---

### AI Integration

#### Claude API (Anthropic)
**מה זה:** ממשק לשימוש במודל השפה Claude — כמו ChatGPT אבל של Anthropic.
**המודל שהשתמשנו:** `claude-sonnet-4-20250514` — מודל חזק ומהיר.
**לשם מה:** יצירת סיכומים שבועיים + צ'אט AI מאמן.

#### Supabase Edge Function — claude-proxy
**למה צריך proxy?**
```
בעיה: Claude API Key חייב להיות סודי.
       אם נשים אותו ב-HTML → כל אחד יכול לגנוב אותו.

פתרון: הקוד שרץ בשרת (Edge Function) שומר את ה-key סודי.
        הפרונטאנד שולח בקשה לEdge Function → זו שולחת לClaude.
```

**הזרימה:**
```
Browser → Edge Function (Supabase) → Claude API → Edge Function → Browser
                        ↑
               רק כאן יש API Key
```

**אימות בEdge Function:**
```typescript
// קוד שכתבנו:
const { data: { user }, error } = await supabase.auth.getUser()
if (!user) return Response(401) // לא מחובר = לא מקבל AI
```

---

### Hosting

#### GitHub Pages
**מה זה:** שירות חינמי של GitHub שמאפשר להגיש קבצי HTML/CSS/JS ישירות מה-Repository.
**מגבלה:** רק קבצים סטטיים — HTML, CSS, JS. אין שרת אמיתי.
**URL:** `https://tamir7895-ops.github.io/courtIQ/`

---

## 3. מבנה הפרויקט

```
courtIQ/
│
├── index.html              ← דף נחיתה שיווקי
│   ├── Navbar + Hero
│   ├── Stats, How It Works
│   ├── Pricing (3 תוכניות)
│   ├── Features showcase
│   └── Footer
│
├── app.html                ← האפליקציה הראשית
│   ├── Sidebar (ניווט)
│   ├── Topbar (מידע עליון)
│   └── 10 פאנלים (ראה סעיף 6)
│
├── sql.html                ← כלי עזר לEstablishment
│   └── עמוד לreview SQL queries
│
└── supabase/
    ├── migrations/
    │   └── 001_initial_schema.sql    ← יצירת הטבלאות
    ├── functions/
    │   └── claude-proxy/
    │       └── index.ts              ← Edge Function
    └── trigger_only.sql              ← Trigger להרשמה
```

---

## 4. מסד הנתונים

### טבלה 1: profiles
מי הוא המשתמש.

```sql
profiles
├── id           (UUID)     ← מזהה ייחודי = זהה למזהה ב-auth.users
├── first_name   (text)     ← שם פרטי
├── last_name    (text)     ← שם משפחה
├── position     (text)     ← PG / SG / SF / PF / C
├── skill_level  (text)     ← Beginner / Intermediate / Advanced
├── goal         (text)     ← מטרת האימון
├── plan         (text)     ← starter / pro / elite
├── streak       (int)      ← כמה ימים ברצף אימן
├── created_at   (timestamp)
└── updated_at   (timestamp)
```

**UUID:** Universally Unique Identifier — מזהה ייחודי בפורמט: `550e8400-e29b-41d4-a716-446655440000`

### טבלה 2: training_weeks
שבוע אימון שהסתיים וקיבל סיכום AI.

```sql
training_weeks
├── id           (UUID)     ← מזהה ייחודי לשבוע
├── user_id      (UUID)     ← מפנה ל-auth.users (Foreign Key)
├── week_number  (int)      ← מספר השבוע (1, 2, 3...)
├── label        (text)     ← תווית מוצגת "W4"
├── summary_json (jsonb)    ← כל ניתוח ה-AI שמור כ-JSON
└── created_at   (timestamp)
```

**JSONB:** סוג עמודה ב-PostgreSQL שמאחסן JSON בצורה מועברת לחיפוש.

**מה summary_json מכיל:**
```json
{
  "averages": {
    "shootingPct": 67.3,
    "verticalIn": 28.5,
    "sprintSec": 4.2
  },
  "strengths": ["Shooting consistency", "Sprint speed"],
  "focusAreas": ["Vertical jump needs work"],
  "feedback": "טקסט AI מפורט על השבוע...",
  "generatedAt": "2025-03-01T10:00:00Z"
}
```

### טבלה 3: training_sessions
אימון יומי בודד.

```sql
training_sessions
├── id               (UUID)
├── user_id          (UUID)    ← Foreign Key לauth.users
├── week_id          (UUID)    ← Foreign Key לtraining_weeks (אופציונלי)
├── day              (text)    ← "Mon", "Tue", "Wed"...
├── shots_made       (numeric) ← זריקות שנכנסו
├── shots_attempted  (numeric) ← זריקות שנזרקו
├── dribbling_min    (numeric) ← דקות דריבלינג
├── vertical_in      (numeric) ← קפיצה אנכית באינצ'ים
├── sprint_sec       (numeric) ← זמן ספרינט בשניות
├── intensity        (text)    ← Low / Medium / High
├── notes            (text)    ← הערות חופשיות
└── created_at       (timestamp)
```

### Foreign Keys — מה זה ולמה חשוב
**הדמיה:** כמו בטופס של בנק — עמודת "קוד סניף" מצביעה על טבלת "סניפים".
```
training_sessions.user_id → auth.users.id
    ↑
אם מוחקים משתמש → כל הסשנים שלו נמחקים אוטומטית (CASCADE)
```

### Trigger — יצירת פרופיל אוטומטית
**מה זה Trigger:** קוד SQL שרץ אוטומטית כתגובה לאירוע.
```sql
-- כשמשתמש חדש נרשם ל-auth.users:
create trigger on_auth_user_created
  after insert on auth.users        -- ← אחרי הוספת שורה
  for each row
  execute procedure handle_new_user();  -- ← הפונקציה שיוצרת profile
```

**למה צריך:** ב-Supabase, הרשמה יוצרת שורה ב-`auth.users` (טבלה פנימית של Supabase), אבל לא ב-`profiles` שלנו. ה-Trigger גשר על הפער.

---

## 5. אינטגרציית ה-AI

### איך יצירת הסיכום השבועי עובדת

**שלב 1 — איסוף נתונים:**
```javascript
// קוד מapp.html — שולפים סשנים מהשבוע
const { data: sessions } = await supabase
  .from('training_sessions')
  .select('*')
  .eq('user_id', APP.user.id)
  .gte('created_at', weekStart)
```

**שלב 2 — בניית Prompt:**
```javascript
const systemPrompt = `You are an elite basketball performance analyst.
The athlete plays ${APP.profile.position}.
Analyze this week's training data and provide insights.`

const userMessage = `Sessions this week:
- Monday: ${mon.shots_made}/${mon.shots_attempted} shots, vertical ${mon.vertical_in}"
- Tuesday: ${tue.shots_made}/${tue.shots_attempted} shots...
Generate a detailed performance summary.`
```

**שלב 3 — קריאה לEdge Function:**
```javascript
const response = await fetch(
  'https://[project].supabase.co/functions/v1/claude-proxy',
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ messages, system: systemPrompt })
  }
)
```

**שלב 4 — שמירה בDB:**
```javascript
await supabase.from('training_weeks').insert({
  user_id: APP.user.id,
  week_number: currentWeek,
  summary_json: aiResult
})
```

### System vs User Messages — מה ההבדל
```
system: "הוראות קבועות לAI — מי הוא, מה התפקיד שלו"
user:   "הבקשה הספציפית — הנתונים שהוא צריך לנתח"
```

---

## 6. תכונות האפליקציה

### הגדרת התוכניות (Pricing Plans)

| תכונה | Starter $9 | Pro $24 | Elite $59 |
|---|---|---|---|
| AI תוכנית שבועית | ✅ | ✅ | ✅ |
| ספריית תרגילים | 50+ | 500+ | 500+ |
| מעקב ביצועים | בסיסי | מלא | מלא |
| Video Drills | ❌ | ✅ | ✅ |
| AI Coach Chat | ❌ | 50 הודעות | ללא הגבלה |
| Game Film Analysis | ❌ | ❌ | ✅ |
| Nutrition & Recovery | ❌ | ❌ | ✅ |

### פאנל 1: Today's Program
**מה זה:** תוכנית האימון היומית, לפי הפוזיציה.
**איך עובד:** תרגילים מסוננים לפי position שנקבע ב-Settings.
**KPIs המוצגים:** streak ימים, שבוע נוכחי, אחוז זריקה, קפיצה אנכית.

### פאנל 2: Log Session
**מה זה:** טופס לרישום אימון שהסתיים.
**שדות:**
- יום האימון
- זריקות שנכנסו / זריקות שנזרקו (מחשב % אוטומטי)
- דקות דריבלינג
- קפיצה אנכית (inches)
- זמן ספרינט (שניות)
- עוצמה (Low/Medium/High)
- הערות חופשיות
**מה קורה אחרי שמירה:** INSERT לטבלת training_sessions.

### פאנל 3: Drill Library
**מה זה:** ספריית 50+ תרגילים עם סינון.
**פילטרים:** לפי קטגוריה (Shooting / Dribbling / Defense...) ולפי קושי.
**מגבלה:** נתוני התרגילים hardcoded ב-JS (לא מ-DB).

### פאנל 4: Video Drills (PRO)
**מה זה:** ספריית וידאו HD של תרגילים.
**מצב נוכחי:** ממשק קיים, אין תוכן אמיתי — Feature gated.

### פאנל 5: Analytics
**מה זה:** גרפים וניתוח ביצועים.
**מה מוצג:**
- 4 גרפים (Chart.js) — shooting%, vertical, sprint, השוואה שבועית
- AI Summary — סיכום שבועי שנוצר על ידי Claude
- Strengths & Focus Areas — חוזקות ותחומים לשיפור

### פאנל 6: History
**מה זה:** ארכיון שבועות אימון עם הסיכומים שלהם.
**מה מוצג:** רשימת שבועות עם תאריך ו-KPIs בסיסיים.

### פאנל 7: Game Film (ELITE)
**מה זה:** העלאת סרטוני משחק לניתוח AI.
**מצב נוכחי:** UI קיים, אין backend — Feature gated.

### פאנל 8: AI Coach Chat (PRO)
**מה זה:** צ'אט בזמן אמת עם מאמן AI.
**איך עובד:**
1. משתמש כותב שאלה
2. הודעה נשלחת לEdge Function
3. Claude מקבל context מלא (פוזיציה, רמה, היסטוריה)
4. תשובה חוזרת ומוצגת
**מגבלה:** היסטוריה נמחקת ברענון — לא שמורה בDB.

### פאנל 9: Weekly Calendar
**מה זה:** לוח שנה שבועי לתכנון אימונים.
**מצב נוכחי:** UI בסיסי, אין לוגיקה.

### פאנל 10: Settings
**מה זה:** ניהול פרופיל.
**מה ניתן לשנות:** שם, פוזיציה, רמה, מטרה, תוכנית.
**מה קורה:** UPDATE לטבלת profiles.

---

## 7. מה חסר

### A. בעיות אבטחה

| בעיה | חומרה | הסבר |
|---|---|---|
| אין auth guard בapp.html | 🔴 קריטי | כל אחד יכול להיכנס ללא התחברות |
| innerHTML ללא sanitization | 🟠 גבוהה | סיכון XSS — הזרקת קוד זדוני |
| API keys נגלים ב-HTML | 🟡 בינונית | Supabase anon key נחשף (מקובל אבל שים לב) |

**XSS מוסבר:**
```
תוקף שולח הודעת צ'אט: "<script>sendAllData(hackerSite)</script>"
אם משתמשים ב-innerHTML ישירות → הסקריפט מופעל
פתרון: textContent במקום innerHTML, או DOMPurify library
```

### B. תכונות שמופיעות אבל לא פועלות

| תכונה | מה קיים | מה חסר |
|---|---|---|
| Video Drills | ממשק יפה | וידאו אמיתי, storage |
| Game Film Analysis | Upload UI | backend, AI analysis |
| Nutrition & Recovery | תצוגה עם mock data | AI generation, persistence |
| Calendar | UI בסיסי | לוגיקת לוח שנה, scheduling |
| Notifications | פאנל ריק | כל המערכת |

### C. בעיות טכניות

| בעיה | השפעה |
|---|---|
| אין error handling | המשתמש לא יודע כשמשהו נכשל |
| Chat history ב-memory בלבד | נאבד ברענון |
| אין validation בטפסים | ניתן לשלוח נתונים ריקים |
| הכל בקובץ HTML אחד | קשה לתחזוקה ועדכונים |

---

## 8. מפת דרכים לאפליקציה המושלמת

### Phase 1 — יסודות (2-3 שבועות)

**מטרה:** לוודא שמה שקיים עובד כמו שצריך.

#### 1.1 Auth Guard
```javascript
// להוסיף לתחילת app.html:
const { data: { session } } = await supabase.auth.getSession()
if (!session) {
  window.location.href = '/index.html#login'
}
```

#### 1.2 Error Handling מסודר
```javascript
// פונקציה גלובלית לניהול שגיאות:
function showError(message) {
  const toast = document.createElement('div')
  toast.className = 'toast toast-error'
  toast.textContent = message
  document.body.appendChild(toast)
  setTimeout(() => toast.remove(), 4000)
}

// שימוש:
try {
  await saveSession(data)
} catch (err) {
  showError('שגיאה בשמירת האימון. נסה שוב.')
  console.error(err)
}
```

#### 1.3 Chat History Persistence
```sql
-- טבלה חדשה:
create table chat_messages (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users on delete cascade,
  role       text not null,       -- 'user' / 'assistant'
  content    text not null,
  created_at timestamptz default now()
);
```

#### 1.4 Input Sanitization
```javascript
// להחליף innerHTML עם textContent או DOMPurify:
import DOMPurify from 'dompurify'
element.innerHTML = DOMPurify.sanitize(userContent)
```

---

### Phase 2 — תכונות ליבה (3-5 שבועות)

**מטרה:** להגיש את מה שמובטח בPRO ו-ELITE.

#### 2.1 Video Drill Library (PRO)
**מה צריך:**
1. **Storage:** Supabase Storage bucket לאחסון וידאו
2. **Database:** טבלת `drills` עם שדה `video_url`
3. **Frontend:** Video player component (HTML5 `<video>` tag)

```sql
create table drills (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  category    text not null,
  difficulty  text not null,
  video_url   text,          ← URL ל-Supabase Storage
  thumbnail   text,
  duration_sec int,
  plan_required text default 'starter'
);
```

#### 2.2 Game Film Analysis (ELITE)
**מה צריך:**
1. **Upload:** Supabase Storage לוידאו המשחק
2. **AI Analysis:** Prompt שמבקש מClaudetoparse תיאור וידאו
3. **Presentation:** דוח PDF ניתן להורדה

```
זרימה:
משתמש מעלה וידאו → Supabase Storage
→ Edge Function מנתח → שולח לClaude עם הוראות
→ Claude מחזיר analysis → נשמר ב-DB
→ מוצג למשתמש כדוח
```

#### 2.3 Nutrition & Recovery (ELITE)
**מה צריך:**
1. שאלון התחלתי (משקל, גובה, יעד קלורי)
2. Edge Function שמייצרת תפריט שבועי עם Claude
3. שמירה בDB לכל שבוע

#### 2.4 Calendar עם AI
**מה צריך:**
1. ספריית לוח שנה (Flatpickr או מובנה)
2. לוגיקת scheduling (אי-חפיפה, מנוחה בין אימונים)
3. AI שמציע מתי לאמן לפי עומס

---

### Phase 3 — פולישינג (2-3 שבועות)

**מטרה:** חווית משתמש מלאה ומלוטשת.

#### 3.1 Notifications System
```javascript
// Push Notifications עם Web Push API:
const registration = await navigator.serviceWorker.register('/sw.js')
const subscription = await registration.pushManager.subscribe({
  userVisibleOnly: true,
  applicationServerKey: VAPID_KEY
})
// שמירת subscription ב-Supabase לשליחת התראות
```

#### 3.2 Data Export
```javascript
// CSV Export:
function exportToCSV(sessions) {
  const csv = sessions.map(s =>
    `${s.day},${s.shots_made},${s.shots_attempted},${s.vertical_in}`
  ).join('\n')

  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  // trigger download...
}
```

#### 3.3 Progressive Web App (PWA)
**מה זה:** הופך את האתר לאפליקציה שניתן "להתקין" בטלפון.
**מה צריך:**
- `manifest.json` (שם, איקון, צבע)
- `service-worker.js` (cache, offline support)

```json
// manifest.json
{
  "name": "CourtIQ",
  "short_name": "CourtIQ",
  "theme_color": "#f5a623",
  "background_color": "#0c0d0f",
  "display": "standalone",
  "start_url": "/app.html"
}
```

#### 3.4 Accessibility (נגישות)
- הוספת ARIA labels לכל האלמנטים האינטראקטיביים
- בדיקת contrast ratio (מינימום 4.5:1 לטקסט)
- ניווט מלא דרך מקלדת

---

### Phase 4 — Scale (חודש+)

**מטרה:** להפוך לעסק אמיתי.

#### 4.1 Payment Integration
```javascript
// Stripe integration:
const stripe = Stripe(STRIPE_PUBLIC_KEY)
const session = await createCheckoutSession({
  priceId: 'price_pro_monthly',
  userId: APP.user.id
})
window.location.href = session.url
```

**Webhook:** Stripe מודיע לשרת שהתשלום הצליח → מעדכנים את ה-plan בDB.

#### 4.2 Admin Panel
- ניהול משתמשים
- ניהול תוכן (תרגילים, וידאו)
- Analytics (כמה משתמשים, revenue)

#### 4.3 Social Features
- Leaderboard (דירוג שחקנים)
- Training Challenges (תחרויות שבועיות)
- Coach Assignment (מאמן אנושי)

#### 4.4 Native Mobile App
**אפשרות 1:** React Native — קוד אחד לiOS ו-Android
**אפשרות 2:** Capacitor — עוטף את האתר הנוכחי כApp
**המלצה:** Capacitor כי הקוד כבר קיים

---

### Phase 5 — AI Upgrade

**מטרה:** AI ברמה הבאה.

#### 5.1 Pose Estimation (ניתוח תנועה)
```
מצלמה → MediaPipe → ניתוח מפרקים → feedback על פורמת יריה
```
**ספרייה:** Google MediaPipe (חינמי, עובד בBrowser)

#### 5.2 Personalized AI שמשתפר
```
במקום prompt גנרי:
"נתח את הנתונים האלה..."

Prompt אישי:
"זהו שחקן שנוטה להתמוטט בדיוק הזריקה תחת לחץ.
 בשבועות הראשונים אחוז הזריקה היה 65%, ירד ל-55% בשבועות תחת לחץ.
 תן המלצות ספציפיות לתסריט הזה..."
```

#### 5.3 Streaming Responses
```javascript
// במקום לחכות לתשובה מלאה:
const stream = await fetch(edgeFunctionUrl, { ... })
const reader = stream.body.getReader()

while (true) {
  const { done, value } = await reader.read()
  if (done) break
  chatBox.textContent += new TextDecoder().decode(value)
}
```

---

## 9. מילון מונחים

| מונח | הסבר |
|---|---|
| **API** | Application Programming Interface — ממשק לתקשורת בין מערכות |
| **Auth** | Authentication — תהליך זיהוי משתמש (כניסה) |
| **Backend** | צד השרת — הקוד שרץ בענן, לא בדפדפן |
| **CDN** | Content Delivery Network — רשת שרתים לטעינה מהירה של קבצים |
| **CORS** | Cross-Origin Resource Sharing — מדיניות אבטחה בין דומיינים |
| **CRUD** | Create, Read, Update, Delete — 4 פעולות בסיסיות על DB |
| **CSS Variables** | משתנים ב-CSS שאפשר לשנות ולשתף בין חלקים |
| **Deno** | Runtime לJavaScript בצד שרת (כמו Node.js) |
| **DOM** | Document Object Model — ייצוג הHTML כעצים, ניתן לשינוי בJS |
| **Edge Function** | קוד שרץ "קרוב" למשתמש, על שרתים מבוזרים |
| **Foreign Key** | עמודה בטבלה שמפנה לשורה בטבלה אחרת |
| **Frontend** | צד הלקוח — HTML/CSS/JS שרץ בדפדפן |
| **Git** | מערכת ניהול גרסאות — מאפשרת tracking של שינויים |
| **GitHub Pages** | שירות הגשת אתרים סטטיים חינמי של GitHub |
| **Hardcoded** | ערכים שקבועים ישירות בקוד, לא מ-DB |
| **HTML** | שפת המבנה של דפי ווב |
| **innerHTML** | דרך לשנות תוכן HTML דרך JavaScript |
| **JWT** | JSON Web Token — תעודת זהות דיגיטלית מוצפנת |
| **JSONB** | סוג עמודה ב-PostgreSQL לאחסון JSON |
| **Migration** | קובץ SQL שמגדיר שינויים למבנה ה-DB |
| **Mock Data** | נתונים מדומים לצורכי פיתוח ו-UI |
| **Node.js** | Runtime לJavaScript בצד שרת |
| **Payload** | הנתונים שנשלחים ב-API request |
| **PostgreSQL** | מסד נתונים רלציוני מתקדם |
| **Prompt** | ההוראות שנשלחות לmodel AI |
| **PWA** | Progressive Web App — אתר שמתנהג כApp |
| **RLS** | Row Level Security — אבטחה ברמת שורה ב-DB |
| **Repository (Repo)** | התיקיה עם כל הקוד, מנוהלת על ידי Git |
| **Runtime** | הסביבה שמריצה קוד (דפדפן, Node, Deno) |
| **Session** | מצב כניסה פעיל של משתמש |
| **State** | המצב הנוכחי של האפליקציה בזיכרון |
| **Static Site** | אתר שמורכב רק מקבצים סטטיים, ללא שרת |
| **Supabase** | Backend-as-a-Service — שירות Backend מלא |
| **Token** | מחרוזת מוצפנת שמשמשת לאימות |
| **Trigger** | קוד שמופעל אוטומטית כתגובה לאירוע ב-DB |
| **TypeScript** | JavaScript עם type checking — מונע שגיאות |
| **UUID** | מזהה ייחודי אוניברסלי |
| **Vanilla JS** | JavaScript ללא frameworks |
| **XSS** | Cross-Site Scripting — התקפת הזרקת קוד זדוני |

---

## סיכום — מפת הדרך המצומצמת

```
עכשיו:        auth guard + error handling + chat persistence
1-2 חודשים:   video drills + nutrition + calendar
3-4 חודשים:   payment (Stripe) + PWA + notifications
5-6 חודשים:   mobile app + social features + admin panel
שנה+:         pose estimation + AI personalization + coaching platform
```

---

*חוברת זו נוצרה ב-03/03/2026 עבור פרויקט CourtIQ*
*כל הנתונים מבוססים על בדיקה מלאה של הקוד*
