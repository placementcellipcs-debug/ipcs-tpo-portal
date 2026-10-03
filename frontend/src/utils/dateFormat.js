const INDIA_TIME_ZONE = 'Asia/Kolkata';

const validLocalDate = (year, month, day, hour = 0, minute = 0, second = 0) => {
  const date = new Date(year, month - 1, day, hour, minute, second);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? date
    : null;
};

const parseParts = (year, first, second, { usWhenSecondExceedsTwelve = true, hour = 0, minute = 0, secondOfMinute = 0 } = {}) => {
  const a = Number(first);
  const b = Number(second);
  // Historical sheets contain both D/M/Y and M/D/Y. Values with a day > 12
  // identify M/D/Y; ambiguous values follow the portal's canonical D/M/Y.
  const month = usWhenSecondExceedsTwelve && b > 12 ? a : b;
  const day = usWhenSecondExceedsTwelve && b > 12 ? b : a;
  return validLocalDate(Number(year), month, day, hour, minute, secondOfMinute);
};

export const parsePortalDateTime = value => {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  const text = String(value).trim();
  if (/^\d{4}-\d{1,2}-\d{1,2}T.*(?:Z|[+-]\d{2}:?\d{2})$/i.test(text)) {
    const zoned = new Date(text);
    if (!Number.isNaN(zoned.getTime())) return zoned;
  }
  const iso = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[, T]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?)?/i);
  if (iso) {
    let hour = Number(iso[4] || 0);
    const meridiem = String(iso[7] || '').toUpperCase();
    if (meridiem === 'PM' && hour < 12) hour += 12;
    if (meridiem === 'AM' && hour === 12) hour = 0;
    return validLocalDate(Number(iso[1]), Number(iso[2]), Number(iso[3]), hour, Number(iso[5] || 0), Number(iso[6] || 0));
  }
  const dayFirst = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:[, T]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?)?/i);
  if (dayFirst) {
    let hour = Number(dayFirst[4] || 0);
    const meridiem = String(dayFirst[7] || '').toUpperCase();
    if (meridiem === 'PM' && hour < 12) hour += 12;
    if (meridiem === 'AM' && hour === 12) hour = 0;
    return parseParts(dayFirst[3], dayFirst[1], dayFirst[2], {
      hour, minute: Number(dayFirst[5] || 0), secondOfMinute: Number(dayFirst[6] || 0)
    });
  }
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const parsePortalDate = value => parsePortalDateTime(value);

export const getTodayPortalDateInput = () => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: INDIA_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
};

const dateParts = value => parsePortalDate(value);

export const formatPortalDate = (value, fallback = '—') => {
  if (typeof value === 'string') {
    const text = value.trim();
    const iso = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
    if (iso) return `${String(iso[3]).padStart(2, '0')}/${String(iso[2]).padStart(2, '0')}/${iso[1]}`;
    const slash = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:$|[ T])/);
    if (slash) {
      const first = Number(slash[1]);
      const second = Number(slash[2]);
      const day = second > 12 ? second : first;
      const month = second > 12 ? first : second;
      if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
        return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${slash[3]}`;
      }
    }
  }
  const date = dateParts(value);
  if (!date) return fallback;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: INDIA_TIME_ZONE, day: '2-digit', month: '2-digit', year: 'numeric'
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.day}/${values.month}/${values.year}`;
};

export const formatPortalTime = (value, fallback = '—') => {
  if (!value) return fallback;
  const text = String(value).trim();
  const timeOnly = text.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (timeOnly) {
    let hour = Number(timeOnly[1]);
    const meridiem = String(timeOnly[4] || '').toUpperCase();
    if (meridiem === 'PM' && hour < 12) hour += 12;
    if (meridiem === 'AM' && hour === 12) hour = 0;
    return `${String(hour).padStart(2, '0')}:${timeOnly[2]}:${timeOnly[3] || '00'}`;
  }
  const date = parsePortalDateTime(value);
  if (!date) return fallback;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: INDIA_TIME_ZONE, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.hour}:${values.minute}:${values.second}`;
};

export const formatPortalDateTime = (value, fallback = '—') => {
  if (!value) return fallback;
  const date = parsePortalDateTime(value);
  if (!date) return String(value);
  return `${formatPortalDate(date)} ${formatPortalTime(date)}`;
};
