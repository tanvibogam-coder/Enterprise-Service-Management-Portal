import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useToast } from '../context/ToastContext.jsx';
import { EmptyState, ErrorState, Pagination, Spinner, fmt, useAsync } from '../components/ui.jsx';

export default function Notifications() {
  const navigate = useNavigate();
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const { data, loading, error, reload } = useAsync(() => api.get('/notifications', { page, limit: 15, unread: unreadOnly ? 1 : '' }), [page, unreadOnly]);
  const changed = () => window.dispatchEvent(new Event('notifications-changed'));

  const open = async (n) => {
    if (!n.is_read) { await api.patch(`/notifications/${n.id}/read`).catch(() => {}); changed(); }
    if (n.request_id) navigate(`/requests/${n.request_id}`); else reload();
  };
  const markAll = async () => {
    try { await api.patch('/notifications/read-all'); toast.success('All notifications marked as read'); changed(); reload(); }
    catch (err) { toast.error(err.message); }
  };

  return (
    <>
      <div className="page-head">
        <div><h1>Notifications</h1><p className="muted">Assignments, status changes, comments and overdue alerts</p></div>
        <div className="head-actions">
          <label className="check"><input type="checkbox" checked={unreadOnly} onChange={(e) => { setUnreadOnly(e.target.checked); setPage(1); }} /> Unread only</label>
          <button className="btn" onClick={markAll}>Mark all as read</button>
        </div>
      </div>
      {loading && !data && <Spinner />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {data && (data.data.length === 0 ? <EmptyState title={unreadOnly ? 'No unread notifications' : 'No notifications yet'} hint="You will be notified when requests are assigned or updated." /> : (
        <div className="panel flush">
          <ul className="notes">
            {data.data.map((n) => (
              <li key={n.id} className={n.is_read ? '' : 'unread'}>
                <button onClick={() => open(n)}>
                  <span className={`dot ${n.type}`} aria-hidden="true" />
                  <span className="note-msg">{n.message}</span>
                  <span className="muted small">{fmt(n.created_at)}</span>
                </button>
              </li>
            ))}
          </ul>
          <Pagination pagination={data.pagination} onPage={setPage} />
        </div>
      ))}
    </>
  );
}
