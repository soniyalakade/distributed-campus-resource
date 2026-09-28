const express = require('express');
const resourceController = require('../controllers/resourceController');
const { jwtAuth } = require('../middleware/jwtAuth');
const { requireAuthenticated } = require('../middleware/roleCheck');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

router.get('/search', jwtAuth, requireAuthenticated, asyncHandler(resourceController.search));
router.get('/search-grpc', jwtAuth, requireAuthenticated, asyncHandler(resourceController.searchGrpc));
router.get('/:id', jwtAuth, requireAuthenticated, asyncHandler(resourceController.getOne));

module.exports = router;
