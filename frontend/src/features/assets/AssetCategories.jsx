import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { ArrowClockwise, CircleNotch, MagnifyingGlass, Package, Plus, Tag, X } from '@phosphor-icons/react';
import Layout from '../../layouts/Layout';
import { API_BASE } from '../../services/apiConfig';
import './AssetCategories.css';

const clean = value => String(value || '').trim();
const norm = value => clean(value).toLowerCase().replace(/\s+/g, ' ');
const categoryName = item => item.categoryname || item.category_name || item.name || item.category || '';
const categoryId = item => item.categoryid || item.category_id || '';
const childName = item => item.name || item.subcategoryname || item.subcategory_name || item.subcategory || '';
const childParentId = item => item.categoryid || item.category_id || item.parentcategoryid || item.parentid || '';
const childParentName = item => item.categoryname || item.category_name || item.parentcategory || item.category || '';
const categoryType = item => {
  const type = clean(item.type || item.categorytype || item.category_type).toUpperCase();
  return type.includes('CONSUM') || type.includes('STOCK') ? 'CONSUMABLE' : type.includes('ASSET') ? 'ASSET' : 'GENERAL';
};

export default function AssetCategories() {
  const [data, setData] = useState({ categories: [], subcategories: [] });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [modal, setModal] = useState('');
  const [draft, setDraft] = useState({ name: '', type: 'ASSET', categoryId: '' });
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);

  const loadCategories = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const response = await axios.get(`${API_BASE}/api/v1/assets/form-data`, { timeout: 15000 });
      if (!response.data?.success) throw new Error(response.data?.message || 'Category data could not be loaded.');
      setData({
        categories: Array.isArray(response.data.categories) ? response.data.categories : [],
        subcategories: Array.isArray(response.data.subcategories) ? response.data.subcategories : []
      });
    } catch (error) {
      setLoadError(error.response?.data?.message || error.message || 'Category data could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadCategories(); }, [loadCategories]);
  useEffect(() => {
    if (!modal) return undefined;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = event => { if (event.key === 'Escape' && !saving) setModal(''); };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [modal, saving]);

  const uniqueCategories = useMemo(() => {
    const unique = new Map();
    data.categories.forEach(item => {
      const name = clean(categoryName(item));
      if (!name) return;
      const key = `${categoryType(item)}|${norm(name)}`;
      if (!unique.has(key)) unique.set(key, item);
    });
    return [...unique.values()].sort((a, b) => categoryName(a).localeCompare(categoryName(b)));
  }, [data.categories]);

  const visibleCategories = useMemo(() => uniqueCategories.filter(item => {
    const type = categoryType(item);
    const matchesFilter = filter === 'ALL' || type === filter;
    const term = norm(search);
    const name = categoryName(item);
    const children = data.subcategories.filter(child => {
      const id = childParentId(child);
      return (id && categoryId(item) && norm(id) === norm(categoryId(item))) || norm(childParentName(child)) === norm(name);
    });
    return matchesFilter && (!term || norm(name).includes(term) || children.some(child => norm(childName(child)).includes(term)));
  }), [uniqueCategories, data.subcategories, filter, search]);

  const openModal = type => {
    setDraft({ name: '', type: 'ASSET', categoryId: '' });
    setNotice(null);
    setModal(type);
  };

  const submit = async event => {
    event.preventDefault();
    event.stopPropagation();
    if (saving) return;
    const name = clean(draft.name);
    if (!name) return;
    setSaving(true);
    setNotice(null);
    try {
      if (modal === 'category') {
        const duplicate = uniqueCategories.some(item => categoryType(item) === draft.type && norm(categoryName(item)) === norm(name));
        if (duplicate) throw new Error('That category already exists in this group.');
        const response = await axios.post(`${API_BASE}/api/v1/assets/config/category`, { categoryName: name, type: draft.type }, { timeout: 30000 });
        if (!response.data?.success) throw new Error(response.data?.message || 'Category was not saved.');
        const created = response.data.category || { categoryid: `LOCAL-${Date.now()}`, categoryname: name, type: draft.type };
        setData(current => ({ ...current, categories: [...current.categories, created] }));
        setNotice({ type: 'success', text: `“${name}” has been added and is ready to use.` });
      } else {
        const parent = uniqueCategories.find(item => norm(categoryId(item)) === norm(draft.categoryId));
        if (!parent) throw new Error('Choose a parent category first.');
        const siblings = data.subcategories.filter(item => {
          const id = childParentId(item);
          return (id && categoryId(parent) && norm(id) === norm(categoryId(parent))) || norm(childParentName(item)) === norm(categoryName(parent));
        });
        if (siblings.some(item => norm(childName(item)) === norm(name))) throw new Error('That subcategory already exists under this category.');
        const response = await axios.post(`${API_BASE}/api/v1/assets/config/subcategory`, { categoryId: categoryId(parent), subcategoryName: name }, { timeout: 30000 });
        if (!response.data?.success) throw new Error(response.data?.message || 'Subcategory was not saved.');
        const created = response.data.subcategory || { categoryid: categoryId(parent), categoryname: categoryName(parent), name };
        setData(current => ({ ...current, subcategories: [...current.subcategories, created] }));
        setNotice({ type: 'success', text: `“${name}” has been added under “${categoryName(parent)}”.` });
      }
      setModal('');
      window.setTimeout(() => setNotice(null), 5000);
    } catch (error) {
      setNotice({ type: 'error', text: error.response?.data?.message || error.message || 'Could not save this entry.' });
    } finally {
      setSaving(false);
    }
  };

  const totalSubcategories = data.subcategories.length;
  const modalView = modal && createPortal(
    <div className="asset-categories-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !saving) setModal(''); }}>
      <section className="asset-categories-modal" role="dialog" aria-modal="true" aria-labelledby="asset-categories-modal-title">
        <header><span className="asset-categories-modal-icon"><Tag size={19} /></span><div><small>CLASSIFICATION LIBRARY</small><h2 id="asset-categories-modal-title">{modal === 'category' ? 'Add a category' : 'Add a subcategory'}</h2></div><button type="button" aria-label="Close dialog" onClick={() => !saving && setModal('')}><X size={19} /></button></header>
        <form onSubmit={submit}>
          {modal === 'category' ? <>
            <label>Category name<input autoFocus value={draft.name} onChange={event => setDraft(current => ({ ...current, name: event.target.value }))} placeholder="e.g. IT Equipment" maxLength={100} required /></label>
            <label>Used for<select value={draft.type} onChange={event => setDraft(current => ({ ...current, type: event.target.value }))}><option value="ASSET">Trackable assets</option><option value="CONSUMABLE">Consumable stock</option></select></label>
          </> : <>
            <label>Parent category<select autoFocus value={draft.categoryId} onChange={event => setDraft(current => ({ ...current, categoryId: event.target.value }))} required><option value="">Choose a category</option>{uniqueCategories.map((item, index) => <option key={categoryId(item) || `${categoryName(item)}-${index}`} value={categoryId(item)}>{categoryName(item)} · {categoryType(item) === 'GENERAL' ? 'General' : categoryType(item)}</option>)}</select></label>
            <label>Subcategory name<input value={draft.name} onChange={event => setDraft(current => ({ ...current, name: event.target.value }))} placeholder="e.g. Laptop Computers" maxLength={100} required /></label>
          </>}
          {notice?.type === 'error' && <p className="asset-categories-modal-error" role="alert">{notice.text}</p>}
          <footer><button type="button" onClick={() => !saving && setModal('')}>Cancel</button><button type="submit" disabled={saving}>{saving ? <><CircleNotch className="asset-categories-spin" size={16} /> Saving…</> : modal === 'category' ? 'Save category' : 'Save subcategory'}</button></footer>
        </form>
      </section>
    </div>, document.body
  );

  return <Layout>
    <main className="asset-categories-page">
      <section className="asset-categories-hero">
        <div className="asset-categories-hero-copy"><span className="asset-categories-kicker"><Tag size={14} weight="fill" /> ASSET CLASSIFICATION</span><h1>Categories & subcategories</h1><p>Review the complete category tree before registering equipment or stock.</p></div>
        <div className="asset-categories-hero-actions"><button type="button" onClick={() => void loadCategories()} disabled={loading}><ArrowClockwise size={16} className={loading ? 'asset-categories-spin' : ''} /> Refresh</button><button type="button" className="primary" onClick={() => openModal('category')}><Plus size={16} weight="bold" /> Add category</button></div>
        <div className="asset-categories-orbit" aria-hidden="true"><div><Tag size={34} weight="duotone" /></div></div>
      </section>

      <section className="asset-categories-summary" aria-label="Category totals">
        <article><span><Tag size={17} /></span><small>Categories</small><strong>{uniqueCategories.length}</strong></article>
        <article><span><Package size={17} /></span><small>Subcategories</small><strong>{totalSubcategories}</strong></article>
        <article><span className="mint"><Tag size={17} /></span><small>Asset groups</small><strong>{uniqueCategories.filter(item => categoryType(item) === 'ASSET').length}</strong></article>
        <article><span className="violet"><Package size={17} /></span><small>Consumable groups</small><strong>{uniqueCategories.filter(item => categoryType(item) === 'CONSUMABLE').length}</strong></article>
      </section>

      <section className="asset-categories-library">
        <div className="asset-categories-toolbar"><div><span className="asset-categories-kicker">BROWSE THE LIBRARY</span><h2>Every group, clearly mapped</h2><p>Each subcategory is shown directly under its parent.</p></div><button type="button" onClick={() => openModal('subcategory')} disabled={!uniqueCategories.length}><Plus size={16} weight="bold" /> Add subcategory</button></div>
        <div className="asset-categories-controls">
          <div className="asset-categories-filter" role="group" aria-label="Filter category type">{[['ALL', 'All'], ['ASSET', 'Assets'], ['CONSUMABLE', 'Consumables']].map(([value, label]) => <button type="button" key={value} className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>{label}</button>)}</div>
          <label className="asset-categories-search"><MagnifyingGlass size={17} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search categories or subcategories" /></label>
        </div>

        {notice && !modal && <div className={`asset-categories-notice ${notice.type}`} role={notice.type === 'error' ? 'alert' : 'status'}>{notice.text}</div>}
        {loading ? <div className="asset-categories-state"><CircleNotch size={30} className="asset-categories-spin" /><span>Loading the category library…</span></div>
          : loadError ? <div className="asset-categories-state error"><strong>Couldn’t load categories</strong><span>{loadError}</span><button type="button" onClick={() => void loadCategories()}>Try again</button></div>
            : visibleCategories.length ? <div className="asset-categories-grid">{visibleCategories.map((item, index) => {
              const children = data.subcategories.filter(child => {
                const id = childParentId(child);
                return (id && categoryId(item) && norm(id) === norm(categoryId(item))) || norm(childParentName(child)) === norm(categoryName(item));
              }).filter((child, childIndex, list) => list.findIndex(other => norm(childName(other)) === norm(childName(child))) === childIndex);
              const type = categoryType(item);
              return <article className={`asset-category-card ${type.toLowerCase()}`} key={categoryId(item) || `${categoryName(item)}-${index}`}>
                <header><span className="asset-category-card-icon"><Tag size={18} weight="duotone" /></span><span className={`asset-category-type ${type.toLowerCase()}`}>{type === 'GENERAL' ? 'General' : type === 'CONSUMABLE' ? 'Consumables' : 'Assets'}</span></header>
                <h3>{categoryName(item)}</h3><p>{categoryId(item) || 'Category'} <span>·</span> {children.length} {children.length === 1 ? 'subcategory' : 'subcategories'}</p>
                <div className="asset-category-tree-label">UNDER THIS CATEGORY</div>
                <div className="asset-category-children">{children.length ? children.map((child, childIndex) => <span key={`${categoryId(item)}-${childName(child)}-${childIndex}`}><i aria-hidden="true" />{childName(child)}</span>) : <span className="empty">No subcategories yet</span>}</div>
                <button type="button" className="asset-category-add-child" onClick={() => { setDraft({ name: '', type: 'ASSET', categoryId: categoryId(item) }); setNotice(null); setModal('subcategory'); }}>Add under this category <Plus size={14} /></button>
              </article>;
            })}</div> : <div className="asset-categories-state"><Tag size={27} /><strong>No matching categories</strong><span>{search ? 'Try another search or filter.' : 'Add a category to start building the library.'}</span></div>}
      </section>
    </main>
    {modalView}
  </Layout>;
}
