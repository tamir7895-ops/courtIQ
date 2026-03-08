# AI Shot Tracking — Integration Guide

## 1. Folder Structure

```
features/shot-tracking/
├── index.js                  ← Stack navigator (RimLock → Tracking → Summary)
├── RimLockScreen.js          ← Camera preview + tap-to-place rim zone
├── ShotTrackingScreen.js     ← Full-screen camera with live overlay + counters
├── SessionSummary.js         ← Post-session: shot chart, stats, XP, save button
├── INTEGRATION_GUIDE.md      ← This file
│
├── hooks/
│   ├── useShotDetection.js   ← Frame processor + ball tracking + made/miss logic
│   └── useSessionManager.js  ← Session lifecycle, shot recording, XP calculation
│
├── utils/
│   ├── trajectoryTracker.js  ← Centroid-based ball position tracking across frames
│   ├── rimDetection.js       ← Rim zone geometry + made/miss spatial analysis
│   └── heatmapGenerator.js   ← Shot chart data + half-court SVG paths
│
└── supabase/
    └── shotService.js        ← DB operations: save sessions/shots, grant XP
```

---

## 2. Dependencies

Install these packages in your React Native project:

```bash
# Camera
npm install react-native-vision-camera@^4

# TensorFlow.js for ball detection
npm install @tensorflow/tfjs @tensorflow/tfjs-react-native
npm install @tensorflow-models/coco-ssd  # optional ML model

# Animations
npm install react-native-reanimated@^3

# SVG for shot chart
npm install react-native-svg

# Navigation (if not already installed)
npm install @react-navigation/native @react-navigation/native-stack
npm install react-native-screens react-native-safe-area-context

# Supabase (if not already installed)
npm install @supabase/supabase-js
```

### iOS Pod Install
```bash
cd ios && pod install && cd ..
```

---

## 3. Permissions

### Android — `android/app/src/main/AndroidManifest.xml`
```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-feature android:name="android.hardware.camera" android:required="true" />
```

### iOS — `ios/YourApp/Info.plist`
```xml
<key>NSCameraUsageDescription</key>
<string>CourtIQ needs camera access to track your shots during AI training sessions.</string>
```

### Runtime Permission Request
Add to your app startup or before navigating to shot tracking:

```javascript
import { Camera } from 'react-native-vision-camera';

async function requestCameraPermission() {
  const status = await Camera.requestCameraPermission();
  if (status !== 'granted') {
    Alert.alert(
      'Camera Required',
      'AI Shot Tracking needs camera access to work. Please enable it in Settings.'
    );
    return false;
  }
  return true;
}
```

---

## 4. Navigation Integration

In your main app navigator, add the shot tracking module:

```javascript
// App.js or your root navigator
import ShotTrackingNavigator from './features/shot-tracking';

function AppNavigator() {
  return (
    <Stack.Navigator>
      {/* Your existing screens */}
      <Stack.Screen name="Dashboard" component={DashboardScreen} />
      <Stack.Screen name="ShotTracker" component={ShotTrackerScreen} />

      {/* AI Shot Tracking module */}
      <Stack.Screen
        name="AITracking"
        component={ShotTrackingNavigator}
        options={{
          headerShown: false,
          presentation: 'fullScreenModal',
        }}
      />
    </Stack.Navigator>
  );
}
```

### Launch Button
Add a button in your existing Shot Tracker screen:

```javascript
<TouchableOpacity
  onPress={async () => {
    const hasPermission = await requestCameraPermission();
    if (hasPermission) {
      navigation.navigate('AITracking');
    }
  }}
  style={styles.aiTrackingButton}
>
  <Text>Start AI Tracking</Text>
</TouchableOpacity>
```

---

## 5. Supabase Schema Migration

Run this SQL in your Supabase SQL Editor to create the required tables:

