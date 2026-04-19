'use client';

import { useEffect, useState } from 'react';
import { ticketApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { useRouter } from 'next/navigation';
import { Plus, MessageSquare, ChevronRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';

const PRIORITY_COLORS = {
  low: 'text-green-400 bg-green-500/10 border-green-500/20',
  medium: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  high: 'text-red-400 bg-red-500/10 border-red-500/20',
};

export default function SupportPage() {
  const { isAuthenticated } = useAuthStore();
  const router = useRouter();
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ subject: '', message: '', priority: 'medium' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) { router.push('/customer/login'); return; }
    ticketApi.getMyTickets()
      .then((res) => setTickets(res.data.data))
      .finally(() => setLoading(false));
  }, [isAuthenticated, router]);

  const handleSubmit = async () => {
    if (!form.subject || !form.message) { toast.error('Fill all fields'); return; }
    setSubmitting(true);
    try {
      const res = await ticketApi.create(form);
      setTickets((prev) => [res.data.data, ...prev]);
      setShowForm(false);
      setForm({ subject: '', message: '', priority: 'medium' });
      toast.success('Ticket submitted!');
    } catch {
      toast.error('Failed to submit ticket');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isAuthenticated) return null;

  return (
    <div className="pt-5">
      <div className="flex items-center justify-between mb-5">
        <h1 className="font-display font-bold text-2xl text-[#f5d38e]">Support</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="btn-press flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-xl font-semibold text-sm shadow-md shadow-amber-400/30"
        >
          <Plus size={15} /> New Ticket
        </button>
      </div>

      {showForm && (
        <div className="mb-5 bg-[#2d1e0f] rounded-2xl border border-[#3d2a15] p-5 animate-slide-up shadow-md">
          <h2 className="font-display font-bold text-[#f5d38e] mb-4">New Support Ticket</h2>
          <div className="space-y-3">
            <input
              className="input-glow w-full px-4 py-3 rounded-xl border border-[#3d2a15] bg-[#1a1208] text-[#f5d38e] text-sm placeholder:text-[#7a6040]"
              placeholder="Subject"
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
            />
            <div className="flex gap-2">
              {(['low', 'medium', 'high'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setForm({ ...form, priority: p })}
                  className={clsx(
                    'flex-1 py-2 rounded-xl text-xs font-bold capitalize border transition-all',
                    form.priority === p ? PRIORITY_COLORS[p] : 'text-[#7a6040] border-[#3d2a15] hover:border-[#4a3520]'
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
            <textarea
              className="input-glow w-full px-4 py-3 rounded-xl border border-[#3d2a15] bg-[#1a1208] text-[#f5d38e] text-sm placeholder:text-[#7a6040] resize-none"
              rows={3}
              placeholder="Describe your issue..."
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
            />
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="btn-press w-full py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-display font-bold text-sm disabled:opacity-60"
            >
              {submitting ? 'Submitting...' : 'Submit Ticket'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="skeleton h-20 rounded-2xl" />
          ))}
        </div>
      ) : tickets.length === 0 ? (
        <div className="text-center py-16">
          <MessageSquare size={40} className="mx-auto text-[#7a6040] mb-3" />
          <p className="font-display font-semibold text-[#f5d38e]">No tickets yet</p>
          <p className="text-[#7a6040] text-sm mt-1">Need help? Open a support ticket.</p>
        </div>
      ) : (
        <div className="space-y-3 stagger-children">
          {tickets.map((ticket) => (
            <div
              key={ticket.id}
              className="card-lift flex items-center gap-4 bg-[#2d1e0f] rounded-2xl border border-[#3d2a15] p-4 animate-slide-up"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-display font-semibold text-[#f5d38e] text-sm">{ticket.subject}</span>
                  <span className={clsx('text-[10px] px-2 py-0.5 rounded-full border font-bold capitalize', PRIORITY_COLORS[ticket.priority as keyof typeof PRIORITY_COLORS])}>
                    {ticket.priority}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-[#7a6040]">
                  <span className="capitalize">{ticket.status.replace('_', ' ')}</span>
                  <span>·</span>
                  <span>{formatDistanceToNow(new Date(ticket.createdAt), { addSuffix: true })}</span>
                </div>
              </div>
              <ChevronRight size={16} className="text-[#7a6040]" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
