import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import axios from 'axios';
import { API_BASE } from './apiConfig';

/** Captures portal UI activity without recording entered values or screen text. */
export default function PortalAuditCapture() {
  const location = useLocation();

  useEffect(() => {
    let bufferedEvents = [];
    let flushTimer = null;
    let isFlushing = false;
    const inputTimers = new WeakMap();

    const flushEvents = async () => {
      if (isFlushing || !bufferedEvents.length) return;
      isFlushing = true;
      const batch = bufferedEvents.splice(0, 80);
      try {
        await axios.post(`${API_BASE}/api/audit/interactions`, { events: batch }, { timeout: 7000 });
      } catch (error) {
        bufferedEvents = [...batch, ...bufferedEvents];
        console.warn('Portal interaction log could not be sent; it will be retried.', error.message);
      } finally {
        isFlushing = false;
        if (bufferedEvents.length) scheduleFlush();
      }
    };
    const scheduleFlush = () => {
      if (flushTimer) clearTimeout(flushTimer);
      flushTimer = setTimeout(() => {
        flushTimer = null;
        void flushEvents();
      }, 1500);
    };
    const controlFor = element => {
      const tag = String(element?.tagName || '').toLowerCase();
      if (tag === 'a') return 'link';
      if (tag === 'button' || element?.getAttribute?.('role') === 'button') return 'button';
      if (tag === 'select') return 'select';
      if (tag === 'textarea') return 'textarea';
      if (tag === 'input') return 'input';
      if (tag === 'form') return 'form';
      if (element?.isContentEditable) return 'contenteditable';
      if (['tab', 'menuitem'].includes(element?.getAttribute?.('role'))) return 'navigation';
      return 'document';
    };
    const fieldFor = element => {
      const name = String(element?.getAttribute?.('name') || element?.getAttribute?.('id') || '').trim();
      return /^[a-z0-9_.:-]{1,80}$/i.test(name) ? name : '';
    };
    const controlIdFor = element => {
      const id = String(element?.getAttribute?.('data-audit-id') || element?.getAttribute?.('data-testid') || '').trim();
      return /^[a-z][a-z0-9_.:-]{0,79}$/i.test(id) ? id : '';
    };
    const record = (type, element, control) => {
      bufferedEvents.push({ timestamp: new Date().toISOString(), type, page: location.pathname, control: control || controlFor(element), field: fieldFor(element), controlId: controlIdFor(element) });
      if (bufferedEvents.length >= 12) void flushEvents();
      else scheduleFlush();
    };
    const interactiveSelector = 'button,a,input,select,textarea,[role="button"],[role="tab"],[role="menuitem"]';
    const onClick = event => {
      const element = event.target?.closest?.(interactiveSelector);
      record('click', element || event.target);
    };
    const onTouch = event => {
      const element = event.target?.closest?.(interactiveSelector);
      record('touch', element || event.target);
    };
    const onInput = event => {
      const element = event.target;
      if (!element?.matches?.('input,select,textarea,[contenteditable="true"]')) return;
      const previous = inputTimers.get(element);
      if (previous) clearTimeout(previous);
      inputTimers.set(element, setTimeout(() => {
        inputTimers.delete(element);
        record('input', element);
      }, 500));
    };
    const onChange = event => {
      const element = event.target;
      if (element?.matches?.('input,select,textarea')) record('change', element);
    };
    const onSubmit = event => record('submit', event.target?.closest?.('form') || event.target, 'form');
    const onKeyboard = event => {
      if (!['Enter', 'Escape', ' '].includes(event.key)) return;
      const element = event.target?.closest?.(interactiveSelector);
      if (element) record('keyboard', element);
    };
    let scrollTimer = null;
    const onScroll = () => {
      if (scrollTimer) clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => {
        scrollTimer = null;
        record('scroll', document.body, 'document');
      }, 1200);
    };

    record('navigate', document.body, 'navigation');
    document.addEventListener('click', onClick, true);
    document.addEventListener('touchstart', onTouch, { capture: true, passive: true });
    document.addEventListener('input', onInput, true);
    document.addEventListener('change', onChange, true);
    document.addEventListener('submit', onSubmit, true);
    document.addEventListener('keydown', onKeyboard, true);
    window.addEventListener('scroll', onScroll, { capture: true, passive: true });
    const flushOnHide = () => { if (document.visibilityState === 'hidden') void flushEvents(); };
    document.addEventListener('visibilitychange', flushOnHide);

    return () => {
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('touchstart', onTouch, true);
      document.removeEventListener('input', onInput, true);
      document.removeEventListener('change', onChange, true);
      document.removeEventListener('submit', onSubmit, true);
      document.removeEventListener('keydown', onKeyboard, true);
      window.removeEventListener('scroll', onScroll, true);
      document.removeEventListener('visibilitychange', flushOnHide);
      if (flushTimer) clearTimeout(flushTimer);
      if (scrollTimer) clearTimeout(scrollTimer);
      void flushEvents();
    };
  }, [location.pathname]);

  return null;
}
