const Joi = require('joi');
const logger = require('../utils/logger');

// Curve data validation schema
const curveSchema = Joi.object({
  name: Joi.string().min(1).max(100).required(),
  description: Joi.string().max(500).optional(),
  points: Joi.array().items(
    Joi.object({
      x: Joi.number().required(),
      y: Joi.number().required()
    })
  ).min(2).required(),
  type: Joi.string().valid('bezier', 'spline', 'linear', 'custom').required(),
  parameters: Joi.object({
    tension: Joi.number().min(0).max(1).optional(),
    smoothness: Joi.number().min(0).max(1).optional(),
    interpolation: Joi.string().valid('linear', 'cubic', 'hermite').optional()
  }).optional(),
  metadata: Joi.object({
    author: Joi.string().optional(),
    tags: Joi.array().items(Joi.string()).optional(),
    version: Joi.string().optional()
  }).optional()
});

// Validation middleware
const validateCurveData = (req, res, next) => {
  const { error, value } = curveSchema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true
  });

  if (error) {
    logger.warn('Validation error:', {
      errors: error.details.map(detail => detail.message),
      body: req.body
    });

    return res.status(400).json({
      success: false,
      error: {
        message: 'Validation failed',
        details: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
          type: detail.type
        }))
      },
      timestamp: new Date().toISOString()
    });
  }

  // Replace req.body with validated data
  req.body = value;
  next();
};

// Generic validation middleware
const validateSchema = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      logger.warn('Validation error:', {
        errors: error.details.map(detail => detail.message),
        body: req.body
      });

      return res.status(400).json({
        success: false,
        error: {
          message: 'Validation failed',
          details: error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message,
            type: detail.type
          }))
        },
        timestamp: new Date().toISOString()
      });
    }

    req.body = value;
    next();
  };
};

module.exports = {
  validateCurveData,
  validateSchema,
  curveSchema
};
