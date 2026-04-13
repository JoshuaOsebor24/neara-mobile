import { useMobileSession } from "@/services/mobile-session";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useEffect } from "react";
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { BackPillButton } from "@/components/ui/back-pill-button";
import { Button } from "@/components/ui/button";

interface StorePlan {
  id: "basic" | "pro";
  title: string;
  description: string;
  price: string;
  dailyEquivalent?: string;
  features: string[];
  isRecommended: boolean;
  buttonLabel: string;
  includesLabel?: string;
  disabled?: boolean;
}

const STORE_PLANS: StorePlan[] = [
  {
    id: "basic",
    title: "Basic Store",
    description:
      "Create your store and start getting discovered by nearby customers.",
    price: "₦1,000 / month",
    dailyEquivalent: "About ₦33/day",
    features: [
      "Get your store discovered by nearby customers searching for products",
      "Display your products so customers can browse and message you",
      "Appear on the map so people around you can find your store",
      "Easily add and update your products anytime",
    ],
    isRecommended: true,
    buttonLabel: "Start your store",
    includesLabel: "Affordable monthly plan for getting visible fast",
  },
  {
    id: "pro",
    title: "Pro Store",
    description: "More tools for faster growth and stronger visibility.",
    price: "Coming soon",
    features: [
      "Boost visibility across Neara",
      "Unlock more ways to attract ready-to-buy customers",
      "Get advanced tools for scaling your store presence",
    ],
    isRecommended: false,
    buttonLabel: "Coming soon",
    disabled: true,
    includesLabel: "Premium growth tools are on the way",
  },
];

