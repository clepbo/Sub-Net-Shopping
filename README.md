# SubNet Shopping

A mobile-first web app that connects shoppers in Benin City with **verified supermarkets**, plus web dashboards for supermarkets, delivery riders and platform admins.

It works on phones and desktop browsers: phones get a compact header and a bottom tab bar; desktops get a full header with search and a category menu, and dashboards get a sidebar.

This repository implements all five phases of the product requirements document (PRD §24–28): **core foundation**, **products & inventory**, **cart & orders**, **payments & pickup**, and **delivery & riders**.

## Sign-up, approval & account security

- **Create account** asks first whether you're a shopper, a supermarket or a rider. Supermarket and rider sign-up are split into three short steps; supermarkets can add a logo and (optionally) pin the store on a map.
- Sign-in and sign-up pages have no shop header or footer, just a **Back** button.
- **Approval gate:** a supermarket or rider sees only a "Waiting for approval" screen until an admin approves them. Registering again with the same email or phone says the application is already waiting. Admins see everything waiting on the **Admin → Overview** page, with a **Review** button for each.
- **After approval** a supermarket first sets its opening and closing hours (`/merchant/setup`), then lands on its dashboard.
- **Forgot password:** emails a one-time link valid for 60 minutes; using it signs the account out everywhere else. Set `RESEND_API_KEY` and `EMAIL_FROM` (see `.env.example`); without them the link is printed to the server log.
- **Login protection:** 5 wrong passwords for one account (or 30 from one network) in 15 minutes locks sign-in for that account for the rest of the window. Reset requests are limited to 3 an hour per account.
- **Legal pages:** `/terms`, `/privacy`, `/refunds`. They're a sensible starting point written for Nigeria (NDPA 2023, FCCPA 2018); have a lawyer review them before launch.

## Money: pricing, Monnify, cash on delivery & 10 PM payouts

**Markup pricing.** Supermarkets enter their **shelf price** and receive exactly that. Customers see it marked up (default **14%**, set under *Admin → Settings*), rounded **up** to ₦10 under ₦500, ₦50 under ₦5,000, otherwise ₦100. Categories can have their own markup (*Admin → Categories*). The migration starts staples (groceries, dairy & eggs, bakery, fresh produce) at **12%** and snacks, health & beauty and household at **16%**. Changing a markup reprices every listing at once. SubNet's share of an order is the difference between customer and shelf prices; the settings page shows the break-even markup for your commission and gateway fee (10% + 2% → 13.64%). *Existing listings were converted: their old price became the shelf price.*

