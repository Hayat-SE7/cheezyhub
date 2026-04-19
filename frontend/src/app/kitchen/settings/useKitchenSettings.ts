'use client';

import { useState, useEffect } from 'react';

export interface KitchenSettings {
  soundAlerts:  boolean;
  displayMode:  'normal' | 'compact';
  autoRefresh:  0 | 30 | 60;
}

export const DEFAULTS: KitchenSettings = {
  soundAlerts: true,
  displayMode: 'normal',
  autoRefresh: 0,
};

export const STORAGE_KEY = 'cheezyhub-kitchen-settings';

export function load(): KitchenSettings {
  if (typeof window === 'undefined') return DEFAULTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

export function save(s: KitchenSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

export function useKitchenSettings(): KitchenSettings {
  const [settings, setSettings] = useState<KitchenSettings>(DEFAULTS);
  useEffect(() => { setSettings(load()); }, []);
  return settings;
}
