import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

try {
  const savedAccent = localStorage.getItem('ipcs-accent');
  if (['purple', 'emerald', 'amber', 'rose'].includes(savedAccent)) {
    document.body.setAttribute('data-accent', savedAccent);
  }
} catch { /* Keep the default palette when browser storage is unavailable. */ }

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
