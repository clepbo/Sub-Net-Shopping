# Sub Net Shopping

A mobile-first web app that connects shoppers in Benin City with **verified supermarkets**, plus web dashboards for supermarkets, delivery riders and platform admins.

This repository implements **Phase 1 — Core Foundation** from the product requirements document (PRD §24), styled after the prototype's green-and-yellow mobile UI.

## What's in Phase 1

| Role | Can do |
| --- | --- |
| **Customer** | Register / sign in · browse approved supermarkets · see open/closed, pickup and delivery status in real time · sort by distance from their location · search by name or area · view a store's hours, contact details and directions · manage profile and password · notifications |
| **Supermarket** | Register (starts **pending approval**) · edit store profile, map location and logo · set weekly hours, last order time, and separate pickup and delivery windows · temporarily close the store · pause delivery or pickup for 30 min / 1 hour / until a time, and resume · record POS/inventory system details |
| **Rider** | Register with vehicle details (starts **pending approval**) · edit vehicle · go online / offline once approved |
| **Admin** | Live platform stats (no demo data) · approve, reject, suspend and reactivate supermarkets and riders, with reasons sent to them · search users and suspend or reactivate accounts · set supermarket and rider commission rates · view platform activity |

Foundations laid for later phases: product, category, inventory (price in kobo, stock, SKU, source) and product-image tables; a storage abstraction for images; a provider-agnostic POS sync pipeline (`src/lib/pos`) that adapters plug into; commission maths; notifications and an activity log.

Out of scope for Phase 1 (per the PRD): product shopping, cart, checkout, payments, Reserve & Pick Up flow, delivery pricing, rider assignment and GPS tracking.

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
| `npm test` | Unit tests |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript |
| `npm run db:migrate` | Create and apply a migration in development |
| `npm run db:deploy` | Apply migrations in production |
| `npm run admin:create` | Create an admin, or reset an existing admin's password |

## How it's put together

```
prisma/schema.prisma        Data model (users, supermarkets, hours, riders, catalogue, inventory, settings…)
src/proxy.ts                Redirects signed-out users and wrong roles away from protected sections
src/lib/auth.ts             getCurrentUser / requireUser(role) — re-checks the user in the DB on every request
src/lib/availability.ts     Open/closed, pickup and delivery status from hours, cut-offs, closures and pauses
src/lib/validation.ts       zod schemas for every form
src/lib/storage.ts          Image storage abstraction (local disk driver; add S3/R2 for production)
src/lib/pos/                POS integration contract and inventory sync
src/app/actions/            Server Actions — each one authorises the caller itself
src/app/(pages)             /, /search, /stores/[id], /merchant, /rider, /admin, /account…
```

**Access control.** The proxy is only a first filter. Every page and Server Action calls `requireUser(role)`, which loads the user from the database, so a suspended account or a revoked session stops working immediately. Merchants only ever act on the supermarket linked to their account through `SupermarketStaff`, never on an ID sent from the browser.

**Time.** All schedules are interpreted in Africa/Lagos (WAT, UTC+1) regardless of the server's time zone.

**Images.** The local storage driver writes to `UPLOAD_DIR` (default `./uploads`) and files are served from `/uploads/…`. Uploads are limited to JPG, PNG and WebP up to 2 MB and checked by file signature. When running more than one server instance, add an object-storage driver in `src/lib/storage.ts`.

## Before going live

- Set a strong `SESSION_SECRET` and serve over HTTPS (cookies are `Secure` in production).
- Add rate limiting on sign-in and registration (for example at the reverse proxy).
- Configure object storage for images if you run multiple instances.
- Add email/phone verification and password reset — not part of Phase 1.
