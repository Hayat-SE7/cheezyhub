# Part D — Full UI/UX Overhaul Design Spec

## Context

CheezyHub v4 is a food ordering platform with 5 role-based panels: Customer, Counter (POS), Kitchen (KDS), Delivery (driver app), and Admin. Parts A (counter order separation), B (CSV export), and C (performance) are complete. Part D addresses the UI/UX layer — the current interface is functional but visually generic, with inconsistent design patterns across panels, no shared component library, and pages built as monolithic inline Tailwind.

**Goal:** Transform all 5 panels into a cohesive, premium, responsive experience with smooth animations, a unified design system, and a customer-first focus.

## Design Decisions

| Decision | Choice |
|----------|--------|
| Scope | Full overhaul — all 5 panels |
| Design vibe | Premium Minimalist — clean, generous whitespace, subtle glassmorphism, micro-animations |
| Customer homepage | Hybrid personalized — greeting, deal carousel, category pills, curated sections |
| Mobile nav (customer) | Glass bottom tab bar — Home, Search, Orders, Profile |
| Staff panels | Unified dark theme + role-specific accent colors |
| Kitchen cards | Ticket style — colored header strip with order number + timer |
| Animation level | Rich & cinematic — Framer Motion page transitions, stagger, spring physics, parallax |
| Component library | shadcn/ui primitives, customized to CheezyHub brand |

---

## Phase 1: Design System Foundation

Zero-risk phase — all new files, no existing pages touched.

### 1.1 Install & Configure shadcn/ui

- Run `npx shadcn-ui@latest init` in `frontend/`
- Configure `components.json`: path alias `@/components/ui`, Tailwind CSS variables mode, `cn()` via `tailwind-merge` + `clsx`
- Create `frontend/src/lib/utils.ts` with `cn()` helper (shadcn convention)
- Generate base primitives: **Button, Card, Input, Badge, Dialog, Sheet, Tabs, Select, DropdownMenu, Skeleton, Separator, ScrollArea, Sonner** (toast replacement for `react-hot-toast`)

### 1.2 Theme Token System

Extend `tailwind.config.js` with CSS-variable-based theming (shadcn pattern):

**Light Theme (Customer):**

| Token | Value | Usage |
|-------|-------|-------|
| `--background` | `#faf9f6` | Page background |
| `--surface` | `#ffffff` | Cards, modals |
| `--surface-raised` | `#f7f4f0` | Input backgrounds, secondary surfaces |
| `--border` | `#ece6dc` | Card borders, dividers |
| `--text-primary` | `#1c1714` | Headings, body text |
| `--text-secondary` | `#5c5147` | Subheadings, labels |
| `--text-muted` | `#a39083` | Placeholders, timestamps |
| `--accent` | `#f59e0b` | Amber — primary accent |
| `--accent-foreground` | `#ffffff` | Text on accent |

**Dark Theme (Staff):**

| Token | Value | Usage |
|-------|-------|-------|
| `--background` | `#09090b` | Page background |
| `--surface` | `#0f0f12` | Cards, panels |
| `--surface-raised` | `#1a1a1f` | Elevated elements |
| `--border` | `#222229` | Borders, dividers |
| `--text-primary` | `#f2f2f5` | Headings, body text |
| `--text-secondary` | `#9898a5` | Labels, metadata |
| `--text-muted` | `#4a4a58` | Inactive, disabled |

**Role Accent Colors:**

| Role | Accent | CSS Variable |
|------|--------|-------------|
| Customer | Amber `#f59e0b` | `--accent-customer` |
| Kitchen | Orange `#f97316` | `--accent-kitchen` |
| Counter | Amber `#f59e0b` | `--accent-counter` |
| Delivery | Lime `#a3e635` | `--accent-delivery` |
| Admin | Indigo `#6366f1` | `--accent-admin` |

**Status Colors (shared across all panels):**

