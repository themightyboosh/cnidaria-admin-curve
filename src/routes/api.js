const express = require('express');
const router = express.Router();

// Import route modules
const healthRoutes = require('./health');
const curveRoutes = require('./curves');

// Health check route
router.use('/health', healthRoutes);

// Curve-related routes
router.use('/curves', curveRoutes);

// API info endpoint
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'New Cnidaria API',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      curves: '/api/curves',
      docs: '/api/docs'
    },
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
