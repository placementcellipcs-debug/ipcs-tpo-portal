import{h as e,i as t,r as n,t as r,v as i}from"./apiConfig-VyrAGNEF.js";import{O as a,_ as o,c as s,k as c,m as l,t as ee}from"./Layout-eCe9Hrjt.js";import{t as u}from"./CalendarBlank.es-DiHpV2a7.js";import{t as te}from"./CaretRight.es-CnplWk2S.js";import{a as d,r as f,t as p}from"./dateFormat-BblTzUnd.js";import{t as m}from"./Clock.es-CiuTmMIz.js";import{t as ne}from"./Image.es-D-bqNbdh.js";import{f as h,r as g,s as _}from"./index-Crl1Qxjn.js";import{t as v}from"./DateInput-Bga0NkKw.js";var y=i(e(),1),b=i(h(),1),x=n(),S=e=>d(e);function C(){let e=localStorage.getItem(`tpoData`),n=e?JSON.parse(e):null,i=String(n?.role||``).toUpperCase(),d=[`DESIGN`,`MEDIA`,`CREATIVE`].some(e=>i.includes(e)),h=n?.accessType===`superadmin`||i.includes(`TPO`)||i.includes(`PLACEMENT OFFICER`),[C,w]=(0,y.useState)([]),[re,T]=(0,y.useState)([]),[ie,E]=(0,y.useState)(!0),[D,O]=(0,y.useState)(new Date),[k,A]=(0,y.useState)(new Date),[j,M]=(0,y.useState)(!1),[N,P]=(0,y.useState)(null),[F,I]=(0,y.useState)(!1),[L,R]=(0,y.useState)(null),[z,B]=(0,y.useState)(!1),[V,H]=(0,y.useState)(null),[U,W]=(0,y.useState)({date:``,time:``,branch:n?.assignedBranchesArray?.[0]||`All Branches`,type:`Placement Drive`,title:``,description:``,location:``}),[G,K]=(0,y.useState)(null);(0,y.useEffect)(()=>{if(!j&&!N)return;let e=document.body.style.overflow;return document.body.style.overflow=`hidden`,()=>{document.body.style.overflow=e}},[j,N]);let q=async()=>{try{E(!0);let e=await t.get(`${r}/api/tpo/events`);e.data.success&&w(e.data.events||[])}catch(e){console.error(`Failed to fetch events`,e)}finally{E(!1)}},J=async()=>{try{let e=await t.get(`${r}/api/tpo/branches`);if(e.data.success){let t=[...new Set(e.data.branches.map(e=>e.branch).filter(e=>!!e&&![`all`,`all branches`].includes(String(e).trim().toLowerCase())))].sort((e,t)=>e.localeCompare(t));T(t)}}catch(e){console.error(`Failed to fetch branches`,e)}};(0,y.useEffect)(()=>{q(),h&&J()},[h]);let Y=async()=>{if(!U.title||!U.date||!U.type)return alert(`Please fill in the Event Title, Date, and Event Type.`);I(!0);try{let e=new FormData;e.append(`tpo`,n?.name||`Unknown`),Object.keys(U).forEach(t=>e.append(t,U[t])),G&&e.append(`posterFile`,G),(await t.post(`https://ipcs-tpo-portal-u0l6.onrender.com/api/tpo/events/add`,e,{headers:{"Content-Type":`multipart/form-data`}})).data.success&&(M(!1),W({date:``,time:``,branch:n?.assignedBranchesArray?.[0]||`All Branches`,type:`Placement Drive`,title:``,description:``,location:``}),K(null),q())}catch{alert(`Failed to save event`)}finally{I(!1)}},X=e=>{let t=S(N?.date),n=t&&!Number.isNaN(t.getTime())?`${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,`0`)}-${String(t.getDate()).padStart(2,`0`)}`:``,r=String(N?.time||``).trim();R({action:e,newDate:n,time:r?f(r,``):``,reason:``}),H(null)},ae=async()=>{if(!(!L||!N?.eventKey)){if(L.action===`reschedule`&&!L.newDate){H({type:`error`,message:`Choose the new event date before saving.`});return}B(!0);try{let e=L.action===`cancel`?`cancel`:`reschedule`,n={reason:L.reason};e===`reschedule`&&(n.date=L.newDate,n.time=L.time);let i=await t.post(`${r}/api/tpo/events/${encodeURIComponent(N.eventKey)}/${e}`,n);if(!i.data?.success)throw Error(i.data?.message||`The event could not be updated.`);let a=i.data.event;a&&(w(e=>e.map(e=>e.eventKey===a.eventKey?a:e)),P(a)),R(null),H({type:i.data.emailSent?`success`:`warning`,message:i.data.message||`Event updated.`})}catch(e){H({type:`error`,message:e.response?.data?.message||e.message||`The event could not be updated.`})}finally{B(!1)}}},Z=e=>{if(!e)return`var(--accent-primary)`;let t=String(e).toLowerCase();return t.includes(`talentino`)?`#a855f7`:t.includes(`placement drive`)?`#ef4444`:`#10b981`},oe=()=>{let e=new Date(D);e.setMonth(e.getMonth()+1),O(e)},se=()=>{let e=new Date(D);e.setMonth(e.getMonth()-1),O(e)},Q=e=>{if(d)return!0;let t=n?.assignedBranchesArray||[];if(n?.accessType===`superadmin`||t.length===0||t.includes(`all`)||t.includes(`All`))return!0;if((e.type||``).toLowerCase().includes(`talentino`)){let n=(e.branch||``).toLowerCase();return n===`all branches`||n===`all`||t.some(e=>n.includes(e.toLowerCase())||e.toLowerCase().includes(n))}return!0},ce=()=>{let e=D.getFullYear(),t=D.getMonth(),n=new Date(e,t,1).getDay(),r=new Date(e,t+1,0).getDate(),i=[];for(let e=0;e<n;e++)i.push((0,x.jsx)(`div`,{className:`neo-cell empty`},`empty-${e}`));for(let n=1;n<=r;n++){let r=new Date(e,t,n),a=n===new Date().getDate()&&t===new Date().getMonth()&&e===new Date().getFullYear(),o=k&&r.toDateString()===k.toDateString(),s=C.filter(e=>{if(!Q(e))return!1;let t=S(e.date);return t&&t.getFullYear()===r.getFullYear()&&t.getMonth()===r.getMonth()&&t.getDate()===r.getDate()});i.push((0,x.jsxs)(`div`,{className:`neo-cell ${o?`selected`:``}`,onClick:()=>A(r),children:[(0,x.jsx)(`div`,{className:`neo-date-num ${a&&!o?`today`:``}`,children:n}),(0,x.jsxs)(`div`,{className:`neo-events`,children:[s.slice(0,3).map((e,t)=>(0,x.jsxs)(`div`,{className:`neo-event-indicator hover-lift`,style:{cursor:`pointer`},onClick:t=>{t.stopPropagation(),P(e)},children:[(0,x.jsx)(`span`,{className:`neo-event-bar`,style:{background:String(e.status||``).toLowerCase()===`cancelled`?`#ef4444`:String(e.status||``).toLowerCase()===`rescheduled`?`#f59e0b`:o?`rgba(255,255,255,0.8)`:Z(e.type)}}),(0,x.jsx)(`span`,{className:`neo-event-title`,style:{color:o?`#fff`:`#cbd5e1`,textDecoration:String(e.status||``).toLowerCase()===`cancelled`?`line-through`:`none`},children:e.title})]},t)),s.length>3&&(0,x.jsxs)(`div`,{className:`neo-event-more`,style:{color:o?`rgba(255,255,255,0.7)`:`#64748b`},children:[`+`,s.length-3,` more`]})]})]},n))}return i},$=k?C.filter(e=>{if(!Q(e))return!1;let t=S(e.date);return t&&t.toDateString()===k.toDateString()}):[];return(0,x.jsxs)(ee,{children:[(0,x.jsxs)(`div`,{className:`page-container`,style:{padding:0},children:[V&&!N&&(0,x.jsx)(`div`,{role:V.type===`error`?`alert`:`status`,style:{marginBottom:`16px`,padding:`13px 16px`,borderRadius:`12px`,border:`1px solid ${V.type===`error`?`rgba(248,113,113,.35)`:V.type===`warning`?`rgba(251,191,36,.35)`:`rgba(52,211,153,.35)`}`,background:V.type===`error`?`rgba(127,29,29,.2)`:V.type===`warning`?`rgba(120,53,15,.2)`:`rgba(6,78,59,.22)`,color:V.type===`error`?`#fecaca`:V.type===`warning`?`#fde68a`:`#a7f3d0`},children:V.message}),(0,x.jsxs)(`div`,{style:{display:`flex`,justifyContent:`space-between`,alignItems:`center`,marginBottom:`1.5rem`,flexWrap:`wrap`,gap:`15px`},children:[(0,x.jsxs)(`div`,{children:[(0,x.jsxs)(`h1`,{style:{fontSize:`2rem`,margin:`0 0 5px 0`,color:`#fff`},children:[`Morning, `,String(n?.name||`Alex`).split(` `)[0],`!`]}),(0,x.jsx)(`p`,{style:{color:`#94a3b8`,margin:0,fontSize:`1.05rem`},children:`Here's what's on your agenda today.`})]}),h&&(0,x.jsxs)(`button`,{className:`btn-action`,style:{width:`auto`,borderRadius:`12px`,display:`flex`,alignItems:`center`,gap:`8px`,padding:`12px 20px`,background:`var(--accent-primary)`,color:`#0f172a`},onClick:()=>M(!0),children:[(0,x.jsx)(l,{weight:`bold`}),` Add Event`]})]}),(0,x.jsxs)(`div`,{className:`neo-layout`,children:[(0,x.jsxs)(`div`,{className:`neo-calendar-section`,children:[(0,x.jsxs)(`div`,{className:`neo-toolbar`,children:[(0,x.jsxs)(`div`,{className:`neo-month-display`,children:[D.toLocaleString(`default`,{month:`long`}),` `,(0,x.jsx)(c,{size:14,weight:`bold`,style:{marginLeft:`8px`,marginRight:`20px`,color:`#64748b`}}),D.getFullYear(),` `,(0,x.jsx)(c,{size:14,weight:`bold`,style:{marginLeft:`8px`,color:`#64748b`}})]}),(0,x.jsxs)(`div`,{className:`neo-nav-arrows`,children:[(0,x.jsx)(`button`,{onClick:se,children:(0,x.jsx)(a,{size:16,weight:`bold`})}),(0,x.jsx)(`button`,{onClick:oe,children:(0,x.jsx)(te,{size:16,weight:`bold`})})]})]}),(0,x.jsx)(`div`,{className:`neo-days-header`,children:[`Sunday`,`Monday`,`Tuesday`,`Wednesday`,`Thursday`,`Friday`,`Saturday`].map(e=>(0,x.jsx)(`div`,{children:e},e))}),(0,x.jsx)(`div`,{className:`neo-grid`,children:ie?(0,x.jsx)(`div`,{style:{gridColumn:`1 / -1`,textAlign:`center`,padding:`5rem`,color:`var(--accent-primary)`},children:(0,x.jsx)(_,{size:48,className:`ph-spin`})}):ce()})]}),k&&(0,x.jsxs)(`div`,{className:`neo-agenda-section`,children:[(0,x.jsxs)(`div`,{className:`neo-agenda-header`,style:{display:`flex`,justifyContent:`space-between`,alignItems:`flex-start`},children:[(0,x.jsxs)(`div`,{children:[(0,x.jsx)(`h3`,{children:`Scheduled`}),(0,x.jsx)(`div`,{className:`neo-agenda-date`,children:p(k)})]}),(0,x.jsx)(`button`,{onClick:()=>A(null),style:{background:`rgba(255,255,255,0.05)`,border:`none`,color:`#94a3b8`,padding:`6px`,borderRadius:`50%`,cursor:`pointer`,display:`flex`,transition:`0.2s`},title:`Close Agenda`,children:(0,x.jsx)(g,{size:18,weight:`bold`})})]}),(0,x.jsx)(`div`,{className:`neo-agenda-list`,children:$.length===0?(0,x.jsxs)(`div`,{style:{color:`#64748b`,fontSize:`0.9rem`,textAlign:`center`,marginTop:`2rem`},children:[(0,x.jsx)(u,{size:32,style:{opacity:.5,marginBottom:`10px`}}),(0,x.jsx)(`br`,{}),`No events scheduled for this day.`]}):$.map((e,t)=>(0,x.jsxs)(`div`,{className:`neo-agenda-card hover-lift`,onClick:()=>P(e),style:{cursor:`pointer`},children:[(0,x.jsx)(`div`,{className:`neo-ac-accent`,style:{background:Z(e.type)}}),(0,x.jsx)(`div`,{className:`neo-ac-time-row`,children:(0,x.jsx)(`span`,{style:{color:`#fff`,fontWeight:`bold`},children:f(e.time,`09:00:00`)})}),(0,x.jsxs)(`div`,{className:`neo-ac-content`,children:[(0,x.jsx)(`h4`,{className:`neo-ac-title`,children:e.title}),(0,x.jsx)(`p`,{className:`neo-ac-desc`,children:e.type}),String(e.status||`Scheduled`).toLowerCase()!==`scheduled`&&(0,x.jsx)(`span`,{className:`event-status-pill ${String(e.status).toLowerCase()===`cancelled`?`cancelled`:`rescheduled`}`,children:e.status}),(0,x.jsxs)(`div`,{className:`neo-ac-footer`,children:[(0,x.jsxs)(`div`,{className:`neo-ac-detail`,children:[(0,x.jsx)(m,{size:14}),` `,e.time?f(e.time):`All Day`]}),(0,x.jsxs)(`div`,{className:`neo-ac-detail`,children:[(0,x.jsx)(o,{size:14}),` `,e.location||`Online`]})]}),(0,x.jsxs)(`div`,{className:`neo-ac-members`,children:[(0,x.jsx)(`div`,{className:`neo-avatar`,children:(0,x.jsx)(s,{size:14})}),(0,x.jsxs)(`span`,{style:{fontSize:`0.8rem`,color:`#cbd5e1`},children:[e.tpo||`System`,` • `,e.branch===`All Branches`?`Global`:e.branch]})]})]})]},t))})]})]})]}),j&&(0,b.createPortal)((0,x.jsx)(`div`,{className:`event-modal-backdrop`,onClick:e=>{e.target===e.currentTarget&&M(!1)},children:(0,x.jsxs)(`div`,{className:`event-modal-dialog`,style:{maxWidth:`600px`},children:[(0,x.jsxs)(`div`,{style:{display:`flex`,justifyContent:`space-between`,alignItems:`center`,marginBottom:`1.5rem`,borderBottom:`1px solid #1e293b`,paddingBottom:`15px`},children:[(0,x.jsx)(`h3`,{style:{margin:0,fontSize:`1.4rem`,color:`#fff`},children:`Add New Event`}),(0,x.jsx)(g,{size:24,style:{cursor:`pointer`,color:`#94a3b8`},onClick:()=>M(!1)})]}),(0,x.jsxs)(`div`,{className:`form-group`,style:{marginBottom:`15px`},children:[(0,x.jsx)(`label`,{style:{display:`block`,fontSize:`0.8rem`,color:`#94a3b8`,marginBottom:`5px`,fontWeight:`bold`},children:`Event Title`}),(0,x.jsx)(`input`,{type:`text`,className:`sleek-input`,style:{width:`100%`},value:U.title,onChange:e=>W({...U,title:e.target.value}),placeholder:`e.g. Wipro Placement Drive`})]}),(0,x.jsxs)(`div`,{className:`event-form-grid`,style:{display:`grid`,gridTemplateColumns:`repeat(2, minmax(0, 1fr))`,gap:`15px`,marginBottom:`15px`},children:[(0,x.jsxs)(`div`,{className:`form-group`,children:[(0,x.jsx)(`label`,{style:{display:`block`,fontSize:`0.8rem`,color:`#94a3b8`,marginBottom:`5px`,fontWeight:`bold`},children:`Date *`}),(0,x.jsx)(v,{className:`sleek-input`,style:{width:`100%`},value:U.date,onChange:e=>W({...U,date:e.target.value})})]}),(0,x.jsxs)(`div`,{className:`form-group`,children:[(0,x.jsx)(`label`,{style:{display:`block`,fontSize:`0.8rem`,color:`#94a3b8`,marginBottom:`5px`,fontWeight:`bold`},children:`Time`}),(0,x.jsx)(`input`,{type:`time`,step:`1`,className:`sleek-input`,style:{width:`100%`},value:U.time,onChange:e=>W({...U,time:e.target.value})})]})]}),(0,x.jsxs)(`div`,{className:`event-form-grid`,style:{display:`grid`,gridTemplateColumns:`repeat(2, minmax(0, 1fr))`,gap:`15px`,marginBottom:`15px`},children:[(0,x.jsxs)(`div`,{className:`form-group`,children:[(0,x.jsx)(`label`,{style:{display:`block`,fontSize:`0.8rem`,color:`#94a3b8`,marginBottom:`5px`,fontWeight:`bold`},children:`Event Type *`}),(0,x.jsxs)(`select`,{className:`sleek-input`,style:{width:`100%`},value:U.type,onChange:e=>W({...U,type:e.target.value}),children:[(0,x.jsx)(`option`,{value:`Placement Drive`,children:`Placement Drive`}),(0,x.jsx)(`option`,{value:`Talentino`,children:`Talentino`})]})]}),(0,x.jsxs)(`div`,{className:`form-group`,children:[(0,x.jsx)(`label`,{style:{display:`block`,fontSize:`0.8rem`,color:`#94a3b8`,marginBottom:`5px`,fontWeight:`bold`},children:`Event Location`}),(0,x.jsx)(`input`,{type:`text`,className:`sleek-input`,style:{width:`100%`},value:U.location,onChange:e=>W({...U,location:e.target.value}),placeholder:`e.g. Bangalore Branch, Online`})]})]}),(0,x.jsxs)(`div`,{className:`form-group`,style:{marginBottom:`15px`},children:[(0,x.jsx)(`label`,{style:{display:`block`,fontSize:`0.8rem`,color:`#94a3b8`,marginBottom:`5px`,fontWeight:`bold`},children:`Eligible Branch`}),(0,x.jsxs)(`select`,{className:`sleek-input`,style:{width:`100%`},value:U.branch,onChange:e=>W({...U,branch:e.target.value}),children:[(0,x.jsx)(`option`,{value:`All Branches`,children:`All Branches`}),re.map((e,t)=>(0,x.jsx)(`option`,{value:e,children:e},t))]})]}),(0,x.jsxs)(`div`,{className:`form-group`,style:{marginBottom:`20px`},children:[(0,x.jsx)(`label`,{style:{display:`block`,fontSize:`0.8rem`,color:`#94a3b8`,marginBottom:`5px`,fontWeight:`bold`},children:`Description`}),(0,x.jsx)(`textarea`,{className:`sleek-input`,style:{width:`100%`,minHeight:`80px`,resize:`vertical`},value:U.description,onChange:e=>W({...U,description:e.target.value}),placeholder:`Add instructions or meeting links...`})]}),U.type===`Placement Drive`&&(0,x.jsxs)(`div`,{className:`form-group`,style:{marginBottom:`25px`,background:`rgba(56, 189, 248, 0.05)`,padding:`15px`,borderRadius:`12px`,border:`1px dashed var(--accent-primary)`},children:[(0,x.jsx)(`label`,{style:{display:`block`,fontSize:`0.8rem`,color:`var(--accent-primary)`,marginBottom:`8px`,fontWeight:`bold`},children:`Upload Drive Poster (Optional)`}),(0,x.jsx)(`input`,{type:`file`,accept:`image/*`,className:`sleek-input`,style:{width:`100%`,padding:`8px`},onChange:e=>K(e.target.files[0])})]}),(0,x.jsxs)(`div`,{style:{display:`flex`,justifyContent:`flex-end`,gap:`10px`,borderTop:`1px solid #1e293b`,paddingTop:`1.5rem`},children:[(0,x.jsx)(`button`,{className:`btn-secondary`,style:{background:`transparent`,border:`1px solid #334155`,color:`#f8fafc`,padding:`10px 20px`,borderRadius:`10px`,cursor:`pointer`,fontWeight:`bold`},onClick:()=>M(!1),children:`Cancel`}),(0,x.jsx)(`button`,{className:`btn-action`,style:{background:`var(--accent-primary)`,color:`#0f172a`,padding:`10px 20px`,borderRadius:`10px`,cursor:`pointer`,fontWeight:`bold`,border:`none`},onClick:Y,disabled:F,children:F?(0,x.jsx)(_,{size:18,className:`ph-spin`}):`Save Event`})]})]})}),document.body),N&&(0,b.createPortal)((0,x.jsx)(`div`,{className:`event-modal-backdrop`,onClick:e=>{e.target===e.currentTarget&&P(null)},children:(0,x.jsxs)(`div`,{className:`event-modal-dialog`,style:{maxWidth:`680px`},children:[(0,x.jsxs)(`div`,{style:{borderBottom:`1px solid #1e293b`,paddingBottom:`15px`,marginBottom:`20px`,display:`flex`,justifyContent:`space-between`,alignItems:`flex-start`},children:[(0,x.jsxs)(`div`,{children:[(0,x.jsx)(`span`,{style:{background:`rgba(255,255,255,0.05)`,color:Z(N.type),padding:`6px 12px`,borderRadius:`8px`,fontSize:`0.75rem`,fontWeight:`bold`,display:`inline-block`,marginBottom:`10px`},children:String(N.type||`Event`)}),(0,x.jsx)(`h2`,{style:{margin:`0 0 5px 0`,fontSize:`1.6rem`,color:`#fff`},children:String(N.title||`Untitled Event`)}),N.eventId&&(0,x.jsxs)(`div`,{style:{color:`var(--accent-primary)`,fontSize:`0.85rem`,fontWeight:`bold`},children:[`Event ID: `,String(N.eventId)]}),(0,x.jsx)(`span`,{className:`event-status-pill ${String(N.status||`Scheduled`).toLowerCase()===`cancelled`?`cancelled`:String(N.status||`Scheduled`).toLowerCase()===`rescheduled`?`rescheduled`:`scheduled`}`,children:String(N.status||`Scheduled`)})]}),(0,x.jsx)(`button`,{style:{background:`rgba(255,255,255,0.05)`,border:`none`,color:`#94a3b8`,padding:`8px`,borderRadius:`50%`,cursor:`pointer`,display:`flex`,transition:`0.2s`},onClick:()=>P(null),title:`Close`,children:(0,x.jsx)(g,{size:20,weight:`bold`})})]}),(0,x.jsxs)(`div`,{className:`event-detail-grid`,style:{display:`grid`,gridTemplateColumns:`repeat(2, minmax(0, 1fr))`,gap:`15px`,marginBottom:`20px`},children:[(0,x.jsxs)(`div`,{style:{background:`#1e293b`,padding:`15px`,borderRadius:`12px`},children:[(0,x.jsx)(`div`,{style:{fontSize:`0.7rem`,color:`#94a3b8`,textTransform:`uppercase`,fontWeight:`bold`,marginBottom:`5px`},children:`Date & Time`}),(0,x.jsxs)(`div`,{style:{color:`#fff`,fontSize:`0.95rem`,fontWeight:600,display:`flex`,alignItems:`center`,gap:`6px`},children:[(0,x.jsx)(m,{size:16,color:`var(--accent-primary)`}),` `,p(N.date,`TBD`),` • `,f(N.time,`TBD`)]})]}),(0,x.jsxs)(`div`,{style:{background:`#1e293b`,padding:`15px`,borderRadius:`12px`},children:[(0,x.jsx)(`div`,{style:{fontSize:`0.7rem`,color:`#94a3b8`,textTransform:`uppercase`,fontWeight:`bold`,marginBottom:`5px`},children:`Location & Branch`}),(0,x.jsxs)(`div`,{style:{color:`#fff`,fontSize:`0.95rem`,fontWeight:600,display:`flex`,alignItems:`center`,gap:`6px`},children:[(0,x.jsx)(o,{size:16,color:`#f59e0b`}),` `,String(N.location||`Online`)]}),(0,x.jsxs)(`div`,{style:{color:`#cbd5e1`,fontSize:`0.85rem`,marginTop:`4px`},children:[`Branch: `,String(N.branch||`Global`)]})]})]}),N.description&&(0,x.jsxs)(`div`,{style:{background:`rgba(255,255,255,0.02)`,padding:`20px`,borderRadius:`12px`,border:`1px solid rgba(255,255,255,0.05)`,marginBottom:`20px`},children:[(0,x.jsx)(`div`,{style:{fontSize:`0.75rem`,color:`#94a3b8`,textTransform:`uppercase`,fontWeight:`bold`,marginBottom:`8px`},children:`Description`}),(0,x.jsx)(`div`,{style:{color:`#e2e8f0`,fontSize:`0.95rem`,lineHeight:`1.6`,whiteSpace:`pre-wrap`},children:String(N.description)})]}),N.poster&&N.poster!==`N/A`&&(0,x.jsxs)(`div`,{style:{marginTop:`20px`},children:[(0,x.jsx)(`div`,{style:{fontSize:`0.75rem`,color:`#94a3b8`,textTransform:`uppercase`,fontWeight:`bold`,marginBottom:`10px`},children:`Event Poster Attached`}),(0,x.jsxs)(`button`,{className:`btn-secondary hover-lift`,style:{background:`rgba(56, 189, 248, 0.1)`,border:`1px solid rgba(56, 189, 248, 0.3)`,color:`var(--accent-primary)`,width:`100%`,padding:`15px`,borderRadius:`12px`,cursor:`pointer`,display:`flex`,justifyContent:`center`,alignItems:`center`,gap:`8px`,fontWeight:`bold`,fontSize:`1rem`,transition:`0.2s`},onClick:()=>window.open(N.poster,`_blank`),children:[(0,x.jsx)(ne,{size:22,weight:`fill`}),` View Full Event Poster`]})]}),N.statusReason&&(0,x.jsxs)(`div`,{style:{marginTop:`16px`,padding:`12px 14px`,background:`rgba(255,255,255,0.04)`,border:`1px solid rgba(148,163,184,.15)`,borderRadius:`10px`,color:`#cbd5e1`,fontSize:`.9rem`},children:[(0,x.jsx)(`strong`,{style:{color:`#94a3b8`},children:`Latest update:`}),` `,String(N.statusReason)]}),V&&(0,x.jsx)(`div`,{role:V.type===`error`?`alert`:`status`,style:{marginTop:`16px`,padding:`12px 14px`,borderRadius:`10px`,border:`1px solid ${V.type===`error`?`rgba(248,113,113,.35)`:V.type===`warning`?`rgba(251,191,36,.35)`:`rgba(52,211,153,.35)`}`,background:V.type===`error`?`rgba(127,29,29,.2)`:V.type===`warning`?`rgba(120,53,15,.2)`:`rgba(6,78,59,.22)`,color:V.type===`error`?`#fecaca`:V.type===`warning`?`#fde68a`:`#a7f3d0`},children:V.message}),h&&String(N.status||``).toLowerCase()!==`cancelled`&&(0,x.jsxs)(`div`,{className:`event-action-row`,children:[(0,x.jsxs)(`button`,{type:`button`,onClick:()=>X(`reschedule`),disabled:z,className:`event-reschedule-button`,children:[(0,x.jsx)(u,{size:18}),` Reschedule Event`]}),(0,x.jsxs)(`button`,{type:`button`,onClick:()=>X(`cancel`),disabled:z,className:`event-cancel-button`,children:[(0,x.jsx)(g,{size:18}),` Cancel Event`]})]})]})}),document.body),L&&N&&(0,b.createPortal)((0,x.jsx)(`div`,{className:`event-modal-backdrop event-action-layer`,onClick:e=>{e.target===e.currentTarget&&!z&&R(null)},children:(0,x.jsxs)(`div`,{className:`event-modal-dialog event-action-dialog`,role:`dialog`,"aria-modal":`true`,"aria-labelledby":`event-action-title`,children:[(0,x.jsxs)(`div`,{style:{display:`flex`,justifyContent:`space-between`,gap:`16px`,alignItems:`flex-start`,marginBottom:`18px`},children:[(0,x.jsxs)(`div`,{children:[(0,x.jsx)(`span`,{className:`event-status-pill ${L.action===`cancel`?`cancelled`:`rescheduled`}`,children:L.action===`cancel`?`Cancellation notice`:`Schedule update`}),(0,x.jsx)(`h2`,{id:`event-action-title`,style:{color:`#fff`,margin:`8px 0 0`,fontSize:`1.35rem`},children:L.action===`cancel`?`Cancel this event?`:`Reschedule this event`}),(0,x.jsx)(`div`,{style:{color:`#94a3b8`,marginTop:`5px`},children:String(N.title||`Untitled Event`)})]}),(0,x.jsx)(`button`,{type:`button`,"aria-label":`Close`,onClick:()=>!z&&R(null),style:{border:0,background:`transparent`,color:`#94a3b8`,cursor:`pointer`},children:(0,x.jsx)(g,{size:22})})]}),L.action===`reschedule`&&(0,x.jsxs)(`div`,{className:`event-form-grid`,style:{display:`grid`,gridTemplateColumns:`repeat(2, minmax(0, 1fr))`,gap:`14px`,marginBottom:`14px`},children:[(0,x.jsxs)(`label`,{style:{color:`#cbd5e1`,fontSize:`.82rem`,fontWeight:700},children:[`New date *`,(0,x.jsx)(v,{className:`sleek-input`,value:L.newDate,onChange:e=>R(t=>({...t,newDate:e.target.value})),required:!0})]}),(0,x.jsxs)(`label`,{style:{color:`#cbd5e1`,fontSize:`.82rem`,fontWeight:700},children:[`New time`,(0,x.jsx)(`input`,{type:`time`,step:`1`,className:`sleek-input`,value:L.time,onChange:e=>R(t=>({...t,time:e.target.value}))})]})]}),(0,x.jsx)(`label`,{style:{display:`block`,color:`#cbd5e1`,fontSize:`.82rem`,fontWeight:700,marginBottom:`8px`},children:L.action===`cancel`?`Reason for cancellation (optional)`:`Message for recipients (optional)`}),(0,x.jsx)(`textarea`,{className:`sleek-input`,rows:3,maxLength:1e3,value:L.reason,onChange:e=>R(t=>({...t,reason:e.target.value})),placeholder:L.action===`cancel`?`Add a short explanation for the cancellation…`:`Add any instructions or context for the revised schedule…`}),(0,x.jsx)(`div`,{className:`event-audience-note`,children:`The notice will be sent to the recipients assigned to this event type and branch.`}),V&&(0,x.jsx)(`div`,{role:V.type===`error`?`alert`:`status`,style:{marginTop:`12px`,padding:`11px 12px`,borderRadius:`9px`,border:`1px solid ${V.type===`error`?`rgba(248,113,113,.35)`:V.type===`warning`?`rgba(251,191,36,.35)`:`rgba(52,211,153,.35)`}`,background:V.type===`error`?`rgba(127,29,29,.2)`:V.type===`warning`?`rgba(120,53,15,.2)`:`rgba(6,78,59,.22)`,color:V.type===`error`?`#fecaca`:V.type===`warning`?`#fde68a`:`#a7f3d0`,fontSize:`.88rem`},children:V.message}),(0,x.jsxs)(`div`,{style:{display:`flex`,justifyContent:`flex-end`,gap:`10px`,marginTop:`20px`,paddingTop:`16px`,borderTop:`1px solid #253247`},children:[(0,x.jsx)(`button`,{type:`button`,className:`event-action-secondary`,disabled:z,onClick:()=>R(null),children:`Back`}),(0,x.jsx)(`button`,{type:`button`,className:L.action===`cancel`?`event-action-confirm-cancel`:`event-action-confirm-reschedule`,disabled:z,onClick:ae,children:z?(0,x.jsx)(_,{size:18,className:`ph-spin`}):L.action===`cancel`?`Cancel Event & Notify`:`Save New Schedule & Notify`})]})]})}),document.body),(0,x.jsx)(`style`,{children:`
        .event-modal-backdrop { position: fixed; inset: 0; z-index: 99999; display: flex; justify-content: center; align-items: center; overflow-y: auto; overscroll-behavior: contain; box-sizing: border-box; padding: 16px; background: rgba(0,0,0,0.82); backdrop-filter: blur(6px); }
        .event-modal-dialog { width: 100%; max-height: calc(100dvh - 32px); min-height: 0; overflow-y: auto; overscroll-behavior: contain; box-sizing: border-box; margin: auto 0; position: relative; background: #0f172a; border: 1px solid #334155; border-radius: 24px; padding: clamp(18px, 3vw, 32px); box-shadow: 0 25px 50px rgba(0,0,0,0.55); scrollbar-width: thin; scrollbar-color: #475569 transparent; }
        .event-modal-dialog::-webkit-scrollbar { width: 8px; }
        .event-modal-dialog::-webkit-scrollbar-track { background: transparent; }
        .event-modal-dialog::-webkit-scrollbar-thumb { background: #475569; border-radius: 8px; }
        .event-modal-dialog input, .event-modal-dialog select, .event-modal-dialog textarea { width: 100%; max-width: 100%; box-sizing: border-box; }
        .event-action-layer { z-index: 100001; background: rgba(2,6,23,.72); }
        .event-status-pill { display: inline-flex; align-items: center; width: fit-content; margin-top: 7px; padding: 5px 9px; border-radius: 999px; font-size: .68rem; line-height: 1.2; font-weight: 800; letter-spacing: .04em; text-transform: uppercase; }
        .event-status-pill.scheduled { color: #a7f3d0; background: rgba(16,185,129,.14); border: 1px solid rgba(16,185,129,.28); }
        .event-status-pill.cancelled { color: #fecaca; background: rgba(239,68,68,.14); border: 1px solid rgba(239,68,68,.28); }
        .event-status-pill.rescheduled { color: #fde68a; background: rgba(245,158,11,.14); border: 1px solid rgba(245,158,11,.28); }
        .event-action-row { display: flex; justify-content: flex-end; flex-wrap: wrap; gap: 10px; margin-top: 22px; padding-top: 18px; border-top: 1px solid #253247; }
        .event-reschedule-button, .event-cancel-button, .event-action-secondary, .event-action-confirm-cancel, .event-action-confirm-reschedule { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 42px; padding: 10px 15px; border-radius: 10px; font-weight: 700; cursor: pointer; }
        .event-reschedule-button { background: rgba(245,158,11,.12); border: 1px solid rgba(245,158,11,.32); color: #fde68a; }
        .event-cancel-button, .event-action-confirm-cancel { background: rgba(239,68,68,.14); border: 1px solid rgba(239,68,68,.38); color: #fecaca; }
        .event-action-secondary { background: transparent; border: 1px solid #475569; color: #cbd5e1; }
        .event-action-confirm-reschedule { background: #7c3aed; border: 1px solid #8b5cf6; color: #fff; }
        .event-reschedule-button:disabled, .event-cancel-button:disabled, .event-action-secondary:disabled, .event-action-confirm-cancel:disabled, .event-action-confirm-reschedule:disabled { opacity: .6; cursor: wait; }
        .event-action-dialog { max-width: 560px; }
        .event-action-dialog input { display: block; margin-top: 7px; }
        .event-action-dialog textarea { min-height: 84px; resize: vertical; }
        .event-audience-note { color: #94a3b8; font-size: .8rem; margin-top: 9px; }
        @media (max-width: 600px) {
          .event-modal-backdrop { padding: 10px; }
          .event-modal-dialog { max-height: calc(100dvh - 20px); border-radius: 18px; }
          .event-form-grid, .event-detail-grid { grid-template-columns: minmax(0, 1fr) !important; }
          .event-modal-dialog h2 { font-size: 1.3rem !important; overflow-wrap: anywhere; }
        }
        /* Global Reset For This Page */
        .hover-lift:hover { transform: translateY(-4px); border-color: rgba(255,255,255,0.1); background: #1e293b; }
        
        /* The Main Wrapper */
        .neo-layout {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 30px;
          align-items: start;
          margin-top: 15px;
          background: #0b1121; 
          padding: 25px;
          border-radius: 24px;
          border: 1px solid #1e293b;
        }

        /* LEFT SIDE: CALENDAR GRID */
        .neo-calendar-section {
          width: 100%;
          min-width: 0;
        }

        .neo-toolbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 30px;
        }

        .neo-month-display {
          color: #fff;
          font-size: 1.6rem;
          font-weight: 500;
          display: flex;
          align-items: center;
        }
        .neo-month-display span {
          color: #94a3b8;
          margin-left: 10px;
        }

        .neo-nav-arrows {
          display: flex;
          gap: 12px;
        }
        .neo-nav-arrows button {
          background: #1e293b;
          border: 1px solid #334155;
          color: #cbd5e1;
          width: 38px;
          height: 38px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: 0.2s;
        }
        .neo-nav-arrows button:hover {
          background: #334155;
          color: #fff;
          border-color: #475569;
        }

        .neo-days-header {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 15px;
          margin-bottom: 15px;
        }
        .neo-days-header div {
          color: #64748b;
          font-size: 0.8rem;
          font-weight: 600;
          text-transform: capitalize;
          padding-left: 15px;
        }

        .neo-grid {
          display: grid;
          grid-template-columns: repeat(7, minmax(0, 1fr));
          gap: 15px; 
        }

        .neo-cell {
          background: #1e293b;
          border-radius: 12px;
          min-height: 120px;
          padding: 12px;
          cursor: pointer;
          transition: 0.2s ease;
          border: 1px solid transparent;
          display: flex;
          flex-direction: column;
          min-width: 0;
          overflow: hidden;
        }
        .neo-cell.empty {
          background: transparent;
          cursor: default;
        }
        .neo-cell:not(.empty):hover {
          background: #27354c;
        }
        
        .neo-cell.selected {
          background: #2563eb;
          box-shadow: 0 10px 25px rgba(37, 99, 235, 0.4);
          transform: translateY(-2px);
        }

        .neo-date-num {
          color: #e2e8f0;
          font-size: 1.1rem;
          font-weight: 500;
          margin-bottom: 10px;
        }
        .neo-date-num.today {
          color: var(--accent-primary);
          font-weight: 900;
        }
        .neo-cell.selected .neo-date-num { color: #fff; }

        .neo-events {
          display: flex;
          flex-direction: column;
          gap: 6px;
          min-width: 0;
          width: 100%;
        }
        .neo-event-indicator {
          display: flex;
          align-items: center;
          gap: 6px;
          min-width: 0; 
          width: 100%;
        }
        .neo-event-bar {
          width: 3px;
          height: 12px;
          border-radius: 2px;
          flex-shrink: 0;
        }
        .neo-event-title {
          color: #cbd5e1;
          font-size: 0.75rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          flex: 1; 
          min-width: 0;
        }
        .neo-cell.selected .neo-event-title {
          color: rgba(255,255,255,0.9);
        }
        .neo-event-more {
          color: #64748b;
          font-size: 0.7rem;
          font-weight: bold;
          margin-top: 4px;
        }

        /* RIGHT SIDE: AGENDA SIDEBAR */
        .neo-agenda-section {
          width: 360px;
          background: rgba(15, 23, 42, 0.5);
          border: 1px solid #1e293b;
          border-radius: 20px;
          padding: 25px;
          display: flex;
          flex-direction: column;
          max-height: 800px;
          flex-shrink: 0;
          box-sizing: border-box;
        }

        .neo-agenda-header {
          margin-bottom: 30px;
        }
        .neo-agenda-header h3 {
          margin: 0 0 5px 0;
          color: #fff;
          font-size: 1.6rem;
          font-weight: 500;
        }
        .neo-agenda-date {
          color: #94a3b8;
          font-size: 0.9rem;
        }

        .neo-agenda-list {
          display: flex;
          flex-direction: column;
          gap: 20px;
          overflow-y: auto;
          padding-right: 10px;
        }
        
        .neo-agenda-list::-webkit-scrollbar { width: 6px; }
        .neo-agenda-list::-webkit-scrollbar-track { background: transparent; }
        .neo-agenda-list::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }

        .neo-agenda-card {
          width: 100%;
          box-sizing: border-box;
          background: #111827; 
          border-radius: 16px;
          padding: 20px;
          display: flex;
          flex-direction: column;
          position: relative;
          border: 1px solid #1e293b;
          overflow: hidden; 
        }

        .neo-ac-accent {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 4px;
          border-top-left-radius: 16px;
          border-top-right-radius: 16px;
        }

        .neo-ac-time-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
          font-size: 0.85rem;
        }

        .neo-ac-content {
          display: flex;
          flex-direction: column;
          min-width: 0; 
        }

        .neo-ac-title {
          margin: 0 0 6px 0;
          color: #fff;
          font-size: 1.05rem;
          font-weight: 600;
          white-space: normal;
          word-wrap: break-word; 
        }
        
        .neo-ac-desc {
          margin: 0 0 15px 0;
          color: #94a3b8;
          font-size: 0.85rem;
        }
        
        .neo-ac-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.8rem;
          color: #64748b;
          margin-bottom: 15px;
          padding-bottom: 15px;
          border-bottom: 1px solid #1e293b;
        }
        .neo-ac-detail {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .neo-ac-members {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .neo-avatar {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: rgba(56, 189, 248, 0.1);
          color: var(--accent-primary);
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid #0284c7;
        }

        /* RESPONSIVE FLUIDITY */
        @media (max-width: 1150px) {
          .neo-layout { flex-direction: column; padding: 15px; }
          .neo-agenda-section { width: 100%; max-height: none; margin-top: 20px; }
          .neo-days-header div { font-size: 0.7rem; padding-left: 5px; }
        }
        @media (max-width: 600px) {
          .neo-grid { gap: 8px; }
          .neo-cell { padding: 8px; min-height: 90px; border-radius: 10px; }
          .neo-date-num { font-size: 0.9rem; margin-bottom: 4px; }
          .neo-event-title { display: none; } 
          .neo-event-bar { height: 6px; width: 6px; border-radius: 50%; }
        }
      `})]})}export{C as default};