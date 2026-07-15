# CourtIQ — בנייה בענן ל-TestFlight (בלי מק)

‏המסלול: ‏Codemagic בונה את האפליקציה על מק-בענן ומעלה ישירות ל-TestFlight.
‏ה-MacBook Air 2017 לא נדרש (ראה MACBOOK_SETUP.md רק אם אי-פעם יהיה מק חדש).

## שלב 0 — ממתינים לאישור Apple Developer Program
‏כל השלבים הבאים אפשריים רק אחרי מייל-האישור של אפל (24-48ש' מהתשלום).

## שלב 1 — מפתח API של אפל (3 דקות, באתר)
1. ‏appstoreconnect.apple.com → ‏Users and Access → ‏Integrations →
   ‏App Store Connect API → ‏Team Keys → ‏(+).
2. שם: ‏codemagic; תפקיד (‏Access): ‏**App Manager**.
3. להוריד את קובץ ה-‏.p8 (מורידים פעם אחת בלבד! לשמור טוב) ולרשום את
   ‏**Key ID** ואת ‏**Issuer ID** (מופיע בראש העמוד).

## שלב 2 — רישום ה-Bundle ID (2 דקות)
1. ‏developer.apple.com → ‏Certificates, Identifiers & Profiles →
   ‏Identifiers → ‏(+) → ‏App IDs → ‏App.
2. ‏Description: ‏CourtIQ; ‏Bundle ID (Explicit): ‏**com.courtiq.app**.
3. ‏Capabilities: לא צריך לסמן כלום מעבר לברירת-המחדל → ‏Register.

## שלב 3 — יצירת האפליקציה ב-App Store Connect (2 דקות)
1. ‏appstoreconnect.apple.com → ‏My Apps → ‏(+) → ‏New App.
2. ‏Platform: ‏iOS; ‏Name: ‏CourtIQ (אם תפוס — ‏CourtIQ AI);
   ‏Language: ‏English; ‏Bundle ID: לבחור ‏com.courtiq.app;
   ‏SKU: ‏courtiq-001.

## שלב 4 — חשבון Codemagic (5 דקות)
1. ‏codemagic.io → ‏Sign up with GitHub → לאשר גישה לריפו ‏courtIQ.
2. ‏Add application → לבחור ‏tamir7895-ops/courtIQ → סוג: ‏**iOS App**
   ‏(יזהה את ‏codemagic.yaml אוטומטית).
3. ‏Team settings (או ‏Personal account settings) → ‏Integrations →
   ‏Developer Portal → ‏App Store Connect → ‏Add key:
   - ‏Name: ‏**courtiq-asc** ‏(חייב בדיוק את השם הזה — ה-yaml מפנה אליו)
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
