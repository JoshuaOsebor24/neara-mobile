import { useFocusEffect, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BackPillButton } from "@/components/ui/back-pill-button";
import { PremiumBadge } from "@/components/ui/premium-badge";
import { ScreenCard } from "@/components/ui/screen-card";
import { StoreOwnerBadge } from "@/components/ui/store-owner-badge";
import { theme } from "@/constants/theme";
import { refreshMobileSessionFromBackend } from "@/services/auth-api";
import { useMobileSession } from "@/services/mobile-session";
import {
  NEARA_FREE_PLAN_LABEL,
  NEARA_PRO_PLAN_LABEL,
} from "@/services/role-access";

export default function ProfileTab() {
  const router = useRouter();
  const session = useMobileSession();
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (!session.isAuthenticated) {
      router.replace("/login");
    }
  }, [router, session.isAuthenticated]);

  const refreshProfileData = useCallback(async () => {
    if (!session.authToken) {
      return;
    }

    setIsRefreshing(true);
    await refreshMobileSessionFromBackend({ force: true });
    setIsRefreshing(false);
  }, [session.authToken]);

  useFocusEffect(
    useCallback(() => {
      void refreshProfileData();
    }, [refreshProfileData]),
  );

  const planLabel = session.isPro
    ? NEARA_PRO_PLAN_LABEL
    : NEARA_FREE_PLAN_LABEL;
  const displayName = session.name.trim() || session.email || "Neara user";

  if (!session.isAuthenticated) {
    return (
      <SafeAreaView edges={["top"]} style={styles.safeArea}>
        <StatusBar style="light" />
        <View style={styles.loadingWrap}>
          <Text style={styles.loadingText}>Opening login...</Text>
        </View>
      </SafeAreaView>
    );
  }

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
            <Text style={styles.headerBrand}>Neara</Text>
          </View>

          <ScreenCard style={styles.panel}>
            <Text style={styles.title}>Profile</Text>

            {isRefreshing ? (
              <View style={styles.noticeCard}>
                <Text style={styles.noticeText}>Loading profile...</Text>
              </View>
            ) : null}

            <View style={styles.identityCard}>
              <View style={styles.identityTitleRow}>
                <Text style={styles.identityName}>{displayName}</Text>
              </View>
              <View style={styles.identityBadgeRow}>
                {session.isPro ? <PremiumBadge /> : null}
                {session.isStoreOwner ? <StoreOwnerBadge /> : null}
              </View>
              <Text style={styles.identitySubtitle}>
                {session.isStoreOwner && session.isPro
                  ? "Pro and Store Owner access active"
                  : session.isStoreOwner
                    ? "Store owner access active"
                    : session.isPro
                      ? "Premium access active"
                      : "Normal account"}
              </Text>
            </View>

            <View style={styles.infoGrid}>
              <View style={styles.infoCard}>
                <Text style={styles.infoLabel}>Email</Text>
                <Text style={styles.infoValue}>
                  {session.email || "Not available"}
                </Text>
              </View>
              <View style={styles.infoCard}>
                <Text style={styles.infoLabel}>Phone</Text>
                <Text style={styles.infoValue}>
                  {session.phoneNumber || "Not available"}
                </Text>
              </View>
            </View>

            <View style={styles.infoCardLarge}>
              <Text style={styles.infoLabel}>Current plan</Text>
              <Text style={styles.infoTitle}>{planLabel}</Text>
              <Text style={styles.infoSubtext}>
                {session.isPro ? "Full access" : "Limited access"}
              </Text>
            </View>

            {session.isStoreOwner && session.primaryStoreId ? (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => router.push(`/store/${session.primaryStoreId}`)}
                style={styles.upgradeCard}
              >
                <Text style={styles.upgradeEyebrow}>Store mode</Text>
                <View style={styles.upgradeRow}>
                  <View style={styles.upgradeTextWrap}>
                    <Text style={styles.upgradeTitle}>My Store</Text>
                    <Text style={styles.upgradeSubtitle}>
                      Edit your store details, listing, and products.
                    </Text>
                  </View>
                  <Text style={styles.upgradeArrow}>Open →</Text>
                </View>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() =>
                router.push(session.isPro ? "/pro-benefits" : "/upgrade")
              }
              style={styles.upgradeCard}
            >
              {!session.isPro ? (
                <Text style={styles.upgradeEyebrow}>Upgrade plan</Text>
              ) : null}
              <View style={styles.upgradeRow}>
                <View style={styles.upgradeTextWrap}>
                  <Text style={styles.upgradeTitle}>
                    {session.isPro ? "Pro benefits" : "Go Pro"}
                  </Text>
                  <Text style={styles.upgradeSubtitle}>
                    {session.isPro
                      ? "All your premium features in one place."
                      : "Chat with stores • Check availability"}
                  </Text>
                </View>
                <Text style={styles.upgradeArrow}>Open →</Text>
              </View>
            </TouchableOpacity>
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
  loadingWrap: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  loadingText: {
    color: theme.colors.mutedText,
    fontSize: 14,
    textAlign: "center",
  },
  page: {
    width: "100%",
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 28,
  },
  headerBrand: {
    color: "#B8C2D9",
    fontSize: 12,
    letterSpacing: 2.2,
    textTransform: "uppercase",
  },
  panel: {
    padding: 20,
  },
  title: {
    color: theme.colors.text,
    fontSize: 30,
    fontWeight: "700",
    marginTop: 16,
  },
  noticeCard: {
    backgroundColor: theme.colors.surfaceCard,
    borderColor: theme.colors.borderStrong,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 24,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  noticeText: {
    color: "#C7D2E5",
    fontSize: 14,
  },
  identityCard: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 16,
    padding: 16,
  },
  identityTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  identityName: {
    color: theme.colors.text,
    flexShrink: 1,
    fontSize: 22,
    fontWeight: "800",
  },
  identitySubtitle: {
    color: "#C7D2E5",
    fontSize: 14,
    marginTop: 6,
  },
  identityBadgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  infoGrid: {
    gap: 14,
    marginTop: 20,
  },
  infoCard: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  infoCardLarge: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 16,
    padding: 16,
  },
  infoLabel: {
    color: "#B8C2D9",
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  infoValue: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: "500",
    marginTop: 6,
  },
  infoTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: "600",
    marginTop: 6,
  },
  infoSubtext: {
    color: "#C7D2E5",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 2,
  },
  upgradeCard: {
    backgroundColor: "rgba(74,136,255,0.14)",
    borderColor: "rgba(74,136,255,0.24)",
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 20,
    padding: 20,
  },
  upgradeEyebrow: {
    color: "#D4E1FF",
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  upgradeRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    marginTop: 8,
  },
  upgradeTextWrap: {
    flex: 1,
  },
  upgradeTitle: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: "600",
  },
  upgradeSubtitle: {
    color: "#E8EEF8",
    fontSize: 14,
    marginTop: 4,
  },
  upgradeArrow: {
    color: "#E2EBFF",
    fontSize: 14,
    fontWeight: "600",
  },
});
