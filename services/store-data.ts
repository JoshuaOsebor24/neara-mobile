import { parseCoordinate } from "@/services/map-links";
import {
  fetchStoreById,
  fetchStoreFullData,
  fetchStoresNearby,
  type BackendStore,
} from "@/services/store-api";
import { fetchStoreProducts } from "@/services/product-api";

const NEARBY_STORE_RADIUS_KM = 6;

export type StoreRecord = {
  address: string;
  category: string;
  country: string;
  deliveryAvailable: boolean;
  description: string;
  headerImages: string[];
  id: number;
  imageUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  phoneNumber: string;
  state: string;
  storeName: string;
};

export type StoreListItem = {
  address: string;
  category: string;
  distanceKm: number | null;
  id: string;
  image: string | null;
  latitude: number | null;
  longitude: number | null;
  name: string;
  phoneNumber: string;
};

export type StoreCatalog = {
  browseStores: StoreListItem[];
  mapPins: StoreListItem[];
  nearbyStores: StoreListItem[];
  stores: StoreListItem[];
};

export type StoreProductVariantRecord = {
  id: string;
  inStock: boolean;
  label: string;
  price: number;
  stockQuantity: number;
  unitCount: number;
};

export type StoreProductRecord = {
  category: string;
  description: string;
  id: string;
  image: string;
  name: string;
  storeId: string;
  tags: string[];
  variants: StoreProductVariantRecord[];
};

export type StoreDetailRecord = {
  products: StoreProductRecord[];
  store: StoreRecord | null;
};

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeOptionalText(value: unknown) {
  const normalized = normalizeText(value);
  return normalized || null;
}

