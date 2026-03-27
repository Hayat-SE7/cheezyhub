'use client';

import { useState, useEffect, useCallback } from 'react';
import { adminDriverApi } from '@/lib/api';
import { useSSE } from '@/hooks/useSSE';
import toast from 'react-hot-toast';
import { CalendarDays, CheckCircle2, XCircle, Clock, MessageSquare } from 'lucide-react';
import { clsx } from 'clsx';

interface HolidayRequest {
  id: string; fromDate: string; toDate: string; reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED'; reviewNote?: string; createdAt: string;
  driver: { id: string; username: string; fullName?: string; phone?: string };
}

const STATUS = {
  PENDING:  { color: 'text-amber-400', bg: 'bg-amber-400/10 border-amber-400/20', icon: Clock,        label: 'Pending'  },
  APPROVED: { color: 'text-lime-400',  bg: 'bg-lime-400/10 border-lime-400/20',   icon: CheckCircle2, label: 'Approved' },
  REJECTED: { color: 'text-red-400',   bg: 'bg-red-400/10 border-red-400/20',     icon: XCircle,      label: 'Rejected' },
};

export default function AdminHolidayRequestsPage() {
  const [requests, setRequests]   = useState<HolidayRequest[]>([]);
  const [loading, setLoading]     = useState(true);
  const [filterStatus, setFilter] = useState<string>('PENDING');
  const [reviewId, setReviewId]   = useState<string | null>(null);
  const [reviewNote, setNote]     = useState('');
  const [reviewing, setReviewing] = useState(false);

  const fetch = useCallback(async (status?: string) => {
    setLoading(true);
    try {
      const res = await adminDriverApi.getHolidays(status === 'all' ? undefined : status);
      setRequests(res.data.data);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetch(filterStatus); }, [filterStatus]);

  useSSE({
    HOLIDAY_REQUEST_SUBMITTED: (d: any) => {
      toast(`${d.driverName} requested time off`, { icon: '📅', duration: 6000 });
      if (filterStatus === 'PENDING' || filterStatus === 'all') fetch(filterStatus);
    },
  });

  const handleReview = async (id: string, action: 'approve' | 'reject') => {
    if (action === 'reject' && !reviewNote.trim()) { toast.error('Add a note for rejection'); return; }
    setReviewing(true);
    try {
      await adminDriverApi.reviewHoliday(id, { action, note: reviewNote || undefined });
      toast.success(action === 'approve' ? 'Request approved ✓' : 'Request rejected');
      setReviewId(null);
      setNote('');
      fetch(filterStatus);
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Review failed');
    } finally { setReviewing(false); }
  };

  const pendingCount = requests.filter(r => r.status === 'PENDING').length;

  return (
    <div className="p-6 space-y-5 max-w-4xl">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#f2f2f5] tracking-tight">
            Holiday Requests
            {filterStatus === 'PENDING' && pendingCount > 0 && (
              <span className="ml-2 text-sm font-normal text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded-full">
                {pendingCount} pending
              </span>
            )}
          </h1>
          <p className="text-sm text-[#4a4a58] mt-0.5">Driver time-off requests</p>
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="flex bg-[#0c0c0e] rounded-xl p-1 border border-[#1e1e22] gap-1 w-fit">
        {[
          { id: 'PENDING',  label: 'Pending'  },
          { id: 'APPROVED', label: 'Approved' },
          { id: 'REJECTED', label: 'Rejected' },
          { id: 'all',      label: 'All'      },
        ].map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setFilter(id)}
            className={clsx(
              'px-4 py-1.5 rounded-lg text-xs font-medium transition-colors',
              filterStatus === id ? 'bg-[#1e1e22] text-[#f2f2f5]' : 'text-[#4a4a58] hover:text-[#9898a5]'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-28 rounded-2xl bg-[#0c0c0e] animate-pulse" />)}
        </div>
      ) : requests.length === 0 ? (
        <div className="text-center py-16 text-[#3a3a48]">
          <CalendarDays size={40} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">No {filterStatus !== 'all' ? filterStatus.toLowerCase() : ''} requests</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => {
            const s    = STATUS[r.status];
            const SIcon = s.icon;
            const isOpen = reviewId === r.id;
            return (
              <div
                key={r.id}
                className={clsx(
                  'bg-[#0c0c0e] border rounded-2xl overflow-hidden transition-colors',
                  r.status === 'PENDING' ? 'border-amber-400/10' : 'border-[#1e1e22]'
                )}
              >
                {/* Main row */}
                <div className="flex items-start justify-between p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-full bg-[#1e1e22] flex items-center justify-center text-sm font-bold text-[#9898a5] flex-shrink-0 mt-0.5">
                      {(r.driver.fullName ?? r.driver.username)[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[#f2f2f5]">
                        {r.driver.fullName ?? r.driver.username}
                      </p>
                      <p className="text-xs text-[#9898a5] mt-0.5">
                        {fmtDate(r.fromDate)} → {fmtDate(r.toDate)}
                        <span className="text-[#4a4a58] ml-1.5">
                          ({dayDiff(r.fromDate, r.toDate)} day{dayDiff(r.fromDate, r.toDate) !== 1 ? 's' : ''})
                        </span>
                      </p>
                      <p className="text-xs text-[#4a4a58] mt-1">{r.reason}</p>
                      {r.reviewNote && (
                        <p className="text-xs text-[#3a3a48] mt-1 flex items-center gap-1">
                          <MessageSquare size={10} /> {r.reviewNote}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                    <div className={clsx('inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border', s.bg, s.color)}>
                      <SIcon size={10} /> {s.label}
                    </div>
                    {r.status === 'PENDING' && (
                      <button
                        onClick={() => { setReviewId(isOpen ? null : r.id); setNote(''); }}
                        className="text-xs text-[#4a4a58] bg-[#131316] border border-[#1e1e22] px-3 py-1.5 rounded-lg hover:text-[#9898a5] hover:border-[#2a2a32] transition-colors"
                      >
                        {isOpen ? 'Cancel' : 'Review'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Inline review form */}
                {isOpen && r.status === 'PENDING' && (
                  <div className="border-t border-[#1e1e22] px-4 pb-4 pt-3 space-y-3">
                    <textarea
                      value={reviewNote}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Add a note (required for rejection)…"
                      rows={2}
                      className="w-full bg-[#131316] border border-[#1e1e22] rounded-xl px-3 py-2.5 text-sm text-[#f2f2f5] placeholder:text-[#3a3a48] outline-none focus:border-amber-500/40 resize-none transition-colors"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleReview(r.id, 'reject')}
                        disabled={reviewing}
                        className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 disabled:opacity-50 transition-colors"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => handleReview(r.id, 'approve')}
                        disabled={reviewing}
                        className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-lime-400/10 border border-lime-400/20 text-lime-400 hover:bg-lime-400/20 disabled:opacity-50 transition-colors"
                      >
                        {reviewing ? 'Processing…' : 'Approve ✓'}
                      </button>
                    </div>
                  </div>
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

function dayDiff(from: string, to: string) {
  return Math.max(1, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86400000));
}
