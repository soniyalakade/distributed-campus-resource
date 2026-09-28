const express = require('express');
const p2pController = require('../controllers/p2pController');
const { jwtAuth } = require('../middleware/jwtAuth');
const { requireAuthenticated } = require('../middleware/roleCheck');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

// Receiving endpoint: another department (or a test client) calls this
// directly. Same auth middleware as every other internal route.
router.get('/availability', jwtAuth, requireAuthenticated, asyncHandler(p2pController.availability));

// Initiating endpoint: this department calls out to peers and aggregates.
router.get('/check', jwtAuth, requireAuthenticated, asyncHandler(p2pController.check));

module.exports = router;
