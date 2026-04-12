const express = require("express");
const pool = require("../config/db");
const rateLimit = require("express-rate-limit");
const {
  logRouteFailure,
  logRouteHit,
  logRouteSuccess,
  sendError,
  sendSuccess,
} = require("../utils/apiResponse");
const { searchCache } = require("../utils/publicRouteCaches");
const { runtime } = require("../config/env");

const router = express.Router();
const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: runtime.isProduction ? 90 : 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many search requests, please slow down.",
  },
});

function normalizeSearchInput(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value.replace(/\s+/g, " ").trim();
}

function parseSearchLimit(value, fallback) {
  const parsed = Number.parseInt(String(value || ""), 10);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.min(parsed, 30);
}

function computeDistanceKm(userLat, userLng, storeLat, storeLng) {
  if (
    !Number.isFinite(userLat) ||
    !Number.isFinite(userLng) ||
    !Number.isFinite(storeLat) ||
    !Number.isFinite(storeLng)
  ) {
    return null;
  }

  const latDelta = storeLat - userLat;
  const lngDelta = storeLng - userLng;

  return Math.sqrt(latDelta * latDelta + lngDelta * lngDelta) * 111;
}

function buildResultKey(row) {
  return [
    String(row.store_id),
    String(row.product_id || 0),
    String(row.variant_id || 0),
  ].join(":");
}

function sortResults(a, b) {
  if (a.distance_km != null && b.distance_km != null && a.distance_km !== b.distance_km) {
    return a.distance_km - b.distance_km;
  }

  if (a.distance_km != null && b.distance_km == null) {
    return -1;
  }

  if (a.distance_km == null && b.distance_km != null) {
    return 1;
  }

  if (a.match_priority !== b.match_priority) {
    return b.match_priority - a.match_priority;
  }

  const storeCompare = String(a.store_name || "").localeCompare(String(b.store_name || ""));
  if (storeCompare !== 0) {
    return storeCompare;
  }

  return String(a.product_name || "").localeCompare(String(b.product_name || ""));
}

function normalizeSearchImageUrl(productImageUrl, storeImageUrl, productId) {
  const hasProduct = productId !== null && productId !== undefined;
  const primaryImage = hasProduct
    ? typeof productImageUrl === "string" && productImageUrl.trim()
      ? productImageUrl.trim()
      : null
    : typeof storeImageUrl === "string" && storeImageUrl.trim()
      ? storeImageUrl.trim()
      : null;

  if (!primaryImage) {
    return null;
  }

  if (primaryImage.startsWith("data:")) {
    return typeof storeImageUrl === "string" && storeImageUrl.trim() && !storeImageUrl.trim().startsWith("data:")
      ? storeImageUrl.trim()
      : null;
  }

  return primaryImage;
}

function buildSearchResults(rows, { hasCoords, userLat, userLng }) {
  const merged = rows.map((row) => {
    const distanceKm = hasCoords
      ? computeDistanceKm(
          userLat,
          userLng,
          Number(row.latitude),
          Number(row.longitude),
        )
      : null;

    return {
      ...row,
      id: row.store_id,
      distance_km: distanceKm,
      distance:
        distanceKm != null ? `${Number(distanceKm).toFixed(2)} km away` : "",
    };
  });

  const deduped = [];
  const seenKeys = new Set();

  for (const row of merged.sort(sortResults)) {
    const resultKey = buildResultKey(row);
    if (seenKeys.has(resultKey)) {
      continue;
    }
    seenKeys.add(resultKey);
    deduped.push(row);
  }

  return deduped.map((item) => ({
    id: item.store_id,
    store_id: item.store_id,
    store_name: item.store_name,
    category: item.category,
    address: item.address,
    latitude: item.latitude,
    longitude: item.longitude,
    product_id: item.product_id,
    product_name: item.product_name,
    description: item.description,
    variant: item.variant_name,
    variant_name: item.variant_name,
    unit_count: item.unit_count ?? 1,
    price: item.price ?? null,
    quantity: item.stock_quantity ?? null,
    in_stock: item.in_stock ?? null,
    match_source: item.match_source,
    image_url: normalizeSearchImageUrl(
      item.image_url,
      item.store_image_url,
      item.product_id,
    ),
    distance_km: item.distance_km,
    distance: item.distance,
  }));
}

