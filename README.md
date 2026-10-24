# Sub Net Shopping

A mobile-first web app that connects shoppers in Benin City with **verified supermarkets**, plus web dashboards for supermarkets, delivery riders and platform admins.

It works on phones and desktop browsers: phones get a compact header and a bottom tab bar; desktops get a full header with search and a category menu, and dashboards get a sidebar.

This repository implements all five phases of the product requirements document (PRD §24–28): **core foundation**, **products & inventory**, **cart & orders**, **payments & pickup**, and **delivery & riders**.

## Phase 5 — Delivery & riders

- **Delivery addresses:** customers save addresses pinned on a map (tap the map or use the phone's GPS), with a landmark and a phone number for the rider.
- **Delivery fee (PRD §14):** (base fee + per-km rate × road distance) × vehicle size, rounded up to ₦50. Road distance is the straight-line distance from the store to the pin × 1.3. Admins set the base fee, per-km rate and maximum distance. The fee is shown before payment and recalculated on the server at checkout.
- **Vehicle matching:** any bulky product (marked by the supermarket, e.g. a TV or fridge) needs a van or truck; more than 25 items needs at least a car. Riders only see jobs their vehicle can carry.
- **Delivery orders are paid online:** riders don't handle cash yet (PRD §17 treats cash as a later addition).
- **Dispatch (PRD §16):** when the supermarket confirms a delivery order, online approved riders with a suitable vehicle are notified and see it on their dashboard with what they'd earn. The first to accept gets it; a rider can hand a job back before pickup. Riders take one delivery at a time.
- **Pickup and drop-off:** the rider can only mark the order picked up once the store has marked it packed. At the door the customer gives their PIN, which completes the delivery. Delivery orders can't be released at the store's pickup counter with that PIN.
- **Live tracking and navigation:** while online, the rider's phone shares GPS. Customers see the rider, store and drop-off on a live map (OpenStreetMap), with the rider's name, vehicle and a call button. Riders get one-tap Google Maps navigation to the store and the customer.
- **Rider earnings and commission (PRD §17):** each job records the delivery fee, the rider commission rate and the rider's earning. Earnings become payable only once the delivery is completed and are voided if the order is cancelled. Admins bundle payable earnings into payouts and mark them paid with a transfer reference; riders see this on their Earnings page.
- **Settlement:** delivery fees are excluded from supermarket sales and commission, so stores are settled on their product sales only.

## Phase 4 — Payments & pickup

Customers choose **Pay now online** (Paystack: card, bank transfer, USSD) or **Pay at the store** at checkout.

- **Online orders** are created as *awaiting payment*, with stock held, and only reach the supermarket once Paystack confirms payment. Confirmation comes from the browser redirect *and* a signed webhook, is always re-verified with Paystack's API, and is applied exactly once (the payment row is locked and stamped). Unpaid orders are cancelled after 30 minutes and their stock released. Before cancelling, each pending payment is checked with Paystack so a missed webhook isn't lost. A payment that lands after expiry restores the order if stock allows, otherwise it's refunded. Duplicate or wrong-amount payments are refunded automatically.
- **Refunds** go out through Paystack when a paid order is cancelled (in full) or the store reduces items (the difference). Refunds that Paystack rejects appear on the admin Payments page with a Retry button.
- **Pickup verification (PRD §13):** every order has a QR code and a 6-digit PIN. Scanning the QR with a phone camera opens the store's pickup screen; staff can also type the PIN. Collection can only be completed with a valid code for a ready, uncollected order at that store, and the code stops working once used. The pickup screen tells staff whether the order is already paid or how much to collect.
- **Digital receipts** that print or save as PDF, stamped from the order's live status (paid, collected / code expired, cancelled / refunded).
- **Commission & settlement (PRD §18):** each order records the supermarket commission rate at checkout. Admins create settlement statements per supermarket from collected orders: online sales minus commission, minus commission owed on pay-at-store sales (negative means the store owes Sub Net). Then they mark them paid with the bank transfer reference. Supermarkets see unsettled earnings and statements on their Earnings page.

## Phase 3 — Cart & orders

Orders are **Reserve & Pick Up** (paid online or at the store) or **delivery** (paid online; see Phase 5).

| Role | Can do |
| --- | --- |
| **Customer** | Add items from any supermarket's listing (from the price comparison or the store's page) · one cart grouped by supermarket, each checked out as its own order · checkout shows pickup address and that payment is at the store, with an optional note · order page with order number, progress, store contact and directions · cancel before the store confirms · order history · notifications at every step |
| **Supermarket** | Order queue (New, Preparing, Ready, Completed, Cancelled) with counts on the dashboard · reduce or remove unavailable items before confirming, with totals recalculated · confirm → mark ready → mark "payment received & collected" · cancel with a reason sent to the customer · notified of new and cancelled orders |
| **Admin** | All orders with status filter · orders today, orders in progress, and collected value on the overview |

