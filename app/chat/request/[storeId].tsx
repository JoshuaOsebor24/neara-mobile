import { theme } from "@/constants/theme";
import { buildChatRequestMessage, type ChatRequestChoice } from "@/services/chat-request";
import { BackPillButton } from "@/components/ui/back-pill-button";
import { BrandPill } from "@/components/ui/brand-pill";
import { ScreenCard } from "@/components/ui/screen-card";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
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
      chipBorder: "rgba(52, 211, 153, 0.18)",
      chipText: "#d1fae5",
      eyebrow: "#9ae6c4",
      iconBackground: "rgba(13, 84, 77, 0.48)",
      iconBorder: "rgba(52, 211, 153, 0.18)",
    };
  }

  if (tone === "amber") {
    return {
      cardBorder: "rgba(251, 191, 36, 0.2)",
      cardWash: "rgba(61, 42, 8, 0.24)",
      chipBackground: "rgba(67, 55, 24, 0.64)",
      chipBorder: "rgba(245, 158, 11, 0.16)",
      chipText: "#fef3c7",
      eyebrow: "#fde68a",
      iconBackground: "rgba(67, 55, 24, 0.5)",
      iconBorder: "rgba(245, 158, 11, 0.16)",
    };
  }

  return {
    cardBorder: "rgba(56, 189, 248, 0.22)",
    cardWash: "rgba(9, 44, 84, 0.22)",
    chipBackground: "rgba(9, 44, 84, 0.62)",
    chipBorder: "rgba(56, 189, 248, 0.16)",
    chipText: "#dbeafe",
    eyebrow: "#c6e7ff",
    iconBackground: "rgba(9, 44, 84, 0.48)",
    iconBorder: "rgba(56, 189, 248, 0.16)",
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
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      style={[
        styles.choiceCard,
        {
          borderColor: toneStyles.cardBorder,
          backgroundColor: toneStyles.cardWash,
        },
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
          <Ionicons color={theme.colors.text} name={icon} size={22} />
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
          <Ionicons color={theme.colors.text} name="arrow-forward" size={22} />
        </View>
      </View>
    </TouchableOpacity>
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.pageShell}>
          <View style={styles.topBar}>
            <BackPillButton fallbackHref={`/store/${storeId}`} />
            <BrandPill label={storeName} style={styles.storePill} />
          </View>

          <ScreenCard style={styles.heroCard}>
            <View style={styles.heroGlow} />
            <Text style={styles.heroEyebrow}>Neara Request</Text>
            <Text style={styles.heroTitle}>What do you want to do?</Text>
            <Text style={styles.heroSubtitle}>
              Pick the fastest way to start the conversation.
            </Text>
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
    alignItems: "center",
    flexDirection: "row",
    gap: 14,
    marginBottom: 24,
  },
  storePill: {
    flexShrink: 1,
    maxWidth: 180,
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
    shadowColor: "#38bdf8",
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
    fontSize: 54,
    fontWeight: "800",
    letterSpacing: -1.4,
    lineHeight: 58,
    maxWidth: 280,
  },
  heroSubtitle: {
    color: "#c3d1e6",
    fontSize: 17,
    lineHeight: 26,
    marginTop: 18,
    maxWidth: 290,
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
    color: "#c3d1e6",
    fontSize: 17,
    lineHeight: 24,
    marginTop: 12,
    maxWidth: 210,
  },
  choiceMessageChip: {
    borderRadius: 22,
    borderWidth: 1,
    marginTop: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  choiceMessageText: {
    fontSize: 14,
    lineHeight: 21,
  },
  choiceArrowButton: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    height: 52,
    justifyContent: "center",
    width: 52,
  },
});
