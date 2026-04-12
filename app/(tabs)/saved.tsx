import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { SavedStoreCard } from "@/components/saved/saved-store-card";
import { BackPillButton } from "@/components/ui/back-pill-button";
import { ScreenCard } from "@/components/ui/screen-card";
import { LoadingCard, SkeletonCard } from "@/components/ux-state";
import { theme } from "@/constants/theme";
import { useMobileSession } from "@/services/mobile-session";
import {
  loadSavedStoresForSession,
  unsaveStore,
  useSavedStores,
} from "@/services/saved-stores";

type Notice = {
  text: string;
  type: "error" | "success";
} | null;

export default function SavedTab() {
  const router = useRouter();
  const session = useMobileSession();
  const savedStores = useSavedStores();
  const [notice, setNotice] = useState<Notice>(null);
  const [removingStoreId, setRemovingStoreId] = useState<number | null>(null);
  const [optimisticRemovedIds, setOptimisticRemovedIds] = useState<number[]>(
    [],
  );
  const [isLoading, setIsLoading] = useState(false);

  const isAuthenticated = session.isAuthenticated;

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, router]);

  useEffect(() => {
    let cancelled = false;

    const loadSavedStores = async () => {
      if (!isAuthenticated) {
        setIsLoading(false);
        return;
      }

      if (!cancelled && savedStores.length === 0) {
        setIsLoading(true);
      }

      try {
        await loadSavedStoresForSession();
      } catch (error) {
        if (!cancelled) {
          setNotice({
            text:
              error instanceof Error
                ? error.message
                : "Could not load saved stores.",
            type: "error",
          });
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadSavedStores();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, savedStores.length, session.authToken]);

  const visibleSavedStores = useMemo(
    () =>
      savedStores.filter(
        (store) => !optimisticRemovedIds.includes(store.store_id),
      ),
    [optimisticRemovedIds, savedStores],
  );

  if (!isAuthenticated) {
    return (
      <SafeAreaView edges={["top"]} style={styles.safeArea}>
        <StatusBar style="light" />
        <View style={styles.redirectWrap}>
          <Text style={styles.redirectText}>Opening login...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const showEmptyState = !isLoading && visibleSavedStores.length === 0;

  return (
    <SafeAreaView edges={["top"]} style={styles.safeArea}>
      <StatusBar style="light" />

      <ScrollView
        bounces={false}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.pageShell}>
          <View style={styles.topBar}>
            <BackPillButton fallbackHref="/(tabs)/home" />

            <Text style={styles.topBarLabel}>NEARA</Text>
          </View>

          <ScreenCard style={styles.mainCard}>
            <Text style={styles.pageTitle}>Saved</Text>

            {notice ? (
              <View
                style={[
                  styles.noticeCard,
                  notice.type === "error"
                    ? styles.noticeError
                    : styles.noticeSuccess,
                ]}
              >
                <Text style={styles.noticeText}>{notice.text}</Text>
              </View>
            ) : null}

            {isLoading && visibleSavedStores.length === 0 ? (
              <View style={styles.stateWrap}>
                <LoadingCard
                  message="Loading saved stores"
                  detail="Checking your favorites."
                />
                <SkeletonCard height={92} />
                <SkeletonCard height={92} />
                <SkeletonCard height={92} />
              </View>
            ) : null}

            {showEmptyState ? (
              <View style={styles.emptyStateWrap}>
                <Ionicons
                  color="rgba(74,136,255,0.6)"
                  name="bookmark-outline"
                  size={48}
                  style={styles.emptyStateIcon}
                />
                <Text style={styles.emptyStateTitle}>No saved stores yet</Text>
                <Text style={styles.emptyStateContext}>
                  Stores you save will appear here
                </Text>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => router.push("/(tabs)/home")}
                  style={styles.exploreButton}
                >
                  <Text style={styles.exploreButtonText}>Explore stores</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {visibleSavedStores.length > 0 ? (
              <View style={styles.savedList}>
                {visibleSavedStores.map((store) => (
                  <SavedStoreCard
                    isRemoving={removingStoreId === store.store_id}
                    key={store.store_id}
                    onOpen={() => router.push(`/store/${store.store_id}`)}
                    onUnsave={async () => {
                      if (!session.authToken) {
                        setNotice({
                          text: "Log in again to manage saved stores.",
                          type: "error",
                        });
                        return;
                      }

                      setRemovingStoreId(store.store_id);
                      setNotice(null);
                      setOptimisticRemovedIds((current) => [
                        ...current,
                        store.store_id,
                      ]);

                      try {
                        await unsaveStore(session.authToken, store.store_id);
                        setNotice({
                          text: "Removed from saved.",
                          type: "success",
                        });
                      } catch (error) {
                        setOptimisticRemovedIds((current) =>
                          current.filter((id) => id !== store.store_id),
                        );
                        setNotice({
                          text:
                            error instanceof Error
                              ? error.message
                              : "Could not remove this store.",
                          type: "error",
                        });
                      } finally {
                        setRemovingStoreId(null);
                      }
                    }}
                    store={store}
                  />
                ))}
              </View>
            ) : null}
          </ScreenCard>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "transparent",
  },
  scrollContent: {
    paddingBottom: 44,
    paddingTop: 6,
  },
  pageShell: {
    paddingHorizontal: theme.spacing.screenHorizontal,
  },
  redirectWrap: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  redirectText: {
    color: theme.colors.mutedText,
    fontSize: 16,
  },
  topBar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 28,
  },
  topBarLabel: {
    color: "#8b97ab",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 4,
  },
  mainCard: {
    minHeight: 520,
    paddingBottom: 26,
    paddingHorizontal: 26,
    paddingTop: 26,
  },
  pageTitle: {
    color: theme.colors.text,
    fontSize: theme.typography.pageTitle.fontSize,
    fontWeight: theme.typography.pageTitle.fontWeight,
    marginBottom: 14,
  },
  noticeCard: {
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  noticeError: {
    backgroundColor: "rgba(17,24,39,0.28)",
    borderColor: "rgba(255,255,255,0.18)",
  },
  noticeSuccess: {
    backgroundColor: "rgba(6, 78, 59, 0.3)",
    borderColor: "rgba(74,136,255,0.16)",
  },
  noticeText: {
    color: theme.colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  emptyStateWrap: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    minHeight: 280,
    paddingBottom: 26,
  },
  emptyStateIcon: {
    marginBottom: 20,
  },
  emptyStateTitle: {
    color: "#e5edf8",
    fontSize: 23,
    fontWeight: "500",
    marginBottom: 8,
    textAlign: "center",
  },
  emptyStateContext: {
    color: "#8f9db4",
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 24,
    textAlign: "center",
  },
  exploreButton: {
    alignItems: "center",
    backgroundColor: "rgba(74,136,255,0.12)",
    borderColor: "rgba(74,136,255,0.20)",
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
    minWidth: 140,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  exploreButtonText: {
    color: "#4A88FF",
    fontSize: 16,
    fontWeight: "600",
  },
  stateWrap: {
    gap: 12,
  },
  savedList: {
    gap: 14,
    marginTop: 8,
  },
});
