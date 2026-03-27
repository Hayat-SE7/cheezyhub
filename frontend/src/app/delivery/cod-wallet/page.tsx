'use client';

import { useState, useEffect } from 'react';
import { deliveryApi } from '@/lib/api';
import { Wallet, ArrowDownCircle, Clock, CheckCircle2 } from 'lucide-react';
import { clsx } from 'clsx';

interface Settlement { id: string; collectedAmount: number; submittedAmount: number; remainingAmount: number; notes?: string; createdAt: string; }
interface CODOrder    { id: string; orderNumber: string; total: number; updatedAt: string; }

export default function CODWalletPage() {
  const [data, setData]     = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]       = useState<'pending' | 'history'>('pending');

  useEffect(() => {
    deliveryApi.getCOD()
      .then((res) => setData(res.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="px-4 pt-5 space-y-4">
      {[1,2,3].map(i => <div key={i} className="h-20 rounded-2xl bg-zinc-900 animate-pulse" />)}
    </div>
  );

  const pending     = Math.round(data?.wallet?.codPending ?? 0);
  const settlements: Settlement[] = data?.settlements ?? [];
  const orders: CODOrder[]        = data?.recentCODOrders ?? [];

  return (
    <div className="px-4 pt-5 space-y-5">

      {/* Balance card */}
      <div className={clsx(
        'rounded-2xl p-5 border',
        pending > 0
          ? 'bg-amber-400/5 border-amber-400/20'
          : 'bg-zinc-900 border-zinc-800'
      )}>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-zinc-500 mb-1">Cash to Submit</p>
            <p className={clsx('text-4xl font-bold tracking-tight', pending > 0 ? 'text-amber-400' : 'text-zinc-500')}>
              Rs.{pending.toLocaleString()}
            </p>
            {pending > 0 && (
              <p className="text-xs text-zinc-500 mt-2">
                Hand this cash to your manager or counter staff
              </p>
            )}
            {pending === 0 && (
              <p className="text-xs text-zinc-600 mt-1 flex items-center gap-1">
                <CheckCircle2 size={11} className="text-lime-400" /> All settled
              </p>
            )}
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center">
            <Wallet size={22} className="text-amber-400" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-zinc-900 rounded-xl p-1 border border-zinc-800">
        {(['pending', 'history'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={clsx(
              'flex-1 py-2 rounded-lg text-xs font-medium transition-colors capitalize',
              tab === t ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'
            )}
          >
            {t === 'pending' ? `COD Orders (${orders.length})` : `Settlements (${settlements.length})`}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'pending' && (
        <div className="space-y-2">
          {orders.length === 0 ? (
            <EmptyState icon={ArrowDownCircle} message="No COD orders yet" />
          ) : orders.map(o => (
            <div key={o.id} className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3">
              <div>
                <p className="text-sm font-medium text-white">#{o.orderNumber}</p>
                <p className="text-xs text-zinc-500">{fmtDate(o.updatedAt)}</p>
              </div>
              <p className="text-amber-400 font-semibold">Rs.{Math.round(o.total)}</p>
            </div>
          ))}
        </div>
      )}

      {tab === 'history' && (
        <div className="space-y-2">
          {settlements.length === 0 ? (
            <EmptyState icon={Clock} message="No settlements yet" />
          ) : settlements.map(s => (
            <div key={s.id} className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="text-xs text-zinc-500">{fmtDate(s.createdAt)}</p>
                <span className="text-xs text-lime-400/70 bg-lime-400/5 border border-lime-400/10 px-2 py-0.5 rounded-full">Settled</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">Collected</span>
                <span className="text-white font-medium">Rs.{Math.round(s.collectedAmount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">Submitted</span>
                <span className="text-lime-400 font-medium">Rs.{Math.round(s.submittedAmount)}</span>
              </div>
              {s.remainingAmount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-400">Carried over</span>
                  <span className="text-amber-400 font-medium">Rs.{Math.round(s.remainingAmount)}</span>
                </div>
              )}
              {s.notes && <p className="text-xs text-zinc-600 border-t border-zinc-800 pt-1.5">{s.notes}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState({ icon: Icon, message }: { icon: any; message: string }) {
  return (
    <div className="text-center py-12 text-zinc-700">
      <Icon size={36} className="mx-auto mb-2 opacity-40" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' });
}
