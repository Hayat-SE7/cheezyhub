'use client';

import { useState, useEffect } from 'react';
import { Settings, Volume2, VolumeX, LayoutGrid, List, RefreshCw } from 'lucide-react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';

interface KitchenSettings {
  soundAlerts:     boolean;
  displayMode:     'normal' | 'compact';
  autoRefresh:     0 | 30 | 60;
}

const DEFAULTS: KitchenSettings = {
  soundAlerts: true,
  displayMode: 'normal',
  autoRefresh: 0,
};

const STORAGE_KEY = 'cheezyhub-kitchen-settings';

function load(): KitchenSettings {
  if (typeof window === 'undefined') return DEFAULTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

function save(s: KitchenSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

export function useKitchenSettings(): KitchenSettings {
  const [settings, setSettings] = useState<KitchenSettings>(DEFAULTS);
  useEffect(() => { setSettings(load()); }, []);
  return settings;
}

export default function KitchenSettingsPage() {
  const [settings, setSettings] = useState<KitchenSettings>(DEFAULTS);
  const [mounted, setMounted]   = useState(false);

  useEffect(() => {
    setSettings(load());
    setMounted(true);
  }, []);

  const update = (patch: Partial<KitchenSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    save(next);
    toast.success('Settings saved', { duration: 1500, style: { background: '#0f0f14', color: '#f2f2f5', border: '1px solid #1e1e28' } });
  };

  if (!mounted) return null;

  return (
    <div className="p-4 max-w-md mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <Settings size={15} className="text-amber-500" />
        <h1 className="font-bold text-[#f2f2f5] text-sm uppercase tracking-wider">Kitchen Settings</h1>
      </div>

      <div className="space-y-3">

        {/* Sound alerts */}
        <div className="flex items-center justify-between p-4 rounded-xl bg-[#0f0f14] border border-[#1e1e28]">
          <div className="flex items-center gap-3">
            {settings.soundAlerts ? <Volume2 size={16} className="text-amber-400" /> : <VolumeX size={16} className="text-[#4a4a58]" />}
            <div>
              <div className="text-sm font-semibold text-[#f2f2f5]">Sound Alerts</div>
              <div className="text-xs text-[#4a4a58]">Play chime on new orders</div>
            </div>
          </div>
          <button
            onClick={() => update({ soundAlerts: !settings.soundAlerts })}
            className={clsx(
              'relative w-11 h-6 rounded-full transition-colors',
              settings.soundAlerts ? 'bg-amber-500' : 'bg-[#2a2a30]'
            )}
          >
            <div className={clsx(
              'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all',
              settings.soundAlerts ? 'left-[22px]' : 'left-0.5'
            )} />
          </button>
        </div>

        {/* Display mode */}
        <div className="p-4 rounded-xl bg-[#0f0f14] border border-[#1e1e28]">
          <div className="flex items-center gap-2 mb-3">
            <LayoutGrid size={15} className="text-amber-400" />
            <div className="text-sm font-semibold text-[#f2f2f5]">Display Mode</div>
          </div>
          <div className="flex gap-2">
            {(['normal', 'compact'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => update({ displayMode: mode })}
                className={clsx(
                  'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold border transition-all',
                  settings.displayMode === mode
                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-400'
                    : 'bg-[#1a1a1e] border-[#2a2a30] text-[#4a4a58] hover:border-[#3a3a48]'
                )}
              >
                {mode === 'normal' ? <LayoutGrid size={12} /> : <List size={12} />}
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Auto-refresh */}
        <div className="p-4 rounded-xl bg-[#0f0f14] border border-[#1e1e28]">
          <div className="flex items-center gap-2 mb-3">
            <RefreshCw size={15} className="text-amber-400" />
            <div>
              <div className="text-sm font-semibold text-[#f2f2f5]">Auto-Refresh</div>
              <div className="text-xs text-[#4a4a58]">Fallback polling interval (SSE preferred)</div>
            </div>
          </div>
          <div className="flex gap-2">
            {([0, 30, 60] as const).map((interval) => (
              <button
                key={interval}
                onClick={() => update({ autoRefresh: interval })}
                className={clsx(
                  'flex-1 py-2 rounded-lg text-xs font-semibold border transition-all',
                  settings.autoRefresh === interval
                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-400'
                    : 'bg-[#1a1a1e] border-[#2a2a30] text-[#4a4a58] hover:border-[#3a3a48]'
                )}
              >
                {interval === 0 ? 'Off' : `${interval}s`}
              </button>
            ))}
          </div>
        </div>

        <p className="text-[10px] text-[#3a3a48] text-center pt-2">
          Settings are saved locally to this device
        </p>
      </div>
    </div>
  );
}
