import { LinearGradient } from "expo-linear-gradient";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
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
      {variant === "primary" ? (
        <LinearGradient colors={theme.gradients.primaryButton} style={styles.primaryFill}>
          <Text
            style={[
              styles.label,
              disabled && styles.disabledLabel,
            ]}
          >
            {label}
          </Text>
        </LinearGradient>
      ) : (
        <View style={styles.innerFill}>
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
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: theme.controls.actionButtonMinHeight,
    borderRadius: theme.radius.button,
    overflow: "hidden",
    shadowColor: theme.colors.accentStrong,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22,
    shadowRadius: 22,
    elevation: 6,
  },
  primaryFill: {
    minHeight: theme.controls.actionButtonMinHeight,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  innerFill: {
    minHeight: theme.controls.actionButtonMinHeight,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  secondary: {
    backgroundColor: theme.button.secondaryBackground,
    borderColor: theme.button.secondaryBorder,
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
    color: theme.colors.primaryTextOnAccent,
    fontSize: 15,
    fontWeight: "800",
  },
  secondaryLabel: {
    color: theme.colors.text,
  },
  ghostLabel: {
    color: theme.colors.text,
  },
  dangerLabel: {
    color: theme.colors.text,
  },
  disabledLabel: {
    color: theme.colors.mutedText,
  },
});
