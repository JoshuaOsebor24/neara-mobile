import { Image, StyleSheet, Text, View } from "react-native";

import { theme } from "@/constants/theme";

const LOGO_SOURCE = require("../assets/images/icon-transparent.png");

export function LaunchLoadingScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.logoWrap}>
        <Image
          blurRadius={1}
          resizeMode="contain"
          source={LOGO_SOURCE}
          style={styles.logoBorderOuter}
        />
        <Image
          resizeMode="contain"
          source={LOGO_SOURCE}
          style={styles.logoBorderInner}
        />
        <Image
          resizeMode="contain"
          source={LOGO_SOURCE}
          style={styles.logo}
        />
      </View>
      <Text style={styles.label}>Neara</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  logoWrap: {
    width: 140,
    height: 140,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  logo: {
    width: 124,
    height: 124,
    zIndex: 3,
  },
  logoBorderOuter: {
    position: "absolute",
    width: 130,
    height: 130,
    opacity: 0.74,
    tintColor: "#FFFFFF",
    zIndex: 1,
  },
  logoBorderInner: {
    position: "absolute",
    width: 128,
    height: 128,
    opacity: 0.92,
    tintColor: "#FCFCFD",
    zIndex: 2,
  },
  label: {
    color: theme.colors.text,
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: 0.2,
    lineHeight: 30,
    textShadowColor: "rgba(141, 221, 255, 0.26)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },
});
