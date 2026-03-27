'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { adminApi } from '@/lib/api';
import { formatDistanceToNow, format } from 'date-fns';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { ArrowLeft, User, Phone, Mail, Clock, Activity, Lock, Check, X } from 'lucide-react';

const ROLE_COLORS: Record<string, string> = {
  admin:    'text-red-400 bg-red-500/10 border-red-500/20',
  cashier:  'text-amber-400 bg-amber-500/10 border-amber-500/20',
  kitchen:  'text-orange-400 bg-orange-500/10 border-orange-500/20',
  delivery: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
};

export default function StaffProfilePage() {
  const params = useParams();
  const router = useRouter();
  const id     = params.id as string;

  const [data,     setData]     = useState<any>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');
  const [newPin,   setNewPin]   = useState('');
  const [saving,   setSaving]   = useState(false);
  const [pinMode,  setPinMode]  = useState(false);

  useEffect(() => {
    adminApi.getStaffMember(id)
      .then((r) => setData(r.data.data))
      .catch(() => setError('Staff member not found'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleToggleActive = async () => {
    if (!data) return;
    setSaving(true);
    try {
      await adminApi.updateStaff(id, { isActive: !data.isActive });
      setData((d: any) => ({ ...d, isActive: !d.isActive }));
      toast.success(data.isActive ? 'Account deactivated' : 'Account activated');
    } catch { toast.error('Failed'); } finally { setSaving(false); }
  };

  const handleResetPin = async () => {
    if (!newPin || newPin.length < 4) { toast.error('PIN must be at least 4 digits'); return; }
    setSaving(true);
    try {
      await adminApi.resetStaffPin(id, newPin);
      toast.success('PIN reset successfully');
      setNewPin(''); setPinMode(false);
    } catch { toast.error('Failed to reset PIN'); } finally { setSaving(false); }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="h-6 w-40 bg-[#1e1e28] rounded animate-pulse mb-4" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {[1,2,3].map((i) => <div key={i} className="h-48 bg-[#1e1e28] rounded-xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 text-center py-20 text-[#4a4a58]">
        <User size={40} className="mx-auto mb-3 opacity-30" />
        <p>{error || 'Not found'}</p>
        <button onClick={() => router.push('/admin/staff')} className="mt-4 text-amber-400 text-sm">← Back</button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => router.push('/admin/staff')} className="p-2 rounded-lg bg-[#1a1a24] text-[#9898a5] hover:text-[#f2f2f5] transition-colors">
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1">
          <h1 className="font-display font-bold text-xl text-[#f2f2f5]">{data.fullName ?? data.username}</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={clsx('text-xs px-2 py-0.5 rounded-full border font-semibold capitalize', ROLE_COLORS[data.role] ?? 'text-[#9898a5] bg-[#1a1a24] border-[#1e1e28]')}>
              {data.role}
            </span>
            <span className={clsx('text-xs px-2 py-0.5 rounded-full font-semibold', data.isActive ? 'text-emerald-400' : 'text-red-400')}>
              {data.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>
        <button
          onClick={handleToggleActive}
          disabled={saving}
          className={clsx('flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-colors', data.isActive ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20' : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20')}
        >
          {data.isActive ? <><X size={14} /> Deactivate</> : <><Check size={14} /> Activate</>}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile card */}
        <div className="space-y-4">
          <div className="bg-[#0c0c0e] border border-[#1e1e28] rounded-xl p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className={clsx('w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-bold text-white', data.role === 'admin' ? 'bg-gradient-to-br from-red-500 to-rose-600' : data.role === 'cashier' ? 'bg-gradient-to-br from-amber-400 to-amber-600' : data.role === 'kitchen' ? 'bg-gradient-to-br from-orange-400 to-red-500' : 'bg-gradient-to-br from-blue-400 to-blue-600')}>
                {(data.fullName ?? data.username).charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-semibold text-[#f2f2f5]">{data.fullName ?? data.username}</p>
                <p className="text-xs text-[#4a4a58]">@{data.username}</p>
              </div>
            </div>

            <div className="space-y-2">
              {data.phone && (
                <div className="flex items-center gap-2 text-sm text-[#9898a5]">
                  <Phone size={13} className="text-[#4a4a58]" /> {data.phone}
                </div>
              )}
              <div className="flex items-center gap-2 text-sm text-[#9898a5]">
                <Clock size={13} className="text-[#4a4a58]" />
                Last login: {data.lastLoginAt ? formatDistanceToNow(new Date(data.lastLoginAt), { addSuffix: true }) : 'Never'}
              </div>
              <div className="flex items-center gap-2 text-sm text-[#9898a5]">
                <Activity size={13} className="text-[#4a4a58]" />
                Member since {format(new Date(data.createdAt), 'MMM d, yyyy')}
              </div>
            </div>
          </div>

          {/* PIN Reset */}
          <div className="bg-[#0c0c0e] border border-[#1e1e28] rounded-xl p-4">
            <button onClick={() => setPinMode((v) => !v)} className="flex items-center gap-2 text-sm font-semibold text-[#9898a5] hover:text-[#f2f2f5] transition-colors w-full">
              <Lock size={14} /> Reset PIN
            </button>
            {pinMode && (
              <div className="mt-3 space-y-2">
                <input
                  type="password"
                  inputMode="numeric"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                  maxLength={8}
                  placeholder="New PIN (4–8 digits)"
                  className="w-full px-3 py-2 rounded-lg bg-[#07070a] border border-[#1e1e28] text-[#f2f2f5] text-sm placeholder-[#3a3a48] focus:outline-none focus:border-amber-500/40"
                />
                <button
                  onClick={handleResetPin}
                  disabled={saving || newPin.length < 4}
                  className="w-full py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold transition-colors disabled:opacity-40"
                >
                  {saving ? 'Saving…' : 'Set PIN'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right: role-specific data */}
        <div className="lg:col-span-2 space-y-4">
          {/* Delivery stats */}
          {data.role === 'delivery' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#0c0c0e] border border-[#1e1e28] rounded-xl p-4 text-center">
                  <div className="font-bold text-2xl text-blue-400">{data.totalDeliveryCount ?? 0}</div>
                  <div className="text-xs text-[#4a4a58] mt-0.5">Deliveries</div>
                </div>
                <div className="bg-[#0c0c0e] border border-[#1e1e28] rounded-xl p-4 text-center">
                  <div className="font-bold text-lg text-emerald-400">Rs. {(data.totalRevenue ?? 0).toLocaleString()}</div>
                  <div className="text-xs text-[#4a4a58] mt-0.5">Total Revenue</div>
                </div>
              </div>

              {data.recentDeliveries?.length > 0 && (
                <div className="bg-[#0c0c0e] border border-[#1e1e28] rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-[#1e1e28]">
                    <h3 className="font-semibold text-[#f2f2f5] text-sm">Recent Deliveries</h3>
                  </div>
                  <div className="divide-y divide-[#1e1e28] max-h-80 overflow-y-auto">
                    {data.recentDeliveries.map((o: any) => (
                      <div key={o.id} className="flex items-center justify-between px-4 py-2.5">
                        <div>
                          <span className="text-sm font-medium text-[#f2f2f5]">#{o.orderNumber}</span>
                          <span className="ml-2 text-xs text-[#4a4a58]">{format(new Date(o.createdAt), 'MMM d')}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={clsx('text-[11px] px-2 py-0.5 rounded-full font-semibold capitalize', o.status === 'completed' ? 'text-emerald-400 bg-emerald-500/10' : 'text-[#9898a5] bg-[#1a1a24]')}>
                            {o.status}
                          </span>
                          <span className="text-sm font-medium text-[#f2f2f5]">Rs. {o.total.toFixed(0)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Kitchen / admin / cashier info */}
          {data.role !== 'delivery' && (
            <div className="bg-[#0c0c0e] border border-[#1e1e28] rounded-xl p-6 text-center text-[#4a4a58]">
              <Activity size={40} className="mx-auto mb-3 opacity-20" />
              <p className="text-sm capitalize">{data.role} account</p>
              <p className="text-xs mt-1">
                {data.lastLoginAt ? `Last active ${formatDistanceToNow(new Date(data.lastLoginAt), { addSuffix: true })}` : 'Never logged in'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
