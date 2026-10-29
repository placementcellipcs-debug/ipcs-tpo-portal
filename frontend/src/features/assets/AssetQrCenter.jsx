import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Barcode, CircleNotch, MagnifyingGlass, Printer, QrCode, WarningCircle, X } from '@phosphor-icons/react';
import Layout from '../../layouts/Layout';
import { API_BASE } from '../../services/apiConfig';
import './AssetOperationsCenter.css';

const text = value => String(value || '').trim().toLowerCase();
const qrImage = assetId => {
  const link = new URL('/assets/register', window.location.origin);
  link.searchParams.set('assetId', assetId);
  return `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(link.toString())}`;
};

export default function AssetQrCenter() {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [creatingLabel, setCreatingLabel] = useState(false);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await axios.get(`${API_BASE}/api/v1/assets`);
      if (!response.data?.success) throw new Error(response.data?.message || 'Could not load the asset register.');
      setAssets(response.data.assets || []);
    } catch (requestError) { setError(requestError.response?.data?.message || requestError.message || 'Could not load the asset register.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => assets.filter(asset => [asset.assetId, asset.name, asset.branch, asset.location, asset.category].some(value => text(value).includes(text(search)))), [assets, search]);
  const createLabel = async asset => {
    setCreatingLabel(true); setError('');
    try {
      const response = await axios.post(`${API_BASE}/api/v1/assets/${encodeURIComponent(asset.assetId)}/qr-label`);
      if (!response.data?.success) throw new Error(response.data?.message || 'Could not create the item label.');
      setSelected(asset);
    } catch (requestError) { setError(requestError.response?.data?.message || requestError.message || 'Could not create the item label.'); }
    finally { setCreatingLabel(false); }
  };

  return <Layout><main className="asset-ops-page">
    <header className="asset-ops-hero qr-hero"><span className="asset-ops-hero-icon"><QrCode size={23} weight="duotone" /></span><div><span className="asset-ops-eyebrow">SCAN TO TRACE</span><h1>QR labels</h1><p>Each label opens the signed-in asset workspace directly to the item record and its history.</p></div><div className="asset-ops-hero-stat"><b>{assets.length.toLocaleString('en-IN')}</b><span>Items in your scope</span></div></header>
    <div className="asset-ops-toolbar"><label className="asset-ops-search"><MagnifyingGlass size={18} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search ID, item, category, branch" /></label><span><Barcode size={17} /> Private portal link inside every label</span></div>
    {error && <div className="asset-ops-message error" role="alert"><WarningCircle size={18} />{error}<button onClick={() => void load()}>Retry</button></div>}
    {loading ? <div className="asset-ops-loading"><CircleNotch className="ph-spin" size={24} /> Loading items…</div> : <section className="asset-qr-grid">{filtered.map(asset => <article className="asset-qr-row" key={asset.assetId}><span className="asset-qr-row-icon"><QrCode size={20} /></span><div><b>{asset.name || 'Unnamed asset'}</b><small>{asset.assetId} · {asset.branch || 'No branch'} · {asset.location || 'No room'}</small></div><span className={`asset-ops-status ${String(asset.status || 'available').toLowerCase()}`}>{String(asset.status || 'AVAILABLE').replaceAll('_', ' ')}</span><button className="asset-qr-open" disabled={creatingLabel} onClick={() => void createLabel(asset)}>{creatingLabel ? 'Preparing…' : 'Create label'}</button></article>)}{!filtered.length && <div className="asset-ops-empty"><QrCode size={24} /><b>No assets found</b><span>Try another asset name, ID, or branch.</span></div>}</section>}
    {selected && <div className="asset-ops-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setSelected(null); }}><section className="asset-ops-qr-modal" role="dialog" aria-modal="true" aria-label={`QR label for ${selected.assetId}`}><button className="asset-ops-modal-close" aria-label="Close QR label" onClick={() => setSelected(null)}><X size={19} /></button><span className="asset-ops-eyebrow">IPCS ASSET IDENTIFICATION</span><h2>{selected.name}</h2><p>{selected.assetId}</p><img src={qrImage(selected.assetId)} alt={`QR label for ${selected.assetId}`} /><small>{selected.branch} · {selected.location || 'Unassigned space'}</small><button className="asset-ops-primary" onClick={() => window.print()}><Printer size={17} /> Print label</button></section></div>}
  </main></Layout>;
}
