import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { ArrowDown, CircleNotch, Printer, QrCode, X } from '@phosphor-icons/react';
import { API_BASE } from '../../services/apiConfig';
import { QR_LABEL_SIZES } from './assetQrLabelSizes';
import './AssetQrLabelModal.css';

const cleanFileName = value => String(value || 'asset').replace(/[^a-z0-9_-]/gi, '_');

export default function AssetQrLabelModal({ asset, onClose }) {
  const [sizeCm, setSizeCm] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageBlob, setImageBlob] = useState(null);
  const [busyFormat, setBusyFormat] = useState('');
  const [error, setError] = useState('');
  const size = useMemo(() => QR_LABEL_SIZES.find(item => item.value === sizeCm) || null, [sizeCm]);

  useEffect(() => {
    const controller = new AbortController();
    let objectUrl = '';
    setImageUrl(''); setImageBlob(null); setError('');
    if (!sizeCm) return undefined;
    axios.get(`${API_BASE}/api/v1/assets/${encodeURIComponent(asset.assetId)}/qr-image`, {
      params: { sizeCm, format: 'svg', origin: window.location.origin },
      responseType: 'blob', signal: controller.signal
    }).then(response => {
      objectUrl = URL.createObjectURL(response.data);
      setImageBlob(response.data); setImageUrl(objectUrl);
    }).catch(requestError => {
      if (requestError.code === 'ERR_CANCELED') return;
      setError(requestError.response?.data?.message || 'Could not prepare this QR image. Check your access and try again.');
    });
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [asset.assetId, sizeCm]);

  const download = async format => {
    setBusyFormat(format); setError('');
    try {
      const blob = format === 'svg' && imageBlob ? imageBlob : (await axios.get(`${API_BASE}/api/v1/assets/${encodeURIComponent(asset.assetId)}/qr-image`, {
        params: { sizeCm, format, origin: window.location.origin }, responseType: 'blob'
      })).data;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url; anchor.download = `${cleanFileName(asset.assetId)}-QR-${sizeCm}cm.${format}`;
      document.body.appendChild(anchor); anchor.click(); anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (requestError) {
      setError(requestError.response?.data?.message || `Could not download the ${format.toUpperCase()} QR image.`);
    } finally { setBusyFormat(''); }
  };

  return <div className="asset-qr-label-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="asset-qr-label-dialog" role="dialog" aria-modal="true" aria-label={`QR label for ${asset.assetId}`}>
      <header className="asset-qr-label-header"><span className="asset-qr-label-icon"><QrCode size={22} /></span><div><span>ASSET IDENTIFICATION</span><h2>Prepare QR label</h2><p>{asset.name || 'Unnamed asset'} · {asset.assetId}</p></div><button type="button" aria-label="Close" onClick={onClose}><X size={19} /></button></header>
      <div className="asset-qr-label-content">
        <div className="asset-qr-label-preview-area">
          <div className="asset-qr-print-card" style={{ '--qr-size-cm': `${sizeCm || '2.5'}cm` }}>
            {imageUrl ? <img src={imageUrl} alt={`QR label for ${asset.assetId}`} /> : <span className="asset-qr-label-placeholder">{sizeCm ? <><CircleNotch className="ph-spin" size={24} /> Preparing QR…</> : 'Choose a size to prepare your QR'}</span>}
            <div><b>{asset.name || 'Asset'}</b><span>{asset.assetId}</span></div>
          </div>
          <small className="asset-qr-branch-caption">{asset.branch || 'No branch'} · {asset.location || 'Unassigned space'}</small>
        </div>
        <div className="asset-qr-label-options">
          <label htmlFor="asset-qr-size">Label size</label>
          <select id="asset-qr-size" value={sizeCm} onChange={event => setSizeCm(event.target.value)}><option value="">Choose the label size…</option>{QR_LABEL_SIZES.map(option => <option key={option.value} value={option.value}>{option.title} · {option.range}</option>)}</select>
          <div className="asset-qr-size-note"><b>{size ? `${size.range} scanning distance` : 'Select a label size to continue'}</b><span>{size ? `${size.context}. Print at 100% scale for the selected physical size.` : 'The size you choose will be used for printing and for the downloaded image.'}</span></div>
          {asset.trackingMode === 'QUANTITY' && <div className="asset-qr-size-note group"><b>Quantity group · {asset.quantity || 1} units</b><span>This code opens the group record. Create individual records when each physical unit needs its own history.</span></div>}
          <div className="asset-qr-label-actions"><button type="button" disabled={!imageUrl} onClick={() => window.print()}><Printer size={17} /> Print label</button><button type="button" disabled={!sizeCm || Boolean(busyFormat)} onClick={() => void download('svg')}>{busyFormat === 'svg' ? <CircleNotch size={17} className="ph-spin" /> : <ArrowDown size={17} />} Download SVG</button><button type="button" disabled={!sizeCm || Boolean(busyFormat)} onClick={() => void download('png')}>{busyFormat === 'png' ? <CircleNotch size={17} className="ph-spin" /> : <ArrowDown size={17} />} Download PNG</button></div>
          {error && <p className="asset-qr-label-error" role="alert">{error}</p>}
          <small className="asset-qr-print-tip">Choose printer paper large enough for the label. A4 is suitable for 12 cm; use A3 for 25 cm. Keep scaling at 100%.</small>
        </div>
      </div>
    </section>
  </div>;
}
