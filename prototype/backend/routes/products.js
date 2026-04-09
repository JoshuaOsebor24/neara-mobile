// Product routes
// - Manage products within a store (create, list, update, delete)
// - Protected endpoints require authentication and ownership checks
const express = require("express");
const { Buffer } = require("node:buffer");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

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

function normalizeUnitCount(value) {
  if (value === undefined || value === null || value === "") {
    return 1;
  }

  const numericValue = Number.parseInt(String(value), 10);

  if (!Number.isInteger(numericValue) || numericValue <= 0) {
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

function parseCsvRows(text) {
  const rows = [];
  let currentField = "";
  let currentRow = [];
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const nextCharacter = text[index + 1];

    if (character === '"') {
      if (inQuotes && nextCharacter === '"') {
        currentField += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (character === "," && !inQuotes) {
      currentRow.push(currentField);
      currentField = "";
      continue;
    }

    if ((character === "\n" || character === "\r") && !inQuotes) {
      if (character === "\r" && nextCharacter === "\n") {
        index += 1;
      }

      currentRow.push(currentField);

      if (currentRow.some((value) => value.length > 0)) {
        rows.push(currentRow);
      }

      currentField = "";
      currentRow = [];
      continue;
    }

    currentField += character;
  }

  currentRow.push(currentField);

  if (currentRow.some((value) => value.length > 0)) {
    rows.push(currentRow);
  }

  return rows;
}

function readMultipartRequest(req, { maxBytes = 5 * 1024 * 1024 } = {}) {
  return new Promise((resolve, reject) => {
    const contentType = String(req.headers["content-type"] || "");
    const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
    const boundary = boundaryMatch?.[1] || boundaryMatch?.[2];

    if (!boundary) {
      reject(new Error("Missing multipart boundary"));
      return;
    }

    let totalBytes = 0;
    const chunks = [];

    req.on("data", (chunk) => {
      totalBytes += chunk.length;

      if (totalBytes > maxBytes) {
        reject(new Error("Uploaded file is too large"));
        req.destroy();
        return;
      }

      chunks.push(chunk);
    });

    req.on("end", () => {
      try {
        const rawBody = Buffer.concat(chunks).toString("latin1");
        const boundaryMarker = `--${boundary}`;
        const segments = rawBody
          .split(boundaryMarker)
          .slice(1, -1)
          .map((segment) => segment.replace(/^\r\n/, "").replace(/\r\n$/, ""));
        const fields = {};
        const files = [];

        segments.forEach((segment) => {
          const headerEndIndex = segment.indexOf("\r\n\r\n");

          if (headerEndIndex < 0) {
            return;
          }

          const rawHeaders = segment.slice(0, headerEndIndex);
          const rawValue = segment.slice(headerEndIndex + 4).replace(/\r\n$/, "");
          const headers = rawHeaders.split("\r\n");
          const dispositionHeader =
            headers.find((header) =>
              header.toLowerCase().startsWith("content-disposition:"),
            ) || "";
          const nameMatch = dispositionHeader.match(/name="([^"]+)"/i);
          const filenameMatch = dispositionHeader.match(/filename="([^"]*)"/i);
          const fieldName = nameMatch?.[1];

          if (!fieldName) {
            return;
          }

          const valueBuffer = Buffer.from(rawValue, "latin1");

          if (filenameMatch) {
            files.push({
              fieldName,
              filename: filenameMatch[1],
              text: valueBuffer.toString("utf8"),
            });
            return;
          }

          fields[fieldName] = valueBuffer.toString("utf8").trim();
        });

        resolve({
          fields,
          files,
        });
      } catch (error) {
        reject(error);
      }
    });

    req.on("error", reject);
  });
}

function parseImportedProductsCsv(csvText) {
  const rows = parseCsvRows(csvText);

  if (rows.length === 0) {
    return {
      errors: [
        {
          message: "CSV file is empty",
          row: 1,
        },
      ],
      products: [],
    };
  }

  const headerRow = rows[0].map((value) =>
    normalizeText(value.replace(/^\uFEFF/, "")).toLowerCase(),
  );
  const requiredHeaders = ["product_name", "variant_name", "price"];
  const missingHeaders = requiredHeaders.filter(
    (header) => !headerRow.includes(header),
  );

  if (missingHeaders.length > 0) {
    return {
      errors: [
        {
          message: `Missing required columns: ${missingHeaders.join(", ")}`,
          row: 1,
        },
      ],
      products: [],
    };
  }

  const headerIndex = new Map(headerRow.map((header, index) => [header, index]));
  const groupedProducts = new Map();
  const errors = [];

  rows.slice(1).forEach((row, index) => {
    const rowNumber = index + 2;
    const getValue = (key) =>
      normalizeText(String(row[headerIndex.get(key)] ?? "").replace(/^\uFEFF/, ""));

    const productName = getValue("product_name");
    const variantName = getValue("variant_name");
    const rawPrice = getValue("price");
    const rawUnitCount = getValue("unit_count");
    const rawStock = getValue("stock");
    const description = normalizeNullableText(getValue("description"));
    const category = normalizeNullableText(getValue("category"));
    const tags = normalizeTagList(
      getValue("tags")
        .split(",")
        .map((tag) => tag.trim()),
    );

    if (
      !productName &&
      !variantName &&
      !rawPrice &&
      !rawUnitCount &&
      !rawStock &&
      !description &&
      !category &&
      tags.length === 0
    ) {
      return;
    }

    const price = normalizePrice(rawPrice);
    const unitCount = normalizeUnitCount(rawUnitCount);
    const stock = normalizeQuantity(rawStock);

    if (!productName) {
      errors.push({ message: "missing product_name", row: rowNumber });
      return;
    }

    if (!variantName) {
      errors.push({ message: "missing variant_name", row: rowNumber });
      return;
    }

    if (price === null) {
      errors.push({ message: "invalid price", row: rowNumber });
      return;
    }

    if (unitCount === null) {
      errors.push({ message: "invalid unit_count", row: rowNumber });
      return;
    }

    if (rawStock && stock === null) {
      errors.push({ message: "invalid stock", row: rowNumber });
      return;
    }

    const groupKey = productName.toLowerCase();
    const existingGroup = groupedProducts.get(groupKey);
    const nextVariant = {
      in_stock: (stock ?? 0) > 0,
      price,
      stock_quantity: stock ?? 0,
      unit_count: unitCount ?? 1,
      variant_name: variantName,
    };

    if (!existingGroup) {
      groupedProducts.set(groupKey, {
        category,
        description,
        productName,
        rowNumbers: [rowNumber],
        tags,
        variants: [nextVariant],
      });
      return;
    }

    if (
      category &&
      existingGroup.category &&
      category.toLowerCase() !== existingGroup.category.toLowerCase()
    ) {
      errors.push({
        message: `category conflicts with earlier rows for ${productName}`,
        row: rowNumber,
      });
      return;
    }

    if (
      description &&
      existingGroup.description &&
      description !== existingGroup.description
    ) {
      errors.push({
        message: `description conflicts with earlier rows for ${productName}`,
        row: rowNumber,
      });
      return;
    }

    existingGroup.category = existingGroup.category || category;
    existingGroup.description = existingGroup.description || description;
    existingGroup.tags = Array.from(new Set([...existingGroup.tags, ...tags]));
    existingGroup.rowNumbers.push(rowNumber);
    existingGroup.variants.push(nextVariant);
  });

  return {
    errors,
    products: Array.from(groupedProducts.values()),
  };
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
    const rawUnitCount = variant?.unit_count;
    const isCompletelyBlank =
      !rawName &&
      (rawPrice === undefined || rawPrice === null || rawPrice === "") &&
      (rawQuantity === undefined || rawQuantity === null || rawQuantity === "") &&
      (rawUnitCount === undefined || rawUnitCount === null || rawUnitCount === "");

    if (isCompletelyBlank) {
      return;
    }

    const normalizedVariantPrice = normalizePrice(rawPrice);
    const normalizedVariantQuantity = normalizeQuantity(rawQuantity);
    const normalizedUnitCount = normalizeUnitCount(rawUnitCount);

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

    if (normalizedUnitCount === null) {
      errors.push(`Variant ${index + 1} needs a valid unit_count`);
      return;
    }

    nextVariants.push({
      variant_name: rawName,
      price: normalizedVariantPrice,
      unit_count: normalizedUnitCount,
      stock_quantity: normalizedVariantQuantity ?? 0,
      in_stock: (normalizedVariantQuantity ?? 0) > 0,
    });
  });

  return {
    variants: nextVariants,
    errors,
  };
}

