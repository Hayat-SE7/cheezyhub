'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { adminDriverApi } from '@/lib/api';
import { useSSE } from '@/hooks/useSSE';
import toast from 'react-hot-toast';
import {
  Plus, Search, ChevronRight, Bike, CheckCircle2, Clock,
  XCircle, AlertCircle, RefreshCw, Filter,
} from 'lucide-react';
import { clsx } from 'clsx';

interface Driver {
  id: string; username: string; fullName?: string; phone?: string;
  vehicleType?: string; vehiclePlate?: string; isActive: boolean;
  driverStatus: 'OFFLINE' | 'AVAILABLE' | 'ON_DELIVERY';
  verificationStatus: 'PENDING' | 'UNDER_REVIEW' | 'VERIFIED' | 'REJECTED';
  codPending: number; totalDeliveries: number; todayDeliveries: number;
  activeOrderCount: number;
}

const DRIVER_STATUS = {
  AVAILABLE:   { dot: 'bg-lime-400',  text: 'text-lime-400',  label: 'Online'      },
  ON_DELIVERY: { dot: 'bg-blue-400',  text: 'text-blue-400',  label: 'Delivering'  },
  OFFLINE:     { dot: 'bg-zinc-600',  text: 'text-zinc-500',  label: 'Offline'     },
};

const VERIFY_STATUS = {
  PENDING:      { color: 'text-zinc-500',  bg: 'bg-zinc-800',       icon: AlertCircle,  label: 'Pending'      },
  UNDER_REVIEW: { color: 'text-amber-400', bg: 'bg-amber-400/10',   icon: Clock,        label: 'In Review'    },
  VERIFIED:     { color: 'text-lime-400',  bg: 'bg-lime-400/10',    icon: CheckCircle2, label: 'Verified'     },
  REJECTED:     { color: 'text-red-400',   bg: 'bg-red-400/10',     icon: XCircle,      label: 'Rejected'     },
};

