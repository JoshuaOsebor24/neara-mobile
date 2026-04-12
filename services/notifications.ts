import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import type {
  Notification,
  NotificationResponse,
  Subscription,
} from "expo-notifications";
import { Platform } from "react-native";

import { registerPushTokenWithBackend, type PushPlatform } from "@/services/notifications-api";

const INSTALLATION_ID_STORAGE_KEY = "neara-notifications-installation-id:v1";

let lifecycleInitialized = false;
let lastHandledNotificationResponseId: string | null = null;
let lastSuccessfulRegistrationKey: string | null = null;
let notificationReceivedSubscription: Subscription | null = null;
let notificationResponseSubscription: Subscription | null = null;
let pendingNotificationResponse: NotificationResponse | null = null;

const notificationReceivedListeners = new Set<(notification: Notification) => void>();
const notificationResponseListeners = new Set<(response: NotificationResponse) => void>();

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function getExpoProjectId() {
  const constants = Constants as typeof Constants & {
    easConfig?: {
      projectId?: string | null;
    } | null;
    expoConfig?: {
      extra?: {
        eas?: {
          projectId?: string | null;
        } | null;
      } | null;
    } | null;
  };

  return (
    constants.easConfig?.projectId ||
    constants.expoConfig?.extra?.eas?.projectId ||
    null
  );
}

function createInstallationId() {
  return `push-installation-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

async function getInstallationId() {
  const storedValue = await AsyncStorage.getItem(INSTALLATION_ID_STORAGE_KEY);

  if (storedValue?.trim()) {
    return storedValue.trim();
  }

  const nextValue = createInstallationId();
  await AsyncStorage.setItem(INSTALLATION_ID_STORAGE_KEY, nextValue);
  return nextValue;
}

async function ensureAndroidNotificationChannel() {
  if (Platform.OS !== "android") {
    return;
  }

  await Notifications.setNotificationChannelAsync("default", {
    name: "default",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
  });
}

function getNotificationResponseId(response: NotificationResponse) {
  return response.notification.request.identifier;
}

function emitNotificationReceived(notification: Notification) {
  notificationReceivedListeners.forEach((listener) => {
    listener(notification);
  });
}

function emitNotificationResponse(response: NotificationResponse) {
  pendingNotificationResponse = response;
  notificationResponseListeners.forEach((listener) => {
    listener(response);
  });
}

async function dispatchLastNotificationResponseIfNeeded() {
  const lastResponse = await Notifications.getLastNotificationResponseAsync();

  if (!lastResponse) {
    return;
  }

  const responseId = getNotificationResponseId(lastResponse);

  if (responseId && responseId === lastHandledNotificationResponseId) {
    return;
  }

  lastHandledNotificationResponseId = responseId;
  emitNotificationResponse(lastResponse);
}

export async function initializeNotificationLifecycle(options?: {
  onNotificationReceived?: (notification: Notification) => void;
  onNotificationResponse?: (response: NotificationResponse) => void;
}) {
  if (Platform.OS === "web") {
    return () => {};
  }

  if (options?.onNotificationReceived) {
    notificationReceivedListeners.add(options.onNotificationReceived);
  }

  if (options?.onNotificationResponse) {
    notificationResponseListeners.add(options.onNotificationResponse);
  }

  if (!lifecycleInitialized) {
    lifecycleInitialized = true;
    await ensureAndroidNotificationChannel();

    notificationReceivedSubscription = Notifications.addNotificationReceivedListener((notification) => {
      emitNotificationReceived(notification);
    });

    notificationResponseSubscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        lastHandledNotificationResponseId = getNotificationResponseId(response);
        emitNotificationResponse(response);
      },
    );
  }

  await dispatchLastNotificationResponseIfNeeded();

  return () => {
    if (options?.onNotificationReceived) {
      notificationReceivedListeners.delete(options.onNotificationReceived);
    }

    if (options?.onNotificationResponse) {
      notificationResponseListeners.delete(options.onNotificationResponse);
    }
  };
}

export function getPendingNotificationResponse() {
  return pendingNotificationResponse;
}

export function clearPendingNotificationResponse() {
  pendingNotificationResponse = null;
}

export function resolveNotificationTargetPath(response: NotificationResponse) {
  const rawData = response.notification.request.content.data;

  if (!rawData || typeof rawData !== "object") {
    return null;
  }

  const candidate = [rawData.path, rawData.pathname, rawData.route].find(
    (value) => typeof value === "string" && value.trim().startsWith("/"),
  );

  return typeof candidate === "string" ? candidate.trim() : null;
}

async function requestPushRegistration() {
  if (Platform.OS === "web") {
    return {
      error: "Push notifications are not supported on web.",
      ok: false as const,
    };
  }

  const projectId = getExpoProjectId();

  if (!projectId) {
    return {
      error: "Missing Expo project ID for push notifications.",
      ok: false as const,
    };
  }

  if (!Device.isDevice) {
    return {
      error: "Expo push tokens require a physical device.",
      ok: false as const,
    };
  }

  const permissions = await Notifications.getPermissionsAsync();
  let finalStatus = permissions.status;

  if (finalStatus !== "granted") {
    const requested = await Notifications.requestPermissionsAsync();
    finalStatus = requested.status;
  }

  if (finalStatus !== "granted") {
    return {
      error: "Push notification permission was not granted.",
      ok: false as const,
    };
  }

  try {
    const token = await Notifications.getExpoPushTokenAsync({
      projectId,
    });

    return {
      deviceId: await getInstallationId(),
      ok: true as const,
      platform: Platform.OS as PushPlatform,
      token: token.data,
    };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Could not generate an Expo push token on this device.",
      ok: false as const,
    };
  }
}

export async function syncPushTokenForAuthenticatedSession(params: {
  authToken: string;
  userId: string;
}) {
  const { authToken, userId } = params;

  await initializeNotificationLifecycle();

  const registration = await requestPushRegistration();

  if (!registration.ok) {
    console.warn("[notifications] push registration skipped", {
      reason: registration.error,
      userId,
    });
    return registration;
  }

  const registrationKey = `${userId}:${registration.token}`;

  if (registrationKey === lastSuccessfulRegistrationKey) {
    return {
      ok: true as const,
      skipped: true as const,
      token: registration.token,
    };
  }

  const result = await registerPushTokenWithBackend(authToken, {
    device_id: registration.deviceId,
    platform: registration.platform,
    token: registration.token,
  });

  if (!result.ok) {
    console.warn("[notifications] backend push token registration failed", {
      reason: result.error,
      status: result.status,
      userId,
    });
    return result;
  }

  lastSuccessfulRegistrationKey = registrationKey;

  return {
    ok: true as const,
    skipped: false as const,
    token: registration.token,
  };
}

export function resetPushTokenRegistrationState() {
  lastSuccessfulRegistrationKey = null;
}

export function disposeNotificationLifecycle() {
  notificationReceivedSubscription?.remove();
  notificationReceivedSubscription = null;
  notificationResponseSubscription?.remove();
  notificationResponseSubscription = null;
  notificationReceivedListeners.clear();
  notificationResponseListeners.clear();
  lifecycleInitialized = false;
  pendingNotificationResponse = null;
  lastHandledNotificationResponseId = null;
}
