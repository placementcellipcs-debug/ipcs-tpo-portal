import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Plus, Tag, X } from '@phosphor-icons/react';
import { API_BASE } from '../../services/apiConfig';

const categoryName = category => category.categoryname || category.category_name || category.name || '';
const categoryId = category => category.categoryid || category.category_id || '';
const subcategoryName = subcategory => subcategory.name || subcategory.subcategoryname || subcategory.subcategory_name || '';
const subcategoryParentId = subcategory => subcategory.categoryid || subcategory.category_id || '';
const subcategoryParentName = subcategory => subcategory.categoryname || subcategory.category_name || '';
const normalize = value => String(value || '').trim().toLowerCase();

export default function AssetCategoryFields({ type = 'ASSET', category, subcategory, subcategoryRequired = false, categories: initialCategories = [], subcategories: initialSubcategories = [], dataReady = false, onCategoryChange, onSubcategoryChange }) {
  const [categories, setCategories] = useState(initialCategories);
  const [subcategories, setSubcategories] = useState(initialSubcategories);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState('');
  const [categoryDraft, setCategoryDraft] = useState('');
  const [subcategoryDraft, setSubcategoryDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    setCategories(Array.isArray(initialCategories) ? initialCategories : []);
    setSubcategories(Array.isArray(initialSubcategories) ? initialSubcategories : []);
    if (dataReady) setLoading(false);
  }, [initialCategories, initialSubcategories, dataReady]);

  const visibleCategories = useMemo(() => categories.filter(item => {
    const itemType = String(item.type || item.categorytype || 'ASSET').trim().toUpperCase();
    return type === 'CONSUMABLE' ? itemType.includes('CONSUM') || itemType.includes('STOCK') : !itemType.includes('CONSUM') && !itemType.includes('STOCK');
  }), [categories, type]);
  const selectedCategory = visibleCategories.find(item => normalize(categoryName(item)) === normalize(category));
  const visibleSubcategories = subcategories.filter(item => {
    if (!selectedCategory) return false;
    const parentId = subcategoryParentId(item);
    const parentName = subcategoryParentName(item);
    return (parentId && categoryId(selectedCategory) && parentId === categoryId(selectedCategory))
      || normalize(parentName) === normalize(categoryName(selectedCategory));
  });

  const submitClassification = async event => {
    event.preventDefault();
    const name = (modal === 'category' ? categoryDraft : subcategoryDraft).trim();
    if (!name) return;
    setSaving(true);
    try {
      if (modal === 'category') {
        const duplicate = visibleCategories.some(item => normalize(categoryName(item)) === normalize(name));
        if (duplicate) throw new Error('That category already exists.');
        const response = await axios.post(`${API_BASE}/api/v1/assets/config/category`, { categoryName: name, type });
        const createdCategory = response.data?.category || { categoryid: `LOCAL-${Date.now()}`, categoryname: name, type };
        setCategories(current => [...current, createdCategory]);
        onCategoryChange(name);
        onSubcategoryChange('');
        setCategoryDraft('');
        setNotice({ kind: 'success', text: `${name} added. It is ready to use.` });
      } else {
        if (!selectedCategory) throw new Error('Choose a parent category first.');
        const duplicate = visibleSubcategories.some(item => normalize(subcategoryName(item)) === normalize(name));
        if (duplicate) throw new Error('That subcategory already exists in this category.');
        const response = await axios.post(`${API_BASE}/api/v1/assets/config/subcategory`, { categoryId: categoryId(selectedCategory), subcategoryName: name });
        const createdSubcategory = response.data?.subcategory || { categoryid: categoryId(selectedCategory), categoryname: categoryName(selectedCategory), name };
        setSubcategories(current => [...current, createdSubcategory]);
        onSubcategoryChange(name);
        setSubcategoryDraft('');
        setNotice({ kind: 'success', text: `${name} added under ${categoryName(selectedCategory)}.` });
      }
      setModal('');
      window.setTimeout(() => setNotice(null), 4000);
    } catch (error) {
      setNotice({ kind: 'error', text: error.response?.data?.message || error.message || 'Could not save this classification.' });
    } finally {
      setSaving(false);
    }
  };

  return <>
    <div className="asset-classification-grid">
      <div>
        <label className="data-label">{type === 'CONSUMABLE' ? 'Stock category *' : 'Asset category *'}</label>
        <select className="premium-select" style={{ width: '100%' }} value={category || ''} onChange={event => { onCategoryChange(event.target.value); onSubcategoryChange(''); }} required disabled={loading}>
          <option value="">{loading ? 'Loading categories…' : 'Select category'}</option>
          {visibleCategories.map((item, index) => <option key={categoryId(item) || `${categoryName(item)}-${index}`} value={categoryName(item)}>{categoryName(item)}</option>)}
        </select>
        <button type="button" className="asset-classification-add" onClick={() => { setModal('category'); setNotice(null); }}><Plus size={14} weight="bold" /> Add category</button>
      </div>
      <div>
        <label className="data-label">Subcategory{subcategoryRequired ? ' *' : ''}</label>
        <select className="premium-select" style={{ width: '100%' }} value={subcategory || ''} onChange={event => onSubcategoryChange(event.target.value)} disabled={!selectedCategory} required={subcategoryRequired}>
          <option value="">{selectedCategory ? `Select subcategory${subcategoryRequired ? '' : ' (optional)'}` : 'Choose a category first'}</option>
          {visibleSubcategories.map((item, index) => <option key={`${subcategoryName(item)}-${index}`} value={subcategoryName(item)}>{subcategoryName(item)}</option>)}
        </select>
        <button type="button" className="asset-classification-add" onClick={() => { setModal('subcategory'); setNotice(null); }} disabled={!selectedCategory}><Plus size={14} weight="bold" /> Add subcategory</button>
      </div>
    </div>
    {notice && <div className={`asset-classification-notice ${notice.kind}`} role={notice.kind === 'error' ? 'alert' : 'status'}>{notice.text}</div>}
    {modal && <div className="asset-classification-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !saving) setModal(''); }}>
      <section className="asset-classification-modal" role="dialog" aria-modal="true" aria-labelledby="asset-classification-title">
        <header><span className="asset-classification-modal-icon"><Tag size={18} /></span><div><small>ASSET CLASSIFICATION</small><h2 id="asset-classification-title">{modal === 'category' ? 'Add a category' : 'Add a subcategory'}</h2></div><button type="button" aria-label="Close" onClick={() => !saving && setModal('')}><X size={18} /></button></header>
        <form onSubmit={submitClassification}>
          {modal === 'category' ? <label>Category name<input autoFocus value={categoryDraft} onChange={event => setCategoryDraft(event.target.value)} placeholder={type === 'CONSUMABLE' ? 'e.g. Stationery' : 'e.g. Training equipment'} required /></label>
            : <><div className="asset-classification-parent"><small>Parent category</small><strong>{categoryName(selectedCategory)}</strong></div><label>Subcategory name<input autoFocus value={subcategoryDraft} onChange={event => setSubcategoryDraft(event.target.value)} placeholder={type === 'CONSUMABLE' ? 'e.g. Whiteboard markers' : 'e.g. Projector'} required /></label></>}
          {notice?.kind === 'error' && <p className="asset-classification-modal-error" role="alert">{notice.text}</p>}
          <footer><button type="button" onClick={() => !saving && setModal('')}>Cancel</button><button type="submit" disabled={saving}>{saving ? 'Saving…' : modal === 'category' ? 'Save category' : 'Save subcategory'}</button></footer>
        </form>
      </section>
    </div>}
    <style>{`
      .asset-classification-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px;margin-bottom:20px}
      .asset-classification-add{display:inline-flex;align-items:center;gap:5px;margin-top:8px;padding:5px 0;border:0;background:transparent;color:#73d9cf;font:inherit;font-size:.72rem;font-weight:750;cursor:pointer}
      .asset-classification-add:hover{color:#a7f3e8}.asset-classification-add:disabled{opacity:.45;cursor:not-allowed}
      .asset-classification-notice{margin:-5px 0 16px;padding:9px 12px;border:1px solid rgba(45,212,191,.22);border-radius:10px;background:rgba(45,212,191,.07);color:#a7f3e8;font-size:.75rem}.asset-classification-notice.error{border-color:rgba(248,113,113,.25);background:rgba(248,113,113,.07);color:#fecaca}
      .asset-classification-backdrop{position:fixed;inset:0;z-index:1000000;display:grid;place-items:center;padding:18px;background:rgba(2,6,17,.78);backdrop-filter:blur(9px)}
      .asset-classification-modal{width:min(100%,460px);overflow:hidden;border:1px solid rgba(125,211,252,.19);border-radius:20px;background:linear-gradient(145deg,#111b2d,#0b1220);box-shadow:0 30px 90px rgba(0,0,0,.6);color:#e6edf7}
      .asset-classification-modal>header{display:flex;align-items:center;gap:12px;padding:20px 21px;border-bottom:1px solid rgba(255,255,255,.07)}.asset-classification-modal-icon{width:38px;height:38px;display:grid;place-items:center;border:1px solid rgba(45,212,191,.2);border-radius:12px;background:rgba(45,212,191,.08);color:#7ee7d4}.asset-classification-modal header div{flex:1}.asset-classification-modal header small{color:#7c94af;font-size:.58rem;font-weight:850;letter-spacing:.12em}.asset-classification-modal header h2{margin:3px 0 0;color:#f1f5fb;font-size:1.08rem}.asset-classification-modal header>button{width:33px;height:33px;display:grid;place-items:center;border:1px solid rgba(255,255,255,.09);border-radius:10px;background:rgba(255,255,255,.04);color:#9eacc0;cursor:pointer}
      .asset-classification-modal form{display:grid;gap:16px;padding:21px}.asset-classification-modal form>label{display:grid;gap:7px;color:#a8b5c8;font-size:.72rem;font-weight:750}.asset-classification-modal input{width:100%;box-sizing:border-box;padding:12px 13px;border:1px solid rgba(148,163,184,.2);border-radius:11px;outline:none;background:#0b1220;color:#edf4fb;font:inherit;font-size:.85rem}.asset-classification-modal input:focus{border-color:#55d9ca;box-shadow:0 0 0 3px rgba(45,212,191,.1)}.asset-classification-parent{display:grid;gap:5px;padding:12px 13px;border:1px solid rgba(148,163,184,.12);border-radius:11px;background:rgba(148,163,184,.045)}.asset-classification-parent small{color:#8291a7;font-size:.62rem}.asset-classification-parent strong{color:#dce8f4;font-size:.82rem}.asset-classification-modal-error{margin:0;color:#fca5a5;font-size:.75rem}.asset-classification-modal footer{display:flex;justify-content:flex-end;gap:8px;padding-top:3px}.asset-classification-modal footer button{padding:10px 14px;border:1px solid rgba(255,255,255,.1);border-radius:10px;background:rgba(255,255,255,.04);color:#bcc9d9;font:inherit;font-size:.75rem;font-weight:750;cursor:pointer}.asset-classification-modal footer button[type=submit]{border-color:transparent;background:linear-gradient(110deg,#41cfbf,#51a7da);color:#06131d}.asset-classification-modal footer button:disabled{opacity:.55;cursor:wait}
      @media(max-width:620px){.asset-classification-grid{grid-template-columns:1fr;gap:12px}}
    `}</style>
  </>;
}
