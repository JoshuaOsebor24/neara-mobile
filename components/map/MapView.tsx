import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import RNMapView, {
  Marker,
  PROVIDER_DEFAULT,
  type Region,
} from "react-native-maps";

import { theme } from "@/constants/theme";
import {
  DEFAULT_MAP_COORDINATES,
  type LocationPermissionState,
  type UserCoordinates,
} from "@/services/location";
import type { StoreListItem } from "@/services/store-data";

function buildRegion(coordinates: UserCoordinates): Region {
  const latitudeDelta = 0.008;
  const longitudeDelta = 0.008;

  return {
    latitude: coordinates.latitude - latitudeDelta * 0.35,
    latitudeDelta,
    longitude: coordinates.longitude,
    longitudeDelta,
  };
}

const DEFAULT_REGION: Region = {
  latitude: DEFAULT_MAP_COORDINATES.latitude,
  latitudeDelta: 0.016,
  longitude: DEFAULT_MAP_COORDINATES.longitude,
  longitudeDelta: 0.016,
};

function buildStatusContent({
  errorMessage,
  isLoading,
  permissionStatus,
}: {
  errorMessage: string;
  isLoading: boolean;
  permissionStatus: LocationPermissionState;
}) {
  if (isLoading) {
    return {
      actionLabel: undefined,
      description: "Requesting permission and finding your current position.",
      title: "Loading your location...",
      tone: "info" as const,
    };
  }

  if (permissionStatus === "denied") {
    return {
      actionLabel: "Retry location",
      description:
        "The map still works with the default region. Allow location access if you want automatic centering.",
      title: "Location permission denied",
      tone: "warning" as const,
    };
  }

  if (errorMessage) {
    return {
      actionLabel: "Retry location",
      description: errorMessage,
      title: "Using default region",
      tone: "info" as const,
    };
  }

  return null;
}

