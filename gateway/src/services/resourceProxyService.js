const axios = require('axios');
const { getNodeByDepartment, getNodes } = require('./nodeRegistry');

const REQUEST_TIMEOUT_MS = 3000;

class BadRequestError extends Error {
  constructor(message) {
    super(message);
    this.statusCode = 400;
  }
}
class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.statusCode = 404;
  }
}
class UpstreamError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode || 502;
  }
}

/** Re-throws axios errors as our own error types so the Gateway's error
 * handler returns sensible status codes instead of leaking axios internals. */
function rethrow(err) {
  if (err.response) {
    throw new UpstreamError(err.response.data?.error || 'Upstream service error', err.response.status);
  }
  throw new UpstreamError(`Upstream service unreachable: ${err.message}`, 503);
}

/**
 * Gateway does not know which department owns a given resourceId ahead
 * of time (resourceId is a UUID, not prefixed by department), so for
 * Phase 2 "get by id" we probe all three nodes and return the first hit.
 * This is a simple foundation - Phase 3+ could optimize with a shared
 * lightweight index, but that is out of scope here.
 */
async function getResourceById(resourceId, authHeader) {
  const nodes = getNodes();
  const settled = await Promise.allSettled(
    nodes.map((node) =>
      axios.get(`${node.internalBase}/internal/resources/${resourceId}`, {
        headers: { Authorization: authHeader },
        timeout: REQUEST_TIMEOUT_MS,
      })
    )
  );

  const hit = settled.find((r) => r.status === 'fulfilled');
  if (hit) {
    return hit.value.data;
  }
  throw new NotFoundError(`Resource '${resourceId}' not found on any reachable node`);
}

/**
 * Forwards a reservation request to the specified department's service.
 */
async function createReservation({ department, resourceId, studentId }, authHeader) {
  const node = getNodeByDepartment(department);
  if (!node) {
    throw new BadRequestError(`Unknown department '${department}'`);
  }
  try {
    const response = await axios.post(
      `${node.internalBase}/internal/reservations`,
      { resourceId, studentId },
      { headers: { Authorization: authHeader }, timeout: REQUEST_TIMEOUT_MS }
    );
    return response.data;
  } catch (err) {
    rethrow(err);
  }
}

/**
 * Cancels a reservation. Since reservationId alone doesn't reveal the
 * department, the caller must supply it (the frontend has it from the
 * original reservation response).
 */
async function cancelReservation({ department, reservationId, studentId }, authHeader) {
  const node = getNodeByDepartment(department);
  if (!node) {
    throw new BadRequestError(`Unknown department '${department}'`);
  }
  try {
    const response = await axios.delete(`${node.internalBase}/internal/reservations/${reservationId}`, {
      headers: { Authorization: authHeader },
      data: { studentId },
      timeout: REQUEST_TIMEOUT_MS,
    });
    return response.data;
  } catch (err) {
    rethrow(err);
  }
}

async function borrowResource({ department, resourceId, studentId }, authHeader) {
  const node = getNodeByDepartment(department);
  if (!node) {
    throw new BadRequestError(`Unknown department '${department}'`);
  }
  try {
    const response = await axios.post(
      `${node.internalBase}/internal/resources/${resourceId}/borrow`,
      { studentId },
      { headers: { Authorization: authHeader }, timeout: REQUEST_TIMEOUT_MS }
    );
    return response.data;
  } catch (err) {
    rethrow(err);
  }
}

async function returnResource({ department, resourceId, studentId, condition }, authHeader) {
  const node = getNodeByDepartment(department);
  if (!node) {
    throw new BadRequestError(`Unknown department '${department}'`);
  }
  try {
    const response = await axios.post(
      `${node.internalBase}/internal/resources/${resourceId}/return`,
      { studentId, condition },
      { headers: { Authorization: authHeader }, timeout: REQUEST_TIMEOUT_MS }
    );
    return response.data;
  } catch (err) {
    rethrow(err);
  }
}

/**
 * Lists every resource belonging to ONE department, unfiltered (used by
 * the admin's "My Department Resources" page). Simply forwards to the
 * department's existing GET /internal/resources with no `search` query,
 * which its own resourceService.listResources() already supports.
 */
async function listDepartmentResources(department, authHeader) {
  const node = getNodeByDepartment(department);
  if (!node) {
    throw new BadRequestError(`Unknown department '${department}'`);
  }
  try {
    const response = await axios.get(`${node.internalBase}/internal/resources`, {
      headers: { Authorization: authHeader },
      timeout: REQUEST_TIMEOUT_MS,
    });
    return response.data;
  } catch (err) {
    rethrow(err);
  }
}

/**
 * Read-only fan-out across ALL THREE departments' resource lists, for
 * the admin's "View All Campus Resources" page. One unreachable node
 * is reported rather than failing the whole request, matching the same
 * Promise.allSettled pattern already used by searchAggregator.js.
 */
async function listAllResources(authHeader) {
  const nodes = getNodes();
  const settled = await Promise.allSettled(
    nodes.map((node) =>
      axios
        .get(`${node.internalBase}/internal/resources`, {
          headers: { Authorization: authHeader },
          timeout: REQUEST_TIMEOUT_MS,
        })
        .then((response) => ({ department: node.department, resources: response.data }))
    )
  );

  return settled.map((outcome, index) => {
    const department = nodes[index].department;
    if (outcome.status === 'fulfilled') {
      return outcome.value;
    }
    return { department, resources: [], error: 'unreachable' };
  });
}

