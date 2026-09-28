const express = require('express');
const distributedController = require('../controllers/distributedController');
const { jwtAuth } = require('../middleware/jwtAuth');
const { requireAuthenticated } = require('../middleware/roleCheck');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

router.get('/heartbeat', jwtAuth, requireAuthenticated, asyncHandler(distributedController.getHeartbeat));

module.exports = router;
