import { useEffect, useState } from 'react';
import axios from 'axios';
import { CircleNotch, CaretLeft, Files, MagnifyingGlass, FilePdf } from '@phosphor-icons/react';
import Layout from './Layout';

const API_BASE = "https://ipcs-tpo-portal.onrender.com";

// Vibrant color palette for the Avodha-style Branch Tiles
const TILE_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#0ea5e9', '#f43f5e'];

export default function Applications() {
  const tpoData = JSON.parse(localStorage.getItem('tpoData'));
  
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // View State Management (Dual-View)
  const [selectedBranch, setSelectedBranch] = useState(null);
  
  // Directory Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [courseFilter, setCourseFilter] = useState('All Courses');

  // Modal State for updating application status
  const [selectedApp, setSelectedApp] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [updateStatus, setUpdateStatus] = useState('');

  useEffect(() => {
    if (tpoData) fetchApplications();
  }, [tpoData]);

  const fetchApplications = async () => {
    try {
      const res = await axios.post(`${API_BASE}/api/tpo/applications`, { 
        assignedBranchesArray: tpoData.assignedBranchesArray,
        tpoName: tpoData.name 
      });
      if (res.data.success) {
        setApplications(res.data.applications);
      }
    } catch (err) {
      console.error("Failed to fetch applications:", err);
    } finally {
      setLoading(false);
    }
  };

  const saveApplicationUpdate = async () => {
    setUpdating(true);
    try {
      const formData = new FormData();
      formData.append('rowNumber', selectedApp.rowNumber);
      formData.append('status', updateStatus);
      formData.append('fullApp', JSON.stringify(selectedApp));

      const res = await axios.post(`${API_BASE}/api/tpo/applications/update`, formData);
      if(res.data.success) {
        const updatedApps = applications.map(app => app.rowNumber === selectedApp.rowNumber ? { ...app, status: updateStatus } : app);
        setApplications(updatedApps);
        setIsModalOpen(false);
      }
    } catch (err) {
      alert("Failed to update status");
    } finally {
      setUpdating(false);
    }
  };

  // ==========================================
  // DATA PROCESSING FOR BRANCH TILES
  // ==========================================
  const branchData = {};
  applications.forEach(app => {
    const branchName = app.branch || 'Unknown Branch';
    if (!branchData[branchName]) branchData[branchName] = 0;
    branchData[branchName]++;
  });
  
  const branchList = Object.keys(branchData).sort();

  // ==========================================
  // DATA PROCESSING FOR SELECTED BRANCH
  // ==========================================
  const activeApps = selectedBranch ? applications.filter(a => a.branch === selectedBranch) : [];
  const uniqueCourses = ['All Courses', ...new Set(activeApps.map(a => a.course).filter(Boolean))];

  let filteredApps = activeApps.filter(app => {
    const matchesSearch = (app.name && app.name.toLowerCase().includes(searchQuery.toLowerCase())) || 
                          (app.company && app.company.toLowerCase().includes(searchQuery.toLowerCase())) ||
                          (app.jobId && app.jobId.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCourse = courseFilter === 'All Courses' || app.course === courseFilter;
    return matchesSearch && matchesCourse;
  });

  // Always show newest applications first
  filteredApps.reverse();

  // Helper to format the status badge colors based on your screenshot
  const getStatusBadge = (status) => {
    const s = (status || 'APPLIED').toUpperCase();
    if (s.includes('PLACED') || s.includes('JOINED')) {
      return { bg: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '#10b981' };
    }
    if (s.includes('REJECTED')) {
      return { bg: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '#ef4444' };
    }
    return { bg: 'rgba(14, 165, 233, 0.1)', color: '#0ea5e9', border: '#0ea5e9' }; // Default Applied Blue
  };


  // ==========================================
  // RENDER: VIEW 1 - AVODHA STYLE BRANCH TILES
  // ==========================================
  if (!selectedBranch) {
    return (
      <Layout>
        <div className="page-container" style={{ padding: 0 }}>
          <h1 style={{ fontSize: '2.2rem', marginBottom: '5px', textAlign: 'center', marginTop: '20px' }}>Which branch's applications?</h1>
          <p style={{ color: 'var(--text-muted)', marginBottom: '3rem', textAlign: 'center' }}>Select an assigned branch to view all job applications submitted by its students.</p>
          
          {loading ? (
            <div style={{ textAlign: 'center', marginTop: '4rem', color: '#3b82f6' }}><CircleNotch size={50} className="ph-spin" /></div>
          ) : branchList.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}>No applications found in your assigned branches.</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '30px', padding: '0 20px' }}>
              {branchList.map((branch, index) => {
                const color = TILE_COLORS[index % TILE_COLORS.length];
                return (
                  <div 
                    key={branch} 
                    onClick={() => setSelectedBranch(branch)}
                    style={{ backgroundColor: color, borderRadius: '24px', padding: '40px 20px', cursor: 'pointer', textAlign: 'center', minHeight: '220px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', transition: 'transform 0.2s ease, box-shadow 0.2s ease' }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-5px)'; e.currentTarget.style.boxShadow = '0 15px 35px rgba(0,0,0,0.3)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 10px 25px rgba(0,0,0,0.2)'; }}
                  >
                    <h2 style={{ color: '#ffffff', fontSize: '2.2rem', margin: '0 0 10px 0', textShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>
                      {branch}
                    </h2>
                    <div style={{ background: 'rgba(255,255,255,0.2)', padding: '8px 16px', borderRadius: '30px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Files size={20} color="#ffffff" weight="bold" />
                      <span style={{ color: '#ffffff', fontSize: '1.1rem', fontWeight: 'bold' }}>{branchData[branch]} Applications</span>
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

  // ==========================================
  // RENDER: VIEW 2 - DETAILED APPLICATIONS LIST
  // ==========================================
  return (
    <Layout>
      <div className="page-container" style={{ padding: 0 }}>
        
        {/* Navigation Header */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '25px', gap: '15px' }}>
          <button 
            onClick={() => setSelectedBranch(null)} 
            style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', color: '#fff', padding: '10px 15px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
          >
            <CaretLeft weight="bold" size={18} /> Back to Branches
          </button>
        </div>

        <h1 style={{ fontSize: '2rem', marginBottom: '5px', color: '#fff' }}>Student Applications</h1>
        <p style={{ color: '#3b82f6', background: 'rgba(59, 130, 246, 0.15)', padding: '4px 12px', borderRadius: '4px', display: 'inline-block', marginBottom: '2rem', fontWeight: 'bold' }}>
          A flat view of all applications submitted by students in {selectedBranch}.
        </p>

        {/* Filters matching the screenshot */}
        <div style={{ display: 'flex', gap: '15px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '250px', maxWidth: '350px' }}>
            <MagnifyingGlass size={18} style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input type="text" className="sleek-input" placeholder="Search student or company..." style={{ width: '100%', paddingLeft: '45px', background: 'var(--card-bg)', border: '1px solid var(--card-border)' }} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
          
          <select className="sleek-input" style={{ width: '200px', background: 'var(--card-bg)', border: '1px solid var(--card-border)' }} value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)}>
            {uniqueCourses.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Application List (Styled exactly like the screenshot) */}
        <div style={{ width: '100%', overflowX: 'auto' }}>
          
          {/* Table Header */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1.5fr 1fr 1fr 1fr', padding: '10px 20px', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            <div>STUDENT</div>
            <div>APPLIED JOB</div>
            <div>DATE</div>
            <div>TPO NAME</div>
            <div>STATUS</div>
          </div>

          {filteredApps.length > 0 ? filteredApps.map((app, idx) => {
            const badge = getStatusBadge(app.status);
            return (
              <div 
                key={idx} 
                onClick={() => { setSelectedApp(app); setUpdateStatus(app.status || 'Applied'); setIsModalOpen(true); }}
                style={{ 
                  display: 'grid', gridTemplateColumns: '1.5fr 1.5fr 1fr 1fr 1fr', alignItems: 'center', 
                  background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '12px', 
                  padding: '16px 20px', marginBottom: '10px', cursor: 'pointer', transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#1e293b'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'var(--card-bg)'}
              >
                <div>
                  <div style={{ fontWeight: 'bold', color: '#fff', fontSize: '1rem', marginBottom: '4px' }}>{app.name || 'Unknown'}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{app.roll || 'N/A'}</div>
                </div>
                <div>
                  <div style={{ fontWeight: 'bold', color: '#fff', fontSize: '0.95rem', marginBottom: '4px' }}>{app.jobId || 'N/A'}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{app.company || 'Unknown Company'}</div>
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  {app.date ? app.date.split(',')[0] : 'N/A'}
                </div>
                <div style={{ fontWeight: 'bold', color: '#fff', fontSize: '0.9rem' }}>
                  {app.tpoName || 'Not Assigned'}
                </div>
                <div>
                  <span style={{ 
                    background: badge.bg, color: badge.color, border: `1px solid ${badge.border}`, 
                    padding: '4px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 'bold' 
                  }}>
                    {(app.status || 'APPLIED').toUpperCase()}
                  </span>
                </div>
              </div>
            );
          }) : (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', background: 'var(--card-bg)', borderRadius: '12px', border: '1px solid var(--card-border)' }}>
              No applications match your search.
            </div>
          )}
        </div>
      </div>

      {/* MODAL FOR UPDATING APPLICATION STATUS */}
      {isModalOpen && selectedApp && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 99999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }} onClick={(e) => { if(e.target === e.currentTarget) setIsModalOpen(false); }}>
          <div className="modal-card" style={{ maxWidth: '500px', width: '100%', background: '#0f1523', border: '1px solid var(--card-border)', borderRadius: '16px', padding: '2rem' }}>
            <h2 style={{ margin: '0 0 1.5rem 0', fontSize: '1.4rem' }}>Update Application</h2>
            
            <div style={{ marginBottom: '1.5rem', background: '#161e2e', padding: '15px', borderRadius: '8px', border: '1px solid #1e293b' }}>
              <div style={{ marginBottom: '8px' }}><span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Student:</span> <strong style={{ color: '#fff' }}>{selectedApp.name}</strong></div>
              <div><span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Company:</span> <strong style={{ color: '#fff' }}>{selectedApp.company}</strong></div>
            </div>

            <label className="data-label" style={{ display: 'block', marginBottom: '8px' }}>Application Status</label>
            <select className="sleek-input" style={{ width: '100%', marginBottom: '1.5rem' }} value={updateStatus} onChange={e => setUpdateStatus(e.target.value)}>
              <option value="Applied">Applied</option>
              <option value="Interviewing">Interviewing</option>
              <option value="Placed">Placed</option>
              <option value="Rejected">Rejected</option>
            </select>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setIsModalOpen(false)}>Cancel</button>
              <button className="btn-action" style={{ flex: 1, background: '#3b82f6', color: '#fff' }} onClick={saveApplicationUpdate} disabled={updating}>
                {updating ? <CircleNotch size={20} className="ph-spin" /> : "Save Status"}
              </button>
            </div>
          </div>
        </div>
      )}

    </Layout>
  );
}