| Status | Color | Usage |
|--------|-------|-------|
| Pending | `#f59e0b` amber | New orders awaiting action |
| Preparing | `#3b82f6` blue | In-progress orders |
| Ready | `#22c55e` emerald | Completed prep, awaiting pickup |
| Assigned | `#8b5cf6` purple | Driver assigned |
| Picked Up | `#f97316` orange | Driver en route |
| Delivered/Completed | `#6b7280` gray | Finished orders |
| Cancelled | `#ef4444` red | Cancelled/urgent |

### 1.3 Typography System

| Role | Font | Weights | Usage |
|------|------|---------|-------|
| Display | Playfair Display | 700, 900 | Hero headings, promotional text |
| Body/UI | Plus Jakarta Sans | 400, 500, 600, 700, 800 | All UI text |
| Mono | JetBrains Mono | 500, 700 | Order numbers, codes, prices |

### 1.4 Framer Motion Variants

Create `frontend/src/lib/motion.ts`:

```
pageTransition: slide-up + fade, duration 0.3s, ease [0.25, 0.1, 0.25, 1]
staggerContainer: staggerChildren 0.05s, delayChildren 0.1s
cardEntrance: scale 0.95→1 + opacity 0→1, spring stiffness 300 damping 24
springPhysics: stiffness 300, damping 24 (buttons, interactive elements)
slideIn: x ±20→0 + opacity, duration 0.25s
fadeIn: opacity 0→1, duration 0.2s
heroParallax: translateY with scroll offset (customer homepage hero)
shimmer: background-position shift for skeleton loading
```

### 1.5 Shared UI Components

Create in `frontend/src/components/ui/`:

- **GlassCard** — Parametric glassmorphism wrapper (replaces scattered `.glass`, `.glass-dark`, `.glass-amber` CSS classes). Props: `variant: 'light' | 'dark' | 'amber'`, `blur`, `opacity`.
- **EmptyState** — Icon + title + description + optional CTA. Used when lists/grids have no content.
- **StatusBadge** — Unified status display. Props: `status`, auto-maps to color from status palette.
- **OrderNumber** — Monospace styled order number with `#CH-` prefix.
- **LoadingSkeleton** — Shimmer-based skeletons for cards, lists, stats (replaces 7 per-page `loading.tsx` files with composable patterns).

### 1.6 globals.css Refactor

- Migrate existing CSS custom properties into shadcn `@layer base` pattern with `:root` and `.dark` selectors
- Keep all existing animation keyframes functional (they still work)
- Add new keyframes: `ticket-slide` (kitchen card entrance), `glow-pulse` (urgent order)
- Remove redundant glass classes once `GlassCard` component is in use

**Files created/modified in Phase 1:**
- `frontend/components.json` (new)
- `frontend/src/lib/utils.ts` (new)
- `frontend/src/lib/motion.ts` (new)
- `frontend/src/components/ui/*.tsx` (new — shadcn primitives + custom components)
- `frontend/tailwind.config.js` (extended)
- `frontend/src/app/globals.css` (refactored)
- `frontend/package.json` (new deps: `tailwind-merge`, `class-variance-authority`, `@radix-ui/*`, `sonner`)

---

## Phase 2: Customer Panel Redesign (8 pages)

### 2.1 Customer Layout (`customer/layout.tsx`)

**Desktop (≥1024px):**
- Sticky glassmorphism header: Logo left, horizontal nav (Menu, Deals, Orders, Support) center, search bar + cart icon + user avatar right
- Content area with `max-w-7xl` constraint
- Footer (existing, upgrade with design tokens)

**Mobile (<1024px):**
- Compact header: Logo left, cart icon (with count badge) right
- Glass bottom tab bar: Home, Search, Orders, Profile — active tab has amber dot indicator
- No hamburger menu — all navigation via bottom tabs
- Page transitions via `AnimatePresence` wrapping `{children}`

