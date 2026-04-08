import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { buildSessionPatchFromStore, refreshMobileSessionFromBackend } from "@/services/auth-api";
import { navigateBackOrFallback } from "@/services/navigation";
import { updateMobileSession, useMobileSession } from "@/services/mobile-session";
import { updateStoreWithBackend } from "@/services/store-api";

type Notice = {
  text: string;
  type: "error" | "success";
} | null;

interface FeatureCardProps {
  title: string;
  description: string;
  price?: string;
  badge?: string;
  features: string[];
  actionLabel: string;
  onAction: () => void;
  isDisabled?: boolean;
}

const FeatureCard: React.FC<FeatureCardProps> = ({
  title,
  description,
  price,
  badge,
  features,
  actionLabel,
  onAction,
  isDisabled = false,
}) => (
  <View style={styles.featureCard}>
    <View style={styles.cardHeader}>
      <View style={{ flex: 1 }}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardDescription}>{description}</Text>
      </View>
      {badge && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      )}
    </View>

    {price && <Text style={styles.price}>{price}</Text>}

    <View style={styles.featuresList}>
      {features.map((feature, index) => (
        <View key={index} style={styles.featureItem}>
          <View style={styles.checkmark}>
            <Text style={styles.checkmarkText}>✓</Text>
          </View>
          <Text style={styles.featureText}>{feature}</Text>
        </View>
      ))}
    </View>

    <TouchableOpacity
      style={[
        styles.actionButton,
        badge ? styles.actionButtonPrimary : styles.actionButtonSecondary,
        isDisabled && styles.actionButtonDisabled,
      ]}
      onPress={onAction}
      disabled={isDisabled}
    >
      <Text
        style={[
          styles.actionButtonText,
          badge && styles.actionButtonTextPrimary,
        ]}
      >
        {actionLabel}
      </Text>
    </TouchableOpacity>
  </View>
);

