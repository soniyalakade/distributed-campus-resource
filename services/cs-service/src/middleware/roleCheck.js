const SERVICE_DEPARTMENT = process.env.DEPARTMENT || 'CS';

/**
 * Requires the caller to be a DEPARTMENT_ADMIN whose JWT department claim
 * matches THIS service's own department. This is the concrete enforcement
 * of "a CS admin can manage CS resources but cannot modify IT resources" -
 * even if a request is somehow routed here for another department, it is
 * rejected based on the token's department claim, not just the URL.
 */
function requireOwnDepartmentAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (req.user.role !== 'DEPARTMENT_ADMIN') {
    return res.status(403).json({ error: 'Only department admins may perform this action' });
  }

  if (req.user.department !== SERVICE_DEPARTMENT) {
    return res.status(403).json({
      error: `Admin for department '${req.user.department}' cannot modify '${SERVICE_DEPARTMENT}' resources`,
    });
  }

  next();
}

/**
 * Allows any authenticated user (student or admin) through - used for
 * read-only endpoints like viewing resources.
 */
function requireAuthenticated(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

module.exports = { requireOwnDepartmentAdmin, requireAuthenticated };