export default function AdminDriversPage() {
  const router = useRouter();
  const [drivers, setDrivers]     = useState<Driver[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [filterStatus, setFilter] = useState<string>('all');
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating]   = useState(false);
  const [newDriver, setNewDriver] = useState({ username: '', pin: '', fullName: '', phone: '' });

  const fetch = useCallback(async () => {
    try {
      const res = await adminDriverApi.getAll();
      setDrivers(res.data.data);
    } catch { toast.error('Failed to load drivers'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetch(); }, []);

  // Live status updates via SSE
  useSSE('/sse/admin', {
    DRIVER_STATUS_CHANGED: (d: any) => {
      setDrivers((prev) => prev.map((dr) =>
        dr.id === d.driverId ? { ...dr, driverStatus: d.status } : dr
      ));
    },
    DRIVER_ASSIGNED: () => fetch(),
    VERIFICATION_SUBMITTED: () => {
      toast('A driver submitted verification docs', { icon: '📋' });
      fetch();
    },
    NO_DRIVER_AVAILABLE: (d: any) => {
      toast.error(`No driver available for order ${d.orderId} — assign manually`, { duration: 8000 });
    },
  });

  const handleCreate = async () => {
    if (!newDriver.username || !newDriver.pin) { toast.error('Username and PIN required'); return; }
    setCreating(true);
    try {
      await adminDriverApi.create(newDriver);
      toast.success('Driver account created');
      setShowCreate(false);
      setNewDriver({ username: '', pin: '', fullName: '', phone: '' });
      fetch();
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Create failed');
    } finally {
      setCreating(false);
    }
  };

  const filtered = drivers.filter((d) => {
    const matchSearch = !search ||
      (d.fullName ?? d.username).toLowerCase().includes(search.toLowerCase()) ||
      d.username.toLowerCase().includes(search.toLowerCase()) ||
      (d.vehiclePlate ?? '').toLowerCase().includes(search.toLowerCase());
    const matchStatus =
      filterStatus === 'all'         ? true :
      filterStatus === 'online'      ? d.driverStatus !== 'OFFLINE' :
      filterStatus === 'pending_verify' ? d.verificationStatus === 'UNDER_REVIEW' :
      filterStatus === 'cod'         ? d.codPending > 0 : true;
    return matchSearch && matchStatus;
  });

  const stats = {
    total:   drivers.length,
    online:  drivers.filter(d => d.driverStatus !== 'OFFLINE').length,
    pending: drivers.filter(d => d.verificationStatus === 'UNDER_REVIEW').length,
    cod:     drivers.reduce((s, d) => s + d.codPending, 0),
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl">

      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#f2f2f5] tracking-tight">Drivers</h1>
          <p className="text-sm text-[#4a4a58] mt-0.5">{drivers.length} total drivers</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetch}
            className="w-9 h-9 rounded-xl bg-[#0c0c0e] border border-[#1e1e22] text-[#4a4a58] hover:text-[#9898a5] flex items-center justify-center transition-colors"
          >
            <RefreshCw size={14} />
          </button>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 text-black text-sm font-semibold hover:bg-amber-400 transition-colors"
          >
            <Plus size={15} /> Add Driver
          </button>
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total',    value: stats.total,                     accent: 'text-[#f2f2f5]'  },
          { label: 'Online',   value: stats.online,                    accent: 'text-lime-400'    },
          { label: 'In Review',value: stats.pending,                   accent: 'text-amber-400'   },
          { label: 'COD Due',  value: `Rs.${Math.round(stats.cod).toLocaleString()}`, accent: 'text-red-400' },
        ].map(({ label, value, accent }) => (
          <div key={label} className="bg-[#0c0c0e] border border-[#1e1e22] rounded-xl px-4 py-3">
            <p className={clsx('text-xl font-bold', accent)}>{value}</p>
            <p className="text-xs text-[#4a4a58] mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Create driver form */}
      {showCreate && (
        <div className="bg-[#0c0c0e] border border-[#1e1e22] rounded-2xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-[#f2f2f5]">New Driver Account</h2>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Username *"  value={newDriver.username} onChange={v => setNewDriver(n => ({...n, username: v}))}  placeholder="driver_ahmed" />
            <Field label="PIN *"       value={newDriver.pin}      onChange={v => setNewDriver(n => ({...n, pin: v}))}       placeholder="4–6 digits"  type="password" />
            <Field label="Full Name"   value={newDriver.fullName} onChange={v => setNewDriver(n => ({...n, fullName: v}))} placeholder="Ahmed Ali" />
            <Field label="Phone"       value={newDriver.phone}    onChange={v => setNewDriver(n => ({...n, phone: v}))}    placeholder="+923001234567" />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-xl text-sm text-[#4a4a58] hover:text-[#9898a5] transition-colors">Cancel</button>
            <button
              onClick={handleCreate}
              disabled={creating}
              className="px-5 py-2 rounded-xl bg-amber-500 text-black text-sm font-semibold disabled:opacity-50 hover:bg-amber-400 transition-colors"
            >
              {creating ? 'Creating…' : 'Create Account'}
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#3a3a48]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search drivers…"
            className="w-full bg-[#0c0c0e] border border-[#1e1e22] rounded-xl pl-9 pr-3 py-2 text-sm text-[#f2f2f5] placeholder:text-[#3a3a48] outline-none focus:border-amber-500/40 transition-colors"
          />
        </div>
        <div className="flex gap-1.5">
          {[
            { id: 'all',            label: 'All'         },
            { id: 'online',         label: 'Online'      },
            { id: 'pending_verify', label: 'In Review'   },
            { id: 'cod',            label: 'COD Due'     },
          ].map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setFilter(id)}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                filterStatus === id
                  ? 'bg-amber-500/10 border border-amber-500/30 text-amber-400'
                  : 'bg-[#0c0c0e] border border-[#1e1e22] text-[#4a4a58] hover:text-[#9898a5]'
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Drivers table */}
      {loading ? (
        <div className="space-y-2">
          {[1,2,3,4,5].map(i => <div key={i} className="h-16 rounded-xl bg-[#0c0c0e] animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-[#3a3a48]">
          <Bike size={40} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">No drivers found</p>
        </div>
      ) : (
        <div className="bg-[#0c0c0e] border border-[#1e1e22] rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#1e1e22]">
                {['Driver', 'Status', 'Verified', 'Today', 'Active', 'COD Due', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-[#3a3a48] uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e1e22]">
              {filtered.map((d) => {
                const ds = DRIVER_STATUS[d.driverStatus];
                const vs = VERIFY_STATUS[d.verificationStatus];
                const VIcon = vs.icon;
                return (
                  <tr
                    key={d.id}
                    onClick={() => router.push(`/admin/drivers/${d.id}`)}
                    className="hover:bg-[#131316] cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#1e1e22] flex items-center justify-center text-xs font-bold text-[#9898a5]">
                          {(d.fullName ?? d.username)[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-[#f2f2f5]">{d.fullName ?? d.username}</p>
                          <p className="text-xs text-[#4a4a58]">{d.vehiclePlate ?? d.username}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5">
                        <div className={clsx('w-1.5 h-1.5 rounded-full', ds.dot)} />
                        <span className={clsx('text-xs font-medium', ds.text)}>{ds.label}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className={clsx('inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full', vs.bg, vs.color)}>
                        <VIcon size={10} /> {vs.label}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-sm text-[#9898a5]">{d.todayDeliveries}</td>
                    <td className="px-4 py-3.5 text-sm text-[#9898a5]">{d.activeOrderCount}</td>
                    <td className="px-4 py-3.5">
                      {d.codPending > 0 ? (
                        <span className="text-sm font-medium text-red-400">Rs.{Math.round(d.codPending).toLocaleString()}</span>
                      ) : (
                        <span className="text-sm text-[#3a3a48]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <ChevronRight size={14} className="text-[#3a3a48] ml-auto" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string;
}) {
  return (
    <div>
      <label className="block text-xs text-[#4a4a58] mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-[#131316] border border-[#1e1e22] rounded-xl px-3.5 py-2.5 text-sm text-[#f2f2f5] placeholder:text-[#3a3a48] outline-none focus:border-amber-500/40 transition-colors"
      />
    </div>
  );
}
