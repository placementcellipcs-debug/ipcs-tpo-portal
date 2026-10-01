import React, { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { 
  Users, Briefcase, CircleNotch, BookOpen, 
  MapPinLine, Clock, Prohibit, EnvelopeSimple, Phone, GraduationCap, Money, X, Eye, Plus, WarningCircle, Buildings
} from '@phosphor-icons/react';
import Layout from '../../layouts/Layout';
import { API_BASE } from '../../services/apiConfig';
import StatusBadge from '../../components/StatusBadge';

// 🚨 ERROR BOUNDARY: Intercepts fatal crashes and prevents the "Black Screen of Death"
class VacanciesErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorInfo: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, errorInfo: error.message };
  }
  componentDidCatch(error, errorInfo) {
    console.error("Vacancies Render Crash:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <Layout>
          <div style={{ padding: '40px', maxWidth: '800px', margin: '40px auto', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', borderRadius: '16px', color: '#f8fafc', textAlign: 'center' }}>
            <WarningCircle size={64} color="#ef4444" weight="fill" style={{ marginBottom: '20px' }} />
            <h2 style={{ color: '#ef4444', margin: '0 0 15px 0' }}>Data Formatting Crash Prevented</h2>
            <p style={{ fontSize: '1.1rem', color: '#cbd5e1', lineHeight: '1.6' }}>
              The portal intercepted a fatal crash caused by corrupted or improperly formatted data inside the Google Sheets database (likely an invalid date, number, or missing column in the Vacancies sheet).
            </p>
            <div style={{ marginTop: '20px', padding: '15px', background: '#0f1523', borderRadius: '8px', color: '#ef4444', fontFamily: 'monospace', fontSize: '0.9rem', textAlign: 'left', overflowX: 'auto' }}>
              {this.state.errorInfo}
            </div>
            <button onClick={() => window.location.reload()} style={{ marginTop: '25px', background: '#3b82f6', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
              Reload Page
            </button>
          </div>
        </Layout>
      );
    }
    return this.props.children; 
  }
}

const DetailBox = ({ label, value, icon }) => (
  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
    <div style={{ background: 'rgba(56, 189, 248, 0.1)', color: 'var(--accent-primary)', padding: '8px', borderRadius: '8px' }}>
      {icon}
    </div>
    <div>
      <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px', fontWeight: 'bold', letterSpacing: '0.5px' }}>{label}</div>
      <div style={{ fontWeight: '600', color: '#fff', fontSize: '0.95rem' }}>{String(value || 'Not Specified')}</div>
    </div>
  </div>
);

const getStandardCourse = (c) => {
  if (!c) return 'Others';
  const lower = String(c).toLowerCase().trim();
  if (lower.includes('bms') || lower.includes('cctv')) return 'BMS AND CCTV';
  if (lower.includes('auto') || lower.includes('plc') || lower.includes('scada')) return 'Industrial Automation';
  if (lower.includes('embed') || lower.includes('iot')) return 'Embedded and IoT';
  if (lower.includes('digital') || lower.includes('dm') || lower.includes('marketing')) return 'Digital Marketing';
  if (lower.includes('information technology') || /(^|[^a-z])it([^a-z]|$)/.test(lower) || lower.includes('python') || lower.includes('software') || lower.includes('data science') || lower.includes('data analytics') || lower.includes('artificial intelligence') || lower.includes('cyber security') || lower.includes('web development') || lower.includes('java') || lower.includes('php')) return 'Information technology (IT)';
  return 'Others';
};

const parseDateSafe = (dateStr) => {
  if (!dateStr) return null; 
  try {
    let cleanStr = String(dateStr).split(' ')[0].replace(/st|nd|rd|th/gi, '').trim();
    let d = new Date(cleanStr);
    if (isNaN(d.getTime()) && (cleanStr.includes('/') || cleanStr.includes('-'))) {
      const parts = cleanStr.split(/[/-]/);
      if (parts.length >= 3) {
        d = new Date(`${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`);
      }
    }
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
};

const companyLogoSource = value => {
  const logo = String(value || '').trim();
  if (!logo) return '';
  const driveId = logo.match(/(?:file\/d\/|id=|\/d\/)([\w-]{25,})/);
  return driveId ? `https://lh3.googleusercontent.com/d/${driveId[1]}` : logo;
};

const getTodayInIndia = () => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return { iso: `${values.year}-${values.month}-${values.day}`, display: `${values.day}/${values.month}/${values.year}` };
};

const isVacancyAddedToday = (timestamp, todayIso) => {
  const value = String(timestamp || '').trim();
  if (!value) return false;

  const isoDate = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoDate) return `${isoDate[1]}-${isoDate[2].padStart(2, '0')}-${isoDate[3].padStart(2, '0')}` === todayIso;

  // Older Google Form rows use the spreadsheet's displayed M/D/YYYY timestamp format.
  const slashDate = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (slashDate) {
    const [, first, second, year] = slashDate;
    const month = Number(first) > 12 ? second : first;
    const day = Number(first) > 12 ? first : second;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}` === todayIso;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return false;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(parsed);
  const date = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${date.year}-${date.month}-${date.day}` === todayIso;
};

function VacancyCreateModal({ onClose, onCreated, currentOfficer }) {
  const today = getTodayInIndia();
  const [placementOfficers, setPlacementOfficers] = useState([]);
  const [loadingOfficers, setLoadingOfficers] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [companyLogo, setCompanyLogo] = useState(null);
  const [form, setForm] = useState({
    date: today.display,
    companyName: '', companyContact: '', companyMailId: '', companyContactPerson: '', companyWebsite: '',
    course: '', position: '', state: '', location: '', workMode: '', openings: '', qualification: '',
    jobDescription: '', experience: '', experienceOther: '', salary: '', genderPreference: '',
    interviewPlan: '', interviewDate: '', lastDate: '', placementOfficer: ''
  });

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    axios.get(`${API_BASE}/api/tpo/vacancies/form-options`)
      .then(response => {
        const officers = Array.isArray(response.data?.placementOfficers) ? response.data.placementOfficers : [];
        setPlacementOfficers(officers);
        setForm(previous => ({
          ...previous,
          placementOfficer: officers.find(name => name.toLowerCase() === String(currentOfficer || '').trim().toLowerCase()) || officers[0] || ''
        }));
      })
      .catch(requestError => setErrorMessage(requestError.response?.data?.message || 'Could not load placement officers from the Contact sheet.'))
      .finally(() => setLoadingOfficers(false));
    return () => { document.body.style.overflow = previousOverflow; };
  }, [currentOfficer]);

  const updateField = (field, value) => setForm(previous => ({ ...previous, [field]: value }));
  const inputStyle = { width: '100%', minWidth: 0, boxSizing: 'border-box', background: '#080d18', border: '1px solid #334155', borderRadius: '10px', padding: '11px 13px', color: '#f8fafc' };
  const labelStyle = { display: 'block', color: '#cbd5e1', fontSize: '0.78rem', fontWeight: 700, marginBottom: '7px' };
  const field = (label, name, control, required = true) => (
    <label key={name} style={{ display: 'block', minWidth: 0 }}>
      <span style={labelStyle}>{label}{required ? ' *' : ''}</span>
      {control}
    </label>
  );
  const textInput = (name, type = 'text', extra = {}) => (
    <input
      className="premium-input"
      style={inputStyle}
      type={type}
      value={form[name]}
      onChange={event => updateField(name, event.target.value)}
      required
      {...extra}
    />
  );
  const selectInput = (name, placeholder, options, extra = {}) => (
    <select className="premium-select" style={inputStyle} value={form[name]} onChange={event => updateField(name, event.target.value)} required {...extra}>
      <option value="">{placeholder}</option>
      {options.map(option => <option key={option} value={option}>{option}</option>)}
    </select>
  );
  const handleSubmit = async event => {
    event.preventDefault();
    setErrorMessage('');
    if (!companyLogo) return setErrorMessage('Please upload the company logo.');
    if (companyLogo.size > 10 * 1024 * 1024) return setErrorMessage('The company logo must be 10 MB or smaller.');
    if (form.experience === 'Other' && !form.experienceOther.trim()) return setErrorMessage('Please specify the experience requirement.');
    if (form.interviewPlan === 'Interview Scheduled' && !form.interviewDate) return setErrorMessage('Please select the interview date.');

    setSaving(true);
    try {
      const payload = new FormData();
      Object.entries(form).forEach(([key, value]) => payload.append(key, value));
      payload.append('companyLogo', companyLogo);
      const response = await axios.post(`${API_BASE}/api/tpo/vacancies/add`, payload, { headers: { 'Content-Type': 'multipart/form-data' } });
      if (!response.data?.success) throw new Error(response.data?.message || 'The vacancy could not be saved.');
      onCreated(response.data.vacancy, response.data);
      onClose();
    } catch (requestError) {
      setErrorMessage(requestError.response?.data?.message || requestError.message || 'The vacancy could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const courses = ['Information Technology (IT)', 'BMS & CCTV', 'Embedded and IOT', 'Industrial Automation', 'Digital Marketing'];
  const states = ['Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'International'];

  return createPortal((
    <div className="modal-backdrop" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
      <form onSubmit={handleSubmit} className="premium-modal glass-panel vacancy-create-modal" style={{ maxWidth: '920px', maxHeight: 'calc(100dvh - 32px)', overflowY: 'auto', padding: 'clamp(18px, 3vw, 30px)', boxSizing: 'border-box' }}>
        <div className="modal-header" style={{ position: 'sticky', top: '-1px', zIndex: 1, background: '#111827', paddingTop: '2px' }}>
          <div>
            <h2>Add Vacancy</h2>
            <div className="modal-subtitle">Create a hiring opening in the NewsLetter sheet</div>
          </div>
          <button type="button" className="close-btn" onClick={onClose} aria-label="Close vacancy form"><X size={24} /></button>
        </div>

        <div className="vacancy-modal-grid">
          {field('Date', 'date', <input style={inputStyle} type="text" value={form.date} readOnly aria-readonly="true" />)}
          {field('Company Logo', 'companyLogo', <input style={inputStyle} type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={event => setCompanyLogo(event.target.files?.[0] || null)} required />)}
          {field('Company Name', 'companyName', textInput('companyName'))}
          {field('Company Contact', 'companyContact', textInput('companyContact', 'tel'))}
          {field('Company Mail ID', 'companyMailId', textInput('companyMailId', 'email'))}
          {field('Company Contact Person', 'companyContactPerson', textInput('companyContactPerson'))}
          {field('Company Website', 'companyWebsite', textInput('companyWebsite', 'url', { placeholder: 'https://www.example.com' }))}
          {field('Course', 'course', selectInput('course', 'Select course', courses))}
          {field('Position', 'position', textInput('position'))}
          {field('State', 'state', selectInput('state', 'Select state', states))}
          {field('Opening At (Location)', 'location', textInput('location'))}
          {field('No. of Openings', 'openings', selectInput('openings', 'Select number of openings', ['01', '01 - 02', '01 - 05', '05 +']))}
          {field('Qualification', 'qualification', textInput('qualification'))}
          {field('Salary', 'salary', textInput('salary'))}
          {field('Gender Preference', 'genderPreference', selectInput('genderPreference', 'Select preference', ['Preferred both Male & female candidates', 'Preferred Male candidates Only', 'Preferred female candidates Only', 'Not Mentioned']))}
          {field('Placement Officer', 'placementOfficer', selectInput('placementOfficer', loadingOfficers ? 'Loading officers…' : 'Select placement officer', placementOfficers, { disabled: loadingOfficers || placementOfficers.length === 0 }))}
        </div>

        <fieldset style={{ margin: '18px 0', padding: '14px', border: '1px solid #334155', borderRadius: '12px' }}>
          <legend style={{ color: '#cbd5e1', fontWeight: 700, padding: '0 7px' }}>Work Mode *</legend>
          <div className="vacancy-radio-row">
            {['Work at Office', 'Work from Home', 'Hybrid'].map(option => (
              <label key={option} style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#e2e8f0' }}>
                <input type="radio" name="workMode" value={option} checked={form.workMode === option} onChange={() => updateField('workMode', option)} required />{option}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset style={{ margin: '18px 0', padding: '14px', border: '1px solid #334155', borderRadius: '12px' }}>
          <legend style={{ color: '#cbd5e1', fontWeight: 700, padding: '0 7px' }}>Experience *</legend>
          <div className="vacancy-radio-row">
            {['Fresher', 'Experienced', 'Other'].map(option => (
              <label key={option} style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#e2e8f0' }}>
                <input type="radio" name="experience" value={option} checked={form.experience === option} onChange={() => updateField('experience', option)} required />{option}
              </label>
            ))}
          </div>
          {form.experience === 'Other' && <input className="premium-input" style={{ ...inputStyle, marginTop: '12px' }} value={form.experienceOther} onChange={event => updateField('experienceOther', event.target.value)} placeholder="Specify experience" required />}
        </fieldset>

        {field('Job Description', 'jobDescription', <textarea className="premium-input" style={{ ...inputStyle, minHeight: '130px', resize: 'vertical' }} value={form.jobDescription} onChange={event => updateField('jobDescription', event.target.value)} required />)}

        <div className="vacancy-modal-grid" style={{ marginTop: '16px' }}>
          {field('Interview Date', 'interviewPlan', selectInput('interviewPlan', 'Choose interview status', ['Will Inform Once Scheduled', 'Interview Scheduled']))}
          {form.interviewPlan === 'Interview Scheduled' && field('Scheduled Interview Date', 'interviewDate', textInput('interviewDate', 'date', { min: today.iso }))}
          {field('Last Date', 'lastDate', textInput('lastDate', 'date', { min: today.iso }))}
        </div>

        {errorMessage && <div role="alert" style={{ marginTop: '16px', padding: '12px 14px', color: '#fecaca', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)', borderRadius: '10px' }}>{errorMessage}</div>}
        {!placementOfficers.length && !loadingOfficers && <div style={{ marginTop: '12px', color: '#fbbf24' }}>No placement officers were found in the Contact sheet.</div>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid #334155', marginTop: '22px', paddingTop: '18px' }}>
          <button type="button" className="premium-btn secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="premium-btn primary" disabled={saving || loadingOfficers || !placementOfficers.length}>
            {saving ? <><CircleNotch size={18} className="ph-spin" /> Saving…</> : 'Submit Opening'}
          </button>
        </div>
      </form>
      <style>{`.vacancy-modal-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px 16px}.vacancy-radio-row{display:flex;flex-wrap:wrap;gap:18px}@media(max-width:680px){.vacancy-modal-grid{grid-template-columns:minmax(0,1fr)}.vacancy-radio-row{flex-direction:column;gap:10px}}`}</style>
    </div>
  ), document.body);
}

function VacanciesContent() {
  let tpoData = null;
  try {
    const rawData = localStorage.getItem('tpoData');
    if (rawData) tpoData = JSON.parse(rawData);
  } catch { /* Keep the vacancy list usable when saved account data is malformed. */ }
  
  const userRole = String(tpoData?.role || '').toUpperCase();
  const accessType = String(tpoData?.accessType || '').toLowerCase();
  
  const isSuperAdmin = accessType === 'superadmin' || ['SYSTEM ADMIN', 'GENERAL MANAGER', 'ZONAL PLACEMENT HEAD', 'TECHNICAL HEAD'].includes(userRole);
  const isTpo = userRole.includes('TPO');
  const isBranchManager = userRole === 'BM' || userRole.includes('BRANCH MANAGER');
  const isRth = /(^|[^A-Z0-9])RTH([^A-Z0-9]|$)/.test(userRole) || userRole.includes('REGIONAL TECHNICAL HEAD');
  const hideTpoFilter = isBranchManager || isRth;
  const canAddOpening = (isTpo || userRole.includes('PLACEMENT OFFICER')) && !isSuperAdmin;
  const isCourseSpecific = userRole.includes('TRAINER') || userRole.includes('RTH') || userRole.includes('REGIONAL TECHNICAL HEAD') || userRole.includes('TTH') || userRole.includes('TERRITORY TECHNICAL HEAD');
  
  const rawCourse = String(tpoData?.assignedCourse || 'All').toLowerCase();
  const assignedDomains = useMemo(() => {
    if (rawCourse === 'all' || rawCourse === 'all courses') return ['All'];
    const entries = String(rawCourse).split(/[\n,;]+/).map(entry => entry.trim()).filter(Boolean);
    const domains = new Set();
    entries.forEach(entry => {
      const c = getStandardCourse(entry);
      if (c !== 'Others') domains.add(c);
    });
    return domains.size ? [...domains] : ['Others'];
  }, [rawCourse]);

  const [vacancies, setVacancies] = useState([]);
  const [applications, setApplications] = useState([]); 
  const [loading, setLoading] = useState(true);
  
  const [activeTab, setActiveTab] = useState('Open'); 
  const [searchQuery, setSearchQuery] = useState('');
  const [courseFilter, setCourseFilter] = useState('All');
  const [tpoFilter, setTpoFilter] = useState('All');
  const [monthYearFilter, setMonthYearFilter] = useState('All');
  const todaySubmissionIso = getTodayInIndia().iso;

  const [selectedJob, setSelectedJob] = useState(null);
  const [isJobDetailsModalOpen, setIsJobDetailsModalOpen] = useState(false);
  const [isApplicantsModalOpen, setIsApplicantsModalOpen] = useState(false);
  const [isCreateVacancyOpen, setIsCreateVacancyOpen] = useState(false);
  const [openingNotice, setOpeningNotice] = useState('');

  useEffect(() => {
    const fetchAllData = async () => {
      const localTpoStr = localStorage.getItem('tpoData');
      if (!localTpoStr) {
        setLoading(false);
        return;
      }
      const localTpo = JSON.parse(localTpoStr);
      
      try {
        const [vacRes, appRes] = await Promise.all([
          axios.get(`${API_BASE}/api/tpo/vacancies`),
          axios.post(`${API_BASE}/api/tpo/applications`, { 
            assignedBranchesArray: localTpo.assignedBranchesArray,
            tpoName: localTpo.name,
            role: localTpo.role,
            assignedCourse: localTpo.assignedCourse
          })
        ]);
        
        if (vacRes.data.success) setVacancies(Array.isArray(vacRes.data.vacancies) ? vacRes.data.vacancies : []);
        if (appRes.data.success) setApplications(Array.isArray(appRes.data.applications) ? appRes.data.applications : []);
      } catch (error) { 
        console.error("Failed to fetch data", error); 
      } finally { 
        setLoading(false); 
      }
    };
    fetchAllData();
  }, []);

  const {
    groupedVacs, uniqueTPOs, uniqueMonths, 
    totalActiveOpenings, totalExpiredOpenings, 
    totalApplicationsCount, uniqueCompaniesCount, todayVacanciesCount,
    renderError, appsMap
  } = useMemo(() => {
    try {
      const safeVacancies = Array.isArray(vacancies) ? vacancies : [];
      const safeApplications = Array.isArray(applications) ? applications : [];

      const todayInner = new Date();
      todayInner.setHours(0,0,0,0);
      
      const appsByJobId = {};
      safeApplications.forEach(app => {
        if (!app) return;
        const jobId = String(app.jobId || '').trim();
        if (!appsByJobId[jobId]) appsByJobId[jobId] = [];
        appsByJobId[jobId].push(app);
      });

      const uniqueTPOsSet = new Set();
      const uniqueMonthsSet = new Set();
      let activeOpenings = 0; let expiredOpenings = 0; let totalApps = 0; let addedTodayCount = 0;
      const companiesSet = new Set();

      const fVacs = safeVacancies.filter(v => {
        if (!v) return false;
        
        const deadline = parseDateSafe(v.lastDate);
        const isExpired = (deadline && deadline < todayInner) || String(v.status || '').toLowerCase().includes('expire');
        const isClosed = String(v.status || '').toLowerCase().includes('close') || String(v.status || '').toLowerCase().includes('no');
        
        if (isExpired || isClosed) expiredOpenings++; else activeOpenings++;
        if (v.company && String(v.company).toLowerCase() !== 'unknown company') companiesSet.add(String(v.company));
        
        const safeJobId = String(v.id || '').trim();
        totalApps += (appsByJobId[safeJobId] || []).length;

        const rowTpo = String(v.tpoName || v.placementofficer || v.placementOfficer || 'Unknown');
        if (rowTpo !== 'Unknown') uniqueTPOsSet.add(rowTpo);

        const d = parseDateSafe(v.datePosted || v.timestamp || v.date);
        const addedToday = isVacancyAddedToday(v.timestamp, todaySubmissionIso);
        if (addedToday) addedTodayCount++;
        if (d && !isNaN(d.getTime()) && d.getFullYear() < 2050 && d.getFullYear() > 2000) {
          uniqueMonthsSet.add(d.toLocaleString('en-us', { month: 'long', year: 'numeric' }));
        }

        const safeSearch = String(searchQuery || '').toLowerCase();
        const matchQuery = String(v.id || '').toLowerCase().includes(safeSearch) || 
                           String(v.company || '').toLowerCase().includes(safeSearch) || 
                           String(v.position || '').toLowerCase().includes(safeSearch);
        
        const matchCourse = courseFilter === 'All' || getStandardCourse(v.course) === getStandardCourse(courseFilter);
        
        let matchTrainerScope = true;
        if (isCourseSpecific && assignedDomains[0] !== 'All') {
           matchTrainerScope = assignedDomains.includes(getStandardCourse(v.course));
        }

        const tabMatch = activeTab === 'Open'
          ? (!isExpired && !isClosed)
          : activeTab === 'Expired'
            ? (isExpired || isClosed)
            : addedToday;
        const tpoMatch = hideTpoFilter || tpoFilter === 'All' || rowTpo === tpoFilter;
        
        let monthMatch = true;
        if (monthYearFilter !== 'All') {
          if (d && !isNaN(d.getTime()) && d.getFullYear() < 2050) monthMatch = d.toLocaleString('en-us', { month: 'long', year: 'numeric' }) === monthYearFilter;
          else monthMatch = false;
        }

        return matchQuery && matchCourse && matchTrainerScope && tabMatch && tpoMatch && monthMatch;
      });

      const gVacs = {};
      fVacs.forEach(v => {
        let loc = 'OTHER STATES';
        try {
          if (v && v.state) loc = String(v.state).toUpperCase().trim();
          else if (v && v.location) loc = String(v.location).toUpperCase().trim();
        } catch { /* Group malformed location data under the default state. */ }
        
        if (!loc || loc === 'UNDEFINED' || loc === 'NULL') loc = 'OTHER STATES';
        if (!gVacs[loc]) gVacs[loc] = [];
        gVacs[loc].push(v);
      });

      const sortedTPOs = Array.from(uniqueTPOsSet).sort();
      const sortedMonths = Array.from(uniqueMonthsSet).sort((a, b) => (new Date(b).getTime() || 0) - (new Date(a).getTime() || 0));

      return {
        groupedVacs: gVacs, uniqueTPOs: sortedTPOs, uniqueMonths: sortedMonths,
        totalActiveOpenings: activeOpenings, totalExpiredOpenings: expiredOpenings,
        totalApplicationsCount: totalApps, uniqueCompaniesCount: companiesSet.size,
        todayVacanciesCount: addedTodayCount,
        renderError: null, appsMap: appsByJobId
      };

    } catch(err) {
      console.error("FATAL RENDER ERROR CAUGHT:", err);
      return {
        groupedVacs: {}, uniqueTPOs: [], uniqueMonths: [],
        totalActiveOpenings: 0, totalExpiredOpenings: 0,
        totalApplicationsCount: 0, uniqueCompaniesCount: 0, todayVacanciesCount: 0,
        renderError: err.message, appsMap: {}
      };
    }
  }, [vacancies, applications, searchQuery, courseFilter, tpoFilter, monthYearFilter, activeTab, isCourseSpecific, assignedDomains, hideTpoFilter, todaySubmissionIso]);

  // Define today for the renderer
  const today = new Date();
  today.setHours(0,0,0,0);

  return (
    <Layout>
      <div className="premium-dashboard-wrapper page-container" style={{ maxWidth: '1600px', margin: '0 auto', paddingBottom: '50px' }}>
        
        {renderError && (
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', padding: '15px', borderRadius: '12px', color: '#ef4444', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <WarningCircle size={24} weight="fill"/> 
            <div>
              <strong>Data Format Error:</strong> The system intercepted a corrupted cell in Google Sheets. 
              <span style={{ display: 'block', fontSize: '0.8rem', opacity: 0.8 }}>Technical Details: {renderError}</span>
            </div>
          </div>
        )}

        <div className="top-hero-section">
          <div className="hero-text">
            <h1>Active Job Ecosystem</h1>
            <p>Real-time applicant tracking and opening management</p>
          </div>
          {canAddOpening && (
            <button className="premium-btn primary hover-lift" onClick={() => { setOpeningNotice(''); setIsCreateVacancyOpen(true); }}>
              <Plus weight="bold" size={20} /> Add Opening
            </button>
          )}
        </div>
        {openingNotice && <div role="status" style={{ marginBottom: '18px', padding: '12px 16px', borderRadius: '10px', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', color: '#a7f3d0' }}>{openingNotice}</div>}

        {/* ADMIN MINI DASHBOARD */}
        {isSuperAdmin && (
          <div className="bento-grid mini-dash-wrapper">
            <div className="kpi-card glass-panel hover-lift">
              <div className="kpi-top">
                <div><div className="kpi-title">Total Active</div><div className="kpi-val">{totalActiveOpenings}</div></div>
                <div className="kpi-icon blue"><Briefcase weight="fill" size={26}/></div>
              </div>
            </div>
            <div className="kpi-card glass-panel hover-lift">
              <div className="kpi-top">
                <div><div className="kpi-title">Total Applicants</div><div className="kpi-val">{totalApplicationsCount}</div></div>
                <div className="kpi-icon green"><Users weight="fill" size={26}/></div>
              </div>
            </div>
            <div className="kpi-card glass-panel hover-lift">
              <div className="kpi-top">
                <div><div className="kpi-title">Hiring Companies</div><div className="kpi-val">{uniqueCompaniesCount}</div></div>
                <div className="kpi-icon purple"><Buildings weight="fill" size={26}/></div>
              </div>
            </div>
            <div className="kpi-card glass-panel hover-lift">
              <div className="kpi-top">
                <div><div className="kpi-title">Expired Openings</div><div className="kpi-val">{totalExpiredOpenings}</div></div>
                <div className="kpi-icon red"><Prohibit weight="fill" size={26}/></div>
              </div>
            </div>
          </div>
        )}

        <div className="glass-panel control-action-bar">
          <div className="segmented-tabs">
            <button className={`seg-tab ${activeTab === 'Open' ? 'active' : ''}`} onClick={() => setActiveTab('Open')}>Active Openings</button>
            <button className={`seg-tab ${activeTab === 'Expired' ? 'active-expired' : ''}`} onClick={() => setActiveTab('Expired')}>Expired / Closed</button>
            <button className={`seg-tab ${activeTab === 'Today' ? 'active' : ''}`} onClick={() => setActiveTab('Today')}>Added Today ({todayVacanciesCount})</button>
          </div>

          <div className="filter-group">
            <input type="text" className="premium-input" placeholder="Search ID, Role, Company..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            
            {(!isCourseSpecific || assignedDomains.length > 1) && (
              <select className="premium-select" value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)}>
                {isCourseSpecific ? (
                  <><option value="All">All My Courses</option>{assignedDomains.map(c => <option key={c} value={c}>{c}</option>)}</>
                ) : (
                  <>
                    <option value="All">All Main Courses</option>
                    <option value="Industrial Automation">Industrial Automation</option>
                    <option value="BMS AND CCTV">BMS AND CCTV</option>
                    <option value="Embedded and IoT">Embedded and IoT</option>
                    <option value="Digital Marketing">Digital Marketing</option>
                    <option value="Information technology (IT)">Information technology (IT)</option>
                  </>
                )}
              </select>
            )}

            {isSuperAdmin && (
              <>
                {!hideTpoFilter && <select className="premium-select border-purple" value={tpoFilter} onChange={(e) => setTpoFilter(e.target.value)}>
                  <option value="All">All TPOs</option>
                  {uniqueTPOs.map((tpo, i) => <option key={i} value={tpo}>{tpo}</option>)}
                </select>}
                <select className="premium-select border-green" value={monthYearFilter} onChange={(e) => setMonthYearFilter(e.target.value)}>
                  <option value="All">All Time</option>
                  {uniqueMonths.map((m, i) => <option key={i} value={m}>{m}</option>)}
                </select>
              </>
            )}
          </div>
        </div>

        {loading ? (
          <div className="empty-state-card"><CircleNotch size={40} className="ph-spin text-blue" /><p>Fetching vacancies...</p></div>
        ) : Object.keys(groupedVacs).length === 0 ? (
          <div className="empty-state-card">
            <span style={{ fontSize: '2.5rem', marginBottom: '10px', display: 'block' }}>🔍</span>
            No {String(activeTab || '').toLowerCase()} vacancies match your current filters.
          </div>
        ) : (
          Object.keys(groupedVacs).map((state, idx) => (
            <div key={idx} className="state-group-section">
              <div className="state-header">
                <span className="state-line"></span>
                <h2 className="state-title">{state}</h2>
                <span className="state-line"></span>
              </div>
              
              <div className="job-card-grid">
                {groupedVacs[state].map((v, i) => {
                  if (!v) return null;
                  
                  const deadline = parseDateSafe(v.lastDate);
                  const isExpired = (deadline && deadline < today) || String(v.status || '').toLowerCase().includes('expire');
                  const isClosed = String(v.status || '').toLowerCase().includes('close') || String(v.status || '').toLowerCase().includes('no');
                  
                  let statClass = 'green'; let statText = 'Open Now';
                  if(isClosed) { statClass = 'gray'; statText = 'Closed'; }
                  else if(isExpired) { statClass = 'red'; statText = 'Expired'; }

                  const safeJobId = String(v.id || '').trim();
                  const companyLogo = companyLogoSource(v.companyLogo || v.companylogo || v.logo);
                  const applicantCount = (appsMap[safeJobId] || []).length;
                  const rowTpo = String(v.tpoName || v.placementofficer || v.placementOfficer || 'Unknown');
                  const datePostedObj = parseDateSafe(v.datePosted || v.timestamp || v.date);
                  const datePostedStr = (datePostedObj && !isNaN(datePostedObj.getTime()) && datePostedObj.getFullYear() < 2050 && datePostedObj.getFullYear() > 2000) ? datePostedObj.toLocaleDateString('en-GB') : 'N/A';

                  return (
                    <div key={i} className="job-card glass-panel hover-lift">
                      <div className="jc-header">
                        <div className="jc-company-logo">
                          <span>{String(v.company || 'U').charAt(0).toUpperCase()}</span>
                          {companyLogo && <img src={companyLogo} alt={`${String(v.company || 'Company')} logo`} loading="lazy" onError={event => { event.currentTarget.remove(); }} />}
                        </div>
                        <div className="jc-company-info">
                          <h3 className="text-truncate">{String(v.position || 'N/A')}</h3>
                          <p className="text-truncate">{String(v.company || 'N/A')}</p>
                        </div>
                        <div className="jc-id">{safeJobId || 'N/A'}</div>
                      </div>

                      <div className="jc-body">
                        <div className="jc-detail"><MapPinLine size={16} /> <span>{String(v.location || 'N/A')} ({String(v.mode || 'N/A')})</span></div>
                        <div className="jc-detail"><GraduationCap size={16} /> <span>{String(v.course || 'N/A')}</span></div>
                        {(isSuperAdmin || activeTab === 'Today') && <div className="jc-detail text-purple"><Clock size={16} /> <span>{rowTpo} • {String(v.timestamp || datePostedStr).replace('T', ' ')}</span></div>}
                      </div>

                      <div className="jc-divider"></div>

                      <div className="jc-footer">
                        <div>
                          <div className={`status-pill ${statClass}`}>{statText}</div>
                          <div className="jc-deadline">Ends: <span style={{color: isExpired || isClosed ? '#ef4444' : '#fff'}}>{String(v.lastDate || 'N/A')}</span></div>
                        </div>
                        <div className="jc-applicants" onClick={() => { setSelectedJob(v); setIsApplicantsModalOpen(true); }}>
                          <Users size={16} weight={applicantCount > 0 ? "fill" : "regular"} color={applicantCount > 0 ? '#3b82f6' : '#94a3b8'}/>
                          <span style={{ color: applicantCount > 0 ? '#3b82f6' : '#94a3b8' }}>{applicantCount} Applied</span>
                        </div>
                      </div>

                      <div className="jc-hover-actions">
                        <button className="premium-btn secondary" onClick={() => { if(!isExpired) { setSelectedJob(v); setIsJobDetailsModalOpen(true); } }} disabled={isExpired}>
                          {isExpired ? <Prohibit size={18}/> : <Eye size={18} />} Details
                        </button>
                        <button className="premium-btn primary" onClick={() => { setSelectedJob(v); setIsApplicantsModalOpen(true); }}>
                          <Users size={18} /> View List
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {isCreateVacancyOpen && (
        <VacancyCreateModal
          currentOfficer={tpoData?.name}
          onClose={() => setIsCreateVacancyOpen(false)}
          onCreated={(vacancy, result) => {
            setVacancies(previous => [vacancy, ...previous]);
            setActiveTab('Today');
            const rowInfo = result?.rowNumber ? ` (row ${result.rowNumber})` : '';
            setOpeningNotice(`Vacancy saved to ${result?.sheet || 'NewsLetter'}${rowInfo}.`);
          }}
        />
      )}

      {/* JOB DETAILS MODAL */}
      {isJobDetailsModalOpen && selectedJob && (
        <div className="modal-backdrop" onClick={(e) => { if(e.target === e.currentTarget) setIsJobDetailsModalOpen(false); }}>
          <div className="premium-modal glass-panel">
            <div className="modal-header">
              <div>
                <h2>{String(selectedJob.position || 'N/A')}</h2>
                <div className="modal-subtitle">{String(selectedJob.company || 'N/A')}</div>
              </div>
              <button className="close-btn" onClick={() => setIsJobDetailsModalOpen(false)}><X size={24} /></button>
            </div>

            <div className="modal-grid">
              <DetailBox label="Job ID" value={selectedJob.id} icon={<Briefcase size={20} weight="fill"/>} />
              <DetailBox label="Location & Mode" value={`${selectedJob.location || ''} (${selectedJob.mode || ''})`} icon={<MapPinLine size={20} weight="fill"/>} />
              <DetailBox label="Eligible Course" value={selectedJob.course} icon={<GraduationCap size={20} weight="fill"/>} />
              <DetailBox label="Salary" value={selectedJob.salary} icon={<Money size={20} weight="fill"/>} />
              <DetailBox label="Experience" value={selectedJob.experience} icon={<Clock size={20} weight="fill"/>} />
              <DetailBox label="Qualification" value={selectedJob.qualification} icon={<BookOpen size={20} weight="fill"/>} />
              <DetailBox label="Gender Pref." value={selectedJob.gender} icon={<Users size={20} weight="fill"/>} />
            </div>

            {selectedJob.description && (
              <div className="modal-desc-box">
                <div className="desc-title">Job Description</div>
                <div className="desc-content">{String(selectedJob.description)}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* APPLICANTS MODAL */}
      {isApplicantsModalOpen && selectedJob && (
        <div className="modal-backdrop" onClick={(e) => { if(e.target === e.currentTarget) setIsApplicantsModalOpen(false); }}>
          <div className="premium-modal glass-panel" style={{ maxWidth: '900px', padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '85vh' }}>
            <div className="modal-header" style={{ padding: '25px', background: 'rgba(15, 23, 42, 0.95)', borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: 0 }}>
              <div>
                <h2>Applicants List</h2>
                <div className="modal-subtitle">{String(selectedJob.id || 'N/A')} | {String(selectedJob.company || 'N/A')}</div>
              </div>
              <button className="close-btn" onClick={() => setIsApplicantsModalOpen(false)}><X size={24} /></button>
            </div>

            <div style={{ overflowY: 'auto', padding: '20px' }}>
              <div className="clean-list">
                {appsMap[String(selectedJob.id || '').trim()] && appsMap[String(selectedJob.id || '').trim()].length > 0 ? (
                  appsMap[String(selectedJob.id || '').trim()].map((app, i) => {
                    if (!app) return null;
                    return (
                      <div key={i} className="clean-row hover-bg">
                        <div className="cl-left">
                          <div className="cl-avatar">{String(app.name || 'U').charAt(0).toUpperCase()}</div>
                          <div><div className="cl-title">{String(app.name || 'N/A')}</div><div className="cl-sub">{String(app.roll || 'N/A')} • {String(app.branch || 'N/A')}</div></div>
                        </div>
                        <div className="cl-middle">
                           <StatusBadge status={String(app.status || 'Applied')} />
                        </div>
                        <div className="cl-right" style={{ display: 'flex', gap: '10px' }}>
                          {app.phone && (
                            <a href={`tel:${app.phone}`} className="action-circle blue" title="Call">
                              <Phone size={18} weight="fill" />
                            </a>
                          )}
                          {app.email && (
                            <a href={`mailto:${app.email}`} className="action-circle red" title="Email">
                              <EnvelopeSimple size={18} weight="fill" />
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="empty-state-card" style={{ background: 'transparent', border: 'none' }}>
                    <Users size={48} style={{ opacity: 0.3, marginBottom: '15px' }} />
                    <span style={{ fontSize: '1.1rem' }}>No students have applied yet.</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .premium-dashboard-wrapper { font-family: 'Inter', sans-serif; color: #f8fafc; }
        .glass-panel { background: rgba(15, 23, 42, 0.7); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border: 1px solid rgba(255, 255, 255, 0.05); }
        .hover-lift { transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1); cursor: pointer; }
        .hover-lift:hover { transform: translateY(-4px); box-shadow: 0 20px 40px -10px rgba(0,0,0,0.7); border-color: rgba(255, 255, 255, 0.1); background: rgba(30, 41, 59, 0.8); }
        .top-hero-section { display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; flex-wrap: wrap; gap: 20px; }
        .hero-text h1 { font-size: 2.2rem; font-weight: 800; margin: 0 0 5px 0; color: #fff; }
        .hero-text p { color: #94a3b8; margin: 0; font-size: 1rem; }
        .premium-btn { border: none; padding: 10px 20px; border-radius: 12px; font-weight: bold; font-size: 0.9rem; display: flex; align-items: center; justify-content: center; gap: 8px; transition: 0.2s; }
        .premium-btn.primary { background: #3b82f6; color: #fff; }
        .premium-btn.secondary { background: rgba(255,255,255,0.05); color: #fff; border: 1px solid rgba(255,255,255,0.1); }
        .premium-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; box-shadow: none; }
        .mini-dash-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 25px; }
        .kpi-card { border-radius: 16px; padding: 20px; }
        .kpi-top { display: flex; justify-content: space-between; align-items: flex-start; }
        .kpi-title { font-size: 0.75rem; color: #94a3b8; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 5px; }
        .kpi-val { font-size: 2rem; font-weight: 900; color: #fff; line-height: 1; }
        .kpi-icon { width: 45px; height: 45px; border-radius: 12px; display: flex; align-items: center; justify-content: center; box-shadow: inset 0 2px 10px rgba(255,255,255,0.05); }
        .kpi-icon.blue { background: rgba(59, 130, 246, 0.15); color: #3b82f6; border: 1px solid rgba(59, 130, 246, 0.3); }
        .kpi-icon.green { background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); }
        .kpi-icon.purple { background: rgba(168, 85, 247, 0.15); color: #a855f7; border: 1px solid rgba(168, 85, 247, 0.3); }
        .kpi-icon.red { background: rgba(239, 68, 68, 0.15); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.3); }
        .control-action-bar { border-radius: 16px; padding: 15px; margin-bottom: 30px; display: flex; flex-direction: column; gap: 15px; }
        .segmented-tabs { display: flex; background: rgba(0,0,0,0.3); padding: 5px; border-radius: 12px; width: fit-content; border: 1px solid rgba(255,255,255,0.05); }
        .seg-tab { background: transparent; border: none; padding: 8px 24px; color: #94a3b8; font-weight: bold; font-size: 0.9rem; border-radius: 8px; cursor: pointer; transition: 0.3s; }
        .seg-tab.active { background: #3b82f6; color: #fff; box-shadow: 0 4px 10px rgba(59,130,246,0.3); }
        .seg-tab.active-expired { background: #ef4444; color: #fff; box-shadow: 0 4px 10px rgba(239,68,68,0.3); }
        .filter-group { display: flex; gap: 12px; flex-wrap: wrap; }
        .premium-input, .premium-select { background: rgba(0,0,0,0.2); color: #fff; border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 10px 15px; font-size: 0.85rem; outline: none; transition: 0.2s; }
        .premium-input { min-width: 250px; flex: 1; }
        .premium-input:focus, .premium-select:focus { border-color: #3b82f6; background: rgba(0,0,0,0.4); }
        .premium-select option { background: #0f1523; color: #fff; padding: 10px; font-weight: bold; }
        .border-purple { border-color: rgba(168, 85, 247, 0.3); } .border-purple:focus { border-color: #a855f7; }
        .border-green { border-color: rgba(16, 185, 129, 0.3); } .border-green:focus { border-color: #10b981; }
        .empty-state-card { background: rgba(15, 23, 42, 0.5); border: 1px dashed rgba(255,255,255,0.1); border-radius: 16px; padding: 50px 20px; text-align: center; color: #94a3b8; font-size: 1.1rem; font-weight: bold; }
        .text-blue { color: #3b82f6; }
        .state-group-section { margin-bottom: 40px; }
        .state-header { display: flex; align-items: center; gap: 15px; margin-bottom: 20px; opacity: 0.8; }
        .state-title { margin: 0; font-size: 1.2rem; font-weight: 900; letter-spacing: 2px; color: #cbd5e1; text-transform: uppercase; }
        .state-line { flex: 1; height: 1px; background: linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0) 100%); }
        .job-card-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 20px; }
        .job-card { border-radius: 20px; padding: 20px; display: flex; flex-direction: column; position: relative; overflow: hidden; }
        .jc-hover-actions { position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(4px); display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 12px; opacity: 0; transition: 0.3s ease; border-radius: 20px; }
        .job-card:hover .jc-hover-actions { opacity: 1; }
        .jc-header { display: flex; align-items: center; gap: 15px; margin-bottom: 15px; }
        .jc-company-logo { position: relative; width: 48px; height: 48px; overflow: hidden; border-radius: 12px; background: linear-gradient(135deg, #3b82f6, var(--accent-primary)); display: flex; align-items: center; justify-content: center; font-size: 1.4rem; font-weight: 900; color: #fff; flex-shrink: 0; box-shadow: 0 4px 10px rgba(59, 130, 246, 0.3); }
        .jc-company-logo img { position: absolute; inset: 0; width: 100%; height: 100%; padding: 4px; object-fit: contain; border-radius: inherit; background: #fff; }
        .jc-company-info { flex: 1; min-width: 0; }
        .jc-company-info h3 { margin: 0 0 2px 0; font-size: 1.05rem; font-weight: 800; color: #fff; }
        .jc-company-info p { margin: 0; font-size: 0.8rem; color: #94a3b8; font-weight: 500; }
        .jc-id { background: rgba(255,255,255,0.05); padding: 4px 8px; border-radius: 8px; font-size: 0.7rem; font-weight: bold; color: #cbd5e1; border: 1px solid rgba(255,255,255,0.1); }
        .text-truncate { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .jc-body { display: flex; flex-direction: column; gap: 8px; margin-bottom: 15px; }
        .jc-detail { display: flex; align-items: center; gap: 8px; font-size: 0.85rem; color: #cbd5e1; }
        .text-purple { color: #a855f7; font-weight: bold; }
        .jc-divider { height: 1px; background: rgba(255,255,255,0.05); margin-bottom: 15px; }
        .jc-footer { display: flex; justify-content: space-between; align-items: flex-end; }
        .status-pill { padding: 4px 10px; border-radius: 12px; font-size: 0.7rem; font-weight: 800; display: inline-block; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
        .status-pill.green { background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); }
        .status-pill.red { background: rgba(239, 68, 68, 0.15); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.3); }
        .status-pill.gray { background: rgba(148, 163, 184, 0.15); color: #94a3b8; border: 1px solid rgba(148, 163, 184, 0.3); }
        .status-pill.blue { background: rgba(59, 130, 246, 0.15); color: #3b82f6; border: 1px solid rgba(59, 130, 246, 0.3); }
        .status-pill.purple { background: rgba(168, 85, 247, 0.15); color: #a855f7; border: 1px solid rgba(168, 85, 247, 0.3); }
        .jc-deadline { font-size: 0.75rem; color: #64748b; font-weight: 500; }
        .jc-applicants { display: flex; align-items: center; gap: 6px; background: rgba(255,255,255,0.03); padding: 8px 12px; border-radius: 12px; font-size: 0.8rem; font-weight: bold; border: 1px solid rgba(255,255,255,0.05); }
        .modal-backdrop { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); backdrop-filter: blur(8px); z-index: 99999; display: flex; justify-content: center; align-items: center; padding: 20px; }
        .premium-modal { width: 100%; max-width: 800px; max-height: 90vh; overflow-y: auto; border-radius: 24px; padding: 30px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.8); }
        .modal-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 15px; margin-bottom: 20px; }
        .modal-header h2 { margin: 0 0 5px 0; font-size: 1.6rem; color: #fff; font-weight: 800; }
        .modal-subtitle { color: var(--accent-primary); font-weight: bold; font-size: 1.1rem; }
        .close-btn { background: none; border: none; color: #64748b; cursor: pointer; transition: 0.2s; display: flex; }
        .close-btn:hover { color: #ef4444; transform: scale(1.1); }
        .modal-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px; }
        @media (max-width: 600px) { .modal-grid { grid-template-columns: 1fr; } }
        .modal-desc-box { background: rgba(255,255,255,0.02); padding: 20px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.05); margin-bottom: 20px; }
        .desc-title { font-size: 0.8rem; color: #94a3b8; text-transform: uppercase; margin-bottom: 10px; font-weight: bold; letter-spacing: 0.5px; }
        .desc-content { color: #e2e8f0; font-size: 0.95rem; line-height: 1.6; white-space: pre-wrap; }
        .clean-list { display: flex; flex-direction: column; gap: 10px; }
        .clean-row { display: flex; justify-content: space-between; align-items: center; padding: 15px; background: rgba(0, 0, 0, 0.2); border-radius: 12px; border: 1px solid rgba(255,255,255,0.02); transition: 0.2s; }
        .hover-bg:hover { background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.1); }
        .cl-left { display: flex; align-items: center; gap: 15px; flex: 1; min-width: 0; }
        .cl-avatar { width: 42px; height: 42px; border-radius: 50%; background: linear-gradient(135deg, #3b82f6, var(--accent-primary)); color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 1.1rem; flex-shrink: 0; box-shadow: 0 4px 10px rgba(59, 130, 246, 0.3); }
        .cl-title { font-size: 1rem; font-weight: 700; color: #fff; margin-bottom: 3px; }
        .cl-sub { font-size: 0.8rem; color: #94a3b8; }
        .action-circle { width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; transition: 0.2s; }
        .action-circle.blue { background: rgba(59, 130, 246, 0.15); color: #3b82f6; } .action-circle.blue:hover { background: #3b82f6; color: #fff; }
        .action-circle.red { background: rgba(239, 68, 68, 0.15); color: #ef4444; } .action-circle.red:hover { background: #ef4444; color: #fff; }
      `}</style>
    </Layout>
  );
}

export default function Vacancies() {
  return (
    <VacanciesErrorBoundary>
      <VacanciesContent />
    </VacanciesErrorBoundary>
  );
}
