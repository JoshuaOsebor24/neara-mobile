import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useMemo, useState } from "react";
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { BackPillButton } from "@/components/ui/back-pill-button";
import { theme } from "@/constants/theme";
import {
  updateMobileSession,
  useMobileSession,
} from "@/services/mobile-session";
import { navigateBackOrFallback } from "@/services/navigation";

const STORE_PLAN_META = {
  description: "Start selling with a simple store presence across Neara.",
  price: "₦1,000 / month",
  title: "Basic Store",
};

export default function StorePaymentScreen() {
  const router = useRouter();
  const session = useMobileSession();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState("");
  const plan = useMemo(() => STORE_PLAN_META, []);

  const handleContinue = async () => {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setNotice("");

    updateMobileSession({
      storePlan: "basic",
    });

    setNotice("Payment confirmed. Continuing to registration...");
    router.replace("/signup?storePlan=basic&paymentStatus=success");
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <LinearGradient
        colors={["rgba(56,189,248,0.16)", "transparent", "rgba(2,6,23,1)"]}
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
            <Text style={styles.title}>Complete Your Payment</Text>
            <Text style={styles.subtitle}>
              Continue with the same store setup flow after payment is
              confirmed.
            </Text>

            <View style={styles.planCard}>
              <Text style={styles.planTitle}>{plan.title}</Text>
              <Text style={styles.planPrice}>{plan.price}</Text>
              <Text style={styles.planDescription}>{plan.description}</Text>
            </View>

            <View style={styles.noticeCard}>
              <Text style={styles.noticeTitle}>Payment step</Text>
              <Text style={styles.noticeText}>
                Real payment can be wired into this step later. For now, this
                keeps the correct flow and success transition from pricing to
                registration.
              </Text>
            </View>

            {notice ? (
              <View style={styles.successPill}>
                <Text style={styles.successPillText}>{notice}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              activeOpacity={0.85}
              disabled={isSubmitting}
              onPress={() => void handleContinue()}
              style={[
                styles.primaryButton,
                isSubmitting && styles.primaryButtonDisabled,
              ]}
            >
              <Text style={styles.primaryButtonText}>
                {isSubmitting ? "Confirming..." : "Confirm payment"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => navigateBackOrFallback(router, "/store-mode")}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonText}>Back to pricing</Text>
            </TouchableOpacity>

            {session.isAuthenticated ? (
              <Text style={styles.sameAccountText}>
                This continues on the same Neara account for{" "}
                {session.email || "your login"}.
              </Text>
            ) : null}
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
    backgroundColor: "#020617",
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
    backgroundColor: "rgba(255,255,255,0.05)",
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
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.8,
    textTransform: "uppercase",
  },
  panel: {
    backgroundColor: "rgba(2, 6, 23, 0.82)",
    borderColor: BORDER,
    borderRadius: 32,
    borderWidth: 1,
    padding: 22,
  },
  eyebrow: {
    color: "#b0e7fe",
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
    color: "#cbd5e1",
    fontSize: 14,
    lineHeight: 22,
    marginTop: 10,
  },
  planCard: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderColor: BORDER,
    borderRadius: 24,
    borderWidth: 1,
    marginTop: 22,
    padding: 18,
  },
  planTitle: {
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: "700",
  },
  planPrice: {
    color: "#f8fafc",
    fontSize: 24,
    fontWeight: "700",
    marginTop: 10,
  },
  planDescription: {
    color: "#cbd5e1",
    fontSize: 14,
    lineHeight: 21,
    marginTop: 10,
  },
  noticeCard: {
    backgroundColor: "rgba(56,189,248,0.08)",
    borderColor: "rgba(125, 211, 252, 0.16)",
    borderRadius: 24,
    borderWidth: 1,
    marginTop: 18,
    padding: 18,
  },
  noticeTitle: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
  noticeText: {
    color: "#d7e4f2",
    fontSize: 13,
    lineHeight: 20,
    marginTop: 8,
  },
  successPill: {
    backgroundColor: "rgba(34,197,94,0.12)",
    borderColor: "rgba(74, 222, 128, 0.22)",
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  successPillText: {
    color: "#dcfce7",
    fontSize: 13,
    fontWeight: "600",
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderRadius: 20,
    justifyContent: "center",
    marginTop: 22,
    minHeight: 56,
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: "#020617",
    fontSize: 15,
    fontWeight: "800",
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
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
    color: "#94a3b8",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 18,
    textAlign: "center",
  },
});
