import { useEffect, useState } from 'react';
import axios from 'axios';
import { 
  CircleNotch, CalendarCheck, Users, 
  CaretLeft, IdentificationCard, Phone, EnvelopeSimple,
  Trophy, UserList, Clock, CheckCircle, MapPin, CalendarBlank, WarningCircle, WhatsappLogo, FilePdf
} from '@phosphor-icons/react';
import Layout from './Layout';
import { API_BASE } from './apiConfig';

const parseDate = (dStr) => {
  if (!dStr) return 0;
  const d = new Date(dStr);
  if (!isNaN(d.getTime())) return d.getTime();
  
  try {
      let cleanStr = typeof dStr === 'string' ? dStr.split(' ')[0] : dStr;
      if (typeof cleanStr === 'string' && cleanStr.includes('/')) {
        const parts = cleanStr.split(/[/\-]/);
        if (parts.length === 3 && parts[2].length === 4) {
          return new Date(`${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`).getTime();
        }
      }
      return 0;
  } catch(e) { return 0; }
};

export default function PlacementDrives() {
  const tpoDataStr = localStorage.getItem('tpoData');
  const tpoData = tpoDataStr ? JSON.parse(tpoDataStr) : null;
  const isSuperAdmin = tpoData?.accessType === 'superadmin';

  const [drives, setDrives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDrive, setSelectedDrive] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [activeMasterTab, setActiveMasterTab] = useState('upcoming'); 
  const [activeInterestTab, setActiveInterestTab] = useState('interested'); 
  
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

  const canEditDrive = (drive) => {
    if (isSuperAdmin) return true;
    if (!tpoData || !tpoData.name) return false;
    if (!drive.driveTpo) return false;
    
    const myName = String(tpoData.name).toLowerCase().trim();
    const driveOwner = String(drive.driveTpo).toLowerCase().trim();
    return myName !== '' && myName === driveOwner;
  };

  const updateStudentStatus = async (rowNumber, newStatus) => {
    setSavingRow(rowNumber);
    try {
      const res = await axios.post(`${API_BASE}/api/tpo/drives/update`, { rowNumber, studentStatus: newStatus });
      if (res.data.success) {
        setDrives(drives.map(d => d.rowNumber === rowNumber ? { ...d, studentStatus: newStatus } : d));
        if (selectedDrive) {
           setSelectedDrive(prev => ({
              ...prev,
              applicants: prev.applicants.map(a => a.rowNumber === rowNumber ? { ...a, studentStatus: newStatus } : a)
           }));
        }
      }
    } catch (err) { alert("Failed to update status"); }
    finally { setSavingRow(null); }
  };

  // Group and sort drives
  const groupedDrives = {};
  drives.forEach(d => {
    if (!d.driveId) return;
    if (!groupedDrives[d.driveId]) {
      groupedDrives[d.driveId] = { 
        driveId: d.driveId, 
        driveTpo: d.driveTpo, 
        driveDate: d.driveDate,
        driveLocation: d.driveLocation,
        applicants: [] 
      };
    }
    if (d.name !== 'NO_APPLICANTS') {
      groupedDrives[d.driveId].applicants.push(d);
    }
  });
  
  const driveList = Object.values(groupedDrives).sort((a, b) => {
    return parseDate(b.driveDate) - parseDate(a.driveDate);
  });

  const todayStart = new Date().setHours(0,0,0,0);
  const upcomingDrives = driveList.filter(d => parseDate(d.driveDate) >= todayStart || parseDate(d.driveDate) === 0);
  const expiredDrives = driveList.filter(d => parseDate(d.driveDate) > 0 && parseDate(d.driveDate) < todayStart);
  const displayDrives = activeMasterTab === 'upcoming' ? upcomingDrives : expiredDrives;

  const allApplicants = selectedDrive ? selectedDrive.applicants : [];
  
  const interestedApplicants = allApplicants.filter(a => {
    const regStat = String(a.regStatus || '').toLowerCase();
    const stuStat = String(a.studentStatus || '').toLowerCase();
    return !regStat.includes('not interested') && !stuStat.includes('not interested');
  });

  const notInterestedApplicants = allApplicants.filter(a => {
    const regStat = String(a.regStatus || '').toLowerCase();
    const stuStat = String(a.studentStatus || '').toLowerCase();
    return regStat.includes('not interested') || stuStat.includes('not interested');
  });

  const activeListSource = activeInterestTab === 'interested' ? interestedApplicants : notInterestedApplicants;

  const filteredApplicants = activeListSource.filter(a => 
    String(a.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
    String(a.branch || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
    String(a.email || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  let kpiTotal = 0, kpiAttended = 0, kpiPlaced = 0, kpiPending = 0;
  if (selectedDrive) {
    kpiTotal = interestedApplicants.length; 
    interestedApplicants.forEach(a => {
      const stat = String(a.studentStatus || '').toLowerCase();
      if (stat.includes('placed') || stat.includes('offer')) kpiPlaced++;
      if (stat.includes('attended') || stat.includes('placed') || stat.includes('offer')) kpiAttended++;
      if (stat.includes('pending') || stat === '') kpiPending++;
    });
  }

  const handleResumeClick = (url) => {
    if (!url || url === 'N/A') return alert('No resume uploaded by this student.');
    const match = url.match(/(?:file\/d\/|id=|\/d\/)([\w-]{25,})/);
    if (match) window.open(`https://drive.google.com/file/d/${match[1]}/view`, '_blank');
    else window.open(url, '_blank');
  };

  return (
    <Layout>
      <div className="pd-wrapper page-container" style={{ maxWidth: '1600px', margin: '0 auto', paddingBottom: '50px' }}>
        
        {!selectedDrive ? (
          <>
            <div className="top-hero-section">
              <div className="hero-text">
                <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <IdentificationCard color="#8b5cf6" weight="fill" /> Placement Drives Master
                </h1>
                <p>Select an active drive below to track applicant attendance, update outcomes, and view analytics.</p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '15px', marginBottom: '25px', borderBottom: '1px solid #1e293b', paddingBottom: '15px' }}>
              <button 
                onClick={() => setActiveMasterTab('upcoming')}
                style={{ 
                  background: activeMasterTab === 'upcoming' ? 'rgba(56, 189, 248, 0.1)' : 'transparent',
                  color: activeMasterTab === 'upcoming' ? '#8b5cf6' : '#94a3b8',
                  border: activeMasterTab === 'upcoming' ? '1px solid rgba(56, 189, 248, 0.3)' : '1px solid transparent',
                  padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', transition: '0.2s'
                }}>
                Upcoming & Active Drives
              </button>
              <button 
                onClick={() => setActiveMasterTab('expired')}
                style={{ 
                  background: activeMasterTab === 'expired' ? 'rgba(239, 68, 68, 0.1)' : 'transparent',
                  color: activeMasterTab === 'expired' ? '#ef4444' : '#94a3b8',
                  border: activeMasterTab === 'expired' ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid transparent',
                  padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', transition: '0.2s'
                }}>
                Expired / Past Drives
              </button>
            </div>

            {loading ? (
              <div className="empty-state-card"><CircleNotch size={40} className="ph-spin text-blue" /><p>Fetching drives...</p></div>
            ) : displayDrives.length === 0 ? (
              <div className="empty-state-card">
                <span style={{ fontSize: '2.5rem', marginBottom: '10px', display: 'block' }}>📭</span>
                No {activeMasterTab} drive records found.
              </div>
            ) : (
              <div className="grid-3-col">
                {displayDrives.map((drive, idx) => {
                  const placedCount = drive.applicants.filter(a => String(a.studentStatus || '').toLowerCase().includes('placed') || String(a.studentStatus || '').toLowerCase().includes('offer')).length;
                  const progressPct = drive.applicants.length > 0 ? (placedCount / drive.applicants.length) * 100 : 0;
                  const isOrphaned = !drive.driveTpo;

                  return (
                    <div key={idx} onClick={() => { setSelectedDrive(drive); setActiveInterestTab('interested'); }} className="dash-card hover-lift" style={{ cursor: 'pointer', padding: '25px', position: 'relative', overflow: 'hidden', border: isOrphaned ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid #1e293b' }}>
                      <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: isOrphaned ? '#f59e0b' : (activeMasterTab === 'upcoming' ? '#8b5cf6' : '#ef4444') }}></div>
                      
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                        <div>
                          <div style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>Drive Reference</div>
                          <h3 style={{ margin: 0, fontSize: '1.4rem', color: '#fff', fontWeight: 900 }}>{String(drive.driveId || 'N/A')}</h3>
                        </div>
                        <div style={{ background: isOrphaned ? 'rgba(245, 158, 11, 0.15)' : (activeMasterTab === 'upcoming' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(239, 68, 68, 0.15)'), color: isOrphaned ? '#f59e0b' : (activeMasterTab === 'upcoming' ? '#8b5cf6' : '#ef4444'), padding: '10px', borderRadius: '12px' }}>
                          <CalendarCheck size={24} weight="fill" />
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px', color: '#cbd5e1', fontSize: '0.85rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <IdentificationCard size={18} color="#94a3b8" /> 
                          {drive.driveTpo ? (
                            <span>Managed by <strong style={{ color: '#fff' }}>{drive.driveTpo}</strong></span>
                          ) : (
                            <span style={{ color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '5px' }}><WarningCircle size={16}/> TPO Missing in Sheet</span>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <CalendarBlank size={18} color="#94a3b8" /> 
                          <span>{drive.driveDate || <span style={{ color: '#f59e0b' }}>Date Missing in Sheet</span>}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <MapPin size={18} color="#94a3b8" /> 
                          <span>{drive.driveLocation || <span style={{ color: '#f59e0b' }}>Location Missing in Sheet</span>}</span>
                        </div>
                      </div>

                      <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '12px', padding: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#10b981' }}>{drive.applicants.length}</div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 'bold' }}>Total Reg.</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#f59e0b' }}>{placedCount}</div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 'bold' }}>Placed</div>
                        </div>
                      </div>

                      <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', marginTop: '15px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${progressPct}%`, background: isOrphaned ? '#f59e0b' : '#8b5cf6', transition: 'width 0.5s ease' }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="dashboard-header" style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
                <button onClick={() => { setSelectedDrive(null); setSearchQuery(''); }} className="premium-btn secondary" style={{ padding: '10px 15px', fontSize: '0.9rem', width: 'auto' }}>
                  <CaretLeft weight="bold" size={18} /> Back
                </button>
                <div>
                  <h1 className="dash-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {String(selectedDrive.driveId || 'N/A')} Analytics
                  </h1>
                </div>
              </div>
            </div>

            <div className="kpi-grid" style={{ marginBottom: '30px' }}>
              <div className="dash-card" style={{ padding: '20px' }}>
                <div className="kpi-header"><div className="icon-c blue"><Users weight="fill" size={24}/></div><div><div className="kpi-title">Interested Registered</div><div className="kpi-val">{kpiTotal}</div></div></div>
              </div>
              <div className="dash-card" style={{ padding: '20px' }}>
                <div className="kpi-header"><div className="icon-c purple"><UserList weight="fill" size={24}/></div><div><div className="kpi-title">Interview Attended</div><div className="kpi-val">{kpiAttended}</div></div></div>
              </div>
              <div className="dash-card" style={{ padding: '20px' }}>
                <div className="kpi-header"><div className="icon-c green"><Trophy weight="fill" size={24}/></div><div><div className="kpi-title">Placed / Offered</div><div className="kpi-val">{kpiPlaced}</div></div></div>
              </div>
              <div className="dash-card" style={{ padding: '20px' }}>
                <div className="kpi-header"><div className="icon-c orange"><Clock weight="fill" size={24}/></div><div><div className="kpi-title">Pending Updates</div><div className="kpi-val">{kpiPending}</div></div></div>
              </div>
            </div>

            <div className="glass-panel control-action-bar" style={{ padding: '15px', borderRadius: '16px', marginBottom: '25px', display: 'flex', gap: '15px', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center' }}>
              
              <div className="segmented-tabs" style={{ background: 'rgba(0,0,0,0.3)', padding: '5px', borderRadius: '12px', display: 'flex', gap: '5px' }}>
                <button 
                  onClick={() => setActiveInterestTab('interested')} 
                  style={{ background: activeInterestTab === 'interested' ? '#8b5cf6' : 'transparent', color: activeInterestTab === 'interested' ? '#0f172a' : '#94a3b8', border: 'none', padding: '10px 20px', fontWeight: 'bold', borderRadius: '8px', cursor: 'pointer', transition: '0.3s' }}
                >
                  Interested ({interestedApplicants.length})
                </button>
                <button 
                  onClick={() => setActiveInterestTab('not_interested')} 
                  style={{ background: activeInterestTab === 'not_interested' ? '#ef4444' : 'transparent', color: activeInterestTab === 'not_interested' ? '#fff' : '#94a3b8', border: 'none', padding: '10px 20px', fontWeight: 'bold', borderRadius: '8px', cursor: 'pointer', transition: '0.3s' }}
                >
                  Not Interested / Opt-Outs ({notInterestedApplicants.length})
                </button>
              </div>

              <div className="filter-group" style={{ flex: 1, maxWidth: '400px' }}>
                <input 
                  type="text" 
                  className="premium-input" 
                  placeholder="Search student, branch, or email..." 
                  value={searchQuery} 
                  onChange={(e) => setSearchQuery(e.target.value)} 
                  style={{ width: '100%' }}
                />
              </div>
            </div>

            <div className="clean-list">
              {filteredApplicants.length === 0 ? (
                <div className="empty-state-card">
                  <span style={{ fontSize: '2.5rem', marginBottom: '10px', display: 'block' }}>🔍</span>
                  {activeInterestTab === 'not_interested' ? 'No students have opted out of this drive.' : 'No interested students found matching your search.'}
                </div>
              ) : (
                filteredApplicants.map((app, i) => {
                  const currStat = String(app.studentStatus || 'Pending / Unknown');
                  let statColor = '#8b5cf6'; let bgAlpha = 'rgba(56, 189, 248, 0.1)';
                  
                  if (activeInterestTab === 'not_interested') { 
                    statColor = '#ef4444'; 
                    bgAlpha = 'rgba(239, 68, 68, 0.1)'; 
                  } else if (currStat.includes('Placed') || currStat.includes('Offer')) { 
                    statColor = '#10b981'; 
                    bgAlpha = 'rgba(16, 185, 129, 0.1)'; 
                  } else if (currStat.includes('Attended')) { 
                    statColor = '#8b5cf6'; 
                    bgAlpha = 'rgba(56, 189, 248, 0.1)'; 
                  }

                  // 🚨 BUG FIX: SAFELY PARSE PHONE NUMBER
                  const phoneStr = String(app.phone || '').replace(/\D/g, '');
                  const waMessage = `Hi ${app.name}, this is regarding the ${selectedDrive.driveId} Placement Drive.`;
                  const waLink = phoneStr ? `https://wa.me/91${phoneStr}?text=${encodeURIComponent(waMessage)}` : '#';

                  return (
                    <div key={i} className="clean-row glass-panel hover-lift" style={{ padding: '20px', borderLeft: `4px solid ${statColor}` }}>
                      
                      <div className="cl-left" style={{ flex: 2, minWidth: '250px' }}>
                        <div className="cl-icon" style={{ background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: '1.2rem', fontWeight: 'bold' }}>
                          {String(app.name || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="cl-title" style={{ fontSize: '1.1rem' }}>{String(app.name || 'Unknown Student')}</div>
                          <div className="cl-sub" style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', marginTop: '4px' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><EnvelopeSimple size={14}/> {String(app.email || 'N/A')}</span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Phone size={14}/> {String(app.phone || 'N/A')}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="cl-middle" style={{ flex: 1.5, minWidth: '200px' }}>
                        <div style={{ color: '#fff', fontWeight: 'bold', fontSize: '0.95rem', marginBottom: '4px' }}>{String(app.branch || 'Unknown Branch')}</div>
                        <div style={{ color: '#94a3b8', fontSize: '0.8rem', marginBottom: '8px' }}>{String(app.course || 'Unknown Course')}</div>
                        <span style={{ background: 'rgba(255,255,255,0.05)', padding: '4px 8px', borderRadius: '6px', fontSize: '0.75rem', color: '#cbd5e1' }}>
                          Registered: {String(app.regDate || 'N/A')}
                        </span>
                      </div>
                      
                      <div className="cl-right" style={{ flex: 1.5, minWidth: '250px', display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'flex-end' }}>
                        
                        <div style={{ display: 'flex', gap: '8px' }}>
                          {phoneStr && (
                            <a href={waLink} target="_blank" rel="noreferrer" style={{ background: 'rgba(34, 197, 94, 0.15)', color: '#22c55e', padding: '8px', borderRadius: '8px', transition: '0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="WhatsApp Student">
                              <WhatsappLogo size={20} weight="fill" />
                            </a>
                          )}
                          {app.email && (
                            <a href={`mailto:${app.email}`} style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', padding: '8px', borderRadius: '8px', transition: '0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Email Student">
                              <EnvelopeSimple size={20} weight="fill" />
                            </a>
                          )}
                          {app.resume && app.resume !== 'N/A' && (
                            <button onClick={() => handleResumeClick(app.resume)} style={{ background: 'rgba(56, 189, 248, 0.15)', border: 'none', cursor: 'pointer', color: '#8b5cf6', padding: '8px', borderRadius: '8px', transition: '0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="View Resume">
                              <FilePdf size={20} weight="fill" />
                            </button>
                          )}
                        </div>

                        {savingRow === app.rowNumber ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#8b5cf6', fontWeight: 'bold' }}>
                            <CircleNotch size={24} className="ph-spin" /> Updating...
                          </div>
                        ) : (
                          <select 
                            className="premium-select" 
                            style={{ 
                              width: '100%', 
                              maxWidth: '220px',
                              background: bgAlpha,
                              color: statColor,
                              border: `1px solid ${statColor}`,
                              fontWeight: 'bold',
                              opacity: canEditDrive(selectedDrive) ? 1 : 0.6,
                              cursor: canEditDrive(selectedDrive) ? 'pointer' : 'not-allowed'
                            }} 
                            value={currStat} 
                            onChange={(e) => updateStudentStatus(app.rowNumber, e.target.value)}
                            disabled={!canEditDrive(selectedDrive)}
                          >
                            <option style={{ color: '#fff' }} value="Pending / Unknown">Pending / Unknown</option>
                            <option style={{ color: '#fff' }} value="Interview Attended">Interview Attended</option>
                            <option style={{ color: '#fff' }} value="Interview Not Attended">Interview Not Attended</option>
                            <option style={{ color: '#fff' }} value="Placed / Got Offer">Placed / Got Offer</option>
                            <option style={{ color: '#fff' }} value="Offer Rejected">Offer Rejected</option>
                            <option style={{ color: '#fff' }} value="Not Interested">Not Interested</option>
                          </select>
                        )}
                      </div>

                    </div>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>

      <style>{`
        .pd-wrapper { font-family: 'Inter', sans-serif; color: #f8fafc; }
        .glass-panel { background: rgba(15, 23, 42, 0.7); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border: 1px solid rgba(255, 255, 255, 0.05); }
        .hover-lift { transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1); }
        .hover-lift:hover { transform: translateY(-4px); box-shadow: 0 20px 40px -10px rgba(0,0,0,0.7); border-color: rgba(255, 255, 255, 0.1); background: rgba(30, 41, 59, 0.8); }
        .top-hero-section { display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; flex-wrap: wrap; gap: 20px; }
        .hero-text h1 { font-size: 2.2rem; font-weight: 800; margin: 0 0 5px 0; color: #fff; }
        .hero-text p { color: #94a3b8; margin: 0; font-size: 1rem; }
        .premium-btn { border: none; padding: 10px 20px; border-radius: 12px; font-weight: bold; font-size: 0.9rem; display: flex; align-items: center; justify-content: center; gap: 8px; transition: 0.2s; cursor: pointer; }
        .premium-btn.secondary { background: rgba(255,255,255,0.05); color: #fff; border: 1px solid rgba(255,255,255,0.1); }
        .control-action-bar { border-radius: 16px; padding: 15px; margin-bottom: 30px; display: flex; align-items: center; }
        .filter-group { display: flex; gap: 12px; flex-wrap: wrap; width: 100%; }
        .premium-input, .premium-select { background: rgba(0,0,0,0.2); color: #fff; border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 12px 15px; font-size: 0.9rem; outline: none; transition: 0.2s; box-sizing: border-box; }
        .premium-input { flex: 1; }
        .premium-input:focus, .premium-select:focus { border-color: #3b82f6; background: rgba(0,0,0,0.4); }
        .premium-select option { background: #0f1523; color: #fff; padding: 10px; font-weight: bold; }
        .empty-state-card { background: rgba(15, 23, 42, 0.5); border: 1px dashed rgba(255,255,255,0.1); border-radius: 16px; padding: 50px 20px; text-align: center; color: #94a3b8; font-size: 1.1rem; font-weight: bold; display: flex; flex-direction: column; align-items: center; }
        .clean-list { display: flex; flex-direction: column; gap: 15px; }
        .clean-row { display: flex; justify-content: space-between; align-items: center; padding: 20px; border-radius: 16px; flex-wrap: wrap; gap: 15px; }
        .cl-left { display: flex; align-items: center; gap: 20px; flex: 2; min-width: 250px; }
        .cl-icon { width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .cl-title { font-size: 1.15rem; font-weight: 800; color: #fff; margin-bottom: 4px; display: flex; align-items: center; }
        .cl-sub { font-size: 0.85rem; color: #94a3b8; font-weight: 500; }
        .cl-middle { display: flex; flex-direction: column; justify-content: center; flex: 1.5; min-width: 200px; }
        .cl-right { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; justify-content: flex-end; flex: 1; min-width: 200px; }
        .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 15px; margin-bottom: 20px; }
        .dash-card { background: #111827; border: 1px solid #1e293b; border-radius: 12px; padding: 20px; display: flex; flex-direction: column; }
        .kpi-header { display: flex; align-items: center; gap: 15px; }
        .icon-c { width: 48px; height: 48px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .icon-c.blue { background: rgba(59, 130, 246, 0.1); color: #3b82f6; }
        .icon-c.green { background: rgba(16, 185, 129, 0.1); color: #10b981; }
        .icon-c.purple { background: rgba(168, 85, 247, 0.1); color: #a855f7; }
        .icon-c.orange { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }
        .kpi-title { font-size: 0.8rem; color: #94a3b8; margin-bottom: 2px; text-transform: uppercase; font-weight: bold; letter-spacing: 0.5px; }
        .kpi-val { font-size: 1.8rem; font-weight: 900; color: #fff; line-height: 1; }
        .grid-3-col { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 20px; }
        .dashboard-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px; }
        .dash-title { font-size: 2rem; margin: 0; color: #fff; }
      `}</style>
    </Layout>
  );
}