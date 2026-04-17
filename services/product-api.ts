import {
    requestMobileApi,
    requestMobileApiFormData,
    requestMobileApiNoCache,
} from "@/services/api";
import { invalidateStoreCache } from "@/services/store-api";

const STORE_PRODUCT_CACHE_TTL_MS = 20_000;
const storeProductsCache = new Map<
  string,
  {
    expiresAt: number;
    value:
      | {
          ok: true;
          products: BackendProduct[];
          status: number;
        }
      | {
          error: string;
          ok: false;
          products: BackendProduct[];
          status: number;
        };
  }
>();
const inflightStoreProductsRequests = new Map<
  string,
  Promise<
    | {
        ok: true;
        products: BackendProduct[];
        status: number;
      }
    | {
        error: string;
        ok: false;
        products: BackendProduct[];
        status: number;
      }
  >
>();

export type BackendProductVariant = {
  id?: number | string;
  in_stock?: boolean;
  price?: number | string | null;
  stock_quantity?: number | string | null;
  unit_count?: number | string | null;
  variant_id?: number | string;
  variant_name?: string | null;
};

export type BackendProduct = {
  category?: string | null;
  description?: string | null;
  id?: number | string;
  image_url?: string | null;
  product_id?: number | string;
  product_name?: string;
  tags?: string[] | null;
  variants?: BackendProductVariant[];
};

type ProductListResponse = {
  products?: BackendProduct[];
};

type LegacyProductListResponse = {
  products?: BackendProduct[];
};

type ProductMutationResponse = {
  errors?: {
    message?: string;
    row?: number;
  }[];
  message?: string;
  product?: BackendProduct;
};

type ProductDeleteResponse = {
  message?: string;
};

function buildInvalidPayloadError(context: string) {
  return `We couldn't load ${context} right now.`;
}

function cleanupStoreProductsCache() {
  const now = Date.now();

  for (const [key, entry] of storeProductsCache.entries()) {
    if (entry.expiresAt <= now) {
      storeProductsCache.delete(key);
    }
  }
}

export function invalidateStoreProductCache(storeId?: string | number | null) {
  if (storeId === null || storeId === undefined || storeId === "") {
    storeProductsCache.clear();
    inflightStoreProductsRequests.clear();
    return;
  }

  const normalizedStoreId = String(storeId);
  storeProductsCache.delete(normalizedStoreId);
  inflightStoreProductsRequests.delete(normalizedStoreId);
}

