import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useToast } from '../context/ToastContext.jsx';
import { ErrorState, Field, Spinner, useAsync } from '../components/ui.jsx';

const CATEGORIES = ['Hardware', 'Software', 'Access', 'Network', 'Payroll', 'Leave', 'Facilities', 'Travel', 'Server', 'Other'];
const ALLOWED = ['.png', '.jpg', '.jpeg', '.gif', '.pdf', '.txt', '.log', '.doc', '.docx', '.xlsx', '.csv', '.zip'];
const MAX_BYTES = 5 * 1024 * 1024;

export default function NewRequest() {
  const navigate = useNavigate();
  const toast = useToast();
  const { data: deps, error, reload } = useAsync(() => api.get('/departments'), []);
  const [form, setForm] = useState({ title: '', description: '', department_id: '', category: '', priority: 'medium' });
  const [files, setFiles] = useState([]);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const pickFiles = (e) => {
    const picked = Array.from(e.target.files);
    const errs = [];
    if (picked.length > 5) errs.push('You can attach up to 5 files');
    picked.forEach((f) => {
      const ext = f.name.slice(f.name.lastIndexOf('.')).toLowerCase();
      if (!ALLOWED.includes(ext)) errs.push(`${f.name}: file type not allowed`);
      if (f.size > MAX_BYTES) errs.push(`${f.name}: larger than 5 MB`);
    });
    if (errs.length) { setErrors({ ...errors, attachments: errs.join('. ') }); e.target.value = ''; setFiles([]); return; }
    setErrors({ ...errors, attachments: undefined });
    setFiles(picked);
  };

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (form.title.trim().length < 5) errs.title = 'Title must be at least 5 characters';
    if (form.description.trim().length < 10) errs.description = 'Describe the problem in at least 10 characters';
    if (!form.department_id) errs.department_id = 'Select a department';
    if (!form.category) errs.category = 'Select a category';
    if (errors.attachments) errs.attachments = errors.attachments;
    setErrors(errs);
    if (Object.keys(errs).length) { toast.warning('Please fix the highlighted fields'); return; }

    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => fd.append(k, v));
    files.forEach((f) => fd.append('attachments', f));
    setBusy(true);
    try {
      const r = await api.postForm('/requests', fd);
      toast.success(`Request ${r.request_no} submitted`);
      window.dispatchEvent(new Event('notifications-changed'));
      navigate(`/requests/${r.id}`);
    } catch (err) {
      setErrors(err.errors || {});
      toast.error(err.message);
    } finally { setBusy(false); }
  };

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!deps) return <Spinner />;

  return (
    <>
      <div className="page-head"><div><h1>New request</h1><p className="muted">Describe what you need. It is routed to an agent in the chosen department automatically.</p></div></div>
      <form className="panel form" onSubmit={submit} noValidate>
        <Field label="Title" error={errors.title}><input value={form.title} onChange={set('title')} maxLength={200} placeholder="e.g. Laptop will not boot" /></Field>
        <div className="row3">
          <Field label="Department" error={errors.department_id}>
            <select value={form.department_id} onChange={set('department_id')}>
              <option value="">Select…</option>{deps.data.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </Field>
          <Field label="Category" error={errors.category}>
            <select value={form.category} onChange={set('category')}>
              <option value="">Select…</option>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Priority" error={errors.priority} hint="Sets the default deadline (Critical 4h, High 24h, Medium 3d, Low 5d)">
            <select value={form.priority} onChange={set('priority')}>
              <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option>
            </select>
          </Field>
        </div>
        <Field label="Description" error={errors.description}>
          <textarea rows={6} value={form.description} onChange={set('description')} maxLength={5000} placeholder="What happened, since when, and what have you tried?" />
        </Field>
        <Field label="Attachments (optional)" error={errors.attachments} hint="Up to 5 files, 5 MB each: images, PDF, text, Office files, zip">
          <input type="file" multiple onChange={pickFiles} />
        </Field>
        {files.length > 0 && <ul className="filelist">{files.map((f) => <li key={f.name}>{f.name} <span className="muted">({Math.ceil(f.size / 1024)} KB)</span></li>)}</ul>}
        <div className="form-actions">
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Submitting…' : 'Submit request'}</button>
          <button type="button" className="btn btn-ghost" onClick={() => navigate(-1)}>Cancel</button>
        </div>
      </form>
    </>
  );
}
