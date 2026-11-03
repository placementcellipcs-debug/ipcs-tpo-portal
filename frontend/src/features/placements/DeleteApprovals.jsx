import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { CheckCircle, CircleNotch, Clock, ShieldCheck, XCircle, ArrowsClockwise } from '@phosphor-icons/react';
import Layout from '../../layouts/Layout';
import { API_BASE } from '../../services/apiConfig';
import { formatPortalDateTime } from '../../utils/dateFormat';
import { PortalConfirmDialog, PortalToast } from '../../components/PortalFeedback';

const filters = ['Pending', 'Approved', 'Rejected', 'Failed', 'All'];
const statusColors = {
  Pending: ['#fbbf24', 'rgba(245,158,11,.12)'],
  Processing: ['#60a5fa', 'rgba(59,130,246,.14)'],
  Approved: ['#34d399', 'rgba(16,185,129,.13)'],
  Rejected: ['#f87171', 'rgba(239,68,68,.12)'],
  Failed: ['#fb7185', 'rgba(244,63,94,.13)']
};

export default function DeleteApprovals() {
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
      const response = await axios.get(`${API_BASE}/api/tpo/delete-requests`, { timeout: 30000 });
      if (!response.data?.success) throw new Error(response.data?.message || 'Could not load deletion requests.');
      setRequests(Array.isArray(response.data.requests) ? response.data.requests : []);
    } catch (error) {
      setLoadError(error.response?.data?.message || error.message || 'Could not load deletion requests.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadRequests(); }, [loadRequests]);

  const pendingCount = useMemo(() => requests.filter(request => String(request.status || '').toLowerCase() === 'pending').length, [requests]);
  const visibleRequests = useMemo(() => filter === 'All'
    ? requests
    : requests.filter(request => String(request.status || '').toLowerCase() === filter.toLowerCase()), [filter, requests]);

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
      const response = await axios.post(`${API_BASE}/api/tpo/delete-requests/${encodeURIComponent(request.requestId)}/review`, {
        decision,
        notes: isApprove ? '' : reviewNotes.trim()
      }, { timeout: 60000 });
      if (!response.data?.success) throw new Error(response.data?.message || 'The request could not be reviewed.');
      setReviewDialog(null);
      setReviewNotes('');
      setToast({ type: 'success', title: isApprove ? 'Record deletion approved' : 'Request rejected', message: isApprove ? `${request.summary} was deleted from its source sheet.` : `The request for ${request.summary} was rejected. No record was deleted.` });
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
              <div style={{ color: '#5eead4', fontSize: 12, fontWeight: 800, letterSpacing: 1.8, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 8 }}><ShieldCheck size={18} /> Deletion governance · Gifty’s review desk</div>
              <h1 style={{ margin: '10px 0 6px', fontSize: 'clamp(28px, 4vw, 42px)', letterSpacing: '-1.5px', color: '#f8fafc' }}>Delete record approvals</h1>
              <p style={{ margin: 0, color: '#aab8cc', fontSize: 15 }}>Review TPO requests before a placement or vacancy row can be removed.</p>
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
          <button type="button" onClick={loadRequests} disabled={loading} style={{ display: 'inline-flex', gap: 8, alignItems: 'center', border: '1px solid var(--card-border, #263449)', color: '#cbd5e1', background: 'var(--card-bg, #101827)', borderRadius: 10, padding: '10px 14px', cursor: 'pointer' }}><ArrowsClockwise size={17} /> Refresh</button>
        </section>

        {loadError && <div role="alert" style={{ marginBottom: 14, border: '1px solid rgba(248,113,113,.4)', background: 'rgba(127,29,29,.2)', color: '#fecaca', padding: 14, borderRadius: 12 }}>{loadError}</div>}
        {loading ? (
          <div style={{ minHeight: 220, display: 'grid', placeItems: 'center', border: '1px solid var(--card-border, #263449)', borderRadius: 18, background: 'var(--card-bg, #101827)', color: '#94a3b8' }}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}><CircleNotch size={21} className="ph-spin" /> Loading approval requests…</span></div>
        ) : visibleRequests.length === 0 ? (
          <div style={{ minHeight: 230, display: 'grid', placeContent: 'center', textAlign: 'center', border: '1px dashed rgba(148,163,184,.3)', borderRadius: 18, background: 'rgba(15,23,42,.55)', padding: 24 }}>
            <CheckCircle size={30} color="#5eead4" style={{ justifySelf: 'center' }} />
            <h2 style={{ margin: '12px 0 5px', color: '#f1f5f9', fontSize: 20 }}>No {filter.toLowerCase()} requests</h2>
            <p style={{ margin: 0, color: '#94a3b8' }}>New TPO deletion requests will appear here before any row is removed.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 13 }}>
            {visibleRequests.map(request => {
              const status = String(request.status || 'Pending');
              const color = statusColors[status] || statusColors.Pending;
              const target = request.target || {};
              const isPending = status.toLowerCase() === 'pending';
              return (
                <article key={request.requestId} style={{ border: '1px solid var(--card-border, #263449)', borderLeft: `4px solid ${color[0]}`, borderRadius: 16, padding: '18px 20px', background: 'linear-gradient(110deg, rgba(20,30,48,.98), rgba(12,19,32,.98))', boxShadow: '0 12px 30px rgba(0,0,0,.12)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    <div style={{ minWidth: 260, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
                        <span style={{ color: '#f8fafc', fontSize: 18, fontWeight: 800 }}>{request.summary}</span>
                        <span style={{ color: color[0], background: color[1], border: `1px solid ${color[0]}44`, padding: '4px 9px', borderRadius: 999, fontSize: 11, fontWeight: 800, textTransform: 'uppercase' }}>{status}</span>
                      </div>
                      <div style={{ color: '#93c5fd', fontSize: 12, fontWeight: 700, marginTop: 8 }}>{request.recordType} · Request {request.requestId}</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px 18px', marginTop: 10, color: '#94a3b8', fontSize: 13 }}>
                        <span>Requested by <strong style={{ color: '#dbeafe' }}>{request.requestedByName || request.requestedByEmail}</strong></span>
                        <span><Clock size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />{formatPortalDateTime(request.requestedAt, 'Time unavailable')}</span>
                        {target.branch && <span>Branch: <strong style={{ color: '#cbd5e1' }}>{target.branch}</strong></span>}
                        {target.course && <span>Course: <strong style={{ color: '#cbd5e1' }}>{target.course}</strong></span>}
                      </div>
                    </div>
                    {isPending && <div style={{ display: 'flex', gap: 8 }}>
                      <button type="button" disabled={Boolean(workingId)} onClick={() => { setReviewNotes(''); setReviewDialog({ request, decision: 'reject' }); }} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, border: '1px solid rgba(248,113,113,.4)', color: '#fca5a5', background: 'rgba(127,29,29,.18)', borderRadius: 10, padding: '10px 13px', cursor: 'pointer', fontWeight: 800 }}><XCircle size={17} /> Reject</button>
                      <button type="button" disabled={Boolean(workingId)} onClick={() => { setReviewNotes(''); setReviewDialog({ request, decision: 'approve' }); }} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, border: '1px solid rgba(45,212,191,.45)', color: '#99f6e4', background: 'rgba(13,148,136,.22)', borderRadius: 10, padding: '10px 13px', cursor: 'pointer', fontWeight: 800 }}>{workingId === request.requestId ? <CircleNotch size={17} className="ph-spin" /> : <CheckCircle size={17} />} Approve &amp; delete</button>
                    </div>}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10, marginTop: 15 }}>
                    <div style={{ padding: 12, borderRadius: 11, background: 'rgba(7,13,25,.42)', border: '1px solid rgba(148,163,184,.12)' }}>
                      <div style={{ color: '#64748b', fontSize: 10, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 5 }}>Reason from TPO</div>
                      <div style={{ color: '#d5deeb', fontSize: 13, lineHeight: 1.5 }}>{request.reason || 'No reason entered'}</div>
                    </div>
                    <div style={{ padding: 12, borderRadius: 11, background: 'rgba(7,13,25,.42)', border: '1px solid rgba(148,163,184,.12)' }}>
                      <div style={{ color: '#64748b', fontSize: 10, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 5 }}>Record scope</div>
                      <div style={{ color: '#d5deeb', fontSize: 13, lineHeight: 1.5 }}>{target.owner ? `Owner: ${target.owner}` : 'Owner not recorded'}{target.linkedApplicationCount ? ` · ${target.linkedApplicationCount} linked application(s) will remain attached to this job ID` : ''}</div>
                    </div>
                  </div>
                  {request.executionMessage && !isPending && <div style={{ marginTop: 12, color: '#94a3b8', fontSize: 12 }}>{request.executionMessage}</div>}
                </article>
              );
            })}
          </div>
        )}
      </main>
      <PortalConfirmDialog
        open={Boolean(reviewDialog)}
        title={reviewDialog?.decision === 'approve' ? 'Approve record deletion?' : 'Reject deletion request?'}
        message={reviewDialog?.decision === 'approve'
          ? `${reviewDialog?.request?.summary || 'This record'} will be deleted from its source sheet after approval.`
          : `${reviewDialog?.request?.summary || 'This request'} will be declined. The source record will stay in place.`}
        confirmLabel={reviewDialog?.decision === 'approve' ? 'Approve & delete' : 'Reject request'}
        tone={reviewDialog?.decision === 'approve' ? 'danger' : 'info'}
        busy={Boolean(workingId)}
        onCancel={() => { setReviewDialog(null); setReviewNotes(''); }}
        onConfirm={review}
      >
        {reviewDialog?.decision === 'approve' && <div style={{ padding: 12, borderRadius: 10, border: '1px solid rgba(248,113,113,.3)', background: 'rgba(127,29,29,.18)', color: '#fecaca', fontSize: 12, lineHeight: 1.5 }}>This action removes the selected row from its source sheet. It cannot be undone from this approval screen.</div>}
        {reviewDialog?.decision === 'reject' && <label style={{ display: 'grid', gap: 7, color: '#cbd5e1', fontSize: 13, fontWeight: 700 }}>Reason for rejection<textarea value={reviewNotes} onChange={event => setReviewNotes(event.target.value)} rows={3} maxLength={1000} placeholder="Explain why the request was rejected" style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', padding: 11, borderRadius: 9, border: '1px solid #334155', background: '#0b1320', color: '#f8fafc' }} /></label>}
      </PortalConfirmDialog>
      <PortalToast toast={toast} onDismiss={() => setToast(null)} />
    </Layout>
  );
}
