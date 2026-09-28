const { v4: uuidv4 } = require('uuid');
const Resource = require('../models/Resource');
const { publish, EVENTS } = require('../messaging/publisher');

const SERVICE_DEPARTMENT = process.env.DEPARTMENT || 'ENTC';

class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.statusCode = 404;
  }
}

class BadRequestError extends Error {
  constructor(message) {
    super(message);
    this.statusCode = 400;
  }
}

/**
 * Creates a new resource. Rejects any attempt to set department to
 * anything other than this service's own department - this is the
 * concrete enforcement of "each department service must reject foreign department values".
 */
async function createResource(data) {
  if (data.department && data.department !== SERVICE_DEPARTMENT) {
    throw new BadRequestError(
      `This service only manages '${SERVICE_DEPARTMENT}' resources, got '${data.department}'`
    );
  }

  const resource = new Resource({
    resourceId: uuidv4(),
    name: data.name,
    category: data.category,
    description: data.description || '',
    department: SERVICE_DEPARTMENT,
    laboratory: data.laboratory || '',
    totalQuantity: data.totalQuantity,
    availableQuantity: data.totalQuantity, // fully available at creation
    reservedQuantity: 0,
    borrowedQuantity: 0,
    condition: data.condition || 'GOOD',
    imageUrl: data.imageUrl || '',
    manualUrl: data.manualUrl || '',
    tutorialVideoUrl: data.tutorialVideoUrl || '',
    version: 0,
  });

  await resource.save();

  // Additive only - does not alter the create flow above. A publish
  // failure (RabbitMQ down) is swallowed inside publish(); it never
  // affects the HTTP response or the already-committed DB write.
  await publish(EVENTS.RESOURCE_ADDED, {
    resourceId: resource.resourceId,
    name: resource.name,
    totalQuantity: resource.totalQuantity,
    availableQuantity: resource.availableQuantity,
  });

  return resource;
}

async function listResources() {
  return Resource.find({ department: SERVICE_DEPARTMENT }).sort({ createdAt: -1 });
}

async function getResourceById(resourceId) {
  const resource = await Resource.findOne({ resourceId });
  if (!resource) {
    throw new NotFoundError(`Resource '${resourceId}' not found`);
  }
  return resource;
}

/**
 * Case-insensitive substring search by name, scoped to this department.
 * Used by the Gateway's fan-out search (Step 8) via GET /internal/resources?search=.
 */
async function searchResourcesByName(name) {
  if (!name) {
    return listResources();
  }
  return Resource.find({
    department: SERVICE_DEPARTMENT,
    name: { $regex: name, $options: 'i' },
  });
}

async function updateResource(resourceId, updates) {
  const resource = await getResourceById(resourceId);

  // Department is immutable after creation - never allow it to be changed.
  const { department, ...safeUpdates } = updates; // eslint-disable-line no-unused-vars

  Object.assign(resource, safeUpdates);
  resource.version += 1;
  await resource.save();

  await publish(EVENTS.RESOURCE_UPDATED, {
    resourceId: resource.resourceId,
    name: resource.name,
    availableQuantity: resource.availableQuantity,
    version: resource.version,
  });

  return resource;
}

async function deleteResource(resourceId) {
  const resource = await Resource.findOneAndDelete({ resourceId });
  if (!resource) {
    throw new NotFoundError(`Resource '${resourceId}' not found`);
  }
  return resource;
}

module.exports = {
  createResource,
  listResources,
  getResourceById,
  searchResourcesByName,
  updateResource,
  deleteResource,
  NotFoundError,
  BadRequestError,
};
