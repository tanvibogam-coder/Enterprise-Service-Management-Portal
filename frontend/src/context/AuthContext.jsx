import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, getToken, setToken, setUnauthorizedHandler } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!getToken());

  const clear = useCallback(() => { setToken(null); setUser(null); }, []);

  useEffect(() => {
    setUnauthorizedHandler(clear);
    if (!getToken()) return;
    api.get('/auth/me').then((r) => setUser(r.user)).catch(clear).finally(() => setLoading(false));
  }, [clear]);

  const login = async (email, password) => {
    const r = await api.post('/auth/login', { email, password });
    setToken(r.token); setUser(r.user);
    return r.user;
  };
  const register = async (payload) => {
    const r = await api.post('/auth/register', payload);
    setToken(r.token); setUser(r.user);
    return r.user;
  };
  const logout = async () => {
    try { await api.post('/auth/logout'); } catch { /* token may already be invalid */ }
    clear();
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
