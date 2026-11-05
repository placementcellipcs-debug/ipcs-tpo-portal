import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { ArrowClockwise, CircleNotch, MagnifyingGlass, Package, Plus, Tag, X } from '@phosphor-icons/react';
import Layout from '../../layouts/Layout';
import { API_BASE } from '../../services/apiConfig';
import './AssetCategories.css';

const clean = value => String(value || '').trim();
const norm = value => clean(value).toLowerCase().replace(/[^a-z0-9]/g, '');
const categoryName = item => item.categoryname || item.category_name || item.name || item.category || '';
const categoryId = item => item.categoryid || item.category_id || '';
const childName = item => item.name || item.subcategoryname || item.subcategory_name || item.subcategory || '';
const childId = item => item.subcategoryid || item.subcategory_id || '';
const childParentId = item => item.categoryid || item.category_id || item.parentcategoryid || item.parentid || '';
const childParentName = item => item.categoryname || item.category_name || item.parentcategory || item.category || '';
const itemTypeName = item => item.name || item.assettypename || item.asset_type_name || item.assettype || '';
const itemTypeId = item => item.assettypeid || item.asset_type_id || '';
const typeOf = item => clean(item.type || item.categorytype || item.category_type).toUpperCase();
const isConsumable = item => typeOf(item).includes('CONSUM') || typeOf(item).includes('STOCK');

