
// Usage: npm run db:setup
// Creates the database schema and loads sample data.

const path = require('path');
const fs = require('fs');
const mysql = require('mysql2/promise');

require('dotenv').config({
  path: path.join(__dirname, '..', '..', '.env')
});

(async () => {
  let conn;

  try {
    conn = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',

      ssl: {
        ca: fs.readFileSync(
          path.join(__dirname, '../../certs/ca.pem')
        ),
        minVersion: 'TLSv1.2'
      },

      multipleStatements: true
    });

    const dir = path.join(__dirname, '..', '..', '..', 'database');

    for (const file of ['schema.sql', 'seed.sql']) {
      const filePath = path.join(dir, file);

      console.log(`Running ${file} ...`);

      const sql = fs.readFileSync(filePath, 'utf8');

      await conn.query(sql);

      console.log(`${file} completed successfully.`);
    }

    console.log('Database ready. Demo password for all users: Password@123');

  } catch (error) {
    console.error('Setup failed:', error.message);
    process.exitCode = 1;

  } finally {
    if (conn) {
      await conn.end();
    }
  }
})();
