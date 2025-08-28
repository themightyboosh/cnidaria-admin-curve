const logger = require('../utils/logger');

const notFoundHandler = (req, res, next) => {
  logger.warn(`Route not found: ${req.method} ${req.url}`);
  
  res.status(404).json({
    success: false,
    error: {
      message: `Route ${req.method} ${req.url} not found`,
      code: 'ROUTE_NOT_FOUND'
    },
    timestamp: new Date().toISOString(),
    path: req.url,
    method: req.method
  });
};

module.exports = notFoundHandler;
