# CourtIQ — בנייה בענן ל-TestFlight (בלי מק)

‏המסלול: ‏Codemagic בונה את האפליקציה על מק-בענן ומעלה ישירות ל-TestFlight.
‏ה-MacBook Air 2017 לא נדרש (ראה MACBOOK_SETUP.md רק אם אי-פעם יהיה מק חדש).

## שלב 0 — אישור Apple Developer Program ✅ הופעל (2026-07-15)
‏החשבון פעיל. ‏Team ID: **3USWWKNDCV**.

## שלב 2 — רישום ה-Bundle ID ✅ בוצע (2026-07-15, אוטומטית)
‏‏**com.courtiq.app היה תפוס גלובלית** (מפתח אחר), לכן ה-Bundle ID הרשום הוא
‏**com.courtiq.ios** (Description: CourtIQ, Explicit, ללא capabilities).
‏כל הקוד (codemagic.yaml, capacitor.config.json, project.pbxproj ×2,
‏TESTFLIGHT_SETUP) כבר מעודכן. ‏Android נשאר com.courtiq.app (namespace נפרד).

## שלב 3 — יצירת האפליקציה ב-App Store Connect ✅ בוצע (2026-07-15, אוטומטית)
‏רשומת האפליקציה נוצרה: ‏Name (חנות) **CourtIQ AI** (השם "CourtIQ" היה תפוס
‏בחנות; ניתן לשנות לפני ההשקה הציבורית), ‏iOS, ‏English (U.S.),
‏Bundle **com.courtiq.ios**, ‏SKU **courtiq-001**. ‏**ASC App ID: 6791217303**.
‏השם מתחת לאייקון במכשיר נשאר **CourtIQ** (CFBundleDisplayName ב-Info.plist).

## שלב 1 — מפתח API של אפל ⬅️ **נותר לך (רק אתה — קובץ-סוד)** (3 דקות)
1. ‏appstoreconnect.apple.com → ‏Users and Access → ‏Integrations →
   ‏App Store Connect API. אם מופיע **Request Access** — ללחוץ פעם אחת
   (מפעיל את ה-API לארגון), ואז:
2. ‏Team Keys → ‏(+) → שם: ‏codemagic; תפקיד (‏Access): ‏**App Manager** → ‏Generate.
3. **Download** את קובץ ה-‏.p8 (מורידים פעם אחת בלבד! לשמור טוב) ולרשום את
   ‏**Key ID** ואת ‏**Issuer ID** (מופיע בראש העמוד).

## שלב 4 — חשבון Codemagic (5 דקות)
1. ‏codemagic.io → ‏Sign up with GitHub → לאשר גישה לריפו ‏courtIQ.
2. ‏Add application → לבחור ‏tamir7895-ops/courtIQ → סוג: ‏**iOS App**
   ‏(יזהה את ‏codemagic.yaml אוטומטית).
3. ‏Team settings (או ‏Personal account settings) → ‏Integrations →
   ‏Developer Portal → ‏App Store Connect → ‏Add key:
   - ‏Name: ‏**COURTIQ** ‏(חייב בדיוק את השם הזה — ה-yaml מפנה אליו, רגיש לאותיות)
   - ‏Issuer ID + ‏Key ID + קובץ ה-‏.p8 משלב 1.

## שלב 5 — בנייה ראשונה
1. בעמוד האפליקציה ב-Codemagic → ‏Start new build →
   ‏workflow: ‏iOS → TestFlight → ‏Start.
2. ‏~10-15 דקות; בסיום ה-build עולה אוטומטית ל-TestFlight.
3. באייפון: להתקין את אפליקציית ‏TestFlight מה-App Store, להתחבר עם
   אותו Apple ID — הגרסה תופיע (לעתים אחרי כמה דקות של "עיבוד" אצל אפל).

## שלב 6 — הבנצ'מרק (יעד M2), בלי שום מחשב
1. לפתוח את CourtIQ מ-TestFlight באייפון.
2. ‏TRACK → העלאת סרטון (~30 שניות) מהגלריה.
3. במסך-הסיכום מופיעה שורה קטנה:
   ‏`ANALYZED 30S CLIP IN 95S · 9.4 FPS · WEBGPU`
   — לצלם ולשלוח ל-Claude. ‏זה כל הבנצ'מרק:
   - ‏WEBGPU = מסלול מהיר ✓; ‏WASM = איטי (נטפל).
   - יעד שמישות: קליפ 30 שניות בפחות מ-3 דקות.

## צירוף חברי-הקבוצה לבטא (M6)
‏App Store Connect → ‏TestFlight → ‏Internal Testing → להוסיף עד 100
בודקים לפי אימייל — הם מקבלים הזמנה לאפליקציית TestFlight שלהם.
