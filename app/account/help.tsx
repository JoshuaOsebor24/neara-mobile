import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BackPillButton } from "@/components/ui/back-pill-button";
import { ScreenCard } from "@/components/ui/screen-card";
import { theme } from "@/constants/theme";

const quickHelpItems = [
  "How to chat with a store",
  "How to save a store",
  "How to start a store",
  "How to upgrade to Pro",
];

export default function HelpScreen() {
  const router = useRouter();

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
            <BackPillButton fallbackHref="/(tabs)/home" />
            <Text style={styles.headerLabel}>Neara</Text>
          </View>

          <ScreenCard style={styles.panel}>
            <Text style={styles.eyebrow}>Help</Text>
            <Text style={styles.title}>Help</Text>

            <View style={styles.sectionStack}>
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Quick help</Text>
                <View style={styles.quickHelpList}>
                  {quickHelpItems.map((item) => (
                    <View key={item} style={styles.quickHelpItem}>
                      <Text style={styles.quickHelpItemText}>{item}</Text>
                    </View>
                  ))}
                </View>
              </View>

              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Need help?</Text>
                <Text style={styles.sectionSubtitle}>Get support in minutes</Text>

                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => router.push("/upgrade")}
                  style={styles.supportButton}
                >
                  <Text style={styles.supportButtonText}>Contact support</Text>
                </TouchableOpacity>
              </View>
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
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 32,
  },
  page: {
    width: "100%",
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  headerLabel: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 2.2,
    textTransform: "uppercase",
  },
  panel: {
    padding: 20,
  },
  eyebrow: {
    color: "#bae6fd",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.8,
    textTransform: "uppercase",
  },
  title: {
    color: theme.colors.text,
    fontSize: 30,
    fontWeight: "700",
    marginTop: 12,
  },
  sectionStack: {
    gap: 16,
    marginTop: 24,
  },
  sectionCard: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderColor: "rgba(255,255,255,0.10)",
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: "700",
  },
  sectionSubtitle: {
    color: theme.colors.mutedText,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
  },
  quickHelpList: {
    gap: 12,
    marginTop: 16,
  },
  quickHelpItem: {
    backgroundColor: "rgba(2, 6, 23, 0.4)",
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  quickHelpItemText: {
    color: "#f1f5f9",
    fontSize: 14,
    fontWeight: "600",
  },
  supportButton: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    justifyContent: "center",
    marginTop: 16,
    minHeight: 48,
    paddingHorizontal: 20,
  },
  supportButtonText: {
    color: "#020617",
    fontSize: 14,
    fontWeight: "700",
  },
});
