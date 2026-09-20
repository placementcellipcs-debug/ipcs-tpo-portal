import React, { useState } from 'react';
import { Notebook, MagnifyingGlass, ChalkboardTeacher, FileText, Certificate } from '@phosphor-icons/react';
import Layout from './Layout';
import AcademicTopNav from './AcademicTopNav';

export default function AcademicDiary() {
  const [search, setSearch] = useState('');
  
  const diaryEntries = [
    { date: '21 Sep 2026', type: 'Training', title: 'Python Functions Completed', desc: 'Student successfully completed modules on defining functions and args.', icon: <ChalkboardTeacher size={20}/>, color: '#3b82f6' },
    { date: '18 Sep 2026', type: 'Assessment', title: 'Python Basics Quiz', desc: 'Scored 85%. Excellent understanding of core concepts.', icon: <FileText size={20}/>, color: '#a855f7' },
    { date: '15 Sep 2026', type: 'Activity', title: 'Company Visit - TCS', desc: 'Participated in the full-day industrial visit.', icon: <Certificate size={20}/>, color: '#10b981' }
  ];

  return (
    <Layout>
      <div className="page-container" style={{ padding: 0, maxWidth: '1600px', margin: '0 auto' }}>
        <AcademicTopNav title="Digital Diary" subtitle="Complete chronological timeline of a student's academic journey." />

        <div style={{ maxWidth: '800px', margin: '0 auto 40px auto', position: 'relative' }}>
          <MagnifyingGlass size={20} color="#94a3b8" style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)' }} />
          <input 
            type="text" 
            placeholder="Enter Student Roll Number (e.g., IPCS00124)..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: '100%', padding: '16px 20px 16px 45px', background: 'var(--card-bg)', border: '2px solid #10b981', borderRadius: '12px', color: '#fff', fontSize: '1rem', outline: 'none', boxShadow: '0 4px 20px rgba(16, 185, 129, 0.15)' }}
          />
        </div>

        {search.length > 3 ? (
          <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
            <div style={{ background: 'var(--card-bg)', padding: '20px', borderRadius: '16px', border: '1px solid var(--card-border)', marginBottom: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ margin: 0, color: '#fff' }}>Anjali Sharma</h2>
                <div style={{ color: '#10b981', fontWeight: 'bold' }}>IPCS00124 • Python & Data Science</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '1.2rem', color: '#fff', fontWeight: 'bold' }}>88%</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Attendance</div>
              </div>
            </div>

            <div style={{ position: 'relative', paddingLeft: '30px' }}>
              <div style={{ position: 'absolute', top: 0, bottom: 0, left: '14px', width: '2px', background: 'rgba(255,255,255,0.1)' }}></div>
              
              {diaryEntries.map((entry, i) => (
                <div key={i} style={{ position: 'relative', marginBottom: '25px' }}>
                  <div style={{ position: 'absolute', left: '-30px', top: '15px', width: '30px', height: '30px', borderRadius: '50%', background: entry.color, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '3px solid #0f1523', zIndex: 2, color: '#fff' }}>
                    {entry.icon}
                  </div>
                  
                  <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '16px', padding: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <span style={{ color: entry.color, fontWeight: 'bold', fontSize: '0.85rem', textTransform: 'uppercase' }}>{entry.type}</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{entry.date}</span>
                    </div>
                    <h3 style={{ margin: '0 0 5px 0', color: '#fff', fontSize: '1.1rem' }}>{entry.title}</h3>
                    <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: '1.5' }}>{entry.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
            <Notebook size={64} style={{ opacity: 0.2, marginBottom: '20px' }} />
            <p>Search for a student to view their complete academic history.</p>
          </div>
        )}
      </div>
    </Layout>
  );
}