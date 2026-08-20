import { useEffect, useState } from 'react';
import axios from 'axios';
import { CircleNotch, FloppyDisk, CheckCircle, Headset } from '@phosphor-icons/react';
import Layout from './Layout';

export default function Issues() {
  const tpoData = JSON.parse(localStorage.getItem('tpoData'));
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);

  // Track local edits before saving
  const [localEdits, setLocalEdits] = useState({});
  const [savingStatus, setSavingStatus] = useState({});

  useEffect(() => {
    if (!tpoData) return;
    const fetchIssues = async () => {
      try {
        const response = await axios.post('http://localhost:5000/api/tpo/issues', {
          assignedBranchesArray: tpoData.assignedBranchesArray
        });
        if (response.data.success) {
          setIssues(response.data.issues);
        }
      } catch (error) { console.error("Failed", error); } finally { setLoading(false); }
    };
    fetchIssues();
  }, []);

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
      const response = await axios.post('http://localhost:5000/api/tpo/issues/update', {
        rowNumber: rowNum,
        status: newStatus,
        remarks: newRemarks
      });

      if (response.data.success) {
        setSavingStatus(prev => ({ ...prev, [rowNum]: 'success' }));
        setTimeout(() => setSavingStatus(prev => ({ ...prev, [rowNum]: null })), 2000);
      }
    } catch (error) {
      console.error("Save failed", error);
      setSavingStatus(prev => ({ ...prev, [rowNum]: 'error' }));
      alert("Failed to save. Check server logs.");
    }
  };

  return (
    <Layout>
      <div className="page-container">
        <h1 style={{ fontSize: '1.8rem', marginBottom: '5px' }}>Student Issues</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Manage and resolve issues reported by students in your branch.</p>

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
              {loading ? (
                <tr><td colSpan="5" style={{ textAlign: 'center', padding: '2rem' }}><CircleNotch size={24} className="ph-spin" /> Fetching issues...</td></tr>
              ) : issues.length === 0 ? (
                <tr><td colSpan="5" style={{ textAlign: 'center', padding: '2rem' }}><Headset size={24} style={{ display: 'block', margin: '0 auto 10px', color: 'var(--text-muted)' }}/> No issues reported in your branches.</td></tr>
              ) : (
                issues.map((issue, i) => {
                  const rowEdits = localEdits[issue.rowNumber] || {};
                  const currentStatus = rowEdits.status !== undefined ? rowEdits.status : issue.status;
                  const currentRemarks = rowEdits.remarks !== undefined ? rowEdits.remarks : issue.remarks;
                  const btnStatus = savingStatus[issue.rowNumber];

                  return (
                    <tr key={i}>
                      <td>
                        <span className="primary-text">{issue.name}</span>
                        <span className="sub-text">{issue.branch}</span>
                      </td>
                      <td style={{ maxWidth: '300px', whiteSpace: 'normal', lineHeight: '1.4' }}>{issue.details}</td>
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
                          style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', background: btnStatus === 'success' ? 'var(--accent-success)' : 'var(--accent-primary)' }}
                          onClick={() => saveIssue(issue)}
                          disabled={btnStatus === 'saving'}
                        >
                          {btnStatus === 'saving' ? <CircleNotch size={16} className="ph-spin" /> : 
                           btnStatus === 'success' ? <CheckCircle size={16} weight="fill" /> : 
                           <FloppyDisk size={16} weight="bold" />}
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