function normalizeIdentifier(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
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

function normalizeStoreImageUri(value: string | null | undefined) {
  const uri = normalizeText(value);

  if (!uri || uri.startsWith("data:")) {
    return null;
  }

  return uri;
}

function normalizeStorePhotos(
  photos: (string | null | undefined)[],
  fallback = "",
) {
  const normalized = photos
    .map((photo) => normalizeText(photo))
    .filter(Boolean);
  const primary = normalizeText(fallback);

  if (!primary) {
    return normalized;
  }

  return [primary, ...normalized.filter((photo) => photo !== primary)];
}

function createVariantKey(
  productId?: string | number | null,
  variantName?: string | null,
) {
  return `${String(productId || "product")}:${normalizeText(variantName) || "variant"}`;
}

export function normalizeStoreRecord(store: BackendStore): StoreRecord | null {
  const id = parseOptionalNumber(store.id);
  const storeName = normalizeText(store.store_name);

  if (id === null || !storeName) {
    return null;
  }

  const imageUrl = normalizeStoreImageUri(store.image_url);
  const headerImages = normalizeStorePhotos(
    Array.isArray(store.header_images) ? store.header_images : [],
    imageUrl || "",
  );

  return {
    address: normalizeText(store.address),
    category: normalizeText(store.category),
    country: normalizeText(store.country),
    deliveryAvailable: Boolean(store.delivery_available),
    description: normalizeText(store.description),
    headerImages,
    id,
    imageUrl,
    latitude: parseCoordinate(store.latitude),
    longitude: parseCoordinate(store.longitude),
    phoneNumber: normalizeText(store.phone_number),
    state: normalizeText(store.state),
    storeName,
  };
}

export function computeDistanceKm(
  origin?: {
    latitude?: number | null;
    longitude?: number | null;
  } | null,
  target?: {
    latitude?: number | null;
    longitude?: number | null;
  } | null,
) {
  if (
    typeof origin?.latitude !== "number" ||
    typeof origin?.longitude !== "number" ||
    typeof target?.latitude !== "number" ||
    typeof target?.longitude !== "number"
  ) {
    return null;
  }

  const toRadians = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const deltaLatitude = toRadians(target.latitude - origin.latitude);
  const deltaLongitude = toRadians(target.longitude - origin.longitude);
  const originLatitude = toRadians(origin.latitude);
  const targetLatitude = toRadians(target.latitude);
  const a =
    Math.sin(deltaLatitude / 2) * Math.sin(deltaLatitude / 2) +
    Math.cos(originLatitude) *
      Math.cos(targetLatitude) *
      Math.sin(deltaLongitude / 2) *
      Math.sin(deltaLongitude / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusKm * c;
}

function toStoreListItem(
  store: StoreRecord,
  origin?: {
    latitude?: number | null;
    longitude?: number | null;
  } | null,
) {
  return {
    address: store.address,
    category: store.category,
    distanceKm: computeDistanceKm(origin, store),
    id: String(store.id),
    image: store.imageUrl,
    latitude: store.latitude,
    longitude: store.longitude,
    name: store.storeName,
    phoneNumber: store.phoneNumber,
  };
}

export function buildStoreCatalog(
  stores: BackendStore[],
  origin?: {
    latitude?: number | null;
    longitude?: number | null;
  } | null,
) {
  const deduped = new Map<number, StoreRecord>();

  stores.forEach((store) => {
    const normalized = normalizeStoreRecord(store);

    if (!normalized || normalized.latitude === null || normalized.longitude === null) {
      return;
    }

    deduped.set(normalized.id, normalized);
  });

  const storeItems = Array.from(deduped.values()).map((store) =>
    toStoreListItem(store, origin),
  );
  const sortedStores = [...storeItems].sort((left, right) => {
    if (
      typeof left.distanceKm === "number" &&
      Number.isFinite(left.distanceKm) &&
      typeof right.distanceKm === "number" &&
      Number.isFinite(right.distanceKm)
    ) {
      return left.distanceKm - right.distanceKm;
    }

    if (typeof left.distanceKm === "number" && Number.isFinite(left.distanceKm)) {
      return -1;
    }

    if (typeof right.distanceKm === "number" && Number.isFinite(right.distanceKm)) {
      return 1;
    }

    return left.name.localeCompare(right.name);
  });
  const nearbyStores = sortedStores.filter(
    (store) =>
      typeof store.distanceKm === "number" &&
      Number.isFinite(store.distanceKm) &&
      store.distanceKm <= NEARBY_STORE_RADIUS_KM,
  );
  const browseStores =
    sortedStores.length > 0
      ? sortedStores
      : [...storeItems].sort((left, right) => left.name.localeCompare(right.name));

  return {
    browseStores: browseStores.slice(0, 6),
    mapPins: sortedStores,
    nearbyStores: (nearbyStores.length > 0 ? nearbyStores : browseStores).slice(0, 6),
    stores: sortedStores,
  } satisfies StoreCatalog;
}

export async function loadPublicStoreCatalog(options?: {
  coordinates?: {
    latitude?: number | null;
    longitude?: number | null;
  } | null;
}) {
  const result = await fetchStoresNearby(options?.coordinates ?? undefined);

  if (!result.ok) {
    return {
      browseStores: [] as StoreListItem[],
      error: result.error,
      mapPins: [] as StoreListItem[],
      nearbyStores: [] as StoreListItem[],
      ok: false as const,
      status: result.status,
      stores: [] as StoreListItem[],
    };
  }

  const catalog = buildStoreCatalog(result.stores, options?.coordinates);

  return {
    ...catalog,
    ok: true as const,
    status: result.status,
  };
}

export function normalizeStoreProductRecord(
  storeId: string,
  product: {
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
  },
  fallbackCategory = "",
) {
  const id = normalizeIdentifier(product.product_id);
  const name = normalizeText(product.product_name);

  if (!id || !name) {
    return null;
  }

  return {
    category: normalizeText(product.category) || fallbackCategory,
    description: normalizeText(product.description),
    id,
    image: normalizeText(product.image_url),
    name,
    storeId,
    tags: Array.isArray(product.tags)
      ? product.tags.map((tag) => normalizeText(tag)).filter(Boolean)
      : [],
    variants:
      product.variants?.map((variant) => ({
        id:
          normalizeIdentifier(variant.variant_id) ||
          createVariantKey(product.product_id, variant.variant_name),
        inStock: Boolean(variant.in_stock),
        label: normalizeText(variant.variant_name),
        price: parseOptionalNumber(variant.price) ?? 0,
        stockQuantity: parseOptionalNumber(variant.stock_quantity) ?? 0,
        unitCount: parseOptionalNumber(variant.unit_count) ?? 1,
      })) ?? [],
  } satisfies StoreProductRecord;
}

export function normalizeStoreDetailPayload(
  storeId: string,
  payload: {
    products: {
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
    store: BackendStore | null;
  }): StoreDetailRecord {
  const normalizedStore = payload.store ? normalizeStoreRecord(payload.store) : null;
  const products = payload.products
    .map((product) =>
      normalizeStoreProductRecord(
        storeId,
        product,
        normalizedStore?.category || "",
      ),
    )
    .filter((product): product is StoreProductRecord => product !== null);

  return {
    products,
    store: normalizedStore,
  };
}

export async function loadStoreDetailRecord(storeId: string) {
  const result = await fetchStoreFullData(String(storeId));

  if (result.ok) {
    const normalized = normalizeStoreDetailPayload(String(storeId), {
      products: result.products,
      store: result.store,
    });

    return {
      ...normalized,
      ok: true as const,
      status: result.status,
    };
  }

  const [storeResult, productsResult] = await Promise.all([
    fetchStoreById(String(storeId)),
    fetchStoreProducts(String(storeId)),
  ]);

  if (!storeResult.ok || !storeResult.store) {
    return {
      error: result.error,
      ok: false as const,
      products: [] as StoreProductRecord[],
      status: result.status,
      store: null,
    };
  }

  const normalizedStore = normalizeStoreRecord(storeResult.store);
  const normalizedProducts = productsResult.ok
    ? productsResult.products
        .map((product) =>
          normalizeStoreProductRecord(
            String(storeId),
            product,
            normalizedStore?.category || "",
          ),
        )
        .filter((product): product is StoreProductRecord => product !== null)
    : [];

  return {
    error: productsResult.ok ? undefined : productsResult.error,
    ok: true as const,
    products: normalizedProducts,
    status: storeResult.status,
    store: normalizedStore,
  };
}

export async function loadStoreProductsRecord(
  storeId: string,
  options?: {
    forceRefresh?: boolean;
  },
) {
  const result = await fetchStoreProducts(String(storeId), options);

  if (!result.ok) {
    return {
      error: result.error,
      ok: false as const,
      products: [] as StoreProductRecord[],
      status: result.status,
    };
  }

  const products = result.products
    .map((product) =>
      normalizeStoreProductRecord(String(storeId), product),
    )
    .filter((product): product is StoreProductRecord => product !== null);

  return {
    ok: true as const,
    products,
    status: result.status,
  };
}

export async function loadStoreRecord(storeId: string) {
  const result = await fetchStoreById(String(storeId));

  if (!result.ok) {
    return {
      error: result.error,
      ok: false as const,
      status: result.status,
      store: null,
    };
  }

  return {
    ok: true as const,
    status: result.status,
    store: result.store ? normalizeStoreRecord(result.store) : null,
  };
}

export function toSavedStorePayload(store: {
  address: string;
  category: string;
  id: number | string;
  image?: string | null;
  imageUrl?: string | null;
  phoneNumber: string;
  storeName?: string;
  name?: string;
}) {
  const numericId = Number.parseInt(String(store.id), 10);

  if (!Number.isFinite(numericId)) {
    return null;
  }

  return {
    address: normalizeText(store.address),
    category: normalizeText(store.category),
    id: numericId,
    image_url: normalizeOptionalText(store.imageUrl ?? store.image),
    phone_number: normalizeText(store.phoneNumber),
    store_name: normalizeText(store.storeName ?? store.name) || "Store",
  };
}
