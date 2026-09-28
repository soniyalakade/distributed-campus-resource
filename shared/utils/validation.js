const { DEPARTMENTS } = require('../constants/departments');
const { ROLES } = require('../constants/roles');

/**
 * Returns true if the given department code is one of CS/IT/ENTC.
 */
function isValidDepartment(department) {
  return DEPARTMENTS.includes(department);
}

/**
 * Returns true if the given role is one of the known roles.
 */
function isValidRole(role) {
  return Object.values(ROLES).includes(role);
}

/**
 * Basic email format check. Intentionally simple for a mini-project;
 * not a full RFC 5322 validator.
 */
function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

module.exports = { isValidDepartment, isValidRole, isValidEmail };
