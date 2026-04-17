# Neara Backend

Standalone backend for the Neara mobile app.

## Runtime

- Node.js
- PostgreSQL

## Environment

Create `.env` in this folder using `.env.example`.

Required variables:

- `DATABASE_URL`
- `JWT_SECRET`

Optional variables:

- `PORT` default `5050`
- `HOST` default `0.0.0.0`
- `CORS_ALLOWED_ORIGINS` comma-separated allowed browser origins

## Start

```bash
npm install
npm run dev
```

## Database

This backend currently bootstraps its schema at startup via [`config/ensureSchema.js`](./config/ensureSchema.js).

Tables currently managed there:

- `users`
- `stores`
- `products`
- `product_variants`
- `saved_stores`
- `conversations`
- `messages`

## Seeds

```bash
npm run seed
npm run seed:search
```

`npm run seed` now uses [`seed.js`](./seed.js) to populate:

- `users` with dummy store owners
- `stores` with 5 Nigerian sample stores
- `products` with 50 realistic grocery and deli items
- `product_variants` with 100 purchasable variants and stock quantities

The script is idempotent by business key:

- users by lowercase email
- stores by lowercase store name
- products by store plus lowercase product name
- variants by product plus lowercase variant name

From the repo root, you can also run:

```bash
npm run seed
```

## Standalone Notes

- This backend no longer needs runtime imports from the old LocalStore frontend.
- The mobile app should point to this backend through `EXPO_PUBLIC_API_URL` or the Expo LAN fallback logic in [`/Users/joshua/neara-mobile/services/api.ts`](/Users/joshua/neara-mobile/services/api.ts).
- For a production-grade standalone system, SQL migrations should eventually replace runtime schema bootstrapping.

## CORS and Connectivity Contract

Development CORS allows:

- configured origins from backend env (`CORS_ALLOWED_ORIGINS`)
- localhost web origins (`http://localhost:3000`, `3001`, `8081`, `8082`, `8083`)
- LAN origins when not in production

Production CORS allows only explicitly configured origins.
Production startup fails if `CORS_ALLOWED_ORIGINS` is empty, contains wildcard entries, or contains invalid origins.

Frontend API base selection should align with this:

- Web dev: use localhost or configured dev API origin.
- Native dev: use configured dev API origin first; Expo/LAN fallback is allowed.
- Production app: use only stable public API origins (never localhost/LAN).
