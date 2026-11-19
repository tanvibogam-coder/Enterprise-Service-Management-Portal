const pool = require('../config/db');
const { logAudit, notify } = require('../utils/audit');

// Flags requests whose deadline has passed. Runs on a timer and before dashboard reads.
async function flagOverdue() {
  let conn;
  try {
    conn = await pool.getConnection();
    const [rows] = await conn.query(
      `SELECT id, request_no, assigned_to FROM service_requests
        WHERE is_overdue = 0 AND due_date IS NOT NULL AND due_date < NOW()
          AND status NOT IN ('resolved','closed')`);
    if (!rows.length) return 0;
    const [admins] = await conn.query("SELECT id FROM users WHERE role = 'admin' AND is_active = 1");
    await conn.beginTransaction();
    for (const r of rows) {
      await conn.query('UPDATE service_requests SET is_overdue = 1 WHERE id = ?', [r.id]);
      await logAudit(conn, { requestId: r.id, userId: null, action: 'overdue_flagged', details: 'Deadline passed' });
      const targets = r.assigned_to ? [r.assigned_to, ...admins.map((a) => a.id)] : admins.map((a) => a.id);
      await notify(conn, targets, r.id, 'overdue', `Request ${r.request_no} is overdue`);
    }
    await conn.commit();
    return rows.length;
  } catch (e) {
    if (conn) await conn.rollback().catch(() => {});
    console.error('Overdue job failed:', e.message);
    return 0;
  } finally {
    if (conn) conn.release();
  }
}

function startOverdueJob() {
  flagOverdue();
  return setInterval(flagOverdue, 60 * 1000);
}

module.exports = { flagOverdue, startOverdueJob };
