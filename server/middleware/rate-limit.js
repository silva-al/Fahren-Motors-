// Limitador de tentativas com suporte a Redis distribuído e fallback em memória.
// Trava ataques de força bruta nas telas de login e checkout mesmo em arquitetura serverless.
const redisService = require('../services/redis-service');

const buckets = new Map();

// Limpeza periódica em memória para evitar memory leak
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of buckets) {
    if (now > entry.resetAt) buckets.delete(key);
  }
}, CLEANUP_INTERVAL_MS);
if (typeof cleanupTimer.unref === 'function') cleanupTimer.unref();

function clientKey(req) {
  const forwarded = (req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || req.ip || req.socket?.remoteAddress || 'desconhecido';
}

/**
 * @param {object} options
 * @param {number} options.windowMs  janela de tempo
 * @param {number} options.max       tentativas permitidas na janela
 * @param {string} options.message   mensagem devolvida ao estourar
 * @param {boolean} options.countOnlyFailures  se true, só conta respostas 4xx/5xx
 */
function rateLimit({ windowMs, max, message, countOnlyFailures = false }) {
  const windowSec = Math.max(1, Math.ceil(windowMs / 1000));

  return async (req, res, next) => {
    const rawKey = `${req.baseUrl || ''}${req.path || ''}|${clientKey(req)}`;
    const redisKey = `ratelimit:${rawKey}`;

    if (countOnlyFailures) {
      // Monitora apenas respostas com falha (4xx/5xx)
      res.on('finish', async () => {
        if (res.statusCode >= 400) {
          if (redisService.isRedisAvailable()) {
            await redisService.incrWithTtl(redisKey, windowSec);
          } else {
            const now = Date.now();
            let entry = buckets.get(rawKey);
            if (!entry || now > entry.resetAt) {
              entry = { count: 0, resetAt: now + windowMs };
              buckets.set(rawKey, entry);
            }
            entry.count += 1;
          }
        }
      });
      return next();
    }

    if (redisService.isRedisAvailable()) {
      try {
        const { count, ttl } = await redisService.incrWithTtl(redisKey, windowSec);
        if (count > max) {
          res.set('Retry-After', String(ttl));
          return res.status(429).json({ error: message });
        }
        return next();
      } catch (err) {
        console.warn('[RateLimit] Falha no Redis, usando fallback local:', err.message);
      }
    }

    // Fallback local em memória
    const now = Date.now();
    let entry = buckets.get(rawKey);
    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
      buckets.set(rawKey, entry);
    }

    if (entry.count >= max) {
      const retryAfterSec = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
      res.set('Retry-After', String(retryAfterSec));
      return res.status(429).json({ error: message });
    }

    entry.count += 1;
    next();
  };
}

module.exports = { rateLimit };
