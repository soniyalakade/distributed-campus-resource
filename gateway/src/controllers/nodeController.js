const { getNodes } = require('../services/nodeRegistry');
const { checkAllNodesHealth } = require('../services/healthAggregator');

async function listNodes(req, res) {
  const nodes = getNodes().map((n) => ({ department: n.department, internalBase: n.internalBase }));
  res.json(nodes);
}

async function nodesHealth(req, res) {
  const health = await checkAllNodesHealth();
  res.json(health);
}

module.exports = { listNodes, nodesHealth };
