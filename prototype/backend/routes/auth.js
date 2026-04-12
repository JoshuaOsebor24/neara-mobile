// Authentication routes
// - `/signup` creates new users
// - `/login` authenticates and returns a JWT
// - `/me` returns the authenticated user's details
const express = require("express");
const bcrypt = require("bcrypt");
const rateLimit = require("express-rate-limit");
const authMiddleware = require("../middleware/authMiddleware");
const { getJwtSecretOrThrow, signUserToken } = require("../config/jwt");
const {
  logRouteFailure,
  logRouteHit,
  logRouteSuccess,
  sendError,
  sendSuccess,
} = require("../utils/apiResponse");
const { auth: AUTH_MESSAGES } = require("../config/messages.json");

const router = express.Router();
const pool = require("../config/db");
const STORE_HEADER_IMAGE_SLOT_COUNT = 4;
const ROLE_USER = "user";
const ROLE_PRO = "pro";
const ROLE_STORE_OWNER = "store_owner";
const ROLE_ORDER = Object.freeze([ROLE_USER, ROLE_PRO, ROLE_STORE_OWNER]);
const AUTH_BCRYPT_ROUNDS = 8;
const EXISTING_ACCOUNT_MESSAGE = AUTH_MESSAGES.signup.emailExists;
const authReadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many authentication requests, please try again later.",
  },
});
const authWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 25,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many signup or login attempts, please try again later.",
  },
});

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function hasMinPasswordLength(value, minimumLength = 6) {
  return String(value || "").length >= minimumLength;
}

function normalizeNullableText(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeHeaderImages(value, fallbackImageUrl = null) {
  const normalized = (Array.isArray(value) ? value : [])
    .slice(0, STORE_HEADER_IMAGE_SLOT_COUNT)
    .map((item) => normalizeNullableText(item));
  const compact = normalized.filter(Boolean);

  if (compact.length > 0) {
    return compact;
  }

  const fallback = normalizeNullableText(fallbackImageUrl);
  return fallback ? [fallback] : [];
}

function pickPrimaryStoreImage(headerImages, fallbackImageUrl = null) {
  const fromHeaders = Array.isArray(headerImages)
    ? headerImages.find((item) => normalizeNullableText(item))
    : null;

  return normalizeNullableText(fromHeaders) || normalizeNullableText(fallbackImageUrl);
}

function serializeHeaderImages(headerImages) {
  return JSON.stringify(normalizeHeaderImages(headerImages));
}

function normalizeUserRoles(rawRoles, extraRoles = []) {
  const values = [
    ...(Array.isArray(rawRoles) ? rawRoles : []),
    ...(Array.isArray(extraRoles) ? extraRoles : []),
  ];
  const seenRoles = new Set();

  for (const role of values) {
    if (typeof role !== "string") {
      continue;
    }

    const normalizedRole = role.trim().toLowerCase();

    if (!ROLE_ORDER.includes(normalizedRole)) {
      continue;
    }

    seenRoles.add(normalizedRole);
  }

  seenRoles.add(ROLE_USER);

  return ROLE_ORDER.filter((role) => seenRoles.has(role));
}

function rolesEqual(leftRoles, rightRoles) {
  const left = normalizeUserRoles(leftRoles);
  const right = normalizeUserRoles(rightRoles);

  if (left.length !== right.length) {
    return false;
  }

  return left.every((role, index) => role === right[index]);
}

function deriveUserRoles(user) {
  return normalizeUserRoles(user?.roles, [
    user?.premium_status ? ROLE_PRO : null,
    user?.has_store_owner_role || user?.primary_store_id ? ROLE_STORE_OWNER : null,
  ]);
}

function buildPublicUser(user) {
  const roles = deriveUserRoles(user);
  const isStoreOwner = roles.includes(ROLE_STORE_OWNER);
  const isPro = roles.includes(ROLE_PRO);

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone_number: user.phone_number ?? null,
    is_admin: Boolean(user.is_admin),
    premium: isPro,
    premium_status: isPro,
    messages_sent_count: Number(user.messages_sent_count ?? 0),
    roles,
    is_store_owner: isStoreOwner,
    primary_store_id: user.primary_store_id ?? null,
    created_at: user.created_at,
  };
}

function buildSignedUserToken(user) {
  return signUserToken(user);
}

async function findExistingOwnerStore(client, userId) {
  const { rows } = await client.query(
    `
      SELECT
        id,
        owner_id,
        store_name,
        category,
        phone_number,
        description,
        image_url,
        header_images,
        address,
        state,
        country,
        latitude,
        longitude,
        created_at
      FROM stores
      WHERE owner_id = $1
      ORDER BY created_at ASC, id ASC
      LIMIT 1
    `,
    [userId],
  );

  return rows[0] || null;
}

