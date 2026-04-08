import { BackPillButton } from "@/components/ui/back-pill-button";
import { ChatInputBar } from "@/components/ui/chat-input-bar";
import {
  EmptyCard,
  ErrorCard,
  LoadingCard,
  SkeletonCard,
} from "@/components/ux-state";
import { theme } from "@/constants/theme";
import { buildSessionPatchFromAuthUser } from "@/services/auth-api";
import {
  fetchChatConversation,
  fetchStoreChatPreview,
  markConversationRead,
  sendConversationChatMessage,
  sendStoreChatMessage,
  type ChatConversationDetail,
  type ChatMessage,
} from "@/services/chat-api";
import { buildChatRequestMessage } from "@/services/chat-request";
import { showFlashFeedback } from "@/services/flash-feedback";
import {
  updateMobileSession,
  useMobileSession,
} from "@/services/mobile-session";
import {
  getFreeMessagesRemaining,
  NEARA_FREE_CHAT_LIMIT,
  NEARA_FREE_LIMIT_REACHED,
  NEARA_ONE_FREE_MESSAGE_LEFT,
} from "@/services/role-access";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

const { width } = Dimensions.get("window");

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function ChatThreadScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const session = useMobileSession();
  const scrollViewRef = useRef<ScrollView>(null);
  const [conversation, setConversation] =
    useState<ChatConversationDetail | null>(null);
  const [storeName, setStoreName] = useState("");
  const [draft, setDraft] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [quotaNotice, setQuotaNotice] = useState("");

  const storeId = params.storeId as string;
  const conversationId =
    typeof params.conversationId === "string" ? params.conversationId : "";
  const prefillPrompt =
    typeof params.prefill === "string" ? params.prefill : "";
  const productPrompt =
    typeof params.product === "string" ? params.product : "";
  const variantPrompt =
    typeof params.variant === "string" ? params.variant : "";
  const pricePrompt = typeof params.price === "string" ? params.price : "";
  const freeMessagesRemaining = getFreeMessagesRemaining(
    session.messagesSentCount,
    session.isPro,
  );

  useEffect(() => {
    scrollViewRef.current?.scrollToEnd({ animated: false });
  }, [conversation?.messages]);

  useEffect(() => {
    if (conversationId || draft.trim()) {
      return;
    }

    setDraft(
      prefillPrompt ||
        buildChatRequestMessage("availability", {
          price: pricePrompt,
          product: productPrompt,
          variant: variantPrompt,
        }),
    );
  }, [
    conversationId,
    draft,
    prefillPrompt,
    pricePrompt,
    productPrompt,
    variantPrompt,
  ]);

  useEffect(() => {
    if (!session.isAuthenticated || !session.authToken) {
      router.replace("/login");
      return;
    }

    async function loadConversation() {
      setIsLoading(true);
      setErrorMessage("");

      if (conversationId) {
        const result = await fetchChatConversation(
          session.authToken!,
          conversationId,
        );

        if (!result.ok) {
          if (result.status === 0 || result.status >= 500) {
            console.error("[chat] fetch conversation failed", {
              conversationId,
              error: result.error,
              status: result.status,
              url: result.url,
            });
          } else {
            console.warn("[chat] fetch conversation blocked", {
              conversationId,
              error: result.error,
              status: result.status,
              url: result.url,
            });
          }
          if (result.status === 401) {
            router.replace("/login");
            return;
          }

          if (result.status === 402 || result.status === 403) {
            router.replace("/chats/locked");
            return;
          }

          setConversation(null);
          setErrorMessage(result.error);
          setIsLoading(false);
          return;
        }

        setConversation(result.conversation);
        setStoreName(result.conversation.store_name);
        setIsLoading(false);
        return;
      }

      const result = await fetchStoreChatPreview(session.authToken!, storeId);

      if (!result.ok) {
        if (result.status === 0 || result.status >= 500) {
          console.error("[chat] fetch store preview failed", {
            storeId,
            error: result.error,
            status: result.status,
            url: result.url,
          });
        } else {
          console.warn("[chat] fetch store preview blocked", {
            storeId,
            error: result.error,
            status: result.status,
            url: result.url,
          });
        }
        if (result.status === 401) {
          router.replace("/login");
          return;
        }

        if (result.status === 402 || result.status === 403) {
          router.replace("/chats/locked");
          return;
        }

        setConversation(null);
        setStoreName("");
        setErrorMessage(result.error);
        setIsLoading(false);
        return;
      }

      setStoreName(result.store?.store_name || "");
      setConversation(result.conversation);
      setIsLoading(false);
    }

    void loadConversation();
  }, [
    conversationId,
    router,
    session.authToken,
    session.isAuthenticated,
    storeId,
  ]);

  useEffect(() => {
    if (!session.authToken || !conversation || conversation.unread_count < 1) {
      return;
    }

    void markConversationRead(session.authToken, String(conversation.id)).then(
      (result) => {
        if (result.ok) {
          setConversation(result.conversation);
        }
      },
    );
  }, [conversation, session.authToken]);

  const handleSend = async () => {
    const trimmedDraft = draft.trim();
    if (!trimmedDraft || isSending || !session.authToken) return;

    setIsSending(true);
    setErrorMessage("");

    const result = conversationId
      ? await sendConversationChatMessage(
          session.authToken,
          conversationId,
          trimmedDraft,
        )
      : await sendStoreChatMessage(session.authToken, storeId, trimmedDraft);

    if (!result.ok) {
      if (result.status === 0 || result.status >= 500) {
        console.error("[chat] send failed", {
          route: conversationId
            ? `/chats/${conversationId}/messages`
            : `/chats/store/${storeId}/messages`,
          conversationId: conversationId || null,
          storeId,
          error: result.error,
          status: result.status,
          url: result.url,
        });
      } else {
        console.warn("[chat] send blocked", {
          route: conversationId
            ? `/chats/${conversationId}/messages`
            : `/chats/store/${storeId}/messages`,
          conversationId: conversationId || null,
          storeId,
          error: result.error,
          status: result.status,
          url: result.url,
        });
      }
      if (result.status === 401) {
        router.replace("/login");
        return;
      }

      if (result.user && typeof result.user.premium_status === "boolean") {
        updateMobileSession({
          ...buildSessionPatchFromAuthUser(
            {
              email: session.email,
              id: session.id,
              messages_sent_count:
                result.user.messages_sent_count ?? session.messagesSentCount,
              premium: result.user.premium,
              premium_status: result.user.premium_status,
            },
            session.authToken,
          ),
          messagesSentCount: Number(
            result.user.messages_sent_count ?? session.messagesSentCount,
          ),
        });
      }

      if (result.status === 402) {
        setQuotaNotice(NEARA_FREE_LIMIT_REACHED);
        router.replace("/chats/locked");
        return;
      }

      if (result.status === 403) {
        router.replace("/chats/locked");
        return;
      }

      setErrorMessage(result.error);
      setIsSending(false);
      return;
    }

    if (result.user && typeof result.user.premium_status === "boolean") {
      const nextMessagesSentCount = Number(
        result.user.messages_sent_count ?? session.messagesSentCount,
      );

      updateMobileSession({
        ...buildSessionPatchFromAuthUser(
          {
            email: session.email,
            id: session.id,
            messages_sent_count: nextMessagesSentCount,
            premium: result.user.premium,
            premium_status: result.user.premium_status,
          },
          session.authToken,
        ),
        messagesSentCount: nextMessagesSentCount,
      });

      if (
        !(
          session.isPro ||
          Boolean(result.user.premium_status) ||
          Boolean(result.user.premium)
        )
      ) {
        const remaining = getFreeMessagesRemaining(
          nextMessagesSentCount,
          false,
        );

        if (remaining === 1) {
          setQuotaNotice(
            `Free users have ${NEARA_FREE_CHAT_LIMIT} total free messages. ${NEARA_ONE_FREE_MESSAGE_LEFT}.`,
          );
        } else if (remaining === 0) {
          setQuotaNotice(NEARA_FREE_LIMIT_REACHED);
        } else {
          setQuotaNotice("");
        }
      } else {
        setQuotaNotice("");
      }
    }

    setConversation(result.conversation);
    setStoreName(result.conversation.store_name);
    setDraft("");
    setIsSending(false);
    showFlashFeedback("Message sent.");
    if (!conversationId) {
      router.replace(
        `/chat/${result.conversation.store_id}?conversationId=${result.conversation.id}`,
      );
      return;
    }
  };

  const title = storeName || "Chat";
  const subtitle = "Send a real message to this store";
  const messages = conversation?.messages ?? [];

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        {/* Header */}
        <View style={styles.header}>
          <BackPillButton fallbackHref="/(tabs)/chats" />
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>{title}</Text>
            <Text style={styles.headerSubtitle}>{subtitle}</Text>
          </View>
        </View>

        {/* Messages */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {isLoading ? (
            <View style={styles.stateWrap}>
              <LoadingCard
                message="Loading conversation"
                detail="Fetching the latest messages."
              />
              <SkeletonCard height={72} />
              <SkeletonCard height={64} />
            </View>
          ) : null}
          {!isLoading && errorMessage ? (
            <View style={styles.stateWrap}>
              <ErrorCard title="Chat unavailable" detail={errorMessage} />
            </View>
          ) : null}
          {!isLoading && !errorMessage && !session.isPro && quotaNotice ? (
            <View style={styles.noticeCard}>
              <Text style={styles.noticeTitle}>Free chat limit</Text>
              <Text style={styles.noticeText}>{quotaNotice}</Text>
            </View>
          ) : null}
          {!isLoading &&
          !errorMessage &&
          !session.isPro &&
          !quotaNotice &&
          freeMessagesRemaining === 2 ? (
            <View style={styles.noticeCard}>
              <Text style={styles.noticeTitle}>Free chat limit</Text>
              <Text style={styles.noticeText}>
                Free users have {NEARA_FREE_CHAT_LIMIT} total free messages.
              </Text>
            </View>
          ) : null}
          {!isLoading && !errorMessage && messages.length === 0 ? (
            <View style={styles.stateWrap}>
              <EmptyCard
                title="Start a conversation"
                detail="Send the first message to begin chatting with this store."
              />
            </View>
          ) : null}
          {messages.map((message: ChatMessage) => {
            const isOwn = String(message.sender_id) === session.id;

            return (
              <View
                key={message.id}
                style={[
                  styles.messageBubble,
                  isOwn ? styles.ownMessage : styles.otherMessage,
                ]}
              >
                <Text
                  style={[
                    styles.messageText,
                    isOwn ? styles.ownMessageText : styles.otherMessageText,
                  ]}
                >
                  {message.text}
                </Text>
                <Text
                  style={[
                    styles.messageTime,
                    isOwn ? styles.ownMessageTime : styles.otherMessageTime,
                  ]}
                >
                  {isOwn ? "You" : title} • {formatTime(message.created_at)}
                </Text>
              </View>
            );
          })}
        </ScrollView>

        {/* Input */}
        <ChatInputBar
          isSending={isSending}
          onChangeText={setDraft}
          onSend={handleSend}
          placeholder="Ask about this product..."
          value={draft}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: theme.spacing.screenHorizontal,
    paddingTop: theme.spacing.screenTop + 4,
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
    backgroundColor: "rgba(10, 18, 32, 0.96)",
  },
  headerContent: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: theme.colors.text,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#96a8bf",
  },
  messagesContainer: {
    flex: 1,
    paddingHorizontal: theme.spacing.screenHorizontal,
  },
  messagesContent: {
    flexGrow: 1,
    paddingTop: 18,
    paddingBottom: 18,
  },
  emptyState: {
    color: theme.colors.mutedText,
    fontSize: 14,
    lineHeight: 22,
    paddingVertical: 12,
    textAlign: "center",
  },
  stateWrap: {
    gap: 12,
    paddingVertical: 12,
  },
  noticeCard: {
    backgroundColor: "rgba(125, 211, 252, 0.08)",
    borderColor: "rgba(125, 211, 252, 0.18)",
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  noticeTitle: {
    color: "#dbeafe",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  noticeText: {
    color: "#cbd5e1",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
  },
  messageBubble: {
    maxWidth: width * 0.75,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 20,
    marginBottom: 14,
    shadowColor: theme.colors.shadow,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  ownMessage: {
    alignSelf: "flex-end",
    backgroundColor: "rgba(125, 211, 252, 0.14)",
    borderWidth: 1,
    borderColor: "rgba(125, 211, 252, 0.22)",
  },
  otherMessage: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(16, 26, 46, 0.9)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
    marginBottom: 8,
  },
  ownMessageText: {
    color: theme.colors.text,
  },
  otherMessageText: {
    color: theme.colors.text,
  },
  messageTime: {
    fontSize: 11,
    fontWeight: "500",
  },
  ownMessageTime: {
    color: "rgba(56, 189, 248, 0.7)",
  },
  otherMessageTime: {
    color: theme.colors.mutedText,
  },
});
