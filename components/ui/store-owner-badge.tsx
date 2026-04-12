import { StyleSheet, Text, View, type ViewStyle } from "react-native";

import { theme } from "@/constants/theme";
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
    backgroundColor: "rgba(255,255,255,0.05)",
    borderColor: theme.colors.border,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 24,
    paddingHorizontal: 10,
  },
  label: {
    color: theme.colors.subduedText,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
});
