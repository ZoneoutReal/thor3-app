// Synchronous key-value store backed by an in-memory Map, mirrored to
// AsyncStorage for durability.
//
// This preserves the PWA's load-bearing *synchronous* read-modify-write
// semantics (see workout-log.ts) that AsyncStorage alone cannot offer: the
// in-memory Map is always current and single-threaded, so the co-mounted day
// logger and strength view never clobber each other's disjoint keys. Writes
// fire-and-forget to AsyncStorage per key; hydrateStore() loads everything once
// at boot, before any gated screen reads identity/logs. Keys are carried over
// verbatim from the PWA (all `thor3-` prefixed), so the on-device data model and
// the server contract are unchanged.

import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = 'thor3-';

const mem = new Map<string, string>();
let hydrated = false;

export function getItem(key: string): string | null {
  return mem.has(key) ? (mem.get(key) as string) : null;
}

export function setItem(key: string, value: string): void {
  mem.set(key, value);
  AsyncStorage.setItem(key, value).catch(() => {});
}

export function removeItem(key: string): void {
  mem.delete(key);
  AsyncStorage.removeItem(key).catch(() => {});
}

export function isHydrated(): boolean {
  return hydrated;
}

// Load every persisted `thor3-` key into memory once, at app boot. Safe to call
// repeatedly (later calls no-op). A hydration failure just starts empty; the
// next write re-persists.
export async function hydrateStore(): Promise<void> {
  if (hydrated) return;
  try {
    const keys = await AsyncStorage.getAllKeys();
    const ours = keys.filter((k) => k.startsWith(PREFIX));
    if (ours.length) {
      const entries = await AsyncStorage.multiGet(ours);
      for (const [k, v] of entries) {
        if (v != null) mem.set(k, v);
      }
    }
  } catch {
    // start empty
  } finally {
    hydrated = true;
  }
}
