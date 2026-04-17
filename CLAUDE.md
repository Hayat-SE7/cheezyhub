# CheezyHub — CLAUDE.md

## Project Overview

CheezyHub is a full-stack, single-restaurant smart ordering system built as a monorepo with an npm workspaces setup. It is actively in development and currently in a debug/enhancement phase.

### Tech Stack

**Monorepo root:** npm workspaces (`backend` + `frontend`), `concurrently` for parallel dev servers.

**Backend (`/backend`):**
- Runtime: Node.js with TypeScript (`tsx watch` for dev, `tsc` for build)
- Framework: Express.js with `helmet`, `cors`, `morgan`, `express-rate-limit`, `express-validator`
- ORM: Prisma with PostgreSQL (hosted on Neon — pooled + direct URLs)
- Auth: JWT (`jsonwebtoken`) + bcrypt PIN-based auth; OTP phone verification flow (Twilio or stub)
- Payments: Safepay integration (covers Pakistani payment methods: JazzCash, EasyPaisa, bank cards) or stub
- Notifications: WhatsApp via Twilio or Meta Cloud API (or stub)
- Real-time: SSE (Server-Sent Events) via a custom `SSEManager` class that handles per-role client connections with heartbeat and stale connection cleanup
- Validation: Zod schemas + express-validator
- Port: 4000

**Frontend (`/frontend`):**
- Framework: Next.js 14 (App Router), React 18, TypeScript
- Styling: Tailwind CSS
- State: Zustand per-panel stores (`authStore`, `cartStore`, `kitchenStore`, `deliveryStore`, `counterStore`, `adminStore`, `offlineQueueStore`)
- Data fetching: TanStack React Query v5
- HTTP: Axios with per-panel isolated instances (each panel has its own cookie-keyed token and axios instance in `/frontend/src/lib/api.ts`)
- Animations: Framer Motion
- Charts: Recharts
- Toasts: react-hot-toast
- Offline support: `idb-keyval` + `offlineQueueStore`
- Virtual lists: `@tanstack/react-virtual`
- Port: 3000

**Database models (Prisma):** `User`, `Staff`, `Order`, `MenuItem`, `Category`, `ModifierGroup`, `Modifier`, `Address`, `Favourite`, `Ticket`, `Deal`, `Shift`, `LedgerEntry`, `Payment`, `HolidayRequest`

**User roles (enum):** `customer`, `kitchen`, `delivery`, `admin`, `cashier`

**Order types:** `delivery`, `counter`, `dine_in`

### Panel Structure

Five panels, each with its own Next.js route, Zustand store, and isolated API axios instance:

| Panel | Route | Auth Token Cookie | Description |
|-------|-------|------------------|-------------|
| Customer | `/customer` | `ch_token` | Menu, cart, OTP login, order tracking, favourites, addresses, support tickets |
| Counter | `/counter` | `ch_counter_token` | POS cashier interface — place orders, shift management, ledger |
| Kitchen | `/kitchen` | `ch_kitchen_token` | Order queue, prep flow, inventory availability toggles |
| Delivery | `/delivery` | `ch_delivery_token` | Driver app — orders, status, COD wallet, earnings, holidays, profile/verification |
| Admin | `/admin` | `ch_admin_token` | Full CRUD — menu, staff, drivers, customers, deals, analytics, settlements, tickets, settings |

### Backend Route Files

`/backend/src/routes/`: `auth`, `menu`, `orders`, `kitchen`, `delivery`, `admin`, `adminDrivers`, `counter`, `payments`, `tickets`, `sse`, `deals`, `addresses`, `favourites`

### Services

`/backend/src/services/`: `assignmentService` (auto driver assignment), `orderLifecycle` (status transitions + SSE broadcast), `settlementService`, `sseManager`, `otpService`, `paymentService`, `radiusService`, `inventoryService`, `whatsapp`

### Key Architectural Patterns

- **Isolated auth per panel:** Each panel uses a separate JWT stored in a separate cookie. The frontend `api.ts` exports separate axios instances per panel so that a counter login never contaminates a delivery session.
- **SSE for real-time:** All panels receive live updates via SSE. The backend `SSEManager` routes events by `role`; the frontend `useSSE` hook normalizes three call signatures used across the codebase.
- **Shared types:** `/shared/types/index.ts` — shared between frontend and backend.
- **PIN-based staff login:** Staff (kitchen, delivery, cashier, admin) authenticate with `username + PIN`. Customers authenticate with `mobile + OTP` (registration) then `mobile + PIN`.
- **Offline queue:** Customer panel has an offline order queue via `idb-keyval`.
- **Payment flow:** Orders created first, then payment initiated via Safepay or recorded as cash — webhook confirms payment status.
- **Driver assignment:** Automated via `assignmentService` (radius-based); manual override available in admin panel.

