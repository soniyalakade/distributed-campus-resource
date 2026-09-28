const express = require('express');
const resourceController = require('../controllers/resourceController');
const { jwtAuth } = require('../middleware/jwtAuth');
const { requireOwnDepartmentAdmin, requireAuthenticated } = require('../middleware/roleCheck');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

// Read-only: any authenticated user (student or admin) can view/search.
router.get('/', jwtAuth, requireAuthenticated, asyncHandler(resourceController.list));
router.get('/:id', jwtAuth, requireAuthenticated, asyncHandler(resourceController.getOne));

// Mutating: only this department's own admin.
router.post('/', jwtAuth, requireOwnDepartmentAdmin, asyncHandler(resourceController.create));
router.put('/:id', jwtAuth, requireOwnDepartmentAdmin, asyncHandler(resourceController.update));
router.delete('/:id', jwtAuth, requireOwnDepartmentAdmin, asyncHandler(resourceController.remove));

module.exports = router;
