/**
 * Role constants shared by the Gateway (which issues JWTs) and every
 * department service (which authorizes requests based on JWT claims).
 */
const ROLES = {
  STUDENT: 'STUDENT',
  DEPARTMENT_ADMIN: 'DEPARTMENT_ADMIN',
};

module.exports = { ROLES };
