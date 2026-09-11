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