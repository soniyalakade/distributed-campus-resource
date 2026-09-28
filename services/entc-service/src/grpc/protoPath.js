const path = require('path');
const fs = require('fs');

/**
 * Resolves proto/resource.proto the same way sharedPath.js resolves
 * shared/ - the proto file lives at the monorepo root, and this
 * service's Dockerfile (Phase 5, when updated) will need to copy it
 * alongside shared/ into the flattened /app image. Candidate order
 * mirrors sharedPath.js exactly for consistency.
 */
const CANDIDATE_ROOTS = [
  path.join(__dirname, '..', '..', '..', '..', 'proto'), // local monorepo: src/grpc/ -> src/ -> <dept>-service/ -> services/ -> proto/
  path.join(__dirname, '..', '..', 'proto'), // Docker: src/grpc/ -> src/ -> proto/ (sibling of src/)
];

function resolveProtoPath(fileName) {
  for (const root of CANDIDATE_ROOTS) {
    const fullPath = path.join(root, fileName);
    if (fs.existsSync(fullPath)) {
      return fullPath;
    }
  }
  throw new Error(`Could not resolve proto file '${fileName}' in any known location`);
}

module.exports = { resolveProtoPath };
