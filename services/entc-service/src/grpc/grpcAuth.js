const jwt = require('jsonwebtoken');

/**
 * gRPC equivalent of middleware/jwtAuth.js. REST forwards the JWT via
 * the Authorization header; gRPC forwards it via call metadata under
 * the same key convention ('authorization': 'Bearer <token>'). Both
 * paths verify against the SAME process.env.JWT_SECRET - this is
 * intentionally NOT a second authentication system, just a different
 * transport for the same token.
 *
 * Returns { userId, role, department } on success, or throws an Error
 * with a `grpcCode`-like marker the handler can translate to
 * SearchResourceResponse.Status.UNAUTHORIZED.
 */
function verifyGrpcAuth(call) {
  const metadataValues = call.metadata.get('authorization');
  const authHeader = metadataValues && metadataValues[0];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    const err = new Error('Missing or malformed authorization metadata');
    err.unauthorized = true;
    throw err;
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    return {
      userId: payload.userId,
      role: payload.role,
      department: payload.department || null,
    };
  } catch (e) {
    const err = new Error('Invalid or expired token');
    err.unauthorized = true;
    throw err;
  }
}

module.exports = { verifyGrpcAuth };