function getPublicUserSelectClause(alias = "u") {
  return `
    ${alias}.id,
    ${alias}.name,
    ${alias}.email,
    ${alias}.phone_number,
    ${alias}.is_admin,
    ${alias}.premium_status,
    (
      SELECT COUNT(*)::INT
      FROM messages sent_messages
      JOIN conversations sent_conversations
        ON sent_conversations.id = sent_messages.conversation_id
      WHERE sent_messages.sender_id = ${alias}.id
        AND sent_conversations.user_id = ${alias}.id
    ) AS messages_sent_count,
    ${alias}.roles,
    ${alias}.created_at,
    EXISTS (
      SELECT 1
      FROM stores owner_store
      WHERE owner_store.owner_id = ${alias}.id
    ) AS has_store_owner_role,
    (
      SELECT owner_store.id
      FROM stores owner_store
      WHERE owner_store.owner_id = ${alias}.id
      ORDER BY owner_store.created_at ASC, owner_store.id ASC
      LIMIT 1
    ) AS primary_store_id
  `;
}

async function fetchPublicUserById(client, userId) {
  const { rows } = await client.query(
    `
      SELECT ${getPublicUserSelectClause("u")}
      FROM users u
      WHERE u.id = $1
      LIMIT 1
    `,
    [userId],
  );

  return rows[0] || null;
}

async function syncUserRoles(client, userId, extraRoles = []) {
  const currentUser = await fetchPublicUserById(client, userId);

  if (!currentUser) {
    return null;
  }

  const nextRoles = normalizeUserRoles(deriveUserRoles(currentUser), extraRoles);

  if (!rolesEqual(currentUser.roles, nextRoles)) {
    await client.query(
      `
        UPDATE users
        SET roles = $2
        WHERE id = $1
      `,
      [userId, nextRoles],
    );
  }

  return {
    ...currentUser,
    roles: nextRoles,
  };
}

async function ensureUserRoles(client, user, extraRoles = []) {
  if (!user) {
    return null;
  }

  const nextRoles = normalizeUserRoles(deriveUserRoles(user), extraRoles);

  if (!rolesEqual(user.roles, nextRoles)) {
    await client.query(
      `
        UPDATE users
        SET roles = $2
        WHERE id = $1
      `,
      [user.id, nextRoles],
    );
  }

  return {
    ...user,
    roles: nextRoles,
  };
}

function buildOwnerRegistrationLogBody(body) {
  const imageUrl = String(body?.store?.image_url || "");
  const headerImages = Array.isArray(body?.store?.header_images)
    ? body.store.header_images.map((item) =>
        item ? `[redacted:${String(item).length} chars]` : null
      )
    : body?.store?.header_images;

  return {
    owner: {
      ...(body?.owner || {}),
      email: normalizeEmail(body?.owner?.email),
      password: body?.owner?.password
        ? `[redacted:${String(body.owner.password).length} chars]`
        : "",
    },
    store: {
      ...(body?.store || {}),
      image_url: imageUrl ? `[redacted:${imageUrl.length} chars]` : "",
      header_images: headerImages,
    },
  };
}

function buildErrorLog(error) {
  return {
    message: error?.message || String(error),
    stack: error?.stack,
    code: error?.code,
    detail: error?.detail,
    constraint: error?.constraint,
    table: error?.table,
    column: error?.column,
  };
}

function logAuthFlowStep(routeLabel, step, details = {}) {
  console.log(`[${routeLabel}] ${step}`, details);
}

function logAuthFlowError(routeLabel, step, error, details = {}) {
  console.error(`[${routeLabel}] ${step}`, {
    ...details,
    ...buildErrorLog(error),
  });
}

function isTimeoutLikeError(error) {
  const message = String(error?.message || "").toLowerCase();
  return (
    error?.code === "57014" ||
    error?.code === "ETIMEDOUT" ||
    message.includes("timeout") ||
    message.includes("timed out")
  );
}

function isDatabaseQuotaError(error) {
  const message = String(error?.message || "").toLowerCase();
  return (
    message.includes("data transfer quota") ||
    message.includes("exceeded the data transfer quota") ||
    message.includes("quota. upgrade your plan")
  );
}

function detectAuthErrorSource(error) {
  if (isDatabaseQuotaError(error)) {
    return "database-quota";
  }

  if (isTimeoutLikeError(error)) {
    return "database-timeout";
  }

  return "unknown";
}

function getAuthFailureStatusCode(error) {
  if (isDatabaseQuotaError(error) || isTimeoutLikeError(error)) {
    return 503;
  }

  if (error?.code === "23505") {
    return 409;
  }

  return 500;
}

function buildSignupFailureMessage(currentStep, error, fallback) {
  if (isDatabaseQuotaError(error)) {
    return AUTH_MESSAGES.signup.failed;
  }

  if (isTimeoutLikeError(error)) {
    return AUTH_MESSAGES.signup.failed;
  }

  if (error?.code === "23505") {
    if (error?.constraint === "stores_owner_unique_idx") {
      return EXISTING_ACCOUNT_MESSAGE;
    }

    if (error?.constraint === "users_email_lower_unique_idx") {
      return EXISTING_ACCOUNT_MESSAGE;
    }
  }

  return fallback || AUTH_MESSAGES.signup.failed;
}

