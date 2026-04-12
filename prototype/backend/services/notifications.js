const { notifications } = require("../config/env");

const EXPO_PUSH_API_URL = "https://exp.host/--/api/v2/push/send";

const PUSH_EVENT_TYPES = Object.freeze({
  NEW_CUSTOMER_MESSAGE: "new_customer_message",
  SAVED_STORE_ACTIVITY: "saved_store_activity",
  STORE_SETUP_COMPLETE: "store_setup_complete",
  TEST: "test_notification",
  UPDATE_PRODUCTS_REMINDER: "update_products_reminder",
});

function isExpoPushToken(value) {
  return /^(ExponentPushToken|ExpoPushToken)\[[^\]]+\]$/.test(String(value || "").trim());
}

function normalizePushPlatform(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "android" || normalized === "ios" ? normalized : null;
}

function normalizeDeviceId(value) {
  const normalized = String(value || "").trim();
  return normalized ? normalized.slice(0, 200) : null;
}

function normalizeNotificationText(value, fallback) {
  const normalized = String(value || "").trim();
  return normalized ? normalized.slice(0, 200) : fallback;
}

async function recordNotificationDelivery(client, payload) {
  const { rows } = await client.query(
    `
      INSERT INTO notification_deliveries (
        user_id,
        push_token_id,
        event_type,
        status,
        title,
        body,
        payload,
        provider_response,
        sent_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9)
      RETURNING *
    `,
    [
      payload.userId,
      payload.pushTokenId,
      payload.eventType,
      payload.status,
      payload.title,
      payload.body,
      JSON.stringify(payload.payload || {}),
      JSON.stringify(payload.providerResponse || {}),
      payload.sentAt || null,
    ],
  );

  return rows[0] || null;
}

async function markPushTokenDeliverySuccess(client, pushTokenId) {
  await client.query(
    `
      UPDATE push_tokens
      SET
        status = 'active',
        last_error_at = NULL,
        last_error_reason = NULL,
        last_sent_at = NOW(),
        updated_at = NOW()
      WHERE id = $1
    `,
    [pushTokenId],
  );
}

async function markPushTokenDeliveryFailure(client, pushTokenId, reason, options = {}) {
  const nextStatus = options.invalidate ? "invalid" : "error";

  await client.query(
    `
      UPDATE push_tokens
      SET
        status = $2,
        last_error_at = NOW(),
        last_error_reason = $3,
        updated_at = NOW()
      WHERE id = $1
    `,
    [pushTokenId, nextStatus, reason],
  );
}

async function getActivePushTokensForUser(client, userId) {
  const { rows } = await client.query(
    `
      SELECT id, token, platform, device_id
      FROM push_tokens
      WHERE user_id = $1
        AND status = 'active'
      ORDER BY last_registered_at DESC, created_at DESC, id DESC
    `,
    [userId],
  );

  return rows.filter((row) => isExpoPushToken(row.token));
}

