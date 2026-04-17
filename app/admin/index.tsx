import Ionicons from "@expo/vector-icons/Ionicons";
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

import { AdminNav } from "@/components/admin/admin-nav";
import { BackPillButton } from "@/components/ui/back-pill-button";
import { ScreenCard } from "@/components/ui/screen-card";
import { theme } from "@/constants/theme";
import {
  fetchAdminOverview,
  type AdminOverviewStats,
} from "@/services/admin-api";
import { useMobileSession } from "@/services/mobile-session";

const EMPTY_STATS: AdminOverviewStats = {
  total_admins: 0,
  total_products: 0,
  total_pro_users: 0,
  total_store_owners: 0,
  total_stores: 0,
  total_users: 0,
};

function StatCard({
  label,
  value,
  icon,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: number;
}) {
  return (
    <View style={styles.statCard}>
      <View style={styles.statIconWrap}>
        <Ionicons color="#DCE8FF" name={icon} size={18} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function QuickLink({
  description,
  href,
  label,
}: {
  description: string;
  href: "/admin/stores" | "/admin/users";
  label: string;
}) {
  const router = useRouter();

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => router.push(href)}
      style={styles.linkCard}
    >
      <View>
        <Text style={styles.linkTitle}>{label}</Text>
        <Text style={styles.linkDescription}>{description}</Text>
      </View>
      <Ionicons color="#AFC7FF" name="arrow-forward" size={18} />
    </TouchableOpacity>
  );
}

export default function AdminOverviewScreen() {
  const router = useRouter();
  const session = useMobileSession();
  const [stats, setStats] = useState<AdminOverviewStats>(EMPTY_STATS);
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

  const loadOverview = useCallback(async () => {
    if (!session.authToken || !session.isAdmin) {
      return;
    }

    setIsLoading(true);
    setErrorMessage("");
    const result = await fetchAdminOverview(session.authToken);

    if (!result.ok) {
      setErrorMessage(result.error);
      setIsLoading(false);
      return;
    }

    setStats(result.stats);
    setIsLoading(false);
  }, [session.authToken, session.isAdmin]);

  useFocusEffect(
    useCallback(() => {
      void loadOverview();
    }, [loadOverview]),
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
        <View style={styles.page}>
          <View style={styles.header}>
            <BackPillButton fallbackHref="/(tabs)/home" />
            <Text style={styles.headerBrand}>NEARA ADMIN</Text>
          </View>

          <ScreenCard style={styles.panel}>
            <Text style={styles.title}>Admin Panel</Text>
            <Text style={styles.subtitle}>Overview</Text>

            <AdminNav />

            {errorMessage ? (
              <View style={styles.noticeCard}>
                <Text style={styles.noticeText}>{errorMessage}</Text>
              </View>
            ) : null}

            <View style={styles.identityCard}>
              <Text style={styles.infoLabel}>Admin</Text>
              <Text style={styles.infoTitle}>
                {session.name.trim() || "Admin user"}
              </Text>
              <Text style={styles.infoValue}>{session.email}</Text>
              <Text style={styles.infoMeta}>Active</Text>
            </View>

            <View style={styles.statsGrid}>
              <StatCard
                icon="people-outline"
                label="Total Users"
                value={stats.total_users}
              />
              <StatCard
                icon="storefront-outline"
                label="Total Stores"
                value={stats.total_stores}
              />
              <StatCard
                icon="cube-outline"
                label="Total Products"
                value={stats.total_products}
              />
              <StatCard
                icon="diamond-outline"
                label="Total Pro Users"
                value={stats.total_pro_users}
              />
              <StatCard
                icon="briefcase-outline"
                label="Store Owners"
                value={stats.total_store_owners}
              />
              <StatCard
                icon="shield-checkmark-outline"
                label="Admins"
                value={stats.total_admins}
              />
            </View>

            {isLoading ? (
              <Text style={styles.helperText}>Loading...</Text>
            ) : null}

            <View style={styles.quickLinksWrap}>
              <QuickLink
                href="/admin/stores"
                label="Manage Stores"
                description="Review stores and inventory."
              />
              <QuickLink
                href="/admin/users"
                label="Manage Users"
                description="View access and roles."
              />
            </View>
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
    fontWeight: "800",
    marginTop: 16,
  },
  subtitle: {
    color: theme.colors.mutedText,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
  noticeCard: {
    backgroundColor: "rgba(117,34,34,0.24)",
    borderColor: "rgba(255,120,120,0.24)",
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 18,
    padding: 14,
  },
  noticeText: {
    color: "#FFD6D6",
    fontSize: 14,
  },
  identityCard: {
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
  infoValue: {
    color: theme.colors.text,
    fontSize: 14,
    marginTop: 6,
  },
  infoMeta: {
    color: "#8ec1ff",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 8,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 20,
  },
  statCard: {
    backgroundColor: "rgba(19,29,49,0.86)",
    borderColor: "rgba(191,212,255,0.14)",
    borderRadius: 18,
    borderWidth: 1,
    flexGrow: 1,
    minWidth: "47%",
    padding: 16,
  },
  statIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(74,136,255,0.16)",
    marginBottom: 14,
  },
  statValue: {
    color: theme.colors.text,
    fontSize: 28,
    fontWeight: "800",
  },
  statLabel: {
    color: "#B8C2D9",
    fontSize: 13,
    marginTop: 6,
  },
  helperText: {
    color: theme.colors.mutedText,
    fontSize: 14,
    marginTop: 16,
  },
  quickLinksWrap: {
    gap: 14,
    marginTop: 22,
  },
  linkCard: {
    alignItems: "center",
    backgroundColor: "rgba(74,136,255,0.12)",
    borderColor: "rgba(74,136,255,0.22)",
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 18,
  },
  linkTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: "700",
  },
  linkDescription: {
    color: "#C7D2E5",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
    maxWidth: 260,
  },
});
