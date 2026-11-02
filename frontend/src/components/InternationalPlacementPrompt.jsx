import { createPortal } from 'react-dom';
import { GlobeHemisphereWest, MapPinLine, X } from '@phosphor-icons/react';

export default function InternationalPlacementPrompt({ open, studentName, busy = false, onChoose, onCancel }) {
  if (!open || typeof document === 'undefined') return null;
  return createPortal(
    <div
      role="presentation"
      onMouseDown={event => { if (event.target === event.currentTarget && !busy) onCancel?.(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 100050, display: 'grid', placeItems: 'center', padding: 18, background: 'rgba(2,6,18,.78)', backdropFilter: 'blur(12px)' }}
    >
      <section role="dialog" aria-modal="true" aria-labelledby="intl-placement-title" style={{ width: 'min(490px, 100%)', overflow: 'hidden', border: '1px solid rgba(103,232,249,.24)', borderRadius: 22, background: 'radial-gradient(circle at 100% 0%,rgba(59,130,246,.17),transparent 40%),linear-gradient(145deg,#131e32,#0b1220)', boxShadow: '0 30px 90px rgba(0,0,0,.55)', color: '#eaf4ff' }}>
        <header style={{ display: 'flex', alignItems: 'flex-start', gap: 13, padding: '22px 22px 16px', borderBottom: '1px solid rgba(148,163,184,.13)' }}>
          <span style={{ width: 42, height: 42, flex: '0 0 42px', display: 'grid', placeItems: 'center', border: '1px solid rgba(56,189,248,.28)', borderRadius: 14, background: 'linear-gradient(145deg,rgba(14,165,233,.2),rgba(99,102,241,.17))', color: '#7dd3fc' }}><GlobeHemisphereWest size={23} weight="duotone" /></span>
          <div style={{ minWidth: 0, flex: 1 }}><span style={{ color: '#7dd3fc', fontSize: '.62rem', fontWeight: 850, letterSpacing: '.15em' }}>PLACEMENT CLASSIFICATION</span><h2 id="intl-placement-title" style={{ margin: '5px 0 0', fontSize: '1.18rem', letterSpacing: '-.035em' }}>Where is this placement?</h2><p style={{ margin: '6px 0 0', color: '#96a9c0', fontSize: '.78rem', lineHeight: 1.55 }}>{studentName ? `Choose the destination for ${studentName}.` : 'Choose the destination for this placed student.'} This is used for international placement totals and reports.</p></div>
          <button type="button" onClick={onCancel} disabled={busy} aria-label="Cancel" style={{ width: 32, height: 32, display: 'grid', placeItems: 'center', border: '1px solid rgba(148,163,184,.16)', borderRadius: 10, background: 'rgba(15,23,42,.75)', color: '#9fb0c4', cursor: 'pointer' }}><X size={17} /></button>
        </header>
        <div style={{ display: 'grid', gap: 9, padding: 18 }}>
          <button type="button" disabled={busy} onClick={() => onChoose?.(false)} style={{ display: 'flex', alignItems: 'center', gap: 13, padding: 14, border: '1px solid rgba(52,211,153,.2)', borderRadius: 15, background: 'linear-gradient(100deg,rgba(16,185,129,.1),rgba(15,23,42,.56))', color: '#e7fff5', textAlign: 'left', cursor: 'pointer' }}>
            <span style={{ width: 36, height: 36, display: 'grid', placeItems: 'center', borderRadius: 11, background: 'rgba(16,185,129,.13)', color: '#6ee7b7' }}><MapPinLine size={20} /></span><span style={{ display: 'grid', gap: 3 }}><strong style={{ fontSize: '.82rem' }}>Within India</strong><small style={{ color: '#8ba49e', fontSize: '.67rem' }}>Domestic placement</small></span>
          </button>
          <button type="button" disabled={busy} onClick={() => onChoose?.(true)} style={{ display: 'flex', alignItems: 'center', gap: 13, padding: 14, border: '1px solid rgba(56,189,248,.27)', borderRadius: 15, background: 'linear-gradient(100deg,rgba(14,165,233,.14),rgba(79,70,229,.1))', color: '#eff8ff', textAlign: 'left', cursor: 'pointer' }}>
            <span style={{ width: 36, height: 36, display: 'grid', placeItems: 'center', borderRadius: 11, background: 'rgba(14,165,233,.16)', color: '#7dd3fc' }}><GlobeHemisphereWest size={20} weight="duotone" /></span><span style={{ display: 'grid', gap: 3 }}><strong style={{ fontSize: '.82rem' }}>Outside India</strong><small style={{ color: '#91a9c1', fontSize: '.67rem' }}>Count as an international placement</small></span>
          </button>
        </div>
        <footer style={{ padding: '0 22px 18px', color: '#6f829a', fontSize: '.64rem', lineHeight: 1.5 }}>Your selection is saved with the placement record and synchronized to the placement sheets.</footer>
      </section>
    </div>,
    document.body
  );
}
