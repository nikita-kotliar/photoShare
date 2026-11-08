const db = require('../config/db');

async function revoke({ jti, exp }) {
  const expiresAt = new Date(exp * 1000);
  await db.tokenBlacklist.upsert({
    where: { jti },
    create: { jti, expiresAt },
    update: {},
  });
}

async function isRevoked(jti) {
  const entry = await db.tokenBlacklist.findUnique({ where: { jti } });
  return Boolean(entry);
}

async function cleanExpired(now = new Date()) {
  const { count } = await db.tokenBlacklist.deleteMany({ where: { expiresAt: { lt: now } } });
  return count;
}

module.exports = { revoke, isRevoked, cleanExpired };
