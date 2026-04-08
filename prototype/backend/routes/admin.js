const express = require("express");
const pool = require("../config/db");
const authMiddleware = require("../middleware/authMiddleware");
const adminOnlyMiddleware = require("../middleware/adminOnlyMiddleware");

const router = express.Router();

router.use(authMiddleware, adminOnlyMiddleware);

function parseInteger(value) {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseBooleanFlag(value) {
  return typeof value === "boolean" ? value : null;
}

function normalizeNumeric(value) {
  if (typeof value === "string" && value.trim() !== "") {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : value;
  }

  return value;
}

router.get("/stats", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        (SELECT COUNT(*)::INT FROM users) AS total_users,
        (SELECT COUNT(*)::INT FROM users WHERE premium_status = TRUE) AS total_pro_users,
        (SELECT COUNT(DISTINCT owner_id)::INT FROM stores WHERE owner_id IS NOT NULL) AS total_store_owners,
        (SELECT COUNT(*)::INT FROM stores) AS total_stores,
        (SELECT COUNT(*)::INT FROM products) AS total_products,
        (SELECT COUNT(*)::INT FROM conversations) AS total_chats
    `);

    res.json({
      stats: rows[0] || {
        total_users: 0,
        total_pro_users: 0,
        total_store_owners: 0,
        total_stores: 0,
        total_products: 0,
        total_chats: 0,
      },
    });
  } catch (error) {
    console.error("admin stats failed", error);
    res.status(500).json({
      message: "Could not load dashboard stats",
    });
  }
});

router.get("/users", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        u.id,
        u.name,
        u.email,
        u.is_admin,
        u.premium_status,
        u.created_at,
        CASE
          WHEN u.is_admin THEN 'admin'
          WHEN EXISTS (
            SELECT 1
            FROM stores s
            WHERE s.owner_id = u.id
          ) THEN 'store_owner'
          ELSE 'user'
        END AS role
      FROM users u
      ORDER BY u.created_at DESC, u.id DESC
    `);

    res.json({
      users: rows.map((user) => ({
        id: Number(user.id),
        name: user.name,
        email: user.email,
        role: user.role,
        is_admin: Boolean(user.is_admin),
        premium_status: Boolean(user.premium_status),
        created_at: user.created_at,
      })),
    });
  } catch (error) {
    console.error("admin users failed", error);
    res.status(500).json({
      message: "Could not load users",
    });
  }
});

