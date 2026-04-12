const { Pool } = require("pg");
const { database, runtime } = require("./env");
const DB_LOG_PREFIX = "[db]";
const SLOW_QUERY_THRESHOLD_MS = database.slowQueryThresholdMs;

function summarizeQueryText(value) {
  const text =
    typeof value === "string"
      ? value
      : value && typeof value.text === "string"
        ? value.text
        : "";

  return text.replace(/\s+/g, " ").trim().slice(0, 240);
}

function summarizeQueryArgs(args) {
  const statement = summarizeQueryText(args[0]);
  const params = Array.isArray(args[1]) ? args[1].length : 0;

  return {
    params,
    statement,
  };
}

function logQueryOutcome(level, label, startedAt, args, extra = {}) {
  const durationMs = Date.now() - startedAt;
  const summary = summarizeQueryArgs(args);
  const payload = {
    duration_ms: durationMs,
    ...summary,
    ...extra,
  };

  if (level === "error") {
    console.error(`${DB_LOG_PREFIX}[${label}]`, payload);
    return;
  }

  if (durationMs >= SLOW_QUERY_THRESHOLD_MS) {
    console.warn(`${DB_LOG_PREFIX}[${label}]`, payload);
  }
}

function buildSslConfig() {
  if (database.ssl === "disable") {
    return false;
  }

  if (database.ssl === "require") {
    return {
      rejectUnauthorized: false,
    };
  }

  return runtime.isProduction
    ? {
        rejectUnauthorized: false,
      }
    : false;
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: buildSslConfig(),
  application_name: database.applicationName,
  allowExitOnIdle: true,
  connectionTimeoutMillis: database.connectionTimeoutMillis,
  idle_in_transaction_session_timeout: database.idleInTransactionSessionTimeout,
  idleTimeoutMillis: database.idleTimeoutMillis,
  keepAlive: true,
  max: database.max,
  maxLifetimeSeconds: database.maxLifetimeSeconds,
  maxUses: database.maxUses,
  query_timeout: database.queryTimeout,
  statement_timeout: database.queryTimeout,
});

const basePoolQuery = pool.query.bind(pool);
pool.query = async (...args) => {
  const startedAt = Date.now();

  try {
    const result = await basePoolQuery(...args);
    logQueryOutcome("warn", "slow-query", startedAt, args, {
      row_count: result?.rowCount ?? null,
    });
    return result;
  } catch (error) {
    logQueryOutcome("error", "query-error", startedAt, args, {
      code: error?.code,
      message: error?.message || String(error),
    });
    throw error;
  }
};

pool.getDiagnostics = () => ({
  idle_count: pool.idleCount,
  max: database.max,
  total_count: pool.totalCount,
  waiting_count: pool.waitingCount,
});

pool.on("error", (error) => {
  console.error("Unexpected PostgreSQL pool error", {
    code: error?.code,
    message: error?.message || String(error),
    stack: error?.stack,
  });
});

pool.on("connect", () => {
  console.info(`${DB_LOG_PREFIX}[client-connect]`, pool.getDiagnostics());
});

pool.on("acquire", () => {
  if (pool.waitingCount > 0) {
    console.warn(`${DB_LOG_PREFIX}[pool-pressure]`, pool.getDiagnostics());
  }
});

module.exports = pool;
