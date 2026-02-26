# 🧀 CheezyHub — Smart Restaurant Ordering System

A full-stack, real-time restaurant ordering platform with customer, kitchen, delivery, and admin modules.

---

## Architecture

```
cheezyhub/
├── backend/          Node.js + Express + TypeScript + Prisma
│   ├── prisma/       Schema + migrations + seed
│   └── src/
│       ├── config/   DB client
│       ├── middleware/ Auth + error handling
│       ├── routes/   auth, menu, orders, kitchen, delivery, admin, tickets, sse
│       ├── services/ SSE manager + WhatsApp notifications
│       └── index.ts  Express app entry
│
├── frontend/         Next.js 14 + TypeScript + Tailwind
│   └── src/
│       ├── app/
│       │   ├── customer/   Light mode UI (menu, cart, orders, support, profile)
│       │   ├── kitchen/    Dark mode dashboard (live queue)
│       │   ├── delivery/   Dark mode panel (pickups, maps)
│       │   └── admin/      Dark mode control center
│       ├── components/     UI components per module
│       ├── hooks/          useSSE (real-time)
│       ├── lib/            API client + typed helpers
│       └── store/          Zustand (auth + cart)
│
└── shared/
    └── types/        Shared TypeScript interfaces
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14, React 18, TypeScript, Tailwind CSS |
| State | Zustand (auth, cart) |
| Backend | Node.js, Express, TypeScript |
| Database | PostgreSQL via Prisma ORM |
| Realtime | Server-Sent Events (SSE) |
| Auth | JWT + PIN-based login |
| Notifications | WhatsApp (stub — plug in provider) |
| Navigation | Google Maps redirect |

---

## Quick Start

### 1. Prerequisites

- Node.js 18+
- PostgreSQL 14+
- pnpm (or npm)

### 2. Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Copy environment file
cp .env.example .env
# Edit .env with your DATABASE_URL and JWT_SECRET

# Generate Prisma client
npm run db:generate

# Run migrations
npm run db:migrate

# Seed with sample data
npm run db:seed

# Start dev server
npm run dev
# → API running at http://localhost:4000
```

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Copy environment file
cp .env.local.example .env.local
# Edit NEXT_PUBLIC_API_URL if backend is not on localhost:4000

# Start dev server
npm run dev
# → App running at http://localhost:3000
```

---

## Access URLs

| Module | URL | Login |
|---|---|---|
| Customer | http://localhost:3000/customer | Register or use any account |
| Customer Login | http://localhost:3000/customer/login | Mobile/email + PIN |
| Kitchen Panel | http://localhost:3000/kitchen | `kitchen1` / `5678` |
| Delivery Panel | http://localhost:3000/delivery | `driver1` / `9012` |
| Admin Panel | http://localhost:3000/admin | `admin` / `1234` |

---

## API Endpoints

### Auth
- `POST /api/auth/register` — customer registration
- `POST /api/auth/login` — all roles

### Menu
- `GET  /api/menu` — public menu
- `POST /api/menu/items` — create item (admin)
- `PATCH /api/menu/items/:id/availability` — toggle (kitchen/admin)
- `PATCH /api/menu/modifiers/:id/availability` — toggle modifier (kitchen/admin)

### Orders
- `POST /api/orders` — place order (customer)
- `GET  /api/orders` — my orders (customer)
- `GET  /api/orders/:id` — order detail

### Kitchen
- `GET  /api/kitchen/orders` — live queue
- `PATCH /api/kitchen/orders/:id/status` — update status
- `PATCH /api/kitchen/pause` — toggle order acceptance

### Delivery
- `GET  /api/delivery/orders` — my deliveries
- `PATCH /api/delivery/orders/:id/status` — picked_up / delivered

### Admin
- `GET  /api/admin/stats` — dashboard metrics
- `GET  /api/admin/orders` — all orders (paginated)
- `PATCH /api/admin/orders/:id/assign` — assign driver
- `PATCH /api/admin/orders/:id/cancel` — cancel
- `POST /api/admin/staff` — create staff account
- `GET  /api/admin/settings` — system settings
- `PATCH /api/admin/settings` — update settings

### Tickets
- `POST /api/tickets` — create ticket (customer)
- `GET  /api/tickets` — all tickets (role-filtered)
- `POST /api/tickets/:id/reply` — reply

### SSE
- `GET /api/sse/connect?token=JWT` — real-time stream

---

## Order Flow

```
Customer places order
  → Kitchen receives as "pending"     [SSE: ORDER_CREATED]
  → Kitchen moves to "preparing"      [SSE: ORDER_UPDATED]
  → Kitchen marks "ready"             [SSE: ORDER_UPDATED → delivery]
  → Admin assigns driver              [SSE: ORDER_ASSIGNED → driver]
  → Driver marks "picked_up"          [WhatsApp: Out for Delivery]
  → Driver marks "delivered"
  → System auto-completes order       [SSE: ORDER_UPDATED → customer]
```

---

## WhatsApp Integration

Edit `backend/src/services/whatsapp.ts` and replace the `sendWhatsApp()` stub with your provider (Twilio, WABA Cloud API, etc.).

Triggered on:
1. Order confirmed → customer
2. Order picked up (out for delivery) → customer  
3. Admin ticket reply → customer

---

## Environment Variables

### Backend (`backend/.env`)
```
DATABASE_URL=postgresql://...
JWT_SECRET=...
WHATSAPP_API_URL=...
WHATSAPP_API_TOKEN=...
```

### Frontend (`frontend/.env.local`)
```
NEXT_PUBLIC_API_URL=http://localhost:4000/api
NEXT_PUBLIC_GOOGLE_MAPS_KEY=...
```

---

## Future Roadmap

- [ ] Stripe payment integration
- [ ] Mobile app (React Native)
- [ ] Multi-language support
- [ ] Push notifications
- [ ] Analytics dashboard
- [ ] Loyalty program
