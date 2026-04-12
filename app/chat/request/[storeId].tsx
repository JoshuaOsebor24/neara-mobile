import { theme } from "@/constants/theme";
import { buildChatRequestMessage, type ChatRequestChoice } from "@/services/chat-request";
import { BackPillButton } from "@/components/ui/back-pill-button";
import { ScreenCard } from "@/components/ui/screen-card";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

type RequestTone = "green" | "amber" | "blue";

type RequestCardConfig = {
  choice: ChatRequestChoice;
  description: string;
  eyebrow: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  tone: RequestTone;
};

const REQUEST_CARDS: RequestCardConfig[] = [
  {
    choice: "availability",
    description: "Ask if the item is still available before you leave.",
    eyebrow: "Quick stock check",
    icon: "checkmark-circle-outline",
    title: "Check Availability",
    tone: "green",
  },
  {
    choice: "reserve",
    description: "Tell the store you want the item kept aside for pickup.",
    eyebrow: "Hold it for me",
    icon: "document-text-outline",
    title: "Reserve Product",
    tone: "amber",
  },
  {
    choice: "question",
    description: "Start a quick product question without typing from scratch.",
    eyebrow: "Need more detail?",
    icon: "chatbox-ellipses-outline",
    title: "Ask Question",
    tone: "blue",
  },
];

function getToneStyles(tone: RequestTone) {
  if (tone === "green") {
    return {
      cardBorder: "rgba(16, 185, 129, 0.22)",
      cardWash: "rgba(11, 47, 41, 0.34)",
      chipBackground: "rgba(13, 84, 77, 0.6)",
      chipBorder: "rgba(74,136,255,0.18)",
      chipText: "#D9E4FF",
      eyebrow: "#9ae6c4",
      iconBackground: "rgba(13, 84, 77, 0.48)",
      iconBorder: "rgba(74,136,255,0.18)",
    };
  }

  if (tone === "amber") {
    return {
      cardBorder: "rgba(245, 158, 11, 0.16)",
      cardWash: "rgba(56, 42, 14, 0.2)",
      chipBackground: "rgba(67, 55, 24, 0.42)",
      chipBorder: "rgba(245, 158, 11, 0.12)",
      chipText: "#f8e7bf",
      eyebrow: "#f4d48b",
      iconBackground: "rgba(67, 55, 24, 0.34)",
      iconBorder: "rgba(245, 158, 11, 0.12)",
    };
  }

  return {
    cardBorder: "rgba(74,136,255,0.16)",
    cardWash: "rgba(10, 36, 62, 0.18)",
    chipBackground: "rgba(9, 44, 84, 0.42)",
    chipBorder: "rgba(74,136,255,0.12)",
    chipText: "#d8e7f7",
    eyebrow: "#c0d9ee",
    iconBackground: "rgba(9, 44, 84, 0.34)",
    iconBorder: "rgba(74,136,255,0.12)",
  };
}

function RequestChoiceCard({
  choice,
  description,
  eyebrow,
  icon,
  message,
  onPress,
  title,
  tone,
}: RequestCardConfig & {
  message: string;
  onPress: () => void;
}) {
  const toneStyles = getToneStyles(tone);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.choiceCard,
        {
          borderColor: toneStyles.cardBorder,
          backgroundColor: toneStyles.cardWash,
        },
        pressed && styles.choiceCardPressed,
      ]}
    >
      <View style={styles.choiceRow}>
        <View
          style={[
            styles.choiceIconWrap,
            {
              backgroundColor: toneStyles.iconBackground,
              borderColor: toneStyles.iconBorder,
            },
          ]}
        >
          <Ionicons color={theme.colors.text} name={icon} size={20} />
        </View>

        <View style={styles.choiceContent}>
          <Text style={[styles.choiceEyebrow, { color: toneStyles.eyebrow }]}>{eyebrow}</Text>
          <Text style={styles.choiceTitle}>{title}</Text>
          <Text style={styles.choiceDescription}>{description}</Text>
          <View
            style={[
              styles.choiceMessageChip,
              {
                backgroundColor: toneStyles.chipBackground,
                borderColor: toneStyles.chipBorder,
              },
            ]}
          >
            <Text style={[styles.choiceMessageText, { color: toneStyles.chipText }]}>
              {message}
            </Text>
          </View>
        </View>

        <View style={styles.choiceArrowButton}>
          <Ionicons color="rgba(248,250,252,0.74)" name="arrow-forward" size={18} />
        </View>
      </View>
    </Pressable>
  );
}

