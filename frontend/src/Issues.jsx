import { useEffect, useState } from 'react';
import axios from 'axios';
import { CircleNotch, FloppyDisk, CheckCircle, Headset, CaretLeft, User, WarningCircle } from '@phosphor-icons/react';
import Layout from './Layout';

import { API_BASE } from './apiConfig';

export default function Issues() {
  // 🚨 SAFE PARSING: Prevents crash if localStorage is empty
  const [tpoData] = useState(() => {
    try { return JSON.parse(localStorage.getItem('tpoData')); } catch (e) { return null; }
  });
  
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
          assignedBranchesArray: tpoData.assignedBranchesArray || [],
          role: tpoData.role,
          assignedCourse: tpoData.assignedCourse
        });
        if (response.data.success) {
          // 🚨 SAFE FALLBACK: Guarantees an array is always set
          setIssues(response.data.issues || []);
        }
      } catch (error) { 
        console.error("Failed to fetch issues", error); 
      } finally { 
        setLoading(false); 
      }
    };
    fetchIssues();
  }, [tpoData]);

  const handleEditChange = (rowNumber, field, value) => {
    setLocalEdits(prev => ({
      ...prev,
      [rowNumber]: { ...prev[rowNumber], [field]: value }
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
        setIssues((prevIssues) => prevIssues.map(i => i.rowNumber === rowNum ? { ...i, status: newStatus, remarks: newRemarks } : i));
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
  
  // 🚨 SAFE ITERATION: Prevents the fatal blank screen crash
  (issues || []).forEach(issue => {
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
  const activeIssues = selectedBranch ? (issues || []).filter(i => i.branch === selectedBranch) : [];

  // ==========================================
  // RENDER: VIEW 1 - PREMIUM BRANCH TILES
  // ==========================================
  if (!selectedBranch) {
    return (
      <Layout>
        <div className="page-container" style={{ padding: 0 }}>
          
          <div className="hero-section">
            <h1 className="hero-title">Issue Resolution Center</h1>
            <p className="hero-subtitle">Select an assigned branch to view and resolve student complaints.</p>
            
            {totalPending > 0 ? (
              <div className="status-badge alert">
                <WarningCircle size={18} weight="fill" /> You have {totalPending} pending issue(s) awaiting resolution.
              </div>
            ) : (
              <div className="status-badge success">
                <CheckCircle size={18} weight="fill" /> All issues across your branches are currently resolved.
              </div>
            )}
          </div>
          
          {loading ? (
            <div style={{ textAlign: 'center', marginTop: '4rem', color: '#8b5cf6' }}><CircleNotch size={50} className="ph-spin" /></div>
          ) : branchList.length === 0 ? (
            <div className="empty-state">
              <Headset size={56} weight="thin" />
              <p>No issues reported in any of your assigned branches!</p>
            </div>
          ) : (
            <div className="branch-grid">
              {branchList.map((branch) => {
                const pendingCount = branchData[branch].pending;
                return (
                  <div 
                    key={branch} 
                    className="branch-tile"
                    onClick={() => setSelectedBranch(branch)}
                  >
                    {pendingCount > 0 && (
                      <div className="pending-indicator">
                        {pendingCount} Pending
                      </div>
                    )}

                    <h2 className="branch-name">{branch}</h2>
                    <div className="branch-stats">
                      <Headset size={18} weight="bold" />
                      <span>{branchData[branch].total} Total Issues</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <style>{`
          .hero-section { text-align: center; margin: 20px 0 40px 0; }
          .hero-title { font-size: 2.2rem; color: #fff; font-weight: 800; margin: 0 0 10px 0; }
          .hero-subtitle { color: #94a3b8; font-size: 1.05rem; margin: 0 0 20px 0; }
          
          .status-badge { display: inline-flex; align-items: center; gap: 8px; padding: 8px 16px; border-radius: 20px; font-size: 0.9rem; font-weight: bold; }
          .status-badge.alert { background: rgba(239, 68, 68, 0.15); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.3); }
          .status-badge.success { background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); }

          .empty-state { text-align: center; padding: 5rem 2rem; color: #64748b; }
          .empty-state p { font-size: 1.1rem; margin-top: 15px; }

          .branch-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 25px; padding: 0 10px; }
          
          .branch-tile {
            background: #111827;
            border: 1px solid #1e293b;
            border-radius: 24px;
            padding: 40px 20px;
            cursor: pointer;
            text-align: center;
            min-height: 200px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            position: relative;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            box-shadow: 0 10px 25px rgba(0,0,0,0.3);
          }
          .branch-tile:hover {
            background: #161e2e;
            border-color: #8b5cf6;
            transform: translateY(-5px);
            box-shadow: 0 15px 35px -10px rgba(139, 92, 246, 0.4);
          }

          .pending-indicator {
            position: absolute;
            top: 20px;
            right: 20px;
            background: #ef4444;
            color: #fff;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 0.75rem;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            box-shadow: 0 4px 10px rgba(239, 68, 68, 0.4);
          }

          .branch-name {
            color: #fff;
            font-size: 2rem;
            font-weight: 800;
            margin: 0 0 15px 0;
          }

          .branch-stats {
            background: rgba(139, 92, 246, 0.1);
            color: #a855f7;
            padding: 8px 16px;
            border-radius: 30px;
            display: flex;
            align-items: center;
            gap: 8px;
            font-weight: bold;
            font-size: 0.95rem;
            border: 1px solid rgba(139, 92, 246, 0.2);
          }
        `}</style>
      </Layout>
    );
  }

  // ==========================================
  // RENDER: VIEW 2 - PREMIUM DETAILED ISSUES GRID
  // ==========================================
  return (
    <Layout>
      <div className="page-container" style={{ padding: 0 }}>
        
        {/* Navigation Header */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '30px', gap: '20px' }}>
          <button 
            onClick={() => setSelectedBranch(null)} 
            className="back-btn"
          >
            <CaretLeft weight="bold" size={18} /> Back to Branches
          </button>
          <div>
            <h1 style={{ fontSize: '1.8rem', margin: '0 0 5px 0', color: '#fff' }}>{selectedBranch} Issues</h1>
            <p style={{ color: '#94a3b8', margin: 0, fontSize: '0.95rem' }}>Manage and resolve student complaints for this branch.</p>
          </div>
        </div>

        {/* 🚨 PREMIUM CSS GRID LAYOUT */}
        <div className="issue-grid-container">
          
          <div className="issue-grid-header">
            <span>Student Details</span>
            <span>Issue Reported</span>
            <span>Status</span>
            <span>Remarks Log</span>
            <span style={{ textAlign: 'center' }}>Action</span>
          </div>

          <div className="issue-list">
            {activeIssues.length === 0 ? (
              <div className="empty-state" style={{ padding: '3rem', background: '#111827', borderRadius: '16px', border: '1px solid #1e293b' }}>
                <CheckCircle size={48} color="#10b981" style={{ marginBottom: '10px' }}/>
                <p style={{ margin: 0, color: '#94a3b8' }}>All issues are resolved for this branch!</p>
              </div>
            ) : (
              activeIssues.map((issue, i) => {
                const rowEdits = localEdits[issue.rowNumber] || {};
                const currentStatus = rowEdits.status !== undefined ? rowEdits.status : issue.status;
                const currentRemarks = rowEdits.remarks !== undefined ? rowEdits.remarks : issue.remarks;
                const btnStatus = savingStatus[issue.rowNumber];

                return (
                  <div key={i} className="issue-card hover-lift">
                    
                    {/* COL 1: Student Details */}
                    <div className="col-student">
                      <div className="stu-name">
                        <User size={16} color="#8b5cf6" weight="bold" /> {issue.name}
                      </div>
                      <div className="stu-branch">{issue.branch}</div>
                    </div>
                    
                    {/* COL 2: Issue Description */}
                    <div className="col-desc">
                      {issue.details}
                    </div>
                    
                    {/* COL 3: Status Dropdown */}
                    <div className="col-status">
                      <select 
                        className="issue-select" 
                        value={currentStatus}
                        onChange={(e) => handleEditChange(issue.rowNumber, 'status', e.target.value)}
                      >
                        <option value="Pending">Pending</option>
                        <option value="Resolved">Resolved</option>
                      </select>
                    </div>
                    
                    {/* COL 4: Remarks Input */}
                    <div className="col-remarks">
                      <input 
                        type="text" 
                        placeholder="Add resolution notes..." 
                        className="issue-input" 
                        value={currentRemarks}
                        onChange={(e) => handleEditChange(issue.rowNumber, 'remarks', e.target.value)}
                      />
                    </div>
                    
                    {/* COL 5: Save Action */}
                    <div className="col-action">
                      <button 
                        className={`issue-save-btn ${btnStatus === 'success' ? 'success' : ''}`}
                        onClick={() => saveIssue(issue)}
                        disabled={btnStatus === 'saving'}
                      >
                        {btnStatus === 'saving' ? <CircleNotch size={18} className="ph-spin" /> : 
                         btnStatus === 'success' ? <CheckCircle size={18} weight="bold" /> : 
                         <><FloppyDisk size={18} weight="bold" /> Save</>}
                      </button>
                    </div>

                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

      <style>{`
        .back-btn {
          background: #111827;
          border: 1px solid #1e293b;
          color: #e2e8f0;
          padding: 10px 16px;
          border-radius: 10px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          font-weight: 600;
          transition: all 0.2s;
        }
        .back-btn:hover { background: #1e293b; color: #fff; border-color: #334155; }

        .issue-grid-container { width: 100%; }

        .issue-grid-header {
          display: grid;
          grid-template-columns: 2fr 3fr 1.5fr 2.5fr 1fr;
          gap: 15px;
          padding: 0 20px 12px 20px;
          font-size: 0.75rem;
          font-weight: 800;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .issue-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .issue-card {
          display: grid;
          grid-template-columns: 2fr 3fr 1.5fr 2.5fr 1fr;
          gap: 15px;
          background: #111827;
          border: 1px solid #1e293b;
          border-radius: 16px;
          padding: 20px;
          align-items: center;
          transition: 0.2s ease;
        }
        .issue-card.hover-lift:hover {
          border-color: rgba(139, 92, 246, 0.4);
          transform: translateY(-2px);
          box-shadow: 0 10px 20px -10px rgba(0,0,0,0.5);
        }

        .stu-name {
          color: #fff;
          font-size: 1.05rem;
          font-weight: 700;
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 4px;
        }
        .stu-branch {
          color: #94a3b8;
          font-size: 0.85rem;
          margin-left: 22px;
        }

        .col-desc {
          color: #cbd5e1;
          font-size: 0.9rem;
          line-height: 1.5;
          white-space: normal;
          word-wrap: break-word;
        }

        .issue-input, .issue-select {
          width: 100%;
          background: #09090e;
          border: 1px solid #1e293b;
          color: #f8fafc;
          padding: 10px 14px;
          border-radius: 8px;
          font-size: 0.9rem;
          outline: none;
          transition: all 0.2s ease;
          box-sizing: border-box;
        }
        .issue-input:focus, .issue-select:focus {
          border-color: #8b5cf6;
          box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.15);
        }

        .issue-save-btn {
          width: 100%;
          background: #8b5cf6;
          color: #ffffff;
          border: none;
          padding: 10px 16px;
          border-radius: 8px;
          font-weight: 800;
          font-size: 0.85rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          transition: all 0.2s;
        }
        .issue-save-btn:hover:not(:disabled) {
          background: #7c3aed;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(139, 92, 246, 0.4);
        }
        .issue-save-btn:disabled { opacity: 0.7; cursor: not-allowed; }
        .issue-save-btn.success { background: #10b981; color: #fff; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4); }

        /* Responsive Breakpoints */
        @media (max-width: 1024px) {
          .issue-grid-header { display: none; }
          .issue-card {
            grid-template-columns: 1fr;
            gap: 15px;
          }
          .stu-branch { margin-left: 0; }
        }
      `}</style>
    </Layout>
  );
}