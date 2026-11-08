const blacklistService = require('../services/blacklistService');

const INTERVAL_MS = 60 * 60 * 1000;

async function cleanBlacklist() {
  try {
    const count = await blacklistService.cleanExpired();
    if (count > 0) console.log(`Blacklist: видалено прострочених токенів: ${count}`);
  } catch (err) {
    console.error('Blacklist: не вдалося очистити прострочені токени', err.message);
  }
}

function startCleanBlacklist(intervalMs = INTERVAL_MS) {
  cleanBlacklist();
  const timer = setInterval(cleanBlacklist, intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}

module.exports = { cleanBlacklist, startCleanBlacklist };
