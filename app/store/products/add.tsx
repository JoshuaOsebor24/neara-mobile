import { BackPillButton } from "@/components/ui/back-pill-button";
import { Button } from "@/components/ui/button";
import {
  MAIN_CATEGORY_OPTIONS,
  normalizeCommaSeparatedValues,
  TAG_OPTIONS,
  type MainCategoryOption,
  type ProductTagOption,
} from "@/constants/product-taxonomy";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppImage } from "@/components/ui/app-image";
import { theme } from "@/constants/theme";
import { showFlashFeedback } from "@/services/flash-feedback";
import { useMobileSession } from "@/services/mobile-session";
import {
  createProductWithBackend,
  updateProductWithBackend,
} from "@/services/product-api";
import {
  loadStoreDetailRecord,
  type StoreProductRecord,
} from "@/services/store-data";

type SaveMode = "edit-next" | "start-new" | "update";

type Notice = {
  type: "success" | "error";
  message: string;
} | null;

type VariantDraft = {
  id: string;
  variantName: string;
  price: string;
  quantity: string;
};

type LastAddedProduct = {
  productId?: string;
  storeId: string;
  productName: string;
  price: string;
  mainCategory: string;
  customMainCategory: string;
  tags: string[];
  customTags: string;
  description: string;
  imageUrl: string;
  variants: VariantDraft[];
};

