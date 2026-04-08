// Store routes
// - Create, fetch, and update stores
// - Write operations are rate-limited to prevent spam
const express = require("express");
const pool = require("../config/db");
const rateLimit = require("express-rate-limit");
const authMiddleware = require("../middleware/authMiddleware");
const {
  logRouteFailure,
  logRouteHit,
  logRouteSuccess,
  sendError,
  sendSuccess,
} = require("../utils/apiResponse");
const { auth: AUTH_MESSAGES } = require("../config/messages.json");

const router = express.Router();
const STORE_HEADER_IMAGE_SLOT_COUNT = 3;
const ROLE_USER = "user";
const ROLE_PRO = "pro";
const ROLE_STORE_OWNER = "store_owner";

function normalizeNullableText(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function hasValidPhoneNumber(value) {
  return String(value || "").replace(/\D/g, "").length >= 7;
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

  if (!fallback) {
    return [];
  }

  return [fallback];
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

function normalizeStoreRecord(store) {
  if (!store || typeof store !== "object") {
    return store;
  }

  const headerImages = normalizeHeaderImages(store.header_images, store.image_url);
  const primaryStoreImage = pickPrimaryStoreImage(headerImages, store.image_url);

  return {
    ...store,
    image_url: primaryStoreImage,
    header_images: headerImages,
  };
}

function normalizeCoordinateQueryParam(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const numeric = Number.parseFloat(String(value));
  return Number.isFinite(numeric) ? numeric : null;
}

async function syncOwnerUserRoles(client, userId) {
  await client.query(
    `
      UPDATE users u
      SET roles = ARRAY(
        SELECT role_name
        FROM unnest(
          ARRAY[
            $2::TEXT,
            CASE WHEN u.premium_status THEN $3::TEXT ELSE NULL END,
            $4::TEXT
          ]
        ) AS role_name
        WHERE role_name IS NOT NULL
      )
      WHERE u.id = $1
    `,
    [userId, ROLE_USER, ROLE_PRO, ROLE_STORE_OWNER],
  );
}

// Rate limiter specifically for store write operations
const storeWriteLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: {
    message: "Too many store update requests, please try again later.",
  },
});

