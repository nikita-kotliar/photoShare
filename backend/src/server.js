const app = require('./app');
const env = require('./config/env');
const db = require('./config/db');

const SHUTDOWN_TIMEOUT_MS = 10_000;

const server = app.listen(env.PORT, () => {
  console.log(`PhotoShare API: http://localhost:${env.PORT}/api`);
});

let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal}: зупиняю сервер`);

  // Якщо з'єднання не закриваються, не висимо вічно
  setTimeout(() => {
    console.error('Graceful shutdown: перевищено час очікування, виходжу примусово');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS).unref();

  server.close(async (err) => {
    try {
      await db.$disconnect();
    } catch (disconnectErr) {
      console.error('Не вдалося закрити з’єднання з БД:', disconnectErr.message);
      process.exit(1);
    }
    process.exit(err ? 1 : 0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