async function handleCurrentUserRequest(req, res, routeLabel = "auth/me") {
  let client;
  console.log("ME ROUTE HIT");

  const userId = Number(req.user?.id);
  logRouteHit(req, routeLabel, {
    hasAuthUser: Boolean(req.user),
    userId: Number.isInteger(userId) ? userId : null,
  });

  if (!Number.isInteger(userId)) {
    logRouteFailure(req, routeLabel, 401, "Not authenticated", {
      hasAuthUser: Boolean(req.user),
    });
    return sendError(res, 401, "Not authenticated", {
      message: "Not authenticated",
    });
  }

  try {
    client = await pool.connect();
    const user = await syncUserRoles(client, userId);

    if (!user) {
      logRouteFailure(req, routeLabel, 404, "User not found", {
        userId,
      });
      return sendError(res, 404, "User not found", {
        message: "User not found",
      });
    }

    const publicUser = buildPublicUser(user);
    logRouteSuccess(req, routeLabel, 200, {
      userId,
    });
    return sendSuccess(res, 200, {
      user: publicUser,
    }, {
      message: "Current user loaded",
    });
  } catch (error) {
    logRouteFailure(req, routeLabel, 500, error, {
      userId,
    });
    return sendError(res, 500, "Something went wrong. Please try again later.", {
      message: "Something went wrong. Please try again later.",
    });
  } finally {
    client?.release();
  }
}

function getConfiguredAdminEmails() {
  return Array.from(
    new Set(
      String(process.env.ADMIN_EMAILS || "")
        .split(",")
        .map((item) => normalizeEmail(item))
        .filter(Boolean),
    ),
  );
}

function shouldGrantAdminForEmail(email) {
  const normalizedEmail = normalizeEmail(email);
  return Boolean(normalizedEmail) && getConfiguredAdminEmails().includes(normalizedEmail);
}

async function grantAdminForConfiguredEmail(client, user) {
  if (!user || !shouldGrantAdminForEmail(user.email) || user.is_admin) {
    return user;
  }

  await client.query(
    `
      UPDATE users
      SET is_admin = TRUE
      WHERE id = $1
    `,
    [user.id],
  );

  const refreshedUser = await fetchPublicUserById(client, user.id);
  return refreshedUser || { ...user, is_admin: true };
}