// Create a new store
// - Protected endpoint: authenticated user becomes the `owner_id`
// - Uses `storeWriteLimiter` to limit repeated create/update requests
router.post("/", storeWriteLimiter, authMiddleware, async (req, res) => {
  const client = await pool.connect();
  let transactionOpen = false;
  try {
    const ownerId = Number(req.user.id);

    if (!Number.isFinite(ownerId)) {
      return res.status(401).json({
        message: "Not authenticated",
      });
    }

    const {
      store_name,
      category,
      address,
      state,
      country,
      delivery_available,
      latitude,
      longitude,
      phone_number,
      image_url,
      header_images,
      description,
    } = req.body;

    const normalizedStoreName = normalizeNullableText(store_name);
    const normalizedCategory = normalizeNullableText(category);
    const normalizedAddress = normalizeNullableText(address);
    const normalizedPhoneNumber = normalizeNullableText(phone_number);
    const hasLatitude = latitude !== undefined && latitude !== null && String(latitude).trim() !== "";
    const hasLongitude = longitude !== undefined && longitude !== null && String(longitude).trim() !== "";

    if (!normalizedStoreName) {
      return sendError(res, 400, "Store name is required", {
        message: "Store name is required",
      });
    }

    if (!normalizedCategory) {
      return sendError(res, 400, "Category is required", {
        message: "Category is required",
      });
    }

    if (normalizedPhoneNumber && !hasValidPhoneNumber(normalizedPhoneNumber)) {
      return sendError(res, 400, "Phone number is invalid", {
        message: "Phone number is invalid",
      });
    }

    if (hasLatitude !== hasLongitude) {
      return sendError(res, 400, "Latitude and longitude must be provided together", {
        message: "Latitude and longitude must be provided together",
      });
    }

    await client.query("BEGIN");
    transactionOpen = true;

    const existingStoreResult = await client.query(
      `
        SELECT *
        FROM stores
        WHERE owner_id = $1
        ORDER BY created_at ASC, id ASC
        LIMIT 1
      `,
      [ownerId],
    );

    if (existingStoreResult.rows.length > 0) {
      await client.query("ROLLBACK");
      transactionOpen = false;
      return res.status(409).json({
        message: AUTH_MESSAGES.signup.emailExists,
        store: normalizeStoreRecord(existingStoreResult.rows[0]),
      });
    }

    const normalizedHeaderImages = normalizeHeaderImages(header_images, image_url);
    const primaryStoreImage = pickPrimaryStoreImage(normalizedHeaderImages, image_url);

    const newStore = await client.query(
      `INSERT INTO stores
       (owner_id, store_name, category, address, state, country, delivery_available, latitude, longitude, phone_number, image_url, header_images, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        ownerId,
        normalizedStoreName,
        normalizedCategory,
        normalizedAddress,
        state || null,
        country || null,
        Boolean(delivery_available),
        latitude || null,
        longitude || null,
        normalizedPhoneNumber,
        primaryStoreImage,
        serializeHeaderImages(normalizedHeaderImages),
        description || null,
      ]
    );

    await syncOwnerUserRoles(client, ownerId);
    await client.query("COMMIT");
    transactionOpen = false;

    res.status(201).json({
      message: "Store created successfully",
      store: normalizeStoreRecord(newStore.rows[0]),
    });
  } catch (error) {
    if (transactionOpen) {
      await client.query("ROLLBACK");
    }
    console.error(error);
    if (error?.code === "23505") {
      return res.status(409).json({
        message: AUTH_MESSAGES.signup.emailExists,
      });
    }
    res.status(500).json({
      message: "Something went wrong",
    });
  } finally {
    client.release();
  }
});

// Get stores owned by the authenticated user
router.get("/owner/me", authMiddleware, async (req, res) => {
  try {
    const ownerId = Number(req.user.id);

    if (!Number.isFinite(ownerId)) {
      return res.status(401).json({
        message: "Not authenticated",
      });
    }

    const storeResult = await pool.query(
      "SELECT * FROM stores WHERE owner_id = $1 ORDER BY created_at DESC",
      [ownerId]
    );

    if (storeResult.rows.length === 0) {
      return res.status(404).json({
        message: "No stores found for this owner",
      });
    }

    res.json({
      message: "Owner stores fetched successfully",
      stores: storeResult.rows.map(normalizeStoreRecord),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Something went wrong",
    });
  }
});


// Get all public stores for map display
router.get("/", async (req, res) => {
  try {
    console.debug("stores/ list");
    const latitude = normalizeCoordinateQueryParam(req.query.lat);
    const longitude = normalizeCoordinateQueryParam(req.query.lng);
    const hasLocation = latitude !== null && longitude !== null;
    const limit = hasLocation ? 24 : 100;
    const storesResult = hasLocation
      ? await pool.query(
          `
          SELECT
            id,
            store_name,
            category,
            address,
            state,
            country,
            latitude,
            longitude,
            phone_number,
            image_url,
            header_images,
            description,
            (
              6371 * acos(
                least(
                  1,
                  greatest(
                    -1,
                    cos(radians($1)) * cos(radians(latitude)) *
                    cos(radians(longitude) - radians($2)) +
                    sin(radians($1)) * sin(radians(latitude))
                  )
                )
              )
            ) AS distance_km
          FROM stores
          WHERE latitude IS NOT NULL AND longitude IS NOT NULL
          ORDER BY distance_km ASC NULLS LAST, store_name ASC
          LIMIT $3
          `,
          [latitude, longitude, limit],
        )
      : await pool.query(
          `
          SELECT
            id,
            store_name,
            category,
            address,
            state,
            country,
            latitude,
            longitude,
            phone_number,
            image_url,
            header_images,
            description
          FROM stores
          WHERE latitude IS NOT NULL AND longitude IS NOT NULL
          ORDER BY store_name
          LIMIT $1
          `,
          [limit],
        );

    res.json({
      message: "Stores fetched successfully",
      stores: storesResult.rows.map(normalizeStoreRecord),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Something went wrong",
    });
  }
});
// Get full store data (store + its products + variants)
// - Single query with JSON aggregation to minimize JS work and round‑trips
router.get("/:id/full", async (req, res, next) => {
  const storeId = Number.parseInt(req.params.id, 10);
  const startedAt = Date.now();

  if (Number.isNaN(storeId)) {
    console.warn("stores/:id/full invalid id", { idParam: req.params.id });
    return res.status(400).json({ message: "Invalid store id" });
  }

  try {
    console.debug("stores/:id/full params", { storeId });
    const { rows } = await pool.query(
      `
      WITH product_data AS (
        SELECT
          p.store_id,
          p.id AS product_id,
          p.product_name,
          p.category,
          p.description,
          p.image_url,
          p.tags,
          COALESCE(
            json_agg(
              jsonb_build_object(
                'variant_id', pv.id,
                'variant_name', pv.variant_name,
                'price', COALESCE(pv.price, 0),
                'stock_quantity', COALESCE(pv.stock_quantity, 0),
                'in_stock', COALESCE(pv.in_stock, false)
              )
              ORDER BY pv.id
            ) FILTER (WHERE pv.id IS NOT NULL),
            '[]'::json
          ) AS variants
        FROM products p
        LEFT JOIN product_variants pv ON pv.product_id = p.id
        WHERE p.store_id = $1
        GROUP BY p.id
      )
      SELECT
        jsonb_build_object(
          'id', s.id,
          'store_name', s.store_name,
          'category', s.category,
          'address', s.address,
          'delivery_available', s.delivery_available,
          'latitude', s.latitude,
          'longitude', s.longitude,
          'phone_number', s.phone_number,
          'image_url', s.image_url,
          'header_images', COALESCE(s.header_images, '[]'::jsonb),
          'description', s.description
        ) AS store,
        COALESCE(
          json_agg(
            jsonb_build_object(
              'product_id', pd.product_id,
              'product_name', pd.product_name,
              'category', pd.category,
              'description', pd.description,
              'image_url', pd.image_url,
              'tags', pd.tags,
              'variants', pd.variants
            )
            ORDER BY pd.product_id DESC
          ) FILTER (WHERE pd.product_id IS NOT NULL),
          '[]'::json
        ) AS products
      FROM stores s
      LEFT JOIN product_data pd ON pd.store_id = s.id
      WHERE s.id = $1
      GROUP BY s.id;
      `,
      [storeId]
    );

    if (rows.length === 0) {
      console.debug("stores/:id/full not found", { storeId });
      return res.status(404).json({ message: "Store not found" });
    }

    // Normalize NUMERIC fields (returned as strings) to numbers for the frontend
    const normalizeNumbers = (val) =>
      typeof val === "string" && val.trim() !== "" ? Number(val) : val;

    const products = rows[0].products.map((product) => ({
      ...product,
      variants: product.variants.map((variant) => ({
        ...variant,
        price: normalizeNumbers(variant.price),
        stock_quantity: normalizeNumbers(variant.stock_quantity),
      })),
    }));

    const store = normalizeStoreRecord(rows[0].store);

    console.log("stores/:id/full loaded", {
      storeId,
      productCount: products.length,
      duration_ms: Date.now() - startedAt,
    });

    res.json({
      message: "Store full data fetched successfully",
      store,
      products,
    });
  } catch (error) {
    console.error("stores/:id/full error", {
      storeId,
      error: error?.message || error,
      duration_ms: Date.now() - startedAt,
    });
    return next(error);
  }
});

// Get a single store by id (public)
router.get("/:id", async (req, res) => {
  const routeLabel = "store/show";
  const startedAt = Date.now();
  try {
    const { id } = req.params;
    logRouteHit(req, routeLabel, {
      id,
      storeId: id,
    });

    const queryStartedAt = Date.now();
    console.log("[store] db query start", {
      id,
    });
    const storeResult = await pool.query(
      `
      SELECT
        id,
        store_name,
        category,
        address,
        latitude,
        longitude,
        image_url,
        header_images
      FROM stores
      WHERE id = $1
      `,
      [id],
    );
    console.log("[store] db query end", {
      id,
      row_count: storeResult.rowCount,
      query_duration_ms: Date.now() - queryStartedAt,
    });

    if (storeResult.rows.length === 0) {
      logRouteFailure(req, routeLabel, 404, "Store not found", {
        duration_ms: Date.now() - startedAt,
        id,
      });
      return sendError(res, 404, "Store not found", {
        message: "Store not found",
      });
    }

    logRouteSuccess(req, routeLabel, 200, {
      id,
      duration_ms: Date.now() - startedAt,
    });

    return sendSuccess(res, 200, {
      store: normalizeStoreRecord(storeResult.rows[0]),
    }, {
      message: "Store fetched successfully",
      store: normalizeStoreRecord(storeResult.rows[0]),
    });
  } catch (error) {
    logRouteFailure(req, routeLabel, 500, error, {
      duration_ms: Date.now() - startedAt,
      id: req.params.id,
    });
    return sendError(res, 500, "Something went wrong", {
      message: "Something went wrong",
    });
  }
});

// Update a store (only owner can update)
// - Protected and rate-limited
router.put("/:id", storeWriteLimiter, authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const ownerId = Number(req.user.id);

    if (!Number.isFinite(ownerId)) {
      return res.status(401).json({
        message: "Not authenticated",
      });
    }

    const {
      store_name,
      category,
      address,
      state,
      country,
      delivery_available,
      latitude,
      longitude,
      phone_number,
      image_url,
      header_images,
      description,
    } = req.body;

    const storeResult = await pool.query(
      "SELECT * FROM stores WHERE id = $1",
      [id]
    );

    if (storeResult.rows.length === 0) {
      return res.status(404).json({
        message: "Store not found",
      });
    }

    const store = storeResult.rows[0];
    const currentHeaderImages = normalizeHeaderImages(store.header_images, store.image_url);
    const normalizedImageUrl = image_url !== undefined ? normalizeNullableText(image_url) : undefined;
    let nextHeaderImages = currentHeaderImages;

    if (header_images !== undefined) {
      nextHeaderImages = normalizeHeaderImages(header_images, normalizedImageUrl ?? store.image_url);
    } else if (image_url !== undefined) {
      nextHeaderImages = [normalizedImageUrl ?? null, ...currentHeaderImages.slice(1)];
    }

    const primaryStoreImage = pickPrimaryStoreImage(nextHeaderImages, normalizedImageUrl ?? store.image_url);

    // Authorization: only the owner may perform updates
    if (Number(store.owner_id) !== ownerId) {
      return res.status(403).json({
        message: "You are not allowed to update this store",
      });
    }

    const updatedStore = await pool.query(
      `UPDATE stores
       SET store_name = $1,
           category = $2,
           address = $3,
           state = $4,
           country = $5,
           delivery_available = $6,
           latitude = $7,
           longitude = $8,
           phone_number = $9,
           image_url = $10,
           header_images = $11,
           description = $12
       WHERE id = $13
       RETURNING *`,
      [
        store_name || store.store_name,
        category || store.category,
        address || store.address,
        state !== undefined ? state : store.state,
        country !== undefined ? country : store.country,
        delivery_available !== undefined ? Boolean(delivery_available) : Boolean(store.delivery_available),
        latitude || store.latitude,
        longitude || store.longitude,
        phone_number || store.phone_number,
        primaryStoreImage,
        serializeHeaderImages(nextHeaderImages),
        description !== undefined ? description : store.description,
        id,
      ]
    );

    res.json({
      message: "Store updated successfully",
      store: normalizeStoreRecord(updatedStore.rows[0]),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Something went wrong",
    });
  }
});

module.exports = router;