**Bottom tab bar spec:**
- Fixed at bottom, `backdrop-filter: blur(16px)`, `bg-white/92`
- 4 tabs with icon + label, active state: amber text + dot below
- `pb-safe` for iOS safe area

### 2.2 Customer Homepage (`customer/page.tsx`)

Decompose 530-line monolith into composable components:

**`GreetingBanner`** — Time-based greeting ("Good evening, Hayat 👋") + "What are you craving?" heading. Shows on authenticated sessions.

**`DealCarousel`** — Horizontal scroll with snap-scroll, gradient deal cards (amber, purple, etc.), auto-rotate with pause on interaction. Each card: deal type label, title, description, CTA button. Subtle parallax on the background emoji.

**`CategoryPills`** — Horizontal scrollable pill buttons. "All" pill uses dark fill (`bg-[#1c1714]`), others white with border. Sticky below header on scroll.

**`PopularSection`** — "Popular Right Now 🔥" header with "See all" link. Horizontal scroll cards (same as menu item cards but in a horizontal scroll container).

**`CategoryGrid`** — For each category, section header + 2-column (mobile) / 3-column (tablet) / 4-column (desktop) grid of menu item cards.

**`MenuItemCard`** (shared component, consolidate existing two implementations):
- Vertical card: image/emoji top, name, description, price + "Add +" button bottom
- Image area: gradient background with centered emoji (or `next/image` if item has `imageUrl`)
- Discount badge (top-left, red): `-20%` when deal applies
- Add button: amber rounded square with `+` icon, box-shadow glow
- On click (items with modifiers): opens Sheet (shadcn) from bottom with modifier selection
- Stagger entrance animation via `cardEntrance` variant

### 2.3 Menu Page (`customer/menu/page.tsx`)

- Desktop: Sticky left sidebar with category list (IntersectionObserver syncs active category on scroll) + main grid right
- Mobile: Horizontal category pills (sticky) + vertical grid
- Grid: 2-col mobile, 2-col tablet, 3-col desktop
- Uses shared `MenuItemCard` component
- Search bar at top with debounced filtering

### 2.4 Cart Page (`customer/cart/page.tsx`)

- Cart item list with image thumbnail, name, modifier summary, quantity +/- controls, swipe-to-remove (mobile)
- Price breakdown: subtotal, delivery fee, service charge, total
- Delivery address selector (Sheet with saved addresses + "Add new")
- Customer note input
- "Place Order" CTA: full-width amber button with loading spinner state
- Desktop: 2-column layout (items left, summary/checkout right in sticky sidebar)

### 2.5 Orders Page (`customer/orders/page.tsx`)

**Active order section:**
- Card with order number (monospace), status badge, progress tracker
- Progress tracker: 4 connected steps with emoji icons (✓ Confirmed → 🍳 Preparing → 📦 Ready → 🏠 Delivered), filled line between completed steps, amber glow on current step
- ETA card below with estimated time + timer icon
- SSE-driven live updates (existing `useSSE` hook, now invalidates react-query)

**Past orders section:**
- Collapsible cards: order number, item count, total, status badge, date
- Expanded: full item list with modifiers, price breakdown, "Reorder" button
- Virtual scrolling for 50+ orders (existing `@tanstack/react-virtual`)

### 2.6 Order Confirmed Page (`customer/order-confirmed/page.tsx`)

- Centered celebration: large green checkmark with scale-pop animation
- Order number in monospace
- ETA estimate
- Two CTAs: "Track Order" (primary amber) and "Back to Menu" (secondary outline)
- Confetti-style micro-animation on mount (CSS-only, lightweight)

### 2.7 Login Page (`customer/login/page.tsx`)

- Desktop: Split layout — brand hero left (gradient + floating food emoji), form right
- Mobile: Stacked — brand banner top, form below
- Phone number input → OTP flow
- Glassmorphism card for form container

### 2.8 Profile & Support Pages

