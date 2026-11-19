import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../api/client';
import { ROLE_LABEL } from './ui.jsx';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = () => api.get('/notifications/unread-count').then((r) => alive && setUnread(r.count)).catch(() => {});
    load();
    const t = setInterval(load, 20000);
    window.addEventListener('notifications-changed', load);
    return () => { alive = false; clearInterval(t); window.removeEventListener('notifications-changed', load); };
  }, []);

  const handleLogout = async () => { await logout(); navigate('/login'); };
  const close = () => setMenuOpen(false);

  return (
    <div className="shell">
      <aside className={`side ${menuOpen ? 'open' : ''}`}>
        <div className="brand">ServiceDesk</div>
        <nav onClick={close}>
          <NavLink to="/" end>Dashboard</NavLink>
          <NavLink to="/requests">{user.role === 'employee' ? 'My requests' : 'Requests'}</NavLink>
          <NavLink to="/requests/new">New request</NavLink>
          <NavLink to="/notifications">Notifications{unread > 0 && <span className="count">{unread}</span>}</NavLink>
          {user.role === 'admin' && <NavLink to="/users">Users</NavLink>}
        </nav>
        <div className="side-user">
          <strong>{user.name}</strong>
          <span>{ROLE_LABEL[user.role]}</span>
          <button className="btn btn-ghost" onClick={handleLogout}>Log out</button>
        </div>
      </aside>
      {menuOpen && <div className="scrim" onClick={close} />}
      <div className="main">
        <header className="top">
          <button className="menu-btn" onClick={() => setMenuOpen(true)} aria-label="Open menu">Menu</button>
          <span className="top-title">Enterprise Service Management</span>
          <button className="bell" onClick={() => navigate('/notifications')} aria-label={`${unread} unread notifications`}>
            Notifications {unread > 0 && <span className="count">{unread}</span>}
          </button>
        </header>
        <main className="content"><Outlet /></main>
      </div>
    </div>
  );
}
