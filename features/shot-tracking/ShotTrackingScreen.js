/**
 * ShotTrackingScreen.js — Camera + Live Overlay UI
 *
 * Full-screen camera view with:
 *  - Semi-transparent overlay showing rim zone
 *  - Live shot counter (Made: X / Attempts: Y) at top
 *  - Ball tracking indicator (small dot following detected ball)
 *  - Green flash on made shot, red flash on miss
 *  - Stop button to end session
 *  - Pause/resume capability
 */
import React, { useRef, useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  Alert,
  Vibration,
} from 'react-native';
import { Camera, useCameraDevice } from 'react-native-vision-camera';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  withDelay,
  runOnJS,
  Easing,
} from 'react-native-reanimated';

import useShotDetection from './hooks/useShotDetection';
import useSessionManager from './hooks/useSessionManager';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// Colors
const COLOR_MADE = '#00ff88';
const COLOR_MISSED = '#ff4444';
const COLOR_RIM = '#ff6b00';
const COLOR_BALL_DOT = '#ffaa00';

export default function ShotTrackingScreen({ route, navigation }) {
  const { rimZone } = route.params;
  const device = useCameraDevice('back');
  const cameraRef = useRef(null);

  // Get userId from your auth system — adjust import as needed
  const [userId] = useState('current-user-id'); // Replace with actual auth

  // Session manager
  const {
    sessionState,
    startSession,
    recordShot,
    endSession,
    shots,
  } = useSessionManager(userId);

  // Flash animation values
  const flashOpacity = useSharedValue(0);
  const flashColor = useSharedValue(COLOR_MADE);

  // Shot result text animation
  const resultScale = useSharedValue(0);
  const resultOpacity = useSharedValue(0);
  const [lastResult, setLastResult] = useState(null);

  // Timer
  const [elapsedTime, setElapsedTime] = useState(0);
  const timerRef = useRef(null);

  /**
   * Handle shot detection callback.
   */
  const handleShotDetected = useCallback(
    (shotData) => {
      // Record in session manager
      recordShot(shotData);

      // Visual feedback
      const isMade = shotData.result === 'made';
      setLastResult(isMade ? 'SWISH!' : 'MISS');

      // Flash effect
      flashColor.value = isMade ? COLOR_MADE : COLOR_MISSED;
      flashOpacity.value = withSequence(
        withTiming(0.4, { duration: 100 }),
        withDelay(200, withTiming(0, { duration: 400 }))
      );

      // Result text pop
      resultScale.value = withSequence(
        withTiming(1.5, { duration: 150, easing: Easing.out(Easing.back) }),
        withDelay(600, withTiming(0, { duration: 200 }))
      );
      resultOpacity.value = withSequence(
        withTiming(1, { duration: 100 }),
        withDelay(600, withTiming(0, { duration: 200 }))
      );

      // Haptic feedback
      Vibration.vibrate(isMade ? [0, 50, 30, 50] : [0, 100]);
    },
    [recordShot, flashColor, flashOpacity, resultScale, resultOpacity]
  );

  // Shot detection hook
  const {
    frameProcessor,
    isDetecting,
    ballPosition,
    stats,
    startDetection,
    stopDetection,
  } = useShotDetection(rimZone, handleShotDetected);

  // Start session and detection on mount
  useEffect(() => {
    startSession();
    startDetection();

    // Start timer
    timerRef.current = setInterval(() => {
      setElapsedTime((prev) => prev + 1);
    }, 1000);

    return () => {
      clearInterval(timerRef.current);
      stopDetection();
    };
  }, []);

  /**
   * Handle stop button — confirm and navigate to summary.
   */
  const handleStop = useCallback(() => {
    Alert.alert('End Session', 'Stop tracking and view your results?', [
      { text: 'Keep Going', style: 'cancel' },
      {
        text: 'End Session',
        style: 'destructive',
        onPress: () => {
          stopDetection();
          clearInterval(timerRef.current);
          const summary = endSession();
          navigation.replace('SessionSummary', { summary });
        },
      },
    ]);
  }, [stopDetection, endSession, navigation]);

  // Format elapsed time
  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Animated styles
  const flashStyle = useAnimatedStyle(() => ({
    opacity: flashOpacity.value,
    backgroundColor: flashColor.value,
  }));

  const resultStyle = useAnimatedStyle(() => ({
    transform: [{ scale: resultScale.value }],
    opacity: resultOpacity.value,
  }));

  if (!device) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Camera not available</Text>
      </View>
    );
  }

  const accuracy =
    stats.attempts > 0
      ? Math.round((stats.made / stats.attempts) * 100)
      : 0;

  return (
    <View style={styles.container}>
      <StatusBar hidden />

      {/* Camera */}
      <Camera
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={true}
        frameProcessor={frameProcessor}
        pixelFormat="rgb"
        fps={30}
      />

      {/* Semi-transparent overlay */}
      <View style={styles.overlay} pointerEvents="box-none">
        {/* ── TOP BAR: Stats ── */}
        <View style={styles.topBar}>
          <View style={styles.statRow}>
            <View style={styles.statBlock}>
              <Text style={styles.statValue}>{stats.made}</Text>
              <Text style={styles.statLabel}>Made</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBlock}>
              <Text style={styles.statValue}>{stats.attempts}</Text>
              <Text style={styles.statLabel}>Attempts</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBlock}>
              <Text style={[styles.statValue, { color: getAccuracyColor(accuracy) }]}>
                {accuracy}%
              </Text>
              <Text style={styles.statLabel}>Accuracy</Text>
            </View>
          </View>
          <Text style={styles.timer}>{formatTime(elapsedTime)}</Text>
        </View>

        {/* ── RIM ZONE INDICATOR ── */}
        <View
          style={[
            styles.rimZoneIndicator,
            {
              left: rimZone.centerX * SCREEN_W - (rimZone.width * SCREEN_W) / 2,
              top: rimZone.centerY * SCREEN_H - (rimZone.height * SCREEN_H) / 2,
              width: rimZone.width * SCREEN_W,
              height: rimZone.height * SCREEN_H,
            },
          ]}
        />

        {/* ── BALL TRACKING DOT ── */}
        {ballPosition && (
          <View
            style={[
              styles.ballDot,
              {
                left: ballPosition.x * SCREEN_W - 6,
                top: ballPosition.y * SCREEN_H - 6,
              },
            ]}
          />
        )}

        {/* ── FLASH OVERLAY (made/missed) ── */}
        <Animated.View style={[styles.flashOverlay, flashStyle]} pointerEvents="none" />

        {/* ── RESULT TEXT ("SWISH!" / "MISS") ── */}
        <Animated.View style={[styles.resultContainer, resultStyle]} pointerEvents="none">
          <Text
            style={[
              styles.resultText,
              {
                color:
                  lastResult === 'SWISH!' ? COLOR_MADE : COLOR_MISSED,
              },
            ]}
          >
            {lastResult}
          </Text>
        </Animated.View>

        {/* ── BOTTOM CONTROLS ── */}
        <View style={styles.bottomBar}>
          <TouchableOpacity style={styles.stopButton} onPress={handleStop}>
            <View style={styles.stopIcon} />
            <Text style={styles.stopText}>End Session</Text>
          </TouchableOpacity>
        </View>

        {/* ── DETECTION STATUS ── */}
        <View style={styles.statusDot}>
          <View
            style={[
              styles.dot,
              { backgroundColor: isDetecting ? '#00ff88' : '#ff4444' },
            ]}
          />
          <Text style={styles.statusText}>
            {isDetecting ? 'Tracking' : 'Initializing...'}
          </Text>
        </View>
      </View>
    </View>
  );
}

