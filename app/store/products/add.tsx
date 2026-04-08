import { BackPillButton } from "@/components/ui/back-pill-button";
import { Button } from "@/components/ui/button";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Image,
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

import { theme } from "@/constants/theme";
import { showFlashFeedback } from "@/services/flash-feedback";
import { useMobileSession } from "@/services/mobile-session";
import {
  createProductWithBackend,
  updateProductWithBackend,
  type BackendProduct,
} from "@/services/product-api";
import { fetchStoreFullData } from "@/services/store-api";

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
  categories: string[];
  customCategory: string;
  description: string;
  imageUrl: string;
  variants: VariantDraft[];
};

const CATEGORY_OPTIONS = [
  "Custom",
  "drink",
  "snack",
  "juice",
  "orange",
  "soda",
  "bread",
  "rice",
  "fruit",
  "vegetable",
  "electronics",
  "phone accessory",
  "toiletries",
  "cleaning",
  "beauty",
];

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

function normalizeCustomCategoryValues(value: string) {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean),
    ),
  );
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
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [customCategory, setCustomCategory] = useState("");
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
    async function loadEditingProduct() {
      if (!isEditing || !preferredStoreId) {
        return;
      }

      setIsLoadingProduct(true);
      const result = await fetchStoreFullData(preferredStoreId);

      if (!result.ok) {
        setNotice({
          type: "error",
          message: result.error,
        });
        setIsLoadingProduct(false);
        return;
      }

      const matchedProduct = result.products.find((product) => {
        return String(product.product_id ?? "") === editingProductId;
      });

      if (!matchedProduct) {
        setNotice({
          type: "error",
          message: "Could not find this product.",
        });
        setIsLoadingProduct(false);
        return;
      }

      hydrateFormFromProduct(matchedProduct, preferredStoreId);
      setIsLoadingProduct(false);
    }

    void loadEditingProduct();
  }, [editingProductId, isEditing, preferredStoreId]);

  if (!session.isAuthenticated || !session.isStoreOwner) {
    return null;
  }

  function hydrateFormFromProduct(product: BackendProduct, storeId: string) {
    const variantDrafts =
      product.variants?.map((variant) => ({
        id: createVariantId(),
        price:
          variant.price !== null && variant.price !== undefined
            ? String(variant.price)
            : "",
        quantity:
          variant.stock_quantity !== null &&
          variant.stock_quantity !== undefined
            ? String(variant.stock_quantity)
            : "",
        variantName: variant.variant_name || "",
      })) ?? [];

    const defaultVariant =
      variantDrafts.length === 1 && !variantDrafts[0].variantName
        ? variantDrafts[0]
        : null;

    const incomingCategories = [
      product.category || "",
      ...(Array.isArray(product.tags) ? product.tags : []),
    ]
      .map((item) => String(item || "").trim())
      .filter(Boolean)
      .slice(0, 4);
    const knownCategories = incomingCategories.filter(
      (item) => item !== "Custom" && CATEGORY_OPTIONS.includes(item),
    );
    const unknownCategories = incomingCategories.filter(
      (item) => !CATEGORY_OPTIONS.includes(item),
    );

    setSelectedStoreId(storeId);
    setProductName(product.product_name || "");
    setPrice(defaultVariant?.price || "");
    setSelectedCategories(
      unknownCategories.length > 0
        ? ["Custom", ...knownCategories]
        : knownCategories,
    );
    setCustomCategory(unknownCategories.join(", "));
    setDescription(product.description || "");
    setImageUrl(product.image_url || "");
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
    setSelectedCategories(lastAddedProduct.categories);
    setCustomCategory(lastAddedProduct.customCategory);
    setDescription(lastAddedProduct.description);
    setImageUrl(lastAddedProduct.imageUrl);
    setVariants(cloneVariants(lastAddedProduct.variants));
    setNotice(null);
  };

  const handleToggleCategory = (option: string) => {
    setSelectedCategories((current) => {
      const exists = current.includes(option);

      if (exists) {
        return current.filter((item) => item !== option);
      }

      if (current.length >= 4) {
        setNotice({
          type: "error",
          message: "Choose up to 4 categories for each product.",
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
            ? "Allow camera access to take a product photo."
            : "Allow photo library access to choose a product photo.",
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
        "We couldn’t load that image right now.",
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

    const normalizedCategoryValues = [
      ...selectedCategories
        .filter((item) => item !== "Custom")
        .map((item) => item.trim().toLowerCase()),
      ...(selectedCategories.includes("Custom")
        ? normalizeCustomCategoryValues(customCategory)
        : []),
    ].slice(0, 4);

    if (normalizedCategoryValues.length === 0) {
      setNotice({
        type: "error",
        message: "Choose at least one category.",
      });
      return;
    }

    if (!session.authToken) {
      setNotice({
        type: "error",
        message: "Log in again to manage store products.",
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
      category: normalizedCategoryValues[0] || undefined,
      description: description.trim() || undefined,
      image_url: imageUrl.trim() || undefined,
      price: price.trim() ? Number(price) : undefined,
      product_name: productName.trim(),
      tags: normalizedCategoryValues.slice(1),
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
      categories: selectedCategories,
      customCategory,
      description,
      imageUrl,
      price,
      productId: resultProductId || undefined,
      productName,
      storeId: selectedStoreId,
      variants: cloneVariants(variants),
    };

    setLastAddedProduct(snapshot);

    if (isEditing) {
      showFlashFeedback(result.message || "Product updated.");
      setNotice({
        type: "success",
        message: result.message || "Product updated successfully.",
      });
      setSubmitMode(null);
      router.push(`/store/${selectedStoreId}`);
      return;
    }

    if (mode === "start-new") {
      showFlashFeedback(result.message || "Product created.");
      setProductName("");
      setPrice("");
      setSelectedCategories([]);
      setCustomCategory("");
      setDescription("");
      setImageUrl("");
      setVariants([]);
      setNotice({
        type: "success",
        message: result.message || "Added. Start the next one.",
      });
    } else {
      showFlashFeedback(result.message || "Product created.");
      setNotice({
        type: "success",
        message: result.message || "Added. Edit the next one.",
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
                  <Text style={styles.fieldLabel}>Categories</Text>
                  <ScrollView
                    horizontal
                    contentContainerStyle={styles.categoryRow}
                    showsHorizontalScrollIndicator={false}
                  >
                    {CATEGORY_OPTIONS.map((option) => {
                      const active = selectedCategories.includes(option);

                      return (
                        <TouchableOpacity
                          key={option}
                          activeOpacity={0.85}
                          disabled={isSubmitting || isLoadingProduct}
                          onPress={() => handleToggleCategory(option)}
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
                    Choose up to 4 categories. Exact name matches still rank
                    first in search, then category matches.
                  </Text>
                  {selectedCategories.includes("Custom") ? (
                    <>
                      <TextInput
                        editable={!isSubmitting && !isLoadingProduct}
                        onChangeText={setCustomCategory}
                        placeholder="Enter custom categories, separated by commas"
                        placeholderTextColor={theme.colors.mutedText}
                        style={styles.input}
                        value={customCategory}
                      />
                      <Text style={styles.helperText}>
                        Separate multiple custom categories with commas.
                      </Text>
                    </>
                  ) : null}
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
                      <Image
                        source={{ uri: imageUrl }}
                        style={styles.previewImage}
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

const BORDER = "rgba(255,255,255,0.10)";

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
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
    backgroundColor: "rgba(255,255,255,0.05)",
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
    backgroundColor: "rgba(255,255,255,0.05)",
    padding: 16,
  },
  infoNoticeCard: {
    borderColor: "rgba(56,189,248,0.22)",
    backgroundColor: "rgba(56,189,248,0.10)",
  },
  topNoticeEyebrow: {
    color: "#cbd5e1",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.8,
    textTransform: "uppercase",
  },
  topNoticeText: {
    marginTop: 8,
    color: "#e2e8f0",
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
    borderColor: "rgba(52,211,153,0.28)",
    backgroundColor: "rgba(52,211,153,0.12)",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  useLastButtonText: {
    color: "#d1fae5",
    fontSize: 12,
    fontWeight: "700",
  },
  quickRepeatFooter: {
    marginTop: 10,
    color: "#94a3b8",
    fontSize: 12,
  },
  formCard: {
    overflow: "hidden",
    borderRadius: 28,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "rgba(15, 23, 42, 0.72)",
  },
  formCardHeader: {
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  sectionEyebrow: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.8,
    textTransform: "uppercase",
  },
  sectionSubtitle: {
    marginTop: 8,
    color: "#cbd5e1",
    fontSize: 14,
  },
  formBody: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 20,
  },
  noticeCard: {
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  noticeSuccess: {
    borderColor: "rgba(52,211,153,0.22)",
    backgroundColor: "rgba(52,211,153,0.12)",
  },
  noticeError: {
    borderColor: "rgba(244,63,94,0.22)",
    backgroundColor: "rgba(244,63,94,0.12)",
  },
  noticeText: {
    color: "#f8fafc",
    fontSize: 14,
    lineHeight: 20,
  },
  fieldGroup: {
    gap: 10,
  },
  fieldLabel: {
    color: "#94a3b8",
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
    backgroundColor: "rgba(2,6,23,0.52)",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  storeChipActive: {
    borderColor: "rgba(56,189,248,0.32)",
    backgroundColor: "rgba(56,189,248,0.12)",
  },
  storeChipTitle: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  storeChipTitleActive: {
    color: "#e0f2fe",
  },
  storeChipMeta: {
    marginTop: 4,
    color: "#94a3b8",
    fontSize: 12,
  },
  selectedStoreCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "rgba(255,255,255,0.05)",
    padding: 14,
    gap: 8,
  },
  selectedStoreTitle: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  selectedStoreMeta: {
    color: "#94a3b8",
    fontSize: 12,
  },
  input: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "rgba(2,6,23,0.58)",
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: theme.colors.text,
    fontSize: 15,
  },
  priceInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "rgba(2,6,23,0.58)",
    paddingHorizontal: 16,
  },
  currencyMark: {
    marginRight: 8,
    color: "#94a3b8",
    fontSize: 16,
    fontWeight: "700",
  },
  priceInput: {
    flex: 1,
    paddingVertical: 14,
    color: theme.colors.text,
    fontSize: 15,
  },
  helperText: {
    color: "#64748b",
    fontSize: 12,
    lineHeight: 18,
  },
  categoryRow: {
    gap: 10,
  },
  categoryChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "rgba(255,255,255,0.05)",
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  categoryChipActive: {
    borderColor: "rgba(56,189,248,0.32)",
    backgroundColor: "rgba(56,189,248,0.12)",
  },
  categoryChipText: {
    color: "#cbd5e1",
    fontSize: 13,
    fontWeight: "600",
  },
  categoryChipTextActive: {
    color: "#e0f2fe",
  },
  textArea: {
    minHeight: 110,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "rgba(2,6,23,0.58)",
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: theme.colors.text,
    fontSize: 14,
    lineHeight: 21,
  },
  imagePanel: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "rgba(255,255,255,0.05)",
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
    color: "#94a3b8",
    fontSize: 12,
    lineHeight: 18,
  },
  removeImageButton: {
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(244,63,94,0.24)",
    backgroundColor: "rgba(244,63,94,0.12)",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  removeImageButtonText: {
    color: "#fecdd3",
    fontSize: 11,
    fontWeight: "700",
  },
  imagePreview: {
    overflow: "hidden",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "rgba(2,6,23,0.58)",
    height: 192,
    alignItems: "center",
    justifyContent: "center",
  },
  previewImage: {
    width: "100%",
    height: "100%",
  },
  imageEmptyText: {
    color: "#64748b",
    fontSize: 14,
  },
  imageActionRow: {
    gap: 10,
  },
  primaryImageButton: {
    borderRadius: 18,
    backgroundColor: "#fff",
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryImageButtonText: {
    color: "#020617",
    fontSize: 14,
    fontWeight: "700",
  },
  secondaryImageButton: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "rgba(255,255,255,0.05)",
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
    backgroundColor: "rgba(255,255,255,0.05)",
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
    color: "#94a3b8",
    fontSize: 12,
    lineHeight: 18,
  },
  variantAddButton: {
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "rgba(255,255,255,0.06)",
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
    backgroundColor: "rgba(2,6,23,0.42)",
    padding: 14,
  },
  variantEmptyText: {
    color: "#94a3b8",
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
    backgroundColor: "rgba(2,6,23,0.42)",
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
    borderColor: "rgba(244,63,94,0.24)",
    backgroundColor: "rgba(244,63,94,0.12)",
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  variantRemoveButtonText: {
    color: "#fecdd3",
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
  },
  primarySubmitButton: {
    borderRadius: 18,
    backgroundColor: "#fff",
    paddingVertical: 16,
    alignItems: "center",
  },
  primarySubmitButtonText: {
    color: "#020617",
    fontSize: 14,
    fontWeight: "700",
  },
  secondarySubmitButton: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "rgba(255,255,255,0.05)",
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
