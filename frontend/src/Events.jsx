import { useEffect, useState } from 'react';
import axios from 'axios';
import { Plus, CaretLeft, CaretRight, X, CircleNotch } from '@phosphor-icons/react';
import Layout from './Layout';

const API_BASE = "https://ipcs-tpo-portal.onrender.com";

export default function Events() {
  const [events, setEvents] = useState([]);
  const [view, setView] = useState('Month'); // Day, Week, Month
  
  // Modal & Saving State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newEvent, setNewEvent] = useState({ date: '', time: '', branch: 'Bangalore', type: 'Placement Drive', location: '', title: '' });

  const fetchEvents = async () => {
    try {
      const response = await axios.get(`${API_BASE}/api/tpo/events`);
      if (response.data.success) setEvents(response.data.events);
    } catch (error) {
      console.error("Failed to fetch events", error);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  // 🚨 THE NEW SAVE FUNCTION
  const handleSaveEvent = async () => {
    if (!newEvent.title || !newEvent.date || !newEvent.time) {
      return alert("Please fill in the Event Title, Date, and Time.");
    }
    
    setIsSaving(true);
    try {
      const res = await axios.post(`${API_BASE}/api/tpo/events/add`, newEvent);
      if (res.data.success) {
        setIsModalOpen(false);
        setNewEvent({ date: '', time: '', branch: 'Bangalore', type: 'Placement Drive', location: '', title: '' });
        fetchEvents(); // Refresh the calendar
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
    return '#38bdf8';
  };

  const daysInMonth = Array.from({length: 30}, (_, i) => i + 1);

  return (
    <Layout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.8rem', margin: 0 }}>Calendar</h1>
        <button className="btn-action" style={{ width: 'auto', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '5px' }} onClick={() => setIsModalOpen(true)}>
          <Plus weight="bold" size={16} /> Add Event
        </button>
      </div>

      <div className="calendar-layout">
        {/* LEFT SIDEBAR */}
        <div>
          <div className="cal-sidebar" style={{ marginBottom: '1rem' }}>
            <h4 style={{ marginBottom: '15px' }}>Filters</h4>
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
              {events.slice(0, 4).map((e, i) => (
                <div key={i} style={{ padding: '10px', borderLeft: `3px solid ${getEventColor(e.type)}`, background: 'var(--bg-dark)', borderRadius: '6px' }}>
                  <strong style={{ fontSize: '0.85rem', display: 'block' }}>{e.title}</strong>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{e.date} • {e.time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* MAIN CALENDAR AREA */}
        <div className="cal-main">
          <div className="cal-toolbar">
            <div className="view-toggles" style={{ borderRadius: '20px' }}>
              {['Day', 'Week', 'Month'].map(v => (
                <button key={v} className={`view-btn ${view === v ? 'active' : ''}`} onClick={() => setView(v)} style={{ padding: '0.4rem 1.2rem', fontSize: '0.85rem', borderRadius: '20px' }}>
                  {v}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', fontWeight: 600 }}>
              <CaretLeft size={20} style={{ cursor: 'pointer' }} />
              August 2026
              <CaretRight size={20} style={{ cursor: 'pointer' }} />
            </div>
          </div>

          {view === 'Month' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => <div key={day} className="cal-day-header">{day}</div>)}
              </div>
              <div className="cal-grid">
                {daysInMonth.map(day => {
                  const dayEvents = events.filter(e => e.date && parseInt(e.date.split('-')[2] || e.date.split('/')[0]) === day);
                  return (
                    <div key={day} className="cal-cell">
                      <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>{day}</div>
                      {dayEvents.map((e, i) => (
                        <div key={i} className="cal-event-pill" style={{ background: getEventColor(e.type) }}>
                          {e.time} {e.title}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {view !== 'Month' && (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', height: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              Select "Month" view. (Timeline grid architecture requires backend hour mapping)
            </div>
          )}
        </div>
      </div>

      {/* 🚨 BULLETPROOF OVERLAY MODAL */}
      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 99999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }} onClick={(e) => { if(e.target === e.currentTarget) setIsModalOpen(false); }}>
          <div className="modal-card" style={{ maxWidth: '500px', width: '100%', background: '#0f1523', border: '1px solid var(--card-border)', borderRadius: '16px', padding: '2rem' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid #1e293b', paddingBottom: '10px' }}>
              <h3 style={{ margin: 0, fontSize: '1.4rem' }}>Add Event</h3>
              <X size={24} style={{ cursor: 'pointer', color: 'var(--text-muted)' }} onClick={() => setIsModalOpen(false)} />
            </div>

            <div className="form-group" style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '5px' }}>Event Title</label>
              <input type="text" className="sleek-input" style={{ width: '100%' }} value={newEvent.title} onChange={e => setNewEvent({...newEvent, title: e.target.value})} placeholder="e.g. Wipro Placement Drive" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
              <div className="form-group">
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '5px' }}>Date</label>
                <input type="date" className="sleek-input" style={{ width: '100%' }} value={newEvent.date} onChange={e => setNewEvent({...newEvent, date: e.target.value})} />
              </div>
              <div className="form-group">
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '5px' }}>Time</label>
                <input type="time" className="sleek-input" style={{ width: '100%' }} value={newEvent.time} onChange={e => setNewEvent({...newEvent, time: e.target.value})} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '25px' }}>
              <div className="form-group">
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '5px' }}>Branch</label>
                <select className="sleek-input" style={{ width: '100%' }} value={newEvent.branch} onChange={e => setNewEvent({...newEvent, branch: e.target.value})}>
                  <option value="Bangalore">Bangalore</option><option value="Trivandrum">Trivandrum</option><option value="Kochi">Kochi</option><option value="Calicut">Calicut</option>
                </select>
              </div>
              <div className="form-group">
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '5px' }}>Event Type</label>
                <select className="sleek-input" style={{ width: '100%' }} value={newEvent.type} onChange={e => setNewEvent({...newEvent, type: e.target.value})}>
                  <option value="Placement Drive">Placement Drive</option><option value="Interview">Interview</option><option value="Talentino">Talentino</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button className="btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
              <button className="btn-action" style={{ background: '#3b82f6', color: '#fff' }} onClick={handleSaveEvent} disabled={isSaving}>
                {isSaving ? <CircleNotch size={18} className="ph-spin" /> : "Save Event"}
              </button>
            </div>

          </div>
        </div>
      )}
    </Layout>
  );
}