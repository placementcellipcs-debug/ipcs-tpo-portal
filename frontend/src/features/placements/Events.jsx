import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { 
  Plus, CaretLeft, CaretRight, X, CircleNotch, MapPin, 
  Clock, CalendarBlank, UserCheck, CaretDown, Image
} from '@phosphor-icons/react';
import Layout from '../../layouts/Layout';
import DateInput from '../../components/DateInput';
import { formatPortalDate, formatPortalTime, parsePortalDateTime } from '../../utils/dateFormat';

import { API_BASE } from '../../services/apiConfig';

const MAIN_PLACEMENT_COURSES = [
  'Information technology (IT)',
  'BMS AND CCTV',
  'Embedded and IoT',
  'Industrial Automation',
  'Digital Marketing'
];

const parseDate = dateStr => parsePortalDateTime(dateStr);
const getFirstAssignedBranch = branches => {
  const values = Array.isArray(branches) ? branches : String(branches || '').split(/[\n,;]+/);
  return values.map(value => String(value || '').trim()).find(value => value && !/^all(?:\s+branches)?$/i.test(value)) || '';
};

export default function Events() {
  const tpoDataStr = localStorage.getItem('tpoData');
  const tpoData = tpoDataStr ? JSON.parse(tpoDataStr) : null;
  const eventRole = String(tpoData?.role || '').toUpperCase();
  const isDesigner = ['DESIGN', 'MEDIA', 'CREATIVE'].some(part => eventRole.includes(part));
  const isTpo = eventRole.includes('TPO') || eventRole.includes('PLACEMENT OFFICER');
  const canManageEvents = tpoData?.accessType === 'superadmin' || eventRole.includes('TPO') || eventRole.includes('PLACEMENT OFFICER');
  const defaultTalentinoBranch = getFirstAssignedBranch(tpoData?.assignedBranchesArray);
  
  const [events, setEvents] = useState([]);
  const [branchList, setBranchList] = useState([]); 
  const [loading, setLoading] = useState(true);
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewEventModal, setViewEventModal] = useState(null); 
  const [isSaving, setIsSaving] = useState(false);
  const [eventActionForm, setEventActionForm] = useState(null);
  const [isUpdatingEvent, setIsUpdatingEvent] = useState(false);
  const [eventActionNotice, setEventActionNotice] = useState(null);
  
  const [newEvent, setNewEvent] = useState({ 
    date: '', time: '', branch: 'All Branches',
    type: 'Placement Drive', title: '', description: '', location: '', course: ''
  });
  const [posterFile, setPosterFile] = useState(null);

  useEffect(() => {
    if (!isModalOpen && !viewEventModal) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [isModalOpen, viewEventModal]);

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

  const monitorEventNotification = async eventId => {
    if (!eventId) return;
    for (let attempt = 0; attempt < 12; attempt += 1) {
      await new Promise(resolve => window.setTimeout(resolve, 5000));
      try {
        const response = await axios.get(`${API_BASE}/api/tpo/events`);
        const event = (response.data?.events || []).find(item => item.eventId === eventId);
        const status = String(event?.mailStatus || '').toUpperCase();
        if (status === 'SENT') {
          setEventActionNotice({ type: 'success', message: 'Event saved and notification email sent.' });
          return;
        }
        if (status === 'FAILED') {
          setEventActionNotice({
            type: 'warning',
            message: `Event saved, but the notification email failed: ${event.mailError || 'Check the Event sheet mail status.'}`
          });
          return;
        }
        if (status === 'QUEUED') {
          setEventActionNotice({ type: 'warning', message: 'Event saved. Its notification email is queued and will retry automatically.' });
          return;
        }
      } catch (error) {
        console.warn('Could not check event notification status:', error);
        return;
      }
    }
    setEventActionNotice({
      type: 'warning',
      message: 'Event saved. Email delivery is still pending; check the Event sheet Mail_Status column.'
    });
  };

  const fetchBranches = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/tpo/branches`);
      if (res.data.success) {
        const branches = [...new Set(res.data.branches
          .map(b => b.branch)
          .filter(name => Boolean(name) && !['all', 'all branches'].includes(String(name).trim().toLowerCase())))]
          .sort((a, b) => a.localeCompare(b));
        setBranchList(branches);
      }
    } catch (error) {
      console.error("Failed to fetch branches", error);
    }
  };

  useEffect(() => {
    fetchEvents();
    if (canManageEvents) fetchBranches();
  }, [canManageEvents]);

  const handleSaveEvent = async () => {
    if (!newEvent.title || !newEvent.date || !newEvent.type || (newEvent.type === 'Placement Drive' && !newEvent.course)) {
      return alert("Please fill in the Event Title, Date, Event Type, and Course for placement drives.");
    }
    
    setEventActionNotice(null);
    setIsSaving(true);
    try {
      const formData = new FormData();
      formData.append('tpo', tpoData?.name || 'Unknown');
      const eventData = { ...newEvent };
      if (/^all(?:\s+branches)?$/i.test(String(eventData.branch || '').trim())) eventData.branch = 'All Branches';
      Object.keys(eventData).forEach(key => formData.append(key, eventData[key]));
      if (posterFile) formData.append('posterFile', posterFile);

      const res = await axios.post(`${API_BASE}/api/tpo/events/add`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (!res.data?.success) throw new Error(res.data?.message || 'The event could not be saved.');
      if (res.data.success) {
        setIsModalOpen(false);
        setEventActionNotice({
          type: res.data.mailStatus === 'FAILED' ? 'warning' : 'success',
          message: res.data.message || 'Event saved.'
        });
        setNewEvent({ date: '', time: '', branch: 'All Branches', type: 'Placement Drive', title: '', description: '', location: '', course: '' });
        setPosterFile(null);
        fetchEvents(); 
        if (res.data.mailStatus === 'PENDING') void monitorEventNotification(res.data.eventId);
      }
    } catch (error) {
      const message = error.response?.data?.message || error.message || 'The event could not be saved.';
      setEventActionNotice({ type: 'error', message: `Event save failed: ${message}` });
    } finally {
      setIsSaving(false);
    }
  };

  const startEventAction = action => {
    const parsedDate = parseDate(viewEventModal?.date);
    const initialDate = parsedDate && !Number.isNaN(parsedDate.getTime())
      ? `${parsedDate.getFullYear()}-${String(parsedDate.getMonth() + 1).padStart(2, '0')}-${String(parsedDate.getDate()).padStart(2, '0')}`
      : '';
    const rawTime = String(viewEventModal?.time || '').trim();
    setEventActionForm({
      action,
      newDate: initialDate,
      time: rawTime ? formatPortalTime(rawTime, '') : '',
      reason: ''
    });
    setEventActionNotice(null);
  };

  const submitEventAction = async () => {
    if (!eventActionForm || !viewEventModal?.eventKey) return;
    if (eventActionForm.action === 'reschedule' && !eventActionForm.newDate) {
      setEventActionNotice({ type: 'error', message: 'Choose the new event date before saving.' });
      return;
    }
    setIsUpdatingEvent(true);
    try {
      const endpoint = eventActionForm.action === 'cancel' ? 'cancel' : 'reschedule';
      const payload = { reason: eventActionForm.reason };
      if (endpoint === 'reschedule') {
        payload.date = eventActionForm.newDate;
        payload.time = eventActionForm.time;
      }
      const response = await axios.post(`${API_BASE}/api/tpo/events/${encodeURIComponent(viewEventModal.eventKey)}/${endpoint}`, payload);
      if (!response.data?.success) throw new Error(response.data?.message || 'The event could not be updated.');
      const updatedEvent = response.data.event;
      if (updatedEvent) {
        setEvents(previous => previous.map(event => event.eventKey === updatedEvent.eventKey ? updatedEvent : event));
        setViewEventModal(updatedEvent);
      }
      setEventActionForm(null);
      setEventActionNotice({ type: response.data.emailSent ? 'success' : 'warning', message: response.data.message || 'Event updated.' });
    } catch (error) {
      setEventActionNotice({ type: 'error', message: error.response?.data?.message || error.message || 'The event could not be updated.' });
    } finally {
      setIsUpdatingEvent(false);
    }
  };

  const getEventColor = (type) => {
    if (!type) return 'var(--accent-primary)';
    const safeType = String(type).toLowerCase();
    if (safeType.includes('talentino')) return '#a855f7';
    if (safeType.includes('placement drive')) return '#ef4444';
    return '#10b981'; 
  };

  const nextPeriod = () => {
    const d = new Date(currentDate);
    d.setMonth(d.getMonth() + 1);
    setCurrentDate(d);
    setSelectedDate(null);
  };

  const prevPeriod = () => {
    const d = new Date(currentDate);
    d.setMonth(d.getMonth() - 1);
    setCurrentDate(d);
    setSelectedDate(null);
  };

  const isVisibleEvent = (e) => {
    if (isDesigner || isTpo) return true;
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

    const eventsByDay = new Map();
    events.forEach(event => {
      if (!isVisibleEvent(event)) return;
      const eventDate = parseDate(event.date);
      if (!eventDate || eventDate.getFullYear() !== year || eventDate.getMonth() !== month) return;
      const dayEvents = eventsByDay.get(eventDate.getDate()) || [];
      dayEvents.push(event);
      eventsByDay.set(eventDate.getDate(), dayEvents);
    });

    const grid = [];
    const cellCount = Math.ceil((firstDay + daysInMonth) / 7) * 7;
    for (let index = 0; index < cellCount; index += 1) {
      const day = index - firstDay + 1;
      if (day < 1 || day > daysInMonth) {
        grid.push(<div key={`empty-${index}`} className="neo-cell empty" aria-hidden="true"></div>);
        continue;
      }

      const cellDate = new Date(year, month, day);
      const isToday = day === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear();
      const isSelected = selectedDate && cellDate.toDateString() === selectedDate.toDateString();
      const dayEvents = eventsByDay.get(day) || [];

      grid.push(
        <div key={day} className={`neo-cell ${isSelected ? 'selected' : ''} ${isToday ? 'is-today' : ''}`}>
          <button
            type="button"
            className={`neo-date-num ${isToday && !isSelected ? 'today' : ''}`}
            onClick={() => setSelectedDate(cellDate)}
            aria-label={`${cellDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}${dayEvents.length ? `, ${dayEvents.length} ${dayEvents.length === 1 ? 'event' : 'events'}` : ''}`}
            aria-pressed={Boolean(isSelected)}
          >
            <span>{day}</span>
            {dayEvents.length > 0 && <span className="neo-date-count">{dayEvents.length}</span>}
          </button>
          <div className="neo-events">
            {dayEvents.slice(0, 3).map((e, i) => (
              <button
                type="button"
                key={i} 
                className="neo-event-indicator hover-lift" 
                onClick={() => setViewEventModal(e)}
                aria-label={`View ${e.title}`}
              >
                <span className="neo-event-bar" style={{ background: String(e.status || '').toLowerCase() === 'cancelled' ? '#ef4444' : String(e.status || '').toLowerCase() === 'rescheduled' ? '#f59e0b' : getEventColor(e.type) }}></span>
                <span className="neo-event-title" style={{ textDecoration: String(e.status || '').toLowerCase() === 'cancelled' ? 'line-through' : 'none' }}>{e.title}</span>
              </button>
            ))}
            {dayEvents.length > 3 && (
              <div className="neo-event-more">
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
    if (!isVisibleEvent(e)) return false; 
    const pd = parseDate(e.date);
    return pd && pd.toDateString() === selectedDate.toDateString();
  }) : [];

  const monthNames = Array.from({ length: 12 }, (_, index) => new Date(2020, index, 1).toLocaleString(undefined, { month: 'long' }));
  const monthEventCount = events.filter(event => {
    if (!isVisibleEvent(event)) return false;
    const eventDate = parseDate(event.date);
    return eventDate && eventDate.getFullYear() === currentDate.getFullYear() && eventDate.getMonth() === currentDate.getMonth();
  }).length;
  const yearOptions = Array.from(new Set([
    ...Array.from({ length: 9 }, (_, index) => new Date().getFullYear() - 3 + index),
    ...events.map(event => parseDate(event.date)?.getFullYear()).filter(Number.isFinite),
    currentDate.getFullYear()
  ])).sort((a, b) => a - b);

  const changeCalendarMonth = month => {
    setCurrentDate(new Date(currentDate.getFullYear(), Number(month), 1));
    setSelectedDate(null);
  };
  const changeCalendarYear = year => {
    setCurrentDate(new Date(Number(year), currentDate.getMonth(), 1));
    setSelectedDate(null);
  };
  const goToToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDate(today);
  };

  return (
    <Layout>
      <div className="page-container" style={{ padding: 0 }}>

        {eventActionNotice && !viewEventModal && <div role={eventActionNotice.type === 'error' ? 'alert' : 'status'} style={{ marginBottom: '16px', padding: '13px 16px', borderRadius: '12px', border: `1px solid ${eventActionNotice.type === 'error' ? 'rgba(248,113,113,.35)' : eventActionNotice.type === 'warning' ? 'rgba(251,191,36,.35)' : 'rgba(52,211,153,.35)'}`, background: eventActionNotice.type === 'error' ? 'rgba(127,29,29,.2)' : eventActionNotice.type === 'warning' ? 'rgba(120,53,15,.2)' : 'rgba(6,78,59,.22)', color: eventActionNotice.type === 'error' ? '#fecaca' : eventActionNotice.type === 'warning' ? '#fde68a' : '#a7f3d0' }}>{eventActionNotice.message}</div>}
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '15px' }}>
          <div>
            <h1 style={{ fontSize: '2rem', margin: '0 0 5px 0', color: '#fff' }}>
              Morning, {String(tpoData?.name || 'Alex').split(' ')[0]}!
            </h1>
            <p style={{ color: '#94a3b8', margin: 0, fontSize: '1.05rem' }}>Here's what's on your agenda today.</p>
          </div>
          
          {canManageEvents && (
            <button className="btn-action" style={{ width: 'auto', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px', background: 'var(--accent-primary)', color: '#0f172a' }} onClick={() => setIsModalOpen(true)}>
              <Plus weight="bold" /> Add Event
            </button>
          )}
        </div>

        <div className="neo-layout">
          
          {/* LEFT: CALENDAR GRID */}
          <div className="neo-calendar-section">
            <div className="neo-toolbar">
              <div className="neo-month-controls" aria-label="Calendar month and year">
                <label className="neo-select-wrap">
                  <span className="neo-sr-only">Month</span>
                  <select aria-label="Month" value={currentDate.getMonth()} onChange={event => changeCalendarMonth(event.target.value)}>
                    {monthNames.map((month, index) => <option key={month} value={index}>{month}</option>)}
                  </select>
                  <CaretDown size={15} weight="bold" aria-hidden="true" />
                </label>
                <label className="neo-select-wrap neo-year-select">
                  <span className="neo-sr-only">Year</span>
                  <select aria-label="Year" value={currentDate.getFullYear()} onChange={event => changeCalendarYear(event.target.value)}>
                    {yearOptions.map(year => <option key={year} value={year}>{year}</option>)}
                  </select>
                  <CaretDown size={15} weight="bold" aria-hidden="true" />
                </label>
              </div>
              <div className="neo-toolbar-actions">
                <span className="neo-month-summary"><span aria-hidden="true" />{monthEventCount} {monthEventCount === 1 ? 'event' : 'events'}</span>
                <button type="button" className="neo-today-button" onClick={goToToday}>Today</button>
                <div className="neo-nav-arrows">
                  <button type="button" aria-label="Previous month" onClick={prevPeriod}><CaretLeft size={17} weight="bold"/></button>
                  <button type="button" aria-label="Next month" onClick={nextPeriod}><CaretRight size={17} weight="bold"/></button>
                </div>
              </div>
            </div>

            <div className="neo-days-header">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day}>{day}</div>
              ))}
            </div>

            <div className="neo-grid">
              {loading ? (
                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '5rem', color: 'var(--accent-primary)' }}>
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
                    {formatPortalDate(selectedDate)}
                  </div>
                </div>
                <button onClick={() => setSelectedDate(null)} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#94a3b8', padding: '6px', borderRadius: '50%', cursor: 'pointer', display: 'flex', transition: '0.2s' }} title="Close Agenda">
                  <X size={18} weight="bold"/>
                </button>
              </div>

              <div className="neo-agenda-list">
                {selectedDayEvents.length === 0 ? (
                  <div style={{ color: '#64748b', fontSize: '0.9rem', textAlign: 'center', marginTop: '2rem' }}>
                    <CalendarBlank size={32} style={{ opacity: 0.5, marginBottom: '10px' }} /><br/>
                    No events scheduled for this day.
                  </div>
                ) : (
                  selectedDayEvents.map((e, idx) => (
                    <div key={idx} className="neo-agenda-card hover-lift" onClick={() => setViewEventModal(e)} style={{ cursor: 'pointer' }}>
                      <div className="neo-ac-accent" style={{ background: getEventColor(e.type) }}></div>
                      
                      <div className="neo-ac-time-row">
                        <span style={{ color: '#fff', fontWeight: 'bold' }}>{formatPortalTime(e.time, '09:00:00')}</span>
                      </div>
                      
                      <div className="neo-ac-content">
                        <h4 className="neo-ac-title">{e.title}</h4>
                        <p className="neo-ac-desc">{e.type}{e.course ? ` • ${e.course}` : ''}</p>
                        {String(e.status || 'Scheduled').toLowerCase() !== 'scheduled' && <span className={`event-status-pill ${String(e.status).toLowerCase() === 'cancelled' ? 'cancelled' : 'rescheduled'}`}>{e.status}</span>}
                        
                        <div className="neo-ac-footer">
                          <div className="neo-ac-detail"><Clock size={14} /> {e.time ? formatPortalTime(e.time) : 'All Day'}</div>
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

      {isModalOpen && createPortal((
        <div className="event-modal-backdrop" onClick={(e) => { if(e.target === e.currentTarget) setIsModalOpen(false); }}>
          <div className="event-modal-dialog" style={{ maxWidth: '600px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid #1e293b', paddingBottom: '15px' }}>
              <h3 style={{ margin: 0, fontSize: '1.4rem', color: '#fff' }}>Add New Event</h3>
              <X size={24} style={{ cursor: 'pointer', color: '#94a3b8' }} onClick={() => setIsModalOpen(false)} />
            </div>

            <div className="form-group" style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '5px', fontWeight: 'bold' }}>Event Title</label>
              <input type="text" className="sleek-input" style={{ width: '100%' }} value={newEvent.title} onChange={e => setNewEvent({...newEvent, title: e.target.value})} placeholder="e.g. Wipro Placement Drive" />
            </div>

            <div className="event-form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '15px', marginBottom: '15px' }}>
              <div className="form-group">
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '5px', fontWeight: 'bold' }}>Date *</label>
                <DateInput className="sleek-input" style={{ width: '100%' }} value={newEvent.date} onChange={e => setNewEvent({...newEvent, date: e.target.value})} />
              </div>
              <div className="form-group">
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '5px', fontWeight: 'bold' }}>Time</label>
                <input type="time" step="1" className="sleek-input" style={{ width: '100%' }} value={newEvent.time} onChange={e => setNewEvent({...newEvent, time: e.target.value})} />
              </div>
            </div>

            <div className="event-form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '15px', marginBottom: '15px' }}>
              <div className="form-group">
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '5px', fontWeight: 'bold' }}>Event Type *</label>
                <select className="sleek-input" style={{ width: '100%' }} value={newEvent.type} onChange={e => {
                  const type = e.target.value;
                  setNewEvent(current => ({
                    ...current,
                    type,
                    course: type === 'Placement Drive' ? current.course : '',
                    branch: type === 'Talentino' && /^all(?:\s+branches)?$/i.test(String(current.branch || '').trim())
                      ? defaultTalentinoBranch || current.branch
                      : current.branch
                  }));
                }}>
                  <option value="Placement Drive">Placement Drive</option>
                  <option value="Talentino">Talentino</option>
                </select>
              </div>
              <div className="form-group">
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '5px', fontWeight: 'bold' }}>Event Location</label>
                <input type="text" className="sleek-input" style={{ width: '100%' }} value={newEvent.location} onChange={e => setNewEvent({...newEvent, location: e.target.value})} placeholder="e.g. Bangalore Branch, Online" />
              </div>
            </div>

            {newEvent.type === 'Placement Drive' && (
              <div className="form-group" style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '5px', fontWeight: 'bold' }}>Eligible Course *</label>
                <select className="sleek-input" style={{ width: '100%' }} value={newEvent.course} onChange={e => setNewEvent({ ...newEvent, course: e.target.value })} required>
                  <option value="">Select a course</option>
                  {MAIN_PLACEMENT_COURSES.map(course => <option key={course} value={course}>{course}</option>)}
                </select>
              </div>
            )}

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
              <div className="form-group" style={{ marginBottom: '25px', background: 'rgba(56, 189, 248, 0.05)', padding: '15px', borderRadius: '12px', border: '1px dashed var(--accent-primary)' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--accent-primary)', marginBottom: '8px', fontWeight: 'bold' }}>Upload Drive Poster (Optional)</label>
                <input type="file" accept="image/*" className="sleek-input" style={{ width: '100%', padding: '8px' }} onChange={e => setPosterFile(e.target.files[0])} />
              </div>
            )}

            {eventActionNotice?.type === 'error' && <div role="alert" style={{ marginBottom: '16px', padding: '12px 14px', borderRadius: '10px', border: '1px solid rgba(248,113,113,.35)', background: 'rgba(127,29,29,.2)', color: '#fecaca' }}>{eventActionNotice.message}</div>}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid #1e293b', paddingTop: '1.5rem' }}>
              <button className="btn-secondary" style={{ background: 'transparent', border: '1px solid #334155', color: '#f8fafc', padding: '10px 20px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold' }} onClick={() => setIsModalOpen(false)}>Cancel</button>
              <button className="btn-action" style={{ background: 'var(--accent-primary)', color: '#0f172a', padding: '10px 20px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', border: 'none' }} onClick={handleSaveEvent} disabled={isSaving}>
                {isSaving ? <CircleNotch size={18} className="ph-spin" /> : "Save Event"}
              </button>
            </div>

          </div>
        </div>
      ), document.body)}

      {/* 🚨 SAFE EVENT DETAILS MODAL */}
      {viewEventModal && createPortal((
        <div className="event-modal-backdrop" onClick={(e) => { if(e.target === e.currentTarget) setViewEventModal(null); }}>
          <div className="event-modal-dialog" style={{ maxWidth: '680px' }}>
            
            <div style={{ borderBottom: '1px solid #1e293b', paddingBottom: '15px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span style={{ background: 'rgba(255,255,255,0.05)', color: getEventColor(viewEventModal.type), padding: '6px 12px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 'bold', display: 'inline-block', marginBottom: '10px' }}>
                  {String(viewEventModal.type || 'Event')}
                </span>
                <h2 style={{ margin: '0 0 5px 0', fontSize: '1.6rem', color: '#fff' }}>{String(viewEventModal.title || 'Untitled Event')}</h2>
                {viewEventModal.eventId && <div style={{ color: 'var(--accent-primary)', fontSize: '0.85rem', fontWeight: 'bold' }}>Event ID: {String(viewEventModal.eventId)}</div>}
                <span className={`event-status-pill ${String(viewEventModal.status || 'Scheduled').toLowerCase() === 'cancelled' ? 'cancelled' : String(viewEventModal.status || 'Scheduled').toLowerCase() === 'rescheduled' ? 'rescheduled' : 'scheduled'}`}>{String(viewEventModal.status || 'Scheduled')}</span>
              </div>
              <button style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#94a3b8', padding: '8px', borderRadius: '50%', cursor: 'pointer', display: 'flex', transition: '0.2s' }} onClick={() => setViewEventModal(null)} title="Close">
                <X size={20} weight="bold"/>
              </button>
            </div>

            <div className="event-detail-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '15px', marginBottom: '20px' }}>
              <div style={{ background: '#1e293b', padding: '15px', borderRadius: '12px' }}>
                <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 'bold', marginBottom: '5px' }}>Date & Time</div>
                <div style={{ color: '#fff', fontSize: '0.95rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Clock size={16} color="var(--accent-primary)" /> {formatPortalDate(viewEventModal.date, 'TBD')} • {formatPortalTime(viewEventModal.time, 'TBD')}
                </div>
              </div>
              <div style={{ background: '#1e293b', padding: '15px', borderRadius: '12px' }}>
                <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 'bold', marginBottom: '5px' }}>Location & Branch</div>
                <div style={{ color: '#fff', fontSize: '0.95rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <MapPin size={16} color="#f59e0b" /> {String(viewEventModal.location || 'Online')}
                </div>
                <div style={{ color: '#cbd5e1', fontSize: '0.85rem', marginTop: '4px' }}>Branch: {String(viewEventModal.branch || 'Global')}</div>
              </div>
              {viewEventModal.course && <div style={{ background: '#1e293b', padding: '15px', borderRadius: '12px' }}>
                <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 'bold', marginBottom: '5px' }}>Eligible Course</div>
                <div style={{ color: '#fff', fontSize: '0.95rem', fontWeight: 600 }}>{String(viewEventModal.course)}</div>
              </div>}
            </div>

            {viewEventModal.description && (
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '20px' }}>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 'bold', marginBottom: '8px' }}>Description</div>
                <div style={{ color: '#e2e8f0', fontSize: '0.95rem', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                  {String(viewEventModal.description)}
                </div>
              </div>
            )}

            {viewEventModal.poster && viewEventModal.poster !== 'N/A' && (
              <div style={{ marginTop: '20px' }}>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 'bold', marginBottom: '10px' }}>Event Poster Attached</div>
                <button className="btn-secondary hover-lift" style={{ background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.3)', color: 'var(--accent-primary)', width: '100%', padding: '15px', borderRadius: '12px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', fontWeight: 'bold', fontSize: '1rem', transition: '0.2s' }} onClick={() => window.open(viewEventModal.poster, '_blank')}>
                  <Image size={22} weight="fill" /> View Full Event Poster
                </button>
              </div>
            )}

            {viewEventModal.statusReason && <div style={{ marginTop: '16px', padding: '12px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(148,163,184,.15)', borderRadius: '10px', color: '#cbd5e1', fontSize: '.9rem' }}><strong style={{ color: '#94a3b8' }}>Latest update:</strong> {String(viewEventModal.statusReason)}</div>}

            {eventActionNotice && <div role={eventActionNotice.type === 'error' ? 'alert' : 'status'} style={{ marginTop: '16px', padding: '12px 14px', borderRadius: '10px', border: `1px solid ${eventActionNotice.type === 'error' ? 'rgba(248,113,113,.35)' : eventActionNotice.type === 'warning' ? 'rgba(251,191,36,.35)' : 'rgba(52,211,153,.35)'}`, background: eventActionNotice.type === 'error' ? 'rgba(127,29,29,.2)' : eventActionNotice.type === 'warning' ? 'rgba(120,53,15,.2)' : 'rgba(6,78,59,.22)', color: eventActionNotice.type === 'error' ? '#fecaca' : eventActionNotice.type === 'warning' ? '#fde68a' : '#a7f3d0' }}>{eventActionNotice.message}</div>}

            {canManageEvents && String(viewEventModal.status || '').toLowerCase() !== 'cancelled' && <div className="event-action-row">
              <button type="button" onClick={() => startEventAction('reschedule')} disabled={isUpdatingEvent} className="event-reschedule-button"><CalendarBlank size={18} /> Reschedule Event</button>
              <button type="button" onClick={() => startEventAction('cancel')} disabled={isUpdatingEvent} className="event-cancel-button"><X size={18} /> Cancel Event</button>
            </div>}

          </div>
        </div>
      ), document.body)}

      {eventActionForm && viewEventModal && createPortal((
        <div className="event-modal-backdrop event-action-layer" onClick={event => { if (event.target === event.currentTarget && !isUpdatingEvent) setEventActionForm(null); }}>
          <div className="event-modal-dialog event-action-dialog" role="dialog" aria-modal="true" aria-labelledby="event-action-title">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'flex-start', marginBottom: '18px' }}>
              <div>
                <span className={`event-status-pill ${eventActionForm.action === 'cancel' ? 'cancelled' : 'rescheduled'}`}>{eventActionForm.action === 'cancel' ? 'Cancellation notice' : 'Schedule update'}</span>
                <h2 id="event-action-title" style={{ color: '#fff', margin: '8px 0 0', fontSize: '1.35rem' }}>{eventActionForm.action === 'cancel' ? 'Cancel this event?' : 'Reschedule this event'}</h2>
                <div style={{ color: '#94a3b8', marginTop: '5px' }}>{String(viewEventModal.title || 'Untitled Event')}</div>
              </div>
              <button type="button" aria-label="Close" onClick={() => !isUpdatingEvent && setEventActionForm(null)} style={{ border: 0, background: 'transparent', color: '#94a3b8', cursor: 'pointer' }}><X size={22} /></button>
            </div>

            {eventActionForm.action === 'reschedule' && <div className="event-form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '14px', marginBottom: '14px' }}>
              <label style={{ color: '#cbd5e1', fontSize: '.82rem', fontWeight: 700 }}>New date *<DateInput className="sleek-input" value={eventActionForm.newDate} onChange={event => setEventActionForm(previous => ({ ...previous, newDate: event.target.value }))} required /></label>
              <label style={{ color: '#cbd5e1', fontSize: '.82rem', fontWeight: 700 }}>New time<input type="time" step="1" className="sleek-input" value={eventActionForm.time} onChange={event => setEventActionForm(previous => ({ ...previous, time: event.target.value }))} /></label>
            </div>}

            <label style={{ display: 'block', color: '#cbd5e1', fontSize: '.82rem', fontWeight: 700, marginBottom: '8px' }}>{eventActionForm.action === 'cancel' ? 'Reason for cancellation (optional)' : 'Message for recipients (optional)'}</label>
            <textarea className="sleek-input" rows={3} maxLength={1000} value={eventActionForm.reason} onChange={event => setEventActionForm(previous => ({ ...previous, reason: event.target.value }))} placeholder={eventActionForm.action === 'cancel' ? 'Add a short explanation for the cancellation…' : 'Add any instructions or context for the revised schedule…'} />
            <div className="event-audience-note">The notice will be sent to the recipients assigned to this event type and branch.</div>
            {eventActionNotice && <div role={eventActionNotice.type === 'error' ? 'alert' : 'status'} style={{ marginTop: '12px', padding: '11px 12px', borderRadius: '9px', border: `1px solid ${eventActionNotice.type === 'error' ? 'rgba(248,113,113,.35)' : eventActionNotice.type === 'warning' ? 'rgba(251,191,36,.35)' : 'rgba(52,211,153,.35)'}`, background: eventActionNotice.type === 'error' ? 'rgba(127,29,29,.2)' : eventActionNotice.type === 'warning' ? 'rgba(120,53,15,.2)' : 'rgba(6,78,59,.22)', color: eventActionNotice.type === 'error' ? '#fecaca' : eventActionNotice.type === 'warning' ? '#fde68a' : '#a7f3d0', fontSize: '.88rem' }}>{eventActionNotice.message}</div>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #253247' }}>
              <button type="button" className="event-action-secondary" disabled={isUpdatingEvent} onClick={() => setEventActionForm(null)}>Back</button>
              <button type="button" className={eventActionForm.action === 'cancel' ? 'event-action-confirm-cancel' : 'event-action-confirm-reschedule'} disabled={isUpdatingEvent} onClick={submitEventAction}>{isUpdatingEvent ? <CircleNotch size={18} className="ph-spin" /> : eventActionForm.action === 'cancel' ? 'Cancel Event & Notify' : 'Save New Schedule & Notify'}</button>
            </div>
          </div>
        </div>
      ), document.body)}

      {/* 🎨 NEO CALENDAR STYLES */}
      <style>{`
        .event-modal-backdrop { position: fixed; inset: 0; z-index: 99999; display: flex; justify-content: center; align-items: center; overflow-y: auto; overscroll-behavior: contain; box-sizing: border-box; padding: 16px; background: rgba(0,0,0,0.82); backdrop-filter: blur(6px); }
        .event-modal-dialog { width: 100%; max-height: calc(100dvh - 32px); min-height: 0; overflow-y: auto; overscroll-behavior: contain; box-sizing: border-box; margin: auto 0; position: relative; background: #0f172a; border: 1px solid #334155; border-radius: 24px; padding: clamp(18px, 3vw, 32px); box-shadow: 0 25px 50px rgba(0,0,0,0.55); scrollbar-width: thin; scrollbar-color: #475569 transparent; }
        .event-modal-dialog::-webkit-scrollbar { width: 8px; }
        .event-modal-dialog::-webkit-scrollbar-track { background: transparent; }
        .event-modal-dialog::-webkit-scrollbar-thumb { background: #475569; border-radius: 8px; }
        .event-modal-dialog input, .event-modal-dialog select, .event-modal-dialog textarea { width: 100%; max-width: 100%; box-sizing: border-box; }
        .event-action-layer { z-index: 100001; background: rgba(2,6,23,.72); }
        .event-status-pill { display: inline-flex; align-items: center; width: fit-content; margin-top: 7px; padding: 5px 9px; border-radius: 999px; font-size: .68rem; line-height: 1.2; font-weight: 800; letter-spacing: .04em; text-transform: uppercase; }
        .event-status-pill.scheduled { color: #a7f3d0; background: rgba(16,185,129,.14); border: 1px solid rgba(16,185,129,.28); }
        .event-status-pill.cancelled { color: #fecaca; background: rgba(239,68,68,.14); border: 1px solid rgba(239,68,68,.28); }
        .event-status-pill.rescheduled { color: #fde68a; background: rgba(245,158,11,.14); border: 1px solid rgba(245,158,11,.28); }
        .event-action-row { display: flex; justify-content: flex-end; flex-wrap: wrap; gap: 10px; margin-top: 22px; padding-top: 18px; border-top: 1px solid #253247; }
        .event-reschedule-button, .event-cancel-button, .event-action-secondary, .event-action-confirm-cancel, .event-action-confirm-reschedule { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 42px; padding: 10px 15px; border-radius: 10px; font-weight: 700; cursor: pointer; }
        .event-reschedule-button { background: rgba(245,158,11,.12); border: 1px solid rgba(245,158,11,.32); color: #fde68a; }
        .event-cancel-button, .event-action-confirm-cancel { background: rgba(239,68,68,.14); border: 1px solid rgba(239,68,68,.38); color: #fecaca; }
        .event-action-secondary { background: transparent; border: 1px solid #475569; color: #cbd5e1; }
        .event-action-confirm-reschedule { background: #7c3aed; border: 1px solid #8b5cf6; color: #fff; }
        .event-reschedule-button:disabled, .event-cancel-button:disabled, .event-action-secondary:disabled, .event-action-confirm-cancel:disabled, .event-action-confirm-reschedule:disabled { opacity: .6; cursor: wait; }
        .event-action-dialog { max-width: 560px; }
        .event-action-dialog input { display: block; margin-top: 7px; }
        .event-action-dialog textarea { min-height: 84px; resize: vertical; }
        .event-audience-note { color: #94a3b8; font-size: .8rem; margin-top: 9px; }
        @media (max-width: 600px) {
          .event-modal-backdrop { padding: 10px; }
          .event-modal-dialog { max-height: calc(100dvh - 20px); border-radius: 18px; }
          .event-form-grid, .event-detail-grid { grid-template-columns: minmax(0, 1fr) !important; }
          .event-modal-dialog h2 { font-size: 1.3rem !important; overflow-wrap: anywhere; }
        }
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
          color: var(--accent-primary);
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
          color: var(--accent-primary);
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

        /* Premium calendar surface and controls */
        .neo-layout {
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 22px;
          margin-top: 18px;
          padding: clamp(16px, 2.5vw, 30px);
          background: radial-gradient(ellipse at 14% 0%, rgba(56, 189, 248, .08), transparent 38%), #0b1121;
          border-color: rgba(148, 163, 184, .16);
          box-shadow: 0 24px 70px rgba(0, 0, 0, .22), inset 0 1px rgba(255, 255, 255, .035);
        }
        .neo-toolbar {
          gap: 16px;
          margin-bottom: 24px;
          padding-bottom: 20px;
          border-bottom: 1px solid rgba(148, 163, 184, .13);
        }
        .neo-month-controls, .neo-toolbar-actions, .neo-nav-arrows { display: flex; align-items: center; }
        .neo-month-controls { gap: 8px; min-width: 0; }
        .neo-select-wrap {
          position: relative;
          display: inline-flex;
          align-items: center;
          min-width: 145px;
          color: #f8fafc;
          background: rgba(15, 23, 42, .78);
          border: 1px solid rgba(148, 163, 184, .2);
          border-radius: 12px;
          transition: border-color .18s ease, box-shadow .18s ease, background .18s ease;
        }
        .neo-select-wrap:hover, .neo-select-wrap:focus-within {
          border-color: rgba(56, 189, 248, .6);
          background: rgba(15, 23, 42, .98);
          box-shadow: 0 0 0 3px rgba(56, 189, 248, .1);
        }
        .neo-select-wrap select {
          appearance: none;
          width: 100%;
          min-width: 0;
          padding: 11px 38px 11px 14px;
          color: inherit;
          font: inherit;
          font-size: 1.08rem;
          font-weight: 650;
          background: transparent;
          border: 0;
          outline: 0;
          cursor: pointer;
        }
        .neo-select-wrap select option { color: #e2e8f0; background: #0f172a; }
        .neo-select-wrap > svg { position: absolute; right: 13px; color: #7c8da8; pointer-events: none; }
        .neo-year-select { min-width: 106px; }
        .neo-year-select select { font-weight: 550; }
        .neo-toolbar-actions { gap: 10px; }
        .neo-month-summary {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          margin-right: 4px;
          padding: 8px 12px;
          border: 1px solid rgba(148, 163, 184, .14);
          border-radius: 999px;
          color: #aab8cc;
          background: rgba(15, 23, 42, .55);
          font-size: .78rem;
          font-weight: 600;
          white-space: nowrap;
        }
        .neo-month-summary > span { width: 7px; height: 7px; border-radius: 50%; background: #38bdf8; box-shadow: 0 0 12px rgba(56, 189, 248, .7); }
        .neo-today-button {
          padding: 9px 14px;
          color: #d8f5ff;
          font-size: .82rem;
          font-weight: 650;
          background: rgba(14, 116, 144, .16);
          border: 1px solid rgba(56, 189, 248, .28);
          border-radius: 11px;
          cursor: pointer;
          transition: .18s ease;
        }
        .neo-today-button:hover { color: #fff; background: rgba(14, 116, 144, .3); border-color: rgba(56, 189, 248, .65); }
        .neo-nav-arrows { gap: 7px; }
        .neo-nav-arrows button { width: 38px; height: 38px; border-radius: 12px; background: rgba(30, 41, 59, .78); }
        .neo-nav-arrows button:hover { transform: translateY(-1px); box-shadow: 0 6px 18px rgba(0, 0, 0, .2); }
        .neo-days-header { gap: 10px; margin-bottom: 9px; }
        .neo-days-header div {
          padding: 0 10px 5px;
          color: #7d8da5;
          font-size: .72rem;
          font-weight: 700;
          letter-spacing: .09em;
          text-transform: uppercase;
        }
        .neo-grid { gap: 10px; }
        .neo-cell {
          min-height: 124px;
          padding: 11px;
          gap: 6px;
          background: linear-gradient(155deg, rgba(30, 41, 59, .92), rgba(20, 31, 49, .92));
          border: 1px solid rgba(148, 163, 184, .1);
          border-radius: 15px;
          box-shadow: inset 0 1px rgba(255, 255, 255, .018);
        }
        .neo-cell.empty { min-height: 124px; background: rgba(15, 23, 42, .18); border-color: transparent; box-shadow: none; }
        .neo-cell:not(.empty):hover { background: linear-gradient(155deg, rgba(40, 54, 77, .98), rgba(25, 39, 61, .98)); border-color: rgba(148, 163, 184, .25); }
        .neo-cell.is-today { border-color: rgba(56, 189, 248, .3); }
        .neo-cell.selected { background: linear-gradient(145deg, rgba(14, 116, 144, .3), rgba(30, 41, 59, .98)); border-color: rgba(56, 189, 248, .72); box-shadow: 0 12px 28px rgba(2, 132, 199, .16), inset 0 1px rgba(255, 255, 255, .06); transform: none; }
        .neo-date-num {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          margin: 0 0 2px;
          padding: 0;
          color: #dbe7f5;
          font: inherit;
          font-size: .93rem;
          font-weight: 650;
          line-height: 1;
          background: transparent;
          border: 0;
          cursor: pointer;
          text-align: left;
        }
        .neo-date-num > span:first-child { display: inline-grid; width: 28px; height: 28px; place-items: center; border-radius: 9px; }
        .neo-date-num:hover > span:first-child { color: #fff; background: rgba(148, 163, 184, .14); }
        .neo-date-num.today > span:first-child { color: #08121f; background: #67e8f9; box-shadow: 0 4px 13px rgba(34, 211, 238, .22); }
        .neo-cell.selected .neo-date-num { color: #fff; }
        .neo-cell.selected .neo-date-num.today > span:first-child { color: #08121f; }
        .neo-date-count { display: inline-grid; min-width: 20px; height: 20px; padding: 0 5px; place-items: center; color: #b9eaff; background: rgba(14, 116, 144, .28); border: 1px solid rgba(56, 189, 248, .18); border-radius: 999px; font-size: .68rem; }
        .neo-events { gap: 5px; }
        .neo-event-indicator {
          padding: 4px 6px;
          color: #cbd5e1;
          background: rgba(8, 15, 28, .4);
          border: 1px solid rgba(148, 163, 184, .09);
          border-radius: 7px;
          text-align: left;
          transition: background .16s ease, border-color .16s ease, transform .16s ease;
        }
        .neo-event-indicator:hover { background: rgba(8, 15, 28, .75); border-color: rgba(148, 163, 184, .22); transform: translateY(-1px); }
        .neo-event-bar { height: 14px; width: 3px; }
        .neo-event-title { font-size: .69rem; font-weight: 550; }
        .neo-event-more { padding-left: 5px; color: #93a4ba; font-size: .67rem; font-weight: 650; }
        .neo-sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
        @media (max-width: 1150px) {
          .neo-layout { grid-template-columns: minmax(0, 1fr); }
          .neo-agenda-section { width: 100%; }
        }
        @media (max-width: 700px) {
          .neo-toolbar { align-items: flex-start; flex-direction: column; gap: 14px; }
          .neo-toolbar-actions { width: 100%; justify-content: space-between; }
          .neo-month-summary { margin-right: auto; }
          .neo-days-header, .neo-grid { gap: 5px; }
          .neo-days-header div { padding: 0 2px 5px; text-align: center; font-size: .62rem; letter-spacing: .04em; }
          .neo-cell, .neo-cell.empty { min-height: 82px; padding: 6px 5px; border-radius: 10px; }
          .neo-date-num { font-size: .8rem; }
          .neo-date-num > span:first-child { width: 24px; height: 24px; border-radius: 7px; }
          .neo-date-count { min-width: 17px; height: 17px; padding: 0 3px; font-size: .6rem; }
          .neo-events { align-items: center; gap: 3px; }
          .neo-event-indicator { width: auto; padding: 3px; border: 0; background: transparent; }
          .neo-event-indicator:hover { background: rgba(8, 15, 28, .5); }
          .neo-event-title, .neo-event-more { display: none; }
          .neo-event-bar { height: 7px; width: 7px; border-radius: 50%; }
          .neo-select-wrap { min-width: 130px; }
          .neo-year-select { min-width: 94px; }
        }
      `}</style>
    </Layout>
  );
}