// Signup: validate input, ensure uniqueness, hash password, save user
router.post("/signup", authWriteLimiter, async (req, res) => {
  const routeLabel = "auth/signup";
  const completedSteps = [];
  let currentStep = "signup start";
  let client;
  const startedAt = Date.now();
  try {
    const { name, email, password, phone_number } = req.body;
    const normalizedEmail = normalizeEmail(email);
    logRouteHit(req, routeLabel, {
      email: normalizedEmail,
      hasName: Boolean(name),
    });
    const markStep = (step, details = {}) => {
      currentStep = step;
      completedSteps.push(step);
      logAuthFlowStep(routeLabel, step, details);
    };

    markStep("signup start", {
      email: normalizedEmail,
      hasName: Boolean(name),
    });

    if (!name || !normalizedEmail || !password) {
      logAuthFlowStep(routeLabel, "validation failed", {
        email: normalizedEmail,
      });
      logRouteFailure(req, routeLabel, 400, "All fields are required", {
        email: normalizedEmail,
      });
      return sendError(res, 400, AUTH_MESSAGES.signup.failed, {
        message: AUTH_MESSAGES.signup.failed,
      });
    }

    if (!isValidEmail(normalizedEmail)) {
      logRouteFailure(req, routeLabel, 400, "Email is invalid", {
        email: normalizedEmail,
      });
      return sendError(res, 400, AUTH_MESSAGES.signup.failed, {
        message: AUTH_MESSAGES.signup.failed,
      });
    }

    if (!hasMinPasswordLength(password)) {
      logRouteFailure(req, routeLabel, 400, "Password must be at least 6 characters", {
        email: normalizedEmail,
      });
      return sendError(res, 400, AUTH_MESSAGES.signup.failed, {
        message: AUTH_MESSAGES.signup.failed,
      });
    }

    markStep("validation passed", {
      email: normalizedEmail,
    });

    client = await pool.connect();
    markStep("database connection acquired", {
      email: normalizedEmail,
    });

    markStep("checking existing user", {
      email: normalizedEmail,
    });
    const existingUser = await client.query(
      `
        SELECT
          u.*,
          EXISTS (
            SELECT 1
            FROM stores owner_store
            WHERE owner_store.owner_id = u.id
          ) AS has_store_owner_role,
          (
            SELECT owner_store.id
            FROM stores owner_store
            WHERE owner_store.owner_id = u.id
            ORDER BY owner_store.created_at ASC, owner_store.id ASC
            LIMIT 1
          ) AS primary_store_id
        FROM users u
        WHERE LOWER(u.email) = $1
        ORDER BY u.id ASC
        LIMIT 1
      `,
      [normalizedEmail],
    );

    if (existingUser.rows.length > 0) {
      const existingAccount =
        (await syncUserRoles(client, existingUser.rows[0].id)) || existingUser.rows[0];

      logAuthFlowStep(routeLabel, "signup failed", {
        email: normalizedEmail,
        reason: "account already has user role",
        userId: existingAccount.id,
      });
      logRouteFailure(req, routeLabel, 409, EXISTING_ACCOUNT_MESSAGE, {
        email: normalizedEmail,
        userId: existingAccount.id,
      });
      return sendError(res, 409, EXISTING_ACCOUNT_MESSAGE, {
        message: EXISTING_ACCOUNT_MESSAGE,
        meta: {
          completedSteps,
          duplicateRole: true,
          existingAccount: true,
        },
        user: buildPublicUser(existingAccount),
      });
    }

    markStep("creating auth account", {
      email: normalizedEmail,
    });
    const hashedPassword = await bcrypt.hash(password, AUTH_BCRYPT_ROUNDS);
    markStep("password hashed", {
      email: normalizedEmail,
    });

    markStep("inserting user", {
      email: normalizedEmail,
    });
    const newUser = await client.query(
      `INSERT INTO users (name, email, password_hash, phone_number, is_admin, roles)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, email, phone_number, is_admin, premium_status, roles, created_at`,
      [
        name,
        normalizedEmail,
        hashedPassword,
        phone_number || null,
        shouldGrantAdminForEmail(normalizedEmail),
        [ROLE_USER],
      ]
    );

    markStep("auth account created", {
      userId: newUser.rows[0]?.id,
    });
    markStep("creating user profile", {
      userId: newUser.rows[0]?.id,
    });
    markStep("user profile created", {
      userId: newUser.rows[0]?.id,
    });
    markStep("assigning role", {
      role: ROLE_USER,
    });
    let createdUser = {
      ...newUser.rows[0],
      has_store_owner_role: false,
      primary_store_id: null,
    };
    createdUser = await grantAdminForConfiguredEmail(client, createdUser);
    createdUser = await ensureUserRoles(client, createdUser, [ROLE_USER]);
    markStep("role assigned", {
      role: buildPublicUser(createdUser).roles.join(","),
      userId: createdUser?.id,
    });

    const publicUser = buildPublicUser(createdUser);
    const token = buildSignedUserToken(createdUser);
    logAuthFlowStep(routeLabel, "signup completed", {
      durationMs: Date.now() - startedAt,
      userId: createdUser?.id,
    });

    logRouteSuccess(req, routeLabel, 201, {
      duration_ms: Date.now() - startedAt,
      userId: createdUser?.id,
    });
    return sendSuccess(res, 201, {
      token,
      user: publicUser,
    }, {
      message: AUTH_MESSAGES.signup.success,
      meta: {
        completedSteps,
        duration_ms: Date.now() - startedAt,
      },
      token,
      user: publicUser,
    });
  } catch (error) {
    const errorSource = detectAuthErrorSource(error);
    logAuthFlowError(routeLabel, "signup failed", error, {
      currentStep,
      errorSource,
    });

    if (
      error?.code === "23505" &&
      error?.constraint === "users_email_lower_unique_idx"
    ) {
      logRouteFailure(req, routeLabel, 409, EXISTING_ACCOUNT_MESSAGE, {
        currentStep,
        email: normalizeEmail(req.body?.email),
      });
      return sendError(res, 409, EXISTING_ACCOUNT_MESSAGE, {
        message: EXISTING_ACCOUNT_MESSAGE,
        meta: {
          completedSteps,
          duplicateRole: true,
          existingAccount: true,
        },
      });
    }

    const statusCode = getAuthFailureStatusCode(error);
    logRouteFailure(req, routeLabel, statusCode, error, {
      currentStep,
      errorSource,
    });
    return sendError(
      res,
      statusCode,
      buildSignupFailureMessage(
        currentStep,
        error,
        AUTH_MESSAGES.signup.failed,
      ),
      {
      message: buildSignupFailureMessage(
        currentStep,
        error,
        AUTH_MESSAGES.signup.failed,
      ),
      meta: {
        completedSteps,
        duration_ms: Date.now() - startedAt,
        error_source: errorSource,
      },
    });
  } finally {
    client?.release();
  }
});

