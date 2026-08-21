import { useEffect, useState } from 'react';
import axios from 'axios';
import { Plus, CaretLeft, CaretRight, X, CircleNotch, CalendarBlank, MapPin, Clock, Textbox } from '@phosphor-icons/react';
import Layout from './Layout';

const API_BASE = "https://ipcs-tpo-portal.onrender.com";

export default function Events() {
  const tpoData = JSON.parse(localStorage.getItem('tpoData'));
  const [events, setEvents] = useState([]);
  const [view, setView] = useState('Month'); // Day, Week, Month
  
  // Date State for Navigation
  const [currentDate, setCurrentDate] = useState(new Date());

  // Modal & Saving State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const [newEvent, setNewEvent] = useState({ 
    date: '', time: '', branch: tpoData?.assignedBranchesArray[0] || 'All Branch', 
    type: 'Placement Drive', title: '', description: '', location: '' 
  });
  const [posterFile, setPosterFile] = useState(null);

  const fetchEvents = async () => {
    try {
      const response = await axios.get(`${API_BASE}/api/tpo/events`);
      if (response.data.success) {
        setEvents(response.data.events);
      }
    } catch (error) {
      console.error("Failed to fetch events", error);
    }
  };

  useEffect(() => {
    fetchEvents();
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
        setNewEvent({ date: '', time: '', branch: tpoData?.assignedBranchesArray[0] || 'All Branch', type: 'Placement Drive', title: '', description: '', location: '' });
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
    if (type.includes('Interview')) return '#10b981';
    if (type.includes('Talentino')) return '#a855f7';
    if (type.includes('Placement Drive')) return '#ef4444';
    return '#38bdf8'; // Default
  };

  // ==========================================
  // CALENDAR HELPER FUNCTIONS
  // ==========================================
  const parseDate = (dateStr) => {
    if (!dateStr) return null;
    const cleanStr = dateStr.replace(/st|nd|rd|th/g, ''); // Remove 1st, 2nd, etc.
    const parsed = new Date(cleanStr);
    return isNaN(parsed) ? null : parsed;
  };

  const nextPeriod = () => {
    const d = new Date(currentDate);
    if (view === 'Month') d.setMonth(d.getMonth() + 1);
    if (view === 'Week') d.setDate(d.getDate() + 7);
    if (view === 'Day') d.setDate(d.getDate() + 1);
    setCurrentDate(d);
  };

  const prevPeriod = () => {
    const d = new Date(currentDate);
    if (view === 'Month') d.setMonth(d.getMonth() - 1);
    if (view === 'Week') d.setDate(d.getDate() - 7);
    if (view === 'Day') d.setDate(d.getDate() - 1);
    setCurrentDate(d);
  };

  const getMonthName = () => currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  // Get upcoming events for Sidebar
  const today = new Date();
  today.setHours(0,0,0,0);
  const upcomingEvents = events
    .map(e => ({ ...e, parsedDate: parseDate(e.date) }))
    .filter(e => e.parsedDate && e.parsedDate >= today)
    .sort((a, b) => a.parsedDate - b.parsedDate)
    .slice(0, 4);

  // ==========================================
  // RENDER GRID HELPERS
  // ==========================================
  const renderMonthGrid = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const grid = [];
    for (let i = 0; i < firstDay; i++) grid.push(<div key={`empty-${i}`} className="cal-cell empty"></div>);
    
    for (let day = 1; day <= daysInMonth; day++) {
      const cellDate = new Date(year, month, day);
      const dayEvents = events.filter(e => {
        const pd = parseDate(e.date);
        return pd && pd.toDateString() === cellDate.toDateString();
      });

      grid.push(
        <div key={day} className="cal-cell">
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>{day}</div>
          {dayEvents.map((e, i) => (
            <div key={i} className="cal-event-pill" style={{ background: getEventColor(e.type), marginBottom: '4px' }} title={`${e.time} - ${e.location}`}>
              {e.time && <strong>{e.time}</strong>} {e.title}
            </div>
          ))}
        </div>
      );
    }
    return grid;
  };

  const renderWeekGrid = () => {
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay()); // Start on Sunday
    
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      
      const dayEvents = events.filter(e => {
        const pd = parseDate(e.date);
        return pd && pd.toDateString() === d.toDateString();
      });

      days.push(
        <div key={i} className="cal-cell" style={{ minHeight: '300px' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#fff', marginBottom: '10px', textAlign: 'center', borderBottom: '1px solid var(--card-border)', paddingBottom: '5px' }}>
            {d.toLocaleString('default', { weekday: 'short' })} {d.getDate()}
          </div>
          {dayEvents.map((e, idx) => (
            <div key={idx} style={{ background: getEventColor(e.type), padding: '8px', borderRadius: '6px', color: '#fff', fontSize: '0.8rem', marginBottom: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{e.title}</div>
              {e.time && <div style={{ fontSize: '0.7rem', opacity: 0.9 }}>{e.time}</div>}
              {e.location && <div style={{ fontSize: '0.7rem', opacity: 0.9 }}>📍 {e.location}</div>}
            </div>
          ))}
        </div>
      );
    }
    return days;
  };

  const renderDayGrid = () => {
    const dayEvents = events.filter(e => {
      const pd = parseDate(e.date);
      return pd && pd.toDateString() === currentDate.toDateString();
    });

    return (
      <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '12px', padding: '20px', minHeight: '400px' }}>
        <h2 style={{ color: '#fff', marginBottom: '20px', borderBottom: '1px solid var(--card-border)', paddingBottom: '10px' }}>
          {currentDate.toLocaleString('default', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
        </h2>
        
        {dayEvents.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            <CalendarBlank size={48} style={{ opacity: 0.3, marginBottom: '10px' }} /><br/>
            No events scheduled for this day.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '15px' }}>
            {dayEvents.map((e, i) => (
              <div key={i} style={{ display: 'flex', gap: '15px', padding: '15px', background: '#161e2e', borderRadius: '10px', borderLeft: `5px solid ${getEventColor(e.type)}` }}>
                <div style={{ minWidth: '80px', color: 'var(--text-muted)', fontWeight: 'bold' }}>{e.time || 'All Day'}</div>
                <div>
                  <h3 style={{ margin: '0 0 5px 0', color: '#fff' }}>{e.title}</h3>
                  <div style={{ display: 'flex', gap: '15px', fontSize: '0.85rem', color: '#cbd5e1' }}>
                    {e.type && <span><span style={{ color: getEventColor(e.type) }}>●</span> {e.type}</span>}
                    {e.location && <span>📍 {e.location}</span>}
                    {e.branch && <span>🏢 {e.branch}</span>}
                  </div>
                  {e.description && <p style={{ margin: '10px 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>{e.description}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };


  return (
    <Layout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '15px' }}>
        <h1 style={{ fontSize: '1.8rem', margin: 0 }}>Calendar Dashboard</h1>
        <button className="btn-action" style={{ width: 'auto', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '8px' }} onClick={() => setIsModalOpen(true)}>
          <Plus weight="bold" /> Add Event
        </button>
      </div>

      <div className="calendar-layout">
        
        {/* LEFT SIDEBAR */}
        <div>
          <div className="cal-sidebar" style={{ marginBottom: '1rem' }}>
            <h4 style={{ marginBottom: '15px' }}>Categories</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.85rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><div style={{ width: 12, height: 12, borderRadius: '50%', background: '#ef4444' }}></div> Placement Drives</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><div style={{ width: 12, height: 12, borderRadius: '50%', background: '#10b981' }}></div> Interviews</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><div style={{ width: 12, height: 12, borderRadius: '50%', background: '#a855f7' }}></div> Talentino</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><div style={{ width: 12, height: 12, borderRadius: '50%', background: '#38bdf8' }}></div> Other</label>
            </div>
          </div>

          <div className="cal-sidebar">
            <h4 style={{ marginBottom: '15px' }}>Upcoming Events</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {upcomingEvents.length === 0 ? (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No upcoming events.</div>
              ) : (
                upcomingEvents.map((e, i) => (
                  <div key={i} style={{ padding: '12px', borderLeft: `3px solid ${getEventColor(e.type)}`, background: '#161e2e', borderRadius: '6px' }}>
                    <strong style={{ fontSize: '0.9rem', display: 'block', color: '#fff', marginBottom: '4px' }}>{e.title}</strong>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <CalendarBlank size={12}/> {e.date} {e.time && `• ${e.time}`}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* MAIN CALENDAR AREA */}
        <div className="cal-main">
          <div className="cal-toolbar" style={{ background: '#161e2e', padding: '15px 20px', borderRadius: '12px', marginBottom: '15px' }}>
            <div className="view-toggles" style={{ borderRadius: '20px', background: '#0f1523', padding: '4px' }}>
              {['Day', 'Week', 'Month'].map(v => (
                <button key={v} className={`view-btn ${view === v ? 'active' : ''}`} onClick={() => setView(v)} style={{ padding: '0.4rem 1.5rem', fontSize: '0.85rem', borderRadius: '16px' }}>
                  {v}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', fontWeight: 'bold', fontSize: '1.2rem', color: '#fff' }}>
              <CaretLeft size={24} style={{ cursor: 'pointer', color: 'var(--text-muted)' }} onClick={prevPeriod} />
              {view === 'Day' ? currentDate.toDateString() : getMonthName()}
              <CaretRight size={24} style={{ cursor: 'pointer', color: 'var(--text-muted)' }} onClick={nextPeriod} />
            </div>
          </div>

          {view === 'Month' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', marginBottom: '10px' }}>
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => <div key={day} style={{ fontWeight: 'bold', color: 'var(--text-muted)', fontSize: '0.85rem', textTransform: 'uppercase' }}>{day}</div>)}
              </div>
              <div className="cal-grid">
                {renderMonthGrid()}
              </div>
            </div>
          )}

          {view === 'Week' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '10px' }}>
              {renderWeekGrid()}
            </div>
          )}

          {view === 'Day' && renderDayGrid()}

        </div>
      </div>

      {/* ========================================== */}
      {/* BULLETPROOF OVERLAY MODAL FOR ADDING EVENTS*/}
      {/* ========================================== */}
      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 99999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }} onClick={(e) => { if(e.target === e.currentTarget) setIsModalOpen(false); }}>
          <div className="modal-card" style={{ maxWidth: '600px', width: '100%', maxHeight: '90vh', overflowY: 'auto', background: '#0f1523', border: '1px solid var(--card-border)', borderRadius: '16px', padding: '2rem' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid #1e293b', paddingBottom: '10px' }}>
              <h3 style={{ margin: 0, fontSize: '1.4rem', color: '#fff' }}>Add New Event</h3>
              <X size={24} style={{ cursor: 'pointer', color: 'var(--text-muted)' }} onClick={() => setIsModalOpen(false)} />
            </div>

            <div style={{ background: '#161e2e', padding: '12px', borderRadius: '8px', marginBottom: '15px', fontSize: '0.85rem', color: '#cbd5e1' }}>
              <strong>TPO Posting:</strong> {tpoData?.name || 'Unknown Officer'}
            </div>

            <div className="form-group" style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '5px' }}>Event Title</label>
              <input type="text" className="sleek-input" style={{ width: '100%' }} value={newEvent.title} onChange={e => setNewEvent({...newEvent, title: e.target.value})} placeholder="e.g. Wipro Placement Drive" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
              <div className="form-group">
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '5px' }}>Date <span style={{color: '#ef4444'}}>*</span></label>
                <input type="date" className="sleek-input" style={{ width: '100%' }} value={newEvent.date} onChange={e => setNewEvent({...newEvent, date: e.target.value})} />
              </div>
              <div className="form-group">
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '5px' }}>Time</label>
                <input type="time" className="sleek-input" style={{ width: '100%' }} value={newEvent.time} onChange={e => setNewEvent({...newEvent, time: e.target.value})} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
              <div className="form-group">
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '5px' }}>Event Type <span style={{color: '#ef4444'}}>*</span></label>
                <select className="sleek-input" style={{ width: '100%' }} value={newEvent.type} onChange={e => setNewEvent({...newEvent, type: e.target.value})}>
                  <option value="Placement Drive">Placement Drive</option>
                  <option value="Interview">Interview</option>
                  <option value="Talentino">Talentino</option>
                  <option value="Training">Training</option>
                </select>
              </div>
              <div className="form-group">
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '5px' }}>Event Happening In</label>
                <input type="text" className="sleek-input" style={{ width: '100%' }} value={newEvent.location} onChange={e => setNewEvent({...newEvent, location: e.target.value})} placeholder="e.g. Kochi Branch, Online" />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '5px' }}>Eligible Branches</label>
              <select className="sleek-input" style={{ width: '100%' }} value={newEvent.branch} onChange={e => setNewEvent({...newEvent, branch: e.target.value})}>
                <option value="All Branch">All Branches</option>
                <option value="Bangalore">Bangalore</option>
                <option value="Trivandrum">Trivandrum</option>
                <option value="Kochi">Kochi</option>
                <option value="Calicut">Calicut</option>
                <option value="Kannur">Kannur</option>
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '5px' }}>Description</label>
              <textarea className="sleek-input" style={{ width: '100%', minHeight: '80px', resize: 'vertical' }} value={newEvent.description} onChange={e => setNewEvent({...newEvent, description: e.target.value})} placeholder="Add event details, instructions, or meeting links..."></textarea>
            </div>

            {/* 🚨 DYNAMIC POSTER UPLOAD: Only shows if "Placement Drive" is selected */}
            {newEvent.type === 'Placement Drive' && (
              <div className="form-group" style={{ marginBottom: '25px', background: 'rgba(56, 189, 248, 0.05)', padding: '15px', borderRadius: '8px', border: '1px dashed #38bdf8' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#38bdf8', marginBottom: '8px', fontWeight: 'bold' }}>Upload Drive Poster (Optional)</label>
                <input type="file" accept="image/*" className="sleek-input" style={{ width: '100%', padding: '8px' }} onChange={e => setPosterFile(e.target.files[0])} />
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '5px' }}>If attached, this will be uploaded to Drive and linked in the sheet automatically.</div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid #1e293b', paddingTop: '1.5rem' }}>
              <button className="btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
              <button className="btn-action" style={{ background: '#38bdf8', color: '#0f172a' }} onClick={handleSaveEvent} disabled={isSaving}>
                {isSaving ? <CircleNotch size={18} className="ph-spin" /> : "Save Event"}
              </button>
            </div>

          </div>
        </div>
      )}
    </Layout>
  );
}