const router = require('express').Router();
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const crypto = require('crypto');
const pool = require('../config/db');
const { HttpError, asyncHandler } = require('../utils/httpError');
const { str, assertValid } = require('../utils/validate');
const { authenticate, authorize } = require('../middleware/auth');
const { visibility, buildFilters } = require('../utils/scope');
const { logAudit, notify } = require('../utils/audit');
const wf = require('../utils/workflow');

router.use(authenticate);

// ---------- file uploads ----------
const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const ALLOWED_EXT = ['.png', '.jpg', '.jpeg', '.gif', '.pdf', '.txt', '.log', '.doc', '.docx', '.xlsx', '.csv', '.zip'];
const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) =>
      cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${path.extname(file.originalname).toLowerCase()}`)
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 5 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXT.includes(ext)) return cb(new HttpError(422, `File type ${ext || '(none)'} is not allowed`));
    cb(null, true);
  }
});
const removeFiles = (files = []) => files.forEach((f) => fs.unlink(f.path, () => {}));

// ---------- helpers ----------
const SELECT_REQUEST = `
  SELECT sr.*, d.name AS department_name, cu.name AS created_by_name, au.name AS assigned_to_name
    FROM service_requests sr
    JOIN departments d ON d.id = sr.department_id
    JOIN users cu ON cu.id = sr.created_by
    LEFT JOIN users au ON au.id = sr.assigned_to`;

const SORTABLE = {
  created_at: 'sr.created_at', due_date: 'sr.due_date', title: 'sr.title', request_no: 'sr.request_no',
  status: "FIELD(sr.status,'open','assigned','in_progress','resolved','closed')",
  priority: "FIELD(sr.priority,'low','medium','high','critical')"
};

async function loadRequest(id, user, conn = pool) {
  if (!/^\d+$/.test(String(id))) throw new HttpError(400, 'Invalid request id');
  const [rows] = await conn.query(`${SELECT_REQUEST} WHERE sr.id = ?`, [Number(id)]);
  if (!rows.length) throw new HttpError(404, 'Request not found');
  const request = rows[0];
  const vis = visibility(user);
  const [ok] = await conn.query(`SELECT sr.id FROM service_requests sr WHERE sr.id = ? AND ${vis.sql}`, [request.id, ...vis.params]);
  if (!ok.length) throw new HttpError(403, 'You do not have access to this request');
  return request;
}

// Picks the active agent in the department with the fewest open assignments.
async function pickAgent(conn, departmentId) {
  const [rows] = await conn.query(
    `SELECT u.id, u.name, COUNT(sr.id) AS workload
       FROM users u
       LEFT JOIN service_requests sr ON sr.assigned_to = u.id AND sr.status IN ('assigned','in_progress')
      WHERE u.role = 'agent' AND u.is_active = 1 AND u.department_id = ?
      GROUP BY u.id, u.name ORDER BY workload ASC, u.id ASC LIMIT 1`, [departmentId]);
  return rows[0] || null;
}

async function autoAssign(conn, request, actorId) {
  const agent = await pickAgent(conn, request.department_id);
  if (agent) {
    await conn.query("UPDATE service_requests SET assigned_to = ?, status = 'assigned' WHERE id = ?", [agent.id, request.id]);
    await conn.query('INSERT INTO request_assignments (request_id, assigned_to, assigned_by, note) VALUES (?,?,?,?)',
      [request.id, agent.id, actorId, 'Auto-assigned (lowest workload)']);
    await logAudit(conn, { requestId: request.id, userId: actorId, action: 'assigned', newValue: agent.name, details: 'Auto-assigned (lowest workload)' });
    await notify(conn, [agent.id], request.id, 'assigned', `Request ${request.request_no} was assigned to you`);
    return agent;
  }
  const [admins] = await conn.query("SELECT id FROM users WHERE role = 'admin' AND is_active = 1");
  await notify(conn, admins.map((a) => a.id), request.id, 'unassigned',
    `Request ${request.request_no} has no available agent in its department`, actorId);
  return null;
}

async function withTransaction(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (e) {
    await conn.rollback().catch(() => {});
    throw e;
  } finally {
    conn.release();
  }
}

const parseDate = (v) => { const d = new Date(v); return Number.isNaN(d.getTime()) ? null : d; };

// ---------- list / export ----------
router.get('/', asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
  const { where, params } = buildFilters(req.query, req.user);
  const sortCol = SORTABLE[req.query.sort] || SORTABLE.created_at;
  const dir = String(req.query.order).toLowerCase() === 'asc' ? 'ASC' : 'DESC';

  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM service_requests sr WHERE ${where}`, params);
  const [rows] = await pool.query(
    `${SELECT_REQUEST} WHERE ${where} ORDER BY ${sortCol} ${dir}, sr.id DESC LIMIT ? OFFSET ?`,
    [...params, limit, (page - 1) * limit]
  );
  res.json({ data: rows, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
}));

