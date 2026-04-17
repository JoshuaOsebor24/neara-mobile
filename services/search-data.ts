import {
    getCachedUserLocation,
    type UserCoordinates,
} from "@/services/location";
import { parseCoordinate } from "@/services/map-links";
import { searchProducts } from "@/services/search-api";

const SEARCH_CACHE_TTL_MS = 15_000;

export type SearchResultRecord = {
  address: string;
  category: string;
  distance: string;
  distanceKm: number | null;
  id: string;
  image: string | null;
  kind: "product" | "store";
  latitude: number | null;
  longitude: number | null;
  matchSource: string;
  price: number | null;
  productId: string | null;
  productName: string;
  storeId: string;
  storeName: string;
  variant: string;
};

export type SearchCardVariant = {
  key: string;
  label: string | null;
  priceLabel?: string;
};

export type SearchCardRecord = {
  address: string;
  category: string;
  distance: string;
  image: string | null;
  key: string;
  latitude: number | null;
  longitude: number | null;
  productId: string;
  productName: string;
  store: string;
  storeId: string;
  variants: SearchCardVariant[];
};

const searchCache = new Map<
  string,
  {
    expiresAt: number;
    value:
      | {
          cards: SearchCardRecord[];
          items: SearchResultRecord[];
          ok: true;
          status: number;
        }
      | {
          cards: SearchCardRecord[];
          error: string;
          items: SearchResultRecord[];
          ok: false;
          status: number;
        };
  }
>();
const inflightSearchRequests = new Map<
  string,
  Promise<
    | {
        cards: SearchCardRecord[];
        items: SearchResultRecord[];
        ok: true;
        status: number;
      }
    | {
        cards: SearchCardRecord[];
        error: string;
        items: SearchResultRecord[];
        ok: false;
        status: number;
      }
  >
>();

function normalizeQuery(value: string) {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function parseOptionalNumber(value: number | string | null | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatDistanceLabel(
  distanceKm: number | null | undefined,
  fallback = "",
) {
  if (typeof distanceKm === "number" && Number.isFinite(distanceKm)) {
    return `${distanceKm.toFixed(distanceKm < 10 ? 1 : 0)} km`;
  }

  return fallback;
}

function formatPrice(price: number | null) {
  if (price === null) {
    return "View store";
  }

  return `₦${price.toLocaleString("en-NG")}`;
}

function buildSearchKey(
  query: string,
  options?: {
    coordinates?: UserCoordinates | null;
    limit?: number;
    preview?: boolean;
  },
) {
  const coordinates = options?.coordinates ?? getCachedUserLocation();
  const latitude = coordinates?.latitude?.toFixed(4) || "none";
  const longitude = coordinates?.longitude?.toFixed(4) || "none";

  return [
    normalizeQuery(query),
    options?.preview ? "preview" : "full",
    typeof options?.limit === "number" ? String(options.limit) : "default",
    latitude,
    longitude,
  ].join(":");
}

function normalizeSearchItems(
  results: Awaited<ReturnType<typeof searchProducts>>["results"],
) {
  return results
    .filter((item) => item.store_id && item.store_name)
    .map((item, index) => ({
      address: typeof item.address === "string" ? item.address : "",
      category: typeof item.category === "string" ? item.category : "",
      distance:
        typeof item.distance === "string"
          ? item.distance
          : formatDistanceLabel(parseOptionalNumber(item.distance_km)),
      distanceKm: parseOptionalNumber(item.distance_km),
      id: `${item.store_id}-${item.product_id || index}-${item.variant_name || item.variant || "result"}`,
      image:
        typeof item.image_url === "string" && item.image_url.trim()
          ? item.image_url
          : null,
      kind:
        item.match_source === "store" ||
        ((item.product_id === null || item.product_id === undefined) &&
          !(typeof item.product_name === "string" && item.product_name.trim()))
          ? ("store" as const)
          : ("product" as const),
      latitude: parseCoordinate(item.latitude),
      longitude: parseCoordinate(item.longitude),
      matchSource:
        typeof item.match_source === "string" ? item.match_source : "",
      price: parseOptionalNumber(item.price),
      productId:
        item.product_id === null || item.product_id === undefined
          ? null
          : String(item.product_id),
      productName:
        typeof item.product_name === "string" ? item.product_name.trim() : "",
      storeId: String(item.store_id),
      storeName: item.store_name || "",
      variant: item.variant_name || item.variant || "",
    }));
}

export function groupSearchResultCards(items: SearchResultRecord[]) {
  const groups = new Map<string, SearchCardRecord>();

  items.forEach((item) => {
    const normalizedProductName = item.productName.trim().toLowerCase();
    const isStoreMatch = item.kind === "store";
    const key = isStoreMatch
      ? `${item.storeId}::store`
      : item.productId
        ? `${item.storeId}::${item.productId}`
        : `${item.storeId}::${normalizedProductName}`;
    const priceLabel =
      item.price !== null ? formatPrice(item.price) : undefined;
    const variantLabel = isStoreMatch ? null : item.variant.trim() || null;
    const variantKey = `${item.id}::${variantLabel || "base"}::${priceLabel || "no-price"}`;
    const existing = groups.get(key);

    if (!existing) {
      groups.set(key, {
        address: item.address,
        category: item.category,
        distance: item.distance,
        image: item.image,
        key,
        latitude: item.latitude,
        longitude: item.longitude,
        productId: item.productId || "",
        productName: item.productName || "Store match",
        store: item.storeName,
        storeId: item.storeId,
        variants: isStoreMatch
          ? []
          : [{ key: variantKey, label: variantLabel, priceLabel }],
      });
      return;
    }

    if (isStoreMatch) {
      return;
    }

    if (
      !existing.variants.some(
        (variant) =>
          variant.label === variantLabel && variant.priceLabel === priceLabel,
      )
    ) {
      existing.variants.push({
        key: variantKey,
        label: variantLabel,
        priceLabel,
      });
    }
  });

  return Array.from(groups.values());
}

function cleanupSearchCache() {
  const now = Date.now();

  for (const [key, entry] of searchCache.entries()) {
    if (entry.expiresAt <= now) {
      searchCache.delete(key);
    }
  }
}

export async function loadSearchResults(
  query: string,
  options?: {
    coordinates?: UserCoordinates | null;
    limit?: number;
    preview?: boolean;
  },
) {
  cleanupSearchCache();

  const key = buildSearchKey(query, options);
  const cached = searchCache.get(key);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const inflight = inflightSearchRequests.get(key);

  if (inflight) {
    return inflight;
  }

  const request = (async () => {
    const result = await searchProducts(query, options);

    if (!result.ok) {
      return {
        cards: [] as SearchCardRecord[],
        error: result.error,
        items: [] as SearchResultRecord[],
        ok: false as const,
        status: result.status,
      };
    }

    const items = normalizeSearchItems(result.results);
    const value = {
      cards: groupSearchResultCards(items),
      items,
      ok: true as const,
      status: result.status,
    };

    searchCache.set(key, {
      expiresAt: Date.now() + SEARCH_CACHE_TTL_MS,
      value,
    });

    return value;
  })();

  inflightSearchRequests.set(key, request);

  try {
    return await request;
  } finally {
    if (inflightSearchRequests.get(key) === request) {
      inflightSearchRequests.delete(key);
    }
  }
}

export { normalizeQuery };
