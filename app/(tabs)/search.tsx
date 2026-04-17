import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  SearchResultCard as SearchResultListCard,
  type SearchResultCardVariant,
} from "@/components/search/search-result-card";
import { BackPillButton } from "@/components/ui/back-pill-button";
import { EmptyCard, ErrorCard, LoadingCard } from "@/components/ux-state";
import { theme } from "@/constants/theme";
import { prefetchImageUris } from "@/services/image-cache";
import {
  loadSearchResults,
  normalizeQuery,
  type SearchCardRecord,
} from "@/services/search-data";

const SearchResultRow = memo(function SearchResultRow({
  animationIndex,
  animationTriggerKey,
  item,
  onPress,
}: {
  animationIndex: number;
  animationTriggerKey: string;
  item: SearchCardRecord;
  onPress: (storeId: string) => void;
}) {
  const variants: SearchResultCardVariant[] = item.variants.map((variant) => ({
    key: variant.key,
    label: variant.label,
    value: variant.priceLabel,
  }));

  return (
    <View style={styles.resultCardWrap}>
      <SearchResultListCard
        actionLabel="View"
        animationIndex={animationIndex}
        animationTriggerKey={animationTriggerKey}
        category={item.category}
        distance={item.distance}
        image={item.image}
        onPress={() => onPress(item.storeId)}
        primaryText={item.store}
        secondaryText={item.productName || "Store match"}
        variants={variants}
      />
    </View>
  );
});

export default function SearchTab() {
  const router = useRouter();
  const params = useLocalSearchParams<{ q?: string }>();
  const initialQuery = String(params.q || "").trim();
  const [query, setQuery] = useState(initialQuery);
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    const normalizedInitialQuery = normalizeQuery(String(params.q || ""));
    return normalizedInitialQuery ? [normalizedInitialQuery] : [];
  });
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

    setRecentSearches((current) =>
      [normalized, ...current.filter((value) => value !== normalized)].slice(
        0,
        6,
      ),
    );
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
        setErrorMessage(
          result.error || "We couldn't load search results right now.",
        );
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
  const resultsAnimationKey = useMemo(
    () => results.map((item) => item.key).join("|"),
    [results],
  );

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
    ({ item, index }: { index: number; item: SearchCardRecord }) => {
      return (
        <SearchResultRow
          animationIndex={index}
          animationTriggerKey={resultsAnimationKey}
          item={item}
          onPress={(storeId) => router.push(`/store/${storeId}`)}
        />
      );
    },
    [resultsAnimationKey, router],
  );

  const ListEmptyComponent = () => {
    if (isLoading && hasQuery) {
      return <LoadingCard message="Searching" detail="Looking nearby." />;
    }
    if (tooShort) {
      return <EmptyCard title="Keep typing" detail="Enter 2+ characters." />;
    }
    if (errorMessage) {
      return <ErrorCard title="Search paused" detail={errorMessage} />;
    }
    return <EmptyCard title="No results" detail="Try another keyword." />;
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
              placeholder="Search products or stores"
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
                <Text style={styles.recentSearchesLabel}>RECENT</Text>
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
              <Text style={styles.idleTitle}>Search</Text>
              <Text style={styles.idleSubtitle}>Stores and products</Text>
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
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
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
    minHeight: theme.controls.inputHeight,
    borderRadius: theme.form.inputRadius,
    borderWidth: 1,
    borderColor: theme.form.inputBorder,
    backgroundColor: theme.form.inputBackground,
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  searchInput: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 15,
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
  resultCardWrap: {
    marginBottom: 10,
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
