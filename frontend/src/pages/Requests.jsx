import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, saveBlob } from '../api/client';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import {
  EmptyState, ErrorState, Pagination, PriorityBadge, Spinner, StatusBadge, fmt, useAsync, useDebounced
} from '../components/ui.jsx';

const COLUMNS = [
  ['request_no', 'ID'], ['title', 'Title'], ['priority', 'Priority'], ['status', 'Status'], ['due_date', 'Due'], ['created_at', 'Created']
];

export default function Requests() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [filters, setFilters] = useState({
    q: '', status: params.get('status') || '', priority: '', department_id: '', from: '', to: '',
    overdue: params.get('overdue') === '1'
  });
  const [sort, setSort] = useState({ sort: 'created_at', order: 'desc' });
  const [page, setPage] = useState(1);
  const q = useDebounced(filters.q);
  const { data: deps } = useAsync(() => api.get('/departments'), []);

  const query = {
    ...filters, q, overdue: filters.overdue ? 1 : '', ...sort, page, limit: 10
  };
  const key = JSON.stringify(query);
  const { data, loading, error, reload } = useAsync(() => api.get('/requests', query), [key]);

  useEffect(() => { setPage(1); }, [q, filters.status, filters.priority, filters.department_id, filters.from, filters.to, filters.overdue]);

  const set = (k) => (e) => setFilters({ ...filters, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const toggleSort = (col) => setSort((s) => (s.sort === col ? { sort: col, order: s.order === 'asc' ? 'desc' : 'asc' } : { sort: col, order: 'asc' }));
  const clear = () => setFilters({ q: '', status: '', priority: '', department_id: '', from: '', to: '', overdue: false });
  const invalidRange = filters.from && filters.to && filters.from > filters.to;

  const exportCsv = async () => {
    try {
      const blob = await api.blob('/requests/export/csv', { ...query, page: undefined, limit: undefined });
      saveBlob(blob, `requests-${new Date().toISOString().slice(0, 10)}.csv`);
      toast.success('CSV report downloaded');
    } catch (err) { toast.error(err.message); }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{user.role === 'employee' ? 'My requests' : 'Requests'}</h1>
          <p className="muted">{user.role === 'employee' ? 'Everything you have submitted' : 'Requests you can see, filtered by your role'}</p>
        </div>
        <div className="head-actions">
          {user.role !== 'employee' && <button className="btn" onClick={exportCsv} disabled={invalidRange}>Export CSV</button>}
          <Link className="btn btn-primary" to="/requests/new">New request</Link>
        </div>
      </div>

      <div className="filters">
        <label className="field grow"><span className="field-label">Search</span>
          <input placeholder="Title, description or ID" value={filters.q} onChange={set('q')} /></label>
        <label className="field"><span className="field-label">Status</span>
          <select value={filters.status} onChange={set('status')}>
            <option value="">All</option><option value="open">Open</option><option value="assigned">Assigned</option>
            <option value="in_progress">In Progress</option><option value="resolved">Resolved</option><option value="closed">Closed</option>
          </select></label>
        <label className="field"><span className="field-label">Priority</span>
          <select value={filters.priority} onChange={set('priority')}>
            <option value="">All</option><option value="critical">Critical</option><option value="high">High</option>
            <option value="medium">Medium</option><option value="low">Low</option>
          </select></label>
        <label className="field"><span className="field-label">Department</span>
          <select value={filters.department_id} onChange={set('department_id')}>
            <option value="">All</option>{deps?.data.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select></label>
        <label className="field"><span className="field-label">From</span><input type="date" value={filters.from} onChange={set('from')} /></label>
        <label className="field"><span className="field-label">To</span><input type="date" value={filters.to} onChange={set('to')} /></label>
        <label className="check"><input type="checkbox" checked={filters.overdue} onChange={set('overdue')} /> Overdue only</label>
        <button className="btn btn-ghost" onClick={clear}>Clear filters</button>
        {invalidRange && <span className="field-error">“From” must be before “To”</span>}
      </div>

      {loading && !data && <Spinner label="Loading requests…" />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {data && (data.data.length === 0 ? (
        <EmptyState title="No requests found" hint="Adjust the filters or submit a new request."
          action={<Link className="btn btn-primary" to="/requests/new">New request</Link>} />
      ) : (
        <div className={`table-wrap ${loading ? 'dim' : ''}`}>
          <table className="table">
            <thead>
              <tr>
                {COLUMNS.map(([k, label]) => (
                  <th key={k} className={`col-${k}`}>
                    <button className="th-btn" onClick={() => toggleSort(k)} aria-label={`Sort by ${label}`}>
                      {label}{sort.sort === k ? (sort.order === 'asc' ? ' ▲' : ' ▼') : ''}
                    </button>
                  </th>
                ))}
                <th className="col-assignee">Assigned to</th>
              </tr>
            </thead>
            <tbody>
              {data.data.map((r) => {
                const overdue = r.is_overdue && !['resolved', 'closed'].includes(r.status);
                return (
                  <tr key={r.id} className="row-link" onClick={() => navigate(`/requests/${r.id}`)}>
                    <td className="col-request_no"><Link to={`/requests/${r.id}`} onClick={(e) => e.stopPropagation()}>{r.request_no}</Link></td>
                    <td className="col-title">{r.title}<div className="muted small">{r.department_name} · {r.category}</div></td>
                    <td className="col-priority"><PriorityBadge priority={r.priority} /></td>
                    <td className="col-status"><StatusBadge status={r.status} />{overdue && <span className="badge overdue">Overdue</span>}</td>
                    <td className="col-due_date">{fmt(r.due_date)}</td>
                    <td className="col-created_at">{fmt(r.created_at)}</td>
                    <td className="col-assignee">{r.assigned_to_name || <span className="muted">Unassigned</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <Pagination pagination={data.pagination} onPage={setPage} />
        </div>
      ))}
    </>
  );
}
