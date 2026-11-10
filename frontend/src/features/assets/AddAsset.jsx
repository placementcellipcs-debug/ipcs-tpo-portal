import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import {
  Barcode, CheckCircle, CircleNotch, Cube, Image as ImageIcon, MapPinLine,
  Package, Plus, ShieldCheck, Trash, UploadSimple, WarningCircle
} from '@phosphor-icons/react';
import Layout from '../../layouts/Layout';
import DateInput from '../../components/DateInput';
import { API_BASE } from '../../services/apiConfig';
import AssetCategoryFields from './AssetCategoryFields';
import { Link, useSearchParams } from 'react-router-dom';

const emptyAsset = branch => ({
  name: '', category: '', categoryId: '', subcategory: '', subcategoryId: '', assetType: '', assetTypeId: '', branch: branch || '', location: '',
  condition: 'NEW', brand: '', model: '', purchaseDate: '', purchaseCost: '',
  vendor: '', invoice: '', warrantyEnd: '', trackingMode: 'INDIVIDUAL', quantity: '1'
});
const text = value => String(value || '').trim();

export default function AddAsset() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [recordType, setRecordType] = useState(() => searchParams.get('type') === 'consumable' ? 'CONSUMABLE' : 'ASSET');
  let tpoData = {};
  try { tpoData = JSON.parse(localStorage.getItem('tpoData') || '{}'); } catch { /* The session guard handles invalid user data. */ }

  const [loading, setLoading] = useState(true);
  const [formLoadError, setFormLoadError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState(null);
  const [dbData, setDbData] = useState({ branches: [], categories: [], subcategories: [], assetTypes: [], locations: [], vendors: [] });
  const [asset, setAsset] = useState(() => emptyAsset(tpoData.sittingBranch));
  const [customFields, setCustomFields] = useState([]);
  const [showSpecifications, setShowSpecifications] = useState(false);
  const [assetPhoto, setAssetPhoto] = useState(null);
  const [assetPhotoPreview, setAssetPhotoPreview] = useState('');
  const previewRef = useRef('');
  const [customLocation, setCustomLocation] = useState('');
  const [customLocationArea, setCustomLocationArea] = useState('Lab');
  const [stock, setStock] = useState({ name: '', category: '', categoryId: '', subcategory: '', subcategoryId: '', assetType: '', assetTypeId: '', branch: tpoData.sittingBranch || '', quantity: '0', minQuantity: '5' });

  useEffect(() => {
    const nextType = searchParams.get('type') === 'consumable' ? 'CONSUMABLE' : 'ASSET';
    setRecordType(nextType);
  }, [searchParams]);

  const loadFormData = useCallback(async () => {
    setLoading(true);
    setFormLoadError('');
    try {
      const response = await axios.get(`${API_BASE}/api/v1/assets/form-data`, { timeout: 15000 });
      if (!response.data?.success) throw new Error(response.data?.message || 'Asset setup data could not be loaded.');
      setDbData({
        branches: Array.isArray(response.data.branches) ? response.data.branches : [],
        categories: Array.isArray(response.data.categories) ? response.data.categories : [],
        subcategories: Array.isArray(response.data.subcategories) ? response.data.subcategories : [],
        assetTypes: Array.isArray(response.data.assetTypes) ? response.data.assetTypes : [],
        locations: Array.isArray(response.data.locations) ? response.data.locations : [],
        vendors: Array.isArray(response.data.vendors) ? response.data.vendors : []
      });
    } catch (error) {
      setFormLoadError(error.response?.data?.message || error.message || 'Asset setup data could not be loaded.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void loadFormData(); }, [loadFormData]);
  useEffect(() => () => { if (previewRef.current) URL.revokeObjectURL(previewRef.current); }, []);

  const locationOptions = useMemo(() => {
    const branch = text(asset.branch).toLowerCase().replace(/\bbranch\b/g, '').trim();
    const values = dbData.locations.filter(item => {
      const itemBranch = text(item.branch || item.branchname).toLowerCase().replace(/\bbranch\b/g, '').trim();
      return !itemBranch || !branch || itemBranch === branch;
    }).map(item => item.locationname || item.name || item.location).filter(Boolean);
    return [...new Set(values.map(text))].sort((a, b) => a.localeCompare(b));
  }, [asset.branch, dbData.locations]);

  const setField = (key, value) => setAsset(current => ({ ...current, [key]: value }));
  const setPhoto = file => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    const preview = file ? URL.createObjectURL(file) : '';
    previewRef.current = preview;
    setAssetPhoto(file);
    setAssetPhotoPreview(preview);
  };
  const setTrackingMode = mode => {
    setAsset(current => ({ ...current, trackingMode: mode, quantity: mode === 'INDIVIDUAL' ? '1' : (current.quantity === '1' ? '2' : current.quantity) }));
    if (mode === 'QUANTITY') { setShowSpecifications(false); setCustomFields([]); }
  };
  const setCustomField = (index, key, value) => setCustomFields(current => current.map((field, fieldIndex) => fieldIndex === index ? { ...field, [key]: value } : field));

  const handleSubmit = async event => {
    event.preventDefault();
    if (isSubmitting) return;
    if (recordType === 'CONSUMABLE') {
      const quantity = Number(stock.quantity);
      const minimumQuantity = Number(stock.minQuantity);
      if (!Number.isSafeInteger(quantity) || quantity < 0 || !Number.isSafeInteger(minimumQuantity) || minimumQuantity < 0) {
        setNotification({ type: 'error', text: 'Enter whole-number stock and alert quantities of 0 or more.' });
        return;
      }
      setIsSubmitting(true);
      setNotification(null);
      try {
        const response = await axios.post(`${API_BASE}/api/v1/assets/inventory/add`, { item: { ...stock, quantity, minQuantity: minimumQuantity }, userName: tpoData.name || '' }, { timeout: 30000 });
        if (!response.data?.success) throw new Error(response.data?.message || 'The stock record was not saved.');
        setNotification({ type: 'success', text: response.data.message || 'Consumable stock registered.' });
        setStock({ name: '', category: '', categoryId: '', subcategory: '', subcategoryId: '', assetType: '', assetTypeId: '', branch: tpoData.sittingBranch || '', quantity: '0', minQuantity: '5' });
      } catch (error) {
        setNotification({ type: 'error', text: error.response?.data?.message || error.message || 'Failed to register stock.' });
      } finally {
        setIsSubmitting(false);
        window.setTimeout(() => setNotification(null), 6000);
      }
      return;
    }
    const quantity = Number(asset.quantity);
    if (asset.trackingMode === 'QUANTITY' && (!Number.isSafeInteger(quantity) || quantity < 1)) {
      setNotification({ type: 'error', text: 'Enter a whole-number quantity of at least 1.' });
      return;
    }
    const locationRoom = asset.location === '__other__' ? text(customLocation) : '';
    const finalLocation = asset.location === '__other__' ? `${locationRoom} (${customLocationArea})` : text(asset.location);
    if (!finalLocation) {
      setNotification({ type: 'error', text: 'Choose or enter the physical location.' });
      return;
    }
    if (asset.location === '__other__' && !locationRoom) {
      setNotification({ type: 'error', text: 'Enter the new room or space name.' });
      return;
    }

    setIsSubmitting(true);
    setNotification(null);
    try {
      const formData = new FormData();
      formData.append('asset', JSON.stringify({
        ...asset,
        location: finalLocation,
        createLocation: asset.location === '__other__',
        locationRoom,
        locationArea: customLocationArea,
        quantity: asset.trackingMode === 'INDIVIDUAL' ? 1 : quantity
      }));
      formData.append('customFields', JSON.stringify(asset.trackingMode === 'INDIVIDUAL' ? customFields.filter(field => text(field.name) && text(field.value)) : []));
      formData.append('userName', tpoData.name || '');
      formData.append('userEmail', tpoData.email || '');
      if (assetPhoto) formData.append('photo', assetPhoto);
      const response = await axios.post(`${API_BASE}/api/v1/assets/add`, formData, { timeout: 60000 });
      if (!response.data?.success) throw new Error(response.data?.message || 'The server did not confirm that the asset was saved.');
      setNotification({
        type: response.data.warning ? 'warning' : 'success',
        text: response.data.warning || `${asset.trackingMode === 'QUANTITY' ? `${quantity} units recorded` : 'Item registered'} · ${response.data.assetId}${response.data.locationCreated ? ` · ${finalLocation} added to this branch’s location list` : ''}`
      });
      if (response.data.locationName) {
        setDbData(current => ({
          ...current,
          locations: current.locations.some(item => text(item.locationname || item.name || item.location) === response.data.locationName
            && text(item.branch || item.branchname).toLowerCase() === text(asset.branch).toLowerCase())
            ? current.locations
            : [...current.locations, { branch: asset.branch, locationname: response.data.locationName, status: 'ACTIVE' }]
        }));
      }
      setAsset(emptyAsset(tpoData.sittingBranch));
      setCustomLocation('');
      setCustomLocationArea('Lab');
      setCustomFields([]);
      setShowSpecifications(false);
      setPhoto(null);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      const savedLocation = error.response?.data?.locationName;
      if (savedLocation) {
        setDbData(current => ({
          ...current,
          locations: current.locations.some(item => text(item.locationname || item.name || item.location) === savedLocation
            && text(item.branch || item.branchname).toLowerCase() === text(asset.branch).toLowerCase())
            ? current.locations
            : [...current.locations, { branch: asset.branch, locationname: savedLocation, status: 'ACTIVE' }]
        }));
      }
      setNotification({ type: 'error', text: error.response?.data?.message || error.message || 'Failed to register asset.' });
    } finally {
      setIsSubmitting(false);
      window.setTimeout(() => setNotification(null), 6000);
    }
  };

  const isQuantity = asset.trackingMode === 'QUANTITY';

  return <Layout>
    <main className="asset-register-page">
      {notification && <div className={`asset-register-toast ${notification.type}`} role={notification.type === 'error' ? 'alert' : 'status'}>
        {notification.type === 'success' ? <CheckCircle size={20} weight="fill" /> : <WarningCircle size={20} weight="fill" />}{notification.text}
        <button type="button" onClick={() => setNotification(null)} aria-label="Dismiss notification">×</button>
      </div>}

      <header className="asset-register-hero">
        <div><span className="asset-register-eyebrow">IPCS ASSET OPERATIONS · ONE REGISTER</span><h1>Register an item</h1><p>Use one place for tracked equipment and counted consumable stock.</p></div>
        <Link to="/assets/register" className="asset-register-link">Open asset register <span aria-hidden="true">↗</span></Link>
      </header>

      {loading ? <div className="asset-register-state"><CircleNotch size={28} className="ph-spin" /> Loading branch and category choices…</div>
        : formLoadError ? <div className="asset-register-state error" role="alert"><WarningCircle size={24} /><span>{formLoadError}</span><button type="button" onClick={() => void loadFormData()}>Retry</button></div>
          : <form className="asset-register-form" onSubmit={handleSubmit}>
            <section className="asset-register-card asset-track-card">
              <div className="asset-card-heading"><div><span>RECORD TYPE</span><h2>What are you adding?</h2><p>Equipment can be tracked one by one or as a group. Consumables are tracked by quantity.</p></div><Package size={24} /></div>
              <div className="asset-tracking-choice" role="group" aria-label="Choose what to register">
                <button type="button" className={recordType === 'ASSET' ? 'selected' : ''} onClick={() => { setRecordType('ASSET'); setSearchParams({}); }}><span className="asset-choice-icon"><Cube size={22} weight="duotone" /></span><span><b>Equipment / asset</b><small>Furniture, devices, and reusable equipment.</small></span><i>{recordType === 'ASSET' ? 'Selected' : 'Tracked items'}</i></button>
                <button type="button" className={`quantity${recordType === 'CONSUMABLE' ? ' selected' : ''}`} onClick={() => { setRecordType('CONSUMABLE'); setSearchParams({ type: 'consumable' }); }}><span className="asset-choice-icon"><Package size={22} weight="duotone" /></span><span><b>Consumable stock</b><small>Paper, stationery, cables, and other counted stock.</small></span><i>{recordType === 'CONSUMABLE' ? 'Selected' : 'Quantity only'}</i></button>
              </div>
            </section>
            {recordType === 'CONSUMABLE' ? <>
              <section className="asset-register-card">
                <div className="asset-card-heading"><div><span>01 · STOCK DETAILS</span><h2>Describe the stock</h2><p>One row represents one stock type in one branch.</p></div><Link to="/assets/categories">Manage categories ↗</Link></div>
                <AssetCategoryFields type="CONSUMABLE" category={stock.category} subcategory={stock.subcategory} assetType={stock.assetType} subcategoryRequired categories={dbData.categories} subcategories={dbData.subcategories} assetTypes={dbData.assetTypes} dataReady={!loading}
                  onCategoryChange={(value, record) => setStock(current => ({ ...current, category: value, categoryId: record?.categoryid || record?.category_id || '', subcategory: '', subcategoryId: '', assetType: '', assetTypeId: '' }))}
                  onSubcategoryChange={(value, record) => setStock(current => ({ ...current, subcategory: value, subcategoryId: record?.subcategoryid || record?.subcategory_id || '' }))}
                  onAssetTypeChange={(value, record) => setStock(current => ({ ...current, assetType: value, assetTypeId: record?.assettypeid || record?.asset_type_id || '' }))} />
                <div className="asset-register-grid asset-register-grid-main">
                  <label><span className="asset-register-label">Stock item name *</span><input value={stock.name} onChange={event => setStock(current => ({ ...current, name: event.target.value }))} placeholder="e.g. A4 paper ream" required /></label>
                  <label><span className="asset-register-label">Branch *</span><select value={stock.branch} onChange={event => setStock(current => ({ ...current, branch: event.target.value }))} required><option value="">Select branch</option>{dbData.branches.map(branch => <option key={branch} value={branch}>{branch}</option>)}</select></label>
                  <label><span className="asset-register-label">Initial quantity *</span><input type="number" min="0" step="1" value={stock.quantity} onChange={event => setStock(current => ({ ...current, quantity: event.target.value }))} required /></label>
                  <label><span className="asset-register-label">Low stock alert at *</span><input type="number" min="0" step="1" value={stock.minQuantity} onChange={event => setStock(current => ({ ...current, minQuantity: event.target.value }))} required /></label>
                </div>
              </section>
              <footer className="asset-register-submit"><span>Stock changes are logged as inventory transactions.</span><button type="submit" disabled={isSubmitting}>{isSubmitting ? <><CircleNotch size={19} className="ph-spin" /> Saving stock…</> : <><CheckCircle size={19} /> Register stock</>}</button></footer>
            </> : <>
            <section className="asset-register-card asset-track-card">
              <div className="asset-card-heading"><div><span>01 · TRACKING STYLE</span><h2>How should these assets be counted?</h2><p>This controls how the record behaves after it is saved.</p></div><Barcode size={24} /></div>
              <div className="asset-tracking-choice" role="radiogroup" aria-label="Asset tracking style">
                <button type="button" role="radio" aria-checked={!isQuantity} className={!isQuantity ? 'selected' : ''} onClick={() => setTrackingMode('INDIVIDUAL')}>
                  <span className="asset-choice-icon"><Cube size={22} weight="duotone" /></span><span><b>Track each item</b><small>Use when pieces have their own identity, such as laptops, projectors, or cameras.</small></span><i>{!isQuantity ? 'Selected' : 'One ID per item'}</i>
                </button>
                <button type="button" role="radio" aria-checked={isQuantity} className={isQuantity ? 'selected quantity' : 'quantity'} onClick={() => setTrackingMode('QUANTITY')}>
                  <span className="asset-choice-icon"><Package size={22} weight="duotone" /></span><span><b>Track a quantity group</b><small>Use for identical items managed together, such as 20 chairs or 12 keyboards.</small></span><i>{isQuantity ? 'Selected' : 'One record + count'}</i>
                </button>
              </div>
              <div className={`asset-count-explainer ${isQuantity ? 'active' : ''}`}><b>{isQuantity ? 'One group record with one QR label' : 'One record for each physical item'}</b><span>{isQuantity ? 'The asset register will show one group ID and its unit count. The QR code opens this group record; use individual records when every physical unit needs a separate history.' : 'Each item receives its own asset ID and can be assigned, returned, serviced, and labeled separately.'}</span></div>
            </section>

            <section className="asset-register-card">
              <div className="asset-card-heading"><div><span>02 · ITEM DETAILS</span><h2>What are you registering?</h2></div><Link to="/assets/categories">Manage categories ↗</Link></div>
              <AssetCategoryFields type="ASSET" category={asset.category} subcategory={asset.subcategory} assetType={asset.assetType} subcategoryRequired categories={dbData.categories} subcategories={dbData.subcategories} assetTypes={dbData.assetTypes} dataReady={!loading}
                onCategoryChange={(value, record) => setAsset(current => ({ ...current, category: value, categoryId: record?.categoryid || record?.category_id || '', subcategory: '', subcategoryId: '', assetType: '', assetTypeId: '' }))}
                onSubcategoryChange={(value, record) => { setAsset(current => ({ ...current, subcategory: value, subcategoryId: record?.subcategoryid || record?.subcategory_id || '' })); setCustomFields([]); }}
                onAssetTypeChange={(value, record) => setAsset(current => ({ ...current, assetType: value, assetTypeId: record?.assettypeid || record?.asset_type_id || '' }))} />
              <div className="asset-register-grid asset-register-grid-main">
                <label><span className="asset-register-label">Asset name *</span><input value={asset.name} onChange={event => setField('name', event.target.value)} placeholder="e.g. Training room keyboard" required /></label>
                {isQuantity && <label><span className="asset-register-label">Number of units *</span><input type="number" min="1" step="1" inputMode="numeric" value={asset.quantity} onChange={event => setField('quantity', event.target.value)} required /><small>Count the identical units in this group.</small></label>}
                <label><span className="asset-register-label">Brand <em>Optional</em></span><input value={asset.brand} onChange={event => setField('brand', event.target.value)} placeholder="e.g. Logitech" /></label>
                <label><span className="asset-register-label">Model <em>Optional</em></span><input value={asset.model} onChange={event => setField('model', event.target.value)} placeholder="Model or variant" /></label>
              </div>
              {!isQuantity && <div className="asset-spec-toggle"><button type="button" onClick={() => setShowSpecifications(value => !value)}><ShieldCheck size={17} /> {showSpecifications ? 'Hide item-specific details' : 'Add item-specific details'} <span>{showSpecifications ? '−' : '+'}</span></button><small>Serial number, IMEI, MAC address, or another identifier.</small></div>}
              {!isQuantity && showSpecifications && <div className="asset-spec-fields">
                {customFields.map((field, index) => <div className="asset-spec-row" key={index}><input aria-label="Specification name" value={field.name} onChange={event => setCustomField(index, 'name', event.target.value)} placeholder="e.g. Serial number" /><input aria-label="Specification value" value={field.value} onChange={event => setCustomField(index, 'value', event.target.value)} placeholder="Enter value" /><button type="button" aria-label="Remove specification" onClick={() => setCustomFields(current => current.filter((_, itemIndex) => itemIndex !== index))}><Trash size={17} /></button></div>)}
                <button type="button" className="asset-spec-add" onClick={() => setCustomFields(current => [...current, { name: '', value: '' }])}><Plus size={16} /> Add a detail</button>
              </div>}
            </section>

            <section className="asset-register-card">
              <div className="asset-card-heading"><div><span>03 · BRANCH & LOCATION</span><h2>Where are they kept?</h2></div><MapPinLine size={24} /></div>
              <div className="asset-register-grid asset-register-grid-place">
                <label><span className="asset-register-label">Branch *</span><select value={asset.branch} onChange={event => { setField('branch', event.target.value); setField('location', ''); setCustomLocation(''); }} required><option value="">Select branch</option>{dbData.branches.map(branch => <option key={branch} value={branch}>{branch}</option>)}</select></label>
                <label><span className="asset-register-label">Physical location *</span><select value={asset.location} onChange={event => { setField('location', event.target.value); setCustomLocation(''); }} required><option value="">Select a room or area</option>{locationOptions.map(location => <option value={location} key={location}>{location}</option>)}<option value="__other__">Add a new room or space</option></select>{asset.location === '__other__' && <><input className="asset-other-location" value={customLocation} onChange={event => setCustomLocation(event.target.value)} placeholder="New room or space name" aria-label="New room or space name" required /><select className="asset-other-location" value={customLocationArea} onChange={event => setCustomLocationArea(event.target.value)} aria-label="New location type"><option value="Lab">Student lab</option><option value="Office">Staff office</option><option value="Storage">Storage / store room</option><option value="Other">Other space</option></select><small>This location will be saved to this branch’s suggestions when you register the item.</small></>}</label>
                <label><span className="asset-register-label">Condition</span><select value={asset.condition} onChange={event => setField('condition', event.target.value)}><option value="NEW">New</option><option value="EXCELLENT">Excellent</option><option value="GOOD">Good</option><option value="FAIR">Fair</option></select></label>
              </div>
            </section>

            <details className="asset-register-card asset-optional-card"><summary><span><b>Optional purchase and photo details</b><small>Expand only when you have these details available.</small></span><i>+</i></summary>
              <div className="asset-register-grid asset-register-grid-purchase">
                <label><span className="asset-register-label">Purchase date</span><DateInput value={asset.purchaseDate} onChange={event => setField('purchaseDate', event.target.value)} /></label>
                <label><span className="asset-register-label">Purchase cost (₹)</span><input type="number" min="0" step="0.01" value={asset.purchaseCost} onChange={event => setField('purchaseCost', event.target.value)} placeholder="0.00" /></label>
                <label><span className="asset-register-label">Vendor / supplier</span><input list="asset-vendor-options" value={asset.vendor} onChange={event => setField('vendor', event.target.value)} placeholder="Vendor name" /><datalist id="asset-vendor-options">{dbData.vendors.map((vendor, index) => <option key={`${vendor.vendorid || vendor.vendorname}-${index}`} value={vendor.vendorname || vendor.name || ''} />)}</datalist></label>
                <label><span className="asset-register-label">Invoice number</span><input value={asset.invoice} onChange={event => setField('invoice', event.target.value)} placeholder="Invoice reference" /></label>
                <label><span className="asset-register-label">Warranty end date</span><DateInput value={asset.warrantyEnd} onChange={event => setField('warrantyEnd', event.target.value)} /></label>
              </div>
              <div className="asset-register-photo"><div><ImageIcon size={20} /><span><b>Condition photo</b><small>Optional · attach a photo of the item or group.</small></span></div><label>{assetPhoto ? <CheckCircle size={17} /> : <UploadSimple size={17} />}{assetPhoto ? 'Change photo' : 'Add photo'}<input type="file" accept="image/*" capture="environment" onChange={event => setPhoto(event.target.files?.[0] || null)} /></label>{assetPhotoPreview && <img src={assetPhotoPreview} alt="Asset condition preview" />}</div>
            </details>

            <footer className="asset-register-submit"><span>One registration flow for tracked equipment and quantity based stock.</span><button type="submit" disabled={isSubmitting}>{isSubmitting ? <><CircleNotch size={19} className="ph-spin" /> Saving record…</> : <><CheckCircle size={19} /> {isQuantity ? 'Save quantity group' : 'Register item'}</>}</button></footer>
            </>}
          </form>}
    </main>
    <style>{`
      .asset-register-page{--reg-ink:#edf5fb;--reg-muted:#8ca2b7;--reg-line:rgba(148,177,201,.16);max-width:1040px;margin:0 auto;padding:34px 26px 72px;color:var(--reg-ink)}
      .asset-register-hero{display:flex;align-items:flex-end;justify-content:space-between;gap:22px;margin-bottom:24px;padding:25px 28px;border:1px solid rgba(70,208,183,.22);border-radius:22px;background:radial-gradient(ellipse at 90% 0%,rgba(88,89,202,.2),transparent 45%),linear-gradient(125deg,rgba(9,37,48,.92),rgba(17,24,43,.96) 62%,rgba(19,26,49,.96));box-shadow:0 20px 50px rgba(0,0,0,.16)}
      .asset-register-eyebrow,.asset-card-heading>div>span{color:#60dfc7;font-size:.69rem;letter-spacing:.13em;font-weight:850}.asset-register-hero h1{margin:8px 0 7px;font-size:clamp(1.9rem,4vw,2.55rem);letter-spacing:-.045em}.asset-register-hero p,.asset-card-heading p{margin:0;color:var(--reg-muted);line-height:1.55}.asset-register-link{white-space:nowrap;color:#9cebdc;text-decoration:none;border:1px solid rgba(89,221,197,.25);background:rgba(45,212,191,.08);padding:11px 14px;border-radius:12px;font-weight:750;font-size:.82rem}
      .asset-register-form{display:grid;gap:15px}.asset-register-card{min-width:0;padding:22px 24px;border-radius:19px;border:1px solid var(--reg-line);background:linear-gradient(140deg,rgba(20,30,47,.97),rgba(14,20,35,.97));box-shadow:0 12px 36px rgba(0,0,0,.13)}
      .asset-card-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:18px;color:#67dcca}.asset-card-heading h2{margin:5px 0 5px;color:#f1f6fb;font-size:1.17rem;letter-spacing:-.025em}.asset-card-heading p{font-size:.84rem}.asset-card-heading>a{color:#a4b4ff;text-decoration:none;font-size:.77rem;font-weight:750;padding-top:4px}
      .asset-tracking-choice{display:grid;grid-template-columns:1fr 1fr;gap:12px}.asset-tracking-choice>button{display:grid;grid-template-columns:42px 1fr auto;align-items:center;gap:12px;min-width:0;text-align:left;padding:15px;border:1px solid rgba(148,177,201,.17);border-radius:15px;background:rgba(6,13,24,.46);color:var(--reg-ink);cursor:pointer;transition:border-color .18s,background .18s,transform .18s}.asset-tracking-choice>button:hover{transform:translateY(-1px);border-color:rgba(80,221,195,.4)}.asset-tracking-choice>button.selected{border-color:#3fd4b4;background:linear-gradient(125deg,rgba(17,96,86,.3),rgba(17,35,52,.76));box-shadow:inset 0 0 0 1px rgba(63,212,180,.1)}.asset-tracking-choice>button.selected.quantity{border-color:#9c91ff;background:linear-gradient(125deg,rgba(89,68,163,.3),rgba(17,35,52,.76))}.asset-choice-icon{width:40px;height:40px;display:grid;place-items:center;border-radius:12px;background:rgba(79,219,192,.1);color:#6be2ca}.quantity .asset-choice-icon{background:rgba(157,140,255,.12);color:#b4a9ff}.asset-tracking-choice b,.asset-tracking-choice small{display:block}.asset-tracking-choice b{font-size:.9rem}.asset-tracking-choice small{margin-top:5px;color:#95a9bd;font-size:.73rem;line-height:1.45}.asset-tracking-choice i{font-style:normal;color:#a9b9cb;font-size:.66rem;white-space:nowrap}.asset-count-explainer{display:flex;gap:8px;flex-wrap:wrap;margin-top:13px;padding:11px 13px;border-radius:11px;background:rgba(77,148,190,.07);color:#9cb0c3;font-size:.74rem}.asset-count-explainer b{color:#d5e4ee}.asset-count-explainer.active{background:rgba(139,120,255,.1)}
      .asset-register-page .asset-category-fields,.asset-register-page [class*=category-fields]{margin-bottom:18px}.asset-register-grid{display:grid;gap:14px}.asset-register-grid-main{grid-template-columns:repeat(2,minmax(0,1fr))}.asset-register-grid-place{grid-template-columns:1fr 1fr .7fr}.asset-register-grid-purchase{grid-template-columns:repeat(3,minmax(0,1fr));margin-top:20px}.asset-register-grid label{display:block;min-width:0}.asset-register-label{display:block;margin-bottom:7px;color:#9db0c3;font-size:.69rem;letter-spacing:.055em;text-transform:uppercase;font-weight:800}.asset-register-label em{font-style:normal;color:#71879a;font-size:.63rem;letter-spacing:0;text-transform:none}.asset-register-grid input,.asset-register-grid select,.asset-spec-row input,.asset-other-location{width:100%;min-width:0;min-height:43px;box-sizing:border-box;padding:10px 12px;border:1px solid rgba(149,178,199,.19);border-radius:10px;background:#0b1321;color:#eff6fb;font:inherit;font-size:.84rem;outline:none}.asset-register-grid input:focus,.asset-register-grid select:focus,.asset-spec-row input:focus,.asset-other-location:focus{border-color:#44cfb4;box-shadow:0 0 0 3px rgba(68,207,180,.1)}.asset-register-grid select option{background:#101a2a;color:#f4f7fa}.asset-register-grid small{display:block;margin-top:5px;color:#8095aa;font-size:.7rem}.asset-other-location{margin-top:8px}
      .asset-spec-toggle{display:flex;align-items:center;flex-wrap:wrap;gap:10px;margin-top:14px}.asset-spec-toggle button,.asset-spec-add{display:inline-flex;align-items:center;gap:7px;border:0;background:transparent;color:#74dfc9;font:inherit;font-size:.77rem;font-weight:750;cursor:pointer}.asset-spec-toggle button span{font-size:1.1rem}.asset-spec-toggle small{color:#8195a9;font-size:.7rem}.asset-spec-fields{display:grid;gap:9px;margin-top:12px}.asset-spec-row{display:grid;grid-template-columns:1fr 1.2fr 40px;gap:8px}.asset-spec-row button{display:grid;place-items:center;border:1px solid rgba(248,113,113,.22);border-radius:10px;background:rgba(127,29,29,.14);color:#ff9b9b;cursor:pointer}.asset-spec-add{justify-self:start;padding:7px 0}
      .asset-optional-card{padding:0 22px}.asset-optional-card summary{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:17px 0;list-style:none;cursor:pointer}.asset-optional-card summary::-webkit-details-marker{display:none}.asset-optional-card summary b,.asset-optional-card summary small{display:block}.asset-optional-card summary b{font-size:.85rem}.asset-optional-card summary small{margin-top:4px;color:#8195a9;font-size:.72rem}.asset-optional-card summary i{font-style:normal;color:#6de0c8;font-size:1.4rem}.asset-optional-card[open] summary{border-bottom:1px solid var(--reg-line)}.asset-register-photo{display:flex;align-items:center;gap:13px;flex-wrap:wrap;margin:17px 0 20px;padding:12px 13px;border:1px dashed rgba(90,167,222,.32);border-radius:12px;background:rgba(49,109,157,.07)}.asset-register-photo>div{display:flex;align-items:center;gap:9px;margin-right:auto;color:#79bdf0}.asset-register-photo b,.asset-register-photo small{display:block}.asset-register-photo b{color:#d9e9f6;font-size:.77rem}.asset-register-photo small{margin-top:3px;color:#859bb0;font-size:.68rem}.asset-register-photo label{display:inline-flex;align-items:center;gap:7px;padding:8px 10px;border:1px solid rgba(90,167,222,.35);border-radius:9px;color:#b8ddf5;font-size:.73rem;font-weight:750;cursor:pointer}.asset-register-photo input{position:absolute;width:1px;height:1px;opacity:0}.asset-register-photo img{width:48px;height:48px;border-radius:9px;object-fit:cover}
      .asset-register-submit{display:flex;justify-content:space-between;align-items:center;gap:16px;padding:5px 2px}.asset-register-submit>span{color:#8095a9;font-size:.72rem;line-height:1.45}.asset-register-submit button,.asset-register-state button{display:inline-flex;align-items:center;justify-content:center;gap:9px;min-height:46px;padding:0 20px;border:1px solid rgba(74,226,197,.35);border-radius:12px;background:linear-gradient(110deg,#0f9e92,#246fd1);color:white;font:inherit;font-size:.84rem;font-weight:800;cursor:pointer;box-shadow:0 10px 25px rgba(18,130,142,.2)}.asset-register-submit button:disabled{opacity:.58;cursor:wait}.asset-register-state{display:flex;align-items:center;justify-content:center;gap:12px;min-height:190px;border:1px dashed var(--reg-line);border-radius:18px;background:rgba(16,24,39,.8);color:#9cb0c3}.asset-register-state.error{flex-wrap:wrap;padding:25px;color:#ffc080}.asset-register-toast{position:fixed;z-index:2000;right:24px;bottom:24px;display:flex;align-items:center;gap:10px;max-width:min(520px,calc(100vw - 36px));padding:13px 15px;border:1px solid rgba(255,255,255,.13);border-radius:13px;background:#132035;color:#e9f6f3;box-shadow:0 18px 45px rgba(0,0,0,.35);font-size:.82rem;font-weight:700}.asset-register-toast.success{border-color:rgba(64,218,176,.4)}.asset-register-toast.warning{border-color:rgba(255,190,74,.4)}.asset-register-toast.error{border-color:rgba(255,109,109,.4);color:#ffc4c4}.asset-register-toast button{margin-left:8px;border:0;background:none;color:inherit;font-size:1.2rem;cursor:pointer}
      @media(max-width:760px){.asset-register-page{padding:20px 14px 52px}.asset-register-hero{align-items:flex-start;flex-direction:column;padding:20px}.asset-tracking-choice{grid-template-columns:1fr}.asset-register-grid-place,.asset-register-grid-purchase{grid-template-columns:repeat(2,minmax(0,1fr))}.asset-register-card{padding:18px}.asset-optional-card{padding:0 18px}.asset-register-submit{align-items:stretch;flex-direction:column}.asset-register-submit button{width:100%}}
      @media(max-width:480px){.asset-register-grid-main,.asset-register-grid-place,.asset-register-grid-purchase{grid-template-columns:1fr}.asset-tracking-choice>button{grid-template-columns:38px 1fr}.asset-tracking-choice>button i{grid-column:2}.asset-spec-row{grid-template-columns:1fr 40px}.asset-spec-row input:nth-child(2){grid-column:1}.asset-spec-row button{grid-column:2;grid-row:1/3}}
    `}</style>
  </Layout>;
}
