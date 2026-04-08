import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSyncExternalStore } from "react";

import { requestMobileApi } from "@/services/api";
import { getMobileSession } from "@/services/mobile-session";

export type SavedStoreRecord = {
  address?: string | null;
  category?: string | null;
  created_at?: string;
  id?: number;
  image_url?: string | null;
  phone_number?: string | null;
  store_id: number;
  store_name: string;
};

export type RecentStoreRecord = {
  address?: string | null;
  category?: string | null;
  image_url?: string | null;
  phone_number?: string | null;
  store_id: number;
  store_name: string;
  viewed_at: string;
};

const STORAGE_PREFIX = "neara:saved-stores:v1";
const RECENT_STORAGE_PREFIX = "neara:recent-stores:v1";
const MAX_RECENT_STORES = 8;

type CollectionState = {
  recentStores: RecentStoreRecord[];
  savedStores: SavedStoreRecord[];
};

type PublicStoreRecord = {
  address?: string | null;
  category?: string | null;
  id: number;
  image_url?: string | null;
  phone_number?: string | null;
  store_name: string;
};

let collectionState: CollectionState = {
  recentStores: [],
  savedStores: [],
};
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function buildStorageKey() {
  const session = getMobileSession();
  const userKey = session.id
    ? `id:${session.id}`
    : session.email.trim()
      ? `email:${session.email.trim().toLowerCase()}`
      : "guest";

  return `${STORAGE_PREFIX}:${userKey}`;
}

function buildRecentStorageKey() {
  const session = getMobileSession();
  const userKey = session.id
    ? `id:${session.id}`
    : session.email.trim()
      ? `email:${session.email.trim().toLowerCase()}`
      : "guest";

  return `${RECENT_STORAGE_PREFIX}:${userKey}`;
}

function normalizeSavedStore(value: unknown): SavedStoreRecord | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const raw = value as Partial<SavedStoreRecord> & { store_id?: unknown };
  const storeId =
    typeof raw.store_id === "number"
      ? raw.store_id
      : Number.parseInt(String(raw.store_id || ""), 10);

  if (!Number.isFinite(storeId) || typeof raw.store_name !== "string") {
    return null;
  }

  return {
    address: typeof raw.address === "string" ? raw.address : null,
    category: typeof raw.category === "string" ? raw.category : null,
    created_at: typeof raw.created_at === "string" ? raw.created_at : undefined,
    id: typeof raw.id === "number" ? raw.id : undefined,
    image_url: typeof raw.image_url === "string" ? raw.image_url : null,
    phone_number: typeof raw.phone_number === "string" ? raw.phone_number : null,
    store_id: storeId,
    store_name: raw.store_name,
  };
}

function normalizeRecentStore(value: unknown): RecentStoreRecord | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const raw = value as Partial<RecentStoreRecord> & { store_id?: unknown };
  const storeId =
    typeof raw.store_id === "number"
      ? raw.store_id
      : Number.parseInt(String(raw.store_id || ""), 10);

  if (
    !Number.isFinite(storeId) ||
    typeof raw.store_name !== "string" ||
    typeof raw.viewed_at !== "string"
  ) {
    return null;
  }

  return {
    address: typeof raw.address === "string" ? raw.address : null,
    category: typeof raw.category === "string" ? raw.category : null,
    image_url: typeof raw.image_url === "string" ? raw.image_url : null,
    phone_number: typeof raw.phone_number === "string" ? raw.phone_number : null,
    store_id: storeId,
    store_name: raw.store_name,
    viewed_at: raw.viewed_at,
  };
}

function normalizePublicStore(value: unknown): PublicStoreRecord | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const raw = value as Partial<PublicStoreRecord> & { id?: unknown };
  const storeId =
    typeof raw.id === "number"
      ? raw.id
      : Number.parseInt(String(raw.id || ""), 10);

  if (!Number.isFinite(storeId) || typeof raw.store_name !== "string") {
    return null;
  }

  return {
    address: typeof raw.address === "string" ? raw.address : null,
    category: typeof raw.category === "string" ? raw.category : null,
    id: storeId,
    image_url: typeof raw.image_url === "string" ? raw.image_url : null,
    phone_number: typeof raw.phone_number === "string" ? raw.phone_number : null,
    store_name: raw.store_name,
  };
}

async function fetchCurrentPublicStores() {
  const result = await requestMobileApi<{ stores?: unknown[] }>("/stores", {
    method: "GET",
  });

  if (!result.ok) {
    return null;
  }

  return Array.isArray(result.data.stores)
    ? result.data.stores
        .map((item) => normalizePublicStore(item))
        .filter((item): item is PublicStoreRecord => item !== null)
    : [];
}

