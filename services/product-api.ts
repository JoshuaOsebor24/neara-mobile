import { requestMobileApi } from "@/services/api";

export type BackendProductVariant = {
  id?: number | string;
  in_stock?: boolean;
  price?: number | string | null;
  stock_quantity?: number | string | null;
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
    variants?: {
      price: number;
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
    variants?: {
      price: number;
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
