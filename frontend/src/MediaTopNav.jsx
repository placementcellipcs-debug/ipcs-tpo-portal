import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Kanban, Files, CheckCircle, ShareNetwork, ClockCounterClockwise, SlidersHorizontal, ImageSquare, PaintBrush } from '@phosphor-icons/react';

export default function MediaTopNav({ title, subtitle, pendingCount = 0, publishedCount = 0 }) {
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;

  const tabs = [
    { name: 'Active Queues', path: '/media/dashboard', icon: <Kanban size={20} /> },
    { name: 'Preview Gallery', path: '/media/preview', icon: <ImageSquare size={20} /> },
    { name: 'File Vault', path: '/media/files', icon: <Files size={20} /> },
    { name: 'Categories', path: '/media/categories', icon: <CheckCircle size={20} /> },
    { name: 'Social Media', path: '/media/social', icon: <ShareNetwork size={20} /> },
    { name: 'Activity Log', path: '/media/logs', icon: <ClockCounterClockwise size={20} /> },
    { name: 'Studio Settings', path: '/media/settings', icon: <SlidersHorizontal size={20} /> }
  ];

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', flexWrap: 'wrap', gap: '20px' }}>
        <div>
          <h1 style={{ fontSize: '2.2rem', display: 'flex', alignItems: 'center', gap: '10px', margin: '0 0 5px 0' }}>
            <PaintBrush weight="fill" color="#ec4899" /> {title}
          </h1>
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>{subtitle}</p>
        </div>
        
        <div style={{ display: 'flex', gap: '15px' }}>
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', padding: '10px 20px', borderRadius: '12px', textAlign: 'center', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Active Tasks</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#f59e0b' }}>{pendingCount}</div>
          </div>
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', padding: '10px 20px', borderRadius: '12px', textAlign: 'center', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Published Posts</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#10b981' }}>{publishedCount}</div>
          </div>
        </div>
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
                border: 'none', background: isActive ? 'rgba(236, 72, 153, 0.1)' : 'transparent',
                color: isActive ? '#ec4899' : 'var(--text-muted)', fontWeight: 'bold', cursor: 'pointer', transition: '0.2s', borderBottom: isActive ? '3px solid #ec4899' : '3px solid transparent', whiteSpace: 'nowrap'
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