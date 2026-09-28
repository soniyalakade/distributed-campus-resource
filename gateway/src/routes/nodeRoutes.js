const express = require('express');
const nodeController = require('../controllers/nodeController');
const { jwtAuth } = require('../middleware/jwtAuth');
const { requireAuthenticated } = require('../middleware/roleCheck');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

router.get('/', jwtAuth, requireAuthenticated, asyncHandler(nodeController.listNodes));
router.get('/health', jwtAuth, requireAuthenticated, asyncHandler(nodeController.nodesHealth));

module.exports = router;
