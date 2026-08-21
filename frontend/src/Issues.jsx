import { useEffect, useState } from 'react';
import axios from 'axios';
import { CircleNotch, FloppyDisk, CheckCircle, Headset, CaretLeft } from '@phosphor-icons/react';
import Layout from './Layout';

const API_BASE = "https://ipcs-tpo-portal.onrender.com";
const TILE_COLORS = ['#ec4899', '#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#0ea5e9', '#f43f5e'];

export default function Issues() {
  const tpoData = JSON.parse(localStorage.getItem('tpoData'));
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);

  // View State Management (Dual-View)
  const [selectedBranch, setSelectedBranch] = useState(null);

  // Track local edits before saving
  const [localEdits, setLocalEdits] = useState({});
  const [savingStatus, setSavingStatus] = useState({});

  useEffect(() => {
    if (!tpoData) return;
    const fetchIssues = async () => {
      try {
        const response = await axios.post(`${API_BASE}/api/tpo/issues`, {
          assignedBranchesArray: tpoData.assignedBranchesArray
        });
        if (response.data.success) {
          setIssues(response.data.issues);
        }
      } catch (error) { console.error("Failed", error); } finally { setLoading(false); }
    };
    fetchIssues();
  }, [tpoData]);

  const handleEditChange = (rowNumber, field, value) => {
    setLocalEdits(prev => ({
      ...prev,
      [rowNumber]: {
        ...prev[rowNumber],
        [field]: value
      }
    }));
  };

  const saveIssue = async (issue) => {
    const rowNum = issue.rowNumber;
    const edits = localEdits[rowNum] || {};
    const newStatus = edits.status !== undefined ? edits.status : issue.status;
    const newRemarks = edits.remarks !== undefined ? edits.remarks : issue.remarks;

    setSavingStatus(prev => ({ ...prev, [rowNum]: 'saving' }));

    try {
      const response = await axios.post(`${API_BASE}/api/tpo/issues/update`, {
        rowNumber: rowNum,
        status: newStatus,
        remarks: newRemarks
      });

      if (response.data.success) {
        setSavingStatus(prev => ({ ...prev, [rowNum]: 'success' }));
        setTimeout(() => setSavingStatus(prev => ({ ...prev, [rowNum]: null })), 2000);
        
        // Update local state to reflect successful save
        setIssues(issues.map(i => i.rowNumber === rowNum ? { ...i, status: newStatus, remarks: newRemarks } : i));
      }
    } catch (error) {
      console.error("Save failed", error);
      setSavingStatus(prev => ({ ...prev, [rowNum]: 'error' }));
      alert("Failed to save. Check server logs.");
    }
  };

  // ==========================================
  // DATA PROCESSING FOR BRANCH TILES
  // ==========================================
  const branchData = {};
  let totalPending = 0;
  
  issues.forEach(issue => {
    const branchName = issue.branch || 'Unknown Branch';
    if (!branchData[branchName]) branchData[branchName] = { total: 0, pending: 0 };
    
    branchData[branchName].total++;
    if ((issue.status || '').toLowerCase() === 'pending') {
      branchData[branchName].pending++;
      totalPending++;
    }
  });
  
  const branchList = Object.keys(branchData).sort();

  // ==========================================
  // DATA PROCESSING FOR SELECTED BRANCH
  // ==========================================
  const activeIssues = selectedBranch ? issues.filter(i => i.branch === selectedBranch) : [];

  // ==========================================
  // RENDER: VIEW 1 - AVODHA STYLE BRANCH TILES
  // ==========================================
  if (!selectedBranch) {
    return (
      <Layout>
        <div className="page-container" style={{ padding: 0 }}>
          <h1 style={{ fontSize: '2.2rem', marginBottom: '5px', textAlign: 'center', marginTop: '20px' }}>Which branch's issues?</h1>
          <p style={{ color: 'var(--text-muted)', marginBottom: '3rem', textAlign: 'center' }}>
            Select an assigned branch to view and resolve student complaints. <br/>
            <span style={{ color: totalPending > 0 ? '#ef4444' : '#10b981', fontWeight: 'bold' }}>You have {totalPending} pending issue(s) across all branches.</span>
          </p>
          
          {loading ? (
            <div style={{ textAlign: 'center', marginTop: '4rem', color: '#ec4899' }}><CircleNotch size={50} className="ph-spin" /></div>
          ) : branchList.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              <Headset size={48} style={{ opacity: 0.5, marginBottom: '15px' }}/><br/>
              No issues reported in any of your assigned branches!
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '30px', padding: '0 20px' }}>
              {branchList.map((branch, index) => {
                const color = TILE_COLORS[index % TILE_COLORS.length];
                const pendingCount = branchData[branch].pending;
                return (
                  <div 
                    key={branch} 
                    onClick={() => setSelectedBranch(branch)}
                    style={{ backgroundColor: color, borderRadius: '24px', padding: '40px 20px', cursor: 'pointer', textAlign: 'center', minHeight: '220px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', transition: 'transform 0.2s ease, box-shadow 0.2s ease', position: 'relative' }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-5px)'; e.currentTarget.style.boxShadow = '0 15px 35px rgba(0,0,0,0.3)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 10px 25px rgba(0,0,0,0.2)'; }}
                  >
                    {/* Alert Dot for Pending Issues */}
                    {pendingCount > 0 && (
                      <div style={{ position: 'absolute', top: '20px', right: '20px', background: '#fff', color: color, padding: '4px 10px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                        {pendingCount} Pending
                      </div>
                    )}

                    <h2 style={{ color: '#ffffff', fontSize: '2.2rem', margin: '0 0 10px 0', textShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>
                      {branch}
                    </h2>
                    <div style={{ background: 'rgba(255,255,255,0.2)', padding: '8px 16px', borderRadius: '30px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Headset size={20} color="#ffffff" weight="bold" />
                      <span style={{ color: '#ffffff', fontSize: '1.1rem', fontWeight: 'bold' }}>{branchData[branch].total} Total Issues</span>
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
  // RENDER: VIEW 2 - DETAILED ISSUES TABLE
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
          <div>
            <h1 style={{ fontSize: '1.8rem', margin: 0 }}>{selectedBranch} Issues</h1>
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>Manage and resolve student complaints for this branch.</p>
          </div>
        </div>

        {/* EXACT ORIGINAL TABLE RENDERER */}
        <div className="table-container">
          <table className="modern-table">
            <thead>
              <tr>
                <th>Student Details</th>
                <th>Issue Details</th>
                <th>Status</th>
                <th>Remarks</th>
                <th style={{ textAlign: 'center' }}>Save</th>
              </tr>
            </thead>
            <tbody>
              {activeIssues.length === 0 ? (
                <tr><td colSpan="5" style={{ textAlign: 'center', padding: '2rem' }}><Headset size={24} style={{ display: 'block', margin: '0 auto 10px', color: 'var(--text-muted)' }}/> No issues reported in this branch.</td></tr>
              ) : (
                activeIssues.map((issue, i) => {
                  const rowEdits = localEdits[issue.rowNumber] || {};
                  const currentStatus = rowEdits.status !== undefined ? rowEdits.status : issue.status;
                  const currentRemarks = rowEdits.remarks !== undefined ? rowEdits.remarks : issue.remarks;
                  const btnStatus = savingStatus[issue.rowNumber];

                  return (
                    <tr key={i}>
                      <td>
                        <span className="primary-text" style={{ color: '#fff', fontWeight: 'bold' }}>{issue.name}</span>
                        <span className="sub-text" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{issue.branch}</span>
                      </td>
                      <td style={{ maxWidth: '300px', whiteSpace: 'normal', lineHeight: '1.4', color: '#cbd5e1' }}>{issue.details}</td>
                      <td>
                        <select 
                          className="sleek-select" 
                          style={{ padding: '6px', width: '100%', borderRadius: '6px' }}
                          value={currentStatus}
                          onChange={(e) => handleEditChange(issue.rowNumber, 'status', e.target.value)}
                        >
                          <option value="Pending">Pending</option>
                          <option value="Resolved">Resolved</option>
                        </select>
                      </td>
                      <td>
                        <input 
                          type="text" 
                          placeholder="Remarks..." 
                          className="sleek-input" 
                          style={{ padding: '6px', width: '100%' }}
                          value={currentRemarks}
                          onChange={(e) => handleEditChange(issue.rowNumber, 'remarks', e.target.value)}
                        />
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button 
                          className="btn-action" 
                          style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', background: btnStatus === 'success' ? '#10b981' : '#38bdf8' }}
                          onClick={() => saveIssue(issue)}
                          disabled={btnStatus === 'saving'}
                        >
                          {btnStatus === 'saving' ? <CircleNotch size={16} className="ph-spin" /> : 
                           btnStatus === 'success' ? <CheckCircle size={16} weight="fill" /> : 
                           <FloppyDisk size={16} weight="bold" color="#0f172a" />}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

      </div>
    </Layout>
  );
}