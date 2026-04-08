import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  LayoutAnimation,
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { NearaMapView } from "@/components/map/MapView";
import { useDrawer } from "@/components/navigation/drawer-provider";
import { PremiumBadge } from "@/components/ui/premium-badge";
import { SearchInput } from "@/components/ui/search-input";
import { StoreOwnerBadge } from "@/components/ui/store-owner-badge";
import { theme } from "@/constants/theme";
import { useLocation } from "@/hooks/useLocation";
import { parseCoordinate } from "@/services/map-links";
import { useMobileSession } from "@/services/mobile-session";
import {
  clearRecentStores,
  loadRecentStoresForSession,
  useRecentStores,
} from "@/services/saved-stores";
import {
  searchProducts,
  type SearchProductResult,
} from "@/services/search-api";
import { fetchStoresNearby, type BackendStore } from "@/services/store-api";

type HomePreviewResult = {
  id: string;
  image?: string | null;
  price: number | null;
  productId: string;
  productName: string;
  storeId: string;
  storeName: string;
  variant: string;
};

type HomePreviewCard = {
  id: string;
  image?: string | null;
  productName: string;
  storeId: string;
  storeName: string;
  variants: {
    id: string;
    label: string;
    price: number | null;
  }[];
};

type HomeStoreCard = {
  address: string;
  category: string;
  distanceKm?: number | null;
  id: string;
  image?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  name: string;
};

type SelectedMapStore = {
  address: string;
  category: string;
  id: string;
  image?: string | null;
  name: string;
};

const NEARBY_STORE_RADIUS_KM = 2;

function buildStoreInitial(name: string) {
  const trimmed = name.trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : "N";
}

function resolveStoreCoordinates(store: BackendStore | HomeStoreCard) {
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

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return { latitude: Number(latitude), longitude: Number(longitude) };
}

function groupPreviewResults(items: HomePreviewResult[]) {
  const groups = new Map<string, HomePreviewCard>();

  items.forEach((item) => {
    const key = item.productId
      ? `${item.storeId}::${item.productId}`
      : `${item.storeId}::${item.productName.trim().toLowerCase()}`;
    const existing = groups.get(key);

    if (!existing) {
      groups.set(key, {
        id: key,
        image: item.image || null,
        productName: item.productName,
        storeId: item.storeId,
        storeName: item.storeName,
        variants: [
          {
            id: item.id,
            label: item.variant || "Product details available in store",
            price: item.price,
          },
        ],
      });
      return;
    }

    if (
      !existing.variants.some(
        (variant) =>
          variant.label === item.variant && variant.price === item.price,
      )
    ) {
      existing.variants.push({
        id: item.id,
        label: item.variant || "Product details available in store",
        price: item.price,
      });
    }
  });

  return Array.from(groups.values());
}