### Current State

The project has a complete foundation with all five panels built. It is in a debug and enhancement phase — recent git work is labeled "current state - pre debug." There are TypeScript error logs (`tsc_errors.log`) in both frontend and backend indicating type issues being worked through.

---

## Panel Ownership
Each sub-agent must stay within its assigned panel scope:

| Panel | Domain |
|-------|--------|
| Customer | UI/UX, menu, cart, orders, tracking |
| Counter | Order receipt, payment, status updates |
| Kitchen | Queue management, prep flow, completion |
| Delivery | Driver assignment, routing, confirmation |
| Admin | Reporting, CRUD, user management, config |

Cross-panel changes require orchestrator approval before proceeding.

---

## Task Complexity Classifier

Before writing any code, classify every task using this rubric:

### TIER 1 — Simple
Model: claude-haiku-4-5 | Effort: low

Use when:
- Single file edits, styling, copy changes
- Adding a field to a form or schema
- Straightforward CRUD endpoints
- Fixing a clearly described, isolated bug
- Boilerplate generation (components, routes, models)
- Writing unit tests for existing logic
- Config changes, constants, feature flags
- Renaming or minor restructuring

---

### TIER 2 — Moderate
Model: claude-sonnet-4-6 | Effort: medium

Use when:
- Feature touches 2 to 5 files
- Integration between two or more panels
- State management changes with side effects
- API design and implementation for a new resource
- Refactoring a module that has dependencies
- Debugging behavior that spans multiple components
- Real-time features like websockets or polling
- Auth flows, role-based access, route guards
- Multi-step workflows or form sequences

---

### TIER 3 — Complex
Model: claude-sonnet-4-6 with extended thinking | Effort: high

Use when:
- Sonnet gets stuck or produces incorrect results repeatedly
- Root cause of a bug is deeply unclear after investigation
- Algorithm has complex performance tradeoffs
- Security vulnerability analysis in existing code
- Untangling deeply nested or legacy logic

Tier 3 is a last resort. Only escalate when Sonnet demonstrably fails.

---

### OPUS USAGE RULE
claude-opus-4-6 is reserved exclusively for:
- System-wide architectural decisions affecting all panels
- Designing shared data models, event buses, or API contracts
- Open-ended ambiguous problems with no clear solution path
- High-stakes decisions where being wrong breaks the entire system

Never use Opus for well-defined coding tasks. If you can describe what files to touch and what to do, it is not an Opus task.

---

## Decision Protocol

Before writing a single line of code, always output this block:

## Task Analysis
- Task: [one-line summary]
- Tier: [1 / 2 / 3]
- Reasoning: [why this tier]
- Model: [haiku / sonnet / sonnet with extended thinking]
- Effort: [low / medium / high]
- Panels affected: [list]
- Sub-agents needed: [yes / no — list if yes]

Then proceed with execution.

---

## Sub-Agent Architecture

For Tier 2 and Tier 3 tasks, decompose and spawn sub-agents:

Orchestrator (sonnet)
├── Sub-Agent A → assigned panel (haiku or sonnet)
├── Sub-Agent B → assigned panel (haiku or sonnet)
└── Sub-Agent C → integration or tests (haiku)

Sub-agent rules:
- Each sub-agent handles one isolated, parallelizable subtask
- Sub-agents default to Tier 1 unless their subtask is genuinely complex
- Orchestrator synthesizes all results and handles cross-panel concerns
- Sub-agents must not modify panels outside their assigned scope
- Batch related simple tasks into one Haiku sub-agent instead of multiple Sonnet calls

---

## Cost Discipline

- Always default to the lowest tier that can complete the task correctly
- Upgrade a tier only when genuinely needed, not as a precaution
- If unsure between Tier 1 and Tier 2, start with Tier 1 and escalate only if blocked
- Never use Opus for tasks Sonnet can handle
- Never use Sonnet for tasks Haiku can handle

---

## Session Management & Auto-Save

This is critical. Context limits mid-task cause lost progress and broken states.

### Session Save Triggers
Automatically save a session snapshot when ANY of these occur:
- Context window reaches approximately 70% full
- A major task or sub-task is completed
- Before starting any Tier 2 or Tier 3 task
- Before spawning sub-agents
- When switching between panels
- Every 10 meaningful exchanges regardless of context size

### What to Save
When a save trigger fires, create or overwrite a file called .cheezyhub-session.md in the project root containing:

