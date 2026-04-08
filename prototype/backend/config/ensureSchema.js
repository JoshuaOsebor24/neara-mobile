const pool = require("./db");

async function ensureSchema() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        phone_number TEXT,
        is_admin BOOLEAN NOT NULL DEFAULT false,
        premium_status BOOLEAN NOT NULL DEFAULT false,
        messages_sent_count INT NOT NULL DEFAULT 0,
        roles TEXT[] NOT NULL DEFAULT ARRAY['user']::TEXT[],
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS stores (
        id SERIAL PRIMARY KEY,
        owner_id INT REFERENCES users(id) ON DELETE SET NULL,
        store_name TEXT NOT NULL,
        category TEXT,
        address TEXT,
        state TEXT,
        country TEXT,
        delivery_available BOOLEAN NOT NULL DEFAULT false,
        latitude NUMERIC,
        longitude NUMERIC,
        phone_number TEXT,
        verified BOOLEAN NOT NULL DEFAULT false,
        is_suspended BOOLEAN NOT NULL DEFAULT false,
        subscription_tier INT NOT NULL DEFAULT 1,
        image_url TEXT,
        header_images JSONB NOT NULL DEFAULT '[]'::jsonb,
        description TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        store_id INT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
        product_name TEXT NOT NULL,
        category TEXT,
        description TEXT,
        image_url TEXT,
        tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS product_variants (
        id SERIAL PRIMARY KEY,
        product_id INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        variant_name TEXT,
        price NUMERIC(10,2) NOT NULL,
        stock_quantity INT NOT NULL DEFAULT 0,
        in_stock BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS saved_stores (
        id SERIAL PRIMARY KEY,
        user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        store_id INT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS conversations (
        id SERIAL PRIMARY KEY,
        user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        store_id INT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
        user_last_read_at TIMESTAMPTZ,
        owner_last_read_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        conversation_id INT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        sender_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        receiver_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        text TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS payment_transactions (
        id SERIAL PRIMARY KEY,
        user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        provider TEXT NOT NULL,
        reference TEXT NOT NULL,
        amount_kobo INT NOT NULL,
        currency TEXT NOT NULL DEFAULT 'NGN',
        status TEXT NOT NULL DEFAULT 'initialized',
        checkout_url TEXT,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        paid_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id SERIAL PRIMARY KEY,
        user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        provider TEXT NOT NULL,
        provider_subscription_id TEXT,
        reference TEXT NOT NULL,
        amount_kobo INT NOT NULL,
        currency TEXT NOT NULL DEFAULT 'NGN',
        status TEXT NOT NULL DEFAULT 'pending',
        current_period_start TIMESTAMPTZ,
        current_period_end TIMESTAMPTZ,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS phone_number TEXT,
        ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS premium_status BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS messages_sent_count INT NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS roles TEXT[] NOT NULL DEFAULT ARRAY['user']::TEXT[],
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    `);

    await client.query(`
      ALTER TABLE stores
        ADD COLUMN IF NOT EXISTS owner_id INT REFERENCES users(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS address TEXT,
        ADD COLUMN IF NOT EXISTS state TEXT,
        ADD COLUMN IF NOT EXISTS country TEXT,
        ADD COLUMN IF NOT EXISTS delivery_available BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS latitude NUMERIC,
        ADD COLUMN IF NOT EXISTS longitude NUMERIC,
        ADD COLUMN IF NOT EXISTS phone_number TEXT,
        ADD COLUMN IF NOT EXISTS verified BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS subscription_tier INT NOT NULL DEFAULT 1,
        ADD COLUMN IF NOT EXISTS image_url TEXT,
        ADD COLUMN IF NOT EXISTS header_images JSONB NOT NULL DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS description TEXT,
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    `);

    await client.query(`
      ALTER TABLE products
        ADD COLUMN IF NOT EXISTS category TEXT,
        ADD COLUMN IF NOT EXISTS description TEXT,
        ADD COLUMN IF NOT EXISTS image_url TEXT,
        ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    `);

    await client.query(`
      ALTER TABLE product_variants
        ADD COLUMN IF NOT EXISTS stock_quantity INT NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS in_stock BOOLEAN NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    `);

    await client.query(`
      ALTER TABLE saved_stores
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    `);

    await client.query(`
      ALTER TABLE conversations
        ADD COLUMN IF NOT EXISTS user_last_read_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS owner_last_read_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    `);

    await client.query(`
      ALTER TABLE messages
        ADD COLUMN IF NOT EXISTS receiver_id INT REFERENCES users(id) ON DELETE CASCADE,
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    `);

    await client.query(`
      ALTER TABLE payment_transactions
        ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'NGN',
        ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'initialized',
        ADD COLUMN IF NOT EXISTS checkout_url TEXT,
        ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    `);

    await client.query(`
      ALTER TABLE subscriptions
        ADD COLUMN IF NOT EXISTS provider_subscription_id TEXT,
        ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'NGN',
        ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending',
        ADD COLUMN IF NOT EXISTS current_period_start TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    `);

    await client.query(`
      UPDATE users
      SET roles = ARRAY(
        SELECT role_name
        FROM unnest(
          ARRAY[
            'user'::TEXT,
            CASE WHEN premium_status THEN 'pro'::TEXT ELSE NULL END,
            CASE
              WHEN EXISTS (
                SELECT 1
                FROM stores
                WHERE stores.owner_id = users.id
              )
              THEN 'store_owner'::TEXT
              ELSE NULL
            END
          ]
        ) AS role_name
        WHERE role_name IS NOT NULL
      )
      WHERE roles IS NULL
         OR roles = '{}'::TEXT[]
         OR roles IS DISTINCT FROM ARRAY(
           SELECT role_name
           FROM unnest(
             ARRAY[
               'user'::TEXT,
               CASE WHEN premium_status THEN 'pro'::TEXT ELSE NULL END,
               CASE
                 WHEN EXISTS (
                   SELECT 1
                   FROM stores
                   WHERE stores.owner_id = users.id
                 )
                 THEN 'store_owner'::TEXT
                 ELSE NULL
               END
             ]
           ) AS role_name
           WHERE role_name IS NOT NULL
         );
    `);

    const duplicateUsers = await client.query(`
      SELECT LOWER(email) AS email, COUNT(*)::INT AS count
      FROM users
      GROUP BY LOWER(email)
      HAVING COUNT(*) > 1
      ORDER BY COUNT(*) DESC
      LIMIT 5;
    `);

    if (duplicateUsers.rows.length > 0) {
      throw new Error(
        `Cannot enforce unique users.email because duplicates exist: ${duplicateUsers.rows
          .map((row) => `${row.email} (${row.count})`)
          .join(", ")}`,
      );
    }

    const duplicateOwnerStores = await client.query(`
      SELECT owner_id, COUNT(*)::INT AS count
      FROM stores
      WHERE owner_id IS NOT NULL
      GROUP BY owner_id
      HAVING COUNT(*) > 1
      ORDER BY COUNT(*) DESC
      LIMIT 5;
    `);

    if (duplicateOwnerStores.rows.length > 0) {
      throw new Error(
        `Cannot enforce one store per owner because multiple stores already exist for owner ids: ${duplicateOwnerStores.rows
          .map((row) => `${row.owner_id} (${row.count})`)
          .join(", ")}`,
      );
    }

    await client.query(`
      DELETE FROM saved_stores a
      USING saved_stores b
      WHERE a.id < b.id
        AND a.user_id = b.user_id
        AND a.store_id = b.store_id;
    `);

    await client.query(`
      CREATE EXTENSION IF NOT EXISTS pg_trgm;
    `);

    await client.query(`
      DROP INDEX IF EXISTS users_email_idx;
      CREATE INDEX IF NOT EXISTS stores_owner_id_idx ON stores (owner_id);
      CREATE UNIQUE INDEX IF NOT EXISTS stores_owner_unique_idx
      ON stores (owner_id)
      WHERE owner_id IS NOT NULL;
      DROP INDEX IF EXISTS products_store_id_idx;
      CREATE INDEX IF NOT EXISTS idx_products_store_id ON products (store_id);
      CREATE INDEX IF NOT EXISTS product_variants_product_id_idx ON product_variants (product_id);
      CREATE INDEX IF NOT EXISTS stores_store_name_trgm_idx
      ON stores USING GIN (store_name gin_trgm_ops);
      CREATE INDEX IF NOT EXISTS stores_category_trgm_idx
      ON stores USING GIN (category gin_trgm_ops);
      CREATE INDEX IF NOT EXISTS products_product_name_trgm_idx
      ON products USING GIN (product_name gin_trgm_ops);
      CREATE INDEX IF NOT EXISTS products_category_trgm_idx
      ON products USING GIN (category gin_trgm_ops);
      CREATE INDEX IF NOT EXISTS product_variants_variant_name_trgm_idx
      ON product_variants USING GIN (variant_name gin_trgm_ops);
      CREATE INDEX IF NOT EXISTS saved_stores_user_id_idx ON saved_stores (user_id);
      CREATE INDEX IF NOT EXISTS saved_stores_store_id_idx ON saved_stores (store_id);
      CREATE UNIQUE INDEX IF NOT EXISTS saved_stores_user_store_unique_idx
      ON saved_stores (user_id, store_id);
      CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_unique_idx
      ON users (LOWER(email));
      CREATE INDEX IF NOT EXISTS conversations_user_id_idx ON conversations (user_id);
      CREATE INDEX IF NOT EXISTS conversations_store_id_idx ON conversations (store_id);
      CREATE INDEX IF NOT EXISTS conversations_store_updated_idx ON conversations (store_id, updated_at DESC);
      CREATE INDEX IF NOT EXISTS conversations_updated_at_idx ON conversations (updated_at DESC);
      CREATE UNIQUE INDEX IF NOT EXISTS conversations_user_store_unique_idx
      ON conversations (user_id, store_id);
      CREATE INDEX IF NOT EXISTS messages_conversation_id_idx
      ON messages (conversation_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS messages_receiver_created_idx
      ON messages (receiver_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS messages_sender_id_idx ON messages (sender_id);
      CREATE INDEX IF NOT EXISTS messages_receiver_id_idx ON messages (receiver_id);
      CREATE INDEX IF NOT EXISTS users_is_admin_idx ON users (is_admin);
      CREATE INDEX IF NOT EXISTS users_premium_status_idx ON users (premium_status);
      CREATE INDEX IF NOT EXISTS stores_is_suspended_idx ON stores (is_suspended);
      CREATE UNIQUE INDEX IF NOT EXISTS payment_transactions_reference_unique_idx
      ON payment_transactions (reference);
      CREATE INDEX IF NOT EXISTS payment_transactions_user_status_idx
      ON payment_transactions (user_id, status, created_at DESC);
      CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_user_unique_idx
      ON subscriptions (user_id);
      CREATE INDEX IF NOT EXISTS subscriptions_status_period_idx
      ON subscriptions (status, current_period_end DESC);
    `);

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = ensureSchema;
