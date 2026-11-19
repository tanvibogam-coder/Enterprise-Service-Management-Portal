const router = require('express').Router();
const pool = require('../config/db');
const { asyncHandler } = require('../utils/httpError');
const { authenticate } = require('../middleware/auth');
const { buildFilters } = require('../utils/scope');
const { flagOverdue } = require('../jobs/overdue');

router.use(authenticate);

// KPI + chart data. Everyone gets metrics for the requests they are allowed to see;
// admins see the whole organisation.
router.get('/summary', asyncHandler(async (req, res) => {
  await flagOverdue();
  const { where, params } = buildFilters({ from: req.query.from, to: req.query.to, department_id: req.query.department_id }, req.user);

  const [[totals]] = await pool.query(
    `SELECT COUNT(*) AS total,
            COALESCE(SUM(sr.status = 'open'),0) AS open,
            COALESCE(SUM(sr.status = 'assigned'),0) AS assigned,
            COALESCE(SUM(sr.status = 'in_progress'),0) AS in_progress,
            COALESCE(SUM(sr.status = 'resolved'),0) AS resolved,
            COALESCE(SUM(sr.status = 'closed'),0) AS closed,
            COALESCE(SUM(sr.is_overdue = 1 AND sr.status NOT IN ('resolved','closed')),0) AS overdue,
            AVG(CASE WHEN sr.resolved_at IS NOT NULL THEN TIMESTAMPDIFF(MINUTE, sr.created_at, sr.resolved_at) END) AS avg_resolution_minutes
       FROM service_requests sr WHERE ${where}`, params);

  const [byDepartment] = await pool.query(
    `SELECT d.name AS label, COUNT(*) AS count FROM service_requests sr
       JOIN departments d ON d.id = sr.department_id WHERE ${where} GROUP BY d.id, d.name ORDER BY count DESC`, params);
  const [byPriority] = await pool.query(
    `SELECT sr.priority AS label, COUNT(*) AS count FROM service_requests sr WHERE ${where}
      GROUP BY sr.priority ORDER BY FIELD(sr.priority,'critical','high','medium','low')`, params);
  const [byStatus] = await pool.query(
    `SELECT sr.status AS label, COUNT(*) AS count FROM service_requests sr WHERE ${where}
      GROUP BY sr.status ORDER BY FIELD(sr.status,'open','assigned','in_progress','resolved','closed')`, params);
  const [overdueList] = await pool.query(
    `SELECT sr.id, sr.request_no, sr.title, sr.priority, sr.due_date, au.name AS assigned_to_name
       FROM service_requests sr LEFT JOIN users au ON au.id = sr.assigned_to
      WHERE ${where} AND sr.is_overdue = 1 AND sr.status NOT IN ('resolved','closed')
      ORDER BY sr.due_date ASC LIMIT 5`, params);

  let agentWorkload = [];
  if (req.user.role === 'admin') {
    [agentWorkload] = await pool.query(
      `SELECT u.id, u.name, d.name AS department_name, COUNT(sr.id) AS active
         FROM users u LEFT JOIN departments d ON d.id = u.department_id
         LEFT JOIN service_requests sr ON sr.assigned_to = u.id AND sr.status IN ('assigned','in_progress')
        WHERE u.role = 'agent' AND u.is_active = 1 GROUP BY u.id, d.name ORDER BY active DESC, u.name`);
  }

  res.json({
    totals: {
      total: Number(totals.total), open: Number(totals.open), assigned: Number(totals.assigned),
      in_progress: Number(totals.in_progress), resolved: Number(totals.resolved), closed: Number(totals.closed),
      overdue: Number(totals.overdue),
      avg_resolution_hours: totals.avg_resolution_minutes == null ? null : Math.round((totals.avg_resolution_minutes / 60) * 10) / 10
    },
    byDepartment, byPriority, byStatus, overdueList, agentWorkload
  });
}));

module.exports = router;