export default function HomeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    focusStore?: string;
    lat?: string;
    lng?: string;
  }>();
  const { openDrawer } = useDrawer();
  const session = useMobileSession();
  const insets = useSafeAreaInsets();
  const {
    coordinates,
    errorMessage: locationErrorMessage,
    isLoading: isLocationLoading,
    permissionStatus,
    refreshLocation,
    requestLocationPermission,
  } = useLocation({ requestOnMount: true });
  const { height: windowHeight } = useWindowDimensions();
  const [homeQuery, setHomeQuery] = useState("");
  const [previewResults, setPreviewResults] = useState<HomePreviewResult[]>([]);
  const [nearbyStores, setNearbyStores] = useState<HomeStoreCard[]>([]);
  const [browseStores, setBrowseStores] = useState<HomeStoreCard[]>([]);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isLoadingStores, setIsLoadingStores] = useState(true);
  const [previewError, setPreviewError] = useState("");
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [storeMarkers, setStoreMarkers] = useState<BackendStore[]>([]);
  const [storesError, setStoresError] = useState("");
  const [isSheetCollapsed, setIsSheetCollapsed] = useState(false);
  const [isSearchOverlayOpen, setIsSearchOverlayOpen] = useState(false);
  const [overlaySearchQuery, setOverlaySearchQuery] = useState("");
  const [userInteractedWithMap, setUserInteractedWithMap] = useState(false);
  const [mapRecenterKey, setMapRecenterKey] = useState(0);
  const recentStores = useRecentStores();
  const wasReturnedFromStorePage = useRef(false);

  useFocusEffect(
    useCallback(() => {
      // If we're returning from a store page, ignore the focusStore parameter
      if (wasReturnedFromStorePage.current) {
        wasReturnedFromStorePage.current = false;
        return;
      }
      // Mark that on next blur->focus cycle we're returning from another screen
      return () => {
        wasReturnedFromStorePage.current = true;
      };
    }, []),
  );

  const focusStoreId =
    typeof params.focusStore === "string" ? params.focusStore : null;
  const focusLatitude = parseCoordinate(params.lat);
  const focusLongitude = parseCoordinate(params.lng);
  const focusedCoordinates = useMemo(
    () =>
      focusLatitude !== null && focusLongitude !== null
        ? {
            accuracy: null,
            fetchedAt: 0,
            latitude: focusLatitude,
            longitude: focusLongitude,
          }
        : null,
    [focusLatitude, focusLongitude],
  );
  const [mapFocusCoordinates, setMapFocusCoordinates] =
    useState<typeof focusedCoordinates>(null);
  const mapHeight = Math.max(windowHeight, 520);
  const sheetHeight = Math.min(
    Math.max(windowHeight * 0.5, 480),
    Math.round(windowHeight * 0.78),
  );
  const collapsedPeekHeight = 104;
  const maxSheetOffset = Math.max(0, sheetHeight - collapsedPeekHeight);
  const [sheetTranslateY, setSheetTranslateY] = useState(0);
  const dragStartOffsetRef = useRef(0);
  const sheetOffsetRef = useRef(0);
  const mapSheetInteractionRef = useRef({
    autoCollapsed: false,
    isMapMoving: false,
    originalOffset: 0,
    panelManuallyControlled: false,
  });

  useEffect(() => {
    let cancelled = false;
    const timeout = setTimeout(() => {
      void loadHomeData();
    }, 220);

    async function loadHomeData() {
      setIsLoadingStores(true);
      setStoresError("");
      const storesResult = await fetchStoresNearby({
        latitude: coordinates?.latitude ?? null,
        longitude: coordinates?.longitude ?? null,
      });

      if (cancelled) {
        return;
      }

      if (!storesResult.ok) {
        setNearbyStores([]);
        setBrowseStores([]);
        setStoreMarkers([]);
        setStoresError(storesResult.error);
        setIsLoadingStores(false);
        return;
      }

      setStoreMarkers(storesResult.stores);
      const mappedStores = storesResult.stores
        .filter(
          (store) =>
            store.id !== null && store.id !== undefined && store.store_name,
        )
        .map((store) => ({
          address: store.address || "",
          category: store.category || "",
          distanceKm:
            typeof store.distance_km === "number"
              ? store.distance_km
              : store.distance_km !== null && store.distance_km !== undefined
                ? Number(store.distance_km)
                : null,
          id: String(store.id ?? ""),
          image: store.image_url || null,
          latitude:
            typeof store.latitude === "number"
              ? store.latitude
              : store.latitude !== null && store.latitude !== undefined
                ? Number(store.latitude)
                : null,
          longitude:
            typeof store.longitude === "number"
              ? store.longitude
              : store.longitude !== null && store.longitude !== undefined
                ? Number(store.longitude)
                : null,
          name: store.store_name || "",
        }));

      setBrowseStores(mappedStores.slice(0, 6));
      setNearbyStores(
        mappedStores
          .filter(
            (store) =>
              typeof store.distanceKm === "number" &&
              Number.isFinite(store.distanceKm),
          )
          .filter(
            (store) =>
              store.distanceKm !== null &&
              store.distanceKm <= NEARBY_STORE_RADIUS_KM,
          )
          .slice(0, 6),
      );
      setSelectedStoreId((current) => {
        if (
          current &&
          storesResult.stores.some(
            (store) => String(store.id ?? "") === current,
          )
        ) {
          return current;
        }
        if (!focusStoreId) {
          return null;
        }

        return (
          storesResult.stores
            .find((store) => String(store.id ?? "") === focusStoreId)
            ?.id?.toString() ?? null
        );
      });
      setIsLoadingStores(false);
    }

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [coordinates?.latitude, coordinates?.longitude, focusStoreId]);

  useEffect(() => {
    void loadRecentStoresForSession();
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadSearchPreview() {
      const normalized = homeQuery.replace(/\s+/g, " ").trim();

      if (normalized.length < 2) {
        setPreviewResults([]);
        setPreviewError("");
        setIsLoadingPreview(false);
        return;
      }

      setIsLoadingPreview(true);
      setPreviewError("");
      const result = await searchProducts(normalized, { preview: true });

      if (cancelled) {
        return;
      }

      if (!result.ok) {
        setPreviewError(result.error || "Search unavailable");
        setPreviewResults([]);
        setIsLoadingPreview(false);
        return;
      }

      setPreviewResults(
        result.results
          .filter(
            (item: SearchProductResult) => item.store_id && item.product_name,
          )
          .slice(0, 4)
          .map((item: SearchProductResult, index: number) => ({
            id: `${item.store_id}-${item.product_id || index}-${item.variant_name || "preview"}`,
            image: item.image_url || null,
            price:
              typeof item.price === "number"
                ? item.price
                : item.price !== null && item.price !== undefined
                  ? Number(item.price)
                  : null,
            productId: String(item.product_id || ""),
            productName: item.product_name || "",
            storeId: String(item.store_id),
            storeName: item.store_name || "",
            variant: item.variant_name || item.variant || "",
          })),
      );
      setIsLoadingPreview(false);
    }

    const timeout = setTimeout(() => {
      void loadSearchPreview();
    }, 180);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [homeQuery]);

  const groupedPreviewResults = useMemo(
    () => groupPreviewResults(previewResults),
    [previewResults],
  );

  const selectedMapStore = useMemo<SelectedMapStore | null>(() => {
    if (!selectedStoreId) {
      return null;
    }

    const store = storeMarkers.find(
      (item) => String(item.id ?? "") === selectedStoreId,
    );

    if (!store) {
      return null;
    }

    return {
      address: store.address || "",
      category: store.category || "",
      id: String(store.id ?? ""),
      image: store.image_url || null,
      name: store.store_name || "Store",
    };
  }, [selectedStoreId, storeMarkers]);

  const setSheetOffset = useCallback(
    (nextOffset: number) => {
      const clamped = Math.max(0, Math.min(nextOffset, maxSheetOffset));
      sheetOffsetRef.current = clamped;
      setIsSheetCollapsed(clamped >= maxSheetOffset * 0.5);
      setSheetTranslateY(clamped);
    },
    [maxSheetOffset],
  );

  const animateSheetOffset = useCallback(
    (nextOffset: number) => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setSheetOffset(nextOffset);
    },
    [setSheetOffset],
  );

  useEffect(() => {
    setSheetOffset(sheetOffsetRef.current);
  }, [setSheetOffset]);

  useEffect(() => {
    if (!focusStoreId) {
      return;
    }

    setUserInteractedWithMap(false);
    setSelectedStoreId(focusStoreId);
    setMapFocusCoordinates(focusedCoordinates);
    setSheetOffset(maxSheetOffset);
  }, [focusStoreId, focusedCoordinates, maxSheetOffset, setSheetOffset]);

  const handleRequestLocation = useCallback(() => {
    setUserInteractedWithMap(false);
    setMapFocusCoordinates(null);
    setMapRecenterKey((current) => current + 1);

    if (permissionStatus === "denied") {
      void requestLocationPermission();
      return;
    }

    void refreshLocation();
  }, [permissionStatus, refreshLocation, requestLocationPermission]);

  const handleSelectStore = useCallback(
    (storeId: string) => {
      setUserInteractedWithMap(false);
      setSelectedStoreId(storeId);
      const store = storeMarkers.find(
        (item) => String(item.id ?? "") === storeId,
      );
      const coordinates = store ? resolveStoreCoordinates(store) : null;

      if (coordinates) {
        setMapFocusCoordinates({
          accuracy: null,
          fetchedAt: 0,
          latitude: coordinates.latitude,
          longitude: coordinates.longitude,
        });
      }
    },
    [storeMarkers],
  );

  const handleMapMoveStart = useCallback(() => {
    setUserInteractedWithMap(true);
    setSelectedStoreId(null);
    setMapFocusCoordinates(null);
    const state = mapSheetInteractionRef.current;

    if (state.isMapMoving) {
      return;
    }

    state.isMapMoving = true;
    state.panelManuallyControlled = false;
    state.originalOffset = sheetOffsetRef.current;
    state.autoCollapsed = sheetOffsetRef.current < maxSheetOffset;

    if (state.autoCollapsed) {
      animateSheetOffset(maxSheetOffset);
    }
  }, [animateSheetOffset, maxSheetOffset]);

  const handleMapMoveEnd = useCallback(() => {
    const state = mapSheetInteractionRef.current;

    if (!state.isMapMoving) {
      return;
    }

    state.isMapMoving = false;

    if (state.autoCollapsed && !state.panelManuallyControlled) {
      animateSheetOffset(state.originalOffset);
    }

    state.autoCollapsed = false;
    state.originalOffset = sheetOffsetRef.current;
    state.panelManuallyControlled = false;
  }, [animateSheetOffset]);

  const snapSheet = useCallback(
    (velocityY: number) => {
      const currentOffset = sheetOffsetRef.current;

      if (velocityY > 0.5) {
        setSheetOffset(maxSheetOffset);
        return;
      }

      if (velocityY < -0.5) {
        setSheetOffset(0);
        return;
      }

      setSheetOffset(currentOffset > maxSheetOffset / 2 ? maxSheetOffset : 0);
    },
    [maxSheetOffset, setSheetOffset],
  );

  const sheetPanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) =>
          Math.abs(gestureState.dy) > 6 &&
          Math.abs(gestureState.dy) > Math.abs(gestureState.dx),
        onPanResponderGrant: () => {
          dragStartOffsetRef.current = sheetOffsetRef.current;
          mapSheetInteractionRef.current.panelManuallyControlled = true;
          mapSheetInteractionRef.current.autoCollapsed = false;
        },
        onPanResponderMove: (_, gestureState) => {
          const nextOffset = dragStartOffsetRef.current + gestureState.dy;
          const clamped = Math.max(0, Math.min(nextOffset, maxSheetOffset));
          sheetOffsetRef.current = clamped;
          setSheetTranslateY(clamped);
        },
        onPanResponderRelease: (_, gestureState) => {
          snapSheet(gestureState.vy);
        },
        onPanResponderTerminate: (_, gestureState) => {
          snapSheet(gestureState.vy);
        },
      }),
    [maxSheetOffset, snapSheet],
  );

  return (
    <SafeAreaView edges={[]} style={styles.safeArea}>
      <StatusBar style="light" />

      <View style={styles.container}>
        <View style={styles.mapArea}>
          <NearaMapView
            coordinates={coordinates}
            disableUserLocationRecenter={userInteractedWithMap}
            errorMessage={locationErrorMessage}
            focusedCoordinates={mapFocusCoordinates}
            isLoading={isLocationLoading}
            mapRecenterKey={mapRecenterKey}
            onMapMoveStart={handleMapMoveStart}
            onMapMoveEnd={handleMapMoveEnd}
            onRequestLocation={handleRequestLocation}
            onSelectStore={handleSelectStore}
            permissionStatus={permissionStatus}
            selectedStoreId={selectedStoreId}
            style={{ height: mapHeight, width: "100%" }}
            stores={storeMarkers}
          />
        </View>

        <View style={[styles.homeTopOverlay, { top: insets.top + 20 }]}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={openDrawer}
            style={styles.homeMenuButton}
          >
            <View style={styles.homeMenuGlyph}>
              <View style={styles.homeMenuLineFull} />
              <View style={styles.homeMenuLineFull} />
              <View style={styles.homeMenuLineShort} />
            </View>
          </TouchableOpacity>

          {session.isAuthenticated ? (
            <View style={styles.accountStatusChip}>
              <Text numberOfLines={1} style={styles.accountStatusName}>
                {session.name.trim() || "Your account"}
              </Text>
              <View style={styles.accountStatusBadges}>
                {session.isPro ? (
                  <PremiumBadge style={styles.accountStatusBadge} />
                ) : null}
                {session.isStoreOwner ? (
                  <StoreOwnerBadge style={styles.accountStatusBadge} />
                ) : null}
              </View>
            </View>
          ) : null}
        </View>

        {selectedMapStore ? (
          <View pointerEvents="box-none" style={styles.mapPreviewWrap}>
            <View style={styles.mapPreviewCard}>
              {selectedMapStore.image ? (
                <Image
                  source={{ uri: selectedMapStore.image }}
                  style={styles.mapPreviewImage}
                />
              ) : (
                <View style={styles.mapPreviewImageFallback}>
                  <Text style={styles.mapPreviewImageFallbackText}>
                    {buildStoreInitial(selectedMapStore.name)}
                  </Text>
                </View>
              )}
              <View style={styles.mapPreviewBody}>
                <View style={styles.mapPreviewTopRow}>
                  <Text numberOfLines={1} style={styles.mapPreviewTitle}>
                    {selectedMapStore.name}
                  </Text>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => setSelectedStoreId(null)}
                    style={styles.mapPreviewDismissButton}
                  >
                    <Ionicons color="#94a3b8" name="close" size={16} />
                  </TouchableOpacity>
                </View>
                <Text numberOfLines={1} style={styles.mapPreviewCategory}>
                  {selectedMapStore.category || "Store"}
                </Text>
                {selectedMapStore.address ? (
                  <Text numberOfLines={2} style={styles.mapPreviewAddress}>
                    {selectedMapStore.address}
                  </Text>
                ) : null}
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => router.push(`/store/${selectedMapStore.id}`)}
                  style={styles.mapPreviewOpenButton}
                >
                  <Text style={styles.mapPreviewOpenText}>Open store</Text>
                  <Ionicons color="#dbeafe" name="chevron-forward" size={14} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : null}

        {isSearchOverlayOpen ? (
          <View style={styles.searchOverlayWrap}>
            <View style={styles.searchOverlayBackdrop} />
            <View
              style={[
                styles.searchOverlayCard,
                { marginTop: Math.max(insets.top + 56, 84) },
              ]}
            >
              <View style={styles.searchOverlayHeader}>
                <Text style={styles.searchOverlayTitle}>Search</Text>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => setIsSearchOverlayOpen(false)}
                  style={styles.searchOverlayCloseButton}
                >
                  <Ionicons color="#f8fafc" name="close" size={22} />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handleRequestLocation}
                style={styles.searchOverlayLocationCard}
              >
                <Text style={styles.searchOverlayLocationEyebrow}>
                  USE YOUR LOCATION
                </Text>
                <Text style={styles.searchOverlayLocationText}>
                  Using your location
                </Text>
              </TouchableOpacity>

              <SearchInput
                onChangeText={(value) => {
                  setOverlaySearchQuery(value);
                  setHomeQuery(value);
                }}
                onSubmitEditing={() => {
                  const normalized = overlaySearchQuery
                    .replace(/\s+/g, " ")
                    .trim();

                  if (normalized.length < 2) {
                    return;
                  }

                  setIsSearchOverlayOpen(false);
                  router.push({
                    pathname: "/search",
                    params: { q: normalized },
                  });
                }}
                placeholder="Search stores, products, or locations"
                returnKeyType="search"
                style={styles.searchOverlayInput}
                value={overlaySearchQuery}
              />

              <View style={styles.searchOverlaySectionHeader}>
                <Text style={styles.searchOverlaySectionTitle}>
                  {overlaySearchQuery.trim().length >= 2
                    ? "Results"
                    : "Recent stores"}
                </Text>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => {
                    if (overlaySearchQuery.trim().length >= 2) {
                      setOverlaySearchQuery("");
                      setHomeQuery("");
                      return;
                    }

                    void clearRecentStores();
                  }}
                >
                  <Text style={styles.clearText}>Clear</Text>
                </TouchableOpacity>
              </View>

              <ScrollView
                bounces={false}
                contentContainerStyle={styles.searchOverlayRecentList}
                showsVerticalScrollIndicator={false}
              >
                {overlaySearchQuery.trim().length >= 2 && previewError ? (
                  <View style={styles.infoCard}>
                    <Text style={styles.infoCardTitle}>Search unavailable</Text>
                    <Text style={styles.infoCardText}>{previewError}</Text>
                  </View>
                ) : overlaySearchQuery.trim().length >= 2 &&
                  isLoadingPreview ? (
                  <View style={styles.infoCard}>
                    <Text style={styles.infoCardTitle}>Loading matches</Text>
                    <Text style={styles.infoCardText}>
                      Checking products and stores around you.
                    </Text>
                  </View>
                ) : overlaySearchQuery.trim().length >= 2 &&
                  groupedPreviewResults.length > 0 ? (
                  groupedPreviewResults.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      activeOpacity={0.85}
                      onPress={() => {
                        setIsSearchOverlayOpen(false);
                        router.push(`/store/${item.storeId}`);
                      }}
                      style={styles.previewCard}
                    >
                      {item.image ? (
                        <Image
                          source={{ uri: item.image }}
                          style={styles.previewImage}
                        />
                      ) : (
                        <View style={styles.previewImageFallback}>
                          <Text style={styles.previewImageFallbackText}>
                            {buildStoreInitial(item.storeName)}
                          </Text>
                        </View>
                      )}
                      <View style={styles.previewBody}>
                        <View style={styles.previewTopRow}>
                          <Text
                            numberOfLines={1}
                            style={styles.previewStoreName}
                          >
                            {item.storeName}
                          </Text>
                        </View>
                        <Text
                          numberOfLines={2}
                          style={styles.previewProductName}
                        >
                          {item.productName}
                        </Text>
                        {item.variants.map((variant) => (
                          <View
                            key={variant.id}
                            style={styles.previewVariantRow}
                          >
                            <Text
                              numberOfLines={1}
                              style={styles.previewVariantText}
                            >
                              {variant.label}
                            </Text>
                            <Text style={styles.previewPriceText}>
                              {variant.price !== null
                                ? `₦${variant.price.toLocaleString("en-NG")}`
                                : "View"}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </TouchableOpacity>
                  ))
                ) : overlaySearchQuery.trim().length >= 2 ? (
                  <View style={styles.infoCard}>
                    <Text style={styles.infoCardTitle}>No matches found</Text>
                    <Text style={styles.infoCardText}>
                      Try another search term.
                    </Text>
                  </View>
                ) : recentStores.length > 0 ? (
                  recentStores.map((store, index) => (
                    <TouchableOpacity
                      key={`${store.store_id}-${index}`}
                      activeOpacity={0.85}
                      onPress={() => {
                        setIsSearchOverlayOpen(false);
                        router.push(`/store/${store.store_id}`);
                      }}
                      style={styles.storeRowCard}
                    >
                      {store.image_url ? (
                        <Image
                          source={{ uri: store.image_url }}
                          style={styles.storeRowImage}
                        />
                      ) : (
                        <View style={styles.storeRowImageFallback}>
                          <Text style={styles.storeRowImageFallbackText}>
                            {store.store_name.slice(0, 1).toUpperCase()}
                          </Text>
                        </View>
                      )}
                      <View style={styles.storeRowBody}>
                        <View style={styles.storeRowTitleWrap}>
                          <Text style={styles.storeRowTitle}>
                            {store.store_name}
                          </Text>
                        </View>
                        <Text numberOfLines={1} style={styles.storeRowMeta}>
                          {store.category || "Store"}
                        </Text>
                        <Text numberOfLines={2} style={styles.storeRowAddress}>
                          {store.address || "View store"}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))
                ) : (
                  <View style={styles.recentCard}>
                    <View style={styles.recentStoreInfo}>
                      <Text style={styles.recentStoreTitle}>
                        No recent stores yet
                      </Text>
                      <Text style={styles.recentStoreSubtitle}>
                        Stores you open from backend results will appear here.
                      </Text>
                    </View>
                  </View>
                )}
              </ScrollView>
            </View>
          </View>
        ) : null}

        <View
          style={[
            styles.sheet,
            {
              height: sheetHeight,
              transform: [{ translateY: sheetTranslateY }],
            },
          ]}
        >
          <View {...sheetPanResponder.panHandlers} style={styles.sheetDragZone}>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() =>
                setSheetOffset(isSheetCollapsed ? 0 : maxSheetOffset)
              }
              style={styles.handleButton}
            >
              <View style={styles.handle} />
            </TouchableOpacity>
          </View>

          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={{ flex: 1 }}
            keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
          >
            <View
              style={[
                styles.searchHeader,
                isSheetCollapsed && styles.searchHeaderCollapsed,
              ]}
            >
              <SearchInput
                mode="pressable"
                onPress={() => setIsSearchOverlayOpen(true)}
                placeholder="Search stores, products, or locations"
                style={styles.searchBar}
              />

              {!isSheetCollapsed ? (
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={handleRequestLocation}
                  style={styles.locationButton}
                >
                  <View style={styles.locationIconWrap}>
                    <Ionicons color="#BFD0FF" name="locate-outline" size={18} />
                  </View>
                  <Text style={styles.locationButtonText}>
                    {permissionStatus === "denied"
                      ? "Enable location"
                      : "My location"}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>

            {!isSheetCollapsed ? (
              <ScrollView
                bounces={false}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                scrollEnabled
                style={styles.sheetScroll}
              >
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Recent stores</Text>
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() => void clearRecentStores()}
                    >
                      <Text style={styles.clearText}>Clear</Text>
                    </TouchableOpacity>
                  </View>

                  {recentStores.length > 0 ? (
                    recentStores.map((store, index) => (
                      <TouchableOpacity
                        key={`${store.store_id}-${index}`}
                        activeOpacity={0.85}
                        onPress={() => router.push(`/store/${store.store_id}`)}
                        style={styles.recentVisualCard}
                      >
                        {store.image_url ? (
                          <Image
                            source={{ uri: store.image_url }}
                            style={styles.recentVisualImage}
                          />
                        ) : (
                          <View style={styles.recentVisualFallback}>
                            <Text style={styles.recentVisualFallbackText}>
                              {store.store_name.slice(0, 1).toUpperCase()}
                            </Text>
                          </View>
                        )}
                        <View style={styles.recentVisualOverlay} />
                        <View style={styles.recentAvatar}>
                          <Text style={styles.recentAvatarText}>
                            {store.store_name.slice(0, 1).toUpperCase()}
                          </Text>
                        </View>
                        <View style={styles.recentVisualFooter}>
                          <View style={styles.recentStoreInfo}>
                            <Text style={styles.recentStoreTitle}>
                              {store.store_name}
                            </Text>
                            <Text style={styles.recentStoreSubtitle}>
                              {store.category || store.address || "View store"}
                            </Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    ))
                  ) : (
                    <View style={styles.recentCard}>
                      <View style={styles.recentStoreInfo}>
                        <Text style={styles.recentStoreTitle}>
                          No recent stores yet
                        </Text>
                        <Text style={styles.recentStoreSubtitle}>
                          Stores you open from backend results will appear here.
                        </Text>
                      </View>
                    </View>
                  )}
                </View>

                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Near you</Text>
                  </View>

                  {isLoadingStores ? (
                    <View style={styles.infoCard}>
                      <Text style={styles.infoCardTitle}>Loading stores</Text>
                      <Text style={styles.infoCardText}>
                        Fetching nearby stores from the backend.
                      </Text>
                    </View>
                  ) : storesError ? (
                    <View style={styles.infoCard}>
                      <Text style={styles.infoCardTitle}>
                        Could not load stores
                      </Text>
                      <Text style={styles.infoCardText}>{storesError}</Text>
                    </View>
                  ) : nearbyStores.length > 0 ? (
                    nearbyStores.map((store, index) => (
                      <TouchableOpacity
                        key={`${store.id}-nearby-${index}`}
                        activeOpacity={0.85}
                        onPress={() => router.push(`/store/${store.id}`)}
                        style={[
                          styles.storeRowCard,
                          selectedStoreId === store.id
                            ? styles.storeRowCardSelected
                            : null,
                        ]}
                      >
                        {store.image ? (
                          <Image
                            source={{ uri: store.image }}
                            style={styles.storeRowImage}
                          />
                        ) : (
                          <View style={styles.storeRowImageFallback}>
                            <Text style={styles.storeRowImageFallbackText}>
                              {buildStoreInitial(store.name)}
                            </Text>
                          </View>
                        )}
                        <View style={styles.storeRowBody}>
                        <View style={styles.storeRowTitleWrap}>
                          <Text style={styles.storeRowTitle}>
                            {store.name}
                          </Text>
                        </View>
                          <Text numberOfLines={1} style={styles.storeRowMeta}>
                            {store.distanceKm &&
                            Number.isFinite(store.distanceKm)
                              ? `${store.category || "Store"} • ${store.distanceKm.toFixed(1)} km`
                              : store.category || "Store"}
                          </Text>
                          <Text
                            numberOfLines={2}
                            style={styles.storeRowAddress}
                          >
                            {store.address || "Address not available"}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))
                  ) : (
                    <View style={styles.infoCard}>
                      <Text style={styles.infoCardTitle}>
                        No stores found near you
                      </Text>
                      <Text style={styles.infoCardText}>
                        Stores will show here when they are within 1 km of you.
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Browse stores</Text>
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() => router.push("/search")}
                    >
                      <Text style={styles.clearText}>Search all</Text>
                    </TouchableOpacity>
                  </View>

                  {isLoadingStores ? (
                    <View style={styles.infoCard}>
                      <Text style={styles.infoCardTitle}>
                        Loading store list
                      </Text>
                      <Text style={styles.infoCardText}>
                        Fetching current stores.
                      </Text>
                    </View>
                  ) : storesError ? (
                    <View style={styles.infoCard}>
                      <Text style={styles.infoCardTitle}>
                        Could not load stores
                      </Text>
                      <Text style={styles.infoCardText}>{storesError}</Text>
                    </View>
                  ) : browseStores.length > 0 ? (
                    browseStores.map((store, index) => (
                      <TouchableOpacity
                        key={`${store.id}-${index}`}
                        activeOpacity={0.85}
                        onPress={() => {
                          handleSelectStore(store.id);
                          router.push(`/store/${store.id}`);
                        }}
                        style={[
                          styles.storeRowCard,
                          selectedStoreId === store.id
                            ? styles.storeRowCardSelected
                            : null,
                        ]}
                      >
                        {store.image ? (
                          <Image
                            source={{ uri: store.image }}
                            style={styles.storeRowImage}
                          />
                        ) : (
                          <View style={styles.storeRowImageFallback}>
                            <Text style={styles.storeRowImageFallbackText}>
                              {buildStoreInitial(store.name)}
                            </Text>
                          </View>
                        )}
                        <View style={styles.storeRowBody}>
                        <View style={styles.storeRowTitleWrap}>
                          <Text style={styles.storeRowTitle}>
                            {store.name}
                          </Text>
                        </View>
                          <Text numberOfLines={1} style={styles.storeRowMeta}>
                            {store.distanceKm &&
                            Number.isFinite(store.distanceKm)
                              ? `${store.category || "Store"} • ${store.distanceKm.toFixed(1)} km`
                              : store.category || "Store"}
                          </Text>
                          <Text
                            numberOfLines={2}
                            style={styles.storeRowAddress}
                          >
                            {store.address || "Address not available"}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))
                  ) : (
                    <View style={styles.infoCard}>
                      <Text style={styles.infoCardTitle}>
                        No stores found near you
                      </Text>
                      <Text style={styles.infoCardText}>
                        Stores will appear here when nearby results are
                        available.
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.bottomSpacing} />
              </ScrollView>
            ) : null}
          </KeyboardAvoidingView>
        </View>
      </View>
    </SafeAreaView>
  );
}

const BORDER = "rgba(255,255,255,0.08)";

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  mapArea: {
    ...StyleSheet.absoluteFillObject,
  },
  homeTopOverlay: {
    position: "absolute",
    left: 20,
    right: 20,
    zIndex: 60,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  homeMenuButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(31, 41, 55, 0.96)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#020617",
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.24,
    shadowRadius: 26,
    elevation: 10,
  },
  homeMenuGlyph: {
    width: 24,
    height: 18,
    justifyContent: "space-between",
  },
  homeMenuLineFull: {
    width: 24,
    height: 2.5,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
  },
  homeMenuLineShort: {
    width: 14,
    height: 2.5,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
  },
  accountStatusChip: {
    minWidth: 132,
    maxWidth: 220,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(17, 24, 39, 0.94)",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    alignItems: "flex-end",
  },
  accountStatusName: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: "800",
  },
  accountStatusBadges: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: 6,
  },
  accountStatusBadge: {
    transform: [{ scale: 0.92 }],
  },
  mapPreviewWrap: {
    position: "absolute",
    left: 16,
    right: 16,
    top: 140,
    zIndex: 58,
  },
  searchOverlayWrap: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 70,
    alignItems: "center",
    paddingHorizontal: 18,
  },
  searchOverlayBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(2, 6, 23, 0.36)",
  },
  searchOverlayCard: {
    width: "100%",
    maxWidth: 540,
    maxHeight: "72%",
    borderRadius: 30,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(11, 18, 32, 0.96)",
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 20,
    shadowColor: "#020617",
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.28,
    shadowRadius: 28,
    elevation: 18,
  },
  searchOverlayHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  searchOverlayTitle: {
    color: theme.colors.text,
    fontSize: 22,
    fontWeight: "800",
  },
  searchOverlayCloseButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.10)",
  },
  searchOverlayLocationCard: {
    borderRadius: 30,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 18,
    paddingVertical: 18,
    marginBottom: 18,
  },
  searchOverlayLocationEyebrow: {
    color: "#9ca3af",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  searchOverlayLocationText: {
    marginTop: 12,
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: "800",
  },
  searchOverlayInput: {
    marginBottom: 28,
    backgroundColor: "rgba(12, 22, 42, 0.96)",
  },
  searchOverlaySectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  searchOverlaySectionTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  searchOverlayRecentList: {
    gap: 12,
    paddingBottom: 4,
  },
  mapPreviewCard: {
    flexDirection: "row",
    overflow: "hidden",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(9, 15, 29, 0.94)",
    shadowColor: "#020617",
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.28,
    shadowRadius: 26,
    elevation: 10,
  },
  mapPreviewImage: {
    width: 116,
    height: 104,
  },
  mapPreviewImageFallback: {
    width: 116,
    height: 104,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(30, 41, 59, 0.98)",
  },
  mapPreviewImageFallbackText: {
    color: "#f8fafc",
    fontSize: 34,
    fontWeight: "800",
  },
  mapPreviewBody: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  mapPreviewTopRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  mapPreviewTitle: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: "800",
  },
  mapPreviewDismissButton: {
    width: 24,
    height: 24,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  mapPreviewCategory: {
    marginTop: 10,
    color: "#b8c6d9",
    fontSize: 13,
    fontWeight: "700",
  },
  mapPreviewAddress: {
    marginTop: 6,
    color: "#8fa2ba",
    fontSize: 12,
    lineHeight: 18,
  },
  mapPreviewOpenButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 10,
  },
  mapPreviewOpenText: {
    color: "#dbeafe",
    fontSize: 12,
    fontWeight: "700",
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    overflow: "hidden",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(10, 18, 32, 0.98)",
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.22,
    shadowRadius: 24,
    elevation: 20,
  },
  sheetDragZone: {
    paddingTop: 10,
  },
  handleButton: {
    alignItems: "center",
  },
  handle: {
    alignSelf: "center",
    width: 48,
    height: 6,
    marginTop: 6,
    marginBottom: 10,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.22)",
  },
  searchHeader: {
    paddingHorizontal: 18,
    paddingBottom: 6,
  },
  searchHeaderCollapsed: {
    paddingBottom: 14,
  },
  searchBar: {
    ...theme.shadows.soft,
  },
  locationButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 46,
    marginTop: 16,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  locationIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(79,124,255,0.22)",
  },
  locationButtonText: {
    color: "#d8e6f6",
    fontSize: 13,
    fontWeight: "800",
  },
  sheetScroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 0,
    paddingBottom: 120,
  },
  section: {
    marginTop: 28,
    gap: 14,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  clearText: {
    color: "#5FA0FF",
    fontSize: 14,
    fontWeight: "700",
  },
  infoCard: {
    gap: 10,
    padding: 18,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(16, 26, 46, 0.88)",
  },
  infoCardTitle: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: "800",
  },
  infoCardText: {
    color: "#9fb0c4",
    fontSize: 14,
    lineHeight: 22,
  },
  previewCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(16, 26, 46, 0.9)",
  },
  previewImage: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: "#111827",
  },
  previewImageFallback: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: "rgba(59,130,246,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  previewImageFallbackText: {
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: "700",
  },
  previewBody: {
    flex: 1,
    minWidth: 0,
  },
  previewTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  previewStoreName: {
    flexShrink: 1,
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: "800",
  },
  previewProductName: {
    marginTop: 4,
    color: "#E2E8F0",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
  },
  previewVariantText: {
    marginTop: 4,
    color: "#94a8bf",
    fontSize: 12,
  },
  previewVariantRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 4,
  },
  previewRightMeta: {
    alignItems: "flex-end",
    gap: 4,
    justifyContent: "center",
  },
  previewPriceText: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: "700",
  },
  previewLinkText: {
    color: "#5FA0FF",
    fontSize: 11,
    fontWeight: "700",
  },
  recentCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "rgba(16, 26, 46, 0.94)",
  },
  recentVisualCard: {
    height: 152,
    overflow: "hidden",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#111827",
  },
  recentVisualImage: {
    ...StyleSheet.absoluteFillObject,
  },
  recentVisualFallback: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(59,130,246,0.18)",
  },
  recentVisualFallbackText: {
    color: "#f8fafc",
    fontSize: 34,
    fontWeight: "800",
  },
  recentVisualOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(2, 6, 23, 0.28)",
  },
  recentAvatar: {
    position: "absolute",
    left: 18,
    top: 18,
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(2, 6, 23, 0.72)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  recentAvatarText: {
    color: "#f8fafc",
    fontSize: 22,
    fontWeight: "800",
  },
  recentVisualFooter: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: 18,
    backgroundColor: "rgba(2, 6, 23, 0.44)",
  },
  recentStoreInfo: {
    gap: 4,
  },
  recentStoreTitle: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: "800",
  },
  recentStoreSubtitle: {
    color: "#c3d1e6",
    fontSize: 13,
  },
  storeRowCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "rgba(16, 26, 46, 0.9)",
  },
  storeRowCardSelected: {
    borderColor: "rgba(125, 211, 252, 0.32)",
    backgroundColor: "rgba(8, 47, 73, 0.88)",
  },
  storeRowImage: {
    width: 58,
    height: 58,
    borderRadius: 16,
  },
  storeRowImageFallback: {
    width: 58,
    height: 58,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(59,130,246,0.16)",
  },
  storeRowImageFallbackText: {
    color: theme.colors.text,
    fontSize: 22,
    fontWeight: "800",
  },
  storeRowBody: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  storeRowTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  storeRowTitle: {
    flexShrink: 1,
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: "800",
  },
  storeRowMeta: {
    color: "#b9c6d8",
    fontSize: 13,
    fontWeight: "700",
  },
  storeRowAddress: {
    color: "#8fa2ba",
    fontSize: 12,
    lineHeight: 18,
  },
  bottomSpacing: {
    height: 24,
  },
});
