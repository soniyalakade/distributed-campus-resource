const mongoose = require('mongoose');

/**
 * BorrowRecord model owned by the CS department service, tracking the
 * physical borrow/return lifecycle of a resource unit.
 */
const borrowRecordSchema = new mongoose.Schema(
  {
    recordId: { type: String, required: true, unique: true },
    resourceId: { type: String, required: true },
    studentId: { type: String, required: true },
    borrowedAt: { type: Date, required: true },
    dueAt: { type: Date, required: true },
    returnedAt: { type: Date, default: null },
    condition: { type: String, default: 'GOOD' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('BorrowRecord', borrowRecordSchema);
