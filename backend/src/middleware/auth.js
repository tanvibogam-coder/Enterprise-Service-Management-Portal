const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { HttpError, asyncHandler } = require('../utils/httpError');

// Verifies the JWT and loads the *current* user row, so role changes and
// deactivation take effect immediately.
const authenticate = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new HttpError(401, 'Authentication required');
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch (e) {
    throw new HttpError(401, 'Session expired or invalid. Please log in again');
  }
  const [rows] = await pool.query(
    'SELECT id, name, email, role, department_id, is_active FROM users WHERE id = ?',
    [payload.id]
  );
  if (!rows.length || !rows[0].is_active) throw new HttpError(401, 'Account not found or disabled');
  req.user = rows[0];
  next();
});

const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return next(new HttpError(403, 'You do not have permission to perform this action'));
  }
  next();
};

module.exports = { authenticate, authorize };
