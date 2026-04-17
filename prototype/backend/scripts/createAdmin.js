require("dotenv").config();

const bcrypt = require("bcrypt");
const ensureSchema = require("../config/ensureSchema");
const pool = require("../config/db");

const AUTH_BCRYPT_ROUNDS = 12;
const ROLE_USER = "user";

function buildAdminRoles(existingRoles) {
  const normalizedRoles = Array.isArray(existingRoles)
    ? existingRoles
        .filter((role) => typeof role === "string")
        .map((role) => role.trim())
        .filter(Boolean)
    : [];

  return Array.from(new Set([ROLE_USER, ...normalizedRoles]));
}

function normalizeEmail(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function normalizeNullableText(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getScriptInputs() {
  const [, , emailArg, passwordArg, nameArg, phoneArg] = process.argv;
  const email = normalizeEmail(emailArg || process.env.ADMIN_EMAIL || "");
  const password = String(passwordArg || process.env.ADMIN_PASSWORD || "");
  const name = String(nameArg || process.env.ADMIN_NAME || "Admin").trim();
  const phoneNumber = normalizeNullableText(
    phoneArg || process.env.ADMIN_PHONE || "",
  );

  if (!email || !password || !name) {
    throw new Error(
      "Usage: node scripts/createAdmin.js <email> <password> [name] [phone] or set ADMIN_EMAIL, ADMIN_PASSWORD, and optionally ADMIN_NAME, ADMIN_PHONE.",
    );
  }

  return {
    email,
    name,
    password,
    phoneNumber,
  };
}

async function createAdmin() {
  const client = await pool.connect();

  try {
    await ensureSchema();

    const { email, password, name, phoneNumber } = getScriptInputs();
    const passwordHash = await bcrypt.hash(password, AUTH_BCRYPT_ROUNDS);

    await client.query("BEGIN");

    const existing = await client.query(
      `
        SELECT id, name, email, phone_number, is_admin, roles
        FROM users
        WHERE LOWER(email) = $1
        LIMIT 1
      `,
      [email],
    );

    if (existing.rows.length > 0) {
      const nextRoles = buildAdminRoles(existing.rows[0].roles);

      const updated = await client.query(
        `
          UPDATE users
          SET name = $2,
              password_hash = $3,
              phone_number = $4,
              is_admin = TRUE,
              roles = $5
          WHERE id = $1
          RETURNING id, name, email, phone_number, is_admin, roles, created_at
        `,
        [existing.rows[0].id, name, passwordHash, phoneNumber, nextRoles],
      );

      await client.query("COMMIT");
      console.log("Updated existing user as admin.");
      console.log(updated.rows[0]);
      return;
    }

    const inserted = await client.query(
      `
        INSERT INTO users (name, email, password_hash, phone_number, is_admin, roles)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, name, email, phone_number, is_admin, roles, created_at
      `,
      [name, email, passwordHash, phoneNumber, true, [ROLE_USER]],
    );

    await client.query("COMMIT");
    console.log("Created admin user successfully.");
    console.log(inserted.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Error creating admin:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end().catch(() => {});
  }
}

createAdmin();
