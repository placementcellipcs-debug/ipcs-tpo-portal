import {
  Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis
} from 'recharts';

const DOMAIN_COLORS = ['#3b82f6', '#10b981', '#a855f7', '#f59e0b', '#ec4899', '#0ea5e9'];

function DashboardTooltip({ active, payload, label, selectedYear }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'rgba(15, 23, 42, 0.95)', border: '1px solid #334155', padding: '12px', borderRadius: '8px', color: '#fff', boxShadow: '0 10px 25px rgba(0,0,0,0.5)', zIndex: 1000 }}>
      {label && <p style={{ margin: '0 0 8px 0', borderBottom: '1px solid #334155', paddingBottom: '6px', fontSize: '0.9rem', fontWeight: 'bold' }}>{label} {selectedYear}</p>}
      {payload.map((entry, index) => (
        <div key={`${entry.name}-${index}`} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', fontSize: '0.8rem' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: entry.color }} />
          <span style={{ color: '#cbd5e1' }}>{entry.name}:</span>
          <span style={{ fontWeight: 'bold' }}>{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

export default function DashboardCharts({ trendData, domainData, availableYears, selectedYear, setSelectedYear, placementTotal }) {
  const displayDomainData = domainData.length > 0 ? domainData : [{ name: 'No Data', value: 1 }];
  return (
    <div className="grid-3-col">
      <div className="dash-card span-2-col" style={{ display: 'flex', flexDirection: 'column' }}>
        <div className="card-top">
          <h3>Placement Trends</h3>
          <select className="mini-select" value={selectedYear} onChange={event => setSelectedYear(Number(event.target.value))}>
            {availableYears.map(year => <option key={year} value={year}>{year}</option>)}
          </select>
        </div>
        <div style={{ flex: 1, width: '100%', minHeight: '260px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorApps" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.3}/><stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0}/></linearGradient>
                <linearGradient id="colorPl" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis dataKey="m" stroke="#64748b" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis stroke="#64748b" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<DashboardTooltip selectedYear={selectedYear} />} />
              <Area type="monotone" dataKey="Applications" stroke="var(--accent-primary)" strokeWidth={2} fillOpacity={1} fill="url(#colorApps)" activeDot={{ r: 5, fill: 'var(--accent-primary)', strokeWidth: 0 }} />
              <Area type="monotone" dataKey="Placed" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorPl)" activeDot={{ r: 5, fill: '#10b981', strokeWidth: 0 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="dash-card">
        <h3>Placements by Domain</h3>
        <div style={{ width: '100%', height: '170px', position: 'relative', marginTop: '10px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip content={<DashboardTooltip selectedYear={selectedYear} />} />
              <Pie data={displayDomainData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value" stroke="none">
                {displayDomainData.map((entry, index) => <Cell key={`domain-${index}`} fill={DOMAIN_COLORS[index % DOMAIN_COLORS.length]} />)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="donut-center">
            <div className="donut-val">{placementTotal}</div>
            <div className="donut-lbl">Total</div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '15px' }}>
          {domainData.length === 0 ? <div style={{ textAlign: 'center', color: '#64748b', fontSize: '0.8rem' }}>No data available</div> :
            domainData.map((domain, index) => (
              <div key={domain.name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#cbd5e1' }}><span style={{ width: '8px', height: '8px', borderRadius: '2px', background: DOMAIN_COLORS[index % DOMAIN_COLORS.length] }} />{domain.name}</div>
                <div style={{ color: '#fff', fontWeight: 'bold' }}>{domain.value}</div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
