# Neara Mobile

Clean Expo Router foundation for a mobile app.

## Structure

- `app/` route tree with root stack and tab navigation
- `components/` shared UI building blocks
- `constants/` theme tokens
- `hooks/` app hooks
- `services/` frontend service layer

## Development

```bash
npm start
```

Tabs included:

- Home
- Chats
- Saved
- Profile

# neara-mobile

## API Configuration Contract

Frontend-backend calls are centralized in `services/api.ts`.

Set environment variables in `.env`:

- `EXPO_PUBLIC_API_ENV=development|production`
- `EXPO_PUBLIC_API_URL` for production
- `EXPO_PUBLIC_API_URL_DEV_WEB` for web development
- `EXPO_PUBLIC_API_URL_DEV_MOBILE` for native development

Resolution behavior:

- Production mode uses `EXPO_PUBLIC_API_URL` only and rejects loopback hosts.
- Web development uses `EXPO_PUBLIC_API_URL_DEV_WEB`.
- Native development uses `EXPO_PUBLIC_API_URL_DEV_MOBILE`.
- The client fails fast when the required URL for the active mode is missing.

Reliability guarantees from the shared client:

- One request pipeline for headers, timeout, JSON parsing, and HTTP/network error handling.
- Development logging of resolved candidates and selected working base URL.
- Explicit failure when no valid API base URL is available.
- Malformed or empty-success payloads are surfaced as API errors instead of silent empty-data success.
