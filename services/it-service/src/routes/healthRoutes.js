const express = require('express');
const healthController = require('../controllers/healthController');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

// Intentionally NOT behind jwtAuth - the Gateway and Docker healthchecks
// need to reach this without a token.
router.get('/', asyncHandler(healthController.health));

module.exports = router;
