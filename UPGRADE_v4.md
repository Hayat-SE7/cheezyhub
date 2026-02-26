# CheezyHub v4 — UI Layer Upgrade

## What's New

### 🧑‍💻 Customer UI (Light Mode)
- **Hero Slider** — Auto-rotating deal cards from Admin → Deals. Framer Motion transitions.
- **Deals Section** — Horizontal scroll cards. Shows combo/discount/promotion/featured.
- **Popular Items Grid** — 2-column featured items with image thumbnails and quick-add.
- **Visual Menu Cards** — Image + name + description + price + Add/Customize button.
- **Modifier Panel** — Inline expandable modifier selection before adding to cart.
- **Search Bar** — Live filter across all menu items and descriptions.
- **Order Tracking Timeline** — Animated progress bar with 6 steps, live SSE updates.

### 🍳 Kitchen UI (Dark Mode)
- **Live Timer Badges** — Shows elapsed time per order. Red + pulsing when >10 min.
- **Color-coded Glow Cards** — Amber (new), Blue (preparing), Green (ready). Box shadow per status.
- **Triple chime alert** — Audio for new orders.
- **Urgent counter** — Header badge when orders are overdue.

### 🚚 Delivery UI (Dark Mode)
- **Stats strip** — Active count, completed count, earnings total.
- **Large delivery cards** — Customer name, items, address, full action buttons.
- **Navigate button** — Opens Google Maps with lat/lng or address fallback.
- **Picked Up / Delivered actions** — Clearly separated, color-coded per status.
- **Completed list** — Today's deliveries with earnings.

### 🧑‍💼 Admin UI (Dark Mode)
- **Analytics Dashboard** — 7-day trend chart (orders/revenue toggle), top items bar chart, peak hours heatmap.
- **Menu Image Upload** — Per-item image upload (file or URL). Instant preview. Customer menu updates automatically.
- **Deals Management** — Full CRUD: title, image, type, discount, validity, linked items, display location.

---

## Setup — Run After Pulling v4

### 1. Apply Prisma Migration (NEW: Deals table)
```bash
cd backend
npx prisma migrate dev --name add-deals
npx prisma generate
```

### 2. Start Backend
```bash
cd backend
npm run dev
```

### 3. Start Frontend
```bash
cd frontend
npm run dev
```

---

## New API Endpoints

| Method | Endpoint                    | Access | Description                  |
|--------|----------------------------|--------|------------------------------|
| GET    | /api/deals                  | Public | Active deals (customer)       |
| GET    | /api/deals/slider           | Public | Slider-only deals             |
| GET    | /api/deals/admin            | Admin  | All deals incl. inactive      |
| POST   | /api/deals/admin            | Admin  | Create deal                   |
| PATCH  | /api/deals/admin/:id        | Admin  | Update deal                   |
| DELETE | /api/deals/admin/:id        | Admin  | Delete deal                   |
| PATCH  | /api/deals/admin/:id/toggle | Admin  | Toggle active status          |
| GET    | /api/admin/analytics        | Admin  | Dashboard chart data          |

---

## Image Upload Notes
- Images are stored as **base64 data URLs** or **external URLs**.
- For production, swap to S3/Cloudinary: update `menuApi.updateItem()` to upload first, then save the URL.
- Max client-side validation: 2MB per image.

---

## Deal Display Logic
- `displayLocation: "slider"` → Hero Slider only
- `displayLocation: "deals_section"` → Horizontal cards only
- `displayLocation: "both"` → Appears in both (default)
- Expired deals (`validTo < now`) are automatically hidden from customers.
- Inactive deals (`isActive: false`) are hidden from customers.
