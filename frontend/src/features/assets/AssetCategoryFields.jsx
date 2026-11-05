import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { Plus, Tag, X } from '@phosphor-icons/react';
import { API_BASE } from '../../services/apiConfig';

const clean = value => String(value || '').trim();
const normalize = value => clean(value).toLowerCase().replace(/[^a-z0-9]/g, '');
const categoryName = item => item?.categoryname || item?.category_name || item?.name || item?.category || '';
const categoryId = item => item?.categoryid || item?.category_id || '';
const subcategoryName = item => item?.name || item?.subcategoryname || item?.subcategory_name || item?.subcategory || '';
const subcategoryId = item => item?.subcategoryid || item?.subcategory_id || '';
const parentId = item => item?.categoryid || item?.category_id || item?.parentcategoryid || item?.parentid || '';
const parentName = item => item?.categoryname || item?.category_name || item?.parentcategory || item?.category || '';
const itemTypeName = item => item?.name || item?.assettypename || item?.asset_type_name || item?.assettype || '';
const itemTypeId = item => item?.assettypeid || item?.asset_type_id || '';
const typeValue = item => clean(item?.type || item?.categorytype || item?.category_type).toUpperCase();
const isConsumable = item => typeValue(item).includes('CONSUM') || typeValue(item).includes('STOCK');

