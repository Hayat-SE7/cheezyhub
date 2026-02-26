# 🧀 CheezyHub — Complete Beginner's Guide
## Setup, Folder Structure & Everything Explained

---

## 📁 WHAT IS THIS PROJECT?

CheezyHub is a **full-stack web application** for a restaurant. Think of it like building your own version of UberEats, but for just one restaurant.

It has **4 separate user panels**:
| Panel | Who uses it? | Style |
|---|---|---|
| Customer | People ordering food | Light, modern, mobile-friendly |
| Kitchen | Chefs watching orders come in | Dark, big screen, fast |
| Delivery | Drivers picking up orders | Dark, simple, mobile |
| Admin | Restaurant owner | Dark, full control |

---

## 🗂️ FOLDER STRUCTURE EXPLAINED (like you're 10)

```
cheezyhub/                     ← Root folder (the whole project)
│
├── 📄 package.json            ← Monorepo config. Lets you run both apps together.
├── 📄 README.md               ← This guide!
│
├── 📁 backend/                ← The SERVER. Handles data, logic, database.
│   │                            (Users never see this. It's the engine.)
│   │
│   ├── 📄 package.json        ← List of all backend libraries (express, prisma, etc.)
│   ├── 📄 tsconfig.json       ← TypeScript settings (tells TS how to compile)
│   ├── 📄 .env.example        ← Template for secret settings (passwords, keys)
│   │
│   ├── 📁 prisma/             ← DATABASE stuff
│   │   ├── schema.prisma      ← The "blueprint" of your database tables
│   │   └── seed.ts            ← Starter data (sample menu, default accounts)
│   │
│   └── 📁 src/               ← All backend code lives here
│       ├── 📄 index.ts        ← ENTRY POINT. This starts the server.
│       │
│       ├── 📁 config/
│       │   └── db.ts          ← Connects to the database (Prisma client)
│       │
│       ├── 📁 middleware/     ← Code that runs BEFORE your routes
│       │   ├── auth.ts        ← Checks if user is logged in (JWT token)
│       │   ├── errorHandler.ts← Catches errors and sends nice messages
│       │   └── notFound.ts    ← Handles 404 "page not found" errors
│       │
│       ├── 📁 routes/         ← URL handlers. Each file = one feature area.
│       │   ├── auth.ts        ← /api/auth/login and /api/auth/register
│       │   ├── menu.ts        ← /api/menu - get items, update availability
│       │   ├── orders.ts      ← /api/orders - place orders, view history
│       │   ├── kitchen.ts     ← /api/kitchen - kitchen queue, status changes
│       │   ├── delivery.ts    ← /api/delivery - driver pickups, deliveries
│       │   ├── admin.ts       ← /api/admin - full control panel
│       │   ├── tickets.ts     ← /api/tickets - support system
│       │   └── sse.ts         ← /api/sse/connect - real-time connection
│       │
│       └── 📁 services/       ← Reusable helper functions
│           ├── sseManager.ts  ← Manages live connections (who gets notified)
│           └── whatsapp.ts    ← Sends WhatsApp messages (stub ready)
│
├── 📁 frontend/               ← The WEBSITE. What users actually see.
│   │                            Built with Next.js (React framework)
│   │
│   ├── 📄 package.json        ← Frontend libraries (react, tailwind, etc.)
│   ├── 📄 next.config.js      ← Next.js settings
│   ├── 📄 tailwind.config.js  ← Design system (colors, fonts, animations)
│   ├── 📄 postcss.config.js   ← Required for Tailwind CSS to work
│   ├── 📄 .env.local.example  ← Frontend environment variables
│   │
│   └── 📁 src/
│       ├── 📁 app/            ← PAGES. Each folder = one URL path.
│       │   │
│       │   ├── layout.tsx     ← Root layout (wraps ALL pages)
│       │   ├── globals.css    ← Global styles & animations
│       │   ├── page.tsx       ← Homepage (redirects to /customer)
│       │   │
│       │   ├── 📁 customer/   ← Everything at /customer/...
│       │   │   ├── layout.tsx       → Header + bottom navigation bar
│       │   │   ├── page.tsx         → Menu page (browse food)
│       │   │   ├── login/page.tsx   → Login & Register page
│       │   │   ├── cart/page.tsx    → Shopping cart + checkout
│       │   │   ├── orders/page.tsx  → Order history + live tracking
│       │   │   ├── support/page.tsx → Create support tickets
│       │   │   └── profile/page.tsx → User profile & logout
│       │   │
│       │   ├── 📁 kitchen/    ← Everything at /kitchen/...
│       │   │   ├── layout.tsx       → Dark wrapper
│       │   │   ├── page.tsx         → Live order queue (Kanban board)
│       │   │   └── login/page.tsx   → Staff PIN login
│       │   │
│       │   ├── 📁 delivery/   ← Everything at /delivery/...
│       │   │   ├── layout.tsx       → Dark wrapper
│       │   │   ├── page.tsx         → Active deliveries + Maps button
│       │   │   └── login/page.tsx   → Driver PIN login
│       │   │
│       │   └── 📁 admin/      ← Everything at /admin/...
│       │       ├── layout.tsx       → Dark layout with sidebar menu
│       │       ├── page.tsx         → Dashboard with stats
│       │       └── login/page.tsx   → Admin PIN login
│       │
│       ├── 📁 components/     ← Reusable UI building blocks
│       │   ├── customer/
│       │   │   ├── MenuItemCard.tsx  → Food card with image, price, modifiers
│       │   │   └── CategoryTabs.tsx  → Scrollable category filter tabs
│       │   ├── kitchen/       → (add KitchenOrderCard here later)
│       │   ├── delivery/      → (add DeliveryCard here later)
│       │   ├── admin/         → (add AdminTable here later)
│       │   └── ui/            → (shared: Button, Modal, Badge, etc.)
│       │
│       ├── 📁 hooks/          ← Custom React hooks (reusable logic)
│       │   └── useSSE.ts      → Hook for real-time updates via SSE
│       │
│       ├── 📁 lib/            ← Utility/helper files
│       │   └── api.ts         → Axios HTTP client + all API calls
│       │
│       ├── 📁 store/          ← Global state management (Zustand)
│       │   ├── authStore.ts   → Stores logged-in user info & JWT token
│       │   └── cartStore.ts   → Shopping cart items, quantities, totals
│       │
│       └── 📁 types/          ← TypeScript type definitions (if needed)
│
└── 📁 shared/                 ← Shared between backend AND frontend
    └── types/
        └── index.ts           ← All TypeScript interfaces (Order, User, etc.)
```

