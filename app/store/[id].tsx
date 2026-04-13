import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  LayoutAnimation,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppImage, AppImageBackground } from "@/components/ui/app-image";
import { BackPillButton } from "@/components/ui/back-pill-button";
import { RemoteProductImage } from "@/components/ui/remote-product-image";
import { SearchInput } from "@/components/ui/search-input";
import {
  EmptyCard,
  ErrorCard,
  LoadingCard,
  SkeletonCard,
} from "@/components/ux-state";
import { theme } from "@/constants/theme";
import { prefetchImageUris } from "@/services/image-cache";
import { buildDirectionsUrl, parseCoordinate } from "@/services/map-links";
import { useMobileSession } from "@/services/mobile-session";
import { deleteProductWithBackend } from "@/services/product-api";
import {
  saveStore,
  trackRecentStoreVisit,
  unsaveStore,
  useSavedStores,
} from "@/services/saved-stores";
import { updateStoreWithBackend } from "@/services/store-api";
import {
  loadStoreProductsRecord,
  loadStoreRecord,
  toSavedStorePayload,
} from "@/services/store-data";

type StoreData = {
  id: string;
  storeName: string;
  isOpen: boolean;
  category: string;
  address: string;
  description: string;
  deliveryAvailable: boolean;
  deliveryTime: string;
  deliveryFee: string;
  phoneNumber: string;
  heroImage: string;
  latitude?: number | null;
  longitude?: number | null;
  photos: string[];
};

type ProductVariant = {
  id: string;
  label: string;
  price: number;
  inStock?: boolean;
  stockQuantity?: number;
  unitCount?: number;
};

type ProductGroup = {
  id: string;
  name: string;
  category: string;
  description: string;
  image: string;
  storeId: string;
  tags: string[];
  variants: ProductVariant[];
};

const STORE_PHOTO_LIMIT = 3;

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

function normalizeStorePhotos(
  photos: (string | null | undefined)[],
  fallback = "",
) {
  const normalized = photos
    .map((photo) => String(photo || "").trim())
    .filter(Boolean);

  if (fallback.trim()) {
    const primary = fallback.trim();
    return [primary, ...normalized.filter((photo) => photo !== primary)].slice(
      0,
      STORE_PHOTO_LIMIT,
    );
  }

  return normalized.slice(0, STORE_PHOTO_LIMIT);
}

function createEmptyStore(storeId: string): StoreData {
  return {
    address: "",
    category: "",
    description: "",
    deliveryAvailable: false,
    deliveryFee: "Delivery information unavailable",
    deliveryTime: "",
    heroImage: "",
    id: storeId,
    isOpen: true,
    latitude: null,
    longitude: null,
    phoneNumber: "",
    photos: [],
    storeName: "",
  };
}

function buildOwnerSessionStore(
  session: ReturnType<typeof useMobileSession>,
  storeId: string,
): StoreData | null {
  if (
    !session.isStoreOwner ||
    !session.primaryStoreId ||
    session.primaryStoreId !== storeId
  ) {
    return null;
  }

  const primaryImage = session.primaryStoreImageUrl || "";
  const photos = normalizeStorePhotos(
    primaryImage ? [primaryImage] : [],
    primaryImage,
  );

  return {
    address: session.primaryStoreAddress || "",
    category: session.primaryStoreCategory || "",
    description: "",
    deliveryAvailable: false,
    deliveryFee: "Delivery information unavailable",
    deliveryTime: "",
    heroImage: photos[0] || "",
    id: storeId,
    isOpen: true,
    latitude: session.primaryStoreLatitude,
    longitude: session.primaryStoreLongitude,
    phoneNumber: session.storePhoneNumber || "",
    photos,
    storeName: session.primaryStoreName || "",
  };
}

function buildInitialLabel(value: string, fallback = "S") {
  const trimmed = value.trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : fallback;
}

function formatCurrency(value: number) {
  return `₦${value.toLocaleString("en-NG")}`;
}

function buildPriceSummary(variants: ProductVariant[]) {
  const prices = variants.map((variant) => variant.price);

  if (prices.length === 0) {
    return "—";
  }

  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);

  return minPrice === maxPrice
    ? formatCurrency(minPrice)
    : `${formatCurrency(minPrice)} - ${formatCurrency(maxPrice)}`;
}

function formatUnitCountLabel(unitCount?: number) {
  const normalized =
    typeof unitCount === "number" && Number.isFinite(unitCount) && unitCount > 0
      ? unitCount
      : 1;

  return normalized > 1 ? `Pack of ${normalized}` : "Single";
}

function InfoRow({
  icon,
  label,
  value,
  hint,
  isEditable = false,
  isEditing = false,
  onChangeText,
  onPress,
  pressable = false,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  hint?: string;
  isEditable?: boolean;
  isEditing?: boolean;
  onChangeText?: (text: string) => void;
  onPress?: () => void;
  pressable?: boolean;
  children?: ReactNode;
}) {
  if (isEditing && isEditable) {
    return (
      <View style={styles.infoRow}>
        <View style={styles.infoIconWrap}>
          <Ionicons color={theme.colors.text} name={icon} size={18} />
        </View>
        <View style={styles.infoContent}>
          <Text style={styles.infoLabel}>{label}</Text>
          {children || (
            <TextInput
              style={styles.infoEditInput}
              placeholderTextColor="#7F8EAD"
              placeholder="Enter value"
              value={value}
              onChangeText={onChangeText}
            />
          )}
        </View>
      </View>
    );
  }

  const rowContent = (
    <>
      <View style={styles.infoIconWrap}>
        <Ionicons color={theme.colors.text} name={icon} size={20} />
      </View>
      <View style={styles.infoContent}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
        {hint ? <Text style={styles.infoHint}>{hint}</Text> : null}
      </View>
    </>
  );

  if (pressable && onPress) {
    return (
      <TouchableOpacity
        activeOpacity={0.82}
        onPress={onPress}
        style={[styles.infoRow, styles.infoRowPressable]}
      >
        {rowContent}
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.infoRow}>
      {rowContent}
    </View>
  );
}

