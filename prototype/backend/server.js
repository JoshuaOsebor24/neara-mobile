// Load environment variables first
require("dotenv").config();

// Core packages
const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const {
  app: appConfig,
  cors: envCors,
  payment,
  runtime,
} = require("./config/env");

// DB pool from config
const pool = require("./config/db");
const ensureSchema = require("./config/ensureSchema");

// Initialize app
const app = express();
let server = null;
let shuttingDown = false;
let isReady = false;
let nextRequestId = 0;
const SERVER_LOG_PREFIX = "[server]";
const REQUEST_LOG_PREFIX = "[http]";
const DIAGNOSTIC_LOG_PREFIX = "[diag]";

if (appConfig.trustedProxy) {
  app.set("trust proxy", 1);
}

const allowedDevOrigins = new Set([
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:8081",
  "http://localhost:8082",
  "http://localhost:8083",
]);
const allowedConfiguredOrigins = new Set(envCors.allowedOrigins);

function isValidHttpOrigin(origin) {
  try {
    const parsed = new URL(origin);
    return (
      (parsed.protocol === "http:" || parsed.protocol === "https:") &&
      !parsed.username &&
      !parsed.password &&
      parsed.origin === origin
    );
  } catch {
    return false;
  }
}

function isAllowedLanOrigin(origin) {
  return /^http:\/\/(?:192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}):(\d+)$/.test(
    origin,
  );
}

function isAllowedProductionOrigin(origin) {
  return allowedConfiguredOrigins.has(origin);
}

function isAllowedDevelopmentOrigin(origin) {
  return (
    allowedConfiguredOrigins.has(origin) ||
    allowedDevOrigins.has(origin) ||
    isAllowedLanOrigin(origin)
  );
}

const corsOptions = {
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  origin(origin, callback) {
    if (!origin) {
      callback(null, true);
      return;
    }

    const isAllowed = runtime.isProduction
      ? isAllowedProductionOrigin(origin)
      : isAllowedDevelopmentOrigin(origin);

    if (isAllowed) {
      callback(null, true);
      return;
    }

    callback(new Error(`CORS origin not allowed: ${origin}`));
  },
  optionsSuccessStatus: 204,
};
/*
--------------------------------
DATABASE CONNECTION
--------------------------------
*/
const logDbStartupCheck = async () => {
  const timeoutMs = runtime.healthTimeoutMs;
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error("startup DB check timeout")), timeoutMs),
  );

  await Promise.race([pool.query("SELECT 1"), timeout]);
  console.log("PostgreSQL reachable via DATABASE_URL");
};

function formatErrorPayload(error) {
  return {
    code: error?.code,
    message: error?.message || String(error),
    name: error?.name,
    stack: error?.stack,
  };
}

function getMemorySnapshot() {
  const memory = process.memoryUsage();

  return {
    external_mb: Number((memory.external / 1024 / 1024).toFixed(2)),
    heap_total_mb: Number((memory.heapTotal / 1024 / 1024).toFixed(2)),
    heap_used_mb: Number((memory.heapUsed / 1024 / 1024).toFixed(2)),
    rss_mb: Number((memory.rss / 1024 / 1024).toFixed(2)),
  };
}

async function buildHealthPayload() {
  const healthTimeoutMs = runtime.healthTimeoutMs;
  const startedAt = Date.now();

  try {
    await Promise.race([
      pool.query("SELECT 1"),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("health DB check timeout")),
          healthTimeoutMs,
        ),
      ),
    ]);

    return {
      database: {
        latency_ms: Date.now() - startedAt,
        status: "ok",
      },
      memory: getMemorySnapshot(),
      pid: process.pid,
      pool:
        typeof pool.getDiagnostics === "function"
          ? pool.getDiagnostics()
          : null,
      readiness: isReady ? "ready" : "starting",
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime_s: Number(process.uptime().toFixed(1)),
    };
  } catch (error) {
    return {
      database: {
        error: error?.message || String(error),
        latency_ms: Date.now() - startedAt,
        status: "error",
      },
      memory: getMemorySnapshot(),
      pid: process.pid,
      pool:
        typeof pool.getDiagnostics === "function"
          ? pool.getDiagnostics()
          : null,
      readiness: isReady ? "ready" : "starting",
      status: "degraded",
      timestamp: new Date().toISOString(),
      uptime_s: Number(process.uptime().toFixed(1)),
    };
  }
}

