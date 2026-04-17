import { BackPillButton } from "@/components/ui/back-pill-button";
import { theme } from "@/constants/theme";
import { showFlashFeedback } from "@/services/flash-feedback";
import { useMobileSession } from "@/services/mobile-session";
import { importProductsCsvWithBackend } from "@/services/product-api";
import {
  formatUnitCountLabel,
  parseProductImportCsv,
  PRODUCT_IMPORT_TEMPLATE,
  type ParsedProductImport,
} from "@/utils/product-import";
import * as DocumentPicker from "expo-document-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type Notice = {
  message: string;
  type: "error" | "success";
} | null;

type SelectedCsvFile = {
  mimeType?: string | null;
  name: string;
  size?: number | null;
  uri: string;
};

function formatCurrency(value: number) {
  return `₦${Number(value || 0).toLocaleString("en-NG", {
    maximumFractionDigits: 0,
  })}`;
}

function formatFileSize(value?: number | null) {
  if (!value || value <= 0) {
    return "CSV file";
  }

  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ImportProductsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ store?: string }>();
  const session = useMobileSession();
  const preferredStoreId = params.store || session.primaryStoreId || "";
  const [selectedFile, setSelectedFile] = useState<SelectedCsvFile | null>(
    null,
  );
  const [preview, setPreview] = useState<ParsedProductImport | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedStore = useMemo(() => {
    if (!preferredStoreId || !session.primaryStoreId) {
      return null;
    }

    return {
      id: session.primaryStoreId,
      meta: session.primaryStoreCategory || session.primaryStoreAddress || "",
      name: session.primaryStoreName || "Your store",
    };
  }, [
    preferredStoreId,
    session.primaryStoreAddress,
    session.primaryStoreCategory,
    session.primaryStoreId,
    session.primaryStoreName,
  ]);

  const importReady =
    Boolean(selectedFile) &&
    Boolean(preview) &&
    preview!.groups.length > 0 &&
    preview!.errors.length === 0;

  const handleDownloadTemplate = async () => {
    if (Platform.OS === "web" && typeof document !== "undefined") {
      const blob = new Blob([PRODUCT_IMPORT_TEMPLATE], {
        type: "text/csv;charset=utf-8",
      });
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = "neara-product-import-template.csv";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);
      return;
    }

    await Share.share({
      message: PRODUCT_IMPORT_TEMPLATE,
      title: "Neara CSV template",
    });
  };

  const handleUploadCsv = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: false,
      type: [
        "text/csv",
        "text/comma-separated-values",
        "application/csv",
        "application/vnd.ms-excel",
      ],
    });

    if (result.canceled || !result.assets?.[0]) {
      return;
    }

    const asset = result.assets[0];

    try {
      const fileResponse = await fetch(asset.uri);
      const csvText = await fileResponse.text();
      const parsedPreview = parseProductImportCsv(csvText);

      setSelectedFile({
        mimeType: asset.mimeType,
        name: asset.name || "products.csv",
        size: asset.size,
        uri: asset.uri,
      });
      setPreview(parsedPreview);
      setNotice(
        parsedPreview.errors.length > 0
          ? {
              message: "Fix the CSV errors before importing.",
              type: "error",
            }
          : {
              message: `${parsedPreview.groups.length} products ready to import.`,
              type: "success",
            },
      );
    } catch {
      setNotice({
        message: "We couldn't read that CSV file. Try another one.",
        type: "error",
      });
    }
  };

  const handleImport = async () => {
    if (
      !session.authToken ||
      !preferredStoreId ||
      !selectedFile ||
      !importReady
    ) {
      setNotice({
        message: "Choose a valid CSV file before importing.",
        type: "error",
      });
      return;
    }

    setIsSubmitting(true);
    setNotice(null);

    const result = await importProductsCsvWithBackend(session.authToken, {
      file: selectedFile,
      store_id: Number(preferredStoreId),
    });

    if (!result.ok) {
      if (preview && result.errors.length > 0) {
        setPreview({
          ...preview,
          errors: result.errors,
        });
      }

      setNotice({
        message: result.error,
        type: "error",
      });
      setIsSubmitting(false);
      return;
    }

    showFlashFeedback(result.message || "Products imported.");
    setNotice({
      message: `${result.count} products are ready in your store.`,
      type: "success",
    });
    setSelectedFile(null);
    setPreview(null);
    setIsSubmitting(false);
    router.replace(
      preferredStoreId ? `/store/${preferredStoreId}` : "/store-mode",
    );
  };

  return (
    <SafeAreaView edges={["top"]} style={styles.safeArea}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.keyboardAvoidingView}
      >
        <ScrollView
          bounces={false}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.pageShell}>
            <View style={styles.topBar}>
              <BackPillButton
                fallbackHref={
                  preferredStoreId
                    ? `/store/${preferredStoreId}`
                    : "/store-mode"
                }
              />
              <Text style={styles.topBarLabel}>Neara</Text>
            </View>

            <View style={styles.heroCard}>
              <Text style={styles.heroTitle}>Import Products</Text>
              <Text style={styles.heroSubtitle}>
                Upload a CSV file and import products with variants in one step.
              </Text>
            </View>

            {selectedStore ? (
              <View style={styles.storeCard}>
                <Text style={styles.sectionLabel}>Store</Text>
                <Text style={styles.storeTitle}>{selectedStore.name}</Text>
                <Text style={styles.storeMeta}>{selectedStore.meta}</Text>
              </View>
            ) : null}

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Upload</Text>
              <Text style={styles.sectionSubtitle}>
                Each CSV row represents one variant. Grouping happens
                automatically by product name.
              </Text>

              <View style={styles.buttonRow}>
                <TouchableOpacity
                  activeOpacity={0.88}
                  onPress={() => void handleUploadCsv()}
                  style={styles.primaryButton}
                >
                  <Text style={styles.primaryButtonText}>Upload CSV</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => void handleDownloadTemplate()}
                  style={styles.secondaryButton}
                >
                  <Text style={styles.secondaryButtonText}>
                    Download template
                  </Text>
                </TouchableOpacity>
              </View>

              {selectedFile ? (
                <View style={styles.fileCard}>
                  <Text style={styles.fileTitle}>{selectedFile.name}</Text>
                  <Text style={styles.fileMeta}>
                    {formatFileSize(selectedFile.size)}
                    {preview
                      ? ` • ${preview.totalRows} rows • ${preview.groups.length} products`
                      : ""}
                  </Text>
                </View>
              ) : null}
            </View>

            {notice ? (
              <View
                style={[
                  styles.noticeCard,
                  notice.type === "error"
                    ? styles.noticeError
                    : styles.noticeSuccess,
                ]}
              >
                <Text style={styles.noticeText}>{notice.message}</Text>
              </View>
            ) : null}

            {preview?.errors.length ? (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>CSV errors</Text>
                <Text style={styles.sectionSubtitle}>
                  Fix these rows, then upload the file again.
                </Text>
                <View style={styles.errorList}>
                  {preview.errors.map((error, index) => (
                    <Text
                      key={`${error.row}:${index}`}
                      style={styles.errorText}
                    >
                      {`Row ${error.row} → ${error.message}`}
                    </Text>
                  ))}
                </View>
              </View>
            ) : null}

            {preview?.groups.length ? (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Preview</Text>
                <Text style={styles.sectionSubtitle}>
                  Search and grouping are based on the imported product and
                  variant data below.
                </Text>

                <View style={styles.previewList}>
                  {preview.groups.map((group) => (
                    <View key={group.productName} style={styles.previewCard}>
                      <View style={styles.previewHeader}>
                        <View style={styles.previewHeaderText}>
                          <Text style={styles.previewTitle}>
                            {group.productName}
                          </Text>
                          <Text style={styles.previewMeta}>
                            {group.category || "No category"}
                            {group.tags.length > 0
                              ? ` • ${group.tags.join(", ")}`
                              : ""}
                          </Text>
                        </View>
                        <Text style={styles.previewBadge}>
                          {group.variants.length} variant
                          {group.variants.length === 1 ? "" : "s"}
                        </Text>
                      </View>

                      {group.variants.map((variant) => (
                        <View
                          key={`${group.productName}:${variant.variantName}`}
                          style={styles.variantRow}
                        >
                          <View style={styles.variantTextWrap}>
                            <Text style={styles.variantName}>
                              {variant.variantName}
                            </Text>
                            <Text style={styles.variantMeta}>
                              {formatCurrency(variant.price)} •{" "}
                              {formatUnitCountLabel(variant.unitCount)}
                              {variant.stock !== null
                                ? ` • ${variant.stock} in stock`
                                : ""}
                            </Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            <TouchableOpacity
              activeOpacity={0.9}
              disabled={!importReady || isSubmitting}
              onPress={() => void handleImport()}
              style={[
                styles.importButton,
                (!importReady || isSubmitting) && styles.importButtonDisabled,
              ]}
            >
              <Text style={styles.importButtonText}>
                {isSubmitting ? "Importing..." : "Import products"}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: "transparent",
    flex: 1,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 36,
  },
  pageShell: {
    gap: 16,
    paddingHorizontal: 18,
    paddingTop: 8,
  },
  topBar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  topBarLabel: {
    color: theme.colors.mutedText,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  heroCard: {
    backgroundColor: theme.colors.surfaceCard,
    borderColor: theme.colors.borderStrong,
    borderRadius: 26,
    borderWidth: 1,
    gap: 8,
    padding: 22,
  },
  heroTitle: {
    color: theme.colors.text,
    fontSize: 28,
    fontWeight: "800",
  },
  heroSubtitle: {
    color: theme.colors.mutedText,
    fontSize: 15,
    lineHeight: 22,
  },
  storeCard: {
    backgroundColor: theme.colors.surfaceElevated,
    borderColor: theme.colors.border,
    borderRadius: 22,
    borderWidth: 1,
    gap: 6,
    padding: 18,
  },
  sectionLabel: {
    color: "#D9E4FF",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  storeTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: "700",
  },
  storeMeta: {
    color: theme.colors.mutedText,
    fontSize: 13,
    lineHeight: 19,
  },
  card: {
    backgroundColor: theme.colors.surfaceCard,
    borderColor: theme.colors.border,
    borderRadius: 24,
    borderWidth: 1,
    gap: 16,
    padding: 18,
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: 19,
    fontWeight: "700",
  },
  sectionSubtitle: {
    color: theme.colors.mutedText,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 10,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: theme.colors.accent,
    borderRadius: 16,
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  primaryButtonText: {
    color: "#F7FAFF",
    fontSize: 15,
    fontWeight: "700",
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: theme.button.secondaryBackground,
    borderColor: theme.colors.border,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  secondaryButtonText: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: "600",
  },
  fileCard: {
    backgroundColor: theme.colors.surfaceOverlay,
    borderRadius: 18,
    gap: 4,
    padding: 14,
  },
  fileTitle: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  fileMeta: {
    color: theme.colors.mutedText,
    fontSize: 13,
  },
  noticeCard: {
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  noticeError: {
    backgroundColor: theme.colors.surfaceElevated,
    borderColor: theme.colors.borderStrong,
    borderWidth: 1,
  },
  noticeSuccess: {
    backgroundColor: "rgba(74,136,255,0.16)",
    borderColor: theme.colors.borderStrong,
    borderWidth: 1,
  },
  noticeText: {
    color: theme.colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  errorList: {
    gap: 10,
  },
  errorText: {
    color: theme.colors.subduedText,
    fontSize: 14,
    lineHeight: 20,
  },
  previewList: {
    gap: 14,
  },
  previewCard: {
    backgroundColor: theme.colors.surfaceOverlay,
    borderColor: theme.colors.borderSoft,
    borderRadius: 20,
    borderWidth: 1,
    gap: 12,
    padding: 16,
  },
  previewHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
  },
  previewHeaderText: {
    flex: 1,
    gap: 4,
  },
  previewTitle: {
    color: theme.colors.text,
    fontSize: 17,
    fontWeight: "700",
  },
  previewMeta: {
    color: theme.colors.mutedText,
    fontSize: 13,
    lineHeight: 18,
  },
  previewBadge: {
    backgroundColor: "rgba(74,136,255,0.18)",
    borderRadius: 999,
    color: theme.colors.subduedText,
    fontSize: 12,
    fontWeight: "700",
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  variantRow: {
    borderTopColor: theme.colors.borderSoft,
    borderTopWidth: 1,
    paddingTop: 12,
  },
  variantTextWrap: {
    gap: 4,
  },
  variantName: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: "600",
  },
  variantMeta: {
    color: theme.colors.mutedText,
    fontSize: 13,
    lineHeight: 19,
  },
  importButton: {
    alignItems: "center",
    backgroundColor: theme.colors.accent,
    borderRadius: 18,
    marginTop: 4,
    paddingVertical: 17,
  },
  importButtonDisabled: {
    backgroundColor: "rgba(74,136,255,0.35)",
  },
  importButtonText: {
    color: "#F7FAFF",
    fontSize: 16,
    fontWeight: "800",
  },
});
