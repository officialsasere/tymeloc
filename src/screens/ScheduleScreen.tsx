// src/screens/ScheduleScreen.tsx

import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, Alert, NativeModules
} from 'react-native';
import { useLockStore, Schedule, RepeatType } from '../store/useLockStore';
import { getNextTrigger } from '../hooks/useScheduler';
import { COLORS } from '../theme/colors';

const { SchedulerModule } = NativeModules;

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

type Props = {
  onSave: () => void;
  onCancel: () => void;
  existing?: Schedule;  // if editing an existing schedule
};

export function ScheduleScreen({ onSave, onCancel, existing }: Props) {
  const { addSchedule, updateSchedule } = useLockStore();

  const [name,         setName]         = useState(existing?.name ?? '');
  const [lockHour,     setLockHour]     = useState(existing?.lockHour ?? 22);
  const [lockMinute,   setLockMinute]   = useState(existing?.lockMinute ?? 0);
  const [unlockHour,   setUnlockHour]   = useState(existing?.unlockHour ?? 6);
  const [unlockMinute, setUnlockMinute] = useState(existing?.unlockMinute ?? 0);
  const [repeatType,   setRepeatType]   = useState<RepeatType>(existing?.repeatType ?? 'daily');
  const [selectedDays, setSelectedDays] = useState<number[]>(existing?.days ?? [1,2,3,4,5]);
  const [startDate,    setStartDate]    = useState(existing?.startDate ?? '');
  const [endDate,      setEndDate]      = useState(existing?.endDate ?? '');

  const pad = (n: number) => String(n).padStart(2, '0');

  const toggleDay = (day: number) => {
    setSelectedDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  // Step a time value up or down, wrapping at boundaries
  const stepHour   = (cur: number, dir: 1 | -1) => (cur + dir + 24) % 24;
  const stepMinute = (cur: number, dir: 1 | -1) => (cur + dir + 60) % 60;

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Name required', 'Give your schedule a name.');
      return;
    }
    if (repeatType === 'days' && selectedDays.length === 0) {
      Alert.alert('Select days', 'Pick at least one day.');
      return;
    }
    if (repeatType === 'range' && (!startDate || !endDate)) {
      Alert.alert('Dates required', 'Enter both start and end dates (YYYY-MM-DD).');
      return;
    }

    const schedule: Schedule = {
      id:           existing?.id ?? Date.now().toString(),
      name:         name.trim(),
      lockHour,
      lockMinute,
      unlockHour,
      unlockMinute,
      repeatType,
      days:         selectedDays,
      startDate:    startDate || null,
      endDate:      endDate || null,
      enabled:      existing?.enabled ?? true,
    };

    if (existing) {
      updateSchedule(existing.id, schedule);
    } else {
      addSchedule(schedule);
    }

    // Set the alarm immediately after saving
    const next = getNextTrigger(schedule);
    if (next && schedule.enabled) {
      await SchedulerModule.setScheduleAlarm(
        schedule.id,
        next.triggerMs,
        next.unlockMs
      );
    }

    onSave();
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>
        {existing ? 'Edit schedule' : 'New schedule'}
      </Text>

      {/* Name */}
      <Text style={styles.label}>Name</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="e.g. Sleep, Deep work"
        placeholderTextColor="#2a2a4a"
      />

      {/* Lock time */}
      <Text style={styles.label}>Lock at</Text>
      <View style={styles.timeRow}>
        <View style={styles.timePicker}>
          <TouchableOpacity onPress={() => setLockHour(h => stepHour(h, 1))}>
            <Text style={styles.arrow}>▲</Text>
          </TouchableOpacity>
          <Text style={styles.timeValue}>{pad(lockHour)}</Text>
          <TouchableOpacity onPress={() => setLockHour(h => stepHour(h, -1))}>
            <Text style={styles.arrow}>▼</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.timeSep}>:</Text>
        <View style={styles.timePicker}>
          <TouchableOpacity onPress={() => setLockMinute(m => stepMinute(m, 1))}>
            <Text style={styles.arrow}>▲</Text>
          </TouchableOpacity>
          <Text style={styles.timeValue}>{pad(lockMinute)}</Text>
          <TouchableOpacity onPress={() => setLockMinute(m => stepMinute(m, -1))}>
            <Text style={styles.arrow}>▼</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Unlock time */}
      <Text style={styles.label}>Unlock at</Text>
      <View style={styles.timeRow}>
        <View style={styles.timePicker}>
          <TouchableOpacity onPress={() => setUnlockHour(h => stepHour(h, 1))}>
            <Text style={styles.arrow}>▲</Text>
          </TouchableOpacity>
          <Text style={styles.timeValue}>{pad(unlockHour)}</Text>
          <TouchableOpacity onPress={() => setUnlockHour(h => stepHour(h, -1))}>
            <Text style={styles.arrow}>▼</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.timeSep}>:</Text>
        <View style={styles.timePicker}>
          <TouchableOpacity onPress={() => setUnlockMinute(m => stepMinute(m, 1))}>
            <Text style={styles.arrow}>▲</Text>
          </TouchableOpacity>
          <Text style={styles.timeValue}>{pad(unlockMinute)}</Text>
          <TouchableOpacity onPress={() => setUnlockMinute(m => stepMinute(m, -1))}>
            <Text style={styles.arrow}>▼</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Repeat type */}
      <Text style={styles.label}>Repeat</Text>
      <View style={styles.repeatRow}>
        {(['daily', 'days', 'range'] as RepeatType[]).map(type => (
          <TouchableOpacity
            key={type}
            style={[styles.repeatBtn, repeatType === type && styles.repeatBtnActive]}
            onPress={() => setRepeatType(type)}
          >
            <Text style={[styles.repeatBtnText, repeatType === type && styles.repeatBtnTextActive]}>
              {type === 'daily' ? 'Every day' : type === 'days' ? 'Specific days' : 'Date range'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Day selector */}
      {repeatType === 'days' && (
        <>
          <Text style={styles.label}>Days</Text>
          <View style={styles.daysRow}>
            {DAYS.map((day, i) => (
              <TouchableOpacity
                key={day}
                style={[styles.dayBtn, selectedDays.includes(i) && styles.dayBtnActive]}
                onPress={() => toggleDay(i)}
              >
                <Text style={[styles.dayText, selectedDays.includes(i) && styles.dayTextActive]}>
                  {day}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      {/* Date range */}
      {repeatType === 'range' && (
        <>
          <Text style={styles.label}>Start date (YYYY-MM-DD)</Text>
          <TextInput
            style={styles.input}
            value={startDate}
            onChangeText={setStartDate}
            placeholder="2025-01-01"
            placeholderTextColor="#2a2a4a"
            keyboardType="numeric"
          />
          <Text style={styles.label}>End date (YYYY-MM-DD)</Text>
          <TextInput
            style={styles.input}
            value={endDate}
            onChangeText={setEndDate}
            placeholder="2025-01-31"
            placeholderTextColor="#2a2a4a"
            keyboardType="numeric"
          />
        </>
      )}

      {/* Actions */}
      <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
        <Text style={styles.saveBtnText}>Save schedule</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
        <Text style={styles.cancelBtnText}>Cancel</Text>
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
  },

  heading: {
    color: COLORS.textPrimary,
    fontSize: 22,
    fontWeight: '200',
    letterSpacing: 2,
    marginBottom: 32,
  },

  label: {
    color: COLORS.textSecondary,
    fontSize: 11,
    letterSpacing: 3,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginTop: 20,
  },

  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 14,
    color: COLORS.textPrimary,
    fontSize: 16,
    backgroundColor: COLORS.surface,
  },

  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 12,
  },

  timePicker: {
    alignItems: 'center',
    gap: 8,
  },

  arrow: {
    color: COLORS.textSecondary,
    fontSize: 18,
    padding: 4,
  },

  timeValue: {
    color: COLORS.textPrimary,
    fontSize: 42,
    fontWeight: '100',
    letterSpacing: 2,
    minWidth: 70,
    textAlign: 'center',
  },

  timeSep: {
    color: COLORS.textMuted,
    fontSize: 42,
    fontWeight: '100',
    marginTop: -8,
  },

  repeatRow: {
    flexDirection: 'row',
    gap: 8,
  },

  repeatBtn: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },

  repeatBtnActive: {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.accentSoft,
  },

  repeatBtnText: {
    color: COLORS.textSecondary,
    fontSize: 11,
  },

  repeatBtnTextActive: {
    color: COLORS.textPrimary,
  },

  daysRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },

  dayBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  dayBtnActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },

  dayText: {
    color: COLORS.textSecondary,
    fontSize: 11,
  },

  dayTextActive: {
    color: COLORS.textPrimary,
  },

  saveBtn: {
    marginTop: 40,
    backgroundColor: COLORS.accent,
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
  },

  saveBtnText: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '500',
  },

  cancelBtn: {
    marginTop: 12,
    padding: 14,
    alignItems: 'center',
  },

  cancelBtnText: {
    color: COLORS.textMuted,
    fontSize: 14,
  },
});