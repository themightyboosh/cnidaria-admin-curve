const express = require('express');
const router = express.Router();
const { validateCurveData } = require('../middleware/validation');
const CurveController = require('../controllers/curveController');

// Get all curves
router.get('/', CurveController.getAllCurves);

// Get curve by ID
router.get('/:id', CurveController.getCurveById);

// Create new curve
router.post('/', validateCurveData, CurveController.createCurve);

// Update curve
router.put('/:id', validateCurveData, CurveController.updateCurve);

// Delete curve
router.delete('/:id', CurveController.deleteCurve);

// Calculate curve transformations
router.post('/:id/transform', CurveController.transformCurve);

// Get curve statistics
router.get('/:id/stats', CurveController.getCurveStats);

module.exports = router;
