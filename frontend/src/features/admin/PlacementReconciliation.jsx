import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { ArrowClockwise, CheckCircle, CircleNotch, ClipboardText, WarningCircle } from '@phosphor-icons/react';
import Layout from '../../layouts/Layout';
import { API_BASE } from '../../services/apiConfig';
import { isPortalAdminAccount } from '../../utils/roleAccess';
import { formatPortalDateTime } from '../../utils/dateFormat';

const formatDate = value => value ? (formatPortalDateTime(value) || value) : 'Not recorded';
const badge = healthy => ({
  display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 999, padding: '5px 10px',
  color: healthy ? '#10b981' : '#f59e0b', background: healthy ? 'rgba(16,185,129,.12)' : 'rgba(245,158,11,.12)', fontSize: 12, fontWeight: 700
});

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
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (isAdmin) load(); }, [isAdmin, load]);

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
    } finally {
      setActionLoading(false);
    }
  };

  if (!isAdmin) {
    return <Layout><div className="page-container"><h1>Admin access required</h1><p>Placement reconciliation is available to portal administrators.</p></div></Layout>;
  }

  const mismatchCount = Number(reconciliation?.missingCount || 0) + Number(reconciliation?.staleCount || 0) + Number(reconciliation?.duplicateCount || 0);
  const statCard = (label, value, note) => (
    <div key={label} style={{ background: 'var(--surface-card, #111827)', border: '1px solid var(--border-color, #263244)', borderRadius: 14, padding: 18 }}>
      <div style={{ color: 'var(--text-muted)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</div>
      <strong style={{ display: 'block', marginTop: 8, fontSize: 28 }}>{value ?? '—'}</strong>
      <small style={{ color: 'var(--text-muted)' }}>{note}</small>
    </div>
  );
  const rowsTable = (title, rows, emptyText) => (
    <section style={{ marginTop: 22, background: 'var(--surface-card, #111827)', border: '1px solid var(--border-color, #263244)', borderRadius: 14, padding: 18 }}>
      <h2 style={{ margin: '0 0 14px', fontSize: 18 }}>{title}</h2>
      {!rows?.length ? <p style={{ color: 'var(--text-muted)', margin: 0 }}>{emptyText}</p> : (
        <div style={{ overflowX: 'auto' }}><table className="dt" style={{ minWidth: 720, width: '100%' }}>
          <thead><tr><th>Source key</th><th>Student</th><th>Roll</th><th>Company</th><th>Status</th></tr></thead>
          <tbody>{rows.map((row, index) => <tr key={`${row.key}-${index}`}>
            <td>{row.key}</td><td>{row.name || '—'}</td><td>{row.roll || '—'}</td><td>{row.company || '—'}</td><td>{row.status || '—'}</td>
          </tr>)}</tbody>
        </table></div>
      )}
      {rows?.length === 100 && <small style={{ color: 'var(--text-muted)' }}>Showing the first 100 mismatches. Counts include all rows.</small>}
    </section>
  );

  return (
    <Layout>
      <main className="page-container" style={{ padding: 0 }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
          <div>
            <h1 style={{ margin: '0 0 7px', fontSize: 30 }}>Placement data reconciliation</h1>
            <p style={{ margin: 0, color: 'var(--text-muted)' }}>Compare authoritative TPO_Log rows with the Placed_Students reporting sheet, inspect recent changes, and retry incomplete saves.</p>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button type="button" onClick={() => load(true)} disabled={loading || actionLoading} className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              {loading ? <CircleNotch className="ph-spin" /> : <ArrowClockwise />} Refresh
            </button>
            {reconciliation?.missingManualLogCount > 0 && <button type="button" onClick={() => runAdminAction('/api/admin/placement-reconciliation/repair-manual-saves', `Retry ${reconciliation.missingManualLogCount} incomplete manual placement save(s)? This will fill missing TPO_Log entries and refresh the derived sheet.`)} disabled={loading || actionLoading} className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              {actionLoading ? <CircleNotch className="ph-spin" /> : <ArrowClockwise />} Retry partial manual saves ({reconciliation.missingManualLogCount})
            </button>}
            <button type="button" onClick={() => runAdminAction('/api/admin/placement-reconciliation/rebuild', 'Rebuild the entire Placed_Students projection from TPO_Log? The current sheet will be backed up before it is cleared and rebuilt.')} disabled={loading || actionLoading || !meta?.sourceHealthy} className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              {actionLoading ? <CircleNotch className="ph-spin" /> : <ArrowClockwise />} Rebuild placed sheet
            </button>
            <button type="button" onClick={() => runAdminAction('/api/admin/company-opening-report', 'Send yesterday’s company resume delivery report to the configured recipients? The daily guard prevents a second report for the same date.')} disabled={loading || actionLoading || !meta?.sourceHealthy} className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              Send company report
            </button>
          </div>
        </header>

        {error && <div role="alert" style={{ marginBottom: 18, padding: 14, borderRadius: 10, color: '#fecaca', background: 'rgba(239,68,68,.12)' }}>{error}</div>}
        {actionMessage && <div role="status" style={{ marginBottom: 18, padding: 14, borderRadius: 10, color: '#a7f3d0', background: 'rgba(16,185,129,.12)' }}>{actionMessage}</div>}
        {loading && !reconciliation ? <div role="status" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}><CircleNotch className="ph-spin" size={28} /> Loading reconciliation…</div> : null}

        {reconciliation && <>
          <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 12 }}>
            {statCard('TPO_Log placed rows', reconciliation.sourceCount, 'Status is exactly Placed')}
            {statCard('Placed_Students rows', reconciliation.projectionCount, 'Derived reporting sheet')}
            {statCard('Missing in projection', reconciliation.missingCount, 'Source rows not copied')}
            {statCard('Stale in projection', reconciliation.staleCount, 'Projection rows with no current source')}
            {statCard('Duplicate projection keys', reconciliation.duplicateCount, 'Rows sharing one source key')}
            {statCard('Manual saves missing TPO_Log', reconciliation.missingManualLogCount, 'Retry can complete these saves')}
          </section>

          <section style={{ marginTop: 18, background: 'var(--surface-card, #111827)', border: '1px solid var(--border-color, #263244)', borderRadius: 14, padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
              {mismatchCount ? <WarningCircle color="#f59e0b" size={20} /> : <CheckCircle color="#10b981" size={20} />}
              <strong>{mismatchCount ? `${mismatchCount} projection issue(s) found` : 'Source and projection match'}</strong>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              <span style={badge(meta?.sourceHealthy)}>TPO_Log {meta?.sourceHealthy ? 'healthy' : 'not confirmed healthy'}</span>
              <span style={badge(meta?.projectionHealthy)}>Placed_Students {meta?.projectionHealthy ? 'healthy' : 'not confirmed healthy'}</span>
              <span style={badge(meta?.refreshStatus === 'success')}>Cache {meta?.refreshStatus || 'unknown'}</span>
            </div>
            <p style={{ color: 'var(--text-muted)', margin: '12px 0 0' }}>
              Last source sync: {formatDate(meta?.sourceLastSuccessfulSyncAt)} · Last projection sync: {formatDate(meta?.projectionLastSuccessfulSyncAt)} · Latest refresh: {formatDate(meta?.lastRefreshAttemptAt)}
            </p>
            {meta?.failedSheets?.length > 0 && <p style={{ color: '#fbbf24', margin: '8px 0 0' }}>Sheets with sync errors: {meta.failedSheets.join(', ')}</p>}
            {mismatchCount > 0 && <p style={{ color: 'var(--text-muted)', margin: '10px 0 0' }}>The next successful source refresh backs up the current projection and rebuilds it from healthy TPO_Log rows. Refresh above to run that sync now; it never edits TPO_Log.</p>}
          </section>

          {rowsTable('Source rows missing from Placed_Students', reconciliation.missingRows, 'No source rows are missing from the projection.')}
          {rowsTable('Projection rows with no matching source', reconciliation.staleRows, 'No stale projection rows were found.')}

          <section style={{ marginTop: 22, background: 'var(--surface-card, #111827)', border: '1px solid var(--border-color, #263244)', borderRadius: 14, padding: 18 }}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 10px', fontSize: 18 }}><ClipboardText size={20} /> Recent placement changes</h2>
            {!auditAvailable && <p style={{ color: 'var(--text-muted)' }}>No placement audit sheet exists yet. It is created automatically when the next placement change is saved.</p>}
            {auditAvailable && audit.length === 0 && <p style={{ color: 'var(--text-muted)' }}>No changes are recorded yet.</p>}
            {audit.length > 0 && <div style={{ overflowX: 'auto' }}><table className="dt" style={{ minWidth: 950, width: '100%' }}>
              <thead><tr><th>When</th><th>Who</th><th>Student</th><th>Opening</th><th>Change</th><th>From → To</th><th>Details</th></tr></thead>
              <tbody>{audit.map((row, index) => <tr key={row.eventId || index}>
                <td>{formatDate(row.timestamp)}</td><td>{row.actorName || row.actorEmail || '—'}</td>
                <td>{row.studentName || '—'}{row.roll ? <small style={{ display: 'block', color: 'var(--text-muted)' }}>{row.roll}</small> : null}</td>
                <td>{[row.company, row.position].filter(Boolean).join(' · ') || row.jobId || '—'}</td>
                <td>{row.action || '—'}</td><td>{row.previousStatus || '—'} → {row.newStatus || '—'}</td><td>{row.details || '—'}</td>
              </tr>)}</tbody>
            </table></div>}
          </section>
        </>}
      </main>
    </Layout>
  );
}
