const { STATUSES, PRIORITIES } = require('./workflow');

// Which requests may this user see? (server-side authorization)
function visibility(user) {
  if (user.role === 'admin') return { sql: '1=1', params: [] };
  if (user.role === 'agent') {
    if (user.department_id) {
      return { sql: '(sr.assigned_to = ? OR sr.department_id = ?)', params: [user.id, user.department_id] };
    }
    return { sql: 'sr.assigned_to = ?', params: [user.id] };
  }
  return { sql: 'sr.created_by = ?', params: [user.id] };
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Builds a WHERE clause from the query string (search + filters + date range).
function buildFilters(query, user) {
  const vis = visibility(user);
  const where = [vis.sql];
  const params = [...vis.params];

  if (query.q && String(query.q).trim()) {
    const like = `%${String(query.q).trim()}%`;
    where.push('(sr.title LIKE ? OR sr.request_no LIKE ? OR sr.description LIKE ?)');
    params.push(like, like, like);
  }
  if (STATUSES.includes(query.status)) { where.push('sr.status = ?'); params.push(query.status); }
  if (PRIORITIES.includes(query.priority)) { where.push('sr.priority = ?'); params.push(query.priority); }
  if (query.department_id && /^\d+$/.test(query.department_id)) {
    where.push('sr.department_id = ?'); params.push(Number(query.department_id));
  }
  if (query.category && String(query.category).trim()) {
    where.push('sr.category = ?'); params.push(String(query.category).trim());
  }
  if (query.overdue === '1' || query.overdue === 'true') {
    where.push("sr.is_overdue = 1 AND sr.status NOT IN ('resolved','closed')");
  }
  if (query.mine === '1' || query.mine === 'true') {
    where.push('(sr.created_by = ? OR sr.assigned_to = ?)'); params.push(user.id, user.id);
  }
  if (DATE_RE.test(query.from || '')) { where.push('sr.created_at >= ?'); params.push(`${query.from} 00:00:00`); }
  if (DATE_RE.test(query.to || '')) {
    where.push('sr.created_at < DATE_ADD(?, INTERVAL 1 DAY)'); params.push(`${query.to} 00:00:00`);
  }
  return { where: where.join(' AND '), params };
}

module.exports = { visibility, buildFilters };
