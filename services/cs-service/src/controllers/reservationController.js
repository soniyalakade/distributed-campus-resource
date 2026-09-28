const reservationService = require('../services/reservationService');
const { createLogger } = require('../sharedPath').resolve('utils/logger');

const NODE_ID = process.env.NODE_ID || 'CS';
const SERVICE_DEPARTMENT = process.env.DEPARTMENT || 'CS';
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
 *
 * A STUDENT is ALWAYS scoped to their own userId, regardless of any
 * query string they might send - req.user.userId (from the verified
 * JWT) wins, never a client-supplied value. This is what makes "my
 * reservations" safe to expose without a separate admin-only guard on
 * this same route.
 *
 * A DEPARTMENT_ADMIN whose token department matches this service's own
 * department may omit the filter to see every reservation in the
 * department (used by the Gateway's "department reservations" admin
 * view). An admin for a DIFFERENT department is rejected outright.
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
    // No studentId filter - admin sees the whole department.
  } else {
    return res.status(403).json({ error: 'Unrecognized role' });
  }

  logger.info('Reservation list requested', { role: req.user.role, studentId: studentId || 'ALL' });
  const reservations = await reservationService.listReservations(studentId);
  res.json(reservations);
}

module.exports = { reserve, cancel, list };
