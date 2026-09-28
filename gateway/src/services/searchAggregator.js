const axios = require('axios');
const { getNodes } = require('./nodeRegistry');
const { createLogger } = require('../sharedPath').resolve('utils/logger');

const logger = createLogger('Gateway');

const PER_NODE_TIMEOUT_MS = 2000;

/**
 * Queries every department node concurrently for a resource name and
 * merges the results into a single aggregated response. This is the
 * "distributed computation" requirement: the search is genuinely
 * dispatched to three independent services, not looked up from one
 * central table.
 *
 * Uses Promise.allSettled so one slow/unreachable node cannot fail the
 * entire search - its department is instead reported in
 * `nodesUnreachable` and excluded from the total.
 */
async function searchAcrossNodes(name, authHeader) {
  const nodes = getNodes();
  logger.info('Search aggregation started', { name });

  const settled = await Promise.allSettled(
    nodes.map((node) =>
      axios
      .get(`${node.internalBase}/internal/resources`, {
        params: { search: name },
        headers: {
          Authorization: authHeader,
        },
        timeout: PER_NODE_TIMEOUT_MS,
      })
        .then((response) => ({ department: node.department, data: response.data }))
    )
  );

  const results = [];
  const nodesUnreachable = [];
  let totalAvailable = 0;

  settled.forEach((outcome, index) => {
    const department = nodes[index].department;

    if (outcome.status === 'fulfilled') {
      const matches = outcome.value.data || [];
      // A department may have multiple matching resources for a loose
      // name search; sum their availableQuantity for this department's total.
      const available = matches.reduce((sum, r) => sum + (r.availableQuantity || 0), 0);
      results.push({ department, available, matches });
      totalAvailable += available;
    } else {
      logger.warn('Node unreachable during search', {
        department,
        reason: outcome.reason?.message,
      });
      nodesUnreachable.push(department);
      results.push({ department, available: null, matches: [], error: 'unreachable' });
    }
  });

  logger.info('Search aggregation complete', { name, totalAvailable, nodesUnreachable });

  return {
    resource: name,
    results,
    totalAvailable,
    nodesUnreachable,
  };
}

module.exports = { searchAcrossNodes };
