const mongoose = require('mongoose');

/**
 * Resource model owned exclusively by the CS department service.
 * Structurally identical to IT/ENTC's Resource model - only the
 * DB connection (via MONGO_URI) and the enforced `department` value
 * differ, which is what makes this genuine distributed data ownership
 * rather than a single shared table with a department column.
 */
const resourceSchema = new mongoose.Schema(
  {
    resourceId: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    department: { type: String, required: true, enum: ['CS'] },
    laboratory: { type: String, default: '' },
    totalQuantity: { type: Number, required: true, min: 0 },
    availableQuantity: { type: Number, required: true, min: 0 },
    reservedQuantity: { type: Number, required: true, default: 0, min: 0 },
    borrowedQuantity: { type: Number, required: true, default: 0, min: 0 },
    condition: { type: String, default: 'GOOD' },
    imageUrl: { type: String, default: '' },
    manualUrl: { type: String, default: '' },
    tutorialVideoUrl: { type: String, default: '' },
    version: { type: Number, required: true, default: 0 },
  },
  { timestamps: true } // adds createdAt, updatedAt automatically
);

module.exports = mongoose.model('Resource', resourceSchema);
