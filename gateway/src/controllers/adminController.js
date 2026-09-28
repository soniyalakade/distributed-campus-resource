const resourceProxyService = require('../services/resourceProxyService');
const { createLogger } = require('../sharedPath').resolve('utils/logger');

const logger = createLogger('Gateway');

/**
 * GET /api/admin/resources - lists resources in the CALLING ADMIN'S OWN
 * department only. Department comes from req.user.department (the JWT
 * claim), never from a query param, so an admin cannot ask to see
 * another department's list through this route (they already can, via
 * GET /api/admin/resources/all - but not paired with edit access there).
 */
async function listOwnDepartmentResources(req, res) {
  logger.info('Admin resource list requested', { department: req.user.department });
  const resources = await resourceProxyService.listDepartmentResources(req.user.department, req.authHeader);
  res.json(resources);
}

/**
 * GET /api/admin/resources/all - read-only view across CS/IT/ENTC.
 * Any department admin may view all departments; only their own
 * department's resources are ever editable (enforced by routing +
 * the department service's own requireOwnDepartmentAdmin check).
 */
async function listAllResources(req, res) {
  logger.info('Admin cross-department resource view requested', { department: req.user.department });
  const results = await resourceProxyService.listAllResources(req.authHeader);
  res.json(results);
}

/**
 * POST /api/admin/resources - always targets the admin's OWN department.
 * See resourceProxyService.createOwnResource for why a client-supplied
 * `department` field cannot redirect this to another node.
 */
async function createResource(req, res) {
  logger.info('Admin create resource', { department: req.user.department, name: req.body.name });
  const resource = await resourceProxyService.createOwnResource(req.user.department, req.body, req.authHeader);
  res.status(201).json(resource);
}

/** PUT /api/admin/resources/:id - always targets the admin's OWN department. */
async function updateResource(req, res) {
  logger.info('Admin update resource', { department: req.user.department, resourceId: req.params.id });
  const resource = await resourceProxyService.updateOwnResource(
    req.user.department,
    req.params.id,
    req.body,
    req.authHeader
  );
  res.json(resource);
}

/** DELETE /api/admin/resources/:id - always targets the admin's OWN department. */
async function deleteResource(req, res) {
  logger.info('Admin delete resource', { department: req.user.department, resourceId: req.params.id });
  await resourceProxyService.deleteOwnResource(req.user.department, req.params.id, req.authHeader);
  res.status(204).send();
}

/** GET /api/admin/reservations - every reservation in the admin's OWN department. */
async function listReservations(req, res) {
  logger.info('Admin reservation list requested', { department: req.user.department });
  const reservations = await resourceProxyService.listDepartmentReservations(req.user.department, req.authHeader);
  res.json(reservations);
}

module.exports = {
  listOwnDepartmentResources,
  listAllResources,
  createResource,
  updateResource,
  deleteResource,
  listReservations,
};
