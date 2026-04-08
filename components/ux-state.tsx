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

export function SkeletonCard({
  height = 92,
}: {
  height?: number;
}) {
  return <View style={[styles.skeletonCard, { height }]} />;
}

const styles = StyleSheet.create({
  statusCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 18,
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  errorCard: {
    borderColor: "rgba(248,113,113,0.22)",
    backgroundColor: "rgba(127,29,29,0.18)",
  },
  statusTitle: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },
  statusBody: {
    color: theme.colors.mutedText,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  skeletonCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
});
