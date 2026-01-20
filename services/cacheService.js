import redis from 'redis';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Cache Service - Redis-based caching for analytics performance optimization
 * Handles cache operations, key generation, and cache warming strategies
 * Gracefully falls back to no-cache mode when Redis is unavailable
 */
class CacheService {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.connectionAttempted = false;
    this.defaultTTL = parseInt(process.env.ANALYTICS_CACHE_TTL) || 300; // 5 minutes default
    this.cacheEnabled = process.env.ENABLE_ANALYTICS_CACHE === 'true';
    this.keyPrefix = 'cleancity:analytics:';
    this.silentMode = process.env.CACHE_SILENT_MODE === 'true'; // Suppress Redis connection errors
    
    // Only attempt Redis connection if explicitly enabled and not in silent mode
    if (this.cacheEnabled && !this.silentMode) {
      this.initializeRedis();
    } else if (this.cacheEnabled && this.silentMode) {
      // In silent mode, try to connect but don't log errors
      this.initializeRedisSilent();
    } else {
      console.log('[INFO] CacheService - Caching disabled via configuration');
    }
  }

  /**
   * Initialize Redis connection with full error logging
   */
  async initializeRedis() {
    if (this.connectionAttempted) {
      return;
    }
    
    this.connectionAttempted = true;
    
    try {
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
      
      this.client = redis.createClient({
        url: redisUrl,
        socket: {
          connectTimeout: 5000, // 5 second timeout
          lazyConnect: true
        },
        retry_strategy: (options) => {
          if (options.error && options.error.code === 'ECONNREFUSED') {
            console.log('[WARNING] CacheService - Redis server not available, falling back to no-cache mode');
            this.cacheEnabled = false;
            return new Error('Redis server connection refused');
          }
          if (options.total_retry_time > 10000) { // 10 seconds max retry time
            console.log('[WARNING] CacheService - Redis retry time exhausted, disabling cache');
            this.cacheEnabled = false;
            return new Error('Retry time exhausted');
          }
          if (options.attempt > 3) { // Max 3 attempts
            console.log('[WARNING] CacheService - Redis max retry attempts reached, disabling cache');
            this.cacheEnabled = false;
            return undefined;
          }
          return Math.min(options.attempt * 1000, 3000);
        }
      });

      this.client.on('error', (err) => {
        if (!this.silentMode) {
          console.error('[ERROR] CacheService - Redis error:', err.message);
        }
        this.isConnected = false;
        this.cacheEnabled = false; // Disable cache on persistent errors
      });

      this.client.on('connect', () => {
        console.log('[INFO] CacheService - Connected to Redis');
        this.isConnected = true;
        this.cacheEnabled = true;
      });

      this.client.on('ready', () => {
        console.log('[INFO] CacheService - Redis client ready');
        this.isConnected = true;
        this.cacheEnabled = true;
      });

      this.client.on('end', () => {
        console.log('[INFO] CacheService - Redis connection ended');
        this.isConnected = false;
      });

      this.client.on('reconnecting', () => {
        console.log('[INFO] CacheService - Reconnecting to Redis...');
      });

      // Attempt connection with timeout
      const connectPromise = this.client.connect();
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Connection timeout')), 5000);
      });

      await Promise.race([connectPromise, timeoutPromise]);
      
    } catch (error) {
      console.error('[ERROR] CacheService - Redis initialization failed:', error.message);
      console.log('[INFO] CacheService - Falling back to no-cache mode');
      this.cacheEnabled = false;
      this.isConnected = false;
      this.client = null;
    }
  }

  /**
   * Initialize Redis connection in silent mode (suppress errors)
   */
  async initializeRedisSilent() {
    if (this.connectionAttempted) {
      return;
    }
    
    this.connectionAttempted = true;
    
    try {
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
      
      this.client = redis.createClient({
        url: redisUrl,
        socket: {
          connectTimeout: 2000, // Shorter timeout in silent mode
          lazyConnect: true
        },
        retry_strategy: () => {
          // Don't retry in silent mode
          this.cacheEnabled = false;
          return undefined;
        }
      });

      // Suppress all Redis errors in silent mode
      this.client.on('error', () => {
        this.isConnected = false;
        this.cacheEnabled = false;
      });

      this.client.on('connect', () => {
        this.isConnected = true;
        this.cacheEnabled = true;
      });

      this.client.on('ready', () => {
        this.isConnected = true;
        this.cacheEnabled = true;
      });

      this.client.on('end', () => {
        this.isConnected = false;
      });

      // Quick connection attempt
      await Promise.race([
        this.client.connect(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Silent timeout')), 2000))
      ]);
      
    } catch (error) {
      // Silently fail and disable cache
      this.cacheEnabled = false;
      this.isConnected = false;
      this.client = null;
    }
  }

  /**
   * Cache analytics data with TTL
   * @param {String} key - Cache key
   * @param {Object} data - Data to cache
   * @param {Number} ttl - Time to live in seconds (optional)
   * @returns {Promise<Boolean>} Success status
   */
  async cacheAnalyticsData(key, data, ttl = null) {
    if (!this.cacheEnabled || !this.isConnected) {
      return false;
    }

    try {
      const cacheKey = this.generateFullKey(key);
      const serializedData = JSON.stringify({
        data,
        timestamp: Date.now(),
        ttl: ttl || this.defaultTTL
      });

      const result = await this.client.setEx(
        cacheKey, 
        ttl || this.defaultTTL, 
        serializedData
      );

      if (result === 'OK') {
        console.log(`[INFO] CacheService - Cached data for key: ${key}`);
        return true;
      }
      
      return false;

    } catch (error) {
      console.error('[ERROR] CacheService - cacheAnalyticsData:', error.message);
      return false;
    }
  }

  /**
   * Get cached data
   * @param {String} key - Cache key
   * @returns {Promise<Object|null>} Cached data or null if not found
   */
  async getCachedData(key) {
    if (!this.cacheEnabled || !this.isConnected) {
      return null;
    }

    try {
      const cacheKey = this.generateFullKey(key);
      const cachedData = await this.client.get(cacheKey);

      if (!cachedData) {
        return null;
      }

      const parsedData = JSON.parse(cachedData);
      
      // Check if data is still valid (additional validation)
      const age = Date.now() - parsedData.timestamp;
      const maxAge = parsedData.ttl * 1000;

      if (age > maxAge) {
        console.log(`[INFO] CacheService - Cache expired for key: ${key}`);
        await this.invalidateCache(key);
        return null;
      }

      console.log(`[INFO] CacheService - Cache hit for key: ${key}`);
      return parsedData.data;

    } catch (error) {
      console.error('[ERROR] CacheService - getCachedData:', error.message);
      return null;
    }
  }

  /**
   * Invalidate cache by pattern or specific key
   * @param {String} pattern - Cache key pattern or specific key
   * @returns {Promise<Number>} Number of keys deleted
   */
  async invalidateCache(pattern) {
    if (!this.cacheEnabled || !this.isConnected) {
      return 0;
    }

    try {
      let keysToDelete;
      
      if (pattern.includes('*')) {
        // Pattern-based deletion
        const searchPattern = this.generateFullKey(pattern);
        keysToDelete = await this.client.keys(searchPattern);
      } else {
        // Single key deletion
        keysToDelete = [this.generateFullKey(pattern)];
      }

      if (keysToDelete.length === 0) {
        return 0;
      }

      const deletedCount = await this.client.del(keysToDelete);
      console.log(`[INFO] CacheService - Invalidated ${deletedCount} cache entries for pattern: ${pattern}`);
      
      return deletedCount;

    } catch (error) {
      console.error('[ERROR] CacheService - invalidateCache:', error.message);
      return 0;
    }
  }

  /**
   * Generate cache key for analytics data
   * @param {String} type - Type of analytics (trends, geographic, drivers, etc.)
   * @param {Object} filters - Filter parameters
   * @param {Object} dateRange - Date range parameters
   * @returns {String} Generated cache key
   */
  generateCacheKey(type, filters = {}, dateRange = {}) {
    try {
      const keyParts = [type];

      // Add date range to key
      if (dateRange.startDate && dateRange.endDate) {
        const startDate = new Date(dateRange.startDate).toISOString().split('T')[0];
        const endDate = new Date(dateRange.endDate).toISOString().split('T')[0];
        keyParts.push(`${startDate}_${endDate}`);
      }

      // Add filters to key
      const filterKeys = Object.keys(filters).sort();
      filterKeys.forEach(key => {
        if (filters[key] && filters[key] !== 'all') {
          keyParts.push(`${key}:${filters[key]}`);
        }
      });

      return keyParts.join('_');

    } catch (error) {
      console.error('[ERROR] CacheService - generateCacheKey:', error.message);
      return `${type}_${Date.now()}`; // Fallback key
    }
  }

  /**
   * Warm frequently accessed analytics data
   * @param {Object} analyticsEngine - Analytics engine instance
   * @returns {Promise<Object>} Warming results
   */
  async warmFrequentlyAccessedData(analyticsEngine) {
    if (!this.cacheEnabled || !this.isConnected || !analyticsEngine) {
      return { warmed: 0, errors: 0 };
    }

    console.log('[INFO] CacheService - Starting cache warming...');
    
    const warmingTasks = [];
    const results = { warmed: 0, errors: 0 };

    try {
      // Common date ranges for warming
      const now = new Date();
      const dateRanges = [
        {
          name: 'last_7_days',
          startDate: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
          endDate: now
        },
        {
          name: 'last_30_days',
          startDate: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
          endDate: now
        }
      ];

      // Common filter combinations
      const filterCombinations = [
        { category: 'all', status: 'all' },
        { category: 'illegal_dumping', status: 'all' },
        { category: 'recyclable', status: 'all' },
        { category: 'hazardous_waste', status: 'all' },
        { category: 'all', status: 'Completed' },
        { category: 'all', status: 'Pending' }
      ];

      // Warm trend data
      for (const dateRange of dateRanges) {
        for (const filters of filterCombinations) {
          warmingTasks.push(
            this.warmTrendData(analyticsEngine, dateRange, filters)
              .then(() => results.warmed++)
              .catch(() => results.errors++)
          );
        }
      }

      // Warm driver performance data
      const timeframes = ['7d', '30d'];
      for (const timeframe of timeframes) {
        warmingTasks.push(
          this.warmDriverData(analyticsEngine, timeframe)
            .then(() => results.warmed++)
            .catch(() => results.errors++)
        );
      }

      // Execute all warming tasks
      await Promise.allSettled(warmingTasks);

      console.log(`[INFO] CacheService - Cache warming completed: ${results.warmed} warmed, ${results.errors} errors`);
      return results;

    } catch (error) {
      console.error('[ERROR] CacheService - warmFrequentlyAccessedData:', error.message);
      return results;
    }
  }

  /**
   * Warm trend data cache
   * @param {Object} analyticsEngine - Analytics engine instance
   * @param {Object} dateRange - Date range
   * @param {Object} filters - Filters
   * @returns {Promise<void>}
   */
  async warmTrendData(analyticsEngine, dateRange, filters) {
    try {
      const cacheKey = this.generateCacheKey('trends', filters, dateRange);
      const existingData = await this.getCachedData(cacheKey);
      
      if (!existingData) {
        const trendData = await analyticsEngine.generateTrendData(dateRange, filters);
        await this.cacheAnalyticsData(cacheKey, trendData);
      }
    } catch (error) {
      console.error('[ERROR] CacheService - warmTrendData:', error.message);
      throw error;
    }
  }

  /**
   * Warm driver performance data cache
   * @param {Object} analyticsEngine - Analytics engine instance
   * @param {String} timeframe - Timeframe
   * @returns {Promise<void>}
   */
  async warmDriverData(analyticsEngine, timeframe) {
    try {
      const cacheKey = this.generateCacheKey('drivers', { timeframe });
      const existingData = await this.getCachedData(cacheKey);
      
      if (!existingData) {
        const now = new Date();
        const startDate = new Date();
        
        switch (timeframe) {
          case '7d':
            startDate.setDate(now.getDate() - 7);
            break;
          case '30d':
            startDate.setDate(now.getDate() - 30);
            break;
        }

        const driverData = await analyticsEngine.calculateDriverMetrics(null, { startDate, endDate: now });
        await this.cacheAnalyticsData(cacheKey, driverData);
      }
    } catch (error) {
      console.error('[ERROR] CacheService - warmDriverData:', error.message);
      throw error;
    }
  }

  /**
   * Get cache statistics
   * @returns {Promise<Object>} Cache statistics
   */
  async getCacheStats() {
    if (!this.cacheEnabled || !this.isConnected) {
      return {
        enabled: false,
        connected: false,
        keys: 0,
        memory: 0
      };
    }

    try {
      const info = await this.client.info('memory');
      const keyCount = await this.client.dbSize();
      
      // Parse memory info
      const memoryMatch = info.match(/used_memory:(\d+)/);
      const memory = memoryMatch ? parseInt(memoryMatch[1]) : 0;

      return {
        enabled: true,
        connected: this.isConnected,
        keys: keyCount,
        memory: Math.round(memory / 1024 / 1024 * 100) / 100, // MB
        ttl: this.defaultTTL
      };

    } catch (error) {
      console.error('[ERROR] CacheService - getCacheStats:', error.message);
      return {
        enabled: true,
        connected: false,
        error: error.message
      };
    }
  }

  /**
   * Clear all analytics cache
   * @returns {Promise<Number>} Number of keys cleared
   */
  async clearAllCache() {
    if (!this.cacheEnabled || !this.isConnected) {
      return 0;
    }

    try {
      const pattern = this.generateFullKey('*');
      const keys = await this.client.keys(pattern);
      
      if (keys.length === 0) {
        return 0;
      }

      const deletedCount = await this.client.del(keys);
      console.log(`[INFO] CacheService - Cleared ${deletedCount} cache entries`);
      
      return deletedCount;

    } catch (error) {
      console.error('[ERROR] CacheService - clearAllCache:', error.message);
      return 0;
    }
  }

  /**
   * Close Redis connection
   * @returns {Promise<void>}
   */
  async close() {
    if (this.client && this.isConnected) {
      try {
        await this.client.quit();
        console.log('[INFO] CacheService - Redis connection closed');
      } catch (error) {
        console.error('[ERROR] CacheService - Error closing Redis connection:', error.message);
      }
    }
  }

  // Private helper methods

  /**
   * Generate full cache key with prefix
   * @param {String} key - Base key
   * @returns {String} Full cache key
   */
  generateFullKey(key) {
    return `${this.keyPrefix}${key}`;
  }

  /**
   * Check if cache is available
   * @returns {Boolean} Cache availability status
   */
  isAvailable() {
    return this.cacheEnabled && this.isConnected;
  }

  /**
   * Get detailed cache service status
   * @returns {Object} Detailed status information
   */
  getStatus() {
    return {
      enabled: this.cacheEnabled,
      connected: this.isConnected,
      connectionAttempted: this.connectionAttempted,
      silentMode: this.silentMode,
      redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
      defaultTTL: this.defaultTTL,
      keyPrefix: this.keyPrefix
    };
  }

  /**
   * Test Redis connection
   * @returns {Promise<Object>} Connection test result
   */
  async testConnection() {
    if (!this.cacheEnabled) {
      return {
        success: false,
        message: 'Cache is disabled via configuration',
        status: 'disabled'
      };
    }

    if (!this.client) {
      return {
        success: false,
        message: 'Redis client not initialized',
        status: 'not_initialized'
      };
    }

    try {
      await this.client.ping();
      return {
        success: true,
        message: 'Redis connection successful',
        status: 'connected'
      };
    } catch (error) {
      return {
        success: false,
        message: `Redis connection failed: ${error.message}`,
        status: 'connection_failed'
      };
    }
  }

  /**
   * Attempt to reconnect to Redis
   * @returns {Promise<Boolean>} Reconnection success status
   */
  async reconnect() {
    if (this.client && this.isConnected) {
      console.log('[INFO] CacheService - Already connected to Redis');
      return true;
    }

    console.log('[INFO] CacheService - Attempting to reconnect to Redis...');
    
    // Reset connection state
    this.connectionAttempted = false;
    this.isConnected = false;
    
    if (this.client) {
      try {
        await this.client.quit();
      } catch (error) {
        // Ignore errors when closing existing connection
      }
      this.client = null;
    }

    // Attempt new connection
    if (this.silentMode) {
      await this.initializeRedisSilent();
    } else {
      await this.initializeRedis();
    }

    return this.isConnected;
  }
}

export default CacheService;