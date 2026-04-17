import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { theme } from "@/constants/theme";

export function LoadingCard({
  message,
  detail,
}: {
  message: string;
  detail?: string;
}) {
  return (
    <View style={styles.statusCard}>
      <ActivityIndicator color={theme.colors.accent} />
      <Text style={styles.statusTitle}>{message}</Text>
      {detail ? <Text style={styles.statusBody}>{detail}</Text> : null}
    </View>
  );
}

export function EmptyCard({
  title,
  detail,
}: {
  title: string;
  detail: string;
}) {
  return (
    <View style={styles.statusCard}>
      <Text style={styles.statusTitle}>{title}</Text>
      <Text style={styles.statusBody}>{detail}</Text>
    </View>
  );
}

export function ErrorCard({
  title,
  detail,
}: {
  title: string;
  detail: string;
}) {
  return (
    <View style={[styles.statusCard, styles.errorCard]}>
      <Text style={styles.statusTitle}>{title}</Text>
      <Text style={styles.statusBody}>{detail}</Text>
    </View>
  );
}

export function SkeletonCard({ height = 92 }: { height?: number }) {
  return <View style={[styles.skeletonCard, { height }]} />;
}

const styles = StyleSheet.create({
  statusCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.colors.borderSoft,
    backgroundColor: theme.colors.surfaceCard,
    paddingHorizontal: 16,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  errorCard: {
    borderColor: "rgba(255,194,214,0.18)",
    backgroundColor: "rgba(133, 54, 98, 0.18)",
  },
  statusTitle: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: "800",
    textAlign: "center",
  },
  statusBody: {
    color: theme.colors.mutedText,
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
  skeletonCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.colors.borderSoft,
    backgroundColor: theme.colors.surfaceElevated,
  },
});
