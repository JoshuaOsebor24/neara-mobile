import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BackPillButton } from "@/components/ui/back-pill-button";
import { RemoteProductImage } from "@/components/ui/remote-product-image";
import { theme } from "@/constants/theme";
import { prefetchImageUris } from "@/services/image-cache";
import {
  loadSearchResults,
  normalizeQuery,
  type SearchCardRecord,
} from "@/services/search-data";

export default function SearchTab() {
  const router = useRouter();
  const params = useLocalSearchParams<{ q?: string }>();
  const initialQuery = String(params.q || "").trim();
  const [query, setQuery] = useState(initialQuery);
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    const normalizedInitialQuery = normalizeQuery(String(params.q || ""));
    return normalizedInitialQuery ? [normalizedInitialQuery] : [];
  });
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [remoteResults, setRemoteResults] = useState<SearchCardRecord[]>([]);
  const [showIdle, setShowIdle] = useState(query.trim().length < 2);

  useEffect(() => {
    const nextQuery = String(params.q || "").trim();
    setQuery(nextQuery);
    setShowIdle(nextQuery.length < 2);

    const normalized = normalizeQuery(nextQuery);
    if (!normalized) {
      return;
    }

    setRecentSearches((current) => [
      normalized,
      ...current.filter((value) => value !== normalized),
    ].slice(0, 6));
  }, [params.q]);

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
    setRemoteResults([]);

    async function loadResults() {
      const result = await loadSearchResults(normalizedQuery);

      if (cancelled) return;

      if (!result.ok) {
        setRemoteResults([]);
        setErrorMessage(result.error || "Search unavailable");
        setIsLoading(false);
        return;
      }

      setRemoteResults(result.cards);
      setIsLoading(false);
    }

    const timeout = setTimeout(loadResults, 180);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [query]);

  useEffect(() => {
    void prefetchImageUris(remoteResults.slice(0, 8).map((item) => item.image));
  }, [remoteResults]);

  const results = remoteResults;

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
    ({ item }: { item: SearchCardRecord }) => {
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
                <RemoteProductImage style={styles.resultImage} uri={item.image} />
              ) : (
                <RemoteProductImage style={styles.resultImage} />
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
                      {item.productName || "Store match"}
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
                  {item.variants.length > 0 ? (
                    item.variants.map((variant, idx) => (
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
                    ))
                  ) : (
                    <View style={styles.resultVariantRow}>
                      <Text numberOfLines={1} style={styles.resultVariantLine}>
                        Open this store to view available products
                      </Text>
                    </View>
                  )}
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
              data={results}
              ListEmptyComponent={ListEmptyComponent}
              contentContainerStyle={styles.resultsList}
              initialNumToRender={6}
              keyboardDismissMode="on-drag"
              keyboardShouldPersistTaps="handled"
              keyExtractor={(item) => item.key}
              maxToRenderPerBatch={6}
              removeClippedSubviews
              renderItem={renderResultCard}
              showsVerticalScrollIndicator={false}
              updateCellsBatchingPeriod={50}
              windowSize={7}
            />
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "transparent" },
  screen: { flex: 1, backgroundColor: "transparent" },
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
    backgroundColor: theme.button.secondaryBackground,
  },
  searchShell: {
    flex: 1,
    height: 64,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    backgroundColor: theme.colors.surfaceCard,
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
    borderColor: theme.colors.borderStrong,
    backgroundColor: theme.colors.surfaceCard,
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
    backgroundColor: "rgba(19,29,49,0.88)",
    borderWidth: 1,
    borderColor: theme.colors.borderSoft,
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
    borderColor: theme.colors.borderStrong,
    backgroundColor: theme.colors.surfaceCard,
    padding: 16,
  },
  resultCardActive: {
    borderColor: "rgba(120,163,255,0.30)",
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
    backgroundColor: "rgba(255,255,255,0.14)",
    resizeMode: "cover",
  },
  resultImageFallback: {
    width: 54,
    height: 54,
    borderRadius: 14,
    backgroundColor: "rgba(74,136,255,0.14)",
    borderWidth: 1,
    borderColor: theme.colors.borderSoft,
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
    color: "#E8EEF8",
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
    color: "#B8C2D9",
    fontSize: 14,
  },
  resultVariantPrice: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: "600",
  },
  resultAside: {
    alignItems: "flex-end",
    paddingTop: 2,
  },
  resultAction: {
    color: "#B8C2D9",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    textAlign: "right",
    lineHeight: 14,
  },
  stateCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    backgroundColor: theme.colors.surfaceCard,
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
