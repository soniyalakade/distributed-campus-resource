const { publishEvent } = require('../sharedPath').resolve('messaging/eventPublisher');
const { EVENTS } = require('../sharedPath').resolve('constants/events');
const { createLogger } = require('../sharedPath').resolve('utils/logger');

const NODE_ID = process.env.NODE_ID || 'CS';
const DEPARTMENT = process.env.DEPARTMENT || 'CS';
const logger = createLogger(NODE_ID);

/**
 * Publishes a RESOURCE_* event with this service's department stamped
 * onto the payload automatically, so consumers (Gateway's WS relay)
 * don't need to infer which node an event came from.
 *
 * This is the ONLY new integration point that reservationService.js,
 * borrowService.js, and resourceService.js call into - everything else
 * about those files is unchanged.
 */
async function publish(eventType, payload) {
  await publishEvent(eventType, { ...payload, department: DEPARTMENT }, logger);
}

module.exports = { publish, EVENTS };
