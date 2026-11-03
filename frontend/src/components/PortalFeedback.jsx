import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle, WarningCircle, X } from '@phosphor-icons/react';

const tones = {
  success: { icon: CheckCircle, color: '#6ee7b7', border: 'rgba(52,211,153,.38)', background: 'rgba(6,78,59,.96)' },
  error: { icon: WarningCircle, color: '#fecaca', border: 'rgba(248,113,113,.42)', background: 'rgba(69,10,10,.97)' },
  info: { icon: WarningCircle, color: '#bfdbfe', border: 'rgba(96,165,250,.4)', background: 'rgba(15,35,68,.97)' }
};

export function PortalToast({ toast, onDismiss }) {
  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(onDismiss, 5200);
    return () => window.clearTimeout(timer);
  }, [toast, onDismiss]);

  if (!toast || typeof document === 'undefined') return null;
  const tone = tones[toast.type] || tones.info;
  const Icon = tone.icon;
  return createPortal(
    <div role={toast.type === 'error' ? 'alert' : 'status'} aria-live="polite" style={{ position: 'fixed', zIndex: 100500, top: 20, right: 20, width: 'min(440px, calc(100vw - 32px))', display: 'flex', alignItems: 'flex-start', gap: 12, padding: '15px 16px', border: `1px solid ${tone.border}`, borderRadius: 14, background: tone.background, color: '#f8fafc', boxShadow: '0 20px 55px rgba(0,0,0,.38)', animation: 'route-content-enter .18s ease both' }}>
      <Icon size={21} color={tone.color} weight="fill" style={{ flexShrink: 0, marginTop: 1 }} />
      <div style={{ flex: 1, minWidth: 0 }}><strong style={{ display: 'block', color: tone.color, fontSize: 13, marginBottom: 3 }}>{toast.title || (toast.type === 'error' ? 'Action could not be completed' : 'Action complete')}</strong><span style={{ fontSize: 13, lineHeight: 1.5, overflowWrap: 'anywhere' }}>{toast.message}</span></div>
      <button type="button" aria-label="Dismiss notification" onClick={onDismiss} style={{ border: 0, background: 'transparent', color: '#94a3b8', cursor: 'pointer', padding: 2 }}><X size={18} /></button>
    </div>, document.body
  );
}

export function PortalConfirmDialog({ open, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', tone = 'danger', busy = false, children, onConfirm, onCancel }) {
  useEffect(() => {
    if (!open) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = event => { if (event.key === 'Escape' && !busy) onCancel?.(); };
    window.addEventListener('keydown', handleKeyDown);
    return () => { document.body.style.overflow = previous; window.removeEventListener('keydown', handleKeyDown); };
  }, [open, busy, onCancel]);

  if (!open || typeof document === 'undefined') return null;
  const confirmColor = tone === 'danger' ? '#f87171' : '#5eead4';
  return createPortal(
    <div role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !busy) onCancel?.(); }} style={{ position: 'fixed', inset: 0, zIndex: 100400, display: 'grid', placeItems: 'center', padding: 18, background: 'rgba(3,8,18,.74)', backdropFilter: 'blur(8px)' }}>
      <section role="dialog" aria-modal="true" aria-labelledby="portal-confirm-title" style={{ width: 'min(520px, 100%)', maxHeight: 'min(88dvh, 760px)', overflowY: 'auto', overscrollBehavior: 'contain', padding: 24, borderRadius: 18, border: `1px solid ${confirmColor}55`, background: 'linear-gradient(145deg, #172338, #0c1422)', color: '#e5edf8', boxShadow: '0 28px 90px rgba(0,0,0,.5)' }}>
        <h2 id="portal-confirm-title" style={{ margin: '0 0 9px', color: '#f8fafc', fontSize: 21 }}>{title}</h2>
        <p style={{ margin: '0 0 18px', color: '#bac7d8', lineHeight: 1.55, fontSize: 14 }}>{message}</p>
        {children}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 }}>
          <button type="button" disabled={busy} onClick={onCancel} style={{ padding: '10px 15px', borderRadius: 10, border: '1px solid #334155', background: '#121c2b', color: '#dbe4f0', cursor: busy ? 'wait' : 'pointer', fontWeight: 700 }}>{cancelLabel}</button>
          <button type="button" disabled={busy} onClick={onConfirm} style={{ padding: '10px 15px', borderRadius: 10, border: `1px solid ${confirmColor}80`, background: tone === 'danger' ? 'rgba(127,29,29,.35)' : 'rgba(13,148,136,.28)', color: tone === 'danger' ? '#fecaca' : '#99f6e4', cursor: busy ? 'wait' : 'pointer', fontWeight: 800 }}>{busy ? 'Working…' : confirmLabel}</button>
        </div>
      </section>
    </div>, document.body
  );
}
