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
import { EmptyCard, LoadingCard, SkeletonCard } from "@/components/ux-state";
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
                : "We couldn't load your saved stores right now.",
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
  const savedStoreCount = visibleSavedStores.length;

  return (
    <SafeAreaView edges={["top"]} style={styles.safeArea}>
      <StatusBar style="light" />

      <ScrollView
        bounces={false}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.pageShell}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <BackPillButton fallbackHref="/(tabs)/home" />
              <Text style={styles.headerTitle}>Saved</Text>
            </View>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => router.push("/(tabs)/home")}
              style={styles.headerAction}
            >
              <Text style={styles.headerActionText}>Browse</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />

          <ScreenCard style={styles.panel}>
            <View style={styles.panelHeader}>
              <Text style={styles.panelTitle}>Saved Stores</Text>
              <View style={styles.limitBadge}>
                <Text style={styles.limitBadgeText}>
                  {savedStoreCount === 0
                    ? "No saved stores yet"
                    : `${savedStoreCount} saved store${savedStoreCount === 1 ? "" : "s"}`}
                </Text>
              </View>
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
              <EmptyCard
                title="No saved stores yet"
                detail="Browse stores and save the ones you want to come back to later."
              />
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
                              : "We couldn't remove this store right now.",
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
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 32,
  },
  pageShell: {
    width: "100%",
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
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  headerLeft: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
  headerTitle: {
    color: theme.colors.text,
    fontSize: 24,
    fontWeight: "700",
  },
  headerAction: {
    alignItems: "center",
    backgroundColor: "rgba(74,136,255,0.12)",
    borderColor: "rgba(74,136,255,0.20)",
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
    minWidth: 104,
    paddingHorizontal: 16,
  },
  headerActionText: {
    color: "#4A88FF",
    fontSize: 14,
    fontWeight: "700",
  },
  divider: {
    backgroundColor: "rgba(255,255,255,0.08)",
    height: 1,
    marginBottom: 16,
    marginHorizontal: 16,
  },
  panel: {
    backgroundColor: "transparent",
    borderColor: "transparent",
    elevation: 0,
    padding: 16,
    shadowOpacity: 0,
    shadowRadius: 0,
  },
  panelHeader: {
    marginBottom: 16,
  },
  panelTitle: {
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: "700",
  },
  limitBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(74,136,255,0.12)",
    borderColor: "rgba(74,136,255,0.20)",
    borderRadius: 999,
    borderWidth: 1,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  limitBadgeText: {
    color: "#4A88FF",
    fontSize: 12,
    fontWeight: "600",
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
  stateWrap: {
    gap: 12,
  },
  savedList: {
    gap: 14,
  },
});
