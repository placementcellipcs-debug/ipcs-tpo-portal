import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { ArrowRight, Check, CircleNotch, ClipboardText, X, WarningCircle } from '@phosphor-icons/react';
import Layout from '../../layouts/Layout';
import { API_BASE } from '../../services/apiConfig';
import { formatPortalDateTime } from '../../utils/dateFormat';
import './AssetOperationsCenter.css';

const readUser = () => { try { return JSON.parse(localStorage.getItem('tpoData') || '{}'); } catch { return {}; } };
const isAdmin = user => String(user?.accessType || '').toLowerCase() === 'superadmin' || ['SYSTEM ADMIN', 'GENERAL MANAGER', 'ZONAL PLACEMENT HEAD', 'TECHNICAL HEAD'].includes(String(user?.role || '').toUpperCase());
const key = value => String(value || '').toLowerCase().replace(/\b(branch|office)\b/g, '').replace(/[^a-z0-9]/g, '');

export default function AssetApprovals() {
  const user = useMemo(() => readUser(), []);
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const admin = isAdmin(user);
  const assignedBranches = user.assignedBranchesArray || user.assignedBranches || user.branches || [];
  const canApproveFrom = branch => admin || [user.sittingBranch, ...(Array.isArray(assignedBranches) ? assignedBranches : [assignedBranches])].some(value => key(value) && key(value) === key(branch));

  const loadTransfers = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await axios.get(`${API_BASE}/api/v1/assets/transfers`);
      if (!response.data?.success) throw new Error(response.data?.message || 'Could not load approval requests.');
      setTransfers(response.data.transfers || []);
    } catch (requestError) { setError(requestError.response?.data?.message || requestError.message || 'Could not load approval requests.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void loadTransfers(); }, [loadTransfers]);
  const pending = transfers.filter(transfer => String(transfer.status || '').toUpperCase() === 'PENDING');
  const history = transfers.filter(transfer => String(transfer.status || '').toUpperCase() !== 'PENDING').slice(0, 8);

  const approve = async transfer => {
    if (!window.confirm(`Approve transfer ${transfer.transferId} from ${transfer.fromBranch} to ${transfer.toBranch}?`)) return;
    setBusyId(transfer.transferId); setNotice(''); setError('');
    try {
      const response = await axios.post(`${API_BASE}/api/v1/assets/transfers/approve`, { transferId: transfer.transferId, userName: user.name || user.email || 'Asset manager' });
      setNotice(response.data?.message || 'Transfer approved.');
      await loadTransfers();
    } catch (requestError) { setError(requestError.response?.data?.message || 'Could not approve this transfer.'); }
    finally { setBusyId(''); }
  };

  const reject = async transfer => {
    const reason = window.prompt(`Why are you rejecting transfer ${transfer.transferId}?`);
    if (!String(reason || '').trim()) return;
    setBusyId(transfer.transferId); setNotice(''); setError('');
    try {
      const response = await axios.post(`${API_BASE}/api/v1/assets/transfers/reject`, { transferId: transfer.transferId, reason: reason.trim(), userName: user.name || user.email || 'Asset manager' });
      setNotice(response.data?.message || 'Transfer rejected.');
      await loadTransfers();
    } catch (requestError) { setError(requestError.response?.data?.message || 'Could not reject this transfer.'); }
    finally { setBusyId(''); }
  };

  return <Layout><main className="asset-ops-page">
    <header className="asset-ops-hero"><span className="asset-ops-hero-icon"><ClipboardText size={23} weight="duotone" /></span><div><span className="asset-ops-eyebrow">CONTROL DESK</span><h1>Approvals</h1><p>Review asset movement requests from the branches you manage.</p></div><div className="asset-ops-hero-stat"><b>{pending.length}</b><span>Waiting for review</span></div></header>
    {error && <div className="asset-ops-message error" role="alert"><WarningCircle size={18} />{error}<button onClick={() => void loadTransfers()}>Retry</button></div>}
    {notice && <div className="asset-ops-message success" role="status">{notice}</div>}
    <section className="asset-ops-panel"><div className="asset-ops-section-head"><div><span>TRANSFER REQUESTS</span><h2>Needs your decision</h2></div><button className="asset-ops-refresh" onClick={() => void loadTransfers()}>Refresh</button></div>
      {loading ? <div className="asset-ops-loading"><CircleNotch className="ph-spin" size={24} /> Loading requests…</div> : pending.length ? <div className="asset-approval-list">{pending.map(transfer => <article className="asset-approval-card" key={transfer.transferId}>
        <div className="asset-approval-symbol"><ArrowRight size={19} /></div><div className="asset-approval-main"><div className="asset-approval-title"><b>{transfer.assetId || 'Asset transfer'}</b><span>{transfer.transferId}</span></div><p>{transfer.fromBranch} <ArrowRight size={14} /> {transfer.toBranch}</p><small>Requested by {transfer.requestedBy || 'Branch team'} · {formatPortalDateTime(transfer.date, String(transfer.date || 'Date unavailable'))}</small>{transfer.remarks && <small>{transfer.remarks}</small>}</div>
        <div className="asset-approval-actions">{canApproveFrom(transfer.fromBranch) ? <><button className="asset-approve-button" disabled={Boolean(busyId)} onClick={() => void approve(transfer)}>{busyId === transfer.transferId ? <CircleNotch className="ph-spin" size={17} /> : <Check size={17} />} Approve</button><button className="asset-reject-button" disabled={Boolean(busyId)} onClick={() => void reject(transfer)}><X size={17} /> Reject</button></> : <span className="asset-approval-scope">Source branch approval required</span>}</div>
      </article>)}</div> : <div className="asset-ops-empty"><Check size={22} /><b>You’re all caught up</b><span>No pending transfers are waiting for approval in your branch scope.</span></div>}
    </section>
    <section className="asset-ops-panel"><div className="asset-ops-section-head"><div><span>RECENT DECISIONS</span><h2>Transfer history</h2></div></div>{history.length ? <div className="asset-ops-history">{history.map(item => <article key={item.transferId}><span className={`asset-ops-status ${String(item.status || '').toLowerCase()}`}>{String(item.status || '').replaceAll('_', ' ')}</span><b>{item.assetId} · {item.fromBranch} to {item.toBranch}</b><small>{item.transferId} · {item.requestedBy || 'Branch team'}</small></article>)}</div> : <div className="asset-ops-empty compact">No completed transfer decisions yet.</div>}</section>
  </main></Layout>;
}
