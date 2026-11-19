import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext.jsx';
import { BarList, ErrorState, PRIORITY_LABEL, PriorityBadge, STATUS_LABEL, Spinner, fmt, useAsync } from '../components/ui.jsx';

const Kpi = ({ label, value, to, tone }) => {
  const body = (<><span className="kpi-n">{value}</span><span className="kpi-l">{label}</span></>);
  return to ? <Link to={to} className={`kpi ${tone || ''}`}>{body}</Link> : <div className={`kpi ${tone || ''}`}>{body}</div>;
};

export default function Dashboard() {
  const { user } = useAuth();
  const [range, setRange] = useState({ from: '', to: '' });
  const [applied, setApplied] = useState({ from: '', to: '' });
  const { data, loading, error, reload } = useAsync(() => api.get('/dashboard/summary', applied), [applied]);

  const apply = (e) => { e.preventDefault(); setApplied({ ...range }); };
  const reset = () => { setRange({ from: '', to: '' }); setApplied({ from: '', to: '' }); };
  const invalidRange = range.from && range.to && range.from > range.to;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Dashboard</h1>
          <p className="muted">{user.role === 'admin' ? 'Organisation-wide request metrics' : user.role === 'agent' ? 'Requests in your department and assigned to you' : 'Your requests'}</p>
        </div>
        <Link className="btn btn-primary" to="/requests/new">New request</Link>
      </div>

      <form className="filters" onSubmit={apply}>
        <label className="field"><span className="field-label">From</span><input type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} /></label>
        <label className="field"><span className="field-label">To</span><input type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} /></label>
        <div className="filter-actions">
          <button className="btn" disabled={invalidRange}>Apply range</button>
          <button type="button" className="btn btn-ghost" onClick={reset}>Reset</button>
        </div>
        {invalidRange && <span className="field-error">“From” must be before “To”</span>}
      </form>

      {loading && !data && <Spinner label="Loading metrics…" />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {data && (() => {
        const t = data.totals;
        const active = t.open + t.assigned + t.in_progress;
        return (
          <>
            <div className="kpis">
              <Kpi label="Total requests" value={t.total} to="/requests" />
              <Kpi label="Open (not yet resolved)" value={active} to="/requests" />
              <Kpi label="Overdue" value={t.overdue} to="/requests?overdue=1" tone={t.overdue ? 'warn' : ''} />
              <Kpi label="Resolved or closed" value={t.resolved + t.closed} />
              <Kpi label="Avg. resolution time" value={t.avg_resolution_hours == null ? '—' : `${t.avg_resolution_hours} h`} />
            </div>

            {t.total === 0 ? (
              <div className="state"><p className="state-title">No requests in this range</p><p className="muted">Try a wider date range.</p></div>
            ) : (
              <div className="grid3">
                <section className="panel"><h2>By status</h2><BarList items={data.byStatus} labelFor={(l) => STATUS_LABEL[l]} colorClass={(l) => `st-${l}`} /></section>
                <section className="panel"><h2>By priority</h2><BarList items={data.byPriority} labelFor={(l) => PRIORITY_LABEL[l]} colorClass={(l) => `pr-${l}`} /></section>
                <section className="panel"><h2>By department</h2><BarList items={data.byDepartment} /></section>
              </div>
            )}

            <div className="grid2">
              <section className="panel">
                <h2>Overdue requests</h2>
                {data.overdueList.length === 0 ? <p className="muted">Nothing is overdue.</p> : (
                  <ul className="list">
                    {data.overdueList.map((r) => (
                      <li key={r.id}>
                        <Link to={`/requests/${r.id}`}><strong>{r.request_no}</strong> {r.title}</Link>
                        <span className="muted">Due {fmt(r.due_date)} · {r.assigned_to_name || 'Unassigned'}</span>
                        <PriorityBadge priority={r.priority} />
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              {user.role === 'admin' && (
                <section className="panel">
                  <h2>Agent workload</h2>
                  <table className="table compact">
                    <thead><tr><th>Agent</th><th>Department</th><th>Active</th></tr></thead>
                    <tbody>
                      {data.agentWorkload.map((a) => <tr key={a.id}><td>{a.name}</td><td>{a.department_name}</td><td>{a.active}</td></tr>)}
                    </tbody>
                  </table>
                </section>
              )}
            </div>
          </>
        );
      })()}
    </>
  );
}