- Profile: Avatar, name, phone, saved addresses list, order stats
- Support: Ticket list with status badges, create ticket form
- Both use shadcn Card, Input, Button primitives

---

## Phase 3: Staff Panels Redesign

### 3.1 Kitchen Display System (2 pages)

**Accent: Orange `#f97316`**

**Kanban Board (`kitchen/page.tsx`):**
- 3-column Kanban: New Orders (orange) → Preparing (blue) → Ready (green)
- **Ticket-style cards:**
  - Colored header strip (column accent gradient) with bold monospace order number + elapsed timer
  - Body: customer name, order type badge (🛵 Delivery / 🏪 Counter), item list with quantity badges (colored squares), special notes
  - Action button: full-width, column accent color
- Urgent orders (>10 min): header strip turns red, timer shows ⚠️, border gets red glow, `glow-pulse` animation
- Column headers: glowing accent dot + name + count badge
- Audio alert on NEW_ORDER SSE event (existing)
- Pause/Resume toggle in header

**Login (`kitchen/login/page.tsx`):** Dark background, orange gradient accents, PIN input, floating fire emoji decorations.

### 3.2 Counter POS (3 pages)

**Accent: Amber `#f59e0b`**

**POS Main (`counter/page.tsx`):**
- 3-panel layout: Category sidebar (left, 80px icons) → Product grid (center, 2-5 cols) → Cart panel (right, 220px)
- Product tiles: dark surface, emoji, name, price. Selected tile: amber border. Unavailable: 40% opacity + "Unavailable" label
- Cart panel: line items with qty controls, subtotal, payment method toggle (Cash/Card), customer note, "Place Order" CTA
- Mobile: Category tabs top (horizontal), product grid full-width, cart slides up as Sheet from bottom
- Offline banner: red warning bar top, queue badge in header
- ConnectivityBar and FailedQueueModal (existing components, restyle)

**Shift Page (`counter/shift/page.tsx`):** Shift status card, opening/closing balance, order count, revenue summary.

**Login (`counter/login/page.tsx`):** Dark/amber gradient, PIN pad input.

### 3.3 Delivery Driver App (8 pages)

**Accent: Lime `#a3e635`**

**Home (`delivery/page.tsx`):**
- Driver greeting + status toggle pill (● Online = lime glow, Offline = gray)
- Stats strip: 3 cards (Today deliveries, Total, COD Due)
- Active delivery card: ticket-style with lime accent, order details, address, customer contact (tel: link), Maps button + Delivered CTA
- Glass bottom nav: Home, History, Earnings, Profile

**Other pages:** History (past deliveries list), Earnings (stats + chart), Settlements (table), COD Wallet (balance + pending), Holidays (request form + list), Profile (details + status).

**Login (`delivery/login/page.tsx`):** Dark/lime gradient, numeric PIN pad.

### 3.4 Admin Dashboard (12+ pages)

**Accent: Indigo `#6366f1`**

**Sidebar Layout (`admin/layout.tsx`):**
- Glass sidebar (200px): Logo, vertical nav links with icons, active state = indigo background, notification badge on Orders
- Mobile: Sidebar becomes Sheet (slide from left)
- Content area with header (page title, date, action buttons)

**Dashboard (`admin/page.tsx`):** 4-column stat cards (revenue, orders, avg value, active drivers) with trend arrows → revenue chart (indigo gradient bars) → top items horizontal bar → peak hours heatmap → quick nav grid.

**CRUD Pages Pattern (orders, customers, menu, deals, staff, drivers, tickets, settlements, holidays, settings):**
- Consistent header: Title + action button (right)
- Filter bar: search input + select dropdowns + status pills
- Data table/card list with shadcn Table/Card
- Detail pages: 2-column (info left, timeline/actions right)
- Forms: shadcn Input, Select, Dialog for create/edit modals

