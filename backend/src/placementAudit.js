const { randomUUID } = require('crypto');

const PLACEMENT_AUDIT_SHEET = 'Placement_Audit_Log';
const PLACEMENT_AUDIT_HEADERS = [
  'Event ID', 'Timestamp', 'Actor Name', 'Actor Email', 'Actor Role', 'Action', 'Previous Status', 'New Status',
  'Student Name', 'Roll Number', 'Job ID', 'Company', 'Position', 'Entry Source', 'Details'
];

const createPlacementAuditEvent = ({ actor = {}, action, previousStatus = '', newStatus = '', record = {}, details = '', changedAt }) => ({
  'Event ID': randomUUID(),
  Timestamp: changedAt || new Date().toISOString(),
  'Actor Name': String(actor.name || ''),
  'Actor Email': String(actor.email || '').toLowerCase(),
  'Actor Role': String(actor.role || ''),
  Action: String(action || 'Placement updated'),
  'Previous Status': String(previousStatus || ''),
  'New Status': String(newStatus || ''),
  'Student Name': String(record.name || record.studentName || ''),
  'Roll Number': String(record.roll || record.rollNumber || ''),
  'Job ID': String(record.jobId || ''),
  Company: String(record.company || record.companyName || ''),
  Position: String(record.position || ''),
  'Entry Source': String(record.entrySource || ''),
  Details: String(details || '')
});

module.exports = { PLACEMENT_AUDIT_SHEET, PLACEMENT_AUDIT_HEADERS, createPlacementAuditEvent };
