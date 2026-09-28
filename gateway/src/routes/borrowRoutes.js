const express = require('express');
const borrowController = require('../controllers/borrowController');
const { jwtAuth } = require('../middleware/jwtAuth');
const { requireAuthenticated } = require('../middleware/roleCheck');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

router.post('/:id/borrow', jwtAuth, requireAuthenticated, asyncHandler(borrowController.borrow));
router.post('/:id/return', jwtAuth, requireAuthenticated, asyncHandler(borrowController.returnItem));
// Registered on the same router as the id-scoped routes above but this
// router is ALSO mounted at /api/borrow in server.js specifically so
// this one lives at the required public path GET /api/borrow/my,
// alongside the existing GET /api/reservations/my convention.
router.get('/my', jwtAuth, requireAuthenticated, asyncHandler(borrowController.myBorrowedResources));

module.exports = router;
