import { useEffect, useState } from 'react';
import axios from 'axios';
import { CircleNotch } from '@phosphor-icons/react';
import Layout from './Layout';

export default function Talentino() {
  const tpoData = JSON.parse(localStorage.getItem('tpoData'));
  const [data, setData] = useState({ dates: [], records: [] });
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState('All');

  useEffect(() => {
    if (!tpoData) return;
    const fetchTalentino = async () => {
      try {
        const response = await axios.post('http://localhost:5000/api/tpo/talentino', {
          assignedBranchesArray: tpoData.assignedBranchesArray
        });
        if (response.data.success) {
          setData({ dates: response.data.dates, records: response.data.records });
        }
      } catch (error) { console.error("Failed", error); } finally { setLoading(false); }
    };
    fetchTalentino();
  }, []);

  const filteredRecords = data.records.filter(r => dateFilter === 'All' || r.date.includes(dateFilter));

  return (
    <Layout>
      <div className="page-container">
        <h1 style={{ fontSize: '1.8rem', marginBottom: '5px' }}>Talentino Tracker</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>View student attendance records strictly for your assigned branches.</p>

        <div className="header-controls" style={{ justifyContent: 'flex-start' }}>
          <select className="sleek-select" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}>
            <option value="All">All Dates</option>
            {data.dates.map((d, i) => <option key={i} value={d}>{d}</option>)}
          </select>
          <div style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            {filteredRecords.length} records found
          </div>
        </div>

        <div className="table-container">
          <table className="modern-table">
            <thead>
              <tr><th>Student</th><th>Branch</th><th>Date</th><th>Rating</th><th>Notes</th></tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="5" style={{ textAlign: 'center', padding: '2rem' }}><CircleNotch size={24} className="ph-spin" /> Fetching data...</td></tr>
              ) : filteredRecords.length === 0 ? (
                <tr><td colSpan="5" style={{ textAlign: 'center', padding: '2rem' }}>No records found.</td></tr>
              ) : (
                filteredRecords.map((r, i) => (
                  <tr key={i}>
                    <td><span className="primary-text">{r.name}</span></td>
                    <td>{r.branch}</td>
                    <td>{r.date.split(' ')[0]}</td>
                    <td><span className="badge badge-warning">{r.rating}</span></td>
                    <td>{r.notes}</td>
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