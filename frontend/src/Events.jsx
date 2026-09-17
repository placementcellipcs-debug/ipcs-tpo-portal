import { useEffect, useState } from 'react';
import axios from 'axios';
import { 
  Plus, CaretLeft, CaretRight, X, CircleNotch, MapPin, 
  Clock, Buildings, CalendarStar, UserCheck, CaretDown
} from '@phosphor-icons/react';
import Layout from './Layout';

import { API_BASE } from './apiConfig';

const parseDate = (dateStr) => {
  if (!dateStr) return null;
  
  // Let standard JS handle Google Sheets 'M/D/YYYY' format perfectly!
  const standardDate = new Date(dateStr);
  if (!isNaN(standardDate)) return standardDate;

  // Fallback for tricky string formats if standard parsing fails
  let cleanStr = typeof dateStr === 'string' ? dateStr.split(' ')[0].replace(/st|nd|rd|th/g, '') : dateStr;
  if (typeof cleanStr === 'string' && (cleanStr.includes('/') || cleanStr.includes('-'))) {
    const parts = cleanStr.split(/[/-]/);
    if (parts.length === 3) {
      if (parts[2].length === 4) return new Date(`${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`);
    }
  }
  return null;
};

export default function Events() {
  const tpoDataStr = localStorage.getItem('tpoData');
  const tpoData = tpoDataStr ? JSON.parse(tpoDataStr) : null;
  
  const [events, setEvents] = useState([]);
  const [branchList, setBranchList] = useState([]); 
  const [loading, setLoading] = useState(true);
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date()); // Tracks sidebar agenda

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const [newEvent, setNewEvent] = useState({ 
    date: '', time: '', branch: tpoData?.assignedBranchesArray?.[0] || 'All Branches', 
    type: 'Placement Drive', title: '', description: '', location: '' 
  });
  const [posterFile, setPosterFile] = useState(null);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE}/api/tpo/events`);
      if (response.data.success) {
        setEvents(response.data.events || []);
      }
    } catch (error) {
      console.error("Failed to fetch events", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBranches = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/admin/branches`);
      if (res.data.success) {
        const branches = res.data.branches
          .map(b => b.branch)
          .filter(Boolean)
          .sort((a, b) => a.localeCompare(b));
        setBranchList(branches);
      }
    } catch (error) {
      console.error("Failed to fetch branches", error);
    }
  };

  useEffect(() => {
    fetchEvents();
    fetchBranches();
  }, []);

  const handleSaveEvent = async () => {
    if (!newEvent.title || !newEvent.date || !newEvent.type) {
      return alert("Please fill in the Event Title, Date, and Event Type.");
    }
    
    setIsSaving(true);
    try {
      const formData = new FormData();
      formData.append('tpo', tpoData?.name || 'Unknown');
      Object.keys(newEvent).forEach(key => formData.append(key, newEvent[key]));
      if (posterFile) formData.append('posterFile', posterFile);

      const res = await axios.post(`${API_BASE}/api/tpo/events/add`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.data.success) {
        setIsModalOpen(false);
        setNewEvent({ date: '', time: '', branch: tpoData?.assignedBranchesArray?.[0] || 'All Branches', type: 'Placement Drive', title: '', description: '', location: '' });
        setPosterFile(null);
        fetchEvents(); 
      }
    } catch (error) {
      alert("Failed to save event");
    } finally {
      setIsSaving(false);
    }
  };

  const getEventColor = (type) => {
    if (!type) return '#38bdf8';
    if (type.includes('Talentino')) return '#a855f7';
    if (type.includes('Placement Drive')) return '#ef4444';
    return '#10b981'; // Green fallback
  };

  const nextPeriod = () => {
    const d = new Date(currentDate);
    d.setMonth(d.getMonth() + 1);
    setCurrentDate(d);
  };

  const prevPeriod = () => {
    const d = new Date(currentDate);
    d.setMonth(d.getMonth() - 1);
    setCurrentDate(d);
  };

  const getMonthName = () => currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  // 🚨 SMART FILTER: Only show Talentino events for assigned branches
  const isVisibleEvent = (e) => {
    const userBranches = tpoData?.assignedBranchesArray || [];
    const isSuper = tpoData?.accessType === 'superadmin';
    
    if (isSuper || userBranches.length === 0 || userBranches.includes('all') || userBranches.includes('All')) return true;
    
    if ((e.type || '').toLowerCase().includes('talentino')) {
      const evtBranch = (e.branch || '').toLowerCase();
      if (evtBranch === 'all branches' || evtBranch === 'all') return true;
      return userBranches.some(b => evtBranch.includes(b.toLowerCase()) || b.toLowerCase().includes(evtBranch));
    }
    return true; 
  };

  const renderMonthGrid = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const grid = [];
    
    // Empty prefix cells
    for (let i = 0; i < firstDay; i++) {
      grid.push(<div key={`empty-${i}`} className="neo-cell empty"></div>);
    }
    
    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const cellDate = new Date(year, month, day);
      const isToday = day === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear();
      const isSelected = selectedDate && cellDate.toDateString() === selectedDate.toDateString();
      
      const dayEvents = events.filter(e => {
        if (!isVisibleEvent(e)) return false; // Apply branch filter
        const pd = parseDate(e.date);
        return pd && pd.getFullYear() === cellDate.getFullYear() && pd.getMonth() === cellDate.getMonth() && pd.getDate() === cellDate.getDate();
      });

      grid.push(
        <div key={day} className={`neo-cell ${isSelected ? 'selected' : ''}`} onClick={() => setSelectedDate(cellDate)}>
          <div className={`neo-date-num ${isToday && !isSelected ? 'today' : ''}`}>{day}</div>
          <div className="neo-events">
            {dayEvents.slice(0, 3).map((e, i) => (
              <div key={i} className="neo-event-indicator">
                <span className="neo-event-bar" style={{ background: isSelected ? 'rgba(255,255,255,0.8)' : getEventColor(e.type) }}></span>
                <span className="neo-event-title" style={{ color: isSelected ? '#fff' : '#cbd5e1' }}>{e.title}</span>
              </div>
            ))}
            {dayEvents.length > 3 && (
              <div className="neo-event-more" style={{ color: isSelected ? 'rgba(255,255,255,0.7)' : '#64748b' }}>
                +{dayEvents.length - 3} more
              </div>
            )}
          </div>
        </div>
      );
    }
    return grid;
  };

  const selectedDayEvents = selectedDate ? events.filter(e => {
    if (!isVisibleEvent(e)) return false; // Apply branch filter to sidebar
    const pd = parseDate(e.date);
    return pd && pd.toDateString() === selectedDate.toDateString();
  }) : [];

  return (
    <Layout>
      <div className="page-container" style={{ padding: 0 }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '15px' }}>
          <div>
            <h1 style={{ fontSize: '2rem', margin: '0 0 5px 0', color: '#fff' }}>
              Morning, {String(tpoData?.name || 'Alex').split(' ')[0]}!
            </h1>
            <p style={{ color: '#94a3b8', margin: 0, fontSize: '1.05rem' }}>Here's what's on your agenda today.</p>
          </div>
          
          {(tpoData?.accessType === 'superadmin' || (tpoData?.role || '').toUpperCase().includes('TPO')) && (
            <button className="btn-action" style={{ width: 'auto', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px', background: '#38bdf8', color: '#0f172a' }} onClick={() => setIsModalOpen(true)}>
              <Plus weight="bold" /> Add Event
            </button>
          )}
        </div>

        <div className="neo-layout">
          
          {/* LEFT: CALENDAR GRID */}
          <div className="neo-calendar-section">
            <div className="neo-toolbar">
              <div className="neo-month-display">
                {currentDate.toLocaleString('default', { month: 'long' })} <CaretDown size={14} weight="bold" style={{ marginLeft:'8px', marginRight:'20px', color: '#64748b' }}/> 
                {currentDate.getFullYear()} <CaretDown size={14} weight="bold" style={{ marginLeft:'8px', color: '#64748b' }}/>
              </div>
              <div className="neo-nav-arrows">
                <button onClick={prevPeriod}><CaretLeft size={16} weight="bold"/></button>
                <button onClick={nextPeriod}><CaretRight size={16} weight="bold"/></button>
              </div>
            </div>

            <div className="neo-days-header">
              {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(day => (
                <div key={day}>{day}</div>
              ))}
            </div>

            <div className="neo-grid">
              {loading ? (
                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '5rem', color: '#38bdf8' }}>
                  <CircleNotch size={48} className="ph-spin" />
                </div>
              ) : (
                renderMonthGrid()
              )}
            </div>
          </div>

          {/* RIGHT: AGENDA SIDEBAR */}
          {selectedDate && (
            <div className="neo-agenda-section">
              <div className="neo-agenda-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3>Scheduled</h3>
                  <div className="neo-agenda-date">
                    {selectedDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </div>
                </div>
                <button onClick={() => setSelectedDate(null)} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#94a3b8', padding: '6px', borderRadius: '50%', cursor: 'pointer', display: 'flex', transition: '0.2s' }} title="Close Agenda">
                  <X size={18} weight="bold"/>
                </button>
              </div>

              <div className="neo-agenda-list">
                {selectedDayEvents.length === 0 ? (
                  <div style={{ color: '#64748b', fontSize: '0.9rem', textAlign: 'center', marginTop: '2rem' }}>No events scheduled for this day.</div>
                ) : (
                  selectedDayEvents.map((e, idx) => (
                    <div key={idx} className="neo-agenda-card">
                      <div className="neo-ac-accent" style={{ background: getEventColor(e.type) }}></div>
                      
                      <div className="neo-ac-time-row">
                        <span style={{ color: '#fff', fontWeight: 'bold' }}>{e.time || '09:00'}</span>
                      </div>
                      
                      <div className="neo-ac-content">
                        <h4 className="neo-ac-title">{e.title}</h4>
                        <p className="neo-ac-desc">{e.type}</p>
                        
                        <div className="neo-ac-footer">
                          <div className="neo-ac-detail"><Clock size={14} /> {e.time || 'All Day'}</div>
                          <div className="neo-ac-detail"><MapPin size={14} /> {e.location || 'Online'}</div>
                        </div>

                        <div className="neo-ac-members">
                          <div className="neo-avatar"><UserCheck size={14}/></div>
                          <span style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>{e.tpo || 'System'} • {e.branch === 'All Branches' ? 'Global' : e.branch}</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

        </div>
      </div>

      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 99999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }} onClick={(e) => { if(e.target === e.currentTarget) setIsModalOpen(false); }}>
          <div className="modal-card" style={{ maxWidth: '600px', width: '100%', maxHeight: '90vh', overflowY: 'auto', background: '#0f172a', border: '1px solid #1e293b', borderRadius: '24px', padding: '2rem', boxShadow: '0 25px 50px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid #1e293b', paddingBottom: '15px' }}>
              <h3 style={{ margin: 0, fontSize: '1.4rem', color: '#fff' }}>Add New Event</h3>
              <X size={24} style={{ cursor: 'pointer', color: '#94a3b8' }} onClick={() => setIsModalOpen(false)} />
            </div>

            <div className="form-group" style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '5px', fontWeight: 'bold' }}>Event Title</label>
              <input type="text" className="sleek-input" style={{ width: '100%' }} value={newEvent.title} onChange={e => setNewEvent({...newEvent, title: e.target.value})} placeholder="e.g. Wipro Placement Drive" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
              <div className="form-group">
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '5px', fontWeight: 'bold' }}>Date *</label>
                <input type="date" className="sleek-input" style={{ width: '100%' }} value={newEvent.date} onChange={e => setNewEvent({...newEvent, date: e.target.value})} />
              </div>
              <div className="form-group">
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '5px', fontWeight: 'bold' }}>Time</label>
                <input type="time" className="sleek-input" style={{ width: '100%' }} value={newEvent.time} onChange={e => setNewEvent({...newEvent, time: e.target.value})} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
              <div className="form-group">
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '5px', fontWeight: 'bold' }}>Event Type *</label>
                <select className="sleek-input" style={{ width: '100%' }} value={newEvent.type} onChange={e => setNewEvent({...newEvent, type: e.target.value})}>
                  <option value="Placement Drive">Placement Drive</option>
                  <option value="Talentino">Talentino</option>
                  <option value="Training">Training</option>
                </select>
              </div>
              <div className="form-group">
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '5px', fontWeight: 'bold' }}>Event Location</label>
                <input type="text" className="sleek-input" style={{ width: '100%' }} value={newEvent.location} onChange={e => setNewEvent({...newEvent, location: e.target.value})} placeholder="e.g. Bangalore Branch, Online" />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '5px', fontWeight: 'bold' }}>Eligible Branch</label>
              <select className="sleek-input" style={{ width: '100%' }} value={newEvent.branch} onChange={e => setNewEvent({...newEvent, branch: e.target.value})}>
                <option value="All Branches">All Branches</option>
                {branchList.map((branchName, idx) => (
                  <option key={idx} value={branchName}>{branchName}</option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '5px', fontWeight: 'bold' }}>Description</label>
              <textarea className="sleek-input" style={{ width: '100%', minHeight: '80px', resize: 'vertical' }} value={newEvent.description} onChange={e => setNewEvent({...newEvent, description: e.target.value})} placeholder="Add instructions or meeting links..."></textarea>
            </div>

            {newEvent.type === 'Placement Drive' && (
              <div className="form-group" style={{ marginBottom: '25px', background: 'rgba(56, 189, 248, 0.05)', padding: '15px', borderRadius: '12px', border: '1px dashed #38bdf8' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#38bdf8', marginBottom: '8px', fontWeight: 'bold' }}>Upload Drive Poster (Optional)</label>
                <input type="file" accept="image/*" className="sleek-input" style={{ width: '100%', padding: '8px' }} onChange={e => setPosterFile(e.target.files[0])} />
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid #1e293b', paddingTop: '1.5rem' }}>
              <button className="btn-secondary" style={{ background: 'transparent', border: '1px solid #334155', color: '#f8fafc', padding: '10px 20px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold' }} onClick={() => setIsModalOpen(false)}>Cancel</button>
              <button className="btn-action" style={{ background: '#38bdf8', color: '#0f172a', padding: '10px 20px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', border: 'none' }} onClick={handleSaveEvent} disabled={isSaving}>
                {isSaving ? <CircleNotch size={18} className="ph-spin" /> : "Save Event"}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* 🎨 NEO CALENDAR STYLES */}
      <style>{`
        /* Global Reset For This Page */
        .hover-lift:hover { transform: translateY(-4px); border-color: rgba(255,255,255,0.1); background: #1e293b; }
        
        /* The Main Wrapper */
        .neo-layout {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 30px;
          align-items: start;
          margin-top: 15px;
          background: #0b1121; 
          padding: 25px;
          border-radius: 24px;
          border: 1px solid #1e293b;
        }

        /* LEFT SIDE: CALENDAR GRID */
        .neo-calendar-section {
          width: 100%;
          min-width: 0;
        }

        .neo-toolbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 30px;
        }

        .neo-month-display {
          color: #fff;
          font-size: 1.6rem;
          font-weight: 500;
          display: flex;
          align-items: center;
        }
        .neo-month-display span {
          color: #94a3b8;
          margin-left: 10px;
        }

        .neo-nav-arrows {
          display: flex;
          gap: 12px;
        }
        .neo-nav-arrows button {
          background: #1e293b;
          border: 1px solid #334155;
          color: #cbd5e1;
          width: 38px;
          height: 38px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: 0.2s;
        }
        .neo-nav-arrows button:hover {
          background: #334155;
          color: #fff;
          border-color: #475569;
        }

        .neo-days-header {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 15px;
          margin-bottom: 15px;
        }
        .neo-days-header div {
          color: #64748b;
          font-size: 0.8rem;
          font-weight: 600;
          text-transform: capitalize;
          padding-left: 15px;
        }

        .neo-grid {
          display: grid;
          grid-template-columns: repeat(7, minmax(0, 1fr));
          gap: 15px; 
        }

        .neo-cell {
          background: #1e293b;
          border-radius: 12px;
          min-height: 120px;
          padding: 12px;
          cursor: pointer;
          transition: 0.2s ease;
          border: 1px solid transparent;
          display: flex;
          flex-direction: column;
          min-width: 0;
          overflow: hidden;
        }
        .neo-cell.empty {
          background: transparent;
          cursor: default;
        }
        .neo-cell:not(.empty):hover {
          background: #27354c;
        }
        
        .neo-cell.selected {
          background: #2563eb;
          box-shadow: 0 10px 25px rgba(37, 99, 235, 0.4);
          transform: translateY(-2px);
        }

        .neo-date-num {
          color: #e2e8f0;
          font-size: 1.1rem;
          font-weight: 500;
          margin-bottom: 10px;
        }
        .neo-date-num.today {
          color: #38bdf8;
          font-weight: 900;
        }
        .neo-cell.selected .neo-date-num { color: #fff; }

        .neo-events {
          display: flex;
          flex-direction: column;
          gap: 6px;
          min-width: 0;
          width: 100%;
        }
        .neo-event-indicator {
          display: flex;
          align-items: center;
          gap: 6px;
          min-width: 0; 
          width: 100%;
        }
        .neo-event-bar {
          width: 3px;
          height: 12px;
          border-radius: 2px;
          flex-shrink: 0;
        }
        .neo-event-title {
          color: #cbd5e1;
          font-size: 0.75rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          flex: 1; 
          min-width: 0;
        }
        .neo-cell.selected .neo-event-title {
          color: rgba(255,255,255,0.9);
        }
        .neo-event-more {
          color: #64748b;
          font-size: 0.7rem;
          font-weight: bold;
          margin-top: 4px;
        }

        /* RIGHT SIDE: AGENDA SIDEBAR */
        .neo-agenda-section {
          width: 360px;
          background: rgba(15, 23, 42, 0.5);
          border: 1px solid #1e293b;
          border-radius: 20px;
          padding: 25px;
          display: flex;
          flex-direction: column;
          max-height: 800px;
          flex-shrink: 0;
          box-sizing: border-box;
        }

        .neo-agenda-header {
          margin-bottom: 30px;
        }
        .neo-agenda-header h3 {
          margin: 0 0 5px 0;
          color: #fff;
          font-size: 1.6rem;
          font-weight: 500;
        }
        .neo-agenda-date {
          color: #94a3b8;
          font-size: 0.9rem;
        }

        .neo-agenda-list {
          display: flex;
          flex-direction: column;
          gap: 20px;
          overflow-y: auto;
          padding-right: 10px;
        }
        
        .neo-agenda-list::-webkit-scrollbar { width: 6px; }
        .neo-agenda-list::-webkit-scrollbar-track { background: transparent; }
        .neo-agenda-list::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }

        .neo-agenda-card {
          width: 100%;
          box-sizing: border-box;
          background: #111827; 
          border-radius: 16px;
          padding: 20px;
          display: flex;
          flex-direction: column;
          position: relative;
          border: 1px solid #1e293b;
          overflow: hidden; 
        }

        .neo-ac-accent {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 4px;
          border-top-left-radius: 16px;
          border-top-right-radius: 16px;
        }

        .neo-ac-time-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
          font-size: 0.85rem;
        }

        .neo-ac-content {
          display: flex;
          flex-direction: column;
          min-width: 0; 
        }

        .neo-ac-title {
          margin: 0 0 6px 0;
          color: #fff;
          font-size: 1.05rem;
          font-weight: 600;
          white-space: normal;
          word-wrap: break-word; 
        }
        
        .neo-ac-desc {
          margin: 0 0 15px 0;
          color: #94a3b8;
          font-size: 0.85rem;
        }
        
        .neo-ac-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.8rem;
          color: #64748b;
          margin-bottom: 15px;
          padding-bottom: 15px;
          border-bottom: 1px solid #1e293b;
        }
        .neo-ac-detail {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .neo-ac-members {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .neo-avatar {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: rgba(56, 189, 248, 0.1);
          color: #38bdf8;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid #0284c7;
        }

        /* RESPONSIVE FLUIDITY */
        @media (max-width: 1150px) {
          .neo-layout { flex-direction: column; padding: 15px; }
          .neo-agenda-section { width: 100%; max-height: none; margin-top: 20px; }
          .neo-days-header div { font-size: 0.7rem; padding-left: 5px; }
        }
        @media (max-width: 600px) {
          .neo-grid { gap: 8px; }
          .neo-cell { padding: 8px; min-height: 90px; border-radius: 10px; }
          .neo-date-num { font-size: 0.9rem; margin-bottom: 4px; }
          .neo-event-title { display: none; } 
          .neo-event-bar { height: 6px; width: 6px; border-radius: 50%; }
        }
      `}</style>
    </Layout>
  );
}