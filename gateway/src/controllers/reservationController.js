const resourceProxyService = require('../services/resourceProxyService');
const { createLogger } = require('../sharedPath').resolve('utils/logger');

const logger = createLogger('Gateway');

/**
 * NOTE (Phase 2 known limitation): the client must specify `department`
 * in the request body, since a resourceId alone (a UUID) doesn't reveal
 * which department node owns it. The frontend has this information
 * already, because it came from a prior search/get-by-id response.
 * A future phase could add a lightweight resourceId->department index
 * in the Gateway to remove this requirement, but that is out of scope
 * for Phase 2.
 */
async function reserve(req, res) {
  const { department, resourceId } = req.body;
  const studentId = req.user.userId;

  if (!department || !resourceId) {
    return res.status(400).json({ error: 'department and resourceId are required' });
  }

  logger.info('Reservation request forwarded', { department, resourceId, studentId });
  const reservation = await resourceProxyService.createReservation(
    { department, resourceId, studentId },
    req.authHeader
  );
  res.status(201).json(reservation);
}

async function cancel(req, res) {
  const { department } = req.body;
  const studentId = req.user.userId;

  if (!department) {
    return res.status(400).json({ error: 'department is required to route the cancellation' });
  }

  logger.info('Reservation cancellation forwarded', { reservationId: req.params.id, department });
  const reservation = await resourceProxyService.cancelReservation(
    { department, reservationId: req.params.id, studentId },
    req.authHeader
  );
  res.json(reservation);
}

/**
 * GET /api/reservations/my - aggregates the calling student's own
 * reservations across CS/IT/ENTC. See resourceProxyService.listMyReservations
 * for why this is a live fan-out rather than a Gateway-owned copy.
 */
async function myReservations(req, res) {
  logger.info('My-reservations request', { studentId: req.user.userId });
  const reservations = await resourceProxyService.listMyReservations(req.authHeader);
  res.json(reservations);
}

module.exports = { reserve, cancel, myReservations };
