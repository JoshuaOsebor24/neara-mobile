import { StyleSheet, Text, View, type ViewStyle } from "react-native";

import { theme } from "@/constants/theme";
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
    backgroundColor: "rgba(74, 136, 255, 0.14)",
    borderColor: theme.colors.borderStrong,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  label: {
    color: theme.colors.subduedText,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
});
