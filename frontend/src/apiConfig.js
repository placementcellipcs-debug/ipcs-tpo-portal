import axios from 'axios';

// Automatically selects backend URL:
// 1. If VITE_API_BASE environment variable is set, use it.
// 2. If running locally (localhost), use localhost:5000 or Render test server.
// 3. In Production, point directly to your live Render API domain.

const isLocal = typeof window !== 'undefined' && window.location.hostname.includes('localhost');

export const API_BASE = 
  import.meta.env.VITE_API_BASE || 
  (isLocal 
    ? 'http://localhost:5000' 
    : 'https://ipcs-tpo-portal-u0l6.onrender.com');

if (typeof window !== 'undefined' && !window.__ipcsSessionInterceptorInstalled) {
  axios.interceptors.request.use((config) => {
    try {
      const apiOrigin = new URL(API_BASE, window.location.origin).origin;
      const requestOrigin = new URL(config.url || '', config.baseURL || window.location.origin).origin;
      if (requestOrigin !== apiOrigin) return config;

      const account = JSON.parse(window.localStorage.getItem('tpoData') || 'null');
      if (account?.email && account?.sessionToken) {
        config.headers = config.headers || {};
        config.headers['x-ipcs-email'] = account.email;
        config.headers['x-ipcs-session-token'] = account.sessionToken;
      }
    } catch {
      // Malformed local session data is handled by the login and layout screens.
    }
    return config;
  });
  window.__ipcsSessionInterceptorInstalled = true;
}