export default function StoreModeScreen() {
  const router = useRouter();
  const session = useMobileSession();
  const draftPlan = "basic";
  const hasOwnerDraft =
    Boolean(session.primaryStoreName) ||
    Boolean(session.primaryStoreCategory) ||
    Boolean(session.primaryStoreAddress);

  useEffect(() => {
    if (!session.isAuthenticated) {
      router.replace("/login");
      return;
    }

    if (session.isStoreOwner && session.primaryStoreId) {
      router.replace("/(tabs)/home");
    }
  }, [
    router,
    session.isAuthenticated,
    session.isStoreOwner,
    session.primaryStoreId,
  ]);

  const handleChoosePlan = (planId: "basic" | "pro") => {
    if (planId !== "basic") {
      return;
    }

    router.push(`/store-payment?storePlan=${planId}`);
  };

  return (
    <SafeAreaView style={styles.container}>
      {!session.isAuthenticated ||
      (session.isStoreOwner && session.primaryStoreId) ? (
        <View style={styles.loadingWrap}>
          <Text style={styles.loadingText}>
            {!session.isAuthenticated ? "Opening login..." : "Opening home..."}
          </Text>
        </View>
      ) : null}
      <LinearGradient
        colors={["rgba(74,136,255,0.16)", "transparent"]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.28 }}
        style={styles.gradient}
      />
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.headerContainer}>
          <BackPillButton fallbackHref="/(tabs)/profile" />
          <Text style={styles.eyebrow}>Neara Store Mode</Text>
          <Text style={styles.title}>Start Your Store</Text>
          <Text style={styles.subtitle}>
            {session.isAuthenticated
              ? "Choose a plan that gets your store visible and brings in customers"
              : "Log in to continue into store mode"}
          </Text>
          {session.isAuthenticated && hasOwnerDraft && !session.isStoreOwner ? (
            <View style={styles.draftPill}>
              <Text style={styles.draftPillText}>
                Existing draft:{" "}
                {session.primaryStoreName ||
                  "Store details saved on this device"}
              </Text>
            </View>
          ) : null}
          {session.isAuthenticated && hasOwnerDraft && !session.isStoreOwner ? (
            <Button
              label="Continue Store Setup"
              onPress={() =>
                router.push(`/store-payment?storePlan=${draftPlan}`)
              }
              style={styles.resumeButton}
            />
          ) : null}
        </View>

        {/* Plans */}
        <View style={styles.plansContainer}>
          {STORE_PLANS.map((plan) => (
            <View key={plan.id} style={styles.planWrapper}>
              <LinearGradient
                colors={
                  plan.isRecommended
                    ? ["rgba(74,136,255,0.16)", "rgba(17,24,39,0.92)"]
                    : ["rgba(255,255,255,0.05)", "rgba(255,255,255,0.02)"]
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[
                  styles.planCard,
                  plan.isRecommended && styles.planCardRecommended,
                  plan.disabled && styles.planCardDisabled,
                ]}
              >
                {plan.isRecommended && (
                  <View style={styles.recommendedBadge}>
                    <Text style={styles.recommendedBadgeText}>
                      Best to start
                    </Text>
                  </View>
                )}

                <View style={styles.planHeader}>
                  <View>
                    <Text style={styles.planTitle}>{plan.title}</Text>
                    <Text style={styles.planDescription}>
                      {plan.description}
                    </Text>
                  </View>
                </View>

                <View style={styles.priceSection}>
                  <Text style={styles.price}>{plan.price}</Text>
                  {plan.dailyEquivalent ? (
                    <Text style={styles.dailyEquivalent}>
                      {plan.dailyEquivalent}
                    </Text>
                  ) : null}
                  {plan.includesLabel && (
                    <Text style={styles.includesLabel}>
                      {plan.includesLabel}
                    </Text>
                  )}
                </View>

                <View style={styles.featuresList}>
                  {plan.features.map((feature, index) => (
                    <View key={index} style={styles.featureItem}>
                      <Text style={styles.featureCheckmark}>✓</Text>
                      <Text style={styles.featureText}>{feature}</Text>
                    </View>
                  ))}
                </View>

                <Button
                  disabled={plan.disabled}
                  label={plan.buttonLabel}
                  onPress={() => handleChoosePlan(plan.id)}
                  style={[
                    styles.button,
                    plan.disabled && styles.buttonDisabled,
                  ]}
                  variant={plan.isRecommended ? "primary" : "secondary"}
                />
                {plan.id === "basic" ? (
                  <Text style={styles.buttonSupportingText}>
                    Instant setup after payment
                  </Text>
                ) : null}
                {plan.id === "basic" ? (
                  <View style={styles.planTrustRow}>
                    <Text style={styles.planTrustText}>Secure payment</Text>
                    <Text style={styles.planTrustDivider}>•</Text>
                    <Text style={styles.planTrustText}>Cancel anytime</Text>
                  </View>
                ) : null}
              </LinearGradient>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A0F1F",
  },
  loadingWrap: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    backgroundColor: "#0A0F1F",
    zIndex: 4,
  },
  loadingText: {
    fontSize: 14,
    color: "#CBD5E1",
    textAlign: "center",
  },
  gradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 200,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  headerContainer: {
    alignItems: "center",
    marginBottom: 32,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "600",
    color: "#B0E7FE",
    letterSpacing: (0.18 * 11) / 100,
    textTransform: "uppercase",
    marginBottom: 12,
  },
  title: {
    fontSize: 32,
    fontWeight: "600",
    color: "#F5F7FB",
    textAlign: "center",
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 14,
    color: "#CBD5E1",
    textAlign: "center",
  },
  draftPill: {
    marginTop: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.05)",
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  draftPillText: {
    color: "#E8EEF8",
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },
  resumeButton: {
    marginTop: 14,
    borderRadius: 999,
    backgroundColor: "#4A88FF",
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  resumeButtonText: {
    color: "#F5F7FB",
    fontSize: 13,
    fontWeight: "800",
  },
  noticeContainer: {
    marginBottom: 32,
  },
  notice: {
    backgroundColor: "rgba(76, 175, 80, 0.1)",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: "rgba(76, 175, 80, 0.2)",
  },
  noticeText: {
    fontSize: 13,
    color: "#DCFCE7",
    textAlign: "center",
    lineHeight: 18,
  },
  plansContainer: {
    gap: 20,
    marginBottom: 32,
  },
  planWrapper: {
    marginBottom: 4,
  },
  planCard: {
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  planCardRecommended: {
    borderColor: "rgba(74,136,255,0.3)",
  },
  planCardDisabled: {
    opacity: 0.72,
  },
  recommendedBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(74,136,255,0.14)",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(74,136,255,0.2)",
  },
  recommendedBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#CFFAFE",
    letterSpacing: (0.16 * 10) / 100,
    textTransform: "uppercase",
  },
  planHeader: {
    marginBottom: 16,
  },
  planTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#F5F7FB",
    marginBottom: 6,
  },
  planDescription: {
    fontSize: 13,
    color: "#CBD5E1",
    lineHeight: 18,
  },
  priceSection: {
    marginBottom: 20,
  },
  price: {
    fontSize: 28,
    fontWeight: "600",
    color: "#F5F7FB",
    marginBottom: 6,
  },
  dailyEquivalent: {
    fontSize: 13,
    fontWeight: "700",
    color: "#b0e7fe",
    marginBottom: 6,
  },
  includesLabel: {
    fontSize: 12,
    fontWeight: "500",
    color: "#CFFAFE",
  },
  featuresList: {
    gap: 12,
    marginBottom: 20,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  featureCheckmark: {
    fontSize: 14,
    color: "#F5F7FB",
    fontWeight: "600",
    marginTop: 2,
  },
  featureText: {
    fontSize: 13,
    color: "#E2E8F0",
    flex: 1,
    lineHeight: 18,
  },
  button: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: "center",
  },
  buttonRecommended: {
    backgroundColor: "#0EA5E9",
  },
  buttonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#E2E8F0",
  },
  buttonTextRecommended: {
    color: "#F5F7FB",
  },
  buttonDisabled: {
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  buttonTextDisabled: {
    color: "#B8C2D9",
  },
  buttonSupportingText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#B8C2D9",
    textAlign: "center",
    marginTop: 8,
  },
  planTrustRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginTop: 14,
  },
  planTrustText: {
    color: "#B8C2D9",
    fontSize: 12,
    fontWeight: "600",
  },
  planTrustDivider: {
    color: "#667892",
    fontSize: 12,
  },
});
