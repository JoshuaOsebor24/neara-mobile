import { StyleSheet, Text, View, type ViewStyle } from "react-native";

import { NEARA_PRO_BADGE_LABEL } from "@/services/role-access";

export function PremiumBadge({ style }: { style?: ViewStyle }) {
  return (
    <View style={[styles.badge, style]}>
      <Text style={styles.label}>{NEARA_PRO_BADGE_LABEL}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "rgba(52, 211, 153, 0.12)",
    borderColor: "rgba(167, 243, 208, 0.25)",
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  label: {
    color: "#d1fae5",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
});
