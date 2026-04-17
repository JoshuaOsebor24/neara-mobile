import type { Href } from "expo-router";

const AUTH_ROUTE_KEYS = new Set([
  "auth/login",
  "auth/signup",
  "login",
  "signup",
]);

const OWNER_PROTECTED_ROUTE_KEYS = new Set([
  "business/promote-store",
  "promote-store",
  "store/chats/index",
  "store/chats/locked",
  "store/products/add",
  "store/products/import",
]);

const PRO_PROTECTED_ROUTE_KEYS = new Set(["store/chats/index"]);

const ADMIN_PROTECTED_ROUTE_KEYS = new Set(["admin", "admin/index"]);

function normalizeSegments(segments: readonly string[]) {
  return segments.filter(Boolean);
}

function buildRouteKey(segments: readonly string[]) {
  return normalizeSegments(segments).join("/");
}

export function isAuthRoute(segments: readonly string[]) {
  return AUTH_ROUTE_KEYS.has(buildRouteKey(segments));
}

export function isPublicRoute(segments: readonly string[]) {
  const normalized = normalizeSegments(segments);
  const routeKey = buildRouteKey(normalized);

  if (normalized.length === 0) {
    return true;
  }

  if (isAuthRoute(normalized)) {
    return true;
  }

  if (routeKey === "store/[id]") {
    return true;
  }

  return false;
}

export function isOwnerProtectedRoute(segments: readonly string[]) {
  const normalized = normalizeSegments(segments);
  const routeKey = buildRouteKey(normalized);

  if (OWNER_PROTECTED_ROUTE_KEYS.has(routeKey)) {
    return true;
  }

  return routeKey === "store/[id]" ? false : routeKey.startsWith("store/");
}

export function isProProtectedRoute(segments: readonly string[]) {
  return PRO_PROTECTED_ROUTE_KEYS.has(buildRouteKey(segments));
}

export function isAdminProtectedRoute(segments: readonly string[]) {
  const routeKey = buildRouteKey(segments);

  return (
    ADMIN_PROTECTED_ROUTE_KEYS.has(routeKey) || routeKey.startsWith("admin/")
  );
}

export function buildPostLoginHref(options: {
  isStoreOwner: boolean;
  primaryStoreId: string | null;
  returnTo?: string | null;
  fallbackHref: Href;
}) {
  const sanitizedReturnTo = sanitizeReturnTo(options.returnTo);

  if (sanitizedReturnTo) {
    return sanitizedReturnTo;
  }

  return options.fallbackHref;
}

export function sanitizeReturnTo(returnTo?: string | null) {
  const normalized = String(returnTo || "").trim();

  if (!normalized || !normalized.startsWith("/")) {
    return null;
  }

  if (normalized === "/login" || normalized === "/signup") {
    return null;
  }

  return normalized as Href;
}
