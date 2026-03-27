'use client';

// ─────────────────────────────────────────────────────────────────
//  Charts.tsx  — CheezyHub admin chart components (Phase 12)
//
//  Exports:
//   BarChart        — vertical bar chart (recharts)
//   LineChart       — single-line chart (recharts)
//   DualLineChart   — two-series line chart (recharts)
//   HorizontalBar   — SVG horizontal bars
//   HourHeatmap     — 24-hour density heatmap (accepts HourlyStat[])
//   DonutChart      — SVG donut with legend
//   ChangeBadge     — ▲/▼ percentage badge (accepts value OR pct)
// ─────────────────────────────────────────────────────────────────

import {
  BarChart as ReBarChart,
  Bar,
  LineChart as ReLineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts';

const FONT  = { fill: '#9898a5', fontSize: 11 };
const GRID  = '#2a2a3a';


// ─────────────────────────────────────────────────────────────────
//  BarChart
// ─────────────────────────────────────────────────────────────────
interface BarChartProps {
  data:         { label: string; value: number }[];
  color?:       string;
  height?:      number;
  unit?:        string;
  formatValue?: (n: number) => string;
}

export function BarChart({ data, color = '#f59e0b', height = 220, unit = '', formatValue }: BarChartProps) {
  const mapped = data.map((d) => ({ name: d.label, v: d.value }));
  const fmt    = formatValue ?? ((v: number) => `${v}${unit}`);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ReBarChart data={mapped} barSize={28}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey="name" tick={FONT} axisLine={false} tickLine={false} />
        <YAxis tick={FONT} axisLine={false} tickLine={false} tickFormatter={fmt} />
        <Tooltip
          contentStyle={{ background: '#1a1a2e', border: `1px solid ${GRID}`, borderRadius: 8 }}
          labelStyle={{ color: '#e2e2e8' }}
          formatter={(v: any) => [fmt(v), 'Value']}
        />
        <Bar dataKey="v" fill={color} radius={[4, 4, 0, 0]} />
      </ReBarChart>
    </ResponsiveContainer>
  );
}


// ─────────────────────────────────────────────────────────────────
//  LineChart
// ─────────────────────────────────────────────────────────────────
interface LineChartProps {
  data:         { label: string; value: number }[];
  color?:       string;
  height?:      number;
  unit?:        string;
  formatValue?: (n: number) => string;
}

export function LineChart({ data, color = '#6366f1', height = 220, unit = '', formatValue }: LineChartProps) {
  const mapped = data.map((d) => ({ name: d.label, v: d.value }));
  const fmt    = formatValue ?? ((v: number) => `${v}${unit}`);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ReLineChart data={mapped}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
        <XAxis dataKey="name" tick={FONT} axisLine={false} tickLine={false} />
        <YAxis tick={FONT} axisLine={false} tickLine={false} tickFormatter={fmt} />
        <Tooltip
          contentStyle={{ background: '#1a1a2e', border: `1px solid ${GRID}`, borderRadius: 8 }}
          labelStyle={{ color: '#e2e2e8' }}
          formatter={(v: any) => [fmt(v), 'Value']}
        />
        <Line dataKey="v" stroke={color} strokeWidth={2} dot={{ r: 3, fill: color }} />
      </ReLineChart>
    </ResponsiveContainer>
  );
}


// ─────────────────────────────────────────────────────────────────
//  DualLineChart
//  Analytics page passes: formatPrimary, formatSecondary
// ─────────────────────────────────────────────────────────────────
interface DualLineChartProps {
  data:             { label: string; primary: number; secondary: number }[];
  primaryColor?:    string;
  secondaryColor?:  string;
  primaryName?:     string;
  secondaryName?:   string;
  height?:          number;
  unit?:            string;
  formatPrimary?:   (n: number) => string;
  formatSecondary?: (n: number) => string;
}

