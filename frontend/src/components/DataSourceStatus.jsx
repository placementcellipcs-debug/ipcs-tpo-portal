import { ArrowClockwise, CircleNotch } from '@phosphor-icons/react';

const formatSyncTime = value => {
  if (!value) return 'not available';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'not available'
    : date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
};

export default function DataSourceStatus({ source, detail, health, lastSyncedAt, lastAttemptAt, onRefresh, refreshing = false }) {
  const failed = health === false;
  const textColor = failed ? '#fbbf24' : 'var(--text-muted)';
  const syncLabel = lastSyncedAt && typeof lastSyncedAt === 'object'
    ? Object.entries(lastSyncedAt).map(([label, value]) => `${label}: ${formatSyncTime(value)}`).join(' · ')
    : formatSyncTime(lastSyncedAt);
  const syncMessage = health === true
    ? `Last successful sync: ${syncLabel}`
    : `Sync not confirmed. Last attempt: ${formatSyncTime(lastAttemptAt)}. Last successful sync: ${syncLabel}`;

  return (
    <div
      role={failed ? 'alert' : 'status'}
      style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap',
        margin: '0 0 18px', padding: '11px 14px', borderRadius: '10px',
        border: `1px solid ${failed ? 'rgba(251,191,36,.35)' : 'var(--card-border)'}`,
        background: failed ? 'rgba(120,78,0,.12)' : 'var(--card-bg)', color: textColor, fontSize: '.9rem'
      }}
    >
      <span>
        <strong style={{ color: 'var(--text-main)' }}>Source: {source}.</strong>{' '}
        {detail} {syncMessage}.
      </span>
      {onRefresh && (
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          title="Reload the latest data currently available in the portal cache"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 11px', borderRadius: '8px', border: '1px solid var(--card-border)', background: 'transparent', color: 'var(--text-main)', cursor: refreshing ? 'wait' : 'pointer', opacity: refreshing ? .7 : 1 }}
        >
          {refreshing ? <CircleNotch className="ph-spin" size={15} /> : <ArrowClockwise size={15} />}
          {refreshing ? 'Loading' : 'Reload'}
        </button>
      )}
    </div>
  );
}
