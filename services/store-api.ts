import { requestMobileApi, requestMobileApiNoCache } from "@/services/api";

const STORE_RESPONSE_CACHE_TTL_MS = 30_000;
const STORE_DETAIL_CACHE_TTL_MS = 20_000;
const storeResponseCache = new Map<
  string,
  {
    expiresAt: number;
    stores: BackendStore[];
  }
>();
const inflightStoreRequests = new Map<
  string,
  Promise<
    | {
        ok: true;
        status: number;
        stores: BackendStore[];
      }
    | {
        error: string;
        ok: false;
        status: number;
        stores: BackendStore[];
      }
  >
>();
const storeFullResponseCache = new Map<
  string,
  {
    expiresAt: number;
    value:
      | {
          ok: true;
          products: NonNullable<StoreFullResponse["products"]>;
          status: number;
          store: NonNullable<StoreFullResponse["store"]> | null;
        }
      | {
          error: string;
          ok: false;
          products: [];
          status: number;
          store: null;
        };
  }
>();
const inflightStoreFullRequests = new Map<
  string,
  Promise<
    | {
        ok: true;
        products: NonNullable<StoreFullResponse["products"]>;
        status: number;
        store: NonNullable<StoreFullResponse["store"]> | null;
      }
    | {
        error: string;
        ok: false;
        products: [];
        status: number;
        store: null;
      }
  >
>();
const storeDetailResponseCache = new Map<
  string,
  {
    expiresAt: number;
    value:
      | {
          ok: true;
          status: number;
          store: NonNullable<StoreDetailResponse["store"]> | null;
        }
      | {
          error: string;
          ok: false;
          status: number;
          store: null;
        };
  }
>();
const inflightStoreDetailRequests = new Map<
  string,
  Promise<
    | {
        ok: true;
        status: number;
        store: NonNullable<StoreDetailResponse["store"]> | null;
      }
    | {
        error: string;
        ok: false;
        status: number;
        store: null;
      }
  >
>();

export type BackendStore = {
  address?: string | null;
  category?: string | null;
  country?: string | null;
  delivery_available?: boolean | null;
  description?: string | null;
  distance_km?: number | string | null;
  header_images?: string[] | null;
  id?: number | string;
  image_url?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  phone_number?: string | null;
  state?: string | null;
  store_name?: string | null;
};

type UpdateStoreResponse = {
  message?: string;
  store?: BackendStore;
};

type CreateStoreResponse = {
  message?: string;
  store?: BackendStore & {
    description?: string | null;
    header_images?: string[] | null;
    state?: string | null;
    country?: string | null;
  };
};

type StoreFullResponse = {
  products?: {
    category?: string | null;
    description?: string | null;
    image_url?: string | null;
    product_id?: number | string;
    product_name?: string;
    tags?: string[] | null;
    variants?: {
      in_stock?: boolean;
      price?: number | string | null;
      stock_quantity?: number | string | null;
      unit_count?: number | string | null;
      variant_id?: number | string;
      variant_name?: string | null;
    }[];
  }[];
  store?: BackendStore & {
    description?: string | null;
    header_images?: string[] | null;
    latitude?: number | string | null;
    longitude?: number | string | null;
  };
};

type StoreDetailResponse = {
  store?: BackendStore & {
    description?: string | null;
    header_images?: string[] | null;
    latitude?: number | string | null;
    longitude?: number | string | null;
  };
};

type PublicStoresResponse = {
  stores?: (BackendStore & {
    description?: string | null;
    header_images?: string[] | null;
    latitude?: number | string | null;
    longitude?: number | string | null;
  })[];
};

function buildStoreRequestKey(location?: {
  latitude?: number | null;
  longitude?: number | null;
}) {
  if (
    typeof location?.latitude !== "number" ||
    typeof location?.longitude !== "number"
  ) {
    return "stores:global";
  }

  return `stores:distance:${location.latitude.toFixed(4)}:${location.longitude.toFixed(4)}`;
}

