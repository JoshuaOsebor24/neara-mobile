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
const {
  invalidatePublicReadCaches,
  publicStoreCache,
} = require("../utils/publicRouteCaches");

const router = express.Router();
const STORE_HEADER_IMAGE_SLOT_COUNT = 3;
const ROLE_USER = "user";
const ROLE_PRO = "pro";
const ROLE_STORE_OWNER = "store_owner";

function normalizeNullableText(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function sanitizePublicImageUrl(value) {
  const normalized = normalizeNullableText(value);
  return normalized || null;
}

function hasValidPhoneNumber(value) {
  return String(value || "").replace(/\D/g, "").length >= 7;
}

function normalizeHeaderImages(value, fallbackImageUrl = null) {
  const normalized = (Array.isArray(value) ? value : [])
    .slice(0, STORE_HEADER_IMAGE_SLOT_COUNT)
    .map((item) => sanitizePublicImageUrl(item));
  const compact = normalized.filter(Boolean);

  if (compact.length > 0) {
    return compact;
  }

  const fallback = sanitizePublicImageUrl(fallbackImageUrl);

  if (!fallback) {
    return [];
  }

  return [fallback];
}

function pickPrimaryStoreImage(headerImages, fallbackImageUrl = null) {
  const fromHeaders = Array.isArray(headerImages)
    ? headerImages.find((item) => sanitizePublicImageUrl(item))
    : null;

  return (
    sanitizePublicImageUrl(fromHeaders) ||
    sanitizePublicImageUrl(fallbackImageUrl)
  );
}

function serializeHeaderImages(headerImages) {
  return JSON.stringify(normalizeHeaderImages(headerImages));
}

function normalizeStoreRecord(store) {
  if (!store || typeof store !== "object") {
    return store;
  }

  const headerImages = normalizeHeaderImages(
    store.header_images,
    store.image_url,
  );
  const primaryStoreImage = pickPrimaryStoreImage(
    headerImages,
    store.image_url,
  );

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

function normalizeCoordinateValue(value) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === "") {
    return null;
  }

  const numeric = Number.parseFloat(String(value));

  if (!Number.isFinite(numeric)) {
    return NaN;
  }

  return numeric;
}

