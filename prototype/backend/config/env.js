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
    bodyLimitMb: readInt("BODY_LIMIT_MB", 12),
    headersTimeoutMs: readInt("HEADERS_TIMEOUT_MS", 20000),
    keepAliveTimeoutMs: readInt("KEEP_ALIVE_TIMEOUT_MS", 5000),
    maxRequestsPerSocket: readInt("MAX_REQUESTS_PER_SOCKET", 100),
    requestTimeoutMs: readInt("REQUEST_TIMEOUT_MS", 20000),
    routeCacheTtlMs: readInt("ROUTE_CACHE_TTL_MS", 15000),
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
    max: readInt("DB_POOL_MAX", 10),
    maxLifetimeSeconds: readInt("DB_POOL_MAX_LIFETIME_S", 300),
    maxUses: readInt("DB_POOL_MAX_USES", 7500),
    slowQueryThresholdMs: readInt("DB_SLOW_QUERY_THRESHOLD_MS", 1500),
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
  notifications: {
    expoAccessToken: readEnv("EXPO_ACCESS_TOKEN"),
    productReminderCooldownHours: readInt("NOTIFICATION_PRODUCTS_REMINDER_COOLDOWN_HOURS", 72),
    productReminderStaleDays: readInt("NOTIFICATION_PRODUCTS_STALE_DAYS", 7),
    reminderBatchSize: readInt("NOTIFICATION_REMINDER_BATCH_SIZE", 50),
  },
  runtime: {
    diagnosticsIntervalMs: readInt("DIAGNOSTICS_INTERVAL_MS", 60000),
    healthTimeoutMs: readInt("HEALTH_TIMEOUT_MS", 2000),
    isProduction,
    nodeEnv,
  },
};
