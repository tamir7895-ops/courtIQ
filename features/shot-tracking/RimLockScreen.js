/**
 * RimLockScreen — Rim Calibration Step
 *
 * User sees a live camera preview and taps the rim to set its position.
 * The rim zone is stored as { centerX, centerY, width, height } in normalized
 * coordinates (0–1) so it works regardless of camera resolution.
 *
 * Flow:
 *  1. Camera preview fills screen
 *  2. Instructional overlay: "Tap the center of the rim"
 *  3. User taps → orange ellipse drawn at tap point
 *  4. User can adjust by tapping again or pinching to resize
 *  5. "Lock Rim & Start" button confirms and navigates to ShotTrackingScreen
 */
import React, { useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  StatusBar,
} from 'react-native';
import { Camera, useCameraDevice } from 'react-native-vision-camera';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// Default rim zone size (relative to screen)
const DEFAULT_RIM_W = 0.18; // ~18% of screen width
const DEFAULT_RIM_H = 0.04; // ~4% of screen height (thin ellipse viewed from side)

export default function RimLockScreen({ navigation }) {
  const device = useCameraDevice('back');
  const cameraRef = useRef(null);

  // Rim position in normalized coords (0–1)
  const [rimCenter, setRimCenter] = useState(null);
  const [rimSize, setRimSize] = useState({ w: DEFAULT_RIM_W, h: DEFAULT_RIM_H });
  const [isLocked, setIsLocked] = useState(false);

  // Animation for the pulsing guide
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0.6);

  const handleTap = useCallback(
    (event) => {
      if (isLocked) return;

      const { locationX, locationY } = event.nativeEvent;
      const normX = locationX / SCREEN_W;
      const normY = locationY / SCREEN_H;

      setRimCenter({ x: normX, y: normY });

      // Pulse animation on placement
      pulseScale.value = withSequence(
        withTiming(1.3, { duration: 150 }),
        withSpring(1, { damping: 8 })
      );
    },
    [isLocked, pulseScale]
  );

  const handleLockAndStart = useCallback(() => {
    if (!rimCenter) return;

    setIsLocked(true);

    // Build rim zone config
    const rimZone = {
      centerX: rimCenter.x,
      centerY: rimCenter.y,
      width: rimSize.w,
      height: rimSize.h,
      // Pixel values for the current screen (used by detection)
      pixelCenterX: rimCenter.x * SCREEN_W,
      pixelCenterY: rimCenter.y * SCREEN_H,
      pixelWidth: rimSize.w * SCREEN_W,
      pixelHeight: rimSize.h * SCREEN_H,
    };

    // Short delay so user sees the "locked" state
    setTimeout(() => {
      navigation.replace('ShotTracking', { rimZone });
    }, 400);
  }, [rimCenter, rimSize, navigation]);

  const handleAdjustSize = useCallback(
    (delta) => {
      if (isLocked) return;
      setRimSize((prev) => ({
        w: Math.max(0.08, Math.min(0.35, prev.w + delta)),
        h: Math.max(0.02, Math.min(0.12, prev.h + delta * 0.3)),
      }));
    },
    [isLocked]
  );

  // Animated style for the rim indicator
  const rimAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  if (!device) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Camera not available</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar hidden />

      {/* Camera Preview */}
      <Camera
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={true}
        photo={false}
        video={false}
      />

      {/* Tap area overlay */}
      <TouchableOpacity
        style={StyleSheet.absoluteFill}
        activeOpacity={1}
        onPress={handleTap}
      >
        {/* Semi-transparent overlay */}
        <View style={styles.overlay}>
          {/* Instructions */}
          <View style={styles.instructionBar}>
            <Text style={styles.instructionText}>
              {rimCenter
                ? isLocked
                  ? 'Rim locked! Starting session...'
                  : 'Adjust position or tap "Lock Rim & Start"'
                : 'Tap the center of the basketball rim'}
            </Text>
          </View>

          {/* Rim indicator */}
          {rimCenter && (
            <Animated.View
              style={[
                styles.rimIndicator,
                rimAnimStyle,
                {
                  left: rimCenter.x * SCREEN_W - (rimSize.w * SCREEN_W) / 2,
                  top: rimCenter.y * SCREEN_H - (rimSize.h * SCREEN_H) / 2,
                  width: rimSize.w * SCREEN_W,
                  height: rimSize.h * SCREEN_H,
                  borderColor: isLocked ? '#00ff88' : '#ff6b00',
                },
              ]}
            />
          )}

          {/* Size adjust buttons */}
          {rimCenter && !isLocked && (
            <View style={styles.sizeControls}>
              <TouchableOpacity
                style={styles.sizeBtn}
                onPress={() => handleAdjustSize(-0.02)}
              >
                <Text style={styles.sizeBtnText}>-</Text>
              </TouchableOpacity>
              <Text style={styles.sizeLabel}>Rim Size</Text>
              <TouchableOpacity
                style={styles.sizeBtn}
                onPress={() => handleAdjustSize(0.02)}
              >
                <Text style={styles.sizeBtnText}>+</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Lock & Start button */}
          {rimCenter && !isLocked && (
            <TouchableOpacity
              style={styles.lockButton}
              onPress={handleLockAndStart}
            >
              <Text style={styles.lockButtonText}>Lock Rim & Start</Text>
            </TouchableOpacity>
          )}

          {/* Back button */}
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>Cancel</Text>
          </TouchableOpacity>

          {/* Crosshair guide (before first tap) */}
          {!rimCenter && (
            <>
              <View style={styles.crosshairH} />
              <View style={styles.crosshairV} />
              <View style={styles.crosshairCenter} />
            </>
          )}
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  errorText: {
    color: '#fff',
    fontSize: 18,
    textAlign: 'center',
    marginTop: 100,
  },
  instructionBar: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  instructionText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  rimIndicator: {
    position: 'absolute',
    borderWidth: 3,
    borderRadius: 999, // ellipse
    backgroundColor: 'rgba(255, 107, 0, 0.15)',
  },
  sizeControls: {
    position: 'absolute',
    bottom: 160,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 24,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  sizeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sizeBtnText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
  },
  sizeLabel: {
    color: '#aaa',
    fontSize: 13,
    marginHorizontal: 12,
  },
  lockButton: {
    position: 'absolute',
    bottom: 80,
    alignSelf: 'center',
    backgroundColor: '#ff6b00',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 30,
    elevation: 6,
    shadowColor: '#ff6b00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  lockButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  backButton: {
    position: 'absolute',
    top: 60,
    left: 20,
    padding: 8,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  // Crosshair guides
  crosshairH: {
    position: 'absolute',
    top: SCREEN_H * 0.5,
    left: SCREEN_W * 0.2,
    right: SCREEN_W * 0.2,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  crosshairV: {
    position: 'absolute',
    left: SCREEN_W * 0.5,
    top: SCREEN_H * 0.2,
    bottom: SCREEN_H * 0.2,
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  crosshairCenter: {
    position: 'absolute',
    top: SCREEN_H * 0.5 - 8,
    left: SCREEN_W * 0.5 - 8,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
  },
});
