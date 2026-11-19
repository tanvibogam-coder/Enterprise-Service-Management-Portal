const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'service_portal',
  waitForConnections: true,
  connectionLimit: 10,
  timezone: 'Z',
  charset: 'utf8mb4'
});

// Keep every session in UTC so NOW() and JS dates always agree.
pool.pool.on('connection', (conn) => {
  conn.query("SET time_zone = '+00:00'");
});

module.exports = pool;
