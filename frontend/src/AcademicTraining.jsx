import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { CircleNotch, Plus, User, Student, BookOpen, MapPin, MagnifyingGlass } from '@phosphor-icons/react';
import Layout from './Layout';
import AcademicTopNav from './AcademicTopNav';
import { API_BASE } from './apiConfig';

export default function AcademicTraining() {
  const [trainingList, setTrainingList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const res = await axios.get(`${API_BASE}/api/academic/training`);
        if (res.data.success) {
          setTrainingList(res.data.training || []);
        }
      } catch (err) { console.error('Failed to fetch training data', err); } 
      finally { setLoading(false); }
    };
    fetchData();
  }, []);

  const getDriveImage = (url) => {
    if (!url || typeof url !== 'string') return null;
    const match = url.match(/(?:file\/d\/|id=|\/d\/)([\w-]{25,})/);
    return match ? `https://lh3.googleusercontent.com/d/${match[1]}` : url;
  };

  const filteredTraining = trainingList.filter(t => 
    (t.studentName || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
    (t.studentId || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (t.subCourse || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Layout>
      <div className="page-container" style={{ padding: 0, maxWidth: '1600px', margin: '0 auto' }}>
        <AcademicTopNav 
          title="Student Training" 
          subtitle="Manage individual training assignments and progress tracking." 
          statLabel="Active Trainees" 
          statValue={trainingList.filter(t => t.status === 'Active').length} 
        />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
          <div style={{ position: 'relative', width: '300px' }}>
            <MagnifyingGlass size={18} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input 
              type="text" 
              placeholder="Search student, ID, or course..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: '100%', padding: '12px 15px 12px 40px', background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '10px', color: '#fff', fontSize: '0.9rem' }}
            />
          </div>
          <button className="hover-lift" style={{ background: '#10b981', color: '#fff', border: 'none', padding: '12px 20px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 15px rgba(16, 185, 129, 0.3)' }}>
            <Plus weight="bold" /> Assign New Training
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '100px' }}><CircleNotch size={50} className="ph-spin" color="#10b981" /></div>
        ) : filteredTraining.length === 0 ? (
          <div className="empty-state-card" style={{ background: 'var(--card-bg)', padding: '60px', textAlign: 'center', borderRadius: '16px', border: '1px dashed var(--card-border)' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', margin: 0 }}>No training records found. Assign training to get started.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
            {filteredTraining.map((t, i) => (
              <div key={i} className="hover-lift" style={{ background: 'var(--card-bg)', borderRadius: '16px', border: '1px solid var(--card-border)', overflow: 'hidden', display: 'flex', flexDirection: 'column', cursor: 'pointer' }}>
                
                <div style={{ padding: '20px', display: 'flex', gap: '15px', alignItems: 'center', borderBottom: '1px solid var(--card-border)', background: 'rgba(255,255,255,0.02)' }}>
                  <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: '#1e293b', overflow: 'hidden', flexShrink: 0, border: '2px solid #10b981' }}>
                    {t.profilePhoto ? <img src={getDriveImage(t.profilePhoto)} alt="Student" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}><User size={32} /></div>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ margin: '0 0 4px 0', fontSize: '1.1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#fff' }}>{t.studentName}</h3>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t.studentId}</div>
                  </div>
                  <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '6px 10px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                    {t.progress}
                  </div>
                </div>

                <div style={{ padding: '20px', flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '12px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    <BookOpen size={16} style={{ marginTop: '2px' }}/> 
                    <div>
                      <div style={{ color: '#fff', fontWeight: 'bold' }}>{t.subCourse}</div>
                      <div style={{ fontSize: '0.75rem' }}>{t.mainCourse}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    <User size={16} /> <span style={{ color: '#e2e8f0' }}>Trainer: {t.trainerName}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    <MapPin size={16} /> <span style={{ color: '#e2e8f0' }}>{t.branch} • {t.trainingType}</span>
                  </div>
                </div>

              </div>
            ))}
          </div>
        )}
      </div>
      <style>{`.hover-lift { transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1); } .hover-lift:hover { transform: translateY(-4px); box-shadow: 0 20px 40px -10px rgba(0,0,0,0.7); border-color: rgba(255, 255, 255, 0.1); }`}</style>
    </Layout>
  );
}