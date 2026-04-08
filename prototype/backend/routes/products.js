// Product routes
// - Manage products within a store (create, list, update, delete)
// - Protected endpoints require authentication and ownership checks
const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

const ALLOWED_TAGS = [
  "drink",
  "soft drink",
  "juice",
  "water",
  "orange",
  "soda",
  "energy drink",
  "tea",
  "coffee",
  "snack",
  "cereal",
  "dairy",
  "bread",
  "rice",
  "frozen food",
  "fruit",
  "vegetable",
  "spice",
  "canned food",
  "breakfast",
  "baby product",
  "electronics",
  "charger",
  "cable",
  "earphones",
  "phone accessory",
  "battery",
  "usb-c",
  "fashion",
  "beauty",
  "personal care",
  "cleaning",
  "detergent",
  "tissue",
  "toiletries",
  "kitchen item",
];

const pool = require("../config/db");

function normalizeText(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function normalizeNullableText(value) {
  const trimmed = normalizeText(value);
  return trimmed ? trimmed : null;
}

function normalizePrice(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const numericValue = Number(value);

  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return null;
  }

  return Number(numericValue.toFixed(2));
}

function normalizeQuantity(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const numericValue = Number.parseInt(String(value), 10);

  if (!Number.isInteger(numericValue) || numericValue < 0) {
    return null;
  }

  return numericValue;
}

function normalizeTagList(tags) {
  if (!Array.isArray(tags)) {
    return [];
  }

  return Array.from(
    new Set(
      tags
        .map((tag) => normalizeText(String(tag)).toLowerCase())
        .filter(Boolean),
    ),
  );
}

function normalizeVariantDrafts(variants) {
  if (!Array.isArray(variants)) {
    return {
      variants: [],
      errors: [],
    };
  }

  const nextVariants = [];
  const errors = [];

  variants.forEach((variant, index) => {
    const rawName = normalizeText(variant?.variant_name);
    const rawPrice = variant?.price;
    const rawQuantity =
      variant?.stock_quantity ?? variant?.quantity_available ?? variant?.quantity;
    const isCompletelyBlank =
      !rawName &&
      (rawPrice === undefined || rawPrice === null || rawPrice === "") &&
      (rawQuantity === undefined || rawQuantity === null || rawQuantity === "");

    if (isCompletelyBlank) {
      return;
    }

    const normalizedVariantPrice = normalizePrice(rawPrice);
    const normalizedVariantQuantity = normalizeQuantity(rawQuantity);

    if (!rawName) {
      errors.push(`Variant ${index + 1} needs a name`);
      return;
    }

    if (normalizedVariantPrice === null) {
      errors.push(`Variant ${index + 1} needs a valid price`);
      return;
    }

    if (
      rawQuantity !== undefined &&
      rawQuantity !== null &&
      rawQuantity !== "" &&
      normalizedVariantQuantity === null
    ) {
      errors.push(`Variant ${index + 1} needs a valid quantity`);
      return;
    }

    nextVariants.push({
      variant_name: rawName,
      price: normalizedVariantPrice,
      stock_quantity: normalizedVariantQuantity ?? 0,
      in_stock: (normalizedVariantQuantity ?? 0) > 0,
    });
  });

  return {
    variants: nextVariants,
    errors,
  };
}