async function gracefulShutdown(reason, exitCode = 0, error = null) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  console.error(`${SERVER_LOG_PREFIX}[shutdown]`, {
    error: error ? formatErrorPayload(error) : null,
    reason,
  });

  const forceExitTimeout = setTimeout(() => {
    console.error(`${SERVER_LOG_PREFIX}[shutdown-timeout]`, { reason });
    process.exit(exitCode);
  }, 10000);
  forceExitTimeout.unref?.();

  try {
    if (server) {
      await new Promise((resolve) => {
        server.close(() => resolve());
      });
    }

    await pool.end();
  } catch (shutdownError) {
    console.error(
      `${SERVER_LOG_PREFIX}[shutdown-error]`,
      formatErrorPayload(shutdownError),
    );
  } finally {
    clearTimeout(forceExitTimeout);
    process.exit(exitCode);
  }
}

setInterval(() => {
  console.info(`${DIAGNOSTIC_LOG_PREFIX}[memory]`, {
    memory: getMemorySnapshot(),
    pid: process.pid,
    pool:
      typeof pool.getDiagnostics === "function" ? pool.getDiagnostics() : null,
    uptime_s: Number(process.uptime().toFixed(1)),
  });
}, runtime.diagnosticsIntervalMs);

// Prevent event loop from exiting - keep server alive
setInterval(() => {
  // This interval keeps Node.js alive
}, 60000);

// Also keep stdin open to prevent exit when terminal closes
process.stdin.resume();

process.on("uncaughtException", (error) => {
  console.error(
    `${SERVER_LOG_PREFIX}[uncaughtException]`,
    formatErrorPayload(error),
  );
  void gracefulShutdown("uncaughtException", 1, error);
});

process.on("unhandledRejection", (reason) => {
  const error =
    reason instanceof Error
      ? reason
      : new Error(String(reason || "Unknown rejection"));
  console.error(
    `${SERVER_LOG_PREFIX}[unhandledRejection]`,
    formatErrorPayload(error),
  );
  void gracefulShutdown("unhandledRejection", 1, error);
});

process.on("SIGINT", () => {
  void gracefulShutdown("SIGINT", 0);
});

process.on("SIGTERM", () => {
  void gracefulShutdown("SIGTERM", 0);
});

/*
--------------------------------
MIDDLEWARE
--------------------------------
*/

// Enable CORS for local frontend development origins and handle preflight.
app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));
// Parse request bodies
app.use(express.json({ limit: `${appConfig.bodyLimitMb}mb` }));
app.use(
  express.urlencoded({ extended: true, limit: `${appConfig.bodyLimitMb}mb` }),
);

app.use((req, res, next) => {
  nextRequestId += 1;
  req.requestId = `${process.pid}-${nextRequestId}`;
  res.setHeader("X-Request-Id", req.requestId);

  if (shuttingDown) {
    return res.status(503).json({
      message: "Server is shutting down",
      request_id: req.requestId,
    });
  }

  res.setTimeout(appConfig.requestTimeoutMs, () => {
    console.error(`${REQUEST_LOG_PREFIX}[timeout]`, {
      method: req.method,
      request_id: req.requestId,
      timeout_ms: appConfig.requestTimeoutMs,
      url: req.originalUrl,
    });

    if (!res.headersSent) {
      res.status(503).json({
        message: "Request timed out",
        request_id: req.requestId,
      });
    }

    req.destroy(new Error("Request timed out"));
  });

  next();
});

// Request logger
app.use((req, res, next) => {
  const startedAt = Date.now();
  const startedIso = new Date().toISOString();

  console.info(`${REQUEST_LOG_PREFIX}[start]`, {
    ip: req.ip,
    method: req.method,
    request_id: req.requestId,
    timestamp: startedIso,
    url: req.originalUrl,
  });

  res.on("finish", () => {
    console.info(`${REQUEST_LOG_PREFIX}[end]`, {
      duration_ms: Date.now() - startedAt,
      ip: req.ip,
      method: req.method,
      request_id: req.requestId,
      status: res.statusCode,
      timestamp: new Date().toISOString(),
      url: req.originalUrl,
    });
  });

  res.on("close", () => {
    if (res.writableEnded) {
      return;
    }

    console.warn(`${REQUEST_LOG_PREFIX}[aborted]`, {
      duration_ms: Date.now() - startedAt,
      ip: req.ip,
      method: req.method,
      request_id: req.requestId,
      timestamp: new Date().toISOString(),
      url: req.originalUrl,
    });
  });

  next();
});

