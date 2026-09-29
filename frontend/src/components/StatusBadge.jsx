export default function StatusBadge({ status, className = '' }) {
  const value = String(status || '').trim().toLowerCase();
  const tone = /reject|declin|not interested|error|fail|not attend|cancel|overdue/.test(value) ? 'danger'
    : /incomplete|not complete|not joined|inactive/.test(value) ? 'neutral'
      : /pending|wait|hold|review|progress|processing|await|applied|no response|not started/.test(value) ? 'warning'
        : /complete|success|placed|joined|resolved|approved|active|accepted|signed/.test(value) ? 'success'
          : /interview|shortlist|schedule|open/.test(value) ? 'info' : 'neutral';
  return <span className={`status-chip tone-${tone} ${className}`.trim()}>{status}</span>;
}
