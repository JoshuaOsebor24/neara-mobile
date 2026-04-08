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
import { theme } from "@/constants/theme";
import { useMobileSession } from "@/services/mobile-session";

function BenefitRow({ title }: { title: string }) {
  return (
    <View style={styles.benefitRow}>
      <View style={styles.benefitIcon}>
        <Text style={styles.benefitIconText}>✓</Text>
      </View>
      <View style={styles.benefitContent}>
        <Text style={styles.benefitTitle}>{title}</Text>
      </View>
    </View>
  );
}

const ACTIVE_BENEFITS = [
  "Chat with stores instantly",
  "Check product availability before going",
  "Reserve items ahead of time",
  "Manage all requests in one place",
];

const NEARA_PRO_TRUST_TEXT = "Cancel anytime. No hidden fees.";

export default function ProBenefitsScreen() {
  const router = useRouter();
  const session = useMobileSession();
  const user = { isPro: session.isPro };

  return (
    <SafeAreaView edges={["top", "bottom"]} style={styles.safeArea}>
      <StatusBar style="light" />

      <ScrollView
        bounces={false}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.page}>
          <View style={styles.header}>
            <BackPillButton fallbackHref="/(tabs)/home" />
            <Text style={styles.headerTitle}>Pro Benefits</Text>
            <View style={styles.headerSpacer} />
          </View>

          <View style={styles.panel}>
            <Text style={styles.statusPill}>
              {user?.isPro ? "Neara Pro Active" : "Premium preview"}
            </Text>
            <Text style={styles.title}>
              {user?.isPro ? "You're now unlocked" : "Neara Pro"}
            </Text>
            <Text style={styles.subtitle}>
              Chat, check availability, and reserve items instantly
            </Text>

            <View style={styles.benefitsCard}>
              <View style={styles.benefitsList}>
                {ACTIVE_BENEFITS.map((benefit) => (
                  <BenefitRow key={benefit} title={benefit} />
                ))}
              </View>
            </View>

            <View style={styles.ctaSection}>
              {user?.isPro ? (
                <View style={styles.ctaGrid}>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => router.push("/")}
                    style={styles.primaryCta}
                  >
                    <Text style={styles.primaryCtaText}>Browse stores</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => router.push("/upgrade")}
                    style={styles.linkCta}
                  >
                    <Text style={styles.linkCtaText}>Learn more</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.ctaGrid}>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => router.push("/upgrade")}
                    style={styles.primaryCta}
                  >
                    <Text style={styles.primaryCtaText}>
                      Unlock Chat for ₦1,000 / month
                    </Text>
                  </TouchableOpacity>
                  <Text style={styles.trustText}>{NEARA_PRO_TRUST_TEXT}</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const BORDER = "rgba(255,255,255,0.10)";

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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 28,
  },
  backButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "rgba(255,255,255,0.05)",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  backButtonText: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  headerTitle: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  headerSpacer: {
    width: 84,
  },
  panel: {
    borderRadius: 30,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "rgba(255,255,255,0.04)",
    paddingHorizontal: 20,
    paddingVertical: 24,
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  statusPill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(125, 211, 252, 0.14)",
    backgroundColor: "rgba(56, 189, 248, 0.10)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    color: "#bae6fd",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },
  title: {
    marginTop: 16,
    color: theme.colors.text,
    fontSize: 36,
    fontWeight: "700",
    letterSpacing: -1,
  },
  subtitle: {
    marginTop: 12,
    color: "#cbd5e1",
    fontSize: 14,
    lineHeight: 21,
  },
  benefitsCard: {
    marginTop: 28,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "rgba(2, 6, 23, 0.82)",
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 1,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  benefitsList: {
    marginTop: 16,
    gap: 12,
  },
  benefitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.035)",
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  benefitIcon: {
    width: 40,
    height: 40,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(56, 189, 248, 0.12)",
    shadowColor: "#fff",
    shadowOpacity: 0.05,
    shadowRadius: 1,
    shadowOffset: { width: 0, height: 1 },
  },
  benefitIconText: {
    color: "#e0f2fe",
    fontSize: 14,
    fontWeight: "700",
  },
  benefitContent: {
    flex: 1,
  },
  benefitTitle: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  ctaSection: {
    marginTop: 24,
  },
  ctaGrid: {
    gap: 12,
  },
  primaryCta: {
    minHeight: 56,
    borderRadius: 18,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#fff",
    shadowOpacity: 0.14,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  primaryCtaText: {
    color: "#020617",
    fontSize: 15,
    fontWeight: "800",
  },
  linkCta: {
    alignItems: "center",
    paddingVertical: 8,
  },
  linkCtaText: {
    color: "#94a3b8",
    fontSize: 14,
    fontWeight: "600",
  },
  trustText: {
    marginTop: 12,
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },
});
