const { v4: uuidv4 } = require('uuid');
const Resource = require('../models/Resource');
const Reservation = require('../models/Reservation');
const BorrowRecord = require('../models/BorrowRecord');
const { NotFoundError, BadRequestError } = require('./resourceService');
const { publish, EVENTS } = require('../messaging/publisher');

const DEFAULT_LOAN_DAYS = 14;
const DEPARTMENT = process.env.DEPARTMENT || 'IT';

/**
 * Marks a reserved unit as borrowed: reservedQuantity -> borrowedQuantity.
 * Requires an existing APPROVED reservation for this student+resource so
 * a student cannot borrow a unit they never reserved.
 */
async function borrowResource(resourceId, studentId) {
  const reservation = await Reservation.findOne({
    resourceId,
    studentId,
    status: 'APPROVED',
  });

  if (!reservation) {
    throw new BadRequestError(
      'No approved reservation found for this student and resource - reserve before borrowing'
    );
  }

  const updatedResource = await Resource.findOneAndUpdate(
    { resourceId, reservedQuantity: { $gt: 0 } },
    {
      $inc: {
        reservedQuantity: -1,
        borrowedQuantity: 1,
        version: 1,
      },
    },
    { new: true }
  );

  if (!updatedResource) {
    throw new BadRequestError('Resource has no reserved units available to borrow');
  }

  reservation.status = 'FULFILLED';
  await reservation.save();

  const now = new Date();
  const dueAt = new Date(now.getTime() + DEFAULT_LOAN_DAYS * 24 * 60 * 60 * 1000);

  const record = new BorrowRecord({
    recordId: uuidv4(),
    resourceId,
    studentId,
    borrowedAt: now,
    dueAt,
    returnedAt: null,
    condition: updatedResource.condition,
  });
  await record.save();

  await publish(EVENTS.RESOURCE_BORROWED, {
    recordId: record.recordId,
    resourceId,
    studentId,
    dueAt,
    borrowedQuantity: updatedResource.borrowedQuantity,
    availableQuantity: updatedResource.availableQuantity,
  });

  return record;
}

/**
 * Marks a borrowed unit as returned: borrowedQuantity -> availableQuantity.
 */
async function returnResource(resourceId, studentId, condition) {
  const record = await BorrowRecord.findOne({
    resourceId,
    studentId,
    returnedAt: null,
  }).sort({ borrowedAt: -1 });

  if (!record) {
    throw new NotFoundError('No active borrow record found for this student and resource');
  }

  const updatedResource = await Resource.findOneAndUpdate(
    { resourceId, borrowedQuantity: { $gt: 0 } },
    {
      $inc: {
        borrowedQuantity: -1,
        availableQuantity: 1,
        version: 1,
      },
      ...(condition ? { condition } : {}),
    },
    { new: true }
  );

  if (!updatedResource) {
    throw new NotFoundError(`Resource '${resourceId}' not found or has no borrowed units`);
  }

  record.returnedAt = new Date();
  if (condition) {
    record.condition = condition;
  }
  await record.save();

  await publish(EVENTS.RESOURCE_RETURNED, {
    recordId: record.recordId,
    resourceId,
    studentId,
    availableQuantity: updatedResource.availableQuantity,
    borrowedQuantity: updatedResource.borrowedQuantity,
  });

  return record;
}


/**
 * Lists this department's ACTIVE (not yet returned) borrow records for
 * one student. Enriches each with resourceName/department from THIS
 * SAME service's own Resource collection - no cross-service call.
 */
async function getActiveBorrowRecords(studentId) {
  const records = await BorrowRecord.find({ studentId, returnedAt: null }).sort({ borrowedAt: -1 });
  if (records.length === 0) {
    return [];
  }

  const resourceIds = [...new Set(records.map((r) => r.resourceId))];
  const resources = await Resource.find({ resourceId: { $in: resourceIds } });
  const nameById = new Map(resources.map((r) => [r.resourceId, r.name]));

  return records.map((r) => ({
    recordId: r.recordId,
    resourceId: r.resourceId,
    resourceName: nameById.get(r.resourceId) || null,
    department: DEPARTMENT,
    studentId: r.studentId,
    borrowedAt: r.borrowedAt,
    dueAt: r.dueAt,
    returnedAt: r.returnedAt,
    condition: r.condition,
  }));
}

module.exports = { borrowResource, returnResource, getActiveBorrowRecords };