// Rate limiter (disabled in development)
if (runtime.isProduction) {
  const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 1000,
    message: {
      message: "Too many requests, please try again later.",
    },
  });

  app.use(apiLimiter);
}

/*
--------------------------------
ROUTES
--------------------------------
*/

const authRoutes = require("./routes/auth");
const authMiddleware = require("./middleware/authMiddleware");
const savedStoresRoutes = require("./routes/savedStores");
const storesRoutes = require("./routes/stores");
const productsRoutes = require("./routes/products");
const variantsRoutes = require("./routes/variants");
const searchRoutes = require("./routes/search");
const chatsRoutes = require("./routes/chats");
const adminRoutes = require("./routes/admin");
const paymentsRoutes = require("./routes/payments");
const notificationsRoutes = require("./routes/notifications");

app.use("/auth", authRoutes);
app.get("/me", authMiddleware, (req, res) =>
  authRoutes.handleCurrentUserRequest(req, res, "me"),
);
app.use("/saved-stores", savedStoresRoutes);
app.use("/stores", storesRoutes);
app.use("/products", productsRoutes);
app.use("/variants", variantsRoutes);
app.use("/search", searchRoutes);
app.use("/chats", chatsRoutes);
app.use("/admin", adminRoutes);
app.use("/payments", paymentsRoutes);
app.use("/notifications", notificationsRoutes);

/*
--------------------------------
HEALTH CHECK ROUTES
--------------------------------
*/

// Simple backend check
app.get("/", (req, res) => {
  res.send("Backend running");
});

app.get("/health", (req, res) => {
  res.status(200).json({
    pid: process.pid,
    readiness: isReady ? "ready" : "starting",
    status: shuttingDown ? "shutting_down" : "ok",
    timestamp: new Date().toISOString(),
    uptime_s: Number(process.uptime().toFixed(1)),
  });
});

app.get("/health/live", (req, res) => {
  res.status(200).json({
    pid: process.pid,
    status: "live",
    timestamp: new Date().toISOString(),
    uptime_s: Number(process.uptime().toFixed(1)),
  });
});

app.get("/health/ready", async (req, res) => {
  const payload = await buildHealthPayload();
  const statusCode =
    payload.status === "ok" && isReady && !shuttingDown ? 200 : 503;

  res.status(statusCode).json({
    ...payload,
    status: statusCode === 200 ? "ready" : "not_ready",
  });
});

// Database check
app.get("/db-test", async (req, res) => {
  if (runtime.isProduction) {
    return res.status(404).json({
      message: "Route not found",
    });
  }

  try {
    const result = await pool.query("SELECT NOW()");
    res.json({
      message: "Database connected",
      time: result.rows[0],
    });
  } catch (err) {
    console.error("DB test failed:", err);
    res.status(500).json({
      message: "Database connection failed",
      error: err?.message || String(err),
    });
  }
});

