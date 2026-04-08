import { Redirect } from "expo-router";
import { Text, View } from "react-native";

import { theme } from "@/constants/theme";
import { useMobileSession, useMobileSessionHydrated } from "@/services/mobile-session";

export default function IndexScreen() {
  const session = useMobileSession();
  const isSessionHydrated = useMobileSessionHydrated();

  if (!isSessionHydrated) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: theme.colors.background,
        }}
      >
        <Text
          style={{
            color: theme.colors.text,
            fontSize: 15,
            fontWeight: "600",
          }}
        >
          Checking your session...
        </Text>
      </View>
    );
  }

  if (!session.isAuthenticated || !session.authToken) {
    return <Redirect href="/login" />;
  }

  return <Redirect href="/(tabs)/home" />;
}
