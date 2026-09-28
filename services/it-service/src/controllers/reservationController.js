const reservationService = require('../services/reservationService');
const { createLogger } = require('../sharedPath').resolve('utils/logger');

const NODE_ID = process.env.NODE_ID || 'IT';
const SERVICE_DEPARTMENT = process.env.DEPARTMENT || 'IT';
const logger = createLogger(NODE_ID);

async function reserve(req, res) {
  const { resourceId, studentId } = req.body;
  logger.info('Reservation request received', { resourceId, studentId });
  const reservation = await reservationService.reserveResource(resourceId, studentId);
  res.status(201).json(reservation);
}

async function cancel(req, res) {
  const { studentId } = req.body;
  logger.info('Reservation cancellation request', { reservationId: req.params.id });
  const reservation = await reservationService.cancelReservation(req.params.id, studentId);
  res.json(reservation);
}


/**
 * GET /internal/reservations
 * STUDENT is always scoped to req.user.userId; DEPARTMENT_ADMIN
 * (matching this service's own department) may see the whole department.
 */
async function list(req, res) {
  let studentId;

  if (req.user.role === 'STUDENT') {
    studentId = req.user.userId;
  } else if (req.user.role === 'DEPARTMENT_ADMIN') {
    if (req.user.department !== SERVICE_DEPARTMENT) {
      return res.status(403).json({
        error: `Admin for department '${req.user.department}' cannot view '${SERVICE_DEPARTMENT}' reservations`,
      });
    }
  } else {
    return res.status(403).json({ error: 'Unrecognized role' });
  }

  const reservations = await reservationService.listReservations(studentId);
  res.json(reservations);
}

module.exports = { reserve, cancel, list };