```sql
-- AI Shot Sessions table
CREATE TABLE IF NOT EXISTS ai_shot_sessions (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  session_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  session_type TEXT NOT NULL DEFAULT 'ai_tracking',
  duration_ms INTEGER NOT NULL DEFAULT 0,
  total_attempts INTEGER NOT NULL DEFAULT 0,
  total_made INTEGER NOT NULL DEFAULT 0,
  accuracy REAL DEFAULT 0,
  max_streak INTEGER DEFAULT 0,
  xp_earned INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Individual AI-detected shots
CREATE TABLE IF NOT EXISTS ai_shots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT REFERENCES ai_shot_sessions(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  shot_result TEXT NOT NULL CHECK (shot_result IN ('made', 'missed')),
  shot_x REAL,           -- Normalized 0-1 horizontal position
  shot_y REAL,           -- Normalized 0-1 vertical position (distance)
  ball_trajectory_points JSONB,  -- Array of {x, y, frame}
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  shot_number INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_ai_sessions_user ON ai_shot_sessions(user_id);
CREATE INDEX idx_ai_sessions_date ON ai_shot_sessions(session_date DESC);
CREATE INDEX idx_ai_shots_session ON ai_shots(session_id);
CREATE INDEX idx_ai_shots_user ON ai_shots(user_id);

-- Row Level Security
ALTER TABLE ai_shot_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_shots ENABLE ROW LEVEL SECURITY;

-- Users can only access their own data
CREATE POLICY "Users can view own sessions"
  ON ai_shot_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sessions"
  ON ai_shot_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own sessions"
  ON ai_shot_sessions FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view own shots"
  ON ai_shots FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own shots"
  ON ai_shots FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own shots"
  ON ai_shots FOR DELETE
  USING (auth.uid() = user_id);
```

---

## 6. Supabase Client Setup

Initialize the shot service in your app entry point:

```javascript
// App.js or equivalent
import { createClient } from '@supabase/supabase-js';
import { initShotService } from './features/shot-tracking/supabase/shotService';

const supabase = createClient(
  'https://txnsuzlgfafjdipfqkqe.supabase.co',
  'your-anon-key'
);

// Initialize shot service
initShotService(supabase);
```

---

## 7. Reanimated Setup

Add the Reanimated Babel plugin if not already configured:

```javascript
// babel.config.js
module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: ['react-native-reanimated/plugin'], // Must be last
};
```

---

## 8. TensorFlow.js Setup

Initialize TF.js before using the tracking screen:

```javascript
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-react-native';

// In your App.js or a loading screen:
async function initApp() {
  await tf.ready();
  console.log('TF.js backend:', tf.getBackend());
}
```

The `useShotDetection` hook handles model loading internally, but TF.js
must be initialized at the app level first.

---

## 9. Dashboard Integration

The `shotService.js` writes to both `ai_shot_sessions` (new) and the
existing `shot_sessions` table. This means:

- Your existing weekly stats dashboard will automatically pick up
  AI-tracked sessions (they appear as regular shot sessions)
- The zone categorization maps to FG/3PT/FT columns:
  - Paint shots → ft_made / ft_missed
  - Mid-range → fg_made / fg_missed
  - Three-point → three_made / three_missed

---

## 10. XP Integration

The `useSessionManager` hook calculates XP using these rules:

| Reward | Amount | Condition |
|--------|--------|-----------|
| Session base | 25 XP | Always (matches existing logSession) |
| Per made shot | 2 XP each | Per shot |
| Streak bonus | 5 XP | Per 3-in-a-row streak |
| Accuracy bonus | 10 XP | >= 60% with 10+ attempts |
| Volume bonus | 15 XP | 50+ attempts in session |

XP is saved to the `profiles.user_data` JSONB column via `grantXP()`,
matching the existing `gamification.js` pattern.

---

## 11. Known Limitations & Future Improvements

### Current limitations:
- **Ball detection accuracy**: Color-based detection works best in
  well-lit outdoor courts. Indoor courts with orange floors may
  cause false positives.
- **Frame processor performance**: JS-based frame processing may
  drop frames on older devices. Consider a native frame processor
  plugin for production.
- **Single ball tracking**: Only tracks one ball at a time.
- **No court mapping**: Zone classification is based on Y-position
  approximation, not actual court distance.
- **Static rim**: The rim position is fixed after calibration.
  Camera movement will break tracking.

### Future improvements:
- Native frame processor plugin (C++/Swift) for real-time
  color segmentation at 30fps
- Custom TFLite model trained on basketball footage
- Multi-ball handling (rebounds)
- Court line detection for automatic zone mapping
- Shot arc analysis (release angle, peak height)
- Video replay with trajectory overlay
