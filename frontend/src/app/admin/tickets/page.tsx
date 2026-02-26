'use client';

import { useEffect, useState } from 'react';
import { adminApi, ticketApi } from '@/lib/api';
import { formatDistanceToNow } from 'date-fns';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { MessageSquare, Send, ChevronDown, ChevronUp } from 'lucide-react';

interface TicketMessage {
  id: string;
  message: string;
  senderRole: string;
  createdAt: string;
}

interface Ticket {
  id: string;
  subject: string;
  priority: 'low' | 'medium' | 'high';
  status: string;
  createdAt: string;
  customer: { name: string; mobile?: string };
  messages?: TicketMessage[];
}

const PRIORITY_STYLES = {
  low:    'text-emerald-400 bg-emerald-500/12 border-emerald-500/20',
  medium: 'text-amber-400   bg-amber-500/12   border-amber-500/20',
  high:   'text-red-400     bg-red-500/12     border-red-500/20',
};

const STATUS_OPTS = ['open', 'in_progress', 'resolved', 'closed'];

export default function AdminTicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [fullTicket, setFullTicket] = useState<Record<string, Ticket>>({});
  const [replyText, setReplyText] = useState('');
  const [replying, setReplying] = useState(false);

  useEffect(() => {
    ticketApi.getAll()
      .then((res) => setTickets(res.data.data))
      .finally(() => setLoading(false));
  }, []);

  const toggleExpand = async (ticket: Ticket) => {
    if (expanded === ticket.id) { setExpanded(null); return; }
    setExpanded(ticket.id);
    if (!fullTicket[ticket.id]) {
      const res = await ticketApi.get(ticket.id);
      setFullTicket((prev) => ({ ...prev, [ticket.id]: res.data.data }));
    }
  };

  const handleReply = async (ticketId: string) => {
    if (!replyText.trim()) return;
    setReplying(true);
    try {
      await ticketApi.reply(ticketId, replyText.trim());
      toast.success('Reply sent + WhatsApp notification fired');
      const res = await ticketApi.get(ticketId);
      setFullTicket((prev) => ({ ...prev, [ticketId]: res.data.data }));
      setReplyText('');
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Failed to send reply');
    } finally {
      setReplying(false);
    }
  };

  const handleStatusChange = async (ticketId: string, status: string) => {
    try {
      await ticketApi.setStatus(ticketId, status);
      setTickets((prev) =>
        prev.map((t) => (t.id === ticketId ? { ...t, status } : t))
      );
      toast.success('Status updated');
    } catch {
      toast.error('Failed to update status');
    }
  };

  const openCount = tickets.filter((t) => ['open', 'in_progress'].includes(t.status)).length;

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="font-display font-bold text-2xl text-[#f2f2f5]">Support Tickets</h1>
        <p className="text-[#4a4a58] text-sm mt-0.5">
          {openCount > 0 ? (
            <span className="text-amber-400 font-semibold">{openCount} open</span>
          ) : 'All clear'}{' '}
          · {tickets.length} total
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-20 rounded-2xl" />)}
        </div>
      ) : tickets.length === 0 ? (
        <div className="py-20 text-center">
          <MessageSquare size={36} className="mx-auto mb-3 text-[#2e2e38]" />
          <p className="text-[#3a3a48]">No tickets yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map((ticket) => {
            const isOpen = expanded === ticket.id;
            const ft = fullTicket[ticket.id];
            return (
              <div
                key={ticket.id}
                className="bg-[#0f0f11] rounded-2xl border border-[#222228] overflow-hidden"
              >
                {/* Header row */}
                <div
                  className="flex items-center gap-4 p-4 cursor-pointer hover:bg-[#111113] transition-colors"
                  onClick={() => toggleExpand(ticket)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-display font-semibold text-[#d4d4dc] text-sm">{ticket.subject}</span>
                      <span className={clsx('text-[10px] px-2 py-0.5 rounded-full border font-bold capitalize', PRIORITY_STYLES[ticket.priority])}>
                        {ticket.priority}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-[#4a4a58]">
                      <span>{ticket.customer.name}</span>
                      {ticket.customer.mobile && <><span>·</span><span>{ticket.customer.mobile}</span></>}
                      <span>·</span>
                      <span>{formatDistanceToNow(new Date(ticket.createdAt), { addSuffix: true })}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      className="text-xs px-2.5 py-1.5 rounded-lg bg-[#1a1a1e] border border-[#2a2a30] text-[#9898a5] outline-none cursor-pointer"
                      value={ticket.status}
                      onChange={(e) => { e.stopPropagation(); handleStatusChange(ticket.id, e.target.value); }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {STATUS_OPTS.map((s) => (
                        <option key={s} value={s}>{s.replace('_', ' ')}</option>
                      ))}
                    </select>
                    {isOpen ? <ChevronUp size={16} className="text-[#4a4a58]" /> : <ChevronDown size={16} className="text-[#4a4a58]" />}
                  </div>
                </div>

                {/* Expanded thread */}
                {isOpen && (
                  <div className="border-t border-[#1e1e22] p-4 animate-fade-in">
                    {/* Messages */}
                    <div className="space-y-3 mb-4 max-h-80 overflow-y-auto pr-1">
                      {ft?.messages?.map((msg) => (
                        <div
                          key={msg.id}
                          className={clsx(
                            'max-w-[85%] rounded-2xl p-3 text-sm leading-relaxed',
                            msg.senderRole === 'admin'
                              ? 'ml-auto bg-amber-500/15 text-amber-100 rounded-br-sm'
                              : 'bg-[#1a1a1e] text-[#d4d4dc] rounded-bl-sm'
                          )}
                        >
                          <div className="text-[10px] font-bold mb-1 opacity-50 uppercase tracking-wide">
                            {msg.senderRole === 'admin' ? '🛡 Admin' : '👤 Customer'}
                          </div>
                          {msg.message}
                          <div className="text-[10px] opacity-40 mt-1.5 text-right">
                            {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Reply box */}
                    {ticket.status !== 'closed' && (
                      <div className="flex gap-2">
                        <textarea
                          className="flex-1 px-4 py-3 rounded-xl bg-[#111113] border border-[#222228] text-[#f2f2f5] text-sm placeholder:text-[#3a3a48] outline-none focus:border-amber-500/40 resize-none"
                          rows={2}
                          placeholder="Type a reply... (WhatsApp notification fires automatically)"
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleReply(ticket.id);
                          }}
                        />
                        <button
                          onClick={() => handleReply(ticket.id)}
                          disabled={!replyText.trim() || replying}
                          className="btn-press flex-shrink-0 w-10 h-full flex items-center justify-center rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white transition-colors"
                        >
                          <Send size={15} />
                        </button>
                      </div>
                    )}
                    {ticket.status === 'closed' && (
                      <p className="text-center text-[#3a3a48] text-xs py-2">This ticket is closed</p>
                    )}
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
