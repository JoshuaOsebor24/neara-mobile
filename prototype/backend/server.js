// Load environment variables first
require("dotenv").config();

// Core packages
const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const { app: appConfig, cors: envCors, payment, runtime } = require("./config/env");

// DB pool from config
const pool = require("./config/db");
const ensureSchema = require("./config/ensureSchema");

// Initialize app
const app = express();
if (appConfig.trustedProxy) {
  app.set("trust proxy", 1);
}

const allowedDevOrigins = new Set([
  "http://localhost:3000",
  "http://localhost:3001",
]);
const allowedConfiguredOrigins = new Set(envCors.allowedOrigins);

function isAllowedLanOrigin(origin) {
  return /^http:\/\/(?:192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}):(3000|3001)$/.test(
    origin,
  );
}

const corsOptions = {
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  origin(origin, callback) {
    if (
      !origin ||
      allowedConfiguredOrigins.has(origin) ||
      (!runtime.isProduction && (allowedDevOrigins.has(origin) || isAllowedLanOrigin(origin)))
    ) {
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
  const timeoutMs = 3000;
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error("startup DB check timeout")), timeoutMs),
  );

  await Promise.race([pool.query("SELECT 1"), timeout]);
  console.log("PostgreSQL reachable via DATABASE_URL");
};

/*
--------------------------------
MIDDLEWARE
--------------------------------
*/

// Enable CORS for local frontend development origins and handle preflight.
app.use(cors(corsOptions));
app.use((req, res, next) => {
  if (req.method === "OPTIONS") {
    return cors(corsOptions)(req, res, next);
  }

  next();
});

// Parse request bodies
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));

// Request logger
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
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

app.use("/auth", authRoutes);
app.get("/me", authMiddleware, (req, res) =>
  authRoutes.handleCurrentUserRequest(req, res, "me")
);
app.use("/saved-stores", savedStoresRoutes);
app.use("/stores", storesRoutes);
app.use("/products", productsRoutes);
app.use("/variants", variantsRoutes);
app.use("/search", searchRoutes);
app.use("/chats", chatsRoutes);
app.use("/admin", adminRoutes);
app.use("/payments", paymentsRoutes);

/*
--------------------------------
HEALTH CHECK ROUTES
--------------------------------
*/

// Simple backend check
app.get("/", (req, res) => {
  res.send("Backend running");
});

app.get("/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({
      payment_provider: payment.provider,
      status: "ok",
    });
  } catch (_error) {
    res.status(500).json({
      message: "Health check failed",
      status: "error",
    });
  }
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
  console.error("Server error:", err);

  if (err?.type === "entity.too.large") {
    return res.status(413).json({
      message: "The uploaded image is too large. Choose a smaller store image and try again.",
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

const PORT = appConfig.port;
const HOST = appConfig.host;

function validateRequiredEnv() {
  const missing = ["DATABASE_URL", "JWT_SECRET"].filter(
    (key) => !String(process.env[key] || "").trim(),
  );

  if (runtime.isProduction && allowedConfiguredOrigins.size === 0) {
    missing.push("CORS_ALLOWED_ORIGINS");
  }

  if (payment.provider === "paystack" && !String(process.env.PAYSTACK_SECRET_KEY || "").trim()) {
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
}

async function startServer() {
  try {
    validateRequiredEnv();
    await ensureSchema();
    console.log("Database schema verified");

    await logDbStartupCheck();

    app.listen(PORT, HOST, () => {
      console.log(`Server running on http://${HOST}:${PORT}`);
    });
  } catch (error) {
    console.error("Server startup failed", {
      message: error?.message || String(error),
      code: error?.code,
      stack: error?.stack,
    });
    process.exit(1);
  }
}

startServer();
