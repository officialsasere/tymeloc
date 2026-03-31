import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, Image, NativeModules, Alert,
  ActivityIndicator, TextInput
} from 'react-native';
import { useLockStore, LockedApp } from '../store/useLockStore';

const { InstalledAppsModule, LockModule } = NativeModules;

interface AppItem {
  packageName: string;
  appName: string;
  icon: string;
}

const DURATIONS = [
  { label: '30 min', ms: 30 * 60 * 1000 },
  { label: '1 hr',   ms: 60 * 60 * 1000 },
  { label: '2 hrs',  ms: 2 * 60 * 60 * 1000 },
  { label: '4 hrs',  ms: 4 * 60 * 60 * 1000 },
  { label: '8 hrs',  ms: 8 * 60 * 60 * 1000 },
];

export function AppLockScreen() {
  const { lockedApps, lockApp, unlockApp, isAppLocked } = useLockStore();
  const [apps, setApps]           = useState<AppItem[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [selected, setSelected]   = useState<AppItem | null>(null);

  // Load installed apps once on mount
  useEffect(() => {
    InstalledAppsModule.getInstalledApps()
      .then((list: AppItem[]) => {
        setApps(list);
        setLoading(false);
      })
      .catch((e: Error) => {
        Alert.alert('Error', e.message);
        setLoading(false);
      });
  }, []);

  const filtered = apps.filter(a =>
    a.appName.toLowerCase().includes(search.toLowerCase())
  );

  const handleLockApp = (app: AppItem, durationMs: number) => {
    const lockUntil = Date.now() + durationMs;
    const lockedApp: LockedApp = {
      packageName: app.packageName,
      appName:     app.appName,
      lockUntil,
    };
    lockApp(lockedApp);

    // Mirror to SharedPreferences so LockService can read it
    LockModule.mirrorLockedApps(JSON.stringify(
      [...lockedApps.filter(a => a.packageName !== app.packageName), lockedApp]
    ));

    setSelected(null);
    Alert.alert(
      'App locked',
      `${app.appName} is locked for ${DURATIONS.find(d => d.ms === durationMs)?.label}`
    );
  };

  const handleUnlockApp = (packageName: string, appName: string) => {
    Alert.alert('Unlock app', `Unlock ${appName}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Unlock',
        onPress: () => {
          unlockApp(packageName);
          LockModule.mirrorLockedApps(JSON.stringify(
            lockedApps.filter(a => a.packageName !== packageName)
          ));
        },
      },
    ]);
  };

  const renderApp = ({ item }: { item: AppItem }) => {
    const locked = isAppLocked(item.packageName);
    const lockInfo = lockedApps.find(a => a.packageName === item.packageName);
    const unlockTime = lockInfo
      ? new Date(lockInfo.lockUntil).toLocaleTimeString([], {
          hour: '2-digit', minute: '2-digit'
        })
      : null;

    return (
      <TouchableOpacity
        style={[styles.appRow, locked && styles.appRowLocked]}
        onPress={() => locked
          ? handleUnlockApp(item.packageName, item.appName)
          : setSelected(item)
        }
        activeOpacity={0.7}
      >
        {item.icon ? (
          <Image source={{ uri: item.icon }} style={styles.appIcon}/>
        ) : (
          <View style={[styles.appIcon, styles.appIconFallback]}/>
        )}

        <View style={styles.appInfo}>
          <Text style={styles.appName}>{item.appName}</Text>
          {locked && unlockTime && (
            <Text style={styles.appLockLabel}>locked until {unlockTime}</Text>
          )}
          {!locked && (
            <Text style={styles.appPackage}>{item.packageName}</Text>
          )}
        </View>

        <View style={[styles.lockBadge, locked && styles.lockBadgeActive]}>
          <Text style={styles.lockBadgeText}>{locked ? 'Locked' : 'Lock'}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  // Duration picker modal — shown when user taps an unlocked app
  if (selected) {
    return (
      <View style={styles.pickerContainer}>
        <View style={styles.pickerCard}>
          {selected.icon && (
            <Image source={{ uri: selected.icon }} style={styles.pickerIcon}/>
          )}
          <Text style={styles.pickerAppName}>{selected.appName}</Text>
          <Text style={styles.pickerLabel}>Lock for how long?</Text>

          {DURATIONS.map(d => (
            <TouchableOpacity
              key={d.label}
              style={styles.durationBtn}
              onPress={() => Alert.alert(
                'Confirm',
                `Lock ${selected.appName} for ${d.label}?`,
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Lock it', onPress: () => handleLockApp(selected, d.ms) },
                ]
              )}
            >
              <Text style={styles.durationText}>{d.label}</Text>
            </TouchableOpacity>
          ))}

          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={() => setSelected(null)}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.search}
        value={search}
        onChangeText={setSearch}
        placeholder="Search apps..."
        placeholderTextColor="#2a2a4a"
      />

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color="#534AB7" size="large"/>
          <Text style={styles.loadingText}>Loading apps...</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.packageName}
          renderItem={renderApp}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#07070f',
  },
  search: {
    margin: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1a1a2e',
    borderRadius: 10,
    color: '#e8e8ff',
    fontSize: 14,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingText: {
    color: '#4a4870',
    fontSize: 13,
  },
  appRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#0d0d1a',
    gap: 12,
  },
  appRowLocked: {
    opacity: 0.7,
  },
  appIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
  },
  appIconFallback: {
    backgroundColor: '#1a1a2e',
  },
  appInfo: {
    flex: 1,
    gap: 2,
  },
  appName: {
    color: '#e8e8ff',
    fontSize: 15,
    fontWeight: '400',
  },
  appPackage: {
    color: '#2a2a4a',
    fontSize: 11,
  },
  appLockLabel: {
    color: '#534AB7',
    fontSize: 11,
  },
  lockBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1a1a2e',
  },
  lockBadgeActive: {
    borderColor: '#534AB7',
    backgroundColor: '#0d0b1e',
  },
  lockBadgeText: {
    color: '#4a4870',
    fontSize: 12,
  },
  pickerContainer: {
    flex: 1,
    backgroundColor: '#07070f',
    justifyContent: 'center',
    padding: 28,
  },
  pickerCard: {
    alignItems: 'center',
    gap: 12,
  },
  pickerIcon: {
    width: 72,
    height: 72,
    borderRadius: 16,
    marginBottom: 8,
  },
  pickerAppName: {
    color: '#e8e8ff',
    fontSize: 22,
    fontWeight: '200',
    letterSpacing: 1,
  },
  pickerLabel: {
    color: '#4a4870',
    fontSize: 12,
    letterSpacing: 3,
    textTransform: 'uppercase',
    marginTop: 8,
    marginBottom: 8,
  },
  durationBtn: {
    width: '100%',
    padding: 18,
    borderWidth: 1,
    borderColor: '#1a1a2e',
    borderRadius: 12,
    alignItems: 'center',
  },
  durationText: {
    color: '#e8e8ff',
    fontSize: 18,
    fontWeight: '300',
  },
  cancelBtn: {
    marginTop: 8,
    padding: 14,
  },
  cancelText: {
    color: '#4a4870',
    fontSize: 14,
  },
});