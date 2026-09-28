const express = require('express');
const adminController = require('../controllers/adminController');
const { jwtAuth } = require('../middleware/jwtAuth');
const { requireDepartmentAdmin } = require('../middleware/roleCheck');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

// Order matters: '/resources/all' must be registered before '/resources/:id'
// so it isn't swallowed as an :id param.
router.get('/resources/all', jwtAuth, requireDepartmentAdmin, asyncHandler(adminController.listAllResources));
router.get('/resources', jwtAuth, requireDepartmentAdmin, asyncHandler(adminController.listOwnDepartmentResources));
router.post('/resources', jwtAuth, requireDepartmentAdmin, asyncHandler(adminController.createResource));
router.put('/resources/:id', jwtAuth, requireDepartmentAdmin, asyncHandler(adminController.updateResource));
router.delete('/resources/:id', jwtAuth, requireDepartmentAdmin, asyncHandler(adminController.deleteResource));

router.get('/reservations', jwtAuth, requireDepartmentAdmin, asyncHandler(adminController.listReservations));

module.exports = router;
