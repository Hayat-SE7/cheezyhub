'use client';

import { useEffect, useState } from 'react';
import { adminApi, analyticsApi } from '@/lib/api';
import { useSSE } from '@/hooks/useSSE';
import { BarChart, LineChart, HorizontalBar, HourHeatmap } from '@/components/admin/Charts';
import {
  ShoppingBag, TrendingUp, Clock, AlertCircle,
  BarChart3, ChevronRight, Package
} from 'lucide-react';
import Link from 'next/link';

interface Stats {
  totalOrders: number;
  todayOrders: number;
  activeOrders: number;
  pendingOrders: number;
  totalRevenue: number;
  openTickets: number;
}

interface Analytics {
  daily:    { date: string; orders: number; revenue: number }[];
  hourly:   { hour: number; orders: number }[];
  topItems: { name: string; quantity: number; revenue: number }[];
}

function StatCard({
  icon: Icon, label, value, sub, color, trend
}: {
  icon: any; label: string; value: string | number; sub?: string; color: string; trend?: string;
}) {
  return (
    <div className="rounded-2xl bg-[#111113] border border-[#222228] p-5 hover:border-[#2e2e35] transition-colors">
      <div className="flex items-start justify-between mb-4">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: color + '20' }}>
          <Icon size={17} style={{ color }} />
        </div>
        {trend && (
          <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
            {trend}
          </span>
        )}
      </div>
      <div className="font-display font-black text-2xl text-[#f2f2f5]">{value}</div>
      <div className="text-[#6a6a78] text-xs mt-0.5">{label}</div>
      {sub && <div className="text-[#3a3a48] text-[10px] mt-0.5">{sub}</div>}
    </div>
  );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-[#111113] border border-[#222228] p-5">
      <div className="mb-4">
        <h3 className="font-display font-bold text-[#f2f2f5] text-sm">{title}</h3>
        {subtitle && <p className="text-[#4a4a58] text-xs mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

const fmtRevenue = (v: number) => `$${v.toFixed(0)}`;
const fmtDate   = (s: string) => { const d = new Date(s); return `${d.getMonth()+1}/${d.getDate()}`; };

export default function AdminDashboard() {
  const [stats,     setStats]     = useState<Stats | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [tab, setTab]             = useState<'orders' | 'revenue'>('orders');

  const fetchStats     = () => adminApi.getStats().then((r) => setStats(r.data.data));
  const fetchAnalytics = () => analyticsApi.getDashboard().then((r) => setAnalytics(r.data.data));

  useEffect(() => {
    fetchStats();
    fetchAnalytics();
  }, []);

  useSSE({
    onEvent: {
      ORDER_CREATED: () => { fetchStats(); fetchAnalytics(); },
      ORDER_UPDATED: () => { fetchStats(); fetchAnalytics(); },
    },
  });

  // Build daily chart data
  const dailyChartData = analytics?.daily.map((d) => ({
    label: fmtDate(d.date),
    value: tab === 'orders' ? d.orders : d.revenue,
  })) ?? [];

  // Build top items data
  const topItemsData = (analytics?.topItems ?? []).map((i) => ({
    label: i.name.length > 15 ? i.name.slice(0, 15) + '…' : i.name,
    value: i.quantity,
  }));

  const navItems = [
    { href: '/admin/orders', label: 'Orders',  desc: 'Manage and assign deliveries', icon: ShoppingBag, color: '#f59e0b' },
    { href: '/admin/menu',   label: 'Menu',    desc: 'Items, images, availability',  icon: BarChart3,   color: '#3b82f6' },
    { href: '/admin/deals',  label: 'Deals',   desc: 'Promotions, combos, offers',   icon: Package,     color: '#10b981' },
    { href: '/admin/staff',  label: 'Staff',   desc: 'Kitchen and delivery team',    icon: AlertCircle, color: '#8b5cf6' },
    { href: '/admin/tickets',label: 'Support', desc: 'Reply to customer tickets',    icon: AlertCircle, color: '#ef4444' },
    { href: '/admin/settings',label:'Settings',desc: 'Fees, radius, restaurant info',icon: TrendingUp,  color: '#6b7280' },
  ];

  return (
    <div className="p-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-7">
        <div>
          <h1 className="font-display font-black text-3xl text-[#f2f2f5]">
            🧀 Dashboard
          </h1>
          <p className="text-[#4a4a58] text-sm mt-1">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        {stats?.activeOrders != null && stats.activeOrders > 0 && (
          <Link
            href="/admin/orders"
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm font-bold hover:bg-amber-500/15 transition-colors"
          >
            <span className="w-2 h-2 rounded-full bg-amber-400 pulse-dot" />
            {stats.activeOrders} active now
            <ChevronRight size={14} />
          </Link>
        )}
      </div>

      {/* Stats grid */}
      {stats ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <StatCard icon={ShoppingBag} label="Total Orders" value={stats.totalOrders.toLocaleString()} color="#f59e0b" />
          <StatCard icon={Clock}       label="Today"        value={stats.todayOrders}                  color="#3b82f6" sub="orders placed" />
          <StatCard icon={TrendingUp}  label="Revenue"      value={`$${(stats.totalRevenue).toLocaleString(undefined, { maximumFractionDigits: 0 })}`} color="#10b981" sub="all time" />
          <StatCard icon={AlertCircle} label="Open Tickets" value={stats.openTickets}                  color="#ef4444" />
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {[...Array(4)].map((_, i) => <div key={i} className="h-28 rounded-2xl skeleton" />)}
        </div>
      )}

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">

        {/* Orders / Revenue trend */}
        <div className="lg:col-span-2 rounded-2xl bg-[#111113] border border-[#222228] p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-display font-bold text-[#f2f2f5] text-sm">7-Day Trend</h3>
              <p className="text-[#4a4a58] text-xs mt-0.5">Last week performance</p>
            </div>
            <div className="flex gap-1.5 bg-[#0f0f11] rounded-xl p-1">
              {(['orders', 'revenue'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold capitalize transition-all ${
                    tab === t ? 'bg-amber-500 text-white' : 'text-[#4a4a58] hover:text-[#9898a5]'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          {analytics ? (
            <LineChart
              data={dailyChartData}
              color={tab === 'orders' ? '#f59e0b' : '#10b981'}
              formatValue={tab === 'revenue' ? fmtRevenue : String}
              height={160}
            />
          ) : (
            <div className="skeleton h-40 rounded-xl" />
          )}
        </div>

        {/* Top items */}
        <ChartCard title="Top Items" subtitle="By units sold">
          {analytics ? (
            <HorizontalBar
              data={topItemsData}
              color="#f59e0b"
              formatValue={(v) => `×${v}`}
              maxBars={6}
            />
          ) : (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => <div key={i} className="skeleton h-6 rounded-lg" />)}
            </div>
          )}
        </ChartCard>
      </div>

      {/* Peak hours */}
      <div className="rounded-2xl bg-[#111113] border border-[#222228] p-5 mb-6">
        <div className="mb-4">
          <h3 className="font-display font-bold text-[#f2f2f5] text-sm">Peak Hours</h3>
          <p className="text-[#4a4a58] text-xs mt-0.5">Order volume by hour (last 7 days)</p>
        </div>
        {analytics ? (
          <HourHeatmap data={analytics.hourly} />
        ) : (
          <div className="skeleton h-10 rounded-xl" />
        )}
        <div className="flex items-center gap-3 mt-3">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ background: 'rgba(245,158,11,0.15)' }} />
            <span className="text-[10px] text-[#4a4a58]">Low</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ background: 'rgba(245,158,11,0.7)' }} />
            <span className="text-[10px] text-[#4a4a58]">High</span>
          </div>
        </div>
      </div>

      {/* Nav links */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {navItems.map(({ href, label, desc, icon: Icon, color }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 p-4 rounded-2xl bg-[#111113] border border-[#222228] hover:border-[#3a3a40] hover:bg-[#1a1a1d] transition-all group"
          >
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors"
              style={{ background: color + '15' }}
            >
              <Icon size={16} style={{ color }} />
            </div>
            <div className="min-w-0">
              <div className="font-display font-bold text-[#f2f2f5] text-sm">{label}</div>
              <div className="text-[#4a4a58] text-[10px] mt-0.5 truncate">{desc}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
