const borrowService = require('../services/borrowService');
const { createLogger } = require('../sharedPath').resolve('utils/logger');

const NODE_ID = process.env.NODE_ID || 'CS';
const logger = createLogger(NODE_ID);

async function borrow(req, res) {
  const { studentId } = req.body;
  logger.info('Borrow request received', { resourceId: req.params.id, studentId });
  const record = await borrowService.borrowResource(req.params.id, studentId);
  res.status(201).json(record);
}

async function returnItem(req, res) {
  const { studentId, condition } = req.body;
  logger.info('Return request received', { resourceId: req.params.id, studentId });
  const record = await borrowService.returnResource(req.params.id, studentId, condition);
  res.json(record);
}

/**
 * GET /internal/borrow-records
 * Returns this student's active (not yet returned) borrow records
 * owned by this department. studentId comes from req.user.userId (the
 * verified JWT), never from a query param or body - same pattern as
 * reservationController.list's STUDENT scoping.
 */
async function listActive(req, res) {
  const studentId = req.user.userId;
  logger.info('Active borrow records requested', { studentId });
  const records = await borrowService.getActiveBorrowRecords(studentId);
  res.json(records);
}

module.exports = { borrow, returnItem, listActive };
