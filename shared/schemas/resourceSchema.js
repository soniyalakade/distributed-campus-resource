/**
 * This file is NOT a Mongoose schema (each department service defines its
 * own Mongoose model against its own DB connection - that's the point of
 * distributed data ownership). It's a plain reference object documenting
 * the canonical resource field set, so the three services' models stay
 * structurally identical by inspection.
 *
 * See: services/<dept>-service/src/models/Resource.js for the actual
 * Mongoose schema, which mirrors this shape exactly.
 */
const RESOURCE_FIELDS = [
  'resourceId',
  'name',
  'category',
  'description',
  'department',
  'laboratory',
  'totalQuantity',
  'availableQuantity',
  'reservedQuantity',
  'borrowedQuantity',
  'condition',
  'imageUrl',
  'manualUrl',
  'tutorialVideoUrl',
  'createdAt',
  'updatedAt',
  'version',
];

module.exports = { RESOURCE_FIELDS };
