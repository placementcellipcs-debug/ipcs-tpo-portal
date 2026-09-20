import React, { useState, useEffect } from 'react';
import { CircleNotch, Plus, UsersFour, ChalkboardTeacher, MapPin, CalendarBlank, X } from '@phosphor-icons/react';
import Layout from './Layout';
import AcademicTopNav from './AcademicTopNav';

export default function AcademicBatches() {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(false); // Set to true when backend is hooked up
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Temporary mock data for UI visualization
  useEffect(() => {
    setBatches([
      { batchId: 'BAT-BLR-001', name: 'Python Sept Weekend', course: 'Python & Data Science', branch: 'Bangalore', trainer: 'Rahul K', students: 14, status: 'Active', startDate: '01/09/2026' },
      { batchId: 'BAT-BLR-002', name: 'Digital Marketing Fast-Track', course: 'Digital Marketing', branch: 'Bangalore', trainer: 'Priya M', students: 22, status: 'Active', startDate: '15/09/2026' }
    ]);
  }, []);

  return (
    <Layout>
      <div className="page-container" style={{ padding: 0, maxWidth: '1600px', margin: '0 auto' }}>
        <AcademicTopNav title="Batch Management" subtitle="Organize students into optional group training batches." statLabel="Active Batches" statValue={batches.length} />

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
          <button onClick={() => setIsModalOpen(true)} className="hover-lift" style={{ background: '#10b981', color: '#fff', border: 'none', padding: '12px 20px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 15px rgba(16, 185, 129, 0.3)' }}>
            <Plus weight="bold" /> Create New Batch
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '100px' }}><CircleNotch size={50} className="ph-spin" color="#10b981" /></div>
        ) : batches.length === 0 ? (
           <div className="empty-state-card" style={{ background: 'var(--card-bg)', padding: '60px', textAlign: 'center', borderRadius: '16px', border: '1px dashed var(--card-border)', color: 'var(--text-muted)' }}>No active batches found.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '20px' }}>
            {batches.map((b, i) => (
              <div key={i} className="hover-lift" style={{ background: 'var(--card-bg)', borderRadius: '16px', border: '1px solid var(--card-border)', overflow: 'hidden', cursor: 'pointer' }}>
                <div style={{ padding: '20px', borderBottom: '1px solid var(--card-border)', background: 'rgba(16, 185, 129, 0.05)', borderLeft: '4px solid #10b981' }}>
                  <h3 style={{ margin: '0 0 5px 0', fontSize: '1.2rem', color: '#fff' }}>{b.name}</h3>
                  <div style={{ fontSize: '0.8rem', color: '#10b981', fontWeight: 'bold', letterSpacing: '0.5px' }}>{b.batchId}</div>
                </div>
                <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-muted)', fontSize: '0.9rem' }}><ChalkboardTeacher size={18} /> <span style={{ color: '#fff', fontWeight: 'bold' }}>{b.course}</span></div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-muted)', fontSize: '0.9rem' }}><User size={18} /> <span>Trainer: <span style={{ color: '#e2e8f0' }}>{b.trainer}</span></span></div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-muted)', fontSize: '0.9rem' }}><UsersFour size={18} /> <span>Students: <span style={{ color: '#3b82f6', fontWeight: 'bold' }}>{b.students} Assigned</span></span></div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-muted)', fontSize: '0.9rem' }}><CalendarBlank size={18} /> <span>Started: {b.startDate}</span></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#0f1523', width: '100%', maxWidth: '500px', borderRadius: '20px', padding: '30px', border: '1px solid var(--card-border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, color: '#fff' }}>Create Training Batch</h2>
              <X size={24} color="#94a3b8" style={{ cursor: 'pointer' }} onClick={() => setIsModalOpen(false)} />
            </div>
            <form onSubmit={e => { e.preventDefault(); setIsModalOpen(false); }}>
              <div style={{ marginBottom: '15px' }}><label className="sleek-label">Batch Name</label><input type="text" className="sleek-input" style={{ width: '100%' }} placeholder="e.g. Sept Python Weekend" required /></div>
              <div style={{ marginBottom: '15px' }}><label className="sleek-label">Course Module</label><input type="text" className="sleek-input" style={{ width: '100%' }} placeholder="e.g. Python" required /></div>
              <div style={{ marginBottom: '25px' }}><label className="sleek-label">Assign Trainer</label><input type="text" className="sleek-input" style={{ width: '100%' }} placeholder="Trainer Name" required /></div>
              <button type="submit" style={{ width: '100%', padding: '14px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}>Save Batch</button>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}