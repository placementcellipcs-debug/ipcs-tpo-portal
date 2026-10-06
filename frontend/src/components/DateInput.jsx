import React, { useEffect, useRef, useState } from 'react';
import { CalendarBlank } from '@phosphor-icons/react';
import { formatPortalDate } from '../utils/dateFormat';

const toIsoDate = value => {
  const text = String(value || '').trim();
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const dmy = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const year = Number(iso ? iso[1] : dmy?.[3]);
  const month = Number(iso ? iso[2] : dmy?.[2]);
  const day = Number(iso ? iso[3] : dmy?.[1]);
  if (!year || !month || !day) return '';
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return '';
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

const displayDate = value => {
  const iso = toIsoDate(value) || toIsoDate(formatPortalDate(value, ''));
  if (!iso) return '';
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
};

const notifyChange = (handler, value) => handler?.({ target: { value }, currentTarget: { value } });

export default function DateInput({ value, onChange, className = '', style, required, min, max, disabled, ...props }) {
  const [draft, setDraft] = useState(() => displayDate(value));
  const textInputRef = useRef(null);
  const pickerValue = toIsoDate(value) || toIsoDate(formatPortalDate(value, '')) || '';

  useEffect(() => {
    setDraft(displayDate(value));
  }, [value]);

  const updateText = event => {
    const next = event.target.value;
    setDraft(next);
    if (!next.trim()) {
      event.target.setCustomValidity('');
      notifyChange(onChange, '');
      return;
    }
    const iso = toIsoDate(next);
    const withinRange = iso && (!min || iso >= min) && (!max || iso <= max);
    event.target.setCustomValidity(!iso ? 'Enter a valid date as DD/MM/YYYY.' : !withinRange ? 'Choose a date within the allowed range.' : '');
    if (withinRange) {
      setDraft(displayDate(iso));
      notifyChange(onChange, iso);
    }
  };

  const updateFromPicker = event => {
    const iso = event.target.value;
    textInputRef.current?.setCustomValidity('');
    setDraft(displayDate(iso));
    notifyChange(onChange, iso);
  };

  return (
    <span style={{ position: 'relative', display: 'block', width: '100%', minWidth: 0 }}>
      <input
        {...props}
        ref={textInputRef}
        className={className}
        style={{ ...style, boxSizing: 'border-box', width: '100%', paddingRight: 42 }}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="DD/MM/YYYY"
        value={draft}
        onChange={updateText}
        required={required}
        disabled={disabled}
        pattern="[0-9]{1,2}/[0-9]{1,2}/[0-9]{4}"
        aria-label={props['aria-label'] || 'Date (DD/MM/YYYY)'}
      />
      <CalendarBlank size={17} aria-hidden="true" style={{ position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
      <input
        type="date"
        tabIndex={-1}
        aria-label="Choose date"
        value={pickerValue}
        onChange={updateFromPicker}
        min={min}
        max={max}
        disabled={disabled}
        style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)', width: 34, height: 34, opacity: 0.01, cursor: disabled ? 'default' : 'pointer' }}
      />
    </span>
  );
}
