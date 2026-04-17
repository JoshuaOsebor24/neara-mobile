import { DarkTheme, ThemeProvider } from "@react-navigation/native";
import { Asset } from "expo-asset";
import { Stack, usePathname, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useState } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { FlashFeedback } from "@/components/flash-feedback";
import { LaunchLoadingScreen } from "@/components/launch-loading-screen";
import { AppBackground } from "@/components/ui/app-background";
import { theme } from "@/constants/theme";
import { refreshMobileSessionFromBackend } from "@/services/auth-api";
import {
  buildPostLoginHref,
  isAdminProtectedRoute,
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
  clearPendingNotificationResponse,
  initializeNotificationLifecycle,
  resetPushTokenRegistrationState,
  resolveNotificationTargetPath,
  syncPushTokenForAuthenticatedSession,
} from "@/services/notifications";
import {
  loadRecentStoresForSession,
  loadSavedStoresForSession,
} from "@/services/saved-stores";
import { loadPublicStoreCatalog } from "@/services/store-data";

const SPLASH_LOGO_ASSET = require("@/assets/images/icon-transparent.png");
const MIN_LAUNCH_SCREEN_DURATION_MS = 3000;

void SplashScreen.preventAutoHideAsync().catch(() => {
  // Ignore repeated calls during fast refresh.
});

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
  const [hasHiddenNativeSplash, setHasHiddenNativeSplash] = useState(false);
  const [hasMetMinimumLaunchDuration, setHasMetMinimumLaunchDuration] =
    useState(false);
  const [hasCompletedLaunchTransition, setHasCompletedLaunchTransition] =
    useState(false);
  const isPendingStoreRegistrationRoute =
    session.isAuthenticated &&
    !session.isStoreOwner &&
    Boolean(session.storePlan) &&
    (pathname === "/signup" || pathname === "/auth/signup");
  const isLaunchReady =
    isSessionHydrated && isAuthBootstrapComplete && hasMetMinimumLaunchDuration;

  const handleLaunchScreenReady = useCallback(() => {
    if (hasHiddenNativeSplash) {
      return;
    }

    setHasHiddenNativeSplash(true);
    void SplashScreen.hideAsync().catch(() => {
      // Ignore hide races during development reloads.
    });
  }, [hasHiddenNativeSplash]);

  const handleLaunchScreenExit = useCallback(() => {
    setHasCompletedLaunchTransition(true);
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setHasMetMinimumLaunchDuration(true);
    }, MIN_LAUNCH_SCREEN_DURATION_MS);

    return () => {
      clearTimeout(timeout);
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      await Promise.all([
        Asset.fromModule(SPLASH_LOGO_ASSET).downloadAsync(),
        hydrateMobileSession(),
      ]);
      const refreshPromise = refreshMobileSessionFromBackend();
      void loadPublicStoreCatalog();
      await refreshPromise;

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
    let isMounted = true;
    let teardown: (() => void) | undefined;

    const bootstrapNotifications = async () => {
      teardown = await initializeNotificationLifecycle({
        onNotificationReceived() {},
        onNotificationResponse(response) {
          const targetPath = resolveNotificationTargetPath(response);

          if (!targetPath || !isMounted) {
            return;
          }

          clearPendingNotificationResponse();
          router.push(targetPath as never);
        },
      });
    };

    void bootstrapNotifications();

    return () => {
      isMounted = false;
      teardown?.();
    };
  }, [router]);

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
      isAdminProtectedRoute(currentSegments) &&
      !session.isAdmin
    ) {
      router.replace("/(tabs)/home");
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
          fallbackHref: "/(tabs)/home",
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
    session.isAdmin,
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
    void loadPublicStoreCatalog();
  }, [
    isAuthBootstrapComplete,
    isSessionHydrated,
    session.authToken,
    session.email,
    session.id,
    session.isAuthenticated,
  ]);

  useEffect(() => {
    if (!isSessionHydrated || !isAuthBootstrapComplete) {
      return;
    }

    if (!session.isAuthenticated || !session.authToken || !session.id) {
      resetPushTokenRegistrationState();
      return;
    }

    void syncPushTokenForAuthenticatedSession({
      authToken: session.authToken,
      userId: session.id,
    });
  }, [
    isAuthBootstrapComplete,
    isSessionHydrated,
    session.authToken,
    session.id,
    session.isAuthenticated,
  ]);

  if (!isLaunchReady || !hasCompletedLaunchTransition) {
    return (
      <SafeAreaProvider>
        <ThemeProvider value={appTheme}>
          <StatusBar style="light" />
          <AppBackground />
          <LaunchLoadingScreen
            isExiting={isLaunchReady}
            onExitComplete={handleLaunchScreenExit}
            onReady={handleLaunchScreenReady}
          />
        </ThemeProvider>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider value={appTheme}>
        <StatusBar style="light" />
        <AppBackground />
        <FlashFeedback />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: {
              backgroundColor: "transparent",
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
