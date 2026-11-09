import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { API_BASE } from '../../services/apiConfig';

const IDLE_LOOKUP = { status: 'idle', matches: [] };

const isValidEmail = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
const phoneDigits = value => String(value || '').replace(/\D/g, '');

export function useStudentLookup({ enabled, setForm, fields, transformStudent }) {
  const stableFields = fields || {};
  const [query, setQuery] = useState(null);
  const [lookup, setLookup] = useState(IDLE_LOOKUP);
  const autoFilledValues = useRef(null);

  const selectStudent = useCallback(student => {
    const selectedStudent = transformStudent ? transformStudent(student) : student;
    const nextValues = Object.fromEntries(
      ['name', 'roll', 'email', 'phone', 'course', 'branch']
        .filter(key => stableFields[key])
        .map(key => [stableFields[key], selectedStudent[key] || ''])
    );
    setForm(current => ({ ...current, ...nextValues }));
    autoFilledValues.current = nextValues;
    setLookup({ status: 'matched', student: selectedStudent, matches: [] });
  }, [setForm, stableFields, transformStudent]);

  const changeIdentifier = (type, value) => {
    const field = stableFields[type];
    const previousValues = autoFilledValues.current;
    setForm(current => {
      const next = { ...current, [field]: value };
      if (previousValues) {
        Object.entries(previousValues).forEach(([previousField, previousValue]) => {
          if (previousField !== field && String(current[previousField] || '') === String(previousValue || '')) {
            next[previousField] = '';
          }
        });
      }
      return next;
    });
    autoFilledValues.current = null;
    setQuery({ type, value });
    setLookup(value.trim() ? { status: 'typing', matches: [] } : IDLE_LOOKUP);
  };

  useEffect(() => {
    if (!enabled) {
      setQuery(null);
      setLookup(IDLE_LOOKUP);
      autoFilledValues.current = null;
      return undefined;
    }
    if (!query) return undefined;

    const value = String(query.value || '').trim();
    if ((query.type === 'email' && !isValidEmail(value)) ||
        (query.type === 'phone' && phoneDigits(value).length < 10)) {
      setLookup(value ? { status: 'typing', matches: [] } : IDLE_LOOKUP);
      return undefined;
    }

    let active = true;
    const timer = window.setTimeout(async () => {
      setLookup({ status: 'loading', matches: [] });
      try {
        const payload = query.type === 'email' ? { email: value } : { phone: value };
        const response = await axios.post(`${API_BASE}/api/tpo/students/lookup`, payload, { timeout: 15000 });
        if (!active) return;
        const matches = Array.isArray(response.data?.matches) ? response.data.matches : [];
        if (matches.length === 1) selectStudent(matches[0]);
        else if (matches.length > 1) setLookup({ status: 'multiple', matches });
        else setLookup({ status: 'not-found', matches: [] });
      } catch {
        if (active) setLookup({ status: 'unavailable', matches: [] });
      }
    }, 350);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [enabled, query, selectStudent]);

  return {
    lookup,
    selectStudent,
    onEmailChange: value => changeIdentifier('email', value),
    onPhoneChange: value => changeIdentifier('phone', value)
  };
}

export default function StudentLookupStatus({ lookup, onSelect, className = '' }) {
  if (!lookup || lookup.status === 'idle') return null;

  const statusStyles = {
    loading: { color: '#7dd3fc', border: 'rgba(56,189,248,.22)', background: 'rgba(14,165,233,.07)' },
    typing: { color: '#94a3b8', border: 'rgba(148,163,184,.16)', background: 'rgba(15,23,42,.28)' },
    matched: { color: '#6ee7b7', border: 'rgba(52,211,153,.24)', background: 'rgba(16,185,129,.07)' },
    multiple: { color: '#fcd34d', border: 'rgba(251,191,36,.24)', background: 'rgba(245,158,11,.07)' },
    'not-found': { color: '#cbd5e1', border: 'rgba(148,163,184,.2)', background: 'rgba(15,23,42,.3)' },
    unavailable: { color: '#fcd34d', border: 'rgba(251,191,36,.24)', background: 'rgba(245,158,11,.07)' }
  };
  const style = statusStyles[lookup.status] || statusStyles.typing;
  const wrapperStyle = {
    marginTop: 9,
    padding: '9px 11px',
    border: `1px solid ${style.border}`,
    borderRadius: 10,
    background: style.background,
    color: style.color,
    fontSize: '.72rem',
    lineHeight: 1.5
  };

  if (lookup.status === 'multiple') {
    return <div className={className} role="status" aria-live="polite" style={wrapperStyle}>
      <div style={{ marginBottom: 6 }}>More than one student matches. Select the right student:</div>
      <div style={{ display: 'grid', gap: 5 }}>
        {lookup.matches.map((student, index) => <button
          key={`${student.roll || student.email || student.phone}-${index}`}
          type="button"
          onClick={() => onSelect(student)}
          style={{ padding: '7px 9px', border: '1px solid rgba(148,163,184,.18)', borderRadius: 8, background: 'rgba(15,23,42,.55)', color: '#e2e8f0', textAlign: 'left', cursor: 'pointer' }}
        >
          <strong>{student.name || 'Student name unavailable'}</strong>
          <span style={{ display: 'block', color: '#94a3b8' }}>{[student.roll, student.course, student.branch].filter(Boolean).join(' · ')}</span>
        </button>)}
      </div>
    </div>;
  }

  const messages = {
    loading: 'Searching the student register…',
    typing: 'Enter a full email or at least 10 phone digits to look up a student.',
    matched: `Student details filled${lookup.student?.name ? ` for ${lookup.student.name}` : ''}. Check and edit them if needed.`,
    'not-found': 'No matching student found. You can enter the details manually.',
    unavailable: 'The student register could not be checked. You can still enter the details manually.'
  };

  return <div className={className} role="status" aria-live="polite" style={wrapperStyle}>{messages[lookup.status] || ''}</div>;
}
