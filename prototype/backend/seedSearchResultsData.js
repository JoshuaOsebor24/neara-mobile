require("dotenv").config();

const bcrypt = require("bcrypt");
const { Pool } = require("pg");
const ensureSchema = require("./config/ensureSchema");
const {
  purgeManagedSeedStores,
  STORE_BLUEPRINTS,
} = require("./seedData/osborneStores");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
  max: 5,
});

const PASSWORD_HASH_ROUNDS = 8;
const DEFAULT_PASSWORD = "NearaDev123!";



const SHOPPER_BLUEPRINT = {
  name: "Demo Shopper",
  email: "shopper+demo@neara.test",
  phone_number: "+234 801 555 1199",
  roles: ["user", "pro"],
  premium_status: true,
};

function normalizeHeaderImages(headerImages, fallbackImageUrl = null) {
  const compact = (Array.isArray(headerImages) ? headerImages : [])
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);

  if (compact.length > 0) {
    return compact;
  }

  return typeof fallbackImageUrl === "string" && fallbackImageUrl.trim()
    ? [fallbackImageUrl.trim()]
    : [];
}

async function findUserByEmail(client, email) {
  const { rows } = await client.query(
    `
      SELECT id, name, email, phone_number, roles, premium_status
      FROM users
      WHERE LOWER(email) = LOWER($1)
      LIMIT 1
    `,
    [email],
  );

  return rows[0] || null;
}

async function ensureUser(client, user, { isOwner = false } = {}) {
  const existingUser = await findUserByEmail(client, user.email);
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, PASSWORD_HASH_ROUNDS);
  const nextRoles = Array.from(
    new Set([
      "user",
      ...(Array.isArray(user.roles) ? user.roles : []),
      ...(isOwner ? ["store_owner"] : []),
    ]),
  );
  const premiumStatus = Boolean(user.premium_status);

  if (existingUser) {
    const { rows } = await client.query(
      `
        UPDATE users
        SET
          name = $2,
          phone_number = $3,
          password_hash = $4,
          premium_status = $5,
          roles = $6
        WHERE id = $1
        RETURNING id, name, email, phone_number, roles, premium_status
      `,
      [
        existingUser.id,
        user.name,
        user.phone_number || null,
        passwordHash,
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
      RETURNING id, name, email, phone_number, roles, premium_status
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
  const { rows } = await client.query(
    `
      SELECT id
      FROM stores
      WHERE LOWER(store_name) = LOWER($1)
      LIMIT 1
    `,
    [storeData.store_name],
  );

  const headerImages = normalizeHeaderImages(storeData.header_images, storeData.image_url);

  if (rows[0]) {
    const updated = await client.query(
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
          description = $12
        WHERE id = $1
        RETURNING id
      `,
      [
        rows[0].id,
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
      ],
    );

    return {
      id: updated.rows[0].id,
      created: false,
    };
  }

  const inserted = await client.query(
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
        description
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, FALSE, $10, $11::jsonb, $12)
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
    ],
  );

  return {
    id: inserted.rows[0].id,
    created: true,
  };
}

async function ensureProduct(client, storeId, product) {
  const existing = await client.query(
    `
      SELECT id
      FROM products
      WHERE store_id = $1 AND LOWER(product_name) = LOWER($2)
      LIMIT 1
    `,
    [storeId, product.product_name],
  );

  if (existing.rows[0]) {
    const updated = await client.query(
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

    return {
      id: updated.rows[0].id,
      created: false,
    };
  }

  const inserted = await client.query(
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

  return {
    id: inserted.rows[0].id,
    created: true,
  };
}

async function ensureVariants(client, productId, variants) {
  let createdVariants = 0;

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
    createdVariants += 1;
  }

  return createdVariants;
}

async function ensureSavedStore(client, userId, storeId) {
  await client.query(
    `
      INSERT INTO saved_stores (user_id, store_id)
      VALUES ($1, $2)
      ON CONFLICT (user_id, store_id) DO NOTHING
    `,
    [userId, storeId],
  );
}

async function seedSearchResultsData() {
  const client = await pool.connect();

  try {
    console.log("🌱 Seeding Neara development data...");
    await ensureSchema();
    await client.query("BEGIN");
    await purgeManagedSeedStores(client);

    const shopperUser = await ensureUser(client, SHOPPER_BLUEPRINT);
    let createdStores = 0;
    let createdProducts = 0;
    let createdVariants = 0;
    const seededStores = [];

    for (const blueprint of STORE_BLUEPRINTS) {
      const owner = await ensureUser(client, blueprint.store.owner, { isOwner: true });
      const storeResult = await ensureStore(client, blueprint.store, owner.id);

      if (storeResult.created) {
        createdStores += 1;
      }

      seededStores.push({
        id: storeResult.id,
        store_name: blueprint.store.store_name,
        category: blueprint.store.category,
      });

      for (const product of blueprint.products) {
        const productResult = await ensureProduct(client, storeResult.id, product);

        if (productResult.created) {
          createdProducts += 1;
        }

        createdVariants += await ensureVariants(client, productResult.id, product.variants);
      }
    }

    for (const savedStore of seededStores.slice(0, 3)) {
      await ensureSavedStore(client, shopperUser.id, savedStore.id);
    }

    await client.query("COMMIT");

    console.log("✅ Neara development data ready", {
      createdProducts,
      createdStores,
      createdVariants,
      defaultPassword: DEFAULT_PASSWORD,
      sampleShopperEmail: SHOPPER_BLUEPRINT.email,
      totalProductsConfigured: STORE_BLUEPRINTS.reduce(
        (sum, blueprint) => sum + blueprint.products.length,
        0,
      ),
      totalStoresConfigured: STORE_BLUEPRINTS.length,
    });

    console.table(
      seededStores.map((store) => ({
        id: store.id,
        category: store.category,
        store_name: store.store_name,
      })),
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("❌ Development seed failed:", error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

seedSearchResultsData();