export function NearaMapView({
  coordinates,
  disableUserLocationRecenter = false,
  disableGestures = false,
  errorMessage,
  focusedCoordinates,
  isLoading,
  mapRecenterKey = 0,
  onMapMoveStart,
  onMapMoveEnd,
  onRequestLocation,
  onSelectStore,
  permissionStatus,
  selectedStoreId,
  stores,
  style,
}: {
  coordinates: UserCoordinates | null;
  disableUserLocationRecenter?: boolean;
  errorMessage: string;
  focusedCoordinates?: UserCoordinates | null;
  isLoading: boolean;
  mapRecenterKey?: number;
  disableGestures?: boolean;
  onMapMoveStart?: () => void;
  onMapMoveEnd?: () => void;
  onRequestLocation: () => void;
  onSelectStore?: (storeId: string) => void;
  permissionStatus: LocationPermissionState;
  selectedStoreId?: string | null;
  stores?: StoreListItem[];
  style?: ViewStyle;
}) {
  const mapRef = useRef<RNMapView | null>(null);
  const [userInteracted, setUserInteracted] = useState(false);
  const hasMountedRef = useRef(false);
  const hasSettledInitialRegionRef = useRef(false);
  const lastAppliedStoreFitKeyRef = useRef("");
  const programmaticMoveRef = useRef(false);
  const mapInteractionActiveRef = useRef(false);
  const mapMoveEndTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const region = useMemo(
    () => (coordinates ? buildRegion(coordinates) : null),
    [coordinates],
  );
  const focusedRegion = useMemo(() => {
    if (!focusedCoordinates) {
      return null;
    }

    return buildRegion(focusedCoordinates);
  }, [focusedCoordinates]);
  const renderableStores = useMemo(
    () =>
      (stores ?? [])
        .map((store) => {
          const latitude =
            typeof store.latitude === "number"
              ? store.latitude
              : store.latitude !== null && store.latitude !== undefined
                ? Number(store.latitude)
                : null;
          const longitude =
            typeof store.longitude === "number"
              ? store.longitude
              : store.longitude !== null && store.longitude !== undefined
                ? Number(store.longitude)
                : null;

          if (
            store.id === null ||
            store.id === undefined ||
            !Number.isFinite(latitude) ||
            !Number.isFinite(longitude)
          ) {
            return null;
          }

          return {
            id: String(store.id),
            latitude: Number(latitude),
            longitude: Number(longitude),
          };
        })
        .filter(
          (
            value,
          ): value is {
            id: string;
            latitude: number;
            longitude: number;
          } =>
            value !== null,
        ),
    [stores],
  );
  const validStoreCoordinates = useMemo(
    () =>
      renderableStores.map(({ id, latitude, longitude }) => ({
        id,
        latitude,
        longitude,
      })),
    [renderableStores],
  );
  const status = useMemo(
    () =>
      buildStatusContent({
        errorMessage,
        isLoading,
        permissionStatus,
      }),
    [errorMessage, isLoading, permissionStatus],
  );

  useEffect(() => {
    if (focusedRegion && !userInteracted) {
      if (hasMountedRef.current) {
        programmaticMoveRef.current = true;
        mapRef.current?.animateToRegion(focusedRegion, 320);
      }
      return;
    }

    if (region && !userInteracted && !disableUserLocationRecenter) {
      if (hasMountedRef.current) {
        programmaticMoveRef.current = true;
        mapRef.current?.animateToRegion(region, 320);
      }
    }
  }, [focusedRegion, region, userInteracted, disableUserLocationRecenter]);

  useEffect(() => {
    if (!region || mapRecenterKey === 0) {
      return;
    }

    setUserInteracted(false);
    programmaticMoveRef.current = true;
    mapRef.current?.animateToRegion(region, 420);
  }, [mapRecenterKey, region]);

  useEffect(() => {
    if (
      !hasMountedRef.current ||
      userInteracted ||
      focusedRegion ||
      validStoreCoordinates.length === 0
    ) {
      return;
    }

    const nextFitKey = validStoreCoordinates
      .map((store) => `${store.id}:${store.latitude.toFixed(5)}:${store.longitude.toFixed(5)}`)
      .join("|");

    if (!nextFitKey || lastAppliedStoreFitKeyRef.current === nextFitKey) {
      return;
    }

    lastAppliedStoreFitKeyRef.current = nextFitKey;
    programmaticMoveRef.current = true;

    requestAnimationFrame(() => {
      if (!mapRef.current) {
        return;
      }

      if (validStoreCoordinates.length === 1) {
        mapRef.current.animateToRegion(
          {
            latitude: validStoreCoordinates[0].latitude - 0.003,
            latitudeDelta: 0.012,
            longitude: validStoreCoordinates[0].longitude,
            longitudeDelta: 0.012,
          },
          360,
        );
        return;
      }

      mapRef.current.fitToCoordinates(validStoreCoordinates, {
        animated: true,
        edgePadding: {
          bottom: 160,
          left: 48,
          right: 48,
          top: 96,
        },
      });
    });
  }, [focusedRegion, userInteracted, validStoreCoordinates]);

  useEffect(() => {
    hasMountedRef.current = true;

    return () => {
      hasMountedRef.current = false;
      if (mapMoveEndTimeoutRef.current) {
        clearTimeout(mapMoveEndTimeoutRef.current);
        mapMoveEndTimeoutRef.current = null;
      }
    };
  }, []);

  const signalMapMoveStart = () => {
    if (programmaticMoveRef.current) {
      return;
    }

    if (mapMoveEndTimeoutRef.current) {
      clearTimeout(mapMoveEndTimeoutRef.current);
      mapMoveEndTimeoutRef.current = null;
    }

    if (mapInteractionActiveRef.current) {
      return;
    }

    mapInteractionActiveRef.current = true;
    setUserInteracted(true);
    onMapMoveStart?.();
  };

  const scheduleMapMoveEnd = (delayMs = 140) => {
    if (mapMoveEndTimeoutRef.current) {
      clearTimeout(mapMoveEndTimeoutRef.current);
    }

    mapMoveEndTimeoutRef.current = setTimeout(() => {
      mapMoveEndTimeoutRef.current = null;

      if (!mapInteractionActiveRef.current) {
        return;
      }

      mapInteractionActiveRef.current = false;
      onMapMoveEnd?.();
    }, delayMs);
  };

  const signalMapMoveEnd = () => {
    if (!hasSettledInitialRegionRef.current) {
      hasSettledInitialRegionRef.current = true;
      programmaticMoveRef.current = false;
      return;
    }

    if (programmaticMoveRef.current) {
      programmaticMoveRef.current = false;
      return;
    }

    scheduleMapMoveEnd();
  };

  return (
    <View style={[styles.container, style]}>
      <RNMapView
        ref={mapRef}
        initialRegion={focusedRegion ?? region ?? DEFAULT_REGION}
        loadingEnabled
        mapType="standard"
        scrollEnabled={!disableGestures}
        zoomEnabled={!disableGestures}
        rotateEnabled={!disableGestures}
        pitchEnabled={!disableGestures}
        zoomTapEnabled={!disableGestures}
        onPanDrag={
          disableGestures
            ? undefined
            : () => {
                hasSettledInitialRegionRef.current = true;
                signalMapMoveStart();
              }
        }
        onRegionChangeComplete={
          disableGestures
            ? undefined
            : () => {
                signalMapMoveEnd();
              }
        }
        maxZoomLevel={19}
        minZoomLevel={9}
        provider={PROVIDER_DEFAULT}
        showsCompass={false}
        showsIndoorLevelPicker={false}
        showsMyLocationButton={false}
        showsUserLocation
        toolbarEnabled={false}
        style={styles.map}
      >
        {renderableStores.map(({ id, latitude, longitude }) => {
          const isSelected = id === String(selectedStoreId || "");

          return (
            <Marker
              key={id}
              coordinate={{
                latitude,
                longitude,
              }}
              onPress={() => onSelectStore?.(id)}
              tracksViewChanges={false}
            >
              <View style={styles.storeMarkerWrap}>
                <View
                  style={[
                    styles.storeMarkerHead,
                    isSelected ? styles.storeMarkerHeadSelected : null,
                  ]}
                >
                  <View
                    style={[
                      styles.storeMarkerCore,
                      isSelected ? styles.storeMarkerCoreSelected : null,
                    ]}
                  />
                </View>
                <View
                  style={[
                    styles.storeMarkerTail,
                    isSelected ? styles.storeMarkerTailSelected : null,
                  ]}
                />
              </View>
            </Marker>
          );
        })}
      </RNMapView>

      <LinearGradient
        colors={["rgba(0,0,0,0.2)", "transparent", "rgba(0,0,0,0.28)"]}
        pointerEvents="none"
        style={styles.mapShade}
      />

      {status ? (
        <View style={styles.statusWrap}>
          <View
            style={[
              styles.statusCard,
              status.tone === "warning" ? styles.statusCardWarning : null,
            ]}
          >
            <Text style={styles.statusTitle}>{status.title}</Text>
            <Text style={styles.statusDescription}>{status.description}</Text>
            {isLoading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color={theme.colors.accent} size="small" />
                <Text style={styles.loadingText}>Updating map...</Text>
              </View>
            ) : status.actionLabel ? (
              <Pressable
                onPress={onRequestLocation}
                style={styles.actionButton}
              >
                <Text style={styles.actionButtonText}>
                  {status.actionLabel}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}

export { NearaMapView as MapView };

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.background,
    height: "100%",
    overflow: "hidden",
    width: "100%",
  },
  map: {
    ...StyleSheet.absoluteFillObject,
    height: "100%",
    width: "100%",
  },
  mapShade: {
    ...StyleSheet.absoluteFillObject,
  },
  statusWrap: {
    left: 16,
    position: "absolute",
    right: 16,
    top: 84,
  },
  statusCard: {
    backgroundColor: "rgba(10,15,31,0.9)",
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 24,
    borderWidth: 1,
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  statusCardWarning: {
    borderColor: "rgba(255,255,255,0.22)",
  },
  statusTitle: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: "800",
  },
  statusDescription: {
    color: theme.colors.subduedText,
    fontSize: 13,
    lineHeight: 19,
  },
  loadingText: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: "600",
  },
  loadingRow: {
    alignItems: "center",
    alignSelf: "flex-start",
    flexDirection: "row",
    gap: 10,
  },
  actionButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderColor: "rgba(120,163,255,0.18)",
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 42,
    paddingHorizontal: 18,
  },
  actionButtonText: {
    color: theme.colors.subduedText,
    fontSize: 13,
    fontWeight: "700",
  },
  storeMarkerWrap: {
    alignItems: "center",
    justifyContent: "flex-start",
    paddingBottom: 12,
    paddingHorizontal: 6,
    paddingTop: 6,
  },
  storeMarkerHead: {
    alignItems: "center",
    backgroundColor: "rgba(11, 18, 33, 0.98)",
    borderColor: "rgba(255,255,255,0.88)",
    borderRadius: 18,
    borderWidth: 2,
    height: 34,
    justifyContent: "center",
    width: 34,
    shadowColor: "#020817",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.24,
    shadowRadius: 12,
  },
  storeMarkerHeadSelected: {
    backgroundColor: "#1F56E5",
    borderColor: "#D9E4FF",
    transform: [{ scale: 1.08 }],
  },
  storeMarkerCore: {
    backgroundColor: "#B8C2D9",
    borderRadius: 7,
    height: 14,
    width: 14,
  },
  storeMarkerCoreSelected: {
    backgroundColor: "#F7FAFF",
  },
  storeMarkerTail: {
    borderLeftColor: "transparent",
    borderLeftWidth: 8,
    borderRightColor: "transparent",
    borderRightWidth: 8,
    borderTopColor: "rgba(11, 18, 33, 0.98)",
    borderTopWidth: 14,
    marginTop: -2,
  },
  storeMarkerTailSelected: {
    borderTopColor: "#1F56E5",
  },
});
