import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { Field } from '../components/ui.jsx';

export default function Login() {
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email)) errs.email = 'Enter a valid email address';
    if (!form.password) errs.password = 'Enter your password';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      const u = await login(form.email.trim(), form.password);
      toast.success(`Welcome back, ${u.name.split(' ')[0]}`);
      navigate('/');
    } catch (err) {
      setErrors(err.errors || {});
      toast.error(err.message);
    } finally { setBusy(false); }
  };

  return (
    <div className="auth">
      <form className="auth-card" onSubmit={submit} noValidate>
        <h1>Sign in to ServiceDesk</h1>
        <p className="muted">Submit and track internal IT, HR, admin and infrastructure requests.</p>
        <Field label="Work email" error={errors.email}>
          <input type="email" autoComplete="username" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        <Field label="Password" error={errors.password}>
          <input type="password" autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </Field>
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        <p className="muted">New employee? <Link to="/register">Create an account</Link></p>
        <details className="demo">
          <summary>Demo accounts (password: Password@123)</summary>
          <ul>
            <li>admin@company.com — Admin</li>
            <li>agent.it@company.com — Service Agent (IT Support)</li>
            <li>employee@company.com — Employee</li>
          </ul>
        </details>
      </form>
    </div>
  );
}
