const { v4: uuidv4 } = require('uuid');
const Resource = require('../models/Resource');
const Reservation = require('../models/Reservation');
const { NotFoundError, BadRequestError } = require('./resourceService');
const { publish, EVENTS } = require('../messaging/publisher');

const SERVICE_DEPARTMENT = process.env.DEPARTMENT || 'IT';

/**
 * Creates a reservation for a resource owned by this department.
 *
 * Steps (per Phase 2 spec):
 *   1. Verify resource exists.
 *   2. Verify availableQuantity > 0.
 *   3. Create reservation.
 *   4. Decrease availableQuantity / increase reservedQuantity.
 *   5. Increment resource version.
 *   6. Return the reservation.
 *
 * Uses a single atomic findOneAndUpdate with a quantity guard
 * (availableQuantity: { $gt: 0 }) so two near-simultaneous requests
 * against THIS SAME service/DB cannot both succeed on the last unit -
 * MongoDB's atomic update guarantees that.
 *
 * IMPORTANT / TODO (FA-2): this atomicity only protects against
 * concurrent requests hitting this one department's DB. It does NOT
 * implement distributed mutual exclusion across department nodes.
 * The cross-node contention scenario described in the approved
 * architecture (two entry points racing for the same resourceId lock)
 * will be protected by the Ricart-Agrawala algorithm added in Phase 6.
 * Until then, this is single-node atomicity only - not distributed
 * mutual exclusion.
 */
async function reserveResource(resourceId, studentId) {
  const existingActive = await Reservation.findOne({
    resourceId,
    studentId,
    status: { $in: ['PENDING', 'APPROVED'] },
  });
  if (existingActive) {
    throw new BadRequestError('You already have an active reservation for this resource');
  }

  const updatedResource = await Resource.findOneAndUpdate(
    { resourceId, availableQuantity: { $gt: 0 } },
    {
      $inc: {
        availableQuantity: -1,
        reservedQuantity: 1,
        version: 1,
      },
    },
    { new: true }
  );

  if (!updatedResource) {
    // Either the resource doesn't exist, or it has zero availability.
    const exists = await Resource.exists({ resourceId });
    if (!exists) {
      throw new NotFoundError(`Resource '${resourceId}' not found`);
    }
    throw new BadRequestError('Resource is not currently available');
  }

  let reservation;
  try {
    reservation = await Reservation.create({
      reservationId: uuidv4(),
      resourceId,
      studentId,
      department: SERVICE_DEPARTMENT,
      status: 'APPROVED',
    });
  } catch (err) {
    if (err.code === 11000) {
      // Lost a genuine race against another concurrent request from
      // this same student for this same resource - undo the quantity
      // change made above so totalQuantity = available + reserved +
      // borrowed still holds, then report the same error the
      // fast-fail pre-check above would have given.
      await Resource.findOneAndUpdate(
        { resourceId },
        {
          $inc: {
            availableQuantity: 1,
            reservedQuantity: -1,
            version: 1,
          },
        }
      );
      throw new BadRequestError('You already have an active reservation for this resource');
    }
    throw err;
  }

  await publish(EVENTS.RESOURCE_RESERVED, {
    reservationId: reservation.reservationId,
    resourceId,
    studentId,
    availableQuantity: updatedResource.availableQuantity,
    reservedQuantity: updatedResource.reservedQuantity,
  });

  return reservation;
}

/**
 * Cancels a PENDING/APPROVED reservation and returns the unit to
 * availableQuantity.
 */
async function cancelReservation(reservationId, studentId) {
  const reservation = await Reservation.findOne({ reservationId });

  if (!reservation) {
    throw new NotFoundError(`Reservation '${reservationId}' not found`);
  }
  if (reservation.studentId !== studentId) {
    const err = new Error('You may only cancel your own reservations');
    err.statusCode = 403;
    throw err;
  }
  if (!['PENDING', 'APPROVED'].includes(reservation.status)) {
    throw new BadRequestError(`Cannot cancel a reservation with status '${reservation.status}'`);
  }

  reservation.status = 'CANCELLED';
  await reservation.save();

  const updatedResource = await Resource.findOneAndUpdate(
    { resourceId: reservation.resourceId },
    {
      $inc: {
        availableQuantity: 1,
        reservedQuantity: -1,
        version: 1,
      },
    },
    { new: true }
  );

  await publish(EVENTS.RESOURCE_CANCELLED, {
    reservationId: reservation.reservationId,
    resourceId: reservation.resourceId,
    studentId,
    availableQuantity: updatedResource?.availableQuantity,
  });

  return reservation;
}


/**
 * Lists reservations owned by this department, optionally scoped to a
 * single student. Enriches each reservation with `resourceName` by
 * reading from THIS SAME service's own Resource collection - no call
 * out to another service or to the Gateway is made.
 */
async function listReservations(studentId) {
  const filter = { department: SERVICE_DEPARTMENT };
  if (studentId) {
    filter.studentId = studentId;
  }

  const reservations = await Reservation.find(filter).sort({ createdAt: -1 });
  if (reservations.length === 0) {
    return [];
  }

  const resourceIds = [...new Set(reservations.map((r) => r.resourceId))];
  const resources = await Resource.find({ resourceId: { $in: resourceIds } });
  const nameById = new Map(resources.map((r) => [r.resourceId, r.name]));

  return reservations.map((r) => ({
    reservationId: r.reservationId,
    resourceId: r.resourceId,
    resourceName: nameById.get(r.resourceId) || null,
    studentId: r.studentId,
    department: r.department,
    status: r.status,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));
}

module.exports = { reserveResource, cancelReservation, listReservations };
