import Ionicons from "@expo/vector-icons/Ionicons";
import { type Href, usePathname, useRouter } from "expo-router";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { theme } from "@/constants/theme";
import { useMobileSession } from "@/services/mobile-session";
import { PremiumBadge } from "@/components/ui/premium-badge";
import { StoreOwnerBadge } from "@/components/ui/store-owner-badge";

type DrawerContextValue = {
  closeDrawer: () => void;
  isDrawerOpen: boolean;
  openDrawer: () => void;
  toggleDrawer: () => void;
};

const DrawerContext = createContext<DrawerContextValue | null>(null);

type DrawerItem = {
  href: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  showBadge?: boolean;
};

function isItemActive(pathname: string, href: string) {
  if (href === "/(tabs)/home") {
    return pathname === "/" || pathname === "/(tabs)/home";
  }

  return pathname === href;
}

export function DrawerProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const router = useRouter();
  const session = useMobileSession();
  const isAuthenticated = session.isAuthenticated && Boolean(session.authToken);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [previousPathname, setPreviousPathname] = useState(pathname);

  const closeDrawer = useCallback(() => {
    if (!isDrawerOpen) {
      return;
    }
    setIsDrawerOpen(false);
  }, [isDrawerOpen]);

  const openDrawer = useCallback(() => {
    if (!isAuthenticated) {
      return;
    }

    if (isDrawerOpen) {
      return;
    }
    setIsDrawerOpen(true);
  }, [isAuthenticated, isDrawerOpen]);

  const toggleDrawer = useCallback(() => {
    if (isDrawerOpen) {
      closeDrawer();
      return;
    }

    openDrawer();
  }, [closeDrawer, isDrawerOpen, openDrawer]);

  useEffect(() => {
    if (isDrawerOpen && pathname !== previousPathname) {
      closeDrawer();
    }
    setPreviousPathname(pathname);
  }, [closeDrawer, isDrawerOpen, pathname, previousPathname]);

  const value = useMemo(
    () => ({
      closeDrawer,
      isDrawerOpen,
      openDrawer,
      toggleDrawer,
    }),
    [closeDrawer, isDrawerOpen, openDrawer, toggleDrawer],
  );
  const identityName = session.name?.trim() || session.email?.trim() || "";
  const identityMeta = isAuthenticated
    ? session.email?.trim() || "Signed in"
    : "Mobile navigation";
  const drawerItems = useMemo(() => {
    if (!isAuthenticated) {
      return [];
    }

    const chatHref = session.isStoreOwner
      ? session.isPro
        ? "/store/chats"
        : "/store/chats/locked"
      : "/(tabs)/chats";
    const chatLabel = session.isStoreOwner ? "Inbox" : "Chats";
    const items: DrawerItem[] = [
      { href: "/(tabs)/profile", icon: "person-outline", label: "Profile" },
      {
        href: chatHref,
        icon: "chatbubble-ellipses-outline",
        label: chatLabel,
      },
      ...(session.isStoreOwner
        ? [
            {
              href: session.primaryStoreId ? `/store/${session.primaryStoreId}` : "/store-mode",
              icon: "storefront-outline" as const,
              label: "My Store",
            },
            {
              href: "/promote-store",
              icon: "megaphone-outline" as const,
              label: "Promote Your Store",
            },
          ]
        : []),
      { href: "/saved-stores", icon: "bookmark-outline", label: "Saved Stores" },
      { href: "/help", icon: "help-circle-outline", label: "Help" },
      {
        href: "/settings",
        icon: "options-outline",
        label: "Settings",
      },
    ];

    return items;
  }, [isAuthenticated, session.isPro, session.isStoreOwner, session.primaryStoreId]);
  return (
    <DrawerContext.Provider value={value}>
      {children}
      {!isAuthenticated ? null : (
      <Modal
        animationType="none"
        onRequestClose={closeDrawer}
        statusBarTranslucent
        transparent
        visible={isDrawerOpen}
      >
        <View style={styles.modalRoot}>
          <View style={styles.overlay}>
            <Pressable
              onPress={closeDrawer}
              style={StyleSheet.absoluteFillObject}
            />
          </View>

          <View style={styles.drawerWrap}>
            <SafeAreaView edges={["bottom"]} style={[styles.drawer, { paddingTop: Math.max(insets.top, 20) }]}>
              <View style={styles.drawerHeader}>
                <View style={styles.brandPill}>
                  <Text style={styles.brandPillText}>Neara</Text>
                </View>
              </View>

              <View style={styles.identityBlock}>
                <View style={styles.identityRow}>
                  <Text style={styles.identityName}>{identityName}</Text>
                </View>
                <View style={styles.identityBadgeRow}>
                  {session.isPro ? <PremiumBadge /> : null}
                  {session.isStoreOwner ? <StoreOwnerBadge /> : null}
                </View>
                <Text style={styles.identityMeta}>{identityMeta}</Text>
              </View>

              <View style={styles.navList}>
                {drawerItems.map((item) => {
                  const active = isItemActive(pathname, item.href);

                  return (
                    <TouchableOpacity
                      key={item.href}
                      activeOpacity={0.85}
                      onPress={() => {
                        closeDrawer();
                        router.push(item.href as Href);
                      }}
                      style={[styles.navItem, active && styles.navItemActive]}
                    >
                      <View style={styles.navIconWrap}>
                        <Ionicons
                          color={active ? "#f8fafc" : "#e2e8f0"}
                          name={item.icon}
                          size={18}
                        />
                      </View>
                      <Text style={[styles.navLabel, active && styles.navLabelActive]}>
                        {item.label}
                      </Text>
                      {item.showBadge ? (
                        <View style={styles.unreadDot} />
                      ) : null}
                      <Ionicons
                        color={active ? "#94a3b8" : "#64748b"}
                        name="chevron-forward"
                        size={16}
                      />
                    </TouchableOpacity>
                  );
                })}
              </View>

              {!session.isStoreOwner ? (
                <View style={styles.bottomActionWrap}>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => {
                      closeDrawer();
                      router.push("/store-mode");
                    }}
                    style={styles.bottomActionButton}
                  >
                    <View style={styles.navIconWrap}>
                      <Ionicons color="#dbeafe" name="swap-horizontal-outline" size={18} />
                    </View>
                    <Text style={styles.navLabel}>Switch to Store Mode</Text>
                    <Ionicons color="#64748b" name="chevron-forward" size={16} />
                  </TouchableOpacity>
                </View>
              ) : null}
            </SafeAreaView>
          </View>
        </View>
      </Modal>
      )}
    </DrawerContext.Provider>
  );
}