/**
 * Creates a resource in the admin's OWN department only. The target
 * node is chosen from `department` (which the controller sets from
 * req.user.department, never from client input), and `department` is
 * stripped from the forwarded body - the department service determines
 * its own department from its own environment, so there is no field
 * for a malicious/careless client to override.
 */
async function createOwnResource(department, data, authHeader) {
  const node = getNodeByDepartment(department);
  if (!node) {
    throw new BadRequestError(`Unknown department '${department}'`);
  }
  const { department: _ignored, ...safeData } = data; // eslint-disable-line no-unused-vars
  try {
    const response = await axios.post(`${node.internalBase}/internal/resources`, safeData, {
      headers: { Authorization: authHeader },
      timeout: REQUEST_TIMEOUT_MS,
    });
    return response.data;
  } catch (err) {
    rethrow(err);
  }
}

/**
 * Updates a resource, routed to the admin's OWN department node only.
 * Because routing is keyed on the admin's department (not on the
 * resourceId or any client-supplied department), a CS admin's request
 * physically never reaches IT's or ENTC's service - it is impossible
 * for this call to touch another department's database, independent
 * of the department service's own re-check.
 */
async function updateOwnResource(department, resourceId, data, authHeader) {
  const node = getNodeByDepartment(department);
  if (!node) {
    throw new BadRequestError(`Unknown department '${department}'`);
  }
  const { department: _ignored, ...safeData } = data; // eslint-disable-line no-unused-vars
  try {
    const response = await axios.put(`${node.internalBase}/internal/resources/${resourceId}`, safeData, {
      headers: { Authorization: authHeader },
      timeout: REQUEST_TIMEOUT_MS,
    });
    return response.data;
  } catch (err) {
    rethrow(err);
  }
}

/** Deletes a resource, routed to the admin's OWN department node only (see updateOwnResource above). */
async function deleteOwnResource(department, resourceId, authHeader) {
  const node = getNodeByDepartment(department);
  if (!node) {
    throw new BadRequestError(`Unknown department '${department}'`);
  }
  try {
    await axios.delete(`${node.internalBase}/internal/resources/${resourceId}`, {
      headers: { Authorization: authHeader },
      timeout: REQUEST_TIMEOUT_MS,
    });
  } catch (err) {
    rethrow(err);
  }
}

/**
 * Aggregates "my reservations" for the calling student across all
 * three department services. Each service enforces studentId = the
 * caller's own JWT userId server-side (see reservationController.js's
 * `list` in every department service) - the Gateway does not filter
 * anything itself and does not persist a central copy of reservation
 * data anywhere; this is a live fan-out on every call.
 */
async function listMyReservations(authHeader) {
  const nodes = getNodes();
  const settled = await Promise.allSettled(
    nodes.map((node) =>
      axios.get(`${node.internalBase}/internal/reservations`, {
        headers: { Authorization: authHeader },
        timeout: REQUEST_TIMEOUT_MS,
      })
    )
  );

  const merged = [];
  settled.forEach((outcome) => {
    if (outcome.status === 'fulfilled') {
      merged.push(...outcome.value.data);
    }
    // An unreachable department is silently omitted from "my
    // reservations" rather than failing the whole request - consistent
    // with how searchAggregator/resourceProxyService already treat
    // partial availability elsewhere in the Gateway.
  });

  merged.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return merged;
}

/**
 * Lists every reservation in the admin's OWN department, by routing to
 * that department's GET /internal/reservations with no studentId -
 * the department service itself recognizes the caller as an admin for
 * its own department and returns the full department list (see the
 * `list` controller added to every department service).
 */
async function listDepartmentReservations(department, authHeader) {
  const node = getNodeByDepartment(department);
  if (!node) {
    throw new BadRequestError(`Unknown department '${department}'`);
  }
  try {
    const response = await axios.get(`${node.internalBase}/internal/reservations`, {
      headers: { Authorization: authHeader },
      timeout: REQUEST_TIMEOUT_MS,
    });
    return response.data;
  } catch (err) {
    rethrow(err);
  }
}

/**
 * Aggregates the calling student's ACTIVE (not yet returned) borrow
 * records across all three department services. Each service enforces
 * studentId = the caller's own JWT userId server-side (see
 * borrowController.js's `listActive` in every department service) -
 * the Gateway does not filter anything itself and does not persist a
 * central copy of borrow data anywhere; this is a live fan-out on
 * every call, same pattern as listMyReservations above.
 *
 * If one department node is unreachable, its records are simply
 * omitted from the merged result (same convention already used by
 * listMyReservations and searchAggregator) rather than failing the
 * whole request or fabricating anything for that department.
 */
async function listMyBorrowRecords(authHeader) {
  const nodes = getNodes();
  const settled = await Promise.allSettled(
    nodes.map((node) =>
      axios.get(`${node.internalBase}/internal/borrow-records`, {
        headers: { Authorization: authHeader },
        timeout: REQUEST_TIMEOUT_MS,
      })
    )
  );

  const merged = [];
  settled.forEach((outcome) => {
    if (outcome.status === 'fulfilled') {
      merged.push(...outcome.value.data);
    }
  });

  merged.sort((a, b) => new Date(b.borrowedAt) - new Date(a.borrowedAt));
  return merged;
}

module.exports = {
  getResourceById,
  createReservation,
  cancelReservation,
  borrowResource,
  returnResource,
  listDepartmentResources,
  listAllResources,
  createOwnResource,
  updateOwnResource,
  deleteOwnResource,
  listMyReservations,
  listDepartmentReservations,
  listMyBorrowRecords,
  BadRequestError,
  NotFoundError,
  UpstreamError,
};
