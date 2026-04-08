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
    backgroundColor: theme.colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  logo: {
    width: 88,
    height: 88,
    marginBottom: 18,
  },
  label: {
    color: theme.colors.text,
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
});
