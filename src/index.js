/**
 * Entry point for FetchtiumV2
 */

import { createServer } from './server.js';
import { config } from './config/index.js';
import { logger } from './utils/logger.js';
import { closeConnections } from './core/network/client.js';

const server = createServer();

/**
 * Start server
 */
async function start() {
  try {
    await server.listen({
      port: config.port,
      host: config.host
    });

    logger.info('server', `Server started on http://${config.host}:${config.port}`);
    logger.info('server', `Environment: ${config.env}`);
  } catch (error) {
    logger.error('server', 'Failed to start server', error);
    process.exit(1);
  }
}

/**
 * Graceful shutdown
 */
async function shutdown() {
  logger.info('server', 'Shutting down...');
  
  try {
    await server.close();
    await closeConnections();
    logger.info('server', 'Server closed');
    process.exit(0);
  } catch (error) {
    logger.error('server', 'Error during shutdown', error);
    process.exit(1);
  }
}

// Handle shutdown signals
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start server
start();
