const jwt = require('jsonwebtoken');

/**
 * Verifies the JWT issued by the Gateway's Auth service. The department
 * service does not issue tokens itself - it only trusts and re-validates
 * them (same JWT_SECRET shared via environment variable), then attaches
 * { userId, role, department } to req.user for downstream authorization
 * checks (see roleCheck.js).
 */
function jwtAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = {
      userId: payload.userId,
      role: payload.role,
      department: payload.department || null,
    };
    next();
  } catch (err) {
    console.error('[CS JWT] Verification failed:', err.message);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = { jwtAuth };
