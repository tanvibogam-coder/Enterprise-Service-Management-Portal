const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { HttpError, asyncHandler } = require('../utils/httpError');
const { EMAIL_RE, str, assertValid, validatePassword } = require('../utils/validate');
const { authenticate } = require('../middleware/auth');

const signToken = (user) =>
  jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '8h'
  });

const publicUser = (u) => ({
  id: u.id, name: u.name, email: u.email, role: u.role, department_id: u.department_id
});

// Very small in-memory brute-force guard: 5 failed logins / 15 min per email+IP.
const attempts = new Map();
const WINDOW_MS = 15 * 60 * 1000;
function tooManyAttempts(key) {
  const rec = attempts.get(key);
  if (!rec || Date.now() - rec.first > WINDOW_MS) { attempts.delete(key); return false; }
  return rec.count >= 5;
}
function recordFailure(key) {
  const rec = attempts.get(key);
  if (!rec || Date.now() - rec.first > WINDOW_MS) attempts.set(key, { count: 1, first: Date.now() });
  else rec.count += 1;
}

router.post('/register', asyncHandler(async (req, res) => {
  const name = str(req.body.name);
  const email = str(req.body.email).toLowerCase();
  const { password } = req.body;
  const errors = {};
  if (name.length < 2 || name.length > 100) errors.name = 'Name must be 2-100 characters';
  if (!EMAIL_RE.test(email)) errors.email = 'Enter a valid email address';
  const pwErr = validatePassword(password);
  if (pwErr) errors.password = pwErr;
  assertValid(errors);

  const [exists] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
  if (exists.length) throw new HttpError(409, 'An account with this email already exists', { email: 'Email already registered' });

  const hash = await bcrypt.hash(password, 10);
  // Public registration always creates an Employee. Admins promote users later.
  const [result] = await pool.query(
    "INSERT INTO users (name, email, password_hash, role) VALUES (?,?,?,'employee')",
    [name, email, hash]
  );
  const user = { id: result.insertId, name, email, role: 'employee', department_id: null };
  res.status(201).json({ token: signToken(user), user: publicUser(user) });
}));

router.post('/login', asyncHandler(async (req, res) => {
  const email = str(req.body.email).toLowerCase();
  const { password } = req.body;
  const errors = {};
  if (!EMAIL_RE.test(email)) errors.email = 'Enter a valid email address';
  if (!password || typeof password !== 'string') errors.password = 'Password is required';
  assertValid(errors);

  const key = `${email}|${req.ip}`;
  if (tooManyAttempts(key)) throw new HttpError(429, 'Too many failed attempts. Try again in 15 minutes');

  const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
  const user = rows[0];
  const ok = user && (await bcrypt.compare(password, user.password_hash));
  if (!ok) { recordFailure(key); throw new HttpError(401, 'Invalid email or password'); }
  if (!user.is_active) throw new HttpError(403, 'This account has been disabled');

  attempts.delete(key);
  res.json({ token: signToken(user), user: publicUser(user) });
}));

router.get('/me', authenticate, (req, res) => res.json({ user: publicUser(req.user) }));

// JWTs are stateless; logout is handled by the client discarding the token.
router.post('/logout', authenticate, (req, res) => res.json({ message: 'Logged out' }));

module.exports = router;