// Login: validate credentials, compare hashed password, return JWT
router.post("/login", authWriteLimiter, async (req, res) => {
  let client;
  const startedAt = Date.now();
  let currentStep = "login request started";
  try {
    const { email, password } = req.body;
    const normalizedEmail = normalizeEmail(email);
    logRouteHit(req, "auth/login", {
      email: normalizedEmail,
    });

    logAuthFlowStep("auth/login", "login request started", {
      email: normalizedEmail,
    });

    if (!normalizedEmail || !password) {
      currentStep = "validation failed";
      logRouteFailure(req, "auth/login", 400, "Email and password are required", {
        email: normalizedEmail,
      });
      return sendError(res, 400, AUTH_MESSAGES.login.invalidCredentials, {
        message: AUTH_MESSAGES.login.invalidCredentials,
      });
    }

    if (!isValidEmail(normalizedEmail)) {
      currentStep = "validation failed";
      logRouteFailure(req, "auth/login", 400, "Email is invalid", {
        email: normalizedEmail,
      });
      return sendError(res, 400, AUTH_MESSAGES.login.invalidCredentials, {
        message: AUTH_MESSAGES.login.invalidCredentials,
      });
    }

    if (!hasMinPasswordLength(password)) {
      currentStep = "validation failed";
      logRouteFailure(req, "auth/login", 400, "Password must be at least 6 characters", {
        email: normalizedEmail,
      });
      return sendError(res, 400, AUTH_MESSAGES.login.invalidCredentials, {
        message: AUTH_MESSAGES.login.invalidCredentials,
      });
    }

    currentStep = "database connection";
    client = await pool.connect();
    logAuthFlowStep("auth/login", "database connection acquired", {
      email: normalizedEmail,
    });

    currentStep = "user lookup";
    logAuthFlowStep("auth/login", "user lookup started", {
      email: normalizedEmail,
    });
    const userResult = await client.query(
      `
        SELECT
          u.*,
          EXISTS (
            SELECT 1
            FROM stores owner_store
            WHERE owner_store.owner_id = u.id
          ) AS has_store_owner_role,
          (
            SELECT owner_store.id
            FROM stores owner_store
            WHERE owner_store.owner_id = u.id
            ORDER BY owner_store.created_at ASC, owner_store.id ASC
            LIMIT 1
          ) AS primary_store_id
        FROM users u
        WHERE LOWER(u.email) = $1
        LIMIT 1
      `,
      [normalizedEmail],
    );

    if (userResult.rows.length === 0) {
      logAuthFlowStep("auth/login", "user lookup finished", {
        email: normalizedEmail,
        foundUser: false,
      });
      logRouteFailure(req, "auth/login", 400, "Invalid email or password", {
        email: normalizedEmail,
      });
      return sendError(res, 400, AUTH_MESSAGES.login.invalidCredentials, {
        message: AUTH_MESSAGES.login.invalidCredentials,
      });
    }

    const matchedUser = userResult.rows[0];
    logAuthFlowStep("auth/login", "user lookup finished", {
      email: normalizedEmail,
      foundUser: true,
      userId: matchedUser.id,
    });

    currentStep = "password compare";
    const isMatch = await bcrypt.compare(password, matchedUser.password_hash);
    logAuthFlowStep("auth/login", "password compare finished", {
      email: normalizedEmail,
      userId: matchedUser.id,
      isMatch,
    });

    if (!isMatch) {
      logRouteFailure(req, "auth/login", 400, "Invalid email or password", {
        email: normalizedEmail,
        userId: matchedUser.id,
      });
      return sendError(res, 400, AUTH_MESSAGES.login.invalidCredentials, {
        message: AUTH_MESSAGES.login.invalidCredentials,
      });
    }

    currentStep = "role sync";
    let user = await grantAdminForConfiguredEmail(client, matchedUser);
    user = await ensureUserRoles(client, user);

    // Create a signed JWT containing minimal user info
    const token = buildSignedUserToken(user);
    logAuthFlowStep("auth/login", "login completed", {
      durationMs: Date.now() - startedAt,
      userId: user.id,
    });

    logRouteSuccess(req, "auth/login", 200, {
      duration_ms: Date.now() - startedAt,
      userId: user.id,
    });
    return sendSuccess(res, 200, {
      token,
      user: buildPublicUser(user),
    }, {
      message: AUTH_MESSAGES.login.success,
      meta: {
        duration_ms: Date.now() - startedAt,
      },
      token,
      user: buildPublicUser(user),
    });
  } catch (error) {
    const errorSource = detectAuthErrorSource(error);
    logAuthFlowError("auth/login", "login failed", error, {
      durationMs: Date.now() - startedAt,
      errorSource,
      currentStep,
    });
    const statusCode = getAuthFailureStatusCode(error);
    logRouteFailure(req, "auth/login", statusCode, error, {
      currentStep,
      errorSource,
    });
    return sendError(res, statusCode, AUTH_MESSAGES.login.failed, {
      message: AUTH_MESSAGES.login.failed,
      meta: {
        duration_ms: Date.now() - startedAt,
        error_source: errorSource,
        current_step: currentStep,
      },
    });
  } finally {
    client?.release();
  }
});

