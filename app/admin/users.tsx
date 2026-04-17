import { useFocusEffect, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AdminNav } from "@/components/admin/admin-nav";
import { BackPillButton } from "@/components/ui/back-pill-button";
import { ScreenCard } from "@/components/ui/screen-card";
import { theme } from "@/constants/theme";
import { fetchAdminUsers, type AdminUserRecord } from "@/services/admin-api";
import { useMobileSession } from "@/services/mobile-session";

function isUserStoreOwner(user: AdminUserRecord) {
  return (
    Boolean(user.is_store_owner) ||
    Boolean(user.has_owned_store) ||
    Number(user.store_count || 0) > 0 ||
    user.roles.includes("store_owner")
  );
}

export default function AdminUsersScreen() {
  const router = useRouter();
  const session = useMobileSession();
  const [users, setUsers] = useState<AdminUserRecord[]>([]);
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

  const loadUsers = useCallback(async () => {
    if (!session.authToken || !session.isAdmin) {
      return;
    }

    setIsLoading(true);
    setErrorMessage("");
    const result = await fetchAdminUsers(session.authToken);

    if (!result.ok) {
      setErrorMessage(result.error);
      setIsLoading(false);
      return;
    }

    setUsers(result.users);
    setIsLoading(false);
  }, [session.authToken, session.isAdmin]);

  useFocusEffect(
    useCallback(() => {
      void loadUsers();
    }, [loadUsers]),
  );

  const summary = useMemo(
    () => ({
      totalAdmins: users.filter((user) => user.is_admin).length,
      totalProUsers: users.filter((user) => user.premium_status).length,
      totalStoreOwners: users.filter((user) => isUserStoreOwner(user)).length,
      totalUsers: users.length,
    }),
    [users],
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
            <Text style={styles.pageTitle}>Manage Users</Text>
            <Text style={styles.pageSubtitle}>Access and roles.</Text>

            <AdminNav />

            <View style={styles.summaryGrid}>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryValue}>{summary.totalUsers}</Text>
                <Text style={styles.summaryLabel}>Total users</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryValue}>{summary.totalProUsers}</Text>
                <Text style={styles.summaryLabel}>Pro users</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryValue}>{summary.totalAdmins}</Text>
                <Text style={styles.summaryLabel}>Admins</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryValue}>
                  {summary.totalStoreOwners}
                </Text>
                <Text style={styles.summaryLabel}>Store owners</Text>
              </View>
            </View>

            {errorMessage ? (
              <Text style={styles.noticeText}>{errorMessage}</Text>
            ) : null}
            {isLoading ? (
              <Text style={styles.helperText}>Loading...</Text>
            ) : null}

            <View style={styles.listWrap}>
              {users.map((user) => (
                <View key={user.id} style={styles.userCard}>
                  {(() => {
                    const isStoreOwner = isUserStoreOwner(user);

                    return (
                      <>
                        <Text style={styles.userName}>
                          {user.name || "Unnamed user"}
                        </Text>
                        <Text style={styles.userEmail}>{user.email}</Text>
                        <View style={styles.badgeRow}>
                          <Text
                            style={[
                              styles.badge,
                              user.is_admin ? styles.badgeAdmin : null,
                            ]}
                          >
                            {user.is_admin ? "Admin" : "User"}
                          </Text>
                          <Text
                            style={[
                              styles.badge,
                              user.premium_status ? styles.badgePro : null,
                            ]}
                          >
                            {user.premium_status ? "Pro" : "Free"}
                          </Text>
                          <Text
                            style={[
                              styles.badge,
                              isStoreOwner ? styles.badgeOwner : null,
                            ]}
                          >
                            {isStoreOwner ? "Store owner" : "No store"}
                          </Text>
                        </View>
                      </>
                    );
                  })()}
                </View>
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
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 20,
  },
  summaryCard: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 18,
    borderWidth: 1,
    minWidth: "47%",
    flexGrow: 1,
    padding: 16,
  },
  summaryValue: { color: theme.colors.text, fontSize: 28, fontWeight: "800" },
  summaryLabel: { color: theme.colors.mutedText, fontSize: 13, marginTop: 6 },
  helperText: { color: theme.colors.mutedText, fontSize: 14, marginTop: 18 },
  noticeText: { color: "#FFD6D6", fontSize: 14, marginTop: 16 },
  listWrap: { gap: 14, marginTop: 18 },
  userCard: {
    backgroundColor: "rgba(19,29,49,0.86)",
    borderColor: "rgba(191,212,255,0.14)",
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
  },
  userName: { color: theme.colors.text, fontSize: 18, fontWeight: "800" },
  userEmail: { color: "#C7D2E5", fontSize: 14, marginTop: 6 },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  badge: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 999,
    borderWidth: 1,
    color: "#DCE8FF",
    fontSize: 12,
    fontWeight: "800",
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  badgeAdmin: {
    backgroundColor: "rgba(74,136,255,0.16)",
    borderColor: "rgba(142,193,255,0.24)",
  },
  badgePro: {
    backgroundColor: "rgba(99,162,255,0.14)",
    borderColor: "rgba(142,193,255,0.2)",
  },
  badgeOwner: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderColor: "rgba(255,255,255,0.12)",
  },
});
