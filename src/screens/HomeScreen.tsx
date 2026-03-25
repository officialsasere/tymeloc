// 📖 NativeModules: https://reactnative.dev/docs/native-modules-intro
// 📖 AppState:      https://reactnative.dev/docs/appstate
// 📖 Animated:      https://reactnative.dev/docs/animated

import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  NativeModules, AppState, Alert, ScrollView
} from 'react-native';
import { useLockStore } from '../store/useLockStore';
import { useCountdown } from '../hooks/useCountdown';



const { LockModule } = NativeModules;

const DURATIONS = [
  { label: '30 min',  ms: 30 * 60 * 1000 },
  { label: '1 hour',  ms: 60 * 60 * 1000 },
  { label: '2 hours', ms: 2 * 60 * 60 * 1000 },
  { label: '3 hours', ms: 3 * 60 * 60 * 1000 },
  { label: '4 hours', ms: 4 * 60 * 60 * 1000 },
  { label: '5 hours', ms: 5 * 60 * 60 * 1000 },
  { label: '6 hours', ms: 6 * 60 * 60 * 1000 },
  { label: '7 hours', ms: 7 * 60 * 60 * 1000 },
  { label: '8 hours', ms: 8 * 60 * 60 * 1000 },
  { label: '9 hours', ms: 9 * 60 * 60 * 1000 },
  { label: '10 hours', ms: 10 * 60 * 60 * 1000 },
  { label: '11 hours', ms: 11 * 60 * 60 * 1000 },
  { label: '12 hours', ms: 12 * 60 * 60 * 1000 },
];

export function HomeScreen() {
  const { phoneLockUntil, lockPhone, unlockPhone, isLocked } = useLockStore();
  const { display, done } = useCountdown(phoneLockUntil);
  const [hasOverlay, setHasOverlay] = useState(false);
  const locked = isLocked();

  // Check overlay permission on mount and when returning from Settings
  useEffect(() => {
    const check = async () => {
      const granted = await LockModule.hasOverlayPermission();
      setHasOverlay(granted);
    };
    check();
    const sub = AppState.addEventListener('change', s => {
      if (s === 'active') check();
    });
    return () => sub.remove();
  }, []);


  // Auto-unlock when countdown reaches zero
  useEffect(() => {
    const now = Date.now();
  const isPastTime = phoneLockUntil && now >= phoneLockUntil;
    if (done && locked && isPastTime) {
      unlockPhone();
   
      LockModule.stopLockService();
    }
  }, [done, locked, phoneLockUntil, unlockPhone]);


const handleLock = async (durationMs: number) => {
  if (!hasOverlay) {
    Alert.alert(
      'Permission needed',
      'FocusLock needs permission to draw over other apps.',
      [{ text: 'Open Settings', onPress: () => LockModule.requestOverlayPermission() }]
    );
    return;
  }

  try {
    const unlockTime = Date.now() + durationMs;
    console.log('Locking until:', unlockTime);
    
    // Save to JS store first
    lockPhone(durationMs);
    
    // Then start native service
    await LockModule.startLockService(unlockTime);
    console.log('Service started successfully');
    
  } catch (e) {
    console.error('Lock failed:', e);
    Alert.alert('Error', String(e));
  }
};

  const unlockTime = phoneLockUntil
    ? new Date(phoneLockUntil).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.appName}>Tymeloc</Text>

      {locked ? (
        // ── Active lock view ────────────────────────────────────────────────
        <View style={styles.activeCard}>
          <Text style={styles.activeLabel}>LOCKDOWN ACTIVE</Text>
          <Text style={styles.countdown}>{display}</Text>
          <Text style={styles.unlockTime}>unlocks at {unlockTime}</Text>
        </View>
      ) : (
        // ── Duration picker ─────────────────────────────────────────────────
        <View style={styles.pickerSection}>
          <Text style={styles.sectionLabel}>Lock phone for</Text>
          {DURATIONS.map(d => (
            <TouchableOpacity
              key={d.label}
              style={styles.durationBtn}
              onPress={() => handleLock(d.ms)}
              disabled={locked}
              activeOpacity={0.7}
            >
              <Text style={styles.durationText}>{d.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {!hasOverlay && (
        <TouchableOpacity
          style={styles.permissionBanner}
          onPress={() => LockModule.requestOverlayPermission()}
        >
          <Text style={styles.permissionText}>
            Tap to grant overlay permission required for locking
          </Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#07070f',
    padding: 28,
    paddingTop: 70,
    alignItems: 'center',
  },
  appName: {
    color: '#3d3a6e',
    fontSize: 13,
    letterSpacing: 4,
    textTransform: 'uppercase',
    marginBottom: 60,
  },
  activeCard: {
    alignItems: 'center',
    gap: 16,
  },
  activeLabel: {
    color: '#4a4870',
    fontSize: 11,
    letterSpacing: 4,
  },
  countdown: {
    color: '#e8e8ff',
    fontSize: 64,
    fontWeight: '100',
    letterSpacing: 4,
  },
  unlockTime: {
    color: '#4a4870',
    fontSize: 14,
  },
  pickerSection: {
    width: '100%',
    gap: 12,
  },
  sectionLabel: {
    color: '#4a4870',
    fontSize: 12,
    letterSpacing: 3,
    textTransform: 'uppercase',
    marginBottom: 8,
    textAlign: 'center',
  },
  durationBtn: {
    borderWidth: 1,
    borderColor: '#1a1a2e',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  durationText: {
    color: '#e8e8ff',
    fontSize: 18,
    fontWeight: '300',
  },
  permissionBanner: {
    position: 'absolute',
    bottom: 40,
    backgroundColor: '#1a1a2e',
    padding: 14,
    borderRadius: 10,
    marginHorizontal: 28,
  },
  permissionText: {
    color: '#EF9F27',
    fontSize: 13,
    textAlign: 'center',
  },
});