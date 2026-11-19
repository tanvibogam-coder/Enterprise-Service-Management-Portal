import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { Field } from '../components/ui.jsx';

export default function Register() {
  const { register } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (form.name.trim().length < 2) errs.name = 'Enter your full name';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email)) errs.email = 'Enter a valid email address';
    if (form.password.length < 8 || !/[A-Za-z]/.test(form.password) || !/\d/.test(form.password)) errs.password = 'Use at least 8 characters with letters and numbers';
    if (form.confirm !== form.password) errs.confirm = 'Passwords do not match';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      await register({ name: form.name.trim(), email: form.email.trim(), password: form.password });
      toast.success('Account created');
      navigate('/');
    } catch (err) {
      setErrors(err.errors || {});
      toast.error(err.message);
    } finally { setBusy(false); }
  };

  return (
    <div className="auth">
      <form className="auth-card" onSubmit={submit} noValidate>
        <h1>Create your account</h1>
        <p className="muted">Accounts are created as Employee. An administrator can change roles later.</p>
        <Field label="Full name" error={errors.name}><input value={form.name} onChange={set('name')} autoComplete="name" /></Field>
        <Field label="Work email" error={errors.email}><input type="email" value={form.email} onChange={set('email')} autoComplete="username" /></Field>
        <Field label="Password" error={errors.password} hint="At least 8 characters, with letters and numbers">
          <input type="password" value={form.password} onChange={set('password')} autoComplete="new-password" />
        </Field>
        <Field label="Confirm password" error={errors.confirm}><input type="password" value={form.confirm} onChange={set('confirm')} autoComplete="new-password" /></Field>
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Creating…' : 'Create account'}</button>
        <p className="muted">Already registered? <Link to="/login">Sign in</Link></p>
      </form>
    </div>
  );
}
