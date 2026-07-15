# CourtIQ — הרצה על אייפון מה-MacBook (M2)

‏כל הפיתוח נשאר ב-Windows. המק הוא תחנת-בנייה בלבד: מושכים, בונים, מריצים על האייפון.

## חד-פעמי (הכנת המק)

1. **‏Xcode** מה-Mac App Store (גדול, ~12GB — להתחיל להוריד מוקדם).
   אחרי ההתקנה לפתוח פעם אחת ולאשר את רכיבי-העזר.
2. **‏Node.js** — אם אין: `brew install node` (או מתקין מ-nodejs.org).
3. לשכפל את הריפו:
   ```bash
   git clone https://github.com/tamir7895-ops/courtIQ.git
   cd courtIQ
   npm install
   ```
4. **חיבור החשבון ל-Xcode:** ‏Xcode → Settings → Accounts → ‏+ → להתחבר עם
   ה-Apple ID. (עוד לפני שאפל מאשרת את התוכנית בתשלום — חתימה אישית חינמית
   מספיקה להרצה על המכשיר שלך.)

## בכל סבב עבודה

```bash
git pull
npm run ios:sync        # בונה www + מסנכרן + מגזם ל-25MB
npx cap open ios        # פותח את הפרויקט ב-Xcode
```

‏ב-Xcode:
1. לבחור את המכשיר (האייפון מחובר בכבל; לאשר "Trust" בטלפון).
2. ‏Target ‏App → ‏Signing & Capabilities → ‏Team = החשבון שלך
   (עם חשבון חינם: ‏Xcode ייצור פרופיל אישי אוטומטית).
3. ‏▶ Run. בפעם הראשונה הטלפון ידרוש אישור:
   ‏Settings → General → VPN & Device Management → לאשר את המפתח.

## בנצ'מרק אינפרנס (יעד M2)

1. באייפון: להפעיל ‏Web Inspector — ‏Settings → Safari → Advanced → Web Inspector.
2. במק: ‏Safari → Develop → ‏<האייפון שלך> → לבחור את ה-WebView של CourtIQ.
3. בקונסול של ה-Inspector להריץ:
   ```js
   window.ShotDetectionEngine && window.ShotDetectionEngine._detectorType
   ```
   ‏זה עונה על שאלת-המפתח: ‏`webgpu` (מהיר) או ‏`wasm` (איטי, ‏fallback).
4. בנצ'מרק מלא — להעלות סרטון דרך ה-UI של האפליקציה (‏TRACK → upload) ולמדוד,
   או להריץ בקונסול על קליפ שנמצא בטלפון דרך ה-UI ואז:
   ```js
   // אחרי שהעיבוד הסתיים, זמני-העיבוד נמצאים בתוצאה שהמסך קיבל
   window.__v10SessionShots && window.__v10SessionShots.length
   ```
   ‏מדידת-הזמן הפשוטה: שעון-עצר מרגע "‏Analyzing every frame" עד המסך-recap.
   ‏יעד: סרטון 30 שניות בפחות מ-3 דקות עיבוד = שמיש לבטא.

## מה לדווח חזרה ל-Claude

- ‏`_detectorType` (‏webgpu / wasm-proxy / wasm)
- זמן-עיבוד לסרטון ~30 שניות + דגם האייפון
- כל קריסה/מסך-לבן — צילום של הקונסול ב-Inspector

## הערות

- ‏Capacitor 8 עם ‏SPM — אין ‏CocoaPods, אין ‏`pod install`.
- ‏bundle האפליקציה מגוזם אוטומטית ע"י ‏`npm run ios:sync` ‏(270MB → ‏25MB:
  בלי סרטוני-eval, בלי מודלים ישנים — רק ‏v7m5).
- חתימה חינמית תקפה 7 ימים — אחרי אישור התוכנית בתשלום זה נעלם,
  ו-TestFlight ‏(M6) נפתח.
