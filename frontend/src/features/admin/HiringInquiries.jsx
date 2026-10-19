import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Buildings, CheckCircle, CircleNotch, EnvelopeSimple, MagnifyingGlass, PaperPlaneTilt, WarningCircle } from '@phosphor-icons/react';
import Layout from '../../layouts/Layout';
import { API_BASE } from '../../services/apiConfig';
import './HiringInquiries.css';

const readUser = () => {
  try { return JSON.parse(localStorage.getItem('tpoData') || '{}'); }
  catch { return {}; }
};
const ownsHiringInbox = account => String(account?.email || '').trim().toLowerCase() === 'gifty@ipcsglobal.com';
const emailStatus = status => {
  const value = String(status || '').toLowerCase();
  if (value === 'sent') return 'TPO emailed';
  if (value === 'queued') return 'Email queued';
  if (value.startsWith('failed')) return 'Email failed';
  if (value === 'sending') return 'Sending email';
  return 'Not assigned';
};

export default function HiringInquiries() {
  const user = readUser();
  const [inquiries, setInquiries] = useState([]);
  const [tpos, setTpos] = useState([]);
  const [selections, setSelections] = useState({});
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [assigningId, setAssigningId] = useState('');
  const [pageError, setPageError] = useState('');
  const [notice, setNotice] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setPageError('');
    try {
      const [inquiryResponse, tpoResponse] = await Promise.all([
        axios.get(`${API_BASE}/api/placement/hiring-inquiries`),
        axios.get(`${API_BASE}/api/placement/hiring-inquiries/tpos`)
      ]);
      const nextInquiries = inquiryResponse.data.inquiries || [];
      setInquiries(nextInquiries);
      setTpos(tpoResponse.data.tpos || []);
      setSelections(current => Object.fromEntries(nextInquiries.map(item => [item.inquiryId, current[item.inquiryId] ?? item.assignedTpo ?? ''])));
    } catch (error) {
      setPageError(error.response?.data?.message || 'Hiring inquiries could not be loaded. Please refresh and try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (ownsHiringInbox(user)) fetchData(); }, [fetchData, user]);

  const filtered = inquiries.filter(item => {
    const query = search.trim().toLowerCase();
    if (!query) return true;
    return [item.company, item.contactPerson, item.email, item.phone, item.location, item.position, item.courseSkills, item.assignedTpo]
      .some(value => String(value || '').toLowerCase().includes(query));
  });
  const assignedCount = inquiries.filter(item => item.assignedTpo).length;
  const notifiedCount = inquiries.filter(item => ['sent', 'queued'].includes(String(item.notificationStatus || '').toLowerCase())).length;

  const assign = async inquiry => {
    const tpoName = selections[inquiry.inquiryId] || inquiry.assignedTpo || '';
    if (!tpoName) { setNotice('Choose a placement officer before assigning this request.'); return; }
    setAssigningId(inquiry.inquiryId);
    setPageError('');
    setNotice('');
    try {
      const response = await axios.post(`${API_BASE}/api/placement/hiring-inquiries/assign`, { inquiryId: inquiry.inquiryId, tpoName });
      if (response.data.inquiry) setInquiries(current => current.map(item => item.inquiryId === inquiry.inquiryId ? response.data.inquiry : item));
      setNotice(response.data.warning || response.data.message || 'Hiring request assigned.');
    } catch (error) {
      setPageError(error.response?.data?.message || 'The hiring request could not be assigned.');
    } finally {
      setAssigningId('');
    }
  };

  if (!ownsHiringInbox(user)) return <Layout><div className="hi-denied"><WarningCircle size={42} /><h2>Gifty’s access is required</h2><p>Company hiring requests are visible only to gifty@ipcsglobal.com.</p></div></Layout>;

  return <Layout>
    <main className="hi-page">
      <header className="hi-hero"><div className="hi-hero-icon"><Buildings size={25} weight="duotone" /></div><div><span className="hi-eyebrow">PLACEMENT WORKSPACE · COMPANY REQUESTS</span><h1>Hire from us inquiries</h1><p>Review company openings, assign a placement officer, and track the notification email.</p></div><button className="hi-refresh" type="button" onClick={fetchData} disabled={loading}>{loading ? <CircleNotch className="ph-spin" size={17} /> : 'Refresh'}</button></header>
      <section className="hi-stats" aria-label="Hiring request totals"><article><span>Total requests</span><strong>{inquiries.length}</strong><small>Saved in the placement register</small></article><article><span>Assigned</span><strong>{assignedCount}</strong><small>Routed to a placement officer</small></article><article><span>TPO email</span><strong>{notifiedCount}</strong><small>Sent or queued for delivery</small></article></section>
      <div className="hi-toolbar"><label className="hi-search"><MagnifyingGlass size={18} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search company, contact, role, or TPO" /></label><span>{filtered.length} {filtered.length === 1 ? 'request' : 'requests'}</span></div>
      {pageError && <div className="hi-message is-error" role="alert"><WarningCircle size={18} />{pageError}</div>}
      {notice && <div className="hi-message" role="status"><CheckCircle size={18} />{notice}</div>}
      {loading ? <div className="hi-empty"><CircleNotch className="ph-spin" size={28} />Loading company requests…</div> : filtered.length === 0 ? <div className="hi-empty"><Buildings size={28} />{search ? 'No requests match your search.' : 'New submissions from Hire from us will appear here.'}</div> : <section className="hi-list" aria-label="Company hiring requests">
        {filtered.map(inquiry => {
          const selectedTpo = selections[inquiry.inquiryId] ?? inquiry.assignedTpo ?? '';
          const sending = assigningId === inquiry.inquiryId;
          const failed = String(inquiry.notificationStatus || '').toLowerCase().startsWith('failed');
          return <article className="hi-card" key={inquiry.inquiryId}>
            <div className="hi-card-top"><div><span className="hi-card-kicker">{inquiry.submittedAt || 'Submission date unavailable'} · {inquiry.inquiryId}</span><h2>{inquiry.company}</h2><p>{inquiry.position}{inquiry.location ? ` · ${inquiry.location}` : ''}</p></div><span className={`hi-status ${inquiry.assignedTpo ? (failed ? 'failed' : 'assigned') : 'new'}`}>{emailStatus(inquiry.notificationStatus)}</span></div>
            <div className="hi-detail-grid">
              <div><small>Contact person</small><strong>{inquiry.contactPerson || 'Not provided'}</strong></div>
              <div><small>Work email</small><a href={`mailto:${inquiry.email}`}><EnvelopeSimple size={14} />{inquiry.email}</a></div>
              <div><small>Phone / WhatsApp</small><a href={`tel:${inquiry.phone}`}>{inquiry.phone || 'Not provided'}</a></div>
              <div><small>Course / skills</small><strong>{inquiry.courseSkills || 'Not provided'}</strong></div>
              <div><small>Openings</small><strong>{inquiry.openingCount || 'Not provided'}</strong></div>
              <div><small>Work mode</small><strong>{inquiry.workMode || 'Not provided'}</strong></div>
              <div><small>Qualification</small><strong>{inquiry.qualification || 'Not provided'}</strong></div>
              <div><small>Experience / salary</small><strong>{[inquiry.experience, inquiry.salary].filter(Boolean).join(' · ') || 'Not provided'}</strong></div>
              <div><small>Deadline</small><strong>{inquiry.lastDate || 'Not provided'}</strong></div>
              {/^https?:\/\//i.test(String(inquiry.website || '')) && <div><small>Company website</small><a href={inquiry.website} target="_blank" rel="noreferrer">{inquiry.website}</a></div>}
            </div>
            {(inquiry.jobDescription || inquiry.notes) && <div className="hi-notes">{inquiry.jobDescription && <div><small>Role details</small><p>{inquiry.jobDescription}</p></div>}{inquiry.notes && <div><small>Additional notes</small><p>{inquiry.notes}</p></div>}</div>}
            <div className="hi-assignment"><div className="hi-assignment-copy"><strong>{inquiry.assignedTpo ? `Assigned to ${inquiry.assignedTpo}` : 'Assign to a placement officer'}</strong><span>{inquiry.assignedTpoEmail || 'The selected TPO will receive the full company and opening details by email.'}</span></div><select aria-label={`Assign ${inquiry.company} to a placement officer`} value={selectedTpo} onChange={event => setSelections(current => ({ ...current, [inquiry.inquiryId]: event.target.value }))}><option value="">Choose TPO</option>{tpos.map(tpo => <option key={tpo.email} value={tpo.name}>{tpo.name}{tpo.branches ? ` · ${tpo.branches}` : ''}</option>)}</select><button type="button" onClick={() => assign(inquiry)} disabled={sending || !selectedTpo}>{sending ? <><CircleNotch className="ph-spin" size={16} /> Sending…</> : <><PaperPlaneTilt size={16} />{failed ? 'Retry / assign' : inquiry.assignedTpo ? 'Update assignment' : 'Assign & email'}</>}</button></div>
            {inquiry.assignedAt && <footer className="hi-assigned-meta">Assigned {inquiry.assignedAt}{inquiry.assignedBy ? ` by ${inquiry.assignedBy}` : ''}{inquiry.notificationSentAt ? ` · Email sent ${inquiry.notificationSentAt}` : ''}</footer>}
          </article>;
        })}
      </section>}
    </main>
  </Layout>;
}
