const { Pool } = require("pg");
const { database, runtime } = require("./env");

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
  connectionTimeoutMillis: database.connectionTimeoutMillis,
  idle_in_transaction_session_timeout: database.idleInTransactionSessionTimeout,
  idleTimeoutMillis: database.idleTimeoutMillis,
  max: database.max,
  query_timeout: database.queryTimeout,
  statement_timeout: database.queryTimeout,
});

pool.on("error", (error) => {
  console.error("Unexpected PostgreSQL pool error", {
    code: error?.code,
    message: error?.message || String(error),
    stack: error?.stack,
  });
});

module.exports = pool;
