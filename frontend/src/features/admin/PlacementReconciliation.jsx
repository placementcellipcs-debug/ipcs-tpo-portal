import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import {
  ArrowClockwise, ArrowCounterClockwise, CheckCircle, CircleNotch,
  ClipboardText, Database, WarningCircle, Wrench
} from '@phosphor-icons/react';
import Layout from '../../layouts/Layout';
import { API_BASE } from '../../services/apiConfig';
import { isPortalAdminAccount } from '../../utils/roleAccess';
import { formatPortalDateTime } from '../../utils/dateFormat';
import './PlacementReconciliation.css';

const formatDate = value => value ? (formatPortalDateTime(value) || value) : 'Not recorded';

function ReconciliationTable({ title, rows, emptyText, kind = 'mismatch' }) {
  const audit = kind === 'audit';
  return <section className={`recon-panel recon-table-panel ${audit ? 'audit-panel' : ''}`}>
    <div className="recon-panel-heading"><div><span>{audit ? 'CHANGE HISTORY' : 'ROW-LEVEL REVIEW'}</span><h2>{title}</h2></div>{audit && <ClipboardText size={22} />}</div>
    {!rows?.length ? <div className="recon-empty"><CheckCircle size={21} /><span>{emptyText}</span></div> : <div className="recon-table-scroll">
      <table className={`recon-table ${audit ? 'recon-audit-table' : ''}`}>
        {audit ? <colgroup><col className="col-when" /><col className="col-who" /><col className="col-student" /><col className="col-opening" /><col className="col-change" /><col className="col-status" /><col className="col-details" /></colgroup> : <colgroup><col className="col-source-key" /><col className="col-student" /><col className="col-roll" /><col className="col-company" /><col className="col-status" /></colgroup>}
        <thead>{audit ? <tr><th>When</th><th>Who</th><th>Student</th><th>Opening</th><th>Change</th><th>From → To</th><th>Details</th></tr> : <tr><th>Source key</th><th>Student</th><th>Roll number</th><th>Company</th><th>Status</th></tr>}</thead>
        <tbody>{audit ? rows.map((row, index) => <tr key={row.eventId || index}>
          <td><time>{formatDate(row.timestamp)}</time></td>
          <td>{row.actorName || row.actorEmail || '—'}</td>
          <td><b>{row.studentName || '—'}</b>{row.roll && <small>{row.roll}</small>}</td>
          <td>{[row.company, row.position].filter(Boolean).join(' · ') || row.jobId || '—'}</td>
          <td><span className="recon-action-tag">{row.action || '—'}</span></td>
          <td><span className="recon-status-change">{row.previousStatus || '—'} <i>→</i> {row.newStatus || '—'}</span></td>
          <td className="recon-detail-cell">{row.details || '—'}</td>
        </tr>) : rows.map((row, index) => <tr key={`${row.key}-${index}`}>
          <td><code>{row.key || '—'}</code></td><td><b>{row.name || '—'}</b></td><td>{row.roll || '—'}</td><td>{row.company || '—'}</td><td><span className="recon-placed-status">{row.status || '—'}</span></td>
        </tr>)}</tbody>
      </table>
      {!audit && rows.length === 100 && <p className="recon-table-note">Showing the first 100 mismatches. Summary counts include every row.</p>}
    </div>}
  </section>;
}

