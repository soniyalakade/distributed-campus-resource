const express = require('express');
const reservationController = require('../controllers/reservationController');
const { jwtAuth } = require('../middleware/jwtAuth');
const { requireAuthenticated } = require('../middleware/roleCheck');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

// Registered before '/:id' so the literal path 'my' is never captured
// as an :id param.
router.get('/my', jwtAuth, requireAuthenticated, asyncHandler(reservationController.myReservations));
router.post('/', jwtAuth, requireAuthenticated, asyncHandler(reservationController.reserve));
router.delete('/:id', jwtAuth, requireAuthenticated, asyncHandler(reservationController.cancel));

module.exports = router;
