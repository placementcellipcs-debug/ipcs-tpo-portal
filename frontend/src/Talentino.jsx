import { useEffect, useState } from 'react';
import axios from 'axios';
import { CircleNotch, CaretLeft, MagnifyingGlass, Star, GraduationCap } from '@phosphor-icons/react';
import Layout from './Layout';

import { API_BASE } from './apiConfig';

const TILE_COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#0ea5e9', '#f43f5e'];

export default function Talentino() {
  // 🚨 FIX: Safe parsing
  const tpoDataStr = localStorage.getItem('tpoData');
  const tpoData = tpoDataStr ? JSON.parse(tpoDataStr) : null;
  
  const [data, setData] = useState({ dates: [], records: [] });
  const [loading, setLoading] = useState(true);
  
  const [selectedBranch, setSelectedBranch] = useState(null);

  const [dateFilter, setDateFilter] = useState('All Dates');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    // 🚨 FIX: Data fetch isolated inside the hook, dependency array empty
    const fetchTalentino = async () => {
      const localTpoStr = localStorage.getItem('tpoData');
      if (!localTpoStr) return;
      const localTpo = JSON.parse(localTpoStr);
      
      try {
        const response = await axios.post(`${API_BASE}/api/tpo/talentino`, {
          assignedBranchesArray: localTpo.assignedBranchesArray
        });
        if (response.data.success) {
          setData({ dates: response.data.dates, records: response.data.records });
        }
      } catch (error) { 
        console.error("Failed to fetch talentino records", error); 
      } finally { 
        setLoading(false); 
      }
    };
    fetchTalentino();
  }, []); // 🚨 CRITICAL FIX: Stops the loop!

  const branchData = {};
  data.records.forEach(r => {
    const b = r.branch || 'Unknown Branch';
    if (!branchData[b]) branchData[b] = 0;
    branchData[b]++;
  });
  
  const branchList = Object.keys(branchData).sort();

  const activeRecords = selectedBranch ? data.records.filter(r => r.branch === selectedBranch) : [];
  
  const uniqueDates = ['All Dates', ...data.dates];

  const filteredRecords = activeRecords.filter(r => {
    const matchDate = dateFilter === 'All Dates' || (r.date || '').includes(dateFilter);
    const matchSearch = (r.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
                        (r.notes || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchDate && matchSearch;
  });

  if (!selectedBranch) {
    return (
      <Layout>
        <div className="page-container" style={{ padding: 0 }}>
          <h1 style={{ fontSize: '2.2rem', marginBottom: '5px', textAlign: 'center', marginTop: '20px' }}>Talentino Tracker</h1>
          <p style={{ color: 'var(--text-muted)', marginBottom: '3rem', textAlign: 'center' }}>Select an assigned branch to view student attendance and performance records.</p>
          
          {loading ? (
            <div style={{ textAlign: 'center', marginTop: '4rem', color: '#8b5cf6' }}><CircleNotch size={50} className="ph-spin" /></div>
          ) : branchList.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}>No Talentino records found in your assigned branches.</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '30px', padding: '0 20px' }}>
              {branchList.map((branch, index) => {
                const color = TILE_COLORS[index % TILE_COLORS.length];
                return (
                  <div 
                    key={branch} 
                    onClick={() => { setSelectedBranch(branch); setDateFilter('All Dates'); setSearchQuery(''); }}
                    style={{ backgroundColor: color, borderRadius: '24px', padding: '40px 20px', cursor: 'pointer', textAlign: 'center', minHeight: '220px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', transition: 'transform 0.2s ease, box-shadow 0.2s ease' }}
                  >
                    <h2 style={{ color: '#ffffff', fontSize: '2.2rem', margin: '0 0 10px 0', textShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>
                      {branch}
                    </h2>
                    <div style={{ background: 'rgba(255,255,255,0.2)', padding: '8px 16px', borderRadius: '30px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <GraduationCap size={20} color="#ffffff" weight="bold" />
                      <span style={{ color: '#ffffff', fontSize: '1.1rem', fontWeight: 'bold' }}>{branchData[branch]} Records</span>
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
            onClick={() => setSelectedBranch(null)} 
            style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', color: '#fff', padding: '10px 15px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
          >
            <CaretLeft weight="bold" size={18} /> Back to Branches
          </button>
        </div>

        <h1 style={{ fontSize: '2rem', marginBottom: '5px', color: '#fff' }}>Talentino Tracker</h1>
        <p style={{ color: '#8b5cf6', background: 'rgba(139, 92, 246, 0.15)', padding: '4px 12px', borderRadius: '4px', display: 'inline-block', marginBottom: '2rem', fontWeight: 'bold' }}>
          Viewing student performance records for {selectedBranch}.
        </p>

        <div style={{ display: 'flex', gap: '15px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
          <select className="sleek-input" style={{ width: '200px', background: 'var(--card-bg)', border: '1px solid var(--card-border)' }} value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}>
            {uniqueDates.map((d, i) => <option key={i} value={d}>{d}</option>)}
          </select>

          <div style={{ position: 'relative', flex: 1, minWidth: '250px', maxWidth: '350px' }}>
            <MagnifyingGlass size={18} style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input type="text" className="sleek-input" placeholder="Search student or notes..." style={{ width: '100%', paddingLeft: '45px', background: 'var(--card-bg)', border: '1px solid var(--card-border)' }} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>

          <div style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            {filteredRecords.length} records found
          </div>
        </div>

        <div style={{ width: '100%', overflowX: 'auto' }}>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr 2fr', padding: '10px 20px', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            <div>STUDENT</div>
            <div>BRANCH</div>
            <div>DATE</div>
            <div>RATING</div>
            <div>NOTES</div>
          </div>

          {filteredRecords.length > 0 ? filteredRecords.map((r, idx) => {
            let rawRating = '-';
            if (r.rating) {
              const match = r.rating.toString().match(/[\d.]+/);
              if (match) rawRating = match[0];
            }

            return (
              <div 
                key={idx} 
                style={{ 
                  display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr 2fr', alignItems: 'center', 
                  background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '12px', 
                  padding: '16px 20px', marginBottom: '10px', transition: 'background 0.2s'
                }}
              >
                <div style={{ fontWeight: 'bold', color: '#fff', fontSize: '1rem', textTransform: 'uppercase' }}>
                  {r.name || 'Unknown'}
                </div>
                <div style={{ color: '#cbd5e1', fontSize: '0.9rem' }}>
                  {r.branch}
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  {r.date ? r.date.split(' ')[0] : 'N/A'}
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  {rawRating !== '-' ? (
                    <>
                      <strong style={{ color: '#fff', fontSize: '1rem' }}>{rawRating}</strong> / 5 STARS
                    </>
                  ) : (
                    'Not Rated'
                  )}
                </div>
                <div style={{ color: '#cbd5e1', fontSize: '0.9rem', lineHeight: '1.4' }}>
                  {r.notes || 'None'}
                </div>
              </div>
            );
          }) : (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', background: 'var(--card-bg)', borderRadius: '12px', border: '1px solid var(--card-border)' }}>
              <Star size={32} style={{ opacity: 0.5, marginBottom: '10px' }} /><br/>
              No records match your search criteria.
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}