function cleanupStoreResponseCache() {
  const now = Date.now();

  for (const [key, entry] of storeResponseCache.entries()) {
    if (entry.expiresAt <= now) {
      storeResponseCache.delete(key);
    }
  }

  for (const [key, entry] of storeFullResponseCache.entries()) {
    if (entry.expiresAt <= now) {
      storeFullResponseCache.delete(key);
    }
  }

  for (const [key, entry] of storeDetailResponseCache.entries()) {
    if (entry.expiresAt <= now) {
      storeDetailResponseCache.delete(key);
    }
  }
}

function normalizeStoreList(stores: PublicStoresResponse["stores"]) {
  const deduped = new Map<string, BackendStore>();

  (stores ?? []).forEach((store) => {
    const id =
      store?.id === null || store?.id === undefined ? null : String(store.id);
    const storeName =
      typeof store?.store_name === "string" ? store.store_name.trim() : "";
    const latitude =
      typeof store?.latitude === "number"
        ? store.latitude
        : store?.latitude !== null && store?.latitude !== undefined
          ? Number(store.latitude)
          : null;
    const longitude =
      typeof store?.longitude === "number"
        ? store.longitude
        : store?.longitude !== null && store?.longitude !== undefined
          ? Number(store.longitude)
          : null;

    if (!id || !storeName || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return;
    }

    deduped.set(id, {
      ...store,
      id,
      latitude: Number(latitude),
      longitude: Number(longitude),
      store_name: storeName,
    });
  });

  return Array.from(deduped.values());
}

export async function fetchPublicStores() {
  return fetchStoresNearby();
}

export function invalidatePublicStoreCache() {
  storeResponseCache.clear();
  inflightStoreRequests.clear();
}

export function invalidateStoreCache(storeId?: string | null) {
  if (!storeId) {
    storeFullResponseCache.clear();
    storeDetailResponseCache.clear();
    inflightStoreFullRequests.clear();
    inflightStoreDetailRequests.clear();
    invalidatePublicStoreCache();
    return;
  }

  const normalizedStoreId = String(storeId);
  storeFullResponseCache.delete(normalizedStoreId);
  storeDetailResponseCache.delete(normalizedStoreId);
  inflightStoreFullRequests.delete(normalizedStoreId);
  inflightStoreDetailRequests.delete(normalizedStoreId);
  invalidatePublicStoreCache();
}

export async function fetchStoresNearby(location?: {
  latitude?: number | null;
  longitude?: number | null;
}) {
  cleanupStoreResponseCache();
  const params = new URLSearchParams();
  const requestKey = buildStoreRequestKey(location);
  const cachedEntry = storeResponseCache.get(requestKey);

  if (cachedEntry && cachedEntry.expiresAt > Date.now()) {
    return {
      ok: true as const,
      status: 200,
      stores: cachedEntry.stores,
    };
  }

  const inflightRequest = inflightStoreRequests.get(requestKey);

  if (inflightRequest) {
    return inflightRequest;
  }

  if (
    typeof location?.latitude === "number" &&
    typeof location?.longitude === "number"
  ) {
    params.set("lat", String(location.latitude));
    params.set("lng", String(location.longitude));
  }

  const request = (async () => {
    const result = await requestMobileApi<PublicStoresResponse>("/stores", {
      method: "GET",
      query: params,
    });

    if (!result.ok) {
      return {
        error: result.error,
        ok: false as const,
        status: result.status,
        stores: [],
      };
    }

    const stores = normalizeStoreList(result.data.stores);
    storeResponseCache.set(requestKey, {
      expiresAt: Date.now() + STORE_RESPONSE_CACHE_TTL_MS,
      stores,
    });

    return {
      ok: true as const,
      status: result.status,
      stores,
    };
  })();

  inflightStoreRequests.set(requestKey, request);

  try {
    return await request;
  } finally {
    inflightStoreRequests.delete(requestKey);
  }
}

