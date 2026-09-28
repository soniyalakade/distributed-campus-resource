const path = require('path');
const fs = require('fs');

/**
 * Resolves the `shared/` package regardless of whether this service is
 * running locally from inside the monorepo (services/cs-service/src/..,
 * where shared/ lives 3 levels up from src/) or inside the Docker image
 * (where the Dockerfile copies shared/ to /app/shared, a sibling of
 * /app/src). Every file in this service should import shared modules
 * via this helper instead of hand-writing relative '../../../shared'
 * paths, which break the moment folder depth changes between the two
 * environments.
 *
 * Usage:
 *   const { createLogger } = require('../sharedPath').resolve('utils/logger');
 */
const CANDIDATE_ROOTS = [
  path.join(__dirname, '..', '..', '..', 'shared'), // local monorepo: src/ -> cs-service/ -> services/ -> shared/
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