function buildPublicStoreIndexes(stores: PublicStoreRecord[]) {
  return {
    byId: new Map(stores.map((store) => [store.id, store])),
    byName: new Map(
      stores.map((store) => [store.store_name.trim().toLowerCase(), store]),
    ),
  };
}

function reconcileSavedStoreRecords(
  stores: SavedStoreRecord[],
  availableStores: PublicStoreRecord[],
) {
  const { byId, byName } = buildPublicStoreIndexes(availableStores);
  const reconciledStores: SavedStoreRecord[] = [];

  stores.forEach((store) => {
    const currentStore =
      byId.get(store.store_id) ??
      byName.get(store.store_name.trim().toLowerCase());

    if (!currentStore) {
      return;
    }

    reconciledStores.push({
      ...store,
      address: currentStore.address ?? store.address ?? null,
      category: currentStore.category ?? store.category ?? null,
      image_url: currentStore.image_url ?? store.image_url ?? null,
      phone_number: currentStore.phone_number ?? store.phone_number ?? null,
      store_id: currentStore.id,
      store_name: currentStore.store_name,
    });
  });

  return sortSavedStores(reconciledStores);
}

function reconcileRecentStoreRecords(
  stores: RecentStoreRecord[],
  availableStores: PublicStoreRecord[],
) {
  const { byId, byName } = buildPublicStoreIndexes(availableStores);
  const reconciledStores: RecentStoreRecord[] = [];

  stores.forEach((store) => {
    const currentStore =
      byId.get(store.store_id) ??
      byName.get(store.store_name.trim().toLowerCase());

    if (!currentStore) {
      return;
    }

    reconciledStores.push({
      ...store,
      address: currentStore.address ?? store.address ?? null,
      category: currentStore.category ?? store.category ?? null,
      image_url: currentStore.image_url ?? store.image_url ?? null,
      phone_number: currentStore.phone_number ?? store.phone_number ?? null,
      store_id: currentStore.id,
      store_name: currentStore.store_name,
    });
  });

  return sortRecentStores(reconciledStores).slice(0, MAX_RECENT_STORES);
}

function sortSavedStores(stores: SavedStoreRecord[]) {
  return [...stores].sort((left, right) => {
    const leftTime = left.created_at ? new Date(left.created_at).getTime() : 0;
    const rightTime = right.created_at ? new Date(right.created_at).getTime() : 0;

    return rightTime - leftTime;
  });
}

function sortRecentStores(stores: RecentStoreRecord[]) {
  return [...stores].sort((left, right) => {
    const leftTime = left.viewed_at ? new Date(left.viewed_at).getTime() : 0;
    const rightTime = right.viewed_at ? new Date(right.viewed_at).getTime() : 0;

    return rightTime - leftTime;
  });
}

function setSavedStoresState(stores: SavedStoreRecord[]) {
  collectionState = {
    ...collectionState,
    savedStores: sortSavedStores(stores),
  };
  emit();
}

function setRecentStoresState(stores: RecentStoreRecord[]) {
  collectionState = {
    ...collectionState,
    recentStores: sortRecentStores(stores).slice(0, MAX_RECENT_STORES),
  };
  emit();
}

export function useSavedStores() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => collectionState.savedStores,
    () => collectionState.savedStores,
  );
}

export function useRecentStores() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => collectionState.recentStores,
    () => collectionState.recentStores,
  );
}

export async function readStoredSavedStores() {
  try {
    const rawValue = await AsyncStorage.getItem(buildStorageKey());

    if (!rawValue) {
      return [] as SavedStoreRecord[];
    }

    const parsed = JSON.parse(rawValue) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    const stores = sortSavedStores(
      parsed
        .map((item) => normalizeSavedStore(item))
        .filter((item): item is SavedStoreRecord => item !== null),
    );
    setSavedStoresState(stores);
    return stores;
  } catch {
    return [];
  }
}

async function persistSavedStores(stores: SavedStoreRecord[]) {
  const sorted = sortSavedStores(stores);
  await AsyncStorage.setItem(buildStorageKey(), JSON.stringify(sorted));
  setSavedStoresState(sorted);
}

export async function readStoredRecentStores() {
  try {
    const rawValue = await AsyncStorage.getItem(buildRecentStorageKey());

    if (!rawValue) {
      setRecentStoresState([]);
      return [] as RecentStoreRecord[];
    }

    const parsed = JSON.parse(rawValue) as unknown;

    if (!Array.isArray(parsed)) {
      setRecentStoresState([]);
      return [];
    }

    const stores = sortRecentStores(
      parsed
        .map((item) => normalizeRecentStore(item))
        .filter((item): item is RecentStoreRecord => item !== null),
    );
    setRecentStoresState(stores);
    return stores;
  } catch {
    return [];
  }
}

