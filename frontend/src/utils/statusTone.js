export function getStatusTone(status) {
  const value = String(status || '').trim().toLowerCase();
  if (/reject|declin|not interested|error|fail|not attend|cancel|overdue/.test(value)) return 'danger';
  if (/incomplete|not complete|not joined|inactive/.test(value)) return 'neutral';
  if (/pending|wait|hold|review|progress|processing|await|applied|no response|not started/.test(value)) return 'warning';
  if (/complete|success|placed|joined|resolved|approved|active|accepted|signed/.test(value)) return 'success';
  if (/interview|shortlist|schedule|open/.test(value)) return 'info';
  return 'neutral';
}
