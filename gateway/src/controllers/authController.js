const authService = require('../services/authService');
const { createLogger } = require('../sharedPath').resolve('utils/logger');

const logger = createLogger('Gateway');

async function register(req, res) {
  logger.info('Registration request', { email: req.body.email });
  const user = await authService.register(req.body);
  res.status(201).json(user);
}

async function login(req, res) {
  logger.info('Login request', { email: req.body.email });
  const result = await authService.login(req.body);
  res.json(result);
}

module.exports = { register, login };
