import { Image, StyleSheet, Text, View } from "react-native";

import { theme } from "@/constants/theme";

export function LaunchLoadingScreen() {
  return (
    <View style={styles.container}>
      <Image
        source={require("../assets/images/splash-icon.png")}
        style={styles.logo}
        resizeMode="contain"
      />
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
  logo: {
    width: 124,
    height: 124,
    marginBottom: 4,
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
