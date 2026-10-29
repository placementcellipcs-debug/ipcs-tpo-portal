import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { CheckCircle, CircleNotch, EnvelopeSimple, PaperPlaneTilt, WarningCircle } from '@phosphor-icons/react';
import Layout from '../../layouts/Layout';
import { API_BASE } from '../../services/apiConfig';
import './AssetOperationsCenter.css';
import { formatPortalDateTime } from '../../utils/dateFormat';

const currentUser = () => { try { return JSON.parse(localStorage.getItem('tpoData') || '{}'); } catch { return {}; } };

export default function AssetMailCenter() {
  const user = currentUser();
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const response = await axios.get(`${API_BASE}/api/v1/assets/notifications`);
      setNotifications(response.data?.notifications || []);
    } catch { setNotifications([]); }
    finally { setLoadingHistory(false); }
  }, []);
  const sendSummary = async () => {
    setSending(true); setMessage(null);
    try {
      const response = await axios.post(`${API_BASE}/api/v1/assets/notifications/summary`);
      setMessage({ kind: 'success', text: response.data?.message || 'Asset summary requested.' });
      await loadHistory();
    } catch (error) { setMessage({ kind: 'error', text: error.response?.data?.message || 'Could not send the asset summary.' }); }
    finally { setSending(false); }
  };

  useEffect(() => { void loadHistory(); }, [loadHistory]);

  return <Layout><main className="asset-ops-page">
    <header className="asset-ops-hero mail-hero"><span className="asset-ops-hero-icon"><EnvelopeSimple size={23} weight="duotone" /></span><div><span className="asset-ops-eyebrow">REPORT DELIVERY</span><h1>Email center</h1><p>Send a branch-scoped asset report through the portal’s existing queued mail and retry service.</p></div><div className="asset-ops-hero-stat"><b>1</b><span>Report available</span></div></header>
    {message && <div className={`asset-ops-message ${message.kind}`} role={message.kind === 'error' ? 'alert' : 'status'}>{message.kind === 'success' ? <CheckCircle size={18} /> : <WarningCircle size={18} />}{message.text}</div>}
    <section className="asset-mail-card"><div className="asset-mail-art"><EnvelopeSimple size={42} weight="duotone" /><span className="asset-mail-pulse" /></div><div className="asset-mail-copy"><span className="asset-ops-eyebrow">ASSET OPERATIONS SUMMARY</span><h2>Get the latest numbers in your inbox</h2><p>The report includes tracked, assigned and available items, pending transfers, and low stock alerts. It follows your account’s permitted branch scope.</p><div className="asset-mail-recipient"><span>DELIVER TO</span><b>{user.email || 'No email is attached to this account'}</b></div><button className="asset-ops-primary" onClick={() => void sendSummary()} disabled={sending || !user.email}>{sending ? <CircleNotch className="ph-spin" size={17} /> : <PaperPlaneTilt size={17} />} {sending ? 'Sending report…' : 'Send summary to me'}</button></div></section>
    <section className="asset-ops-panel"><div className="asset-ops-section-head"><div><span>DELIVERY HISTORY</span><h2>Recent asset emails</h2></div></div>{loadingHistory ? <div className="asset-ops-loading"><CircleNotch className="ph-spin" size={20} /> Loading delivery history…</div> : notifications.length ? <div className="asset-mail-history">{notifications.map(item => <article key={item.notificationId}><span className={`asset-ops-status ${String(item.status || '').toLowerCase()}`}>{item.status}</span><div><b>{item.subject || item.eventType}</b><small>{item.recipient} · {formatPortalDateTime(item.timestamp, String(item.timestamp || ''))}</small></div><small>{item.provider || 'Portal mail'}{item.queueId ? ` · ${item.queueId}` : ''}</small></article>)}</div> : <div className="asset-ops-empty compact">No asset emails have been requested yet.</div>}</section>
    <section className="asset-ops-panel asset-mail-info"><div className="asset-ops-section-head"><div><span>DELIVERY SAFEGUARDS</span><h2>How mail is handled</h2></div></div><div className="asset-mail-steps"><article><span>01</span><div><b>Uses your signed-in email</b><small>Only the email on your active portal account is used as recipient.</small></div></article><article><span>02</span><div><b>Uses the existing mail queue</b><small>Temporary delivery failures are queued for retry and tracked by the portal mail service.</small></div></article><article><span>03</span><div><b>Never sends automatically from this page</b><small>A report goes out only after you click “Send summary to me.”</small></div></article></div></section>
  </main></Layout>;
}
