// 📖 Zustand: https://docs.pmnd.rs/zustand/getting-started/introduction
import { createMMKV } from 'react-native-mmkv';
import { create } from 'zustand';

const storage = createMMKV();

export type RepeatType = 'daily' | 'days' | 'range';

export interface Schedule {
  id: string;
  name: string;
  lockHour: number;
  lockMinute: number;
  unlockHour: number;
  unlockMinute: number;
  repeatType: RepeatType;
  days: number[];
  startDate: string | null;
  endDate: string | null;
  enabled: boolean;
}

// ── New: per-app lock ────────────────────────────────────────────────
export interface LockedApp {
  packageName: string;
  appName: string;
  lockUntil: number;       // timestamp ms
  scheduleId?: string;     // optional — links to a schedule
}

interface LockStore {
  // ── Phone lock ──────────────────────────────────────────────────────
  phoneLockUntil: number;
  lockPhone: (ms: number) => void;
  unlockPhone: () => void;
  isLocked: () => boolean;

  // ── Schedules ───────────────────────────────────────────────────────
  schedules: Schedule[];
  addSchedule: (s: Schedule) => void;
  updateSchedule: (id: string, changes: Partial<Schedule>) => void;
  deleteSchedule: (id: string) => void;
  toggleSchedule: (id: string) => void;

  // ── App locks ───────────────────────────────────────────────────────
  lockedApps: LockedApp[];
  lockApp: (app: LockedApp) => void;
  unlockApp: (packageName: string) => void;
  isAppLocked: (packageName: string) => boolean;
}

export const useLockStore = create<LockStore>((set, get) => ({
  // ── Phone lock ──────────────────────────────────────────────────────
  phoneLockUntil: storage.getNumber('phoneLockUntil') ?? 0,

  lockPhone: (durationMs) => {
    const until = Date.now() + durationMs;
    storage.set('phoneLockUntil', until);
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

  // ── App locks ───────────────────────────────────────────────────────
  lockedApps: JSON.parse(storage.getString('lockedApps') ?? '[]'),

  lockApp: (app) => {
    // Replace if same packageName already exists, otherwise add
    const existing = get().lockedApps.filter(a => a.packageName !== app.packageName);
    const updated = [...existing, app];
    storage.set('lockedApps', JSON.stringify(updated));
    set({ lockedApps: updated });
  },

  unlockApp: (packageName) => {
    const updated = get().lockedApps.filter(a => a.packageName !== packageName);
    storage.set('lockedApps', JSON.stringify(updated));
    set({ lockedApps: updated });
  },

  isAppLocked: (packageName) => {
    const app = get().lockedApps.find(a => a.packageName === packageName);
    if (!app) return false;
    return app.lockUntil > Date.now();
  },
}));