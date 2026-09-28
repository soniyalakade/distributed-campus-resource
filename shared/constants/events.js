/**
 * Shared event name constants used for RabbitMQ messaging (Phase 3+).
 * Defined now so every service references the same string literals
 * from Phase 2 onward, even though publishing/consuming isn't wired yet.
 */
const EVENTS = {
  RESOURCE_ADDED: 'RESOURCE_ADDED',
  RESOURCE_UPDATED: 'RESOURCE_UPDATED',
  RESOURCE_RESERVED: 'RESOURCE_RESERVED',
  RESOURCE_CANCELLED: 'RESOURCE_CANCELLED',
  RESOURCE_BORROWED: 'RESOURCE_BORROWED',
  RESOURCE_RETURNED: 'RESOURCE_RETURNED',
  NODE_STATUS_CHANGED: 'NODE_STATUS_CHANGED',
};

module.exports = { EVENTS };
