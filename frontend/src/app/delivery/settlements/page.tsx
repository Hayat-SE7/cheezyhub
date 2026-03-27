'use client';

import { useState, useEffect } from 'react';
import { deliveryApi } from '@/lib/api';
import { Wallet, ArrowDownLeft, CheckCircle2 } from 'lucide-react';
import { clsx } from 'clsx';

interface Settlement {
  id:              string;
  collectedAmount: number;
  submittedAmount: number;
  remainingAmount: number;
  notes?:          string;
  createdAt:       string;
  settledBy:       string;
}

export default function SettlementsPage() {
  const [items, setItems]     = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    deliveryApi.getSettlements()
      .then((res) => setItems(res.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const totalSubmitted = items.reduce((s, i) => s + i.submittedAmount, 0);

  return (
    <div className="px-4 pt-5 space-y-5">
      <div>
        <h1 className="text-lg font-bold text-white">Settlements</h1>
        <p className="text-xs text-zinc-500">Cash handover history</p>
      </div>

      {/* Summary card */}
      {items.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-zinc-500 mb-1">Total Submitted</p>
            <p className="text-2xl font-bold text-lime-400">
              Rs.{Math.round(totalSubmitted).toLocaleString()}
            </p>
            <p className="text-xs text-zinc-600 mt-0.5">{items.length} settlement{items.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-lime-400/10 border border-lime-400/20 flex items-center justify-center">
            <CheckCircle2 size={22} className="text-lime-400" />
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-24 rounded-2xl bg-zinc-900 animate-pulse" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-zinc-700">
          <Wallet size={40} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">No settlements yet</p>
          <p className="text-xs mt-1">Settled amounts will appear here</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((s) => (
            <div key={s.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3">
              {/* Date + icon */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-lime-400/10 flex items-center justify-center">
                    <ArrowDownLeft size={14} className="text-lime-400" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-white">Settlement</p>
                    <p className="text-[10px] text-zinc-500">{fmtDate(s.createdAt)}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-lime-400">Rs.{Math.round(s.submittedAmount)}</p>
                  <p className="text-[10px] text-zinc-500">submitted</p>
                </div>
              </div>

              {/* Breakdown */}
              <div className="grid grid-cols-3 gap-2 pt-1 border-t border-zinc-800">
                <Stat label="Collected"    value={`Rs.${Math.round(s.collectedAmount)}`} color="text-zinc-300"  />
                <Stat label="Submitted"    value={`Rs.${Math.round(s.submittedAmount)}`} color="text-lime-400"  />
                <Stat label="Carried Over" value={`Rs.${Math.round(s.remainingAmount)}`} color={s.remainingAmount > 0 ? 'text-amber-400' : 'text-zinc-600'} />
              </div>

              {/* Notes */}
              {s.notes && (
                <p className="text-xs text-zinc-500 italic">{s.notes}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="text-center">
      <p className={clsx('text-sm font-semibold', color)}>{value}</p>
      <p className="text-[10px] text-zinc-600">{label}</p>
    </div>
  );
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-PK', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}
