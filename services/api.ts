import { Platform } from "react-native";

const REQUEST_TIMEOUT_MS = 8000;
const DISCOVERY_TIMEOUT_MS = 2500;
const GET_DEDUPE_WINDOW_MS = 4000;
const RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);
const RUNTIME_IS_DEV = typeof __DEV__ !== "undefined" ? __DEV__ : false;
const CONFIG_ERROR_MESSAGE = "Neara is not ready yet. Please try again later.";
const INVALID_PAYLOAD_MESSAGE =
  "We couldn't finish that right now. Please try again.";
const TECHNICAL_ERROR_PATTERN =
  /\b(api|backend|server|database|sql|payload|response|dns|econn|enotfound|cors|stack|exception|internal(?: error)?|request failed|fetch failed|load failed)\b/i;
const successfulBaseUrlByPath = new Map<string, string>();
let loggedResolvedApiBaseUrl: string | null = null;
const inflightGetRequests = new Map<
  string,
  {
    expiresAt: number;
    promise: Promise<MobileApiResult<unknown>>;
  }
>();

type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

export type MobileApiResult<T> =
  | {
      data: T;
      ok: true;
      status: number;
      url: string;
    }
  | {
      data?: T | null;
      error: string;
      ok: false;
      status: number;
      url: string;
    };

function normalizeApiPath(path: string) {
  return path.startsWith("/") ? path : `/${path}`;
}

export function toFriendlyNetworkError(error: unknown) {
  const rawMessage =
    error instanceof Error ? error.message : String(error || "");
  const normalizedMessage = rawMessage.trim().toLowerCase();

  if (
    normalizedMessage.includes("internet disconnected") ||
    normalizedMessage.includes("offline") ||
    normalizedMessage.includes("not connected to the internet")
  ) {
    return "Your device is offline. Reconnect to the internet and try again.";
  }

  if (
    normalizedMessage.includes("aborted") ||
    normalizedMessage.includes("timeout")
  ) {
    return "This is taking longer than usual. Please try again.";
  }

  if (
    normalizedMessage.includes("econnrefused") ||
    normalizedMessage.includes("connection refused") ||
    normalizedMessage.includes("failed to connect") ||
    normalizedMessage.includes("could not connect") ||
    normalizedMessage.includes("could not reach") ||
    normalizedMessage.includes("enotfound") ||
    normalizedMessage.includes("dns")
  ) {
    return "Neara isn't reachable right now. Please try again shortly.";
  }

  if (
    normalizedMessage.includes("network request failed") ||
    normalizedMessage.includes("fetch failed") ||
    normalizedMessage.includes("load failed")
  ) {
    return "We couldn't connect right now. Check your connection and try again.";
  }

  return "Something went wrong. Please try again.";
}

function sanitizeBackendErrorMessage(status: number, message?: string | null) {
  const normalizedMessage = String(message || "").trim();

  if (!normalizedMessage) {
    return "";
  }

  const lowercaseMessage = normalizedMessage.toLowerCase();

  if (
    lowercaseMessage.includes("not authenticated") ||
    lowercaseMessage.includes("unauthorized") ||
    lowercaseMessage.includes("invalid token") ||
    lowercaseMessage.includes("token expired") ||
    lowercaseMessage.includes("session expired")
  ) {
    return "Log in again to continue.";
  }

  if (lowercaseMessage.includes("invalid store id")) {
    return "That store link is no longer valid.";
  }

  if (lowercaseMessage.includes("invalid conversation id")) {
    return "That conversation link is no longer valid.";
  }

  if (lowercaseMessage.includes("invalid user id")) {
    return "That account link is no longer valid.";
  }

  if (lowercaseMessage.includes("user not found")) {
    return "That account could not be found.";
  }

  if (lowercaseMessage.includes("store not found")) {
    return "That store could not be found.";
  }

  if (lowercaseMessage.includes("product not found")) {
    return "That product could not be found.";
  }

  if (
    lowercaseMessage.includes("conversation not found") ||
    lowercaseMessage.includes("chat not found")
  ) {
    return "That conversation could not be found.";
  }

  if (
    lowercaseMessage.includes("for store owners") ||
    lowercaseMessage.includes("store inbox is for store owners")
  ) {
    return "This feature is only available to store owners.";
  }

  if (lowercaseMessage.includes("for admins")) {
    return "This feature is only available to admins.";
  }

  if (
    lowercaseMessage.includes("forbidden") ||
    lowercaseMessage.includes("not allowed") ||
    lowercaseMessage.includes("permission")
  ) {
    return "Your account doesn't have access to that.";
  }

  if (lowercaseMessage.includes("push token")) {
    return "We couldn't turn on notifications right now.";
  }

  if (lowercaseMessage.includes("test push notification")) {
    return "We couldn't send a test notification right now.";
  }

  if (TECHNICAL_ERROR_PATTERN.test(normalizedMessage)) {
    return "";
  }

  if (status === 401) {
    return "Log in again to continue.";
  }

  return normalizedMessage;
}

