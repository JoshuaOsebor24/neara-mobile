import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useMemo, useState } from "react";
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { BackPillButton } from "@/components/ui/back-pill-button";
import { Button } from "@/components/ui/button";
import { theme } from "@/constants/theme";
import {
  updateMobileSession,
  useMobileSession,
} from "@/services/mobile-session";
import { navigateBackOrFallback } from "@/services/navigation";

const STORE_PLAN_META = {
  description:
    "Start selling with a store customers can discover, browse, and message on Neara.",
  dailyEquivalent: "About ₦33/day",
  price: "₦1,000 / month",
  title: "Basic Store",
};

export default function StorePaymentScreen() {
  const router = useRouter();
  const session = useMobileSession();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const plan = useMemo(() => STORE_PLAN_META, []);

  const handleContinue = async () => {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);

    updateMobileSession({
      storePlan: "basic",
    });

    router.replace("/signup?storePlan=basic&paymentStatus=success");
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <LinearGradient
        colors={["rgba(74,136,255,0.16)", "transparent", "rgba(10,15,31,1)"]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      <ScrollView
        bounces={false}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.page}>
          <View style={styles.header}>
            <BackPillButton fallbackHref="/store-mode" />
            <Text style={styles.headerLabel}>Store payment</Text>
          </View>

          <View style={styles.panel}>
            <Text style={styles.eyebrow}>Neara Store Mode</Text>
            <Text style={styles.title}>Start Your Store</Text>
            <Text style={styles.subtitle}>
              Secure your store plan now and start getting discovered today.
            </Text>

            <View style={styles.mainCard}>
              <Text style={styles.planPrice}>{plan.price}</Text>
              <Text style={styles.planDailyEquivalent}>
                {plan.dailyEquivalent}
              </Text>
              <Text style={styles.planDescription}>{plan.description}</Text>

              <View style={styles.benefitsSection}>
                <Text style={styles.benefitsTitle}>What happens next</Text>
                <View style={styles.noticeBullets}>
                  <Text style={styles.noticeBullet}>
                    • Continue setup after payment
                  </Text>
                  <Text style={styles.noticeBullet}>
                    • Add your first products
                  </Text>
                  <Text style={styles.noticeBullet}>
                    • Start appearing in search
                  </Text>
                </View>
              </View>

              <Text style={styles.ctaPrompt}>
                Start getting customers today
              </Text>

              <Button
                disabled={isSubmitting}
                label={isSubmitting ? "Processing..." : "Pay ₦1,000"}
                onPress={() => void handleContinue()}
                style={styles.primaryButton}
              />
            </View>

            <View style={styles.trustRow}>
              <Text style={styles.trustText}>Secure payment</Text>
              <Text style={styles.trustDivider}>•</Text>
              <Text style={styles.trustText}>Cancel anytime</Text>
            </View>

            <Button
              label="Back to pricing"
              onPress={() => navigateBackOrFallback(router, "/store-mode")}
              style={styles.secondaryButton}
              variant="secondary"
            />

            {session.isAuthenticated ? (
              <Text style={styles.sameAccountText}>
                This secure checkout continues on the same Neara account for{" "}
                {session.email || "your login"}.
              </Text>
            ) : null}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const BORDER = theme.colors.borderStrong;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#0A0F1F",
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
  backButton: {
    backgroundColor: theme.button.secondaryBackground,
    borderColor: BORDER,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  backButtonText: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  headerLabel: {
    color: "#B8C2D9",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.8,
    textTransform: "uppercase",
  },
  panel: {
    backgroundColor: theme.colors.surfaceCard,
    borderColor: BORDER,
    borderRadius: 32,
    borderWidth: 1,
    padding: 22,
  },
  eyebrow: {
    color: theme.colors.accentStrong,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.8,
    textTransform: "uppercase",
  },
  title: {
    color: theme.colors.text,
    fontSize: 32,
    fontWeight: "700",
    marginTop: 16,
  },
  subtitle: {
    color: theme.colors.subduedText,
    fontSize: 14,
    lineHeight: 22,
    marginTop: 10,
  },
  mainCard: {
    backgroundColor: theme.colors.surfaceElevated,
    borderColor: BORDER,
    borderRadius: 24,
    borderWidth: 1,
    marginTop: 22,
    padding: 24,
  },
  planPrice: {
    color: "#F5F7FB",
    fontSize: 32,
    fontWeight: "700",
    textAlign: "center",
  },
  planDailyEquivalent: {
    color: theme.colors.accentStrong,
    fontSize: 14,
    fontWeight: "700",
    marginTop: 8,
    textAlign: "center",
  },
  planDescription: {
    color: theme.colors.subduedText,
    fontSize: 16,
    lineHeight: 24,
    marginTop: 16,
    textAlign: "center",
  },
  benefitsSection: {
    marginTop: 24,
  },
  benefitsTitle: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 12,
    textAlign: "center",
  },
  noticeBullets: {
    gap: 8,
  },
  noticeBullet: {
    color: theme.colors.subduedText,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  ctaPrompt: {
    color: "#B8C2D9",
    fontSize: 14,
    fontWeight: "600",
    marginTop: 24,
    textAlign: "center",
  },
  primaryButton: {
    borderRadius: 24,
    marginTop: 16,
    minHeight: 64,
    paddingHorizontal: 32,
  },
  primaryButtonTouchable: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: theme.colors.primaryTextOnAccent,
    fontSize: 16,
    fontWeight: "800",
  },
  trustRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginTop: 16,
  },
  trustText: {
    color: "#B8C2D9",
    fontSize: 12,
    fontWeight: "700",
  },
  trustDivider: {
    color: theme.colors.mutedText,
    fontSize: 12,
  },
  successPill: {
    backgroundColor: "rgba(74,136,255,0.16)",
    borderColor: theme.colors.borderStrong,
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  successPillText: {
    color: "#E2EBFF",
    fontSize: 13,
    fontWeight: "600",
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: theme.button.secondaryBackground,
    borderColor: BORDER,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: "center",
    marginTop: 14,
    minHeight: 54,
  },
  secondaryButtonText: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  sameAccountText: {
    color: "#B8C2D9",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 18,
    textAlign: "center",
  },
});
