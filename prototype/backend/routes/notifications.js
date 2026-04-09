const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const adminOnlyMiddleware = require("../middleware/adminOnlyMiddleware");
const pool = require("../config/db");
const {
  logRouteFailure,
  logRouteHit,
  logRouteSuccess,
  sendError,
  sendSuccess,
} = require("../utils/apiResponse");
const {
  registerPushTokenForUser,
  sendTestPushNotification,
} = require("../services/notifications");
const { sendProductUpdateReminders } = require("../services/reminder-jobs");

const router = express.Router();

router.post("/register-token", authMiddleware, async (req, res) => {
  const userId = Number(req.user?.id);
  const routeLabel = "notifications/register-token";
  let client;

  try {
    logRouteHit(req, routeLabel, {
      userId,
    });

    if (!Number.isInteger(userId) || userId <= 0) {
      return sendError(res, 401, "Not authenticated", {
        message: "Not authenticated",
      });
    }

    client = await pool.connect();
    const pushToken = await registerPushTokenForUser(client, {
      deviceId: req.body?.device_id,
      platform: req.body?.platform,
      token: req.body?.token,
      userId,
    });

    logRouteSuccess(req, routeLabel, 200, {
      platform: pushToken?.platform,
      pushTokenId: pushToken?.id,
      userId,
    });

    return sendSuccess(
      res,
      200,
      {
        message: "Push token registered successfully.",
        push_token: pushToken,
      },
      {
        message: "Push token registered successfully.",
      },
    );
  } catch (error) {
    logRouteFailure(req, routeLabel, 400, error, {
      userId,
    });
    return sendError(res, 400, error?.message || "Could not register push token.", {
      message: error?.message || "Could not register push token.",
    });
  } finally {
    client?.release();
  }
});

router.post("/test", authMiddleware, async (req, res) => {
  const userId = Number(req.user?.id);
  const routeLabel = "notifications/test";
  let client;

  try {
    logRouteHit(req, routeLabel, {
      userId,
    });

    if (!Number.isInteger(userId) || userId <= 0) {
      return sendError(res, 401, "Not authenticated", {
        message: "Not authenticated",
      });
    }

    client = await pool.connect();
    const delivery = await sendTestPushNotification(client, userId);

    logRouteSuccess(req, routeLabel, 200, {
      attemptedCount: delivery.attemptedCount,
      deliveredCount: delivery.deliveredCount,
      invalidatedCount: delivery.invalidatedCount,
      userId,
    });

    return sendSuccess(
      res,
      200,
      {
        attempted_count: delivery.attemptedCount,
        delivered_count: delivery.deliveredCount,
        invalidated_count: delivery.invalidatedCount,
        message:
          delivery.attemptedCount > 0
            ? "Test push notification sent."
            : "No active push tokens found for this user.",
      },
      {
        message:
          delivery.attemptedCount > 0
            ? "Test push notification sent."
            : "No active push tokens found for this user.",
      },
    );
  } catch (error) {
    logRouteFailure(req, routeLabel, 500, error, {
      userId,
    });
    return sendError(res, 500, "Could not send test push notification.", {
      message: "Could not send test push notification.",
    });
  } finally {
    client?.release();
  }
});

router.post(
  "/reminders/product-updates/run",
  authMiddleware,
  adminOnlyMiddleware,
  async (req, res) => {
    const routeLabel = "notifications/reminders/product-updates/run";

    try {
      logRouteHit(req, routeLabel, {
        adminUserId: req.adminUser?.id,
      });

      const result = await sendProductUpdateReminders({
        limit: req.body?.limit,
      });

      logRouteSuccess(req, routeLabel, 200, {
        adminUserId: req.adminUser?.id,
        candidatesEvaluated: result.candidatesEvaluated,
      });

      return sendSuccess(
        res,
        200,
        {
          candidates_evaluated: result.candidatesEvaluated,
          results: result.results,
        },
        {
          message: "Product update reminder job completed.",
        },
      );
    } catch (error) {
      logRouteFailure(req, routeLabel, 500, error, {
        adminUserId: req.adminUser?.id,
      });
      return sendError(res, 500, "Could not run product reminder job.", {
        message: "Could not run product reminder job.",
      });
    }
  },
);

module.exports = router;
