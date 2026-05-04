const redis = require("redis");
const logger = require("../utils/logger");

const childLogger = logger.child({ module: "Redis Client" });

const normalizeRedisError = (error) => ({
  name: error?.name,
  message: error?.message || String(error),
  code: error?.code,
  errno: error?.errno,
  address: error?.address,
  port: error?.port,
});

class RedisClient {
  constructor() {
    this.client = null;
    this.isConnected = false;
  }

  async connect() {
    try {
      // Create Redis client with configuration
      this.client = redis.createClient({
        socket: {
          host: process.env.REDIS_HOST || "localhost",
          port: Number(process.env.REDIS_PORT || 6379),
          reconnectStrategy: (retries) => {
            if (retries >= 3) {
              childLogger.error("Redis reconnect attempts exhausted", {
                retries,
              });
              return false;
            }

            const delay = Math.min((retries + 1) * 500, 2000);
            childLogger.warn("Retrying Redis connection", {
              retries: retries + 1,
              delay,
            });
            return delay;
          },
        },
        password: process.env.REDIS_PASSWORD || undefined,
        database: Number(process.env.REDIS_DB || 0),
      });

      // Handle Redis client events
      this.client.on("connect", () => {
        childLogger.info("Redis client connected");
        this.isConnected = true;
      });

      this.client.on("error", (err) => {
        childLogger.error("Redis client error", normalizeRedisError(err));
        this.isConnected = false;
      });

      this.client.on("end", () => {
        childLogger.info("Redis client connection ended");
        this.isConnected = false;
      });

      // Connect to Redis
      await this.client.connect();

      childLogger.info("Redis connection established successfully");
      return this.client;
    } catch (error) {
      childLogger.error(
        "Failed to connect to Redis",
        normalizeRedisError(error),
      );
      this.isConnected = false;
      // Don't throw error to allow app to continue without Redis
      return null;
    }
  }

  async get(key) {
    if (!this.isConnected || !this.client) {
      childLogger.warn("Redis not connected, skipping cache get", { key });
      return null;
    }

    try {
      const result = await this.client.get(key);
      if (result) {
        childLogger.debug("Cache hit", { key });
        return JSON.parse(result);
      }
      childLogger.debug("Cache miss", { key });
      return null;
    } catch (error) {
      childLogger.error("Redis get error", {
        key,
        ...normalizeRedisError(error),
      });
      return null;
    }
  }

  async set(key, value, ttl = 300) {
    if (!this.isConnected || !this.client) {
      childLogger.warn("Redis not connected, skipping cache set", { key });
      return false;
    }

    try {
      const serializedValue = JSON.stringify(value);
      await this.client.setEx(key, ttl, serializedValue);
      childLogger.debug("Cache set", { key, ttl });
      return true;
    } catch (error) {
      childLogger.error("Redis set error", {
        key,
        ttl,
        ...normalizeRedisError(error),
      });
      return false;
    }
  }

  async del(key) {
    if (!this.isConnected || !this.client) {
      childLogger.warn("Redis not connected, skipping cache delete", { key });
      return false;
    }

    try {
      await this.client.del(key);
      childLogger.debug("Cache deleted", { key });
      return true;
    } catch (error) {
      childLogger.error("Redis delete error", {
        key,
        ...normalizeRedisError(error),
      });
      return false;
    }
  }

  async invalidatePattern(pattern) {
    if (!this.isConnected || !this.client) {
      childLogger.warn("Redis not connected, skipping pattern invalidation", {
        pattern,
      });
      return false;
    }

    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(keys);
        childLogger.debug("Cache pattern invalidated", {
          pattern,
          count: keys.length,
        });
      }
      return true;
    } catch (error) {
      childLogger.error("Redis pattern invalidation error", {
        pattern,
        ...normalizeRedisError(error),
      });
      return false;
    }
  }

  async disconnect() {
    if (this.client) {
      try {
        await this.client.quit();
        childLogger.info("Redis client disconnected");
      } catch (error) {
        childLogger.error(
          "Error disconnecting Redis client",
          normalizeRedisError(error),
        );
      }
    }
  }
}

// Create a singleton instance
const redisClient = new RedisClient();

module.exports = redisClient;
