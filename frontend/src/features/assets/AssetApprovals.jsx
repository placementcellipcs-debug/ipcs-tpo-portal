import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { CheckCircle, CircleNotch, ClipboardText, ClockCounterClockwise, Package, WarningCircle, XCircle } from '@phosphor-icons/react';
import Layout from '../../layouts/Layout';
import { API_BASE } from '../../services/apiConfig';
import { formatPortalDateTime } from '../../utils/dateFormat';
import './AssetOperationsCenter.css';

const readUser = () => { try { return JSON.parse(localStorage.getItem('tpoData') || '{}'); } catch { return {}; } };
const pending = status => String(status || 'PENDING').trim().toUpperCase() === 'PENDING';

export default function AssetApprovals() {
  const account = useMemo(readUser, []);
  const [requests, setRequests] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState('');
  const [rejecting, setRejecting] = useState(null);
  const [reason, setReason] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [approvalResponse, transferResponse, assetResponse] = await Promise.all([
        axios.get(`${API_BASE}/api/v1/assets/approvals`),
        axios.get(`${API_BASE}/api/v1/assets/transfers`),
        axios.get(`${API_BASE}/api/v1/assets`)
      ]);
      if (!approvalResponse.data?.success) throw new Error(approvalResponse.data?.message || 'Could not load pending asset approvals.');
      if (!transferResponse.data?.success) throw new Error(transferResponse.data?.message || 'Could not load transfer requests.');
      setRequests(approvalResponse.data.requests || []);
      setTransfers(transferResponse.data.transfers || []);
      setAssets(assetResponse.data?.assets || []);
    } catch (requestError) { setError(requestError.response?.data?.message || requestError.message || 'Could not load asset approvals.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const assetNames = useMemo(() => new Map(assets.map(asset => [String(asset.assetId || '').toLowerCase(), asset.name])), [assets]);
  const pendingDeletes = requests.filter(request => request.requestType === 'DELETE_ASSET' && pending(request.decision));
  const pendingTransfers = transfers.filter(transfer => pending(transfer.status));
  const allDone = [
    ...requests.filter(request => request.requestType === 'DELETE_ASSET' && !pending(request.decision)).map(request => ({ kind: 'Retirement', id: request.requestId, itemId: request.assetId, itemName: request.assetName, branch: request.branch, status: request.decision, requester: request.requestedBy, date: request.decidedAt || request.requestedAt, notes: request.reason })),
    ...transfers.filter(transfer => !pending(transfer.status)).map(transfer => ({ kind: 'Transfer', id: transfer.transferId, itemId: transfer.assetId, itemName: assetNames.get(String(transfer.assetId || '').toLowerCase()), branch: `${transfer.fromBranch} → ${transfer.toBranch}`, status: transfer.status, requester: transfer.requestedBy, date: transfer.receivedAt || transfer.dispatchedAt || transfer.date, notes: transfer.remarks }))
  ].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

  const decide = async (kind, id, decision, rejectionReason = '') => {
    const key = `${kind}:${id}`;
    setBusy(key); setError(''); setMessage('');
    try {
      let response;
      if (kind === 'retirement') response = await axios.post(`${API_BASE}/api/v1/assets/approvals/${encodeURIComponent(id)}/decision`, { decision, reason: rejectionReason });
      else response = await axios.post(`${API_BASE}/api/v1/assets/transfers/${decision === 'APPROVED' ? 'approve' : 'reject'}`, { transferId: id, userName: account.name || account.email || 'Rakesh', ...(decision === 'REJECTED' ? { reason: rejectionReason } : {}) });
      if (!response.data?.success) throw new Error(response.data?.message || 'Could not save this decision.');
      setMessage(response.data.message || `${kind === 'retirement' ? 'Retirement' : 'Transfer'} ${decision.toLowerCase()}.`);
      setRejecting(null); setReason('');
      await load();
    } catch (requestError) { setError(requestError.response?.data?.message || requestError.message || 'Could not save this decision.'); }
    finally { setBusy(''); }
  };
  const beginReject = (kind, id) => { setRejecting({ kind, id }); setReason(''); };
  const submitRejection = event => { event.preventDefault(); if (!reason.trim()) return; void decide(rejecting.kind, rejecting.id, 'REJECTED', reason.trim()); };

  const renderRequest = (item, kind) => {
    const isRetirement = kind === 'retirement';
    const id = isRetirement ? item.requestId : item.transferId;
    const rowBusy = busy === `${kind}:${id}`;
    const name = item.assetName || assetNames.get(String(item.assetId || '').toLowerCase()) || 'Asset item';
    const destination = isRetirement ? item.branch : `${item.fromBranch || 'Branch'} → ${item.toBranch || 'Branch'}`;
    const detail = isRetirement ? [item.reason, item.payload?.method && `Method: ${item.payload.method}`, item.payload?.remarks].filter(Boolean).join(' · ') : item.remarks;
    return <article className="asset-approval-card" key={`${kind}:${id}`}><span className="asset-approval-symbol"><Package size={19} /></span><div className="asset-approval-main"><div className="asset-approval-title"><b>{name}</b><span>{isRetirement ? 'RETIREMENT REQUEST' : 'BRANCH TRANSFER'}</span></div><p>{item.assetId} · {destination}</p><small>Requested by {item.requestedBy || 'Staff'}{item.requestedAt || item.date ? ` · ${formatPortalDateTime(item.requestedAt || item.date, '')}` : ''}</small>{detail && <small>{detail}</small>}
      {rejecting?.kind === kind && rejecting.id === id && <form className="asset-approval-reject-form" onSubmit={submitRejection}><label><span>Reason for rejection</span><textarea value={reason} onChange={event => setReason(event.target.value)} required rows={2} placeholder="Explain what needs to be corrected" /></label><div><button type="button" onClick={() => setRejecting(null)}>Cancel</button><button className="asset-reject-button" disabled={!reason.trim() || rowBusy} type="submit">Confirm rejection</button></div></form>}
      </div><div className="asset-approval-actions">{!rejecting || rejecting.id !== id ? <><button type="button" className="asset-approve-button" disabled={rowBusy} onClick={() => void decide(kind, id, 'APPROVED')}><CheckCircle size={16} /> Approve</button><button type="button" className="asset-reject-button" disabled={rowBusy} onClick={() => beginReject(kind, id)}><XCircle size={16} /> Reject</button></> : null}{rowBusy && <CircleNotch size={17} className="ph-spin" />}</div></article>;
  };

  return <Layout><main className="asset-ops-page">
    <header className="asset-ops-hero approval-hero"><span className="asset-ops-hero-icon"><ClipboardText size={23} weight="duotone" /></span><div><span className="asset-ops-eyebrow">RAKESH · ASSET GOVERNANCE</span><h1>Asset approval desk</h1><p>Review retirement and branch-transfer requests before any approved change is committed.</p></div><div className="asset-ops-hero-stat"><b>{pendingDeletes.length + pendingTransfers.length}</b><span>Waiting for review</span></div></header>
    {message && <div className="asset-ops-message success" role="status">{message}<button onClick={() => setMessage('')}>Dismiss</button></div>}
    {error && <div className="asset-ops-message error" role="alert"><WarningCircle size={18} />{error}<button onClick={() => void load()}>Retry</button></div>}
    <section className="asset-ops-panel"><div className="asset-ops-section-head"><div><span>DECISION QUEUE</span><h2>Requests that need your review</h2></div><button className="asset-ops-refresh" onClick={() => void load()}>Refresh</button></div>
      {loading ? <div className="asset-ops-loading"><CircleNotch size={24} className="ph-spin" /> Loading approval requests…</div> : <>
        <div className="asset-approval-group"><div className="asset-approval-group-heading"><h3>Retirement & deletion</h3><span>{pendingDeletes.length} pending</span></div>{pendingDeletes.length ? <div className="asset-approval-list">{pendingDeletes.map(item => renderRequest(item, 'retirement'))}</div> : <div className="asset-ops-empty compact">No pending retirement requests.</div>}</div>
        <div className="asset-approval-group"><div className="asset-approval-group-heading"><h3>Branch transfers</h3><span>{pendingTransfers.length} pending</span></div>{pendingTransfers.length ? <div className="asset-approval-list">{pendingTransfers.map(item => renderRequest(item, 'transfer'))}</div> : <div className="asset-ops-empty compact">No pending transfer requests.</div>}</div>
      </>}
    </section>
    {!loading && <section className="asset-ops-panel"><div className="asset-ops-section-head"><div><span>DECISION HISTORY</span><h2>Reviewed requests</h2></div><span className="asset-approval-scope">{allDone.length} records</span></div>{allDone.length ? <div className="asset-approval-list">{allDone.map(item => <article className="asset-approval-card" key={`${item.kind}:${item.id}`}><span className="asset-approval-symbol"><ClockCounterClockwise size={19} /></span><div className="asset-approval-main"><div className="asset-approval-title"><b>{item.itemName || 'Asset item'}</b><span>{item.kind.toUpperCase()}</span></div><p>{item.itemId} · {item.branch}</p><small>{item.requester || 'Staff'} · {formatPortalDateTime(item.date, '')}</small>{item.notes && <small>{item.notes}</small>}</div><span className={`asset-ops-status ${String(item.status || '').toLowerCase()}`}>{String(item.status || '').replaceAll('_', ' ')}</span></article>)}</div> : <div className="asset-ops-empty compact">Decisions will be listed here after you review requests.</div>}</section>}
  </main></Layout>;
}