function normalizeBaseUrl(value?: string | null) {
  const normalized = String(value || "")
    .trim()
    .replace(/\/+$/, "");
  return normalized || null;
}

function isProductionApiMode() {
  const apiEnv = String(process.env.EXPO_PUBLIC_API_ENV || "")
    .trim()
    .toLowerCase();

  if (apiEnv === "production") {
    return true;
  }

  if (apiEnv === "development") {
    return false;
  }

  return !RUNTIME_IS_DEV;
}

function logApiDebug(message: string, details?: unknown) {
  if (!RUNTIME_IS_DEV) {
    return;
  }

  if (details === undefined) {
    console.info(`[api] ${message}`);
    return;
  }

  console.info(`[api] ${message}`, details);
}

function getConfiguredApiBaseUrl() {
  const productionBase = normalizeBaseUrl(process.env.EXPO_PUBLIC_API_URL);
  const webDevelopmentBase = normalizeBaseUrl(
    process.env.EXPO_PUBLIC_API_URL_DEV_WEB,
  );
  const mobileDevelopmentBase = normalizeBaseUrl(
    process.env.EXPO_PUBLIC_API_URL_DEV_MOBILE,
  );

  let selectedBaseUrl: string | null = null;

  if (isProductionApiMode()) {
    selectedBaseUrl = productionBase;
  } else if (Platform.OS === "web") {
    selectedBaseUrl = webDevelopmentBase;
  } else {
    selectedBaseUrl = mobileDevelopmentBase;
  }

  if (!selectedBaseUrl) {
    throw new Error(CONFIG_ERROR_MESSAGE);
  }

  if (RUNTIME_IS_DEV && loggedResolvedApiBaseUrl !== selectedBaseUrl) {
    loggedResolvedApiBaseUrl = selectedBaseUrl;
    logApiDebug(`selected API URL: ${selectedBaseUrl}`);
  }

  return selectedBaseUrl;
}

function buildDedupeKey(
  method: string,
  path: string,
  queryString: string,
  token?: string | null,
) {
  return `${method}:${path}${queryString}:${token || ""}`;
}

function readCachedBaseUrl(path: string) {
  return successfulBaseUrlByPath.get(path) || null;
}

function rememberSuccessfulBaseUrl(path: string, baseUrl: string) {
  successfulBaseUrlByPath.set(path, baseUrl);
}

function getOrderedCandidates(path: string, candidates: string[]) {
  const cachedBaseUrl = readCachedBaseUrl(path);

  if (!cachedBaseUrl) {
    return candidates;
  }

  return [
    cachedBaseUrl,
    ...candidates.filter((candidate) => candidate !== cachedBaseUrl),
  ];
}

function cleanupInflightGetRequests() {
  const now = Date.now();

  for (const [key, entry] of inflightGetRequests.entries()) {
    if (entry.expiresAt <= now) {
      inflightGetRequests.delete(key);
    }
  }
}

function parseJsonResponse<T>(rawText: string): {
  data: (T & { message?: string; error?: string }) | null;
  error?: string;
} {
  const normalizedText = rawText.trim();

  if (!normalizedText) {
    return { data: null };
  }

  try {
    return {
      data: JSON.parse(normalizedText) as T & {
        message?: string;
        error?: string;
      },
    };
  } catch {
    return {
      data: null,
      error: INVALID_PAYLOAD_MESSAGE,
    };
  }
}

function isRetryableStatus(status: number) {
  return RETRYABLE_STATUSES.has(status);
}

