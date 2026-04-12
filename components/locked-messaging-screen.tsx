import { type Href, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BackPillButton } from "@/components/ui/back-pill-button";
import { ScreenCard } from "@/components/ui/screen-card";
import { theme } from "@/constants/theme";
import { useMobileSession } from "@/services/mobile-session";
import { navigateBackOrFallback } from "@/services/navigation";

const NEARA_PRO_TRUST_TEXT = "Cancel anytime. No hidden fees.";

export function LockedMessagingScreen({
  fallbackHref = "/(tabs)/profile",
  message,
  showActions,
  title,
}: {
  fallbackHref?: Href;
  message: string;
  showActions: boolean;
  title: string;
}) {
  const router = useRouter();
  const session = useMobileSession();
  const primaryHref = session.isPro ? "/(tabs)/home" : "/upgrade";
  const primaryLabel = session.isPro ? "Go Home" : "Unlock Chat for ₦1,000 / month";

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
            <BackPillButton fallbackHref={fallbackHref} />
          </View>

          <ScreenCard style={styles.panel}>
            <Text style={styles.eyebrow}>Neara Chat</Text>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.message}>{message}</Text>

            {showActions ? (
              <>
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => router.push(primaryHref)}
                    style={styles.primaryButton}
                  >
                    <Text style={styles.primaryButtonText}>{primaryLabel}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() =>
                      navigateBackOrFallback(router, fallbackHref)
                    }
                    style={styles.secondaryButton}
                  >
                    <Text style={styles.secondaryButtonText}>Go back</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.trustText}>{NEARA_PRO_TRUST_TEXT}</Text>
              </>
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
    backgroundColor: "transparent",
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  page: {
    flex: 1,
  },
  header: {
    marginBottom: 20,
  },
  panel: {
    marginTop: "auto",
    marginBottom: "auto",
    padding: 24,
  },
  eyebrow: {
    color: "#D4E1FF",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.8,
    textTransform: "uppercase",
  },
  title: {
    marginTop: 12,
    color: theme.colors.text,
    fontSize: 30,
    fontWeight: "700",
    letterSpacing: -0.7,
  },
  message: {
    marginTop: 12,
    color: "#C7D2E5",
    fontSize: 14,
    lineHeight: 22,
  },
  actionRow: {
    gap: 12,
    marginTop: 24,
  },
  primaryButton: {
    borderRadius: 999,
    backgroundColor: theme.colors.accent,
    paddingHorizontal: 18,
    paddingVertical: 15,
    alignItems: "center",
  },
  primaryButtonText: {
    color: theme.colors.primaryTextOnAccent,
    fontSize: 14,
    fontWeight: "700",
  },
  secondaryButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: theme.button.secondaryBackground,
    paddingHorizontal: 18,
    paddingVertical: 15,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  trustText: {
    marginTop: 12,
    color: "#B8C2D9",
    fontSize: 12,
    textAlign: "center",
  },
});