export default function ChatRequestScreen() {
  const params = useLocalSearchParams<{
    price?: string;
    product?: string;
    storeId: string;
    storeName?: string;
    variant?: string;
  }>();
  const router = useRouter();

  const storeId = String(params.storeId || "");
  const storeName = String(params.storeName || "").trim() || "Store";
  const product = String(params.product || "");
  const variant = String(params.variant || "");
  const price = String(params.price || "");

  const handleChoose = (choice: ChatRequestChoice) => {
    router.push({
      pathname: "/chat/[storeId]",
      params: {
        prefill: buildChatRequestMessage(choice, { price, product, variant }),
        price,
        product,
        request: choice,
        storeId,
        variant,
      },
    });
  };

  const handleCustomMessage = () => {
    router.push({
      pathname: "/chat/[storeId]",
      params: {
        price,
        product,
        storeId,
        variant,
      },
    });
  };

  const heroTitle = product
    ? "How do you want to message this store about this product?"
    : "How do you want to start the conversation with this store?";

  const heroSubtitle = product
    ? `Choose a quick way to contact ${storeName} about ${variant ? `${product} (${variant})` : product}.`
    : `Choose the fastest way to start a conversation with ${storeName}.`;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.pageShell}>
          <View style={styles.topBar}>
            <BackPillButton fallbackHref={`/store/${storeId}`} />
            <View style={styles.storeIdentity}>
              <Text style={styles.storeLabel}>Chatting with</Text>
              <Text style={styles.storeName} numberOfLines={2}>
                {storeName}
              </Text>
            </View>
          </View>

          <ScreenCard style={styles.heroCard}>
            <View style={styles.heroGlow} />
            <Text style={styles.heroEyebrow}>Neara Request</Text>
            <Text style={styles.heroTitle}>{heroTitle}</Text>
            <Text style={styles.heroSubtitle}>{heroSubtitle}</Text>
          </ScreenCard>

          <View style={styles.choiceList}>
            {REQUEST_CARDS.map((card) => (
              <RequestChoiceCard
                key={card.choice}
                {...card}
                message={buildChatRequestMessage(card.choice, { price, product, variant })}
                onPress={() => handleChoose(card.choice)}
              />
            ))}

            <Pressable
              onPress={handleCustomMessage}
              style={({ pressed }) => [
                styles.customMessageCard,
                pressed && styles.choiceCardPressed,
              ]}
            >
              <View style={styles.choiceRow}>
                <View style={styles.customMessageIconWrap}>
                  <Ionicons
                    color={theme.colors.text}
                    name="create-outline"
                    size={20}
                  />
                </View>

                <View style={styles.choiceContent}>
                  <Text style={styles.customMessageEyebrow}>Write your own</Text>
                  <Text style={styles.customMessageTitle}>Type your own message</Text>
                  <Text style={styles.customMessageDescription}>
                    Open the chat and send a custom message in your own words.
                  </Text>
                </View>

                <View style={styles.choiceArrowButton}>
                  <Ionicons
                    color="rgba(248,250,252,0.74)"
                    name="arrow-forward"
                    size={18}
                  />
                </View>
              </View>
            </Pressable>
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
  contentContainer: {
    paddingBottom: 32,
    paddingTop: 8,
  },
  pageShell: {
    paddingHorizontal: theme.spacing.screenHorizontal,
  },
  topBar: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 14,
    marginBottom: 24,
  },
  storeIdentity: {
    flexShrink: 1,
    flex: 1,
    paddingTop: 4,
  },
  storeLabel: {
    color: "#8aa4c6",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.6,
    marginBottom: 6,
    textTransform: "uppercase",
  },
  storeName: {
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: "800",
    lineHeight: 26,
  },
  heroCard: {
    marginBottom: 20,
    paddingHorizontal: 28,
    paddingVertical: 28,
    position: "relative",
  },
  heroGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "transparent",
    borderRadius: 34,
    shadowColor: "#4A88FF",
    shadowOffset: { height: 12, width: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 40,
  },
  heroEyebrow: {
    color: "#c6e7ff",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 3,
    marginBottom: 14,
    textTransform: "uppercase",
  },
  heroTitle: {
    color: theme.colors.text,
    fontSize: 40,
    fontWeight: "800",
    letterSpacing: -1,
    lineHeight: 46,
    maxWidth: 320,
  },
  heroSubtitle: {
    color: theme.colors.subduedText,
    fontSize: 16,
    lineHeight: 24,
    marginTop: 16,
    maxWidth: 310,
  },
  choiceList: {
    gap: 16,
  },
  choiceCard: {
    borderRadius: 32,
    borderWidth: 1,
    overflow: "hidden",
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  choiceCardPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.985 }],
  },
  choiceRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 16,
  },
  choiceIconWrap: {
    alignItems: "center",
    borderRadius: 20,
    borderWidth: 1,
    height: 72,
    justifyContent: "center",
    width: 72,
  },
  choiceContent: {
    flex: 1,
    paddingTop: 4,
  },
  choiceEyebrow: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 3,
    marginBottom: 10,
    textTransform: "uppercase",
  },
  choiceTitle: {
    color: theme.colors.text,
    fontSize: 27,
    fontWeight: "800",
    lineHeight: 32,
  },
  choiceDescription: {
    color: theme.colors.subduedText,
    fontSize: 17,
    lineHeight: 24,
    marginTop: 12,
    maxWidth: 210,
  },
  choiceMessageChip: {
    alignSelf: "flex-start",
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 16,
    opacity: 0.88,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  choiceMessageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  choiceArrowButton: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.035)",
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    marginTop: 6,
    width: 44,
  },
  customMessageCard: {
    backgroundColor: "rgba(16, 26, 46, 0.58)",
    borderColor: "rgba(148, 163, 184, 0.16)",
    borderRadius: 32,
    borderWidth: 1,
    overflow: "hidden",
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  customMessageIconWrap: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 20,
    borderWidth: 1,
    height: 72,
    justifyContent: "center",
    width: 72,
  },
  customMessageEyebrow: {
    color: "#C7D2E5",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 3,
    marginBottom: 10,
    textTransform: "uppercase",
  },
  customMessageTitle: {
    color: theme.colors.text,
    fontSize: 25,
    fontWeight: "800",
    lineHeight: 30,
  },
  customMessageDescription: {
    color: "#b6c4da",
    fontSize: 16,
    lineHeight: 23,
    marginTop: 10,
    maxWidth: 220,
  },
});
