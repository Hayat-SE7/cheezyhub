'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStaff, StaffMember } from '@/hooks/useStaff';
import { adminApi } from '@/lib/api';
import { formatDistanceToNow, format } from 'date-fns';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { Plus, ChevronRight, Clock, Check, X, Users } from 'lucide-react';

const ROLE_COLORS: Record<string, string> = {
  admin:    'text-red-400 bg-red-500/10 border-red-500/20',
  cashier:  'text-amber-400 bg-amber-500/10 border-amber-500/20',
  kitchen:  'text-orange-400 bg-orange-500/10 border-orange-500/20',
  delivery: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
};

function CreateStaffModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ username: '', pin: '', role: 'kitchen', fullName: '', phone: '' });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!form.username || !form.pin || !form.role) { toast.error('Fill all required fields'); return; }
    if (form.pin.length < 4) { toast.error('PIN must be at least 4 digits'); return; }
    setSaving(true);
    try {
      await adminApi.createStaff(form);
      toast.success('Staff account created');
      onCreated();
      onClose();
    } catch (e: any) {
      toast.error(e.response?.data?.error ?? 'Failed to create');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0c0c0e] border border-[#1e1e28] rounded-2xl p-6 w-full max-w-md space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-bold text-lg text-[#f2f2f5]">New Staff Account</h2>
          <button onClick={onClose} className="text-[#4a4a58] hover:text-[#9898a5]"><X size={18} /></button>
        </div>

        {[
          { label: 'Username *', key: 'username', placeholder: 'e.g. ahmed_k' },
          { label: 'PIN * (4–8 digits)', key: 'pin', placeholder: '••••', type: 'password', inputMode: 'numeric' },
          { label: 'Full Name', key: 'fullName', placeholder: 'Ahmed Khan' },
          { label: 'Phone', key: 'phone', placeholder: '+92 300 000 0000' },
        ].map(({ label, key, placeholder, type, inputMode }) => (
          <div key={key}>
            <label className="block text-xs font-semibold text-[#4a4a58] mb-1">{label}</label>
            <input
              type={type ?? 'text'}
              inputMode={inputMode as any}
              value={(form as any)[key]}
              onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
              placeholder={placeholder}
              className="w-full px-3 py-2 rounded-lg bg-[#07070a] border border-[#1e1e28] text-[#f2f2f5] text-sm placeholder-[#3a3a48] focus:outline-none focus:border-amber-500/40"
            />
          </div>
        ))}

        <div>
          <label className="block text-xs font-semibold text-[#4a4a58] mb-1">Role *</label>
          <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-[#07070a] border border-[#1e1e28] text-[#f2f2f5] text-sm focus:outline-none focus:border-amber-500/40">
            {['kitchen', 'cashier', 'delivery', 'admin'].map((r) => (
              <option key={r} value={r} className="capitalize">{r}</option>
            ))}
          </select>
        </div>

        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-[#1a1a24] text-[#9898a5] hover:text-[#f2f2f5] text-sm font-semibold transition-colors">Cancel</button>
          <button onClick={handleSubmit} disabled={saving} className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold transition-colors disabled:opacity-50">
            {saving ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminStaffPage() {
  const router = useRouter();
  const { data, loading, refetch } = useStaff();
  const [showCreate, setShowCreate] = useState(false);

  const handleToggle = async (m: StaffMember) => {
    try {
      await adminApi.updateStaff(m.id, { isActive: !m.isActive });
      toast.success(m.isActive ? 'Deactivated' : 'Activated');
      refetch();
    } catch { toast.error('Failed'); }
  };

  return (
    <div className="p-6 space-y-5">
      {showCreate && <CreateStaffModal onClose={() => setShowCreate(false)} onCreated={refetch} />}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-2xl text-[#f2f2f5]">Staff</h1>
          <p className="text-[#4a4a58] text-sm mt-0.5">{data.length} accounts</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold transition-colors">
          <Plus size={15} /> New Staff
        </button>
      </div>

      <div className="rounded-xl border border-[#1e1e28] overflow-hidden">
        <table className="w-full">
          <thead className="bg-[#0c0c0e] border-b border-[#1e1e28]">
            <tr>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-[#4a4a58] uppercase tracking-wide">Name</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-[#4a4a58] uppercase tracking-wide">Role</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-[#4a4a58] uppercase tracking-wide">Phone</th>
              <th className="px-4 py-2.5 text-center text-xs font-semibold text-[#4a4a58] uppercase tracking-wide">Last Login</th>
              <th className="px-4 py-2.5 text-center text-xs font-semibold text-[#4a4a58] uppercase tracking-wide">Status</th>
              <th className="px-4 py-2.5 text-center text-xs font-semibold text-[#4a4a58] uppercase tracking-wide">Action</th>
              <th className="px-2" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-[#1e1e28]">
                  {Array.from({ length: 7 }).map((_, j) => (
                    <td key={j} className="px-4 py-3"><div className="h-4 bg-[#1e1e28] rounded animate-pulse" /></td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-16 text-center text-[#4a4a58]"><Users size={36} className="mx-auto mb-2 opacity-30" /><p>No staff yet</p></td></tr>
            ) : (
              data.map((m) => (
                <tr key={m.id} className="border-b border-[#1e1e28] hover:bg-[#14141c] transition-colors cursor-pointer group" onClick={() => router.push(`/admin/staff/${m.id}`)}>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-sm text-[#f2f2f5]">{m.fullName ?? m.username}</div>
                    {m.fullName && <div className="text-xs text-[#4a4a58]">@{m.username}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={clsx('text-xs px-2 py-0.5 rounded-full border font-semibold capitalize', ROLE_COLORS[m.role] ?? 'text-[#9898a5] bg-[#1a1a24] border-[#1e1e28]')}>
                      {m.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-[#9898a5]">{m.phone ?? '—'}</td>
                  <td className="px-4 py-3 text-center text-xs text-[#4a4a58]">
                    {m.lastLoginAt ? formatDistanceToNow(new Date(m.lastLoginAt), { addSuffix: true }) : 'Never'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={clsx('text-[11px] px-2 py-0.5 rounded-full font-semibold', m.isActive ? 'text-emerald-400 bg-emerald-500/10' : 'text-red-400 bg-red-500/10')}>
                      {m.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center" onClick={(e) => { e.stopPropagation(); handleToggle(m); }}>
                    <button className={clsx('text-xs px-2.5 py-1 rounded-lg font-semibold transition-colors', m.isActive ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20' : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20')}>
                      {m.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-[#4a4a58] group-hover:text-[#9898a5]"><ChevronRight size={15} /></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
