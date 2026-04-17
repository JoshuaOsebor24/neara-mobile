import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { useSyncExternalStore } from "react";
import { Platform } from "react-native";

import {
    buildActiveRoles,
    getAccountType,
    type ActiveRole,
} from "@/services/role-access";

export type MobileUser = {
  accountType: ActiveRole;
  authToken: string | null;
  email: string;
  id: string;
  isAdmin: boolean;
  isAuthenticated: boolean;
  isPro: boolean;
  isStoreOwner: boolean;
  messagesSentCount: number;
  name: string;
  phoneNumber: string;
  primaryStoreId: string | null;
  primaryStoreAddress: string;
  primaryStoreCategory: string;
  primaryStoreImageUrl: string;
  primaryStoreLatitude: number | null;
  primaryStoreLongitude: number | null;
  primaryStoreName: string;
  roles: ActiveRole[];
  storePhoneNumber: string;
  storePlan: "basic" | null;
};

const defaultUser: MobileUser = {
  accountType: "user",
  authToken: null,
  email: "",
  id: "",
  isAdmin: false,
  isAuthenticated: false,
  isPro: false,
  isStoreOwner: false,
  messagesSentCount: 0,
  name: "",
  phoneNumber: "",
  primaryStoreId: null,
  primaryStoreAddress: "",
  primaryStoreCategory: "",
  primaryStoreImageUrl: "",
  primaryStoreLatitude: null,
  primaryStoreLongitude: null,
  primaryStoreName: "",
  roles: ["user"],
  storePlan: null,
  storePhoneNumber: "",
};

const MOBILE_SESSION_STORAGE_KEY = "neara-mobile-session:v1";

let sessionState: MobileUser = defaultUser;
let isSessionHydrated = false;
const listeners = new Set<() => void>();
let sessionPersistenceTask: Promise<void> = Promise.resolve();

function emit() {
  listeners.forEach((listener) => listener());
}

async function readSecureSession() {
  try {
    return await SecureStore.getItemAsync(MOBILE_SESSION_STORAGE_KEY);
  } catch (error) {
    console.warn("Failed to read secure mobile session", error);
    return null;
  }
}

async function writeSecureSession(value: string) {
  try {
    await SecureStore.setItemAsync(MOBILE_SESSION_STORAGE_KEY, value);
  } catch (error) {
    console.warn("Failed to write secure mobile session", error);
  }
}

async function clearSecureSession() {
  try {
    await SecureStore.deleteItemAsync(MOBILE_SESSION_STORAGE_KEY);
  } catch (error) {
    console.warn("Failed to clear secure mobile session", error);
  }
}

async function persistMobileSession() {
  try {
    const serializedSession = JSON.stringify(sessionState);

    if (Platform.OS === "web") {
      await AsyncStorage.setItem(MOBILE_SESSION_STORAGE_KEY, serializedSession);
      return;
    }

    await AsyncStorage.setItem(MOBILE_SESSION_STORAGE_KEY, serializedSession);
    await writeSecureSession(serializedSession);
  } catch (error) {
    console.warn("Failed to persist mobile session", error);
  }
}

function enqueueSessionPersistence(task: () => Promise<void>) {
  sessionPersistenceTask = sessionPersistenceTask
    .catch(() => undefined)
    .then(task);

  return sessionPersistenceTask;
}

async function clearPersistedMobileSession() {
  try {
    if (Platform.OS === "web") {
      await AsyncStorage.removeItem(MOBILE_SESSION_STORAGE_KEY);
      return;
    }

    await AsyncStorage.removeItem(MOBILE_SESSION_STORAGE_KEY);
    await clearSecureSession();
  } catch (error) {
    console.warn("Failed to clear mobile session", error);
  }
}

