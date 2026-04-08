import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { theme } from "@/constants/theme";
import {
  buildSessionPatchFromAuthUser,
  initializeProSubscriptionWithBackend,
  verifyProSubscriptionWithBackend,
} from "@/services/auth-api";
import { updateMobileSession, useMobileSession } from "@/services/mobile-session";
import { navigateBackOrFallback } from "@/services/navigation";
import {
  NEARA_PRO_LIMIT_MESSAGE,
  NEARA_PRO_PRICE_LABEL,
  NEARA_PRO_TRUST_TEXT,
} from "@/services/role-access";

const UPGRADE_BENEFITS = [
  "Chat with stores instantly",
  "Confirm product availability before going",
  "Reserve items ahead of time",
];

type Notice = {
  type: "success" | "error";
  text: string;
} | null;

export default function UpgradeScreen() {
  const router = useRouter();
  const session = useMobileSession();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const hydrated = true;
  const hasToken = session.isAuthenticated;
  const isPro = session.isPro;

  useFocusEffect(
    useCallback(() => {
      if (session.isPro) {
        router.replace("/(tabs)/home");
      }
    }, [router, session.isPro]),
  );

  if (!hydrated) {
    return (
      <SafeAreaView edges={["top"]} style={styles.safeArea}>
        <StatusBar style="light" />
        <View style={styles.loadingScreen}>
          <View style={styles.loadingPill}>
            <Text style={styles.loadingText}>Loading Pro...</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

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
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => navigateBackOrFallback(router, "/(tabs)/profile")}
              style={styles.backButton}
            >
              <Text style={styles.backButtonText}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.headerLabel}>Neara</Text>
          </View>

          <View style={styles.panel}>
            <View style={styles.heroBlock}>
              <Text style={styles.heroPill}>Premium Access</Text>
              <Text style={styles.heroTitle}>Unlock Chat with Stores</Text>
              <Text style={styles.heroSubtitle}>
                Check availability, reserve products, and chat instantly.
              </Text>

              {!isPro ? (
                <View style={styles.limitCard}>
                  <Text style={styles.limitTitle}>{NEARA_PRO_LIMIT_MESSAGE}</Text>
                  <Text style={styles.limitText}>
                    Upgrade to continue chatting with stores instantly.
                  </Text>
                </View>
              ) : null}
            </View>

            {notice ? (
              <View
                style={[
                  styles.notice,
                  notice.type === "error"
                    ? styles.noticeError
                    : styles.noticeSuccess,
                ]}
              >
                <Text style={styles.noticeText}>{notice.text}</Text>
              </View>
            ) : null}

            {!hasToken ? (
              <View style={[styles.notice, styles.noticeError]}>
                <Text style={styles.noticeText}>Log in to activate Pro.</Text>
              </View>
            ) : null}

            <LinearGradient
              colors={["rgba(14,165,233,0.12)", "rgba(15,23,42,0.92)"]}
              style={styles.pricingCard}
            >
              <View style={styles.pricingHeader}>
                <Text style={styles.pricingTitle}>{NEARA_PRO_PRICE_LABEL}</Text>
                <Text style={styles.pricingSubtitle}>
                  {NEARA_PRO_TRUST_TEXT}
                </Text>
              </View>

              <View style={styles.benefitList}>
                {UPGRADE_BENEFITS.map((benefit) => (
                  <View key={benefit} style={styles.benefitRow}>
                    <View style={styles.benefitIcon}>
                      <Text style={styles.benefitIconText}>✓</Text>
                    </View>
                    <Text style={styles.benefitText}>{benefit}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.ctaGrid}>
                {!hasToken ? (
                  <>
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() => router.push("/login")}
                      style={styles.primaryCta}
                    >
                      <Text style={styles.primaryCtaText}>Unlock Chat</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() => navigateBackOrFallback(router, "/(tabs)/profile")}
                      style={styles.secondaryCta}
                    >
                      <Text style={styles.secondaryCtaText}>Not now</Text>
                    </TouchableOpacity>
                  </>
                ) : isPro ? (
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => router.push("/")}
                    style={styles.primaryCta}
                  >
                    <Text style={styles.primaryCtaText}>Go Home</Text>
                  </TouchableOpacity>
                ) : (
                  <>
                    <TouchableOpacity
                      activeOpacity={0.85}
                      disabled={isSubmitting}
                      onPress={async () => {
                        setIsSubmitting(true);
                        setNotice(null);

                        if (!session.authToken) {
                          setIsSubmitting(false);
                          setNotice({
                            type: "error",
                            text: "Log in again to activate Pro.",
                          });
                          return;
                        }

                        const initResult = await initializeProSubscriptionWithBackend(
                          session.authToken,
                        );

                        if (!initResult.ok) {
                          setIsSubmitting(false);
                          setNotice({
                            type: "error",
                            text: initResult.error,
                          });
                          return;
                        }

                        if (
                          initResult.provider !== "mock" &&
                          initResult.authorizationUrl
                        ) {
                          const browserResult = await WebBrowser.openBrowserAsync(
                            initResult.authorizationUrl,
                          );

                          if (browserResult.type === "cancel") {
                            setIsSubmitting(false);
                            setNotice({
                              type: "error",
                              text: "Checkout was cancelled.",
                            });
                            return;
                          }
                        }

                        const verifyResult = await verifyProSubscriptionWithBackend(
                          session.authToken,
                          initResult.reference,
                        );

                        if (!verifyResult.ok) {
                          setIsSubmitting(false);
                          setNotice({
                            type: "error",
                            text: verifyResult.error,
                          });
                          return;
                        }

                        updateMobileSession(
                          buildSessionPatchFromAuthUser(
                            verifyResult.user,
                            session.authToken,
                          ),
                        );
                        setIsSubmitting(false);
                        setNotice({
                          type: "success",
                          text: verifyResult.message || "Pro activated.",
                        });
                        router.replace("/(tabs)/home");
                      }}
                      style={styles.accentCta}
                    >
                      <Text style={styles.accentCtaText}>
                        {isSubmitting ? "Activating Pro..." : "Unlock Chat"}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() => navigateBackOrFallback(router, "/(tabs)/profile")}
                      style={styles.secondaryCta}
                    >
                      <Text style={styles.secondaryCtaText}>Not now</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </LinearGradient>
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
  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  loadingPill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "rgba(255,255,255,0.05)",
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  loadingText: {
    color: "#cbd5e1",
    fontSize: 14,
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
    gap: 12,
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
  headerLabel: {
    color: theme.colors.mutedText,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.8,
    textTransform: "uppercase",
  },
  panel: {
    borderRadius: 32,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "rgba(2, 6, 23, 0.82)",
    padding: 22,
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 16 },
    elevation: 8,
  },
  heroBlock: {
    alignItems: "center",
  },
  heroPill: {
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
  heroTitle: {
    marginTop: 20,
    color: theme.colors.text,
    fontSize: 36,
    fontWeight: "700",
    letterSpacing: -1,
    textAlign: "center",
  },
  heroSubtitle: {
    marginTop: 12,
    maxWidth: 320,
    color: "#cbd5e1",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
  limitCard: {
    width: "100%",
    marginTop: 24,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "rgba(255,255,255,0.05)",
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  limitTitle: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  limitText: {
    marginTop: 6,
    color: "#cbd5e1",
    fontSize: 14,
    lineHeight: 21,
  },
  notice: {
    marginTop: 20,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  noticeSuccess: {
    borderColor: "rgba(16, 185, 129, 0.20)",
    backgroundColor: "rgba(16, 185, 129, 0.12)",
  },
  noticeError: {
    borderColor: "rgba(244, 63, 94, 0.20)",
    backgroundColor: "rgba(244, 63, 94, 0.12)",
  },
  noticeText: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
  pricingCard: {
    marginTop: 28,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 22,
  },
  pricingHeader: {
    alignItems: "center",
  },
  pricingTitle: {
    color: theme.colors.text,
    fontSize: 30,
    fontWeight: "700",
    letterSpacing: -0.8,
    textAlign: "center",
  },
  pricingSubtitle: {
    marginTop: 8,
    color: "#cbd5e1",
    fontSize: 14,
    textAlign: "center",
  },
  benefitList: {
    marginTop: 24,
    gap: 12,
  },
  benefitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.04)",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  benefitIcon: {
    width: 22,
    height: 22,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(56, 189, 248, 0.16)",
  },
  benefitIconText: {
    color: "#e0f2fe",
    fontSize: 12,
    fontWeight: "700",
  },
  benefitText: {
    flex: 1,
    color: "#f8fafc",
    fontSize: 14,
    lineHeight: 20,
  },
  ctaGrid: {
    marginTop: 24,
    gap: 12,
  },
  primaryCta: {
    minHeight: 56,
    borderRadius: 18,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryCtaText: {
    color: "#020617",
    fontSize: 15,
    fontWeight: "800",
  },
  accentCta: {
    minHeight: 56,
    borderRadius: 18,
    backgroundColor: theme.colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  accentCtaText: {
    color: "#082f49",
    fontSize: 15,
    fontWeight: "800",
  },
  secondaryCta: {
    minHeight: 56,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "rgba(255,255,255,0.04)",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryCtaText: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
});
