import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { ArrowsClockwise, CheckCircle, CircleNotch, Clock, ShieldCheck, XCircle } from '@phosphor-icons/react';
import Layout from '../../layouts/Layout';
import { API_BASE } from '../../services/apiConfig';
import { formatPortalDateTime } from '../../utils/dateFormat';
import { PortalConfirmDialog, PortalToast } from '../../components/PortalFeedback';

const filters = ['Pending', 'Approved', 'Rejected', 'All'];
const statusColors = {
  Pending: ['#fbbf24', 'rgba(245,158,11,.12)'],
  Processing: ['#60a5fa', 'rgba(59,130,246,.14)'],
  Approved: ['#34d399', 'rgba(16,185,129,.13)'],
  Rejected: ['#f87171', 'rgba(239,68,68,.12)'],
};

const displayValue = value => String(value ?? '').trim() || '—';

export default function StudentEditApprovals() {
  const [requests, setRequests] = useState([]);
  const [filter, setFilter] = useState('Pending');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [workingId, setWorkingId] = useState('');
  const [reviewDialog, setReviewDialog] = useState(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [toast, setToast] = useState(null);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const response = await axios.get(`${API_BASE}/api/admin/student-edit-requests`, { timeout: 30000 });
      if (!response.data?.success) throw new Error(response.data?.message || 'Could not load student detail requests.');
      setRequests(Array.isArray(response.data.requests) ? response.data.requests : []);
    } catch (error) {
      const message = error.response?.status === 404
        ? 'The connected TPO server does not have the student-approval API yet. Deploy the latest TPO backend and make sure this portal points to that server.'
        : error.response?.data?.message || error.message || 'Could not load student detail requests.';
      setLoadError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadRequests(); }, [loadRequests]);

  const pendingCount = useMemo(() => requests.filter(request => ['pending', 'processing'].includes(String(request.status || '').toLowerCase())).length, [requests]);
  const visibleRequests = useMemo(() => filter === 'All'
    ? requests
    : requests.filter(request => filter === 'Pending'
      ? ['pending', 'processing'].includes(String(request.status || '').toLowerCase())
      : String(request.status || '').toLowerCase() === filter.toLowerCase()), [filter, requests]);

  const review = async () => {
    if (!reviewDialog) return;
    const { request, decision } = reviewDialog;
    const isApprove = decision === 'approve';
    if (!isApprove && !reviewNotes.trim()) {
      setToast({ type: 'error', title: 'Reason required', message: 'Add a short reason before rejecting this request.' });
      return;
    }
    setWorkingId(request.requestId);
    try {
      const response = await axios.post(`${API_BASE}/api/admin/student-edit-requests/${encodeURIComponent(request.requestId)}/review`, {
        decision,
        notes: reviewNotes.trim()
      }, { timeout: 60000 });
      if (!response.data?.success) throw new Error(response.data?.message || 'The request could not be reviewed.');
      setReviewDialog(null);
      setReviewNotes('');
      setToast({ type: 'success', title: isApprove ? 'Student details approved' : 'Request rejected', message: isApprove ? `${request.studentName || 'The student'}’s approved details have been updated in the student register.` : `${request.studentName || 'The student'}’s details were not changed.` });
      await loadRequests();
    } catch (error) {
      setToast({ type: 'error', title: 'Review failed', message: error.response?.data?.message || error.message || 'The request could not be reviewed.' });
      await loadRequests();
    } finally {
      setWorkingId('');
    }
  };

  return (
    <Layout>
      <main style={{ maxWidth: 1260, margin: '0 auto', padding: '8px 0 36px', color: 'var(--text-main, #e7edf8)' }}>
        <section style={{ border: '1px solid rgba(56,189,248,.25)', borderRadius: 22, padding: '28px 32px', marginBottom: 22, background: 'radial-gradient(circle at 88% 10%, rgba(139,92,246,.22), transparent 34%), linear-gradient(120deg, rgba(15,118,110,.2), rgba(15,23,42,.96) 54%, rgba(30,41,59,.8))', boxShadow: '0 18px 50px rgba(0,0,0,.2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
            <div>
              <div style={{ color: '#5eead4', fontSize: 12, fontWeight: 800, letterSpacing: 1.8, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 8 }}><ShieldCheck size={18} /> Student directory · Gifty’s review desk</div>
              <h1 style={{ margin: '10px 0 6px', fontSize: 'clamp(28px, 4vw, 42px)', letterSpacing: '-1.5px', color: '#f8fafc' }}>Student detail approvals</h1>
              <p style={{ margin: 0, color: '#aab8cc', fontSize: 15 }}>Review TPO proposed changes before they update the student record.</p>
            </div>
            <div style={{ minWidth: 132, padding: '15px 18px', border: '1px solid rgba(148,163,184,.22)', borderRadius: 16, background: 'rgba(7,13,25,.55)' }}>
              <div style={{ color: '#94a3b8', fontSize: 10, fontWeight: 800, letterSpacing: 1.2, textTransform: 'uppercase' }}>Awaiting review</div>
              <div style={{ color: '#fbbf24', fontSize: 34, fontWeight: 800, lineHeight: 1.1 }}>{pendingCount}</div>
            </div>
          </div>
        </section>

        <section style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {filters.map(item => (
              <button key={item} type="button" onClick={() => setFilter(item)} style={{ border: `1px solid ${filter === item ? 'rgba(45,212,191,.5)' : 'var(--card-border, #263449)'}`, background: filter === item ? 'rgba(13,148,136,.16)' : 'var(--card-bg, #101827)', color: filter === item ? '#5eead4' : '#aab8cc', borderRadius: 999, padding: '9px 14px', fontWeight: 700, cursor: 'pointer' }}>{item}{item === 'Pending' ? ` · ${pendingCount}` : ''}</button>
            ))}
          </div>
          <button type="button" onClick={() => void loadRequests()} disabled={loading} style={{ display: 'inline-flex', gap: 8, alignItems: 'center', border: '1px solid var(--card-border, #263449)', color: '#cbd5e1', background: 'var(--card-bg, #101827)', borderRadius: 10, padding: '10px 14px', cursor: 'pointer' }}><ArrowsClockwise size={17} /> Refresh</button>
        </section>

        {loadError && <div role="alert" style={{ marginBottom: 14, border: '1px solid rgba(248,113,113,.4)', background: 'rgba(127,29,29,.2)', color: '#fecaca', padding: 14, borderRadius: 12 }}>{loadError}</div>}
        {loading ? (
          <div style={{ minHeight: 220, display: 'grid', placeItems: 'center', border: '1px solid var(--card-border, #263449)', borderRadius: 18, background: 'var(--card-bg, #101827)', color: '#94a3b8' }}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}><CircleNotch size={21} className="ph-spin" /> Loading student detail requests…</span></div>
        ) : visibleRequests.length === 0 ? (
          <div style={{ minHeight: 230, display: 'grid', placeContent: 'center', textAlign: 'center', border: '1px dashed rgba(148,163,184,.3)', borderRadius: 18, background: 'rgba(15,23,42,.55)', padding: 24 }}>
            <CheckCircle size={30} color="#5eead4" style={{ justifySelf: 'center' }} />
            <h2 style={{ margin: '12px 0 5px', color: '#f1f5f9', fontSize: 20 }}>No {filter.toLowerCase()} requests</h2>
            <p style={{ margin: 0, color: '#94a3b8' }}>TPO student detail changes will appear here before they are applied.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 13 }}>
            {visibleRequests.map(request => {
              const status = String(request.status || 'Pending');
              const color = statusColors[status] || statusColors.Pending;
              const isPending = ['pending', 'processing'].includes(status.toLowerCase());
              const changedFields = Object.entries(request.proposedData || {});
              return (
                <article key={request.requestId} style={{ border: '1px solid var(--card-border, #263449)', borderLeft: `4px solid ${color[0]}`, borderRadius: 16, padding: '18px 20px', background: 'linear-gradient(110deg, rgba(20,30,48,.98), rgba(12,19,32,.98))', boxShadow: '0 12px 30px rgba(0,0,0,.12)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    <div style={{ minWidth: 260, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
                        <span style={{ color: '#f8fafc', fontSize: 18, fontWeight: 800 }}>{request.studentName || 'Student record'}</span>
                        <span style={{ color: color[0], background: color[1], border: `1px solid ${color[0]}44`, padding: '4px 9px', borderRadius: 999, fontSize: 11, fontWeight: 800, textTransform: 'uppercase' }}>{status}</span>
                      </div>
                      <div style={{ color: '#93c5fd', fontSize: 12, fontWeight: 700, marginTop: 8 }}>{request.studentRollNumber || 'No roll number'} · {request.studentBranch || 'Branch not recorded'} · {request.changeSummary}</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px 18px', marginTop: 10, color: '#94a3b8', fontSize: 13 }}>
                        <span>Requested by <strong style={{ color: '#dbeafe' }}>{request.requestedByName || request.requestedByEmail}</strong></span>
                        <span><Clock size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />{formatPortalDateTime(request.requestedAt, 'Time unavailable')}</span>
                        <span>Request {request.requestId}</span>
                      </div>
                    </div>
                    {isPending && <div style={{ display: 'flex', gap: 8 }}>
                      <button type="button" disabled={Boolean(workingId)} onClick={() => { setReviewNotes(''); setReviewDialog({ request, decision: 'reject' }); }} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, border: '1px solid rgba(248,113,113,.4)', color: '#fca5a5', background: 'rgba(127,29,29,.18)', borderRadius: 10, padding: '10px 13px', cursor: 'pointer', fontWeight: 800 }}><XCircle size={17} /> Reject</button>
                      <button type="button" disabled={Boolean(workingId)} onClick={() => { setReviewNotes(''); setReviewDialog({ request, decision: 'approve' }); }} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, border: '1px solid rgba(45,212,191,.45)', color: '#99f6e4', background: 'rgba(13,148,136,.22)', borderRadius: 10, padding: '10px 13px', cursor: 'pointer', fontWeight: 800 }}>{workingId === request.requestId ? <CircleNotch size={17} className="ph-spin" /> : <CheckCircle size={17} />} Approve &amp; apply</button>
                    </div>}
                  </div>
                  {changedFields.length > 0 && <div style={{ marginTop: 15, overflowX: 'auto', border: '1px solid rgba(148,163,184,.14)', borderRadius: 11 }}>
                    <table style={{ width: '100%', minWidth: 540, borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead><tr style={{ background: 'rgba(7,13,25,.65)', color: '#94a3b8', textAlign: 'left' }}><th style={{ padding: 10 }}>Field</th><th style={{ padding: 10 }}>Current value</th><th style={{ padding: 10 }}>Proposed value</th></tr></thead>
                      <tbody>{changedFields.map(([field, proposed]) => <tr key={field} style={{ borderTop: '1px solid rgba(148,163,184,.1)' }}>
                        <td style={{ padding: 10, color: '#cbd5e1', fontWeight: 700 }}>{field}</td>
                        <td style={{ padding: 10, color: '#fca5a5', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{displayValue(request.originalData?.[field])}</td>
                        <td style={{ padding: 10, color: '#a7f3d0', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{displayValue(proposed)}</td>
                      </tr>)}</tbody>
                    </table>
                  </div>}
                  {request.executionMessage && <div style={{ marginTop: 12, color: status.toLowerCase() === 'pending' ? '#fcd34d' : '#94a3b8', fontSize: 12, lineHeight: 1.5 }}>{request.executionMessage}</div>}
                  {request.decisionNotes && !isPending && <div style={{ marginTop: 7, color: '#94a3b8', fontSize: 12 }}>Review note: {request.decisionNotes}</div>}
                </article>
              );
            })}
          </div>
        )}
      </main>
      <PortalConfirmDialog
        open={Boolean(reviewDialog)}
        title={reviewDialog?.decision === 'approve' ? 'Approve student detail changes?' : 'Reject student detail request?'}
        message={reviewDialog?.decision === 'approve'
          ? `${reviewDialog?.request?.changeSummary || 'These student details'} will be written to the student register.`
          : `${reviewDialog?.request?.studentName || 'This student'}’s record will stay unchanged.`}
        confirmLabel={reviewDialog?.decision === 'approve' ? 'Approve & apply' : 'Reject request'}
        tone={reviewDialog?.decision === 'approve' ? 'info' : 'danger'}
        busy={Boolean(workingId)}
        onCancel={() => { setReviewDialog(null); setReviewNotes(''); }}
        onConfirm={review}
      >
        {reviewDialog?.decision === 'reject' && <label style={{ display: 'grid', gap: 7, color: '#cbd5e1', fontSize: 13, fontWeight: 700 }}>Reason for rejection<textarea value={reviewNotes} onChange={event => setReviewNotes(event.target.value)} rows={3} maxLength={1000} placeholder="Explain why the request was rejected" style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', padding: 11, borderRadius: 9, border: '1px solid #334155', background: '#0b1320', color: '#f8fafc' }} /></label>}
      </PortalConfirmDialog>
      <PortalToast toast={toast} onDismiss={() => setToast(null)} />
    </Layout>
  );
}