function createVariantId() {
  return `variant-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function cloneVariants(variants: VariantDraft[]) {
  return variants.map((variant) => ({
    ...variant,
    id: createVariantId(),
  }));
}

function buildSelectedImageValue(asset: ImagePicker.ImagePickerAsset) {
  if (asset.base64) {
    const mimeType = asset.mimeType || "image/jpeg";
    return `data:${mimeType};base64,${asset.base64}`;
  }

  return asset.uri;
}

function VariantRows({
  disabled,
  onAdd,
  onChange,
  onRemove,
  variants,
}: {
  disabled: boolean;
  onAdd: () => void;
  onChange: (
    id: string,
    field: "variantName" | "price" | "quantity",
    value: string,
  ) => void;
  onRemove: (id: string) => void;
  variants: VariantDraft[];
}) {
  return (
    <View style={styles.variantPanel}>
      <View style={styles.variantHeader}>
        <View>
          <Text style={styles.variantTitle}>Variants</Text>
          <Text style={styles.variantSubtitle}>
            Add sizes or options that change the price.
          </Text>
        </View>
        <TouchableOpacity
          activeOpacity={0.85}
          disabled={disabled}
          onPress={onAdd}
          style={styles.variantAddButton}
        >
          <Text style={styles.variantAddButtonText}>Add Variant</Text>
        </TouchableOpacity>
      </View>

      {variants.length === 0 ? (
        <View style={styles.variantEmpty}>
          <Text style={styles.variantEmptyText}>
            No variants yet. Use the base price for simple products.
          </Text>
        </View>
      ) : (
        <View style={styles.variantList}>
          {variants.map((variant, index) => (
            <View key={variant.id} style={styles.variantCard}>
              <View style={styles.variantCardHeader}>
                <Text style={styles.variantCardTitle}>Variant {index + 1}</Text>
                <TouchableOpacity
                  activeOpacity={0.85}
                  disabled={disabled}
                  onPress={() => onRemove(variant.id)}
                  style={styles.variantRemoveButton}
                >
                  <Text style={styles.variantRemoveButtonText}>Remove</Text>
                </TouchableOpacity>
              </View>

              <TextInput
                editable={!disabled}
                onChangeText={(value) =>
                  onChange(variant.id, "variantName", value)
                }
                placeholder="Variant name"
                placeholderTextColor={theme.colors.mutedText}
                style={styles.input}
                value={variant.variantName}
              />

              <View style={styles.variantRow}>
                <TextInput
                  editable={!disabled}
                  keyboardType="decimal-pad"
                  onChangeText={(value) => onChange(variant.id, "price", value)}
                  placeholder="Price"
                  placeholderTextColor={theme.colors.mutedText}
                  style={[styles.input, styles.variantHalf]}
                  value={variant.price}
                />

                <TextInput
                  editable={!disabled}
                  keyboardType="number-pad"
                  onChangeText={(value) =>
                    onChange(variant.id, "quantity", value)
                  }
                  placeholder="Quantity"
                  placeholderTextColor={theme.colors.mutedText}
                  style={[styles.input, styles.variantHalf]}
                  value={variant.quantity}
                />
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

export default function AddStoreProductScreen() {
  const router = useRouter();
  const session = useMobileSession();
  const params = useLocalSearchParams<{ store?: string; product?: string }>();
  const storeOptions = useMemo(() => {
    if (!session.isStoreOwner || !session.primaryStoreId) {
      return [];
    }

    return [
      {
        id: session.primaryStoreId,
        store_name: session.primaryStoreName || "Your store",
        address: session.primaryStoreAddress || "",
        category: session.primaryStoreCategory || "",
      },
    ];
  }, [
    session.isStoreOwner,
    session.primaryStoreAddress,
    session.primaryStoreCategory,
    session.primaryStoreId,
    session.primaryStoreName,
  ]);
  const preferredStoreId =
    storeOptions.find((store) => store.id === params.store)?.id ||
    session.primaryStoreId ||
    storeOptions[0]?.id ||
    "";
  const editingProductId = params.product || "";
  const isEditing = Boolean(editingProductId);

  const [selectedStoreId, setSelectedStoreId] = useState(preferredStoreId);
  const [productName, setProductName] = useState("");
  const [price, setPrice] = useState("");
  const [selectedMainCategory, setSelectedMainCategory] = useState("");
  const [customMainCategory, setCustomMainCategory] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [customTags, setCustomTags] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [variants, setVariants] = useState<VariantDraft[]>([]);
  const [notice, setNotice] = useState<Notice>(null);
  const [submitMode, setSubmitMode] = useState<SaveMode | null>(null);
  const [isLoadingProduct, setIsLoadingProduct] = useState(isEditing);
  const [isPickingImage, setIsPickingImage] = useState(false);
  const [lastAddedProduct, setLastAddedProduct] =
    useState<LastAddedProduct | null>(null);

  const selectedStore = useMemo(
    () => storeOptions.find((store) => store.id === selectedStoreId) ?? null,
    [selectedStoreId, storeOptions],
  );

  const isSubmitting = submitMode !== null;
  const canDuplicate = Boolean(lastAddedProduct) && !isEditing;

  useEffect(() => {
    if (session.isAuthenticated && session.isStoreOwner) {
      return;
    }

    router.replace(!session.isAuthenticated ? "/login" : "/store-mode");
  }, [router, session.isAuthenticated, session.isStoreOwner]);

  useEffect(() => {
    let cancelled = false;

    async function loadEditingProduct() {
      if (!isEditing || !preferredStoreId) {
        return;
      }

      setIsLoadingProduct(true);
      const result = await loadStoreDetailRecord(preferredStoreId);

      if (cancelled) {
        return;
      }

      if (!result.ok) {
        setNotice({
          type: "error",
          message: result.error,
        });
        setIsLoadingProduct(false);
        return;
      }

      const matchedProduct = result.products.find(
        (product) => product.id === editingProductId,
      );

      if (!matchedProduct) {
        setNotice({
          type: "error",
          message: "We couldn't find that product.",
        });
        setIsLoadingProduct(false);
        return;
      }

      hydrateFormFromProduct(matchedProduct, preferredStoreId);
      setIsLoadingProduct(false);
    }

    void loadEditingProduct();

    return () => {
      cancelled = true;
    };
  }, [editingProductId, isEditing, preferredStoreId]);

  if (!session.isAuthenticated || !session.isStoreOwner) {
    return null;
  }

  function hydrateFormFromProduct(
    product: StoreProductRecord,
    storeId: string,
  ) {
    const variantDrafts = product.variants.map((variant) => ({
      id: createVariantId(),
      price: String(variant.price ?? ""),
      quantity: String(variant.stockQuantity ?? ""),
      variantName: variant.label || "",
    }));

    const defaultVariant =
      variantDrafts.length === 1 && !variantDrafts[0].variantName
        ? variantDrafts[0]
        : null;

    const normalizedCategory = String(product.category || "").trim();
    const incomingTags = (Array.isArray(product.tags) ? product.tags : [])
      .map((item) =>
        String(item || "")
          .trim()
          .toLowerCase(),
      )
      .filter(Boolean);
    const knownTags = incomingTags.filter((item): item is ProductTagOption =>
      TAG_OPTIONS.includes(item as ProductTagOption),
    );
    const unknownTags = incomingTags.filter(
      (item) => !TAG_OPTIONS.includes(item as ProductTagOption),
    );

    setSelectedStoreId(storeId);
    setProductName(product.name || "");
    setPrice(defaultVariant?.price || "");
    setSelectedMainCategory(
      MAIN_CATEGORY_OPTIONS.includes(normalizedCategory as MainCategoryOption)
        ? normalizedCategory
        : normalizedCategory
          ? "Custom"
          : "",
    );
    setCustomMainCategory(
      MAIN_CATEGORY_OPTIONS.includes(normalizedCategory as MainCategoryOption)
        ? ""
        : normalizedCategory,
    );
    setSelectedTags(knownTags);
    setCustomTags(unknownTags.join(", "));
    setDescription(product.description || "");
    setImageUrl(product.image || "");
    setVariants(defaultVariant ? [] : variantDrafts);
  }

  const handleVariantAdd = () => {
    setVariants((current) => [
      ...current,
      {
        id: createVariantId(),
        variantName: "",
        price: price.trim(),
        quantity: "1",
      },
    ]);
  };

  const handleVariantChange = (
    id: string,
    field: "variantName" | "price" | "quantity",
    value: string,
  ) => {
    setVariants((current) =>
      current.map((variant) =>
        variant.id === id ? { ...variant, [field]: value } : variant,
      ),
    );
  };

  const handleVariantRemove = (id: string) => {
    setVariants((current) => current.filter((variant) => variant.id !== id));
  };

  const handleDuplicateLastProduct = () => {
    if (!lastAddedProduct) {
      return;
    }

    setSelectedStoreId(lastAddedProduct.storeId);
    setProductName(lastAddedProduct.productName);
    setPrice(lastAddedProduct.price);
    setSelectedMainCategory(lastAddedProduct.mainCategory);
    setCustomMainCategory(lastAddedProduct.customMainCategory);
    setSelectedTags(lastAddedProduct.tags);
    setCustomTags(lastAddedProduct.customTags);
    setDescription(lastAddedProduct.description);
    setImageUrl(lastAddedProduct.imageUrl);
    setVariants(cloneVariants(lastAddedProduct.variants));
    setNotice(null);
  };

  const handleToggleTag = (option: string) => {
    setSelectedTags((current) => {
      const exists = current.includes(option);

      if (exists) {
        return current.filter((item) => item !== option);
      }

      if (current.length >= 8) {
        setNotice({
          type: "error",
          message: "Choose up to 8 tags for each product.",
        });
        return current;
      }

      return [...current, option];
    });
  };

  const handlePickProductImage = async (mode: "camera" | "library") => {
    setIsPickingImage(true);
    setNotice(null);

    try {
      const permission =
        mode === "camera"
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          "Permission needed",
          mode === "camera"
            ? "Allow camera access to add a product photo."
            : "Allow photo access to choose a product photo.",
        );
        setIsPickingImage(false);
        return;
      }

      const result =
        mode === "camera"
          ? await ImagePicker.launchCameraAsync({
              allowsEditing: true,
              aspect: [4, 3],
              base64: true,
              mediaTypes: ["images"],
              quality: 0.7,
            })
          : await ImagePicker.launchImageLibraryAsync({
              allowsEditing: true,
              aspect: [4, 3],
              base64: true,
              mediaTypes: ["images"],
              quality: 0.7,
            });

      if (result.canceled || !result.assets?.[0]) {
        setIsPickingImage(false);
        return;
      }

      setImageUrl(buildSelectedImageValue(result.assets[0]));
    } catch {
      Alert.alert(
        "Image unavailable",
        "We couldn't load that image right now.",
      );
    } finally {
      setIsPickingImage(false);
    }
  };

  const handleSubmit = async (mode: SaveMode) => {
    if (!selectedStoreId) {
      setNotice({
        type: "error",
        message: "Choose the store you want to add this product to.",
      });
      return;
    }

    if (!productName.trim()) {
      setNotice({
        type: "error",
        message: "Product name is required.",
      });
      return;
    }

    if (!price.trim() && variants.length === 0) {
      setNotice({
        type: "error",
        message: "Enter a valid price.",
      });
      return;
    }

    const normalizedMainCategory =
      selectedMainCategory === "Custom"
        ? customMainCategory.trim()
        : selectedMainCategory.trim();
    const normalizedTags = Array.from(
      new Set([
        ...selectedTags
          .map((item) => item.trim().toLowerCase())
          .filter(Boolean),
        ...normalizeCommaSeparatedValues(customTags),
      ]),
    ).filter((tag) => tag !== normalizedMainCategory.trim().toLowerCase());

    if (!normalizedMainCategory) {
      setNotice({
        type: "error",
        message: "Choose a main category for this product.",
      });
      return;
    }

    if (!session.authToken) {
      setNotice({
        type: "error",
        message: "Log in again to manage your products.",
      });
      return;
    }

    setSubmitMode(mode);
    setNotice(null);

    const normalizedVariants = variants
      .map((variant) => ({
        price: Number(variant.price),
        stock_quantity: Number.parseInt(variant.quantity || "0", 10),
        variant_name: variant.variantName.trim(),
      }))
      .filter(
        (variant) =>
          variant.variant_name &&
          Number.isFinite(variant.price) &&
          Number.isInteger(variant.stock_quantity) &&
          variant.stock_quantity >= 0,
      );

    const payload = {
      category: normalizedMainCategory || undefined,
      description: description.trim() || undefined,
      image_url: imageUrl.trim() || undefined,
      price: price.trim() ? Number(price) : undefined,
      product_name: productName.trim(),
      tags: normalizedTags,
      ...(normalizedVariants.length > 0
        ? { variants: normalizedVariants }
        : {}),
    };

    const result = isEditing
      ? await updateProductWithBackend(
          session.authToken,
          editingProductId,
          payload,
        )
      : await createProductWithBackend(session.authToken, {
          ...payload,
          store_id: Number(selectedStoreId),
        });

    if (!result.ok) {
      setNotice({
        type: "error",
        message: result.error,
      });
      setSubmitMode(null);
      return;
    }

    const resultProductId = String(
      result.product.product_id ?? result.product.id ?? "",
    );
    const snapshot: LastAddedProduct = {
      customMainCategory,
      customTags,
      description,
      imageUrl,
      mainCategory: selectedMainCategory,
      price,
      productId: resultProductId || undefined,
      productName,
      storeId: selectedStoreId,
      tags: selectedTags,
      variants: cloneVariants(variants),
    };

    setLastAddedProduct(snapshot);

    if (isEditing) {
      showFlashFeedback(result.message || "Product updated.");
      setNotice({
        type: "success",
        message: result.message || "Your product is updated.",
      });
      setSubmitMode(null);
      router.push(`/store/${selectedStoreId}`);
      return;
    }

    if (mode === "start-new") {
      showFlashFeedback(result.message || "Product created.");
      setProductName("");
      setPrice("");
      setSelectedMainCategory("");
      setCustomMainCategory("");
      setSelectedTags([]);
      setCustomTags("");
      setDescription("");
      setImageUrl("");
      setVariants([]);
      setNotice({
        type: "success",
        message: result.message || "Saved. You can add the next one now.",
      });
    } else {
      showFlashFeedback(result.message || "Product created.");
      setNotice({
        type: "success",
        message: result.message || "Saved. You can keep editing from here.",
      });
      if (resultProductId) {
        router.replace(
          `/store/products/add?store=${selectedStoreId}&product=${resultProductId}`,
        );
        setSubmitMode(null);
        return;
      }
    }

    setSubmitMode(null);
  };

  return (
    <SafeAreaView edges={["top"]} style={styles.safeArea}>
      <StatusBar style="light" />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 12 : 0}
        style={[styles.flex, { flex: 1 }]}
      >
        <ScrollView
          bounces={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.page}>
            <View style={styles.header}>
              <BackPillButton
                fallbackHref={
                  selectedStoreId ? `/store/${selectedStoreId}` : "/profile"
                }
              />
              <Text style={styles.headerTitle}>
                {isEditing ? "Edit Product" : "Add Product"}
              </Text>
              <View style={styles.headerSpacer} />
            </View>

            {isEditing ? (
              <View style={[styles.topNoticeCard, styles.infoNoticeCard]}>
                <Text style={styles.topNoticeEyebrow}>Editing Product</Text>
                <Text style={styles.topNoticeText}>
                  Update the product details, image, and variants, then save to
                  return to your store.
                </Text>
              </View>
            ) : (
              <View style={styles.topNoticeCard}>
                <View style={styles.quickRepeatRow}>
                  <View style={styles.quickRepeatTextWrap}>
                    <Text style={styles.topNoticeEyebrow}>Quick Repeat</Text>
                    <Text style={styles.topNoticeText}>
                      Reuse the last product and only edit what changed.
                    </Text>
                  </View>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    disabled={!canDuplicate || isSubmitting || isLoadingProduct}
                    onPress={handleDuplicateLastProduct}
                    style={[
                      styles.useLastButton,
                      (!canDuplicate || isSubmitting) && styles.buttonDisabled,
                    ]}
                  >
                    <Text style={styles.useLastButtonText}>
                      Use Last Product
                    </Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.quickRepeatFooter}>
                  {lastAddedProduct
                    ? `Last added: ${lastAddedProduct.productName}`
                    : "Your last saved product shows here."}
                </Text>
              </View>
            )}

            <View style={styles.formCard}>
              <View style={styles.formCardHeader}>
                <Text style={styles.sectionEyebrow}>Details</Text>
                <Text style={styles.sectionSubtitle}>
                  {isEditing
                    ? "Update the product and save."
                    : "Name it, price it, save it."}
                </Text>
              </View>

              <View style={styles.formBody}>
                {notice ? (
                  <View
                    style={[
                      styles.noticeCard,
                      notice.type === "success"
                        ? styles.noticeSuccess
                        : styles.noticeError,
                    ]}
                  >
                    <Text style={styles.noticeText}>{notice.message}</Text>
                  </View>
                ) : null}

                {isLoadingProduct ? (
                  <View style={styles.noticeCard}>
                    <Text style={styles.noticeText}>
                      Loading product details...
                    </Text>
                  </View>
                ) : null}

                {storeOptions.length > 1 ? (
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Store</Text>
                    <ScrollView
                      horizontal
                      contentContainerStyle={styles.storeChipRow}
                      showsHorizontalScrollIndicator={false}
                    >
                      {storeOptions.map((store) => {
                        const active = store.id === selectedStoreId;

                        return (
                          <TouchableOpacity
                            key={store.id}
                            activeOpacity={0.85}
                            disabled={
                              isSubmitting || isEditing || isLoadingProduct
                            }
                            onPress={() => setSelectedStoreId(store.id)}
                            style={[
                              styles.storeChip,
                              active && styles.storeChipActive,
                            ]}
                          >
                            <Text
                              style={[
                                styles.storeChipTitle,
                                active && styles.storeChipTitleActive,
                              ]}
                            >
                              {store.store_name}
                            </Text>
                            <Text style={styles.storeChipMeta}>
                              {store.category}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                ) : null}

                {selectedStore ? (
                  <View style={styles.selectedStoreCard}>
                    <Text style={styles.fieldLabel}>Store</Text>
                    <Text style={styles.selectedStoreTitle}>
                      {selectedStore.store_name}
                    </Text>
                    <Text style={styles.selectedStoreMeta}>
                      {selectedStore.category || selectedStore.address}
                    </Text>
                  </View>
                ) : null}

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Product Name</Text>
                  <TextInput
                    editable={!isSubmitting && !isLoadingProduct}
                    onChangeText={setProductName}
                    placeholder="Golden Morn Cereal"
                    placeholderTextColor={theme.colors.mutedText}
                    style={styles.input}
                    value={productName}
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Price</Text>
                  <View style={styles.priceInputWrap}>
                    <Text style={styles.currencyMark}>₦</Text>
                    <TextInput
                      editable={!isSubmitting && !isLoadingProduct}
                      keyboardType="decimal-pad"
                      onChangeText={setPrice}
                      placeholder="2500"
                      placeholderTextColor={theme.colors.mutedText}
                      style={styles.priceInput}
                      value={price}
                    />
                  </View>
                  <Text style={styles.helperText}>
                    Base price for simple products. Variants can override it.
                  </Text>
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Main category</Text>
                  <ScrollView
                    horizontal
                    contentContainerStyle={styles.categoryRow}
                    showsHorizontalScrollIndicator={false}
                  >
                    {MAIN_CATEGORY_OPTIONS.map((option) => {
                      const active = selectedMainCategory === option;

                      return (
                        <TouchableOpacity
                          key={option}
                          activeOpacity={0.85}
                          disabled={isSubmitting || isLoadingProduct}
                          onPress={() => setSelectedMainCategory(option)}
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
                            {option}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                  <Text style={styles.helperText}>
                    Choose one main category for this product.
                  </Text>
                  {selectedMainCategory === "Custom" ? (
                    <>
                      <TextInput
                        editable={!isSubmitting && !isLoadingProduct}
                        onChangeText={setCustomMainCategory}
                        placeholder="Enter a custom main category"
                        placeholderTextColor={theme.colors.mutedText}
                        style={styles.input}
                        value={customMainCategory}
                      />
                    </>
                  ) : null}
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Tags</Text>
                  <ScrollView
                    horizontal
                    contentContainerStyle={styles.categoryRow}
                    showsHorizontalScrollIndicator={false}
                  >
                    {TAG_OPTIONS.map((option) => {
                      const active = selectedTags.includes(option);

                      return (
                        <TouchableOpacity
                          key={option}
                          activeOpacity={0.85}
                          disabled={isSubmitting || isLoadingProduct}
                          onPress={() => handleToggleTag(option)}
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
                            {option}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                  <Text style={styles.helperText}>
                    Add tags customers might search for.
                  </Text>
                  <TextInput
                    editable={!isSubmitting && !isLoadingProduct}
                    onChangeText={setCustomTags}
                    placeholder="Add custom tags, separated by commas"
                    placeholderTextColor={theme.colors.mutedText}
                    style={styles.input}
                    value={customTags}
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Description</Text>
                  <TextInput
                    editable={!isSubmitting && !isLoadingProduct}
                    multiline
                    onChangeText={setDescription}
                    placeholder="Short description customers will see on your store page"
                    placeholderTextColor={theme.colors.mutedText}
                    style={styles.textArea}
                    textAlignVertical="top"
                    value={description}
                  />
                </View>

                <View style={styles.imagePanel}>
                  <View style={styles.imageHeader}>
                    <View>
                      <Text style={styles.imageTitle}>Product image</Text>
                      <Text style={styles.imageSubtitle}>
                        Optional. Helps the product stand out.
                      </Text>
                    </View>
                    {imageUrl ? (
                      <TouchableOpacity
                        activeOpacity={0.85}
                        disabled={isSubmitting || isLoadingProduct}
                        onPress={() => setImageUrl("")}
                        style={styles.removeImageButton}
                      >
                        <Text style={styles.removeImageButtonText}>Remove</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  <View style={styles.imagePreview}>
                    {imageUrl ? (
                      <AppImage
                        contentFit="cover"
                        style={styles.previewImage}
                        uri={imageUrl}
                      />
                    ) : (
                      <Text style={styles.imageEmptyText}>
                        No image selected
                      </Text>
                    )}
                  </View>

                  <View style={styles.imageActionRow}>
                    <TouchableOpacity
                      activeOpacity={0.85}
                      disabled={
                        isSubmitting || isLoadingProduct || isPickingImage
                      }
                      onPress={() => void handlePickProductImage("camera")}
                      style={styles.primaryImageButton}
                    >
                      <Text style={styles.primaryImageButtonText}>
                        {isPickingImage ? "Loading..." : "Take Photo"}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      activeOpacity={0.85}
                      disabled={
                        isSubmitting || isLoadingProduct || isPickingImage
                      }
                      onPress={() => void handlePickProductImage("library")}
                      style={styles.secondaryImageButton}
                    >
                      <Text style={styles.secondaryImageButtonText}>
                        Choose from Gallery
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <VariantRows
                  disabled={isSubmitting || isLoadingProduct}
                  onAdd={handleVariantAdd}
                  onChange={handleVariantChange}
                  onRemove={handleVariantRemove}
                  variants={variants}
                />

                <View style={styles.submitRow}>
                  <Button
                    label={
                      submitMode === "edit-next" || submitMode === "update"
                        ? isEditing
                          ? "Saving Changes…"
                          : "Saving..."
                        : isEditing
                          ? "Save Changes"
                          : "Add & Edit Next"
                    }
                    onPress={() =>
                      handleSubmit(isEditing ? "update" : "edit-next")
                    }
                    disabled={isSubmitting || isLoadingProduct}
                    style={styles.primarySubmitButton}
                  />

                  {!isEditing ? (
                    <Button
                      label={
                        submitMode === "start-new"
                          ? "Saving..."
                          : "Add & Start New"
                      }
                      onPress={() => handleSubmit("start-new")}
                      disabled={isSubmitting || isLoadingProduct}
                      variant="secondary"
                      style={styles.secondarySubmitButton}
                    />
                  ) : null}
                </View>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const BORDER = theme.colors.borderStrong;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "transparent",
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 32,
  },
  page: {
    width: "100%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  backButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: theme.button.secondaryBackground,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  backButtonText: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  headerTitle: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
  headerSpacer: {
    width: 78,
  },
  topNoticeCard: {
    marginBottom: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: theme.colors.surfaceElevated,
    padding: 16,
  },
  infoNoticeCard: {
    borderColor: theme.colors.borderStrong,
    backgroundColor: "rgba(74,136,255,0.16)",
  },
  topNoticeEyebrow: {
    color: theme.colors.subduedText,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.8,
    textTransform: "uppercase",
  },
  topNoticeText: {
    marginTop: 8,
    color: theme.colors.subduedText,
    fontSize: 14,
    lineHeight: 21,
  },
  quickRepeatRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  quickRepeatTextWrap: {
    flex: 1,
  },
  useLastButton: {
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    backgroundColor: "rgba(74,136,255,0.16)",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  useLastButtonText: {
    color: theme.colors.subduedText,
    fontSize: 12,
    fontWeight: "700",
  },
  quickRepeatFooter: {
    marginTop: 10,
    color: theme.colors.mutedText,
    fontSize: 12,
  },
  formCard: {
    overflow: "hidden",
    borderRadius: 28,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: theme.colors.surfaceCard,
  },
  formCardHeader: {
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  sectionEyebrow: {
    color: theme.colors.mutedText,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.8,
    textTransform: "uppercase",
  },
  sectionSubtitle: {
    marginTop: 6,
    color: theme.colors.subduedText,
    fontSize: 14,
    lineHeight: 20,
  },
  formBody: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 18,
  },
  noticeCard: {
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  noticeSuccess: {
    borderColor: theme.colors.borderStrong,
    backgroundColor: "rgba(74,136,255,0.16)",
  },
  noticeError: {
    borderColor: theme.colors.borderStrong,
    backgroundColor: theme.colors.surfaceElevated,
  },
  noticeText: {
    color: "#F5F7FB",
    fontSize: 14,
    lineHeight: 20,
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    color: theme.colors.mutedText,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.8,
    textTransform: "uppercase",
  },
  storeChipRow: {
    gap: 10,
  },
  storeChip: {
    minWidth: 152,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: theme.colors.surfaceOverlay,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  storeChipActive: {
    borderColor: theme.colors.borderStrong,
    backgroundColor: "rgba(74,136,255,0.16)",
  },
  storeChipTitle: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  storeChipTitleActive: {
    color: theme.colors.subduedText,
  },
  storeChipMeta: {
    marginTop: 4,
    color: theme.colors.mutedText,
    fontSize: 12,
  },
  selectedStoreCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: theme.colors.surfaceElevated,
    padding: 14,
    gap: 8,
  },
  selectedStoreTitle: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  selectedStoreMeta: {
    color: theme.colors.mutedText,
    fontSize: 12,
  },
  input: {
    minHeight: theme.controls.inputHeight,
    borderRadius: theme.form.inputRadius,
    borderWidth: 1,
    borderColor: theme.form.inputBorder,
    backgroundColor: theme.form.inputBackground,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: theme.colors.text,
    fontSize: 15,
  },
  priceInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: theme.controls.inputHeight,
    borderRadius: theme.form.inputRadius,
    borderWidth: 1,
    borderColor: theme.form.inputBorder,
    backgroundColor: theme.form.inputBackground,
    paddingHorizontal: 16,
  },
  currencyMark: {
    marginRight: 8,
    color: theme.colors.mutedText,
    fontSize: 16,
    fontWeight: "700",
  },
  priceInput: {
    flex: 1,
    paddingVertical: 12,
    color: theme.colors.text,
    fontSize: 15,
  },
  helperText: {
    color: "rgba(184,194,217,0.84)",
    fontSize: 11,
    lineHeight: 16,
  },
  categoryRow: {
    gap: 10,
  },
  categoryChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: theme.colors.surfaceElevated,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  categoryChipActive: {
    borderColor: theme.colors.borderStrong,
    backgroundColor: "rgba(74,136,255,0.16)",
  },
  categoryChipText: {
    color: theme.colors.subduedText,
    fontSize: 13,
    fontWeight: "600",
  },
  categoryChipTextActive: {
    color: theme.colors.text,
  },
  textArea: {
    minHeight: 110,
    borderRadius: theme.form.inputRadius,
    borderWidth: 1,
    borderColor: theme.form.inputBorder,
    backgroundColor: theme.form.inputBackground,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: theme.colors.text,
    fontSize: 14,
    lineHeight: 21,
  },
  imagePanel: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: theme.colors.surfaceElevated,
    padding: 16,
    gap: 14,
  },
  imageHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  imageTitle: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  imageSubtitle: {
    marginTop: 4,
    color: theme.colors.mutedText,
    fontSize: 12,
    lineHeight: 18,
  },
  removeImageButton: {
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    backgroundColor: theme.button.secondaryBackground,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  removeImageButtonText: {
    color: theme.colors.subduedText,
    fontSize: 11,
    fontWeight: "700",
  },
  imagePreview: {
    overflow: "hidden",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: theme.colors.surfaceOverlay,
    height: 192,
    alignItems: "center",
    justifyContent: "center",
  },
  previewImage: {
    width: "100%",
    height: "100%",
  },
  imageEmptyText: {
    color: theme.colors.mutedText,
    fontSize: 14,
  },
  imageActionRow: {
    gap: 10,
  },
  primaryImageButton: {
    borderRadius: 18,
    backgroundColor: theme.colors.accent,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryImageButtonText: {
    color: theme.colors.primaryTextOnAccent,
    fontSize: 14,
    fontWeight: "700",
  },
  secondaryImageButton: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: theme.button.secondaryBackground,
    paddingVertical: 14,
    alignItems: "center",
  },
  secondaryImageButtonText: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  variantPanel: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: theme.colors.surfaceElevated,
    padding: 16,
    gap: 14,
  },
  variantHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  variantTitle: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  variantSubtitle: {
    marginTop: 4,
    color: theme.colors.mutedText,
    fontSize: 12,
    lineHeight: 18,
  },
  variantAddButton: {
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: theme.button.secondaryBackground,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  variantAddButtonText: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: "700",
  },
  variantEmpty: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: theme.colors.surfaceOverlay,
    padding: 14,
  },
  variantEmptyText: {
    color: theme.colors.mutedText,
    fontSize: 13,
    lineHeight: 19,
  },
  variantList: {
    gap: 12,
  },
  variantCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: theme.colors.surfaceOverlay,
    padding: 14,
    gap: 12,
  },
  variantCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  variantCardTitle: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  variantRemoveButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    backgroundColor: theme.button.secondaryBackground,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  variantRemoveButtonText: {
    color: theme.colors.subduedText,
    fontSize: 11,
    fontWeight: "700",
  },
  variantRow: {
    flexDirection: "row",
    gap: 10,
  },
  variantHalf: {
    flex: 1,
  },
  submitRow: {
    gap: 12,
    marginTop: 2,
  },
  primarySubmitButton: {
    borderRadius: 18,
    backgroundColor: theme.colors.accent,
    paddingVertical: 16,
    alignItems: "center",
  },
  primarySubmitButtonText: {
    color: theme.colors.primaryTextOnAccent,
    fontSize: 14,
    fontWeight: "700",
  },
  secondarySubmitButton: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: theme.button.secondaryBackground,
    paddingVertical: 16,
    alignItems: "center",
  },
  secondarySubmitButtonText: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
