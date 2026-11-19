import { useCallback, useEffect, useRef, useState } from 'react';

export const STATUS_LABEL = { open: 'Open', assigned: 'Assigned', in_progress: 'In Progress', resolved: 'Resolved', closed: 'Closed' };
export const PRIORITY_LABEL = { low: 'Low', medium: 'Medium', high: 'High', critical: 'Critical' };
export const ROLE_LABEL = { admin: 'Admin', agent: 'Service Agent', employee: 'Employee' };

export const StatusBadge = ({ status }) => <span className={`badge st-${status}`}>{STATUS_LABEL[status] || status}</span>;
export const PriorityBadge = ({ priority }) => <span className={`badge pr-${priority}`}>{PRIORITY_LABEL[priority] || priority}</span>;

export const fmt = (v) => (v ? new Date(v).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '—');

export function Spinner({ label = 'Loading…' }) {
  return <div className="state"><div className="spinner" aria-hidden="true" /><p>{label}</p></div>;
}

export function EmptyState({ title, hint, action }) {
  return (
    <div className="state">
      <p className="state-title">{title}</p>
      {hint && <p className="muted">{hint}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="state state-error" role="alert">
      <p className="state-title">Could not load this page</p>
      <p className="muted">{message}</p>
      {onRetry && <button className="btn" onClick={onRetry}>Try again</button>}
    </div>
  );
}

export function Field({ label, error, children, hint }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && !error && <span className="field-hint">{hint}</span>}
      {error && <span className="field-error">{error}</span>}
    </label>
  );
}

export function Pagination({ pagination, onPage }) {
  if (!pagination || pagination.totalPages <= 1) return null;
  const { page, totalPages, total } = pagination;
  return (
    <div className="pager">
      <span className="muted">{total} results</span>
      <div className="pager-btns">
        <button className="btn btn-sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button>
        <span>Page {page} of {totalPages}</span>
        <button className="btn btn-sm" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>Next</button>
      </div>
    </div>
  );
}

// Loads data and exposes loading / error / reload.
export function useAsync(fn, deps) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const seq = useRef(0);
  const run = useCallback(() => {
    const id = ++seq.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    fn().then(
      (data) => { if (id === seq.current) setState({ data, loading: false, error: null }); },
      (error) => { if (id === seq.current) setState({ data: null, loading: false, error: error.message }); }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => { run(); }, [run]);
  return { ...state, reload: run };
}

export function useDebounced(value, delay = 350) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), delay); return () => clearTimeout(t); }, [value, delay]);
  return v;
}

export function BarList({ items, labelFor = (x) => x, colorClass = () => '' }) {
  const max = Math.max(1, ...items.map((i) => i.count));
  if (!items.length) return <p className="muted">No data for this range.</p>;
  return (
    <ul className="bars">
      {items.map((i) => (
        <li key={i.label}>
          <span className="bar-label">{labelFor(i.label)}</span>
          <span className="bar-track"><span className={`bar-fill ${colorClass(i.label)}`} style={{ width: `${(i.count / max) * 100}%` }} /></span>
          <span className="bar-n">{i.count}</span>
        </li>
      ))}
    </ul>
  );
}
