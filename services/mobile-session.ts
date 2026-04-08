import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSyncExternalStore } from "react";

import { buildActiveRoles, getAccountType, type ActiveRole } from "@/services/role-access";

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
  storePlan: "basic" | "verified" | null;
  storeVerified: boolean;
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
  storeVerified: false,
};

const MOBILE_SESSION_STORAGE_KEY = "neara-mobile-session:v1";

let sessionState: MobileUser = defaultUser;
let isSessionHydrated = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

async function persistMobileSession() {
  try {
    await AsyncStorage.setItem(
      MOBILE_SESSION_STORAGE_KEY,
      JSON.stringify(sessionState),
    );
  } catch (error) {
    console.warn("Failed to persist mobile session", error);
  }
}

async function clearPersistedMobileSession() {
  try {
    await AsyncStorage.removeItem(MOBILE_SESSION_STORAGE_KEY);
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
      (typeof parsed.primaryStoreId === "string" && Boolean(parsed.primaryStoreId.trim())));
  const roles = buildActiveRoles(isPro, isStoreOwner);

  return {
    accountType: getAccountType(isPro),
    authToken,
    email: isAuthenticated && typeof parsed.email === "string" ? parsed.email : defaultUser.email,
    id: isAuthenticated && typeof parsed.id === "string" ? parsed.id : defaultUser.id,
    isAdmin: isAuthenticated && Boolean(parsed.isAdmin),
    isAuthenticated,
    isPro,
    isStoreOwner,
    messagesSentCount:
      isAuthenticated && Number.isFinite(Number(parsed.messagesSentCount))
        ? Number(parsed.messagesSentCount)
        : 0,
    name: isAuthenticated && typeof parsed.name === "string" ? parsed.name : defaultUser.name,
    phoneNumber:
      isAuthenticated && typeof parsed.phoneNumber === "string" ? parsed.phoneNumber : "",
    primaryStoreAddress:
      isAuthenticated && typeof parsed.primaryStoreAddress === "string"
        ? parsed.primaryStoreAddress
        : "",
    primaryStoreCategory:
      isAuthenticated && typeof parsed.primaryStoreCategory === "string"
        ? parsed.primaryStoreCategory
        : "",
    primaryStoreId:
      isAuthenticated && typeof parsed.primaryStoreId === "string" && parsed.primaryStoreId.trim()
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
    storePlan:
      parsed.storePlan === "basic" || parsed.storePlan === "verified" ? parsed.storePlan : null,
    storeVerified: isAuthenticated && Boolean(parsed.storeVerified),
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
  void persistMobileSession();
}

export function resetMobileSession() {
  sessionState = {
    ...defaultUser,
  };
  emit();
  void clearPersistedMobileSession();
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
    const storedValue = await AsyncStorage.getItem(MOBILE_SESSION_STORAGE_KEY);

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
