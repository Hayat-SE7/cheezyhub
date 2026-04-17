'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp, ShoppingBag, DollarSign, XCircle,
  BarChart2, Download, RefreshCw, Users,
  Package, Clock, CreditCard, ChevronUp, ChevronDown,
} from 'lucide-react';
import { analyticsApi } from '@/lib/api';
import { DualLineChart, HorizontalBar, DonutChart, HourHeatmap, ChangeBadge } from '@/components/admin/Charts';
import toast from 'react-hot-toast';

// ─── Types ────────────────────────────────────────────
interface DailyStat    { date: string; revenue: number; orders: number; cancelled: number }
interface HourlyStat   { hour: number; orders: number }
interface TopItem      { name: string; quantity: number; revenue: number }
interface TypeBreakdown { type: string; count: number; revenue: number }
interface PayBreakdown  { method: string; count: number; revenue: number }
interface DriverStat   {
  id: string; username: string;
  totalDeliveries: number; todayDeliveries: number;
  codPending: number; status: string; verified: boolean;
}

interface AnalyticsData {
  range: number;
  summary: {
    totalRevenue: number; totalOrders: number;
    avgOrderValue: number; cancellationRate: number; completedOrders: number;
  };
  comparison: {
    revenue: number; orders: number;
    revenueChange: number | null; ordersChange: number | null;
  };
  daily: DailyStat[];
  hourly: HourlyStat[];
  topItems: TopItem[];
  orderTypeBreakdown: TypeBreakdown[];
  paymentMethodBreakdown: PayBreakdown[];
  driverPerformance: DriverStat[];
}

// ─── Constants ────────────────────────────────────────
const RANGES: { label: string; value: 7 | 30 | 90 }[] = [
  { label: '7 days',  value: 7  },
  { label: '30 days', value: 30 },
  { label: '90 days', value: 90 },
];

const TYPE_COLORS: Record<string, string> = {
  delivery: '#f59e0b',
  pickup:   '#8b5cf6',
  dine_in:  '#10b981',
  counter:  '#3b82f6',
};

const PM_COLORS: Record<string, string> = {
  cash:    '#10b981',
  card:    '#3b82f6',
  safepay: '#8b5cf6',
  split:   '#f59e0b',
};

const TYPE_LABEL: Record<string, string> = {
  delivery: 'Delivery',
  pickup:   'Pickup',
  dine_in:  'Dine-in',
  counter:  'Counter',
};

const PM_LABEL: Record<string, string> = {
  cash:    'Cash',
  card:    'Card',
  safepay: 'Safepay',
  split:   'Split',
};

const STATUS_COLOR: Record<string, string> = {
  AVAILABLE:   '#10b981',
  ON_DELIVERY: '#f59e0b',
  OFFLINE:     '#4a4a58',
};

// ─── Helpers ─────────────────────────────────────────
const fmt = (n: number) =>
  n >= 1000 ? `Rs. ${(n / 1000).toFixed(1)}k` : `Rs. ${n.toFixed(0)}`;
const fmtFull = (n: number) =>
  `Rs. ${n.toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const shortDate = (iso: string) => {
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1}`;
};

