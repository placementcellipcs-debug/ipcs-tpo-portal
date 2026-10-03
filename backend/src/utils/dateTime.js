const indiaDateTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Kolkata',
  day: '2-digit', month: '2-digit', year: 'numeric',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
});

const formatIndiaTimestamp = (date = new Date()) => {
  const values = Object.fromEntries(indiaDateTimeFormatter.formatToParts(date).map(part => [part.type, part.value]));
  return `${values.day}/${values.month}/${values.year} ${values.hour}:${values.minute}:${values.second}`;
};

const formatIndiaDate = value => {
  if (!value) return '';
  const text = String(value).trim();
  const isoDate = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoDate) return `${String(isoDate[3]).padStart(2, '0')}/${String(isoDate[2]).padStart(2, '0')}/${isoDate[1]}`;
  const dayFirst = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (dayFirst) {
    const first = Number(dayFirst[1]);
    const second = Number(dayFirst[2]);
    const month = second > 12 ? first : second;
    const day = second > 12 ? second : first;
    return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${dayFirst[3]}`;
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? text : new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
};

const formatIndiaTime = value => {
  if (!value) return '';
  const text = String(value).trim();
  const time = text.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (time) {
    let hour = Number(time[1]);
    const meridiem = String(time[4] || '').toUpperCase();
    if (meridiem === 'PM' && hour < 12) hour += 12;
    if (meridiem === 'AM' && hour === 12) hour = 0;
    return `${String(hour).padStart(2, '0')}:${time[2]}:${time[3] || '00'}`;
  }
  const dateAndTime = text.match(/^\d{1,2}[/-]\d{1,2}[/-]\d{4}[, T]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (dateAndTime) {
    let hour = Number(dateAndTime[1]);
    const meridiem = String(dateAndTime[4] || '').toUpperCase();
    if (meridiem === 'PM' && hour < 12) hour += 12;
    if (meridiem === 'AM' && hour === 12) hour = 0;
    return `${String(hour).padStart(2, '0')}:${dateAndTime[2]}:${dateAndTime[3] || '00'}`;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? text : new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(date);
};

module.exports = { formatIndiaTimestamp, formatIndiaDate, formatIndiaTime };
