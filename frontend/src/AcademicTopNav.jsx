import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { GraduationCap, UsersFour, ChalkboardTeacher, CalendarCheck, Notebook, BookOpen } from '@phosphor-icons/react';

export default function AcademicTopNav({ title, subtitle, statLabel, statValue }) {
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;

  const tabs = [
    { name: 'Student Training', path: '/academic/training', icon: <GraduationCap size={20} /> },
    { name: 'Batches', path: '/academic/batches', icon: <UsersFour size={20} /> },
    { name: 'Daily Sessions', path: '/academic/sessions', icon: <ChalkboardTeacher size={20} /> },
    { name: 'Attendance', path: '/academic/attendance', icon: <CalendarCheck size={20} /> },
    { name: 'Syllabus & Topics', path: '/academic/topics', icon: <BookOpen size={20} /> },
    { name: 'Digital Diary', path: '/academic/diary', icon: <Notebook size={20} /> }
  ];

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', flexWrap: 'wrap', gap: '20px' }}>
        <div>
          <h1 style={{ fontSize: '2.2rem', display: 'flex', alignItems: 'center', gap: '10px', margin: '0 0 5px 0' }}>
            <GraduationCap weight="fill" color="#10b981" /> {title}
          </h1>
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>{subtitle}</p>
        </div>
        
        {statLabel && (
          <div style={{ display: 'flex', gap: '15px' }}>
            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', padding: '10px 20px', borderRadius: '12px', textAlign: 'center', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{statLabel}</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#10b981' }}>{statValue}</div>
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '10px', marginBottom: '25px', borderBottom: '1px solid var(--card-border)', scrollbarWidth: 'none' }}>
        {tabs.map(tab => {
          const isActive = currentPath === tab.path;
          return (
            <button 
              key={tab.name}
              onClick={() => navigate(tab.path)}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '12px 12px 0 0',
                border: 'none', background: isActive ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                color: isActive ? '#10b981' : 'var(--text-muted)', fontWeight: 'bold', cursor: 'pointer', transition: '0.2s', borderBottom: isActive ? '3px solid #10b981' : '3px solid transparent', whiteSpace: 'nowrap'
              }}
            >
              {tab.icon} {tab.name}
            </button>
          )
        })}
      </div>
    </>
  );
}