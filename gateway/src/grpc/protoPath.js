const path = require('path');
const fs = require('fs');

/**
 * Resolves proto/resource.proto for the Gateway. Mirrors the department
 * services' own protoPath.js files, adjusted for the Gateway's folder
 * depth (gateway/src/grpc/.. vs services/<dept>-service/src/grpc/..).
 */
const CANDIDATE_ROOTS = [
  path.join(__dirname, '..', '..', '..', 'proto'), // local monorepo: src/grpc/ -> src/ -> gateway/ -> proto/
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