export default function AssetCategories() {
  const [data, setData] = useState({ categories: [], subcategories: [], assetTypes: [] });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [modal, setModal] = useState('');
  const [draft, setDraft] = useState({ name: '', categoryId: '', subcategoryId: '', type: 'ASSET' });
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);

  const loadCategories = useCallback(async () => {
    setLoading(true); setLoadError('');
    try {
      const response = await axios.get(`${API_BASE}/api/v1/assets/form-data`, { timeout: 20000 });
      if (!response.data?.success) throw new Error(response.data?.message || 'Classification data could not be loaded.');
      setData({
        categories: Array.isArray(response.data.categories) ? response.data.categories : [],
        subcategories: Array.isArray(response.data.subcategories) ? response.data.subcategories : [],
        assetTypes: Array.isArray(response.data.assetTypes) ? response.data.assetTypes : []
      });
    } catch (error) { setLoadError(error.response?.data?.message || error.message || 'Classification data could not be loaded.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void loadCategories(); }, [loadCategories]);
  useEffect(() => {
    if (!modal) return undefined;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = event => { if (event.key === 'Escape' && !saving) setModal(''); };
    document.body.style.overflow = 'hidden'; window.addEventListener('keydown', closeOnEscape);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener('keydown', closeOnEscape); };
  }, [modal, saving]);

  const uniqueCategories = useMemo(() => {
    const unique = new Map();
    data.categories.forEach(item => {
      const name = clean(categoryName(item));
      if (name && !unique.has(norm(name))) unique.set(norm(name), item);
    });
    return [...unique.values()].sort((a, b) => categoryName(a).localeCompare(categoryName(b)));
  }, [data.categories]);

  const categoryChildren = category => data.subcategories.filter(item => {
    const sameParent = (childParentId(item) && categoryId(category) && norm(childParentId(item)) === norm(categoryId(category)))
      || norm(childParentName(item)) === norm(categoryName(category));
    const scope = filter === 'ALL' || (filter === 'CONSUMABLES' ? isConsumable(item) : !isConsumable(item));
    return sameParent && scope;
  });

  const visibleCategories = useMemo(() => {
    const term = norm(search);
    return uniqueCategories.filter(category => {
      const children = categoryChildren(category);
      const matchesFilter = filter === 'ALL' || children.length > 0;
      const matchesSearch = !term || norm(categoryName(category)).includes(term) || children.some(child => {
        const types = data.assetTypes.filter(item => norm(item.subcategoryid || item.subcategory_id) === norm(childId(child))
          || (norm(item.subcategoryname || item.subcategory_name) === norm(childName(child)) && norm(item.categoryid || item.category_id) === norm(categoryId(category))));
        return norm(childName(child)).includes(term) || types.some(item => norm(itemTypeName(item)).includes(term));
      });
      return matchesFilter && (children.length || filter === 'ALL') && matchesSearch;
    });
  // categoryChildren is deliberately recalculated from the selected filter and data.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uniqueCategories, data.subcategories, data.assetTypes, filter, search]);

  const subcategoryTypeRows = (category, subcategory) => data.assetTypes.filter(item => {
    const sameSubcategory = (childId(subcategory) && norm(item.subcategoryid || item.subcategory_id) === norm(childId(subcategory)))
      || (norm(item.subcategoryname || item.subcategory_name) === norm(childName(subcategory)) && norm(item.categoryid || item.category_id) === norm(categoryId(category)));
    const scope = filter === 'ALL' || (filter === 'CONSUMABLES' ? isConsumable(item) : !isConsumable(item));
    const term = norm(search);
    return sameSubcategory && scope && (!term || norm(itemTypeName(item)).includes(term) || norm(childName(subcategory)).includes(term) || norm(categoryName(category)).includes(term));
  });

  const openModal = (type, category = null, subcategory = null) => {
    const categoryType = typeOf(category);
    const inheritedType = type === 'assetType' ? typeOf(subcategory)
      : type === 'subcategory' && categoryType !== 'GENERAL' ? categoryType
        : filter === 'CONSUMABLES' ? 'CONSUMABLE' : 'ASSET';
    setDraft({ name: '', categoryId: categoryId(category) || '', subcategoryId: childId(subcategory) || '', type: ['ASSET', 'CONSUMABLE'].includes(inheritedType) ? inheritedType : 'ASSET' });
    setNotice(null); setModal(type);
  };

  const submit = async event => {
    event.preventDefault(); event.stopPropagation();
    if (saving) return;
    const name = clean(draft.name);
    if (!name) return;
    setSaving(true); setNotice(null);
    try {
      let response;
      if (modal === 'category') {
        if (uniqueCategories.some(item => norm(categoryName(item)) === norm(name))) throw new Error('That main category already exists.');
        response = await axios.post(`${API_BASE}/api/v1/assets/config/category`, { categoryName: name, type: draft.type }, { timeout: 30000 });
        if (!response.data?.success) throw new Error(response.data?.message || 'Category was not saved.');
        const created = response.data.category || { categoryid: `LOCAL-${Date.now()}`, categoryname: name, type: draft.type };
        setData(current => ({ ...current, categories: [...current.categories, created] }));
      } else if (modal === 'subcategory') {
        const parent = uniqueCategories.find(item => norm(categoryId(item)) === norm(draft.categoryId));
        if (!parent) throw new Error('Choose a parent category.');
        const siblings = data.subcategories.filter(item => norm(childParentId(item)) === norm(categoryId(parent)) || norm(childParentName(item)) === norm(categoryName(parent)));
        if (siblings.some(item => norm(childName(item)) === norm(name))) throw new Error('That subcategory already exists under this category.');
        response = await axios.post(`${API_BASE}/api/v1/assets/config/subcategory`, { categoryId: categoryId(parent), subcategoryName: name, type: draft.type }, { timeout: 30000 });
        if (!response.data?.success) throw new Error(response.data?.message || 'Subcategory was not saved.');
        const created = response.data.subcategory || { categoryid: categoryId(parent), categoryname: categoryName(parent), subcategoryid: `LOCAL-${Date.now()}`, name, type: draft.type };
        setData(current => ({ ...current, subcategories: [...current.subcategories, created] }));
      } else {
        const subcategory = data.subcategories.find(item => norm(childId(item)) === norm(draft.subcategoryId));
        const parent = uniqueCategories.find(item => norm(categoryId(item)) === norm(draft.categoryId));
        if (!parent || !subcategory) throw new Error('Choose a category and subcategory first.');
        if (data.assetTypes.some(item => norm(item.subcategoryid || item.subcategory_id) === norm(draft.subcategoryId) && norm(itemTypeName(item)) === norm(name))) throw new Error('That item type already exists under this subcategory.');
        response = await axios.post(`${API_BASE}/api/v1/assets/config/asset-type`, { categoryId: categoryId(parent), subcategoryId: childId(subcategory), assetTypeName: name, type: draft.type }, { timeout: 30000 });
        if (!response.data?.success) throw new Error(response.data?.message || 'Item type was not saved.');
        const created = response.data.assetType || { assettypeid: `LOCAL-${Date.now()}`, categoryid: categoryId(parent), categoryname: categoryName(parent), subcategoryid: childId(subcategory), subcategoryname: childName(subcategory), name, type: draft.type };
        setData(current => ({ ...current, assetTypes: [...current.assetTypes, created] }));
      }
      setModal(''); setNotice({ type: 'success', text: `“${name}” was saved in the classification library.` });
      window.setTimeout(() => setNotice(null), 5000);
    } catch (error) { setNotice({ type: 'error', text: error.response?.data?.message || error.message || 'Could not save this classification.' }); }
    finally { setSaving(false); }
  };

  const totalVisibleSubcategories = uniqueCategories.reduce((total, category) => total + categoryChildren(category).length, 0);
  const modalView = modal && createPortal(
    <div className="asset-categories-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !saving) setModal(''); }}>
      <section className="asset-categories-modal" role="dialog" aria-modal="true" aria-labelledby="asset-categories-modal-title">
        <header><span className="asset-categories-modal-icon"><Tag size={19} /></span><div><small>ASSET CLASSIFICATION</small><h2 id="asset-categories-modal-title">{modal === 'category' ? 'Add a main category' : modal === 'subcategory' ? 'Add a subcategory' : 'Add an item type'}</h2></div><button type="button" aria-label="Close dialog" onClick={() => !saving && setModal('')}><X size={19} /></button></header>
        <form onSubmit={submit}>
          {modal === 'category' ? <>
            <label>Main category name<input autoFocus value={draft.name} onChange={event => setDraft(current => ({ ...current, name: event.target.value }))} placeholder="e.g. Industrial equipment" maxLength={100} required /></label>
            <label>Classification<select value={draft.type} onChange={event => setDraft(current => ({ ...current, type: event.target.value }))}><option value="ASSET">Trackable assets</option><option value="CONSUMABLE">Consumable stock</option></select></label>
          </> : modal === 'subcategory' ? <>
            <label>Main category<select autoFocus value={draft.categoryId} onChange={event => setDraft(current => ({ ...current, categoryId: event.target.value }))} required><option value="">Choose a main category</option>{uniqueCategories.map((item, index) => <option key={categoryId(item) || index} value={categoryId(item)}>{categoryName(item)}</option>)}</select></label>
            <label>Subcategory name<input value={draft.name} onChange={event => setDraft(current => ({ ...current, name: event.target.value }))} placeholder="e.g. Controllers & processors" maxLength={100} required /></label>
            {typeOf(uniqueCategories.find(item => norm(categoryId(item)) === norm(draft.categoryId))) === 'GENERAL'
              ? <label>Classification<select value={draft.type} onChange={event => setDraft(current => ({ ...current, type: event.target.value }))}><option value="ASSET">Trackable assets</option><option value="CONSUMABLE">Consumable stock</option></select></label>
              : <p className="asset-categories-inherited-type">Classification follows its main category: <b>{draft.type === 'CONSUMABLE' ? 'Consumable stock' : 'Trackable assets'}</b>.</p>}
          </> : <>
            <label>Main category<select value={draft.categoryId} onChange={event => setDraft(current => ({ ...current, categoryId: event.target.value, subcategoryId: '' }))} required><option value="">Choose a main category</option>{uniqueCategories.map((item, index) => <option key={categoryId(item) || index} value={categoryId(item)}>{categoryName(item)}</option>)}</select></label>
            <label>Subcategory<select autoFocus value={draft.subcategoryId} onChange={event => {
              const selected = data.subcategories.find(item => norm(childId(item)) === norm(event.target.value));
              setDraft(current => ({ ...current, subcategoryId: event.target.value, type: typeOf(selected) === 'CONSUMABLE' ? 'CONSUMABLE' : 'ASSET' }));
            }} required><option value="">Choose a subcategory</option>{data.subcategories.filter(item => norm(childParentId(item)) === norm(draft.categoryId) && (filter === 'ALL' || (filter === 'CONSUMABLES' ? isConsumable(item) : !isConsumable(item)))).map((item, index) => <option key={childId(item) || index} value={childId(item)}>{childName(item)}</option>)}</select></label>
            <label>Item / asset type<input value={draft.name} onChange={event => setDraft(current => ({ ...current, name: event.target.value }))} placeholder="e.g. PLC trainer kit" maxLength={100} required /></label>
            <p className="asset-categories-inherited-type">Classification follows its subcategory: <b>{draft.type === 'CONSUMABLE' ? 'Consumable stock' : 'Trackable assets'}</b>.</p>
          </>}
          {notice?.type === 'error' && <p className="asset-categories-modal-error" role="alert">{notice.text}</p>}
          <footer><button type="button" onClick={() => !saving && setModal('')}>Cancel</button><button type="submit" disabled={saving}>{saving ? <><CircleNotch className="asset-categories-spin" size={16} /> Saving…</> : 'Save classification'}</button></footer>
        </form>
      </section>
    </div>, document.body
  );

  return <Layout>
    <main className="asset-categories-page">
      <section className="asset-categories-hero">
        <div className="asset-categories-hero-copy"><span className="asset-categories-kicker"><Tag size={14} weight="fill" /> ASSET CLASSIFICATION</span><h1>The item taxonomy</h1><p>Follow the hierarchy from main category to subcategory to the exact item type. Brands, models, serial numbers and quantities stay on the item record.</p></div>
        <div className="asset-categories-hero-actions"><button type="button" onClick={() => void loadCategories()} disabled={loading}><ArrowClockwise size={16} className={loading ? 'asset-categories-spin' : ''} /> Refresh</button><button type="button" className="primary" onClick={() => openModal('category')}><Plus size={16} weight="bold" /> Add main category</button></div>
        <div className="asset-categories-orbit" aria-hidden="true"><div><Tag size={34} weight="duotone" /></div></div>
      </section>

      <section className="asset-categories-summary" aria-label="Classification totals">
        <article><span><Tag size={17} /></span><small>Main categories</small><strong>{uniqueCategories.length}</strong></article>
        <article><span><Package size={17} /></span><small>Subcategories</small><strong>{totalVisibleSubcategories}</strong></article>
        <article><span className="mint"><Tag size={17} /></span><small>Item types</small><strong>{data.assetTypes.length}</strong></article>
        <article><span className="violet"><Package size={17} /></span><small>Classification levels</small><strong>3</strong></article>
      </section>

      <section className="asset-categories-library">
        <div className="asset-categories-toolbar"><div><span className="asset-categories-kicker">CLASSIFICATION LIBRARY</span><h2>Browse the full item tree</h2><p>Subcategories and item types appear under their parent category. Duplicate names are collapsed.</p></div><button type="button" onClick={() => openModal('subcategory')} disabled={!uniqueCategories.length}><Plus size={16} weight="bold" /> Add subcategory</button></div>
        <div className="asset-categories-controls">
          <div className="asset-categories-filter" role="group" aria-label="Filter category type">{[['ALL', 'All'], ['ASSET', 'Assets'], ['CONSUMABLES', 'Consumables']].map(([value, label]) => <button type="button" key={value} className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>{label}</button>)}</div>
          <label className="asset-categories-search"><MagnifyingGlass size={17} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search category, subcategory, or item type" /></label>
        </div>

        {notice && !modal && <div className={`asset-categories-notice ${notice.type}`} role={notice.type === 'error' ? 'alert' : 'status'}>{notice.text}</div>}
        {loading ? <div className="asset-categories-state"><CircleNotch size={30} className="asset-categories-spin" /><span>Loading the classification library…</span></div>
          : loadError ? <div className="asset-categories-state error"><strong>Couldn’t load the classification</strong><span>{loadError}</span><button type="button" onClick={() => void loadCategories()}>Try again</button></div>
            : visibleCategories.length ? <div className="asset-categories-grid">{visibleCategories.map((category, index) => {
              const children = categoryChildren(category);
              const types = children.reduce((total, child) => total + subcategoryTypeRows(category, child).length, 0);
              const categoryKind = typeOf(category).toLowerCase();
              return <article className={`asset-category-card ${categoryKind === 'consumable' ? 'consumable' : ''}`} key={categoryId(category) || `${categoryName(category)}-${index}`}>
                <header><span className="asset-category-card-icon"><Tag size={18} weight="duotone" /></span><span className="asset-category-type">{categoryKind === 'general' ? 'General' : categoryKind === 'consumable' ? 'Consumables' : 'Assets'}</span></header>
                <h3>{categoryName(category)}</h3><p>{children.length} subcategories <span>·</span> {types} item types</p>
                <div className="asset-category-tree-label">SUBCATEGORY → ITEM TYPE</div>
                <div className="asset-category-hierarchy">{children.length ? children.map((child, childIndex) => {
                  const childTypes = subcategoryTypeRows(category, child);
                  return <section className="asset-category-subcategory" key={childId(child) || `${childName(child)}-${childIndex}`}>
                    <div className="asset-category-subcategory-head"><div><b>{childName(child)}</b><small>{childTypes.length} item {childTypes.length === 1 ? 'type' : 'types'}</small></div><button type="button" title={`Add an item type under ${childName(child)}`} onClick={() => openModal('assetType', category, child)}><Plus size={14} /> Type</button></div>
                    <div className="asset-category-type-list">{childTypes.map((item, typeIndex) => <span key={itemTypeId(item) || `${itemTypeName(item)}-${typeIndex}`}><i aria-hidden="true" />{itemTypeName(item)}</span>)}{!childTypes.length && <small className="empty">No item types recorded</small>}</div>
                  </section>;
                }) : <span className="empty">No subcategories yet</span>}</div>
                <button type="button" className="asset-category-add-child" onClick={() => openModal('subcategory', category)}>Add subcategory under this category <Plus size={14} /></button>
              </article>;
            })}</div> : <div className="asset-categories-state"><Tag size={27} /><strong>No matching classifications</strong><span>{search ? 'Try a different search or filter.' : 'Add a category to begin building the library.'}</span></div>}
      </section>
    </main>
    {modalView}
  </Layout>;
}
