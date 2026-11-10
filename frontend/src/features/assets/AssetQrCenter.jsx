import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Barcode, Camera, CircleNotch, MagnifyingGlass, QrCode, WarningCircle } from '@phosphor-icons/react';
import Layout from '../../layouts/Layout';
import { API_BASE } from '../../services/apiConfig';
import AssetQrLabelModal from './AssetQrLabelModal';
import AssetQrScanner from './AssetQrScanner';
import './AssetOperationsCenter.css';

const text = value => String(value || '').trim().toLowerCase();

export default function AssetQrCenter() {
  const navigate = useNavigate();
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [creatingId, setCreatingId] = useState('');
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
    setCreatingId(asset.assetId); setError('');
    try {
      const response = await axios.post(`${API_BASE}/api/v1/assets/${encodeURIComponent(asset.assetId)}/qr-label`);
      if (!response.data?.success) throw new Error(response.data?.message || 'Could not create the item label.');
      setSelected(asset);
    } catch (requestError) { setError(requestError.response?.data?.message || requestError.message || 'Could not create the item label.'); }
    finally { setCreatingId(''); }
  };
  const openScannedAsset = useCallback(assetId => {
    setScanning(false);
    navigate(`/assets/item/${encodeURIComponent(assetId)}`);
  }, [navigate]);

  return <Layout><main className="asset-ops-page">
    <header className="asset-ops-hero qr-hero"><span className="asset-ops-hero-icon"><QrCode size={23} weight="duotone" /></span><div><span className="asset-ops-eyebrow">SCAN TO TRACE</span><h1>QR labels</h1><p>Every asset record, including quantity groups, can have a size-ready label that opens its secure item record.</p></div><div className="asset-ops-hero-stat"><b>{assets.length.toLocaleString('en-IN')}</b><span>Asset records</span></div></header>
    <div className="asset-ops-toolbar"><label className="asset-ops-search"><MagnifyingGlass size={18} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search ID, item, category, branch" /></label><button className="asset-qr-scan-button" type="button" onClick={() => setScanning(true)}><Camera size={17} /> Scan a label</button><span><Barcode size={17} /> Item pages require authorized portal access</span></div>
    {error && <div className="asset-ops-message error" role="alert"><WarningCircle size={18} />{error}<button onClick={() => void load()}>Retry</button></div>}
    {loading ? <div className="asset-ops-loading"><CircleNotch className="ph-spin" size={24} /> Loading items…</div> : <section className="asset-qr-grid">{filtered.map(asset => {
      const isGroup = String(asset.trackingMode || 'INDIVIDUAL').toUpperCase() === 'QUANTITY';
      return <article className="asset-qr-row" key={asset.assetId}><span className="asset-qr-row-icon"><QrCode size={20} /></span><div><b>{asset.name || 'Unnamed asset'}</b><small>{asset.assetId} · {asset.branch || 'No branch'} · {asset.location || 'No room'}{isGroup ? ` · ${asset.quantity || 1} units` : ''}</small></div><span className={`asset-ops-status ${String(asset.status || 'available').toLowerCase()}`}>{String(asset.status || 'AVAILABLE').replaceAll('_', ' ')}</span><button className="asset-qr-open" disabled={Boolean(creatingId)} onClick={() => void createLabel(asset)}>{creatingId === asset.assetId ? 'Preparing…' : 'Create label'}</button></article>;
    })}{!filtered.length && <div className="asset-ops-empty"><QrCode size={24} /><b>No assets found</b><span>Try another asset name, ID, or branch.</span></div>}</section>}
    {selected && <AssetQrLabelModal asset={selected} onClose={() => setSelected(null)} />}
    {scanning && <AssetQrScanner onClose={() => setScanning(false)} onScan={openScannedAsset} />}
  </main></Layout>;
}