export function DualLineChart({
  data,
  primaryColor    = '#f59e0b',
  secondaryColor  = '#3b82f6',
  primaryName     = 'Primary',
  secondaryName   = 'Secondary',
  height          = 240,
  unit            = '',
  formatPrimary,
  formatSecondary,
}: DualLineChartProps) {
  const mapped = data.map((d) => ({ name: d.label, p: d.primary, s: d.secondary }));
  const fmtP   = formatPrimary   ?? ((v: number) => `${v}${unit}`);
  const fmtS   = formatSecondary ?? ((v: number) => `${v}${unit}`);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ReLineChart data={mapped}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
        <XAxis dataKey="name" tick={FONT} axisLine={false} tickLine={false} />
        <YAxis yAxisId="p" orientation="left"  tick={FONT} axisLine={false} tickLine={false} tickFormatter={fmtP} />
        <YAxis yAxisId="s" orientation="right" tick={FONT} axisLine={false} tickLine={false} tickFormatter={fmtS} />
        <Tooltip
          contentStyle={{ background: '#1a1a2e', border: `1px solid ${GRID}`, borderRadius: 8 }}
          labelStyle={{ color: '#e2e2e8' }}
          formatter={(v: any, key: string) =>
            key === 'p' ? [fmtP(v), primaryName] : [fmtS(v), secondaryName]
          }
        />
        <Legend
          wrapperStyle={{ fontSize: 11, color: '#9898a5' }}
          formatter={(val) => (val === 'p' ? primaryName : secondaryName)}
        />
        <Line yAxisId="p" dataKey="p" stroke={primaryColor}   strokeWidth={2}
          dot={{ r: 3, fill: primaryColor }}   name="p" />
        <Line yAxisId="s" dataKey="s" stroke={secondaryColor} strokeWidth={2}
          dot={{ r: 3, fill: secondaryColor }} name="s" strokeDasharray="5 3" />
      </ReLineChart>
    </ResponsiveContainer>
  );
}


// ─────────────────────────────────────────────────────────────────
//  HorizontalBar
//  Analytics page passes: color (single string), formatValue, maxBars
// ─────────────────────────────────────────────────────────────────
interface HBarItem { label: string; value: number; color?: string }

interface HorizontalBarProps {
  data:         HBarItem[];
  color?:       string;          // single fallback colour
  unit?:        string;
  maxValue?:    number;
  maxBars?:     number;
  height?:      number;
  formatValue?: (n: number) => string;
}

