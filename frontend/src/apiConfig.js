// Automatically chooses the backend URL:
// 1. If VITE_API_BASE is set, use it.
// 2. If running locally (localhost) or on Vercel, point to Render test server.
// 3. Otherwise, point to the live Production server.

export const API_BASE =
  import.meta.env.VITE_API_BASE ||
  (window.location.hostname.includes('vercel.app') || window.location.hostname.includes('localhost')
    ? 'https://ipcs-tpo-portal-u0l6.onrender.com'   // Staging Backend (Render & Local Testing)
    : 'https://api-talenzo.ipcsglobal.info');       // Live Production Backend