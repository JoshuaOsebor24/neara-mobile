import { StyleSheet, Text, View, type ViewStyle } from "react-native";

import { NEARA_STORE_OWNER_BADGE_LABEL } from "@/services/role-access";

export function StoreOwnerBadge({ style }: { style?: ViewStyle }) {
  return (
    <View style={[styles.badge, style]}>
      <Text style={styles.label}>{NEARA_STORE_OWNER_BADGE_LABEL}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "rgba(250, 204, 21, 0.14)",
    borderColor: "rgba(250, 204, 21, 0.24)",
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 24,
    paddingHorizontal: 10,
  },
  label: {
    color: "#fde68a",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
});
