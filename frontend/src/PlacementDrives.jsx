import { useEffect, useState } from 'react';
import axios from 'axios';
import { 
  CircleNotch, CalendarCheck, Users, 
  CaretLeft, X, IdentificationCard, Phone, EnvelopeSimple 
} from '@phosphor-icons/react';
import Layout from './Layout';
import { API_BASE } from './apiConfig';

const parseDate = (dStr) => {
  if (!dStr) return 0;
  let cleanStr = typeof dStr === 'string' ? dStr.split(' ')[0] : dStr;
  if (typeof cleanStr === 'string' && cleanStr.includes('/')) {
    const parts = cleanStr.split('/');
    if (parts.length === 3 && parts[2].length === 4) {
      return new Date(`${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`).getTime();
    }
  }
  const d = new Date(cleanStr).getTime();
  return isNaN(d) ? 0 : d;
};

export default function PlacementDrives() {
  const tpoDataStr = localStorage.getItem('tpoData');
  const tpoData = tpoDataStr ? JSON.parse(tpoDataStr) : null;
  const isSuperAdmin = tpoData?.accessType === 'superadmin';

  const [drives, setDrives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDrive, setSelectedDrive] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [savingRow, setSavingRow] = useState(null);

  const fetchDrives = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE}/api/tpo/drives`);
      if (res.data.success) {
        setDrives(res.data.drives || []);
      }
    } catch (error) { console.error("Failed to load drives"); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchDrives(); }, []);

  // 🚨 SECURITY CHECK: Can this user edit the drive?
  const canEditDrive = (drive) => {
    if (isSuperAdmin) return true;
    const myName = (tpoData?.name || '').toLowerCase().trim();
    const driveOwner = (drive.driveTpo || '').toLowerCase().trim();
    return myName !== '' && myName === driveOwner;
  };

  const updateStudentStatus = async (rowNumber, newStatus) => {
    setSavingRow(rowNumber);
    try {
      const res = await axios.post(`${API_BASE}/api/tpo/drives/update`, { rowNumber, studentStatus: newStatus });
      if (res.data.success) {
        setDrives(drives.map(d => d.rowNumber === rowNumber ? { ...d, studentStatus: newStatus } : d));
      }
    } catch (err) { alert("Failed to update status"); }
    finally { setSavingRow(null); }
  };

  // Grouping students by Drive ID for the Landing View
  const groupedDrives = {};
  drives.forEach(d => {
    if (!d.driveId) return;
    if (!groupedDrives[d.driveId]) {
      groupedDrives[d.driveId] = { driveId: d.driveId, driveTpo: d.driveTpo, applicants: [] };
    }
    groupedDrives[d.driveId].applicants.push(d);
  });
  
  const driveList = Object.values(groupedDrives).sort((a, b) => {
    const d1 = Math.max(...a.applicants.map(ap => parseDate(ap.regDate)));
    const d2 = Math.max(...b.applicants.map(ap => parseDate(ap.regDate)));
    return d2 - d1;
  });

  const filteredApplicants = selectedDrive ? selectedDrive.applicants.filter(a => 
    (a.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
    (a.branch || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
    (a.email || '').toLowerCase().includes(searchQuery.toLowerCase())
  ) : [];

  return (
    <Layout>
      <div className="page-container" style={{ padding: 0 }}>
        
        {!selectedDrive ? (
          <>
            <div style={{ marginBottom: '2rem' }}>
              <h1 style={{ fontSize: '2rem', margin: '0 0 5px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <IdentificationCard color="var(--accent-primary)" weight="fill" /> Placement Drives
              </h1>
              <p style={{ color: 'var(--text-muted)', margin: 0 }}>Select a drive ID below to track registrations and update outcomes.</p>
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', marginTop: '4rem', color: '#38bdf8' }}><CircleNotch size={40} className="ph-spin" /></div>
            ) : driveList.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', background: 'var(--card-bg)', borderRadius: '12px', border: '1px solid var(--card-border)' }}>No drive registrations recorded yet.</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
                {driveList.map((drive, idx) => (
                  <div key={idx} onClick={() => setSelectedDrive(drive)} style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '12px', padding: '20px', cursor: 'pointer', transition: '0.2s', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', padding: '8px', borderRadius: '8px' }}><CalendarCheck size={24} weight="fill" /></div>
                        <div>
                          <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#fff' }}>{drive.driveId}</h3>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Created by: {drive.driveTpo || 'Admin'}</span>
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.05)', padding: '8px 12px', borderRadius: '8px', fontSize: '0.85rem', color: '#cbd5e1' }}>
                      <Users size={16} /> <strong>{drive.applicants.length}</strong> Registered Students
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '25px', gap: '15px', flexWrap: 'wrap' }}>
              <button onClick={() => { setSelectedDrive(null); setSearchQuery(''); }} style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', color: '#fff', padding: '10px 15px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <CaretLeft weight="bold" size={18} /> Back to Drives
              </button>
              <div>
                <h1 style={{ fontSize: '1.8rem', margin: '0 0 5px 0' }}>{selectedDrive.driveId} Registrations</h1>
                <p style={{ color: 'var(--text-muted)', margin: 0 }}>Track attendance and offer status for students in this drive.</p>
              </div>
            </div>

            <div style={{ marginBottom: '20px', maxWidth: '400px' }}>
              <input type="text" className="sleek-input" placeholder="Search student or branch..." style={{ width: '100%' }} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 2fr 1fr', padding: '0 1.5rem', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.5px' }}>
                <span>STUDENT INFO</span><span>COURSE & BRANCH</span><span>REGISTRATION DATA</span><span style={{ textAlign: 'center' }}>STUDENT STATUS</span>
              </div>

              {filteredApplicants.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', background: 'var(--card-bg)', borderRadius: '12px', border: '1px solid var(--card-border)' }}>No students match your search.</div>
              ) : (
                filteredApplicants.map((app, i) => (
                  <div key={i} style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '12px', padding: '1rem 1.5rem', display: 'grid', gridTemplateColumns: '2fr 1.5fr 2fr 1fr', alignItems: 'center', gap: '15px' }}>
                    <div>
                      <strong style={{ display: 'block', color: '#fff', fontSize: '1.05rem', marginBottom: '4px' }}>{app.name}</strong>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{app.email} • {app.phone}</span>
                    </div>
                    <div>
                      <strong style={{ display: 'block', color: '#fff', fontSize: '1rem', marginBottom: '4px' }}>{app.branch}</strong>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{app.course}</span>
                    </div>
                    <div>
                      <span style={{ color: '#cbd5e1', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '5px' }}><Clock size={14}/> {app.regDate}</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '4px', display: 'block' }}>Status: {app.regStatus || 'Registered'}</span>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      {savingRow === app.rowNumber ? (
                        <CircleNotch size={20} className="ph-spin" color="#38bdf8" />
                      ) : (
                        <select 
                          className="sleek-select" 
                          style={{ width: '100%', opacity: canEditDrive(selectedDrive) ? 1 : 0.6 }} 
                          value={app.studentStatus || 'Pending / Unknown'} 
                          onChange={(e) => updateStudentStatus(app.rowNumber, e.target.value)}
                          disabled={!canEditDrive(selectedDrive)}
                        >
                          <option value="Pending / Unknown">Pending / Unknown</option>
                          <option value="Interview Attended">Interview Attended</option>
                          <option value="Interview Not Attended">Interview Not Attended</option>
                          <option value="Placed / Got Offer">Placed / Got Offer</option>
                          <option value="Offer Rejected">Offer Rejected</option>
                          <option value="Not Interested">Not Interested</option>
                        </select>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}

      </div>
    </Layout>
  );
}