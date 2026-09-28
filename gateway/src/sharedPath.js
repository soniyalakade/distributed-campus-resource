const path = require('path');
const fs = require('fs');

/**
 * Resolves the `shared/` package regardless of whether the Gateway is
 * running locally from inside the monorepo (gateway/src/.. , where
 * shared/ lives 2 levels up from src/) or inside the Docker image
 * (where the Dockerfile copies shared/ to /app/shared, a sibling of
 * /app/src). See the department services' own sharedPath.js files for
 * the identical pattern (services/cs-service/src/sharedPath.js etc).
 */
const CANDIDATE_ROOTS = [
  path.join(__dirname, '..', '..', 'shared'), // local monorepo: src/ -> gateway/ -> shared/
  path.join(__dirname, '..', 'shared'), // Docker: src/ -> shared/ (sibling)
];

function resolve(modulePath) {
  for (const root of CANDIDATE_ROOTS) {
    const fullPath = path.join(root, `${modulePath}.js`);
    if (fs.existsSync(fullPath)) {
      return require(path.join(root, modulePath)); // eslint-disable-line global-require, import/no-dynamic-require
    }
  }
  throw new Error(`Could not resolve shared module '${modulePath}' in any known location`);
}

module.exports = { resolve };