function getAccuracyColor(pct) {
  if (pct >= 65) return COLOR_MADE;
  if (pct >= 50) return '#ffaa00';
  return COLOR_MISSED;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  errorText: {
    color: '#fff',
    fontSize: 18,
    textAlign: 'center',
    marginTop: 100,
  },

  // Top bar
  topBar: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  statBlock: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800',
  },
  statLabel: {
    color: '#888',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  timer: {
    color: '#aaa',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
    fontVariant: ['tabular-nums'],
  },

  // Rim zone
  rimZoneIndicator: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: 'rgba(255, 107, 0, 0.5)',
    borderStyle: 'dashed',
    borderRadius: 999,
    backgroundColor: 'rgba(255, 107, 0, 0.08)',
  },

  // Ball dot
  ballDot: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLOR_BALL_DOT,
    borderWidth: 2,
    borderColor: '#fff',
    elevation: 4,
    shadowColor: COLOR_BALL_DOT,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },

  // Flash overlay
  flashOverlay: {
    ...StyleSheet.absoluteFillObject,
  },

  // Result text
  resultContainer: {
    position: 'absolute',
    top: SCREEN_H * 0.4,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  resultText: {
    fontSize: 48,
    fontWeight: '900',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },

  // Bottom bar
  bottomBar: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  stopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 68, 68, 0.9)',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 30,
    elevation: 4,
    shadowColor: '#ff4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  stopIcon: {
    width: 16,
    height: 16,
    borderRadius: 3,
    backgroundColor: '#fff',
    marginRight: 10,
  },
  stopText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },

  // Status indicator
  statusDot: {
    position: 'absolute',
    top: 140,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    color: '#aaa',
    fontSize: 11,
    fontWeight: '600',
  },
});
