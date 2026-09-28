const resourceService = require('../services/resourceService');
const { createLogger } = require('../sharedPath').resolve('utils/logger');

const NODE_ID = process.env.NODE_ID || 'ENTC';
const logger = createLogger(NODE_ID);

async function create(req, res) {
  logger.info('Create resource request', { name: req.body.name });
  const resource = await resourceService.createResource(req.body);
  res.status(201).json(resource);
}

async function list(req, res) {
  const { search } = req.query;
  if (search) {
    logger.info('Resource search received', { search });
    const results = await resourceService.searchResourcesByName(search);
    return res.json(results);
  }
  const resources = await resourceService.listResources();
  res.json(resources);
}

async function getOne(req, res) {
  const resource = await resourceService.getResourceById(req.params.id);
  res.json(resource);
}

async function update(req, res) {
  logger.info('Update resource request', { id: req.params.id });
  const resource = await resourceService.updateResource(req.params.id, req.body);
  res.json(resource);
}

async function remove(req, res) {
  logger.info('Delete resource request', { id: req.params.id });
  await resourceService.deleteResource(req.params.id);
  res.status(204).send();
}

module.exports = { create, list, getOne, update, remove };