export async function fetchStoreProducts(
  storeId: string,
  options?: {
    forceRefresh?: boolean;
  },
) {
  cleanupStoreProductsCache();
  const normalizedStoreId = String(storeId);
  const forceRefresh = Boolean(options?.forceRefresh);

  if (forceRefresh) {
    storeProductsCache.delete(normalizedStoreId);
    inflightStoreProductsRequests.delete(normalizedStoreId);
  }

  const cached = storeProductsCache.get(normalizedStoreId);

  if (!forceRefresh && cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const inflight = inflightStoreProductsRequests.get(normalizedStoreId);

  if (!forceRefresh && inflight) {
    return inflight;
  }

  const request = (async () => {
    const query = new URLSearchParams();
    query.set("store_id", normalizedStoreId);
    const result = await requestMobileApiNoCache<ProductListResponse>(
      "/products",
      {
        method: "GET",
        query,
      },
    );

    if (!result.ok) {
      const legacyResult =
        await requestMobileApiNoCache<LegacyProductListResponse>(
          `/products/${normalizedStoreId}`,
          {
            method: "GET",
          },
        );

      if (!legacyResult.ok) {
        return {
          error: result.error,
          ok: false as const,
          products: [] as BackendProduct[],
          status: result.status,
        };
      }

      if (!Array.isArray(legacyResult.data.products)) {
        return {
          error: buildInvalidPayloadError("store products"),
          ok: false as const,
          products: [] as BackendProduct[],
          status: legacyResult.status,
        };
      }

      const value = {
        ok: true as const,
        products: legacyResult.data.products,
        status: legacyResult.status,
      };

      storeProductsCache.set(normalizedStoreId, {
        expiresAt: Date.now() + STORE_PRODUCT_CACHE_TTL_MS,
        value,
      });

      return value;
    }

    if (!Array.isArray(result.data.products)) {
      return {
        error: buildInvalidPayloadError("store products"),
        ok: false as const,
        products: [] as BackendProduct[],
        status: result.status,
      };
    }

    const value = {
      ok: true as const,
      products: result.data.products,
      status: result.status,
    };

    storeProductsCache.set(normalizedStoreId, {
      expiresAt: Date.now() + STORE_PRODUCT_CACHE_TTL_MS,
      value,
    });

    return value;
  })();

  inflightStoreProductsRequests.set(normalizedStoreId, request);

  try {
    return await request;
  } finally {
    if (inflightStoreProductsRequests.get(normalizedStoreId) === request) {
      inflightStoreProductsRequests.delete(normalizedStoreId);
    }
  }
}

export async function createProductWithBackend(
  token: string,
  payload: {
    category?: string;
    description?: string;
    image_url?: string;
    price?: number;
    product_name: string;
    store_id: number;
    tags?: string[];
    unit_count?: number;
    variants?: {
      price: number;
      unit_count?: number;
      stock_quantity: number;
      variant_name: string;
    }[];
  },
) {
  const result = await requestMobileApi<ProductMutationResponse>("/products", {
    body: payload,
    method: "POST",
    token,
  });

  if (!result.ok || !result.data.product) {
    return {
      error: result.ok
        ? "We couldn't add this product right now."
        : result.error,
      ok: false as const,
      product: null,
      status: result.status,
    };
  }

  invalidateStoreProductCache(payload.store_id);
  invalidateStoreCache(String(payload.store_id));

  return {
    message: result.data.message,
    ok: true as const,
    product: result.data.product,
    status: result.status,
  };
}

export async function importProductsCsvWithBackend(
  token: string,
  payload: {
    file: {
      mimeType?: string | null;
      name: string;
      uri: string;
    };
    store_id: number;
  },
) {
  const formData = new FormData();
  formData.append("store_id", String(payload.store_id));
  formData.append("file", {
    name: payload.file.name,
    type: payload.file.mimeType || "text/csv",
    uri: payload.file.uri,
  } as never);

  const result = await requestMobileApiFormData<
    ProductMutationResponse & {
      count?: number;
      products?: BackendProduct[];
    }
  >("/products/import", {
    body: formData,
    method: "POST",
    token,
  });

  if (!result.ok) {
    return {
      count: 0,
      error: result.error,
      errors:
        result.data?.errors?.map((item) => ({
          message: item.message || "Invalid row",
          row: Number(item.row || 0),
        })) || [],
      ok: false as const,
      products: [] as BackendProduct[],
      status: result.status,
    };
  }

  invalidateStoreProductCache(payload.store_id);
  invalidateStoreCache(String(payload.store_id));

  return {
    count: result.data.count ?? result.data.products?.length ?? 0,
    errors: [] as { message: string; row: number }[],
    message: result.data.message,
    ok: true as const,
    products: Array.isArray(result.data.products) ? result.data.products : [],
    status: result.status,
  };
}

export async function updateProductWithBackend(
  token: string,
  productId: string,
  payload: {
    category?: string;
    description?: string;
    image_url?: string;
    price?: number;
    product_name: string;
    tags?: string[];
    unit_count?: number;
    variants?: {
      price: number;
      unit_count?: number;
      stock_quantity: number;
      variant_name: string;
    }[];
  },
) {
  const result = await requestMobileApi<ProductMutationResponse>(
    `/products/${productId}`,
    {
      body: payload,
      method: "PUT",
      token,
    },
  );

  if (!result.ok || !result.data.product) {
    return {
      error: result.ok
        ? "We couldn't save this product right now."
        : result.error,
      ok: false as const,
      product: null,
      status: result.status,
    };
  }

  invalidateStoreProductCache();
  invalidateStoreCache();

  return {
    message: result.data.message,
    ok: true as const,
    product: result.data.product,
    status: result.status,
  };
}

export async function deleteProductWithBackend(
  token: string,
  productId: string,
) {
  const result = await requestMobileApi<ProductDeleteResponse>(
    `/products/${productId}`,
    {
      method: "DELETE",
      token,
    },
  );

  if (!result.ok) {
    return {
      error: result.error,
      ok: false as const,
      status: result.status,
    };
  }

  invalidateStoreProductCache();
  invalidateStoreCache();

  return {
    message: result.data.message,
    ok: true as const,
    status: result.status,
  };
}
