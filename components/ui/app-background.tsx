import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, View } from "react-native";

import { theme } from "@/constants/theme";

export function AppBackground() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient colors={theme.gradients.screen} style={StyleSheet.absoluteFill} />
      <View style={styles.topGlow} />
      <View style={styles.sideGlow} />
      <View style={styles.bottomGlow} />
    </View>
  );
}

const styles = StyleSheet.create({
  topGlow: {
    position: "absolute",
    top: -120,
    left: -40,
    width: 340,
    height: 340,
    borderRadius: 999,
    backgroundColor: theme.colors.glow,
    opacity: 0.9,
  },
  sideGlow: {
    position: "absolute",
    top: "28%",
    right: -120,
    width: 300,
    height: 300,
    borderRadius: 999,
    backgroundColor: theme.colors.glowSoft,
    opacity: 0.95,
  },
  bottomGlow: {
    position: "absolute",
    bottom: -160,
    left: "12%",
    width: 360,
    height: 360,
    borderRadius: 999,
    backgroundColor: "rgba(122, 163, 255, 0.10)",
  },
});