export default function AssetCategoryFields({
  type = 'ASSET', category, subcategory, assetType, subcategoryRequired = false,
  categories: initialCategories = [], subcategories: initialSubcategories = [], assetTypes: initialAssetTypes = [],
  dataReady = false, onCategoryChange, onSubcategoryChange, onAssetTypeChange
}) {
  const [categories, setCategories] = useState(initialCategories);
  const [subcategories, setSubcategories] = useState(initialSubcategories);
  const [assetTypes, setAssetTypes] = useState(initialAssetTypes);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState('');
  const [draft, setDraft] = useState({ name: '', categoryId: '', subcategoryId: '' });
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    setCategories(Array.isArray(initialCategories) ? initialCategories : []);
    setSubcategories(Array.isArray(initialSubcategories) ? initialSubcategories : []);
    setAssetTypes(Array.isArray(initialAssetTypes) ? initialAssetTypes : []);
    if (dataReady) setLoading(false);
  }, [initialCategories, initialSubcategories, initialAssetTypes, dataReady]);

  useEffect(() => {
    if (!modal) return undefined;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = event => { if (event.key === 'Escape' && !saving) setModal(''); };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', closeOnEscape);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener('keydown', closeOnEscape); };
  }, [modal, saving]);

  const visibleCategories = useMemo(() => {
    const unique = new Map();
    categories.forEach(item => {
      const rawType = typeValue(item);
      const inScope = !rawType || rawType.includes('GENERAL') || (type === 'CONSUMABLE' ? isConsumable(item) : !isConsumable(item));
      const name = clean(categoryName(item));
      if (!inScope || !name) return;
      const key = normalize(name);
      if (!unique.has(key)) unique.set(key, item);
    });
    return [...unique.values()].sort((a, b) => categoryName(a).localeCompare(categoryName(b)));
  }, [categories, type]);

  const selectedCategory = visibleCategories.find(item => normalize(categoryName(item)) === normalize(category));
  const visibleSubcategories = useMemo(() => {
    if (!selectedCategory) return [];
    const unique = new Map();
    subcategories.forEach(item => {
      const belongs = (parentId(item) && categoryId(selectedCategory) && normalize(parentId(item)) === normalize(categoryId(selectedCategory)))
        || normalize(parentName(item)) === normalize(categoryName(selectedCategory));
      const rawType = typeValue(item);
      const inScope = !rawType || (type === 'CONSUMABLE' ? isConsumable(item) : !isConsumable(item));
      const name = clean(subcategoryName(item));
      if (!belongs || !inScope || !name || unique.has(normalize(name))) return;
      unique.set(normalize(name), item);
    });
    return [...unique.values()].sort((a, b) => subcategoryName(a).localeCompare(subcategoryName(b)));
  }, [subcategories, selectedCategory, type]);

  const selectedSubcategory = visibleSubcategories.find(item => normalize(subcategoryName(item)) === normalize(subcategory));
  const visibleAssetTypes = useMemo(() => {
    if (!selectedCategory || !selectedSubcategory) return [];
    const unique = new Map();
    assetTypes.forEach(item => {
      const sameSubcategory = (subcategoryId(item) && subcategoryId(selectedSubcategory) && normalize(subcategoryId(item)) === normalize(subcategoryId(selectedSubcategory)))
        || (normalize(item.subcategoryname || item.subcategory_name) === normalize(subcategoryName(selectedSubcategory))
          && normalize(item.categoryid || item.category_id) === normalize(categoryId(selectedCategory)));
      const inScope = !typeValue(item) || (type === 'CONSUMABLE' ? isConsumable(item) : !isConsumable(item));
      const name = clean(itemTypeName(item));
      if (!sameSubcategory || !inScope || !name || unique.has(normalize(name))) return;
      unique.set(normalize(name), item);
    });
    return [...unique.values()].sort((a, b) => itemTypeName(a).localeCompare(itemTypeName(b)));
  }, [assetTypes, selectedCategory, selectedSubcategory, type]);

  const siblingSubcategories = subcategories.filter(item => normalize(parentId(item)) === normalize(draft.categoryId)
    || normalize(parentName(item)) === normalize(categoryName(visibleCategories.find(entry => normalize(categoryId(entry)) === normalize(draft.categoryId)))));

  const openModal = modalType => {
    setDraft({ name: '', categoryId: modalType === 'category' ? '' : categoryId(selectedCategory), subcategoryId: modalType === 'assetType' ? subcategoryId(selectedSubcategory) : '' });
    setNotice(null);
    setModal(modalType);
  };

  const submitClassification = async event => {
    event.preventDefault();
    event.stopPropagation();
    const name = clean(draft.name);
    if (!name || saving) return;
    setSaving(true);
    setNotice(null);
    try {
      if (modal === 'category') {
        if (visibleCategories.some(item => normalize(categoryName(item)) === normalize(name))) throw new Error('That category already exists.');
        const response = await axios.post(`${API_BASE}/api/v1/assets/config/category`, { categoryName: name, type }, { timeout: 30000 });
        if (!response.data?.success) throw new Error(response.data?.message || 'Category was not saved.');
        const created = response.data.category || { categoryid: `LOCAL-${Date.now()}`, categoryname: name, type };
        setCategories(current => [...current, created]);
        onCategoryChange(name, created);
        onSubcategoryChange('', null);
        onAssetTypeChange('', null);
      } else if (modal === 'subcategory') {
        const parent = visibleCategories.find(item => normalize(categoryId(item)) === normalize(draft.categoryId));
        if (!parent) throw new Error('Choose a parent category first.');
        if (siblingSubcategories.some(item => normalize(subcategoryName(item)) === normalize(name))) throw new Error('That subcategory already exists under this category.');
        const response = await axios.post(`${API_BASE}/api/v1/assets/config/subcategory`, {
          categoryId: categoryId(parent), subcategoryName: name, type
        }, { timeout: 30000 });
        if (!response.data?.success) throw new Error(response.data?.message || 'Subcategory was not saved.');
        const created = response.data.subcategory || { categoryid: categoryId(parent), categoryname: categoryName(parent), subcategoryid: `LOCAL-${Date.now()}`, name, type };
        setSubcategories(current => [...current, created]);
        onCategoryChange(categoryName(parent), parent);
        onSubcategoryChange(name, created);
        onAssetTypeChange('', null);
      } else {
        const subcategoryParent = subcategories.find(item => normalize(subcategoryId(item)) === normalize(draft.subcategoryId));
        const parent = visibleCategories.find(item => normalize(categoryId(item)) === normalize(draft.categoryId));
        if (!parent || !subcategoryParent) throw new Error('Choose a category and subcategory first.');
        const duplicate = assetTypes.some(item => normalize(subcategoryId(item)) === normalize(draft.subcategoryId) && normalize(itemTypeName(item)) === normalize(name));
        if (duplicate) throw new Error('That item type already exists under this subcategory.');
        const response = await axios.post(`${API_BASE}/api/v1/assets/config/asset-type`, {
          categoryId: categoryId(parent), subcategoryId: subcategoryId(subcategoryParent), assetTypeName: name, type
        }, { timeout: 30000 });
        if (!response.data?.success) throw new Error(response.data?.message || 'Asset type was not saved.');
        const created = response.data.assetType || { assettypeid: `LOCAL-${Date.now()}`, categoryid: categoryId(parent), categoryname: categoryName(parent), subcategoryid: subcategoryId(subcategoryParent), subcategoryname: subcategoryName(subcategoryParent), name, type };
        setAssetTypes(current => [...current, created]);
        onAssetTypeChange(name, created);
      }
      setModal('');
      setNotice({ kind: 'success', text: `${name} was saved to the classification library.` });
      window.setTimeout(() => setNotice(null), 4000);
    } catch (error) {
      setNotice({ kind: 'error', text: error.response?.data?.message || error.message || 'Could not save this classification.' });
    } finally { setSaving(false); }
  };

  return <>
    <div className="asset-classification-grid">
      <div>
        <label className="data-label">{type === 'CONSUMABLE' ? 'Stock category *' : 'Main category *'}</label>
        <select className="premium-select" style={{ width: '100%' }} value={category || ''} onChange={event => {
          const selected = visibleCategories.find(item => categoryName(item) === event.target.value);
          onCategoryChange(event.target.value, selected); onSubcategoryChange('', null); onAssetTypeChange('', null);
        }} required disabled={loading}>
          <option value="">{loading ? 'Loading categories…' : 'Select main category'}</option>
          {visibleCategories.map((item, index) => <option key={categoryId(item) || `${categoryName(item)}-${index}`} value={categoryName(item)}>{categoryName(item)}</option>)}
        </select>
        <button type="button" className="asset-classification-add" onClick={() => openModal('category')}><Plus size={14} weight="bold" /> Add category</button>
      </div>
      <div>
        <label className="data-label">Subcategory *</label>
        <select className="premium-select" style={{ width: '100%' }} value={subcategory || ''} onChange={event => {
          const selected = visibleSubcategories.find(item => subcategoryName(item) === event.target.value);
          onSubcategoryChange(event.target.value, selected); onAssetTypeChange('', null);
        }} disabled={!selectedCategory} required={subcategoryRequired}>
          <option value="">{selectedCategory ? 'Select subcategory' : 'Choose a main category first'}</option>
          {visibleSubcategories.map((item, index) => <option key={subcategoryId(item) || `${subcategoryName(item)}-${index}`} value={subcategoryName(item)}>{subcategoryName(item)}</option>)}
        </select>
        <button type="button" className="asset-classification-add" onClick={() => openModal('subcategory')} disabled={!selectedCategory}><Plus size={14} weight="bold" /> Add subcategory</button>
      </div>
      <div>
        <label className="data-label">Item / asset type *</label>
        <select className="premium-select" style={{ width: '100%' }} value={assetType || ''} onChange={event => {
          const selected = visibleAssetTypes.find(item => itemTypeName(item) === event.target.value);
          onAssetTypeChange(event.target.value, selected);
        }} disabled={!selectedSubcategory} required>
          <option value="">{selectedSubcategory ? 'Choose the item type' : 'Choose a subcategory first'}</option>
          {visibleAssetTypes.map((item, index) => <option key={itemTypeId(item) || `${itemTypeName(item)}-${index}`} value={itemTypeName(item)}>{itemTypeName(item)}</option>)}
        </select>
        <button type="button" className="asset-classification-add" onClick={() => openModal('assetType')} disabled={!selectedSubcategory}><Plus size={14} weight="bold" /> Add item type</button>
      </div>
    </div>
    {notice && !modal && <div className={`asset-classification-notice ${notice.kind}`} role={notice.kind === 'error' ? 'alert' : 'status'}>{notice.text}</div>}
    {modal && createPortal(<div className="asset-classification-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !saving) setModal(''); }}>
      <section className="asset-classification-modal" role="dialog" aria-modal="true" aria-labelledby="asset-classification-title">
        <header><span className="asset-classification-modal-icon"><Tag size={18} /></span><div><small>ASSET CLASSIFICATION</small><h2 id="asset-classification-title">{modal === 'category' ? 'Add a main category' : modal === 'subcategory' ? 'Add a subcategory' : 'Add an item type'}</h2></div><button type="button" aria-label="Close" onClick={() => !saving && setModal('')}><X size={18} /></button></header>
        <form onSubmit={submitClassification}>
          {modal === 'category' ? <label>Category name<input autoFocus value={draft.name} onChange={event => setDraft(current => ({ ...current, name: event.target.value }))} placeholder="e.g. Training equipment" maxLength={100} required /></label>
            : modal === 'subcategory' ? <>
              <label>Main category<select autoFocus value={draft.categoryId} onChange={event => setDraft(current => ({ ...current, categoryId: event.target.value }))} required><option value="">Choose a main category</option>{visibleCategories.map((item, index) => <option key={categoryId(item) || index} value={categoryId(item)}>{categoryName(item)}</option>)}</select></label>
              <label>Subcategory name<input value={draft.name} onChange={event => setDraft(current => ({ ...current, name: event.target.value }))} placeholder="e.g. Laptop computers" maxLength={100} required /></label>
            </> : <>
              <label>Main category<select value={draft.categoryId} onChange={event => setDraft(current => ({ ...current, categoryId: event.target.value, subcategoryId: '' }))} required><option value="">Choose a main category</option>{visibleCategories.map((item, index) => <option key={categoryId(item) || index} value={categoryId(item)}>{categoryName(item)}</option>)}</select></label>
              <label>Subcategory<select autoFocus value={draft.subcategoryId} onChange={event => setDraft(current => ({ ...current, subcategoryId: event.target.value }))} required><option value="">Choose a subcategory</option>{siblingSubcategories.map((item, index) => <option key={subcategoryId(item) || index} value={subcategoryId(item)}>{subcategoryName(item)}</option>)}</select></label>
              <label>Item / asset type<input value={draft.name} onChange={event => setDraft(current => ({ ...current, name: event.target.value }))} placeholder="e.g. PLC trainer kit" maxLength={100} required /></label>
            </>}
          {notice?.kind === 'error' && <p className="asset-classification-modal-error" role="alert">{notice.text}</p>}
          <footer><button type="button" onClick={() => !saving && setModal('')}>Cancel</button><button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save classification'}</button></footer>
        </form>
      </section>
    </div>, document.body)}
    <style>{`
      .asset-classification-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin-bottom:20px}
      .asset-classification-add{display:inline-flex;align-items:center;gap:5px;margin-top:8px;padding:5px 0;border:0;background:transparent;color:#73d9cf;font:inherit;font-size:.72rem;font-weight:750;cursor:pointer}
      .asset-classification-add:hover{color:#a7f3e8}.asset-classification-add:disabled{opacity:.45;cursor:not-allowed}
      .asset-classification-notice{margin:-5px 0 16px;padding:9px 12px;border:1px solid rgba(45,212,191,.22);border-radius:10px;background:rgba(45,212,191,.07);color:#a7f3e8;font-size:.75rem}.asset-classification-notice.error{border-color:rgba(248,113,113,.25);background:rgba(248,113,113,.07);color:#fecaca}
      .asset-classification-backdrop{position:fixed;inset:0;z-index:1000000;display:grid;place-items:center;padding:18px;background:rgba(2,6,17,.78);backdrop-filter:blur(9px)}
      .asset-classification-modal{width:min(100%,460px);max-height:min(88vh,700px);overflow:auto;border:1px solid rgba(125,211,252,.19);border-radius:20px;background:linear-gradient(145deg,#111b2d,#0b1220);box-shadow:0 30px 90px rgba(0,0,0,.6);color:#e6edf7}
      .asset-classification-modal>header{display:flex;align-items:center;gap:12px;padding:20px 21px;border-bottom:1px solid rgba(255,255,255,.07)}.asset-classification-modal-icon{width:38px;height:38px;display:grid;place-items:center;border:1px solid rgba(45,212,191,.2);border-radius:12px;background:rgba(45,212,191,.08);color:#7ee7d4}.asset-classification-modal header div{flex:1}.asset-classification-modal header small{color:#7c94af;font-size:.58rem;font-weight:850;letter-spacing:.12em}.asset-classification-modal header h2{margin:3px 0 0;color:#f1f5fb;font-size:1.08rem}.asset-classification-modal header>button{width:33px;height:33px;display:grid;place-items:center;border:1px solid rgba(255,255,255,.09);border-radius:10px;background:rgba(255,255,255,.04);color:#9eacc0;cursor:pointer}
      .asset-classification-modal form{display:grid;gap:16px;padding:21px}.asset-classification-modal form>label{display:grid;gap:7px;color:#a8b5c8;font-size:.72rem;font-weight:750}.asset-classification-modal input,.asset-classification-modal select{width:100%;box-sizing:border-box;padding:12px 13px;border:1px solid rgba(148,163,184,.2);border-radius:11px;outline:none;background:#0b1220;color:#edf4fb;font:inherit;font-size:.85rem}.asset-classification-modal input:focus,.asset-classification-modal select:focus{border-color:#55d9ca;box-shadow:0 0 0 3px rgba(45,212,191,.1)}.asset-classification-modal-error{margin:0;color:#fca5a5;font-size:.75rem}.asset-classification-modal footer{display:flex;justify-content:flex-end;gap:8px;padding-top:3px}.asset-classification-modal footer button{padding:10px 14px;border:1px solid rgba(255,255,255,.1);border-radius:10px;background:rgba(255,255,255,.04);color:#bcc9d9;font:inherit;font-size:.75rem;font-weight:750;cursor:pointer}.asset-classification-modal footer button[type=submit]{border-color:transparent;background:linear-gradient(110deg,#41cfbf,#51a7da);color:#06131d}.asset-classification-modal footer button:disabled{opacity:.55;cursor:wait}
      @media(max-width:900px){.asset-classification-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media(max-width:620px){.asset-classification-grid{grid-template-columns:1fr;gap:12px}}
    `}</style>
  </>;
}
