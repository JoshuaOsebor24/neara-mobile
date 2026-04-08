import {
  StyleSheet,
  Text,
  TouchableOpacity,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { theme } from "@/constants/theme";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export function Button({
  label,
  onPress,
  disabled,
  variant = "primary",
  style,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: ButtonVariant;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.button,
        variant === "secondary" && styles.secondary,
        variant === "ghost" && styles.ghost,
        variant === "danger" && styles.danger,
        disabled && styles.disabled,
        style,
      ]}
    >
      <Text
        style={[
          styles.label,
          variant === "secondary" && styles.secondaryLabel,
          variant === "ghost" && styles.ghostLabel,
          variant === "danger" && styles.dangerLabel,
          disabled && styles.disabledLabel,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: theme.controls.actionButtonMinHeight,
    borderRadius: theme.radius.button,
    paddingHorizontal: 18,
    backgroundColor: theme.colors.accent,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 4,
  },
  secondary: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    shadowOpacity: 0,
    elevation: 0,
  },
  ghost: {
    backgroundColor: "transparent",
    borderColor: "transparent",
    shadowOpacity: 0,
    elevation: 0,
  },
  danger: {
    backgroundColor: theme.colors.danger,
  },
  disabled: {
    opacity: 0.6,
  },
  label: {
    color: theme.colors.background,
    fontSize: 15,
    fontWeight: "700",
  },
  secondaryLabel: {
    color: theme.colors.text,
  },
  ghostLabel: {
    color: theme.colors.text,
  },
  dangerLabel: {
    color: theme.colors.background,
  },
  disabledLabel: {
    color: theme.colors.mutedText,
  },
});
