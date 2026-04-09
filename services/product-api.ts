import {
  getMobileApiBaseCandidates,
  requestMobileApi,
} from "@/services/api";

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

export async function fetchStoreProducts(storeId: string) {
  const result = await requestMobileApi<ProductListResponse>(`/products?store_id=${storeId}`, {
    method: "GET",
  });

  if (!result.ok) {
    return {
      error: result.error,
      ok: false as const,
      products: [] as BackendProduct[],
      status: result.status,
    };
  }

  return {
    ok: true as const,
    products: result.data.products ?? [],
    status: result.status,
  };
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
      error: result.ok ? "Could not add this product." : result.error,
      ok: false as const,
      product: null,
      status: result.status,
    };
  }

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
  const candidates = getMobileApiBaseCandidates();
  let lastNetworkError =
    "We couldn't connect right now. Check your internet and try again.";

  for (const apiBase of candidates) {
    const formData = new FormData();
    formData.append("store_id", String(payload.store_id));
    formData.append("file", {
      name: payload.file.name,
      type: payload.file.mimeType || "text/csv",
      uri: payload.file.uri,
    } as never);

    const url = `${apiBase}/products/import`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const rawText = await response.text();
      const parsed = rawText
        ? (JSON.parse(rawText) as ProductMutationResponse & {
            count?: number;
            products?: BackendProduct[];
          })
        : null;

      if (!response.ok) {
        return {
          count: 0,
          error:
            parsed?.message || `Request failed with status ${response.status}.`,
          errors:
            parsed?.errors?.map((item) => ({
              message: item.message || "Invalid row",
              row: Number(item.row || 0),
            })) || [],
          ok: false as const,
          products: [] as BackendProduct[],
          status: response.status,
        };
      }

      return {
        count: parsed?.count ?? parsed?.products?.length ?? 0,
        errors: [] as { message: string; row: number }[],
        message: parsed?.message,
        ok: true as const,
        products: parsed?.products ?? [],
        status: response.status,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message.toLowerCase() : "";

      if (
        message.includes("network request failed") ||
        message.includes("fetch failed") ||
        message.includes("load failed")
      ) {
        lastNetworkError =
          "We couldn't connect right now. Check your internet and try again.";
      } else {
        lastNetworkError =
          "Something went wrong while importing products. Please try again.";
      }
    }
  }

  return {
    count: 0,
    error: lastNetworkError,
    errors: [] as { message: string; row: number }[],
    ok: false as const,
    products: [] as BackendProduct[],
    status: 0,
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
  const result = await requestMobileApi<ProductMutationResponse>(`/products/${productId}`, {
    body: payload,
    method: "PUT",
    token,
  });

  if (!result.ok || !result.data.product) {
    return {
      error: result.ok ? "Could not update this product." : result.error,
      ok: false as const,
      product: null,
      status: result.status,
    };
  }

  return {
    message: result.data.message,
    ok: true as const,
    product: result.data.product,
    status: result.status,
  };
}

export async function deleteProductWithBackend(token: string, productId: string) {
  const result = await requestMobileApi<ProductDeleteResponse>(`/products/${productId}`, {
    method: "DELETE",
    token,
  });

  if (!result.ok) {
    return {
      error: result.error,
      ok: false as const,
      status: result.status,
    };
  }

  return {
    message: result.data.message,
    ok: true as const,
    status: result.status,
  };
}
