function readEnv(name, fallback = "") {
  return String(process.env[name] || fallback).trim();
}

function readBool(name, fallback = false) {
  const value = readEnv(name);

  if (!value) {
    return fallback;
  }

  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function readInt(name, fallback) {
  const value = Number.parseInt(readEnv(name), 10);
  return Number.isFinite(value) ? value : fallback;
}

function readList(name, fallback = []) {
  const value = readEnv(name);

  if (!value) {
    return fallback;
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

const nodeEnv = readEnv("NODE_ENV", "development");
const isProduction = nodeEnv === "production";

module.exports = {
  app: {
    host: readEnv("HOST", "0.0.0.0"),
    port: readInt("PORT", 5050),
    publicAppUrl: readEnv("PUBLIC_APP_URL", "http://localhost:8081"),
    trustedProxy: readBool("TRUST_PROXY", isProduction),
  },
  cors: {
    allowedOrigins: readList("CORS_ALLOWED_ORIGINS", []),
  },
  database: {
    applicationName: readEnv("DB_APPLICATION_NAME", "neara-backend"),
    connectionTimeoutMillis: readInt("DB_CONNECTION_TIMEOUT_MS", 10000),
    idleInTransactionSessionTimeout: readInt("DB_IDLE_IN_TX_TIMEOUT_MS", 15000),
    idleTimeoutMillis: readInt("DB_IDLE_TIMEOUT_MS", 30000),
    max: readInt("DB_POOL_MAX", 5),
    queryTimeout: readInt("DB_QUERY_TIMEOUT_MS", 15000),
    ssl: readEnv("DATABASE_SSL_MODE", isProduction ? "require" : "prefer"),
  },
  jwt: {
    audience: readEnv("JWT_AUDIENCE", "neara-mobile"),
    expiresIn: readEnv("JWT_EXPIRES_IN", "7d"),
    issuer: readEnv("JWT_ISSUER", "neara-backend"),
    secret: readEnv("JWT_SECRET"),
  },
  payment: {
    amountKobo: readInt("PRO_SUBSCRIPTION_AMOUNT_KOBO", 100000),
    currency: readEnv("PRO_SUBSCRIPTION_CURRENCY", "NGN"),
    provider: readEnv("PAYMENT_PROVIDER", "mock").toLowerCase(),
    paystackSecretKey: readEnv("PAYSTACK_SECRET_KEY"),
    paystackPlanCode: readEnv("PAYSTACK_PLAN_CODE"),
    stripePriceId: readEnv("STRIPE_PRICE_ID"),
    stripeSecretKey: readEnv("STRIPE_SECRET_KEY"),
    successUrl: readEnv("PAYMENT_SUCCESS_URL", "https://example.com/payments/success"),
    cancelUrl: readEnv("PAYMENT_CANCEL_URL", "https://example.com/payments/cancel"),
    webhookSecret: readEnv("PAYMENT_WEBHOOK_SECRET"),
  },
  runtime: {
    isProduction,
    nodeEnv,
  },
};
