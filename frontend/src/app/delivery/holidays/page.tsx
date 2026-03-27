'use client';

import { useState, useEffect } from 'react';
import { deliveryApi } from '@/lib/api';
import toast from 'react-hot-toast';
import { CalendarDays, Plus, X, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { clsx } from 'clsx';

interface HolidayRequest {
  id: string; fromDate: string; toDate: string; reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED'; reviewNote?: string; createdAt: string;
}

const STATUS = {
  PENDING:  { color: 'text-amber-400', bg: 'bg-amber-400/10 border-amber-400/20', icon: Clock,        label: 'Pending'  },
  APPROVED: { color: 'text-lime-400',  bg: 'bg-lime-400/10 border-lime-400/20',   icon: CheckCircle2, label: 'Approved' },
  REJECTED: { color: 'text-red-400',   bg: 'bg-red-400/10 border-red-400/20',     icon: XCircle,      label: 'Rejected' },
};

export default function HolidaysPage() {
  const [requests, setRequests] = useState<HolidayRequest[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({ fromDate: '', toDate: '', reason: '' });

  const fetchRequests = async () => {
    try {
      const res = await deliveryApi.getHolidays();
      setRequests(res.data.data);
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => { fetchRequests(); }, []);

  const handleSubmit = async () => {
    if (!form.fromDate || !form.toDate || !form.reason.trim()) {
      toast.error('Fill in all fields');
      return;
    }
    if (new Date(form.fromDate) >= new Date(form.toDate)) {
      toast.error('End date must be after start date');
      return;
    }
    setSubmitting(true);
    try {
      await deliveryApi.requestHoliday({
        fromDate: new Date(form.fromDate).toISOString(),
        toDate:   new Date(form.toDate).toISOString(),
        reason:   form.reason.trim(),
      });
      toast.success('Holiday request submitted!');
      setShowForm(false);
      setForm({ fromDate: '', toDate: '', reason: '' });
      fetchRequests();
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Submit failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (id: string) => {
    try {
      await deliveryApi.cancelHoliday(id);
      toast.success('Request cancelled');
      fetchRequests();
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Cancel failed');
    }
  };

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="px-4 pt-5 space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white">Days Off</h1>
          <p className="text-xs text-zinc-500">Request time off from deliveries</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className={clsx(
            'flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors',
            showForm
              ? 'bg-zinc-800 text-zinc-400'
              : 'bg-lime-400/10 border border-lime-400/20 text-lime-400 hover:bg-lime-400/20'
          )}
        >
          {showForm ? <X size={13} /> : <Plus size={13} />}
          {showForm ? 'Cancel' : 'Request'}
        </button>
      </div>

      {/* New request form */}
      {showForm && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3">
          <h2 className="text-sm font-semibold text-zinc-200">New Request</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-zinc-500 mb-1.5">From</label>
              <input
                type="date"
                min={today}
                value={form.fromDate}
                onChange={(e) => setForm(f => ({...f, fromDate: e.target.value}))}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-lime-400/40 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1.5">To</label>
              <input
                type="date"
                min={form.fromDate || today}
                value={form.toDate}
                onChange={(e) => setForm(f => ({...f, toDate: e.target.value}))}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-lime-400/40 transition-colors"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1.5">Reason</label>
            <textarea
              value={form.reason}
              onChange={(e) => setForm(f => ({...f, reason: e.target.value}))}
              placeholder="Brief reason for the request…"
              rows={3}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-lime-400/40 transition-colors resize-none"
            />
          </div>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full py-3 rounded-xl bg-lime-400 text-black font-bold text-sm disabled:opacity-50 hover:bg-lime-300 transition-colors"
          >
            {submitting ? 'Submitting…' : 'Submit Request'}
          </button>
        </div>
      )}

      {/* Requests list */}
      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-24 rounded-2xl bg-zinc-900 animate-pulse" />)}
        </div>
      ) : requests.length === 0 ? (
        <div className="text-center py-14 text-zinc-700">
          <CalendarDays size={40} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">No holiday requests</p>
          <p className="text-xs mt-1">Tap Request to submit one</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => {
            const s    = STATUS[r.status];
            const Icon = s.icon;
            return (
              <div key={r.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-white">
                      {fmtDate(r.fromDate)} → {fmtDate(r.toDate)}
                    </p>
                    <p className="text-xs text-zinc-500 mt-0.5">{r.reason}</p>
                  </div>
                  <div className={clsx('flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border', s.bg, s.color)}>
                    <Icon size={11} /> {s.label}
                  </div>
                </div>
                {r.reviewNote && (
                  <p className="text-xs text-zinc-500 border-t border-zinc-800 pt-2">{r.reviewNote}</p>
                )}
                {r.status === 'PENDING' && (
                  <button
                    onClick={() => handleCancel(r.id)}
                    className="text-xs text-zinc-600 hover:text-red-400 flex items-center gap-1 transition-colors pt-1"
                  >
                    <X size={11} /> Cancel request
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-PK', { day: 'numeric', month: 'short' });
}
