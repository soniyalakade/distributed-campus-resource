const mongoose = require('mongoose');

/**
 * Reservation model owned by the CS department service. A reservation
 * always references a resourceId that exists in this same service's
 * Resource collection - reservations never cross department boundaries.
 */
const reservationSchema = new mongoose.Schema(
  {
    reservationId: { type: String, required: true, unique: true },
    resourceId: { type: String, required: true },
    studentId: { type: String, required: true },
    department: { type: String, required: true, enum: ['CS'] },
    status: {
      type: String,
      required: true,
      enum: ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'FULFILLED'],
      default: 'APPROVED', // Phase 2: no admin-approval workflow yet, auto-approved on creation
    },
  },
  { timestamps: true }
);

/**
 * Concurrency-safe duplicate-reservation guard.
 *
 * A `Reservation.findOne(...)` pre-check alone is NOT safe against two
 * near-simultaneous requests from the SAME student for the SAME
 * resource: both could read "no active reservation exists" before
 * either has written one, and both would then proceed to create a
 * reservation. A plain pre-check is a good fast-fail for the common
 * case, but the actual safety guarantee has to come from MongoDB
 * itself.
 *
 * This partial unique index enforces, at the database level, that at
 * most one reservation with status PENDING or APPROVED can exist for
 * a given (resourceId, studentId) pair. Because index uniqueness is
 * checked atomically as part of the write, this holds even when two
 * requests race - MongoDB will accept exactly one insert and reject
 * the other with a duplicate-key error (code 11000), which
 * reservationService.reserveResource() below catches and turns into
 * the same BadRequestError the pre-check produces.
 *
 * IMPORTANT: if this department's MongoDB volume already contains
 * duplicate active reservations from earlier testing, Mongoose will
 * be unable to build this index (it will log an index-creation error
 * but the service will still start, silently leaving this guard
 * inactive). If that happens, the volume needs to be reset with
 * `docker compose down -v` before this protection takes effect.
 */
reservationSchema.index(
  { resourceId: 1, studentId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ['PENDING', 'APPROVED'] } },
    name: 'uniq_active_reservation_per_student_resource',
  }
);

module.exports = mongoose.model('Reservation', reservationSchema);
