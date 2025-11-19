import { server } from './server.js';
import logger from './utils/logger.js';

// Port and host configuration from environment variables
const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || 'localhost';

// Start the server
server.listen(PORT, HOST, () => {
  logger.info(`POC server running on http://${HOST}:${PORT}`);
  logger.info(`WebSocket server running on ws://${HOST}:${PORT}`);
});
