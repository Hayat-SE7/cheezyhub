# CheezyHub — Full UI/UX Redesign Design Spec
**Date:** 2026-04-17  
**Status:** Approved by user

---

## Why This Redesign

The current CheezyHub UI was built for function first — all five panels work but share no visual language, have inconsistent spacing, and feel like internal tools rather than a polished product. This redesign gives each panel a distinct, purposeful identity while rooting all five in a shared dark foundation and token system.

---

## Design Decisions (User Selections)

| Panel | Chosen Concept |
|-------|---------------|
| Customer | Warm Artisan |
| Counter | Bento Grid |
| Kitchen | Large Card Wall |
| Delivery | Map-First |
| Admin | Command Center |

---

## Design Principles

1. **Dark-first** — All panels use near-black backgrounds (#080808–#0f0f1a range). No light mode in v1.
2. **Role-appropriate** — Each panel is optimised for its user (driver app ≠ admin dashboard).
3. **Shared tokens** — Spacing, border-radius, font scale, and shadow system are identical across panels.
4. **Brand accent** — Amber/gold (#D97706, #CA8A04) is the CheezyHub brand colour used in CTAs across all panels. Panel-specific accent colours supplement it.

---

## Shared Design Tokens

### Colours
```
Background layers:
  bg-base:     #080808   (page background)
  bg-surface:  #0f0f14   (card / panel)
  bg-elevated: #161620   (hover state, modal)
  bg-border:   #1e1e28   (dividers, card borders)

Brand:
  brand-amber: #D97706
  brand-gold:  #CA8A04

Text:
  text-primary:   #F2F2F5
  text-secondary: #9898A5
  text-muted:     #4A4A58

Status:
  status-green:  #4ADE80
  status-amber:  #FBBF24
  status-red:    #F87171
  status-blue:   #60A5FA

Panel accents:
  customer-accent:  #D97706  (amber)
  counter-accent:   #D97706  (amber)
  kitchen-accent:   status-driven (amber/blue/green per status)
  delivery-accent:  #00D4AA  (teal)
  admin-accent:     #60A5FA  (blue) + #D97706 for CTAs
```

### Typography
- **Headings:** Inter or system-ui, weight 800–900
- **Body:** Inter, weight 400–600, size 13–14px
- **Monospace values** (prices, IDs): `font-variant-numeric: tabular-nums`

### Spacing Scale
4 / 8 / 12 / 16 / 20 / 24 / 32 / 48px

### Border Radius
- Cards: 14–16px
- Badges/pills: 20px (full)
- Buttons: 10–12px
- Inner elements: 8px

### Shadows
- Card: `0 1px 3px rgba(0,0,0,0.4)`
- Modal: `0 8px 32px rgba(0,0,0,0.6)`
- Focus ring: `0 0 0 2px #D97706`

---

## Panel 1: Customer — "Warm Artisan"

**Route:** `/customer`  
**Accent:** Amber `#D97706` + warm cream `#F5E6C8`  
**Background:** `#100C07` (warm near-black)  
**Vibe:** Craft bakery / artisan food brand — warm, inviting, premium

### Layout
- **Top bar:** Brand logo left, cart icon + item count right, sticky
- **Hero section:** Category filter pills (horizontal scroll), amber active state
- **Menu grid:** 2-column card grid on mobile, 3-column on desktop
- **Cart drawer:** Slides from bottom (mobile) / right (desktop), amber CTA

### Menu Card
```
bg: #1A1208  border: #3D2E12  border-radius: 16px
Image: top, 16:9, rounded-t-16
Title: 14px 700 #F5E6C8
Price: 16px 900 #D97706
Add button: circular amber +/- stepper
```

### Navigation (bottom tab bar on mobile)
Home · Orders · Favourites · Profile  
Active tab: amber underline + amber icon tint

### Order Tracking Page
Progress stepper: 4 steps (Confirmed → Kitchen → On the Way → Delivered)  
Active step: filled amber circle  
Connector line: amber gradient for completed, `#2D2210` for pending

---

## Panel 2: Counter — "Bento Grid"

**Route:** `/counter`  
**Accent:** Amber `#D97706`  
**Background:** `#09090E`  
**Vibe:** Bento-box grid layout — every piece of info in its own clean cell

### Layout
```
┌─────────────────┬──────────────────────┐
│  Category Pills │  Order Summary       │
│  (left column,  │  (right column,      │
│   ~35% width)   │   ~65% width)        │
│                 │                      │
│  Menu Items     │  Line items list     │
│  (scrollable)   │  Total + Pay button  │
└─────────────────┴──────────────────────┘
```

- Left: category filter (vertical pill list) + menu item grid (2-col)
- Right: current order, quantity controls, subtotal, payment method selector, large amber "Charge" CTA
- Menu item cards: bento-style, tight padding, item name + price, tap to add
- Active order card border: 2px amber

### Shift Management
Separate `/counter/shift` route, minimal — clock in/out, current session earnings, ledger button

---

## Panel 3: Kitchen — "Large Card Wall"

**Route:** `/kitchen`  
**Accent:** Status-driven (amber=new, blue=cooking, green=ready)  
**Background:** `#070709`  
**Vibe:** Large, readable cards — optimised for glancing across a busy kitchen

### Layout
- **Header bar (from layout.tsx):** Brand logo, SSE indicator (Wifi/WifiOff), staff name, logout
- **Stats bar:** Today count, avg prep time, pending count — small pill row under header
- **Card Wall:** 2-col on tablet (`sm:grid-cols-2`), 3-col on desktop (`lg:grid-cols-3`), NO kanban columns
- Cards sorted: newest first, with age indicator (elapsed time since order placed)

### Order Card (Large)
```
bg: #0F0F14  border: 1px #1E1E28  border-radius: 16px
Top strip: 4px colour bar (amber=new, blue=cooking, green=ready)
Header: Order # (large, 800 weight) + elapsed timer (right, colour-coded)
Items: full item list with modifiers, 14px
Footer: status badge + action button (full width, appropriate colour)
Card size: min-height 160px, comfortable reading distance
```

### Status Actions
- New → "Start Cooking" (amber button)
- Cooking → "Mark Ready" (blue button)
- Ready → green badge, no further action

---

## Panel 4: Delivery — "Map-First"

**Route:** `/delivery`  
**Accent:** Teal `#00D4AA`  
**Background:** `#070E0D`  
**Vibe:** Navigation app feel — map dominates, order card underneath

### Layout
```
┌─────────────────────────────┐
│  Map / Route Visualisation  │  ~38% of screen height
│  (grid overlay, ETA badge,  │
│   online/offline toggle)    │
├─────────────────────────────┤
│  Active Order Card          │  order details + actions
├─────────────────────────────┤
│  Stats Row (3 cols)         │  deliveries / earned / rating
└─────────────────────────────┘
```

- Map area: dark teal-tinted gradient with CSS grid overlay lines, animated route line, position dot (teal), destination dot (red/coral)
- ETA badge: centred overlay on map, teal border, white number
- Order card: `bg #0D1F1B`, teal accent, address, COD badge, Navigate + Mark Delivered buttons
- Online/Offline toggle: teal pill top-right of map

### Secondary Pages
- **COD Wallet:** Teal balance card, transaction list with teal amounts, settle button
- **Earnings:** Teal bar chart, daily/weekly/monthly toggle
- **Profile / Verification:** Clean form cards, teal focus rings, document upload areas
- **Holidays:** Calendar-style request list, teal approved badges

---

## Panel 5: Admin — "Command Center"

**Route:** `/admin`  
**Accent:** Blue `#60A5FA` (data/info) + Amber `#D97706` (action CTAs)  
**Background:** `#09090F`  
**Vibe:** Dense, professional ops dashboard — icon sidebar + data-rich main area

### Layout
```
┌────┬──────────────────────────────────────┐
│    │  Topbar: page title + timestamp       │
│ 56 ├──────────────────────────────────────┤
│ px │  KPI Row (4 cards)                    │
│    ├──────────────────────────────────────┤
│ S  │  Chart Area                           │
│ i  ├──────────────────────────────────────┤
│ d  │  Data Table / Content                 │
│ e  │                                       │
│ b  │                                       │
│ a  │                                       │
│ r  │                                       │
└────┴──────────────────────────────────────┘
```

### Sidebar (56px always, expands to 200px on ≥1280px)
Icons: Dashboard, Orders, Drivers, Menu, Staff, Deals, Analytics, Settings  
Active state: blue-tinted bg `#1E3A5F`, blue icon  
Inactive: 30% opacity

### KPI Cards
4-across row: Orders Today, Revenue (Rs), Active Drivers, Avg Rating  
Value: 18–22px weight-900 blue  
Delta: 10px green (↑) / red (↓)

### Tables (Orders, Drivers, Staff, Deals, etc.)
- Column headers: 10px uppercase muted
- Rows: 11–12px, hover `bg-elevated`
- Status badges: pill with colour-coded bg/text (matches shared status tokens)
- Row actions: icon buttons (edit/view/delete) appear on hover

### Charts (Analytics page)
- Revenue: blue bars, amber highlight for current period
- Order types: donut chart (blue/green/amber/red segments)
- Driver performance: horizontal bar chart, blue bars

---

## Shared Components (Already Built — Reuse As-Is)

| Component | File | Notes |
|-----------|------|-------|
| EmptyState | `components/ui/EmptyState.tsx` | Use across all panels, dark prop where needed |
| ConfirmModal | `components/ui/ConfirmModal.tsx` | All destructive actions (cancel, delete, reject) |
| Toast | `lib/toast.ts` + `providers.tsx` | Branded dark pill toasts |
| Error boundaries | `app/*/error.tsx` | Already added for all 5 panels |

---

## Responsive Behaviour

| Breakpoint | Behaviour |
|-----------|-----------|
| `< 640px` mobile | Single column, bottom tab nav (customer), full-width cards |
| `640–1024px` tablet | 2-column grids, icon-only sidebars |
| `≥ 1024px` desktop | Full layout, expanded sidebar (admin), 3-column grids |

All panels must be tested at 375px, 768px, 1024px, 1440px.

---

## What Does NOT Change

- Backend API — zero backend changes
- Auth flows — login pages restyled but logic identical
- Zustand stores — no structural changes
- Route structure — same URLs
- `lib/api.ts` — no changes

---

## Acceptance Criteria

- [ ] All 5 panels match their chosen concept at 375px, 768px, 1024px, 1440px
- [ ] Shared token values applied consistently (Tailwind config or CSS variables)
- [ ] `npx tsc --noEmit` passes — zero TypeScript errors
- [ ] No console errors in browser on any panel
- [ ] SSE indicators visible in Kitchen + Delivery headers
- [ ] All interactive elements: hover states, focus rings, cursor-pointer
- [ ] EmptyState, ConfirmModal, Toast used — no one-off inline implementations
- [ ] All existing functionality preserved (auth, orders, SSE, cart, etc.)
