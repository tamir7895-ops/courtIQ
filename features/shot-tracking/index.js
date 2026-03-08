/**
 * AI Shot Tracking Session — Feature Module Entry Point
 *
 * Navigation flow: RimLock → ShotTracking → SessionSummary
 *
 * Usage in your app navigator:
 *   import ShotTrackingNavigator from './features/shot-tracking';
 *   <Stack.Screen name="AITracking" component={ShotTrackingNavigator} />
 */
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import RimLockScreen from './RimLockScreen';
import ShotTrackingScreen from './ShotTrackingScreen';
import SessionSummary from './SessionSummary';

const Stack = createNativeStackNavigator();

export default function ShotTrackingNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        gestureEnabled: false, // prevent accidental swipe during session
      }}
    >
      <Stack.Screen name="RimLock" component={RimLockScreen} />
      <Stack.Screen name="ShotTracking" component={ShotTrackingScreen} />
      <Stack.Screen name="SessionSummary" component={SessionSummary} />
    </Stack.Navigator>
  );
}
