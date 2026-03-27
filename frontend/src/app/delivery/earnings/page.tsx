'use client';

import { useState, useEffect } from 'react';
import { deliveryApi } from '@/lib/api';
import { TrendingUp, Package, Wallet, BarChart3 } from 'lucide-react';
import { clsx } from 'clsx';

interface DailyPoint { date: string; count: number; cod: number; }

export default function EarningsPage() {
  const [data, setData]     = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    deliveryApi.getEarnings()
      .then((res) => setData(res.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="px-4 pt-5 space-y-4">
      {[1,2,3].map(i => <div key={i} className="h-24 rounded-2xl bg-zinc-900 animate-pulse" />)}
    </div>
  );

  const daily: DailyPoint[] = data?.dailyBreakdown ?? [];
  const maxCount  = Math.max(...daily.map((d) => d.count), 1);

  const stats = [
    { label: 'Today',   value: data?.todayDeliveries  ?? 0, icon: TrendingUp, color: 'text-lime-400'  },
    { label: 'This Week', value: data?.weeklyDeliveries ?? 0, icon: BarChart3,  color: 'text-blue-400'  },
    { label: 'All Time', value: data?.totalDeliveries  ?? 0, icon: Package,    color: 'text-zinc-300'  },
    { label: 'COD Due',  value: `Rs.${Math.round(data?.codPending ?? 0)}`, icon: Wallet, color: 'text-amber-400' },
  ];

  return (
    <div className="px-4 pt-5 space-y-6">
      <div>
        <h1 className="text-lg font-bold text-white">Earnings</h1>
        <p className="text-xs text-zinc-500">Your delivery performance</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
            <Icon size={16} className={clsx('mb-2', color)} />
            <p className={clsx('text-2xl font-bold tracking-tight', color)}>{value}</p>
            <p className="text-xs text-zinc-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* 7-day bar chart */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
        <p className="text-xs font-semibold text-zinc-400 mb-4">Last 7 Days</p>

        {daily.length === 0 ? (
          <div className="text-center py-8 text-zinc-700">
            <BarChart3 size={32} className="mx-auto mb-2 opacity-40" />
            <p className="text-sm">No data yet</p>
          </div>
        ) : (
          <div className="flex items-end gap-2 h-32">
            {/* Fill missing days so chart always shows 7 slots */}
            {buildWeek(daily).map(({ dateLabel, count, cod }) => {
              const heightPct = maxCount > 0 ? (count / maxCount) * 100 : 0;
              return (
                <div key={dateLabel} className="flex-1 flex flex-col items-center gap-1">
                  {/* Bar */}
                  <div className="w-full flex flex-col justify-end h-24 relative group">
                    {/* Tooltip */}
                    {count > 0 && (
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1 text-[10px] text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                        {count} order{count !== 1 ? 's' : ''}
                        {cod > 0 && ` · Rs.${Math.round(cod)}`}
                      </div>
                    )}
                    <div
                      className={clsx(
                        'w-full rounded-t-lg transition-all',
                        count > 0 ? 'bg-lime-400/70' : 'bg-zinc-800'
                      )}
                      style={{ height: count > 0 ? `${Math.max(heightPct, 8)}%` : '8%' }}
                    />
                  </div>
                  {/* Count label */}
                  <span className={clsx('text-[10px]', count > 0 ? 'text-lime-400' : 'text-zinc-700')}>
                    {count > 0 ? count : '–'}
                  </span>
                  {/* Day label */}
                  <span className="text-[9px] text-zinc-600">{dateLabel}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* COD breakdown notice */}
      {(data?.codPending ?? 0) > 0 && (
        <div className="bg-amber-400/5 border border-amber-400/10 rounded-2xl p-4 flex items-start gap-3">
          <Wallet size={16} className="text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-400">Rs.{Math.round(data.codPending)} cash to submit</p>
            <p className="text-xs text-zinc-500 mt-0.5">
              Hand this to your manager. You can track settlements in the Wallet tab.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────

function buildWeek(daily: DailyPoint[]) {
  const map: Record<string, DailyPoint> = {};
  daily.forEach(d => { map[d.date] = d; });

  return Array.from({ length: 7 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const key = d.toISOString().split('T')[0];
    const day = map[key];
    return {
      dateLabel: d.toLocaleDateString('en', { weekday: 'short' }).slice(0, 2),
      count:     day?.count ?? 0,
      cod:       day?.cod   ?? 0,
    };
  });
}