router.get("/", searchLimiter, async (req, res) => {
  const routeLabel = "search";
  const startedAt = Date.now();

  try {
    const cacheKey = `search:${req.originalUrl}`;
    const cachedPayload = searchCache.get(cacheKey);

    if (cachedPayload) {
      logRouteSuccess(req, routeLabel, 200, {
        cache_hit: true,
        duration_ms: Date.now() - startedAt,
      });
      return sendSuccess(res, 200, {
        results: cachedPayload.results,
      }, {
        message: cachedPayload.message,
        results: cachedPayload.results,
      });
    }

    const { product, q, query, lat, lng, limit, preview } = req.query;
    logRouteHit(req, routeLabel, {
      product,
      q,
      query,
      lat,
      lng,
      limit,
      preview,
    });
    const searchTerm = normalizeSearchInput(
      typeof query === "string" && query.trim()
        ? query
        : typeof q === "string" && q.trim()
          ? q
          : typeof product === "string"
            ? product
            : "",
    );
    const isPreviewRequest = String(preview || "") === "1";
    const resultLimit = parseSearchLimit(limit, isPreviewRequest ? 6 : 24);
    const likeTerm = `%${searchTerm}%`;

    const userLat = lat !== undefined ? Number.parseFloat(String(lat)) : NaN;
    const userLng = lng !== undefined ? Number.parseFloat(String(lng)) : NaN;
    const hasCoords = Number.isFinite(userLat) && Number.isFinite(userLng);

    console.log("[search] request summary", {
      request_url: req.originalUrl,
      query: typeof query === "string" ? query : "",
      q: typeof q === "string" ? q : "",
      product: typeof product === "string" ? product : "",
      normalized_query: searchTerm,
      length: searchTerm.length,
      preview: isPreviewRequest,
      result_limit: resultLimit,
      has_coords: hasCoords,
    });

    if (!searchTerm || searchTerm.length < 2) {
      logRouteSuccess(req, routeLabel, 200, {
        duration_ms: Date.now() - startedAt,
        preview: isPreviewRequest,
        result_count: 0,
        skipped: true,
      });
      return sendSuccess(res, 200, {
        results: [],
      }, {
        error: undefined,
        message: !searchTerm ? "Search query is empty" : "Search query is too short",
        results: [],
      });
    }

    const fetchLimit = isPreviewRequest
      ? Math.max(resultLimit + 2, 8)
      : Math.min(Math.max(resultLimit + 4, 12), 24);

    if (isPreviewRequest) {
      const storePreviewSql = `
        SELECT
          stores.id AS store_id,
          stores.store_name,
          stores.category,
          stores.address,
          stores.latitude,
          stores.longitude,
          stores.image_url AS store_image_url,
          NULL::integer AS product_id,
          NULL::text AS product_name,
          NULL::text AS description,
          NULL::text AS image_url,
          NULL::integer AS variant_id,
          NULL::text AS variant_name,
          NULL::numeric AS price,
          NULL::integer AS stock_quantity,
          NULL::boolean AS in_stock,
          'store'::text AS match_source,
          1 AS match_priority
        FROM stores
        WHERE
          stores.is_suspended = FALSE
          AND (
          stores.store_name ILIKE $1
          OR COALESCE(stores.category, '') ILIKE $1
          )
        ORDER BY stores.store_name ASC
        LIMIT $2
      `;

      const productPreviewSql = `
        SELECT
          stores.id AS store_id,
          stores.store_name,
          stores.category,
          stores.address,
          stores.latitude,
          stores.longitude,
          stores.image_url AS store_image_url,
          products.id AS product_id,
          products.product_name,
          NULL::text AS description,
          CASE
            WHEN products.image_url ILIKE 'data:%' THEN NULL
            ELSE products.image_url
          END AS image_url,
          preview_variant.variant_id,
          preview_variant.variant_name,
          preview_variant.unit_count,
          preview_variant.price,
          NULL::integer AS stock_quantity,
          NULL::boolean AS in_stock,
          'product'::text AS match_source,
          2 AS match_priority
        FROM products
        INNER JOIN stores ON stores.id = products.store_id
        LEFT JOIN LATERAL (
          SELECT
            product_variants.id AS variant_id,
            product_variants.variant_name,
            product_variants.unit_count,
            product_variants.price
          FROM product_variants
          WHERE product_variants.product_id = products.id
          ORDER BY product_variants.price NULLS LAST, product_variants.id ASC
          LIMIT 1
        ) AS preview_variant ON true
        WHERE
          stores.is_suspended = FALSE
          AND (
          COALESCE(products.product_name, '') ILIKE $1
          OR COALESCE(products.category, '') ILIKE $1
          OR EXISTS (
            SELECT 1
            FROM UNNEST(COALESCE(products.tags, ARRAY[]::TEXT[])) AS product_tag
            WHERE product_tag ILIKE $1
          )
          OR COALESCE(stores.store_name, '') ILIKE $1
          OR COALESCE(stores.category, '') ILIKE $1
          )
        ORDER BY stores.store_name ASC, products.product_name ASC
        LIMIT $2
      `;

      const variantPreviewSql = `
        SELECT
          stores.id AS store_id,
          stores.store_name,
          stores.category,
          stores.address,
          stores.latitude,
          stores.longitude,
          stores.image_url AS store_image_url,
          products.id AS product_id,
          products.product_name,
          NULL::text AS description,
          CASE
            WHEN products.image_url ILIKE 'data:%' THEN NULL
            ELSE products.image_url
          END AS image_url,
          product_variants.id AS variant_id,
          product_variants.variant_name,
          product_variants.unit_count,
          product_variants.price,
          NULL::integer AS stock_quantity,
          NULL::boolean AS in_stock,
          'variant'::text AS match_source,
          3 AS match_priority
        FROM product_variants
        INNER JOIN products ON products.id = product_variants.product_id
        INNER JOIN stores ON stores.id = products.store_id
        WHERE
          stores.is_suspended = FALSE
          AND (
          COALESCE(product_variants.variant_name, '') ILIKE $1
          OR COALESCE(products.product_name, '') ILIKE $1
          OR EXISTS (
            SELECT 1
            FROM UNNEST(COALESCE(products.tags, ARRAY[]::TEXT[])) AS product_tag
            WHERE product_tag ILIKE $1
          )
          OR COALESCE(stores.store_name, '') ILIKE $1
          )
        ORDER BY stores.store_name ASC, products.product_name ASC
        LIMIT $2
      `;

    console.log("[search] db query start", {
      phase: "start",
      mode: "preview",
      store_sql: "stores by name/category",
      product_sql: "products by name/category/store",
        variant_sql: "variants by variant/product/store",
        fetch_limit: fetchLimit,
      });

      const previewQueryStartedAt = Date.now();
      const [storeMatches, productMatches, variantMatches] = await Promise.all([
        pool.query(storePreviewSql, [likeTerm, fetchLimit]),
        pool.query(productPreviewSql, [likeTerm, fetchLimit]),
        pool.query(variantPreviewSql, [likeTerm, fetchLimit]),
      ]);
      const previewQueryDurationMs = Date.now() - previewQueryStartedAt;

      console.log("[search] db query end", {
        phase: "end",
        mode: "preview",
        duration_ms: previewQueryDurationMs,
      });

      const results = buildSearchResults(
        [
          ...variantMatches.rows,
          ...productMatches.rows,
          ...storeMatches.rows,
        ].slice(0, fetchLimit * 3),
        { hasCoords, userLat, userLng },
      ).slice(0, resultLimit);

      console.log("[search] response summary", {
        request_url: req.originalUrl,
        normalized_query: searchTerm,
        preview: true,
        sql_duration_ms: previewQueryDurationMs,
        store_matches: storeMatches.rowCount,
        product_matches: productMatches.rowCount,
        variant_matches: variantMatches.rowCount,
        result_count: results.length,
        duration_ms: Date.now() - startedAt,
      });

      searchCache.set(cacheKey, {
        message: "Search completed successfully",
        results,
      });
      logRouteSuccess(req, routeLabel, 200, {
        duration_ms: Date.now() - startedAt,
        preview: true,
        result_count: results.length,
      });
      return sendSuccess(res, 200, {
        results,
      }, {
        message: "Search completed successfully",
        results,
      });
    }

    const storeSql = `
      SELECT
        stores.id AS store_id,
        stores.store_name,
        stores.category,
        stores.address,
        stores.latitude,
        stores.longitude,
        stores.image_url AS store_image_url,
        NULL::integer AS product_id,
        NULL::text AS product_name,
        NULL::text AS description,
        NULL::text AS image_url,
        NULL::integer AS variant_id,
        NULL::text AS variant_name,
        NULL::numeric AS price,
        NULL::integer AS stock_quantity,
        NULL::boolean AS in_stock,
        'store'::text AS match_source,
        1 AS match_priority
      FROM stores
      WHERE
        stores.is_suspended = FALSE
        AND (
        stores.store_name ILIKE $1
        OR COALESCE(stores.category, '') ILIKE $1
        )
      ORDER BY stores.store_name ASC
      LIMIT $2
    `;

    const productSql = `
      SELECT
        stores.id AS store_id,
        stores.store_name,
        stores.category,
        stores.address,
        stores.latitude,
        stores.longitude,
        stores.image_url AS store_image_url,
        products.id AS product_id,
        products.product_name,
        products.description,
        CASE
          WHEN products.image_url ILIKE 'data:%' THEN NULL
          ELSE products.image_url
        END AS image_url,
        display_variant.variant_id,
        display_variant.variant_name,
        display_variant.unit_count,
        display_variant.price,
        display_variant.stock_quantity,
        display_variant.in_stock,
        'product'::text AS match_source,
        2 AS match_priority
      FROM products
      INNER JOIN stores ON stores.id = products.store_id
      LEFT JOIN LATERAL (
        SELECT
          product_variants.id AS variant_id,
          product_variants.variant_name,
          product_variants.unit_count,
          product_variants.price,
          product_variants.stock_quantity,
          product_variants.in_stock
        FROM product_variants
        WHERE product_variants.product_id = products.id
        ORDER BY
          CASE WHEN product_variants.in_stock IS TRUE THEN 0 ELSE 1 END,
          product_variants.price NULLS LAST,
          product_variants.id ASC
        LIMIT 1
      ) AS display_variant ON true
      WHERE
        stores.is_suspended = FALSE
        AND (
        COALESCE(products.product_name, '') ILIKE $1
        OR COALESCE(products.description, '') ILIKE $1
        OR COALESCE(products.category, '') ILIKE $1
        OR EXISTS (
          SELECT 1
          FROM UNNEST(COALESCE(products.tags, ARRAY[]::TEXT[])) AS product_tag
          WHERE product_tag ILIKE $1
        )
        OR COALESCE(stores.store_name, '') ILIKE $1
        OR COALESCE(stores.category, '') ILIKE $1
        )
      ORDER BY stores.store_name ASC, products.product_name ASC
      LIMIT $2
    `;

    const variantSql = `
      SELECT
        stores.id AS store_id,
        stores.store_name,
        stores.category,
        stores.address,
        stores.latitude,
        stores.longitude,
        stores.image_url AS store_image_url,
        products.id AS product_id,
        products.product_name,
        products.description,
        CASE
          WHEN products.image_url ILIKE 'data:%' THEN NULL
          ELSE products.image_url
        END AS image_url,
        product_variants.id AS variant_id,
        product_variants.variant_name,
        product_variants.unit_count,
        product_variants.price,
        product_variants.stock_quantity,
        product_variants.in_stock,
        'variant'::text AS match_source,
        3 AS match_priority
      FROM product_variants
      INNER JOIN products ON products.id = product_variants.product_id
      INNER JOIN stores ON stores.id = products.store_id
      WHERE
        stores.is_suspended = FALSE
        AND (
        COALESCE(product_variants.variant_name, '') ILIKE $1
        OR COALESCE(products.product_name, '') ILIKE $1
        OR EXISTS (
          SELECT 1
          FROM UNNEST(COALESCE(products.tags, ARRAY[]::TEXT[])) AS product_tag
          WHERE product_tag ILIKE $1
        )
        OR COALESCE(stores.store_name, '') ILIKE $1
        )
      ORDER BY stores.store_name ASC, products.product_name ASC
      LIMIT $2
    `;

    console.log("[search] db query start", {
      phase: "start",
      store_sql: "stores by name/category",
      product_sql: "products by name/description/category/store",
      variant_sql: "variants by variant/product/store",
      fetch_limit: fetchLimit,
    });

    const sqlStartedAt = Date.now();
    const [storeMatches, productMatches, variantMatches] = await Promise.all([
      pool.query(storeSql, [likeTerm, fetchLimit]),
      pool.query(productSql, [likeTerm, fetchLimit]),
      pool.query(variantSql, [likeTerm, fetchLimit]),
    ]);
    const sqlDurationMs = Date.now() - sqlStartedAt;

    console.log("[search] db query end", {
      phase: "end",
      mode: "full",
      duration_ms: sqlDurationMs,
    });

    const results = buildSearchResults(
      [
        ...variantMatches.rows,
        ...productMatches.rows,
        ...storeMatches.rows,
      ],
      { hasCoords, userLat, userLng },
    ).slice(0, resultLimit);

    console.log("[search] response summary", {
      request_url: req.originalUrl,
      normalized_query: searchTerm,
      preview: false,
      sql_duration_ms: sqlDurationMs,
      store_matches: storeMatches.rowCount,
      product_matches: productMatches.rowCount,
      variant_matches: variantMatches.rowCount,
      result_count: results.length,
      duration_ms: Date.now() - startedAt,
    });

    searchCache.set(cacheKey, {
      message: "Search completed successfully",
      results,
    });
    logRouteSuccess(req, routeLabel, 200, {
      duration_ms: Date.now() - startedAt,
      preview: false,
      result_count: results.length,
    });
    return sendSuccess(res, 200, {
      results,
    }, {
      message: "Search completed successfully",
      results,
    });
  } catch (error) {
    logRouteFailure(req, routeLabel, 500, error, {
      duration_ms: Date.now() - startedAt,
    });

    return sendError(res, 500, error?.message || "Something went wrong", {
      message: "Something went wrong",
      error: error?.message || "Unknown error",
      results: [],
    });
  }
});

module.exports = router;
