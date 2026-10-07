import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Buildings, CheckCircle, CircleNotch, EnvelopeSimple, GraduationCap, MagnifyingGlass, PaperPlaneTilt, WarningCircle } from '@phosphor-icons/react';
import Layout from '../../layouts/Layout';
import { API_BASE } from '../../services/apiConfig';
import './CorporateTrainingInquiries.css';

const readUser = () => {
  try { return JSON.parse(localStorage.getItem('tpoData') || '{}'); }
  catch { return {}; }
};
const isAdminAccount = account => {
  const role = String(account?.role || '').toUpperCase();
  return String(account?.accessType || '').toLowerCase() === 'superadmin' ||
    ['SYSTEM ADMIN', 'GENERAL MANAGER', 'ZONAL PLACEMENT HEAD', 'TECHNICAL HEAD'].includes(role);
};
const notificationLabel = status => {
  if (String(status || '').toLowerCase() === 'sent') return 'Branch notified';
  if (String(status || '').toLowerCase().startsWith('failed')) return 'Email failed';
  if (String(status || '').toLowerCase() === 'sending') return 'Sending email';
  return 'Not assigned';
};

export default function CorporateTrainingInquiries() {
  const user = useMemo(readUser, []);
  const [inquiries, setInquiries] = useState([]);
  const [branches, setBranches] = useState([]);
  const [branchSelections, setBranchSelections] = useState({});
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [assigningId, setAssigningId] = useState('');
  const [pageError, setPageError] = useState('');
  const [notice, setNotice] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setPageError('');
    try {
      const [inquiryResponse, branchResponse] = await Promise.all([
        axios.get(`${API_BASE}/api/admin/corporate-training-inquiries`),
        axios.get(`${API_BASE}/api/admin/branches`)
      ]);
      setInquiries(inquiryResponse.data.inquiries || []);
      setBranches((branchResponse.data.branches || []).filter(item => item.branch));
    } catch (error) {
      setPageError(error.response?.data?.message || 'Corporate training inquiries could not be loaded. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdminAccount(user)) fetchData();
  }, [fetchData, user]);

  const filtered = inquiries.filter(inquiry => {
    const query = search.trim().toLowerCase();
    if (!query) return true;
    return [inquiry.name, inquiry.company, inquiry.email, inquiry.phone, inquiry.location, inquiry.trainingArea, inquiry.assignedBranch]
      .some(value => String(value || '').toLowerCase().includes(query));
  });
  const assignedCount = inquiries.filter(item => item.assignedBranch).length;
  const notifiedCount = inquiries.filter(item => String(item.notificationStatus || '').toLowerCase() === 'sent').length;

  const assignToBranch = async inquiry => {
    const branch = branchSelections[inquiry.inquiryId] || inquiry.assignedBranch || '';
    if (!branch) { setNotice('Choose a branch before assigning this inquiry.'); return; }
    setAssigningId(inquiry.inquiryId);
    setPageError('');
    setNotice('');
    try {
      const response = await axios.post(`${API_BASE}/api/admin/corporate-training-inquiries/assign`, { inquiryId: inquiry.inquiryId, branch });
      if (response.data.inquiry) {
        setInquiries(current => current.map(item => item.inquiryId === inquiry.inquiryId ? response.data.inquiry : item));
      }
      setNotice(response.data.warning || response.data.message || 'Inquiry assigned.');
    } catch (error) {
      setPageError(error.response?.data?.message || 'The inquiry could not be assigned.');
    } finally {
      setAssigningId('');
    }
  };

  if (!isAdminAccount(user)) {
    return <Layout><div className="cti-denied"><WarningCircle size={42} /><h2>Administrator access required</h2><p>Corporate training inquiries are available to portal administrators.</p></div></Layout>;
  }

  return (
    <Layout>
      <main className="cti-page">
        <header className="cti-hero">
          <div className="cti-hero-icon"><GraduationCap size={25} weight="duotone" /></div>
          <div><span className="cti-eyebrow">ADMIN WORKSPACE · CORPORATE TRAINING</span><h1>Training inquiries</h1><p>Review public requests, route them to a branch, and track the branch notification.</p></div>
          <button className="cti-refresh" type="button" onClick={fetchData} disabled={loading}>{loading ? <CircleNotch className="ph-spin" size={17} /> : 'Refresh'}</button>
        </header>

        <section className="cti-stats" aria-label="Inquiry totals">
          <article><span>Total inquiries</span><strong>{inquiries.length}</strong><small>Saved in the corporate training register</small></article>
          <article><span>Assigned</span><strong>{assignedCount}</strong><small>Routed to a branch</small></article>
          <article><span>Branch notified</span><strong>{notifiedCount}</strong><small>Assignment emails sent</small></article>
        </section>

        <div className="cti-toolbar">
          <label className="cti-search"><MagnifyingGlass size={18} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search company, contact, location, or training area" /></label>
          <span>{filtered.length} {filtered.length === 1 ? 'inquiry' : 'inquiries'}</span>
        </div>
        {pageError && <div className="cti-message cti-error" role="alert"><WarningCircle size={18} />{pageError}</div>}
        {notice && <div className="cti-message cti-notice" role="status"><CheckCircle size={18} />{notice}</div>}

        {loading ? <div className="cti-empty"><CircleNotch className="ph-spin" size={28} />Loading inquiries…</div> : filtered.length === 0 ? (
          <div className="cti-empty"><Buildings size={28} />{search ? 'No inquiries match your search.' : 'New corporate training form submissions will appear here.'}</div>
        ) : <section className="cti-list" aria-label="Corporate training inquiries">
          {filtered.map(inquiry => {
            const selectedBranch = branchSelections[inquiry.inquiryId] ?? inquiry.assignedBranch ?? '';
            const selectedBranchInfo = branches.find(item => item.branch === selectedBranch);
            const isSending = assigningId === inquiry.inquiryId;
            const emailFailed = String(inquiry.notificationStatus || '').toLowerCase().startsWith('failed');
            return <article className="cti-card" key={inquiry.inquiryId}>
              <div className="cti-card-top">
                <div><span className="cti-card-kicker">{inquiry.submittedAt || 'Submission date unavailable'} · {inquiry.inquiryId}</span><h2>{inquiry.company}</h2><p>{inquiry.trainingArea || 'Corporate training'}{inquiry.location ? ` · ${inquiry.location}` : ''}</p></div>
                <span className={`cti-status ${inquiry.assignedBranch ? (emailFailed ? 'failed' : 'assigned') : 'new'}`}>{notificationLabel(inquiry.notificationStatus)}</span>
              </div>
              <div className="cti-detail-grid">
                <div><small>Contact person</small><strong>{inquiry.name}</strong></div>
                <div><small>Work email</small><a href={`mailto:${inquiry.email}`}><EnvelopeSimple size={14} />{inquiry.email}</a></div>
                <div><small>Phone / WhatsApp</small><strong>{inquiry.phone || 'Not provided'}</strong></div>
                <div><small>Team size</small><strong>{inquiry.teamSize || 'Not provided'}</strong></div>
              </div>
              <div className="cti-notes"><small>Training goals or notes</small><p>{inquiry.message || 'No additional notes were provided.'}</p></div>
              <div className="cti-assignment">
                <div className="cti-assignment-copy"><strong>{inquiry.assignedBranch ? `Assigned to ${inquiry.assignedBranch}` : 'Assign a branch'}</strong><span>{inquiry.assignedBranchEmail || (selectedBranchInfo?.email ? `To: ${selectedBranchInfo.email}` : 'Branch manager/TPO email will be used if configured.')}</span></div>
                <select aria-label={`Assign ${inquiry.company} to branch`} value={selectedBranch} onChange={event => setBranchSelections(current => ({ ...current, [inquiry.inquiryId]: event.target.value }))}>
                  <option value="">Choose branch</option>{branches.map(branch => <option key={branch.branch} value={branch.branch}>{branch.branch}{branch.region ? ` · ${branch.region}` : ''}</option>)}
                </select>
                <button type="button" onClick={() => assignToBranch(inquiry)} disabled={isSending || !selectedBranch}>
                  {isSending ? <><CircleNotch className="ph-spin" size={16} /> Sending…</> : <><PaperPlaneTilt size={16} />{emailFailed ? 'Retry / assign' : inquiry.assignedBranch ? 'Update assignment' : 'Assign & email'}</>}
                </button>
              </div>
              {inquiry.assignedAt && <footer className="cti-assigned-meta">Assigned {inquiry.assignedAt}{inquiry.assignedBy ? ` by ${inquiry.assignedBy}` : ''}{inquiry.notificationSentAt ? ` · Email sent ${inquiry.notificationSentAt}` : ''}</footer>}
            </article>;
          })}
        </section>}
      </main>
    </Layout>
  );
}
