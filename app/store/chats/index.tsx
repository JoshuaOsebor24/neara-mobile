import { useFocusEffect, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { EmptyCard, ErrorCard, LoadingCard, SkeletonCard } from "@/components/ux-state";
import { theme } from "@/constants/theme";
import { fetchChatConversations, type ChatConversationSummary } from "@/services/chat-api";
import { navigateBackOrFallback } from "@/services/navigation";
import { useMobileSession } from "@/services/mobile-session";

export default function StoreChatsScreen() {
  const router = useRouter();
  const session = useMobileSession();
  const storeName = session.primaryStoreName || "Store inbox";
  const [conversations, setConversations] = useState<ChatConversationSummary[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

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

      setIsLoading(true);
      setErrorMessage("");

      const result = await fetchChatConversations(session.authToken, "owner");

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
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => navigateBackOrFallback(router, "/(tabs)/profile")}
              style={styles.backButton}
            >
              <Text style={styles.backButtonText}>← Back</Text>
            </TouchableOpacity>
            <View>
              <Text style={styles.title}>Inbox</Text>
              <Text style={styles.subtitle}>{storeName} owner inbox</Text>
            </View>
          </View>

          <View style={styles.actionRow}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() =>
                router.push(
                  session.primaryStoreId ? `/store/${session.primaryStoreId}` : "/(tabs)/profile",
                )
              }
              style={styles.secondaryAction}
            >
              <Text style={styles.secondaryActionText}>My Store</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => router.push("/(tabs)/profile")}
              style={styles.secondaryAction}
            >
              <Text style={styles.secondaryActionText}>Profile</Text>
            </TouchableOpacity>
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
              <ErrorCard title="Couldn't load inbox" detail={errorMessage} />
            ) : null}
            {!isLoading && !errorMessage && conversations.length === 0 ? (
              <EmptyCard
                title="Start a conversation"
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
                  <Text style={styles.customerName}>{conversation.user_name}</Text>
                  <Text style={styles.statusText}>
                    {conversation.unread_count > 0
                      ? `${conversation.unread_count} unread`
                      : "Awaiting reply"}
                  </Text>
                </View>
                <Text style={styles.preview}>
                  {conversation.last_message || "Open this conversation to view messages."}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
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
    paddingTop: 12,
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
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 20,
  },
  backButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.05)",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  backButtonText: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  title: {
    color: theme.colors.text,
    fontSize: 24,
    fontWeight: "700",
  },
  subtitle: {
    marginTop: 2,
    color: theme.colors.mutedText,
    fontSize: 13,
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 18,
  },
  secondaryAction: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.05)",
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  secondaryActionText: {
    color: theme.colors.text,
    fontSize: 12,
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
    backgroundColor: "rgba(15,23,42,0.90)",
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
    color: "#93c5fd",
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
