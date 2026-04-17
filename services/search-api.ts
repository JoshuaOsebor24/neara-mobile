import { requestMobileApi } from "@/services/api";
import {
    getCachedUserLocation,
    type UserCoordinates,
} from "@/services/location";

export type SearchProductResult = {
  address?: string | null;
  category?: string | null;
  description?: string | null;
  distance?: string | null;
  distance_km?: number | null;
  id?: number | string | null;
  image_url?: string | null;
  in_stock?: boolean | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  match_source?: "store" | "product" | "variant" | string | null;
  price?: number | string | null;
  product_id?: number | string | null;
  product_name?: string | null;
  quantity?: number | string | null;
  unit_count?: number | string | null;
  store_id?: number | string | null;
  store_name?: string | null;
  variant?: string | null;
  variant_name?: string | null;
};

type SearchApiEnvelope = {
  data?: {
    results?: SearchProductResult[];
  } | null;
  error?: string;
  message?: string;
  results?: SearchProductResult[];
  success?: boolean;
};

function resolveSearchResults(payload: SearchApiEnvelope | null | undefined) {
  const nestedResults = payload?.data?.results;
  if (Array.isArray(nestedResults)) {
    return nestedResults;
  }

  const directResults = payload?.results;
  if (Array.isArray(directResults)) {
    return directResults;
  }

  return [];
}

function hasSearchResultsArray(payload: SearchApiEnvelope | null | undefined) {
  return (
    Array.isArray(payload?.data?.results) || Array.isArray(payload?.results)
  );
}

function appendCoordinates(
  query: URLSearchParams,
  coordinates?: UserCoordinates | null,
) {
  if (
    typeof coordinates?.latitude === "number" &&
    Number.isFinite(coordinates.latitude) &&
    typeof coordinates?.longitude === "number" &&
    Number.isFinite(coordinates.longitude)
  ) {
    query.set("lat", String(coordinates.latitude));
    query.set("lng", String(coordinates.longitude));
  }
}

export async function searchProducts(
  searchTerm: string,
  options?: {
    coordinates?: UserCoordinates | null;
    limit?: number;
    preview?: boolean;
  },
) {
  const normalizedQuery = searchTerm.replace(/\s+/g, " ").trim();

  if (normalizedQuery.length < 2) {
    return {
      message: !normalizedQuery
        ? "Search query is empty"
        : "Search query is too short",
      ok: true as const,
      results: [] as SearchProductResult[],
      status: 200,
    };
  }

  const query = new URLSearchParams();
  query.set("q", normalizedQuery);

  if (options?.preview) {
    query.set("preview", "1");
  }

  if (typeof options?.limit === "number" && Number.isFinite(options.limit)) {
    query.set("limit", String(Math.max(1, Math.floor(options.limit))));
  }

  appendCoordinates(query, options?.coordinates ?? getCachedUserLocation());

  const result = await requestMobileApi<SearchApiEnvelope>("/search", {
    method: "GET",
    query,
  });

  if (!result.ok) {
    return {
      error: result.error,
      ok: false as const,
      results: [] as SearchProductResult[],
      status: result.status,
    };
  }

  if (!hasSearchResultsArray(result.data)) {
    return {
      error: "We couldn't load search results right now.",
      ok: false as const,
      results: [] as SearchProductResult[],
      status: result.status,
    };
  }

  return {
    message: result.data.message,
    ok: true as const,
    results: resolveSearchResults(result.data),
    status: result.status,
  };
}
