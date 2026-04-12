class RouteCache {
  constructor({ maxEntries = 250, ttlMs = 15000 } = {}) {
    this.maxEntries = maxEntries;
    this.ttlMs = ttlMs;
    this.store = new Map();
  }

  buildRecord(value, ttlMs) {
    const now = Date.now();
    return {
      expiresAt: now + (ttlMs || this.ttlMs),
      value,
    };
  }

  deleteExpired() {
    const now = Date.now();

    for (const [key, record] of this.store.entries()) {
      if (!record || record.expiresAt <= now) {
        this.store.delete(key);
      }
    }
  }

  enforceSizeLimit() {
    while (this.store.size > this.maxEntries) {
      const oldestKey = this.store.keys().next().value;

      if (!oldestKey) {
        break;
      }

      this.store.delete(oldestKey);
    }
  }

  get(key) {
    const record = this.store.get(key);

    if (!record) {
      return null;
    }

    if (record.expiresAt <= Date.now()) {
      this.store.delete(key);
      return null;
    }

    return record.value;
  }

  set(key, value, ttlMs) {
    this.deleteExpired();
    this.store.set(key, this.buildRecord(value, ttlMs));
    this.enforceSizeLimit();
    return value;
  }

  clear() {
    this.store.clear();
  }

  deleteByPrefix(prefix) {
    for (const key of this.store.keys()) {
      if (String(key).startsWith(prefix)) {
        this.store.delete(key);
      }
    }
  }
}

module.exports = {
  RouteCache,
};
