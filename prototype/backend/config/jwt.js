const jwt = require("jsonwebtoken");
const { jwt: jwtConfig } = require("./env");

function getJwtSecretOrThrow() {
  if (!jwtConfig.secret) {
    throw new Error("JWT_SECRET is not configured");
  }

  return jwtConfig.secret;
}

function signUserToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      is_admin: Boolean(user.is_admin),
    },
    getJwtSecretOrThrow(),
    {
      audience: jwtConfig.audience,
      expiresIn: jwtConfig.expiresIn,
      issuer: jwtConfig.issuer,
    },
  );
}

function verifyUserToken(token) {
  return jwt.verify(token, getJwtSecretOrThrow(), {
    algorithms: ["HS256"],
    audience: jwtConfig.audience,
    issuer: jwtConfig.issuer,
  });
}

module.exports = {
  getJwtSecretOrThrow,
  signUserToken,
  verifyUserToken,
};
