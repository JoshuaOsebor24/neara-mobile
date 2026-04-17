import { useFocusEffect, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BackPillButton } from "@/components/ui/back-pill-button";
import { ScreenCard } from "@/components/ui/screen-card";
import {
  EmptyCard,
  ErrorCard,
  LoadingCard,
  SkeletonCard,
} from "@/components/ux-state";
import { theme } from "@/constants/theme";
import {
  fetchChatConversations,
  type ChatConversationSummary,
} from "@/services/chat-api";
import { useMobileSession } from "@/services/mobile-session";

export default function StoreChatsScreen() {
  const router = useRouter();
  const session = useMobileSession();
  const storeName = session.primaryStoreName || "Store inbox";
  const [conversations, setConversations] = useState<ChatConversationSummary[]>(
    [],
  );
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const latestLoadIdRef = useRef(0);

  useEffect(() => {
    if (!session.isAuthenticated) {
      router.replace("/login");
      return;
    }

    if (!session.isStoreOwner || !session.isPro) {
      router.replace("/store/chats/locked");
    }
  }, [router, session.isAuthenticated, session.isPro, session.isStoreOwner]);

  const loadOwnerConversations = useCallback(async () => {
    if (
      !session.isAuthenticated ||
      !session.isStoreOwner ||
      !session.isPro ||
      !session.authToken
    ) {
      return;
    }

    const loadId = latestLoadIdRef.current + 1;
    latestLoadIdRef.current = loadId;

    setIsLoading(true);
    setErrorMessage("");

    const result = await fetchChatConversations(session.authToken, "owner");

    if (latestLoadIdRef.current !== loadId) {
      return;
    }

    if (!result.ok) {
      if (result.status === 401) {
        router.replace("/login");
        return;
      }

      if (result.status === 403) {
        router.replace("/store/chats/locked");
        return;
      }

      setErrorMessage(result.error);
      setConversations([]);
      setIsLoading(false);
      return;
    }

    setConversations(result.conversations);
    setIsLoading(false);
  }, [
    router,
    session.authToken,
    session.isAuthenticated,
    session.isPro,
    session.isStoreOwner,
  ]);

  useFocusEffect(
    useCallback(() => {
      void loadOwnerConversations();

      return () => {
        latestLoadIdRef.current += 1;
      };
    }, [loadOwnerConversations]),
  );

  if (!session.isAuthenticated || !session.isStoreOwner || !session.isPro) {
    return (
      <SafeAreaView edges={["top"]} style={styles.safeArea}>
        <StatusBar style="light" />
        <View style={styles.loadingWrap}>
          <Text style={styles.loadingText}>Checking store inbox access...</Text>
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
            <View style={styles.headerLeft}>
              <BackPillButton fallbackHref="/(tabs)/profile" />
              <View>
                <Text style={styles.title}>Inbox</Text>
              </View>
            </View>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() =>
                router.push(
                  session.primaryStoreId
                    ? `/store/${session.primaryStoreId}`
                    : "/(tabs)/profile",
                )
              }
              style={styles.primaryAction}
            >
              <Text style={styles.primaryActionText}>My Store</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />

          <ScreenCard style={styles.panel}>
            <View style={styles.panelHeader}>
              <Text style={styles.panelTitle}>Conversations</Text>
              <View style={styles.limitBadge}>
                <Text style={styles.limitBadgeText}>
                  {storeName} owner inbox
                </Text>
              </View>
            </View>

            <View style={styles.list}>
              {isLoading ? (
                <View style={styles.stateWrap}>
                  <LoadingCard
                    message="Loading customer conversations"
                    detail="Checking your latest inbox activity."
                  />
                  <SkeletonCard height={92} />
                  <SkeletonCard height={92} />
                </View>
              ) : null}
              {!isLoading && errorMessage ? (
                <ErrorCard
                  title="We couldn't load your inbox"
                  detail={errorMessage}
                />
              ) : null}
              {!isLoading && !errorMessage && conversations.length === 0 ? (
                <EmptyCard
                  title="No conversations yet"
                  detail={`Customer messages will appear here when shoppers contact ${storeName}.`}
                />
              ) : null}
              {conversations.map((conversation) => (
                <TouchableOpacity
                  key={conversation.id}
                  activeOpacity={0.85}
                  onPress={() =>
                    router.push(
                      `/chat/${conversation.store_id}?conversationId=${conversation.id}&role=owner`,
                    )
                  }
                  style={styles.card}
                >
                  <View style={styles.cardHeader}>
                    <Text style={styles.customerName}>
                      {conversation.user_name}
                    </Text>
                    <Text style={styles.statusText}>
                      {conversation.unread_count > 0
                        ? `${conversation.unread_count} unread`
                        : "Awaiting reply"}
                    </Text>
                  </View>
                  <Text style={styles.preview}>
                    {conversation.last_message ||
                      "Open this conversation to view messages."}
                  </Text>
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
    flex: 1,
    alignItems: "center",
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
    marginBottom: 20,
  },
  headerLeft: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
  primaryAction: {
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
  primaryActionText: {
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
    padding: 16,
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
  title: {
    color: theme.colors.text,
    fontSize: 24,
    fontWeight: "700",
  },
  list: {
    gap: 12,
  },
  stateWrap: {
    gap: 12,
  },
  card: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(17,24,39,0.90)",
    padding: 16,
    gap: 8,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  customerName: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
  statusText: {
    color: "#D9E4FF",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  preview: {
    color: theme.colors.mutedText,
    fontSize: 14,
    lineHeight: 21,
  },
});
