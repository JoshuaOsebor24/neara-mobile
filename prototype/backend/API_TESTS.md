# Neara Backend API Tests

Use these routes to verify backend behavior before wiring frontend pages.

Base URL:

```txt
http://localhost:5050
```

## Health Check

Browser:

```txt
http://localhost:5050/
```

Expected:

```json
"Backend running"
```

## Signup

Route:

```txt
POST /auth/signup
```

Example `curl`:

```bash
curl -sS -X POST "http://localhost:5050/auth/signup" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test-user@example.com",
    "password": "NearaDev123!"
  }'
```

Good response:

```json
{
  "success": true,
  "data": {
    "token": "jwt-token",
    "user": {
      "id": 1,
      "name": "Test User",
      "email": "test-user@example.com"
    }
  },
  "message": "Account created successfully."
}
```

## Login

Route:

```txt
POST /auth/login
```

Example `curl`:

```bash
curl -sS -X POST "http://localhost:5050/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "shopper+demo@neara.test",
    "password": "NearaDev123!"
  }'
```

Good response:

```json
{
  "success": true,
  "data": {
    "token": "jwt-token",
    "user": {
      "email": "shopper+demo@neara.test"
    }
  },
  "message": "Welcome back!"
}
```

## Search

Route:

```txt
GET /search?query=charger&limit=6&preview=1
```

Browser URL:

```txt
http://localhost:5050/search?query=charger&limit=6&preview=1
```

Good response:

```json
{
  "success": true,
  "data": {
    "results": [
      {
        "store_name": "VoltHub Electronics",
        "product_name": "USB-C Fast Charger"
      }
    ]
  },
  "message": "Search completed successfully"
}
```

## Store By ID

Route:

```txt
GET /stores/1
```

Browser URL:

```txt
http://localhost:5050/stores/1
```

Good response:

```json
{
  "success": true,
  "data": {
    "store": {
      "id": 1,
      "store_name": "Green Basket Grocery"
    }
  },
  "message": "Store fetched successfully"
}
```

## Saved Stores

Route:

```txt
GET /saved-stores
```

Example `curl`:

```bash
curl -sS "http://localhost:5050/saved-stores" \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

Good response:

```json
{
  "success": true,
  "data": {
    "savedStores": [
      {
        "store_id": 1,
        "store_name": "Green Basket Grocery"
      }
    ]
  },
  "message": "Saved stores fetched successfully"
}
```

Create saved store:

```bash
curl -sS -X POST "http://localhost:5050/saved-stores" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "store_id": 1
  }'
```

Delete saved store:

```bash
curl -sS -X DELETE "http://localhost:5050/saved-stores/1" \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

## What To Watch In Backend Logs

Each core route now logs:

- route hit
- method
- key params or query
- response status
- success or failure
- caught error message

This lets you test backend routes directly from the browser or `curl` before debugging frontend pages.