// ─── KPI Card ─────────────────────────────────────────
function KpiCard({
  icon: Icon, label, value, sub, change, iconColor,
}: {
  icon: any; label: string; value: string; sub?: string;
  change?: number | null; iconColor: string;
}) {
  return (
    <div className="glass-dark rounded-2xl border border-white/6 p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center`} style={{ background: `${iconColor}20` }}>
          <Icon size={16} style={{ color: iconColor }} />
        </div>
        {change !== undefined && <ChangeBadge pct={change ?? null} />}
      </div>
      <div>
        <p className="text-2xl font-bold text-white tracking-tight">{value}</p>
        <p className="text-[12px] text-[#6b6b78] mt-0.5">{label}</p>
        {sub && <p className="text-[11px] text-[#4a4a58] mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Section Card ─────────────────────────────────────
function Section({ title, icon: Icon, children, action }: {
  title: string; icon: any; children: React.ReactNode; action?: React.ReactNode;
}) {
  return (
    <div className="glass-dark rounded-2xl border border-white/6 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Icon size={14} className="text-amber-400/70" />
          <h3 className="text-[13px] font-semibold text-white/80">{title}</h3>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
//  MAIN PAGE
// ═══════════════════════════════════════════════════════
export default function AnalyticsPage() {
  const [range, setRange]   = useState<7 | 30 | 90>(7);
  const [itemMode, setItemMode] = useState<'revenue' | 'quantity'>('revenue');
  const [exporting, setExporting] = useState(false);

  const { data, isLoading: loading, refetch } = useQuery<AnalyticsData>({
    queryKey: ['analytics', range],
    queryFn: async () => {
      try {
        const res = await analyticsApi.getDashboard(String(range));
        return res.data.data;
      } catch (err) {
        toast.error('Failed to load analytics');
        throw err;
      }
    },
  });
  const load = () => { refetch(); };

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await analyticsApi.exportCsv(String(range));
      const url = URL.createObjectURL(res.data as Blob);
      const a   = document.createElement('a');
      a.href     = url;
      a.download = `analytics-${range}d.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('CSV downloaded');
    } catch {
      toast.error('Export failed');
    } finally {
      setExporting(false);
    }
  };

  // ── Chart data transforms ──────────────────────────
  const dualData = (data?.daily ?? []).map(d => ({
    label: shortDate(d.date),
    primary: d.revenue,
    secondary: d.orders,
  }));

  const topItemsData = (data?.topItems ?? []).map(i => ({
    label: i.name,
    value: itemMode === 'revenue' ? i.revenue : i.quantity,
  }));

  const typeDonut = (data?.orderTypeBreakdown ?? []).map(t => ({
    label: TYPE_LABEL[t.type] ?? t.type,
    value: t.count,
    color: TYPE_COLORS[t.type] ?? '#6b6b78',
  }));

  const pmDonut = (data?.paymentMethodBreakdown ?? []).map(p => ({
    label: PM_LABEL[p.method] ?? p.method,
    value: p.count,
    color: PM_COLORS[p.method] ?? '#6b6b78',
  }));

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">

      {/* ── Header ─────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Analytics</h1>
          <p className="text-[13px] text-[#6b6b78] mt-0.5">Revenue, orders, items & driver performance</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Range selector */}
          <div className="flex items-center bg-[#111115] border border-white/8 rounded-xl p-1 gap-1">
            {RANGES.map(r => (
              <button
                key={r.value}
                onClick={() => setRange(r.value)}
                className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all ${
                  range === r.value
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'text-white/40 hover:text-white/70'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          {/* Refresh */}
          <button
            onClick={load}
            disabled={loading}
            className="w-9 h-9 rounded-xl glass-dark border border-white/8 flex items-center justify-center text-white/50 hover:text-white/80 transition-colors disabled:opacity-40"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>

          {/* Export */}
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[12px] font-semibold hover:bg-amber-500/20 transition-all disabled:opacity-50"
          >
            <Download size={13} />
            Export CSV
          </button>
        </div>
      </div>

      {/* ── Loading skeleton ───────────────────────── */}
      {loading && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 glass-dark rounded-2xl border border-white/6 animate-pulse" />
          ))}
        </div>
      )}

      {data && (
        <>
          {/* ── KPI Cards ──────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard
              icon={DollarSign}
              label="Total Revenue"
              value={fmt(data.summary.totalRevenue)}
              sub={fmtFull(data.summary.totalRevenue)}
              change={data.comparison.revenueChange}
              iconColor="#f59e0b"
            />
            <KpiCard
              icon={ShoppingBag}
              label="Completed Orders"
              value={data.summary.completedOrders.toString()}
              sub={`${data.summary.totalOrders} placed total`}
              change={data.comparison.ordersChange}
              iconColor="#3b82f6"
            />
            <KpiCard
              icon={TrendingUp}
              label="Avg Order Value"
              value={fmt(data.summary.avgOrderValue)}
              iconColor="#10b981"
            />
            <KpiCard
              icon={XCircle}
              label="Cancellation Rate"
              value={`${data.summary.cancellationRate}%`}
              iconColor={data.summary.cancellationRate > 10 ? '#ef4444' : '#6b6b78'}
            />
          </div>

          {/* ── Revenue + Orders Chart ─────────────── */}
          <Section title={`Revenue & Orders — last ${range} days`} icon={TrendingUp}>
            <div className="flex items-center gap-4 mb-3 text-[11px]">
              <span className="flex items-center gap-1.5">
                <span className="w-6 h-0.5 bg-amber-400 inline-block rounded" />
                <span className="text-[#9898a5]">Revenue</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-6 h-0.5 bg-blue-400 inline-block rounded border-dashed border-t-2 border-blue-400" style={{ background: 'none', borderTop: '2px dashed #3b82f6' }} />
                <span className="text-[#9898a5]">Orders</span>
              </span>
              <span className="ml-auto text-[#4a4a58]">
                Prev period: {fmtFull(data.comparison.revenue)} · {data.comparison.orders} orders
              </span>
            </div>
            <DualLineChart
              data={dualData}
              primaryColor="#f59e0b"
              secondaryColor="#3b82f6"
              height={160}
              formatPrimary={fmtFull}
              formatSecondary={(v) => `${v} orders`}
            />
          </Section>

          {/* ── Two-col row: Order Types + Payment Methods ── */}
          <div className="grid lg:grid-cols-2 gap-4">
            <Section title="Order Type Breakdown" icon={Package}>
              <DonutChart
                data={typeDonut}
                size={120}
                thickness={22}
                formatValue={(v) => `${v} orders`}
              />
              {/* Revenue by type */}
              <div className="mt-4 space-y-1.5">
                {data.orderTypeBreakdown
                  .sort((a, b) => b.revenue - a.revenue)
                  .map(t => (
                    <div key={t.type} className="flex items-center justify-between text-[12px]">
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-sm" style={{ background: TYPE_COLORS[t.type] ?? '#6b6b78' }} />
                        <span className="text-[#9898a5]">{TYPE_LABEL[t.type] ?? t.type}</span>
                      </span>
                      <span className="font-mono text-white/60">{fmtFull(t.revenue)}</span>
                    </div>
                  ))}
              </div>
            </Section>

            <Section title="Payment Methods" icon={CreditCard}>
              <DonutChart
                data={pmDonut}
                size={120}
                thickness={22}
                formatValue={(v) => `${v} orders`}
              />
              <div className="mt-4 space-y-1.5">
                {data.paymentMethodBreakdown
                  .sort((a, b) => b.revenue - a.revenue)
                  .map(p => (
                    <div key={p.method} className="flex items-center justify-between text-[12px]">
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-sm" style={{ background: PM_COLORS[p.method] ?? '#6b6b78' }} />
                        <span className="text-[#9898a5]">{PM_LABEL[p.method] ?? p.method}</span>
                      </span>
                      <span className="font-mono text-white/60">{fmtFull(p.revenue)}</span>
                    </div>
                  ))}
              </div>
            </Section>
          </div>

          {/* ── Peak Hours ─────────────────────────── */}
          <Section title="Peak Hours" icon={Clock}
            action={<span className="text-[11px] text-[#4a4a58]">hover cells for detail</span>}
          >
            <HourHeatmap data={data.hourly} />
            {/* Quick peak summary */}
            {data.hourly.length > 0 && (() => {
              const peak = data.hourly.reduce((a, b) => a.orders >= b.orders ? a : b);
              return (
                <p className="mt-2 text-[11px] text-[#6b6b78]">
                  Busiest hour: <span className="text-amber-400 font-semibold">{peak.hour}:00 — {peak.hour + 1}:00</span>
                  {' '}with <span className="text-white/70">{peak.orders} orders</span>
                </p>
              );
            })()}
          </Section>

          {/* ── Top Items ──────────────────────────── */}
          <Section
            title="Top Menu Items"
            icon={BarChart2}
            action={
              <div className="flex items-center bg-[#111115] border border-white/8 rounded-lg p-0.5 gap-0.5">
                {(['revenue', 'quantity'] as const).map(m => (
                  <button
                    key={m}
                    onClick={() => setItemMode(m)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                      itemMode === m
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'text-white/30 hover:text-white/60'
                    }`}
                  >
                    By {m}
                  </button>
                ))}
              </div>
            }
          >
            <HorizontalBar
              data={topItemsData}
              color="#f59e0b"
              formatValue={itemMode === 'revenue' ? fmtFull : (v) => `×${v}`}
              maxBars={8}
            />
          </Section>

          {/* ── Driver Performance ─────────────────── */}
          <Section title="Driver Performance" icon={Users}>
            {data.driverPerformance.length === 0 ? (
              <p className="text-[13px] text-[#4a4a58] text-center py-6">No drivers yet</p>
            ) : (
              <div className="overflow-x-auto -mx-1">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="border-b border-white/6">
                      <th className="text-left text-[#6b6b78] font-medium pb-2 pr-4">Driver</th>
                      <th className="text-center text-[#6b6b78] font-medium pb-2 pr-4">Status</th>
                      <th className="text-right text-[#6b6b78] font-medium pb-2 pr-4">Today</th>
                      <th className="text-right text-[#6b6b78] font-medium pb-2 pr-4">Total</th>
                      <th className="text-right text-[#6b6b78] font-medium pb-2">COD Pending</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.driverPerformance.map((d, i) => (
                      <tr key={d.id} className={`border-b border-white/4 ${i % 2 === 0 ? '' : 'bg-white/2'}`}>
                        <td className="py-2.5 pr-4">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-white/8 flex items-center justify-center text-[10px] font-bold text-white/50">
                              {d.username[0].toUpperCase()}
                            </div>
                            <span className="text-white/80 font-medium">{d.username}</span>
                            {!d.verified && (
                              <span className="text-[10px] text-amber-400/70 bg-amber-400/10 px-1.5 py-0.5 rounded">unverified</span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 pr-4 text-center">
                          <span
                            className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                            style={{
                              color: STATUS_COLOR[d.status] ?? '#6b6b78',
                              background: `${STATUS_COLOR[d.status] ?? '#6b6b78'}18`,
                            }}
                          >
                            {d.status}
                          </span>
                        </td>
                        <td className="py-2.5 pr-4 text-right font-mono text-white/60">{d.todayDeliveries}</td>
                        <td className="py-2.5 pr-4 text-right font-mono text-white/60">{d.totalDeliveries}</td>
                        <td className="py-2.5 text-right">
                          <span className={`font-mono font-bold ${d.codPending > 0 ? 'text-amber-400' : 'text-white/30'}`}>
                            {d.codPending > 0 ? fmtFull(d.codPending) : '—'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

        </>
      )}
    </div>
  );
}