function buildHttpStatusErrorMessage(status: number, fallback?: string | null) {
  const normalizedFallback = sanitizeBackendErrorMessage(status, fallback);

  if (normalizedFallback) {
    return normalizedFallback;
  }

  if (status === 400 || status === 422) {
    return "Some details need attention. Review them and try again.";
  }

  if (status === 401) {
    return "Log in again to continue.";
  }

  if (status === 403) {
    return "Your account doesn't have access to that.";
  }

  if (status === 404) {
    return "That item could not be found.";
  }

  if (status === 408 || status === 504) {
    return "This is taking longer than usual. Please try again.";
  }

  if (status === 429) {
    return "You're moving fast. Please wait a moment and try again.";
  }

  if (status >= 500) {
    return "Neara is having a moment. Please try again shortly.";
  }

  return "We couldn't complete that right now. Please try again.";
}

type RequestOptions = {
  body?: BodyInit | JsonValue;
  headers?: Record<string, string>;
  isJsonBody?: boolean;
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  path: string;
  query?: URLSearchParams;
  token?: string | null;
  bypassCache?: boolean;
};

async function executeMobileApiRequest<T>({
  body,
  headers = {},
  isJsonBody = true,
  method = "GET",
  path,
  query,
  token,
  bypassCache = false,
}: RequestOptions): Promise<MobileApiResult<T>> {
  const requestPath = normalizeApiPath(path);

  // Add cache busting timestamp when bypassing cache
  let finalQuery = query;
  if (bypassCache) {
    finalQuery = new URLSearchParams(query || {});
    finalQuery.append("_t", String(Date.now()));
  }

  const queryString =
    finalQuery && finalQuery.toString() ? `?${finalQuery.toString()}` : "";
  const candidates = getOrderedCandidates(
    requestPath,
    getMobileApiBaseCandidates(),
  );

  let lastNetworkError = "We couldn't connect right now. Please try again.";

  for (const [candidateIndex, apiBase] of candidates.entries()) {
    const maxAttempts = method === "GET" ? 2 : 1;

    for (let attemptIndex = 0; attemptIndex < maxAttempts; attemptIndex += 1) {
      const controller = new AbortController();
      const timeoutMs =
        candidateIndex === 0 &&
        attemptIndex === 0 &&
        readCachedBaseUrl(requestPath) === apiBase
          ? REQUEST_TIMEOUT_MS
          : DISCOVERY_TIMEOUT_MS;
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      const url = `${apiBase}${requestPath}${queryString}`;

      try {
        const requestHeaders: Record<string, string> = {
          Accept: "application/json",
          ...(isJsonBody ? { "Content-Type": "application/json" } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...headers,
        };

        if (bypassCache) {
          requestHeaders["Cache-Control"] = "no-cache";
          requestHeaders["Pragma"] = "no-cache";
        }

        const response = await fetch(url, {
          method,
          headers: requestHeaders,
          body:
            body === undefined
              ? undefined
              : isJsonBody
                ? JSON.stringify(body)
                : (body as BodyInit),
          signal: controller.signal,
        });

        clearTimeout(timeout);

        const rawText = await response.text();
        const parsed = parseJsonResponse<T>(rawText);

        if (parsed.error) {
          return {
            data: null,
            error: parsed.error,
            ok: false as const,
            status: response.status,
            url,
          };
        }

        if (response.ok || response.status < 500) {
          rememberSuccessfulBaseUrl(requestPath, apiBase);
        }

        // Handle 304 Not Modified first - it's a redirection status not 2xx
        if (response.status === 304 && parsed.data === null) {
          return {
            data: null,
            error: "That update is not available right now. Please try again.",
            ok: false as const,
            status: 304,
            url,
          };
        }

        const isSuccessStatus = response.status >= 200 && response.status < 300;

        if (!isSuccessStatus) {
          if (
            attemptIndex + 1 < maxAttempts &&
            isRetryableStatus(response.status)
          ) {
            continue;
          }

          return {
            data: (parsed.data ?? null) as T | null,
            error: buildHttpStatusErrorMessage(
              response.status,
              parsed.data && typeof parsed.data === "object"
                ? parsed.data.error || parsed.data.message
                : undefined,
            ),
            ok: false as const,
            status: response.status,
            url,
          };
        }

        if (
          parsed.data === null &&
          (response.status === 204 || response.status === 205)
        ) {
          return {
            data: {} as T,
            ok: true as const,
            status: response.status,
            url,
          };
        }

        if (parsed.data === null) {
          return {
            data: null,
            error: INVALID_PAYLOAD_MESSAGE,
            ok: false as const,
            status: response.status,
            url,
          };
        }

        return {
          data: parsed.data as T,
          ok: true as const,
          status: response.status,
          url,
        };
      } catch (error) {
        clearTimeout(timeout);
        lastNetworkError = toFriendlyNetworkError(error);
      }
    }
  }

  return {
    data: null,
    error: lastNetworkError,
    ok: false as const,
    status: 0,
    url: candidates[0]
      ? `${candidates[0]}${requestPath}${queryString}`
      : `${requestPath}${queryString}`,
  };
}

export function getMobileApiBaseCandidates() {
  return [getConfiguredApiBaseUrl()];
}

export async function requestMobileApi<T>(
  path: string,
  options: {
    body?: JsonValue;
    headers?: Record<string, string>;
    method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
    query?: URLSearchParams;
    token?: string | null;
  } = {},
): Promise<MobileApiResult<T>> {
  const { body, headers = {}, method = "GET", query, token } = options;
  const requestPath = normalizeApiPath(path);
  const queryString = query && query.toString() ? `?${query.toString()}` : "";
  const dedupeKey = buildDedupeKey(method, requestPath, queryString, token);

  if (method === "GET") {
    cleanupInflightGetRequests();
    const inflight = inflightGetRequests.get(dedupeKey);

    if (inflight) {
      return inflight.promise as Promise<MobileApiResult<T>>;
    }
  }

  const requestPromise: Promise<MobileApiResult<T>> = (async () => {
    return executeMobileApiRequest<T>({
      body,
      headers,
      isJsonBody: true,
      method,
      path: requestPath,
      query,
      token,
      bypassCache: false,
    });
  })();

  if (method === "GET") {
    inflightGetRequests.set(dedupeKey, {
      expiresAt: Date.now() + GET_DEDUPE_WINDOW_MS,
      promise: requestPromise as Promise<MobileApiResult<unknown>>,
    });

    void requestPromise.finally(() => {
      const entry = inflightGetRequests.get(dedupeKey);

      if (entry?.promise === requestPromise) {
        inflightGetRequests.delete(dedupeKey);
      }
    });
  }

  return requestPromise;
}

export async function requestMobileApiNoCache<T>(
  path: string,
  options: {
    body?: JsonValue;
    headers?: Record<string, string>;
    method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
    query?: URLSearchParams;
    token?: string | null;
  } = {},
): Promise<MobileApiResult<T>> {
  const { body, headers = {}, method = "GET", query, token } = options;
  const requestPath = normalizeApiPath(path);
  const queryString = query && query.toString() ? `?${query.toString()}` : "";
  const dedupeKey = buildDedupeKey(method, requestPath, queryString, token);

  if (method === "GET") {
    cleanupInflightGetRequests();
    const inflight = inflightGetRequests.get(dedupeKey);

    if (inflight) {
      return inflight.promise as Promise<MobileApiResult<T>>;
    }
  }

  const requestPromise: Promise<MobileApiResult<T>> = (async () => {
    return executeMobileApiRequest<T>({
      body,
      headers,
      isJsonBody: true,
      method,
      path: requestPath,
      query,
      token,
      bypassCache: true,
    });
  })();

  if (method === "GET") {
    inflightGetRequests.set(dedupeKey, {
      expiresAt: Date.now() + GET_DEDUPE_WINDOW_MS,
      promise: requestPromise as Promise<MobileApiResult<unknown>>,
    });

    void requestPromise.finally(() => {
      const entry = inflightGetRequests.get(dedupeKey);

      if (entry?.promise === requestPromise) {
        inflightGetRequests.delete(dedupeKey);
      }
    });
  }

  return requestPromise;
}

export async function requestMobileApiFormData<T>(
  path: string,
  options: {
    body: FormData;
    headers?: Record<string, string>;
    method?: "POST" | "PUT" | "PATCH";
    query?: URLSearchParams;
    token?: string | null;
  },
) {
  return executeMobileApiRequest<T>({
    body: options.body,
    headers: options.headers,
    isJsonBody: false,
    method: options.method,
    path,
    query: options.query,
    token: options.token,
  });
}
