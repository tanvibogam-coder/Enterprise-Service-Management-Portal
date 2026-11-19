const router = require('express').Router();
const pool = require('../config/db');
const { HttpError, asyncHandler } = require('../utils/httpError');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/', asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const unreadOnly = req.query.unread === '1';
  const where = unreadOnly ? 'n.user_id = ? AND n.is_read = 0' : 'n.user_id = ?';
  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM notifications n WHERE ${where}`, [req.user.id]);
  const [rows] = await pool.query(
    `SELECT n.id, n.request_id, n.type, n.message, n.is_read, n.created_at, sr.request_no
       FROM notifications n LEFT JOIN service_requests sr ON sr.id = n.request_id
      WHERE ${where}
      ORDER BY n.created_at DESC, n.id DESC LIMIT ? OFFSET ?`,
    [req.user.id, limit, (page - 1) * limit]
  );
  res.json({ data: rows, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
}));

router.get('/unread-count', asyncHandler(async (req, res) => {
  const [[{ count }]] = await pool.query(
    'SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND is_read = 0', [req.user.id]);
  res.json({ count });
}));

router.patch('/read-all', asyncHandler(async (req, res) => {
  await pool.query('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0', [req.user.id]);
  res.json({ message: 'All notifications marked as read' });
}));

router.patch('/:id/read', asyncHandler(async (req, res) => {
  const [r] = await pool.query('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  if (!r.affectedRows) throw new HttpError(404, 'Notification not found');
  res.json({ message: 'Marked as read' });
}));

module.exports = router;