// Add a product to a store
// - Requires authentication
// - Verifies the requester owns the target store before inserting
router.post("/", authMiddleware, async (req, res) => {
  let client;
  let transactionOpen = false;

  try {
    client = await pool.connect();
    const userId = Number(req.user.id);
    const {
      store_id,
      product_name,
      category,
      description,
      image_url,
      tags,
      price,
      quantity_available,
      stock_quantity,
      variants,
    } = req.body;

    console.log("products/create request", {
      userId,
      store_id,
      product_name,
      category,
      hasVariants: Array.isArray(variants),
      variantCount: Array.isArray(variants) ? variants.length : 0,
    });

    const normalizedStoreId = Number(store_id);
    const normalizedProductName = normalizeText(product_name);
    const normalizedCategory = normalizeNullableText(category);
    const normalizedDescription = normalizeNullableText(description);
    const normalizedImageUrl = normalizeNullableText(image_url);
    const normalizedTags = normalizeTagList(tags);
    const normalizedBasePrice = normalizePrice(price);
    const rawBaseQuantity = quantity_available ?? stock_quantity;
    const normalizedBaseQuantity = normalizeQuantity(rawBaseQuantity);
    const {
      variants: normalizedVariants,
      errors: normalizedVariantErrors,
    } = normalizeVariantDrafts(variants);

    if (!Number.isInteger(normalizedStoreId) || normalizedStoreId <= 0) {
      return res.status(400).json({
        message: "A valid store_id is required",
      });
    }

    if (!normalizedProductName) {
      return res.status(400).json({
        message: "product_name is required",
      });
    }

    if (normalizedVariantErrors.length > 0) {
      return res.status(400).json({
        message: normalizedVariantErrors[0],
        errors: normalizedVariantErrors,
      });
    }

    if (normalizedVariants.length === 0 && normalizedBasePrice === null) {
      return res.status(400).json({
        message: "price is required when no variants are provided",
      });
    }

    if (
      rawBaseQuantity !== undefined &&
      rawBaseQuantity !== null &&
      rawBaseQuantity !== "" &&
      normalizedBaseQuantity === null
    ) {
      return res.status(400).json({
        message: "quantity_available must be a valid quantity",
      });
    }

    const invalidTags = normalizedTags.filter((tag) => !ALLOWED_TAGS.includes(tag));

    if (invalidTags.length > 0) {
      return res.status(400).json({
        message: "Invalid tags selected",
        invalidTags,
      });
    }

    await client.query("BEGIN");
    transactionOpen = true;

    // Ensure target store exists
    const storeResult = await client.query(
      "SELECT id, owner_id, store_name FROM stores WHERE id = $1 FOR UPDATE",
      [normalizedStoreId],
    );

    if (storeResult.rows.length === 0) {
      await client.query("ROLLBACK");
      transactionOpen = false;
      return res.status(404).json({
        message: "Store not found",
      });
    }

    const store = storeResult.rows[0];

    // Authorization: only the store owner can add products
    if (Number(store.owner_id) !== userId) {
      await client.query("ROLLBACK");
      transactionOpen = false;
      return res.status(403).json({
        message: "You are not allowed to add products to this store",
      });
    }

    const newProduct = await client.query(
      `INSERT INTO products (store_id, product_name, category, description, image_url, tags)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        normalizedStoreId,
        normalizedProductName,
        normalizedCategory,
        normalizedDescription,
        normalizedImageUrl,
        normalizedTags,
      ],
    );

    const createdProduct = newProduct.rows[0];
    const variantPayload =
      normalizedVariants.length > 0
        ? normalizedVariants
        : [
            {
              variant_name: null,
              price: normalizedBasePrice,
              stock_quantity: normalizedBaseQuantity ?? 0,
              in_stock: (normalizedBaseQuantity ?? 0) > 0,
            },
          ];

    const createdVariants = [];

    for (const variant of variantPayload) {
      const variantResult = await client.query(
        `
        INSERT INTO product_variants (product_id, variant_name, price, stock_quantity, in_stock)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
        `,
        [
          createdProduct.id,
          variant.variant_name,
          variant.price,
          variant.stock_quantity,
          variant.in_stock,
        ],
      );

      createdVariants.push(variantResult.rows[0]);
    }

    await client.query("COMMIT");
    transactionOpen = false;

    res.status(201).json({
      message: "Product added successfully",
      product: {
        ...createdProduct,
        variants: createdVariants,
      },
    });
  } catch (error) {
    if (client && transactionOpen) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("PRODUCT CREATE ROLLBACK ERROR:", rollbackError);
      }
    }
    console.error("PRODUCT CREATE ERROR:", error);
    console.error("PRODUCT CREATE ERROR MESSAGE:", error?.message || String(error));
    if (error?.stack) {
      console.error("PRODUCT CREATE ERROR STACK:", error.stack);
    }
    res.status(500).json({
      message: "Something went wrong",
    });
  } finally {
    if (client) {
      client.release();
    }
  }
});

// Lightweight public products endpoint for the store page.
// Returns only the fields needed for rendering plus internal ids.
router.get("/", async (req, res) => {
  // Temporary performance-debug logs for store page timing.
  const startedAt = Date.now();

  try {
    const storeId = Number.parseInt(String(req.query.store_id || ""), 10);

    if (Number.isNaN(storeId)) {
      return res.status(400).json({
        message: "Valid store_id query param is required",
      });
    }

    console.log("PRODUCTS API START", {
      route: "/products?store_id=:id",
      storeId,
    });

    const productsQueryStartedAt = Date.now();
    const productsResult = await pool.query(
      `
      SELECT
        p.id AS product_id,
        p.product_name,
        p.image_url
      FROM products p
      WHERE p.store_id = $1
      ORDER BY p.id DESC
      `,
      [storeId],
    );
    const productsQueryDurationMs = Date.now() - productsQueryStartedAt;

    console.log("products?store_id=:id products query", {
      storeId,
      duration_ms: productsQueryDurationMs,
      row_count: productsResult.rowCount,
    });

    if (productsResult.rows.length === 0) {
      console.log("PRODUCTS API END", {
        route: "/products?store_id=:id",
        storeId,
        productCount: 0,
        variantCount: 0,
        duration_ms: Date.now() - startedAt,
      });

      return res.json({
        message: "Store products fetched successfully",
        products: [],
      });
    }

    const productIds = productsResult.rows.map((product) => product.product_id);
    const variantsQueryStartedAt = Date.now();
    const variantsResult = await pool.query(
      `
      SELECT
        pv.product_id,
        pv.id AS variant_id,
        pv.variant_name,
        pv.price
      FROM product_variants pv
      WHERE pv.product_id = ANY($1::int[])
      ORDER BY pv.product_id DESC, pv.id ASC
      `,
      [productIds],
    );
    const variantsQueryDurationMs = Date.now() - variantsQueryStartedAt;

    console.log("products?store_id=:id variants query", {
      storeId,
      duration_ms: variantsQueryDurationMs,
      row_count: variantsResult.rowCount,
    });

    const normalizeNumbers = (val) =>
      typeof val === "string" && val.trim() !== "" ? Number(val) : val;

    const variantsByProductId = new Map();

    for (const variant of variantsResult.rows) {
      const nextVariant = {
        variant_id: variant.variant_id,
        variant_name: variant.variant_name,
        price: normalizeNumbers(variant.price),
      };

      const currentVariants = variantsByProductId.get(variant.product_id) || [];
      currentVariants.push(nextVariant);
      variantsByProductId.set(variant.product_id, currentVariants);
    }

    const products = productsResult.rows.map((product) => ({
      product_id: product.product_id,
      product_name: product.product_name,
      image_url: product.image_url,
      variants: variantsByProductId.get(product.product_id) || [],
    }));

    console.log("PRODUCTS API END", {
      route: "/products?store_id=:id",
      storeId,
      productCount: products.length,
      variantCount: variantsResult.rowCount,
      duration_ms: Date.now() - startedAt,
    });

    return res.json({
      message: "Store products fetched successfully",
      products,
    });
  } catch (error) {
    console.error("PRODUCTS API ERROR", {
      route: "/products?store_id=:id",
      storeId: req.query.store_id,
      error: error?.message || String(error),
      duration_ms: Date.now() - startedAt,
    });

    return res.status(500).json({
      message: "Something went wrong",
      products: [],
    });
  }
});

// Get all products for a store (public)
router.get("/:storeId", async (req, res) => {
  try {
    const { storeId } = req.params;

    const products = await pool.query(
      "SELECT * FROM products WHERE store_id = $1 ORDER BY created_at DESC",
      [storeId]
    );

    res.json({
      message: "Products fetched successfully",
      products: products.rows,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Something went wrong",
    });
  }
});

// Update a product
// - Requires auth and ownership of the parent store
router.put("/:id", authMiddleware, async (req, res) => {
  let client;
  let transactionOpen = false;

  try {
    client = await pool.connect();
    const userId = Number(req.user.id);
    const { id } = req.params;
    const {
      product_name,
      category,
      description,
      image_url,
      tags,
      price,
      quantity_available,
      stock_quantity,
      variants,
    } = req.body;

    const productResult = await client.query(
      `
      SELECT products.*, stores.owner_id
      FROM products
      JOIN stores ON products.store_id = stores.id
      WHERE products.id = $1
      `,
      [id]
    );

    if (productResult.rows.length === 0) {
      return res.status(404).json({
        message: "Product not found",
      });
    }

    const product = productResult.rows[0];
    const existingVariantsResult = await client.query(
      `
      SELECT id, variant_name, price, stock_quantity, in_stock
      FROM product_variants
      WHERE product_id = $1
      ORDER BY id
      `,
      [id],
    );
    const existingVariants = existingVariantsResult.rows;

    const finalTags =
      tags !== undefined ? normalizeTagList(tags) : product.tags || [];

    const invalidTags = finalTags.filter((tag) => !ALLOWED_TAGS.includes(tag));

    if (invalidTags.length > 0) {
      return res.status(400).json({
        message: "Invalid tags selected",
        invalidTags,
      });
    }

    // Authorization: confirm requesting user is the store owner
    if (Number(product.owner_id) !== userId) {
      return res.status(403).json({
        message: "You are not allowed to update this product",
      });
    }

    const normalizedProductName =
      product_name !== undefined
        ? normalizeText(product_name) || product.product_name
        : product.product_name;
    const normalizedCategory =
      category !== undefined ? normalizeNullableText(category) : product.category;
    const normalizedDescription =
      description !== undefined
        ? normalizeNullableText(description)
        : product.description;
    const normalizedImageUrl =
      image_url !== undefined ? normalizeNullableText(image_url) : product.image_url;

    const normalizedBasePrice = normalizePrice(price);
    const rawBaseQuantity = quantity_available ?? stock_quantity;
    const normalizedBaseQuantity = normalizeQuantity(rawBaseQuantity);
    const {
      variants: normalizedVariants,
      errors: normalizedVariantErrors,
    } = normalizeVariantDrafts(variants);
    const shouldReplaceVariants =
      Array.isArray(variants) ||
      price !== undefined ||
      quantity_available !== undefined ||
      stock_quantity !== undefined;

    if (normalizedVariantErrors.length > 0) {
      return res.status(400).json({
        message: normalizedVariantErrors[0],
        errors: normalizedVariantErrors,
      });
    }

    if (
      rawBaseQuantity !== undefined &&
      rawBaseQuantity !== null &&
      rawBaseQuantity !== "" &&
      normalizedBaseQuantity === null
    ) {
      return res.status(400).json({
        message: "quantity_available must be a valid quantity",
      });
    }

    const existingDefaultVariant =
      existingVariants.length === 1 ? existingVariants[0] : null;
    const fallbackBasePrice =
      normalizedBasePrice !== null
        ? normalizedBasePrice
        : existingDefaultVariant
          ? normalizePrice(existingDefaultVariant.price)
          : null;
    const fallbackBaseQuantity =
      normalizedBaseQuantity !== null
        ? normalizedBaseQuantity
        : existingDefaultVariant
          ? normalizeQuantity(existingDefaultVariant.stock_quantity) ?? 0
          : 0;

    if (shouldReplaceVariants && normalizedVariants.length === 0 && fallbackBasePrice === null) {
      return res.status(400).json({
        message: "price is required when no variants are provided",
      });
    }

    await client.query("BEGIN");
    transactionOpen = true;

    const updatedProduct = await client.query(
      `
      UPDATE products
      SET product_name = $1,
          category = $2,
          description = $3,
          image_url = $4,
          tags = $5
      WHERE id = $6
      RETURNING *
      `,
      [
        normalizedProductName,
        normalizedCategory,
        normalizedDescription,
        normalizedImageUrl,
        finalTags,
        id,
      ]
    );

    let nextVariants = existingVariants;

    if (shouldReplaceVariants) {
      await client.query("DELETE FROM product_variants WHERE product_id = $1", [id]);

      const variantPayload =
        normalizedVariants.length > 0
          ? normalizedVariants
          : [
              {
                variant_name: null,
                price: fallbackBasePrice,
                stock_quantity: fallbackBaseQuantity,
                in_stock: fallbackBaseQuantity > 0,
              },
            ];

      nextVariants = [];

      for (const variant of variantPayload) {
        const variantResult = await client.query(
          `
          INSERT INTO product_variants (product_id, variant_name, price, stock_quantity, in_stock)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING *
          `,
          [
            id,
            variant.variant_name,
            variant.price,
            variant.stock_quantity,
            variant.in_stock,
          ],
        );

        nextVariants.push(variantResult.rows[0]);
      }
    }

    await client.query("COMMIT");
    transactionOpen = false;

    res.json({
      message: "Product updated successfully",
      product: {
        ...updatedProduct.rows[0],
        variants: nextVariants,
      },
    });
  } catch (error) {
    if (client && transactionOpen) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("PRODUCT UPDATE ROLLBACK ERROR:", rollbackError);
      }
    }
    console.error(error);
    res.status(500).json({
      message: "Something went wrong",
    });
  } finally {
    if (client) {
      client.release();
    }
  }
});

// Delete a product
// - Requires auth and ownership of the parent store
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const userId = Number(req.user.id);
    const { id } = req.params;

    const productResult = await pool.query(
      `
      SELECT products.*, stores.owner_id
      FROM products
      JOIN stores ON products.store_id = stores.id
      WHERE products.id = $1
      `,
      [id]
    );

    if (productResult.rows.length === 0) {
      return res.status(404).json({
        message: "Product not found",
      });
    }

    const product = productResult.rows[0];

    // Authorization: confirm requesting user is the store owner
    if (Number(product.owner_id) !== userId) {
      return res.status(403).json({
        message: "You are not allowed to delete this product",
      });
    }

    await pool.query("DELETE FROM products WHERE id = $1", [id]);

    res.json({
      message: "Product deleted successfully",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Something went wrong",
    });
  }
});

module.exports = router;
