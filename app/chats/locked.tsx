import { LockedMessagingScreen } from "@/components/locked-messaging-screen";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect } from "react";

import { refreshMobileSessionFromBackend } from "@/services/auth-api";
import { useMobileSession } from "@/services/mobile-session";
import { NEARA_PRO_LIMIT_MESSAGE, NEARA_PRO_PRICE_LABEL } from "@/services/role-access";

export default function LockedChatsScreen() {
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

    if (session.isPro) {
      router.replace("/(tabs)/chats");
      return;
    }

    if (session.messagesSentCount < 2) {
      router.replace("/(tabs)/chats");
    }
  }, [router, session.isAuthenticated, session.isPro, session.messagesSentCount]);

  if (!session.isAuthenticated || session.isPro || session.messagesSentCount < 2) {
    return null;
  }

  return (
    <LockedMessagingScreen
      fallbackHref="/(tabs)/profile"
      message={`${NEARA_PRO_LIMIT_MESSAGE}. Unlock Chat with Stores for ${NEARA_PRO_PRICE_LABEL}.`}
      showActions
      title="Chats locked"
    />
  );
}