export function useDrawer() {
  const context = useContext(DrawerContext);

  if (!context) {
    throw new Error("useDrawer must be used inside DrawerProvider");
  }

  return context;
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: "flex-start",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.64)",
  },
  drawerWrap: {
    width: "82%",
    maxWidth: 360,
    minHeight: "100%",
  },
  drawer: {
    flex: 1,
    borderRightWidth: 1,
    borderRightColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(2, 8, 23, 0.96)",
    paddingHorizontal: 20,
    paddingBottom: 28,
    shadowColor: "#000",
    shadowOpacity: 0.48,
    shadowRadius: 40,
    shadowOffset: { width: 12, height: 0 },
    elevation: 16,
  },
  drawerHeader: {
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  brandPill: {
    borderRadius: 999,
    borderColor: "rgba(59,130,246,0.22)",
    borderWidth: 1,
    backgroundColor: "rgba(59,130,246,0.12)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: "flex-start",
  },
  brandPillText: {
    color: "#dbeafe",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.8,
    textTransform: "uppercase",
  },
  identityBlock: {
    paddingTop: 20,
    paddingBottom: 8,
  },
  identityRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  identityName: {
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: "600",
    letterSpacing: -0.3,
  },
  identityMeta: {
    marginTop: 4,
    color: "#94a3b8",
    fontSize: 14,
  },
  identityBadgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  navList: {
    marginTop: 8,
    flex: 1,
  },
  navItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  navItemActive: {
    backgroundColor: "transparent",
  },
  navIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    backgroundColor: "rgba(255,255,255,0.04)",
    alignItems: "center",
    justifyContent: "center",
  },
  navLabel: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: "500",
  },
  navLabelActive: {
    color: "#ffffff",
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#ef4444",
    marginRight: 6,
  },
  bottomActionWrap: {
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
    marginTop: 16,
    paddingTop: 16,
  },
  bottomActionButton: {
    alignItems: "center",
    backgroundColor: "rgba(59,130,246,0.10)",
    borderColor: "rgba(59,130,246,0.18)",
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
});
