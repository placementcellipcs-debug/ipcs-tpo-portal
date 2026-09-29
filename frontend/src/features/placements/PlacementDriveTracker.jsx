import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { CalendarBlank, CaretDown, CircleNotch, FloppyDisk, MagnifyingGlass, MapPin, Users, CheckCircle, WarningCircle } from '@phosphor-icons/react';
import { API_BASE } from '../../services/apiConfig';
import { getStatusTone } from '../../utils/statusTone';

const DRIVE_STATUSES = [
  'Pending', 'Shortlisted', 'Interview Scheduled', 'Interview Attended', 'Interview Not Attended',
  'Got Offer', 'Placed', 'Student Not Interested', 'Student Rejected Offer', 'Company Rejected', 'No Response from Student'
];

export default function PlacementDriveTracker() {
  const [drives, setDrives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [openDrives, setOpenDrives] = useState({});
  const [edits, setEdits] = useState({});
  const [saving, setSaving] = useState({});

  useEffect(() => {
    let active = true;
    axios.get(`${API_BASE}/api/tpo/drives`)
      .then(response => {
        if (!active) return;
        if (!response.data?.success) throw new Error(response.data?.message || 'Could not load placement drives.');
        setDrives(response.data.drives || []);
      })
      .catch(error => { if (active) setLoadError(error.response?.data?.message || error.message || 'Could not load placement drives.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const groupedDrives = useMemo(() => {
    const groups = new Map();
    drives.forEach(row => {
      if (!row.driveId) return;
      if (!groups.has(row.driveId)) groups.set(row.driveId, {
        driveId: row.driveId, driveTpo: row.driveTpo, driveDate: row.driveDate,
        driveLocation: row.driveLocation, applicants: []
      });
      if (row.name !== 'NO_APPLICANTS' && Number(row.rowNumber) >= 2 && Number.isInteger(Number(row.rowNumber))) groups.get(row.driveId).applicants.push(row);
    });
    return [...groups.values()].filter(drive => {
      const haystack = [drive.driveId, drive.driveTpo, drive.driveLocation, ...drive.applicants.flatMap(student => [student.name, student.course, student.branch, student.email])].join(' ').toLowerCase();
      return haystack.includes(search.trim().toLowerCase());
    }).sort((a, b) => String(b.driveDate || '').localeCompare(String(a.driveDate || '')));
  }, [drives, search]);

  const totalStudents = groupedDrives.reduce((sum, drive) => sum + drive.applicants.length, 0);
  const pendingStudents = groupedDrives.reduce((sum, drive) => sum + drive.applicants.filter(student => !student.studentStatus || /pending|unknown/i.test(student.studentStatus)).length, 0);
  const setEdit = (student, field, value) => setEdits(current => ({
    ...current,
    [student.rowNumber]: { ...current[student.rowNumber], [field]: value }
  }));

  const saveStudent = async student => {
    const currentEdit = edits[student.rowNumber] || {};
    const studentStatus = currentEdit.studentStatus ?? student.studentStatus ?? 'Pending';
    const remarks = currentEdit.remarks ?? student.remarks ?? '';
    setSaving(current => ({ ...current, [student.rowNumber]: 'saving' }));
    try {
      const response = await axios.post(`${API_BASE}/api/tpo/drives/update`, {
        rowNumber: student.rowNumber, studentStatus, remarks
      });
      if (!response.data?.success) throw new Error(response.data?.message || 'Unable to save this student.');
      setLoadError('');
      setDrives(current => current.map(row => row.rowNumber === student.rowNumber ? { ...row, studentStatus, remarks } : row));
      setEdits(current => { const next = { ...current }; delete next[student.rowNumber]; return next; });
      setSaving(current => ({ ...current, [student.rowNumber]: 'success' }));
      window.setTimeout(() => setSaving(current => ({ ...current, [student.rowNumber]: null })), 2600);
    } catch (error) {
      setSaving(current => ({ ...current, [student.rowNumber]: 'error' }));
      setLoadError(error.response?.data?.message || error.message || 'Unable to save this student.');
    }
  };

  return (
    <section className="pdt-shell" aria-label="Placement drive tracking">
      <div className="pdt-summary-row">
        <div><span className="pdt-summary-label">CONDUCTED DRIVES</span><strong>{groupedDrives.length}</strong></div>
        <div><span className="pdt-summary-label">REGISTERED STUDENTS</span><strong>{totalStudents}</strong></div>
        <div><span className="pdt-summary-label">PENDING UPDATES</span><strong>{pendingStudents}</strong></div>
        <label className="pdt-search"><MagnifyingGlass size={19} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search drives or students" /></label>
      </div>

      {loadError && <div className="pdt-alert" role="alert"><WarningCircle size={18} />{loadError}</div>}
      {loading ? <div className="pdt-empty"><CircleNotch className="ph-spin" size={32} />Loading your placement drives…</div> : groupedDrives.length === 0 ? (
        <div className="pdt-empty">{search ? 'No placement drives match this search.' : 'No placement drives are assigned to your account yet.'}</div>
      ) : (
        <div className="pdt-drive-list">
          {groupedDrives.map(drive => {
            const isOpen = Boolean(openDrives[drive.driveId]);
            const placedCount = drive.applicants.filter(student => /placed|offer/i.test(student.studentStatus || '')).length;
            return <article className={`pdt-drive-card ${isOpen ? 'expanded' : ''}`} key={drive.driveId}>
              <button type="button" className="pdt-drive-heading" aria-expanded={isOpen} onClick={() => setOpenDrives(current => ({ ...current, [drive.driveId]: !current[drive.driveId] }))}>
                <div className="pdt-drive-mark"><CalendarBlank size={22} weight="fill" /></div>
                <div className="pdt-drive-title"><span className="pdt-eyebrow">PLACEMENT DRIVE</span><strong>{drive.driveId}</strong><span className="pdt-drive-meta"><span><CalendarBlank size={15} />{drive.driveDate || 'Date not set'}</span><span><MapPin size={15} />{drive.driveLocation || 'Location not set'}</span></span></div>
                <div className="pdt-drive-metrics"><span><Users size={17} />{drive.applicants.length} students</span><span className="pdt-placed-count">{placedCount} offer / placed</span></div>
                <CaretDown className="pdt-chevron" size={20} />
              </button>
              {isOpen && <div className="pdt-student-list">
                {drive.applicants.length === 0 ? <div className="pdt-no-students">This drive has no registrations yet.</div> : drive.applicants.map(student => {
                  const studentEdit = edits[student.rowNumber] || {};
                  const status = studentEdit.studentStatus ?? student.studentStatus ?? 'Pending';
                  const remarks = studentEdit.remarks ?? student.remarks ?? '';
                  const saveState = saving[student.rowNumber];
                  return <div className="pdt-student-row" key={student.rowNumber}>
                    <div className="pdt-student-info"><div className="pdt-student-avatar">{String(student.name || '?').trim().charAt(0).toUpperCase()}</div><div><strong>{student.name || 'Unnamed student'}</strong><span>{[student.roll, student.course || student.branch].filter(Boolean).join(' · ') || 'Course details unavailable'}</span></div></div>
                    <div className="pdt-student-registration"><span className="pdt-eyebrow">REGISTRATION</span><span>{student.regStatus || 'Registered'}</span></div>
                    <label className="pdt-field"><span>Status</span><select className={`tone-${getStatusTone(status)}`} value={status} onChange={event => setEdit(student, 'studentStatus', event.target.value)}>{status && !DRIVE_STATUSES.includes(status) && <option value={status}>{status}</option>}{DRIVE_STATUSES.map(option => <option key={option} value={option}>{option}</option>)}</select></label>
                    <label className="pdt-field pdt-remarks"><span>Remarks</span><textarea rows={2} value={remarks} onChange={event => setEdit(student, 'remarks', event.target.value)} placeholder="Add an update for this student" /></label>
                    <div className="pdt-save-wrap"><button type="button" className={`pdt-save ${saveState || ''}`} disabled={saveState === 'saving'} onClick={() => saveStudent(student)}>{saveState === 'saving' ? <CircleNotch className="ph-spin" size={18} /> : saveState === 'success' ? <CheckCircle size={18} weight="fill" /> : saveState === 'error' ? <WarningCircle size={18} weight="fill" /> : <FloppyDisk size={18} weight="bold" />}{saveState === 'success' ? 'Saved' : saveState === 'error' ? 'Retry' : 'Save'}</button></div>
                  </div>;
                })}
              </div>}
            </article>;
          })}
        </div>
      )}
    </section>
  );
}
