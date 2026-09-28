const mongoose = require('mongoose');

/**
 * The Gateway is the sole owner of the User collection (centralized
 * auth per the approved architecture - authentication is not a
 * distributed "resource" concept, so this does not violate the
 * separate-DB-per-department rule for resources).
 */
const userSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, required: true, enum: ['STUDENT', 'DEPARTMENT_ADMIN'] },
    // Only populated (and only valid) for DEPARTMENT_ADMIN role.
    department: { type: String, enum: ['CS', 'IT', 'ENTC', null], default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
