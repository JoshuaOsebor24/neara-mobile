import { useCallback, useEffect, useRef, useState } from "react";

import {
    getCachedUserLocation,
    getCurrentUserLocation,
    getForegroundLocationPermission,
    requestForegroundLocationPermission,
    type LocationPermissionState,
    type UserCoordinates,
} from "@/services/location";

type UseLocationState = {
  coordinates: UserCoordinates | null;
  errorMessage: string;
  isLoading: boolean;
  permissionStatus: LocationPermissionState;
};

const DEFAULT_STATE: UseLocationState = {
  coordinates: getCachedUserLocation(),
  errorMessage: "",
  isLoading: false,
  permissionStatus: "undetermined",
};

export function useLocation(options?: { requestOnMount?: boolean }) {
  const requestOnMount = options?.requestOnMount ?? true;
  const [state, setState] = useState<UseLocationState>({
    ...DEFAULT_STATE,
    isLoading: requestOnMount,
  });
  const hasLoadedRef = useRef(false);

  const resolveLocation = useCallback(
    async (config?: {
      forceRefresh?: boolean;
      requestPermission?: boolean;
    }) => {
      setState((current) => ({
        ...current,
        errorMessage: "",
        isLoading: true,
      }));

      try {
        let permissionStatus = await getForegroundLocationPermission();

        if (
          permissionStatus !== "granted" &&
          config?.requestPermission !== false
        ) {
          permissionStatus = await requestForegroundLocationPermission();
        }

        if (permissionStatus !== "granted") {
          setState((current) => ({
            ...current,
            errorMessage:
              permissionStatus === "denied"
                ? "Location access is off. Turn it on if you want the map to center on you."
                : "",
            isLoading: false,
            permissionStatus,
          }));
          return null;
        }

        const coordinates = await getCurrentUserLocation({
          forceRefresh: config?.forceRefresh,
        });

        setState({
          coordinates,
          errorMessage: "",
          isLoading: false,
          permissionStatus,
        });

        return coordinates;
      } catch {
        setState((current) => ({
          ...current,
          errorMessage:
            "We couldn't get your location just yet. Try again in a moment.",
          isLoading: false,
        }));
        return null;
      }
    },
    [],
  );

  useEffect(() => {
    if (!requestOnMount || hasLoadedRef.current) {
      return;
    }

    hasLoadedRef.current = true;
    void resolveLocation({ requestPermission: true });
  }, [requestOnMount, resolveLocation]);

  return {
    ...state,
    refreshLocation: () =>
      resolveLocation({ forceRefresh: true, requestPermission: true }),
    requestLocationPermission: () =>
      resolveLocation({ forceRefresh: false, requestPermission: true }),
  };
}
