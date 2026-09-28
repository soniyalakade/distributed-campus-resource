const { v4: uuidv4 } = require('uuid');
const Resource = require('../models/Resource');
const Reservation = require('../models/Reservation');
const { NotFoundError, BadRequestError } = require('./resourceService');
const { publish, EVENTS } = require('../messaging/publisher');

const SERVICE_DEPARTMENT = process.env.DEPARTMENT || 'CS';

/**
 * Creates a reservation for a resource owned by this department.
 *
 * Steps (per Phase 2 spec, extended for duplicate-reservation prevention):
 *   1. Fast-fail pre-check: does this student already have an active
 *      (PENDING/APPROVED) reservation for this resource? If so, reject
 *      immediately without touching resource quantities at all - this
 *      covers the overwhelming majority of duplicate-click cases with
 *      zero side effects.
 *   2. Verify resource exists / availableQuantity > 0, and atomically
 *      decrement availableQuantity / increment reservedQuantity.
 *   3. Attempt to create the reservation document.
 *   4. If step 3 fails with a duplicate-key error (MongoDB code 11000),
 *      it means a second request from the SAME student for the SAME
 *      resource won a race against step 1's pre-check - roll back the
 *      quantity change made in step 2 and reject with the same
 *      "already have an active reservation" error the pre-check gives.
 *   5. Otherwise, return the reservation.
 *
 * Why a pre-check AND a unique index, instead of just one:
 *   - The pre-check alone is not concurrency-safe (see Reservation.js
 *     for the race it can't close on its own).
 *   - The unique index alone is concurrency-safe but, used by itself,
 *     would mean every duplicate attempt still pays the cost of
 *     decrementing/incrementing resource quantities before being
 *     rejected and rolled back - wasteful for the common case, and it
 *     would emit a spurious RESOURCE_RESERVED-then-rollback pair of
 *     side effects every single time a student double-clicks.
 *   - Together: the common case is caught for free in step 1, and the
 *     rare genuine race is still caught correctly (never silently
 *     allowed) by the index in step 3, with quantities compensated
 *     back to their correct value before this function returns.
 *
 * The existing atomic findOneAndUpdate quantity guard
 * (availableQuantity: { $gt: 0 }) is UNCHANGED - it still protects
 * against two DIFFERENT students racing for the last unit exactly as
 * before. This change only adds protection against the SAME student
 * creating more than one active reservation for the same resource.
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
 * out to another service or to the Gateway is made. This keeps
 * resource data ownership exactly where the architecture already puts
 * it (each department owns its own resources + reservations), and
 * avoids an unnecessary distributed round-trip for something this
 * service can already answer locally.
 *
 * Caller-side authorization (STUDENT can only ever pass their own
 * studentId; DEPARTMENT_ADMIN may omit it to see the whole department)
 * is enforced in the controller, not here - this function trusts
 * whatever filter it's given.
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
