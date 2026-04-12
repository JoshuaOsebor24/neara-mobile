import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BackPillButton } from "@/components/ui/back-pill-button";
import { theme } from "@/constants/theme";
import { useMobileSession } from "@/services/mobile-session";
import {
  loadRecentStoresForSession,
  loadSavedStoresForSession,
  useRecentStores,
  useSavedStores,
} from "@/services/saved-stores";

function formatStoreMeta(category?: string | null, address?: string | null) {
  const parts = [category, address]
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean);

  if (parts.length === 0) {
    return "Local store";
  }

  return parts.join(" • ");
}

export default function CartScreen() {
  const router = useRouter();
  const session = useMobileSession();
  const recentStores = useRecentStores().slice(0, 3);
  const savedStores = useSavedStores().slice(0, 3);

  useEffect(() => {
    void loadRecentStoresForSession();

    if (session.isAuthenticated) {
      void loadSavedStoresForSession();
    }
  }, [session.isAuthenticated, session.authToken]);

  const recommendedStores = savedStores.length > 0 ? savedStores : recentStores;

  return (
    <SafeAreaView edges={["top"]} style={styles.safeArea}>
      <StatusBar style="light" />

      <ScrollView
        bounces={false}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.page}>
          <View style={styles.header}>
            <BackPillButton fallbackHref="/(tabs)/home" />
            <Text style={styles.headerLabel}>Cart</Text>
          </View>

          <View style={styles.heroCard}>
            <Text style={styles.eyebrow}>Cart</Text>
            <Text style={styles.title}>Your cart is empty</Text>
            <Text style={styles.body}>
              Neara shopping still starts with stores. Find a store, confirm
              what is available, then continue from there.
            </Text>

            <View style={styles.actions}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => router.push("/search")}
                style={styles.primaryButton}
              >
                <Text style={styles.primaryButtonText}>Find products</Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => router.push("/(tabs)/saved")}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonText}>
                  Open saved stores
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                {savedStores.length > 0 ? "Saved stores" : "Recently viewed"}
              </Text>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() =>
                  router.push(
                    savedStores.length > 0 ? "/saved-stores" : "/(tabs)/home",
                  )
                }
              >
                <Text style={styles.sectionAction}>
                  {savedStores.length > 0 ? "See all" : "Browse"}
                </Text>
              </TouchableOpacity>
            </View>

            {recommendedStores.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No stores yet</Text>
                <Text style={styles.emptyBody}>
                  Search for products or open a store to keep it here.
                </Text>
              </View>
            ) : (
              <View style={styles.storeList}>
                {recommendedStores.map((store) => (
                  <TouchableOpacity
                    key={store.store_id}
                    activeOpacity={0.85}
                    onPress={() => router.push(`/store/${store.store_id}`)}
                    style={styles.storeCard}
                  >
                    {store.image_url ? (
                      <Image
                        source={{ uri: store.image_url }}
                        style={styles.storeImage}
                      />
                    ) : (
                      <View style={styles.storeImageFallback}>
                        <Text style={styles.storeImageFallbackText}>
                          {store.store_name.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}

                    <View style={styles.storeBody}>
                      <View style={styles.storeTitleRow}>
                        <Text style={styles.storeName}>{store.store_name}</Text>
                      </View>
                      <Text style={styles.storeMeta}>
                        {formatStoreMeta(store.category, store.address)}
                      </Text>
                      <Text style={styles.storeLink}>Open store</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const BORDER = "rgba(255,255,255,0.10)";

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 32,
  },
  page: {
    width: "100%",
    gap: 18,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  backButton: {
    backgroundColor: "rgba(17,24,39,0.72)",
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
    color: theme.colors.mutedText,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 2.2,
    textTransform: "uppercase",
  },
  heroCard: {
    backgroundColor: "rgba(17,24,39,0.78)",
    borderColor: BORDER,
    borderRadius: 28,
    borderWidth: 1,
    padding: 24,
  },
  eyebrow: {
    color: "#D4E1FF",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.8,
    textTransform: "uppercase",
  },
  title: {
    color: theme.colors.text,
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: -0.7,
    marginTop: 12,
  },
  body: {
    color: theme.colors.mutedText,
    fontSize: 14,
    lineHeight: 22,
    marginTop: 10,
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 20,
  },
  primaryButton: {
    backgroundColor: theme.colors.accent,
    borderRadius: 18,
    minHeight: 50,
    paddingHorizontal: 18,
    justifyContent: "center",
  },
  primaryButtonText: {
    color: "#F5F7FB",
    fontSize: 15,
    fontWeight: "800",
  },
  secondaryButton: {
    borderColor: BORDER,
    borderRadius: 18,
    borderWidth: 1,
    minHeight: 50,
    paddingHorizontal: 18,
    justifyContent: "center",
  },
  secondaryButtonText: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  sectionCard: {
    backgroundColor: "rgba(17,24,39,0.72)",
    borderColor: BORDER,
    borderRadius: 24,
    borderWidth: 1,
    padding: 18,
  },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: "700",
  },
  sectionAction: {
    color: theme.colors.accent,
    fontSize: 13,
    fontWeight: "700",
  },
  emptyCard: {
    backgroundColor: "rgba(10,15,31,0.42)",
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 18,
    borderWidth: 1,
    marginTop: 16,
    padding: 16,
  },
  emptyTitle: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  emptyBody: {
    color: theme.colors.mutedText,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 6,
  },
  storeList: {
    gap: 12,
    marginTop: 16,
  },
  storeCard: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    gap: 14,
    padding: 14,
  },
  storeImage: {
    borderRadius: 16,
    height: 68,
    width: 68,
  },
  storeImageFallback: {
    alignItems: "center",
    backgroundColor: "rgba(74,136,255,0.12)",
    borderRadius: 16,
    height: 68,
    justifyContent: "center",
    width: 68,
  },
  storeImageFallbackText: {
    color: "#E2EBFF",
    fontSize: 22,
    fontWeight: "800",
  },
  storeBody: {
    flex: 1,
  },
  storeTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  storeName: {
    color: theme.colors.text,
    flexShrink: 1,
    fontSize: 16,
    fontWeight: "700",
  },
  storeMeta: {
    color: theme.colors.mutedText,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 6,
  },
  storeLink: {
    color: theme.colors.accent,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 8,
  },
});
