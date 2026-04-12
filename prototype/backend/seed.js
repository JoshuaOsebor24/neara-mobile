require("dotenv").config();

const bcrypt = require("bcrypt");
const ensureSchema = require("./config/ensureSchema");
const pool = require("./config/db");
const {
  purgeManagedSeedStores,
  STORE_BLUEPRINTS,
} = require("./seedData/osborneStores");

const PASSWORD_HASH_ROUNDS = 8;
const DEFAULT_PASSWORD = "NearaSeed123!";



function normalizeHeaderImages(headerImages, fallbackImageUrl = null) {
  const list = Array.isArray(headerImages) ? headerImages : [];
  const normalized = list
    .map((item) => (typeof item === "string" && item.trim() ? item.trim() : null))
    .filter(Boolean);

  if (normalized.length > 0) {
    return normalized;
  }

  return typeof fallbackImageUrl === "string" && fallbackImageUrl.trim()
    ? [fallbackImageUrl.trim()]
    : [];
}

function buildOwnerRoles(premiumStatus, isOwner) {
  return [
    "user",
    ...(premiumStatus ? ["pro"] : []),
    ...(isOwner ? ["store_owner"] : []),
  ];
}

async function ensureUser(client, user, options = {}) {
  const premiumStatus = Boolean(options.premiumStatus);
  const isOwner = Boolean(options.isOwner);
  const nextRoles = buildOwnerRoles(premiumStatus, isOwner);
  const passwordHash = await bcrypt.hash(options.password || DEFAULT_PASSWORD, PASSWORD_HASH_ROUNDS);

  const existing = await client.query(
    `
      SELECT id
      FROM users
      WHERE LOWER(email) = LOWER($1)
      LIMIT 1
    `,
    [user.email],
  );

  if (existing.rows[0]) {
    const { rows } = await client.query(
      `
        UPDATE users
        SET
          name = $2,
          password_hash = $3,
          phone_number = $4,
          premium_status = $5,
          roles = $6
        WHERE id = $1
        RETURNING id, name, email
      `,
      [
        existing.rows[0].id,
        user.name,
        passwordHash,
        user.phone_number || null,
        premiumStatus,
        nextRoles,
      ],
    );

    return rows[0];
  }

  const { rows } = await client.query(
    `
      INSERT INTO users (name, email, password_hash, phone_number, premium_status, roles)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, name, email
    `,
    [
      user.name,
      user.email,
      passwordHash,
      user.phone_number || null,
      premiumStatus,
      nextRoles,
    ],
  );

  return rows[0];
}

async function ensureStore(client, storeData, ownerId) {
  const existing = await client.query(
    `
      SELECT id
      FROM stores
      WHERE LOWER(store_name) = LOWER($1)
      LIMIT 1
    `,
    [storeData.store_name],
  );

  const headerImages = normalizeHeaderImages(storeData.header_images, storeData.image_url);

  if (existing.rows[0]) {
    const { rows } = await client.query(
      `
        UPDATE stores
        SET
          owner_id = $2,
          category = $3,
          address = $4,
          state = $5,
          country = $6,
          latitude = $7,
          longitude = $8,
          phone_number = $9,
          is_suspended = FALSE,
          image_url = $10,
          header_images = $11::jsonb,
          description = $12,
          delivery_available = $13,
          verified = $14,
          subscription_tier = $15
        WHERE id = $1
        RETURNING id
      `,
      [
        existing.rows[0].id,
        ownerId,
        storeData.category,
        storeData.address,
        storeData.state || null,
        storeData.country || null,
        storeData.latitude,
        storeData.longitude,
        storeData.phone_number || null,
        storeData.image_url || null,
        JSON.stringify(headerImages),
        storeData.description || null,
        Boolean(storeData.delivery_available),
        Boolean(storeData.verified),
        Number.isInteger(storeData.subscription_tier) ? storeData.subscription_tier : 1,
      ],
    );

    return { id: rows[0].id, created: false };
  }

  const { rows } = await client.query(
    `
      INSERT INTO stores (
        owner_id,
        store_name,
        category,
        address,
        state,
        country,
        latitude,
        longitude,
        phone_number,
        is_suspended,
        image_url,
        header_images,
        description,
        delivery_available,
        verified,
        subscription_tier
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, FALSE, $10, $11::jsonb, $12, $13, $14, $15)
      RETURNING id
    `,
    [
      ownerId,
      storeData.store_name,
      storeData.category,
      storeData.address,
      storeData.state || null,
      storeData.country || null,
      storeData.latitude,
      storeData.longitude,
      storeData.phone_number || null,
      storeData.image_url || null,
      JSON.stringify(headerImages),
      storeData.description || null,
      Boolean(storeData.delivery_available),
      Boolean(storeData.verified),
      Number.isInteger(storeData.subscription_tier) ? storeData.subscription_tier : 1,
    ],
  );

  return { id: rows[0].id, created: true };
}

