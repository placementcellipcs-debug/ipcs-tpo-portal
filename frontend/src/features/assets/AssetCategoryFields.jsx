import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { CaretDown, Check, MagnifyingGlass, Plus, Tag, X } from '@phosphor-icons/react';
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

function PremiumCombobox({ label, value, options, placeholder, disabled = false, required = false, onSelect }) {
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const selected = options.find(option => option.label === value);
  const displayValue = open ? query : (selected?.label || value || '');
  const matches = useMemo(() => {
    const term = query.trim().toLowerCase();
    return options.filter(option => !term || option.label.toLowerCase().includes(term)).slice(0, 80);
  }, [options, query]);

  useEffect(() => {
    if (!open) return undefined;
    const closeOutside = event => { if (!rootRef.current?.contains(event.target)) setOpen(false); };
    const closeOnEscape = event => { if (event.key === 'Escape') { setOpen(false); setQuery(''); } };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  useEffect(() => {
    inputRef.current?.setCustomValidity(required && !selected ? `Choose a ${label.toLowerCase()} from the list.` : '');
  }, [required, selected, label]);

  const openOptions = () => {
    if (disabled) return;
    setQuery('');
    setActiveIndex(0);
    setOpen(true);
  };
  const choose = option => {
    onSelect(option);
    setOpen(false);
    setQuery('');
  };
  const onKeyDown = event => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!open) openOptions();
      else setActiveIndex(index => Math.min(index + 1, Math.max(0, matches.length - 1)));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) openOptions();
      else setActiveIndex(index => Math.max(0, index - 1));
    } else if (event.key === 'Enter' && open) {
      event.preventDefault();
      if (matches[activeIndex]) choose(matches[activeIndex]);
    } else if (event.key === 'Escape' && open) {
      event.preventDefault();
      setOpen(false);
      setQuery('');
    }
  };

  return <div className={`asset-combobox${open ? ' is-open' : ''}${disabled ? ' is-disabled' : ''}`} ref={rootRef}>
    <div className="asset-combobox-control">
      <input ref={inputRef} className="asset-combobox-input" type="text" role="combobox" aria-label={label}
        aria-expanded={open} aria-haspopup="listbox" aria-autocomplete="list" aria-required={required}
        autoComplete="off" required={required} disabled={disabled} value={displayValue}
        placeholder={placeholder} onFocus={openOptions} onClick={() => open ? null : openOptions()}
        onChange={event => { setQuery(event.target.value); setActiveIndex(0); setOpen(true); }} onKeyDown={onKeyDown} />
      {open && <button type="button" className="asset-combobox-clear" aria-label="Clear search" onClick={() => { setQuery(''); setActiveIndex(0); inputRef.current?.focus(); }}><X size={15} /></button>}
      <CaretDown className="asset-combobox-chevron" size={16} weight="bold" aria-hidden="true" />
    </div>
    {open && <div className="asset-combobox-menu" role="listbox" aria-label={`${label} options`}>
      <div className="asset-combobox-menu-head"><MagnifyingGlass size={15} /><span>{query ? `${matches.length} matching` : `${options.length} available`}</span><small>Type to filter</small></div>
      <div className="asset-combobox-options">
        {matches.length ? matches.map((option, index) => <button type="button" role="option" aria-selected={option.label === value}
          className={`asset-combobox-option${index === activeIndex ? ' is-active' : ''}`} key={option.key || option.label}
          onMouseEnter={() => setActiveIndex(index)} onClick={() => choose(option)}>
          <span className="asset-combobox-option-mark">{option.label === value ? <Check size={15} weight="bold" /> : <i />}</span>
          <span className="asset-combobox-option-copy"><b>{option.label}</b>{option.meta && <small>{option.meta}</small>}</span>
        </button>) : <div className="asset-combobox-empty">No matches. Try another search.</div>}
        {options.filter(option => !query.trim() || option.label.toLowerCase().includes(query.trim().toLowerCase())).length > 80 && <div className="asset-combobox-more">Search to narrow the list · showing first 80 results</div>}
      </div>
    </div>}
  </div>;
}

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
        <PremiumCombobox label={type === 'CONSUMABLE' ? 'Stock category' : 'Main category'} value={category || ''}
          placeholder={loading ? 'Loading categories…' : 'Select main category'} disabled={loading} required
          options={visibleCategories.map((item, index) => ({ key: categoryId(item) || `${categoryName(item)}-${index}`, label: categoryName(item), meta: categoryId(item) ? `Category · ${categoryId(item)}` : 'Main category', item }))}
          onSelect={option => { onCategoryChange(option.label, option.item); onSubcategoryChange('', null); onAssetTypeChange('', null); }} />
        <button type="button" className="asset-classification-add" onClick={() => openModal('category')}><Plus size={14} weight="bold" /> Add category</button>
      </div>
      <div>
        <label className="data-label">Subcategory *</label>
        <PremiumCombobox label="Subcategory" value={subcategory || ''}
          placeholder={selectedCategory ? 'Select subcategory' : 'Choose a main category first'} disabled={!selectedCategory} required={subcategoryRequired}
          options={visibleSubcategories.map((item, index) => ({ key: subcategoryId(item) || `${subcategoryName(item)}-${index}`, label: subcategoryName(item), meta: subcategoryId(item) ? `Subcategory · ${subcategoryId(item)}` : 'Subcategory', item }))}
          onSelect={option => { onSubcategoryChange(option.label, option.item); onAssetTypeChange('', null); }} />
        <button type="button" className="asset-classification-add" onClick={() => openModal('subcategory')} disabled={!selectedCategory}><Plus size={14} weight="bold" /> Add subcategory</button>
      </div>
      <div>
        <label className="data-label">Item / asset type *</label>
        <PremiumCombobox label="Item or asset type" value={assetType || ''}
          placeholder={selectedSubcategory ? 'Choose the item type' : 'Choose a subcategory first'} disabled={!selectedSubcategory} required
          options={visibleAssetTypes.map((item, index) => ({ key: itemTypeId(item) || `${itemTypeName(item)}-${index}`, label: itemTypeName(item), meta: itemTypeId(item) ? `Item type · ${itemTypeId(item)}` : 'Item / asset type', item }))}
          onSelect={option => onAssetTypeChange(option.label, option.item)} />
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
      .asset-combobox{position:relative;z-index:1;width:100%;}.asset-combobox.is-open{z-index:80}.asset-combobox-control{position:relative;display:flex;align-items:center;min-height:46px;border:1px solid rgba(133,166,197,.22);border-radius:12px;background:linear-gradient(135deg,rgba(13,24,41,.98),rgba(17,25,46,.97));box-shadow:inset 0 1px rgba(255,255,255,.035),0 5px 14px rgba(1,7,18,.12);transition:border-color .2s ease,box-shadow .2s ease,background .2s ease,transform .2s ease}.asset-combobox-control:hover{border-color:rgba(83,218,198,.55);background:linear-gradient(135deg,rgba(15,32,49,.99),rgba(21,29,53,.98));}.asset-combobox.is-open .asset-combobox-control,.asset-combobox-control:focus-within{border-color:#52d8c3;box-shadow:0 0 0 3px rgba(82,216,195,.12),0 9px 22px rgba(2,9,23,.24)}.asset-combobox.is-disabled .asset-combobox-control{opacity:.55;cursor:not-allowed}.asset-combobox-input{width:100%;min-width:0;min-height:44px;padding:0 42px 0 14px;border:0!important;border-radius:inherit!important;outline:0!important;background:transparent!important;box-shadow:none!important;color:#eff8ff!important;font:inherit!important;font-size:.82rem!important;font-weight:700!important;letter-spacing:.005em}.asset-combobox-input::placeholder{color:#91a5bb!important;font-weight:550}.asset-combobox-clear,.asset-combobox-chevron{position:absolute;right:34px;display:grid;place-items:center;width:23px;height:23px;border:0;border-radius:7px;color:#9db1c6;background:transparent}.asset-combobox-clear{cursor:pointer}.asset-combobox-clear:hover{color:#e3f9f5;background:rgba(255,255,255,.08)}.asset-combobox-chevron{right:10px;pointer-events:none;transition:transform .2s ease,color .2s ease;color:#73ddcc}.asset-combobox.is-open .asset-combobox-chevron{transform:rotate(180deg);color:#b5fff1}.asset-combobox-menu{position:absolute;top:calc(100% + 8px);left:0;right:0;z-index:100;overflow:hidden;border:1px solid rgba(103,220,202,.32);border-radius:15px;background:linear-gradient(150deg,#132136,#101829 70%,#11172b);box-shadow:0 22px 56px rgba(0,0,0,.48),0 0 0 1px rgba(255,255,255,.035);animation:asset-menu-arrive .2s cubic-bezier(.2,.7,.25,1) both;transform-origin:top center}.asset-combobox-menu-head{min-height:37px;display:flex;align-items:center;gap:8px;padding:0 12px;border-bottom:1px solid rgba(150,180,207,.12);color:#6cdbca;font-size:.63rem;font-weight:800;letter-spacing:.045em}.asset-combobox-menu-head small{margin-left:auto;color:#7188a1;font-size:.59rem;font-weight:600;letter-spacing:0}.asset-combobox-options{max-height:255px;overflow-y:auto;padding:6px;overscroll-behavior:contain;scrollbar-width:thin;scrollbar-color:#42667b #111b2c}.asset-combobox-option{width:100%;display:flex;align-items:center;gap:10px;padding:9px 10px;border:1px solid transparent;border-radius:10px;color:#dbe8f5;background:transparent;text-align:left;cursor:pointer}.asset-combobox-option:hover,.asset-combobox-option.is-active{border-color:rgba(90,220,199,.2);background:linear-gradient(105deg,rgba(37,155,144,.19),rgba(83,104,185,.12));}.asset-combobox-option-mark{width:24px;height:24px;flex:0 0 24px;display:grid;place-items:center;border:1px solid rgba(127,157,186,.19);border-radius:8px;color:#6ee4cc;background:rgba(59,214,187,.07)}.asset-combobox-option-mark i{width:6px;height:6px;border-radius:50%;background:#72879e}.asset-combobox-option-copy{display:grid;min-width:0;gap:3px}.asset-combobox-option-copy b{overflow:hidden;color:#eaf2fc;font-size:.75rem;text-overflow:ellipsis;white-space:nowrap}.asset-combobox-option-copy small{color:#8299b2;font-size:.59rem}.asset-combobox-empty,.asset-combobox-more{padding:14px 10px;color:#93a8be;font-size:.69rem;text-align:center}.asset-combobox-more{padding:8px;border-top:1px solid rgba(148,163,184,.12);color:#6f879d;font-size:.6rem}
      @keyframes asset-menu-arrive{from{opacity:0;transform:translateY(-5px) scale(.985)}to{opacity:1;transform:translateY(0) scale(1)}}
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
