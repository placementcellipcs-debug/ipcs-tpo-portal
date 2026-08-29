import { useEffect, useState } from 'react';
import axios from 'axios';
import { 
  Plus, CaretLeft, CaretRight, X, CircleNotch, CalendarBlank, MapPin, 
  Clock, Buildings, CalendarStar, Briefcase, UserCheck, Image
} from '@phosphor-icons/react';
import Layout from './Layout';

const API_BASE = "https://ipcs-tpo-portal-u0l6.onrender.com";

// 🚨 ROBUST DATE PARSER ADDED to fix the blank calendar issue
const parseDate = (dateStr) => {
  if (!dateStr) return null;
  let cleanStr = typeof dateStr === 'string' ? dateStr.split(' ')[0].replace(/st|nd|rd|th/g, '') : dateStr;

  if (typeof cleanStr === 'string' && (cleanStr.includes('/') || cleanStr.includes('-'))) {
    const parts = cleanStr.split(/[/-]/);
    if (parts.length === 3) {
      // Handles DD/MM/YYYY or DD-MM-YYYY
      if (parts[2].length === 4) {
        return new Date(`${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`);
      }
      // Handles YYYY/MM/DD or YYYY-MM-DD
      if (parts[0].length === 4) {
        return new Date(`${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`);
      }
    }
  }
  const d = new Date(cleanStr);
  return isNaN(d) ? null : d;
};

