function summarizeRequest(req, details = {}) {
  return {
    method: req.method,
    params: req.params || {},
    query: req.query || {},
    route: req.originalUrl,
    ...details,
  };
}

function logRouteHit(req, label, details = {}) {
  console.log(`[${label}] route hit`, summarizeRequest(req, details));
}

function logRouteSuccess(req, label, status, details = {}) {
  console.log(`[${label}] response`, summarizeRequest(req, {
    status,
    success: true,
    ...details,
  }));
}

function logRouteFailure(req, label, status, error, details = {}) {
  console.error(`[${label}] failure`, summarizeRequest(req, {
    status,
    success: false,
    error: error?.message || String(error),
    ...details,
  }));
}

function sendSuccess(res, status, data, extra = {}) {
  return res.status(status).json({
    success: true,
    data,
    ...extra,
  });
}

function sendError(res, status, error, extra = {}) {
  const errorMessage = typeof error === "string" && error.trim()
    ? error
    : "Something went wrong";

  return res.status(status).json({
    success: false,
    error: errorMessage,
    ...extra,
  });
}

module.exports = {
  logRouteFailure,
  logRouteHit,
  logRouteSuccess,
  sendError,
  sendSuccess,
};
