// Authentication middleware
// - Verifies a Bearer JWT on incoming requests
// - Attaches decoded user payload to `req.user` when valid
const { sendError } = require("../utils/apiResponse");
const { verifyUserToken } = require("../config/jwt");

const authMiddleware = (req, res, next) => {
  try {
    // Expect Authorization header in format: "Bearer <token>"
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return sendError(res, 401, "Not authenticated", {
        message: "Not authenticated",
      });
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      return sendError(res, 401, "Not authenticated", {
        message: "Not authenticated",
      });
    }

    // Verify token using the JWT secret from environment
    const decoded = verifyUserToken(token);

    // Make user info available to downstream handlers
    req.user = decoded;

    next();
  } catch (_error) {
    // Any error -> unauthorized (invalid or expired token)
    return sendError(res, 401, "Not authenticated", {
      message: "Not authenticated",
    });
  }
};

module.exports = authMiddleware;