export default function Events() {
  const tpoDataStr = localStorage.getItem('tpoData');
  const tpoData = tpoDataStr ? JSON.parse(tpoDataStr) : null;
  
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Master Category Tabs: 'calendar' | 'Placement Drive' | 'Talentino' | 'Other'
  const [categoryTab, setCategoryTab] = useState('calendar');
  const [view, setView] = useState('Month'); 
  const [currentDate, setCurrentDate] = useState(new Date());

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
    return '#38bdf8';
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

  // Categorized event filtering
  const categorizedEvents = events.filter(e => {
    if (categoryTab === 'calendar') return true;
    if (categoryTab === 'Other') {
      return !['Placement Drive', 'Talentino'].some(t => (e.type || '').toLowerCase().includes(t.toLowerCase()));
    }
    return (e.type || '').toLowerCase().includes(categoryTab.toLowerCase());
  }).sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

  // Calendar Grids
  const renderMonthGrid = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const grid = [];
    for (let i = 0; i < firstDay; i++) grid.push(<div key={`empty-${i}`} className="cal-cell empty" style={{ minHeight: '120px', background: 'var(--bg-dark)', borderRight: '1px solid var(--card-border)', borderBottom: '1px solid var(--card-border)' }}></div>);
    
    for (let day = 1; day <= daysInMonth; day++) {
      const cellDate = new Date(year, month, day);
      
      const dayEvents = events.filter(e => {
        const pd = parseDate(e.date);
        return pd && pd.toDateString() === cellDate.toDateString();
      });

      grid.push(
        <div key={day} className="cal-cell" style={{ minHeight: '120px', padding: '8px', borderRight: '1px solid var(--card-border)', borderBottom: '1px solid var(--card-border)' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>{day}</div>
          {dayEvents.map((e, i) => (
            <div key={i} className="cal-event-pill" style={{ 
              background: getEventColor(e.type), 
              marginBottom: '4px', 
              padding: '4px 6px', 
              borderRadius: '4px', 
              fontSize: '0.75rem', 
              color: '#fff', 
              whiteSpace: 'nowrap', 
              overflow: 'hidden', 
              textOverflow: 'ellipsis' 
            }} title={`${e.time || 'All Day'} - ${e.title}`}>
              {e.time && <strong>{e.time}</strong>} {e.title}
            </div>
          ))}
        </div>
      );
    }
    return grid;
  };

  return (
    <Layout>
      <div className="page-container" style={{ padding: 0 }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '15px' }}>
          <div>
            <h1 style={{ fontSize: '2rem', margin: '0 0 5px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <CalendarStar color="var(--accent-primary)" weight="fill" /> Schedule & Event Dashboard
            </h1>
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>Track corporate drives and training sessions across branches.</p>
          </div>
          <button className="btn-action" style={{ width: 'auto', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px' }} onClick={() => setIsModalOpen(true)}>
            <Plus weight="bold" /> Add Event
          </button>
        </div>

        {/* 🚨 CATEGORY NAVIGATION TABS */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '25px', borderBottom: '1px solid var(--card-border)', paddingBottom: '10px', overflowX: 'auto' }}>
          <button 
            onClick={() => setCategoryTab('calendar')}
            style={{ background: categoryTab === 'calendar' ? 'rgba(56, 189, 248, 0.1)' : 'transparent', color: categoryTab === 'calendar' ? 'var(--accent-primary)' : 'var(--text-muted)', border: 'none', padding: '10px 18px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' }}
          >
            <CalendarBlank size={18} weight={categoryTab === 'calendar' ? "fill" : "regular"} /> Calendar View
          </button>
          <button 
            onClick={() => setCategoryTab('Placement Drive')}
            style={{ background: categoryTab === 'Placement Drive' ? 'rgba(239, 68, 68, 0.1)' : 'transparent', color: categoryTab === 'Placement Drive' ? '#ef4444' : 'var(--text-muted)', border: 'none', padding: '10px 18px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' }}
          >
            <Briefcase size={18} weight={categoryTab === 'Placement Drive' ? "fill" : "regular"} /> Placement Drives
          </button>
          <button 
            onClick={() => setCategoryTab('Talentino')}
            style={{ background: categoryTab === 'Talentino' ? 'rgba(168, 85, 247, 0.1)' : 'transparent', color: categoryTab === 'Talentino' ? '#a855f7' : 'var(--text-muted)', border: 'none', padding: '10px 18px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' }}
          >
            <UserCheck size={18} weight={categoryTab === 'Talentino' ? "fill" : "regular"} /> Talentino
          </button>
          <button 
            onClick={() => setCategoryTab('Other')}
            style={{ background: categoryTab === 'Other' ? 'rgba(56, 189, 248, 0.1)' : 'transparent', color: categoryTab === 'Other' ? '#38bdf8' : 'var(--text-muted)', border: 'none', padding: '10px 18px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' }}
          >
            <CalendarStar size={18} weight={categoryTab === 'Other' ? "fill" : "regular"} /> Other Events
          </button>
        </div>

        {/* ========================================== */}
        {/* VIEW 1: FULL CALENDAR VIEW */}
        {/* ========================================== */}
        {categoryTab === 'calendar' && (
          <div className="cal-main" style={{ background: 'var(--card-bg)', borderRadius: '12px', border: '1px solid var(--card-border)', overflow: 'hidden' }}>
            <div className="cal-toolbar" style={{ background: '#161e2e', padding: '15px 20px', borderBottom: '1px solid var(--card-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px', fontWeight: 'bold', fontSize: '1.2rem', color: '#fff' }}>
                <CaretLeft size={24} style={{ cursor: 'pointer', color: 'var(--text-muted)' }} onClick={prevPeriod} />
                {getMonthName()}
                <CaretRight size={24} style={{ cursor: 'pointer', color: 'var(--text-muted)' }} onClick={nextPeriod} />
              </div>
            </div>

            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', padding: '15px 0', borderBottom: '1px solid var(--card-border)' }}>
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => <div key={day} style={{ fontWeight: 'bold', color: 'var(--text-muted)', fontSize: '0.85rem', textTransform: 'uppercase' }}>{day}</div>)}
              </div>
              <div className="cal-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
                {loading ? (
                  <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '4rem', color: 'var(--accent-primary)' }}>
                    <CircleNotch size={40} className="ph-spin" />
                  </div>
                ) : (
                  renderMonthGrid()
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* VIEW 2: CATEGORIZED SCHEDULES & BRANCHES */}
        {/* ========================================== */}
        {categoryTab !== 'calendar' && (
          <div style={{ display: 'grid', gap: '15px' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '3rem' }}><CircleNotch size={32} className="ph-spin" color="var(--accent-primary)" /></div>
            ) : categorizedEvents.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', background: 'var(--card-bg)', borderRadius: '12px', border: '1px solid var(--card-border)', color: 'var(--text-muted)' }}>
                No events recorded for this category.
              </div>
            ) : (
              categorizedEvents.map((evt, idx) => (
                <div key={idx} style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderLeft: `6px solid ${getEventColor(evt.type)}`, borderRadius: '12px', padding: '20px', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '20px' }}>
                  <div style={{ flex: '1 1 350px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <span style={{ background: 'rgba(255,255,255,0.05)', color: getEventColor(evt.type), padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                        {evt.type}
                      </span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={14} /> {evt.time || 'Time TBD'}
                      </span>
                    </div>
                    <h3 style={{ margin: '0 0 8px 0', fontSize: '1.25rem', color: '#fff' }}>{evt.title}</h3>
                    {evt.description && <p style={{ margin: '0 0 10px 0', fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>{evt.description}</p>}
                    <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', fontSize: '0.85rem', color: '#cbd5e1' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><MapPin size={16} color="var(--accent-primary)" /> Location: <b>{evt.location || 'N/A'}</b></span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><Buildings size={16} color="#f59e0b" /> Branch: <b>{evt.branch || 'All Branches'}</b></span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '10px' }}>
                    <div style={{ background: 'var(--bg-dark)', border: '1px solid var(--card-border)', padding: '10px 18px', borderRadius: '10px', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>EVENT DATE</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#fff' }}>{evt.date}</div>
                    </div>
                    {evt.poster && (
                      <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }} onClick={() => window.open(evt.poster, '_blank')}>
                        <Image size={16} /> View Poster
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

      </div>

      {/* ========================================== */}
      {/* ADD EVENT MODAL */}
      {/* ========================================== */}
      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 99999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }} onClick={(e) => { if(e.target === e.currentTarget) setIsModalOpen(false); }}>
          <div className="modal-card" style={{ maxWidth: '600px', width: '100%', maxHeight: '90vh', overflowY: 'auto', background: '#0f1523', border: '1px solid var(--card-border)', borderRadius: '16px', padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid #1e293b', paddingBottom: '10px' }}>
              <h3 style={{ margin: 0, fontSize: '1.4rem', color: '#fff' }}>Add New Event</h3>
              <X size={24} style={{ cursor: 'pointer', color: 'var(--text-muted)' }} onClick={() => setIsModalOpen(false)} />
            </div>

            <div className="form-group" style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '5px' }}>Event Title</label>
              <input type="text" className="sleek-input" style={{ width: '100%' }} value={newEvent.title} onChange={e => setNewEvent({...newEvent, title: e.target.value})} placeholder="e.g. Wipro Placement Drive" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
              <div className="form-group">
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '5px' }}>Date *</label>
                <input type="date" className="sleek-input" style={{ width: '100%' }} value={newEvent.date} onChange={e => setNewEvent({...newEvent, date: e.target.value})} />
              </div>
              <div className="form-group">
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '5px' }}>Time</label>
                <input type="time" className="sleek-input" style={{ width: '100%' }} value={newEvent.time} onChange={e => setNewEvent({...newEvent, time: e.target.value})} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
              <div className="form-group">
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '5px' }}>Event Type *</label>
                <select className="sleek-input" style={{ width: '100%' }} value={newEvent.type} onChange={e => setNewEvent({...newEvent, type: e.target.value})}>
                  <option value="Placement Drive">Placement Drive</option>
                  <option value="Talentino">Talentino</option>
                  <option value="Training">Training</option>
                </select>
              </div>
              <div className="form-group">
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '5px' }}>Event Location</label>
                <input type="text" className="sleek-input" style={{ width: '100%' }} value={newEvent.location} onChange={e => setNewEvent({...newEvent, location: e.target.value})} placeholder="e.g. Bangalore Branch, Online" />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '5px' }}>Eligible Branch</label>
              <select className="sleek-input" style={{ width: '100%' }} value={newEvent.branch} onChange={e => setNewEvent({...newEvent, branch: e.target.value})}>
                <option value="All Branches">All Branches</option>
                <option value="Bangalore">Bangalore</option>
                <option value="Trivandrum">Trivandrum</option>
                <option value="Kochi">Kochi</option>
                <option value="Calicut">Calicut</option>
                <option value="Kannur">Kannur</option>
                <option value="Coimbatore">Coimbatore</option>
                <option value="Chennai">Chennai</option>
                <option value="Madurai">Madurai</option>
                <option value="Trichy">Trichy</option>
                <option value="Tirunelveli">Tirunelveli</option>
                <option value="Nagercoil">Nagercoil</option>
                <option value="Mumbai">Mumbai</option>
                <option value="Pune">Pune</option>
                <option value="Salem">Salem</option>
                <option value="Erode">Erode</option>
                <option value="Mysore">Mysore</option>
                <option value="Hubli">Hubli</option>
                <option value="Belgaum">Belgaum</option>
                <option value="Mangalore">Mangalore</option>
                <option value="Delhi">Delhi</option>
                <option value="Navi Mumbai">Navi Mumbai</option>
                <option value="Noida">Noida</option>
                <option value="Lucknow">Lucknow</option>
                <option value="Dubai">Dubai</option>
                <option value="Qatar">Qatar</option>
                <option value="Pathanamthitta">Pathanamthitta</option>
                <option value="Kottayam">Kottayam</option>
                <option value="Alleppey">Alleppey</option>
                <option value="Trichur">Trichur</option>
                <option value="Palakkad">Palakkad</option>
                <option value="Malappuram">Malappuram</option>
                <option value="Perinthalmanna">Perinthalmanna</option>
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '5px' }}>Description</label>
              <textarea className="sleek-input" style={{ width: '100%', minHeight: '80px', resize: 'vertical' }} value={newEvent.description} onChange={e => setNewEvent({...newEvent, description: e.target.value})} placeholder="Add instructions or meeting links..."></textarea>
            </div>

            {newEvent.type === 'Placement Drive' && (
              <div className="form-group" style={{ marginBottom: '25px', background: 'rgba(56, 189, 248, 0.05)', padding: '15px', borderRadius: '8px', border: '1px dashed #38bdf8' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#38bdf8', marginBottom: '8px', fontWeight: 'bold' }}>Upload Drive Poster (Optional)</label>
                <input type="file" accept="image/*" className="sleek-input" style={{ width: '100%', padding: '8px' }} onChange={e => setPosterFile(e.target.files[0])} />
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