import { LockedMessagingScreen } from "@/components/locked-messaging-screen";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect } from "react";

import { refreshMobileSessionFromBackend } from "@/services/auth-api";
import { useMobileSession } from "@/services/mobile-session";

export default function StoreLockedChatsScreen() {
  const router = useRouter();
  const session = useMobileSession();

  useFocusEffect(
    useCallback(() => {
      if (!session.authToken) {
        return;
      }

      void refreshMobileSessionFromBackend();
    }, [session.authToken]),
  );

  useEffect(() => {
    if (!session.isAuthenticated) {
      router.replace("/login");
      return;
    }

    if (session.isStoreOwner && session.isPro) {
      router.replace("/store/chats");
    }
  }, [router, session.isAuthenticated, session.isPro, session.isStoreOwner]);

  if (!session.isAuthenticated || (session.isStoreOwner && session.isPro)) {
    return null;
  }

  return (
    <LockedMessagingScreen
      fallbackHref="/(tabs)/profile"
      message="Upgrade to Pro to receive and respond to customer messages."
      showActions={false}
      title="Inbox locked"
    />
  );
}
