import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

// Configuration Redis optimisée pour serverless
class CacheService {
  constructor() {
    this.redis = null;
    this.isConnected = false;
    this.connectionPromise = null;
    this.retryCount = 0;
    this.maxRetries = 3;
    
    // TTL par type de données
    this.ttlConfig = {
      user: parseInt(process.env.REDIS_TTL_USER) || 1800,        // 30min
      subscription: parseInt(process.env.REDIS_TTL_SUBSCRIPTION) || 900,  // 15min
      partners: parseInt(process.env.REDIS_TTL_PARTNERS) || 3600,        // 1h
      geo: parseInt(process.env.REDIS_TTL_GEO) || 86400,               // 24h
      auth: parseInt(process.env.REDIS_TTL_USER) || 1800               // 30min
    };
    
    // Préfixes pour éviter les collisions
    this.prefixes = {
      user: 'usr:',
      subscription: 'sub:',
      partners: 'ptn:',
      geo: 'geo:',
      auth: 'auth:',
      rate: 'rate:'
    };
  }

  // Connexion lazy avec retry automatique
  async connect() {
    if (this.isConnected && this.redis) {
      return this.redis;
    }
    
    if (this.connectionPromise) {
      return this.connectionPromise;
    }
    
    this.connectionPromise = this._establishConnection();
    return this.connectionPromise;
  }
  
  async _establishConnection() {
    try {
      console.log('Connexion Redis...');
      
      const redisConfig = {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        db: process.env.REDIS_DB || 0,
        // Optimisations serverless
        lazyConnect: true,
        keepAlive: 30000,
        connectTimeout: 10000,
        commandTimeout: 5000,
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
        family: 4
      };
      
      // Support Redis URL
      if (process.env.REDIS_URL) {
        this.redis = new Redis(process.env.REDIS_URL, redisConfig);
      } else {
        this.redis = new Redis(redisConfig);
      }
      
      // Event listeners
      this.redis.on('connect', () => {
        console.log('Redis connecté');
        this.isConnected = true;
        this.retryCount = 0;
      });
      
      this.redis.on('error', (err) => {
        console.error('Redis erreur:', err.message);
        this.isConnected = false;
      });
      
      this.redis.on('close', () => {
        console.log('Redis connexion fermée');
        this.isConnected = false;
      });
      
      // Test de connexion
      await this.redis.ping();
      
      return this.redis;
    } catch (error) {
      console.error('Échec connexion Redis:', error.message);
      this.isConnected = false;
      this.connectionPromise = null;
      
      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        console.log(`Retry Redis ${this.retryCount}/${this.maxRetries}`);
        await new Promise(resolve => setTimeout(resolve, 1000 * this.retryCount));
        return this._establishConnection();
      }
      
      throw error;
    }
  }

  // Interface unifiée de cache
  async get(key, type = 'user') {
    if (!process.env.CACHE_ENABLED === 'true') return null;
    
    try {
      await this.connect();
      const fullKey = this.prefixes[type] + key;
      const value = await this.redis.get(fullKey);
      
      if (value) {
        console.log(`Cache HIT: ${fullKey}`);
        return JSON.parse(value);
      }
      
      console.log(`Cache MISS: ${fullKey}`);
      return null;
    } catch (error) {
      console.error('Cache GET error:', error.message);
      return null; // Graceful degradation
    }
  }

  async set(key, value, type = 'user', customTTL = null) {
    if (!process.env.CACHE_ENABLED === 'true') return false;
    
    try {
      await this.connect();
      const fullKey = this.prefixes[type] + key;
      const ttl = customTTL || this.ttlConfig[type];
      
      await this.redis.setex(fullKey, ttl, JSON.stringify(value));
      console.log(`Cache SET: ${fullKey} (TTL: ${ttl}s)`);
      return true;
    } catch (error) {
      console.error('Cache SET error:', error.message);
      return false;
    }
  }

  async del(key, type = 'user') {
    if (!process.env.CACHE_ENABLED === 'true') return false;
    
    try {
      await this.connect();
      const fullKey = this.prefixes[type] + key;
      await this.redis.del(fullKey);
      console.log(`Cache DEL: ${fullKey}`);
      return true;
    } catch (error) {
      console.error('Cache DEL error:', error.message);
      return false;
    }
  }

  // Invalidation par pattern
  async invalidatePattern(pattern, type = 'user') {
    if (!process.env.CACHE_ENABLED === 'true') return false;
    
    try {
      await this.connect();
      const fullPattern = this.prefixes[type] + pattern;
      const keys = await this.redis.keys(fullPattern);
      
      if (keys.length > 0) {
        await this.redis.del(...keys);
        console.log(`Cache invalidated: ${keys.length} keys matching ${fullPattern}`);
      }
      
      return true;
    } catch (error) {
      console.error('Cache invalidation error:', error.message);
      return false;
    }
  }

  // Cache avec fonction de fallback
  async getOrSet(key, type, fallbackFn, customTTL = null) {
    const cached = await this.get(key, type);
    
    if (cached !== null) {
      return cached;
    }
    
    try {
      const freshData = await fallbackFn();
      if (freshData !== null && freshData !== undefined) {
        await this.set(key, freshData, type, customTTL);
      }
      return freshData;
    } catch (error) {
      console.error('Fallback function error:', error.message);
      throw error;
    }
  }

  // Rate limiting
  async checkRateLimit(identifier, limit = 100, window = 3600) {
    if (!process.env.CACHE_ENABLED === 'true') return { allowed: true, remaining: limit };
    
    try {
      await this.connect();
      const key = this.prefixes.rate + identifier;
      
      const current = await this.redis.incr(key);
      
      if (current === 1) {
        await this.redis.expire(key, window);
      }
      
      const remaining = Math.max(0, limit - current);
      const allowed = current <= limit;
      
      return { allowed, remaining, current };
    } catch (error) {
      console.error('Rate limit error:', error.message);
      return { allowed: true, remaining: limit }; // Graceful degradation
    }
  }

  // Health check
  async health() {
    try {
      await this.connect();
      const start = Date.now();
      await this.redis.ping();
      const latency = Date.now() - start;
      
      return {
        status: 'healthy',
        latency: `${latency}ms`,
        connected: this.isConnected
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        connected: false
      };
    }
  }

  // Fermeture propre
  async disconnect() {
    if (this.redis) {
      await this.redis.quit();
      this.redis = null;
      this.isConnected = false;
      this.connectionPromise = null;
      console.log('Redis déconnecté');
    }
  }
}

// Instance singleton
const cacheService = new CacheService();
export default cacheService;
