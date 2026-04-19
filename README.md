# CheezyHub

A full-stack, single-restaurant smart ordering system built as an npm workspaces monorepo. Five dedicated panels — Customer, Counter, Kitchen, Delivery, and Admin — each with isolated auth, real-time SSE updates, and their own Zustand store. Designed for Pakistani restaurant operations with Safepay payment integration.

---

## Overview

| Panel | Route | Who Uses It | What It Does |
|-------|-------|-------------|--------------|
| Customer | `/customer` | Guests & registered customers | Browse menu, build a cart, pay via Safepay or cash, track orders live, manage addresses and favourites, raise support tickets. |
| Counter | `/counter` | Cashier / POS staff | Place walk-in and dine-in orders, manage shift float, record cash/card/split payments, view per-shift ledger. |
| Kitchen | `/kitchen` | Kitchen crew | View incoming order queue in real time, advance prep status (pending → preparing → ready), toggle item availability. |
| Delivery | `/delivery` | Drivers | Accept assigned delivery orders, update status, manage COD wallet, request holidays, upload verification documents. |
| Admin | `/admin` | Restaurant owner / manager | Full CRUD over menu, staff, drivers, customers, deals; analytics and revenue charts; driver settlements; support tickets; system settings. |

---

## Tech Stack

| Layer | Technology | Version / Notes |
|-------|-----------|-----------------|
| Monorepo | npm workspaces + concurrently | concurrently ^8.2.2 |
| Backend runtime | Node.js + TypeScript | tsx ^4.21.0, tsc ^5.3.3 |
| Backend framework | Express.js | ^4.18.2 |
| Security / middleware | helmet, cors, morgan, express-rate-limit | ^7.1.0, ^2.8.5, ^1.10.0, ^7.2.0 |
| Validation | Zod + express-validator | ^3.22.4, ^7.0.1 |
| ORM | Prisma | ^6.19.2 |
| Database | PostgreSQL (Neon serverless) | pooled + direct URLs |
| Auth | jsonwebtoken + bcryptjs | ^9.0.2, ^2.4.3 |
| OTP / SMS | Twilio (or stub) | ^5.12.2 |
| Payments | Safepay (JazzCash, EasyPaisa, cards) or stub | custom integration |
| WhatsApp | Twilio / Meta Cloud API or stub | configurable provider |
| Real-time | SSE via custom SSEManager | no WebSockets |
| Frontend framework | Next.js 14 App Router | 14.2.35 |
| UI | React 18 + Tailwind CSS | ^18.2.0, ^3.4.1 |
| State | Zustand | ^4.5.0 |
| Server state | TanStack React Query v5 | ^5.99.0 |
| HTTP client | Axios (per-panel isolated instances) | ^1.15.0 |
| Animations | Framer Motion | ^11.0.0 |
| Charts | Recharts | ^3.8.1 |
| Toasts | react-hot-toast | ^2.4.1 |
| Icons | lucide-react | ^0.323.0 |
| Offline queue | idb-keyval | ^6.2.2 |
| Virtual lists | @tanstack/react-virtual | ^3.13.24 |
| E2E testing | Playwright + @axe-core/playwright | ^1.59.1, ^4.11.2 |

---

## Monorepo Structure

```
cheezyhub/
├── package.json                  # Workspaces root — scripts + concurrently
├── backend/
│   ├── package.json
│   ├── railway.json              # Railway deployment config
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── seed.ts
│   │   └── migrations/
│   └── src/
│       ├── index.ts              # Express app entry — route registration order matters
│       ├── routes/               # addresses, admin, adminDrivers, auth, counter,
│       │                         # deals, delivery, favourites, kitchen, menu,
│       │                         # orders, payments, sse, tickets
│       └── services/             # assignmentService, inventoryService,
│                                 # orderLifecycle, otpService, paymentService,
│                                 # radiusService, settlementService, sseManager, whatsapp
├── frontend/
│   ├── package.json
│   ├── vercel.json               # Vercel deployment config
│   └── src/
│       ├── app/
│       │   ├── customer/
│       │   ├── counter/
│       │   ├── kitchen/
│       │   ├── delivery/
│       │   └── admin/
│       ├── components/
│       │   └── customer/, counter/, kitchen/, delivery/, admin/, ui/
│       ├── store/                # adminStore, authStore, cartStore, counterStore,
│       │                         # deliveryStore, kitchenStore, offlineQueueStore
│       ├── lib/
│       │   └── api.ts            # All axios instances and typed API helpers
│       └── hooks/
│           └── useSSE.ts
└── shared/
    └── types/index.ts
```

