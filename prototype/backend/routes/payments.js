const express = require("express");

const pool = require("../config/db");
const { payment } = require("../config/env");
const authMiddleware = require("../middleware/authMiddleware");
const { initializeSubscriptionCheckout, verifySubscriptionPayment } = require("../services/payment-provider");

const router = express.Router();

function buildReference(userId) {
  return `neara_pro_${userId}_${Date.now()}`;
}

async function syncProRole(client, userId) {
  return client.query(
    `
      UPDATE users
      SET premium_status = TRUE,
          roles = ARRAY(
            SELECT role_name
            FROM unnest(
              ARRAY[
                'user'::TEXT,
                'pro'::TEXT,
                CASE
                  WHEN EXISTS (
                    SELECT 1
                    FROM stores
                    WHERE stores.owner_id = users.id
                  )
                  THEN 'store_owner'::TEXT
                  ELSE NULL
                END
              ]
            ) AS role_name
            WHERE role_name IS NOT NULL
          )
      WHERE id = $1
      RETURNING id, name, email, phone_number, is_admin, premium_status, roles, created_at
    `,
    [userId],
  );
}

router.get("/config", authMiddleware, async (req, res) => {
  return res.json({
    amount_kobo: payment.amountKobo,
    currency: payment.currency,
    interval: "month",
    plan_code: payment.paystackPlanCode || null,
    provider: payment.provider,
  });
});

router.post("/subscriptions/initialize", authMiddleware, async (req, res) => {
  const userId = Number(req.user?.id);

  if (!Number.isInteger(userId)) {
    return res.status(401).json({
      message: "Invalid user session",
    });
  }

  const client = await pool.connect();

  try {
    const userResult = await client.query(
      `
        SELECT id, name, email, premium_status
        FROM users
        WHERE id = $1
        LIMIT 1
      `,
      [userId],
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const user = userResult.rows[0];

    if (user.premium_status && payment.provider === "mock") {
      return res.status(409).json({
        message: "Pro access is already active.",
      });
    }

    const reference = buildReference(userId);
    const checkout = await initializeSubscriptionCheckout({
      email: user.email,
      metadata: {
        plan: "pro_monthly",
        user_id: userId,
      },
      name: user.name,
      reference,
    });

    await client.query(
      `
        INSERT INTO payment_transactions (
          user_id,
          provider,
          reference,
          amount_kobo,
          currency,
          status,
          checkout_url,
          metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (reference)
        DO UPDATE SET
          status = EXCLUDED.status,
          checkout_url = EXCLUDED.checkout_url,
          metadata = EXCLUDED.metadata,
          updated_at = NOW()
      `,
      [
        userId,
        checkout.provider,
        reference,
        payment.amountKobo,
        payment.currency,
        payment.provider === "mock" ? "pending_verification" : "initialized",
        checkout.checkout_url,
        checkout.raw || {},
      ],
    );

    return res.status(201).json({
      amount_kobo: payment.amountKobo,
      authorization_url: checkout.checkout_url,
      currency: payment.currency,
      message:
        payment.provider === "mock"
          ? "Mock checkout initialized for local development."
          : "Subscription checkout initialized.",
      provider: checkout.provider,
      reference,
    });
  } catch (error) {
    return res.status(500).json({
      message: error?.message || "Could not initialize subscription checkout",
    });
  } finally {
    client.release();
  }
});

router.post("/subscriptions/verify", authMiddleware, async (req, res) => {
  const userId = Number(req.user?.id);
  const reference = String(req.body?.reference || "").trim();

  if (!Number.isInteger(userId)) {
    return res.status(401).json({
      message: "Invalid user session",
    });
  }

  if (!reference) {
    return res.status(400).json({
      message: "Payment reference is required",
    });
  }

  const client = await pool.connect();
  let transactionOpen = false;

  try {
    const paymentResult = await client.query(
      `
        SELECT *
        FROM payment_transactions
        WHERE reference = $1 AND user_id = $2
        LIMIT 1
      `,
      [reference, userId],
    );

    if (paymentResult.rows.length === 0) {
      return res.status(404).json({
        message: "Payment reference not found",
      });
    }

    const verified = await verifySubscriptionPayment(reference);

    await client.query("BEGIN");
    transactionOpen = true;

    await client.query(
      `
        UPDATE payment_transactions
        SET status = 'paid',
            paid_at = $2,
            metadata = COALESCE(metadata, '{}'::jsonb) || $3::jsonb,
            updated_at = NOW()
        WHERE reference = $1
      `,
      [reference, verified.paid_at, verified.raw || {}],
    );

    await client.query(
      `
        INSERT INTO subscriptions (
          user_id,
          provider,
          provider_subscription_id,
          reference,
          amount_kobo,
          currency,
          status,
          current_period_start,
          current_period_end,
          metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, 'active', NOW(), NOW() + INTERVAL '1 month', $7)
        ON CONFLICT (user_id)
        DO UPDATE SET
          provider = EXCLUDED.provider,
          provider_subscription_id = EXCLUDED.provider_subscription_id,
          reference = EXCLUDED.reference,
          amount_kobo = EXCLUDED.amount_kobo,
          currency = EXCLUDED.currency,
          status = 'active',
          current_period_start = NOW(),
          current_period_end = NOW() + INTERVAL '1 month',
          metadata = EXCLUDED.metadata,
          updated_at = NOW()
      `,
      [
        userId,
        verified.provider,
        verified.subscription_id || verified.provider_reference || null,
        reference,
        payment.amountKobo,
        payment.currency,
        verified.raw || {},
      ],
    );

    const userUpdateResult = await syncProRole(client, userId);
    await client.query("COMMIT");
    transactionOpen = false;

    return res.json({
      message: "Pro subscription activated.",
      subscription: {
        amount_kobo: payment.amountKobo,
        currency: payment.currency,
        provider: verified.provider,
        reference,
        status: "active",
      },
      user: userUpdateResult.rows[0],
    });
  } catch (error) {
    if (transactionOpen) {
      await client.query("ROLLBACK");
    }

    return res.status(500).json({
      message: error?.message || "Could not verify subscription payment",
    });
  } finally {
    client.release();
  }
});

module.exports = router;