async function persistRecentStores(stores: RecentStoreRecord[]) {
  const sorted = sortRecentStores(stores).slice(0, MAX_RECENT_STORES);
  await AsyncStorage.setItem(buildRecentStorageKey(), JSON.stringify(sorted));
  setRecentStoresState(sorted);
}

export async function upsertStoredSavedStore(store: SavedStoreRecord) {
  const currentStores = await readStoredSavedStores();
  const nextStores = currentStores.filter((item) => item.store_id !== store.store_id);
  nextStores.unshift(store);
  await persistSavedStores(nextStores);
  return store;
}

export async function removeStoredSavedStore(storeId: number) {
  const currentStores = await readStoredSavedStores();
  await persistSavedStores(currentStores.filter((item) => item.store_id !== storeId));
}

export async function trackRecentStoreVisit(store: {
  address?: string | null;
  category?: string | null;
  id: number;
  image_url?: string | null;
  phone_number?: string | null;
  store_name: string;
}) {
  const currentStores = await readStoredRecentStores();
  const nextStores = currentStores.filter((item) => item.store_id !== store.id);
  nextStores.unshift({
    address: store.address ?? null,
    category: store.category ?? null,
    image_url: store.image_url ?? null,
    phone_number: store.phone_number ?? null,
    store_id: store.id,
    store_name: store.store_name,
    viewed_at: new Date().toISOString(),
  });
  await persistRecentStores(nextStores);
}

export async function clearRecentStores() {
  await persistRecentStores([]);
}

export async function loadSavedStoresForSession() {
  const session = getMobileSession();

  if (!session.isAuthenticated) {
    setSavedStoresState([]);
    return [];
  }

  let localStores = await readStoredSavedStores();
  const currentPublicStores = await fetchCurrentPublicStores();

  if (currentPublicStores) {
    const reconciledStores = reconcileSavedStoreRecords(
      localStores,
      currentPublicStores,
    );

    if (JSON.stringify(reconciledStores) !== JSON.stringify(localStores)) {
      await persistSavedStores(reconciledStores);
      localStores = reconciledStores;
    }
  }

  if (!session.authToken) {
    return localStores;
  }

  try {
    return await getSavedStores(session.authToken);
  } catch {
    return localStores;
  }
}

export async function loadRecentStoresForSession() {
  const localStores = await readStoredRecentStores();
  const currentPublicStores = await fetchCurrentPublicStores();

  if (!currentPublicStores) {
    return localStores;
  }

  const reconciledStores = reconcileRecentStoreRecords(
    localStores,
    currentPublicStores,
  );

  if (JSON.stringify(reconciledStores) !== JSON.stringify(localStores)) {
    await persistRecentStores(reconciledStores);
  }

  return reconciledStores;
}

export async function getSavedStores(token: string) {
  const result = await requestMobileApi<{ savedStores?: unknown[] }>("/saved-stores", {
    method: "GET",
    token,
  });

  if (!result.ok) {
    throw new Error(result.error || "Could not load saved stores.");
  }

  const savedStores = Array.isArray(result.data.savedStores)
    ? result.data.savedStores
        .map((item) => normalizeSavedStore(item))
        .filter((item): item is SavedStoreRecord => item !== null)
    : [];

  await persistSavedStores(savedStores);
  return savedStores;
}

export async function saveStore(token: string, store: {
  address?: string | null;
  category?: string | null;
  id: number;
  image_url?: string | null;
  phone_number?: string | null;
  store_name: string;
}) {
  const result = await requestMobileApi<{ message?: string }>("/saved-stores", {
    body: { store_id: store.id },
    method: "POST",
    token,
  });

  if (!result.ok) {
    throw new Error(result.error || "Could not save store.");
  }

  await upsertStoredSavedStore({
    address: store.address ?? null,
    category: store.category ?? null,
    created_at: new Date().toISOString(),
    image_url: store.image_url ?? null,
    phone_number: store.phone_number ?? null,
    store_id: store.id,
    store_name: store.store_name,
  });

  return result.data;
}

export async function unsaveStore(token: string, storeId: number) {
  const result = await requestMobileApi<{ message?: string }>(`/saved-stores/${storeId}`, {
    method: "DELETE",
    token,
  });

  if (!result.ok) {
    throw new Error(result.error || "Could not remove this store.");
  }

  await removeStoredSavedStore(storeId);
  return result.data;
}

export async function isStoreSaved(storeId: number) {
  const stores =
    collectionState.savedStores.length > 0
      ? collectionState.savedStores
      : await readStoredSavedStores();
  return stores.some((store) => store.store_id === storeId);
}
