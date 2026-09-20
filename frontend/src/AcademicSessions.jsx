import React, { useState } from 'react';
import { ChalkboardTeacher, Clock, PlayCircle, CheckCircle, UsersFour, X } from '@phosphor-icons/react';
import Layout from './Layout';
import AcademicTopNav from './AcademicTopNav';

export default function AcademicSessions() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const sessions = [
    { id: 'SES-092', type: 'Batch', name: 'Python Sept Weekend', topic: 'OOP Concepts', time: '10:00 AM - 12:00 PM', status: 'Completed', attendance: '12/14' },
    { id: 'SES-093', type: 'Individual', name: 'Anjali Sharma', topic: 'Data Types', time: '02:00 PM - 03:30 PM', status: 'In Progress', attendance: 'Present' }
  ];

  return (
    <Layout>
      <div className="page-container" style={{ padding: 0, maxWidth: '1600px', margin: '0 auto' }}>
        <AcademicTopNav title="Live Sessions" subtitle="Log daily classes for individuals and batches." statLabel="Today's Sessions" statValue="2" />

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
          <button onClick={() => setIsModalOpen(true)} className="hover-lift" style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '12px 20px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <PlayCircle weight="fill" size={20} /> Start New Session
          </button>
        </div>

        <div className="table-container" style={{ background: 'var(--card-bg)', borderRadius: '16px', border: '1px solid var(--card-border)', overflow: 'hidden' }}>
          <table className="modern-table">
            <thead><tr><th>Session Details</th><th>Subject / Target</th><th>Topic Taught</th><th>Time</th><th style={{ textAlign: 'center' }}>Status</th></tr></thead>
            <tbody>
              {sessions.map((s, i) => (
                <tr key={i}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.type === 'Batch' ? '#a855f7' : '#3b82f6' }}>
                        {s.type === 'Batch' ? <UsersFour size={20} weight="fill"/> : <User size={20} weight="fill"/>}
                      </div>
                      <div><div style={{ color: '#fff', fontWeight: 'bold' }}>{s.id}</div><div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{s.type} Training</div></div>
                    </div>
                  </td>
                  <td style={{ color: '#e2e8f0', fontWeight: 'bold' }}>{s.name}</td>
                  <td style={{ color: '#10b981', fontWeight: 'bold' }}>{s.topic}</td>
                  <td><span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--text-muted)', fontSize: '0.85rem' }}><Clock /> {s.time}</span></td>
                  <td style={{ textAlign: 'center' }}>
                    <span style={{ padding: '6px 12px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 'bold', background: s.status === 'Completed' ? 'rgba(16,185,129,0.1)' : 'rgba(59,130,246,0.1)', color: s.status === 'Completed' ? '#10b981' : '#3b82f6' }}>{s.status.toUpperCase()}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#0f1523', width: '100%', maxWidth: '500px', borderRadius: '20px', padding: '30px', border: '1px solid var(--card-border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, color: '#fff' }}>Log Training Session</h2>
              <X size={24} color="#94a3b8" style={{ cursor: 'pointer' }} onClick={() => setIsModalOpen(false)} />
            </div>
            <form onSubmit={e => { e.preventDefault(); setIsModalOpen(false); }}>
              <div style={{ marginBottom: '15px' }}>
                <label className="sleek-label">Session Type</label>
                <select className="sleek-select" style={{ width: '100%' }}><option>Individual Student</option><option>Batch</option></select>
              </div>
              <div style={{ marginBottom: '15px' }}><label className="sleek-label">Select Target</label><input type="text" className="sleek-input" style={{ width: '100%' }} placeholder="Search Student or Batch Name..." required /></div>
              <div style={{ marginBottom: '25px' }}><label className="sleek-label">Topic Taught</label><input type="text" className="sleek-input" style={{ width: '100%' }} placeholder="e.g. Python Variables" required /></div>
              <button type="submit" style={{ width: '100%', padding: '14px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}>Start Session</button>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}