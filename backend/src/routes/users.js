const router = require('express').Router();
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { HttpError, asyncHandler } = require('../utils/httpError');
const { EMAIL_RE, str, assertValid, validatePassword } = require('../utils/validate');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

const ROLES = ['admin', 'employee', 'agent'];

// Agents of a department with their current workload (used for assignment).
router.get('/agents', authorize('admin', 'agent'), asyncHandler(async (req, res) => {
  const params = [];
  let where = "u.role = 'agent' AND u.is_active = 1";
  if (req.query.department_id && /^\d+$/.test(req.query.department_id)) {
    where += ' AND u.department_id = ?'; params.push(Number(req.query.department_id));
  }
  const [rows] = await pool.query(
    `SELECT u.id, u.name, u.email, u.department_id, d.name AS department_name,
            COUNT(sr.id) AS workload
       FROM users u
       LEFT JOIN departments d ON d.id = u.department_id
       LEFT JOIN service_requests sr ON sr.assigned_to = u.id AND sr.status IN ('assigned','in_progress')
      WHERE ${where}
      GROUP BY u.id, d.name
      ORDER BY workload ASC, u.name ASC`, params);
  res.json({ data: rows });
}));

router.get('/', authorize('admin'), asyncHandler(async (req, res) => {
  const where = ['1=1']; const params = [];
  if (ROLES.includes(req.query.role)) { where.push('u.role = ?'); params.push(req.query.role); }
  if (req.query.q && String(req.query.q).trim()) {
    where.push('(u.name LIKE ? OR u.email LIKE ?)');
    const like = `%${String(req.query.q).trim()}%`; params.push(like, like);
  }
  const [rows] = await pool.query(
    `SELECT u.id, u.name, u.email, u.role, u.department_id, d.name AS department_name, u.is_active, u.created_at
       FROM users u LEFT JOIN departments d ON d.id = u.department_id
      WHERE ${where.join(' AND ')} ORDER BY u.created_at DESC`, params);
  res.json({ data: rows });
}));

async function validateUserFields(body, { partial }) {
  const errors = {};
  const out = {};
  if (!partial || body.name !== undefined) {
    out.name = str(body.name);
    if (out.name.length < 2 || out.name.length > 100) errors.name = 'Name must be 2-100 characters';
  }
  if (!partial || body.email !== undefined) {
    out.email = str(body.email).toLowerCase();
    if (!EMAIL_RE.test(out.email)) errors.email = 'Enter a valid email address';
  }
  if (!partial || body.role !== undefined) {
    out.role = body.role;
    if (!ROLES.includes(out.role)) errors.role = 'Role must be admin, employee or agent';
  }
  if (body.department_id !== undefined) {
    out.department_id = body.department_id === null || body.department_id === '' ? null : Number(body.department_id);
    if (out.department_id !== null) {
      const [d] = await pool.query('SELECT id FROM departments WHERE id = ?', [out.department_id]);
      if (!d.length) errors.department_id = 'Department does not exist';
    }
  }
  if (body.password !== undefined && body.password !== '') {
    const e = validatePassword(body.password); if (e) errors.password = e;
    out.password = body.password;
  } else if (!partial) {
    errors.password = 'Password is required';
  }
  return { errors, out };
}

router.post('/', authorize('admin'), asyncHandler(async (req, res) => {
  const { errors, out } = await validateUserFields(req.body, { partial: false });
  if (out.role === 'agent' && !out.department_id) errors.department_id = 'Agents must belong to a department';
  assertValid(errors);
  const [exists] = await pool.query('SELECT id FROM users WHERE email = ?', [out.email]);
  if (exists.length) throw new HttpError(409, 'An account with this email already exists', { email: 'Email already registered' });
  const hash = await bcrypt.hash(out.password, 10);
  const [r] = await pool.query(
    'INSERT INTO users (name, email, password_hash, role, department_id) VALUES (?,?,?,?,?)',
    [out.name, out.email, hash, out.role, out.department_id || null]
  );
  res.status(201).json({ id: r.insertId, message: 'User created' });
}));

router.patch('/:id', authorize('admin'), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [id]);
  if (!rows.length) throw new HttpError(404, 'User not found');
  const target = rows[0];

  const { errors, out } = await validateUserFields(req.body, { partial: true });
  const newRole = out.role || target.role;
  const newDept = out.department_id !== undefined ? out.department_id : target.department_id;
  if (newRole === 'agent' && !newDept) errors.department_id = 'Agents must belong to a department';
  if (id === req.user.id) {
    if (out.role && out.role !== 'admin') errors.role = 'You cannot change your own role';
    if (req.body.is_active === false || req.body.is_active === 0) errors.is_active = 'You cannot disable your own account';
  }
  assertValid(errors);

  const sets = []; const params = [];
  for (const f of ['name', 'email', 'role', 'department_id']) {
    if (out[f] !== undefined) { sets.push(`${f} = ?`); params.push(out[f]); }
  }
  if (req.body.is_active !== undefined) { sets.push('is_active = ?'); params.push(req.body.is_active ? 1 : 0); }
  if (out.password) { sets.push('password_hash = ?'); params.push(await bcrypt.hash(out.password, 10)); }
  if (!sets.length) throw new HttpError(400, 'No changes provided');
  try {
    await pool.query(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, [...params, id]);
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') throw new HttpError(409, 'Email already registered', { email: 'Email already registered' });
    throw e;
  }
  res.json({ message: 'User updated' });
}));

module.exports = router;
