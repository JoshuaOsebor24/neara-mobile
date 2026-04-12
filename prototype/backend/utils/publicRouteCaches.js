const { app: appConfig } = require("../config/env");
const { RouteCache } = require("./routeCache");

const publicStoreCache = new RouteCache({
  maxEntries: 250,
  ttlMs: appConfig.routeCacheTtlMs,
});

const searchCache = new RouteCache({
  maxEntries: 300,
  ttlMs: appConfig.routeCacheTtlMs,
});

function invalidatePublicStoreCaches() {
  publicStoreCache.clear();
}

function invalidateSearchCache() {
  searchCache.clear();
}

function invalidatePublicReadCaches() {
  invalidatePublicStoreCaches();
  invalidateSearchCache();
}

module.exports = {
  invalidatePublicReadCaches,
  invalidatePublicStoreCaches,
  invalidateSearchCache,
  publicStoreCache,
  searchCache,
};