**Analytics (`admin/analytics/page.tsx`):** KPI cards, line/bar/donut charts (existing Recharts, restyle with indigo theme), CSV export button.

**Login (`admin/login/page.tsx`):** Dark/indigo gradient, admin credentials form.

---

## Phase 4: Polish & Unification

- Cross-panel consistency audit: verify all panels use design tokens, no hardcoded hex colors remaining
- Loading states: all pages use shimmer Skeleton components
- Error boundaries: `error.tsx` per panel with retry CTA
- Empty states: `EmptyState` component applied to all empty lists/grids
- Accessibility: keyboard navigation on all interactive elements, `aria-checked` on toggles, proper focus management in modals/sheets
- Responsive QA: test all pages at 375px (mobile), 768px (tablet), 1024px (small desktop), 1440px (large desktop)
- Dead CSS cleanup: remove old glass classes, old animation utilities replaced by Framer Motion
- Toast migration: replace all `react-hot-toast` calls with Sonner
- Long-action feedback: loading spinners on cart place-order, COD settle, driver verify/reject buttons

---

## Animation Specification

| Element | Animation | Trigger | Duration |
|---------|-----------|---------|----------|
| Page transitions | Slide-up + fade | Route change | 300ms |
| Card entrance | Scale 0.95→1 + fade | Mount | 250ms + 50ms stagger |
| Deal carousel | Auto-scroll + snap | Timer (5s) | 400ms slide |
| Hero parallax | translateY with scroll | Scroll | Continuous |
| Button press | Scale 0.96 | Active/press | 100ms |
| Card hover | translateY -2px + shadow | Hover | 200ms |
| Add to cart | Scale pop on badge | Cart add | 300ms spring |
| Kitchen ticket | Slide-in from top | New order SSE | 350ms spring |
| Urgent pulse | Border glow pulse | Timer >10min | 1.5s infinite |
| Skeleton shimmer | Background-position shift | Loading | 1.4s infinite |
| Bottom tab active | Dot scale-in + color | Tab change | 200ms |
| Sheet open | Slide-up + overlay fade | User action | 300ms spring |
| Toast | Slide-in from top-right | Event | 200ms |

---

## Verification Plan

### Build Verification
```bash
cd frontend && npx tsc --noEmit    # TypeScript clean
cd frontend && npm run build        # Next.js build clean
```

### Visual Verification (per phase)

**Phase 1:** Import and render each shadcn primitive in a test page. Verify dark/light theme toggle works. Verify motion variants animate correctly.

**Phase 2 (Customer):**
- Homepage: greeting shows, deals carousel auto-rotates, category pills filter items, menu cards render with stagger animation, Add button opens modifier Sheet
- Menu: sidebar syncs with scroll on desktop, pills work on mobile, search filters correctly
- Cart: items show with qty controls, price breakdown calculates, address selector works, place order submits
- Orders: active order shows progress tracker with live SSE updates, past orders expand/collapse, virtual scroll works for 50+ orders
- Responsive: test at 375px, 768px, 1024px, 1440px — no overflow, no broken layouts

**Phase 3 (Staff):**
- Kitchen: tickets appear on SSE NEW_ORDER, status transitions work (Prepare → Ready), urgent pulse fires at 10min, audio alert plays
- Counter: product grid populates from menu API, add to cart works, payment toggle switches, offline queue works when disconnected
- Delivery: status toggle changes driver status via API, active delivery card shows Maps link, Delivered button triggers status update
- Admin: sidebar nav works, dashboard stats populate from API, all CRUD pages load data, filters/search work

**Phase 4:**
- No hardcoded hex colors in any page file (grep verify)
- All empty states render EmptyState component
- All pages have loading.tsx with Skeleton
- Keyboard-navigate through counter POS, kitchen board, delivery actions
- Open all pages at 375px width — no horizontal scroll, all text readable

---

## Files Inventory

