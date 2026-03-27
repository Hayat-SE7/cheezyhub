'use client';

import { useState, useEffect, useCallback } from 'react';
import { adminDriverApi } from '@/lib/api';
import { Wallet, Filter, Download, TrendingDown } from 'lucide-react';
import { clsx } from 'clsx';

interface Settlement {
  id: string; driverId: string; collectedAmount: number; submittedAmount: number;
  remainingAmount: number; notes?: string; settledBy: string; createdAt: string;
  driver?: { id: string; username: string; fullName?: string };
}

export default function AdminSettlementsPage() {
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loading, setLoading]         = useState(true);
  const [drivers, setDrivers]         = useState<{ id: string; username: string; fullName?: string }[]>([]);

  // Filters
  const [driverId, setDriverId] = useState('');
  const [from, setFrom]         = useState('');
  const [to, setTo]             = useState('');

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const [sRes, dRes] = await Promise.all([
        adminDriverApi.getAllSettlements({
          driverId: driverId || undefined,
          from:     from     || undefined,
          to:       to       || undefined,
        }),
        adminDriverApi.getAll(),
      ]);
      setSettlements(sRes.data.data);
      setDrivers(dRes.data.data);
    } catch {}
    finally { setLoading(false); }
  }, [driverId, from, to]);

  useEffect(() => { fetch(); }, []);

  const handleApply = () => fetch();

  const totalCollected  = settlements.reduce((s, r) => s + r.collectedAmount, 0);
  const totalSubmitted  = settlements.reduce((s, r) => s + r.submittedAmount, 0);
  const totalCarried    = settlements.reduce((s, r) => s + r.remainingAmount, 0);

  return (
    <div className="p-6 space-y-6 max-w-5xl">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#f2f2f5] tracking-tight">Settlements</h1>
          <p className="text-sm text-[#4a4a58] mt-0.5">COD cash settlement records</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Collected',  value: totalCollected, color: 'text-[#f2f2f5]'  },
          { label: 'Total Submitted',  value: totalSubmitted, color: 'text-lime-400'    },
          { label: 'Total Carried Over',value: totalCarried,  color: totalCarried > 0 ? 'text-amber-400' : 'text-[#4a4a58]' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-[#0c0c0e] border border-[#1e1e22] rounded-xl px-4 py-3">
            <p className={clsx('text-2xl font-bold', color)}>Rs.{Math.round(value).toLocaleString()}</p>
            <p className="text-xs text-[#4a4a58] mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-end gap-3 flex-wrap bg-[#0c0c0e] border border-[#1e1e22] rounded-2xl p-4">
        <Filter size={14} className="text-[#4a4a58] mb-2.5" />
        <div>
          <label className="block text-xs text-[#4a4a58] mb-1.5">Driver</label>
          <select
            value={driverId}
            onChange={(e) => setDriverId(e.target.value)}
            className="bg-[#131316] border border-[#1e1e22] rounded-xl px-3 py-2 text-sm text-[#f2f2f5] outline-none focus:border-amber-500/40 transition-colors min-w-[160px]"
          >
            <option value="">All Drivers</option>
            {drivers.map(d => (
              <option key={d.id} value={d.id}>{d.fullName ?? d.username}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-[#4a4a58] mb-1.5">From</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="bg-[#131316] border border-[#1e1e22] rounded-xl px-3 py-2 text-sm text-[#f2f2f5] outline-none focus:border-amber-500/40 transition-colors"
          />
        </div>
        <div>
          <label className="block text-xs text-[#4a4a58] mb-1.5">To</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="bg-[#131316] border border-[#1e1e22] rounded-xl px-3 py-2 text-sm text-[#f2f2f5] outline-none focus:border-amber-500/40 transition-colors"
          />
        </div>
        <button
          onClick={handleApply}
          className="px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm font-medium hover:bg-amber-500/20 transition-colors"
        >
          Apply
        </button>
        {(driverId || from || to) && (
          <button
            onClick={() => { setDriverId(''); setFrom(''); setTo(''); setTimeout(fetch, 0); }}
            className="text-xs text-[#4a4a58] hover:text-[#9898a5] transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {[1,2,3,4].map(i => <div key={i} className="h-14 rounded-xl bg-[#0c0c0e] animate-pulse" />)}
        </div>
      ) : settlements.length === 0 ? (
        <div className="text-center py-16 text-[#3a3a48]">
          <Wallet size={40} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">No settlements found</p>
        </div>
      ) : (
        <div className="bg-[#0c0c0e] border border-[#1e1e22] rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#1e1e22]">
                {['Date', 'Driver', 'Collected', 'Submitted', 'Carried Over', 'Note'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-[#3a3a48] uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e1e22]">
              {settlements.map((s) => (
                <tr key={s.id} className="hover:bg-[#131316] transition-colors">
                  <td className="px-4 py-3 text-sm text-[#9898a5] whitespace-nowrap">
                    {new Date(s.createdAt).toLocaleDateString('en-PK', { day:'numeric', month:'short', year:'numeric' })}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-[#f2f2f5]">{s.driver?.fullName ?? s.driver?.username ?? '—'}</p>
                    <p className="text-xs text-[#4a4a58]">@{s.driver?.username}</p>
                  </td>
                  <td className="px-4 py-3 text-sm text-[#9898a5]">Rs.{Math.round(s.collectedAmount).toLocaleString()}</td>
                  <td className="px-4 py-3 text-sm font-medium text-lime-400">Rs.{Math.round(s.submittedAmount).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    {s.remainingAmount > 0 ? (
                      <span className="text-sm text-amber-400">Rs.{Math.round(s.remainingAmount).toLocaleString()}</span>
                    ) : (
                      <span className="text-sm text-[#3a3a48]">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-[#4a4a58] max-w-[200px] truncate">
                    {s.notes ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
