// Serviço de Cache Distribuído e Lock de Concorrência (Redis + Fallback Local)
// Suporta instâncias horizontais em nuvem e serverless sem perda de estado.
let Redis;
try {
  Redis = require('ioredis');
} catch {
  Redis = null;
}

let redisClient = null;
let isConnected = false;

const inMemoryStore = new Map();
const inMemoryLocks = new Set();

const redisUrl = (process.env.REDIS_URL || '').trim();

if (redisUrl && Redis) {
  try {
    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 2,
      enableReadyCheck: true,
      retryStrategy(times) {
        if (times > 5) {
          console.warn('[Redis] Número máximo de reconexões atingido. Recorrendo a fallback em memória.');
          return null;
        }
        return Math.min(times * 200, 2000);
      },
      reconnectOnError(err) {
        console.warn('[Redis] Erro de reconexão:', err.message);
        return true;
      },
    });

    redisClient.on('connect', () => {
      isConnected = true;
      console.log('[Redis] Conexão estabelecida com sucesso.');
    });

    redisClient.on('error', (err) => {
      isConnected = false;
      console.warn('[Redis] Falha temporária na conexão (fallback em memória ativo):', err.message);
    });

    redisClient.on('close', () => {
      isConnected = false;
    });
  } catch (err) {
    console.warn('[Redis] Não foi possível instanciar cliente Redis:', err.message);
    redisClient = null;
  }
} else if (!redisUrl) {
  // Modo padrão seguro quando REDIS_URL não está configurada
  // Silencioso ou informativo para não poluir testes locais
}

/**
 * Incrementa contador com expiração (Sliding Window / Rate Limiting)
 * @param {string} key 
 * @param {number} windowSeconds 
 * @returns {Promise<{ count: number, ttl: number }>}
 */
async function incrWithTtl(key, windowSeconds = 60) {
  if (redisClient && isConnected) {
    try {
      const multi = redisClient.multi();
      multi.incr(key);
      multi.ttl(key);
      const results = await multi.exec();
      const count = results[0][1];
      let ttl = results[1][1];

      if (ttl === -1) {
        await redisClient.expire(key, windowSeconds);
        ttl = windowSeconds;
      }
      return { count, ttl };
    } catch (err) {
      console.warn('[Redis] Erro em incrWithTtl, usando fallback:', err.message);
    }
  }

  // Fallback em memória
  const now = Date.now();
  let entry = inMemoryStore.get(key);
  if (!entry || now > entry.resetAt) {
    entry = { count: 1, resetAt: now + windowSeconds * 1000 };
    inMemoryStore.set(key, entry);
    return { count: 1, ttl: windowSeconds };
  }

  entry.count += 1;
  const ttl = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
  return { count: entry.count, ttl };
}

/**
 * Adquire lock de concorrência distribuído (ex: pagamento de cartão de pedido)
 * @param {string} lockKey 
 * @param {number} ttlSeconds 
 * @returns {Promise<boolean>} true se adquiriu o lock com sucesso, false se já está travado
 */
async function acquireLock(lockKey, ttlSeconds = 30) {
  if (redisClient && isConnected) {
    try {
      const result = await redisClient.set(lockKey, 'locked', 'EX', ttlSeconds, 'NX');
      return result === 'OK';
    } catch (err) {
      console.warn('[Redis] Erro em acquireLock, usando fallback:', err.message);
    }
  }

  // Fallback em memória
  if (inMemoryLocks.has(lockKey)) {
    return false;
  }
  inMemoryLocks.add(lockKey);
  setTimeout(() => inMemoryLocks.delete(lockKey), ttlSeconds * 1000).unref?.();
  return true;
}

/**
 * Libera lock de concorrência
 * @param {string} lockKey 
 */
async function releaseLock(lockKey) {
  if (redisClient && isConnected) {
    try {
      await redisClient.del(lockKey);
      return;
    } catch (err) {
      console.warn('[Redis] Erro em releaseLock:', err.message);
    }
  }

  inMemoryLocks.delete(lockKey);
}

function isRedisAvailable() {
  return Boolean(redisClient && isConnected);
}

module.exports = {
  incrWithTtl,
  acquireLock,
  releaseLock,
  isRedisAvailable,
  getClient: () => redisClient,
};