export async function createStoreWithBackend(
  token: string,
  payload: {
    address: string;
    category: string;
    country?: string;
    delivery_available?: boolean;
    description?: string;
    header_images?: (string | null)[];
    image_url?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    phone_number?: string;
    state?: string;
    store_name: string;
  },
) {
  const result = await requestMobileApi<CreateStoreResponse>("/stores", {
    body: payload,
    method: "POST",
    token,
  });

  if (!result.ok || !result.data.store) {
    return {
      error: result.ok ? "Could not create this store." : result.error,
      ok: false as const,
      status: result.status,
      store: result.data?.store ?? null,
    };
  }

  invalidateStoreCache(
    result.data.store.id !== null && result.data.store.id !== undefined
      ? String(result.data.store.id)
      : null,
  );

  return {
    message: result.data.message,
    ok: true as const,
    status: result.status,
    store: result.data.store,
  };
}

export async function fetchStoreFullData(storeId: string) {
  cleanupStoreResponseCache();
  const normalizedStoreId = String(storeId);
  const cached = storeFullResponseCache.get(normalizedStoreId);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const inflight = inflightStoreFullRequests.get(normalizedStoreId);

  if (inflight) {
    return inflight;
  }

  const request = (async () => {
    const result = await requestMobileApiNoCache<StoreFullResponse>(`/stores/${normalizedStoreId}/full`, {
      method: "GET",
    });

    if (!result.ok) {
      return {
        error: result.error,
        ok: false as const,
        products: [] as [],
        status: result.status,
        store: null,
      };
    }

    const value = {
      ok: true as const,
      products: result.data.products ?? [],
      status: result.status,
      store: result.data.store ?? null,
    };

    storeFullResponseCache.set(normalizedStoreId, {
      expiresAt: Date.now() + STORE_DETAIL_CACHE_TTL_MS,
      value,
    });

    return value;
  })();

  inflightStoreFullRequests.set(normalizedStoreId, request);

  try {
    return await request;
  } finally {
    if (inflightStoreFullRequests.get(normalizedStoreId) === request) {
      inflightStoreFullRequests.delete(normalizedStoreId);
    }
  }
}

export async function fetchStoreById(storeId: string) {
  cleanupStoreResponseCache();
  const normalizedStoreId = String(storeId);
  const cached = storeDetailResponseCache.get(normalizedStoreId);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const inflight = inflightStoreDetailRequests.get(normalizedStoreId);

  if (inflight) {
    return inflight;
  }

  const request = (async () => {
    const result = await requestMobileApi<StoreDetailResponse>(`/stores/${normalizedStoreId}`, {
      method: "GET",
    });

    if (!result.ok) {
      return {
        error: result.error,
        ok: false as const,
        status: result.status,
        store: null,
      };
    }

    const value = {
      ok: true as const,
      status: result.status,
      store: result.data.store ?? null,
    };

    storeDetailResponseCache.set(normalizedStoreId, {
      expiresAt: Date.now() + STORE_DETAIL_CACHE_TTL_MS,
      value,
    });

    return value;
  })();

  inflightStoreDetailRequests.set(normalizedStoreId, request);

  try {
    return await request;
  } finally {
    if (inflightStoreDetailRequests.get(normalizedStoreId) === request) {
      inflightStoreDetailRequests.delete(normalizedStoreId);
    }
  }
}

export async function updateStoreWithBackend(
  token: string,
  storeId: string,
  payload: {
    address?: string;
    category?: string;
    country?: string;
    delivery_available?: boolean;
    description?: string;
    header_images?: (string | null)[];
    image_url?: string;
    latitude?: number;
    longitude?: number;
    phone_number?: string;
    state?: string;
    store_name?: string;
  },
) {
  const result = await requestMobileApi<UpdateStoreResponse>(`/stores/${storeId}`, {
    body: payload,
    method: "PUT",
    token,
  });

  if (!result.ok || !result.data.store) {
    return {
      error: result.ok ? "Could not update this store." : result.error,
      ok: false as const,
      status: result.status,
      store: null,
    };
  }

  invalidateStoreCache(String(storeId));

  return {
    message: result.data.message,
    ok: true as const,
    status: result.status,
    store: result.data.store,
  };
}
