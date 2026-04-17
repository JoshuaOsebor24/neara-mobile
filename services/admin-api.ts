import { requestMobileApi } from "@/services/api";

export type AdminOverviewStats = {
  total_admins: number;
  total_products: number;
  total_pro_users: number;
  total_store_owners: number;
  total_stores: number;
  total_users: number;
};

export type AdminStoreListItem = {
  address: string | null;
  category: string | null;
  country: string | null;
  created_at: string;
  delivery_available: boolean;
  id: number;
  is_suspended: boolean;
  owner_email: string | null;
  owner_id: number | null;
  owner_name: string | null;
  phone_number: string | null;
  product_count: number;
  state: string | null;
  store_name: string;
};

export type AdminStoreDetailProduct = {
  category: string | null;
  created_at: string;
  description: string | null;
  id: number;
  image_url: string | null;
  product_name: string;
  store_id: number;
  tags: string[];
  variants: {
    id: number;
    in_stock: boolean;
    price: number | string | null;
    stock_quantity: number | string | null;
    unit_count: number | string | null;
    variant_name: string | null;
  }[];
};

export type AdminStoreDetail = {
  address: string | null;
  category: string | null;
  country: string | null;
  created_at: string;
  delivery_available: boolean;
  description: string | null;
  header_images: string[];
  id: number;
  image_url: string | null;
  is_suspended: boolean;
  owner_email: string | null;
  owner_id: number | null;
  owner_name: string | null;
  phone_number: string | null;
  product_count: number;
  state: string | null;
  store_name: string;
};

export type AdminUserRecord = {
  created_at: string;
  email: string;
  has_owned_store?: boolean;
  id: number;
  is_admin: boolean;
  is_store_owner: boolean;
  name: string;
  phone_number: string | null;
  premium_status: boolean;
  role: string;
  roles: string[];
  store_count?: number;
};

type AdminStatsResponse = {
  stats?: AdminOverviewStats;
};

type AdminStoresResponse = {
  stores?: AdminStoreListItem[];
};

type AdminStoreDetailResponse = {
  products?: AdminStoreDetailProduct[];
  store?: AdminStoreDetail;
};

type AdminUsersResponse = {
  users?: AdminUserRecord[];
};

function invalidResponse(message: string) {
  return {
    error: message,
    ok: false as const,
  };
}

export async function fetchAdminOverview(token: string) {
  const result = await requestMobileApi<AdminStatsResponse>("/admin/stats", {
    method: "GET",
    token,
  });

  if (!result.ok) {
    return invalidResponse(
      result.error || "We couldn't load the admin overview right now.",
    );
  }

  if (!result.data?.stats) {
    return invalidResponse("We couldn't load the admin overview right now.");
  }

  return {
    ok: true as const,
    stats: result.data.stats,
  };
}

export async function fetchAdminStores(token: string) {
  const result = await requestMobileApi<AdminStoresResponse>("/admin/stores", {
    method: "GET",
    token,
  });

  if (!result.ok) {
    return invalidResponse(
      result.error || "We couldn't load stores right now.",
    );
  }

  if (!Array.isArray(result.data?.stores)) {
    return invalidResponse("We couldn't load stores right now.");
  }

  return {
    ok: true as const,
    stores: result.data.stores,
  };
}

export async function fetchAdminStoreDetail(token: string, storeId: string) {
  const result = await requestMobileApi<AdminStoreDetailResponse>(
    `/admin/stores/${storeId}`,
    {
      method: "GET",
      token,
    },
  );

  if (!result.ok) {
    return invalidResponse(
      result.error || "We couldn't load this store right now.",
    );
  }

  if (!result.data?.store || !Array.isArray(result.data.products)) {
    return invalidResponse("We couldn't load this store right now.");
  }

  return {
    ok: true as const,
    products: result.data.products,
    store: result.data.store,
  };
}

export async function fetchAdminUsers(token: string) {
  const result = await requestMobileApi<AdminUsersResponse>("/admin/users", {
    method: "GET",
    token,
  });

  if (!result.ok) {
    return invalidResponse(result.error || "We couldn't load users right now.");
  }

  if (!Array.isArray(result.data?.users)) {
    return invalidResponse("We couldn't load users right now.");
  }

  return {
    ok: true as const,
    users: result.data.users,
  };
}