async function sendExpoPushRequest(messages) {
  const headers = {
    Accept: "application/json",
    "Accept-Encoding": "gzip, deflate",
    "Content-Type": "application/json",
  };

  if (notifications.expoAccessToken) {
    headers.Authorization = `Bearer ${notifications.expoAccessToken}`;
  }

  const response = await fetch(EXPO_PUSH_API_URL, {
    body: JSON.stringify(messages),
    headers,
    method: "POST",
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      payload?.errors?.[0]?.message ||
      payload?.error ||
      `Expo push request failed with status ${response.status}`;
    throw new Error(message);
  }

  return payload;
}

async function sendPushNotifications(client, deliveries) {
  if (!Array.isArray(deliveries) || deliveries.length === 0) {
    return {
      attemptedCount: 0,
      deliveredCount: 0,
      invalidatedCount: 0,
      tickets: [],
    };
  }

  const messages = deliveries.map((delivery) => ({
    body: delivery.body,
    channelId: "default",
    data: {
      event_type: delivery.eventType,
      ...delivery.data,
    },
    priority: "high",
    sound: "default",
    title: delivery.title,
    to: delivery.token,
  }));

  let payload;

  try {
    payload = await sendExpoPushRequest(messages);
  } catch (error) {
    for (const delivery of deliveries) {
      await markPushTokenDeliveryFailure(
        client,
        delivery.pushTokenId,
        error?.message || String(error),
      );
      await recordNotificationDelivery(client, {
        body: delivery.body,
        eventType: delivery.eventType,
        payload: delivery.data,
        providerResponse: {
          error: error?.message || String(error),
        },
        pushTokenId: delivery.pushTokenId,
        sentAt: null,
        status: "error",
        title: delivery.title,
        userId: delivery.userId,
      });
    }

    throw error;
  }

  const tickets = Array.isArray(payload?.data) ? payload.data : [];
  let deliveredCount = 0;
  let invalidatedCount = 0;

  for (const [index, delivery] of deliveries.entries()) {
    const ticket = tickets[index] || null;
    const ticketStatus = ticket?.status === "ok" ? "sent" : "error";
    const errorCode = ticket?.details?.error || null;
    const invalidateToken = errorCode === "DeviceNotRegistered";

    if (ticketStatus === "sent") {
      deliveredCount += 1;
      await markPushTokenDeliverySuccess(client, delivery.pushTokenId);
    } else {
      if (invalidateToken) {
        invalidatedCount += 1;
      }

      await markPushTokenDeliveryFailure(
        client,
        delivery.pushTokenId,
        errorCode || ticket?.message || "Push delivery failed",
        {
          invalidate: invalidateToken,
        },
      );
    }

    await recordNotificationDelivery(client, {
      body: delivery.body,
      eventType: delivery.eventType,
      payload: delivery.data,
      providerResponse: ticket || {},
      pushTokenId: delivery.pushTokenId,
      sentAt: ticketStatus === "sent" ? new Date().toISOString() : null,
      status: ticketStatus,
      title: delivery.title,
      userId: delivery.userId,
    });
  }

  return {
    attemptedCount: deliveries.length,
    deliveredCount,
    invalidatedCount,
    tickets,
  };
}

async function sendPushEventToUser(client, params) {
  const tokens = await getActivePushTokensForUser(client, params.userId);

  if (tokens.length === 0) {
    return {
      attemptedCount: 0,
      deliveredCount: 0,
      invalidatedCount: 0,
      reason: "No active push tokens for user.",
      tickets: [],
    };
  }

  const deliveries = tokens.map((tokenRow) => ({
    body: normalizeNotificationText(params.body, "Neara notification"),
    data: params.data || {},
    eventType: params.eventType,
    pushTokenId: Number(tokenRow.id),
    title: normalizeNotificationText(params.title, "Neara"),
    token: tokenRow.token,
    userId: params.userId,
  }));

  return sendPushNotifications(client, deliveries);
}

async function registerPushTokenForUser(client, params) {
  const normalizedToken = String(params.token || "").trim();
  const normalizedPlatform = normalizePushPlatform(params.platform);
  const normalizedDeviceId = normalizeDeviceId(params.deviceId);

  if (!isExpoPushToken(normalizedToken)) {
    throw new Error("A valid Expo push token is required.");
  }

  if (!normalizedPlatform) {
    throw new Error("platform must be either ios or android.");
  }

  if (normalizedDeviceId) {
    await client.query(
      `
        DELETE FROM push_tokens
        WHERE user_id = $1
          AND device_id = $2
          AND token <> $3
      `,
      [params.userId, normalizedDeviceId, normalizedToken],
    );
  }

  const { rows } = await client.query(
    `
      INSERT INTO push_tokens (
        user_id,
        token,
        platform,
        device_id,
        status,
        last_registered_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, 'active', NOW(), NOW())
      ON CONFLICT (token)
      DO UPDATE SET
        user_id = EXCLUDED.user_id,
        platform = EXCLUDED.platform,
        device_id = COALESCE(EXCLUDED.device_id, push_tokens.device_id),
        status = 'active',
        last_registered_at = NOW(),
        last_error_at = NULL,
        last_error_reason = NULL,
        updated_at = NOW()
      RETURNING *
    `,
    [params.userId, normalizedToken, normalizedPlatform, normalizedDeviceId],
  );

  return rows[0] || null;
}

async function sendTestPushNotification(client, userId) {
  return sendPushEventToUser(client, {
    body: "This is a test notification",
    data: {
      path: "/(tabs)/home",
    },
    eventType: PUSH_EVENT_TYPES.TEST,
    title: "Neara",
    userId,
  });
}

module.exports = {
  PUSH_EVENT_TYPES,
  getActivePushTokensForUser,
  isExpoPushToken,
  registerPushTokenForUser,
  sendPushEventToUser,
  sendTestPushNotification,
};
