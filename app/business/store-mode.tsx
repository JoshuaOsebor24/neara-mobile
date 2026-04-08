import { useMobileSession } from "@/services/mobile-session";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useEffect } from "react";
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { BackPillButton } from "@/components/ui/back-pill-button";

interface StorePlan {
  id: "basic";
  title: string;
  description: string;
  price: string;
  features: string[];
  isRecommended: boolean;
  buttonLabel: string;
  includesLabel?: string;
}

const STORE_PLANS: StorePlan[] = [
  {
    id: "basic",
    title: "Basic Store",
    description: "Start selling with a simple store presence across Neara.",
    price: "₦1,000 / month",
    features: [
      "Create your store",
      "Add and manage products",
      "Appear in search results",
      "Appear on the map",
    ],
    isRecommended: false,
    buttonLabel: "Choose Basic",
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

  const handleChoosePlan = (planId: "basic") => {
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
        colors={["rgba(56,189,248,0.16)", "transparent"]}
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
              ? "Choose the plan that fits your business"
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
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() =>
                router.push(`/store-payment?storePlan=${draftPlan}`)
              }
              style={styles.resumeButton}
            >
              <Text style={styles.resumeButtonText}>Continue Store Setup</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Plans */}
        <View style={styles.plansContainer}>
          {STORE_PLANS.map((plan) => (
            <View key={plan.id} style={styles.planWrapper}>
              <LinearGradient
                colors={
                  plan.isRecommended
                    ? ["rgba(14,165,233,0.16)", "rgba(15,23,42,0.92)"]
                    : ["rgba(255,255,255,0.05)", "rgba(255,255,255,0.02)"]
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[
                  styles.planCard,
                  plan.isRecommended && styles.planCardRecommended,
                ]}
              >
                {plan.isRecommended && (
                  <View style={styles.recommendedBadge}>
                    <Text style={styles.recommendedBadgeText}>Recommended</Text>
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

                <TouchableOpacity
                  style={[
                    styles.button,
                    plan.isRecommended && styles.buttonRecommended,
                  ]}
                  onPress={() => handleChoosePlan(plan.id)}
                >
                  <Text
                    style={[
                      styles.buttonText,
                      plan.isRecommended && styles.buttonTextRecommended,
                    ]}
                  >
                    {plan.buttonLabel}
                  </Text>
                </TouchableOpacity>
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
    backgroundColor: "#020617",
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
    backgroundColor: "#020617",
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
    color: "#FFFFFF",
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
    color: "#e2e8f0",
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },
  resumeButton: {
    marginTop: 14,
    borderRadius: 999,
    backgroundColor: "#38bdf8",
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  resumeButtonText: {
    color: "#082f49",
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
    borderColor: "rgba(14, 165, 233, 0.3)",
  },
  recommendedBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(14, 165, 233, 0.14)",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(14, 165, 233, 0.2)",
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
    color: "#FFFFFF",
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
    color: "#FFFFFF",
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
    color: "#FFFFFF",
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
    color: "#FFFFFF",
  },
});
