const pool = require("../config/db");
const { notifications } = require("../config/env");
const { PUSH_EVENT_TYPES, sendPushEventToUser } = require("./notifications");

async function findUsersNeedingProductUpdateReminder(client, limit) {
  const { rows } = await client.query(
    `
      SELECT
        users.id AS user_id,
        users.name,
        stores.id AS store_id,
        stores.store_name,
        MAX(COALESCE(products.updated_at, products.created_at)) AS last_product_activity_at,
        (
          SELECT MAX(notification_deliveries.sent_at)
          FROM notification_deliveries
          WHERE notification_deliveries.user_id = users.id
            AND notification_deliveries.event_type = $1
            AND notification_deliveries.status = 'sent'
        ) AS last_reminder_sent_at
      FROM users
      JOIN stores
        ON stores.owner_id = users.id
      LEFT JOIN products
        ON products.store_id = stores.id
      WHERE EXISTS (
        SELECT 1
        FROM push_tokens
        WHERE push_tokens.user_id = users.id
          AND push_tokens.status = 'active'
      )
      GROUP BY users.id, users.name, stores.id, stores.store_name
      HAVING (
        MAX(COALESCE(products.updated_at, products.created_at)) IS NULL
        OR MAX(COALESCE(products.updated_at, products.created_at))
          < NOW() - make_interval(days => $2::INT)
      )
      AND (
        (
          SELECT MAX(notification_deliveries.sent_at)
          FROM notification_deliveries
          WHERE notification_deliveries.user_id = users.id
            AND notification_deliveries.event_type = $1
            AND notification_deliveries.status = 'sent'
        ) IS NULL
        OR (
          SELECT MAX(notification_deliveries.sent_at)
          FROM notification_deliveries
          WHERE notification_deliveries.user_id = users.id
            AND notification_deliveries.event_type = $1
            AND notification_deliveries.status = 'sent'
        ) < NOW() - make_interval(hours => $3::INT)
      )
      ORDER BY COALESCE(MAX(COALESCE(products.updated_at, products.created_at)), users.created_at) ASC
      LIMIT $4
    `,
    [
      PUSH_EVENT_TYPES.UPDATE_PRODUCTS_REMINDER,
      notifications.productReminderStaleDays,
      notifications.productReminderCooldownHours,
      limit,
    ],
  );

  return rows;
}

async function sendProductUpdateReminders(options = {}) {
  const limit = Number.isFinite(Number(options.limit))
    ? Number(options.limit)
    : notifications.reminderBatchSize;
  const client = await pool.connect();

  try {
    const candidates = await findUsersNeedingProductUpdateReminder(client, limit);
    const results = [];

    for (const candidate of candidates) {
      const delivery = await sendPushEventToUser(client, {
        body: "Remember to update your products.",
        data: {
          path: "/store/products/add",
          reminder_type: PUSH_EVENT_TYPES.UPDATE_PRODUCTS_REMINDER,
          store_id: Number(candidate.store_id),
        },
        eventType: PUSH_EVENT_TYPES.UPDATE_PRODUCTS_REMINDER,
        title: "Neara",
        userId: Number(candidate.user_id),
      });

      results.push({
        deliveredCount: delivery.deliveredCount,
        lastProductActivityAt: candidate.last_product_activity_at,
        lastReminderSentAt: candidate.last_reminder_sent_at,
        storeId: Number(candidate.store_id),
        storeName: candidate.store_name,
        userId: Number(candidate.user_id),
      });
    }

    return {
      candidatesEvaluated: candidates.length,
      results,
    };
  } finally {
    client.release();
  }
}

module.exports = {
  sendProductUpdateReminders,
};
