const BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export class ApiError extends Error {
  constructor(status, message, errors) {
    super(message);
    this.status = status;
    this.errors = errors || {};
  }
}

export const getToken = () => localStorage.getItem('sp_token');
export const setToken = (t) => (t ? localStorage.setItem('sp_token', t) : localStorage.removeItem('sp_token'));

let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

async function request(path, { method = 'GET', body, form, query, blob } = {}) {
  const url = new URL(BASE + path, window.location.origin);
  if (query) {
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
    });
  }
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }

  let res;
  try {
    res = await fetch(url, { method, headers, body: payload });
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Check that the API is running.');
  }
  if (!res.ok) {
    let data = {};
    try { data = await res.json(); } catch { /* ignore */ }
    if (res.status === 401 && token) onUnauthorized();
    throw new ApiError(res.status, data.message || `Request failed (${res.status})`, data.errors);
  }
  if (blob) return res.blob();
  return res.json();
}

export const api = {
  get: (path, query) => request(path, { query }),
  post: (path, body) => request(path, { method: 'POST', body }),
  put: (path, body) => request(path, { method: 'PUT', body }),
  patch: (path, body) => request(path, { method: 'PATCH', body }),
  del: (path) => request(path, { method: 'DELETE' }),
  postForm: (path, form) => request(path, { method: 'POST', form }),
  blob: (path, query) => request(path, { query, blob: true })
};

export function saveBlob(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
