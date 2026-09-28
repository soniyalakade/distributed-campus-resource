/**
 * Requires any authenticated user (student or admin). Fine-grained
 * department-admin-only checks for resource mutation happen inside the
 * department services themselves (they re-validate the JWT and enforce
 * department ownership) - the Gateway does not duplicate that logic,
 * it only ensures a valid token is present before forwarding.
 */
function requireAuthenticated(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

/**
 * Fast-fail check for admin-only Gateway routes (resource management,
 * department reservation view). This is a convenience/UX check only -
 * the department services independently re-verify role AND department
 * ownership on every write (see services/*-service/src/middleware/
 * roleCheck.js's requireOwnDepartmentAdmin), so security does not
 * depend on this check alone.
 */
function requireDepartmentAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (req.user.role !== 'DEPARTMENT_ADMIN' || !req.user.department) {
    return res.status(403).json({ error: 'Only department admins may perform this action' });
  }
  next();
}

module.exports = { requireAuthenticated, requireDepartmentAdmin };
