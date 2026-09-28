const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const User = require('../models/User');
const { isValidDepartment, isValidEmail } = require('../sharedPath').resolve('utils/validation');
const { ROLES } = require('../sharedPath').resolve('constants/roles');

const SALT_ROUNDS = 10;
const JWT_EXPIRY = '12h';

class BadRequestError extends Error {
  constructor(message) {
    super(message);
    this.statusCode = 400;
  }
}

class UnauthorizedError extends Error {
  constructor(message) {
    super(message);
    this.statusCode = 401;
  }
}

/**
 * Registers a new user. Students have no department restriction.
 * Department admins MUST supply a valid department (CS/IT/ENTC).
 */
async function register({ name, email, password, role, department }) {
  if (!name || !email || !password || !role) {
    throw new BadRequestError('name, email, password, and role are required');
  }
  if (!isValidEmail(email)) {
    throw new BadRequestError('Invalid email format');
  }
  if (!Object.values(ROLES).includes(role)) {
    throw new BadRequestError(`role must be one of: ${Object.values(ROLES).join(', ')}`);
  }
  if (role === ROLES.DEPARTMENT_ADMIN && !isValidDepartment(department)) {
    throw new BadRequestError('department_admin accounts require a valid department (CS, IT, or ENTC)');
  }
  if (role === ROLES.STUDENT && department) {
    throw new BadRequestError('students must not specify a department');
  }

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    throw new BadRequestError('A user with this email already exists');
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const user = new User({
    userId: uuidv4(),
    name,
    email: email.toLowerCase(),
    passwordHash,
    role,
    department: role === ROLES.DEPARTMENT_ADMIN ? department : null,
  });
  await user.save();

  return { userId: user.userId, name: user.name, email: user.email, role: user.role, department: user.department };
}

/**
 * Verifies credentials and returns a signed JWT containing
 * { userId, role, department }, which every department service trusts
 * and re-validates using the same JWT_SECRET.
 */
async function login({ email, password }) {
  if (!email || !password) {
    throw new BadRequestError('email and password are required');
  }

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const token = jwt.sign(
    { userId: user.userId, role: user.role, department: user.department },
    process.env.JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );

  return {
    token,
    user: { userId: user.userId, name: user.name, email: user.email, role: user.role, department: user.department },
  };
}

module.exports = { register, login, BadRequestError, UnauthorizedError };
