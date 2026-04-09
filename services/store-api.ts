import { requestMobileApi } from "@/services/api";

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

type PublicStoresResponse = {
  stores?: (BackendStore & {
    description?: string | null;
    header_images?: string[] | null;
    latitude?: number | string | null;
    longitude?: number | string | null;
  })[];
};

export async function fetchPublicStores() {
  return fetchStoresNearby();
}

export async function fetchStoresNearby(location?: {
  latitude?: number | null;
  longitude?: number | null;
}) {
  const params = new URLSearchParams();

  if (typeof location?.latitude === "number" && typeof location?.longitude === "number") {
    params.set("lat", String(location.latitude));
    params.set("lng", String(location.longitude));
  }

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

  return {
    ok: true as const,
    status: result.status,
    stores: result.data.stores ?? [],
  };
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

  return {
    message: result.data.message,
    ok: true as const,
    status: result.status,
    store: result.data.store,
  };
}

export async function fetchStoreFullData(storeId: string) {
  const result = await requestMobileApi<StoreFullResponse>(`/stores/${storeId}/full`, {
    method: "GET",
  });

  if (!result.ok) {
    return {
      error: result.error,
      ok: false as const,
      products: [],
      status: result.status,
      store: null,
    };
  }

  return {
    ok: true as const,
    products: result.data.products ?? [],
    status: result.status,
    store: result.data.store ?? null,
  };
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

  return {
    message: result.data.message,
    ok: true as const,
    status: result.status,
    store: result.data.store,
  };
}
