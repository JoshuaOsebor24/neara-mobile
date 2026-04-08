import { useRouter, type Href } from "expo-router";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { theme } from "@/constants/theme";
import { navigateBackOrFallback } from "@/services/navigation";

export function BackPillButton({
  fallbackHref,
  label = "Back",
  style,
}: {
  fallbackHref: Href;
  label?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const router = useRouter();

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => navigateBackOrFallback(router, fallbackHref)}
      style={[styles.button, style]}
    >
      <Text style={styles.text}>← {label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderColor: theme.colors.borderStrong,
    borderRadius: theme.radius.button,
    borderWidth: 1,
    minHeight: theme.controls.actionButtonMinHeight,
    justifyContent: "center",
    minWidth: 92,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  text: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
});
