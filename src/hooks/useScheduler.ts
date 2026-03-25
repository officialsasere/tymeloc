// src/hooks/useScheduler.ts

import { useEffect, useCallback } from 'react';
import { NativeModules, AppState } from 'react-native';
import { useLockStore, Schedule } from '../store/useLockStore';

const { SchedulerModule, LockModule } = NativeModules;

export function getNextTrigger(
  schedule: Schedule,
  now: Date = new Date()
): { triggerMs: number; unlockMs: number } | null {

  const tryDay = (date: Date) => {
    const lock = new Date(date);
    lock.setHours(schedule.lockHour, schedule.lockMinute, 0, 0);
    const unlock = new Date(date);
    unlock.setHours(schedule.unlockHour, schedule.unlockMinute, 0, 0);
    if (unlock <= lock) unlock.setDate(unlock.getDate() + 1);
    return { triggerMs: lock.getTime(), unlockMs: unlock.getTime() };
  };

  const appliesToDate = (date: Date): boolean => {
    if (schedule.repeatType === 'daily') return true;
    if (schedule.repeatType === 'days') {
      return schedule.days.includes(date.getDay());
    }
    if (schedule.repeatType === 'range') {
      const pad = (n: number) => String(n).padStart(2, '0');
      const dateStr = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
      return !!schedule.startDate &&
             !!schedule.endDate &&
             dateStr >= schedule.startDate &&
             dateStr <= schedule.endDate;
    }
    return false;
  };

  for (let offset = 0; offset <= 7; offset++) {
    const candidate = new Date(now);
    candidate.setDate(candidate.getDate() + offset);
    if (!appliesToDate(candidate)) continue;
    const { triggerMs, unlockMs } = tryDay(candidate);
    if (offset === 0 && now.getTime() >= triggerMs && now.getTime() < unlockMs) {
      return { triggerMs: now.getTime(), unlockMs };
    }
    if (triggerMs > now.getTime()) {
      return { triggerMs, unlockMs };
    }
  }
  return null;
}

export function useScheduler() {
  const { schedules } = useLockStore();

  const syncAlarms = useCallback(async () => {
    const now = new Date();

    for (const schedule of schedules) {
      if (!schedule.enabled) {
        SchedulerModule.cancelScheduleAlarm(schedule.id);
        continue;
      }
      const next = getNextTrigger(schedule, now);
      if (!next) {
        SchedulerModule.cancelScheduleAlarm(schedule.id);
        continue;
      }
      SchedulerModule.setScheduleAlarm(schedule.id, next.triggerMs, next.unlockMs);
    }

    // Mirror to SharedPreferences via LockModule so BootReceiver can read
    // schedules in Kotlin without React Native being active
    LockModule.mirrorSchedules(JSON.stringify(schedules));

  }, [schedules]);

  useEffect(() => {
    syncAlarms();
  }, [schedules, syncAlarms]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') syncAlarms();
    });
    return () => sub.remove();
  }, [syncAlarms]);

  return { syncAlarms };
}