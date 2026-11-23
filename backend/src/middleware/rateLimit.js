const AppError = require('../utils/AppError');

const buckets = new Set();

function rateLimit({ windowMs, max, key = (req) => req.ip, message }) {
  const hits = new Map();
  buckets.add(hits);
  return (req, res, next) => {
    const now = Date.now();
    const id = key(req);
    let entry = hits.get(id);
    if (!entry || now >= entry.reset) {
      entry = { count: 0, reset: now + windowMs };
      hits.set(id, entry);
    }
    entry.count += 1;
    if (hits.size > 10_000) {
      for (const [k, v] of hits) if (now >= v.reset) hits.delete(k);
    }
    if (entry.count > max) {
      res.set('Retry-After', String(Math.ceil((entry.reset - now) / 1000)));
      return next(new AppError(429, 'RATE_LIMIT', message));
    }
    return next();
  };
}

function resetRateLimits() {
  for (const hits of buckets) hits.clear();
}

const loginLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Забагато спроб входу. Спробуйте за 15 хвилин',
});

const registerLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: 'Забагато реєстрацій з цієї адреси. Спробуйте пізніше',
});

const googleLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Забагато спроб входу через Google. Спробуйте пізніше',
});

module.exports = { rateLimit, resetRateLimits, loginLimit, registerLimit, googleLimit };
