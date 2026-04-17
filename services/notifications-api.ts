import { requestMobileApi } from "@/services/api";

export type PushPlatform = "android" | "ios";

type RegisterPushTokenPayload = {
  device_id: string;
  platform: PushPlatform;
  token: string;
};

type RegisterPushTokenResponse = {
  data?: {
    message?: string;
    push_token?: {
      id?: number;
      platform?: string;
      status?: string;
      token?: string;
      user_id?: number;
    };
  };
  message?: string;
  push_token?: {
    id?: number;
    platform?: string;
    status?: string;
    token?: string;
    user_id?: number;
  };
};

export async function registerPushTokenWithBackend(
  authToken: string,
  payload: RegisterPushTokenPayload,
) {
  const result = await requestMobileApi<RegisterPushTokenResponse>(
    "/notifications/register-token",
    {
      body: payload,
      method: "POST",
      token: authToken,
    },
  );

  if (!result.ok) {
    return {
      error: result.error,
      ok: false as const,
      status: result.status,
    };
  }

  return {
    message:
      result.data?.data?.message ??
      result.data?.message ??
      "Notifications are ready.",
    ok: true as const,
    pushToken: result.data?.data?.push_token ?? result.data?.push_token ?? null,
    status: result.status,
  };
}

export async function sendTestPushNotificationWithBackend(authToken: string) {
  const result = await requestMobileApi<{
    data?: {
      attempted_count?: number;
      delivered_count?: number;
      invalidated_count?: number;
      message?: string;
    };
    message?: string;
  }>("/notifications/test", {
    method: "POST",
    token: authToken,
  });

  if (!result.ok) {
    return {
      error: result.error,
      ok: false as const,
      status: result.status,
    };
  }

  return {
    attemptedCount: Number(result.data?.data?.attempted_count ?? 0),
    deliveredCount: Number(result.data?.data?.delivered_count ?? 0),
    invalidatedCount: Number(result.data?.data?.invalidated_count ?? 0),
    message:
      result.data?.data?.message ??
      result.data?.message ??
      "Test notification sent.",
    ok: true as const,
    status: result.status,
  };
}