app.use((req, res) => {
  res.status(404).json({
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

/*
--------------------------------
GLOBAL ERROR HANDLER
--------------------------------
*/

app.use((err, req, res, next) => {
  console.error("Server error:", {
    error: formatErrorPayload(err),
    method: req.method,
    request_id: req.requestId,
    url: req.originalUrl,
  });

  if (err?.type === "entity.too.large") {
    return res.status(413).json({
      message:
        "The uploaded image is too large. Choose a smaller store image and try again.",
    });
  }

  res.status(500).json({
    message: "Internal server error",
  });
});

/*
--------------------------------
START SERVER
--------------------------------
*/

const PORT = Number(process.env.PORT) || appConfig.port;
const HOST = "0.0.0.0";

function validateRequiredEnv() {
  const missing = ["DATABASE_URL", "JWT_SECRET"].filter(
    (key) => !String(process.env[key] || "").trim(),
  );
  const invalid = [];

  if (runtime.isProduction && allowedConfiguredOrigins.size === 0) {
    missing.push("CORS_ALLOWED_ORIGINS");
  }

  if (runtime.isProduction) {
    if (
      envCors.allowedOrigins.some(
        (origin) => origin === "*" || origin.includes("*"),
      )
    ) {
      invalid.push(
        "CORS_ALLOWED_ORIGINS must not contain wildcard origins in production",
      );
    }

    if (envCors.allowedOrigins.some((origin) => !isValidHttpOrigin(origin))) {
      invalid.push(
        "CORS_ALLOWED_ORIGINS must contain only valid http/https origins in production",
      );
    }
  }

  if (
    payment.provider === "paystack" &&
    !String(process.env.PAYSTACK_SECRET_KEY || "").trim()
  ) {
    missing.push("PAYSTACK_SECRET_KEY");
  }

  if (
    payment.provider === "stripe" &&
    (!String(process.env.STRIPE_SECRET_KEY || "").trim() ||
      !String(process.env.STRIPE_PRICE_ID || "").trim())
  ) {
    missing.push("STRIPE_SECRET_KEY", "STRIPE_PRICE_ID");
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${Array.from(new Set(missing)).join(", ")}`,
    );
  }

  if (invalid.length > 0) {
    throw new Error(Array.from(new Set(invalid)).join("; "));
  }
}

async function isExistingBackendHealthy() {
  const http = require("http");
  const probeHost = HOST === "0.0.0.0" || HOST === "::" ? "127.0.0.1" : HOST;

  return await new Promise((resolve) => {
    const request = http.request(
      {
        host: probeHost,
        port: PORT,
        path: "/health/live",
        method: "GET",
        timeout: 1500,
        headers: {
          Connection: "close",
        },
      },
      (response) => {
        response.resume();
        resolve(response.statusCode === 200);
      },
    );

    request.once("timeout", () => {
      request.destroy();
      resolve(false);
    });

    request.once("error", () => {
      resolve(false);
    });

    request.end();
  });
}

async function retryAsync(label, task, options = {}) {
  const attempts = Number.isFinite(options.attempts) ? options.attempts : 3;
  const delayMs = Number.isFinite(options.delayMs) ? options.delayMs : 1500;
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      console.warn(`${SERVER_LOG_PREFIX}[startup-retry]`, {
        attempt,
        error: formatErrorPayload(error),
        label,
      });

      if (attempt >= attempts) {
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
    }
  }

  throw lastError;
}

async function startServer() {
  try {
    validateRequiredEnv();
    await retryAsync("ensureSchema", () => ensureSchema(), {
      attempts: 4,
      delayMs: 2000,
    });
    console.log("Database schema verified");

    await retryAsync("startupDbCheck", () => logDbStartupCheck(), {
      attempts: 4,
      delayMs: 1500,
    });

    server = app.listen(PORT, HOST);
    await new Promise((resolve, reject) => {
      server.once("listening", resolve);
      server.once("error", reject);
    });

    isReady = true;
    console.log(`Server running on http://${HOST}:${PORT}`);
    console.log("PID:", process.pid);
    console.log(`${SERVER_LOG_PREFIX}[cors-policy]`, {
      allowedOrigins: envCors.allowedOrigins,
      host: HOST,
      mode: runtime.isProduction ? "production" : "development",
      allowsLanOrigins: !runtime.isProduction,
      allowsLocalhostOrigins: !runtime.isProduction,
    });

    // Prevent process from exiting - keep event loop alive
    setImmediate(() => {
      // This prevents the process from exiting when stdin is closed
      process.stdin.resume();
    });
    server.on("error", async (error) => {
      if (error?.code === "EADDRINUSE") {
        const alreadyRunning = await isExistingBackendHealthy();

        if (alreadyRunning) {
          console.warn(`${SERVER_LOG_PREFIX}[already-running]`, {
            action: "exiting duplicate start",
            host: HOST,
            port: PORT,
            reason: "healthy backend already running on requested port",
          });
          process.exit(0);
        }
      }

      console.error("Server listen error:", error);
      process.exit(1);
    });
    server.headersTimeout = appConfig.headersTimeoutMs;
    server.keepAliveTimeout = appConfig.keepAliveTimeoutMs;
    server.maxRequestsPerSocket = appConfig.maxRequestsPerSocket;
    server.requestTimeout = appConfig.requestTimeoutMs;
  } catch (error) {
    if (error?.code === "EADDRINUSE") {
      const alreadyRunning = await isExistingBackendHealthy();

      if (alreadyRunning) {
        console.warn(`${SERVER_LOG_PREFIX}[already-running]`, {
          action: "exiting duplicate start",
          host: HOST,
          port: PORT,
          reason: "healthy backend already running on requested port",
        });
        process.exit(0);
      }
    }

    console.error("Server startup failed", {
      message: error?.message || String(error),
      code: error?.code,
      stack: error?.stack,
    });
    process.exit(1);
  }
}

startServer();
