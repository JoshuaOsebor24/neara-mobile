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
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  StoreLocationPicker,
  type StoreCoordinates,
} from "@/components/map/store-location-picker";
import { BackPillButton } from "@/components/ui/back-pill-button";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { theme } from "@/constants/theme";
import { buildSessionPatchFromStore } from "@/services/auth-api";
import {
  updateMobileSession,
  useMobileSession,
} from "@/services/mobile-session";
import {
  updateStoreWithBackend,
} from "@/services/store-api";
import { loadStoreRecord } from "@/services/store-data";

const HEADER_IMAGE_LIMIT = 3;
const DELIVERY_OPTIONS = [
  { label: "Yes", value: true },
  { label: "No", value: false },
] as const;

function buildSelectedImageValue(asset: ImagePicker.ImagePickerAsset) {
  if (asset.base64) {
    const mimeType = asset.mimeType || "image/jpeg";
    return `data:${mimeType};base64,${asset.base64}`;
  }

  return asset.uri;
}

function buildImageSlots(images: string[]) {
  const normalized = images.filter(Boolean).slice(0, HEADER_IMAGE_LIMIT);

  if (normalized.length >= HEADER_IMAGE_LIMIT) {
    return normalized;
  }

  return [...normalized, ""];
}

export default function StoreEditScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ store?: string }>();
  const session = useMobileSession();
  const storeId =
    typeof params.store === "string" && params.store
      ? params.store
      : session.primaryStoreId;

  const [storeName, setStoreName] = useState(session.primaryStoreName);
  const [category, setCategory] = useState(session.primaryStoreCategory);
  const [address, setAddress] = useState(session.primaryStoreAddress);
  const [country, setCountry] = useState("Nigeria");
  const [stateRegion, setStateRegion] = useState("");
  const [storePhone, setStorePhone] = useState(session.storePhoneNumber);
  const [description, setDescription] = useState("");
  const [headerImages, setHeaderImages] = useState<string[]>(
    session.primaryStoreImageUrl ? [session.primaryStoreImageUrl] : [],
  );
  const [locationCoordinates, setLocationCoordinates] =
    useState<StoreCoordinates | null>(
      session.primaryStoreLatitude !== null &&
        session.primaryStoreLongitude !== null
        ? {
            latitude: session.primaryStoreLatitude,
            longitude: session.primaryStoreLongitude,
          }
        : null,
    );
  const [deliveryAvailable, setDeliveryAvailable] = useState(false);
  const [notice, setNotice] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingStore, setIsLoadingStore] = useState(true);
  const [editingImageIndex, setEditingImageIndex] = useState<number | null>(
    null,
  );

  const canEdit = useMemo(
    () =>
      session.isAuthenticated &&
      session.isStoreOwner &&
      Boolean(session.authToken) &&
      Boolean(storeId),
    [session.authToken, session.isAuthenticated, session.isStoreOwner, storeId],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadStore() {
      if (!canEdit || !storeId) {
        setIsLoadingStore(false);
        return;
      }

      setIsLoadingStore(true);
      const result = await loadStoreRecord(storeId);

      if (cancelled) {
        return;
      }

      if (!result.ok || !result.store) {
        setNotice(result.ok ? "Could not load your store." : result.error);
        setIsLoadingStore(false);
        return;
      }

      const store = result.store;
      setStoreName(store.storeName || "");
      setCategory(store.category || "");
      setAddress(store.address || "");
      setCountry(store.country || "Nigeria");
      setStateRegion(store.state || "");
      setStorePhone(store.phoneNumber || "");
      setDescription(store.description || "");
      setDeliveryAvailable(Boolean(store.deliveryAvailable));
      setHeaderImages(
        Array.isArray(store.headerImages) && store.headerImages.length > 0
          ? store.headerImages.filter(Boolean).slice(0, HEADER_IMAGE_LIMIT)
          : store.imageUrl
            ? [store.imageUrl]
            : [],
      );
      setLocationCoordinates(
        typeof store.latitude === "number" && typeof store.longitude === "number"
          ? {
              latitude: store.latitude,
              longitude: store.longitude,
            }
          : null,
      );
      setIsLoadingStore(false);
    }

    void loadStore();

    return () => {
      cancelled = true;
    };
  }, [canEdit, storeId]);

  const imageSlots = useMemo(
    () => buildImageSlots(headerImages),
    [headerImages],
  );

  const launchImagePicker = async (
    slotIndex: number,
    mode: "camera" | "library",
  ) => {
    setEditingImageIndex(slotIndex);

    try {
      const permission =
        mode === "camera"
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          "Permission needed",
          mode === "camera"
            ? "Allow camera access to take a store photo."
            : "Allow photo library access to choose a store photo.",
        );
        setEditingImageIndex(null);
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
        setEditingImageIndex(null);
        return;
      }

      const nextValue = buildSelectedImageValue(result.assets[0]);

      setHeaderImages((current) => {
        const next = buildImageSlots(current);
        next[slotIndex] = nextValue;
        return next.filter(Boolean).slice(0, HEADER_IMAGE_LIMIT);
      });
    } catch {
      Alert.alert(
        "Image unavailable",
        "We couldn’t load that image right now.",
      );
    } finally {
      setEditingImageIndex(null);
    }
  };

  const handleEditImage = (slotIndex: number) => {
    Alert.alert("Store image", "Choose how you want to update this image.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Take Photo",
        onPress: () => {
          void launchImagePicker(slotIndex, "camera");
        },
      },
      {
        text: "Choose from Gallery",
        onPress: () => {
          void launchImagePicker(slotIndex, "library");
        },
      },
    ]);
  };

  const handleRemoveImage = (slotIndex: number) => {
    setHeaderImages((current) =>
      current.filter((_, index) => index !== slotIndex),
    );
  };

  const handleSubmit = async () => {
    if (!canEdit || !session.authToken || !storeId || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setNotice("");

    const normalizedHeaderImages = headerImages
      .filter(Boolean)
      .slice(0, HEADER_IMAGE_LIMIT);
    const result = await updateStoreWithBackend(session.authToken, storeId, {
      address: address.trim(),
      category: category.trim(),
      country: country.trim(),
      delivery_available: deliveryAvailable,
      description: description.trim(),
      header_images: normalizedHeaderImages,
      image_url: normalizedHeaderImages[0] || "",
      latitude: locationCoordinates?.latitude,
      longitude: locationCoordinates?.longitude,
      phone_number: storePhone.trim(),
      state: stateRegion.trim(),
      store_name: storeName.trim(),
    });

    if (!result.ok || !result.store) {
      setIsSubmitting(false);
      setNotice(result.error || "Could not update your store.");
      return;
    }

    updateMobileSession(buildSessionPatchFromStore(result.store));
    setHeaderImages(
      Array.isArray(result.store.header_images)
        ? result.store.header_images
            .filter(Boolean)
            .slice(0, HEADER_IMAGE_LIMIT)
        : result.store.image_url
          ? [result.store.image_url]
          : [],
    );
    setNotice(result.message || "Store updated successfully.");
    setIsSubmitting(false);
  };

  if (!canEdit) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="light" />
        <View style={styles.loadingWrap}>
          <Text style={styles.loadingText}>Opening your store tools...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 12 : 0}
        style={styles.flex}
      >
        <ScrollView
          bounces={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <BackPillButton fallbackHref={`/store/${storeId}`} />
            <Text style={styles.headerLabel}>My Store</Text>
          </View>

          <View style={styles.panel}>
            <Text style={styles.title}>Edit Store Listing</Text>
            <Text style={styles.subtitle}>
              Update the display address, header images, contact details, and
              pin location.
            </Text>

            {isLoadingStore ? (
              <View style={styles.notice}>
                <Text style={styles.noticeText}>
                  Loading your current store details...
                </Text>
              </View>
            ) : null}

            <FormField
              label="Store Name"
              onChangeText={setStoreName}
              value={storeName}
              placeholder="Enter store name"
            />
            <FormField
              label="Category"
              onChangeText={setCategory}
              value={category}
              placeholder="e.g. Grocery"
            />
            <FormField
              label="Display Address"
              hint="This address is display text only. The real store location still comes from the map pin below."
              multiline
              onChangeText={setAddress}
              value={address}
              placeholder="Enter display address"
            />
            <FormField
              label="Country"
              onChangeText={setCountry}
              value={country}
              placeholder="Nigeria"
            />
            <FormField
              label="State / City"
              onChangeText={setStateRegion}
              value={stateRegion}
              placeholder="Lagos"
            />
            <FormField
              label="Phone Number"
              onChangeText={setStorePhone}
              value={storePhone}
              placeholder="0801 234 5678"
            />
            <FormField
              label="Store Description"
              multiline
              onChangeText={setDescription}
              value={description}
              placeholder="Short store description"
            />

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Delivery Available</Text>
              <View style={styles.optionRow}>
                {DELIVERY_OPTIONS.map((option) => {
                  const active = deliveryAvailable === option.value;
                  return (
                    <TouchableOpacity
                      key={option.label}
                      activeOpacity={0.85}
                      onPress={() => setDeliveryAvailable(option.value)}
                      style={[
                        styles.optionChip,
                        active && styles.optionChipActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.optionChipText,
                          active && styles.optionChipTextActive,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Header Images</Text>
              <Text style={styles.helperText}>
                Add up to 3 images. These appear in your store header.
              </Text>
              <View style={styles.imageGrid}>
                {imageSlots.map((image, index) => (
                  <View
                    key={`header-image:${index}`}
                    style={[
                      styles.imageSlot,
                      index === 0 && styles.imageSlotPrimary,
                      imageSlots.length === 1 && styles.imageSlotSingle,
                      imageSlots.length === 2 &&
                        index > 0 &&
                        styles.imageSlotHalf,
                    ]}
                  >
                    {image ? (
                      <Image
                        resizeMode="cover"
                        source={{ uri: image }}
                        style={[
                          styles.imagePreview,
                          index === 0 && styles.imagePreviewPrimary,
                        ]}
                      />
                    ) : (
                      <View
                        style={[
                          styles.imagePlaceholder,
                          index === 0 && styles.imagePlaceholderPrimary,
                        ]}
                      >
                        <Text style={styles.imagePlaceholderText}>
                          Add image
                        </Text>
                      </View>
                    )}

                    <View style={styles.imageActions}>
                      <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() => handleEditImage(index)}
                        style={styles.imageActionButton}
                      >
                        <Text style={styles.imageActionButtonText}>
                          {editingImageIndex === index ? "Loading..." : "Edit"}
                        </Text>
                      </TouchableOpacity>
                      {image ? (
                        <TouchableOpacity
                          activeOpacity={0.85}
                          onPress={() => handleRemoveImage(index)}
                          style={styles.imageActionSecondaryButton}
                        >
                          <Text style={styles.imageActionSecondaryText}>
                            Remove
                          </Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Store Pin</Text>
              <Text style={styles.helperText}>
                Move the pin if the true store location changed. The pin
                coordinates remain the real location everywhere in the app.
              </Text>
              <StoreLocationPicker
                address={address}
                coordinates={locationCoordinates}
                onChange={setLocationCoordinates}
                storeName={storeName}
              />
            </View>

            {notice ? (
              <View style={styles.notice}>
                <Text style={styles.noticeText}>{notice}</Text>
              </View>
            ) : null}

            <Button
              label={isSubmitting ? "Saving..." : "Save Store Changes"}
              onPress={() => void handleSubmit()}
              disabled={isSubmitting}
              style={styles.formButton}
            />

            <Button
              label="Preview Store"
              onPress={() => router.push(`/store/${storeId}?preview=customer`)}
              variant="secondary"
              style={[styles.formButton, styles.secondaryAction]}
            />

            <Button
              label="Manage Products"
              onPress={() =>
                router.push(`/store/products/add?store=${storeId}`)
              }
              variant="secondary"
              style={[styles.formButton, styles.secondaryAction]}
            />
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
  loadingWrap: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  loadingText: {
    color: theme.colors.mutedText,
    fontSize: 14,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  backButton: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderColor: BORDER,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  backButtonText: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  headerLabel: {
    color: "#B8C2D9",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.8,
    textTransform: "uppercase",
  },
  panel: {
    backgroundColor: "rgba(10,15,31,0.82)",
    borderColor: BORDER,
    borderRadius: 28,
    borderWidth: 1,
    padding: 20,
  },
  title: {
    color: theme.colors.text,
    fontSize: 28,
    fontWeight: "700",
  },
  subtitle: {
    color: "#C7D2E5",
    fontSize: 14,
    lineHeight: 21,
    marginTop: 10,
  },
  fieldGroup: {
    gap: 8,
    marginTop: 18,
  },
  fieldLabel: {
    color: "#C7D2E5",
    fontSize: 13,
    fontWeight: "600",
  },
  helperText: {
    color: "#B8C2D9",
    fontSize: 12,
    lineHeight: 18,
  },
  inputShell: {
    backgroundColor: "rgba(10,15,31,0.5)",
    borderColor: BORDER,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  textAreaShell: {
    minHeight: 98,
  },
  input: {
    color: theme.colors.text,
    fontSize: 15,
    paddingVertical: 0,
  },
  textArea: {
    minHeight: 72,
  },
  optionRow: {
    flexDirection: "row",
    gap: 10,
  },
  optionChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "rgba(255,255,255,0.05)",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  optionChipActive: {
    backgroundColor: "rgba(74,136,255,0.16)",
    borderColor: "rgba(74,136,255,0.28)",
  },
  optionChipText: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: "700",
  },
  optionChipTextActive: {
    color: "#D9E4FF",
  },
  imageGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  imageSlot: {
    width: "48%",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: "hidden",
    backgroundColor: "rgba(17,24,39,0.92)",
  },
  imageSlotPrimary: {
    width: "100%",
  },
  imageSlotSingle: {
    width: "100%",
  },
  imageSlotHalf: {
    width: "48%",
  },
  imagePreview: {
    width: "100%",
    height: 154,
    backgroundColor: "#111827",
  },
  imagePreviewPrimary: {
    height: 208,
  },
  imagePlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    height: 154,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  imagePlaceholderPrimary: {
    height: 208,
  },
  imagePlaceholderText: {
    color: "#B8C2D9",
    fontSize: 14,
    fontWeight: "700",
  },
  imageActions: {
    flexDirection: "row",
    gap: 8,
    padding: 12,
  },
  imageActionButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 42,
    borderRadius: 14,
    backgroundColor: "rgba(74,136,255,0.14)",
    borderWidth: 1,
    borderColor: "rgba(74,136,255,0.22)",
  },
  imageActionButtonText: {
    color: "#E2EBFF",
    fontSize: 13,
    fontWeight: "800",
  },
  imageActionSecondaryButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 42,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  imageActionSecondaryText: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: "700",
  },
  notice: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderColor: BORDER,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  noticeText: {
    color: "#d7e4f2",
    fontSize: 13,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#F5F7FB",
    borderRadius: 18,
    justifyContent: "center",
    marginTop: 22,
    minHeight: 54,
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  formButton: {
    marginTop: 22,
  },
  secondaryAction: {
    marginTop: 14,
  },
  primaryButtonText: {
    color: "#0A0F1F",
    fontSize: 15,
    fontWeight: "800",
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderColor: BORDER,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: "center",
    marginTop: 14,
    minHeight: 52,
  },
  secondaryButtonText: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
});
