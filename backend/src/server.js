const app = require('./app');
const env = require('./config/env');
const db = require('./config/db');

const server = app.listen(env.PORT, () => {
  console.log(`PhotoShare API: http://localhost:${env.PORT}/api`);
});

async function shutdown(signal) {
  console.log(`${signal}: зупиняю сервер`);
  server.close(async () => {
    await db.$disconnect();
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