---

## 🔧 SETUP GUIDE (Step by Step)

### What You Need First

Before you start, install these on your computer:

1. **Node.js** (version 18 or higher)
   - Go to https://nodejs.org → Download the LTS version → Install it
   - Verify: open Terminal, type `node --version` → should show v18.x.x

2. **PostgreSQL** (the database)
   - Go to https://www.postgresql.org/download/
   - Install it, remember your password!
   - Or use https://neon.tech for a free cloud database (easier for beginners)

3. **Git** (optional but recommended)
   - https://git-scm.com/downloads

---

### Step 1: Extract the Project

Unzip `cheezyhub-scaffold.zip` somewhere on your computer, like your Desktop.

Open **Terminal** (Mac/Linux) or **Command Prompt** (Windows) and navigate there:

```bash
cd Desktop/cheezyhub
```

---

### Step 2: Set Up the Database

#### Option A: Local PostgreSQL
Open your PostgreSQL tool (pgAdmin or command line) and create a database:

```sql
CREATE DATABASE cheezyhub;
```

Your connection URL will be:
```
postgresql://postgres:YOUR_PASSWORD@localhost:5432/cheezyhub
```

#### Option B: Free Cloud Database (Neon - Easier!)
1. Go to https://neon.tech → Sign up (free)
2. Create a project → Copy the "Connection string" (it looks like postgresql://...)
3. Use that as your DATABASE_URL

---

### Step 3: Configure the Backend

```bash
cd backend
```

Create your environment file:
```bash
cp .env.example .env
```

Open `.env` in any text editor (VS Code, Notepad++, etc.) and fill in:

```env
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/cheezyhub"
JWT_SECRET="make-this-a-long-random-string-like-abc123xyz789"
PORT=4000
CORS_ORIGIN=http://localhost:3000
NODE_ENV=development
```

> 💡 The JWT_SECRET can be anything long and random. It's used to sign login tokens.
> Example: `my-super-secret-key-cheezyhub-2024-xyz`

---

### Step 4: Install Backend Dependencies

Still inside the `backend` folder:

```bash
npm install
```

This downloads all the libraries listed in `package.json`. Takes 1-2 minutes.

---

### Step 5: Set Up the Database Tables

```bash
# Generate the Prisma client (creates TypeScript types from your schema)
npm run db:generate

# Create all the database tables
npm run db:migrate
```

When asked for a migration name, type something like: `initial`

---

### Step 6: Add Sample Data (Seed)

```bash
npm run db:seed
```

This creates:
- ✅ Default admin account (username: `admin`, PIN: `1234`)
- ✅ Kitchen account (username: `kitchen1`, PIN: `5678`)
- ✅ Driver account (username: `driver1`, PIN: `9012`)
- ✅ Sample menu with burgers, pizza, sides, drinks

---

### Step 7: Start the Backend Server

```bash
npm run dev
```

You should see:
```
🧀 CheezyHub API running on http://localhost:4000
```

**Don't close this terminal!** Keep it running.

---

### Step 8: Set Up the Frontend

Open a **NEW terminal window** and go to the frontend folder:

```bash
cd Desktop/cheezyhub/frontend
```

Create environment file:
```bash
cp .env.local.example .env.local
```

The `.env.local` file should already have the right default:
```env
NEXT_PUBLIC_API_URL=http://localhost:4000/api
```

Install dependencies:
```bash
npm install
```

Start the frontend:
```bash
npm run dev
```

You should see:
```
- Local: http://localhost:3000
```

---

### Step 9: Open the App!

Open your browser and go to:

| URL | What you'll see |
|---|---|
| `http://localhost:3000/customer` | Customer menu (register a new account!) |
| `http://localhost:3000/customer/login` | Login / Register |
| `http://localhost:3000/kitchen` | Kitchen panel (use kitchen1 / 5678) |
| `http://localhost:3000/kitchen/login` | Kitchen staff login |
| `http://localhost:3000/delivery/login` | Delivery driver login (driver1 / 9012) |
| `http://localhost:3000/admin/login` | Admin panel (admin / 1234) |

---

## 🔄 HOW THE REAL-TIME SYSTEM WORKS

When you place an order, this is what happens:

```
You click "Place Order" on the website
       ↓
Frontend sends HTTP POST to backend (http://localhost:4000/api/orders)
       ↓
Backend saves order to PostgreSQL database
       ↓
Backend sends SSE event "ORDER_CREATED" to kitchen
       ↓
Kitchen screen instantly shows the new order card (no page refresh!)
       ↓
Chef clicks "Start Preparing" → sends PATCH to backend
       ↓
Backend sends "ORDER_UPDATED" to everyone who needs to know
       ↓
Your order page shows "Being Prepared" in real-time!
```

**SSE = Server-Sent Events** — It's like a phone call that stays open. The server can push updates to the browser at any time without the browser having to keep asking.

---

## 🛠️ TECH STACK EXPLAINED

### Backend Technologies

| Technology | What it does | Analogy |
|---|---|---|
| **Node.js** | Runs JavaScript on the server | The engine of a car |
| **Express** | Web framework, handles HTTP requests | The steering wheel |
| **TypeScript** | JavaScript with types (catches bugs early) | Spell-check for code |
| **Prisma** | Talks to your database easily | A translator |
| **PostgreSQL** | Stores all your data permanently | A giant spreadsheet |
| **JWT** | Secure login tokens | A wristband at a concert |
| **bcrypt** | Encrypts passwords | A padlock |
| **SSE** | Real-time server→browser messages | A live radio broadcast |
| **Zod** | Validates incoming data | A bouncer at the door |

### Frontend Technologies

| Technology | What it does | Analogy |
|---|---|---|
| **Next.js** | React framework with routing | A car with GPS built in |
| **React** | Builds interactive UI components | LEGO bricks |
| **TypeScript** | Types for React code | Labels on your LEGO bricks |
| **Tailwind CSS** | Style with utility classes in HTML | Pre-made outfit pieces |
| **Zustand** | Global state management | A shared whiteboard |
| **Axios** | Makes HTTP requests to backend | A delivery person |
| **Framer Motion** | Animations | A choreographer |
| **date-fns** | Formats dates/times | A clock translator |

---

## 📝 COMMON BEGINNER MISTAKES & FIXES

### ❌ "Cannot connect to database"
**Fix:** Check your `DATABASE_URL` in `.env`. Make sure PostgreSQL is running.
```bash
# On Mac:
brew services start postgresql

# On Windows: Open "Services" and start PostgreSQL
```

### ❌ "Port 4000 is already in use"
**Fix:** Change `PORT=4001` in your `.env` file, and update `NEXT_PUBLIC_API_URL=http://localhost:4001/api` in frontend `.env.local`

### ❌ "Module not found" errors
**Fix:** You forgot to run `npm install`!
```bash
cd backend && npm install
cd ../frontend && npm install
```

### ❌ "Invalid token" when logging in
**Fix:** Make sure both `.env` files are created and `JWT_SECRET` is set.

### ❌ Real-time updates not working
**Fix:** The SSE connection uses your JWT token. Make sure you're logged in first.

### ❌ Kitchen panel shows blank
**Fix:** Log in to kitchen first at `/kitchen/login` with `kitchen1` / `5678`

---

## 🎨 HOW TO CUSTOMIZE

### Change Colors
Open `frontend/tailwind.config.js` and find the `cheeze` colors:
```js
cheeze: {
  500: '#f59e0b',  // ← Change this hex code to any color you want!
}
```

### Add a Menu Category
After running the seed, log into admin at `/admin/login` → Menu → Add Category

Or directly in the database using Prisma Studio:
```bash
cd backend
npm run db:studio
```
This opens a visual database editor at `http://localhost:5555`

### Change Restaurant Name
Edit `backend/.env`:
```env
RESTAURANT_NAME="My Pizza Place"
```

### Connect Real WhatsApp
Open `backend/src/services/whatsapp.ts` and replace the stub `sendWhatsApp()` function with your provider's API. Options:
- **Twilio** (easy, popular): https://www.twilio.com/whatsapp
- **WhatsApp Cloud API** (free, direct from Meta): https://developers.facebook.com/docs/whatsapp

---

## 🚀 RUNNING BOTH AT ONCE (Optional Shortcut)

From the root `cheezyhub/` folder, if you install `concurrently`:

```bash
cd cheezyhub
npm install
npm run dev
```

This starts both backend and frontend simultaneously!

---

## 📊 HOW THE DATABASE WORKS

The `schema.prisma` file defines your tables. Think of each `model` as a spreadsheet:

```
User Table:
┌─────┬────────┬──────────┬──────────┐
│ id  │ name   │ mobile   │ pinHash  │
├─────┼────────┼──────────┼──────────┤
│ abc │ Ahmed  │ 03001234 │ $2b$...  │
│ def │ Sara   │ 03009876 │ $2b$...  │
└─────┴────────┴──────────┴──────────┘

Order Table:
┌─────┬──────────────┬────────┬──────────┐
│ id  │ orderNumber  │ total  │ status   │
├─────┼──────────────┼────────┼──────────┤
│ xyz │ CH-ABC123    │ 25.99  │ pending  │
└─────┴──────────────┴────────┴──────────┘
```

When you run `npm run db:migrate`, Prisma reads your schema and creates these actual tables in PostgreSQL.

---

## 🔐 HOW LOGIN WORKS (Simplified)

1. You enter mobile + PIN on the login page
2. Frontend sends `{ identifier: "0300...", pin: "1234" }` to `/api/auth/login`
3. Backend finds the user in the database
4. Backend uses `bcrypt` to check if the PIN matches the stored hash
5. If correct → backend creates a JWT token (a long encrypted string)
6. Frontend stores this token in a cookie
7. Every future request includes `Authorization: Bearer <token>`
8. Backend verifies the token on every protected route

---

## 📱 MAKING IT PRODUCTION-READY (Future Steps)

When you want to deploy publicly:

1. **Backend hosting**: Railway, Render, or DigitalOcean
2. **Database**: Neon (free), Supabase, or Railway PostgreSQL
3. **Frontend hosting**: Vercel (perfect for Next.js, free tier)
4. **Domain**: Buy from Namecheap or Google Domains
5. **WhatsApp**: Connect real Twilio/WhatsApp API
6. **Payments**: Add Stripe (the code is already structured for it!)

---

## 💡 NEXT THINGS TO BUILD

The scaffold is complete. Here's what to add next (in order of priority):

1. ✅ **Admin: Menu CRUD** — Add/Edit/Delete menu items with image upload
2. ✅ **Admin: Order management** — Assign drivers, cancel orders
3. ✅ **Admin: Staff management** — Create kitchen/delivery accounts
4. ✅ **Admin: Settings** — Delivery fee, radius, opening hours
5. **Image uploads** — Use Cloudinary or AWS S3
6. **Stripe payments** — Card payments at checkout
7. **Push notifications** — Service Worker + Web Push API
8. **Analytics** — Charts for daily revenue, popular items

---

*Happy building! If something breaks, check the browser console (F12) and the backend terminal for error messages. 99% of issues are missing `.env` variables or database connection problems.*