export function HorizontalBar({
  data,
  color     = '#6366f1',
  unit      = '',
  maxValue,
  maxBars,
  height    = 28,
  formatValue,
}: HorizontalBarProps) {
  const sliced = maxBars ? data.slice(0, maxBars) : data;
  const max    = maxValue ?? Math.max(...sliced.map((d) => d.value), 1);
  const fmt    = formatValue ?? ((v: number) => `${v}${unit}`);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {sliced.map((item) => (
        <div key={item.label}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 12, color: '#c8c8d8' }}>{item.label}</span>
            <span style={{ fontSize: 12, color: '#9898a5' }}>{fmt(item.value)}</span>
          </div>
          <div style={{ background: '#1e1e2e', borderRadius: 6, height, overflow: 'hidden' }}>
            <div
              style={{
                width:        `${Math.min((item.value / max) * 100, 100)}%`,
                height:       '100%',
                background:   item.color ?? color,
                borderRadius: 6,
                transition:   'width 0.4s ease',
                minWidth:     item.value > 0 ? 4 : 0,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────
//  HourHeatmap
//
//  Accepts TWO data shapes:
//   A) number[][]    — data[day][hour] = count  (classic 7×24 grid)
//   B) HourlyStat[]  — { hour: number; orders: number }[]
//      (what the analytics backend returns — 1-D, no day dimension)
// ─────────────────────────────────────────────────────────────────
interface HourlyStat { hour: number; orders: number }
type HeatmapData = number[][] | HourlyStat[];

interface HourHeatmapProps {
  data:      HeatmapData;
  maxValue?: number;
  color?:    string;
}

const HOUR_LABELS = Array.from({ length: 24 }, (_, i) =>
  i === 0 ? '12a' : i < 12 ? `${i}a` : i === 12 ? '12p' : `${i - 12}p`
);
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function HourHeatmap({ data, maxValue, color = '#f59e0b' }: HourHeatmapProps) {
  // normalise to number[][]
  let grid: number[][];

  if (!data || (data as any[]).length === 0) {
    grid = [Array(24).fill(0)];
  } else if (Array.isArray(data[0])) {
    grid = data as number[][];
  } else {
    // HourlyStat[] → single row
    const row = Array(24).fill(0);
    (data as HourlyStat[]).forEach(({ hour, orders }) => {
      if (hour >= 0 && hour < 24) row[hour] = orders;
    });
    grid = [row];
  }

  const max     = maxValue ?? Math.max(...grid.flat(), 1);
  const CELL    = 22;
  const GAP     = 2;
  const showDay = grid.length > 1;
  const LEFT    = showDay ? 30 : 0;
  const TOP     = 20;
  const w       = LEFT + 24 * (CELL + GAP);
  const h       = TOP  + grid.length * (CELL + GAP);

  const safeHex = /^#[0-9a-fA-F]{6}$/.test(color) ? color : '#f59e0b';
  const rr      = parseInt(safeHex.slice(1, 3), 16);
  const gg      = parseInt(safeHex.slice(3, 5), 16);
  const bb      = parseInt(safeHex.slice(5, 7), 16);

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg width={w} height={h} style={{ display: 'block' }}>
        {HOUR_LABELS.map((lbl, hi) => (
          <text key={hi}
            x={LEFT + hi * (CELL + GAP) + CELL / 2} y={12}
            textAnchor="middle" fontSize={8} fill="#6b7280">
            {hi % 3 === 0 ? lbl : ''}
          </text>
        ))}

        {grid.map((row, di) => (
          <g key={di}>
            {showDay && (
              <text
                x={LEFT - 4}
                y={TOP + di * (CELL + GAP) + CELL / 2 + 4}
                textAnchor="end" fontSize={9} fill="#6b7280"
              >
                {DAY_LABELS[di] ?? `D${di + 1}`}
              </text>
            )}
            {Array.from({ length: 24 }, (_, hi) => {
              const val   = row[hi] ?? 0;
              const alpha = max > 0 ? (val / max) * 0.85 + (val > 0 ? 0.1 : 0) : 0;
              return (
                <rect key={hi}
                  x={LEFT + hi * (CELL + GAP)}
                  y={TOP  + di * (CELL + GAP)}
                  width={CELL} height={CELL} rx={3}
                  fill={val === 0 ? '#1a1a2e' : `rgba(${rr},${gg},${bb},${alpha})`}
                >
                  <title>{HOUR_LABELS[hi]}: {val} orders</title>
                </rect>
              );
            })}
          </g>
        ))}
      </svg>
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────
//  DonutChart
//  Analytics page passes: formatValue
// ─────────────────────────────────────────────────────────────────
interface DonutSlice { label: string; value: number; color: string }

interface DonutChartProps {
  data:         DonutSlice[];
  size?:        number;
  thickness?:   number;
  unit?:        string;
  formatValue?: (v: number) => string;
}

export function DonutChart({ data, size = 160, thickness = 32, unit = '', formatValue }: DonutChartProps) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const fmt   = formatValue ?? ((v: number) => `${v}${unit}`);

  if (total === 0) return (
    <p style={{ color: '#6b7280', fontSize: 13, textAlign: 'center' }}>No data</p>
  );

  const cx   = size / 2;
  const cy   = size / 2;
  const rr   = (size - thickness) / 2;
  const circ = 2 * Math.PI * rr;
  let offset = 0;

  const slices = data.map((d) => {
    const dash  = (d.value / total) * circ;
    const gap   = circ - dash;
    const s     = { ...d, dash, gap, offset };
    offset += dash;
    return s;
  });

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
      <svg width={size} height={size} style={{ flexShrink: 0 }}>
        {slices.map((s, i) => (
          <circle key={i}
            cx={cx} cy={cy} r={rr}
            fill="none" stroke={s.color} strokeWidth={thickness}
            strokeDasharray={`${s.dash} ${s.gap}`}
            strokeDashoffset={-s.offset}
            transform={`rotate(-90 ${cx} ${cy})`}
            style={{ transition: 'stroke-dasharray 0.4s ease' }}
          >
            <title>{s.label}: {fmt(s.value)}</title>
          </circle>
        ))}
        <text x={cx} y={cy - 6}  textAnchor="middle" fontSize={18} fontWeight={700} fill="#e2e2e8">{total}</text>
        <text x={cx} y={cy + 14} textAnchor="middle" fontSize={10} fill="#6b7280">total</text>
      </svg>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 100 }}>
        {slices.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: '#c8c8d8' }}>
              {s.label}
              <span style={{ marginLeft: 6, color: '#6b7280' }}>
                {((s.value / total) * 100).toFixed(0)}%
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────
//  ChangeBadge
//  Accepts both `value` and `pct` (analytics page uses `pct`)
//  Also accepts null (analytics passes `change ?? null`)
// ─────────────────────────────────────────────────────────────────
interface ChangeBadgeProps {
  value?:     number | null;
  pct?:       number | null;
  precision?: number;
  className?: string;
}

export function ChangeBadge({ value, pct, precision = 1, className = '' }: ChangeBadgeProps) {
  const raw = value ?? pct;
  if (raw === null || raw === undefined) return null;
  const positive = raw >= 0;
  const abs      = Math.abs(raw).toFixed(precision);
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded-md ${
        positive ? 'text-emerald-400 bg-emerald-400/10' : 'text-red-400 bg-red-400/10'
      } ${className}`}
    >
      {positive ? '▲' : '▼'} {abs}%
    </span>
  );
}