async function ensureProduct(client, storeId, product) {
  const existing = await client.query(
    `
      SELECT id
      FROM products
      WHERE store_id = $1
        AND LOWER(product_name) = LOWER($2)
      LIMIT 1
    `,
    [storeId, product.product_name],
  );

  if (existing.rows[0]) {
    const { rows } = await client.query(
      `
        UPDATE products
        SET
          category = $2,
          description = $3,
          image_url = $4,
          tags = $5
        WHERE id = $1
        RETURNING id
      `,
      [
        existing.rows[0].id,
        product.category || null,
        product.description || null,
        product.image_url || null,
        product.tags || [],
      ],
    );

    return { id: rows[0].id, created: false };
  }

  const { rows } = await client.query(
    `
      INSERT INTO products (store_id, product_name, category, description, image_url, tags)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `,
    [
      storeId,
      product.product_name,
      product.category || null,
      product.description || null,
      product.image_url || null,
      product.tags || [],
    ],
  );

  return { id: rows[0].id, created: true };
}

async function ensureVariants(client, productId, variants) {
  let createdCount = 0;

  for (const variant of variants) {
    const existing = await client.query(
      `
        SELECT id
        FROM product_variants
        WHERE product_id = $1
          AND COALESCE(LOWER(variant_name), '') = COALESCE(LOWER($2), '')
        LIMIT 1
      `,
      [productId, variant.variant_name || null],
    );

    if (existing.rows[0]) {
      await client.query(
        `
          UPDATE product_variants
          SET
            price = $2,
            stock_quantity = $3,
            in_stock = $4
          WHERE id = $1
        `,
        [
          existing.rows[0].id,
          variant.price,
          variant.stock_quantity ?? 0,
          Boolean(variant.in_stock),
        ],
      );
      continue;
    }

    await client.query(
      `
        INSERT INTO product_variants (product_id, variant_name, price, stock_quantity, in_stock)
        VALUES ($1, $2, $3, $4, $5)
      `,
      [
        productId,
        variant.variant_name || null,
        variant.price,
        variant.stock_quantity ?? 0,
        Boolean(variant.in_stock),
      ],
    );

    createdCount += 1;
  }

  return createdCount;
}

async function countRows(client, tableName) {
  const { rows } = await client.query(`SELECT COUNT(*)::int AS count FROM ${tableName}`);
  return rows[0].count;
}

async function seed() {
  const client = await pool.connect();

  try {
    console.log("🌱 Seeding Neara backend sample data...");
    await ensureSchema();
    await client.query("BEGIN");
    await purgeManagedSeedStores(client);

    let createdStores = 0;
    let createdProducts = 0;
    let createdVariants = 0;

    for (const blueprint of STORE_BLUEPRINTS) {
      const owner = await ensureUser(client, blueprint.store.owner, {
        isOwner: true,
        premiumStatus: Number(blueprint.store.subscription_tier || 1) > 1,
      });

      const storeResult = await ensureStore(client, blueprint.store, owner.id);
      if (storeResult.created) {
        createdStores += 1;
      }

      for (const product of blueprint.products) {
        const productResult = await ensureProduct(client, storeResult.id, product);
        if (productResult.created) {
          createdProducts += 1;
        }

        createdVariants += await ensureVariants(client, productResult.id, product.variants);
      }
    }

    await client.query("COMMIT");

    const totals = {
      stores: await countRows(client, "stores"),
      products: await countRows(client, "products"),
      variants: await countRows(client, "product_variants"),
      users: await countRows(client, "users"),
    };

    console.log("✅ Neara backend sample data ready", {
      createdProducts,
      createdStores,
      createdVariants,
      defaultOwnerPassword: DEFAULT_PASSWORD,
      totalConfiguredProducts: STORE_BLUEPRINTS.reduce(
        (sum, blueprint) => sum + blueprint.products.length,
        0,
      ),
      totalConfiguredStores: STORE_BLUEPRINTS.length,
      totals,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("❌ Seed failed:", error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