export default function PlacementReconciliation() {
  let account;
  try { account = JSON.parse(localStorage.getItem('tpoData') || 'null'); } catch { account = null; }
  const isAdmin = isPortalAdminAccount(account);
  const [reconciliation, setReconciliation] = useState(null);
  const [meta, setMeta] = useState(null);
  const [audit, setAudit] = useState([]);
  const [auditAvailable, setAuditAvailable] = useState(true);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setError('');
    try {
      if (forceRefresh) {
        const refreshResponse = await axios.post(`${API_BASE}/api/admin/placement-reconciliation/refresh`, {}, { timeout: 120000 });
        if (!refreshResponse.data?.success) throw new Error(refreshResponse.data?.message || 'Could not refresh the placement sheets.');
      }
      const [reconciliationResponse, auditResponse] = await Promise.all([
        axios.get(`${API_BASE}/api/admin/placement-reconciliation`, { timeout: 45000 }),
        axios.get(`${API_BASE}/api/admin/placement-audit`, { timeout: 45000 }).catch(() => null)
      ]);
      if (!reconciliationResponse.data?.success) throw new Error(reconciliationResponse.data?.message || 'Could not load placement reconciliation.');
      setReconciliation(reconciliationResponse.data.reconciliation);
      setMeta(reconciliationResponse.data.dataMeta);
      setAudit(auditResponse?.data?.logs || []);
      setAuditAvailable(Boolean(auditResponse?.data?.available));
    } catch (loadError) {
      setError(loadError.response?.data?.message || loadError.message || 'Could not load placement reconciliation.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { if (isAdmin) void load(); }, [isAdmin, load]);

  const runAdminAction = async (path, prompt) => {
    if (actionLoading || (prompt && !window.confirm(prompt))) return;
    setActionLoading(true);
    setActionMessage('');
    setError('');
    try {
      const response = await axios.post(`${API_BASE}${path}`, {}, { timeout: 120000 });
      if (!response.data?.success) throw new Error(response.data?.message || 'The action could not be completed.');
      setActionMessage(response.data.message || 'Completed.');
      await load();
    } catch (actionError) {
      setError(actionError.response?.data?.message || actionError.message || 'The action could not be completed.');
    } finally { setActionLoading(false); }
  };

  if (!isAdmin) return <Layout><div className="page-container"><h1>Admin access required</h1><p>Placement reconciliation is available to portal administrators.</p></div></Layout>;

  const mismatchCount = Number(reconciliation?.missingCount || 0) + Number(reconciliation?.staleCount || 0) + Number(reconciliation?.duplicateCount || 0);
  const cards = [
    { label: 'Placed source rows', value: reconciliation?.sourceCount, note: 'TPO_Log · exact Placed status', tone: 'cyan', icon: Database },
    { label: 'Projection rows', value: reconciliation?.projectionCount, note: 'Placed_Students reporting sheet', tone: 'violet', icon: ClipboardText },
    { label: 'Missing from projection', value: reconciliation?.missingCount, note: 'Source rows not copied', tone: 'amber', icon: WarningCircle },
    { label: 'Stale projection rows', value: reconciliation?.staleCount, note: 'No matching source row', tone: 'rose', icon: ArrowCounterClockwise },
    { label: 'Duplicate projection keys', value: reconciliation?.duplicateCount, note: 'Rows sharing a source key', tone: 'blue', icon: WarningCircle },
    { label: 'Manual saves to repair', value: reconciliation?.missingManualLogCount, note: 'Incomplete TPO_Log writes', tone: 'mint', icon: Wrench }
  ];

  return <Layout><main className="recon-page">
    <header className="recon-hero">
      <div className="recon-hero-copy"><span className="recon-kicker"><i /> DATA QUALITY CONTROL</span><h1>Placement reconciliation</h1><p>Compare the authoritative placement log with its reporting sheet, review row-level differences, and repair incomplete saves.</p></div>
      <div className="recon-hero-icon"><Database size={35} weight="duotone" /><span /><i /></div>
    </header>

    <section className="recon-action-bar" aria-label="Reconciliation actions">
      <div className="recon-action-copy"><span>ADMIN ACTIONS</span><b>Review or repair the placement data</b></div>
      <div className="recon-action-buttons">
        <button type="button" className="recon-button secondary" onClick={() => void load(true)} disabled={loading || actionLoading}>{loading ? <CircleNotch className="ph-spin" /> : <ArrowClockwise />} Refresh source data</button>
        {reconciliation?.missingManualLogCount > 0 && <button type="button" className="recon-button warning" onClick={() => void runAdminAction('/api/admin/placement-reconciliation/repair-manual-saves', `Retry ${reconciliation.missingManualLogCount} incomplete manual placement save(s)? This will fill missing TPO_Log entries and refresh the derived sheet.`)} disabled={loading || actionLoading}>{actionLoading ? <CircleNotch className="ph-spin" /> : <Wrench />} Retry manual saves <span>{reconciliation.missingManualLogCount}</span></button>}
        <button type="button" className="recon-button primary" onClick={() => void runAdminAction('/api/admin/placement-reconciliation/rebuild', 'Rebuild the entire Placed_Students projection from TPO_Log? The current sheet will be backed up before it is cleared and rebuilt.')} disabled={loading || actionLoading || !meta?.sourceHealthy}>{actionLoading ? <CircleNotch className="ph-spin" /> : <ArrowCounterClockwise />} Rebuild placed sheet</button>
        <button type="button" className="recon-button report" onClick={() => void runAdminAction('/api/admin/company-opening-report', 'Send yesterday’s company resume delivery report to the configured recipients? The daily guard prevents a second report for the same date.')} disabled={loading || actionLoading || !meta?.sourceHealthy}>{actionLoading ? <CircleNotch className="ph-spin" /> : <ClipboardText />} Send company report</button>
      </div>
    </section>

    {error && <div className="recon-notice error" role="alert"><WarningCircle size={19} />{error}</div>}
    {actionMessage && <div className="recon-notice success" role="status"><CheckCircle size={19} />{actionMessage}</div>}
    {loading && !reconciliation ? <div className="recon-loading" role="status"><CircleNotch className="ph-spin" size={30} /><span>Loading source and projection rows…</span></div> : null}

    {reconciliation && <>
      <section className="recon-metrics" aria-label="Reconciliation counts">{cards.map(({ label, value, note, tone, icon: Icon }) => <article className={`recon-metric ${tone}`} key={label}><span className="recon-metric-icon"><Icon size={20} weight="duotone" /></span><div><span>{label}</span><strong>{Number(value || 0).toLocaleString('en-IN')}</strong><small>{note}</small></div></article>)}</section>

      <section className={`recon-health-panel ${mismatchCount ? 'has-issues' : 'is-healthy'}`}>
        <div className="recon-health-top"><span className="recon-health-symbol">{mismatchCount ? <WarningCircle size={22} /> : <CheckCircle size={22} />}</span><div><span>SHEET HEALTH</span><h2>{mismatchCount ? `${mismatchCount.toLocaleString('en-IN')} placement row issue${mismatchCount === 1 ? '' : 's'} found` : 'Source and reporting sheet match'}</h2></div></div>
        <div className="recon-health-badges"><span className={meta?.sourceHealthy ? 'healthy' : 'unknown'}><i /> TPO_Log {meta?.sourceHealthy ? 'healthy' : 'not confirmed'}</span><span className={meta?.projectionHealthy ? 'healthy' : 'unknown'}><i /> Placed_Students {meta?.projectionHealthy ? 'healthy' : 'not confirmed'}</span><span className={meta?.refreshStatus === 'success' ? 'healthy' : 'unknown'}><i /> Cache {meta?.refreshStatus || 'unknown'}</span></div>
        <div className="recon-sync-grid"><div><span>Source sync</span><b>{formatDate(meta?.sourceLastSuccessfulSyncAt)}</b></div><div><span>Projection sync</span><b>{formatDate(meta?.projectionLastSuccessfulSyncAt)}</b></div><div><span>Last refresh attempt</span><b>{formatDate(meta?.lastRefreshAttemptAt)}</b></div></div>
        {meta?.failedSheets?.length > 0 && <p className="recon-sheet-errors">Sync errors: {meta.failedSheets.join(', ')}</p>}
        {mismatchCount > 0 && <p className="recon-health-footnote">Refresh runs a source sync. Rebuilding first backs up Placed_Students, then derives it from healthy TPO_Log rows; it does not edit TPO_Log.</p>}
      </section>

      <div className="recon-tables-grid"><ReconciliationTable title="Source rows missing from Placed_Students" rows={reconciliation.missingRows} emptyText="No source rows are missing from the projection." /><ReconciliationTable title="Projection rows with no matching source" rows={reconciliation.staleRows} emptyText="No stale projection rows were found." /></div>

      {!auditAvailable
        ? <section className="recon-panel recon-audit-unavailable"><ClipboardText size={24} /><div><h2>Recent placement changes</h2><p>No placement audit sheet exists yet. It will be created automatically when the next placement change is saved.</p></div></section>
        : <ReconciliationTable kind="audit" title="Recent placement changes" rows={audit} emptyText="No changes are recorded yet." />}
    </>}
  </main></Layout>;
}
