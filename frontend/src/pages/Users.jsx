import { useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { EmptyState, ErrorState, Field, ROLE_LABEL, Spinner, useAsync, useDebounced } from '../components/ui.jsx';

const blank = { name: '', email: '', password: '', role: 'employee', department_id: '' };

export default function Users() {
  const { user: me } = useAuth();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const dq = useDebounced(q);
  const { data, loading, error, reload } = useAsync(() => api.get('/users', { q: dq, role }), [dq, role]);
  const { data: deps } = useAsync(() => api.get('/departments'), []);
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const create = async (e) => {
    e.preventDefault();
    const errs = {};
    if (form.name.trim().length < 2) errs.name = 'Enter a name';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email)) errs.email = 'Enter a valid email';
    if (form.password.length < 8 || !/[A-Za-z]/.test(form.password) || !/\d/.test(form.password)) errs.password = 'At least 8 characters, letters and numbers';
    if (form.role === 'agent' && !form.department_id) errs.department_id = 'Agents need a department';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      await api.post('/users', { ...form, department_id: form.department_id || null });
      toast.success('User created'); setForm(null); reload();
    } catch (err) { setErrors(err.errors || {}); toast.error(err.message); }
    finally { setBusy(false); }
  };

  const update = async (u, patch) => {
    try { await api.patch(`/users/${u.id}`, patch); toast.success('User updated'); reload(); }
    catch (err) { toast.error(err.errors ? Object.values(err.errors)[0] : err.message); reload(); }
  };

  return (
    <>
      <div className="page-head">
        <div><h1>Users</h1><p className="muted">Manage roles, departments and access</p></div>
        <button className="btn btn-primary" onClick={() => { setForm({ ...blank }); setErrors({}); }}>Add user</button>
      </div>

      {form && (
        <form className="panel form" onSubmit={create} noValidate>
          <h2>New user</h2>
          <div className="row3">
            <Field label="Name" error={errors.name}><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Email" error={errors.email}><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            <Field label="Temporary password" error={errors.password}><input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>
          </div>
          <div className="row3">
            <Field label="Role" error={errors.role}>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="employee">Employee</option><option value="agent">Service Agent</option><option value="admin">Admin</option>
              </select>
            </Field>
            <Field label="Department" error={errors.department_id}>
              <select value={form.department_id} onChange={(e) => setForm({ ...form, department_id: e.target.value })}>
                <option value="">None</option>{deps?.data.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </Field>
          </div>
          <div className="form-actions"><button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Create user'}</button><button type="button" className="btn btn-ghost" onClick={() => setForm(null)}>Cancel</button></div>
        </form>
      )}

      <div className="filters">
        <label className="field grow"><span className="field-label">Search</span><input placeholder="Name or email" value={q} onChange={(e) => setQ(e.target.value)} /></label>
        <label className="field"><span className="field-label">Role</span>
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="">All</option><option value="admin">Admin</option><option value="agent">Service Agent</option><option value="employee">Employee</option>
          </select></label>
      </div>

      {loading && !data && <Spinner />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {data && (data.data.length === 0 ? <EmptyState title="No users match" /> : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Name</th><th>Role</th><th>Department</th><th>Status</th></tr></thead>
            <tbody>
              {data.data.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}<div className="muted small">{u.email}</div></td>
                  <td>
                    <select value={u.role} disabled={u.id === me.id} aria-label={`Role for ${u.name}`} onChange={(e) => update(u, { role: e.target.value })}>
                      {Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </td>
                  <td>
                    <select value={u.department_id || ''} aria-label={`Department for ${u.name}`} onChange={(e) => update(u, { department_id: e.target.value || null })}>
                      <option value="">None</option>{deps?.data.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </td>
                  <td>
                    <button className="btn btn-sm" disabled={u.id === me.id} onClick={() => update(u, { is_active: !u.is_active })}>{u.is_active ? 'Disable' : 'Enable'}</button>
                    <span className={`badge ${u.is_active ? 'st-resolved' : 'st-closed'}`}>{u.is_active ? 'Active' : 'Disabled'}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </>
  );
}
