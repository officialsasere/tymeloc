// 📖 Zustand: https://docs.pmnd.rs/zustand/getting-started/introduction

import { createMMKV } from 'react-native-mmkv';
import { create } from 'zustand';


const storage = createMMKV();


// A schedule tells the app: "lock me at this time, unlock at this time, on these days"
export type RepeatType = 'daily' | 'days' | 'range';

export interface Schedule {
  id: string;                  // unique id — we use Date.now().toString()
  name: string;                // e.g. "Sleep", "Work focus"
  lockHour: number;            // 0-23
  lockMinute: number;          // 0-59
  unlockHour: number;          // 0-23
  unlockMinute: number;        // 0-59
  repeatType: RepeatType;
  days: number[];              // [0,1,2,3,4,5,6] Sun=0 Mon=1 ... Sat=6 (used when repeatType='days')
  startDate: string | null;    // 'YYYY-MM-DD' (used when repeatType='range')
  endDate: string | null;      // 'YYYY-MM-DD' (used when repeatType='range')
  enabled: boolean;
}

interface LockStore {
  phoneLockUntil: number;        // timestamp ms, 0 = not locked
  lockPhone: (ms: number) => void;
  unlockPhone: () => void;
  isLocked: () => boolean;


 // ── Schedules ───────────────────────────────────────────────────────
  schedules: Schedule[];
  addSchedule: (s: Schedule) => void;
  updateSchedule: (id: string, changes: Partial<Schedule>) => void;
  deleteSchedule: (id: string) => void;
  toggleSchedule: (id: string) => void;
}

export const useLockStore = create<LockStore>((set, get) => ({
  phoneLockUntil: storage.getNumber('phoneLockUntil') ?? 0,

  lockPhone: (durationMs) => {
    const until = Date.now() + durationMs;
    storage.set('phoneLockUntil', until);   // survives reboot
    set({ phoneLockUntil: until });
  },

  unlockPhone: () => {
    storage.set('phoneLockUntil', 0);
    set({ phoneLockUntil: 0 });
  },

  isLocked: () => get().phoneLockUntil > Date.now(),


  // ── Schedules ───────────────────────────────────────────────────────
  schedules: JSON.parse(storage.getString('schedules') ?? '[]'),

  addSchedule: (s) => {
    const updated = [...get().schedules, s];
    storage.set('schedules', JSON.stringify(updated));
    set({ schedules: updated });
  },

  updateSchedule: (id, changes) => {
    const updated = get().schedules.map(s =>
      s.id === id ? { ...s, ...changes } : s
    );
    storage.set('schedules', JSON.stringify(updated));
    set({ schedules: updated });
  },

  deleteSchedule: (id) => {
    const updated = get().schedules.filter(s => s.id !== id);
    storage.set('schedules', JSON.stringify(updated));
    set({ schedules: updated });
  },

  toggleSchedule: (id) => {
    const updated = get().schedules.map(s =>
      s.id === id ? { ...s, enabled: !s.enabled } : s
    );
    storage.set('schedules', JSON.stringify(updated));
    set({ schedules: updated });
  },
}));