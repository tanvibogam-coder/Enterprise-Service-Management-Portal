const router = require('express').Router();
const pool = require('../config/db');
const { asyncHandler } = require('../utils/httpError');

// Public: used by the registration/request forms.
router.get('/departments', asyncHandler(async (req, res) => {
  const [rows] = await pool.query('SELECT id, name, description FROM departments ORDER BY name');
  res.json({ data: rows });
}));

module.exports = router;
