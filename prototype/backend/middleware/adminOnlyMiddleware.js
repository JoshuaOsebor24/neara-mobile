const pool = require("../config/db");

async function adminOnlyMiddleware(req, res, next) {
  try {
    const userId = Number(req.user?.id);

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(401).json({
        message: "Invalid session",
      });
    }

    const { rows } = await pool.query(
      `
        SELECT id, name, email, is_admin
        FROM users
        WHERE id = $1
        LIMIT 1
      `,
      [userId],
    );

    const user = rows[0];

    if (!user) {
      return res.status(401).json({
        message: "User not found",
      });
    }

    if (!user.is_admin) {
      return res.status(403).json({
        message: "Admin access required",
      });
    }

    req.adminUser = user;
    next();
  } catch (error) {
    console.error("admin auth failed", error);
    res.status(500).json({
      message: "Could not verify admin access",
    });
  }
}

module.exports = adminOnlyMiddleware;
