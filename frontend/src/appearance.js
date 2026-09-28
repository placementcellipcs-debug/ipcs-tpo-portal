export const APPEARANCE_KEY = 'ipcs-appearance';

export const ACCENT_OPTIONS = [
  { id: 'violet', label: 'Violet', color: '#8b5cf6' },
  { id: 'blue', label: 'Blue', color: '#2563eb' },
  { id: 'teal', label: 'Teal', color: '#0f9f9a' },
  { id: 'green', label: 'Green', color: '#16a34a' },
  { id: 'rose', label: 'Rose', color: '#e11d48' },
  { id: 'amber', label: 'Amber', color: '#d97706' }
];

const DEFAULT_APPEARANCE = { theme: 'dark', accent: 'violet' };

export function readAppearance() {
  try {
    const saved = JSON.parse(localStorage.getItem(APPEARANCE_KEY) || '{}');
    return {
      theme: saved.theme === 'light' ? 'light' : 'dark',
      accent: ACCENT_OPTIONS.some(option => option.id === saved.accent) ? saved.accent : DEFAULT_APPEARANCE.accent
    };
  } catch {
    return DEFAULT_APPEARANCE;
  }
}

export function saveAppearance(appearance) {
  try { localStorage.setItem(APPEARANCE_KEY, JSON.stringify(appearance)); } catch { /* Keep the selected appearance active for this page. */ }
}

export function applyAppearance(appearance = readAppearance()) {
  if (!document.body) return;
  document.body.dataset.theme = appearance.theme === 'light' ? 'light' : 'dark';
  document.body.dataset.accent = ACCENT_OPTIONS.some(option => option.id === appearance.accent) ? appearance.accent : DEFAULT_APPEARANCE.accent;
}
