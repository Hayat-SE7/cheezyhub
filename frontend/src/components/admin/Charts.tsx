'use client';

// ─── Pure SVG Chart Components ────────────────────────
// No external chart library. Lightweight, beautiful.

interface BarChartProps {
  data: { label: string; value: number; secondary?: number }[];
  color?: string;
  secondaryColor?: string;
  height?: number;
  formatValue?: (v: number) => string;
}

export function BarChart({
  data,
  color = '#f59e0b',
  secondaryColor = '#3b82f6',
  height = 160,
  formatValue = String,
}: BarChartProps) {
  if (!data.length) return <div className="h-40 flex items-center justify-center text-[#3a3a48] text-sm">No data</div>;

  const maxVal = Math.max(...data.map((d) => Math.max(d.value, d.secondary ?? 0)), 1);
  const barW = 100 / (data.length * (data[0].secondary !== undefined ? 2.5 : 1.5));

  return (
    <div className="w-full" style={{ height }}>
      <svg viewBox={`0 0 100 100`} preserveAspectRatio="none" className="w-full h-full" style={{ overflow: 'visible' }}>
        {/* Grid lines */}
        {[0.25, 0.5, 0.75, 1].map((pct) => (
          <line
            key={pct}
            x1="0" y1={`${100 - pct * 85}`}
            x2="100" y2={`${100 - pct * 85}`}
            stroke="#1e1e22" strokeWidth="0.5"
          />
        ))}

        {data.map((d, i) => {
          const slot = 100 / data.length;
          const x = i * slot + slot * 0.15;
          const hasSecondary = d.secondary !== undefined;

          return (
            <g key={i}>
              {/* Primary bar */}
              <rect
                x={x}
                y={100 - (d.value / maxVal) * 85}
                width={hasSecondary ? barW * 0.9 : barW * 1.2}
                height={(d.value / maxVal) * 85}
                fill={color}
                opacity="0.85"
                rx="1"
              >
                <title>{formatValue(d.value)}</title>
              </rect>

              {/* Secondary bar */}
              {hasSecondary && d.secondary! > 0 && (
                <rect
                  x={x + barW}
                  y={100 - ((d.secondary ?? 0) / maxVal) * 85}
                  width={barW * 0.9}
                  height={((d.secondary ?? 0) / maxVal) * 85}
                  fill={secondaryColor}
                  opacity="0.7"
                  rx="1"
                >
                  <title>{formatValue(d.secondary ?? 0)}</title>
                </rect>
              )}
            </g>
          );
        })}
      </svg>

      {/* X axis labels */}
      <div className="flex w-full mt-1">
        {data.map((d, i) => (
          <div key={i} className="flex-1 text-center text-[10px] text-[#4a4a58] truncate px-0.5">
            {d.label}
          </div>
        ))}
      </div>
    </div>
  );
}

interface LineChartProps {
  data: { label: string; value: number }[];
  color?: string;
  height?: number;
  formatValue?: (v: number) => string;
  fill?: boolean;
}

export function LineChart({
  data,
  color = '#f59e0b',
  height = 140,
  formatValue = String,
  fill = true,
}: LineChartProps) {
  if (!data.length) return null;

  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const pts = data.map((d, i) => {
    const x = (i / (data.length - 1)) * 98 + 1;
    const y = 90 - (d.value / maxVal) * 80;
    return `${x},${y}`;
  });

  const polyline = pts.join(' ');
  const firstPt = pts[0];
  const lastPt = pts[pts.length - 1];

  return (
    <div className="w-full" style={{ height }}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full" style={{ overflow: 'visible' }}>
        <defs>
          <linearGradient id={`fill-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Grid */}
        {[0.25, 0.5, 0.75].map((pct) => (
          <line
            key={pct}
            x1="0" y1={90 - pct * 80}
            x2="100" y2={90 - pct * 80}
            stroke="#1e1e22" strokeWidth="0.5"
          />
        ))}

        {/* Fill area */}
        {fill && (
          <polygon
            points={`1,90 ${polyline} ${lastPt.split(',')[0]},90`}
            fill={`url(#fill-${color.replace('#', '')})`}
          />
        )}

        {/* Line */}
        <polyline
          points={polyline}
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Dots */}
        {pts.map((pt, i) => {
          const [x, y] = pt.split(',').map(Number);
          return (
            <circle key={i} cx={x} cy={y} r="1.5" fill={color} stroke="#0f0f11" strokeWidth="0.8">
              <title>{formatValue(data[i].value)}</title>
            </circle>
          );
        })}
      </svg>

      {/* X labels */}
      <div className="flex w-full mt-1">
        {data.map((d, i) => (
          <div key={i} className="flex-1 text-center text-[10px] text-[#4a4a58] truncate px-0.5">
            {d.label}
          </div>
        ))}
      </div>
    </div>
  );
}

interface HorizontalBarProps {
  data: { label: string; value: number }[];
  color?: string;
  formatValue?: (v: number) => string;
  maxBars?: number;
}

export function HorizontalBar({
  data,
  color = '#f59e0b',
  formatValue = String,
  maxBars = 6,
}: HorizontalBarProps) {
  const sliced = data.slice(0, maxBars);
  const maxVal = Math.max(...sliced.map((d) => d.value), 1);

  return (
    <div className="space-y-2.5">
      {sliced.map((d, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="w-24 text-[11px] text-[#9898a5] truncate text-right flex-shrink-0">
            {d.label}
          </div>
          <div className="flex-1 h-5 bg-[#1a1a1e] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700 flex items-center justify-end pr-2"
              style={{
                width: `${(d.value / maxVal) * 100}%`,
                background: `linear-gradient(90deg, ${color}80, ${color})`,
                minWidth: '8px',
              }}
            />
          </div>
          <div className="w-12 text-[11px] font-mono font-bold text-[#9898a5] text-right flex-shrink-0">
            {formatValue(d.value)}
          </div>
        </div>
      ))}
    </div>
  );
}

// Peak hours heatmap
interface HeatmapProps {
  data: { hour: number; orders: number }[];
}

export function HourHeatmap({ data }: HeatmapProps) {
  const maxVal = Math.max(...data.map((d) => d.orders), 1);

  const HOUR_LABELS: Record<number, string> = {
    0: '12a', 6: '6a', 12: '12p', 18: '6p', 23: '11p',
  };

  return (
    <div>
      <div className="flex gap-1 flex-wrap">
        {data.map((d) => {
          const intensity = d.orders / maxVal;
          return (
            <div
              key={d.hour}
              className="relative group"
              title={`${d.hour}:00 — ${d.orders} orders`}
            >
              <div
                className="w-6 h-6 rounded-md transition-all cursor-default"
                style={{
                  background:
                    intensity === 0
                      ? '#1a1a1e'
                      : `rgba(245, 158, 11, ${0.15 + intensity * 0.85})`,
                }}
              />
              {/* Tooltip */}
              <div className="absolute bottom-8 left-1/2 -translate-x-1/2 hidden group-hover:block bg-[#222228] text-[10px] text-white px-2 py-1 rounded-lg whitespace-nowrap z-10 pointer-events-none">
                {d.hour}:00 · {d.orders}
              </div>
            </div>
          );
        })}
      </div>
      {/* Hour labels */}
      <div className="flex mt-1">
        {data.map((d) => (
          <div key={d.hour} className="flex-1 text-center">
            {HOUR_LABELS[d.hour] && (
              <span className="text-[9px] text-[#3a3a48]">{HOUR_LABELS[d.hour]}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
