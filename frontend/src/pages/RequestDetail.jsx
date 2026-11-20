import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, saveBlob } from '../api/client';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { ErrorState, Field, PriorityBadge, STATUS_LABEL, Spinner, StatusBadge, fmt, useAsync } from '../components/ui.jsx';

const ACTION_LABEL = {
  created: 'Request created', assigned: 'Assigned', status_changed: 'Status changed', updated: 'Updated',
  commented: 'Comment added', attachment_added: 'Attachment added', overdue_flagged: 'Flagged overdue'
};
const STATUS_ACTION = { assigned: 'Move back to Assigned', in_progress: 'Start work', resolved: 'Mark resolved', closed: 'Close request' };

const toLocalInput = (v) => {
  if (!v) return '';
  const d = new Date(v); d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

export default function RequestDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const { data, loading, error, reload } = useAsync(() => api.get(`/requests/${id}`), [id]);
  const [comment, setComment] = useState('');
  const [note, setNote] = useState('');
  const [agents, setAgents] = useState([]);
  const [agentId, setAgentId] = useState('');
  const [assignNote, setAssignNote] = useState('');
  const [meta, setMeta] = useState({ priority: '', due_date: '' });
  const [edit, setEdit] = useState(null);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const r = data?.request;
  const p = data?.permissions;

  useEffect(() => {
    if (!r) return;
    setMeta({ priority: r.priority, due_date: toLocalInput(r.due_date) });
    if (user.role !== 'employee' && p?.can_assign) {
      api.get('/users/agents', { department_id: r.department_id }).then((a) => {
        setAgents(user.role === 'agent' ? a.data.filter((x) => x.id === user.id) : a.data);
      }).catch(() => {});
    }
  }, [r, p?.can_assign, user.role, user.id]);

  const run = async (fn, okMsg) => {
    setBusy(true); setErrors({});
    try {
      const res = await fn();
      toast.success(okMsg || res?.message || 'Saved');
      window.dispatchEvent(new Event('notifications-changed'));
      await reload();
      return true;
    } catch (err) {
      setErrors(err.errors || {});
      toast.error(err.message);
      return false;
    } finally { setBusy(false); }
  };

  if (loading && !data) return <Spinner label="Loading request…" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return null;

  const active = !['resolved', 'closed'].includes(r.status);
  const overdue = !!r.is_overdue && active;
  const canMeta = user.role === 'admin' || (user.role === 'agent' && p.can_edit_priority);

  const changeStatus = (to) => run(() => api.patch(`/requests/${r.id}/status`, { status: to, note }), `Status changed to ${STATUS_LABEL[to]}`).then((ok) => ok && setNote(''));
  const assign = () => {
    if (!agentId) { setErrors({ assigned_to: 'Select an agent' }); return; }
    run(() => api.patch(`/requests/${r.id}/assign`, { assigned_to: Number(agentId), note: assignNote })).then((ok) => ok && (setAgentId(''), setAssignNote('')));
  };
  const saveMeta = () => {
    const body = {};
    if (meta.priority !== r.priority) body.priority = meta.priority;
    if (meta.due_date && new Date(meta.due_date).getTime() !== new Date(r.due_date).getTime()) body.due_date = new Date(meta.due_date).toISOString();
    if (!Object.keys(body).length) { toast.info('Nothing to update'); return; }
    run(() => api.put(`/requests/${r.id}`, body), 'Priority / deadline updated');
  };
  const addComment = (e) => {
    e.preventDefault();
    if (!comment.trim()) { setErrors({ comment: 'Write a comment first' }); return; }
    run(() => api.post(`/requests/${r.id}/comments`, { comment }), 'Comment added').then((ok) => ok && setComment(''));
  };
  const saveEdit = (e) => {
    e.preventDefault();
    const errs = {};
    if (edit.title.trim().length < 5) errs.title = 'Title must be at least 5 characters';
    if (edit.description.trim().length < 10) errs.description = 'Description must be at least 10 characters';
    if (!edit.category.trim()) errs.category = 'Category is required';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    run(() => api.put(`/requests/${r.id}`, edit), 'Request updated').then((ok) => ok && setEdit(null));
  };
  const remove = async () => {
    if (!window.confirm(`Delete ${r.request_no}? This cannot be undone.`)) return;
    if (await run(() => api.del(`/requests/${r.id}`), 'Request deleted')) navigate('/requests');
  };
  const download = async (a) => {
    try { saveBlob(await api.blob(`/requests/${r.id}/attachments/${a.id}`), a.original_name); }
    catch (err) { toast.error(err.message); }
  };
  const upload = (e) => {
    const picked = Array.from(e.target.files);
    if (!picked.length) return;
    const fd = new FormData(); picked.forEach((f) => fd.append('attachments', f));
    run(() => api.postForm(`/requests/${r.id}/attachments`, fd), 'Attachment uploaded');
    e.target.value = '';
  };

  return (
    <>
      <p className="crumbs"><Link to="/requests">← Requests</Link></p>
      <div className="page-head">
        <div>
          <h1><span className="muted">{r.request_no}</span> {r.title}</h1>
          <div className="badges"><StatusBadge status={r.status} /><PriorityBadge priority={r.priority} />{overdue && <span className="badge overdue">Overdue</span>}</div>
        </div>
        <div className="head-actions">
          {p.can_edit_basic && <button className="btn" onClick={() => setEdit({ title: r.title, description: r.description, category: r.category })}>Edit</button>}
          {p.can_delete && <button className="btn btn-danger" onClick={remove} disabled={busy}>Delete</button>}
        </div>
      </div>

      {overdue && <div className="banner warn" role="alert">This request passed its deadline ({fmt(r.due_date)}).</div>}

      <div className="detail">
        <div className="detail-main">
          <section className="panel">
            {edit ? (
              <form className="form" onSubmit={saveEdit} noValidate>
                <Field label="Title" error={errors.title}><input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></Field>
                <Field label="Category" error={errors.category}><input value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value })} /></Field>
                <Field label="Description" error={errors.description}><textarea rows={5} value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></Field>
                <div className="form-actions"><button className="btn btn-primary" disabled={busy}>Save changes</button><button type="button" className="btn btn-ghost" onClick={() => { setEdit(null); setErrors({}); }}>Cancel</button></div>
              </form>
            ) : (<><h2>Description</h2><p className="prewrap">{r.description}</p></>)}
          </section>

          <section className="panel">
            <h2>Attachments</h2>
            {data.attachments.length === 0 ? <p className="muted">No files attached.</p> : (
              <ul className="list">
                {data.attachments.map((a) => (
                  <li key={a.id}><button className="link" onClick={() => download(a)}>{a.original_name}</button>
                    <span className="muted small">{Math.ceil(a.size_bytes / 1024)} KB · {a.uploaded_by_name} · {fmt(a.created_at)}</span></li>
                ))}
              </ul>
            )}
            {r.status !== 'closed' && <label className="btn btn-sm upload">Add files<input type="file" multiple hidden onChange={upload} /></label>}
            {errors.attachments && <span className="field-error">{errors.attachments}</span>}
          </section>

          <section className="panel">
            <h2>Discussion</h2>
            {data.comments.length === 0 ? <p className="muted">No comments yet.</p> : (
              <ul className="comments">
                {data.comments.map((c) => (
                  <li key={c.id}><div><strong>{c.user_name}</strong> <span className="muted small">{c.user_role} · {fmt(c.created_at)}</span></div><p className="prewrap">{c.comment}</p></li>
                ))}
              </ul>
            )}
            <form onSubmit={addComment} className="form" noValidate>
              <Field label="Add a comment" error={errors.comment}><textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} maxLength={2000} /></Field>
              <div className="form-actions"><button className="btn" disabled={busy}>Post comment</button></div>
            </form>
          </section>
        </div>

        <aside className="detail-side">
          <section className="panel">
            <h2>Details</h2>
            <dl className="meta">
              <dt>Department</dt><dd>{r.department_name}</dd>
              <dt>Category</dt><dd>{r.category}</dd>
              <dt>Requested by</dt><dd>{r.created_by_name}</dd>
              <dt>Assigned to</dt><dd>{r.assigned_to_name || 'Unassigned'}</dd>
              <dt>Created</dt><dd>{fmt(r.created_at)}</dd>
              <dt>Due</dt><dd>{fmt(r.due_date)}</dd>
              {r.resolved_at && <><dt>Resolved</dt><dd>{fmt(r.resolved_at)}</dd></>}
            </dl>
          </section>

          {p.allowed_statuses.length > 0 && (
            <section className="panel">
              <h2>Update status</h2>
              <Field label="Note (optional)"><input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Added to the discussion" /></Field>
              <div className="stack">
                {p.allowed_statuses.map((s) => (
                  <button key={s} className={`btn ${s === 'resolved' || s === 'closed' ? 'btn-primary' : ''}`} disabled={busy} onClick={() => changeStatus(s)}>{STATUS_ACTION[s] || STATUS_LABEL[s]}</button>
                ))}
              </div>
              {user.role === 'employee' && r.status === 'resolved' && <p className="muted small">Not fixed? Choose “Start work” to reopen it.</p>}
            </section>
          )}

          {p.can_assign && (
            <section className="panel">
              <h2>{r.assigned_to_name ? 'Reassign' : 'Assign'}</h2>
              <Field label="Agent" error={errors.assigned_to}>
                <select value={agentId} onChange={(e) => setAgentId(e.target.value)}>
                  <option value="">Select agent…</option>
                  {agents.filter((a) => a.id !== r.assigned_to).map((a) => <option key={a.id} value={a.id}>{a.name} ({a.workload} active)</option>)}
                </select>
              </Field>
              <Field label="Note (optional)"><input value={assignNote} onChange={(e) => setAssignNote(e.target.value)} maxLength={255} /></Field>
              <button className="btn btn-primary" disabled={busy} onClick={assign}>{user.role === 'agent' ? 'Take this request' : 'Assign'}</button>
            </section>
          )}

          {canMeta && (
            <section className="panel">
              <h2>Priority and deadline</h2>
              <Field label="Priority" error={errors.priority}>
                <select value={meta.priority} onChange={(e) => setMeta({ ...meta, priority: e.target.value })}>
                  <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option>
                </select>
              </Field>
              <Field label="Deadline" error={errors.due_date}><input type="datetime-local" value={meta.due_date} onChange={(e) => setMeta({ ...meta, due_date: e.target.value })} /></Field>
              <button className="btn" disabled={busy} onClick={saveMeta}>Save</button>
            </section>
          )}

          <section className="panel">
            <h2>Activity timeline</h2>
            <ol className="timeline">
              {data.timeline.map((t) => (
                <li key={t.id}>
                  <strong>{ACTION_LABEL[t.action] || t.action}</strong>
                  {t.action === 'status_changed' && <span> {STATUS_LABEL[t.old_value]} → {STATUS_LABEL[t.new_value]}</span>}
                  {t.action === 'assigned' && <span> {t.old_value ? `${t.old_value} → ` : 'to '}{t.new_value}</span>}
                  {t.action === 'updated' && <span> {t.details?.replace('Changed ', '')}: {t.old_value ?? '—'} → {t.new_value ?? '—'}</span>}
                  {t.details && !['updated', 'created'].includes(t.action) && <div className="muted small">{t.details}</div>}
                  <div className="muted small">{t.user_name || 'System'} · {fmt(t.created_at)}</div>
                </li>
              ))}
            </ol>
          </section>

          {data.assignments.length > 0 && (
            <section className="panel">
              <h2>Assignment history</h2>
              <ul className="list">
                {data.assignments.map((a) => (
                  <li key={a.id}><span>{a.assigned_to_name}</span><span className="muted small">by {a.assigned_by_name || 'System'} · {fmt(a.created_at)}{a.note ? ` · ${a.note}` : ''}</span></li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </>
  );
}
