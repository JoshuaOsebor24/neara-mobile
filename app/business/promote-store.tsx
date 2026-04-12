import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BackPillButton } from "@/components/ui/back-pill-button";
import {
  useMobileSession,
} from "@/services/mobile-session";

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
            name: session.primaryStoreName || "Your store",
          }
        : null,
    [
      session.isStoreOwner,
      session.primaryStoreId,
      session.primaryStoreName,
    ],
  );

  const handleLearnMore = async () => {
    router.push("/help");
  };

  if (!session.isAuthenticated || !session.isStoreOwner) {
    return (
      <SafeAreaView edges={["top"]} style={styles.safeArea}>
        <LinearGradient
          colors={[
            "rgba(74,136,255,0.16)",
            "transparent",
            "rgba(10,15,31,1)",
          ]}
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
        colors={["rgba(74,136,255,0.16)", "transparent", "rgba(10,15,31,1)"]}
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
            <BackPillButton fallbackHref="/(tabs)/profile" />
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
                    {selectedOwnerStore.name}
                  </Text>
                </View>
              ) : null}
            </View>

            {/* Feature Cards */}
            <View style={styles.cardsContainer}>
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
    backgroundColor: "#0A0F1F",
  },
  container: {
    flex: 1,
    backgroundColor: "#0A0F1F",
  },
  background: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#0A0F1F",
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  loadingText: {
    color: "#C7D2E5",
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
    color: "#F5F7FB",
    fontSize: 14,
    fontWeight: "600",
  },
  nearaBrand: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.18 * 12,
    color: "#B8C2D9",
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
    color: "#E8EEF8",
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
    color: "#F5F7FB",
    marginTop: 16,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: "#C7D2E5",
    marginTop: 12,
    textAlign: "center",
    lineHeight: 21,
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
    color: "#F5F7FB",
  },
  cardDescription: {
    fontSize: 13,
    color: "#C7D2E5",
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
    color: "#D4E1FF",
    textTransform: "uppercase",
  },
  price: {
    fontSize: 28,
    fontWeight: "600",
    color: "#F5F7FB",
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
    color: "#C7D2E5",
    fontWeight: "600",
  },
  featureText: {
    fontSize: 13,
    color: "#E8EEF8",
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
    backgroundColor: "#2F6BFF",
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
    color: "#F5F7FB",
  },
  actionButtonTextPrimary: {
    color: "#0A0F1F",
  },
});
