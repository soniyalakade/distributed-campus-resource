const grpc = require('@grpc/grpc-js');
const { getGrpcNodes } = require('./grpcNodeRegistry');
const { getResourceServiceClient } = require('../grpc/client');
const { createLogger } = require('../sharedPath').resolve('utils/logger');

const logger = createLogger('Gateway');

const PER_NODE_TIMEOUT_MS = 2000;
const GATEWAY_NODE_ID = 'Gateway';

// Mirrors proto/resource.proto's SearchResourceResponse.Status enum.
const STATUS = { SUCCESS: 0, INTERNAL_ERROR: 1, UNAUTHORIZED: 2 };

/**
 * Wraps a single gRPC SearchResource call in a Promise, with an explicit
 * per-call deadline (grpc-js does not time out by default) and JWT
 * forwarded via metadata - the gRPC equivalent of the REST path's
 * Authorization header forwarding.
 */
function callSearchResource(department, address, query, authHeader) {
  return new Promise((resolve, reject) => {
    const client = getResourceServiceClient(address);

    const metadata = new grpc.Metadata();
    if (authHeader) {
      metadata.set('authorization', authHeader);
    }

    const deadline = new Date(Date.now() + PER_NODE_TIMEOUT_MS);

    logger.info(`Sending SearchResource to ${department}`, { address });

    client.SearchResource(
      { query, requestingNodeId: GATEWAY_NODE_ID },
      metadata,
      { deadline },
      (err, response) => {
        if (err) {
          // Distinguishes network-level failure (node down, timeout,
          // connection refused) from an application-level error the
          // node itself returned (handled below via response.status).
          return reject(err);
        }
        resolve(response);
      }
    );
  });
}

/**
 * gRPC counterpart to searchAggregator.js's searchAcrossNodes. Kept as
 * a SEPARATE function/file so the existing REST search path
 * (GET /api/resources/search) is completely unaffected - this backs
 * the new GET /api/resources/search-grpc endpoint only.
 */
async function searchAcrossNodesGrpc(name, authHeader) {
  const nodes = getGrpcNodes();
  logger.info('gRPC search started', { name });

  const settled = await Promise.allSettled(
    nodes.map((node) => callSearchResource(node.department, node.address, name, authHeader))
  );

  const results = [];
  const nodesUnreachable = [];
  let totalAvailable = 0;

  settled.forEach((outcome, index) => {
    const department = nodes[index].department;

    if (outcome.status === 'fulfilled') {
      const response = outcome.value;

      if (response.status === STATUS.SUCCESS) {
        logger.info(`gRPC response received from ${department}`, {
          matches: response.matches.length,
        });
        results.push({
          department,
          available: response.totalAvailable,
          matches: response.matches,
        });
        totalAvailable += response.totalAvailable;
      } else if (response.status === STATUS.UNAUTHORIZED) {
        logger.warn(`gRPC auth failure from ${department}`, { errorMessage: response.errorMessage });
        results.push({ department, available: null, matches: [], error: 'unauthorized' });
        nodesUnreachable.push(department);
      } else {
        logger.warn(`gRPC internal error from ${department}`, { errorMessage: response.errorMessage });
        results.push({ department, available: null, matches: [], error: 'internal_error' });
        nodesUnreachable.push(department);
      }
    } else {
      // Network-level failure: connection refused (service down),
      // deadline exceeded (timeout), or other transport error.
      const reason = outcome.reason;
      const isTimeout = reason?.code === grpc.status.DEADLINE_EXCEEDED;
      logger.warn(`gRPC node unreachable during search`, {
        department,
        reason: reason?.message,
        timeout: isTimeout,
      });
      nodesUnreachable.push(department);
      results.push({
        department,
        available: null,
        matches: [],
        error: isTimeout ? 'timeout' : 'unreachable',
      });
    }
  });

  logger.info('gRPC search aggregation complete', { name, totalAvailable, nodesUnreachable });

  return {
    resource: name,
    results,
    totalAvailable,
    nodesUnreachable,
  };
}

module.exports = { searchAcrossNodesGrpc };
