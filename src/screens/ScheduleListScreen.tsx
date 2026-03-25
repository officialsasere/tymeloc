// src/screens/ScheduleListScreen.tsx

import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Alert, NativeModules, Switch
} from 'react-native';
import { useLockStore, Schedule } from '../store/useLockStore';
import { ScheduleScreen } from './ScheduleScreen';
import { getNextTrigger } from '../hooks/useScheduler';
import { useScheduler } from '../hooks/useScheduler';
import { COLORS } from '../theme/colors';

const { SchedulerModule } = NativeModules;

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function ScheduleListScreen() {
  const { schedules, deleteSchedule, toggleSchedule } = useLockStore();
  const { syncAlarms } = useScheduler();

  const [showCreate, setShowCreate] = useState(false);
  const [editing,    setEditing]    = useState<Schedule | null>(null);

  const handleDelete = (s: Schedule) => {
    Alert.alert(
      'Delete schedule',
      `Delete "${s.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            SchedulerModule.cancelScheduleAlarm(s.id);
            deleteSchedule(s.id);
          },
        },
      ]
    );
  };

  const handleToggle = (s: Schedule) => {
    toggleSchedule(s.id);
    if (s.enabled) {
      // Was enabled, now disabling — cancel alarm
      SchedulerModule.cancelScheduleAlarm(s.id);
    } else {
      // Was disabled, now enabling — set alarm
      const next = getNextTrigger({ ...s, enabled: true });
      if (next) {
        SchedulerModule.setScheduleAlarm(s.id, next.triggerMs, next.unlockMs);
      }
    }
  };

  const formatTime = (h: number, m: number) =>
    `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

  const repeatLabel = (s: Schedule) => {
    if (s.repeatType === 'daily') return 'Every day';
    if (s.repeatType === 'days') {
      return s.days.map(d => DAYS[d]).join(', ');
    }
    return `${s.startDate} → ${s.endDate}`;
  };

  const nextTriggerLabel = (s: Schedule) => {
    if (!s.enabled) return 'Disabled';
    const next = getNextTrigger(s);
    if (!next) return 'No upcoming trigger';
    const d = new Date(next.triggerMs);
    return `Next: ${d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })} at ${formatTime(d.getHours(), d.getMinutes())}`;
  };

  // Show create form
  if (showCreate) {
    return (
      <ScheduleScreen
        onSave={() => { setShowCreate(false); syncAlarms(); }}
        onCancel={() => setShowCreate(false)}
      />
    );
  }

  // Show edit form
  if (editing) {
    return (
      <ScheduleScreen
        existing={editing}
        onSave={() => { setEditing(null); syncAlarms(); }}
        onCancel={() => setEditing(null)}
      />
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>Schedules</Text>
      <Text style={styles.subheading}>
        Automatic lockdowns at specific times
      </Text>

      {schedules.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No schedules yet</Text>
          <Text style={styles.emptySubtext}>
            Add one to automatically lock your phone at a set time every day
          </Text>
        </View>
      ) : (
        schedules.map(s => (
          <View key={s.id} style={[styles.card, !s.enabled && styles.cardDisabled]}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardName}>{s.name}</Text>
              <Switch
                value={s.enabled}
                onValueChange={() => handleToggle(s)}
                trackColor={{ false: '#1a1a2e', true: '#534AB7' }}
                thumbColor={s.enabled ? '#e8e8ff' : '#4a4870'}
              />
            </View>

            <Text style={styles.cardTime}>
              {formatTime(s.lockHour, s.lockMinute)}
              <Text style={styles.cardTimeSep}> → </Text>
              {formatTime(s.unlockHour, s.unlockMinute)}
            </Text>

            <Text style={styles.cardRepeat}>{repeatLabel(s)}</Text>
            <Text style={styles.cardNext}>{nextTriggerLabel(s)}</Text>

            <View style={styles.cardActions}>
              <TouchableOpacity
                style={styles.editBtn}
                onPress={() => setEditing(s)}
              >
                <Text style={styles.editBtnText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => handleDelete(s)}
              >
                <Text style={styles.deleteBtnText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}

      <TouchableOpacity
        style={styles.addBtn}
        onPress={() => setShowCreate(true)}
      >
        <Text style={styles.addBtnText}>+ Add schedule</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}



const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.bg,
    padding: 28,
    paddingTop: 60,
    paddingBottom: 60,
    minHeight: '100%',
  },

  heading: {
    color: COLORS.textPrimary,
    fontSize: 22,
    fontWeight: '200',
    letterSpacing: 2,
    marginBottom: 6,
  },

  subheading: {
    color: COLORS.textMuted,
    fontSize: 13,
    marginBottom: 32,
  },

  empty: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 12,
  },

  emptyText: {
    color: COLORS.textSecondary,
    fontSize: 16,
  },

  emptySubtext: {
    color: COLORS.textMuted,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },

  card: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 18,
    marginBottom: 14,
    gap: 6,
    backgroundColor: COLORS.surface, // 👈 subtle depth (important)
  },

  cardDisabled: {
    opacity: 0.4,
  },

  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  cardName: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '500',
  },

  cardTime: {
    color: COLORS.textPrimary,
    fontSize: 28,
    fontWeight: '100',
    letterSpacing: 1,
    marginTop: 4,
  },

  cardTimeSep: {
    color: COLORS.textMuted,
    fontSize: 20,
  },

  cardRepeat: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },

  cardNext: {
    color: COLORS.accent,
    fontSize: 12,
    marginTop: 2,
  },

  cardActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },

  editBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: 'transparent',
  },

  editBtnText: {
    color: COLORS.textPrimary,
    fontSize: 13,
  },

  deleteBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.dangerBorder,
  },

  deleteBtnText: {
    color: COLORS.danger,
    fontSize: 13,
  },

  addBtn: {
    marginTop: 24,
    borderWidth: 1,
    borderColor: COLORS.accent,
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    backgroundColor: COLORS.accentSoft,
  },

  addBtnText: {
    color: COLORS.accent,
    fontSize: 16,
  },
});