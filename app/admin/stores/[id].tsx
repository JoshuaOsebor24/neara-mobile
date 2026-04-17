import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AdminNav } from "@/components/admin/admin-nav";
import { BackPillButton } from "@/components/ui/back-pill-button";
import { ScreenCard } from "@/components/ui/screen-card";
import { theme } from "@/constants/theme";
import {
  fetchAdminStoreDetail,
  type AdminStoreDetail,
  type AdminStoreDetailProduct,
} from "@/services/admin-api";
import { useMobileSession } from "@/services/mobile-session";

export default function AdminStoreDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const session = useMobileSession();
  const [store, setStore] = useState<AdminStoreDetail | null>(null);
  const [products, setProducts] = useState<AdminStoreDetailProduct[]>([]);
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

  const loadStore = useCallback(async () => {
    if (!session.authToken || !session.isAdmin || !params.id) {
      return;
    }

    setIsLoading(true);
    setErrorMessage("");
    const result = await fetchAdminStoreDetail(session.authToken, params.id);

    if (!result.ok) {
      setErrorMessage(result.error);
      setIsLoading(false);
      return;
    }

    setStore(result.store);
    setProducts(result.products);
    setIsLoading(false);
  }, [params.id, session.authToken, session.isAdmin]);

  useFocusEffect(
    useCallback(() => {
      void loadStore();
    }, [loadStore]),
  );

  const totalVariants = useMemo(
    () => products.reduce((sum, product) => sum + product.variants.length, 0),
    [products],
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
            <BackPillButton fallbackHref="/admin/stores" />
            <Text style={styles.topBarLabel}>STORE DETAIL</Text>
          </View>

          <ScreenCard style={styles.mainCard}>
            <Text style={styles.pageTitle}>
              {store?.store_name || "Store Detail"}
            </Text>
            <Text style={styles.pageSubtitle}>
              Admin management view for store information and product catalog.
            </Text>
            <AdminNav />

            {errorMessage ? (
              <Text style={styles.noticeText}>{errorMessage}</Text>
            ) : null}
            {isLoading ? (
              <Text style={styles.helperText}>Loading store details...</Text>
            ) : null}

            {store ? (
              <>
                <View style={styles.infoCard}>
                  <Text style={styles.infoLabel}>Store Info</Text>
                  <Text style={styles.infoTitle}>{store.store_name}</Text>
                  <Text style={styles.infoText}>
                    {store.category || "Uncategorized"}
                  </Text>
                  <Text style={styles.infoText}>
                    {store.address || "No address provided"}
                  </Text>
                  <Text style={styles.infoText}>
                    {store.owner_name || "No owner name"}
                    {store.owner_email ? ` • ${store.owner_email}` : ""}
                  </Text>
                  <Text style={styles.infoText}>
                    {store.phone_number || "No phone number"}
                  </Text>
                </View>

                <View style={styles.metricsRow}>
                  <View style={styles.metricCard}>
                    <Text style={styles.metricValue}>
                      {store.product_count}
                    </Text>
                    <Text style={styles.metricLabel}>Products</Text>
                  </View>
                  <View style={styles.metricCard}>
                    <Text style={styles.metricValue}>{totalVariants}</Text>
                    <Text style={styles.metricLabel}>Variants</Text>
                  </View>
                </View>

                <View style={styles.productsWrap}>
                  <Text style={styles.sectionTitle}>Products</Text>
                  {products.map((product) => (
                    <View key={product.id} style={styles.productCard}>
                      <View style={styles.productHeader}>
                        <Text style={styles.productName}>
                          {product.product_name}
                        </Text>
                        <View style={styles.productCountBadge}>
                          <Text style={styles.productCountText}>
                            {product.variants.length} variants
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.productMeta}>
                        {product.category || "Uncategorized"}
                      </Text>
                      {product.tags.length > 0 ? (
                        <Text style={styles.productMeta}>
                          Tags: {product.tags.join(", ")}
                        </Text>
                      ) : null}
                      {product.description ? (
                        <Text style={styles.productDescription}>
                          {product.description}
                        </Text>
                      ) : null}
                      <View style={styles.variantList}>
                        {product.variants.map((variant) => (
                          <View key={variant.id} style={styles.variantRow}>
                            <Text style={styles.variantLabel}>
                              {variant.variant_name || "Default"}
                            </Text>
                            <Text style={styles.variantMeta}>
                              {String(variant.price ?? "-")} • Stock{" "}
                              {String(variant.stock_quantity ?? "0")}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  ))}
                </View>
              </>
            ) : null}
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
  helperText: { color: theme.colors.mutedText, fontSize: 14, marginTop: 18 },
  noticeText: { color: "#FFD6D6", fontSize: 14, marginTop: 16 },
  infoCard: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 18,
    borderWidth: 1,
    marginTop: 18,
    padding: 18,
  },
  infoLabel: {
    color: "#B8C2D9",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },
  infoTitle: {
    color: theme.colors.text,
    fontSize: 22,
    fontWeight: "800",
    marginTop: 8,
  },
  infoText: { color: "#C7D2E5", fontSize: 14, lineHeight: 20, marginTop: 6 },
  metricsRow: { flexDirection: "row", gap: 12, marginTop: 16 },
  metricCard: {
    flex: 1,
    backgroundColor: "rgba(19,29,49,0.86)",
    borderColor: "rgba(191,212,255,0.14)",
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
  },
  metricValue: { color: theme.colors.text, fontSize: 26, fontWeight: "800" },
  metricLabel: { color: theme.colors.mutedText, fontSize: 13, marginTop: 6 },
  productsWrap: { marginTop: 22 },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 12,
  },
  productCard: {
    backgroundColor: "rgba(19,29,49,0.86)",
    borderColor: "rgba(191,212,255,0.14)",
    borderRadius: 18,
    borderWidth: 1,
    marginTop: 12,
    padding: 16,
  },
  productHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  productName: {
    color: theme.colors.text,
    flex: 1,
    fontSize: 17,
    fontWeight: "800",
  },
  productCountBadge: {
    backgroundColor: "rgba(74,136,255,0.16)",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  productCountText: { color: "#DCE8FF", fontSize: 12, fontWeight: "700" },
  productMeta: { color: "#AFC0DF", fontSize: 13, marginTop: 8 },
  productDescription: {
    color: "#C7D2E5",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
  variantList: { gap: 10, marginTop: 12 },
  variantRow: {
    borderTopColor: "rgba(255,255,255,0.08)",
    borderTopWidth: 1,
    paddingTop: 10,
  },
  variantLabel: { color: theme.colors.text, fontSize: 14, fontWeight: "700" },
  variantMeta: { color: "#B8C2D9", fontSize: 13, marginTop: 4 },
});
