import * as ExpoLocation from "expo-location";

export type LocationPermissionState =
  | "granted"
  | "denied"
  | "undetermined";

export type UserCoordinates = {
  accuracy: number | null;
  fetchedAt: number;
  latitude: number;
  longitude: number;
};

const LOCATION_CACHE_TTL_MS = 2 * 60 * 1000;
export const DEFAULT_MAP_COORDINATES = Object.freeze({
  latitude: 6.60184,
  longitude: 3.35149,
});

let cachedCoordinates: UserCoordinates | null = null;

function normalizePermissionStatus(
  status: ExpoLocation.PermissionStatus | string | undefined,
): LocationPermissionState {
  if (status === ExpoLocation.PermissionStatus.GRANTED || status === "granted") {
    return "granted";
  }

  if (status === ExpoLocation.PermissionStatus.DENIED || status === "denied") {
    return "denied";
  }

  return "undetermined";
}

function isCacheFresh(location: UserCoordinates | null) {
  if (!location) {
    return false;
  }

  return Date.now() - location.fetchedAt < LOCATION_CACHE_TTL_MS;
}

export function getCachedUserLocation() {
  return isCacheFresh(cachedCoordinates) ? cachedCoordinates : null;
}

export async function getForegroundLocationPermission() {
  const result = await ExpoLocation.getForegroundPermissionsAsync();
  return normalizePermissionStatus(result.status);
}

export async function requestForegroundLocationPermission() {
  const result = await ExpoLocation.requestForegroundPermissionsAsync();
  return normalizePermissionStatus(result.status);
}

export async function getCurrentUserLocation(options?: {
  forceRefresh?: boolean;
}) {
  if (!options?.forceRefresh) {
    const cached = getCachedUserLocation();

    if (cached) {
      return cached;
    }
  }

  const result = await ExpoLocation.getCurrentPositionAsync({
    accuracy: ExpoLocation.Accuracy.Balanced,
  });

  cachedCoordinates = {
    accuracy:
      typeof result.coords.accuracy === "number" ? result.coords.accuracy : null,
    fetchedAt: Date.now(),
    latitude: result.coords.latitude,
    longitude: result.coords.longitude,
  };

  return cachedCoordinates;
}
