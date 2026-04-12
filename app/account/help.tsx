import Ionicons from "@expo/vector-icons/Ionicons";
import Constants from "expo-constants";
import { StatusBar } from "expo-status-bar";
import * as WebBrowser from "expo-web-browser";
import {
  Alert,
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

const HELP_CENTER_PORT = "5500";
const HELP_CENTER_PATH = "/neara-help-center/index.html";

function normalizeBaseUrl(value?: string | null) {
  const normalized = String(value || "").trim().replace(/\/+$/, "");
  return normalized || null;
}

function extractExpoHostCandidate() {
  const constants = Constants as unknown as {
    expoConfig?: { hostUri?: string | null } | null;
    linkingUri?: string | null;
    manifest?: { debuggerHost?: string | null } | null;
    manifest2?: {
      extra?: {
        expoGo?: { debuggerHost?: string | null } | null;
      } | null;
    } | null;
  };

  const hostSource =
    constants.expoConfig?.hostUri ||
    constants.manifest2?.extra?.expoGo?.debuggerHost ||
    constants.manifest?.debuggerHost ||
    constants.linkingUri ||
    "";

  const normalizedHost = String(hostSource)
    .trim()
    .replace(/^exp:\/\//, "")
    .replace(/^https?:\/\//, "")
    .split("/")[0]
    .split(":")[0];

  return normalizedHost || null;
}

function getHelpCenterUrl() {
  const explicitUrl = normalizeBaseUrl(process.env.EXPO_PUBLIC_HELP_CENTER_URL);
  if (explicitUrl) {
    return explicitUrl;
  }

  const expoHost = extractExpoHostCandidate();
  if (expoHost) {
    return `http://${expoHost}:${HELP_CENTER_PORT}${HELP_CENTER_PATH}`;
  }

  return `http://localhost:${HELP_CENTER_PORT}${HELP_CENTER_PATH}`;
}

const quickHelpItems = [
  { text: "How to chat with a store", icon: "chatbubble-outline" },
  { text: "How to save a store", icon: "bookmark-outline" },
  { text: "How to start a store", icon: "storefront-outline" },
  { text: "How to upgrade to Pro", icon: "flash-outline" },
] as const satisfies readonly {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  text: string;
}[];

export default function HelpScreen() {
  const openHelpCenter = async () => {
    try {
      await WebBrowser.openBrowserAsync(getHelpCenterUrl());
    } catch {
      Alert.alert(
        "Help Center unavailable",
        "We could not open the Neara Help Center right now.",
      );
    }
  };

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
                      onPress={openHelpCenter}
                      style={styles.quickHelpItem}
                    >
                      <View style={styles.quickHelpItemLeft}>
                        <Ionicons
                          color="#4A88FF"
                          name={item.icon}
                          size={18}
                          style={styles.quickHelpItemIcon}
                        />
                        <Text style={styles.quickHelpItemText}>
                          {item.text}
                        </Text>
                      </View>
                      <Ionicons
                        color="#7F8EAD"
                        name="chevron-forward"
                        size={16}
                      />
                    </TouchableOpacity>
                  ))}
                </View>

                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={openHelpCenter}
                  style={[styles.supportButton, styles.helpCenterButton]}
                >
                  <Ionicons color="#0A0F1F" name="open-outline" size={16} />
                  <Text style={styles.helpCenterButtonText}>
                    Open Help Center
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Need help?</Text>
                <Text style={styles.sectionSubtitle}>
                  We usually respond within minutes
                </Text>

                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={openHelpCenter}
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
    backgroundColor: "transparent",
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
    color: "#B8C2D9",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 2.2,
    textTransform: "uppercase",
  },
  panel: {
    padding: 20,
  },
  eyebrow: {
    color: "#D4E1FF",
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
    backgroundColor: "rgba(10,15,31,0.4)",
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
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: "600",
  },
  supportButton: {
    alignItems: "center",
    backgroundColor: "rgba(74,136,255,0.12)",
    borderColor: "rgba(74,136,255,0.20)",
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: "center",
    marginTop: 16,
    minHeight: 48,
    paddingHorizontal: 20,
  },
  helpCenterButton: {
    backgroundColor: "#4A88FF",
    flexDirection: "row",
    gap: 8,
    marginTop: 16,
    borderColor: "rgba(120,163,255,0.28)",
  },
  helpCenterButtonText: {
    color: "#F5F7FB",
    fontSize: 14,
    fontWeight: "800",
  },
  supportButtonText: {
    color: "#4A88FF",
    fontSize: 14,
    fontWeight: "700",
  },
});