function ProductCard({
  deletingProductId,
  askDisabled,
  isOwnerView,
  onDelete,
  onEdit,
  onOpenImage,
  product,
  onAsk,
}: {
  deletingProductId: string | null;
  askDisabled?: boolean;
  isOwnerView: boolean;
  onDelete: (product: ProductGroup) => void;
  onEdit: (product: ProductGroup) => void;
  onOpenImage: (imageUrl: string) => void;
  product: ProductGroup;
  onAsk: (product: ProductGroup, variant?: ProductVariant) => void;
}) {
  const [showVariants, setShowVariants] = useState(false);
  const priceSummary = buildPriceSummary(product.variants);
  const hasVariantChoices = product.variants.length > 1;
  const primaryVariant = product.variants[0];
  const singleVariantUnitLabel =
    !hasVariantChoices && primaryVariant
      ? formatUnitCountLabel(primaryVariant.unitCount)
      : null;

  return (
    <View style={styles.productCard}>
      <View style={styles.productTopRow}>
        {product.image ? (
          <TouchableOpacity
            activeOpacity={0.92}
            onPress={() => onOpenImage(product.image)}
          >
            <RemoteProductImage
              style={styles.productImage}
              uri={product.image}
            />
          </TouchableOpacity>
        ) : (
          <RemoteProductImage style={styles.productImage} />
        )}

        <View style={styles.productTopContent}>
          <View style={styles.productTopHeader}>
            <View style={styles.productTextWrap}>
              <Text style={styles.productName}>{product.name}</Text>
              <Text style={styles.productSubtitle}>
                {hasVariantChoices
                  ? `${product.variants.length} options`
                  : product.description || singleVariantUnitLabel || "Single price"}
              </Text>
            </View>

            <Text style={styles.productPriceSummary}>{priceSummary}</Text>
          </View>

          {isOwnerView ? (
            <View style={styles.ownerActionRow}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => onEdit(product)}
                style={styles.ownerSecondaryButton}
              >
                <Text style={styles.ownerSecondaryButtonText}>Edit</Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.85}
                disabled={deletingProductId === product.id}
                onPress={() => onDelete(product)}
                style={[
                  styles.ownerDangerButton,
                  deletingProductId === product.id &&
                    styles.ownerDisabledButton,
                ]}
              >
                <Text style={styles.ownerDangerButtonText}>
                  {deletingProductId === product.id ? "Deleting..." : "Delete"}
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      </View>

      {hasVariantChoices ? (
        <View style={styles.variantSection}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setShowVariants((current) => !current)}
            style={styles.variantToggle}
          >
            <Text style={styles.variantToggleText}>
              {showVariants ? "Hide options" : "Show options"}
            </Text>
          </TouchableOpacity>

          {showVariants ? (
            <View style={styles.variantList}>
              {product.variants.map((variant, index) => (
                <View
                  key={`${product.id}:${variant.id || variant.label || "variant"}:${index}`}
                  style={styles.variantRow}
                >
                  <View style={styles.variantTextWrap}>
                    <Text style={styles.variantProductName}>
                      {product.name}
                    </Text>
                    <Text style={styles.variantLabel}>
                      {variant.label || "Base price"}
                    </Text>
                  </View>

                  <View style={styles.variantActionWrap}>
                    <Text style={styles.variantPriceText}>
                      {formatCurrency(variant.price)}
                    </Text>
                    <Text style={styles.variantMetaText}>
                      {formatUnitCountLabel(variant.unitCount)}
                    </Text>
                    <TouchableOpacity
                      activeOpacity={0.85}
                      disabled={askDisabled}
                      onPress={() => onAsk(product, variant)}
                      style={[
                        styles.askButton,
                        askDisabled && styles.disabledActionButton,
                      ]}
                    >
                      <View style={styles.askButtonContent}>
                        <Ionicons
                          color="#E2EBFF"
                          name="chatbubble-ellipses-outline"
                          size={15}
                        />
                        <Text style={styles.askButtonMeta}>Ask about this</Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      ) : (
        <TouchableOpacity
          activeOpacity={0.85}
          disabled={askDisabled}
          onPress={() => onAsk(product, product.variants[0])}
          style={[
            styles.singleAskButton,
            askDisabled && styles.disabledActionButton,
          ]}
        >
          <View style={styles.askButtonContent}>
            <Ionicons
              color="#E2EBFF"
              name="chatbubble-ellipses-outline"
              size={16}
            />
            <Text style={styles.singleAskButtonText}>Chat store</Text>
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function StoreScreen() {
  const router = useRouter();
  const { id, preview } = useLocalSearchParams<{
    id: string;
    preview?: string;
  }>();
  const session = useMobileSession();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [isSaveSubmitting, setIsSaveSubmitting] = useState(false);
  const [isStoreLoading, setIsStoreLoading] = useState(true);
  const [isProductsLoading, setIsProductsLoading] = useState(true);
  const [storeError, setStoreError] = useState("");
  const [productsError, setProductsError] = useState("");
  const [ownerNotice, setOwnerNotice] = useState("");
  const [deletingProductId, setDeletingProductId] = useState<string | null>(
    null,
  );
  const [expandedImageUrl, setExpandedImageUrl] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [remoteStore, setRemoteStore] = useState<StoreData | null>(null);
  const [remoteProducts, setRemoteProducts] = useState<ProductGroup[]>([]);
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [isSavingInfo, setIsSavingInfo] = useState(false);
  const [editAddress, setEditAddress] = useState("");
  const [editDelivery, setEditDelivery] = useState(false);
  const [editContact, setEditContact] = useState("");
  const savedStores = useSavedStores();
  const routeStoreId = Array.isArray(id) ? id[0] || "" : id || "";
  const storeId = routeStoreId;
  const latestStoreLoadIdRef = useRef(0);
  const latestProductsLoadIdRef = useRef(0);

  const loadStoreData = useCallback(async () => {
    const loadId = latestStoreLoadIdRef.current + 1;
    latestStoreLoadIdRef.current = loadId;

    if (!storeId) {
      setStoreError("Store not found.");
      setRemoteStore(null);
      setIsStoreLoading(false);
      return;
    }

    setIsStoreLoading(true);
    setStoreError("");

    const result = await loadStoreRecord(String(storeId));

    if (latestStoreLoadIdRef.current !== loadId) {
      return;
    }

    if (!result.ok || !result.store) {
      setStoreError(result.error || "We couldn’t load this store right now.");
      setIsStoreLoading(false);
      setRemoteStore(null);
      return;
    }

    const nextStorePhotos = normalizeStorePhotos(
      result.store.headerImages,
      result.store.imageUrl || "",
    );
    const nextStore = {
      address: result.store.address || "",
      category: result.store.category || "",
      description: result.store.description || "",
      deliveryAvailable: result.store.deliveryAvailable,
      deliveryFee: "Delivery information unavailable",
      deliveryTime: "",
      heroImage: nextStorePhotos[0] || "",
      id: String(result.store.id),
      isOpen: true,
      latitude: result.store.latitude,
      longitude: result.store.longitude,
      phoneNumber: result.store.phoneNumber || "",
      photos: nextStorePhotos,
      storeName: result.store.storeName || "",
    };

    setRemoteStore(nextStore);
    setIsStoreLoading(false);
  }, [storeId]);

  const loadProductsData = useCallback(async () => {
    const loadId = latestProductsLoadIdRef.current + 1;
    latestProductsLoadIdRef.current = loadId;

    if (!storeId) {
      setProductsError("");
      setRemoteProducts([]);
      setIsProductsLoading(false);
      return;
    }

    setIsProductsLoading(true);
    setProductsError("");

    const result = await loadStoreProductsRecord(String(storeId), {
      forceRefresh: true,
    });

    if (latestProductsLoadIdRef.current !== loadId) {
      return;
    }

    if (!result.ok) {
      setProductsError(result.error || "We couldn’t load products right now.");
      setRemoteProducts([]);
      setIsProductsLoading(false);
      return;
    }

    setRemoteProducts(result.products);
    setIsProductsLoading(false);
  }, [storeId]);

  useEffect(() => {
    void loadStoreData();

    return () => {
      latestStoreLoadIdRef.current += 1;
    };
  }, [loadStoreData]);

  useEffect(() => {
    void loadProductsData();

    return () => {
      latestProductsLoadIdRef.current += 1;
    };
  }, [loadProductsData]);

  useFocusEffect(
    useCallback(() => {
      void loadProductsData();
    }, [loadProductsData]),
  );

  useEffect(() => {
    setSearchTerm("");
    setActiveFilters([]);
    setExpandedImageUrl(null);
    setOwnerNotice("");
  }, [storeId]);

  const categories = useMemo(() => {
    const unique = new Set<string>(["All"]);
    remoteProducts.forEach((product) => {
      if (product.category) {
        unique.add(product.category);
      }
      product.tags.forEach((tag) => {
        if (tag) {
          unique.add(tag);
        }
      });
    });
    return Array.from(unique);
  }, [remoteProducts]);

  const filteredProducts = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    const nextProducts = remoteProducts.filter((product) => {
      const productFilters = new Set(
        [product.category, ...product.tags]
          .map((value) => value.trim().toLowerCase())
          .filter(Boolean),
      );
      const matchesCategory =
        activeFilters.length === 0 ||
        activeFilters.every((filter) => productFilters.has(filter.toLowerCase()));
      const matchesSearch =
        !term ||
        product.name.toLowerCase().includes(term) ||
        product.description.toLowerCase().includes(term) ||
        product.category.toLowerCase().includes(term) ||
        product.tags.some((tag) => tag.toLowerCase().includes(term)) ||
        product.variants.some((variant) =>
          variant.label.toLowerCase().includes(term),
        );

      return matchesCategory && matchesSearch;
    });

    if (!term) {
      return nextProducts;
    }

    const scoreProduct = (product: ProductGroup) => {
      const name = product.name.toLowerCase();

      if (name === term) return 0;
      if (name.startsWith(term)) return 1;
      if (name.includes(term)) return 2;
      if (product.category.toLowerCase().includes(term)) return 3;
      if (product.tags.some((tag) => tag.toLowerCase().includes(term)))
        return 4;
      if (product.description.toLowerCase().includes(term)) return 5;
      return 6;
    };

    return [...nextProducts].sort(
      (left, right) => scoreProduct(left) - scoreProduct(right),
    );
  }, [activeFilters, remoteProducts, searchTerm]);

  const ownerSessionStore = useMemo(
    () => buildOwnerSessionStore(session, String(storeId)),
    [session, storeId],
  );
  const resolvedStore = useMemo(() => {
    const baseStore =
      session.isStoreOwner && session.primaryStoreId === storeId
        ? {
            ...(remoteStore ||
              ownerSessionStore ||
              createEmptyStore(String(storeId))),
            address:
              session.primaryStoreAddress ||
              remoteStore?.address ||
              ownerSessionStore?.address ||
              "",
            category:
              session.primaryStoreCategory ||
              remoteStore?.category ||
              ownerSessionStore?.category ||
              "",
            description:
              remoteStore?.description || ownerSessionStore?.description || "",
            deliveryAvailable: Boolean(
              remoteStore?.deliveryAvailable ??
              ownerSessionStore?.deliveryAvailable,
            ),
            phoneNumber:
              session.storePhoneNumber ||
              remoteStore?.phoneNumber ||
              ownerSessionStore?.phoneNumber ||
              "",
            latitude:
              remoteStore?.latitude ?? ownerSessionStore?.latitude ?? null,
            longitude:
              remoteStore?.longitude ?? ownerSessionStore?.longitude ?? null,
            storeName:
              session.primaryStoreName ||
              remoteStore?.storeName ||
              ownerSessionStore?.storeName ||
              "",
          }
        : remoteStore || ownerSessionStore || createEmptyStore(String(storeId));

    const photos = normalizeStorePhotos(
      [
        ...(session.isStoreOwner &&
        session.primaryStoreId === storeId &&
        session.primaryStoreImageUrl
          ? [session.primaryStoreImageUrl]
          : []),
        ...(baseStore.photos || []),
      ],
      session.isStoreOwner && session.primaryStoreId === storeId
        ? session.primaryStoreImageUrl || baseStore.heroImage || ""
        : baseStore.heroImage || "",
    );

    return {
      ...baseStore,
      heroImage: photos[0] || baseStore.heroImage || "",
      photos,
    };
  }, [
    ownerSessionStore,
    remoteStore,
    session.isStoreOwner,
    session.primaryStoreAddress,
    session.primaryStoreCategory,
    session.primaryStoreId,
    session.primaryStoreImageUrl,
    session.primaryStoreName,
    session.storePhoneNumber,
    storeId,
  ]);
  const isOwnerViewingStore =
    session.isStoreOwner &&
    session.primaryStoreId === String(storeId) &&
    preview !== "customer";
  const isPreviewingOwnStore =
    session.isStoreOwner &&
    session.primaryStoreId === String(storeId) &&
    preview === "customer";
  const hasActiveProductFilters =
    activeFilters.length > 0 || searchTerm.trim().length > 0;
  const renderedProducts = filteredProducts;
  const renderedProductCount = renderedProducts.length;
  const totalProductCount = remoteProducts.length;
  const showNoMatchingProductsState =
    !isProductsLoading &&
    !productsError &&
    totalProductCount > 0 &&
    renderedProductCount === 0;
  const showNoProductsState =
    !isProductsLoading && !productsError && totalProductCount === 0;
  const productCountText = hasActiveProductFilters
    ? `${renderedProductCount} of ${totalProductCount} items`
    : `${totalProductCount} items`;

  const openChat = (product?: ProductGroup, variant?: ProductVariant) => {
    if (isOwnerViewingStore || isPreviewingOwnStore) {
      return;
    }

    const params: Record<string, string> = {};

    if (product) {
      params.product = product.name;
      params.productId = product.id;
    }

    if (variant) {
      params.variant = variant.label;
      params.variantId = variant.id;
      params.price = String(variant.price);
    }

    router.push({
      pathname: "/chat/request/[storeId]",
      params: {
        storeName: resolvedStore.storeName || "Store",
        storeId,
        ...params,
      },
    });
  };

  const openStoreOnMap = () => {
    const latitude = parseCoordinate(resolvedStore.latitude);
    const longitude = parseCoordinate(resolvedStore.longitude);

    if (latitude === null || longitude === null) {
      Alert.alert(
        "Map unavailable",
        "This store does not have a pinned location yet.",
      );
      return;
    }

    router.push({
      pathname: "/(tabs)/home",
      params: {
        focusStore: String(storeId),
        lat: String(latitude),
        lng: String(longitude),
      },
    });
  };

  const openDirections = async () => {
    const directionsUrl = buildDirectionsUrl({
      label: resolvedStore.storeName || "Store",
      latitude: resolvedStore.latitude,
      longitude: resolvedStore.longitude,
    });

    if (!directionsUrl) {
      Alert.alert(
        "Directions unavailable",
        "This store does not have a pinned location yet.",
      );
      return;
    }

    try {
      const supported = await Linking.canOpenURL(directionsUrl);

      if (!supported) {
        Alert.alert(
          "Directions unavailable",
          "No maps app was available to open directions.",
        );
        return;
      }

      await Linking.openURL(directionsUrl);
    } catch {
      Alert.alert(
        "Directions unavailable",
        "Could not open directions right now.",
      );
    }
  };

  const openCustomerPreview = () => {
    router.push(`/store/${storeId}?preview=customer`);
  };

  const handleCategoryPress = (category: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setActiveFilters((current) => {
      if (category === "All") {
        return [];
      }

      if (current.includes(category)) {
        return current.filter((item) => item !== category);
      }

      return [...current, category];
    });
  };

  const handleCallStore = async () => {
    const phoneNumber = resolvedStore.phoneNumber.trim();

    if (!phoneNumber) {
      Alert.alert("Phone unavailable", "This store has no phone number yet.");
      return;
    }

    const phoneUrl = `tel:${phoneNumber.replace(/\s+/g, "")}`;

    try {
      const supported = await Linking.canOpenURL(phoneUrl);

      if (!supported) {
        Alert.alert(
          "Calling unavailable",
          "This device could not open the phone dialer.",
        );
        return;
      }

      await Linking.openURL(phoneUrl);
    } catch {
      Alert.alert("Calling unavailable", "Could not start a call right now.");
    }
  };

  const handleEditProduct = (product: ProductGroup) => {
    router.push(`/store/products/add?store=${storeId}&product=${product.id}`);
  };

  const handleDeleteProduct = async (product: ProductGroup) => {
    if (!session.authToken || deletingProductId) {
      return;
    }

    setDeletingProductId(product.id);
    setOwnerNotice("");

    const result = await deleteProductWithBackend(
      session.authToken,
      product.id,
    );

    if (!result.ok) {
      setOwnerNotice(result.error);
      setDeletingProductId(null);
      return;
    }

    setRemoteProducts((current) =>
      current.filter((item) => item.id !== product.id),
    );
    setOwnerNotice(result.message || "Product deleted successfully.");
    setDeletingProductId(null);
  };

  const handleSaveStoreInfo = async () => {
    if (!session.authToken || !storeId || isSavingInfo) {
      return;
    }

    setIsSavingInfo(true);
    setOwnerNotice("");

    const result = await updateStoreWithBackend(session.authToken, String(storeId), {
      address: editAddress.trim(),
      delivery_available: editDelivery,
      phone_number: editContact.trim(),
    });

    if (!result.ok || !result.store) {
      setOwnerNotice(result.error || "Could not update store info.");
      setIsSavingInfo(false);
      return;
    }

    setRemoteStore((current) =>
      current
        ? {
            ...current,
            address: result.store?.address || editAddress.trim(),
            deliveryAvailable: Boolean(result.store?.delivery_available),
            phoneNumber: result.store?.phone_number || editContact.trim(),
          }
        : current,
    );
    setOwnerNotice(result.message || "Store info updated.");
    setIsEditingInfo(false);
    setIsSavingInfo(false);
  };

  useEffect(() => {
    const numericStoreId = Number.parseInt(String(storeId), 10);

    if (!Number.isFinite(numericStoreId) || !session.isAuthenticated) {
      setSaved(false);
      return;
    }

    setSaved(savedStores.some((store) => store.store_id === numericStoreId));
  }, [savedStores, session.isAuthenticated, storeId]);

  useEffect(() => {
    const numericStoreId = Number.parseInt(String(storeId), 10);

    if (!Number.isFinite(numericStoreId) || !resolvedStore.storeName) {
      return;
    }

    void trackRecentStoreVisit({
      address: resolvedStore.address,
      category: resolvedStore.category,
      id: numericStoreId,
      image_url: resolvedStore.heroImage,
      phone_number: resolvedStore.phoneNumber,
      store_name: resolvedStore.storeName,
    });
  }, [
    resolvedStore.address,
    resolvedStore.category,
    resolvedStore.heroImage,
    resolvedStore.phoneNumber,
    resolvedStore.storeName,
    storeId,
  ]);

  useEffect(() => {
    void prefetchImageUris([
      resolvedStore.heroImage,
      expandedImageUrl,
      ...resolvedStore.photos.slice(0, STORE_PHOTO_LIMIT),
      ...filteredProducts.slice(0, 8).map((product) => product.image),
    ]);
  }, [expandedImageUrl, filteredProducts, resolvedStore.heroImage, resolvedStore.photos]);

  useEffect(() => {
    if (isEditingInfo) {
      setEditAddress(resolvedStore.address);
      setEditDelivery(resolvedStore.deliveryAvailable);
      setEditContact(resolvedStore.phoneNumber);
    }
  }, [
    isEditingInfo,
    resolvedStore.address,
    resolvedStore.deliveryAvailable,
    resolvedStore.phoneNumber,
  ]);

  return (
    <SafeAreaView edges={["top"]} style={styles.safeArea}>
      <StatusBar style="light" />

      {isStoreLoading && !remoteStore ? (
        <ScrollView
          bounces={false}
          contentContainerStyle={styles.contentContainer}
          removeClippedSubviews
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.pageShell}>
            <View style={styles.topBar}>
              <BackPillButton fallbackHref="/(tabs)/home" />
              <Text style={styles.topBarLabel}>Neara</Text>
            </View>
            <LoadingCard
              message="Loading store"
              detail="Fetching store details and products."
            />
            <View style={styles.skeletonStack}>
              <SkeletonCard height={320} />
              <SkeletonCard height={64} />
              <SkeletonCard height={132} />
              <SkeletonCard height={132} />
            </View>
          </View>
        </ScrollView>
      ) : storeError && !remoteStore ? (
        <ScrollView
          bounces={false}
          contentContainerStyle={styles.contentContainer}
          removeClippedSubviews
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.pageShell}>
            <View style={styles.topBar}>
              <BackPillButton fallbackHref="/(tabs)/home" />
              <Text style={styles.topBarLabel}>Neara</Text>
            </View>
            <ErrorCard
              title="Could not load this store"
              detail={storeError}
            />
          </View>
        </ScrollView>
      ) : (
        <ScrollView
          bounces={false}
          contentContainerStyle={styles.contentContainer}
          removeClippedSubviews
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.pageShell}>
            <View style={styles.topBar}>
              <BackPillButton fallbackHref="/(tabs)/home" />

              <Text style={styles.topBarLabel}>Neara</Text>
            </View>

            <View style={styles.heroCard}>
              <AppImageBackground
                contentFit="cover"
                imageStyle={styles.heroBackgroundImage}
                style={styles.heroBackground}
                uri={resolvedStore.heroImage}
              >
                <View style={styles.heroOverlay} />
                <LinearGradient
                  colors={[
                    "rgba(10,15,31,0.24)",
                    "rgba(10,15,31,0.5)",
                    "rgba(10,15,31,0.82)",
                    "rgba(10,15,31,0.94)",
                  ]}
                  locations={[0, 0.28, 0.72, 1]}
                  pointerEvents="none"
                  style={styles.heroGradientOverlay}
                />
                <View style={styles.heroContent}>
                  <View style={styles.heroHeaderBlock}>
                    <View style={styles.heroEyebrowRow}>
                      <Text style={styles.heroEyebrow}>Store</Text>
                    </View>

                    <View style={styles.heroTitleRow}>
                      <Text style={styles.heroTitle}>
                        {resolvedStore.storeName || "Store"}
                      </Text>
                    </View>

                    <View style={styles.heroMetaRow}>
                      <View
                        style={[
                          styles.statusPill,
                          resolvedStore.isOpen
                            ? styles.statusPillOpen
                            : styles.statusPillClosed,
                        ]}
                      >
                        <View
                          style={[
                            styles.statusDot,
                            resolvedStore.isOpen
                              ? styles.statusDotOpen
                              : styles.statusDotClosed,
                          ]}
                        />
                        <Text style={styles.statusPillText}>
                          {resolvedStore.isOpen ? "Open now" : "Closed"}
                        </Text>
                      </View>

                      {resolvedStore.deliveryTime ? (
                        <Text style={styles.deliveryTime}>
                          {resolvedStore.deliveryTime}
                        </Text>
                      ) : null}
                    </View>

                    {resolvedStore.category ? (
                      <Text style={styles.heroCategory}>
                        {resolvedStore.category}
                      </Text>
                    ) : null}
                    {resolvedStore.address ? (
                      <Text style={styles.heroAddress}>
                        {resolvedStore.address}
                      </Text>
                    ) : null}
                  </View>

                  <View style={styles.actionCard}>
                    <View style={styles.actionGrid}>
                      <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={
                          isOwnerViewingStore
                            ? openCustomerPreview
                            : async () => {
                                if (isPreviewingOwnStore) {
                                  return;
                                }
                                if (!session.isAuthenticated) {
                                  router.push("/login");
                                  return;
                                }

                                if (!session.authToken) {
                                  return;
                                }

                                const numericStoreId = Number.parseInt(
                                  String(storeId),
                                  10,
                                );

                                if (
                                  !Number.isFinite(numericStoreId) ||
                                  isSaveSubmitting
                                ) {
                                  return;
                                }

                                setIsSaveSubmitting(true);
                                setOwnerNotice("");

                                try {
                                  if (saved) {
                                    await unsaveStore(
                                      session.authToken,
                                      numericStoreId,
                                    );
                                    setSaved(false);
                                    setOwnerNotice("Removed from saved.");
                                  } else {
                                    const savedStorePayload = toSavedStorePayload({
                                      address: resolvedStore.address,
                                      category: resolvedStore.category,
                                      id: numericStoreId,
                                      imageUrl: resolvedStore.heroImage || null,
                                      name: resolvedStore.storeName || "Store",
                                      phoneNumber: resolvedStore.phoneNumber,
                                    });

                                    if (!savedStorePayload) {
                                      throw new Error("Could not save this store.");
                                    }

                                    await saveStore(session.authToken, savedStorePayload);
                                    setSaved(true);
                                    setOwnerNotice("Saved to your stores.");
                                  }
                                } catch (error) {
                                  setOwnerNotice(
                                    error instanceof Error
                                      ? error.message
                                      : saved
                                        ? "Could not remove this store."
                                        : "Could not save this store.",
                                  );
                                } finally {
                                  setIsSaveSubmitting(false);
                                }
                              }
                        }
                        style={[
                          styles.gridActionButton,
                          isOwnerViewingStore
                            ? styles.gridActionButtonPrimary
                            : isPreviewingOwnStore
                              ? styles.gridActionButtonSecondary
                              : saved
                                ? styles.gridActionButtonSaved
                                : styles.gridActionButtonSecondary,
                        ]}
                      >
                        <View style={styles.gridActionContent}>
                          <Ionicons
                            color={
                              isOwnerViewingStore
                                ? "#F7FAFF"
                                : saved
                                  ? "#D9E4FF"
                                  : theme.colors.text
                            }
                            name={
                              isOwnerViewingStore
                                ? "eye-outline"
                                : isPreviewingOwnStore
                                  ? "eye-outline"
                                  : saved
                                    ? "checkmark-circle"
                                    : "bookmark-outline"
                            }
                            size={18}
                          />
                          <Text
                            style={[
                              styles.gridActionButtonText,
                              isOwnerViewingStore &&
                                styles.gridActionButtonTextPrimary,
                              saved &&
                                !isOwnerViewingStore &&
                                styles.gridActionButtonTextSaved,
                            ]}
                          >
                            {isOwnerViewingStore
                              ? "Preview Store"
                              : isPreviewingOwnStore
                                ? "Previewing"
                                : saved && !isSaveSubmitting
                                  ? "Saved"
                                  : isSaveSubmitting
                                    ? saved
                                      ? "Unsaving..."
                                      : "Saving..."
                                    : "Save"}
                          </Text>
                        </View>
                      </TouchableOpacity>

                      <TouchableOpacity
                        activeOpacity={0.85}
                        disabled={isOwnerViewingStore || isPreviewingOwnStore}
                        onPress={() => openChat()}
                        style={[
                          styles.gridActionButton,
                          styles.gridActionButtonTertiary,
                          (isOwnerViewingStore || isPreviewingOwnStore) &&
                            styles.disabledActionButton,
                        ]}
                      >
                        <View style={styles.gridActionContent}>
                          <Ionicons
                            color={theme.colors.text}
                            name="chatbubble-outline"
                            size={17}
                          />
                          <Text style={styles.gridActionButtonText}>
                            Chat store
                          </Text>
                        </View>
                      </TouchableOpacity>

                      <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={openStoreOnMap}
                        style={[
                          styles.gridActionButton,
                          styles.gridActionButtonSecondary,
                        ]}
                      >
                        <Text style={styles.gridActionButtonText}>
                          View on Map
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() => void openDirections()}
                        style={[
                          styles.gridActionButton,
                          styles.gridActionButtonPrimary,
                        ]}
                      >
                        <Text style={styles.gridActionButtonTextPrimary}>
                          Get Directions
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {resolvedStore.description ? (
                    <View style={styles.descriptionCard}>
                      <Text style={styles.descriptionLabel}>
                        About this store
                      </Text>
                      <Text style={styles.descriptionText}>
                        {resolvedStore.description}
                      </Text>
                    </View>
                  ) : null}

                  <View style={styles.photosSection}>
                    <View style={styles.photosHeader}>
                      <Text style={styles.photosLabel}>Photos</Text>
                      {isOwnerViewingStore ? (
                        <TouchableOpacity
                          activeOpacity={0.85}
                          onPress={() =>
                            router.push(`/store/edit?store=${storeId}`)
                          }
                          style={styles.photosEditButton}
                        >
                          <Ionicons
                            color="#D9E4FF"
                            name="create-outline"
                            size={14}
                          />
                          <Text style={styles.photosEditButtonText}>
                            Edit Photos
                          </Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                    <View style={styles.photoGrid}>
                      {resolvedStore.photos.length > 0 ? (
                        <>
                          <TouchableOpacity
                            activeOpacity={0.92}
                            onPress={() =>
                              setExpandedImageUrl(resolvedStore.photos[0])
                            }
                            style={styles.primaryPhotoCard}
                          >
                            <AppImage
                              contentFit="cover"
                              style={[
                                styles.headerPhoto,
                                styles.headerPhotoLarge,
                              ]}
                              uri={resolvedStore.photos[0]}
                            />
                          </TouchableOpacity>

                          {resolvedStore.photos.length > 1 ? (
                            <View style={styles.secondaryPhotoRow}>
                              {resolvedStore.photos
                                .slice(1, 3)
                                .map((photo, index) => (
                                  <TouchableOpacity
                                    activeOpacity={0.92}
                                    key={`${photo}-${index + 1}`}
                                    onPress={() => setExpandedImageUrl(photo)}
                                    style={styles.secondaryPhotoCard}
                                  >
                                    <AppImage
                                      contentFit="cover"
                                      style={[
                                        styles.headerPhoto,
                                        styles.headerPhotoSmall,
                                      ]}
                                      uri={photo}
                                    />
                                  </TouchableOpacity>
                                ))}
                            </View>
                          ) : null}
                        </>
                      ) : (
                        <View
                          style={[
                            styles.headerPhoto,
                            styles.headerPhotoLarge,
                            styles.headerPhotoFallback,
                          ]}
                        >
                          <Text style={styles.headerPhotoFallbackText}>
                            {buildInitialLabel(resolvedStore.storeName)}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              </AppImageBackground>
            </View>

            <View style={styles.searchSection}>
              <SearchInput
                onChangeText={setSearchTerm}
                placeholder="Search this store"
                value={searchTerm}
              />

              <ScrollView
                horizontal
                contentContainerStyle={styles.categoryWrap}
                showsHorizontalScrollIndicator={false}
              >
                {categories.map((category, index) => {
                  const active =
                    category === "All"
                      ? activeFilters.length === 0
                      : activeFilters.includes(category);

                  return (
                    <TouchableOpacity
                      key={`category:${category || "all"}:${index}`}
                      activeOpacity={0.85}
                      onPress={() => handleCategoryPress(category)}
                      style={[
                        styles.categoryChip,
                        active && styles.categoryChipActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.categoryChipText,
                          active && styles.categoryChipTextActive,
                        ]}
                      >
                        {category}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionHeaderText}>
                  <Text style={styles.sectionTitle}>Products</Text>
                  <Text style={styles.sectionSubtitle}>
                    {productCountText}
                  </Text>
                </View>
                <View style={styles.sectionHeaderActions}>
                  {isOwnerViewingStore ? (
                    <>
                      <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() =>
                          router.push(`/store/edit?store=${storeId}`)
                        }
                        style={styles.ownerManageButton}
                      >
                        <Text style={styles.ownerManageButtonText}>
                          Edit Store
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() =>
                          router.push(`/store/products/add?store=${storeId}`)
                        }
                        style={styles.addProductButton}
                      >
                        <Text style={styles.addProductButtonText}>
                          Add Product
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() =>
                          router.push(`/store/products/import?store=${storeId}`)
                        }
                        style={styles.ownerManageButton}
                      >
                        <Text style={styles.ownerManageButtonText}>
                          Import CSV
                        </Text>
                      </TouchableOpacity>
                    </>
                  ) : null}
                </View>
              </View>

              <View style={styles.productList}>
                {ownerNotice ? (
                  <View style={styles.ownerNoticeCard}>
                    <Text style={styles.ownerNoticeText}>{ownerNotice}</Text>
                  </View>
                ) : null}
                {isProductsLoading ? (
                  <View style={styles.skeletonStack}>
                    <SkeletonCard height={132} />
                    <SkeletonCard height={132} />
                  </View>
                ) : productsError ? (
                  <ErrorCard
                    title="Could not load products"
                    detail={productsError}
                  />
                ) : renderedProductCount > 0 ? (
                  renderedProducts.map((product, index) => (
                    <ProductCard
                      deletingProductId={deletingProductId}
                      askDisabled={isOwnerViewingStore || isPreviewingOwnStore}
                      isOwnerView={isOwnerViewingStore}
                      key={`product:${product.id || product.name}:${index}`}
                      onAsk={openChat}
                      onDelete={handleDeleteProduct}
                      onEdit={handleEditProduct}
                      onOpenImage={setExpandedImageUrl}
                      product={product}
                    />
                  ))
                ) : showNoMatchingProductsState ? (
                  <EmptyCard
                    title="No products found"
                    detail="Try a different search term or remove a filter."
                  />
                ) : showNoProductsState ? (
                  <EmptyCard
                    title="No products yet"
                    detail="This store has not added any products yet. Start a chat to ask what is currently available."
                  />
                ) : null}
              </View>
            </View>

            <View style={styles.infoSection}>
              <View style={styles.infoSectionHeader}>
                <Text style={styles.infoSectionTitle}>Store info</Text>
                {isOwnerViewingStore ? (
                  <TouchableOpacity
                    activeOpacity={0.85}
                    disabled={isSavingInfo}
                    onPress={() => {
                      if (isEditingInfo) {
                        void handleSaveStoreInfo();
                      } else {
                        setOwnerNotice("");
                        setIsEditingInfo(true);
                      }
                    }}
                    style={styles.infoEditToggle}
                  >
                    <Text style={styles.infoEditToggleText}>
                      {isEditingInfo
                        ? isSavingInfo
                          ? "Saving..."
                          : "Done"
                        : "Edit"}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              <InfoRow
                icon="location-outline"
                label="Address"
                value={
                  isEditingInfo
                    ? editAddress
                    : resolvedStore.address || "Not available"
                }
                isEditable={isOwnerViewingStore}
                isEditing={isEditingInfo}
                onChangeText={setEditAddress}
              />
              <InfoRow
                icon="bicycle-outline"
                label="Delivery"
                value={
                  isEditingInfo
                    ? editDelivery
                      ? "Yes"
                      : "No"
                    : resolvedStore.deliveryAvailable
                      ? "Yes"
                      : "No"
                }
                hint={
                  isEditingInfo
                    ? editDelivery
                      ? "Delivery available"
                      : "Pickup only"
                    : resolvedStore.deliveryAvailable
                      ? "Delivery available"
                      : "Pickup only"
                }
                isEditable={isOwnerViewingStore}
                isEditing={isEditingInfo}
              >
                {isEditingInfo && (
                  <View style={styles.infoDeliveryPickerWrap}>
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() => setEditDelivery(!editDelivery)}
                      style={[
                        styles.infoDeliveryOption,
                        editDelivery && styles.infoDeliveryOptionActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.infoDeliveryOptionText,
                          editDelivery && styles.infoDeliveryOptionTextActive,
                        ]}
                      >
                        Yes
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() => setEditDelivery(false)}
                      style={[
                        styles.infoDeliveryOption,
                        !editDelivery && styles.infoDeliveryOptionActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.infoDeliveryOptionText,
                          !editDelivery && styles.infoDeliveryOptionTextActive,
                        ]}
                      >
                        No
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </InfoRow>
              <InfoRow
                icon="call-outline"
                label="Contact"
                value={
                  isEditingInfo
                    ? editContact
                    : resolvedStore.phoneNumber || "Not available"
                }
                hint={
                  !isEditingInfo && resolvedStore.phoneNumber
                    ? "Tap to call"
                    : undefined
                }
                isEditable={isOwnerViewingStore}
                isEditing={isEditingInfo}
                onChangeText={setEditContact}
                onPress={!isEditingInfo ? () => void handleCallStore() : undefined}
                pressable={!isEditingInfo && Boolean(resolvedStore.phoneNumber)}
              />
            </View>

            <Text style={styles.routeNote}>Store ID: {storeId}</Text>
          </View>
        </ScrollView>
      )}

      {!isOwnerViewingStore && !isPreviewingOwnStore ? (
        <View pointerEvents="box-none" style={styles.stickyCtaWrap}>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => openChat()}
            style={styles.stickyCtaButton}
          >
            <Ionicons color="#F7FAFF" name="chatbubble-ellipses" size={18} />
            <Text style={styles.stickyCtaButtonText}>Chat store</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <Modal
        animationType="none"
        onRequestClose={() => setExpandedImageUrl(null)}
        transparent
        visible={Boolean(expandedImageUrl)}
      >
        <View style={styles.imageModalBackdrop}>
          <Pressable
            onPress={() => setExpandedImageUrl(null)}
            style={styles.imageModalBackdropPressable}
          />
          <View style={styles.imageModalCard}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setExpandedImageUrl(null)}
              style={styles.imageModalCloseButton}
            >
              <Ionicons color="#E8EEF8" name="close" size={20} />
            </TouchableOpacity>

            {expandedImageUrl ? (
              <AppImage
                contentFit="contain"
                style={styles.imageModalImage}
                uri={expandedImageUrl}
              />
            ) : null}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const BORDER = "rgba(255,255,255,0.08)";

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "transparent",
  },
  contentContainer: {
    paddingTop: 6,
    paddingBottom: 120,
  },
  skeletonStack: {
    gap: 12,
    marginTop: 16,
  },
  pageShell: {
    paddingHorizontal: theme.spacing.screenHorizontal,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  topBarLabel: {
    color: theme.colors.mutedText,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  heroCard: {
    overflow: "hidden",
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: theme.colors.surfaceCard,
    marginBottom: 20,
  },
  heroBackground: {
    minHeight: 520,
  },
  heroBackgroundImage: {
    resizeMode: "cover",
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(17, 24, 39, 0.24)",
  },
  heroGradientOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  heroContent: {
    padding: 22,
    gap: 18,
  },
  heroHeaderBlock: {
    gap: 10,
  },
  heroEyebrowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  heroEyebrow: {
    color: "#B8C2D9",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  heroTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
  },
  heroTitle: {
    color: theme.colors.text,
    fontSize: 30,
    fontWeight: "800",
    lineHeight: 34,
    textShadowColor: "rgba(20, 53, 90, 0.34)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },
  heroMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  statusPillOpen: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
  },
  statusPillClosed: {
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  statusDotOpen: {
    backgroundColor: "#4A88FF",
  },
  statusDotClosed: {
    backgroundColor: "#B8C2D9",
  },
  statusPillText: {
    color: "#E8EEF8",
    fontSize: 12,
    fontWeight: "700",
  },
  deliveryTime: {
    color: "#C7D2E5",
    fontSize: 14,
  },
  heroCategory: {
    color: "#C7D2E5",
    fontSize: 15,
    fontWeight: "600",
  },
  heroAddress: {
    color: "#C7D2E5",
    fontSize: 14,
    lineHeight: 21,
    maxWidth: 540,
    textShadowColor: "rgba(10,15,31,0.6)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  actionCard: {
    gap: 12,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: theme.colors.surfaceOverlay,
    padding: 16,
  },
  actionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  gridActionButton: {
    width: "48%",
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  gridActionButtonPrimary: {
    borderColor: "rgba(74,136,255,0.58)",
    backgroundColor: "rgba(86, 188, 255, 0.30)",
    shadowColor: "#1F56E5",
    shadowOpacity: 0.2,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  gridActionButtonSecondary: {
    borderColor: "rgba(255,255,255,0.11)",
    backgroundColor: "rgba(255,255,255,0.10)",
  },
  gridActionButtonSaved: {
    borderColor: "rgba(74,136,255,0.28)",
    backgroundColor: "rgba(74,136,255,0.16)",
  },
  gridActionButtonTertiary: {
    borderColor: "rgba(74,136,255,0.28)",
    backgroundColor: "rgba(95, 199, 255, 0.22)",
    shadowColor: "#2F6BFF",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  gridActionContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  gridActionButtonText: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: "800",
    textAlign: "center",
  },
  gridActionButtonTextSaved: {
    color: "#D9E4FF",
  },
  gridActionButtonTextPrimary: {
    color: "#F7FAFF",
    fontSize: 14,
    fontWeight: "800",
    textAlign: "center",
  },
  disabledActionButton: {
    opacity: 0.45,
  },
  photosSection: {
    gap: 12,
  },
  photosHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  photosLabel: {
    color: "#B8C2D9",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },
  photosEditButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(74,136,255,0.2)",
    backgroundColor: "rgba(74,136,255,0.12)",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  photosEditButtonText: {
    color: "#D9E4FF",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  photoGrid: {
    gap: 12,
  },
  primaryPhotoCard: {
    width: "100%",
  },
  secondaryPhotoRow: {
    flexDirection: "row",
    gap: 12,
  },
  secondaryPhotoCard: {
    flex: 1,
  },
  headerPhoto: {
    width: "100%",
    borderRadius: 20,
  },
  headerPhotoFallback: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(74,136,255,0.14)",
  },
  headerPhotoFallbackText: {
    color: theme.colors.text,
    fontSize: 32,
    fontWeight: "700",
  },
  headerPhotoLarge: {
    height: 184,
  },
  headerPhotoSmall: {
    height: 136,
  },
  searchSection: {
    marginTop: 20,
    marginBottom: 16,
    gap: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(30, 41, 59, 0.95)",
    paddingBottom: 16,
  },
  categoryWrap: {
    flexDirection: "row",
    flexWrap: "nowrap",
    gap: 8,
  },
  categoryChip: {
    borderRadius: 999,
    backgroundColor: theme.colors.surfaceCard,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  categoryChipActive: {
    backgroundColor: "#2F6BFF",
    borderColor: "#4A88FF",
    shadowColor: "#4A88FF",
    shadowOpacity: 0.36,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
    transform: [{ scale: 1.02 }],
  },
  categoryChipText: {
    color: "#E8EEF8",
    fontSize: 12,
    fontWeight: "700",
  },
  categoryChipTextActive: {
    color: "#F5F7FB",
  },
  section: {
    marginBottom: 24,
    paddingTop: 0,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 16,
    gap: 16,
  },
  sectionHeaderText: {
    gap: 4,
  },
  sectionHeaderActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 10,
    justifyContent: "flex-end",
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: "800",
  },
  sectionSubtitle: {
    color: theme.colors.mutedText,
    fontSize: 14,
    fontWeight: "600",
  },
  productList: {
    gap: 12,
  },
  ownerNoticeCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(120,163,255,0.18)",
    backgroundColor: "rgba(74,136,255,0.08)",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  ownerNoticeText: {
    color: "#dff5ff",
    fontSize: 13,
    fontWeight: "600",
  },
  productCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: theme.colors.surfaceCard,
    padding: 20,
    gap: 16,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: {
      height: 6,
      width: 0,
    },
    shadowOpacity: 0.18,
    shadowRadius: 12,
  },
  productTopRow: {
    flexDirection: "row",
    gap: 12,
  },
  productImage: {
    width: 84,
    height: 84,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  productImageFallback: {
    width: 84,
    height: 84,
    borderRadius: 16,
    backgroundColor: "rgba(74,136,255,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  productImageFallbackText: {
    color: theme.colors.text,
    fontSize: 28,
    fontWeight: "700",
  },
  imageModalBackdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  imageModalBackdropPressable: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.surfaceOverlay,
  },
  imageModalCard: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(17,24,39,0.96)",
    overflow: "hidden",
    padding: 18,
  },
  imageModalCloseButton: {
    alignSelf: "flex-end",
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    marginBottom: 8,
  },
  imageModalImage: {
    width: "100%",
    height: 360,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  productTopContent: {
    flex: 1,
    gap: 8,
  },
  productTopHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  productTextWrap: {
    flex: 1,
    gap: 4,
  },
  productName: {
    color: "#F5F7FB",
    fontSize: 15,
    fontWeight: "800",
  },
  productSubtitle: {
    color: "#B8C2D9",
    fontSize: 12,
  },
  productPriceSummary: {
    color: "#F5F7FB",
    fontSize: 14,
    fontWeight: "800",
  },
  ownerActionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  ownerSecondaryButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "rgba(255,255,255,0.05)",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  ownerSecondaryButtonText: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: "700",
  },
  ownerDangerButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(248,113,113,0.24)",
    backgroundColor: "rgba(17,24,39,0.22)",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  ownerDangerButtonText: {
    color: "#E2EBFF",
    fontSize: 12,
    fontWeight: "700",
  },
  ownerDisabledButton: {
    opacity: 0.65,
  },
  variantSection: {
    gap: 12,
  },
  variantToggle: {
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.05)",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  variantToggleText: {
    color: "#F5F7FB",
    fontSize: 14,
    fontWeight: "500",
  },
  variantList: {
    gap: 8,
  },
  variantRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(7, 13, 27, 0.72)",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  variantTextWrap: {
    flex: 1,
    gap: 4,
  },
  variantProductName: {
    color: "#F5F7FB",
    fontSize: 14,
    fontWeight: "500",
  },
  variantLabel: {
    color: "#B8C2D9",
    fontSize: 12,
  },
  variantActionWrap: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    marginLeft: 12,
  },
  variantPriceText: {
    color: "#cbe8ff",
    fontSize: 14,
    fontWeight: "600",
  },
  variantMetaText: {
    color: "#B8C2D9",
    fontSize: 12,
    fontWeight: "600",
  },
  askButton: {
    alignItems: "center",
    justifyContent: "center",
    minWidth: 132,
    minHeight: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(74,136,255,0.28)",
    backgroundColor: "rgba(74,136,255,0.14)",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  askButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  askButtonMeta: {
    color: "#E2EBFF",
    fontSize: 13,
    fontWeight: "700",
  },
  singleAskButton: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(74,136,255,0.28)",
    backgroundColor: "rgba(74,136,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  singleAskButtonText: {
    color: "#E2EBFF",
    fontSize: 14,
    fontWeight: "700",
  },
  addProductButton: {
    borderRadius: 999,
    backgroundColor: theme.colors.accent,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  ownerManageButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "rgba(255,255,255,0.05)",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  ownerManageButtonText: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: "800",
  },
  addProductButtonText: {
    color: "#F5F7FB",
    fontSize: 12,
    fontWeight: "800",
  },
  emptyState: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: "rgba(17,24,39,0.6)",
    padding: 20,
    gap: 8,
  },
  emptyStateTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: "700",
  },
  emptyStateBody: {
    color: theme.colors.mutedText,
    fontSize: 14,
    lineHeight: 20,
  },
  infoSection: {
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.05)",
    paddingTop: 24,
  },
  infoSectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  infoSectionTitle: {
    color: theme.colors.mutedText,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },
  infoEditToggle: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(74,136,255,0.2)",
    backgroundColor: "rgba(74,136,255,0.1)",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  infoEditToggleText: {
    color: "#E2EBFF",
    fontSize: 11,
    fontWeight: "700",
  },
  infoRow: {
    flexDirection: "row",
    gap: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(16, 26, 46, 0.9)",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  infoRowPressable: {
    shadowColor: "#4A88FF",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  infoIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(10,15,31,1)",
    alignItems: "center",
    justifyContent: "center",
  },
  infoContent: {
    flex: 1,
    gap: 4,
  },
  infoLabel: {
    color: "#B8C2D9",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  infoEditInput: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: "500",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(74,136,255,0.3)",
    backgroundColor: "rgba(74,136,255,0.08)",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  infoDeliveryPickerWrap: {
    flexDirection: "row",
    gap: 8,
  },
  infoDeliveryOption: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(255,255,255,0.05)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: "center",
  },
  infoDeliveryOptionActive: {
    borderColor: "rgba(74,136,255,0.4)",
    backgroundColor: "rgba(74,136,255,0.15)",
  },
  infoDeliveryOptionText: {
    color: "#B8C2D9",
    fontSize: 13,
    fontWeight: "600",
  },
  infoDeliveryOptionTextActive: {
    color: "#E2EBFF",
  },
  infoValue: {
    color: "#F5F7FB",
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
  },
  infoHint: {
    color: "#B8C2D9",
    fontSize: 13,
  },
  descriptionCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(8, 17, 32, 0.62)",
    padding: 16,
    gap: 8,
  },
  descriptionLabel: {
    color: "#B8C2D9",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  descriptionText: {
    color: "#E8EEF8",
    fontSize: 14,
    lineHeight: 22,
  },
  routeNote: {
    marginTop: 20,
    color: "#667892",
    fontSize: 12,
    textAlign: "center",
  },
  stickyCtaWrap: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 18,
  },
  stickyCtaButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    minHeight: 54,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(74,136,255,0.52)",
    backgroundColor: "rgba(3, 105, 161, 0.96)",
    shadowColor: "#1F56E5",
    shadowOpacity: 0.24,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 7,
  },
  stickyCtaButtonText: {
    color: "#F7FAFF",
    fontSize: 15,
    fontWeight: "800",
  },
});
