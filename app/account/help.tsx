import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
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
import { theme } from "@/constants/theme";

const quickHelpItems = [
  { text: "How to chat with a store", icon: "chatbubble-outline" },
  { text: "How to save a store", icon: "bookmark-outline" },
  { text: "How to start a store", icon: "storefront-outline" },
  { text: "How to upgrade to Pro", icon: "flash-outline" },
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
            <Text style={styles.title}>Help</Text>

            <View style={styles.sectionStack}>
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Quick help</Text>
                <View style={styles.quickHelpList}>
                  {quickHelpItems.map((item) => (
                    <TouchableOpacity
                      key={item.text}
                      activeOpacity={0.7}
                      onPress={() => {
                        // TODO: Navigate to specific help content
                      }}
                      style={styles.quickHelpItem}
                    >
                      <View style={styles.quickHelpItemLeft}>
                        <Ionicons
                          color="#38bdf8"
                          name={item.icon}
                          size={18}
                          style={styles.quickHelpItemIcon}
                        />
                        <Text style={styles.quickHelpItemText}>
                          {item.text}
                        </Text>
                      </View>
                      <Ionicons
                        color="#64748b"
                        name="chevron-forward"
                        size={16}
                      />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Need help?</Text>
                <Text style={styles.sectionSubtitle}>
                  We usually respond within minutes
                </Text>

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
    alignItems: "center",
    backgroundColor: "rgba(2, 6, 23, 0.4)",
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  quickHelpItemLeft: {
    alignItems: "center",
    flexDirection: "row",
    flex: 1,
    gap: 12,
  },
  quickHelpItemIcon: {
    marginTop: 1,
  },
  quickHelpItemText: {
    color: "#f1f5f9",
    fontSize: 14,
    fontWeight: "600",
  },
  supportButton: {
    alignItems: "center",
    backgroundColor: "rgba(56, 189, 248, 0.12)",
    borderColor: "rgba(56, 189, 248, 0.20)",
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: "center",
    marginTop: 16,
    minHeight: 48,
    paddingHorizontal: 20,
  },
  supportButtonText: {
    color: "#38bdf8",
    fontSize: 14,
    fontWeight: "700",
  },
});
