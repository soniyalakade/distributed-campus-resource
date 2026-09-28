const express = require('express');
const reservationController = require('../controllers/reservationController');
const borrowController = require('../controllers/borrowController');
const { jwtAuth } = require('../middleware/jwtAuth');
const { requireAuthenticated } = require('../middleware/roleCheck');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

// Reservations - any authenticated student (or admin, for testing) may act.
router.post('/reservations', jwtAuth, requireAuthenticated, asyncHandler(reservationController.reserve));
router.delete('/reservations/:id', jwtAuth, requireAuthenticated, asyncHandler(reservationController.cancel));
// List: STUDENT is always scoped to their own reservations; DEPARTMENT_ADMIN
// (matching this service's own department) sees the whole department.
// Fine-grained scoping is enforced inside the controller, not here.
router.get('/reservations', jwtAuth, requireAuthenticated, asyncHandler(reservationController.list));

// Borrow / return, scoped under /resources/:id/...
router.post('/resources/:id/borrow', jwtAuth, requireAuthenticated, asyncHandler(borrowController.borrow));
router.post('/resources/:id/return', jwtAuth, requireAuthenticated, asyncHandler(borrowController.returnItem));
// Active borrow records for the calling student - see borrowController.listActive
// for why studentId is taken from the JWT and never from client input.
router.get('/borrow-records', jwtAuth, requireAuthenticated, asyncHandler(borrowController.listActive));

module.exports = router;
