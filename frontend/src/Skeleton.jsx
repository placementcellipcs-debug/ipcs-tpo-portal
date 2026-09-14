export default function Skeleton({ type = 'table', count = 5, cols = 5 }) {
  // KPI Grid Skeleton Loader
  if (type === 'kpi') {
    return (
      <div className="kpi-grid">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="dash-card skeleton-box" style={{ minHeight: '120px', padding: '20px' }}>
            <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
              <div className="skeleton-box" style={{ width: '42px', height: '42px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
              <div style={{ flex: 1 }}>
                <div className="skeleton-box" style={{ width: '60%', height: '12px', marginBottom: '8px', background: 'rgba(255,255,255,0.05)' }} />
                <div className="skeleton-box" style={{ width: '40%', height: '24px', background: 'rgba(255,255,255,0.05)' }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Card Grid Skeleton (Placement Drives, Student Directory)
  if (type === 'cards') {
    return (
      <div className="grid-3-col">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="dash-card skeleton-box" style={{ minHeight: '220px', padding: '25px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div style={{ width: '50%', height: '20px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px' }} />
              <div style={{ width: '35px', height: '35px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)' }} />
            </div>
            <div style={{ width: '70%', height: '14px', background: 'rgba(255,255,255,0.05)', marginBottom: '10px' }} />
            <div style={{ width: '50%', height: '14px', background: 'rgba(255,255,255,0.05)', marginBottom: '25px' }} />
            <div style={{ width: '100%', height: '45px', background: 'rgba(255,255,255,0.04)', borderRadius: '8px' }} />
          </div>
        ))}
      </div>
    );
  }

  // Table Rows Skeleton Loader
  return (
    <div style={{ width: '100%', padding: '10px 0' }}>
      {Array.from({ length: count }).map((_, r) => (
        <div key={r} style={{ display: 'flex', gap: '15px', padding: '16px 20px', borderBottom: '1px solid var(--card-border)' }}>
          {Array.from({ length: cols }).map((_, c) => (
            <div 
              key={c} 
              className="skeleton-box" 
              style={{ 
                flex: c === 0 ? 2 : 1, 
                height: '16px', 
                background: 'rgba(255,255,255,0.04)' 
              }} 
            />
          ))}
        </div>
      ))}
    </div>
  );
}