### New Files (Phase 1)
- `frontend/components.json`
- `frontend/src/lib/utils.ts`
- `frontend/src/lib/motion.ts`
- `frontend/src/components/ui/button.tsx` (shadcn)
- `frontend/src/components/ui/card.tsx` (shadcn)
- `frontend/src/components/ui/input.tsx` (shadcn)
- `frontend/src/components/ui/badge.tsx` (shadcn)
- `frontend/src/components/ui/dialog.tsx` (shadcn)
- `frontend/src/components/ui/sheet.tsx` (shadcn)
- `frontend/src/components/ui/tabs.tsx` (shadcn)
- `frontend/src/components/ui/select.tsx` (shadcn)
- `frontend/src/components/ui/dropdown-menu.tsx` (shadcn)
- `frontend/src/components/ui/skeleton.tsx` (shadcn)
- `frontend/src/components/ui/separator.tsx` (shadcn)
- `frontend/src/components/ui/scroll-area.tsx` (shadcn)
- `frontend/src/components/ui/sonner.tsx` (shadcn)
- `frontend/src/components/ui/glass-card.tsx`
- `frontend/src/components/ui/empty-state.tsx`
- `frontend/src/components/ui/status-badge.tsx`
- `frontend/src/components/ui/order-number.tsx`

### Modified Files (Phase 1)
- `frontend/tailwind.config.js`
- `frontend/src/app/globals.css`
- `frontend/package.json` / `package-lock.json`

### New Files (Phase 2 — Customer Components)
- `frontend/src/components/customer/GreetingBanner.tsx`
- `frontend/src/components/customer/DealCarousel.tsx`
- `frontend/src/components/customer/CategoryPills.tsx`
- `frontend/src/components/customer/PopularSection.tsx`
- `frontend/src/components/customer/CategoryGrid.tsx`
- `frontend/src/components/customer/MenuItemCard.tsx` (consolidate existing)
- `frontend/src/components/customer/BottomTabBar.tsx`
- `frontend/src/components/customer/CartSheet.tsx`

### Modified Files (Phase 2)
- `frontend/src/app/customer/layout.tsx`
- `frontend/src/app/customer/page.tsx`
- `frontend/src/app/customer/menu/page.tsx`
- `frontend/src/app/customer/cart/page.tsx`
- `frontend/src/app/customer/orders/page.tsx`
- `frontend/src/app/customer/order-confirmed/page.tsx`
- `frontend/src/app/customer/login/page.tsx`
- `frontend/src/app/customer/profile/page.tsx`
- `frontend/src/app/customer/support/page.tsx`
- `frontend/src/components/customer/Header.tsx`
- `frontend/src/components/customer/Footer.tsx`
- `frontend/src/components/customer/HeroSlider.tsx` → replaced by DealCarousel

### Modified Files (Phase 3 — Staff)
- All layout.tsx files (admin, kitchen, delivery, counter)
- All page.tsx files in admin/, kitchen/, delivery/, counter/
- All login page.tsx files
- `frontend/src/components/admin/Charts.tsx`
- `frontend/src/components/counter/ConnectivityBar.tsx`
- `frontend/src/components/counter/FailedQueueModal.tsx`

### New Files (Phase 3)
- `frontend/src/components/kitchen/TicketCard.tsx`
- `frontend/src/components/kitchen/KanbanColumn.tsx`
- `frontend/src/components/admin/Sidebar.tsx`
- `frontend/src/components/admin/StatCard.tsx`
- `frontend/src/components/delivery/BottomNav.tsx`
- `frontend/src/components/delivery/DeliveryCard.tsx`
- `frontend/src/components/delivery/StatusToggle.tsx`

### New Files (Phase 4)
- `frontend/src/app/customer/error.tsx`
- `frontend/src/app/admin/error.tsx`
- `frontend/src/app/kitchen/error.tsx`
- `frontend/src/app/delivery/error.tsx`
- `frontend/src/app/counter/error.tsx`
