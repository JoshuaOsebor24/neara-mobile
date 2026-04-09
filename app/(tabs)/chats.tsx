import { useFocusEffect, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
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
import { getFreeMessagesRemaining } from "@/services/role-access";

export default function ChatsTab() {
  const router = useRouter();
  const session = useMobileSession();
  const freeMessagesRemaining = getFreeMessagesRemaining(
    session.messagesSentCount,
    session.isPro,
  );
  const [conversations, setConversations] = useState<ChatConversationSummary[]>(
    [],
  );
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!session.isAuthenticated) {
      router.replace("/login");
      return;
    }

    if (session.isStoreOwner) {
      router.replace(session.isPro ? "/store/chats" : "/store/chats/locked");
    }
  }, [router, session.isAuthenticated, session.isPro, session.isStoreOwner]);

  const loadConversations = useCallback(async () => {
    if (!session.isAuthenticated || !session.authToken) {
      return;
    }

    setIsLoading(true);
    setErrorMessage("");

    const result = await fetchChatConversations(session.authToken, "user");

    if (!result.ok) {
      if (result.status === 401) {
        router.replace("/login");
        return;
      }

      setErrorMessage(result.error);
      setConversations([]);
      setIsLoading(false);
      return;
    }

    setConversations(result.conversations);
    setIsLoading(false);
  }, [router, session.authToken, session.isAuthenticated]);

  useFocusEffect(
    useCallback(() => {
      void loadConversations();
    }, [loadConversations]),
  );

  if (!session.isAuthenticated || session.isStoreOwner) {
    return (
      <SafeAreaView edges={["top"]} style={styles.safeArea}>
        <StatusBar style="light" />
        <View style={styles.loadingWrap}>
          <Text style={styles.loadingText}>
            {!session.isAuthenticated ? "Opening chats..." : "Opening inbox..."}
          </Text>
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
                <Text style={styles.headerTitle}>Messages</Text>
              </View>
            </View>

            <Pressable
              onPress={() => router.push("/(tabs)/search")}
              style={styles.newChatButton}
            >
              <Text style={styles.newChatButtonText}>New Chat</Text>
            </Pressable>
          </View>

          <View style={styles.divider} />

          <ScreenCard style={styles.panel}>
            <View style={styles.panelHeader}>
              <View>
                <Text style={styles.panelTitle}>Conversations</Text>
                {session.isPro ? (
                  <View style={styles.limitBadge}>
                    <Text style={styles.limitBadgeText}>
                      Pro messaging active
                    </Text>
                  </View>
                ) : freeMessagesRemaining > 0 ? (
                  <View style={styles.limitBadge}>
                    <Text style={styles.limitBadgeText}>
                      Free messaging • {freeMessagesRemaining} message
                      {freeMessagesRemaining === 1 ? "" : "s"} left
                    </Text>
                  </View>
                ) : (
                  <View style={styles.limitBadgeExhausted}>
                    <Text style={[styles.limitBadgeText, { color: "#ef4444" }]}>
                      Free message quota exhausted
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {isLoading ? (
              <View style={styles.stateWrap}>
                <LoadingCard
                  message="Loading conversations"
                  detail="Checking your latest store messages."
                />
                <SkeletonCard height={92} />
                <SkeletonCard height={92} />
                <SkeletonCard height={92} />
              </View>
            ) : null}

            {!isLoading && errorMessage ? (
              <ErrorCard title="Couldn't load chats" detail={errorMessage} />
            ) : null}

            {!isLoading && !errorMessage && conversations.length === 0 ? (
              <EmptyCard
                title="No conversations yet"
                detail="Browse stores and tap the chat button to start messaging."
              />
            ) : null}

            {!isLoading && !errorMessage && conversations.length > 0 ? (
              <View style={styles.list}>
                {conversations.map((conversation) => (
                  <Pressable
                    key={conversation.id}
                    onPress={() =>
                      router.push(
                        `/chat/${conversation.store_id}?conversationId=${conversation.id}`,
                      )
                    }
                    style={({ pressed }) => [
                      styles.card,
                      pressed && styles.cardPressed,
                    ]}
                  >
                    <View style={styles.cardHeader}>
                      <View style={styles.cardHeaderLeft}>
                        <View style={styles.avatar}>
                          <Text style={styles.avatarText}>
                            {conversation.store_name.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <Text numberOfLines={1} style={styles.storeName}>
                          {conversation.store_name}
                        </Text>
                        {conversation.unread_count > 0 ? (
                          <View style={styles.badge}>
                            <Text style={styles.badgeText}>
                              {conversation.unread_count > 9
                                ? "9+"
                                : conversation.unread_count}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={styles.timeText}>
                        {conversation.last_message_at || conversation.updated_at
                          ? new Date(
                              conversation.last_message_at ||
                                conversation.updated_at,
                            ).toLocaleDateString("en-NG", {
                              day: "numeric",
                              month: "short",
                            })
                          : ""}
                      </Text>
                    </View>
                    <Text numberOfLines={2} style={styles.preview}>
                      {conversation.last_message || "No messages yet."}
                    </Text>
                  </Pressable>
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
    backgroundColor: theme.colors.background,
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
  newChatButton: {
    alignItems: "center",
    backgroundColor: "rgba(56, 189, 248, 0.12)",
    borderColor: "rgba(56, 189, 248, 0.20)",
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
    minWidth: 104,
    paddingHorizontal: 16,
  },
  newChatButtonText: {
    color: "#38bdf8",
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
  panelSubtitle: {
    color: "#94a3b8",
    fontSize: 13,
    marginTop: 4,
  },
  limitBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(56, 189, 248, 0.12)",
    borderColor: "rgba(56, 189, 248, 0.20)",
    borderRadius: 999,
    borderWidth: 1,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  limitBadgeExhausted: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderColor: "rgba(239, 68, 68, 0.20)",
    borderRadius: 999,
    borderWidth: 1,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  limitBadgeText: {
    color: "#38bdf8",
    fontSize: 12,
    fontWeight: "600",
  },
  stateWrap: {
    gap: 12,
  },
  list: {
    gap: 8,
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  cardPressed: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderColor: "rgba(255,255,255,0.12)",
  },
  cardHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
  },
  cardHeaderLeft: {
    alignItems: "center",
    flexDirection: "row",
    flex: 1,
    gap: 8,
  },
  avatar: {
    alignItems: "center",
    backgroundColor: "rgba(56, 189, 248, 0.12)",
    borderColor: "rgba(56, 189, 248, 0.20)",
    borderRadius: 999,
    borderWidth: 1,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  avatarText: {
    color: "#38bdf8",
    fontSize: 14,
    fontWeight: "700",
  },
  storeName: {
    color: theme.colors.text,
    flexShrink: 1,
    fontSize: 14,
    fontWeight: "700",
  },
  badge: {
    alignItems: "center",
    backgroundColor: "#ef4444",
    borderRadius: 999,
    justifyContent: "center",
    minWidth: 20,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
  timeText: {
    color: "#94a3b8",
    fontSize: 12,
  },
  preview: {
    color: "#cbd5e1",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 12,
  },
});
