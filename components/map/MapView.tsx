import { LinearGradient } from "expo-linear-gradient";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
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

const MARKER_COLLISION_DISTANCE_METERS = 80;
const MARKER_SPREAD_RADIUS_METERS = 28;
const USER_STORE_COLLISION_DISTANCE_METERS = 36;
const USER_STORE_OFFSET_METERS = {
  east: 18,
  north: 26,
};

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function distanceBetweenCoordinatesMeters(
  left: { latitude: number; longitude: number },
  right: { latitude: number; longitude: number },
) {
  const earthRadiusMeters = 6_371_000;
  const deltaLatitude = toRadians(right.latitude - left.latitude);
  const deltaLongitude = toRadians(right.longitude - left.longitude);
  const leftLatitude = toRadians(left.latitude);
  const rightLatitude = toRadians(right.latitude);
  const a =
    Math.sin(deltaLatitude / 2) * Math.sin(deltaLatitude / 2) +
    Math.cos(leftLatitude) *
      Math.cos(rightLatitude) *
      Math.sin(deltaLongitude / 2) *
      Math.sin(deltaLongitude / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusMeters * c;
}

function offsetCoordinateByMeters(
  coordinate: { latitude: number; longitude: number },
  offsetMeters: { east: number; north: number },
) {
  const latitudeDelta = offsetMeters.north / 111_320;
  const longitudeScale = Math.cos(toRadians(coordinate.latitude));
  const longitudeDelta =
    Math.abs(longitudeScale) > 0.000001
      ? offsetMeters.east / (111_320 * longitudeScale)
      : 0;

  return {
    latitude: coordinate.latitude + latitudeDelta,
    longitude: coordinate.longitude + longitudeDelta,
  };
}

function buildDisplayStores(
  stores: {
    id: string;
    latitude: number;
    longitude: number;
    originalId?: string;
  }[],
) {
  const groups: {
    center: { latitude: number; longitude: number };
    stores: {
      id: string;
      latitude: number;
      longitude: number;
      originalId?: string;
    }[];
  }[] = [];

  stores.forEach((store) => {
    const matchingGroup = groups.find(
      (group) =>
        distanceBetweenCoordinatesMeters(group.center, store) <=
        MARKER_COLLISION_DISTANCE_METERS,
    );

    if (!matchingGroup) {
      groups.push({
        center: {
          latitude: store.latitude,
          longitude: store.longitude,
        },
        stores: [store],
      });
      return;
    }

    matchingGroup.stores.push(store);
    const latitudeTotal = matchingGroup.stores.reduce(
      (sum, item) => sum + item.latitude,
      0,
    );
    const longitudeTotal = matchingGroup.stores.reduce(
      (sum, item) => sum + item.longitude,
      0,
    );
    matchingGroup.center = {
      latitude: latitudeTotal / matchingGroup.stores.length,
      longitude: longitudeTotal / matchingGroup.stores.length,
    };
  });

  return groups.flatMap((group) => {
    if (group.stores.length <= 1) {
      return group.stores.map((store) => ({
        ...store,
        displayLatitude: store.latitude,
        displayLongitude: store.longitude,
      }));
    }

    const orderedStores = [...group.stores].sort((left, right) =>
      left.id.localeCompare(right.id),
    );
    const radiusMeters =
      MARKER_SPREAD_RADIUS_METERS + Math.max(0, orderedStores.length - 2) * 6;

    return orderedStores.map((store, index) => {
      const angle = (Math.PI * 2 * index) / orderedStores.length - Math.PI / 2;
      const displayCoordinate = offsetCoordinateByMeters(group.center, {
        east: Math.cos(angle) * radiusMeters,
        north: Math.sin(angle) * radiusMeters,
      });

      return {
        ...store,
        displayLatitude: displayCoordinate.latitude,
        displayLongitude: displayCoordinate.longitude,
      };
    });
  });
}

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

const UserLocationMarker = memo(function UserLocationMarker({
  coordinates,
  userPulseStyle,
}: {
  coordinates: UserCoordinates;
  userPulseStyle: {
    opacity: Animated.AnimatedInterpolation<number>;
    transform: {
      scale: Animated.AnimatedInterpolation<number>;
    }[];
  };
}) {
  return (
    <Marker
      anchor={{ x: 0.5, y: 0.5 }}
      coordinate={{
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
      }}
      tracksViewChanges
    >
      <View pointerEvents="none" style={styles.userLocationWrap}>
        <Animated.View style={[styles.userLocationPulse, userPulseStyle]} />
        <View style={styles.userLocationHalo}>
          <View style={styles.userLocationDot} />
        </View>
      </View>
    </Marker>
  );
});

const StoreMapMarker = memo(function StoreMapMarker({
  id,
  isSelected,
  isUserStore,
  latitude,
  longitude,
  onPress,
}: {
  id: string;
  isSelected: boolean;
  isUserStore: boolean;
  latitude: number;
  longitude: number;
  onPress: (storeId: string) => void;
}) {
  return (
    <Marker
      anchor={{ x: 0.5, y: 1 }}
      coordinate={{
        latitude,
        longitude,
      }}
      onPress={() => onPress(id)}
      tracksViewChanges={false}
    >
      <View style={styles.storeMarkerWrap}>
        <View
          style={[
            styles.storeMarkerHead,
            isSelected ? styles.storeMarkerHeadSelected : null,
            isUserStore ? styles.storeMarkerHeadUserStore : null,
          ]}
        >
          <View
            style={[
              styles.storeMarkerCore,
              isSelected ? styles.storeMarkerCoreSelected : null,
              isUserStore ? styles.storeMarkerCoreUserStore : null,
            ]}
          />
        </View>
        <View
          style={[
            styles.storeMarkerTail,
            isSelected ? styles.storeMarkerTailSelected : null,
            isUserStore ? styles.storeMarkerTailUserStore : null,
          ]}
        />
      </View>
    </Marker>
  );
});

export function NearaMapView({
  coordinates,
  currentUserId,
  disableUserLocationRecenter = false,
  disableGestures = false,
  errorMessage,
  focusedCoordinates,
  isLoading,
  isStoreOwner,
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
  currentUserId?: string | null;
  disableUserLocationRecenter?: boolean;
  errorMessage: string;
  focusedCoordinates?: UserCoordinates | null;
  isLoading: boolean;
  isStoreOwner?: boolean;
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
  const userPulse = useRef(new Animated.Value(0)).current;
  const [userInteracted, setUserInteracted] = useState(false);
  const hasMountedRef = useRef(false);
  const hasSettledInitialRegionRef = useRef(false);
  const lastAppliedStoreFitKeyRef = useRef("");
  const programmaticMoveRef = useRef(false);
  const mapInteractionActiveRef = useRef(false);
  const mapMoveEndTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
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
      buildDisplayStores(
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
              originalId: String(store.id),
            };
          })
          .filter(
            (
              value,
            ): value is {
              id: string;
              latitude: number;
              longitude: number;
              originalId: string;
            } => value !== null,
          ),
      ),
    [stores],
  );
  const adjustedRenderableStores = useMemo(() => {
    if (
      !coordinates ||
      !isStoreOwner ||
      !currentUserId ||
      renderableStores.length === 0
    ) {
      return renderableStores;
    }

    return renderableStores.map((store) => {
      const isUserStore = store.originalId === currentUserId;

      if (!isUserStore) {
        return store;
      }

      const userCoordinate = {
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
      };
      const storeCoordinate = {
        latitude: store.displayLatitude,
        longitude: store.displayLongitude,
      };

      if (
        distanceBetweenCoordinatesMeters(userCoordinate, storeCoordinate) >
        USER_STORE_COLLISION_DISTANCE_METERS
      ) {
        return store;
      }

      const offsetCoordinate = offsetCoordinateByMeters(
        storeCoordinate,
        USER_STORE_OFFSET_METERS,
      );

      return {
        ...store,
        displayLatitude: offsetCoordinate.latitude,
        displayLongitude: offsetCoordinate.longitude,
      };
    });
  }, [coordinates, currentUserId, isStoreOwner, renderableStores]);
  const validStoreCoordinates = useMemo(
    () =>
      adjustedRenderableStores.map(
        ({ id, displayLatitude, displayLongitude }) => ({
          id,
          latitude: displayLatitude,
          longitude: displayLongitude,
        }),
      ),
    [adjustedRenderableStores],
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
      .map(
        (store) =>
          `${store.id}:${store.latitude.toFixed(5)}:${store.longitude.toFixed(5)}`,
      )
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

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(userPulse, {
          duration: 1500,
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.timing(userPulse, {
          duration: 0,
          toValue: 0,
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();

    return () => {
      animation.stop();
    };
  }, [userPulse]);

  const userPulseStyle = useMemo(
    () => ({
      opacity: userPulse.interpolate({
        inputRange: [0, 1],
        outputRange: [0.22, 0],
      }),
      transform: [
        {
          scale: userPulse.interpolate({
            inputRange: [0, 1],
            outputRange: [1, 1.9],
          }),
        },
      ],
    }),
    [userPulse],
  );

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
        showsUserLocation={false}
        toolbarEnabled={false}
        style={styles.map}
      >
        {coordinates ? (
          <UserLocationMarker
            coordinates={coordinates}
            userPulseStyle={userPulseStyle}
          />
        ) : null}

        {adjustedRenderableStores.map(
          ({ id, displayLatitude, displayLongitude, originalId }) => {
            const isSelected = id === String(selectedStoreId || "");
            const isUserStore =
              isStoreOwner && currentUserId && originalId === currentUserId;

            return (
              <StoreMapMarker
                key={id}
                id={id}
                isSelected={isSelected}
                isUserStore={Boolean(isUserStore)}
                latitude={displayLatitude}
                longitude={displayLongitude}
                onPress={(storeId) => onSelectStore?.(storeId)}
              />
            );
          },
        )}
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
  userLocationWrap: {
    alignItems: "center",
    height: 54,
    justifyContent: "center",
    width: 54,
  },
  userLocationPulse: {
    backgroundColor: "rgba(71, 122, 255, 0.26)",
    borderRadius: 22,
    height: 44,
    position: "absolute",
    width: 44,
  },
  userLocationHalo: {
    alignItems: "center",
    backgroundColor: "rgba(83, 143, 255, 0.18)",
    borderColor: "rgba(196, 221, 255, 0.45)",
    borderRadius: 12,
    borderWidth: 1,
    height: 24,
    justifyContent: "center",
    shadowColor: "#11203B",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    width: 24,
  },
  userLocationDot: {
    backgroundColor: "#4F86FF",
    borderColor: "rgba(241, 247, 255, 0.92)",
    borderRadius: 7,
    borderWidth: 2,
    height: 14,
    width: 14,
  },
  storeMarkerWrap: {
    alignItems: "center",
    justifyContent: "flex-start",
    paddingBottom: 10,
    paddingHorizontal: 5,
    paddingTop: 5,
  },
  storeMarkerHead: {
    alignItems: "center",
    backgroundColor: "rgba(14, 22, 38, 0.96)",
    borderColor: "rgba(210, 222, 244, 0.92)",
    borderRadius: 15,
    borderWidth: 1.5,
    height: 30,
    justifyContent: "center",
    width: 30,
    shadowColor: "#020817",
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 5,
  },
  storeMarkerHeadSelected: {
    backgroundColor: "#234FC5",
    borderColor: "#DDE8FF",
    transform: [{ scale: 1.05 }],
  },
  storeMarkerCore: {
    backgroundColor: "#D7DFEE",
    borderRadius: 5,
    height: 10,
    width: 10,
  },
  storeMarkerCoreSelected: {
    backgroundColor: "#F7FAFF",
  },
  storeMarkerTail: {
    borderLeftColor: "transparent",
    borderLeftWidth: 7,
    borderRightColor: "transparent",
    borderRightWidth: 7,
    borderTopColor: "rgba(14, 22, 38, 0.96)",
    borderTopWidth: 12,
    marginTop: -2,
  },
  storeMarkerTailSelected: {
    borderTopColor: "#234FC5",
  },
  storeMarkerHeadUserStore: {
    backgroundColor: "#A6313D",
    borderColor: "#F4C6CF",
  },
  storeMarkerCoreUserStore: {
    backgroundColor: "#FBE4E8",
  },
  storeMarkerTailUserStore: {
    borderTopColor: "#A6313D",
  },
});