router.patch("/roles/pro", authMiddleware, async (req, res) => {
  try {
    const userId = Number(req.user?.id);

    if (!Number.isInteger(userId)) {
      return res.status(401).json({
        message: "Invalid user session",
      });
    }

    const userResult = await pool.query(
      `
        SELECT ${getPublicUserSelectClause("u")}
        FROM users u
        WHERE u.id = $1
        LIMIT 1
      `,
      [userId],
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const currentUser = await grantAdminForConfiguredEmail(pool, userResult.rows[0]);
    const currentRoles = deriveUserRoles(currentUser);

    if (currentRoles.includes(ROLE_PRO)) {
      return res.status(409).json({
        message: "You already registered as a Pro user.",
        user: buildPublicUser(currentUser),
      });
    }

    await pool.query(
      `
        UPDATE users
        SET premium_status = TRUE
        WHERE id = $1
      `,
      [userId],
    );
    const updatedUser = await syncUserRoles(pool, userId, [ROLE_PRO]);

    return res.json({
      message: "Pro access activated.",
      user: buildPublicUser(updatedUser),
    });
  } catch (error) {
    console.error("auth/roles/pro failed", buildErrorLog(error));
    return res.status(500).json({
      message: "Could not activate Pro access",
    });
  }
});

router.post("/register-owner", authWriteLimiter, async (req, res) => {
  let client;
  let transactionOpen = false;
  const routeLabel = "auth/register-owner";
  const completedSteps = [];
  let currentStep = "signup start";

  const markStep = (step, details = {}) => {
    currentStep = step;
    completedSteps.push(step);
    logAuthFlowStep(routeLabel, step, details);
  };
  try {
    markStep("signup start", {
      method: req.method,
      url: req.originalUrl,
      body: buildOwnerRegistrationLogBody(req.body),
    });

    const { owner, store } = req.body || {};

    const ownerName = String(owner?.full_name || owner?.name || "").trim();
    const ownerEmail = normalizeEmail(owner?.email);
    const ownerPassword = String(owner?.password || "");
    const ownerPhone = String(owner?.phone_number || "").trim();

    const storeName = String(store?.store_name || "").trim();
    const category = String(store?.category || "").trim();
    const storePhone = String(store?.phone_number || "").trim();
    const description = String(store?.description || "").trim();
    const imageUrl = String(store?.image_url || "").trim();
    const headerImages = normalizeHeaderImages(store?.header_images, imageUrl);
    const primaryStoreImage = pickPrimaryStoreImage(headerImages, imageUrl);
    const address = String(store?.address || "").trim();
    const state = String(store?.state || store?.state_region || "").trim();
    const country = String(store?.country || "").trim();
    const hasLatitude =
      store?.latitude !== undefined &&
      store?.latitude !== null &&
      String(store.latitude).trim() !== "";
    const hasLongitude =
      store?.longitude !== undefined &&
      store?.longitude !== null &&
      String(store.longitude).trim() !== "";
    const latitude = hasLatitude ? Number(store?.latitude) : null;
    const longitude = hasLongitude ? Number(store?.longitude) : null;
    const jwtSecret = getJwtSecretOrThrow();
    const validationResult = {
      ownerName: Boolean(ownerName),
      ownerEmail: Boolean(ownerEmail),
      ownerPassword: Boolean(ownerPassword),
      ownerPhone: Boolean(ownerPhone),
      storeName: Boolean(storeName),
      category: Boolean(category),
      storePhone: Boolean(storePhone),
      description: Boolean(description),
      address: Boolean(address),
      latitudeIsFinite: latitude === null ? null : Number.isFinite(latitude),
      longitudeIsFinite: longitude === null ? null : Number.isFinite(longitude),
      passwordLength: ownerPassword.length,
    };

    logAuthFlowStep(routeLabel, "normalized signup payload", {
      ownerName,
      ownerEmail,
      ownerPhone,
      storeName,
      category,
      storePhone,
      address,
      state,
      country,
      latitude,
      longitude,
      latitudeType: typeof store?.latitude,
      longitudeType: typeof store?.longitude,
      ownerId: null,
    });
    logAuthFlowStep(routeLabel, "validation result", validationResult);

    if (
      !ownerName ||
      !ownerEmail ||
      !ownerPassword ||
      !ownerPhone ||
      !storeName ||
      !category ||
      !storePhone ||
      !address
    ) {
      logAuthFlowStep(routeLabel, "validation failed", validationResult);
      return res.status(400).json({
        success: false,
        error: AUTH_MESSAGES.signup.failed,
        message: AUTH_MESSAGES.signup.failed,
      });
    }

    if (hasLatitude !== hasLongitude) {
      logAuthFlowStep(routeLabel, "validation failed", {
        ...validationResult,
        reason: "partial coordinates",
      });
      return res.status(400).json({
        success: false,
        error: AUTH_MESSAGES.signup.failed,
        message: AUTH_MESSAGES.signup.failed,
      });
    }

    if (
      (latitude !== null && !Number.isFinite(latitude)) ||
      (longitude !== null && !Number.isFinite(longitude))
    ) {
      logAuthFlowStep(routeLabel, "validation failed", {
        ...validationResult,
        reason: "invalid coordinates",
      });
      return res.status(400).json({
        success: false,
        error: AUTH_MESSAGES.signup.failed,
        message: AUTH_MESSAGES.signup.failed,
      });
    }

    if (!isValidEmail(ownerEmail)) {
      logAuthFlowStep(routeLabel, "validation failed", {
        ...validationResult,
        reason: "invalid email",
      });
      return res.status(400).json({
        success: false,
        error: AUTH_MESSAGES.signup.failed,
        message: AUTH_MESSAGES.signup.failed,
      });
    }

    if (ownerPassword.length < 6) {
      logAuthFlowStep(routeLabel, "validation failed", {
        ...validationResult,
        reason: "password too short",
      });
      return res.status(400).json({
        success: false,
        error: AUTH_MESSAGES.signup.failed,
        message: AUTH_MESSAGES.signup.failed,
      });
    }

    markStep("validation passed", {
      ownerEmail,
    });

    client = await pool.connect();
    logAuthFlowStep(routeLabel, "database client acquired");

    await client.query("BEGIN");
    transactionOpen = true;
    logAuthFlowStep(routeLabel, "transaction started");

    logAuthFlowStep(routeLabel, "existing user lookup", {
      ownerEmail,
    });
    const existingUser = await client.query(
      `SELECT
         u.password_hash,
         ${getPublicUserSelectClause("u")}
       FROM users u
       WHERE LOWER(email) = $1
       ORDER BY u.id ASC
       LIMIT 1`,
      [ownerEmail]
    );
    logAuthFlowStep(routeLabel, "existing user lookup result", {
      rowCount: existingUser.rows.length,
    });

    let user;
    let usedExistingUser = false;

    markStep("creating auth account", {
      ownerEmail,
      usingExistingAccount: existingUser.rows.length > 0,
    });

    if (existingUser.rows.length > 0) {
      const matchedUser = existingUser.rows[0];
      const passwordMatches = await bcrypt.compare(
        ownerPassword,
        matchedUser.password_hash
      );

      if (!passwordMatches) {
        await client.query("ROLLBACK");
        transactionOpen = false;
        logAuthFlowStep(routeLabel, "signup failed", {
          ownerEmail,
          reason: "duplicate email with password mismatch",
          userId: matchedUser.id,
        });
        return res.status(409).json({
          message: EXISTING_ACCOUNT_MESSAGE,
        });
      }

      const existingOwnerStore = await findExistingOwnerStore(client, matchedUser.id);

      if (existingOwnerStore) {
        const existingOwnerUser =
          (await syncUserRoles(client, matchedUser.id, [ROLE_STORE_OWNER])) || matchedUser;
        await client.query("ROLLBACK");
        transactionOpen = false;
        logAuthFlowStep(routeLabel, "signup failed", {
          ownerEmail,
          reason: "account already has store owner access",
          storeId: existingOwnerStore.id,
          userId: matchedUser.id,
        });
        return res.status(409).json({
          message: EXISTING_ACCOUNT_MESSAGE,
          meta: {
            completedSteps,
            existingStore: true,
            usedExistingUser: true,
          },
          token: buildSignedUserToken(existingOwnerUser, jwtSecret),
          user: buildPublicUser(existingOwnerUser),
          store: existingOwnerStore,
        });
      }

      await client.query(
        `UPDATE users
         SET name = $1,
             phone_number = $2
         WHERE id = $3`,
        [ownerName, ownerPhone || null, matchedUser.id]
      );

      markStep("auth account created", {
        userId: matchedUser.id,
        reusedExistingUser: true,
      });
      markStep("creating user profile", {
        userId: matchedUser.id,
      });
      user = await fetchPublicUserById(client, matchedUser.id);
      markStep("user profile created", {
        userId: user.id,
      });
      markStep("assigning role", {
        role: ROLE_STORE_OWNER,
        userId: user.id,
      });
      user = await grantAdminForConfiguredEmail(client, user);
      markStep("role assigned", {
        role: deriveUserRoles(user).includes(ROLE_PRO)
          ? "user,pro,store_owner"
          : "user,store_owner",
        userId: user.id,
      });
      usedExistingUser = true;
      logAuthFlowStep(routeLabel, "reusing existing user", {
        userId: user.id,
        email: user.email,
      });
    } else {
      logAuthFlowStep(routeLabel, "hashing password", {
        ownerEmail,
        passwordLength: ownerPassword.length,
      });
      const hashedPassword = await bcrypt.hash(ownerPassword, AUTH_BCRYPT_ROUNDS);

      logAuthFlowStep(routeLabel, "user insert inputs", {
        name: ownerName,
        email: ownerEmail,
        phone_number: ownerPhone || null,
      });
      const userResult = await client.query(
        `INSERT INTO users (name, email, password_hash, phone_number, is_admin, roles)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [
          ownerName,
          ownerEmail,
          hashedPassword,
          ownerPhone,
          shouldGrantAdminForEmail(ownerEmail),
          [ROLE_USER],
        ]
      );

      user = await fetchPublicUserById(client, userResult.rows[0].id);
      markStep("auth account created", {
        userId: user.id,
        reusedExistingUser: false,
      });
      markStep("creating user profile", {
        userId: user.id,
      });
      markStep("user profile created", {
        userId: user.id,
      });
      markStep("assigning role", {
        role: ROLE_STORE_OWNER,
        userId: user.id,
      });
      user = await grantAdminForConfiguredEmail(client, user);
      markStep("role assigned", {
        role: "user,store_owner",
        userId: user.id,
      });
    }

    logAuthFlowStep(routeLabel, "owner user ready", {
      userId: user.id,
      email: user.email,
      reused: usedExistingUser,
    });

    markStep("saving store data", {
      ownerId: user.id,
      storeName,
    });
    logAuthFlowStep(routeLabel, "store insert inputs", {
      owner_id: user.id,
      store_name: storeName,
      category,
      phone_number: storePhone,
        description: description || null,
        image_url: primaryStoreImage,
      header_images: headerImages.map((item) =>
        item ? `[redacted:${String(item).length} chars]` : null
      ),
      address,
      state: state || null,
      country: country || null,
      latitude,
      longitude,
    });
    const storeResult = await client.query(
      `INSERT INTO stores
        (owner_id, store_name, category, phone_number, description, image_url, header_images, address, state, country, latitude, longitude)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id, owner_id, store_name, category, phone_number, description, image_url, header_images, address, state, country, latitude, longitude, created_at`,
      [
        user.id,
        storeName,
        category,
        storePhone,
        description || null,
        primaryStoreImage,
        serializeHeaderImages(headerImages),
        address,
        state || null,
        country || null,
        latitude,
        longitude,
      ]
    );
    markStep("store data saved", {
      storeId: storeResult.rows[0]?.id,
      ownerId: user.id,
    });
    user = await syncUserRoles(client, user.id, [ROLE_STORE_OWNER]);

    await client.query("COMMIT");
    transactionOpen = false;
    logAuthFlowStep(routeLabel, "transaction committed", {
      userId: user.id,
      storeId: storeResult.rows[0]?.id,
    });

    const token = buildSignedUserToken(user, jwtSecret);

    return res.status(201).json({
      message: AUTH_MESSAGES.signup.success,
      meta: {
        completedSteps,
        usedExistingUser,
      },
      token,
      user: buildPublicUser(user),
      store: storeResult.rows[0],
    });
  } catch (error) {
    if (client && transactionOpen) {
      try {
        await client.query("ROLLBACK");
        logAuthFlowStep(routeLabel, "transaction rolled back");
      } catch (rollbackError) {
        logAuthFlowError(routeLabel, "rollback failed", rollbackError);
      }
    }

    logAuthFlowError(routeLabel, "signup failed", error, {
      currentStep,
    });
    const statusCode = error?.code === "23505" ? 409 : 500;
    return res.status(statusCode).json({
      message: buildSignupFailureMessage(
        currentStep,
        error,
        AUTH_MESSAGES.signup.failed,
      ),
    });
  } finally {
    if (client) {
      client.release();
    }
  }
});

// Protected endpoint: return authenticated user's public profile
router.get("/me", authReadLimiter, authMiddleware, async (req, res) => {
  return handleCurrentUserRequest(req, res, "auth/me");
});

router.patch("/me", authMiddleware, async (req, res) => {
  let client;

  try {
    const userId = Number(req.user?.id);

    if (!Number.isInteger(userId)) {
      return sendError(res, 401, "Not authenticated", {
        message: "Not authenticated",
      });
    }

    const nextName = String(req.body?.name || "").trim();
    const nextEmail = normalizeEmail(req.body?.email);
    const nextPhone = normalizeNullableText(req.body?.phone_number);
    const nextPassword = String(req.body?.password || "");

    if (!nextName) {
      return sendError(res, 400, "Name is required", {
        message: "Name is required",
      });
    }

    if (!nextEmail || !isValidEmail(nextEmail)) {
      return sendError(res, 400, "Enter a valid email address", {
        message: "Enter a valid email address",
      });
    }

    if (nextPassword && !hasMinPasswordLength(nextPassword)) {
      return sendError(res, 400, "Password must be at least 6 characters", {
        message: "Password must be at least 6 characters",
      });
    }

    client = await pool.connect();

    const currentUserResult = await client.query(
      `
        SELECT id, email
        FROM users
        WHERE id = $1
        LIMIT 1
      `,
      [userId],
    );

    if (currentUserResult.rows.length === 0) {
      return sendError(res, 404, "User not found", {
        message: "User not found",
      });
    }

    const duplicateUserResult = await client.query(
      `
        SELECT id
        FROM users
        WHERE LOWER(email) = $1 AND id <> $2
        LIMIT 1
      `,
      [nextEmail, userId],
    );

    if (duplicateUserResult.rows.length > 0) {
      return sendError(res, 409, EXISTING_ACCOUNT_MESSAGE, {
        message: EXISTING_ACCOUNT_MESSAGE,
      });
    }

    const passwordHash = nextPassword
      ? await bcrypt.hash(nextPassword, AUTH_BCRYPT_ROUNDS)
      : null;

    await client.query(
      `
        UPDATE users
        SET name = $2,
            email = $3,
            phone_number = $4,
            password_hash = COALESCE($5, password_hash)
        WHERE id = $1
      `,
      [userId, nextName, nextEmail, nextPhone, passwordHash],
    );

    const updatedUser = await syncUserRoles(client, userId);

    return sendSuccess(
      res,
      200,
      {
        user: buildPublicUser(updatedUser),
      },
      {
        message: "Account updated successfully.",
      },
    );
  } catch (error) {
    console.error("auth/me patch failed", buildErrorLog(error));
    return sendError(res, 500, "Something went wrong. Please try again later.", {
      message: "Something went wrong. Please try again later.",
    });
  } finally {
    client?.release();
  }
});


module.exports = router;
module.exports.handleCurrentUserRequest = handleCurrentUserRequest;
