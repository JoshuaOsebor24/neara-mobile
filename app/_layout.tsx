import { DarkTheme, ThemeProvider } from "@react-navigation/native";
import { Stack, usePathname, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { FlashFeedback } from "@/components/flash-feedback";
import { LaunchLoadingScreen } from "@/components/launch-loading-screen";
import { theme } from "@/constants/theme";
import { refreshMobileSessionFromBackend } from "@/services/auth-api";
import {
  buildPostLoginHref,
  isAuthRoute,
  isOwnerProtectedRoute,
  isProProtectedRoute,
  isPublicRoute,
} from "@/services/auth-routing";
import {
  hydrateMobileSession,
  useMobileSession,
  useMobileSessionHydrated,
} from "@/services/mobile-session";
import {
  loadRecentStoresForSession,
  loadSavedStoresForSession,
} from "@/services/saved-stores";

const appTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: theme.colors.background,
    card: theme.colors.surface,
    border: theme.colors.border,
    primary: theme.colors.accent,
    text: theme.colors.text,
    notification: theme.colors.accent,
  },
};

export default function RootLayout() {
  const pathname = usePathname();
  const router = useRouter();
  const segments = useSegments();
  const session = useMobileSession();
  const isSessionHydrated = useMobileSessionHydrated();
  const [isAuthBootstrapComplete, setIsAuthBootstrapComplete] = useState(false);
  const isPendingStoreRegistrationRoute =
    session.isAuthenticated &&
    !session.isStoreOwner &&
    Boolean(session.storePlan) &&
    (pathname === "/signup" || pathname === "/auth/signup");

  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      await hydrateMobileSession();
      await refreshMobileSessionFromBackend();

      if (mounted) {
        setIsAuthBootstrapComplete(true);
      }
    };

    void bootstrap();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isSessionHydrated || !isAuthBootstrapComplete) {
      return;
    }

    const authenticated = session.isAuthenticated && Boolean(session.authToken);
    const currentSegments = [...segments];

    if (!authenticated && !isPublicRoute(currentSegments)) {
      const redirectTarget = "/login";

      router.replace({
        params:
          pathname && pathname !== "/" ? { returnTo: pathname } : undefined,
        pathname: redirectTarget,
      });
      return;
    }

    if (
      authenticated &&
      isOwnerProtectedRoute(currentSegments) &&
      !session.isStoreOwner
    ) {
      router.replace("/store-mode");
      return;
    }

    if (
      authenticated &&
      isProProtectedRoute(currentSegments) &&
      !session.isPro
    ) {
      router.replace("/chats/locked");
      return;
    }

    if (
      authenticated &&
      isAuthRoute(currentSegments) &&
      !isPendingStoreRegistrationRoute
    ) {
      router.replace(
        buildPostLoginHref({
          fallbackHref: "/",
          isStoreOwner: session.isStoreOwner,
          primaryStoreId: session.primaryStoreId,
          returnTo: pathname,
        }),
      );
    }
  }, [
    isAuthBootstrapComplete,
    isSessionHydrated,
    pathname,
    router,
    segments,
    session.authToken,
    session.isAuthenticated,
    session.isPro,
    session.isStoreOwner,
    session.storePlan,
    session.primaryStoreId,
    isPendingStoreRegistrationRoute,
  ]);

  useEffect(() => {
    if (!isSessionHydrated || !isAuthBootstrapComplete) {
      return;
    }

    void loadSavedStoresForSession();
    void loadRecentStoresForSession();
  }, [
    isAuthBootstrapComplete,
    isSessionHydrated,
    session.authToken,
    session.email,
    session.id,
    session.isAuthenticated,
  ]);

  if (!isSessionHydrated || !isAuthBootstrapComplete) {
    return (
      <SafeAreaProvider>
        <ThemeProvider value={appTheme}>
          <StatusBar style="light" />
          <LaunchLoadingScreen />
        </ThemeProvider>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider value={appTheme}>
        <StatusBar style="light" />
        <FlashFeedback />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: {
              backgroundColor: appTheme.colors.background,
            },
            animation: "none",
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="(tabs)" />
        </Stack>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