Rules enforced on the server: checkout re-reads prices and stock from the database; it's refused when the store is closed, past its last order time, or has pickup paused; tracked stock is reserved at checkout with an atomic decrement (two shoppers can't both get the last item) and returned when items are reduced or orders cancelled; a double-tapped "Place order" creates one order; and order status changes lock the order row so two staff can't act on it at once.

## Phase 2 — Products & inventory

| Role | Can do |
| --- | --- |
| **Customer** | Browse products by category · search products, brands and supermarkets · filter by supermarket and stock, sort by price · **compare one product's price, stock and store status across every supermarket that sells it**, cheapest first · shop a single supermarket's products from its page |
| **Supermarket** | Add products: first search the shared catalogue and "sell this" (so shoppers can compare prices), or create a new product with brand, size, barcode, category, description and photos · set its own SKU, price, stock and status (available, out of stock, hidden) · edit price and stock inline in the product list · **import products from a CSV** exported from a POS or Excel (common POS column names recognised, per-row error report) · see stock counts on the dashboard |
| **Admin** | Manage categories and subcategories · see catalogue totals |

How the catalogue works: a **product** is the shared identity of an item (name, brand, size, barcode, photos), and a **listing** is one supermarket's SKU, price and stock for it. Products are matched across stores by barcode, or when a store picks an existing product. Only the supermarket that created a product can change its shared details. Stock of 5 or fewer shows as "Low stock" and 0 as "Out of stock".

## Phase 1 — Core foundation

| Role | Can do |
| --- | --- |
| **Customer** | Register / sign in · browse approved supermarkets · see open/closed, pickup and delivery status in real time · sort by distance from their location · search by name or area · view a store's hours, contact details and directions · manage profile and password · notifications |
| **Supermarket** | Register (starts **pending approval**) · edit store profile, map location and logo · set weekly hours, last order time, and separate pickup and delivery windows · temporarily close the store · pause delivery or pickup for 30 min / 1 hour / until a time, and resume · record POS/inventory system details |
| **Rider** | Register with vehicle details (starts **pending approval**) · edit vehicle · go online / offline once approved |
| **Admin** | Live platform stats (no demo data) · approve, reject, suspend and reactivate supermarkets and riders, with reasons sent to them · search users and suspend or reactivate accounts · set supermarket and rider commission rates · view platform activity |

Also in place for later phases: a provider-agnostic POS sync pipeline (`src/lib/pos`) that live POS adapters plug into, commission maths, notifications and an activity log.

## Tech stack

- **Next.js 16** (App Router, Server Components, Server Actions) + **React 19** + **TypeScript**
- **Tailwind CSS 4**
- **PostgreSQL** via **Prisma 7** (`@prisma/adapter-pg`)
- Auth: bcrypt password hashes, signed HTTP-only session cookies (`jose`), session revocation via a per-user version
- Validation: **zod** (Nigerian phone numbers are normalised to `+234…`)
- Tests: **Vitest**

## Getting started

Requirements: Node.js 20+ and PostgreSQL 14+.

```bash
npm install                       # also generates the Prisma client
cp .env.example .env              # then set DATABASE_URL and SESSION_SECRET
npm run db:migrate                # create the database schema
ADMIN_PASSWORD='a-long-password' npm run admin:create -- \
  --email you@example.com --phone 08031234567 --first-name Ada --last-name Osagie
npm run dev                       # http://localhost:3000
```

Admins can't sign up through the app; use `npm run admin:create`. Everyone else registers in the app: customers at `/register`, supermarkets at `/register/supermarket`, riders at `/register/rider`.

### Scripts

| Command | Does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / server |
| `npm test` | Unit tests, plus database tests when `DATABASE_URL` is set |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript |
| `npm run db:migrate` | Create and apply a migration in development |
| `npm run db:deploy` | Apply migrations in production |
| `npm run admin:create` | Create an admin, or reset an existing admin's password |
| `npm run paystack:mock` | Local stand-in for Paystack's API and checkout page, for development without keys |

## Deploying to Vercel

The repo is ready for Vercel: `vercel.json` runs `prisma migrate deploy` before `next build`, functions run in Frankfurt (`fra1`, the closest region to Nigeria), and images go to Vercel Blob when it's connected.