function hasValidCoordinateRange(latitude, longitude) {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

function buildPublicStoreCacheKey(prefix, req) {
  return `${prefix}:${req.originalUrl}`;
}

async function queryAllPublicStores({ latitude, longitude, hasLocation }) {
  return pool.query(
    `
      SELECT
        s.id,
        s.store_name,
        s.category,
        s.address,
        s.state,
        s.country,
        s.latitude,
        s.longitude,
        s.phone_number,
        s.image_url AS image_url,
        COALESCE(
          (
            SELECT jsonb_agg(image_item)
            FROM jsonb_array_elements_text(COALESCE(s.header_images, '[]'::jsonb)) AS image_item
          ),
          '[]'::jsonb
        ) AS header_images,
        s.description,
        CASE
          WHEN $3::boolean THEN (
            6371 * acos(
              least(
                1,
                greatest(
                  -1,
                  cos(radians($1)) * cos(radians(s.latitude)) *
                  cos(radians(s.longitude) - radians($2)) +
                  sin(radians($1)) * sin(radians(s.latitude))
                )
              )
            )
          )
          ELSE NULL
        END AS distance_km
      FROM stores s
      WHERE
        s.is_suspended = FALSE
        AND s.latitude IS NOT NULL
        AND s.longitude IS NOT NULL
      ORDER BY distance_km ASC NULLS LAST, store_name ASC
    `,
    [latitude, longitude, Boolean(hasLocation)],
  );
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
    const normalizedLatitude = normalizeCoordinateValue(latitude);
    const normalizedLongitude = normalizeCoordinateValue(longitude);
    const hasLatitude =
      normalizedLatitude !== undefined && normalizedLatitude !== null;
    const hasLongitude =
      normalizedLongitude !== undefined && normalizedLongitude !== null;

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
      return sendError(
        res,
        400,
        "Latitude and longitude must be provided together",
        {
          message: "Latitude and longitude must be provided together",
        },
      );
    }

    if (
      hasLatitude &&
      hasLongitude &&
      !hasValidCoordinateRange(normalizedLatitude, normalizedLongitude)
    ) {
      return sendError(res, 400, "Store coordinates are invalid", {
        message: "Store coordinates are invalid",
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

    const normalizedHeaderImages = normalizeHeaderImages(
      header_images,
      image_url,
    );
    const primaryStoreImage = pickPrimaryStoreImage(
      normalizedHeaderImages,
      image_url,
    );

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
        normalizedLatitude ?? null,
        normalizedLongitude ?? null,
        normalizedPhoneNumber,
        primaryStoreImage,
        serializeHeaderImages(normalizedHeaderImages),
        description || null,
      ],
    );

    await syncOwnerUserRoles(client, ownerId);
    await client.query("COMMIT");
    transactionOpen = false;
    invalidatePublicReadCaches();

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
      [ownerId],
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
    const cacheKey = buildPublicStoreCacheKey("stores", req);
    const cachedPayload = publicStoreCache.get(cacheKey);

    if (cachedPayload) {
      return res.json(cachedPayload);
    }

    const latitude = normalizeCoordinateQueryParam(req.query.lat);
    const longitude = normalizeCoordinateQueryParam(req.query.lng);
    const hasLocation = latitude !== null && longitude !== null;
    const storesResult = await queryAllPublicStores({
      latitude,
      longitude,
      hasLocation,
    });

    const payload = {
      message: "Stores fetched successfully",
      stores: storesResult.rows.map(normalizeStoreRecord),
    };

    publicStoreCache.set(cacheKey, payload);
    res.json(payload);
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
    const cacheKey = `store-full:${storeId}:${req.originalUrl}`;
    const cachedPayload = publicStoreCache.get(cacheKey);

    if (cachedPayload) {
      return res.json(cachedPayload);
    }

    console.debug("stores/:id/full params", { storeId });
    const storeResult = await pool.query(
      `
      SELECT
        id,
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
        COALESCE(
          (
            SELECT jsonb_agg(image_item)
            FROM jsonb_array_elements_text(COALESCE(header_images, '[]'::jsonb)) AS image_item
          ),
          '[]'::jsonb
        ) AS header_images,
        description
      FROM stores
      WHERE id = $1
        AND is_suspended = FALSE
      `,
      [storeId],
    );

    if (storeResult.rows.length === 0) {
      console.debug("stores/:id/full not found", { storeId });
      return res.status(404).json({ message: "Store not found" });
    }

    const productsResult = await pool.query(
      `
      SELECT
        p.id AS product_id,
        p.product_name,
        p.category,
        p.description,
        p.image_url,
        p.tags,
        pv.id AS variant_id,
        pv.variant_name,
        pv.price,
        pv.unit_count,
        pv.stock_quantity,
        pv.in_stock
      FROM products p
      LEFT JOIN product_variants pv ON pv.product_id = p.id
      WHERE p.store_id = $1
      ORDER BY p.id DESC, pv.id ASC
      `,
      [storeId],
    );

    const variantsByProductId = new Map();
    const productsById = new Map();

    for (const row of productsResult.rows) {
      if (!productsById.has(row.product_id)) {
        productsById.set(row.product_id, {
          product_id: row.product_id,
          product_name: row.product_name,
          category: row.category,
          description: row.description,
          image_url: sanitizePublicImageUrl(row.image_url),
          tags: Array.isArray(row.tags) ? row.tags : [],
          variants: [],
        });
      }

      if (row.variant_id === null || row.variant_id === undefined) {
        continue;
      }

      const product = productsById.get(row.product_id);
      product.variants.push({
        variant_id: row.variant_id,
        variant_name: row.variant_name,
        price:
          typeof row.price === "string" && row.price.trim() !== ""
            ? Number(row.price)
            : row.price,
        unit_count:
          typeof row.unit_count === "string" && row.unit_count.trim() !== ""
            ? Number(row.unit_count)
            : row.unit_count,
        stock_quantity:
          typeof row.stock_quantity === "string" &&
          row.stock_quantity.trim() !== ""
            ? Number(row.stock_quantity)
            : row.stock_quantity,
        in_stock: Boolean(row.in_stock),
      });
      variantsByProductId.set(row.product_id, product.variants);
    }

    const store = normalizeStoreRecord(storeResult.rows[0]);
    const products = Array.from(productsById.values());

    console.log("stores/:id/full loaded", {
      storeId,
      productCount: products.length,
      duration_ms: Date.now() - startedAt,
    });

    const payload = {
      message: "Store full data fetched successfully",
      store,
      products,
    };

    publicStoreCache.set(cacheKey, payload);
    res.json(payload);
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
    const storeId = Number.parseInt(id, 10);
    logRouteHit(req, routeLabel, {
      id,
      storeId: id,
    });

    if (!Number.isInteger(storeId) || storeId <= 0) {
      return sendError(res, 400, "Invalid store id", {
        message: "Invalid store id",
      });
    }

    const cacheKey = `store:${storeId}:${req.originalUrl}`;
    const cachedPayload = publicStoreCache.get(cacheKey);

    if (cachedPayload) {
      return sendSuccess(res, 200, cachedPayload.data, {
        message: cachedPayload.message,
        store: cachedPayload.store,
      });
    }

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
        state,
        country,
        delivery_available,
        latitude,
        longitude,
        phone_number,
        image_url,
        COALESCE(
          (
            SELECT jsonb_agg(image_item)
            FROM jsonb_array_elements_text(COALESCE(header_images, '[]'::jsonb)) AS image_item
          ),
          '[]'::jsonb
        ) AS header_images,
        description
      FROM stores
      WHERE id = $1
        AND is_suspended = FALSE
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

    const normalizedStore = normalizeStoreRecord(storeResult.rows[0]);
    const payload = {
      data: {
        store: normalizedStore,
      },
      message: "Store fetched successfully",
      store: normalizedStore,
    };

    publicStoreCache.set(cacheKey, payload);
    return sendSuccess(
      res,
      200,
      {
        store: payload.store,
      },
      {
        message: payload.message,
        store: payload.store,
      },
    );
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

    const storeResult = await pool.query("SELECT * FROM stores WHERE id = $1", [
      id,
    ]);

    if (storeResult.rows.length === 0) {
      return res.status(404).json({
        message: "Store not found",
      });
    }

    const store = storeResult.rows[0];
    const currentHeaderImages = normalizeHeaderImages(
      store.header_images,
      store.image_url,
    );
    const normalizedImageUrl =
      image_url !== undefined ? normalizeNullableText(image_url) : undefined;
    const normalizedLatitude = normalizeCoordinateValue(latitude);
    const normalizedLongitude = normalizeCoordinateValue(longitude);
    const normalizedStoreName =
      store_name !== undefined
        ? normalizeNullableText(store_name)
        : normalizeNullableText(store.store_name);
    const normalizedCategory =
      category !== undefined
        ? normalizeNullableText(category)
        : normalizeNullableText(store.category);
    const normalizedAddress =
      address !== undefined ? normalizeNullableText(address) : store.address;
    const normalizedState =
      state !== undefined ? normalizeNullableText(state) : store.state;
    const normalizedCountry =
      country !== undefined ? normalizeNullableText(country) : store.country;
    const normalizedPhoneNumber =
      phone_number !== undefined
        ? normalizeNullableText(phone_number)
        : store.phone_number;
    const normalizedDescription =
      description !== undefined
        ? normalizeNullableText(description)
        : store.description;
    const hasLatitude =
      normalizedLatitude !== undefined && normalizedLatitude !== null;
    const hasLongitude =
      normalizedLongitude !== undefined && normalizedLongitude !== null;
    let nextHeaderImages = currentHeaderImages;

    if (header_images !== undefined) {
      nextHeaderImages = normalizeHeaderImages(
        header_images,
        normalizedImageUrl ?? store.image_url,
      );
    } else if (image_url !== undefined) {
      nextHeaderImages = [
        normalizedImageUrl ?? null,
        ...currentHeaderImages.slice(1),
      ];
    }

    const primaryStoreImage = pickPrimaryStoreImage(
      nextHeaderImages,
      normalizedImageUrl ?? store.image_url,
    );

    // Authorization: only the owner may perform updates
    if (Number(store.owner_id) !== ownerId) {
      return res.status(403).json({
        message: "You are not allowed to update this store",
      });
    }

    if (hasLatitude !== hasLongitude) {
      return sendError(
        res,
        400,
        "Latitude and longitude must be provided together",
        {
          message: "Latitude and longitude must be provided together",
        },
      );
    }

    if (
      hasLatitude &&
      hasLongitude &&
      !hasValidCoordinateRange(normalizedLatitude, normalizedLongitude)
    ) {
      return sendError(res, 400, "Store coordinates are invalid", {
        message: "Store coordinates are invalid",
      });
    }

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
        normalizedStoreName,
        normalizedCategory,
        normalizedAddress,
        normalizedState,
        normalizedCountry,
        delivery_available !== undefined
          ? Boolean(delivery_available)
          : Boolean(store.delivery_available),
        normalizedLatitude !== undefined ? normalizedLatitude : store.latitude,
        normalizedLongitude !== undefined
          ? normalizedLongitude
          : store.longitude,
        normalizedPhoneNumber,
        primaryStoreImage,
        serializeHeaderImages(nextHeaderImages),
        normalizedDescription,
        id,
      ],
    );

    invalidatePublicReadCaches();

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
