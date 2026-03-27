// Re-export all chart components from the canonical location.
// This file exists so that:
//   import { ... } from '@/components/Charts'         ← analytics page (phase 10)
//   import { ... } from '@/components/admin/Charts'   ← dashboard page
// both work without any page edits.

export {
  BarChart,
  LineChart,
  DualLineChart,
  HorizontalBar,
  HourHeatmap,
  DonutChart,
  ChangeBadge,
} from '@/components/admin/Charts';
