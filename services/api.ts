import Constants from "expo-constants";
import { Platform } from "react-native";

const REQUEST_TIMEOUT_MS = 8000;
const DEFAULT_API_PORTS = ["5050", "5051"] as const;
const DISCOVERY_TIMEOUT_MS = 2500;
const GET_DEDUPE_WINDOW_MS = 4000;
const RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);
const successfulBaseUrlByPath = new Map<string, string>();
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
  const rawMessage = error instanceof Error ? error.message : String(error || "");
  const normalizedMessage = rawMessage.trim().toLowerCase();

  if (
    normalizedMessage.includes("internet disconnected") ||
    normalizedMessage.includes("offline") ||
    normalizedMessage.includes("not connected to the internet")
  ) {
    return "Your device is offline. Reconnect to the internet and try again.";
  }

  if (normalizedMessage.includes("aborted") || normalizedMessage.includes("timeout")) {
    return "The server took too long to respond. Please try again.";
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
    return "The Neara server is unavailable right now. Please try again shortly.";
  }

  if (
    normalizedMessage.includes("network request failed") ||
    normalizedMessage.includes("fetch failed") ||
    normalizedMessage.includes("load failed")
  ) {
    return "We couldn't reach the Neara server. Check your connection and try again.";
  }

  return "Something went wrong while contacting Neara. Please try again.";
}

function extractExpoHostCandidate() {
  const constants = Constants as unknown as {
    expoConfig?: { hostUri?: string | null } | null;
    linkingUri?: string | null;
    manifest?: { debuggerHost?: string | null } | null;
    manifest2?: {
      extra?: {
        expoGo?: { debuggerHost?: string | null } | null;
      } | null;
    } | null;
  };

  const hostSource =
    constants.expoConfig?.hostUri ||
    constants.manifest2?.extra?.expoGo?.debuggerHost ||
    constants.manifest?.debuggerHost ||
    constants.linkingUri ||
    "";

  const normalizedHost = String(hostSource)
    .trim()
    .replace(/^exp:\/\//, "")
    .replace(/^https?:\/\//, "")
    .split("/")[0]
    .split(":")[0];

  return normalizedHost || null;
}

function normalizeBaseUrl(value?: string | null) {
  const normalized = String(value || "").trim().replace(/\/+$/, "");
  return normalized || null;
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

  return [cachedBaseUrl, ...candidates.filter((candidate) => candidate !== cachedBaseUrl)];
}

function cleanupInflightGetRequests() {
  const now = Date.now();

  for (const [key, entry] of inflightGetRequests.entries()) {
    if (entry.expiresAt <= now) {
      inflightGetRequests.delete(key);
    }
  }
}

function buildHostCandidates(host: string | null, ports: readonly string[]) {
  if (!host) {
    return [];
  }

  return ports.map((port) => `http://${host}:${port}`);
}

function parseJsonResponse<T>(
  rawText: string,
): {
  data: (T & { message?: string; error?: string }) | null;
  error?: string;
} {
  const normalizedText = rawText.trim();

  if (!normalizedText) {
    return { data: null };
  }

  try {
    return {
      data: JSON.parse(normalizedText) as T & { message?: string; error?: string },
    };
  } catch {
    return {
      data: null,
      error: "Neara returned unreadable data. Please try again.",
    };
  }
}

function isRetryableStatus(status: number) {
  return RETRYABLE_STATUSES.has(status);
}

function buildHttpStatusErrorMessage(status: number, fallback?: string | null) {
  const normalizedFallback = String(fallback || "").trim();

  if (normalizedFallback) {
    return normalizedFallback;
  }

  if (status === 400 || status === 422) {
    return "Neara could not process that request.";
  }

  if (status === 401) {
    return "Your session has expired. Log in again and retry.";
  }

  if (status === 403) {
    return "Your account is not allowed to do that.";
  }

  if (status === 404) {
    return "The requested Neara data was not found.";
  }

  if (status === 408 || status === 504) {
    return "The Neara server took too long to respond.";
  }

  if (status === 429) {
    return "Too many requests were sent to Neara. Please wait a moment.";
  }

  if (status >= 500) {
    return "The Neara server is having trouble right now. Please try again shortly.";
  }

  return `Request failed with status ${status}.`;
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
    finalQuery.append('_t', String(Date.now()));
  }
  
  const queryString = finalQuery && finalQuery.toString() ? `?${finalQuery.toString()}` : "";
  const candidates = getOrderedCandidates(requestPath, getMobileApiBaseCandidates());
  let lastNetworkError = "We couldn't reach the Neara server. Please try again.";

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
          lastNetworkError = parsed.error;

          if (attemptIndex + 1 < maxAttempts && isRetryableStatus(response.status)) {
            continue;
          }

          break;
        }

        if (response.ok || response.status < 500) {
          rememberSuccessfulBaseUrl(requestPath, apiBase);
        }

        // Handle 304 Not Modified first - it's a redirection status not 2xx
        if (response.status === 304 && parsed.data === null) {
          return {
            data: null,
            error: "Response not available. Please try again.",
            ok: false as const,
            status: 304,
            url,
          };
        }

        const isSuccessStatus = response.status >= 200 && response.status < 300;

        if (!isSuccessStatus) {
          if (attemptIndex + 1 < maxAttempts && isRetryableStatus(response.status)) {
            continue;
          }

          return {
            data: (parsed.data ?? null) as T | null,
            error: buildHttpStatusErrorMessage(
              response.status,
              parsed.data &&
                typeof parsed.data === "object"
                ? parsed.data.error || parsed.data.message
                : undefined,
            ),
            ok: false as const,
            status: response.status,
            url,
          };
        }

        if (parsed.data === null) {
          return {
            data: null,
            error: "Neara returned unreadable data. Please try again.",
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
  const apiEnv = String(process.env.EXPO_PUBLIC_API_ENV || "").trim().toLowerCase();
  const explicitBase = normalizeBaseUrl(process.env.EXPO_PUBLIC_API_URL);
  const productionBase = normalizeBaseUrl(process.env.EXPO_PUBLIC_API_URL_PRODUCTION);
  const developmentBase = normalizeBaseUrl(process.env.EXPO_PUBLIC_API_URL_DEVELOPMENT);
  const expoHost = extractExpoHostCandidate();
  const preferredEnvBase =
    apiEnv === "production" ? productionBase || explicitBase : developmentBase || explicitBase;

  const candidates = Array.from(
    new Set(
      [
        preferredEnvBase,
        explicitBase,
        productionBase,
        developmentBase,
        ...buildHostCandidates(expoHost, DEFAULT_API_PORTS),
        ...buildHostCandidates(
          Platform.OS === "android" ? "10.0.2.2" : "localhost",
          DEFAULT_API_PORTS,
        ),
        ...buildHostCandidates("localhost", DEFAULT_API_PORTS),
      ].filter(Boolean),
    ),
  ) as string[];

  return candidates;
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
