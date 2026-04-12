import { BackPillButton } from "@/components/ui/back-pill-button";
import { ChatInputBar } from "@/components/ui/chat-input-bar";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import {
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
  TouchableOpacity,
  View,
} from "react-native";

const { width } = Dimensions.get("window");

type DraftBubble = {
  created_at: string;
  id: string;
  pending?: boolean;
  sender_id: string;
  text: string;
};

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function isSameDay(left: string, right: string) {
  const leftDate = new Date(left);
  const rightDate = new Date(right);

  return (
    leftDate.getFullYear() === rightDate.getFullYear() &&
    leftDate.getMonth() === rightDate.getMonth() &&
    leftDate.getDate() === rightDate.getDate()
  );
}

function formatDayLabel(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);

  if (isSameDay(date.toISOString(), now.toISOString())) {
    return "Today";
  }

  if (isSameDay(date.toISOString(), yesterday.toISOString())) {
    return "Yesterday";
  }

  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: date.getFullYear() === now.getFullYear() ? undefined : "numeric",
  });
}

function buildStoreInitial(name: string) {
  const trimmed = name.trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : "S";
}

export default function ChatThreadScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const session = useMobileSession();
  const scrollViewRef = useRef<ScrollView>(null);
  const lastAppliedDraftSeedRef = useRef("");
  const latestConversationLoadIdRef = useRef(0);
  const [conversation, setConversation] =
    useState<ChatConversationDetail | null>(null);
  const [storeName, setStoreName] = useState("");
  const [draft, setDraft] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [quotaNotice, setQuotaNotice] = useState("");
  const [optimisticMessages, setOptimisticMessages] = useState<DraftBubble[]>(
    [],
  );

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
  const draftSeedKey = [
    conversationId,
    storeId,
    prefillPrompt,
    productPrompt,
    variantPrompt,
    pricePrompt,
  ].join("|");
  const freeMessagesRemaining = getFreeMessagesRemaining(
    session.messagesSentCount,
    session.isPro,
  );

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    });

    return () => cancelAnimationFrame(frame);
  }, [conversation?.messages, optimisticMessages]);

  useEffect(() => {
    if (conversationId || lastAppliedDraftSeedRef.current === draftSeedKey) {
      return;
    }

    lastAppliedDraftSeedRef.current = draftSeedKey;
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
    draftSeedKey,
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

    let cancelled = false;
    const loadId = latestConversationLoadIdRef.current + 1;
    latestConversationLoadIdRef.current = loadId;

    async function loadConversation() {
      setIsLoading(true);
      setErrorMessage("");

      if (conversationId) {
        const result = await fetchChatConversation(
          session.authToken!,
          conversationId,
        );

        if (cancelled || latestConversationLoadIdRef.current !== loadId) {
          return;
        }

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

      if (cancelled || latestConversationLoadIdRef.current !== loadId) {
        return;
      }

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

    return () => {
      cancelled = true;
    };
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

    const optimisticMessage: DraftBubble = {
      created_at: new Date().toISOString(),
      id: `pending:${Date.now()}`,
      pending: true,
      sender_id: session.id || "me",
      text: trimmedDraft,
    };

    setOptimisticMessages((current) => [...current, optimisticMessage]);
    setDraft("");
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
      setDraft(trimmedDraft);
      setOptimisticMessages((current) =>
        current.filter((message) => message.id !== optimisticMessage.id),
      );
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
    setOptimisticMessages([]);
    setStoreName(result.conversation.store_name);
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
  const subtitle = conversation?.messages?.length
    ? "Online"
    : "Responds fast";
  const messages = conversation?.messages ?? [];
  const hasDraftPreview = !conversationId && !messages.length && Boolean(draft.trim());
  const renderedMessages = [
    ...messages,
    ...optimisticMessages.filter(
      (optimisticMessage) =>
        !messages.some((message) => message.text === optimisticMessage.text),
    ),
  ];
  const threadTitle = storeName || "Store";

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
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => router.push(`/store/${storeId}`)}
            style={styles.headerContentButton}
          >
            <View style={styles.headerAvatar}>
              <Text style={styles.headerAvatarText}>
                {buildStoreInitial(threadTitle)}
              </Text>
            </View>
            <View style={styles.headerContent}>
              <Text numberOfLines={1} style={styles.headerTitle}>
                {title}
              </Text>
              <Text style={styles.headerSubtitle}>{subtitle}</Text>
            </View>
            <Ionicons color="#7F8EAD" name="chevron-forward" size={16} />
          </TouchableOpacity>
        </View>

        {/* Messages */}
        <View style={styles.threadWrap}>
          <LinearGradient
            colors={[
              "rgba(10,15,31,0.96)",
              "rgba(8,12,24,1)",
              "rgba(4, 10, 20, 1)",
            ]}
            pointerEvents="none"
            style={StyleSheet.absoluteFillObject}
          />
          <ScrollView
            ref={scrollViewRef}
            style={styles.messagesContainer}
            contentContainerStyle={[
              styles.messagesContent,
              !renderedMessages.length && styles.messagesContentEmpty,
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {productPrompt ? (
              <View style={styles.contextCard}>
                <Text style={styles.contextLabel}>About</Text>
                <Text style={styles.contextValue}>
                  {variantPrompt ? `${productPrompt} (${variantPrompt})` : productPrompt}
                </Text>
                {pricePrompt ? (
                  <Text style={styles.contextMeta}>Price: {pricePrompt}</Text>
                ) : null}
              </View>
            ) : null}
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
            {!isLoading && !errorMessage && !renderedMessages.length ? (
              <View style={styles.emptyThreadSpacer}>
                <Text style={styles.emptyThreadLabel}>
                  Messages with {title} will appear here
                </Text>
              </View>
            ) : null}
            {renderedMessages.map((message: ChatMessage | DraftBubble, index) => {
              const isOwn = String(message.sender_id) === session.id;
              const previousMessage =
                index > 0 ? renderedMessages[index - 1] : null;
              const nextMessage =
                index < renderedMessages.length - 1
                  ? renderedMessages[index + 1]
                  : null;
              const startsNewDay =
                !previousMessage ||
                !isSameDay(previousMessage.created_at, message.created_at);
              const isGroupedWithPrevious =
                previousMessage &&
                String(previousMessage.sender_id) === String(message.sender_id) &&
                isSameDay(previousMessage.created_at, message.created_at);
              const endsGroup =
                !nextMessage ||
                String(nextMessage.sender_id) !== String(message.sender_id) ||
                !isSameDay(nextMessage.created_at, message.created_at);
              const hasLaterIncomingMessage = renderedMessages
                .slice(index + 1)
                .some(
                  (nextItem) =>
                    String(nextItem.sender_id) !== String(message.sender_id),
                );
              const ownStatus =
                "pending" in message && message.pending
                  ? "sending"
                  : hasLaterIncomingMessage
                    ? "read"
                    : index === renderedMessages.length - 1 && isOwn
                      ? "delivered"
                      : "sent";

              return (
                <View key={message.id}>
                  {startsNewDay ? (
                    <View style={styles.dateSeparatorWrap}>
                      <View style={styles.dateSeparatorLine} />
                      <Text style={styles.dateSeparatorText}>
                        {formatDayLabel(message.created_at)}
                      </Text>
                      <View style={styles.dateSeparatorLine} />
                    </View>
                  ) : null}
                  <View
                    style={[
                      styles.messageBubble,
                      isOwn ? styles.ownMessage : styles.otherMessage,
                      isGroupedWithPrevious
                        ? styles.messageBubbleGrouped
                        : null,
                      "pending" in message &&
                        message.pending &&
                        styles.pendingMessage,
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
                    {endsGroup ? (
                      <View style={styles.messageMetaRow}>
                        {!isOwn ? (
                          <Text style={styles.otherMessageTime}>
                            {formatTime(message.created_at)}
                          </Text>
                        ) : (
                          <>
                            <Text style={styles.ownMessageTime}>
                              {formatTime(message.created_at)}
                            </Text>
                            <View style={styles.messageStatusWrap}>
                              {ownStatus === "sending" ? (
                                <Ionicons
                                  color="rgba(191,219,254,0.8)"
                                  name="time-outline"
                                  size={12}
                                />
                              ) : ownStatus === "read" ? (
                                <Ionicons
                                  color="#4A88FF"
                                  name="checkmark-done"
                                  size={13}
                                />
                              ) : ownStatus === "delivered" ? (
                                <Ionicons
                                  color="rgba(191,219,254,0.84)"
                                  name="checkmark-done"
                                  size={13}
                                />
                              ) : (
                                <Ionicons
                                  color="rgba(191,219,254,0.84)"
                                  name="checkmark"
                                  size={12}
                                />
                              )}
                            </View>
                          </>
                        )}
                      </View>
                    ) : null}
                  </View>
                </View>
              );
            })}
            {!isLoading && !errorMessage && hasDraftPreview ? (
              <View
                style={[
                  styles.messageBubble,
                  styles.ownMessage,
                  styles.draftPreviewBubble,
                ]}
              >
                <Text style={[styles.messageText, styles.ownMessageText]}>
                  {draft.trim()}
                </Text>
                <View style={styles.messageMetaRow}>
                  <Text style={styles.ownMessageTime}>Draft</Text>
                  <Ionicons
                    color="rgba(191,219,254,0.72)"
                    name="create-outline"
                    size={12}
                  />
                </View>
              </View>
            ) : null}
          </ScrollView>
        </View>

        {/* Input */}
        <ChatInputBar
          isSending={isSending}
          onChangeText={setDraft}
          onSend={handleSend}
          placeholder={`Message ${title}...`}
          value={draft}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "transparent",
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
    borderBottomColor: theme.colors.borderSoft,
    backgroundColor: theme.colors.surfaceCard,
  },
  headerContentButton: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: 12,
    marginLeft: 12,
  },
  headerAvatar: {
    alignItems: "center",
    backgroundColor: "rgba(74,136,255,0.16)",
    borderColor: "rgba(74,136,255,0.22)",
    borderRadius: 22,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  headerAvatarText: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: "800",
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 21,
    fontWeight: "800",
    color: theme.colors.text,
    marginBottom: 3,
  },
  headerSubtitle: {
    fontSize: 13,
    color: "#D9E4FF",
    fontWeight: "600",
  },
  threadWrap: {
    flex: 1,
  },
  messagesContainer: {
    flex: 1,
    paddingHorizontal: theme.spacing.screenHorizontal,
    backgroundColor: "transparent",
  },
  messagesContent: {
    flexGrow: 1,
    paddingTop: 18,
    paddingBottom: 18,
  },
  messagesContentEmpty: {
    justifyContent: "flex-end",
  },
  stateWrap: {
    gap: 12,
    paddingVertical: 12,
  },
  emptyThreadSpacer: {
    flex: 1,
    justifyContent: "flex-end",
    paddingBottom: 8,
  },
  emptyThreadLabel: {
    alignSelf: "center",
    color: theme.colors.mutedText,
    fontSize: 13,
    paddingVertical: 12,
  },
  noticeCard: {
    backgroundColor: "rgba(120,163,255,0.08)",
    borderColor: "rgba(120,163,255,0.18)",
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  noticeTitle: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  noticeText: {
    color: theme.colors.subduedText,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
  },
  contextCard: {
    alignSelf: "flex-start",
    backgroundColor: theme.colors.surfaceOverlay,
    borderColor: theme.colors.borderSoft,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 18,
    maxWidth: width * 0.82,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  contextLabel: {
    color: "#D9E4FF",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  contextValue: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
    marginTop: 4,
  },
  contextMeta: {
    color: theme.colors.mutedText,
    fontSize: 12,
    marginTop: 4,
  },
  dateSeparatorWrap: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
    marginTop: 6,
  },
  dateSeparatorLine: {
    backgroundColor: "rgba(148,163,184,0.14)",
    flex: 1,
    height: 1,
  },
  dateSeparatorText: {
    color: theme.colors.mutedText,
    fontSize: 12,
    fontWeight: "700",
  },
  messageBubble: {
    maxWidth: width * 0.72,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 22,
    marginBottom: 10,
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
    backgroundColor: "rgba(74,136,255,0.24)",
    borderWidth: 1,
    borderColor: "rgba(96, 165, 250, 0.3)",
    borderBottomRightRadius: 8,
  },
  otherMessage: {
    alignSelf: "flex-start",
    backgroundColor: theme.colors.surfaceOverlay,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    borderBottomLeftRadius: 8,
  },
  messageBubbleGrouped: {
    marginBottom: 4,
  },
  pendingMessage: {
    opacity: 0.8,
  },
  draftPreviewBubble: {
    marginTop: 4,
    marginBottom: 6,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
    marginBottom: 4,
  },
  ownMessageText: {
    color: theme.colors.text,
  },
  otherMessageText: {
    color: theme.colors.text,
  },
  messageMetaRow: {
    alignItems: "center",
    alignSelf: "flex-end",
    flexDirection: "row",
    gap: 4,
    marginTop: 2,
  },
  messageTime: {
    fontSize: 11,
    fontWeight: "500",
  },
  ownMessageTime: {
    color: "rgba(74,136,255,0.7)",
  },
  otherMessageTime: {
    color: theme.colors.mutedText,
  },
  messageStatusWrap: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    minWidth: 14,
  },
});
