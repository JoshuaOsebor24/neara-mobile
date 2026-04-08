const { app, payment } = require("../config/env");

function buildMockCheckoutUrl(reference) {
  const baseUrl = app.publicAppUrl.replace(/\/+$/, "");
  return `${baseUrl}/upgrade?payment_reference=${encodeURIComponent(reference)}`;
}

async function initializeSubscriptionCheckout({ email, name, reference, metadata }) {
  if (payment.provider === "mock") {
    return {
      checkout_url: buildMockCheckoutUrl(reference),
      provider: "mock",
      provider_reference: reference,
      raw: {
        metadata,
      },
    };
  }

  if (payment.provider === "paystack") {
    if (!payment.paystackSecretKey) {
      throw new Error("PAYSTACK_SECRET_KEY is not configured");
    }

    const response = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${payment.paystackSecretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: payment.amountKobo,
        callback_url: payment.successUrl,
        channels: ["card", "bank", "ussd", "bank_transfer"],
        currency: payment.currency,
        email,
        metadata: {
          ...metadata,
          custom_fields: [
            {
              display_name: "Neara Plan",
              variable_name: "neara_plan",
              value: "pro_monthly",
            },
            {
              display_name: "Customer Name",
              variable_name: "customer_name",
              value: name || email,
            },
          ],
        },
        plan: payment.paystackPlanCode || undefined,
        reference,
      }),
    });
    const payload = await response.json();

    if (!response.ok || !payload?.status || !payload?.data?.authorization_url) {
      throw new Error(payload?.message || "Could not initialize Paystack checkout");
    }

    return {
      checkout_url: payload.data.authorization_url,
      provider: "paystack",
      provider_reference: payload.data.reference || reference,
      raw: payload.data,
    };
  }

  if (payment.provider === "stripe") {
    if (!payment.stripeSecretKey || !payment.stripePriceId) {
      throw new Error("Stripe payment variables are not configured");
    }

    const body = new URLSearchParams();
    body.append("mode", "subscription");
    body.append("success_url", `${payment.successUrl}?reference=${encodeURIComponent(reference)}`);
    body.append("cancel_url", payment.cancelUrl);
    body.append("client_reference_id", reference);
    body.append("customer_email", email);
    body.append("line_items[0][price]", payment.stripePriceId);
    body.append("line_items[0][quantity]", "1");
    body.append("metadata[user_email]", email);
    body.append("metadata[reference]", reference);
    if (name) {
      body.append("metadata[user_name]", name);
    }

    const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${payment.stripeSecretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
    const payload = await response.json();

    if (!response.ok || !payload?.url) {
      throw new Error(payload?.error?.message || "Could not initialize Stripe checkout");
    }

    return {
      checkout_url: payload.url,
      provider: "stripe",
      provider_reference: payload.id || reference,
      raw: payload,
    };
  }

  throw new Error(`Unsupported payment provider: ${payment.provider}`);
}

async function verifySubscriptionPayment(reference) {
  if (payment.provider === "mock") {
    return {
      paid_at: new Date().toISOString(),
      provider: "mock",
      provider_reference: reference,
      status: "success",
    };
  }

  if (payment.provider === "paystack") {
    if (!payment.paystackSecretKey) {
      throw new Error("PAYSTACK_SECRET_KEY is not configured");
    }

    const response = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      {
        headers: {
          Authorization: `Bearer ${payment.paystackSecretKey}`,
        },
      },
    );
    const payload = await response.json();

    if (!response.ok || !payload?.status || payload?.data?.status !== "success") {
      throw new Error(payload?.message || "Payment has not been completed yet");
    }

    return {
      paid_at: payload.data.paid_at || new Date().toISOString(),
      provider: "paystack",
      provider_reference: payload.data.reference || reference,
      raw: payload.data,
      status: "success",
    };
  }

  if (payment.provider === "stripe") {
    if (!payment.stripeSecretKey) {
      throw new Error("STRIPE_SECRET_KEY is not configured");
    }

    const response = await fetch(
      `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(reference)}`,
      {
        headers: {
          Authorization: `Bearer ${payment.stripeSecretKey}`,
        },
      },
    );
    const payload = await response.json();

    if (!response.ok || payload?.payment_status !== "paid") {
      throw new Error(payload?.error?.message || "Payment has not been completed yet");
    }

    return {
      paid_at: payload.created
        ? new Date(payload.created * 1000).toISOString()
        : new Date().toISOString(),
      provider: "stripe",
      provider_reference: payload.id || reference,
      raw: payload,
      status: "success",
      subscription_id: payload.subscription || null,
    };
  }

  throw new Error(`Unsupported payment provider: ${payment.provider}`);
}

module.exports = {
  initializeSubscriptionCheckout,
  verifySubscriptionPayment,
};
