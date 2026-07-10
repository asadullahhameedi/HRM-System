const app = require('./app');
const { connectDB } = require('./config/db');
const env = require('./config/env');
const logger = require('./utils/logger');

process.on('uncaughtException', (err) => {
  logger.error('UNCAUGHT EXCEPTION:', err);
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  logger.error('UNHANDLED REJECTION:', err);
});

async function start() {
  await connectDB();
  app.listen(env.port, () => {
    logger.info(`${env.appName} running in ${env.nodeEnv} mode on port ${env.port}`);
    logger.info(`Visit: ${env.appUrl}`);
  });
}

start();
