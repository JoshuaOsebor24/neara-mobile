// Saved stores routes
// - Save a store for a user, list saved stores, and remove saved stores
const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const {
  logRouteFailure,
  logRouteHit,
  logRouteSuccess,
  sendError,
  sendSuccess,
} = require("../utils/apiResponse");

const router = express.Router();

const pool = require("../config/db");

// Save a store for the authenticated user
// - Prevents duplicates via DB unique constraint (handled by error code 23505)
router.post("/", authMiddleware, async (req, res) => {
  const routeLabel = "saved/save";
  try {
    const userId = req.user.id;
    const { store_id } = req.body;
    logRouteHit(req, routeLabel, {
      store_id,
      userId,
    });

    if (!store_id) {
      logRouteFailure(req, routeLabel, 400, "store_id is required", {
        userId,
      });
      return sendError(res, 400, "store_id is required", {
        message: "store_id is required",
      });
    }

    const storeResult = await pool.query("SELECT id FROM stores WHERE id = $1 LIMIT 1", [
      store_id,
    ]);

    if (storeResult.rows.length === 0) {
      logRouteFailure(req, routeLabel, 404, "Store not found", {
        store_id,
        userId,
      });
      return sendError(res, 404, "Store not found", {
        message: "Store not found",
      });
    }

    const savedStore = await pool.query(
      `
      INSERT INTO saved_stores (user_id, store_id)
      VALUES ($1, $2)
      ON CONFLICT (user_id, store_id) DO NOTHING
      RETURNING *
      `,
      [userId, store_id]
    );

    if (savedStore.rows.length === 0) {
      logRouteSuccess(req, routeLabel, 200, {
        store_id,
        userId,
        result: "already-saved",
      });
      return sendSuccess(res, 200, {
        savedStore: null,
      }, {
        message: "Store already saved",
      });
    }

    logRouteSuccess(req, routeLabel, 201, {
      store_id,
      userId,
    });
    return sendSuccess(res, 201, {
      savedStore: savedStore.rows[0],
    }, {
      message: "Store saved successfully",
      savedStore: savedStore.rows[0],
    });
  } catch (error) {
    logRouteFailure(req, routeLabel, 500, error, {
      userId: req.user?.id,
      store_id: req.body?.store_id,
    });
    return sendError(res, 500, "Something went wrong", {
      message: "Something went wrong",
    });
  }
});

// Get all saved stores for the current authenticated user
router.get("/", authMiddleware, async (req, res) => {
  const routeLabel = "saved/list";
  try {
    const userId = req.user.id;
    logRouteHit(req, routeLabel, {
      userId,
    });

    const savedStores = await pool.query(
      `
      SELECT 
        saved_stores.id,
        stores.id AS store_id,
        stores.store_name,
        stores.category,
        stores.address,
        stores.latitude,
        stores.longitude,
        stores.phone_number,
        stores.verified,
        stores.subscription_tier,
        stores.image_url,
        saved_stores.created_at
      FROM saved_stores
      JOIN stores ON saved_stores.store_id = stores.id
      WHERE saved_stores.user_id = $1
      ORDER BY saved_stores.created_at DESC
      `,
      [userId]
    );

    logRouteSuccess(req, routeLabel, 200, {
      count: savedStores.rows.length,
      userId,
    });
    return sendSuccess(res, 200, {
      savedStores: savedStores.rows,
    }, {
      message: "Saved stores fetched successfully",
      savedStores: savedStores.rows,
    });
  } catch (error) {
    logRouteFailure(req, routeLabel, 500, error, {
      userId: req.user?.id,
    });
    return sendError(res, 500, "Something went wrong", {
      message: "Something went wrong",
    });
  }
});

// Remove a saved store for the authenticated user
router.delete("/:storeId", authMiddleware, async (req, res) => {
  const routeLabel = "saved/unsave";
  try {
    const userId = req.user.id;
    const { storeId } = req.params;
    logRouteHit(req, routeLabel, {
      storeId,
      userId,
    });

    const deletedStore = await pool.query(
      "DELETE FROM saved_stores WHERE user_id = $1 AND store_id = $2 RETURNING *",
      [userId, storeId]
    );

    if (deletedStore.rows.length === 0) {
      logRouteFailure(req, routeLabel, 404, "Saved store not found", {
        storeId,
        userId,
      });
      return sendError(res, 404, "Saved store not found", {
        message: "Saved store not found",
      });
    }

    logRouteSuccess(req, routeLabel, 200, {
      storeId,
      userId,
    });
    return sendSuccess(res, 200, {
      removed: deletedStore.rows[0],
    }, {
      message: "Store removed from saved stores",
      removed: deletedStore.rows[0],
    });
  } catch (error) {
    logRouteFailure(req, routeLabel, 500, error, {
      userId: req.user?.id,
      storeId: req.params?.storeId,
    });
    return sendError(res, 500, "Something went wrong", {
      message: "Something went wrong",
    });
  }
});

module.exports = router;
