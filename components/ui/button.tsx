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
      activeOpacity={0.9}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.button,
        variant === "secondary" && styles.secondary,
        variant === "ghost" && styles.ghost,
        variant === "danger" && styles.danger,
        style,
      ]}
    >
      {variant === "primary" ? (
        <View style={[styles.primaryShell, disabled && styles.primaryShellDisabled]}>
          <LinearGradient
            colors={
              disabled
                ? theme.gradients.primaryButtonDisabled
                : theme.gradients.primaryButton
            }
            end={{ x: 1, y: 1 }}
            start={{ x: 0, y: 0 }}
            style={styles.primaryFill}
          >
            <View style={styles.primaryHighlight} />
            <Text
              style={[
                styles.label,
                styles.primaryLabel,
                disabled && styles.primaryLabelDisabled,
              ]}
            >
              {label}
            </Text>
          </LinearGradient>
        </View>
      ) : (
        <View style={styles.innerFill}>
          {variant === "secondary" ? <View style={styles.secondaryHighlight} /> : null}
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
    borderRadius: theme.button.radius,
    overflow: "visible",
    width: "100%",
    shadowColor: theme.button.primaryShadow,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.28,
    shadowRadius: 24,
    elevation: 8,
  },
  primaryShell: {
    width: "100%",
    minHeight: theme.controls.actionButtonMinHeight,
    borderRadius: theme.button.radius,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: theme.button.primaryBorder,
    backgroundColor: theme.button.primaryBackground,
  },
  primaryShellDisabled: {
    borderColor: "rgba(180,197,229,0.18)",
    shadowOpacity: 0,
    elevation: 0,
  },
  primaryFill: {
    width: "100%",
    minHeight: theme.controls.actionButtonMinHeight,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 22,
    paddingVertical: 17,
  },
  innerFill: {
    width: "100%",
    minHeight: theme.controls.actionButtonMinHeight,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 22,
    paddingVertical: 17,
    borderRadius: theme.button.radius,
    overflow: "hidden",
  },
  secondary: {
    backgroundColor: theme.button.secondaryBackground,
    borderColor: theme.button.secondaryBorder,
    borderWidth: 1,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 3,
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
  label: {
    color: theme.colors.primaryTextOnAccent,
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  primaryLabel: {
    textShadowColor: "rgba(7,11,24,0.18)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  primaryLabelDisabled: {
    color: "rgba(240,245,255,0.78)",
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
    color: "rgba(190,203,228,0.82)",
  },
  primaryHighlight: {
    position: "absolute",
    top: 1,
    left: 1,
    right: 1,
    height: "54%",
    borderTopLeftRadius: theme.button.radius,
    borderTopRightRadius: theme.button.radius,
    backgroundColor: theme.button.primaryHighlight,
  },
  secondaryHighlight: {
    position: "absolute",
    top: 1,
    left: 1,
    right: 1,
    height: "52%",
    borderTopLeftRadius: theme.button.radius,
    borderTopRightRadius: theme.button.radius,
    backgroundColor: theme.button.secondaryHighlight,
  },
});
