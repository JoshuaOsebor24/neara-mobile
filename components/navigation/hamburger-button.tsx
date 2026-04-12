import Ionicons from "@expo/vector-icons/Ionicons";
import { StyleSheet, TouchableOpacity } from "react-native";

import { useDrawer } from "@/components/navigation/drawer-provider";
import { theme } from "@/constants/theme";

export function HamburgerButton() {
  const { openDrawer } = useDrawer();

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={openDrawer}
      style={styles.button}
    >
      <Ionicons color={theme.colors.text} name="menu" size={24} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(17,24,39,0.92)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0A0F1F",
    shadowOffset: {
      width: 0,
      height: 12,
    },
    shadowOpacity: 0.24,
    shadowRadius: 22,
    elevation: 10,
  },
});
