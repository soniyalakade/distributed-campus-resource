const jwt = require('jsonwebtoken');

/**
 * Verifies the JWT issued by this same Gateway's /api/auth/login and
 * attaches { userId, role, department } to req.user.
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
    req.authHeader = authHeader; // forwarded as-is to department services
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = { jwtAuth };
