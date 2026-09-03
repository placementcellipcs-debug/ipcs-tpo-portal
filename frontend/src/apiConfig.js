// Automatically chooses the backend URL:
// 1. If VITE_API_BASE is set (e.g. in Vercel settings), use it.
// 2. If running locally or on production without env override, fallback to production or staging.

export const API_BASE = 
  import.meta.env.VITE_API_BASE || 
  (window.location.hostname.includes('vercel.app') 
    ? 'https://ipcs-tpo-portal-u0l6.onrender.com'           // Staging Backend (Render)
    : 'https://api-talenzo.ipcsglobal.info');              // Production Backend