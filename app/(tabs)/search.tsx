import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BackPillButton } from "@/components/ui/back-pill-button";
import { theme } from "@/constants/theme";
import {
  searchProducts,
  type SearchProductResult,
} from "@/services/search-api";

type SearchResultItem = {
  id: string;
  productId: string;
  storeId: string;
  store: string;
  productName: string;
  variant: string;
  category: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  price: number | null;
  distance: string;
  image?: string | null;
};

type SearchCardVariant = {
  key: string;
  label: string | null;
  priceLabel?: string;
};

type SearchCardItem = {
  key: string;
  productId: string;
  storeId: string;
  store: string;
  productName: string;
  variants: SearchCardVariant[];
  image?: string | null;
  distance?: string;
  category?: string;
  address?: string;
  latitude?: number | null;
  longitude?: number | null;
};

function formatPrice(price: number | null) {
  if (price === null) {
    return "View store";
  }
  return `₦${price.toLocaleString("en-NG")}`;
}

function normalizeQuery(value: string) {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function parseCoordinate(value: number | string | null | undefined) {
  const parsed =
    typeof value === "number" ? value : value ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function buildStoreInitial(name: string) {
  const trimmed = name.trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : "N";
}

function groupSearchResults(items: SearchResultItem[]) {
  const groups = new Map<string, SearchCardItem>();

  items.forEach((item) => {
    const normalizedProductName = item.productName.trim().toLowerCase();
    const key = item.productId
      ? `${item.storeId}::${item.productId}`
      : `${item.storeId}::${normalizedProductName}`;
    const priceLabel =
      item.price !== null ? formatPrice(item.price) : undefined;
    const variantLabel = item.variant.trim() || null;
    const variantKey = `${item.id}::${variantLabel || "base"}::${priceLabel || "no-price"}`;
    const existing = groups.get(key);

    if (!existing) {
      groups.set(key, {
        key,
        productId: item.productId,
        storeId: item.storeId,
        store: item.store,
        productName: item.productName,
        variants: [{ key: variantKey, label: variantLabel, priceLabel }],
        image: item.image || null,
        distance: item.distance || "",
        category: item.category || "",
        address: item.address || "",
        latitude: item.latitude,
        longitude: item.longitude,
      });
      return;
    }

    if (
      !existing.variants.some(
        (v) => v.label === variantLabel && v.priceLabel === priceLabel,
      )
    ) {
      existing.variants.push({
        key: variantKey,
        label: variantLabel,
        priceLabel,
      });
    }
  });

  return Array.from(groups.values());
}

export default function SearchTab() {
  const router = useRouter();
  const params = useLocalSearchParams<{ q?: string }>();
  const [query, setQuery] = useState(() => String(params.q || "").trim());
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    const initialQuery = normalizeQuery(String(params.q || ""));
    return initialQuery ? [initialQuery] : [];
  });
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [remoteResults, setRemoteResults] = useState<SearchResultItem[]>([]);
  const [showIdle, setShowIdle] = useState(query.trim().length < 2);

  useEffect(() => {
    let cancelled = false;

    const normalizedQuery = normalizeQuery(query);
    if (normalizedQuery.length < 2) {
      setRemoteResults([]);
      setErrorMessage("");
      setIsLoading(false);
      setShowIdle(true);
      return;
    }

    setShowIdle(false);
    setIsLoading(true);
    setErrorMessage("");

    async function loadResults() {
      const result = await searchProducts(normalizedQuery);

      if (cancelled) return;

      if (!result.ok) {
        setRemoteResults([]);
        setErrorMessage(result.error || "Search unavailable");
        setIsLoading(false);
        return;
      }

      const mappedResults = result.results
        .filter(
          (item: SearchProductResult) =>
            item.store_id && item.store_name && item.product_name,
        )
        .map((item: SearchProductResult, index: number) => ({
          category: item.category || "",
          address: item.address || "",
          distance: item.distance || "",
          latitude: parseCoordinate(item.latitude),
          longitude: parseCoordinate(item.longitude),
          price:
            typeof item.price === "number"
              ? item.price
              : Number(item.price || 0),
          productId: String(item.product_id || ""),
          productName: item.product_name || "",
          store: item.store_name || "",
          storeId: String(item.store_id),
          variant: item.variant_name || item.variant || "",
          id: `${item.store_id}-${item.product_id || index}`,
          image: item.image_url || null,
        }));

      setRemoteResults(mappedResults);
      setIsLoading(false);
    }

    const timeout = setTimeout(loadResults, 180);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [query]);

  const results = useMemo(() => {
    const normalized = normalizeQuery(query);
    return remoteResults.filter(
      (item) =>
        !normalized ||
        item.productName.toLowerCase().includes(normalized) ||
        item.store.toLowerCase().includes(normalized) ||
        item.category.toLowerCase().includes(normalized),
    );
  }, [query, remoteResults]);

  const groupedResults = useMemo(() => groupSearchResults(results), [results]);

  const tooShort = query.trim().length > 0 && query.trim().length < 2;
  const hasQuery = normalizeQuery(query).length >= 2;

  const handleSubmitSearch = () => {
    const normalized = normalizeQuery(query);
    if (normalized.length < 2) return;
    setRecentSearches((current) => {
      const next = [
        normalized,
        ...current.filter((s) => s !== normalized),
      ].slice(0, 6);
      return next;
    });
  };

  const renderResultCard = useCallback(
    ({ item }: { item: SearchCardItem }) => {
      const isActive = activeId === item.key;
      return (
        <View style={styles.resultCardWrap}>
          <Pressable
            onPress={() => {
              setActiveId(item.key);
              router.push(`/store/${item.storeId}`);
            }}
            style={[styles.resultCard, isActive && styles.resultCardActive]}
          >
            <View style={styles.resultCardInner}>
              {item.image ? (
                <Image
                  source={{ uri: item.image }}
                  style={styles.resultImage}
                />
              ) : (
                <View style={styles.resultImageFallback}>
                  <Text style={styles.resultImageFallbackText}>
                    {buildStoreInitial(item.store)}
                  </Text>
                </View>
              )}
              <View style={styles.resultMain}>
                <View style={styles.resultTopRow}>
                  <View style={styles.resultTopMain}>
                    <View style={styles.resultStoreRow}>
                      <Text numberOfLines={1} style={styles.resultStoreName}>
                        {item.store}
                      </Text>
                    </View>
                    <Text numberOfLines={1} style={styles.resultProductName}>
                      {item.productName}
                    </Text>
                    <View style={styles.resultMetaRow}>
                      {item.category && (
                        <Text style={styles.resultMetaText}>
                          {item.category}
                        </Text>
                      )}
                      {item.distance && (
                        <Text style={styles.resultMetaText}>
                          {item.distance}
                        </Text>
                      )}
                    </View>
                  </View>
                  <View style={styles.resultAside}>
                    <Text style={styles.resultAction}>VIEW{"\n"}STORE</Text>
                  </View>
                </View>
                <View style={styles.resultVariantBlock}>
                  {item.variants.map((variant, idx) => (
                    <View
                      key={`${variant.key}-${idx}`}
                      style={styles.resultVariantRow}
                    >
                      <Text numberOfLines={1} style={styles.resultVariantLine}>
                        {variant.label ||
                          (item.variants.length > 1
                            ? `Option ${idx + 1}`
                            : "Available")}
                      </Text>
                      {variant.priceLabel && (
                        <Text style={styles.resultVariantPrice}>
                          {variant.priceLabel}
                        </Text>
                      )}
                    </View>
                  ))}
                </View>
              </View>
            </View>
          </Pressable>
        </View>
      );
    },
    [activeId, router],
  );

  const renderStateCard = (title: string, detail: string) => (
    <View style={styles.stateCard}>
      <Text style={styles.stateTitle}>{title}</Text>
      <Text style={styles.stateDetail}>{detail}</Text>
    </View>
  );

  const ListEmptyComponent = () => {
    if (isLoading && hasQuery)
      return renderStateCard("Searching", "Looking for products near you.");
    if (tooShort)
      return renderStateCard("Start typing", "Enter at least 2 characters.");
    if (errorMessage) return renderStateCard("Unavailable", errorMessage);
    return renderStateCard("No results", "Try different keywords.");
  };

  return (
    <SafeAreaView edges={["top"]} style={styles.safeArea}>
      <StatusBar style="light" />
      <View style={styles.screen}>
        <View style={styles.searchTopBar}>
          <BackPillButton fallbackHref="/(tabs)/home" />

          <View style={styles.searchShell}>
            <TextInput
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={handleSubmitSearch}
              placeholder="Search stores and products"
              placeholderTextColor={theme.colors.mutedText}
              selectionColor={theme.colors.accent}
              style={styles.searchInput}
              returnKeyType="search"
              autoFocus
            />
          </View>
        </View>

        <View style={styles.resultsContainer}>
          {recentSearches.length > 0 ? (
            <View style={styles.recentSearchesCard}>
              <View style={styles.recentSearchesHeader}>
                <Text style={styles.recentSearchesLabel}>RECENT SEARCHES</Text>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => setRecentSearches([])}
                >
                  <Text style={styles.recentSearchesClear}>Clear</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.recentChips}>
                {recentSearches.map((search, idx) => (
                  <TouchableOpacity
                    key={`${search}-${idx}`}
                    onPress={() => {
                      setQuery(search);
                      setShowIdle(false);
                    }}
                    style={styles.recentChip}
                  >
                    <Text style={styles.recentChipText}>{search}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : null}

          {showIdle ? (
            <View style={styles.idleContent}>
              <Text style={styles.idleTitle}>Search stores and products</Text>
              <Text style={styles.idleSubtitle}>
                Discover what&apos;s nearby
              </Text>
            </View>
          ) : (
            <FlatList
              data={groupedResults}
              renderItem={renderResultCard}
              keyExtractor={(item) => item.key}
              ListEmptyComponent={ListEmptyComponent}
              contentContainerStyle={styles.resultsList}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
            />
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#0b1220" },
  screen: { flex: 1, backgroundColor: "#0b1220" },
  searchTopBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 18,
  },
  backButton: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  searchShell: {
    flex: 1,
    height: 64,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(16,26,46,0.92)",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  searchInput: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 17,
    fontWeight: "500",
    paddingVertical: 0,
  },
  recentSearchesCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(10, 18, 32, 0.92)",
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 12,
  },
  recentSearchesHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  recentSearchesLabel: {
    color: "#a5b4cf",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 3,
  },
  recentSearchesClear: {
    color: "#8ec1ff",
    fontSize: 14,
    fontWeight: "700",
  },
  idleContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
    gap: 24,
  },
  idleTitle: {
    color: theme.colors.text,
    fontSize: 28,
    fontWeight: "800",
    textAlign: "center",
    lineHeight: 32,
  },
  idleSubtitle: {
    color: theme.colors.mutedText,
    fontSize: 16,
    textAlign: "center",
    lineHeight: 24,
  },
  recentChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  recentChip: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  recentChipText: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: "600",
  },
  resultsContainer: {
    flex: 1,
    paddingBottom: 12,
  },
  resultsList: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    flexGrow: 1,
  },
  resultCardWrap: {},
  resultCard: {
    marginBottom: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(16,26,46,0.94)",
    padding: 16,
  },
  resultCardActive: {
    borderColor: "rgba(96,165,250,0.42)",
  },
  resultCardInner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
  },
  resultImage: {
    width: 54,
    height: 54,
    borderRadius: 14,
    backgroundColor: "#1e293b",
    resizeMode: "cover",
  },
  resultImageFallback: {
    width: 54,
    height: 54,
    borderRadius: 14,
    backgroundColor: "rgba(59,130,246,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  resultImageFallbackText: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: "600",
  },
  resultMain: {
    flex: 1,
    paddingTop: 2,
  },
  resultTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  resultTopMain: {
    flex: 1,
  },
  resultStoreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  resultStoreName: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: "800",
  },
  resultProductName: {
    marginTop: 4,
    color: "#e2e8f0",
    fontSize: 14,
    fontWeight: "700",
  },
  resultMetaRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 4,
  },
  resultMetaText: {
    color: theme.colors.mutedText,
    fontSize: 12,
    fontWeight: "600",
  },
  resultVariantBlock: {
    marginTop: 12,
    gap: 8,
  },
  resultVariantRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  resultVariantLine: {
    flex: 1,
    color: "#94a3b8",
    fontSize: 14,
  },
  resultVariantPrice: {
    color: "#f1f5f9",
    fontSize: 14,
    fontWeight: "600",
  },
  resultAside: {
    alignItems: "flex-end",
    paddingTop: 2,
  },
  resultAction: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    textAlign: "right",
    lineHeight: 14,
  },
  stateCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(16,26,46,0.9)",
    padding: 20,
    gap: 8,
    marginHorizontal: 20,
    marginTop: 20,
  },
  stateTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: "800",
  },
  stateDetail: {
    color: theme.colors.mutedText,
    fontSize: 15,
    lineHeight: 22,
  },
});