## Session Snapshot — [timestamp]

### Current Task
[What was being worked on]

### Progress
[What has been completed so far, file by file]

### Files Modified This Session
[List every file touched with a one-line summary of what changed]

### Pending Work
[What still needs to be done to finish the current task]

### Decisions Made
[Any architectural or implementation decisions made this session that future agents must know]

### Known Issues
[Anything broken, incomplete, or intentionally skipped]

### Resume Instructions
[Exact instructions for the next session to pick up without confusion — be specific]

---

### On Session Start
At the beginning of every new session:
1. Check if .cheezyhub-session.md exists in the root
2. If it exists, read it fully before doing anything else
3. Output a resume summary:

## Resuming Session
- Last worked on: [task]
- Completed: [what is done]
- Picking up from: [exact resume point]
- Files to be aware of: [list]

4. Then continue from where the last session left off unless the user says otherwise

### Save Confirmation
Every time a session snapshot is saved, output:
💾 Session saved — [brief reason for save trigger]

---

## Stack Awareness

### Frameworks & Libraries
- **Backend:** Express + Prisma + PostgreSQL (Neon). TypeScript compiled with `tsx` in dev. Zod for request validation. JWT + bcrypt for auth. SSE (not WebSockets) for real-time.
- **Frontend:** Next.js 14 App Router. Tailwind CSS for styling. Zustand for client state. TanStack Query v5 for server state. Axios with isolated per-panel instances.

### Panel Layout in Repo
```
frontend/src/app/
  customer/   — menu, cart, orders, login, profile, support
  counter/    — POS page, shift management
  kitchen/    — order queue
  delivery/   — driver app (earnings, COD, holidays, profile)
  admin/      — full management suite

frontend/src/store/
  authStore.ts, cartStore.ts, kitchenStore.ts, deliveryStore.ts,
  counterStore.ts, adminStore.ts, offlineQueueStore.ts

frontend/src/components/
  customer/, counter/, kitchen/, delivery/, admin/, ui/

backend/src/routes/   — one file per feature area
backend/src/services/ — business logic, SSE broadcasting, payment, OTP
backend/prisma/       — schema.prisma + seed.ts
```

### Shared API Layer
All frontend API calls go through `frontend/src/lib/api.ts`. This file exports:
- A default `api` axios instance (customer, uses `ch_token` cookie)
- Per-panel isolated instances: `deliveryApi_http`, `kitchenApi_http`, `adminApi_http`, `counterApi_http`
- Typed helper objects: `authApi`, `menuApi`, `orderApi`, `kitchenApi`, `deliveryApi`, `adminApi`, `counterApi`, `dealsApi`, `analyticsApi`, `ticketApi`, `addressApi`, `paymentApi`, etc.

**When adding a new API call, add it to the relevant typed helper in `api.ts` — do not create raw axios calls inline in components.**

### Auth Pattern
- Staff login: `POST /auth/login` with `{ identifier, pin, role: 'staff' }` → returns JWT stored in panel-specific cookie
- Customer login: OTP flow — `send-otp` → `verify-otp` → `complete-registration` or `reset-pin`
- Backend middleware: `authenticate` (JWT check) + `requireRole(...roles)` applied per route
- SSE connections pass the JWT as `?token=` query param (EventSource doesn't support headers)

### Database
- PostgreSQL on Neon (serverless). Pooled URL for app, direct URL for migrations.
- Prisma migrations in `backend/prisma/migrations/`
- After any schema change: run `prisma migrate dev` then `prisma generate`
- Two user tables: `User` (customers) and `Staff` (kitchen, delivery, admin, cashier)

### Real-Time
- SSE only — no WebSockets. Backend `SSEManager` in `backend/src/services/sseManager.ts` holds active connections per role.
- `orderLifecycle.ts` is the central place where order status changes and SSE broadcasts happen together.
- Frontend `useSSE` hook (`frontend/src/hooks/`) connects to `/sse` endpoint and handles reconnect, heartbeat, and event routing.

### Critical Files to Know Before Touching Code
| File | Why It Matters |
|------|----------------|
| `backend/src/services/orderLifecycle.ts` | All order status transitions + SSE broadcasts |
| `backend/src/services/sseManager.ts` | SSE client registry — touch carefully |
| `backend/src/services/assignmentService.ts` | Auto driver assignment logic |
| `frontend/src/lib/api.ts` | All API surface — all panels share this file |
| `backend/prisma/schema.prisma` | Schema changes ripple everywhere |
| `backend/src/index.ts` | Route registration order matters (webhook before json parser) |
