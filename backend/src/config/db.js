const { PrismaClient } = require('@prisma/client');

// Один екземпляр на весь застосунок: кожен `new PrismaClient()` відкриває свій пул з'єднань.
const globalForPrisma = globalThis;

const db =
  globalForPrisma.__photoshareDb ??
  new PrismaClient({ log: process.env.NODE_ENV === 'production' ? ['error'] : ['warn', 'error'] });

globalForPrisma.__photoshareDb = db;

module.exports = db;