function sanitizeMobileSession(value: unknown): MobileUser | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const parsed = value as Partial<MobileUser>;
  const normalizedRoles = Array.isArray(parsed.roles)
    ? parsed.roles
        .filter((role): role is ActiveRole => typeof role === "string")
        .map((role) => role.trim().toLowerCase() as ActiveRole)
    : [];
  const hasProRole = normalizedRoles.includes("pro");
  const hasStoreOwnerRole = normalizedRoles.includes("store_owner");
  const authToken =
    typeof parsed.authToken === "string" && parsed.authToken.trim()
      ? parsed.authToken
      : null;
  const isAuthenticated = Boolean(parsed.isAuthenticated) && Boolean(authToken);
  const isPro =
    isAuthenticated &&
    (Boolean(parsed.isPro) || hasProRole || parsed.accountType === "pro");
  const isStoreOwner =
    isAuthenticated &&
    (Boolean(parsed.isStoreOwner) ||
      hasStoreOwnerRole ||
      (typeof parsed.primaryStoreId === "string" &&
        Boolean(parsed.primaryStoreId.trim())));
  const roles = buildActiveRoles(isPro, isStoreOwner);

  return {
    accountType: getAccountType(isPro),
    authToken,
    email:
      isAuthenticated && typeof parsed.email === "string"
        ? parsed.email
        : defaultUser.email,
    id:
      isAuthenticated && typeof parsed.id === "string"
        ? parsed.id
        : defaultUser.id,
    isAdmin: isAuthenticated && Boolean(parsed.isAdmin),
    isAuthenticated,
    isPro,
    isStoreOwner,
    messagesSentCount:
      isAuthenticated && Number.isFinite(Number(parsed.messagesSentCount))
        ? Number(parsed.messagesSentCount)
        : 0,
    name:
      isAuthenticated && typeof parsed.name === "string"
        ? parsed.name
        : defaultUser.name,
    phoneNumber:
      isAuthenticated && typeof parsed.phoneNumber === "string"
        ? parsed.phoneNumber
        : "",
    primaryStoreAddress:
      isAuthenticated && typeof parsed.primaryStoreAddress === "string"
        ? parsed.primaryStoreAddress
        : "",
    primaryStoreCategory:
      isAuthenticated && typeof parsed.primaryStoreCategory === "string"
        ? parsed.primaryStoreCategory
        : "",
    primaryStoreId:
      isAuthenticated &&
      typeof parsed.primaryStoreId === "string" &&
      parsed.primaryStoreId.trim()
        ? parsed.primaryStoreId
        : null,
    primaryStoreImageUrl:
      isAuthenticated && typeof parsed.primaryStoreImageUrl === "string"
        ? parsed.primaryStoreImageUrl
        : "",
    primaryStoreLatitude:
      isAuthenticated && Number.isFinite(Number(parsed.primaryStoreLatitude))
        ? Number(parsed.primaryStoreLatitude)
        : null,
    primaryStoreLongitude:
      isAuthenticated && Number.isFinite(Number(parsed.primaryStoreLongitude))
        ? Number(parsed.primaryStoreLongitude)
        : null,
    primaryStoreName:
      isAuthenticated && typeof parsed.primaryStoreName === "string"
        ? parsed.primaryStoreName
        : "",
    roles,
    storePhoneNumber:
      isAuthenticated && typeof parsed.storePhoneNumber === "string"
        ? parsed.storePhoneNumber
        : "",
    storePlan: parsed.storePlan === "basic" ? parsed.storePlan : null,
  };
}

export function getMobileSession() {
  return sessionState;
}

export function updateMobileSession(next: Partial<MobileUser>) {
  sessionState = sanitizeMobileSession({
    ...sessionState,
    ...next,
  }) ?? { ...defaultUser };
  emit();

  return enqueueSessionPersistence(() => persistMobileSession());
}

export function resetMobileSession() {
  sessionState = {
    ...defaultUser,
  };
  emit();

  return enqueueSessionPersistence(() => clearPersistedMobileSession());
}

export function useMobileSession() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getMobileSession,
    getMobileSession,
  );
}

export function getMobileSessionHydrated() {
  return isSessionHydrated;
}

export function useMobileSessionHydrated() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getMobileSessionHydrated,
    getMobileSessionHydrated,
  );
}

export async function hydrateMobileSession() {
  if (isSessionHydrated) {
    return sessionState;
  }

  try {
    let storedValue: string | null = null;

    if (Platform.OS === "web") {
      storedValue = await AsyncStorage.getItem(MOBILE_SESSION_STORAGE_KEY);
    } else {
      const asyncValue = await AsyncStorage.getItem(MOBILE_SESSION_STORAGE_KEY);
      const secureValue = await readSecureSession();

      storedValue = secureValue || asyncValue;

      if (storedValue && secureValue !== storedValue) {
        await writeSecureSession(storedValue);
      }
    }

    if (storedValue) {
      const parsed = JSON.parse(storedValue) as unknown;
      const sanitized = sanitizeMobileSession(parsed);

      if (sanitized) {
        sessionState = sanitized;
      }
    }
  } catch (error) {
    console.warn("Failed to hydrate mobile session", error);
  } finally {
    isSessionHydrated = true;
    emit();
  }

  return sessionState;
}