**Payments.** Checkout uses **Monnify** when `MONNIFY_API_KEY`, `MONNIFY_SECRET_KEY` and `MONNIFY_CONTRACT_CODE` are set, else Paystack (`PAYMENT_PROVIDER` picks one if both are set). Set the Monnify webhook URL to `https://<your-site>/api/webhooks/monnify` (the spec's `/api/v1/payments/remittance-webhook` works too).

**Cash on delivery.** Delivery orders can be paid in cash to the rider (on by default, up to ₦50,000; both set in *Settings*). When the rider confirms delivery with the customer's PIN:

- their **cash wallet** is debited by the order total;
- at **₦20,000** owed (also a setting) they're paused: no jobs are offered, accepting is refused, and they get a push notification;
- cash jobs that would take them past the limit aren't offered.

Each approved rider gets a permanent **Monnify virtual account** (*Rider → Cash*). Transfers into it credit the wallet automatically through the webhook, exactly once, and un-pause them. Admins can record cash paid in by hand on the rider's page.

**10 PM payouts.** Every night from 22:00 Lagos time, each supermarket owed money gets one settlement and **one bank transfer**: its shelf-price share of online and cash orders, minus SubNet's share of pay-at-store sales. Stores add their bank under *Store profile*; the name is checked with the bank. Transfers come from `MONNIFY_WALLET_ACCOUNT_NUMBER`, the master account you fund, so cash still with riders doesn't delay stores. Without Monnify payouts, Paystack transfers are used, and with neither, statements are created for you to pay by hand. Failed transfers are retried the next night, or from *Admin → Settlements*.

- A Vercel cron calls `/api/cron/tick` at 21:00 UTC (22:00 Lagos). Vercel's Hobby plan can fire up to an hour late, so also run the cron-job.org schedule below; the run happens once per day either way.
- *Paystack transfers need "OTP for transfers" turned off in the Paystack dashboard.*

For local testing, `npm run monnify:mock` runs a fake Monnify (see `.env.example`).

## SMS alerts

Set `TERMII_API_KEY` (and a registered `TERMII_SENDER_ID`) to send SMS through [Termii](https://termii.com) for the moments that matter:

- **Customers:** order ready for pickup (with PIN), out for delivery (with PIN), delivery failed, order cancelled, and the pickup reminder.
- **Stores:** each new order, sent to the store's phone.
- **Riders:** when they're paused for unremitted cash.

Messages are capped at two SMS pages. Without a key, they're printed to the server log.

## Maps

Maps use OpenStreetMap's free tiles by default. That's fine for testing, but its usage policy doesn't allow heavy traffic. Once you have real users, sign up with a hosted tile service such as MapTiler, Stadia Maps or Mapbox (each has a free tier), then set `NEXT_PUBLIC_MAP_TILE_URL` and `NEXT_PUBLIC_MAP_ATTRIBUTION` (example in `.env.example`) and redeploy. No code change is needed.

## Live POS connection

Under **Store profile → Live POS connection**, a manager can connect any POS in two ways. Prices from the POS are shelf prices; the markup is added for customers.

1. **Push:** create an API key, then the POS or a small connector script sends changes to `POST /api/pos/v1/items` with `Authorization: Bearer <key>`:
   - full items (`sku`, `name`, `price`, `stock`) create or update listings;
   - just `sku` plus `stock` and/or `price` makes a quick update.

   `GET` on the same URL lists what SubNet has, for reconciling. Up to 500 items per request.
2. **Feed:** paste a public `https://` link to a CSV in the import-template columns (a POS's scheduled export, or a Google Sheet published as CSV). SubNet reads it straight away and then every hour.

Every sync is logged on the same page.

## Guest shopping

Anyone can browse and fill a cart without an account. A guest cart is kept for 30 days, tied to a private cookie in that browser.

At checkout, guests are asked to create an account (or sign in), and are then taken straight back to the same checkout. Everything in the guest cart moves into the account; if the account already has some of the same items, the quantities are added together. Signing in later from a guest cart merges it the same way.

## Shopping list (find one store with everything)

Shoppers tap **Add to list** on products, then open the list (icon next to the cart, or `/basket`). SubNet ranks supermarkets by distance from the shopper's location or a saved address (by price if neither is set):

- the **closest store with everything** on the list, with the basket total;
- a **closer store that's missing some items**, listing what's out of stock there;
- every other store with items from the list.

One tap adds the whole list from a store to the cart. The list lives in the browser, so it works before signing in, and a `/basket?items=…` link can be shared.

## Supermarket staff logins

Managers add staff under **Merchant → Staff**. Each person gets their own login: SubNet emails them a link to set a password (valid 3 days), and the manager can also copy it or send it on WhatsApp.

- **Staff** can handle orders, pickup and products/stock.
- **Managers** can also change the store profile, hours, payouts and staff.
- Removing someone signs them out at once and closes their login. The owner can't be removed.

## Failed deliveries

If a rider can't hand an order over, they tap **Can't deliver this order?** and pick a reason. The order becomes **Delivery failed** and the rider takes it back to the store. They can't take new jobs until the store taps **Confirm items are back**, which puts the stock back and refunds the customer.

| Reason | Customer refund | Rider paid for the trip |
|---|---|---|
| Customer not available, wrong address, refused | Items only (delivery fee kept) | Yes |
| Rider's side (breakdown, accident, damage), or other | Everything | No |

## Pickup times & reminders

- Customers choose a **pickup time** at checkout: 30-minute slots today and the next two days, inside the store's pickup window (or opening hours) and at least the store's **preparation time** ahead (set on the Hours page; default 30 minutes). After today's last order time, slots start tomorrow; a pickup pause moves the earliest slot past the pause. The server re-checks the chosen time, so it can't be outside the store's rules.
- Supermarkets see each order's pickup time; work queues are sorted by it.
- About **an hour before** the chosen time, customers get a reminder in the app and, if they've allowed it, as a **phone notification** (web push). Customers, staff and riders also get phone notifications for key events (order ready, rider on the way, new order, new delivery job).
- Web push works on Android and desktop browsers, and on iPhone (iOS 16.4+) once the site is added to the home screen.

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
- **Commission & settlement (PRD §18):** each order records the supermarket commission rate at checkout. Admins create settlement statements per supermarket from collected orders: online sales minus commission, minus commission owed on pay-at-store sales (negative means the store owes SubNet). Then they mark them paid with the bank transfer reference. Supermarkets see unsettled earnings and statements on their Earnings page.

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
| `npm run push:keys` | Generate the VAPID keys for phone notifications |
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

7. **Turn on phone notifications** (optional): run `npm run push:keys` and add the two values it prints, `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY`, plus `VAPID_SUBJECT` (e.g. `mailto:you@yourdomain.com`).
8. **Send reminders on time:** Vercel's free plan runs scheduled jobs only once a day, so also have a free scheduler such as [cron-job.org](https://cron-job.org) call `https://<your domain>/api/cron/tick` every 5 minutes with the header `Authorization: Bearer <CRON_SECRET>`. (Page visits also run these jobs, at most once a minute.)
9. **Turn on online payment** (optional; without it checkout offers only pay-at-store):
   - Add `PAYSTACK_SECRET_KEY` (from Paystack → Settings → API Keys & Webhooks; use the `sk_test_…` key first).
   - Add `APP_URL` set to your site's address, e.g. `https://subnet.vercel.app`.
   - In Paystack, set the **Webhook URL** to `https://<your domain>/api/webhooks/paystack`.
   - Add `CRON_SECRET` (any long random value). It protects `/api/cron/tick`, which expires unpaid orders and sends pickup reminders.

Preview deployments run migrations too. If you enable Neon's preview branching in the integration, each preview gets its own copy of the database; otherwise previews share production's database.

### If the site feels slow

Each page and button talks to the database several times, so the distance between the app and the database matters most:

- **Same region:** the app runs in Frankfurt (`fra1`). Your Neon database must be in **Frankfurt (eu-central-1)** too; a database in the US adds roughly 0.1 s to every query, which adds up to seconds per page. Neon's region is shown on the project's dashboard and can't be changed: create a new project in Frankfurt and move the data if needed.
- **Idle database:** on Neon's free plan the database sleeps after about 5 minutes without traffic, and the first request afterwards takes 1–3 seconds while it wakes. Paid plans can turn this off. The app tolerates the wake-up (transactions wait up to 20 s) instead of failing.

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
src/lib/pickup-slots.ts     Pickup times customers can choose
src/lib/reminders.ts        Pickup reminders; src/lib/push.ts sends web push
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
