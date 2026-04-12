import { StyleSheet, View, type ViewProps } from "react-native";

import { theme } from "@/constants/theme";

export function ScreenCard({ style, ...rest }: ViewProps) {
  return <View {...rest} style={[styles.card, style]} />;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surfaceCard,
    borderColor: theme.colors.borderStrong,
    borderRadius: theme.radius.card,
    borderWidth: 1,
    overflow: "hidden",
    padding: theme.controls.cardPadding,
    ...theme.shadows.card,
  },
});