1. **Import the project.** In Vercel, choose *Add New → Project* and import `clepbo/Sub-Net-Shopping`. Keep the detected Next.js settings, but don't deploy yet.
2. **Add a database.** In the project's *Storage* tab, create a **Neon** Postgres database in **Frankfurt (eu-central-1)** and connect it to the project. This sets `DATABASE_URL` (pooled) and `DATABASE_URL_UNPOOLED` (used for migrations).
3. **Add image storage.** In *Storage*, create a **Blob** store and connect it. This sets `BLOB_READ_WRITE_TOKEN`.
4. **Set the session secret.** Under *Settings → Environment Variables*, add `SESSION_SECRET` for Production and Preview, with a long random value:
   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
   ```
5. **Deploy.** The first build creates the database tables.
6. **Create your admin** from your own computer, against the production database:
   ```bash
   npm i -g vercel && vercel link && vercel env pull .env.production.local
   set -a && . ./.env.production.local && set +a
   ADMIN_PASSWORD='a-long-password' npm run admin:create -- \
     --email you@example.com --phone 08031234567 --first-name Ada --last-name Osagie
   ```

7. **Turn on online payment** (optional; without it checkout offers only pay-at-store):
   - Add `PAYSTACK_SECRET_KEY` (from Paystack → Settings → API Keys & Webhooks; use the `sk_test_…` key first).
   - Add `APP_URL` set to your site's address, e.g. `https://subnet.vercel.app`.
   - In Paystack, set the **Webhook URL** to `https://<your domain>/api/webhooks/paystack`.
   - Add `CRON_SECRET` (any long random value). A daily Vercel Cron job expires unpaid orders; page visits also do this, at most once a minute.

Preview deployments run migrations too. If you enable Neon's preview branching in the integration, each preview gets its own copy of the database; otherwise previews share production's database.

## How it's put together

```
prisma/schema.prisma        Data model (users, supermarkets, hours, riders, catalogue, inventory, settings…)
src/proxy.ts                Redirects signed-out users and wrong roles away from protected sections
src/lib/auth.ts             getCurrentUser / requireUser(role) — re-checks the user in the DB on every request
src/lib/availability.ts     Open/closed, pickup and delivery status from hours, cut-offs, closures and pauses
src/lib/catalog.ts          Product browsing, search and cross-store price comparison
src/lib/inventory.ts        Stock status rules and the listing upsert shared by CSV import and POS sync
src/lib/csv-import.ts       CSV parsing and validation for product imports
src/lib/cart.ts             Cart grouped by supermarket, with every line re-checked
src/lib/order-rules.ts      Order status machine and totals
src/lib/orders.ts           Checkout, stock reservation, status changes, item adjustments
src/lib/payments/           Paystack client, payment application, refunds, expiry of unpaid orders
src/lib/pickup.ts           QR/PIN pickup verification
src/lib/settlements.ts      Commission and settlement statements
src/lib/delivery-rules.ts   Delivery fee, distance and vehicle matching
src/lib/deliveries.ts       Rider jobs: accept, hand back, pick up, deliver, location
src/lib/rider-payouts.ts    Rider earnings and payouts
src/lib/validation.ts       zod schemas for every form
src/lib/storage.ts          Image storage: Vercel Blob, or local disk for development
src/lib/pos/                POS integration contract and inventory sync
src/app/actions/            Server Actions — each one authorises the caller itself
src/app/(shop)/             Customer pages: /, /categories, /products, /search, /stores/[id], /cart, /checkout, /orders…
src/app/merchant|rider|admin Dashboards (sidebar on desktop)
```

**Access control.** The proxy is only a first filter. Every page and Server Action calls `requireUser(role)`, which loads the user from the database, so a suspended account or a revoked session stops working immediately. Merchants only ever act on the supermarket linked to their account through `SupermarketStaff`, never on an ID sent from the browser.

**Time.** All schedules are interpreted in Africa/Lagos (WAT, UTC+1) regardless of the server's time zone.

**Images.** With `BLOB_READ_WRITE_TOKEN` set (on Vercel) images go to Vercel Blob. Otherwise the local driver writes to `UPLOAD_DIR` (default `./uploads`) and serves files from `/uploads/…`. Uploads are limited to JPG, PNG and WebP up to 2 MB and checked by file signature.

## Before going live

- Set a strong `SESSION_SECRET` and serve over HTTPS (cookies are `Secure` in production).
- Add rate limiting on sign-in and registration (for example at the reverse proxy).
- Test online payment end to end with Paystack **test** keys, including the webhook, before switching to live keys.
- Maps use OpenStreetMap's public tiles, which are fine for light use. For heavier traffic, switch the tile URL in `src/components/map/leaflet-map.tsx` to a hosted provider (e.g. MapTiler or Stadia Maps).
- Add email/phone verification and password reset — not part of Phase 1.
