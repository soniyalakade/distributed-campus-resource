const resourceProxyService = require('../services/resourceProxyService');
const { createLogger } = require('../sharedPath').resolve('utils/logger');

const logger = createLogger('Gateway');

async function borrow(req, res) {
  const { department } = req.body;
  const studentId = req.user.userId;

  if (!department) {
    return res.status(400).json({ error: 'department is required to route the borrow request' });
  }

  logger.info('Borrow request forwarded', { resourceId: req.params.id, department });
  const record = await resourceProxyService.borrowResource(
    { department, resourceId: req.params.id, studentId },
    req.authHeader
  );
  res.status(201).json(record);
}

async function returnItem(req, res) {
  const { department, condition } = req.body;
  const studentId = req.user.userId;

  if (!department) {
    return res.status(400).json({ error: 'department is required to route the return request' });
  }

  logger.info('Return request forwarded', { resourceId: req.params.id, department });
  const record = await resourceProxyService.returnResource(
    { department, resourceId: req.params.id, studentId, condition },
    req.authHeader
  );
  res.json(record);
}

/**
 * GET /api/borrow/my - aggregates the calling student's ACTIVE borrow
 * records across CS/IT/ENTC. studentId is never read from this
 * request - req.user.userId (from the verified JWT) is what each
 * department service uses server-side; the Gateway does not pass or
 * trust any studentId of its own. Same live fan-out, no central copy,
 * pattern as resourceProxyService.listMyReservations.
 */
async function myBorrowedResources(req, res) {
  logger.info('My-borrowed-resources request', { studentId: req.user.userId });
  const records = await resourceProxyService.listMyBorrowRecords(req.authHeader);
  res.json(records);
}

module.exports = { borrow, returnItem, myBorrowedResources };
