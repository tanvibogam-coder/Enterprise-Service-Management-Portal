const { HttpError } = require('./httpError');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const str = (v) => (typeof v === 'string' ? v.trim() : '');

function assertValid(errors) {
  if (Object.keys(errors).length) throw new HttpError(422, 'Validation failed', errors);
}

function validatePassword(pw) {
  if (typeof pw !== 'string' || pw.length < 8) return 'Password must be at least 8 characters';
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return 'Password must contain letters and numbers';
  if (pw.length > 72) return 'Password must be 72 characters or fewer';
  return null;
}

module.exports = { EMAIL_RE, str, assertValid, validatePassword };
