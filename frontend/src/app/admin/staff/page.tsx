'use client';

import { useEffect, useState } from 'react';
import { adminApi } from '@/lib/api';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { Plus, Trash2, ToggleLeft, ToggleRight, Eye, EyeOff } from 'lucide-react';

interface Staff {
  id: string;
  username: string;
  role: 'kitchen' | 'delivery' | 'admin';
  isActive: boolean;
  createdAt: string;
}

const ROLE_STYLES = {
  kitchen:  { color: 'text-blue-400',   bg: 'bg-blue-500/15 border-blue-500/25' },
  delivery: { color: 'text-orange-400', bg: 'bg-orange-500/15 border-orange-500/25' },
  admin:    { color: 'text-amber-400',  bg: 'bg-amber-500/15 border-amber-500/25' },
};

export default function AdminStaffPage() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ username: '', pin: '', role: 'kitchen' });
  const [showPin, setShowPin] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fetchStaff = () => {
    adminApi.getStaff()
      .then((res) => setStaff(res.data.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchStaff(); }, []);

  const handleCreate = async () => {
    if (!form.username || !form.pin || !form.role) {
      toast.error('All fields required');
      return;
    }
    if (form.pin.length < 4) {
      toast.error('PIN must be at least 4 digits');
      return;
    }
    setSubmitting(true);
    try {
      await adminApi.createStaff({ username: form.username, pin: form.pin, role: form.role });
      toast.success(`${form.username} created!`);
      setForm({ username: '', pin: '', role: 'kitchen' });
      setShowForm(false);
      fetchStaff();
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Failed to create staff');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (member: Staff) => {
    try {
      await adminApi.updateStaff(member.id, { isActive: !member.isActive });
      setStaff((prev) =>
        prev.map((s) => (s.id === member.id ? { ...s, isActive: !s.isActive } : s))
      );
      toast.success(`${member.username} ${member.isActive ? 'deactivated' : 'activated'}`);
    } catch {
      toast.error('Failed to update');
    }
  };

  const handleDelete = async (member: Staff) => {
    if (!confirm(`Delete account for "${member.username}"? This cannot be undone.`)) return;
    try {
      await adminApi.deleteStaff(member.id);
      setStaff((prev) => prev.filter((s) => s.id !== member.id));
      toast.success('Staff account deleted');
    } catch {
      toast.error('Failed to delete');
    }
  };

  const grouped = {
    admin:    staff.filter((s) => s.role === 'admin'),
    kitchen:  staff.filter((s) => s.role === 'kitchen'),
    delivery: staff.filter((s) => s.role === 'delivery'),
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display font-bold text-2xl text-[#f2f2f5]">Staff</h1>
          <p className="text-[#4a4a58] text-sm mt-0.5">{staff.length} accounts</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="btn-press flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-display font-bold text-sm transition-colors"
        >
          <Plus size={15} /> Add Staff
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="mb-6 bg-[#0f0f11] rounded-2xl border border-[#222228] p-6 animate-slide-up">
          <h2 className="font-display font-bold text-[#f2f2f5] mb-4">New Staff Account</h2>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <input
              className="px-4 py-3 rounded-xl bg-[#111113] border border-[#222228] text-[#f2f2f5] text-sm placeholder:text-[#3a3a48] outline-none focus:border-amber-500/40"
              placeholder="Username"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase().replace(/\s/g, '') })}
            />
            <div className="relative">
              <input
                type={showPin ? 'text' : 'password'}
                className="w-full px-4 py-3 pr-10 rounded-xl bg-[#111113] border border-[#222228] text-[#f2f2f5] text-sm placeholder:text-[#3a3a48] outline-none focus:border-amber-500/40 font-mono"
                placeholder="PIN (4–8 digits)"
                maxLength={8}
                value={form.pin}
                onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, '') })}
              />
              <button
                onClick={() => setShowPin(!showPin)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4a4a58] hover:text-[#9898a5]"
              >
                {showPin ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <select
              className="px-4 py-3 rounded-xl bg-[#111113] border border-[#222228] text-[#f2f2f5] text-sm outline-none focus:border-amber-500/40"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
            >
              <option value="kitchen">Kitchen</option>
              <option value="delivery">Delivery</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2.5 rounded-xl border border-[#222228] text-[#6a6a78] text-sm hover:border-[#333340] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={submitting}
              className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white font-display font-bold text-sm transition-colors"
            >
              {submitting ? 'Creating...' : 'Create Account'}
            </button>
          </div>
        </div>
      )}

      {/* Staff by role */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-16 rounded-2xl" />)}
        </div>
      ) : (
        <div className="space-y-6">
          {(Object.entries(grouped) as [keyof typeof ROLE_STYLES, Staff[]][]).map(([role, members]) => (
            members.length > 0 && (
              <div key={role}>
                <div className={clsx('inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-bold uppercase tracking-wider mb-3', ROLE_STYLES[role].bg, ROLE_STYLES[role].color)}>
                  {role}
                  <span className="opacity-60">({members.length})</span>
                </div>
                <div className="space-y-2">
                  {members.map((member) => (
                    <div
                      key={member.id}
                      className={clsx(
                        'flex items-center justify-between p-4 rounded-2xl bg-[#0f0f11] border transition-all',
                        member.isActive ? 'border-[#222228]' : 'border-[#1a1a1e] opacity-50'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-[#1e1e22] flex items-center justify-center font-display font-bold text-[#6a6a78] text-sm">
                          {member.username.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium text-[#d4d4dc] text-sm">{member.username}</div>
                          <div className="text-[11px] text-[#4a4a58]">
                            {member.isActive ? '🟢 Active' : '⚫ Inactive'}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleToggle(member)}
                          className="p-2 rounded-lg text-[#4a4a58] hover:text-amber-400 hover:bg-amber-500/10 transition-all"
                          title={member.isActive ? 'Deactivate' : 'Activate'}
                        >
                          {member.isActive ? <ToggleRight size={18} className="text-emerald-400" /> : <ToggleLeft size={18} />}
                        </button>
                        <button
                          onClick={() => handleDelete(member)}
                          className="p-2 rounded-lg text-[#4a4a58] hover:text-red-400 hover:bg-red-500/10 transition-all"
                          title="Delete"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          ))}
        </div>
      )}
    </div>
  );
}
