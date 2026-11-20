require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');
const { HttpError } = require('./utils/httpError');
const { startOverdueJob } = require('./jobs/overdue');

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET is missing. Copy .env.example to .env and set it.');
  process.exit(1);
}

const app = express();
app.disable('x-powered-by');
app.use(cors({ origin: true, exposedHeaders: ['Content-Disposition'] }));
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));
app.use('/api/auth', require('./routes/auth'));
app.use('/api', require('./routes/lookups'));
app.use('/api/users', require('./routes/users'));
app.use('/api/requests', require('./routes/requests'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/dashboard', require('./routes/dashboard'));

app.use('/api', (req, res, next) => next(new HttpError(404, `Route not found: ${req.method} ${req.originalUrl}`)));

// Central error handler -> consistent JSON + proper status codes.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  let status = err.status || 500;
  let message = err.message;
  let errors = err.errors;
  if (err.type === 'entity.parse.failed') { status = 400; message = 'Malformed JSON body'; }
  if (err.name === 'MulterError') {
    status = 422;
    message = err.code === 'LIMIT_FILE_SIZE' ? 'Each file must be 5 MB or smaller' : `Upload error: ${err.message}`;
    errors = { attachments: message };
  }
  if (err.code === 'ER_DUP_ENTRY') { status = 409; message = 'Duplicate record'; }
  if (status >= 500) { console.error(err); message = 'Something went wrong on the server'; }
  res.status(status).json({ message, ...(errors ? { errors } : {}) });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);
  startOverdueJob();
});
