import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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
import { SavedStoreSkeleton } from "@/components/saved/saved-store-skeleton";
import {
  SearchResultCard,
  type SearchResultCardVariant,
} from "@/components/search/search-result-card";
import { AppImage } from "@/components/ui/app-image";
import { PremiumBadge } from "@/components/ui/premium-badge";
import { SearchInput } from "@/components/ui/search-input";
import { StoreOwnerBadge } from "@/components/ui/store-owner-badge";
import { theme } from "@/constants/theme";
import { useLocation } from "@/hooks/useLocation";
import { prefetchImageUris } from "@/services/image-cache";
import { parseCoordinate } from "@/services/map-links";
import { useMobileSession } from "@/services/mobile-session";
import {
  clearRecentStores,
  loadRecentStoresForSession,
  useRecentStores,
} from "@/services/saved-stores";
import {
  groupSearchResultCards,
  loadSearchResults,
  type SearchResultRecord,
} from "@/services/search-data";
import {
  loadPublicStoreCatalog,
  type StoreListItem,
} from "@/services/store-data";

type HomePreviewResult = SearchResultRecord;

type HomeStoreCard = StoreListItem;

type SelectedMapStore = {
  address: string;
  category: string;
  id: string;
  image?: string | null;
  name: string;
};

function buildStoreInitial(name: string) {
  const trimmed = name.trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : "N";
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
  const [storeMarkers, setStoreMarkers] = useState<StoreListItem[]>([]);
  const [storesError, setStoresError] = useState("");
  const [isSheetCollapsed, setIsSheetCollapsed] = useState(false);
  const [isSearchOverlayOpen, setIsSearchOverlayOpen] = useState(false);
  const [overlaySearchQuery, setOverlaySearchQuery] = useState("");
  const [userInteractedWithMap, setUserInteractedWithMap] = useState(false);
  const [mapRecenterKey, setMapRecenterKey] = useState(0);
  const recentStores = useRecentStores();
  const wasReturnedFromStorePage = useRef(false);
  const searchOverlayInputRef = useRef<TextInput | null>(null);
  const storeMarkersRef = useRef<StoreListItem[]>([]);
  const latestStoreFetchIdRef = useRef(0);

  useFocusEffect(
    useCallback(() => {
      if (wasReturnedFromStorePage.current) {
        wasReturnedFromStorePage.current = false;
        setSelectedStoreId(null);
        setMapFocusCoordinates(null);
        setUserInteractedWithMap(false);
        return;
      }

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
  const sheetEntranceOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(0)).current;
  const dragStartOffsetRef = useRef(0);
  const sheetOffsetRef = useRef(0);
  const sheetAnimationRef = useRef<Animated.CompositeAnimation | null>(null);
  const hasPlayedSheetEntranceRef = useRef(false);
  const [isManuallyCollapsed, setIsManuallyCollapsed] = useState(false);
  const [isMapInteracting, setIsMapInteracting] = useState(false);
  const isManuallyCollapsedRef = useRef(false);
  const isMapInteractingRef = useRef(false);

  useEffect(() => {
    storeMarkersRef.current = storeMarkers;
  }, [storeMarkers]);

  const applyLoadedStores = useCallback(
    (catalog: {
      browseStores: StoreListItem[];
      mapPins: StoreListItem[];
      nearbyStores: StoreListItem[];
      stores: StoreListItem[];
    }) => {
      setStoreMarkers(catalog.mapPins);
      setBrowseStores(catalog.browseStores);
      setNearbyStores(catalog.nearbyStores);
      setSelectedStoreId((current) => {
        if (!current) {
          return null;
        }

        return catalog.mapPins.some((store) => store.id === current)
          ? current
          : null;
      });

      return catalog.mapPins.length > 0;
    },
    [],
  );

  useEffect(() => {
    const fetchId = latestStoreFetchIdRef.current + 1;
    latestStoreFetchIdRef.current = fetchId;
    let cancelled = false;

    async function loadStores() {
      const shouldShowLoadingState = storeMarkersRef.current.length === 0;

      if (shouldShowLoadingState) {
        setIsLoadingStores(true);
      }
      setStoresError("");

      const storesResult = await loadPublicStoreCatalog({
        coordinates,
      });

      if (cancelled || latestStoreFetchIdRef.current !== fetchId) {
        return;
      }

      if (!storesResult.ok) {
        if (storeMarkersRef.current.length === 0) {
          setStoresError(storesResult.error);
        }

        setIsLoadingStores(false);
        return;
      }

      const didApplyStores = applyLoadedStores(storesResult);

      if (didApplyStores) {
        setStoresError("");
      } else if (storeMarkersRef.current.length === 0) {
        setStoresError("No stores available yet.");
      }

      setIsLoadingStores(false);
    }

    void loadStores();

    return () => {
      cancelled = true;
    };
  }, [applyLoadedStores, coordinates]);

  useEffect(() => {
    if (!focusStoreId) {
      return;
    }

    const matchingStore = storeMarkers.find(
      (store) => store.id === focusStoreId,
    );

    if (!matchingStore?.id) {
      return;
    }

    setSelectedStoreId(matchingStore.id);
  }, [focusStoreId, storeMarkers]);

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
      const result = await loadSearchResults(normalized, { preview: true });

      if (cancelled) {
        return;
      }

      if (!result.ok) {
        setPreviewError(result.error || "We couldn't load results right now.");
        setPreviewResults([]);
        setIsLoadingPreview(false);
        return;
      }

      setPreviewResults(result.items.slice(0, 4));
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

  useEffect(() => {
    if (!isSearchOverlayOpen) {
      return;
    }

    const timeout = setTimeout(() => {
      searchOverlayInputRef.current?.focus();
    }, 60);

    return () => clearTimeout(timeout);
  }, [isSearchOverlayOpen]);

  const groupedPreviewResults = useMemo(
    () => groupSearchResultCards(previewResults),
    [previewResults],
  );
  const previewResultsAnimationKey = useMemo(
    () => groupedPreviewResults.map((item) => item.key).join("|"),
    [groupedPreviewResults],
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
      address: store.address,
      category: store.category,
      id: store.id,
      image: store.image,
      name: store.name || "Store",
    };
  }, [selectedStoreId, storeMarkers]);

  useEffect(() => {
    void prefetchImageUris([
      selectedMapStore?.image,
      ...groupedPreviewResults.slice(0, 6).map((item) => item.image),
      ...recentStores.slice(0, 6).map((store) => store.image_url),
      ...nearbyStores.slice(0, 6).map((store) => store.image),
      ...browseStores.slice(0, 6).map((store) => store.image),
    ]);
  }, [
    browseStores,
    groupedPreviewResults,
    nearbyStores,
    recentStores,
    selectedMapStore,
  ]);

  const syncSheetFlags = useCallback(
    (offset: number, options?: { manualCollapsed?: boolean }) => {
      const manualCollapsed =
        options?.manualCollapsed ?? offset >= maxSheetOffset * 0.5;
      isManuallyCollapsedRef.current = manualCollapsed;
      setIsManuallyCollapsed(manualCollapsed);
      setIsSheetCollapsed(offset >= maxSheetOffset * 0.5);
    },
    [maxSheetOffset],
  );

  const setSheetPosition = useCallback(
    (
      nextOffset: number,
      options?: { manualCollapsed?: boolean; stopAnimation?: boolean },
    ) => {
      const clamped = Math.max(0, Math.min(nextOffset, maxSheetOffset));
      if (options?.stopAnimation !== false) {
        sheetAnimationRef.current?.stop();
        sheetAnimationRef.current = null;
      }
      sheetOffsetRef.current = clamped;
      syncSheetFlags(clamped, { manualCollapsed: options?.manualCollapsed });
      sheetTranslateY.setValue(clamped);
    },
    [maxSheetOffset, sheetTranslateY, syncSheetFlags],
  );

  const animateSheetPosition = useCallback(
    (nextOffset: number, options?: { manualCollapsed?: boolean }) => {
      const clamped = Math.max(0, Math.min(nextOffset, maxSheetOffset));

      sheetAnimationRef.current?.stop();
      sheetAnimationRef.current = Animated.timing(sheetTranslateY, {
        toValue: clamped,
        duration: 260,
        useNativeDriver: true,
      });

      sheetAnimationRef.current.start(({ finished }) => {
        if (!finished) {
          return;
        }

        sheetOffsetRef.current = clamped;
        syncSheetFlags(clamped, { manualCollapsed: options?.manualCollapsed });
        sheetAnimationRef.current = null;
      });
    },
    [maxSheetOffset, sheetTranslateY, syncSheetFlags],
  );

  const animateSheetEntrance = useCallback(
    (targetOffset: number) => {
      const clamped = Math.max(0, Math.min(targetOffset, maxSheetOffset));

      sheetAnimationRef.current?.stop();
      sheetEntranceOpacity.setValue(0);
      sheetTranslateY.setValue(sheetHeight);
      sheetAnimationRef.current = Animated.parallel([
        Animated.timing(sheetTranslateY, {
          toValue: clamped,
          duration: 720,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(sheetEntranceOpacity, {
          toValue: 1,
          duration: 520,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]);

      sheetAnimationRef.current.start(({ finished }) => {
        if (!finished) {
          return;
        }

        sheetOffsetRef.current = clamped;
        syncSheetFlags(clamped, {
          manualCollapsed: clamped >= maxSheetOffset * 0.5,
        });
        sheetEntranceOpacity.setValue(1);
        sheetAnimationRef.current = null;
      });
    },
    [
      maxSheetOffset,
      sheetEntranceOpacity,
      sheetHeight,
      sheetTranslateY,
      syncSheetFlags,
    ],
  );

  useEffect(() => {
    setSheetPosition(sheetOffsetRef.current, {
      manualCollapsed: isManuallyCollapsedRef.current,
    });
  }, [setSheetPosition]);

  useEffect(() => {
    if (hasPlayedSheetEntranceRef.current) {
      return;
    }

    hasPlayedSheetEntranceRef.current = true;
    animateSheetEntrance(
      focusStoreId ? maxSheetOffset : sheetOffsetRef.current,
    );
  }, [animateSheetEntrance, focusStoreId, maxSheetOffset]);

  useEffect(() => {
    isManuallyCollapsedRef.current = isManuallyCollapsed;
  }, [isManuallyCollapsed]);

  useEffect(() => {
    isMapInteractingRef.current = isMapInteracting;
  }, [isMapInteracting]);

  useEffect(() => {
    if (!focusStoreId) {
      return;
    }

    setUserInteractedWithMap(false);
    setSelectedStoreId(focusStoreId);
    setMapFocusCoordinates(focusedCoordinates);
    setSheetPosition(maxSheetOffset, { manualCollapsed: true });
  }, [focusStoreId, focusedCoordinates, maxSheetOffset, setSheetPosition]);

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
      const store = storeMarkers.find((item) => item.id === storeId);
      const coordinates =
        store &&
        typeof store.latitude === "number" &&
        typeof store.longitude === "number"
          ? {
              latitude: store.latitude,
              longitude: store.longitude,
            }
          : null;

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

  const handleOpenStoreFromHomeList = useCallback(
    (storeId: string) => {
      setSelectedStoreId(null);
      setMapFocusCoordinates(null);
      setUserInteractedWithMap(false);
      router.push(`/store/${storeId}`);
    },
    [router],
  );

  const handleMapMoveStart = useCallback(() => {
    setUserInteractedWithMap(true);
    setSelectedStoreId(null);
    setMapFocusCoordinates(null);
    if (isMapInteractingRef.current) {
      return;
    }

    isMapInteractingRef.current = true;
    setIsMapInteracting(true);

    if (!isManuallyCollapsedRef.current) {
      animateSheetPosition(maxSheetOffset, { manualCollapsed: false });
    }
  }, [animateSheetPosition, maxSheetOffset]);

  const handleMapMoveEnd = useCallback(() => {
    if (!isMapInteractingRef.current) {
      return;
    }

    isMapInteractingRef.current = false;
    setIsMapInteracting(false);

    if (!isManuallyCollapsedRef.current) {
      animateSheetPosition(0, { manualCollapsed: false });
    }
  }, [animateSheetPosition]);

  const snapSheet = useCallback(
    (velocityY: number) => {
      const currentOffset = sheetOffsetRef.current;
      const nextOffset =
        velocityY > 0.5
          ? maxSheetOffset
          : velocityY < -0.5
            ? 0
            : currentOffset > maxSheetOffset / 2
              ? maxSheetOffset
              : 0;

      animateSheetPosition(nextOffset, {
        manualCollapsed: nextOffset >= maxSheetOffset * 0.5,
      });
    },
    [animateSheetPosition, maxSheetOffset],
  );

  const sheetPanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) =>
          Math.abs(gestureState.dy) > 6 &&
          Math.abs(gestureState.dy) > Math.abs(gestureState.dx),
        onPanResponderGrant: () => {
          sheetAnimationRef.current?.stop();
          sheetAnimationRef.current = null;
          dragStartOffsetRef.current = sheetOffsetRef.current;
        },
        onPanResponderMove: (_, gestureState) => {
          const nextOffset = dragStartOffsetRef.current + gestureState.dy;
          setSheetPosition(nextOffset, {
            manualCollapsed: nextOffset >= maxSheetOffset * 0.5,
            stopAnimation: false,
          });
        },
        onPanResponderRelease: (_, gestureState) => {
          snapSheet(gestureState.vy);
        },
        onPanResponderTerminate: (_, gestureState) => {
          snapSheet(gestureState.vy);
        },
      }),
    [maxSheetOffset, setSheetPosition, snapSheet],
  );

  return (
    <SafeAreaView edges={[]} style={styles.safeArea}>
      <StatusBar style="light" />

      <View style={styles.container}>
        <View style={styles.mapArea}>
          <NearaMapView
            coordinates={coordinates}
            currentUserId={session.primaryStoreId}
            disableUserLocationRecenter={userInteractedWithMap}
            errorMessage={locationErrorMessage}
            focusedCoordinates={mapFocusCoordinates}
            isLoading={isLocationLoading}
            isStoreOwner={session.isStoreOwner}
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
          <View
            pointerEvents="box-none"
            style={[styles.mapPreviewWrap, { top: insets.top + 112 }]}
          >
            <View style={styles.mapPreviewCard}>
              <View style={styles.mapPreviewMediaWrap}>
                {selectedMapStore.image ? (
                  <AppImage
                    contentFit="cover"
                    style={styles.mapPreviewImage}
                    uri={selectedMapStore.image}
                  />
                ) : (
                  <View style={styles.mapPreviewImageFallback}>
                    <Text style={styles.mapPreviewImageFallbackText}>
                      {buildStoreInitial(selectedMapStore.name)}
                    </Text>
                  </View>
                )}
              </View>
              <View style={styles.mapPreviewBody}>
                <View style={styles.mapPreviewTopRow}>
                  <View style={styles.mapPreviewTitleBlock}>
                    <Text numberOfLines={1} style={styles.mapPreviewTitle}>
                      {selectedMapStore.name}
                    </Text>
                    <Text numberOfLines={1} style={styles.mapPreviewCategory}>
                      {selectedMapStore.category || "Store"}
                    </Text>
                  </View>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => setSelectedStoreId(null)}
                    style={styles.mapPreviewDismissButton}
                  >
                    <Ionicons color="#B8C2D9" name="close" size={16} />
                  </TouchableOpacity>
                </View>
                {selectedMapStore.address ? (
                  <Text numberOfLines={2} style={styles.mapPreviewAddress}>
                    {selectedMapStore.address}
                  </Text>
                ) : null}
                <View style={styles.mapPreviewFooter}>
                  <View style={styles.mapPreviewFooterSpacer} />
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => router.push(`/store/${selectedMapStore.id}`)}
                    style={styles.mapPreviewOpenButton}
                  >
                    <Text style={styles.mapPreviewOpenText}>Open store</Text>
                    <Ionicons
                      color="#0A0F1F"
                      name="chevron-forward"
                      size={14}
                    />
                  </TouchableOpacity>
                </View>
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
                  <Ionicons color="#F5F7FB" name="close" size={22} />
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
                inputRef={searchOverlayInputRef}
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
                placeholder="Search for food, groceries, electronics"
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
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                contentContainerStyle={styles.searchOverlayRecentList}
                removeClippedSubviews
                showsVerticalScrollIndicator={false}
              >
                {overlaySearchQuery.trim().length >= 2 && previewError ? (
                  <View style={styles.infoCard}>
                    <Text style={styles.infoCardTitle}>Search paused</Text>
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
                  groupedPreviewResults.map((item, index) => (
                    <SearchResultCard
                      key={item.key}
                      actionLabel="View"
                      animationIndex={index}
                      animationTriggerKey={previewResultsAnimationKey}
                      category={item.category}
                      distance={item.distance}
                      image={item.image}
                      onPress={() => {
                        setIsSearchOverlayOpen(false);
                        router.push(`/store/${item.storeId}`);
                      }}
                      primaryText={item.store}
                      secondaryText={item.productName || "Store match"}
                      style={styles.previewCard}
                      variants={item.variants.map<SearchResultCardVariant>(
                        (variant) => ({
                          key: variant.key,
                          label: variant.label,
                          value: variant.priceLabel,
                        }),
                      )}
                    />
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
                        <AppImage
                          contentFit="cover"
                          style={styles.storeRowImage}
                          uri={store.image_url}
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
                        Start exploring stores near you
                      </Text>
                      <Text style={styles.recentStoreSubtitle}>
                        Your recently interacted stores will appear here.
                      </Text>
                    </View>
                  </View>
                )}
              </ScrollView>
            </View>
          </View>
        ) : null}

        <Animated.View
          style={[
            styles.sheet,
            {
              height: sheetHeight,
              opacity: sheetEntranceOpacity,
              transform: [{ translateY: sheetTranslateY }],
            },
          ]}
        >
          <View {...sheetPanResponder.panHandlers} style={styles.sheetDragZone}>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => {
                const nextOffset = isSheetCollapsed ? 0 : maxSheetOffset;
                animateSheetPosition(nextOffset, {
                  manualCollapsed: nextOffset >= maxSheetOffset * 0.5,
                });
              }}
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
                onPress={() => {
                  animateSheetPosition(0, { manualCollapsed: false });
                  setIsSearchOverlayOpen(true);
                }}
                placeholder="Search for food, groceries, electronics"
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
                removeClippedSubviews
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
                          <AppImage
                            contentFit="cover"
                            style={styles.recentVisualImage}
                            uri={store.image_url}
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
                          Start exploring stores near you
                        </Text>
                        <Text style={styles.recentStoreSubtitle}>
                          Your recently interacted stores will appear here.
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
                    <>
                      <SavedStoreSkeleton />
                      <SavedStoreSkeleton />
                      <SavedStoreSkeleton />
                    </>
                  ) : storesError ? (
                    <View style={styles.infoCard}>
                      <Text style={styles.infoCardTitle}>
                        Stores are taking a moment
                      </Text>
                      <Text style={styles.infoCardText}>{storesError}</Text>
                    </View>
                  ) : nearbyStores.length > 0 ? (
                    nearbyStores.map((store, index) => (
                      <TouchableOpacity
                        key={`${store.id}-nearby-${index}`}
                        activeOpacity={0.85}
                        onPress={() => handleOpenStoreFromHomeList(store.id)}
                        style={[
                          styles.storeRowCard,
                          selectedStoreId === store.id
                            ? styles.storeRowCardSelected
                            : null,
                        ]}
                      >
                        {store.image ? (
                          <AppImage
                            contentFit="cover"
                            style={styles.storeRowImage}
                            uri={store.image}
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
                        Waiting for stores near you
                      </Text>
                      <Text style={styles.infoCardText}>
                        Stores are sorted by distance as soon as your location
                        is available.
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
                    <>
                      <SavedStoreSkeleton />
                      <SavedStoreSkeleton />
                      <SavedStoreSkeleton />
                    </>
                  ) : storesError ? (
                    <View style={styles.infoCard}>
                      <Text style={styles.infoCardTitle}>
                        Stores are taking a moment
                      </Text>
                      <Text style={styles.infoCardText}>{storesError}</Text>
                    </View>
                  ) : browseStores.length > 0 ? (
                    browseStores.map((store, index) => (
                      <TouchableOpacity
                        key={`${store.id}-${index}`}
                        activeOpacity={0.85}
                        onPress={() => handleOpenStoreFromHomeList(store.id)}
                        style={[
                          styles.storeRowCard,
                          selectedStoreId === store.id
                            ? styles.storeRowCardSelected
                            : null,
                        ]}
                      >
                        {store.image ? (
                          <AppImage
                            contentFit="cover"
                            style={styles.storeRowImage}
                            uri={store.image}
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
                        No stores available yet
                      </Text>
                      <Text style={styles.infoCardText}>
                        Public stores with valid map coordinates will appear
                        here automatically.
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.bottomSpacing} />
              </ScrollView>
            ) : null}
          </KeyboardAvoidingView>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "transparent",
  },
  container: {
    flex: 1,
    backgroundColor: "transparent",
  },
  mapArea: {
    ...StyleSheet.absoluteFillObject,
  },
  homeTopOverlay: {
    position: "absolute",
    left: 18,
    right: 18,
    zIndex: 60,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  homeMenuButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: theme.colors.surfaceCard,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: theme.colors.shadow,
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
    backgroundColor: "#F5F7FB",
  },
  homeMenuLineShort: {
    width: 14,
    height: 2.5,
    borderRadius: 999,
    backgroundColor: "#F5F7FB",
  },
  accountStatusChip: {
    minWidth: 132,
    maxWidth: 220,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: theme.colors.surfaceCard,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    alignItems: "center",
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
    zIndex: 58,
    alignItems: "center",
  },
  searchOverlayWrap: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 70,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingHorizontal: 18,
  },
  searchOverlayBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(7,11,24,0.76)",
  },
  searchOverlayCard: {
    width: "100%",
    maxWidth: 540,
    maxHeight: "72%",
    borderRadius: 30,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    backgroundColor: theme.colors.surfaceCard,
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 20,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.28,
    shadowRadius: 28,
    elevation: 18,
  },
  searchOverlayHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  searchOverlayTitle: {
    color: theme.colors.text,
    fontSize: 22,
    fontWeight: "800",
  },
  searchOverlayCloseButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(17,24,39,0.82)",
    borderWidth: 1,
    borderColor: theme.colors.borderSoft,
    opacity: 0.92,
  },
  searchOverlayLocationCard: {
    borderRadius: 30,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    backgroundColor: "rgba(19,29,49,0.9)",
    paddingHorizontal: 18,
    paddingVertical: 18,
    marginBottom: 18,
  },
  searchOverlayLocationEyebrow: {
    color: theme.colors.mutedText,
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
    backgroundColor: theme.colors.surfaceElevated,
  },
  searchOverlaySectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
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
    paddingBottom: 36,
  },
  mapPreviewCard: {
    width: "100%",
    maxWidth: 560,
    flexDirection: "row",
    overflow: "hidden",
    alignItems: "center",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: theme.colors.surfaceCard,
    shadowColor: "#0A0F1F",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.22,
    shadowRadius: 20,
    elevation: 8,
  },
  mapPreviewMediaWrap: {
    paddingLeft: 10,
    paddingVertical: 10,
  },
  mapPreviewImage: {
    width: 72,
    height: 72,
    borderRadius: 18,
  },
  mapPreviewImageFallback: {
    width: 72,
    height: 72,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  mapPreviewImageFallbackText: {
    color: "#F5F7FB",
    fontSize: 24,
    fontWeight: "800",
  },
  mapPreviewBody: {
    flex: 1,
    paddingLeft: 12,
    paddingRight: 12,
    paddingVertical: 12,
  },
  mapPreviewTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  mapPreviewTitleBlock: {
    flex: 1,
    gap: 3,
  },
  mapPreviewTitle: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  mapPreviewDismissButton: {
    width: 28,
    height: 28,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  mapPreviewCategory: {
    color: theme.colors.mutedText,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  mapPreviewAddress: {
    marginTop: 8,
    color: theme.colors.mutedText,
    fontSize: 12,
    lineHeight: 16,
  },
  mapPreviewFooter: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  mapPreviewFooterSpacer: {
    flex: 1,
  },
  mapPreviewOpenButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    height: 30,
    borderRadius: 999,
    backgroundColor: theme.colors.accent,
  },
  mapPreviewOpenText: {
    color: theme.colors.primaryTextOnAccent,
    fontSize: 12,
    fontWeight: "800",
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
    borderColor: theme.colors.borderStrong,
    backgroundColor: theme.colors.surfaceOverlay,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.22,
    shadowRadius: 24,
    elevation: 20,
  },
  sheetDragZone: {
    paddingTop: 6,
  },
  handleButton: {
    alignItems: "center",
  },
  handle: {
    alignSelf: "center",
    width: 48,
    height: 6,
    marginTop: 4,
    marginBottom: 8,
    borderRadius: 999,
    backgroundColor: theme.colors.borderStrong,
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
    borderColor: theme.colors.borderStrong,
    backgroundColor: "rgba(19,29,49,0.9)",
  },
  locationIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(74,136,255,0.24)",
  },
  locationButtonText: {
    color: theme.colors.subduedText,
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
    marginTop: 24,
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
    color: theme.colors.accentStrong,
    fontSize: 14,
    fontWeight: "700",
  },
  infoCard: {
    gap: 10,
    padding: 18,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceCard,
  },
  infoCardTitle: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: "800",
  },
  infoCardText: {
    color: theme.colors.mutedText,
    fontSize: 14,
    lineHeight: 22,
  },
  previewCard: {
    marginBottom: 2,
  },
  recentCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceCard,
  },
  recentVisualCard: {
    height: 152,
    overflow: "hidden",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: "rgba(19,29,49,0.9)",
  },
  recentVisualImage: {
    ...StyleSheet.absoluteFillObject,
  },
  recentVisualFallback: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(74,136,255,0.18)",
  },
  recentVisualFallbackText: {
    color: "#F5F7FB",
    fontSize: 34,
    fontWeight: "800",
  },
  recentVisualOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(10, 15, 31, 0.22)",
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
    backgroundColor: "rgba(20, 31, 54, 0.78)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  recentAvatarText: {
    color: "#F5F7FB",
    fontSize: 22,
    fontWeight: "800",
  },
  recentVisualFooter: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: 18,
    backgroundColor: "rgba(12, 18, 34, 0.68)",
  },
  recentStoreInfo: {
    gap: 2,
  },
  recentStoreTitle: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: "800",
  },
  recentStoreSubtitle: {
    color: theme.colors.subduedText,
    fontSize: 13,
  },
  storeRowCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceCard,
  },
  storeRowCardSelected: {
    borderColor: "rgba(120,163,255,0.32)",
    backgroundColor: "rgba(19,29,49,0.92)",
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
    backgroundColor: "rgba(74,136,255,0.16)",
  },
  storeRowImageFallbackText: {
    color: theme.colors.text,
    fontSize: 22,
    fontWeight: "800",
  },
  storeRowBody: {
    flex: 1,
    minWidth: 0,
    gap: 2,
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
    color: theme.colors.subduedText,
    fontSize: 13,
    fontWeight: "700",
  },
  storeRowAddress: {
    color: theme.colors.mutedText,
    fontSize: 12,
    lineHeight: 16,
  },
  bottomSpacing: {
    height: 24,
  },
});