export default function PromoteStorePage() {
  const router = useRouter();
  const session = useMobileSession();
  const [notice, setNotice] = useState<Notice>(null);
  const [isSubmittingVerification, setIsSubmittingVerification] =
    useState(false);

  useEffect(() => {
    if (!session.isAuthenticated) {
      router.replace("/login");
      return;
    }

    if (!session.isStoreOwner) {
      router.replace("/store-mode");
    }
  }, [router, session.isAuthenticated, session.isStoreOwner]);

  const selectedOwnerStore = useMemo(
    () =>
      session.isStoreOwner && session.primaryStoreId
        ? {
            id: Number(session.primaryStoreId),
            verified: session.storeVerified,
            name: session.primaryStoreName || "Your store",
            planLabel:
              session.storePlan === "verified" ? "Verified Store" : "Basic Store",
          }
        : null,
    [
      session.isStoreOwner,
      session.primaryStoreId,
      session.primaryStoreName,
      session.storePlan,
      session.storeVerified,
    ],
  );

  const handleGetVerified = async () => {
    if (
      !selectedOwnerStore ||
      isSubmittingVerification ||
      !session.authToken ||
      !session.primaryStoreId
    ) {
      return;
    }

    if (selectedOwnerStore.verified) {
      setNotice({
        text: "You are already verified ✔",
        type: "success",
      });
      return;
    }

    setIsSubmittingVerification(true);
    setNotice(null);

    const result = await updateStoreWithBackend(
      session.authToken,
      session.primaryStoreId,
      {
        verified: true,
      },
    );

    if (!result.ok || !result.store) {
      setIsSubmittingVerification(false);
      setNotice({
        text: result.error || "Could not update verification.",
        type: "error",
      });
      return;
    }

    updateMobileSession({
      ...buildSessionPatchFromStore(result.store),
      storePlan: "verified",
      storeVerified: Boolean(result.store.verified),
    });
    await refreshMobileSessionFromBackend();
    setIsSubmittingVerification(false);
    setNotice({
      text: result.message || "Your store is now verified ✔",
      type: "success",
    });
  };

  const handleLearnMore = async () => {
    router.push("/help");
  };

  if (!session.isAuthenticated || !session.isStoreOwner) {
    return (
      <SafeAreaView edges={["top"]} style={styles.safeArea}>
        <LinearGradient
          colors={["rgba(34, 197, 94, 0.16)", "transparent", "rgba(2, 6, 23, 1)"]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.container}
        >
          <View style={styles.loadingWrap}>
            <Text style={styles.loadingText}>
              {!session.isAuthenticated
                ? "Opening login..."
                : "Opening store mode..."}
            </Text>
          </View>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["top"]} style={styles.safeArea}>
      <LinearGradient
        colors={["rgba(34, 197, 94, 0.16)", "transparent", "rgba(2, 6, 23, 1)"]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.container}
      >
        <View style={styles.background} />
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigateBackOrFallback(router, "/(tabs)/profile")}
            >
              <Text style={styles.backButtonText}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.nearaBrand}>NEARA</Text>
          </View>

          {/* Main Content */}
          <View style={styles.mainContent}>
            {/* Title Section */}
            <View style={styles.titleSection}>
              <Text style={styles.eyebrow}>Store Growth</Text>
              <Text style={styles.title}>Get More Customers</Text>
              <Text style={styles.subtitle}>
                Grow your store and reach more people
              </Text>
              {selectedOwnerStore ? (
                <View style={styles.storePill}>
                  <Text style={styles.storePillText}>
                    {selectedOwnerStore.name} • {selectedOwnerStore.planLabel}
                  </Text>
                </View>
              ) : null}
            </View>

            {/* Notice */}
            {notice && (
              <View
                style={[
                  styles.notice,
                  notice.type === "success"
                    ? styles.noticeSuccess
                    : styles.noticeError,
                ]}
              >
                <Text
                  style={[
                    styles.noticeText,
                    notice.type === "success"
                      ? styles.noticeSuccessText
                      : styles.noticeErrorText,
                  ]}
                >
                  {notice.text}
                </Text>
              </View>
            )}

            {/* Feature Cards */}
            <View style={styles.cardsContainer}>
              <FeatureCard
                title="Get Verified"
                description="Build trust with customers and stand out from other stores."
                price="₦2,000 / month"
                badge="Recommended"
                features={[
                  "Everything in Basic",
                  "Verified badge",
                  "Increased customer trust",
                  "Higher chance of being chosen",
                ]}
                actionLabel={
                  selectedOwnerStore?.verified
                    ? "You are already verified ✔"
                    : isSubmittingVerification
                      ? "Activating verification..."
                      : "Get Verified"
                }
                onAction={handleGetVerified}
                isDisabled={
                  isSubmittingVerification || Boolean(selectedOwnerStore?.verified)
                }
              />

              <FeatureCard
                title="Advertise on App"
                description="Show your offers to customers who are already interested in your store."
                features={[
                  "Reach users who saved your store",
                  "Reach users who interacted with your store",
                ]}
                actionLabel="Open Help"
                onAction={handleLearnMore}
              />
            </View>
          </View>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#020617",
  },
  container: {
    flex: 1,
    backgroundColor: "#020617",
  },
  background: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#020617",
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  loadingText: {
    color: "#cbd5e1",
    fontSize: 14,
    textAlign: "center",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 28,
  },
  backButton: {
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  backButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },
  nearaBrand: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.18 * 12,
    color: "#94a3b8",
    textTransform: "uppercase",
  },
  mainContent: {
    marginHorizontal: "auto",
    width: "100%",
    maxWidth: 420,
  },
  titleSection: {
    alignItems: "center",
    marginBottom: 24,
    backgroundColor: "rgba(3, 7, 18, 0.78)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 32,
    padding: 24,
  },
  storePill: {
    marginTop: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.05)",
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  storePillText: {
    color: "#e2e8f0",
    fontSize: 12,
    fontWeight: "600",
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.18 * 11,
    color: "#86efac",
    textTransform: "uppercase",
  },
  title: {
    fontSize: 32,
    fontWeight: "600",
    color: "#ffffff",
    marginTop: 16,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: "#cbd5e1",
    marginTop: 12,
    textAlign: "center",
    lineHeight: 21,
  },
  notice: {
    marginTop: 16,
    marginBottom: 16,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  noticeSuccess: {
    backgroundColor: "rgba(34, 197, 94, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(134, 239, 172, 0.3)",
  },
  noticeError: {
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(248, 113, 113, 0.3)",
  },
  noticeText: {
    fontSize: 14,
    fontWeight: "500",
  },
  noticeSuccessText: {
    color: "#86efac",
  },
  noticeErrorText: {
    color: "#fca5a5",
  },
  cardsContainer: {
    gap: 20,
  },
  featureCard: {
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 30,
    padding: 20,
    backdropFilter: "blur(50px)",
  },
  cardHeader: {
    gap: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#ffffff",
  },
  cardDescription: {
    fontSize: 13,
    color: "#cbd5e1",
    marginTop: 4,
    lineHeight: 18,
  },
  badge: {
    borderWidth: 1,
    borderColor: "rgba(147, 197, 253, 0.2)",
    backgroundColor: "rgba(147, 197, 253, 0.12)",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.16 * 10,
    color: "#bae6fd",
    textTransform: "uppercase",
  },
  price: {
    fontSize: 28,
    fontWeight: "600",
    color: "#ffffff",
    marginTop: 20,
  },
  featuresList: {
    marginTop: 20,
    gap: 12,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  checkmark: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(148, 163, 184, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 2,
  },
  checkmarkText: {
    fontSize: 12,
    color: "#cbd5e1",
    fontWeight: "600",
  },
  featureText: {
    fontSize: 13,
    color: "#e2e8f0",
    flex: 1,
    lineHeight: 18,
  },
  actionButton: {
    marginTop: 24,
    borderRadius: 20,
    paddingVertical: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  actionButtonPrimary: {
    backgroundColor: "#0ea5e9",
  },
  actionButtonSecondary: {
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#ffffff",
  },
  actionButtonTextPrimary: {
    color: "#020617",
  },
});
