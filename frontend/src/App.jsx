import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import Layout from './components/Layout.jsx';
import { Spinner } from './components/ui.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Requests from './pages/Requests.jsx';
import NewRequest from './pages/NewRequest.jsx';
import RequestDetail from './pages/RequestDetail.jsx';
import Notifications from './pages/Notifications.jsx';
import Users from './pages/Users.jsx';

// Redirects anonymous users to /login and blocks roles that are not allowed.
function Protected({ roles, children }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner label="Checking your session…" />;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) {
    return (
      <div className="state" role="alert">
        <p className="state-title">Access denied</p>
        <p className="muted">Your role does not have permission to open this page.</p>
      </div>
    );
  }
  return children;
}

function GuestOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  return user ? <Navigate to="/" replace /> : children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
      <Route path="/register" element={<GuestOnly><Register /></GuestOnly>} />
      <Route element={<Protected><Layout /></Protected>}>
        <Route index element={<Dashboard />} />
        <Route path="requests" element={<Requests />} />
        <Route path="requests/new" element={<NewRequest />} />
        <Route path="requests/:id" element={<RequestDetail />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="users" element={<Protected roles={['admin']}><Users /></Protected>} />
      </Route>
      <Route path="*" element={<div className="state"><p className="state-title">Page not found</p></div>} />
    </Routes>
  );
}
