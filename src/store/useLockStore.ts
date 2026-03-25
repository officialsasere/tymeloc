// 📖 Zustand: https://docs.pmnd.rs/zustand/getting-started/introduction

import { createMMKV } from 'react-native-mmkv';
import { create } from 'zustand';


const storage = createMMKV();

interface LockStore {
  phoneLockUntil: number;        // timestamp ms, 0 = not locked
  lockPhone: (ms: number) => void;
  unlockPhone: () => void;
  isLocked: () => boolean;
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
}));