// Helpers that write to audit_logs / notifications using the caller's connection
// (so they take part in the same transaction).
async function logAudit(conn, { requestId, userId, action, oldValue = null, newValue = null, details = null }) {
  await conn.query(
    'INSERT INTO audit_logs (request_id, user_id, action, old_value, new_value, details) VALUES (?,?,?,?,?,?)',
    [requestId, userId || null, action, oldValue, newValue, details]
  );
}

async function notify(conn, userIds, requestId, type, message, excludeUserId = null) {
  const targets = [...new Set(userIds)].filter((id) => id && id !== excludeUserId);
  for (const id of targets) {
    await conn.query(
      'INSERT INTO notifications (user_id, request_id, type, message) VALUES (?,?,?,?)',
      [id, requestId, type, message.slice(0, 255)]
    );
  }
}

module.exports = { logAudit, notify };
