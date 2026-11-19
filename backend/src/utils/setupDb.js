// Usage: npm run db:setup   -> creates the schema and loads sample data.
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true
  });
  const dir = path.join(__dirname, '..', '..', '..', 'database');
  for (const file of ['schema.sql', 'seed.sql']) {
    console.log(`Running ${file} ...`);
    await conn.query(fs.readFileSync(path.join(dir, file), 'utf8'));
  }
  await conn.end();
  console.log('Database ready. Demo password for all users: Password@123');
})().catch((e) => { console.error('Setup failed:', e.message); process.exit(1); });
