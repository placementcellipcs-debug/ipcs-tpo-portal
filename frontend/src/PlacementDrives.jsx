import { useEffect, useState } from 'react';
import axios from 'axios';
import { CircleNotch, CaretLeft, IdentificationCard, Users, Clock } from '@phosphor-icons/react';
import Layout from './Layout';

const TILE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#0ea5e9'];

export default function PlacementDrives() {
  const tpoData = JSON.parse(localStorage.getItem('tpoData'));
  const isTpo = (tpoData?.role || '').toUpperCase() === 'TPO';
  
  const [drivesData, setDrivesData] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedDrive, setSelectedDrive] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchDrives();
  }, []);

  const fetchDrives = async () => {
    try {
      const res = await axios.get('https://ipcs-tpo-portal-u0l6.onrender.com/api/tpo/drives');
      if(res.data.success) setDrivesData(res.data.drives);
    } catch(err) { console.error("Failed to load drives"); } finally { setLoading(false); }
  };

  const updateStudentStatus = async (rowNumber, newStatus) => {
    // Optimistic UI update for instant feedback
    setDrivesData(prev => prev.map(d => d.rowNumber === rowNumber ? { ...d, studentStatus: newStatus } : d));
    try {
      await axios.post('https://ipcs-tpo-portal-u0l6.onrender.com/api/tpo/drives/update', { rowNumber, studentStatus: newStatus });
    } catch(err) { 
      alert("Failed to sync status to Google Sheets"); 
      fetchDrives(); 
    }
  };

  // Group data by Drive ID
  const groupedDrives = {};
  drivesData.forEach(d => {
    const id = d.driveId || 'Unknown Drive';
    if(!groupedDrives[id]) groupedDrives[id] = [];
    groupedDrives[id].push(d);
  });
  const driveIds = Object.keys(groupedDrives).sort();

  const activeStudents = selectedDrive ? groupedDrives[selectedDrive] || [] : [];
  const filteredStudents = activeStudents.filter(s => 
    (s.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.branch || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!selectedDrive) {
    return (
      <Layout>
        <div className="page-container" style={{ padding: 0 }}>
          <h1 style={{ fontSize: '2rem', marginBottom: '5px', textAlign: 'center', marginTop: '20px' }}>Placement Drives</h1>
          <p style={{ color: 'var(--text-muted)', marginBottom: '3rem', textAlign: 'center' }}>Select a Drive ID to view registered students and track attendance.</p>
          
          {loading ? (
            <div style={{ textAlign: 'center', marginTop: '4rem', color: '#38bdf8' }}><CircleNotch size={50} className="ph-spin" /></div>
          ) : driveIds.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}>No placement drive registrations found.</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '30px', padding: '0 20px' }}>
              {driveIds.map((id, index) => {
                const color = TILE_COLORS[index % TILE_COLORS.length];
                const count = groupedDrives[id].length;
                return (
                  <div 
                    key={id} 
                    onClick={() => setSelectedDrive(id)}
                    style={{ backgroundColor: color, borderRadius: '24px', padding: '40px 20px', cursor: 'pointer', textAlign: 'center', minHeight: '220px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', transition: 'transform 0.2s ease' }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-5px)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
                  >
                    <h2 style={{ color: '#ffffff', fontSize: '2rem', margin: '0 0 10px 0' }}>{id}</h2>
                    <div style={{ background: 'rgba(255,255,255,0.2)', padding: '8px 16px', borderRadius: '30px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Users size={20} color="#ffffff" weight="bold" />
                      <span style={{ color: '#ffffff', fontSize: '1rem', fontWeight: 'bold' }}>{count} Registered</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="page-container" style={{ padding: 0 }}>
        
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '25px', gap: '15px' }}>
          <button 
            onClick={() => setSelectedDrive(null)} 
            style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', color: '#fff', padding: '10px 15px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
          >
            <CaretLeft weight="bold" size={18} /> Back to Drives
          </button>
          <div>
            <h1 style={{ fontSize: '1.8rem', margin: 0 }}>{selectedDrive} Registrations</h1>
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>Track attendance and offer status for students in this drive.</p>
          </div>
        </div>

        <div style={{ marginBottom: '20px', maxWidth: '400px' }}>
          <input 
            type="text" 
            placeholder="Search student or branch..." 
            className="sleek-input" 
            style={{ width: '100%' }}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="table-container">
          <table className="modern-table">
            <thead>
              <tr>
                <th>Student Info</th>
                <th>Course & Branch</th>
                <th>Registration Data</th>
                <th style={{ textAlign: 'center' }}>Student Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.length === 0 ? (
                <tr><td colSpan="4" style={{ textAlign: 'center', padding: '2rem' }}>No students match your search.</td></tr>
              ) : (
                filteredStudents.map((s, i) => (
                  <tr key={i}>
                    <td>
                      <span className="primary-text">{s.name}</span>
                      <span className="sub-text">{s.email} • {s.phone}</span>
                    </td>
                    <td>
                      <span className="primary-text">{s.branch}</span>
                      <span className="sub-text">{s.course}</span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <Clock size={14} color="var(--accent-primary)"/> {s.regDate}
                      </span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Status: {s.regStatus || 'Registered'}</span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {isTpo ? (
                        <select 
                          className="sleek-select" 
                          style={{ background: 'var(--bg-dark)', border: '1px solid var(--card-border)', color: '#fff', fontSize: '0.85rem', padding: '6px 12px' }}
                          value={s.studentStatus}
                          onChange={(e) => updateStudentStatus(s.rowNumber, e.target.value)}
                        >
                          <option value="">Pending / Unknown</option>
                          <option value="Attended">Attended</option>
                          <option value="Not Attended">Not Attended</option>
                          <option value="Shortlisted">Shortlisted</option>
                          <option value="Placed">Placed / Got Offer</option>
                          <option value="Rejected">Rejected</option>
                        </select>
                      ) : (
                        <span className="badge badge-blue">{s.studentStatus || 'Pending'}</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}