---

## Prerequisites

- Node.js 18+
- npm 9+
- PostgreSQL database (Neon serverless recommended — requires both a pooled URL and a direct URL)

---

## Environment Setup

### Backend — `backend/.env`

Copy `backend/.env.example` to `backend/.env` and fill in:

```env
# Database
DATABASE_URL=          # Pooled connection string (pgbouncer=true)
DIRECT_URL=            # Direct connection string for Prisma migrations

# Server
PORT=4000
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000

# Auth — generate with: openssl rand -base64 32
JWT_SECRET=
JWT_EXPIRES_IN=7d
BCRYPT_ROUNDS=10

# OTP — generate with: openssl rand -hex 32
OTP_SECRET=
OTP_PROVIDER=stub      # stub | twilio_verify | twilio_sms
TWILIO_SID=
TWILIO_TOKEN=
TWILIO_VERIFY_SID=

# WhatsApp
WHATSAPP_PROVIDER=stub # stub | twilio | meta
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
META_WHATSAPP_TOKEN=
META_PHONE_NUMBER_ID=

# Payments (Safepay — covers JazzCash, EasyPaisa, Pakistani bank cards)
PAYMENT_PROVIDER=stub  # stub | safepay
SAFEPAY_SECRET_KEY=
SAFEPAY_ENVIRONMENT=sandbox
SAFEPAY_WEBHOOK_SECRET=

# URLs
FRONTEND_URL=http://localhost:3000
```

### Frontend — `frontend/.env.local`

Copy `frontend/.env.local.example` to `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:4000/api
NEXT_PUBLIC_GOOGLE_MAPS_KEY=your-google-maps-api-key
```

---

## Getting Started

```bash
# Install all workspace dependencies from the repo root
npm run install-all

# Start both servers concurrently (backend :4000, frontend :3000)
npm run dev

# Or start individually
npm run dev:backend
npm run dev:frontend
```

---

## Database

```bash
# Apply migrations
cd backend && npx prisma migrate dev

# Regenerate Prisma client after any schema change
npm run db:generate

# Seed the database
npm run db:seed
```

### Prisma Models

| Model | Purpose |
|-------|---------|
| `User` | Customer accounts — mobile/email, OTP fields, live location, tags |
| `Staff` | All non-customer roles: kitchen, delivery, admin, cashier — includes driver-specific fields |
| `Order` | Core order record — type, status, payment fields, offline sync flag |
| `OrderItem` | Line items with modifier snapshot |
| `MenuItem` | Menu items with price, image, availability, sort order |
| `Category` | Menu categories with sort order |
| `ModifierGroup` | Grouping of option sets per menu item (required / multi-select) |
| `Modifier` | Individual option with price adjustment |
| `Shift` | Cashier shift — opening float, closing cash, discrepancy |
| `LedgerEntry` | Per-order payment record tied to a shift |
| `Payment` | Safepay / cash payment record per order |
| `Ticket` | Customer support ticket with priority and status |
| `TicketMessage` | Individual messages within a ticket thread |
| `Deal` | Promotions — combo, discount, featured; slider / section display |
| `Address` | Customer saved addresses with GPS coordinates |
| `DriverSettlement` | COD settlement records per driver |
| `HolidayRequest` | Driver leave requests with admin review |
| `SystemSettings` | Restaurant-wide config: delivery fee, radius, open/closed, prep time |
| `OfflineSyncLog` | Idempotency log for counter POS offline order sync |
| `NotificationLog` | WhatsApp notification dispatch log |
| `Favourite` | Customer menu item favourites (unique per user+item) |

---

## The 5 Panels

### Customer — `/customer`
- **Cookie:** `ch_token`
- **Users:** Registered customers and guests
- OTP-based phone registration; PIN login for returning customers
- Full menu browsing with deals, modifier selection, cart, offline order queue
- Live order tracking via SSE; address book; favourites; support ticket creation

### Counter — `/counter`
- **Cookie:** `ch_counter_token`
- **Users:** Cashier / POS staff
- Place walk-in and dine-in orders with item search and modifier support
- Shift management — open/close float, per-shift sales totals and ledger
- Offline order queue syncs to server when connectivity is restored

### Kitchen — `/kitchen`
- **Cookie:** `ch_kitchen_token`
- **Users:** Kitchen crew
- Real-time order queue sorted by priority; advance each order through preparing → ready
- Toggle item availability (marks items as unavailable in real time)
- SSE-driven updates — no manual refresh needed

