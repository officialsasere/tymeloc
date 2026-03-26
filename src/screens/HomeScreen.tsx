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
import { ScheduleListScreen } from './ScheduleListScreen';
import { useScheduler } from '../hooks/useScheduler';



const { LockModule } = NativeModules;

const DURATIONS = [
  // { label: '1 min',  ms: 1 * 60 * 1000 },
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
  const { done } = useCountdown(phoneLockUntil);
  const [hasOverlay, setHasOverlay] = useState(false);
  const [activeTab, setActiveTab] = useState<'lock' | 'schedule'>('lock');
  const locked = isLocked(); 
  console.log('Render HomeScreen - locked:', locked, 'phoneLockUntil:', phoneLockUntil, 'done:', done);


  //Reset lock state if we detect a past lock time (e.g. due to reboot or manual time change)
// useEffect(() => {
//   if (phoneLockUntil && phoneLockUntil > Date.now()) {
//     console.log('Past lock detected, resetting');
//     unlockPhone();
//     LockModule.stopLockService();
//   }
// }, [phoneLockUntil, unlockPhone]);

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
   const isAccessibilityEnabled = await LockModule.hasAccessibilityPermission();
  // if (!hasOverlay) {
  //   Alert.alert(
  //     'Permission needed',
  //     'TymeLoc needs permission to draw over other apps.',
  //     [{ text: 'Open Settings', onPress: () => LockModule.requestOverlayPermission() }]
  //   );
  //   return;
  // }

  if (!isAccessibilityEnabled) {
    Alert.alert(
      'Strict Mode Required',
      'To prevent bypassing the lock, please enable Tymeloc in Accessibility Settings.',
      [{ text: 'Open Settings', onPress: () => LockModule.requestAccessibilityPermission() }]
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

  // const unlockTime = phoneLockUntil
  //   ? new Date(phoneLockUntil).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  //   : null;
  useScheduler();

  return (
   
      <View style={styles.motherContainer}>
      <Text style={styles.appName}>Tymeloc</Text>

      {/* Tab bar */}
    <View style={styles.tabBar}>
      <TouchableOpacity
        style={[styles.tab, activeTab === 'lock' && styles.tabActive]}
        onPress={() => setActiveTab('lock')}
      >
        <Text style={[styles.tabText, activeTab === 'lock' && styles.tabTextActive]}>
          Lock
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.tab, activeTab === 'schedule' && styles.tabActive]}
        onPress={() => setActiveTab('schedule')}
      >
        <Text style={[styles.tabText, activeTab === 'schedule' && styles.tabTextActive]}>
          Schedule
        </Text>
      </TouchableOpacity>
    </View>

    {activeTab === 'lock' ? (
      <ScrollView contentContainerStyle={styles.container}>
        {/* <Text style={styles.appName}>Tymeloc</Text> */}
        <View style={styles.pickerSection}>
          <Text style={styles.sectionLabel}>Lock phone for</Text>
          {DURATIONS.map(d => (
            <TouchableOpacity
              key={d.label}
              style={styles.durationBtn}
              // onPress={() => 
              //   handleLock(d.ms)}
              onPress={() => {
  Alert.alert(
    'Confirm Lock',
    `Are you sure you want to lock your phone for ${d.label}?`,
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Yes', onPress: () => handleLock(d.ms) }
    ],
    { cancelable: true }
  );
}}
              disabled={locked}
              activeOpacity={0.7}
            >
              <Text style={styles.durationText}>{d.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
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
    ) : (
      <ScheduleListScreen />
    )}
    </View>
   
  );
}

const styles = StyleSheet.create({
  motherContainer: {
    flex: 1,
    backgroundColor: '#07070f',
    paddingTop: 10,
    paddingBottom: 10,
  },
  container: {
    backgroundColor: '#07070f',
    padding: 28,
    paddingTop: 30,
    paddingBottom: 130,
    alignItems: 'center',
  },
  appName: {
    color: '#3d3a6e',
    fontSize: 13,
    alignSelf: 'center',
    letterSpacing: 4,
    padding: 20,
    textTransform: 'uppercase',
    // marginBottom: 0,
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
     minHeight: '100%',
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

  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#07070f',
    paddingTop: 20,
    paddingHorizontal: 28,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a2e',
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 1,
    borderBottomColor: '#534AB7',
  },
  tabText: {
    color: '#4a4870',
    fontSize: 13,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  tabTextActive: {
    color: '#e8e8ff',
  },
});