const csvCell = (v) => {
  if (v === null || v === undefined) return '';
  let s = v instanceof Date ? v.toISOString() : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // neutralise spreadsheet formula injection
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

router.get('/export/csv', authorize('admin', 'agent'), asyncHandler(async (req, res) => {
  const { where, params } = buildFilters(req.query, req.user);
  const [rows] = await pool.query(`${SELECT_REQUEST} WHERE ${where} ORDER BY sr.created_at DESC LIMIT 10000`, params);
  const cols = [
    ['Request ID', 'request_no'], ['Title', 'title'], ['Department', 'department_name'], ['Category', 'category'],
    ['Priority', 'priority'], ['Status', 'status'], ['Created By', 'created_by_name'], ['Assigned To', 'assigned_to_name'],
    ['Created At', 'created_at'], ['Due Date', 'due_date'], ['Resolved At', 'resolved_at'], ['Overdue', 'is_overdue']
  ];
  const lines = [cols.map((c) => c[0]).join(',')];
  for (const r of rows) {
    lines.push(cols.map(([, k]) => csvCell(k === 'is_overdue' ? (r.is_overdue ? 'Yes' : 'No') : r[k])).join(','));
  }
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="requests-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send('\uFEFF' + lines.join('\r\n'));
}));

// ---------- create ----------
router.post('/', upload.array('attachments', 5), asyncHandler(async (req, res) => {
  try {
    const title = str(req.body.title);
    const description = str(req.body.description);
    const category = str(req.body.category);
    const priority = str(req.body.priority) || 'medium';
    const departmentId = Number(req.body.department_id);
    const errors = {};
    if (title.length < 5 || title.length > 200) errors.title = 'Title must be 5-200 characters';
    if (description.length < 10 || description.length > 5000) errors.description = 'Description must be 10-5000 characters';
    if (!category || category.length > 60) errors.category = 'Category is required (max 60 characters)';
    if (!wf.PRIORITIES.includes(priority)) errors.priority = 'Priority must be low, medium, high or critical';
    if (!Number.isInteger(departmentId) || departmentId < 1) errors.department_id = 'Select a department';
    else {
      const [d] = await pool.query('SELECT id FROM departments WHERE id = ?', [departmentId]);
      if (!d.length) errors.department_id = 'Department does not exist';
    }
    assertValid(errors);

    const created = await withTransaction(async (conn) => {
      const due = wf.dueDateFor(priority);
      const [ins] = await conn.query(
        `INSERT INTO service_requests (request_no, title, description, department_id, category, priority, created_by, due_date)
         VALUES (?,?,?,?,?,?,?,?)`,
        [`TMP-${crypto.randomBytes(8).toString('hex')}`, title, description, departmentId, category, priority, req.user.id, due]
      );
      const id = ins.insertId;
      const requestNo = `REQ-${new Date().getUTCFullYear()}-${String(id).padStart(5, '0')}`;
      await conn.query('UPDATE service_requests SET request_no = ? WHERE id = ?', [requestNo, id]);
      for (const f of req.files || []) {
        await conn.query(
          'INSERT INTO request_attachments (request_id, original_name, stored_name, mime_type, size_bytes, uploaded_by) VALUES (?,?,?,?,?,?)',
          [id, f.originalname.slice(0, 255), f.filename, f.mimetype, f.size, req.user.id]);
      }
      await logAudit(conn, { requestId: id, userId: req.user.id, action: 'created', newValue: 'open', details: 'Request created' });
      await autoAssign(conn, { id, request_no: requestNo, department_id: departmentId }, req.user.id);
      return { id, request_no: requestNo };
    });
    res.status(201).json({ message: 'Request submitted', ...created });
  } catch (e) {
    removeFiles(req.files);
    throw e;
  }
}));

// ---------- detail ----------
router.get('/:id', asyncHandler(async (req, res) => {
  const request = await loadRequest(req.params.id, req.user);
  const [attachments] = await pool.query(
    `SELECT a.id, a.original_name, a.mime_type, a.size_bytes, a.created_at, u.name AS uploaded_by_name
       FROM request_attachments a JOIN users u ON u.id = a.uploaded_by WHERE a.request_id = ? ORDER BY a.id`, [request.id]);
  const [comments] = await pool.query(
    `SELECT c.id, c.comment, c.created_at, u.name AS user_name, u.role AS user_role
       FROM request_comments c JOIN users u ON u.id = c.user_id WHERE c.request_id = ? ORDER BY c.created_at, c.id`, [request.id]);
  const [assignments] = await pool.query(
    `SELECT ra.id, ra.note, ra.created_at, t.name AS assigned_to_name, b.name AS assigned_by_name
       FROM request_assignments ra JOIN users t ON t.id = ra.assigned_to LEFT JOIN users b ON b.id = ra.assigned_by
      WHERE ra.request_id = ? ORDER BY ra.created_at DESC, ra.id DESC`, [request.id]);
  const [timeline] = await pool.query(
    `SELECT al.id, al.action, al.old_value, al.new_value, al.details, al.created_at, u.name AS user_name
       FROM audit_logs al LEFT JOIN users u ON u.id = al.user_id WHERE al.request_id = ?
      ORDER BY al.created_at DESC, al.id DESC`, [request.id]);

  const u = req.user;
  const isAdmin = u.role === 'admin';
  const isOwner = request.created_by === u.id;
  const isAssignee = request.assigned_to === u.id;
  const active = !['resolved', 'closed'].includes(request.status);
  res.json({
    request, attachments, comments, assignments, timeline,
    permissions: {
      allowed_statuses: wf.allowedTransitions(u, request),
      can_assign: active && (isAdmin || (u.role === 'agent' && !request.assigned_to && u.department_id === request.department_id)),
      can_edit_basic: isAdmin || (isOwner && ['open', 'assigned'].includes(request.status)),
      can_edit_priority: isAdmin || (u.role === 'agent' && isAssignee && active),
      can_delete: isAdmin || (isOwner && ['open', 'assigned'].includes(request.status)),
      can_comment: true
    }
  });
}));

// ---------- edit (title/description/category, priority/deadline, department) ----------
router.put('/:id', asyncHandler(async (req, res) => {
  const request = await loadRequest(req.params.id, req.user);
  const u = req.user;
  const isAdmin = u.role === 'admin';
  const isOwner = request.created_by === u.id;
  const isAssignee = u.role === 'agent' && request.assigned_to === u.id;
  const active = !['resolved', 'closed'].includes(request.status);
  const b = req.body;

  const canBasic = isAdmin || (isOwner && ['open', 'assigned'].includes(request.status));
  const canPriority = isAdmin || (isAssignee && active) || (isOwner && ['open', 'assigned'].includes(request.status));
  const canDeadline = isAdmin || (isAssignee && active);
  if (!canBasic && !canPriority && !canDeadline) throw new HttpError(403, 'You cannot edit this request');

  const changes = {}; const errors = {};
  if (b.title !== undefined || b.description !== undefined || b.category !== undefined) {
    if (!canBasic) throw new HttpError(403, 'You cannot edit the details of this request');
    if (b.title !== undefined) {
      const v = str(b.title); if (v.length < 5 || v.length > 200) errors.title = 'Title must be 5-200 characters'; else changes.title = v;
    }
    if (b.description !== undefined) {
      const v = str(b.description); if (v.length < 10 || v.length > 5000) errors.description = 'Description must be 10-5000 characters'; else changes.description = v;
    }
    if (b.category !== undefined) {
      const v = str(b.category); if (!v || v.length > 60) errors.category = 'Category is required (max 60 characters)'; else changes.category = v;
    }
  }
  if (b.priority !== undefined) {
    if (!canPriority) throw new HttpError(403, 'You cannot change the priority of this request');
    if (!wf.PRIORITIES.includes(b.priority)) errors.priority = 'Priority must be low, medium, high or critical'; else changes.priority = b.priority;
  }
  if (b.due_date !== undefined) {
    if (!canDeadline) throw new HttpError(403, 'You cannot change the deadline of this request');
    const d = parseDate(b.due_date);
    if (!d) errors.due_date = 'Enter a valid deadline'; else changes.due_date = d;
  }
  if (b.department_id !== undefined) {
    if (!isAdmin) throw new HttpError(403, 'Only administrators can move a request to another department');
    const id = Number(b.department_id);
    const [d] = await pool.query('SELECT id FROM departments WHERE id = ?', [id]);
    if (!d.length) errors.department_id = 'Department does not exist'; else changes.department_id = id;
  }
  assertValid(errors);
  const fields = Object.keys(changes).filter((k) => {
    const cur = request[k];
    return (cur instanceof Date ? cur.getTime() : cur) !== (changes[k] instanceof Date ? changes[k].getTime() : changes[k]);
  });
  if (!fields.length) throw new HttpError(400, 'No changes to save');

  await withTransaction(async (conn) => {
    const sets = fields.map((f) => `${f} = ?`);
    const vals = fields.map((f) => changes[f]);
    if (fields.includes('due_date')) { sets.push('is_overdue = ?'); vals.push(changes.due_date < new Date() ? 1 : 0); }
    await conn.query(`UPDATE service_requests SET ${sets.join(', ')} WHERE id = ?`, [...vals, request.id]);
    for (const f of fields) {
      const show = (v) => (v instanceof Date ? v.toISOString() : v === null || v === undefined ? null : String(v).slice(0, 255));
      await logAudit(conn, { requestId: request.id, userId: u.id, action: 'updated', oldValue: show(request[f]), newValue: show(changes[f]), details: `Changed ${f.replace('_', ' ')}` });
    }
    if (fields.includes('department_id')) {
      // Re-route to an agent of the new department.
      await conn.query("UPDATE service_requests SET assigned_to = NULL, status = 'open' WHERE id = ?", [request.id]);
      await autoAssign(conn, { ...request, department_id: changes.department_id }, u.id);
    }
    await notify(conn, [request.created_by, request.assigned_to], request.id, 'updated',
      `Request ${request.request_no} was updated by ${u.name}`, u.id);
  });
  res.json({ message: 'Request updated' });
}));

// ---------- status ----------
router.patch('/:id/status', asyncHandler(async (req, res) => {
  const request = await loadRequest(req.params.id, req.user);
  const to = req.body.status;
  if (!wf.STATUSES.includes(to)) throw new HttpError(422, 'Validation failed', { status: 'Invalid status' });
  if (!wf.isValidTransition(request.status, to)) {
    throw new HttpError(400, `Invalid status change: ${wf.STATUS_LABELS[request.status]} → ${wf.STATUS_LABELS[to]}`);
  }
  if (to === 'assigned' && !request.assigned_to) throw new HttpError(400, 'Assign the request to an agent first');
  if (!wf.canUserTransition(req.user, request, to)) {
    throw new HttpError(403, 'You are not allowed to make this status change');
  }
  const note = str(req.body.note).slice(0, 500);

  await withTransaction(async (conn) => {
    const extra = [];
    if (to === 'resolved') extra.push('resolved_at = NOW()');
    if (to === 'closed') extra.push('closed_at = NOW()');
    if (request.status === 'resolved' && to === 'in_progress') extra.push('resolved_at = NULL');
    await conn.query(`UPDATE service_requests SET status = ?${extra.length ? ', ' + extra.join(', ') : ''} WHERE id = ?`, [to, request.id]);
    await logAudit(conn, { requestId: request.id, userId: req.user.id, action: 'status_changed', oldValue: request.status, newValue: to, details: note || null });
    if (note) await conn.query('INSERT INTO request_comments (request_id, user_id, comment) VALUES (?,?,?)', [request.id, req.user.id, note]);
    await notify(conn, [request.created_by, request.assigned_to], request.id, 'status',
      `Request ${request.request_no} is now ${wf.STATUS_LABELS[to]}`, req.user.id);
  });
  res.json({ message: `Status changed to ${wf.STATUS_LABELS[to]}` });
}));

// ---------- assignment ----------
router.patch('/:id/assign', authorize('admin', 'agent'), asyncHandler(async (req, res) => {
  const request = await loadRequest(req.params.id, req.user);
  const u = req.user;
  if (['resolved', 'closed'].includes(request.status)) throw new HttpError(400, 'Resolved or closed requests cannot be reassigned');
  const targetId = Number(req.body.assigned_to);
  if (!Number.isInteger(targetId) || targetId < 1) throw new HttpError(422, 'Validation failed', { assigned_to: 'Select an agent' });

  if (u.role === 'agent') {
    const canTake = !request.assigned_to && u.department_id === request.department_id && targetId === u.id;
    if (!canTake) throw new HttpError(403, 'Agents can only assign unassigned requests of their own department to themselves');
  }
  const [agents] = await pool.query("SELECT id, name, department_id FROM users WHERE id = ? AND role = 'agent' AND is_active = 1", [targetId]);
  if (!agents.length) throw new HttpError(422, 'Validation failed', { assigned_to: 'Selected user is not an active agent' });
  if (agents[0].department_id !== request.department_id) {
    throw new HttpError(422, 'Validation failed', { assigned_to: 'Agent does not belong to the request department' });
  }
  if (request.assigned_to === targetId) throw new HttpError(400, 'Request is already assigned to this agent');
  const note = str(req.body.note).slice(0, 255) || null;

  await withTransaction(async (conn) => {
    await conn.query("UPDATE service_requests SET assigned_to = ?, status = 'assigned' WHERE id = ?", [targetId, request.id]);
    await conn.query('INSERT INTO request_assignments (request_id, assigned_to, assigned_by, note) VALUES (?,?,?,?)', [request.id, targetId, u.id, note]);
    await logAudit(conn, { requestId: request.id, userId: u.id, action: 'assigned', oldValue: request.assigned_to_name, newValue: agents[0].name, details: note });
    await notify(conn, [targetId], request.id, 'assigned', `Request ${request.request_no} was assigned to you`, u.id);
    await notify(conn, [request.created_by, request.assigned_to], request.id, 'status',
      `Request ${request.request_no} was assigned to ${agents[0].name}`, u.id);
  });
  res.json({ message: `Assigned to ${agents[0].name}` });
}));

// ---------- comments ----------
router.post('/:id/comments', asyncHandler(async (req, res) => {
  const request = await loadRequest(req.params.id, req.user);
  const comment = str(req.body.comment);
  if (comment.length < 1 || comment.length > 2000) throw new HttpError(422, 'Validation failed', { comment: 'Comment must be 1-2000 characters' });
  await withTransaction(async (conn) => {
    await conn.query('INSERT INTO request_comments (request_id, user_id, comment) VALUES (?,?,?)', [request.id, req.user.id, comment]);
    await logAudit(conn, { requestId: request.id, userId: req.user.id, action: 'commented', details: comment.slice(0, 120) });
    await notify(conn, [request.created_by, request.assigned_to], request.id, 'comment',
      `${req.user.name} commented on ${request.request_no}`, req.user.id);
  });
  res.status(201).json({ message: 'Comment added' });
}));

// ---------- attachments ----------
router.get('/:id/attachments/:attId', asyncHandler(async (req, res) => {
  const request = await loadRequest(req.params.id, req.user);
  const [rows] = await pool.query('SELECT * FROM request_attachments WHERE id = ? AND request_id = ?', [req.params.attId, request.id]);
  if (!rows.length) throw new HttpError(404, 'Attachment not found');
  const file = path.join(UPLOAD_DIR, path.basename(rows[0].stored_name));
  if (!fs.existsSync(file)) throw new HttpError(404, 'File is no longer available');
  res.download(file, rows[0].original_name);
}));

router.post('/:id/attachments', upload.array('attachments', 5), asyncHandler(async (req, res) => {
  try {
    const request = await loadRequest(req.params.id, req.user);
    if (!req.files || !req.files.length) throw new HttpError(422, 'Validation failed', { attachments: 'Choose at least one file' });
    if (request.status === 'closed') throw new HttpError(400, 'Closed requests cannot be changed');
    await withTransaction(async (conn) => {
      for (const f of req.files) {
        await conn.query(
          'INSERT INTO request_attachments (request_id, original_name, stored_name, mime_type, size_bytes, uploaded_by) VALUES (?,?,?,?,?,?)',
          [request.id, f.originalname.slice(0, 255), f.filename, f.mimetype, f.size, req.user.id]);
      }
      await logAudit(conn, { requestId: request.id, userId: req.user.id, action: 'attachment_added', details: req.files.map((f) => f.originalname).join(', ').slice(0, 480) });
    });
    res.status(201).json({ message: 'Attachment uploaded' });
  } catch (e) {
    removeFiles(req.files);
    throw e;
  }
}));

// ---------- delete ----------
router.delete('/:id', asyncHandler(async (req, res) => {
  const request = await loadRequest(req.params.id, req.user);
  const isAdmin = req.user.role === 'admin';
  const isOwner = request.created_by === req.user.id;
  if (!(isAdmin || (isOwner && ['open', 'assigned'].includes(request.status)))) {
    throw new HttpError(403, 'You cannot delete this request');
  }
  const [files] = await pool.query('SELECT stored_name FROM request_attachments WHERE request_id = ?', [request.id]);
  await pool.query('DELETE FROM service_requests WHERE id = ?', [request.id]);
  files.forEach((f) => fs.unlink(path.join(UPLOAD_DIR, path.basename(f.stored_name)), () => {}));
  res.json({ message: 'Request deleted' });
}));

module.exports = router;
