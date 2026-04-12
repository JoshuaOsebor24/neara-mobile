import { StyleSheet, Text, View, type ViewStyle } from "react-native";

import { theme } from "@/constants/theme";

export function BrandPill({
  label,
  style,
}: {
  label: string;
  style?: ViewStyle;
}) {
  return (
    <View style={[styles.pill, style]}>
      <Text numberOfLines={1} style={styles.text}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(74,136,255,0.12)",
    borderColor: "rgba(120,163,255,0.22)",
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  text: {
    color: theme.colors.subduedText,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.8,
    textTransform: "uppercase",
  },
});
