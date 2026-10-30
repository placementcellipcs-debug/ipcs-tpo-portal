import{r as e}from"./rolldown-runtime-XKyaHtl9.js";import{h as t,i as n,m as r,n as i,r as a}from"./index-DXDw_wyo.js";import{F as o,N as s,P as ee,b as c,l as te,t as ne}from"./Layout-BrpAdB5S.js";import{t as l}from"./X.es-D8giDnPx.js";import{t as u}from"./CalendarBlank.es-Bvm7nktC.js";import{t as d}from"./CircleNotch.es-UurZd9yg.js";import{t as f}from"./Clock.es-D6kDGVjA.js";import{t as re}from"./Image.es-DPIiNm-v.js";import{t as ie}from"./Plus.es-BErA-ahL.js";import{a as p,r as m,t as h}from"./dateFormat-BXNi2L40.js";import{t as g}from"./DateInput--etFqP7_.js";var _=e(t(),1),v=e(r(),1),y=i(),ae=[`Information technology (IT)`,`BMS AND CCTV`,`Embedded and IoT`,`Industrial Automation`,`Digital Marketing`],b=e=>p(e),x=e=>(Array.isArray(e)?e:String(e||``).split(/[\n,;]+/)).map(e=>String(e||``).trim()).find(e=>e&&!/^all(?:\s+branches)?$/i.test(e))||``;function S(){let e=localStorage.getItem(`tpoData`),t=e?JSON.parse(e):null,r=String(t?.role||``).toUpperCase(),i=[`DESIGN`,`MEDIA`,`CREATIVE`].some(e=>r.includes(e)),p=r.includes(`TPO`)||r.includes(`PLACEMENT OFFICER`),S=t?.accessType===`superadmin`||r.includes(`TPO`)||r.includes(`PLACEMENT OFFICER`),oe=x(t?.assignedBranchesArray),[C,w]=(0,_.useState)([]),[T,E]=(0,_.useState)([]),[se,D]=(0,_.useState)(!0),[O,k]=(0,_.useState)(new Date),[A,j]=(0,_.useState)(new Date),[M,N]=(0,_.useState)(!1),[P,F]=(0,_.useState)(null),[I,L]=(0,_.useState)(!1),[R,z]=(0,_.useState)(null),[B,V]=(0,_.useState)(!1),[H,U]=(0,_.useState)(null),[W,G]=(0,_.useState)({date:``,time:``,branch:`All Branches`,type:`Placement Drive`,title:``,description:``,location:``,course:``}),[K,q]=(0,_.useState)(null);(0,_.useEffect)(()=>{if(!M&&!P)return;let e=document.body.style.overflow;return document.body.style.overflow=`hidden`,()=>{document.body.style.overflow=e}},[M,P]);let J=async()=>{try{D(!0);let e=await n.get(`${a}/api/tpo/events`);e.data.success&&w(e.data.events||[])}catch(e){console.error(`Failed to fetch events`,e)}finally{D(!1)}},ce=async e=>{if(e){for(let t=0;t<12;t+=1){await new Promise(e=>window.setTimeout(e,5e3));try{let t=((await n.get(`https://api-placement.ipcstalenzo.com/api/tpo/events`)).data?.events||[]).find(t=>t.eventId===e),r=String(t?.mailStatus||``).toUpperCase();if(r===`SENT`){U({type:`success`,message:`Event saved and notification email sent.`});return}if(r===`FAILED`){U({type:`warning`,message:`Event saved, but the notification email failed: ${t.mailError||`Check the Event sheet mail status.`}`});return}if(r===`QUEUED`){U({type:`warning`,message:`Event saved. Its notification email is queued and will retry automatically.`});return}}catch(e){console.warn(`Could not check event notification status:`,e);return}}U({type:`warning`,message:`Event saved. Email delivery is still pending; check the Event sheet Mail_Status column.`})}},le=async()=>{try{let e=await n.get(`${a}/api/tpo/branches`);if(e.data.success){let t=[...new Set(e.data.branches.map(e=>e.branch).filter(e=>!!e&&![`all`,`all branches`].includes(String(e).trim().toLowerCase())))].sort((e,t)=>e.localeCompare(t));E(t)}}catch(e){console.error(`Failed to fetch branches`,e)}};(0,_.useEffect)(()=>{J(),S&&le()},[S]);let Y=async()=>{if(!W.title||!W.date||!W.type||W.type===`Placement Drive`&&!W.course)return alert(`Please fill in the Event Title, Date, Event Type, and Course for placement drives.`);U(null),L(!0);try{let e=new FormData;e.append(`tpo`,t?.name||`Unknown`);let r={...W};/^all(?:\s+branches)?$/i.test(String(r.branch||``).trim())&&(r.branch=`All Branches`),Object.keys(r).forEach(t=>e.append(t,r[t])),K&&e.append(`posterFile`,K);let i=await n.post(`${a}/api/tpo/events/add`,e,{headers:{"Content-Type":`multipart/form-data`}});if(!i.data?.success)throw Error(i.data?.message||`The event could not be saved.`);i.data.success&&(N(!1),U({type:i.data.mailStatus===`FAILED`?`warning`:`success`,message:i.data.message||`Event saved.`}),G({date:``,time:``,branch:`All Branches`,type:`Placement Drive`,title:``,description:``,location:``,course:``}),q(null),J(),i.data.mailStatus===`PENDING`&&ce(i.data.eventId))}catch(e){let t=e.response?.data?.message||e.message||`The event could not be saved.`;U({type:`error`,message:`Event save failed: ${t}`})}finally{L(!1)}},X=e=>{let t=b(P?.date),n=t&&!Number.isNaN(t.getTime())?`${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,`0`)}-${String(t.getDate()).padStart(2,`0`)}`:``,r=String(P?.time||``).trim();z({action:e,newDate:n,time:r?m(r,``):``,reason:``}),U(null)},ue=async()=>{if(R&&P?.eventKey){if(R.action===`reschedule`&&!R.newDate)U({type:`error`,message:`Choose the new event date before saving.`});else{V(!0);try{let e=R.action===`cancel`?`cancel`:`reschedule`,t={reason:R.reason};e===`reschedule`&&(t.date=R.newDate,t.time=R.time);let r=await n.post(`${a}/api/tpo/events/${encodeURIComponent(P.eventKey)}/${e}`,t);if(!r.data?.success)throw Error(r.data?.message||`The event could not be updated.`);let i=r.data.event;i&&(w(e=>e.map(e=>e.eventKey===i.eventKey?i:e)),F(i)),z(null),U({type:r.data.emailSent?`success`:`warning`,message:r.data.message||`Event updated.`})}catch(e){U({type:`error`,message:e.response?.data?.message||e.message||`The event could not be updated.`})}finally{V(!1)}}}},Z=e=>{if(!e)return`var(--accent-primary)`;let t=String(e).toLowerCase();return t.includes(`talentino`)?`#a855f7`:t.includes(`placement drive`)?`#ef4444`:`#10b981`},de=()=>{let e=new Date(O);e.setMonth(e.getMonth()+1),k(e)},fe=()=>{let e=new Date(O);e.setMonth(e.getMonth()-1),k(e)},Q=e=>{if(i||p)return!0;let n=t?.assignedBranchesArray||[];if(t?.accessType===`superadmin`||n.length===0||n.includes(`all`)||n.includes(`All`))return!0;if((e.type||``).toLowerCase().includes(`talentino`)){let t=(e.branch||``).toLowerCase();return t===`all branches`||t===`all`||n.some(e=>t.includes(e.toLowerCase())||e.toLowerCase().includes(t))}return!0},pe=()=>{let e=O.getFullYear(),t=O.getMonth(),n=new Date(e,t,1).getDay(),r=new Date(e,t+1,0).getDate(),i=[];for(let e=0;e<n;e++)i.push((0,y.jsx)(`div`,{className:`neo-cell empty`},`empty-${e}`));for(let n=1;n<=r;n++){let r=new Date(e,t,n),a=n===new Date().getDate()&&t===new Date().getMonth()&&e===new Date().getFullYear(),o=A&&r.toDateString()===A.toDateString(),s=C.filter(e=>{if(!Q(e))return!1;let t=b(e.date);return t&&t.getFullYear()===r.getFullYear()&&t.getMonth()===r.getMonth()&&t.getDate()===r.getDate()});i.push((0,y.jsxs)(`div`,{className:`neo-cell ${o?`selected`:``}`,onClick:()=>j(r),children:[(0,y.jsx)(`div`,{className:`neo-date-num ${a&&!o?`today`:``}`,children:n}),(0,y.jsxs)(`div`,{className:`neo-events`,children:[s.slice(0,3).map((e,t)=>(0,y.jsxs)(`div`,{className:`neo-event-indicator hover-lift`,style:{cursor:`pointer`},onClick:t=>{t.stopPropagation(),F(e)},children:[(0,y.jsx)(`span`,{className:`neo-event-bar`,style:{background:String(e.status||``).toLowerCase()===`cancelled`?`#ef4444`:String(e.status||``).toLowerCase()===`rescheduled`?`#f59e0b`:o?`rgba(255,255,255,0.8)`:Z(e.type)}}),(0,y.jsx)(`span`,{className:`neo-event-title`,style:{color:o?`#fff`:`#cbd5e1`,textDecoration:String(e.status||``).toLowerCase()===`cancelled`?`line-through`:`none`},children:e.title})]},t)),s.length>3&&(0,y.jsxs)(`div`,{className:`neo-event-more`,style:{color:o?`rgba(255,255,255,0.7)`:`#64748b`},children:[`+`,s.length-3,` more`]})]})]},n))}return i},$=A?C.filter(e=>{if(!Q(e))return!1;let t=b(e.date);return t&&t.toDateString()===A.toDateString()}):[];return(0,y.jsxs)(ne,{children:[(0,y.jsxs)(`div`,{className:`page-container`,style:{padding:0},children:[H&&!P&&(0,y.jsx)(`div`,{role:H.type===`error`?`alert`:`status`,style:{marginBottom:`16px`,padding:`13px 16px`,borderRadius:`12px`,border:`1px solid ${H.type===`error`?`rgba(248,113,113,.35)`:H.type===`warning`?`rgba(251,191,36,.35)`:`rgba(52,211,153,.35)`}`,background:H.type===`error`?`rgba(127,29,29,.2)`:H.type===`warning`?`rgba(120,53,15,.2)`:`rgba(6,78,59,.22)`,color:H.type===`error`?`#fecaca`:H.type===`warning`?`#fde68a`:`#a7f3d0`},children:H.message}),(0,y.jsxs)(`div`,{style:{display:`flex`,justifyContent:`space-between`,alignItems:`center`,marginBottom:`1.5rem`,flexWrap:`wrap`,gap:`15px`},children:[(0,y.jsxs)(`div`,{children:[(0,y.jsxs)(`h1`,{style:{fontSize:`2rem`,margin:`0 0 5px 0`,color:`#fff`},children:[`Morning, `,String(t?.name||`Alex`).split(` `)[0],`!`]}),(0,y.jsx)(`p`,{style:{color:`#94a3b8`,margin:0,fontSize:`1.05rem`},children:`Here's what's on your agenda today.`})]}),S&&(0,y.jsxs)(`button`,{className:`btn-action`,style:{width:`auto`,borderRadius:`12px`,display:`flex`,alignItems:`center`,gap:`8px`,padding:`12px 20px`,background:`var(--accent-primary)`,color:`#0f172a`},onClick:()=>N(!0),children:[(0,y.jsx)(ie,{weight:`bold`}),` Add Event`]})]}),(0,y.jsxs)(`div`,{className:`neo-layout`,children:[(0,y.jsxs)(`div`,{className:`neo-calendar-section`,children:[(0,y.jsxs)(`div`,{className:`neo-toolbar`,children:[(0,y.jsxs)(`div`,{className:`neo-month-display`,children:[O.toLocaleString(`default`,{month:`long`}),` `,(0,y.jsx)(o,{size:14,weight:`bold`,style:{marginLeft:`8px`,marginRight:`20px`,color:`#64748b`}}),O.getFullYear(),` `,(0,y.jsx)(o,{size:14,weight:`bold`,style:{marginLeft:`8px`,color:`#64748b`}})]}),(0,y.jsxs)(`div`,{className:`neo-nav-arrows`,children:[(0,y.jsx)(`button`,{onClick:fe,children:(0,y.jsx)(ee,{size:16,weight:`bold`})}),(0,y.jsx)(`button`,{onClick:de,children:(0,y.jsx)(s,{size:16,weight:`bold`})})]})]}),(0,y.jsx)(`div`,{className:`neo-days-header`,children:[`Sunday`,`Monday`,`Tuesday`,`Wednesday`,`Thursday`,`Friday`,`Saturday`].map(e=>(0,y.jsx)(`div`,{children:e},e))}),(0,y.jsx)(`div`,{className:`neo-grid`,children:se?(0,y.jsx)(`div`,{style:{gridColumn:`1 / -1`,textAlign:`center`,padding:`5rem`,color:`var(--accent-primary)`},children:(0,y.jsx)(d,{size:48,className:`ph-spin`})}):pe()})]}),A&&(0,y.jsxs)(`div`,{className:`neo-agenda-section`,children:[(0,y.jsxs)(`div`,{className:`neo-agenda-header`,style:{display:`flex`,justifyContent:`space-between`,alignItems:`flex-start`},children:[(0,y.jsxs)(`div`,{children:[(0,y.jsx)(`h3`,{children:`Scheduled`}),(0,y.jsx)(`div`,{className:`neo-agenda-date`,children:h(A)})]}),(0,y.jsx)(`button`,{onClick:()=>j(null),style:{background:`rgba(255,255,255,0.05)`,border:`none`,color:`#94a3b8`,padding:`6px`,borderRadius:`50%`,cursor:`pointer`,display:`flex`,transition:`0.2s`},title:`Close Agenda`,children:(0,y.jsx)(l,{size:18,weight:`bold`})})]}),(0,y.jsx)(`div`,{className:`neo-agenda-list`,children:$.length===0?(0,y.jsxs)(`div`,{style:{color:`#64748b`,fontSize:`0.9rem`,textAlign:`center`,marginTop:`2rem`},children:[(0,y.jsx)(u,{size:32,style:{opacity:.5,marginBottom:`10px`}}),(0,y.jsx)(`br`,{}),`No events scheduled for this day.`]}):$.map((e,t)=>(0,y.jsxs)(`div`,{className:`neo-agenda-card hover-lift`,onClick:()=>F(e),style:{cursor:`pointer`},children:[(0,y.jsx)(`div`,{className:`neo-ac-accent`,style:{background:Z(e.type)}}),(0,y.jsx)(`div`,{className:`neo-ac-time-row`,children:(0,y.jsx)(`span`,{style:{color:`#fff`,fontWeight:`bold`},children:m(e.time,`09:00:00`)})}),(0,y.jsxs)(`div`,{className:`neo-ac-content`,children:[(0,y.jsx)(`h4`,{className:`neo-ac-title`,children:e.title}),(0,y.jsxs)(`p`,{className:`neo-ac-desc`,children:[e.type,e.course?` • ${e.course}`:``]}),String(e.status||`Scheduled`).toLowerCase()!==`scheduled`&&(0,y.jsx)(`span`,{className:`event-status-pill ${String(e.status).toLowerCase()===`cancelled`?`cancelled`:`rescheduled`}`,children:e.status}),(0,y.jsxs)(`div`,{className:`neo-ac-footer`,children:[(0,y.jsxs)(`div`,{className:`neo-ac-detail`,children:[(0,y.jsx)(f,{size:14}),` `,e.time?m(e.time):`All Day`]}),(0,y.jsxs)(`div`,{className:`neo-ac-detail`,children:[(0,y.jsx)(c,{size:14}),` `,e.location||`Online`]})]}),(0,y.jsxs)(`div`,{className:`neo-ac-members`,children:[(0,y.jsx)(`div`,{className:`neo-avatar`,children:(0,y.jsx)(te,{size:14})}),(0,y.jsxs)(`span`,{style:{fontSize:`0.8rem`,color:`#cbd5e1`},children:[e.tpo||`System`,` • `,e.branch===`All Branches`?`Global`:e.branch]})]})]})]},t))})]})]})]}),M&&(0,v.createPortal)((0,y.jsx)(`div`,{className:`event-modal-backdrop`,onClick:e=>{e.target===e.currentTarget&&N(!1)},children:(0,y.jsxs)(`div`,{className:`event-modal-dialog`,style:{maxWidth:`600px`},children:[(0,y.jsxs)(`div`,{style:{display:`flex`,justifyContent:`space-between`,alignItems:`center`,marginBottom:`1.5rem`,borderBottom:`1px solid #1e293b`,paddingBottom:`15px`},children:[(0,y.jsx)(`h3`,{style:{margin:0,fontSize:`1.4rem`,color:`#fff`},children:`Add New Event`}),(0,y.jsx)(l,{size:24,style:{cursor:`pointer`,color:`#94a3b8`},onClick:()=>N(!1)})]}),(0,y.jsxs)(`div`,{className:`form-group`,style:{marginBottom:`15px`},children:[(0,y.jsx)(`label`,{style:{display:`block`,fontSize:`0.8rem`,color:`#94a3b8`,marginBottom:`5px`,fontWeight:`bold`},children:`Event Title`}),(0,y.jsx)(`input`,{type:`text`,className:`sleek-input`,style:{width:`100%`},value:W.title,onChange:e=>G({...W,title:e.target.value}),placeholder:`e.g. Wipro Placement Drive`})]}),(0,y.jsxs)(`div`,{className:`event-form-grid`,style:{display:`grid`,gridTemplateColumns:`repeat(2, minmax(0, 1fr))`,gap:`15px`,marginBottom:`15px`},children:[(0,y.jsxs)(`div`,{className:`form-group`,children:[(0,y.jsx)(`label`,{style:{display:`block`,fontSize:`0.8rem`,color:`#94a3b8`,marginBottom:`5px`,fontWeight:`bold`},children:`Date *`}),(0,y.jsx)(g,{className:`sleek-input`,style:{width:`100%`},value:W.date,onChange:e=>G({...W,date:e.target.value})})]}),(0,y.jsxs)(`div`,{className:`form-group`,children:[(0,y.jsx)(`label`,{style:{display:`block`,fontSize:`0.8rem`,color:`#94a3b8`,marginBottom:`5px`,fontWeight:`bold`},children:`Time`}),(0,y.jsx)(`input`,{type:`time`,step:`1`,className:`sleek-input`,style:{width:`100%`},value:W.time,onChange:e=>G({...W,time:e.target.value})})]})]}),(0,y.jsxs)(`div`,{className:`event-form-grid`,style:{display:`grid`,gridTemplateColumns:`repeat(2, minmax(0, 1fr))`,gap:`15px`,marginBottom:`15px`},children:[(0,y.jsxs)(`div`,{className:`form-group`,children:[(0,y.jsx)(`label`,{style:{display:`block`,fontSize:`0.8rem`,color:`#94a3b8`,marginBottom:`5px`,fontWeight:`bold`},children:`Event Type *`}),(0,y.jsxs)(`select`,{className:`sleek-input`,style:{width:`100%`},value:W.type,onChange:e=>{let t=e.target.value;G(e=>({...e,type:t,course:t===`Placement Drive`?e.course:``,branch:t===`Talentino`&&/^all(?:\s+branches)?$/i.test(String(e.branch||``).trim())&&oe||e.branch}))},children:[(0,y.jsx)(`option`,{value:`Placement Drive`,children:`Placement Drive`}),(0,y.jsx)(`option`,{value:`Talentino`,children:`Talentino`})]})]}),(0,y.jsxs)(`div`,{className:`form-group`,children:[(0,y.jsx)(`label`,{style:{display:`block`,fontSize:`0.8rem`,color:`#94a3b8`,marginBottom:`5px`,fontWeight:`bold`},children:`Event Location`}),(0,y.jsx)(`input`,{type:`text`,className:`sleek-input`,style:{width:`100%`},value:W.location,onChange:e=>G({...W,location:e.target.value}),placeholder:`e.g. Bangalore Branch, Online`})]})]}),W.type===`Placement Drive`&&(0,y.jsxs)(`div`,{className:`form-group`,style:{marginBottom:`15px`},children:[(0,y.jsx)(`label`,{style:{display:`block`,fontSize:`0.8rem`,color:`#94a3b8`,marginBottom:`5px`,fontWeight:`bold`},children:`Eligible Course *`}),(0,y.jsxs)(`select`,{className:`sleek-input`,style:{width:`100%`},value:W.course,onChange:e=>G({...W,course:e.target.value}),required:!0,children:[(0,y.jsx)(`option`,{value:``,children:`Select a course`}),ae.map(e=>(0,y.jsx)(`option`,{value:e,children:e},e))]})]}),(0,y.jsxs)(`div`,{className:`form-group`,style:{marginBottom:`15px`},children:[(0,y.jsx)(`label`,{style:{display:`block`,fontSize:`0.8rem`,color:`#94a3b8`,marginBottom:`5px`,fontWeight:`bold`},children:`Eligible Branch`}),(0,y.jsxs)(`select`,{className:`sleek-input`,style:{width:`100%`},value:W.branch,onChange:e=>G({...W,branch:e.target.value}),children:[(0,y.jsx)(`option`,{value:`All Branches`,children:`All Branches`}),T.map((e,t)=>(0,y.jsx)(`option`,{value:e,children:e},t))]})]}),(0,y.jsxs)(`div`,{className:`form-group`,style:{marginBottom:`20px`},children:[(0,y.jsx)(`label`,{style:{display:`block`,fontSize:`0.8rem`,color:`#94a3b8`,marginBottom:`5px`,fontWeight:`bold`},children:`Description`}),(0,y.jsx)(`textarea`,{className:`sleek-input`,style:{width:`100%`,minHeight:`80px`,resize:`vertical`},value:W.description,onChange:e=>G({...W,description:e.target.value}),placeholder:`Add instructions or meeting links...`})]}),W.type===`Placement Drive`&&(0,y.jsxs)(`div`,{className:`form-group`,style:{marginBottom:`25px`,background:`rgba(56, 189, 248, 0.05)`,padding:`15px`,borderRadius:`12px`,border:`1px dashed var(--accent-primary)`},children:[(0,y.jsx)(`label`,{style:{display:`block`,fontSize:`0.8rem`,color:`var(--accent-primary)`,marginBottom:`8px`,fontWeight:`bold`},children:`Upload Drive Poster (Optional)`}),(0,y.jsx)(`input`,{type:`file`,accept:`image/*`,className:`sleek-input`,style:{width:`100%`,padding:`8px`},onChange:e=>q(e.target.files[0])})]}),H?.type===`error`&&(0,y.jsx)(`div`,{role:`alert`,style:{marginBottom:`16px`,padding:`12px 14px`,borderRadius:`10px`,border:`1px solid rgba(248,113,113,.35)`,background:`rgba(127,29,29,.2)`,color:`#fecaca`},children:H.message}),(0,y.jsxs)(`div`,{style:{display:`flex`,justifyContent:`flex-end`,gap:`10px`,borderTop:`1px solid #1e293b`,paddingTop:`1.5rem`},children:[(0,y.jsx)(`button`,{className:`btn-secondary`,style:{background:`transparent`,border:`1px solid #334155`,color:`#f8fafc`,padding:`10px 20px`,borderRadius:`10px`,cursor:`pointer`,fontWeight:`bold`},onClick:()=>N(!1),children:`Cancel`}),(0,y.jsx)(`button`,{className:`btn-action`,style:{background:`var(--accent-primary)`,color:`#0f172a`,padding:`10px 20px`,borderRadius:`10px`,cursor:`pointer`,fontWeight:`bold`,border:`none`},onClick:Y,disabled:I,children:I?(0,y.jsx)(d,{size:18,className:`ph-spin`}):`Save Event`})]})]})}),document.body),P&&(0,v.createPortal)((0,y.jsx)(`div`,{className:`event-modal-backdrop`,onClick:e=>{e.target===e.currentTarget&&F(null)},children:(0,y.jsxs)(`div`,{className:`event-modal-dialog`,style:{maxWidth:`680px`},children:[(0,y.jsxs)(`div`,{style:{borderBottom:`1px solid #1e293b`,paddingBottom:`15px`,marginBottom:`20px`,display:`flex`,justifyContent:`space-between`,alignItems:`flex-start`},children:[(0,y.jsxs)(`div`,{children:[(0,y.jsx)(`span`,{style:{background:`rgba(255,255,255,0.05)`,color:Z(P.type),padding:`6px 12px`,borderRadius:`8px`,fontSize:`0.75rem`,fontWeight:`bold`,display:`inline-block`,marginBottom:`10px`},children:String(P.type||`Event`)}),(0,y.jsx)(`h2`,{style:{margin:`0 0 5px 0`,fontSize:`1.6rem`,color:`#fff`},children:String(P.title||`Untitled Event`)}),P.eventId&&(0,y.jsxs)(`div`,{style:{color:`var(--accent-primary)`,fontSize:`0.85rem`,fontWeight:`bold`},children:[`Event ID: `,String(P.eventId)]}),(0,y.jsx)(`span`,{className:`event-status-pill ${String(P.status||`Scheduled`).toLowerCase()===`cancelled`?`cancelled`:String(P.status||`Scheduled`).toLowerCase()===`rescheduled`?`rescheduled`:`scheduled`}`,children:String(P.status||`Scheduled`)})]}),(0,y.jsx)(`button`,{style:{background:`rgba(255,255,255,0.05)`,border:`none`,color:`#94a3b8`,padding:`8px`,borderRadius:`50%`,cursor:`pointer`,display:`flex`,transition:`0.2s`},onClick:()=>F(null),title:`Close`,children:(0,y.jsx)(l,{size:20,weight:`bold`})})]}),(0,y.jsxs)(`div`,{className:`event-detail-grid`,style:{display:`grid`,gridTemplateColumns:`repeat(2, minmax(0, 1fr))`,gap:`15px`,marginBottom:`20px`},children:[(0,y.jsxs)(`div`,{style:{background:`#1e293b`,padding:`15px`,borderRadius:`12px`},children:[(0,y.jsx)(`div`,{style:{fontSize:`0.7rem`,color:`#94a3b8`,textTransform:`uppercase`,fontWeight:`bold`,marginBottom:`5px`},children:`Date & Time`}),(0,y.jsxs)(`div`,{style:{color:`#fff`,fontSize:`0.95rem`,fontWeight:600,display:`flex`,alignItems:`center`,gap:`6px`},children:[(0,y.jsx)(f,{size:16,color:`var(--accent-primary)`}),` `,h(P.date,`TBD`),` • `,m(P.time,`TBD`)]})]}),(0,y.jsxs)(`div`,{style:{background:`#1e293b`,padding:`15px`,borderRadius:`12px`},children:[(0,y.jsx)(`div`,{style:{fontSize:`0.7rem`,color:`#94a3b8`,textTransform:`uppercase`,fontWeight:`bold`,marginBottom:`5px`},children:`Location & Branch`}),(0,y.jsxs)(`div`,{style:{color:`#fff`,fontSize:`0.95rem`,fontWeight:600,display:`flex`,alignItems:`center`,gap:`6px`},children:[(0,y.jsx)(c,{size:16,color:`#f59e0b`}),` `,String(P.location||`Online`)]}),(0,y.jsxs)(`div`,{style:{color:`#cbd5e1`,fontSize:`0.85rem`,marginTop:`4px`},children:[`Branch: `,String(P.branch||`Global`)]})]}),P.course&&(0,y.jsxs)(`div`,{style:{background:`#1e293b`,padding:`15px`,borderRadius:`12px`},children:[(0,y.jsx)(`div`,{style:{fontSize:`0.7rem`,color:`#94a3b8`,textTransform:`uppercase`,fontWeight:`bold`,marginBottom:`5px`},children:`Eligible Course`}),(0,y.jsx)(`div`,{style:{color:`#fff`,fontSize:`0.95rem`,fontWeight:600},children:String(P.course)})]})]}),P.description&&(0,y.jsxs)(`div`,{style:{background:`rgba(255,255,255,0.02)`,padding:`20px`,borderRadius:`12px`,border:`1px solid rgba(255,255,255,0.05)`,marginBottom:`20px`},children:[(0,y.jsx)(`div`,{style:{fontSize:`0.75rem`,color:`#94a3b8`,textTransform:`uppercase`,fontWeight:`bold`,marginBottom:`8px`},children:`Description`}),(0,y.jsx)(`div`,{style:{color:`#e2e8f0`,fontSize:`0.95rem`,lineHeight:`1.6`,whiteSpace:`pre-wrap`},children:String(P.description)})]}),P.poster&&P.poster!==`N/A`&&(0,y.jsxs)(`div`,{style:{marginTop:`20px`},children:[(0,y.jsx)(`div`,{style:{fontSize:`0.75rem`,color:`#94a3b8`,textTransform:`uppercase`,fontWeight:`bold`,marginBottom:`10px`},children:`Event Poster Attached`}),(0,y.jsxs)(`button`,{className:`btn-secondary hover-lift`,style:{background:`rgba(56, 189, 248, 0.1)`,border:`1px solid rgba(56, 189, 248, 0.3)`,color:`var(--accent-primary)`,width:`100%`,padding:`15px`,borderRadius:`12px`,cursor:`pointer`,display:`flex`,justifyContent:`center`,alignItems:`center`,gap:`8px`,fontWeight:`bold`,fontSize:`1rem`,transition:`0.2s`},onClick:()=>window.open(P.poster,`_blank`),children:[(0,y.jsx)(re,{size:22,weight:`fill`}),` View Full Event Poster`]})]}),P.statusReason&&(0,y.jsxs)(`div`,{style:{marginTop:`16px`,padding:`12px 14px`,background:`rgba(255,255,255,0.04)`,border:`1px solid rgba(148,163,184,.15)`,borderRadius:`10px`,color:`#cbd5e1`,fontSize:`.9rem`},children:[(0,y.jsx)(`strong`,{style:{color:`#94a3b8`},children:`Latest update:`}),` `,String(P.statusReason)]}),H&&(0,y.jsx)(`div`,{role:H.type===`error`?`alert`:`status`,style:{marginTop:`16px`,padding:`12px 14px`,borderRadius:`10px`,border:`1px solid ${H.type===`error`?`rgba(248,113,113,.35)`:H.type===`warning`?`rgba(251,191,36,.35)`:`rgba(52,211,153,.35)`}`,background:H.type===`error`?`rgba(127,29,29,.2)`:H.type===`warning`?`rgba(120,53,15,.2)`:`rgba(6,78,59,.22)`,color:H.type===`error`?`#fecaca`:H.type===`warning`?`#fde68a`:`#a7f3d0`},children:H.message}),S&&String(P.status||``).toLowerCase()!==`cancelled`&&(0,y.jsxs)(`div`,{className:`event-action-row`,children:[(0,y.jsxs)(`button`,{type:`button`,onClick:()=>X(`reschedule`),disabled:B,className:`event-reschedule-button`,children:[(0,y.jsx)(u,{size:18}),` Reschedule Event`]}),(0,y.jsxs)(`button`,{type:`button`,onClick:()=>X(`cancel`),disabled:B,className:`event-cancel-button`,children:[(0,y.jsx)(l,{size:18}),` Cancel Event`]})]})]})}),document.body),R&&P&&(0,v.createPortal)((0,y.jsx)(`div`,{className:`event-modal-backdrop event-action-layer`,onClick:e=>{e.target===e.currentTarget&&!B&&z(null)},children:(0,y.jsxs)(`div`,{className:`event-modal-dialog event-action-dialog`,role:`dialog`,"aria-modal":`true`,"aria-labelledby":`event-action-title`,children:[(0,y.jsxs)(`div`,{style:{display:`flex`,justifyContent:`space-between`,gap:`16px`,alignItems:`flex-start`,marginBottom:`18px`},children:[(0,y.jsxs)(`div`,{children:[(0,y.jsx)(`span`,{className:`event-status-pill ${R.action===`cancel`?`cancelled`:`rescheduled`}`,children:R.action===`cancel`?`Cancellation notice`:`Schedule update`}),(0,y.jsx)(`h2`,{id:`event-action-title`,style:{color:`#fff`,margin:`8px 0 0`,fontSize:`1.35rem`},children:R.action===`cancel`?`Cancel this event?`:`Reschedule this event`}),(0,y.jsx)(`div`,{style:{color:`#94a3b8`,marginTop:`5px`},children:String(P.title||`Untitled Event`)})]}),(0,y.jsx)(`button`,{type:`button`,"aria-label":`Close`,onClick:()=>!B&&z(null),style:{border:0,background:`transparent`,color:`#94a3b8`,cursor:`pointer`},children:(0,y.jsx)(l,{size:22})})]}),R.action===`reschedule`&&(0,y.jsxs)(`div`,{className:`event-form-grid`,style:{display:`grid`,gridTemplateColumns:`repeat(2, minmax(0, 1fr))`,gap:`14px`,marginBottom:`14px`},children:[(0,y.jsxs)(`label`,{style:{color:`#cbd5e1`,fontSize:`.82rem`,fontWeight:700},children:[`New date *`,(0,y.jsx)(g,{className:`sleek-input`,value:R.newDate,onChange:e=>z(t=>({...t,newDate:e.target.value})),required:!0})]}),(0,y.jsxs)(`label`,{style:{color:`#cbd5e1`,fontSize:`.82rem`,fontWeight:700},children:[`New time`,(0,y.jsx)(`input`,{type:`time`,step:`1`,className:`sleek-input`,value:R.time,onChange:e=>z(t=>({...t,time:e.target.value}))})]})]}),(0,y.jsx)(`label`,{style:{display:`block`,color:`#cbd5e1`,fontSize:`.82rem`,fontWeight:700,marginBottom:`8px`},children:R.action===`cancel`?`Reason for cancellation (optional)`:`Message for recipients (optional)`}),(0,y.jsx)(`textarea`,{className:`sleek-input`,rows:3,maxLength:1e3,value:R.reason,onChange:e=>z(t=>({...t,reason:e.target.value})),placeholder:R.action===`cancel`?`Add a short explanation for the cancellation…`:`Add any instructions or context for the revised schedule…`}),(0,y.jsx)(`div`,{className:`event-audience-note`,children:`The notice will be sent to the recipients assigned to this event type and branch.`}),H&&(0,y.jsx)(`div`,{role:H.type===`error`?`alert`:`status`,style:{marginTop:`12px`,padding:`11px 12px`,borderRadius:`9px`,border:`1px solid ${H.type===`error`?`rgba(248,113,113,.35)`:H.type===`warning`?`rgba(251,191,36,.35)`:`rgba(52,211,153,.35)`}`,background:H.type===`error`?`rgba(127,29,29,.2)`:H.type===`warning`?`rgba(120,53,15,.2)`:`rgba(6,78,59,.22)`,color:H.type===`error`?`#fecaca`:H.type===`warning`?`#fde68a`:`#a7f3d0`,fontSize:`.88rem`},children:H.message}),(0,y.jsxs)(`div`,{style:{display:`flex`,justifyContent:`flex-end`,gap:`10px`,marginTop:`20px`,paddingTop:`16px`,borderTop:`1px solid #253247`},children:[(0,y.jsx)(`button`,{type:`button`,className:`event-action-secondary`,disabled:B,onClick:()=>z(null),children:`Back`}),(0,y.jsx)(`button`,{type:`button`,className:R.action===`cancel`?`event-action-confirm-cancel`:`event-action-confirm-reschedule`,disabled:B,onClick:ue,children:B?(0,y.jsx)(d,{size:18,className:`ph-spin`}):R.action===`cancel`?`Cancel Event & Notify`:`Save New Schedule & Notify`})]})]})}),document.body),(0,y.jsx)(`style`,{children:`
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
      `})]})}export{S as default};