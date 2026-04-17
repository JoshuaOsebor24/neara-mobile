import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AdminNav } from "@/components/admin/admin-nav";
import { BackPillButton } from "@/components/ui/back-pill-button";
import { ScreenCard } from "@/components/ui/screen-card";
import { theme } from "@/constants/theme";
import {
  fetchAdminStores,
  type AdminStoreListItem,
} from "@/services/admin-api";
import { useMobileSession } from "@/services/mobile-session";

export default function AdminStoresScreen() {
  const router = useRouter();
  const session = useMobileSession();
  const [stores, setStores] = useState<AdminStoreListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!session.isAuthenticated) {
      router.replace("/login");
      return;
    }

    if (!session.isAdmin) {
      router.replace("/(tabs)/home");
    }
  }, [router, session.isAdmin, session.isAuthenticated]);

  const loadStores = useCallback(async () => {
    if (!session.authToken || !session.isAdmin) {
      return;
    }

    setIsLoading(true);
    setErrorMessage("");
    const result = await fetchAdminStores(session.authToken);

    if (!result.ok) {
      setErrorMessage(result.error);
      setIsLoading(false);
      return;
    }

    setStores(result.stores);
    setIsLoading(false);
  }, [session.authToken, session.isAdmin]);

  useFocusEffect(
    useCallback(() => {
      void loadStores();
    }, [loadStores]),
  );

  const suspendedCount = useMemo(
    () => stores.filter((store) => store.is_suspended).length,
    [stores],
  );

  if (!session.isAuthenticated || !session.isAdmin) {
    return null;
  }

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
            <BackPillButton fallbackHref="/admin" />
            <Text style={styles.topBarLabel}>NEARA ADMIN</Text>
          </View>

          <ScreenCard style={styles.mainCard}>
            <Text style={styles.pageTitle}>Manage Stores</Text>
            <Text style={styles.pageSubtitle}>Stores and status.</Text>

            <AdminNav />

            <View style={styles.summaryRow}>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryValue}>{stores.length}</Text>
                <Text style={styles.summaryLabel}>Total stores</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryValue}>{suspendedCount}</Text>
                <Text style={styles.summaryLabel}>Suspended</Text>
              </View>
            </View>

            {errorMessage ? (
              <Text style={styles.noticeText}>{errorMessage}</Text>
            ) : null}
            {isLoading ? (
              <Text style={styles.helperText}>Loading...</Text>
            ) : null}

            <View style={styles.listWrap}>
              {stores.map((store) => (
                <TouchableOpacity
                  activeOpacity={0.85}
                  key={store.id}
                  onPress={() => router.push(`/admin/stores/${store.id}`)}
                  style={styles.storeCard}
                >
                  <View style={styles.storeTopRow}>
                    <View style={styles.storeMain}>
                      <Text style={styles.storeName}>{store.store_name}</Text>
                      <Text style={styles.storeMeta}>
                        {store.category || "Uncategorized"}
                      </Text>
                    </View>
                    <View style={styles.storeBadge}>
                      <Text style={styles.storeBadgeText}>
                        {store.product_count} items
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.storeDetail}>
                    {store.address || "No address"}
                  </Text>
                  <Text style={styles.storeDetail}>
                    {store.owner_name || "No owner"}
                    {store.owner_email ? ` • ${store.owner_email}` : ""}
                  </Text>
                  <View style={styles.storeFooter}>
                    <Text
                      style={[
                        styles.storeState,
                        store.is_suspended ? styles.storeStateSuspended : null,
                      ]}
                    >
                      {store.is_suspended ? "Suspended" : "Active"}
                    </Text>
                    <Ionicons
                      color="#9DB8F1"
                      name="chevron-forward"
                      size={16}
                    />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </ScreenCard>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "transparent" },
  scrollContent: { paddingBottom: 44, paddingTop: 6 },
  pageShell: { paddingHorizontal: theme.spacing.screenHorizontal },
  topBar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 28,
  },
  topBarLabel: {
    color: "#B8C2D9",
    fontSize: 12,
    letterSpacing: 2.2,
    textTransform: "uppercase",
  },
  mainCard: { padding: 20 },
  pageTitle: {
    color: theme.colors.text,
    fontSize: 30,
    fontWeight: "800",
    marginTop: 16,
  },
  pageSubtitle: {
    color: theme.colors.mutedText,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
  summaryRow: { flexDirection: "row", gap: 12, marginTop: 20 },
  summaryCard: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
  },
  summaryValue: { color: theme.colors.text, fontSize: 28, fontWeight: "800" },
  summaryLabel: { color: theme.colors.mutedText, fontSize: 13, marginTop: 6 },
  helperText: { color: theme.colors.mutedText, fontSize: 14, marginTop: 18 },
  noticeText: { color: "#FFD6D6", fontSize: 14, marginTop: 16 },
  listWrap: { gap: 14, marginTop: 18 },
  storeCard: {
    backgroundColor: "rgba(19,29,49,0.86)",
    borderColor: "rgba(191,212,255,0.14)",
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
  },
  storeTopRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  storeMain: { flex: 1 },
  storeName: { color: theme.colors.text, fontSize: 18, fontWeight: "800" },
  storeMeta: { color: "#AFC0DF", fontSize: 13, marginTop: 4 },
  storeBadge: {
    backgroundColor: "rgba(74,136,255,0.16)",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  storeBadgeText: { color: "#DCE8FF", fontSize: 12, fontWeight: "700" },
  storeDetail: {
    color: "#C7D2E5",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 10,
  },
  storeFooter: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 14,
  },
  storeState: {
    color: "#98B7F4",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  storeStateSuspended: { color: "#FFB3B3" },
});
