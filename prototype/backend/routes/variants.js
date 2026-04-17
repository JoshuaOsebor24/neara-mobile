// Variant routes
// - Manage product variants (create, update, delete)
// - Ensures the requester owns the parent store/product before changes
const express = require("express");
const pool = require("../config/db");

const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

// Add a variant to a product
// - Checks product exists and that the authenticated user owns it
router.post("/", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { product_id, variant_name, price, stock_quantity, unit_count } =
      req.body;

    if (!product_id || !variant_name || price === undefined) {
      return res.status(400).json({
        message: "product_id, variant_name, and price are required",
      });
    }

    const productResult = await pool.query(
      `
      SELECT products.*, stores.owner_id
      FROM products
      JOIN stores ON products.store_id = stores.id
      WHERE products.id = $1
      `,
      [product_id],
    );

    if (productResult.rows.length === 0) {
      return res.status(404).json({
        message: "Product not found",
      });
    }

    const product = productResult.rows[0];

    // Authorization: only store owner can add variants
    if (product.owner_id !== userId) {
      return res.status(403).json({
        message: "You are not allowed to add variants to this product",
      });
    }

    const finalStockQuantity =
      stock_quantity !== undefined ? Number(stock_quantity) : 0;
    const finalUnitCount =
      unit_count !== undefined ? Number.parseInt(String(unit_count), 10) : 1;

    if (!Number.isInteger(finalUnitCount) || finalUnitCount <= 0) {
      return res.status(400).json({
        message: "unit_count must be a valid positive number",
      });
    }
    const finalInStock = finalStockQuantity > 0;

    const newVariant = await pool.query(
      `
      INSERT INTO product_variants (product_id, variant_name, price, unit_count, stock_quantity, in_stock)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
      `,
      [
        product_id,
        variant_name,
        price,
        finalUnitCount,
        finalStockQuantity,
        finalInStock,
      ],
    );

    res.status(201).json({
      message: "Variant added successfully",
      variant: newVariant.rows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Something went wrong",
    });
  }
});

// Update a variant
// - Verifies ownership of the parent store before allowing update
router.put("/:id", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { variant_name, price, stock_quantity, unit_count } = req.body;

    const variantResult = await pool.query(
      `
      SELECT product_variants.*, stores.owner_id
      FROM product_variants
      JOIN products ON product_variants.product_id = products.id
      JOIN stores ON products.store_id = stores.id
      WHERE product_variants.id = $1
      `,
      [id],
    );

    if (variantResult.rows.length === 0) {
      return res.status(404).json({
        message: "Variant not found",
      });
    }

    const variant = variantResult.rows[0];

    // Authorization: only store owner may update the variant
    if (variant.owner_id !== userId) {
      return res.status(403).json({
        message: "You are not allowed to update this variant",
      });
    }

    const normalizedVariantName =
      variant_name !== undefined
        ? String(variant_name || "").trim() || null
        : variant.variant_name;
    const finalPrice =
      price !== undefined ? Number(price) : Number(variant.price);
    const finalStockQuantity =
      stock_quantity !== undefined
        ? Number(stock_quantity)
        : Number(variant.stock_quantity ?? 0);
    const finalUnitCount =
      unit_count !== undefined
        ? Number.parseInt(String(unit_count), 10)
        : Number.parseInt(String(variant.unit_count ?? 1), 10);

    if (!Number.isFinite(finalPrice) || finalPrice < 0) {
      return res.status(400).json({
        message: "price must be a valid non-negative number",
      });
    }

    if (!Number.isFinite(finalStockQuantity) || finalStockQuantity < 0) {
      return res.status(400).json({
        message: "stock_quantity must be a valid non-negative number",
      });
    }

    if (!Number.isInteger(finalUnitCount) || finalUnitCount <= 0) {
      return res.status(400).json({
        message: "unit_count must be a valid positive number",
      });
    }

    const finalInStock = finalStockQuantity > 0;

    const updatedVariant = await pool.query(
      `
      UPDATE product_variants
      SET variant_name = $1,
          price = $2,
          stock_quantity = $3,
          in_stock = $4,
          unit_count = $5
      WHERE id = $6
      RETURNING *
      `,
      [
        normalizedVariantName,
        finalPrice,
        finalStockQuantity,
        finalInStock,
        finalUnitCount,
        id,
      ],
    );

    res.json({
      message: "Variant updated successfully",
      variant: updatedVariant.rows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Something went wrong",
    });
  }
});

// Delete a variant
// - Requires auth and ownership of the parent store
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const variantResult = await pool.query(
      `
      SELECT product_variants.*, stores.owner_id
      FROM product_variants
      JOIN products ON product_variants.product_id = products.id
      JOIN stores ON products.store_id = stores.id
      WHERE product_variants.id = $1
      `,
      [id],
    );

    if (variantResult.rows.length === 0) {
      return res.status(404).json({
        message: "Variant not found",
      });
    }

    const variant = variantResult.rows[0];

    // Authorization: only store owner may delete the variant
    if (variant.owner_id !== userId) {
      return res.status(403).json({
        message: "You are not allowed to delete this variant",
      });
    }

    await pool.query("DELETE FROM product_variants WHERE id = $1", [id]);

    res.json({
      message: "Variant deleted successfully",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Something went wrong",
    });
  }
});

module.exports = router;
