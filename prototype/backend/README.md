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