### Delivery — `/delivery`
- **Cookie:** `ch_delivery_token`
- **Users:** Delivery drivers
- View assigned orders; update delivery status (assigned → picked up → delivered)
- COD wallet tracking; earnings summary; holiday request submission
- Profile with vehicle details and document upload for admin verification

### Admin — `/admin`
- **Cookie:** `ch_admin_token`
- **Users:** Restaurant owner / manager
- Full CRUD: menu items, categories, modifiers, deals, staff, drivers, customers
- Analytics dashboard with revenue charts (Recharts); driver settlement flow
- Support ticket management; system settings (delivery fee, radius, open/closed toggle)

---

## API Routes

| Route file | Handles |
|-----------|---------|
| `auth.ts` | Customer OTP flow, staff PIN login, token refresh |
| `menu.ts` | Public menu listing, category and item CRUD (admin) |
| `orders.ts` | Order creation, status reads, customer order history |
| `kitchen.ts` | Kitchen queue, status advancement, item availability toggles |
| `delivery.ts` | Driver order list, status updates, earnings, COD, holidays, profile |
| `admin.ts` | Staff, customer, settings CRUD; analytics endpoints |
| `adminDrivers.ts` | Driver verification, settlement, assignment override |
| `counter.ts` | POS order placement, shift open/close, ledger, offline sync |
| `payments.ts` | Safepay initiation and webhook handler (registered before JSON parser) |
| `tickets.ts` | Ticket creation, messaging, status updates |
| `deals.ts` | Deal CRUD and public deals listing |
| `addresses.ts` | Customer address book CRUD |
| `favourites.ts` | Customer favourites add/remove/list |
| `sse.ts` | SSE endpoint — clients connect with `?token=` query param |

---

## Key Concepts

### SSE (Server-Sent Events)
All real-time updates flow through `backend/src/services/sseManager.ts`. Clients connect to `GET /sse?token=<jwt>` — the token is passed as a query param because `EventSource` does not support custom headers. `orderLifecycle.ts` is the single place where order status transitions and SSE broadcasts happen together.

### Zustand Stores
One store per panel: `authStore`, `cartStore`, `kitchenStore`, `deliveryStore`, `counterStore`, `adminStore`, `offlineQueueStore`. Stores are isolated and do not share state across panels.

### Isolated Auth
Each panel has its own JWT stored in its own cookie. `frontend/src/lib/api.ts` exports a separate axios instance per panel (`deliveryApi_http`, `kitchenApi_http`, `adminApi_http`, `counterApi_http`, default `api` for customer). All new API calls must be added as typed helpers in `api.ts` — never inline raw axios calls in components.

### Offline Queue
The counter panel stores unsynced orders in IndexedDB via `idb-keyval` (managed by `offlineQueueStore`). On reconnect, the queue is flushed to the server using an idempotency key logged in `OfflineSyncLog`.

---

## Deployment

### Backend — Railway

`backend/railway.json` configures:
- **Builder:** Nixpacks
- **Start command:** `npm run start` (runs compiled `dist/index.js`)
- **Health check:** `GET /health` with 30 s timeout
- **Restart policy:** On failure, max 3 retries

Set all variables from `backend/.env.example` as Railway environment variables. Use the Neon **pooled** URL for `DATABASE_URL` and the **direct** URL for `DIRECT_URL`.

### Frontend — Vercel

`frontend/vercel.json` configures:
- **Framework:** Next.js
- **Build command:** `npm run build`
- **Output directory:** `.next`
- **Region:** `sin1` (Singapore)
- **Service worker header:** `Service-Worker-Allowed: /` with no-cache policy on `/sw.js`

Set `NEXT_PUBLIC_API_URL` to your Railway backend URL and `NEXT_PUBLIC_GOOGLE_MAPS_KEY` in Vercel environment variables.

---

## Common Issues

**TypeScript import error on Charts**
Use `@/components/admin/Charts` not `@/components/Charts`. All panel components live under their panel subfolder.

**Prisma: stale types after schema change**
Always run `npx prisma generate` (or `npm run db:generate`) after any change to `schema.prisma`. The client is not auto-regenerated on save.

**SSE drops or rejects immediately**
SSE connections authenticate via `?token=<jwt>` query param. If the token is missing or expired the connection is rejected. Do not pass auth via a request header — `EventSource` does not support it.

**Panel API calls hitting the wrong session**
Each panel must use its own axios instance from `api.ts`. Importing the default `api` instance in a kitchen or delivery component will send the wrong cookie and receive 401 errors.

**Safepay webhook rejected**
The Safepay webhook route must be registered before `express.json()` in `backend/src/index.ts` so the raw request body is available for signature verification.
