# SpaceGo — Premium Workspace Marketplace & PropTech Platform

> **"Find the right space. Make every space work."**  
> A demand-led platform connecting flexible workspace discovery, property activation, verification, and operations.

SpaceGo combines the intuitive discovery of Airbnb, the sophisticated interface of Linear, the polished SaaS analytics of Stripe, and enterprise prop-tech discipline.

---

## 🌟 Core Strategic Differentiators

1. **Demand-Backed Space Activation**: Rather than listing existing supply indiscriminately or recommending blind conversion CapEx, SpaceGo qualifies local customer demand signals first, calculates an explainable **100-Point Activation Score**, provides fit-out coordination, and stages launch.
2. **Space Passport™ Verification**: Every listed workspace features a documented audit record verifying legal property authority, permitted commercial zoning, field-measured internet bandwidth (300+ Mbps redundant fiber), emergency power generator tests, and fire/life safety.
3. **Double-Booking & Conflict-Proof Booking Engine**: Real-time server and client date-range verification ensures no overlapping pending or approved reservations can occur.
4. **Three Stakeholder Portals**:
   - **Space Seeker**: Browse spaces by task, view Space Passports, select dates and capacity, book with dynamic pricing, view QR entry passes, and submit unlisted workspace demand requests.
   - **Property Owner (Host)**: Portfolio dashboard, add/edit listings with photo presets, review pending requests with 1-click approval/decline, manage calendar blocks, simulate unit economics (CapEx payback & net remittance), and track activation projects.
   - **Administrator (Ops)**: Platform-wide GMV ledger, user management, workspace moderation, Demand Intelligence (zero-result searches & requested micro-markets), and 100-Point Activation Matrix scoring.

---

## 🛠️ Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4 with custom design tokens (Midnight Navy `#0B132B`, Warm Slate `#F8FAFC`, Refined Teal `#0D9488`)
- **Icons**: Lucide React
- **Validation**: Zod
- **Database & Auth**: Supabase PostgreSQL & Supabase Auth (with immediate zero-friction resilient offline/demo fallback mode)
- **Delight**: Canvas Confetti

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Run the Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to experience the platform.

### 3. Production Build
```bash
npm run build
npm start
```

---

## 🎭 1-Click Demo Evaluation Accounts

You can switch between any of the 3 platform personas anytime directly from the top navigation role switcher dropdown or the login screen:

| Role | Name | Email | Default View |
|---|---|---|---|
| **Space Seeker (Customer)** | Alex Vance | `alex.seeker@spacego.io` | `/dashboard` |
| **Property Owner (Host)** | Elena Rostova | `elena.owner@spacego.io` | `/owner` |
| **Administrator (Ops)** | Marcus Sterling | `admin@spacego.io` | `/admin` |

---

## 🗄️ Database Architecture & Migrations

The production PostgreSQL migration is available at:
`supabase/migrations/20261108_init.sql`

Tables included:
- `profiles`: Extends `auth.users` with role-based access (`seeker`, `owner`, `admin`).
- `spaces`: Workspaces with categories, coordinates, pricing tiers, operating hours, and Space Passport metadata.
- `space_images`: Image galleries with cover flags.
- `bookings`: Reservations with atomic date validation and status lifecycle (`pending`, `approved`, `declined`, `cancelled`, `completed`).
- `blocked_slots`: Host-reserved maintenance or blackout slots.
- `favourites`: User saved workspace bookmarks.
- `property_activation_requests`: Intake queue for idle properties with 100-point scoring.
- `workspace_enquiries`: Direct demand submissions for unlisted spaces.
- `demand_searches`: Demand intelligence logger recording micro-market queries and zero-result areas.
- `notifications`: User and host notification system.

### Connecting Live Supabase (Optional)
Create a `.env.local` file:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```
Execute `supabase/migrations/20261108_init.sql` in your Supabase SQL Editor.

---

## 📁 Key Routes

- `/` — Premium Homepage with task-first search, Space Passport™ trust pillars, and activation showcase.
- `/spaces` — Interactive Marketplace with filters (category, rate duration, capacity, amenities, verification tier), sorting, and grid/list view.
- `/spaces/[id]` — Workspace Detail with photo gallery modal, Space Passport breakdown, and live conflict-checking booking panel.
- `/activation` — Property Activation Service with 6-step workflow explanation and owner intake form.
- `/activation/track` — Real-time activation request tracker with 100-point scoring matrix breakdown.
- `/dashboard` — Seeker Customer Portal (upcoming bookings, digital QR entry passes, saved spaces, custom requests).
- `/owner` — Host Portal (active listings, pending request approval queue, availability calendar, unit economics calculator).
- `/owner/spaces/new` — Workspace Listing Creation Wizard.
- `/admin` — Operations Console (global GMV ledger, user management, workspace moderation).
- `/admin/activations` — Administrator 100-Point Activation Scorer and stage-gate controller.
- `/admin/demand` — Demand Intelligence Dashboard (top searched locations, requested categories, zero-result unmet demand).
- `/auth/login` & `/auth/register` — Authentication with 1-click test persona quick fill.
