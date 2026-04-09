import Constants from "expo-constants";
import { Platform } from "react-native";

const REQUEST_TIMEOUT_MS = 8000;
const DEFAULT_API_PORTS = ["5050", "5051"] as const;

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

function toFriendlyNetworkError(error: unknown) {
  const rawMessage = error instanceof Error ? error.message : String(error || "");
  const normalizedMessage = rawMessage.trim().toLowerCase();

  if (
    normalizedMessage.includes("network request failed") ||
    normalizedMessage.includes("fetch failed") ||
    normalizedMessage.includes("load failed") ||
    normalizedMessage.includes("could not reach")
  ) {
    return "We couldn't connect right now. Check your internet and try again.";
  }

  if (normalizedMessage.includes("aborted") || normalizedMessage.includes("timeout")) {
    return "The request took too long. Please try again.";
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

function buildHostCandidates(host: string | null, ports: readonly string[]) {
  if (!host) {
    return [];
  }

  return ports.map((port) => `http://${host}:${port}`);
}

export function getMobileApiBaseCandidates() {
  const apiEnv = String(process.env.EXPO_PUBLIC_API_ENV || "").trim().toLowerCase();
  const explicitBase = normalizeBaseUrl(process.env.EXPO_PUBLIC_API_URL);
  const productionBase = normalizeBaseUrl(process.env.EXPO_PUBLIC_API_URL_PRODUCTION);
  const developmentBase = normalizeBaseUrl(process.env.EXPO_PUBLIC_API_URL_DEVELOPMENT);
  const expoHost = extractExpoHostCandidate();
  const preferredEnvBase =
    apiEnv === "production" ? productionBase || explicitBase : developmentBase || explicitBase;

  return Array.from(
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
  const candidates = getMobileApiBaseCandidates();
  let lastNetworkError = "We couldn't connect right now. Check your internet and try again.";

  for (const apiBase of candidates) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const url = `${apiBase}${requestPath}${queryString}`;

    try {
      const response = await fetch(url, {
        method,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...headers,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      const rawText = await response.text();
      const parsed = rawText ? (JSON.parse(rawText) as T & { message?: string; error?: string }) : null;

      if (!response.ok) {
        return {
          data: (parsed ?? null) as T | null,
          error:
            (parsed &&
              typeof parsed === "object" &&
              (parsed.error || parsed.message)) ||
            `Request failed with status ${response.status}.`,
          ok: false,
          status: response.status,
          url,
        };
      }

      return {
        data: (parsed ?? {}) as T,
        ok: true,
        status: response.status,
        url,
      };
    } catch (error) {
      clearTimeout(timeout);
      lastNetworkError = toFriendlyNetworkError(error);
    }
  }

  return {
    data: null,
    error: lastNetworkError,
    ok: false,
    status: 0,
    url: candidates[0] ? `${candidates[0]}${requestPath}${queryString}` : `${requestPath}${queryString}`,
  };
}
