/**
 * The three fixed department/node identifiers used throughout the system.
 * Kept as a single source of truth so the Gateway and every department
 * service validate against the same list.
 */
const DEPARTMENTS = ['CS', 'IT', 'ENTC'];

module.exports = { DEPARTMENTS };
