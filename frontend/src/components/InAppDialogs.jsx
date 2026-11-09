import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle, Info, WarningCircle, X } from '@phosphor-icons/react';

const EVENT_NAME = 'ipcs:in-app-dialog';
const requests = [];
let nextRequestId = 1;

const notifyHost = () => {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENT_NAME));
};

const enqueueDialog = (type, message) => new Promise(resolve => {
  requests.push({ id: nextRequestId++, type, message: String(message ?? ''), resolve });
  notifyHost();
});

export const inAppAlert = message => enqueueDialog('alert', message);
export const inAppConfirm = message => enqueueDialog('confirm', message);
export const inAppPrompt = message => enqueueDialog('prompt', message);

export function installInAppAlerts() {
  if (typeof window === 'undefined' || window.__ipcsInAppAlertsInstalled) return () => {};
  const originalAlert = window.alert;
  const replacement = message => { void inAppAlert(message); };
  window.alert = replacement;
  window.__ipcsInAppAlertsInstalled = true;
  return () => {
    if (window.alert === replacement) window.alert = originalAlert;
    delete window.__ipcsInAppAlertsInstalled;
  };
}

export default function InAppDialogs() {
  const [, setRevision] = useState(0);
  const inputRef = useRef(null);
  const current = requests[0];
  const finish = useCallback(value => {
    const request = requests.shift();
    request?.resolve(value);
    notifyHost();
  }, []);

  useEffect(() => {
    const refresh = () => setRevision(value => value + 1);
    window.addEventListener(EVENT_NAME, refresh);
    return () => window.removeEventListener(EVENT_NAME, refresh);
  }, []);

  useEffect(() => {
    if (!current) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    if (current.type === 'prompt') inputRef.current?.focus();
    const onKeyDown = event => {
      if (event.key === 'Escape') {
        event.preventDefault();
        finish(current.type === 'confirm' ? false : null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [current?.id, current?.type, finish]);

  if (!current || typeof document === 'undefined') return null;
  const isPrompt = current.type === 'prompt';
  const isConfirm = current.type === 'confirm';
  const Icon = isConfirm ? WarningCircle : isPrompt ? Info : CheckCircle;
  const accent = isConfirm ? '#fda4af' : isPrompt ? '#7dd3fc' : '#6ee7b7';

  return createPortal(
    <div
      role="presentation"
      onMouseDown={event => { if (event.target === event.currentTarget) finish(isConfirm ? false : null); }}
      style={{ position: 'fixed', inset: 0, zIndex: 100600, display: 'grid', placeItems: 'center', padding: 20, background: 'rgba(2,6,16,.76)', backdropFilter: 'blur(10px)' }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="in-app-dialog-title"
        style={{ width: 'min(480px, 100%)', maxHeight: 'min(88dvh, 700px)', overflowY: 'auto', padding: 25, border: '1px solid rgba(125,211,252,.23)', borderRadius: 22, background: 'linear-gradient(145deg,#172338 0%,#0d1524 72%)', color: '#e8eef7', boxShadow: '0 32px 100px rgba(0,0,0,.58)' }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 13 }}>
          <span style={{ width: 42, height: 42, flex: '0 0 42px', display: 'grid', placeItems: 'center', borderRadius: 14, background: `${accent}18`, border: `1px solid ${accent}45` }}>
            <Icon size={22} color={accent} weight="fill" />
          </span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h2 id="in-app-dialog-title" style={{ margin: '2px 0 8px', color: '#f8fafc', fontSize: 19, lineHeight: 1.3 }}>
              {isConfirm ? 'Please confirm' : isPrompt ? 'Additional information' : 'Portal notification'}
            </h2>
            <p style={{ margin: 0, color: '#c1ccdc', fontSize: 14, lineHeight: 1.65, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{current.message}</p>
          </div>
          <button type="button" aria-label="Close" onClick={() => finish(isConfirm ? false : null)} style={{ display: 'grid', placeItems: 'center', width: 32, height: 32, border: '1px solid #334155', borderRadius: 10, background: '#111b2b', color: '#a7b5c8', cursor: 'pointer' }}><X size={17} /></button>
        </div>

        {isPrompt && (
          <input
            ref={inputRef}
            type="text"
            aria-label="Reason"
            placeholder="Enter a reason"
            onKeyDown={event => { if (event.key === 'Enter') finish(event.currentTarget.value); }}
            style={{ boxSizing: 'border-box', width: '100%', marginTop: 20, padding: '12px 14px', border: '1px solid #40536b', borderRadius: 12, outline: 'none', background: 'rgba(7,13,24,.82)', color: '#f8fafc', fontSize: 14 }}
          />
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
          {(isPrompt || isConfirm) && <button type="button" onClick={() => finish(isConfirm ? false : null)} style={{ padding: '10px 16px', border: '1px solid #3a4a60', borderRadius: 11, background: 'rgba(18,28,43,.9)', color: '#d5deea', cursor: 'pointer', fontWeight: 700 }}>Cancel</button>}
          <button type="button" autoFocus={!isPrompt} onClick={() => finish(isConfirm ? true : isPrompt ? inputRef.current?.value ?? '' : true)} style={{ minWidth: 92, padding: '10px 18px', border: `1px solid ${accent}66`, borderRadius: 11, background: `linear-gradient(135deg,${accent}38,${accent}20)`, color: accent, cursor: 'pointer', fontWeight: 800 }}>{isConfirm ? 'Continue' : isPrompt ? 'Submit' : 'Got it'}</button>
        </div>
      </section>
    </div>,
    document.body
  );
}