async function getOwnedStoreForUpdate(client, storeId, userId) {
  const storeResult = await client.query(
    "SELECT id, owner_id, store_name FROM stores WHERE id = $1 FOR UPDATE",
    [storeId],
  );

  if (storeResult.rows.length === 0) {
    return {
      error: {
        message: "Store not found",
        status: 404,
      },
      store: null,
    };
  }

  const store = storeResult.rows[0];

  if (Number(store.owner_id) !== userId) {
    return {
      error: {
        message: "You are not allowed to add products to this store",
        status: 403,
      },
      store: null,
    };
  }

  return {
    error: null,
    store,
  };
}

async function insertProductWithVariants(client, payload) {
  const newProduct = await client.query(
    `INSERT INTO products (store_id, product_name, category, description, image_url, tags)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      payload.storeId,
      payload.productName,
      payload.category,
      payload.description,
      payload.imageUrl,
      payload.tags,
    ],
  );

  const createdProduct = newProduct.rows[0];
  const variantPayload =
    payload.variants.length > 0
      ? payload.variants
      : [
            {
              variant_name: null,
              price: payload.basePrice,
              unit_count: payload.unitCount ?? 1,
              stock_quantity: payload.baseQuantity ?? 0,
              in_stock: (payload.baseQuantity ?? 0) > 0,
            },
        ];

  const createdVariants = [];

  for (const variant of variantPayload) {
    const variantResult = await client.query(
      `
      INSERT INTO product_variants (product_id, variant_name, price, unit_count, stock_quantity, in_stock)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
      `,
      [
        createdProduct.id,
        variant.variant_name,
        variant.price,
        variant.unit_count ?? 1,
        variant.stock_quantity,
        variant.in_stock,
      ],
    );

    createdVariants.push(variantResult.rows[0]);
  }

  return {
    ...createdProduct,
    variants: createdVariants,
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
      unit_count,
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
    const normalizedUnitCount = normalizeUnitCount(unit_count);
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

    if (normalizedUnitCount === null) {
      return res.status(400).json({
        message: "unit_count must be a valid positive number",
      });
    }

    await client.query("BEGIN");
    transactionOpen = true;

    const storeAccess = await getOwnedStoreForUpdate(
      client,
      normalizedStoreId,
      userId,
    );

    if (storeAccess.error) {
      await client.query("ROLLBACK");
      transactionOpen = false;
      return res.status(storeAccess.error.status).json({
        message: storeAccess.error.message,
      });
    }
    const createdProduct = await insertProductWithVariants(client, {
      basePrice: normalizedBasePrice,
      baseQuantity: normalizedBaseQuantity,
      category: normalizedCategory,
      description: normalizedDescription,
      imageUrl: normalizedImageUrl,
      productName: normalizedProductName,
      storeId: normalizedStoreId,
      tags: normalizedTags,
      unitCount: normalizedUnitCount,
      variants: normalizedVariants,
    });

    await client.query("COMMIT");
    transactionOpen = false;

    res.status(201).json({
      message: "Product added successfully",
      product: createdProduct,
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

router.post("/bulk", authMiddleware, async (req, res) => {
  let client;
  let transactionOpen = false;

  try {
    client = await pool.connect();
    const userId = Number(req.user.id);
    const normalizedStoreId = Number(req.body?.store_id);
    const inputProducts = Array.isArray(req.body?.products) ? req.body.products : [];

    if (!Number.isInteger(normalizedStoreId) || normalizedStoreId <= 0) {
      return res.status(400).json({
        message: "A valid store_id is required",
      });
    }

    await client.query("BEGIN");
    transactionOpen = true;

    const storeAccess = await getOwnedStoreForUpdate(
      client,
      normalizedStoreId,
      userId,
    );

    if (storeAccess.error) {
      await client.query("ROLLBACK");
      transactionOpen = false;
      return res.status(storeAccess.error.status).json({
        message: storeAccess.error.message,
      });
    }

    const normalizedProducts = inputProducts
      .map((product) => {
        const productName = normalizeText(
          product?.product_name ?? product?.name,
        );
        const basePrice = normalizePrice(product?.price);
        const category = normalizeNullableText(product?.category);
        const tags = normalizeTagList(product?.tags);
        const unitCount = normalizeUnitCount(product?.unit_count);
        const isEmptyRow =
          !productName &&
          (product?.price === undefined ||
            product?.price === null ||
            product?.price === "") &&
          (product?.unit_count === undefined ||
            product?.unit_count === null ||
            product?.unit_count === "");

        return {
          basePrice,
          category,
          isEmptyRow,
          productName,
          rawPrice: product?.price,
          tags,
          unitCount,
        };
      })
      .filter((product) => !product.isEmptyRow);

    if (normalizedProducts.length === 0) {
      await client.query("ROLLBACK");
      transactionOpen = false;
      return res.status(400).json({
        message: "Add at least one valid product row.",
      });
    }

    for (let index = 0; index < normalizedProducts.length; index += 1) {
      const product = normalizedProducts[index];

      if (!product.productName) {
        await client.query("ROLLBACK");
        transactionOpen = false;
        return res.status(400).json({
          message: `Product ${index + 1} needs a name.`,
        });
      }

      if (product.basePrice === null) {
        await client.query("ROLLBACK");
        transactionOpen = false;
        return res.status(400).json({
          message: `Product ${index + 1} needs a valid price.`,
        });
      }

      if (product.unitCount === null) {
        await client.query("ROLLBACK");
        transactionOpen = false;
        return res.status(400).json({
          message: `Product ${index + 1} needs a valid unit_count.`,
        });
      }
    }

    const createdProducts = [];

    for (const product of normalizedProducts) {
      const createdProduct = await insertProductWithVariants(client, {
        basePrice: product.basePrice,
        baseQuantity: 0,
        category: product.category,
        description: null,
        imageUrl: null,
        productName: product.productName,
        storeId: normalizedStoreId,
        tags: product.tags,
        unitCount: product.unitCount ?? 1,
        variants: [],
      });

      createdProducts.push(createdProduct);
    }

    await client.query("COMMIT");
    transactionOpen = false;

    return res.status(201).json({
      count: createdProducts.length,
      message: "Products added successfully",
      products: createdProducts,
    });
  } catch (error) {
    if (client && transactionOpen) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("PRODUCT BULK CREATE ROLLBACK ERROR:", rollbackError);
      }
    }

    console.error("PRODUCT BULK CREATE ERROR:", error);
    return res.status(500).json({
      message: "Something went wrong",
    });
  } finally {
    if (client) {
      client.release();
    }
  }
});

router.post("/import", authMiddleware, async (req, res) => {
  let client;
  let transactionOpen = false;

  try {
    client = await pool.connect();
    const userId = Number(req.user.id);
    const { fields, files } = await readMultipartRequest(req);
    const normalizedStoreId = Number(fields.store_id);
    const csvFile = files.find((file) => file.fieldName === "file") || files[0];

    if (!Number.isInteger(normalizedStoreId) || normalizedStoreId <= 0) {
      return res.status(400).json({
        message: "A valid store_id is required",
      });
    }

    if (!csvFile || !normalizeText(csvFile.text)) {
      return res.status(400).json({
        message: "Upload a CSV file to import products.",
      });
    }

    const parsedImport = parseImportedProductsCsv(csvFile.text);

    if (parsedImport.errors.length > 0) {
      return res.status(400).json({
        errors: parsedImport.errors,
        message: "Fix the CSV errors and try again.",
      });
    }

    if (parsedImport.products.length === 0) {
      return res.status(400).json({
        message: "The CSV file does not contain any product rows.",
      });
    }

    await client.query("BEGIN");
    transactionOpen = true;

    const storeAccess = await getOwnedStoreForUpdate(
      client,
      normalizedStoreId,
      userId,
    );

    if (storeAccess.error) {
      await client.query("ROLLBACK");
      transactionOpen = false;
      return res.status(storeAccess.error.status).json({
        message: storeAccess.error.message,
      });
    }

    const createdProducts = [];

    for (const product of parsedImport.products) {
      const createdProduct = await insertProductWithVariants(client, {
        basePrice: null,
        baseQuantity: 0,
        category: product.category,
        description: product.description,
        imageUrl: null,
        productName: product.productName,
        storeId: normalizedStoreId,
        tags: product.tags,
        unitCount: 1,
        variants: product.variants,
      });

      createdProducts.push({
        product_id: createdProduct.id,
        product_name: createdProduct.product_name,
        variant_count: createdProduct.variants.length,
      });
    }

    await client.query("COMMIT");
    transactionOpen = false;

    return res.status(201).json({
      count: createdProducts.length,
      message: "Products imported successfully",
      products: createdProducts,
    });
  } catch (error) {
    if (client && transactionOpen) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("PRODUCT IMPORT ROLLBACK ERROR:", rollbackError);
      }
    }

    console.error("PRODUCT IMPORT ERROR:", error);

    const errorMessage = error?.message || String(error);
    const statusCode =
      errorMessage === "Missing multipart boundary" ? 400
        : errorMessage === "Uploaded file is too large" ? 413
        : 500;

    return res.status(statusCode).json({
      message:
        statusCode === 500
          ? "Something went wrong"
          : errorMessage,
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
        pv.unit_count,
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
        unit_count:
          typeof variant.unit_count === "number"
            ? variant.unit_count
            : Number(variant.unit_count || 1),
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
      unit_count,
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
      , unit_count
      FROM product_variants
      WHERE product_id = $1
      ORDER BY id
      `,
      [id],
    );
    const existingVariants = existingVariantsResult.rows;

    const finalTags =
      tags !== undefined ? normalizeTagList(tags) : product.tags || [];

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
    const normalizedUnitCount = normalizeUnitCount(unit_count);
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

    if (normalizedUnitCount === null) {
      return res.status(400).json({
        message: "unit_count must be a valid positive number",
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
    const fallbackUnitCount =
      normalizedUnitCount !== null
        ? normalizedUnitCount
        : existingDefaultVariant
          ? normalizeUnitCount(existingDefaultVariant.unit_count) ?? 1
          : 1;

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
          tags = $5,
          updated_at = NOW()
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
                unit_count: fallbackUnitCount,
                stock_quantity: fallbackBaseQuantity,
                in_stock: fallbackBaseQuantity > 0,
              },
            ];

      nextVariants = [];

      for (const variant of variantPayload) {
        const variantResult = await client.query(
          `
          INSERT INTO product_variants (product_id, variant_name, price, unit_count, stock_quantity, in_stock)
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING *
          `,
          [
            id,
            variant.variant_name,
            variant.price,
            variant.unit_count ?? 1,
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