router.get("/stores", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        s.id,
        s.owner_id,
        s.store_name,
        s.category,
        s.verified,
        s.is_suspended,
        s.created_at,
        u.name AS owner_name,
        u.email AS owner_email,
        COUNT(p.id)::INT AS product_count
      FROM stores s
      LEFT JOIN users u ON u.id = s.owner_id
      LEFT JOIN products p ON p.store_id = s.id
      GROUP BY s.id, u.id
      ORDER BY s.created_at DESC, s.id DESC
    `);

    res.json({
      stores: rows.map((store) => ({
        id: Number(store.id),
        owner_id: store.owner_id === null ? null : Number(store.owner_id),
        store_name: store.store_name,
        owner_name: store.owner_name ?? null,
        owner_email: store.owner_email ?? null,
        category: store.category ?? null,
        verified: Boolean(store.verified),
        is_suspended: Boolean(store.is_suspended),
        product_count: Number(store.product_count || 0),
        created_at: store.created_at,
      })),
    });
  } catch (error) {
    console.error("admin stores failed", error);
    res.status(500).json({
      message: "Could not load stores",
    });
  }
});

router.patch("/stores/:storeId/verify", async (req, res) => {
  const storeId = parseInteger(req.params.storeId);
  const verified = parseBooleanFlag(req.body?.verified);

  if (!storeId) {
    return res.status(400).json({
      message: "Invalid store id",
    });
  }

  if (verified === null) {
    return res.status(400).json({
      message: "verified must be true or false",
    });
  }

  try {
    const { rows } = await pool.query(
      `
        UPDATE stores
        SET verified = $1
        WHERE id = $2
        RETURNING id, store_name, verified, is_suspended
      `,
      [verified, storeId],
    );

    if (rows.length === 0) {
      return res.status(404).json({
        message: "Store not found",
      });
    }

    res.json({
      message: verified ? "Store verified" : "Store unverified",
      store: {
        id: Number(rows[0].id),
        store_name: rows[0].store_name,
        verified: Boolean(rows[0].verified),
        is_suspended: Boolean(rows[0].is_suspended),
      },
    });
  } catch (error) {
    console.error("admin verify store failed", error);
    res.status(500).json({
      message: "Could not update store verification",
    });
  }
});

router.patch("/stores/:storeId/status", async (req, res) => {
  const storeId = parseInteger(req.params.storeId);
  const isSuspended = parseBooleanFlag(req.body?.is_suspended);

  if (!storeId) {
    return res.status(400).json({
      message: "Invalid store id",
    });
  }

  if (isSuspended === null) {
    return res.status(400).json({
      message: "is_suspended must be true or false",
    });
  }

  try {
    const { rows } = await pool.query(
      `
        UPDATE stores
        SET is_suspended = $1
        WHERE id = $2
        RETURNING id, store_name, verified, is_suspended
      `,
      [isSuspended, storeId],
    );

    if (rows.length === 0) {
      return res.status(404).json({
        message: "Store not found",
      });
    }

    res.json({
      message: isSuspended ? "Store suspended" : "Store restored",
      store: {
        id: Number(rows[0].id),
        store_name: rows[0].store_name,
        verified: Boolean(rows[0].verified),
        is_suspended: Boolean(rows[0].is_suspended),
      },
    });
  } catch (error) {
    console.error("admin store status failed", error);
    res.status(500).json({
      message: "Could not update store status",
    });
  }
});

router.delete("/stores/:storeId", async (req, res) => {
  const storeId = parseInteger(req.params.storeId);

  if (!storeId) {
    return res.status(400).json({
      message: "Invalid store id",
    });
  }

  try {
    const { rows } = await pool.query(
      `
        DELETE FROM stores
        WHERE id = $1
        RETURNING id, store_name
      `,
      [storeId],
    );

    if (rows.length === 0) {
      return res.status(404).json({
        message: "Store not found",
      });
    }

    res.json({
      message: "Store deleted successfully",
      store: {
        id: Number(rows[0].id),
        store_name: rows[0].store_name,
      },
    });
  } catch (error) {
    console.error("admin delete store failed", error);
    res.status(500).json({
      message: "Could not delete store",
    });
  }
});

router.get("/products", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        p.id,
        p.store_id,
        p.product_name,
        p.created_at,
        s.store_name,
        COALESCE(
          json_agg(
            json_build_object(
              'id', pv.id,
              'variant_name', pv.variant_name,
              'price', pv.price,
              'stock_quantity', pv.stock_quantity,
              'in_stock', pv.in_stock
            )
            ORDER BY pv.id
          ) FILTER (WHERE pv.id IS NOT NULL),
          '[]'::json
        ) AS variants
      FROM products p
      JOIN stores s ON s.id = p.store_id
      LEFT JOIN product_variants pv ON pv.product_id = p.id
      GROUP BY p.id, s.store_name
      ORDER BY p.created_at DESC, p.id DESC
    `);

    res.json({
      products: rows.map((product) => ({
        id: Number(product.id),
        store_id: Number(product.store_id),
        product_name: product.product_name,
        store_name: product.store_name,
        created_at: product.created_at,
        variants: Array.isArray(product.variants)
          ? product.variants.map((variant) => ({
              id: Number(variant.id),
              variant_name: variant.variant_name ?? null,
              price: normalizeNumeric(variant.price),
              stock_quantity: normalizeNumeric(variant.stock_quantity),
              in_stock: Boolean(variant.in_stock),
            }))
          : [],
      })),
    });
  } catch (error) {
    console.error("admin products failed", error);
    res.status(500).json({
      message: "Could not load products",
    });
  }
});

router.delete("/products/:productId", async (req, res) => {
  const productId = parseInteger(req.params.productId);

  if (!productId) {
    return res.status(400).json({
      message: "Invalid product id",
    });
  }

  try {
    const { rows } = await pool.query(
      `
        DELETE FROM products
        WHERE id = $1
        RETURNING id, product_name
      `,
      [productId],
    );

    if (rows.length === 0) {
      return res.status(404).json({
        message: "Product not found",
      });
    }

    res.json({
      message: "Product deleted successfully",
      product: {
        id: Number(rows[0].id),
        product_name: rows[0].product_name,
      },
    });
  } catch (error) {
    console.error("admin delete product failed", error);
    res.status(500).json({
      message: "Could not delete product",
    });
  }
});

router.get("/chats", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        c.id,
        c.user_id,
        c.store_id,
        c.created_at,
        c.updated_at,
        u.name AS user_name,
        u.email AS user_email,
        s.store_name,
        lm.text AS last_message,
        lm.created_at AS last_message_at,
        COUNT(m.id)::INT AS message_count
      FROM conversations c
      JOIN users u ON u.id = c.user_id
      JOIN stores s ON s.id = c.store_id
      LEFT JOIN LATERAL (
        SELECT text, created_at
        FROM messages
        WHERE conversation_id = c.id
        ORDER BY created_at DESC, id DESC
        LIMIT 1
      ) lm ON TRUE
      LEFT JOIN messages m ON m.conversation_id = c.id
      GROUP BY c.id, u.id, s.id, lm.text, lm.created_at
      ORDER BY COALESCE(lm.created_at, c.updated_at, c.created_at) DESC, c.id DESC
    `);

    res.json({
      chats: rows.map((chat) => ({
        id: Number(chat.id),
        user_id: Number(chat.user_id),
        user_name: chat.user_name,
        user_email: chat.user_email,
        store_id: Number(chat.store_id),
        store_name: chat.store_name,
        last_message: chat.last_message ?? null,
        last_message_at: chat.last_message_at ?? null,
        timestamp: chat.last_message_at ?? chat.updated_at ?? chat.created_at,
        message_count: Number(chat.message_count || 0),
      })),
    });
  } catch (error) {
    console.error("admin chats failed", error);
    res.status(500).json({
      message: "Could not load chats",
    });
  }
});

module.exports = router;
