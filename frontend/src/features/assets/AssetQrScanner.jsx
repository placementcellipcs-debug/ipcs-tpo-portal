import { useEffect, useRef, useState } from 'react';
import { Barcode, Camera, CircleNotch, Keyboard, X } from '@phosphor-icons/react';
import './AssetQrScanner.css';

function assetIdFromQr(rawValue) {
  const value = String(rawValue || '').trim();
  if (!value) return '';
  try {
    const url = new URL(value, window.location.origin);
    const match = url.pathname.match(/^\/assets\/item\/([^/]+)\/?$/);
    return match ? decodeURIComponent(match[1]).trim() : '';
  } catch { return ''; }
}

export default function AssetQrScanner({ onClose, onScan }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [status, setStatus] = useState('starting');
  const [message, setMessage] = useState('Starting your camera…');
  const [manualId, setManualId] = useState('');

  useEffect(() => {
    let active = true;
    let frameId = 0;
    const stop = () => {
      active = false;
      if (frameId) window.cancelAnimationFrame(frameId);
      streamRef.current?.getTracks().forEach(track => track.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
    };
    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus('manual'); setMessage('Camera access is unavailable here. Enter the asset ID below.'); return;
      }
      if (!('BarcodeDetector' in window)) {
        setStatus('manual'); setMessage('This browser cannot read QR codes directly. Enter the asset ID below, or open this page in an updated Chrome browser.'); return;
      }
      try {
        const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
        if (!active) { stream.getTracks().forEach(track => track.stop()); return; }
        streamRef.current = stream;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setStatus('scanning'); setMessage('Hold the code inside the camera frame.');
        const scan = async () => {
          if (!active) return;
          if (videoRef.current?.readyState >= 2) {
            try {
              const codes = await detector.detect(videoRef.current);
              const id = codes.map(code => assetIdFromQr(code.rawValue)).find(Boolean);
              if (id) { stop(); onScan(id); return; }
            } catch { /* Keep scanning while camera frames are settling. */ }
          }
          if (active) frameId = window.requestAnimationFrame(scan);
        };
        frameId = window.requestAnimationFrame(scan);
      } catch (error) {
        setStatus('manual');
        setMessage(error.name === 'NotAllowedError' ? 'Camera permission was blocked. Allow camera access or enter the asset ID below.' : 'The camera could not start. Enter the asset ID below instead.');
      }
    };
    void start();
    return stop;
  }, [onScan]);

  const submitManual = event => {
    event.preventDefault();
    const id = assetIdFromQr(manualId) || manualId.trim();
    if (id) onScan(id);
  };

  return <div className="asset-qr-scanner-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="asset-qr-scanner-dialog" role="dialog" aria-modal="true" aria-label="Scan asset QR code">
      <header><span><Barcode size={20} /> ASSET SCANNER</span><button type="button" aria-label="Close scanner" onClick={onClose}><X size={18} /></button></header>
      <div className="asset-qr-scanner-view">
        {status === 'starting' && <div className="asset-qr-camera-status"><CircleNotch size={26} className="ph-spin" />{message}</div>}
        <video ref={videoRef} className={status === 'scanning' ? 'is-scanning' : ''} muted playsInline aria-label="Camera view for scanning asset QR" />
        {status === 'scanning' && <span className="asset-qr-scan-frame" aria-hidden="true" />}
        {status === 'manual' && <div className="asset-qr-camera-status"><Camera size={25} />{message}</div>}
      </div>
      {status === 'scanning' && <p className="asset-qr-scanner-message">{message}</p>}
      <form className="asset-qr-manual-entry" onSubmit={submitManual}><label htmlFor="asset-qr-manual-id"><Keyboard size={16} /> Enter asset ID manually</label><div><input id="asset-qr-manual-id" value={manualId} onChange={event => setManualId(event.target.value)} placeholder="e.g. AST-2026-0001" /><button type="submit" disabled={!manualId.trim()}>Open item</button></div></form>
    </section>
  </div>;
}
