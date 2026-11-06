import{r as e}from"./rolldown-runtime-XKyaHtl9.js";import{h as t,i as n,m as r,n as i,r as a}from"./index-U1jni94N.js";import{t as o}from"./X.es-DDaWs-Id.js";import{D as s,H as c,U as l,V as u,m as d,t as ee}from"./Layout-D2LaIxbM.js";import{t as f}from"./CalendarBlank.es-D30JZwtV.js";import{t as p}from"./CircleNotch.es-h-yhOzaD.js";import{t as m}from"./Clock.es-DOehPv2O.js";import{t as te}from"./Image.es-3iVWbTwK.js";import{t as ne}from"./Plus.es-DViZynen.js";import{a as h,r as g,t as _}from"./dateFormat-0JZDQOs7.js";import{t as v}from"./DateInput-Dkq1sB8N.js";var y=e(t(),1),b=e(r(),1),x=i(),re=[`Information technology (IT)`,`BMS AND CCTV`,`Embedded and IoT`,`Industrial Automation`,`Digital Marketing`],S=e=>h(e),ie=e=>(Array.isArray(e)?e:String(e||``).split(/[\n,;]+/)).map(e=>String(e||``).trim()).find(e=>e&&!/^all(?:\s+branches)?$/i.test(e))||``;function C(){let e=localStorage.getItem(`tpoData`),t=e?JSON.parse(e):null,r=String(t?.role||``).toUpperCase(),i=[`DESIGN`,`MEDIA`,`CREATIVE`].some(e=>r.includes(e)),h=r.includes(`TPO`)||r.includes(`PLACEMENT OFFICER`),C=t?.accessType===`superadmin`||r.includes(`TPO`)||r.includes(`PLACEMENT OFFICER`),ae=ie(t?.assignedBranchesArray),[w,T]=(0,y.useState)([]),[E,oe]=(0,y.useState)([]),[se,D]=(0,y.useState)(!0),[O,k]=(0,y.useState)(new Date),[A,j]=(0,y.useState)(null),[M,N]=(0,y.useState)(!1),[P,F]=(0,y.useState)(null),[I,L]=(0,y.useState)(!1),[R,z]=(0,y.useState)(null),[B,V]=(0,y.useState)(!1),[H,U]=(0,y.useState)(null),[W,G]=(0,y.useState)({date:``,time:``,branch:`All Branches`,type:`Placement Drive`,title:``,description:``,location:``,course:``}),[K,q]=(0,y.useState)(null);(0,y.useEffect)(()=>{if(!M&&!P)return;let e=document.body.style.overflow;return document.body.style.overflow=`hidden`,()=>{document.body.style.overflow=e}},[M,P]);let J=async()=>{try{D(!0);let e=await n.get(`${a}/api/tpo/events`);e.data.success&&T(e.data.events||[])}catch(e){console.error(`Failed to fetch events`,e)}finally{D(!1)}},ce=async e=>{if(e){for(let t=0;t<12;t+=1){await new Promise(e=>window.setTimeout(e,5e3));try{let t=((await n.get(`https://api-placement.ipcstalenzo.com/api/tpo/events`)).data?.events||[]).find(t=>t.eventId===e),r=String(t?.mailStatus||``).toUpperCase();if(r===`SENT`){U({type:`success`,message:`Event saved and notification email sent.`});return}if(r===`FAILED`){U({type:`warning`,message:`Event saved, but the notification email failed: ${t.mailError||`Check the Event sheet mail status.`}`});return}if(r===`QUEUED`){U({type:`warning`,message:`Event saved. Its notification email is queued and will retry automatically.`});return}}catch(e){console.warn(`Could not check event notification status:`,e);return}}U({type:`warning`,message:`Event saved. Email delivery is still pending; check the Event sheet Mail_Status column.`})}},le=async()=>{try{let e=await n.get(`${a}/api/tpo/branches`);if(e.data.success){let t=[...new Set(e.data.branches.map(e=>e.branch).filter(e=>!!e&&![`all`,`all branches`].includes(String(e).trim().toLowerCase())))].sort((e,t)=>e.localeCompare(t));oe(t)}}catch(e){console.error(`Failed to fetch branches`,e)}};(0,y.useEffect)(()=>{J(),C&&le()},[C]);let ue=async()=>{if(!W.title||!W.date||!W.type||W.type===`Placement Drive`&&!W.course)return alert(`Please fill in the Event Title, Date, Event Type, and Course for placement drives.`);U(null),L(!0);try{let e=new FormData;e.append(`tpo`,t?.name||`Unknown`);let r={...W};/^all(?:\s+branches)?$/i.test(String(r.branch||``).trim())&&(r.branch=`All Branches`),Object.keys(r).forEach(t=>e.append(t,r[t])),K&&e.append(`posterFile`,K);let i=await n.post(`${a}/api/tpo/events/add`,e,{headers:{"Content-Type":`multipart/form-data`}});if(!i.data?.success)throw Error(i.data?.message||`The event could not be saved.`);i.data.success&&(N(!1),U({type:i.data.mailStatus===`FAILED`?`warning`:`success`,message:i.data.message||`Event saved.`}),G({date:``,time:``,branch:`All Branches`,type:`Placement Drive`,title:``,description:``,location:``,course:``}),q(null),J(),i.data.mailStatus===`PENDING`&&ce(i.data.eventId))}catch(e){let t=e.response?.data?.message||e.message||`The event could not be saved.`;U({type:`error`,message:`Event save failed: ${t}`})}finally{L(!1)}},Y=e=>{let t=S(P?.date),n=t&&!Number.isNaN(t.getTime())?`${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,`0`)}-${String(t.getDate()).padStart(2,`0`)}`:``,r=String(P?.time||``).trim();z({action:e,newDate:n,time:r?g(r,``):``,reason:``}),U(null)},de=async()=>{if(R&&P?.eventKey){if(R.action===`reschedule`&&!R.newDate)U({type:`error`,message:`Choose the new event date before saving.`});else{V(!0);try{let e=R.action===`cancel`?`cancel`:`reschedule`,t={reason:R.reason};e===`reschedule`&&(t.date=R.newDate,t.time=R.time);let r=await n.post(`${a}/api/tpo/events/${encodeURIComponent(P.eventKey)}/${e}`,t);if(!r.data?.success)throw Error(r.data?.message||`The event could not be updated.`);let i=r.data.event;i&&(T(e=>e.map(e=>e.eventKey===i.eventKey?i:e)),F(i)),z(null),U({type:r.data.emailSent?`success`:`warning`,message:r.data.message||`Event updated.`})}catch(e){U({type:`error`,message:e.response?.data?.message||e.message||`The event could not be updated.`})}finally{V(!1)}}}},X=e=>{if(!e)return`var(--accent-primary)`;let t=String(e).toLowerCase();return t.includes(`talentino`)?`#a855f7`:t.includes(`placement drive`)?`#ef4444`:`#10b981`},fe=()=>{let e=new Date(O);e.setMonth(e.getMonth()+1),k(e),j(null)},pe=()=>{let e=new Date(O);e.setMonth(e.getMonth()-1),k(e),j(null)},Z=e=>{if(i||h)return!0;let n=t?.assignedBranchesArray||[];if(t?.accessType===`superadmin`||n.length===0||n.includes(`all`)||n.includes(`All`))return!0;if((e.type||``).toLowerCase().includes(`talentino`)){let t=(e.branch||``).toLowerCase();return t===`all branches`||t===`all`||n.some(e=>t.includes(e.toLowerCase())||e.toLowerCase().includes(t))}return!0},me=()=>{let e=O.getFullYear(),t=O.getMonth(),n=new Date(e,t,1).getDay(),r=new Date(e,t+1,0).getDate(),i=new Map;w.forEach(n=>{if(!Z(n))return;let r=S(n.date);if(!r||r.getFullYear()!==e||r.getMonth()!==t)return;let a=i.get(r.getDate())||[];a.push(n),i.set(r.getDate(),a)});let a=[],o=Math.ceil((n+r)/7)*7;for(let s=0;s<o;s+=1){let o=s-n+1;if(o<1||o>r){a.push((0,x.jsx)(`div`,{className:`neo-cell empty`,"aria-hidden":`true`},`empty-${s}`));continue}let c=new Date(e,t,o),l=o===new Date().getDate()&&t===new Date().getMonth()&&e===new Date().getFullYear(),u=A&&c.toDateString()===A.toDateString(),d=i.get(o)||[];a.push((0,x.jsxs)(`div`,{className:`neo-cell ${u?`selected`:``} ${l?`is-today`:``}`,children:[(0,x.jsxs)(`button`,{type:`button`,className:`neo-date-num ${l&&!u?`today`:``}`,onClick:()=>j(c),"aria-label":`${c.toLocaleDateString(void 0,{weekday:`long`,month:`long`,day:`numeric`,year:`numeric`})}${d.length?`, ${d.length} ${d.length===1?`event`:`events`}`:``}`,"aria-pressed":!!u,children:[(0,x.jsx)(`span`,{children:o}),d.length>0&&(0,x.jsx)(`span`,{className:`neo-date-count`,children:d.length})]}),(0,x.jsxs)(`div`,{className:`neo-events`,children:[d.slice(0,3).map((e,t)=>(0,x.jsxs)(`button`,{type:`button`,className:`neo-event-indicator hover-lift`,onClick:()=>F(e),"aria-label":`View ${e.title}`,children:[(0,x.jsx)(`span`,{className:`neo-event-bar`,style:{background:String(e.status||``).toLowerCase()===`cancelled`?`#ef4444`:String(e.status||``).toLowerCase()===`rescheduled`?`#f59e0b`:X(e.type)}}),(0,x.jsx)(`span`,{className:`neo-event-title`,style:{textDecoration:String(e.status||``).toLowerCase()===`cancelled`?`line-through`:`none`},children:e.title})]},t)),d.length>3&&(0,x.jsxs)(`div`,{className:`neo-event-more`,children:[`+`,d.length-3,` more`]})]})]},o))}return a},Q=A?w.filter(e=>{if(!Z(e))return!1;let t=S(e.date);return t&&t.toDateString()===A.toDateString()}):[],he=Array.from({length:12},(e,t)=>new Date(2020,t,1).toLocaleString(void 0,{month:`long`})),$=w.filter(e=>{if(!Z(e))return!1;let t=S(e.date);return t&&t.getFullYear()===O.getFullYear()&&t.getMonth()===O.getMonth()}).length,ge=Array.from(new Set([...Array.from({length:9},(e,t)=>new Date().getFullYear()-3+t),...w.map(e=>S(e.date)?.getFullYear()).filter(Number.isFinite),O.getFullYear()])).sort((e,t)=>e-t),_e=e=>{k(new Date(O.getFullYear(),Number(e),1)),j(null)},ve=e=>{k(new Date(Number(e),O.getMonth(),1)),j(null)};return(0,x.jsxs)(ee,{children:[(0,x.jsxs)(`div`,{className:`page-container`,style:{padding:0},children:[H&&!P&&(0,x.jsx)(`div`,{role:H.type===`error`?`alert`:`status`,style:{marginBottom:`16px`,padding:`13px 16px`,borderRadius:`12px`,border:`1px solid ${H.type===`error`?`rgba(248,113,113,.35)`:H.type===`warning`?`rgba(251,191,36,.35)`:`rgba(52,211,153,.35)`}`,background:H.type===`error`?`rgba(127,29,29,.2)`:H.type===`warning`?`rgba(120,53,15,.2)`:`rgba(6,78,59,.22)`,color:H.type===`error`?`#fecaca`:H.type===`warning`?`#fde68a`:`#a7f3d0`},children:H.message}),(0,x.jsxs)(`div`,{style:{display:`flex`,justifyContent:`space-between`,alignItems:`center`,marginBottom:`1.5rem`,flexWrap:`wrap`,gap:`15px`},children:[(0,x.jsxs)(`div`,{children:[(0,x.jsxs)(`h1`,{style:{fontSize:`2rem`,margin:`0 0 5px 0`,color:`#fff`},children:[`Morning, `,String(t?.name||`Alex`).split(` `)[0],`!`]}),(0,x.jsx)(`p`,{style:{color:`#94a3b8`,margin:0,fontSize:`1.05rem`},children:`Here's what's on your agenda today.`})]}),C&&(0,x.jsxs)(`button`,{className:`btn-action`,style:{width:`auto`,borderRadius:`12px`,display:`flex`,alignItems:`center`,gap:`8px`,padding:`12px 20px`,background:`var(--accent-primary)`,color:`#0f172a`},onClick:()=>N(!0),children:[(0,x.jsx)(ne,{weight:`bold`}),` Add Event`]})]}),(0,x.jsxs)(`div`,{className:`neo-layout`,children:[(0,x.jsxs)(`div`,{className:`neo-calendar-section`,children:[(0,x.jsxs)(`div`,{className:`neo-toolbar`,children:[(0,x.jsxs)(`div`,{className:`neo-month-controls`,"aria-label":`Calendar month and year`,children:[(0,x.jsxs)(`label`,{className:`neo-select-wrap`,children:[(0,x.jsx)(`span`,{className:`neo-sr-only`,children:`Month`}),(0,x.jsx)(`select`,{"aria-label":`Month`,value:O.getMonth(),onChange:e=>_e(e.target.value),children:he.map((e,t)=>(0,x.jsx)(`option`,{value:t,children:e},e))}),(0,x.jsx)(l,{size:15,weight:`bold`,"aria-hidden":`true`})]}),(0,x.jsxs)(`label`,{className:`neo-select-wrap neo-year-select`,children:[(0,x.jsx)(`span`,{className:`neo-sr-only`,children:`Year`}),(0,x.jsx)(`select`,{"aria-label":`Year`,value:O.getFullYear(),onChange:e=>ve(e.target.value),children:ge.map(e=>(0,x.jsx)(`option`,{value:e,children:e},e))}),(0,x.jsx)(l,{size:15,weight:`bold`,"aria-hidden":`true`})]})]}),(0,x.jsxs)(`div`,{className:`neo-toolbar-actions`,children:[(0,x.jsxs)(`span`,{className:`neo-month-summary`,children:[(0,x.jsx)(`span`,{"aria-hidden":`true`}),$,` `,$===1?`event`:`events`]}),(0,x.jsx)(`button`,{type:`button`,className:`neo-today-button`,onClick:()=>{let e=new Date;k(e),j(e)},children:`Today`}),(0,x.jsxs)(`div`,{className:`neo-nav-arrows`,children:[(0,x.jsx)(`button`,{type:`button`,"aria-label":`Previous month`,onClick:pe,children:(0,x.jsx)(c,{size:17,weight:`bold`})}),(0,x.jsx)(`button`,{type:`button`,"aria-label":`Next month`,onClick:fe,children:(0,x.jsx)(u,{size:17,weight:`bold`})})]})]})]}),(0,x.jsx)(`div`,{className:`neo-days-header`,children:[`Sun`,`Mon`,`Tue`,`Wed`,`Thu`,`Fri`,`Sat`].map(e=>(0,x.jsx)(`div`,{children:e},e))}),(0,x.jsx)(`div`,{className:`neo-grid`,children:se?(0,x.jsx)(`div`,{style:{gridColumn:`1 / -1`,textAlign:`center`,padding:`5rem`,color:`var(--accent-primary)`},children:(0,x.jsx)(p,{size:48,className:`ph-spin`})}):me()})]}),A&&(0,x.jsxs)(`div`,{className:`neo-agenda-section`,children:[(0,x.jsxs)(`div`,{className:`neo-agenda-header`,style:{display:`flex`,justifyContent:`space-between`,alignItems:`flex-start`},children:[(0,x.jsxs)(`div`,{children:[(0,x.jsx)(`h3`,{children:`Scheduled`}),(0,x.jsx)(`div`,{className:`neo-agenda-date`,children:_(A)})]}),(0,x.jsx)(`button`,{onClick:()=>j(null),style:{background:`rgba(255,255,255,0.05)`,border:`none`,color:`#94a3b8`,padding:`6px`,borderRadius:`50%`,cursor:`pointer`,display:`flex`,transition:`0.2s`},title:`Close Agenda`,children:(0,x.jsx)(o,{size:18,weight:`bold`})})]}),(0,x.jsx)(`div`,{className:`neo-agenda-list`,children:Q.length===0?(0,x.jsxs)(`div`,{style:{color:`#64748b`,fontSize:`0.9rem`,textAlign:`center`,marginTop:`2rem`},children:[(0,x.jsx)(f,{size:32,style:{opacity:.5,marginBottom:`10px`}}),(0,x.jsx)(`br`,{}),`No events scheduled for this day.`]}):Q.map((e,t)=>(0,x.jsxs)(`div`,{className:`neo-agenda-card hover-lift`,onClick:()=>F(e),style:{cursor:`pointer`},children:[(0,x.jsx)(`div`,{className:`neo-ac-accent`,style:{background:X(e.type)}}),(0,x.jsx)(`div`,{className:`neo-ac-time-row`,children:(0,x.jsx)(`span`,{style:{color:`#fff`,fontWeight:`bold`},children:g(e.time,`09:00:00`)})}),(0,x.jsxs)(`div`,{className:`neo-ac-content`,children:[(0,x.jsx)(`h4`,{className:`neo-ac-title`,children:e.title}),(0,x.jsxs)(`p`,{className:`neo-ac-desc`,children:[e.type,e.course?` • ${e.course}`:``]}),String(e.status||`Scheduled`).toLowerCase()!==`scheduled`&&(0,x.jsx)(`span`,{className:`event-status-pill ${String(e.status).toLowerCase()===`cancelled`?`cancelled`:`rescheduled`}`,children:e.status}),(0,x.jsxs)(`div`,{className:`neo-ac-footer`,children:[(0,x.jsxs)(`div`,{className:`neo-ac-detail`,children:[(0,x.jsx)(m,{size:14}),` `,e.time?g(e.time):`All Day`]}),(0,x.jsxs)(`div`,{className:`neo-ac-detail`,children:[(0,x.jsx)(s,{size:14}),` `,e.location||`Online`]})]}),(0,x.jsxs)(`div`,{className:`neo-ac-members`,children:[(0,x.jsx)(`div`,{className:`neo-avatar`,children:(0,x.jsx)(d,{size:14})}),(0,x.jsxs)(`span`,{style:{fontSize:`0.8rem`,color:`#cbd5e1`},children:[e.tpo||`System`,` • `,e.branch===`All Branches`?`Global`:e.branch]})]})]})]},t))})]})]})]}),M&&(0,b.createPortal)((0,x.jsx)(`div`,{className:`event-modal-backdrop`,onClick:e=>{e.target===e.currentTarget&&N(!1)},children:(0,x.jsxs)(`div`,{className:`event-modal-dialog`,style:{maxWidth:`600px`},children:[(0,x.jsxs)(`div`,{style:{display:`flex`,justifyContent:`space-between`,alignItems:`center`,marginBottom:`1.5rem`,borderBottom:`1px solid #1e293b`,paddingBottom:`15px`},children:[(0,x.jsx)(`h3`,{style:{margin:0,fontSize:`1.4rem`,color:`#fff`},children:`Add New Event`}),(0,x.jsx)(o,{size:24,style:{cursor:`pointer`,color:`#94a3b8`},onClick:()=>N(!1)})]}),(0,x.jsxs)(`div`,{className:`form-group`,style:{marginBottom:`15px`},children:[(0,x.jsx)(`label`,{style:{display:`block`,fontSize:`0.8rem`,color:`#94a3b8`,marginBottom:`5px`,fontWeight:`bold`},children:`Event Title`}),(0,x.jsx)(`input`,{type:`text`,className:`sleek-input`,style:{width:`100%`},value:W.title,onChange:e=>G({...W,title:e.target.value}),placeholder:`e.g. Wipro Placement Drive`})]}),(0,x.jsxs)(`div`,{className:`event-form-grid`,style:{display:`grid`,gridTemplateColumns:`repeat(2, minmax(0, 1fr))`,gap:`15px`,marginBottom:`15px`},children:[(0,x.jsxs)(`div`,{className:`form-group`,children:[(0,x.jsx)(`label`,{style:{display:`block`,fontSize:`0.8rem`,color:`#94a3b8`,marginBottom:`5px`,fontWeight:`bold`},children:`Date *`}),(0,x.jsx)(v,{className:`sleek-input`,style:{width:`100%`},value:W.date,onChange:e=>G({...W,date:e.target.value})})]}),(0,x.jsxs)(`div`,{className:`form-group`,children:[(0,x.jsx)(`label`,{style:{display:`block`,fontSize:`0.8rem`,color:`#94a3b8`,marginBottom:`5px`,fontWeight:`bold`},children:`Time`}),(0,x.jsx)(`input`,{type:`time`,step:`1`,className:`sleek-input`,style:{width:`100%`},value:W.time,onChange:e=>G({...W,time:e.target.value})})]})]}),(0,x.jsxs)(`div`,{className:`event-form-grid`,style:{display:`grid`,gridTemplateColumns:`repeat(2, minmax(0, 1fr))`,gap:`15px`,marginBottom:`15px`},children:[(0,x.jsxs)(`div`,{className:`form-group`,children:[(0,x.jsx)(`label`,{style:{display:`block`,fontSize:`0.8rem`,color:`#94a3b8`,marginBottom:`5px`,fontWeight:`bold`},children:`Event Type *`}),(0,x.jsxs)(`select`,{className:`sleek-input`,style:{width:`100%`},value:W.type,onChange:e=>{let t=e.target.value;G(e=>({...e,type:t,course:t===`Placement Drive`?e.course:``,branch:t===`Talentino`&&/^all(?:\s+branches)?$/i.test(String(e.branch||``).trim())&&ae||e.branch}))},children:[(0,x.jsx)(`option`,{value:`Placement Drive`,children:`Placement Drive`}),(0,x.jsx)(`option`,{value:`Talentino`,children:`Talentino`})]})]}),(0,x.jsxs)(`div`,{className:`form-group`,children:[(0,x.jsx)(`label`,{style:{display:`block`,fontSize:`0.8rem`,color:`#94a3b8`,marginBottom:`5px`,fontWeight:`bold`},children:`Event Location`}),(0,x.jsx)(`input`,{type:`text`,className:`sleek-input`,style:{width:`100%`},value:W.location,onChange:e=>G({...W,location:e.target.value}),placeholder:`e.g. Bangalore Branch, Online`})]})]}),W.type===`Placement Drive`&&(0,x.jsxs)(`div`,{className:`form-group`,style:{marginBottom:`15px`},children:[(0,x.jsx)(`label`,{style:{display:`block`,fontSize:`0.8rem`,color:`#94a3b8`,marginBottom:`5px`,fontWeight:`bold`},children:`Eligible Course *`}),(0,x.jsxs)(`select`,{className:`sleek-input`,style:{width:`100%`},value:W.course,onChange:e=>G({...W,course:e.target.value}),required:!0,children:[(0,x.jsx)(`option`,{value:``,children:`Select a course`}),re.map(e=>(0,x.jsx)(`option`,{value:e,children:e},e))]})]}),(0,x.jsxs)(`div`,{className:`form-group`,style:{marginBottom:`15px`},children:[(0,x.jsx)(`label`,{style:{display:`block`,fontSize:`0.8rem`,color:`#94a3b8`,marginBottom:`5px`,fontWeight:`bold`},children:`Eligible Branch`}),(0,x.jsxs)(`select`,{className:`sleek-input`,style:{width:`100%`},value:W.branch,onChange:e=>G({...W,branch:e.target.value}),children:[(0,x.jsx)(`option`,{value:`All Branches`,children:`All Branches`}),E.map((e,t)=>(0,x.jsx)(`option`,{value:e,children:e},t))]})]}),(0,x.jsxs)(`div`,{className:`form-group`,style:{marginBottom:`20px`},children:[(0,x.jsx)(`label`,{style:{display:`block`,fontSize:`0.8rem`,color:`#94a3b8`,marginBottom:`5px`,fontWeight:`bold`},children:`Description`}),(0,x.jsx)(`textarea`,{className:`sleek-input`,style:{width:`100%`,minHeight:`80px`,resize:`vertical`},value:W.description,onChange:e=>G({...W,description:e.target.value}),placeholder:`Add instructions or meeting links...`})]}),W.type===`Placement Drive`&&(0,x.jsxs)(`div`,{className:`form-group`,style:{marginBottom:`25px`,background:`rgba(56, 189, 248, 0.05)`,padding:`15px`,borderRadius:`12px`,border:`1px dashed var(--accent-primary)`},children:[(0,x.jsx)(`label`,{style:{display:`block`,fontSize:`0.8rem`,color:`var(--accent-primary)`,marginBottom:`8px`,fontWeight:`bold`},children:`Upload Drive Poster (Optional)`}),(0,x.jsx)(`input`,{type:`file`,accept:`image/*`,className:`sleek-input`,style:{width:`100%`,padding:`8px`},onChange:e=>q(e.target.files[0])})]}),H?.type===`error`&&(0,x.jsx)(`div`,{role:`alert`,style:{marginBottom:`16px`,padding:`12px 14px`,borderRadius:`10px`,border:`1px solid rgba(248,113,113,.35)`,background:`rgba(127,29,29,.2)`,color:`#fecaca`},children:H.message}),(0,x.jsxs)(`div`,{style:{display:`flex`,justifyContent:`flex-end`,gap:`10px`,borderTop:`1px solid #1e293b`,paddingTop:`1.5rem`},children:[(0,x.jsx)(`button`,{className:`btn-secondary`,style:{background:`transparent`,border:`1px solid #334155`,color:`#f8fafc`,padding:`10px 20px`,borderRadius:`10px`,cursor:`pointer`,fontWeight:`bold`},onClick:()=>N(!1),children:`Cancel`}),(0,x.jsx)(`button`,{className:`btn-action`,style:{background:`var(--accent-primary)`,color:`#0f172a`,padding:`10px 20px`,borderRadius:`10px`,cursor:`pointer`,fontWeight:`bold`,border:`none`},onClick:ue,disabled:I,children:I?(0,x.jsx)(p,{size:18,className:`ph-spin`}):`Save Event`})]})]})}),document.body),P&&(0,b.createPortal)((0,x.jsx)(`div`,{className:`event-modal-backdrop`,onClick:e=>{e.target===e.currentTarget&&F(null)},children:(0,x.jsxs)(`div`,{className:`event-modal-dialog`,style:{maxWidth:`680px`},children:[(0,x.jsxs)(`div`,{style:{borderBottom:`1px solid #1e293b`,paddingBottom:`15px`,marginBottom:`20px`,display:`flex`,justifyContent:`space-between`,alignItems:`flex-start`},children:[(0,x.jsxs)(`div`,{children:[(0,x.jsx)(`span`,{style:{background:`rgba(255,255,255,0.05)`,color:X(P.type),padding:`6px 12px`,borderRadius:`8px`,fontSize:`0.75rem`,fontWeight:`bold`,display:`inline-block`,marginBottom:`10px`},children:String(P.type||`Event`)}),(0,x.jsx)(`h2`,{style:{margin:`0 0 5px 0`,fontSize:`1.6rem`,color:`#fff`},children:String(P.title||`Untitled Event`)}),P.eventId&&(0,x.jsxs)(`div`,{style:{color:`var(--accent-primary)`,fontSize:`0.85rem`,fontWeight:`bold`},children:[`Event ID: `,String(P.eventId)]}),(0,x.jsx)(`span`,{className:`event-status-pill ${String(P.status||`Scheduled`).toLowerCase()===`cancelled`?`cancelled`:String(P.status||`Scheduled`).toLowerCase()===`rescheduled`?`rescheduled`:`scheduled`}`,children:String(P.status||`Scheduled`)})]}),(0,x.jsx)(`button`,{style:{background:`rgba(255,255,255,0.05)`,border:`none`,color:`#94a3b8`,padding:`8px`,borderRadius:`50%`,cursor:`pointer`,display:`flex`,transition:`0.2s`},onClick:()=>F(null),title:`Close`,children:(0,x.jsx)(o,{size:20,weight:`bold`})})]}),(0,x.jsxs)(`div`,{className:`event-detail-grid`,style:{display:`grid`,gridTemplateColumns:`repeat(2, minmax(0, 1fr))`,gap:`15px`,marginBottom:`20px`},children:[(0,x.jsxs)(`div`,{style:{background:`#1e293b`,padding:`15px`,borderRadius:`12px`},children:[(0,x.jsx)(`div`,{style:{fontSize:`0.7rem`,color:`#94a3b8`,textTransform:`uppercase`,fontWeight:`bold`,marginBottom:`5px`},children:`Date & Time`}),(0,x.jsxs)(`div`,{style:{color:`#fff`,fontSize:`0.95rem`,fontWeight:600,display:`flex`,alignItems:`center`,gap:`6px`},children:[(0,x.jsx)(m,{size:16,color:`var(--accent-primary)`}),` `,_(P.date,`TBD`),` • `,g(P.time,`TBD`)]})]}),(0,x.jsxs)(`div`,{style:{background:`#1e293b`,padding:`15px`,borderRadius:`12px`},children:[(0,x.jsx)(`div`,{style:{fontSize:`0.7rem`,color:`#94a3b8`,textTransform:`uppercase`,fontWeight:`bold`,marginBottom:`5px`},children:`Location & Branch`}),(0,x.jsxs)(`div`,{style:{color:`#fff`,fontSize:`0.95rem`,fontWeight:600,display:`flex`,alignItems:`center`,gap:`6px`},children:[(0,x.jsx)(s,{size:16,color:`#f59e0b`}),` `,String(P.location||`Online`)]}),(0,x.jsxs)(`div`,{style:{color:`#cbd5e1`,fontSize:`0.85rem`,marginTop:`4px`},children:[`Branch: `,String(P.branch||`Global`)]})]}),P.course&&(0,x.jsxs)(`div`,{style:{background:`#1e293b`,padding:`15px`,borderRadius:`12px`},children:[(0,x.jsx)(`div`,{style:{fontSize:`0.7rem`,color:`#94a3b8`,textTransform:`uppercase`,fontWeight:`bold`,marginBottom:`5px`},children:`Eligible Course`}),(0,x.jsx)(`div`,{style:{color:`#fff`,fontSize:`0.95rem`,fontWeight:600},children:String(P.course)})]})]}),P.description&&(0,x.jsxs)(`div`,{style:{background:`rgba(255,255,255,0.02)`,padding:`20px`,borderRadius:`12px`,border:`1px solid rgba(255,255,255,0.05)`,marginBottom:`20px`},children:[(0,x.jsx)(`div`,{style:{fontSize:`0.75rem`,color:`#94a3b8`,textTransform:`uppercase`,fontWeight:`bold`,marginBottom:`8px`},children:`Description`}),(0,x.jsx)(`div`,{style:{color:`#e2e8f0`,fontSize:`0.95rem`,lineHeight:`1.6`,whiteSpace:`pre-wrap`},children:String(P.description)})]}),P.poster&&P.poster!==`N/A`&&(0,x.jsxs)(`div`,{style:{marginTop:`20px`},children:[(0,x.jsx)(`div`,{style:{fontSize:`0.75rem`,color:`#94a3b8`,textTransform:`uppercase`,fontWeight:`bold`,marginBottom:`10px`},children:`Event Poster Attached`}),(0,x.jsxs)(`button`,{className:`btn-secondary hover-lift`,style:{background:`rgba(56, 189, 248, 0.1)`,border:`1px solid rgba(56, 189, 248, 0.3)`,color:`var(--accent-primary)`,width:`100%`,padding:`15px`,borderRadius:`12px`,cursor:`pointer`,display:`flex`,justifyContent:`center`,alignItems:`center`,gap:`8px`,fontWeight:`bold`,fontSize:`1rem`,transition:`0.2s`},onClick:()=>window.open(P.poster,`_blank`),children:[(0,x.jsx)(te,{size:22,weight:`fill`}),` View Full Event Poster`]})]}),P.statusReason&&(0,x.jsxs)(`div`,{style:{marginTop:`16px`,padding:`12px 14px`,background:`rgba(255,255,255,0.04)`,border:`1px solid rgba(148,163,184,.15)`,borderRadius:`10px`,color:`#cbd5e1`,fontSize:`.9rem`},children:[(0,x.jsx)(`strong`,{style:{color:`#94a3b8`},children:`Latest update:`}),` `,String(P.statusReason)]}),H&&(0,x.jsx)(`div`,{role:H.type===`error`?`alert`:`status`,style:{marginTop:`16px`,padding:`12px 14px`,borderRadius:`10px`,border:`1px solid ${H.type===`error`?`rgba(248,113,113,.35)`:H.type===`warning`?`rgba(251,191,36,.35)`:`rgba(52,211,153,.35)`}`,background:H.type===`error`?`rgba(127,29,29,.2)`:H.type===`warning`?`rgba(120,53,15,.2)`:`rgba(6,78,59,.22)`,color:H.type===`error`?`#fecaca`:H.type===`warning`?`#fde68a`:`#a7f3d0`},children:H.message}),C&&String(P.status||``).toLowerCase()!==`cancelled`&&(0,x.jsxs)(`div`,{className:`event-action-row`,children:[(0,x.jsxs)(`button`,{type:`button`,onClick:()=>Y(`reschedule`),disabled:B,className:`event-reschedule-button`,children:[(0,x.jsx)(f,{size:18}),` Reschedule Event`]}),(0,x.jsxs)(`button`,{type:`button`,onClick:()=>Y(`cancel`),disabled:B,className:`event-cancel-button`,children:[(0,x.jsx)(o,{size:18}),` Cancel Event`]})]})]})}),document.body),R&&P&&(0,b.createPortal)((0,x.jsx)(`div`,{className:`event-modal-backdrop event-action-layer`,onClick:e=>{e.target===e.currentTarget&&!B&&z(null)},children:(0,x.jsxs)(`div`,{className:`event-modal-dialog event-action-dialog`,role:`dialog`,"aria-modal":`true`,"aria-labelledby":`event-action-title`,children:[(0,x.jsxs)(`div`,{style:{display:`flex`,justifyContent:`space-between`,gap:`16px`,alignItems:`flex-start`,marginBottom:`18px`},children:[(0,x.jsxs)(`div`,{children:[(0,x.jsx)(`span`,{className:`event-status-pill ${R.action===`cancel`?`cancelled`:`rescheduled`}`,children:R.action===`cancel`?`Cancellation notice`:`Schedule update`}),(0,x.jsx)(`h2`,{id:`event-action-title`,style:{color:`#fff`,margin:`8px 0 0`,fontSize:`1.35rem`},children:R.action===`cancel`?`Cancel this event?`:`Reschedule this event`}),(0,x.jsx)(`div`,{style:{color:`#94a3b8`,marginTop:`5px`},children:String(P.title||`Untitled Event`)})]}),(0,x.jsx)(`button`,{type:`button`,"aria-label":`Close`,onClick:()=>!B&&z(null),style:{border:0,background:`transparent`,color:`#94a3b8`,cursor:`pointer`},children:(0,x.jsx)(o,{size:22})})]}),R.action===`reschedule`&&(0,x.jsxs)(`div`,{className:`event-form-grid`,style:{display:`grid`,gridTemplateColumns:`repeat(2, minmax(0, 1fr))`,gap:`14px`,marginBottom:`14px`},children:[(0,x.jsxs)(`label`,{style:{color:`#cbd5e1`,fontSize:`.82rem`,fontWeight:700},children:[`New date *`,(0,x.jsx)(v,{className:`sleek-input`,value:R.newDate,onChange:e=>z(t=>({...t,newDate:e.target.value})),required:!0})]}),(0,x.jsxs)(`label`,{style:{color:`#cbd5e1`,fontSize:`.82rem`,fontWeight:700},children:[`New time`,(0,x.jsx)(`input`,{type:`time`,step:`1`,className:`sleek-input`,value:R.time,onChange:e=>z(t=>({...t,time:e.target.value}))})]})]}),(0,x.jsx)(`label`,{style:{display:`block`,color:`#cbd5e1`,fontSize:`.82rem`,fontWeight:700,marginBottom:`8px`},children:R.action===`cancel`?`Reason for cancellation (optional)`:`Message for recipients (optional)`}),(0,x.jsx)(`textarea`,{className:`sleek-input`,rows:3,maxLength:1e3,value:R.reason,onChange:e=>z(t=>({...t,reason:e.target.value})),placeholder:R.action===`cancel`?`Add a short explanation for the cancellation…`:`Add any instructions or context for the revised schedule…`}),(0,x.jsx)(`div`,{className:`event-audience-note`,children:`The notice will be sent to the recipients assigned to this event type and branch.`}),H&&(0,x.jsx)(`div`,{role:H.type===`error`?`alert`:`status`,style:{marginTop:`12px`,padding:`11px 12px`,borderRadius:`9px`,border:`1px solid ${H.type===`error`?`rgba(248,113,113,.35)`:H.type===`warning`?`rgba(251,191,36,.35)`:`rgba(52,211,153,.35)`}`,background:H.type===`error`?`rgba(127,29,29,.2)`:H.type===`warning`?`rgba(120,53,15,.2)`:`rgba(6,78,59,.22)`,color:H.type===`error`?`#fecaca`:H.type===`warning`?`#fde68a`:`#a7f3d0`,fontSize:`.88rem`},children:H.message}),(0,x.jsxs)(`div`,{style:{display:`flex`,justifyContent:`flex-end`,gap:`10px`,marginTop:`20px`,paddingTop:`16px`,borderTop:`1px solid #253247`},children:[(0,x.jsx)(`button`,{type:`button`,className:`event-action-secondary`,disabled:B,onClick:()=>z(null),children:`Back`}),(0,x.jsx)(`button`,{type:`button`,className:R.action===`cancel`?`event-action-confirm-cancel`:`event-action-confirm-reschedule`,disabled:B,onClick:de,children:B?(0,x.jsx)(p,{size:18,className:`ph-spin`}):R.action===`cancel`?`Cancel Event & Notify`:`Save New Schedule & Notify`})]})]})}),document.body),(0,x.jsx)(`style`,{children:`
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

        /* Premium calendar surface and controls */
        .neo-layout {
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 22px;
          margin-top: 18px;
          padding: clamp(16px, 2.5vw, 30px);
          background: radial-gradient(ellipse at 14% 0%, rgba(56, 189, 248, .08), transparent 38%), #0b1121;
          border-color: rgba(148, 163, 184, .16);
          box-shadow: 0 24px 70px rgba(0, 0, 0, .22), inset 0 1px rgba(255, 255, 255, .035);
        }
        .neo-toolbar {
          gap: 16px;
          margin-bottom: 24px;
          padding-bottom: 20px;
          border-bottom: 1px solid rgba(148, 163, 184, .13);
        }
        .neo-month-controls, .neo-toolbar-actions, .neo-nav-arrows { display: flex; align-items: center; }
        .neo-month-controls { gap: 8px; min-width: 0; }
        .neo-select-wrap {
          position: relative;
          display: inline-flex;
          align-items: center;
          min-width: 145px;
          color: #f8fafc;
          background: rgba(15, 23, 42, .78);
          border: 1px solid rgba(148, 163, 184, .2);
          border-radius: 12px;
          transition: border-color .18s ease, box-shadow .18s ease, background .18s ease;
        }
        .neo-select-wrap:hover, .neo-select-wrap:focus-within {
          border-color: rgba(56, 189, 248, .6);
          background: rgba(15, 23, 42, .98);
          box-shadow: 0 0 0 3px rgba(56, 189, 248, .1);
        }
        .neo-select-wrap select {
          appearance: none;
          width: 100%;
          min-width: 0;
          padding: 11px 38px 11px 14px;
          color: inherit;
          font: inherit;
          font-size: 1.08rem;
          font-weight: 650;
          background: transparent;
          border: 0;
          outline: 0;
          cursor: pointer;
        }
        .neo-select-wrap select option { color: #e2e8f0; background: #0f172a; }
        .neo-select-wrap > svg { position: absolute; right: 13px; color: #7c8da8; pointer-events: none; }
        .neo-year-select { min-width: 106px; }
        .neo-year-select select { font-weight: 550; }
        .neo-toolbar-actions { gap: 10px; }
        .neo-month-summary {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          margin-right: 4px;
          padding: 8px 12px;
          border: 1px solid rgba(148, 163, 184, .14);
          border-radius: 999px;
          color: #aab8cc;
          background: rgba(15, 23, 42, .55);
          font-size: .78rem;
          font-weight: 600;
          white-space: nowrap;
        }
        .neo-month-summary > span { width: 7px; height: 7px; border-radius: 50%; background: #38bdf8; box-shadow: 0 0 12px rgba(56, 189, 248, .7); }
        .neo-today-button {
          padding: 9px 14px;
          color: #d8f5ff;
          font-size: .82rem;
          font-weight: 650;
          background: rgba(14, 116, 144, .16);
          border: 1px solid rgba(56, 189, 248, .28);
          border-radius: 11px;
          cursor: pointer;
          transition: .18s ease;
        }
        .neo-today-button:hover { color: #fff; background: rgba(14, 116, 144, .3); border-color: rgba(56, 189, 248, .65); }
        .neo-nav-arrows { gap: 7px; }
        .neo-nav-arrows button { width: 38px; height: 38px; border-radius: 12px; background: rgba(30, 41, 59, .78); }
        .neo-nav-arrows button:hover { transform: translateY(-1px); box-shadow: 0 6px 18px rgba(0, 0, 0, .2); }
        .neo-days-header { gap: 10px; margin-bottom: 9px; }
        .neo-days-header div {
          padding: 0 10px 5px;
          color: #7d8da5;
          font-size: .72rem;
          font-weight: 700;
          letter-spacing: .09em;
          text-transform: uppercase;
        }
        .neo-grid { gap: 10px; }
        .neo-cell {
          min-height: 124px;
          padding: 11px;
          gap: 6px;
          background: linear-gradient(155deg, rgba(30, 41, 59, .92), rgba(20, 31, 49, .92));
          border: 1px solid rgba(148, 163, 184, .1);
          border-radius: 15px;
          box-shadow: inset 0 1px rgba(255, 255, 255, .018);
        }
        .neo-cell.empty { min-height: 124px; background: rgba(15, 23, 42, .18); border-color: transparent; box-shadow: none; }
        .neo-cell:not(.empty):hover { background: linear-gradient(155deg, rgba(40, 54, 77, .98), rgba(25, 39, 61, .98)); border-color: rgba(148, 163, 184, .25); }
        .neo-cell.is-today { border-color: rgba(56, 189, 248, .3); }
        .neo-cell.selected { background: linear-gradient(145deg, rgba(14, 116, 144, .3), rgba(30, 41, 59, .98)); border-color: rgba(56, 189, 248, .72); box-shadow: 0 12px 28px rgba(2, 132, 199, .16), inset 0 1px rgba(255, 255, 255, .06); transform: none; }
        .neo-date-num {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          margin: 0 0 2px;
          padding: 0;
          color: #dbe7f5;
          font: inherit;
          font-size: .93rem;
          font-weight: 650;
          line-height: 1;
          background: transparent;
          border: 0;
          cursor: pointer;
          text-align: left;
        }
        .neo-date-num > span:first-child { display: inline-grid; width: 28px; height: 28px; place-items: center; border-radius: 9px; }
        .neo-date-num:hover > span:first-child { color: #fff; background: rgba(148, 163, 184, .14); }
        .neo-date-num.today > span:first-child { color: #08121f; background: #67e8f9; box-shadow: 0 4px 13px rgba(34, 211, 238, .22); }
        .neo-cell.selected .neo-date-num { color: #fff; }
        .neo-cell.selected .neo-date-num.today > span:first-child { color: #08121f; }
        .neo-date-count { display: inline-grid; min-width: 20px; height: 20px; padding: 0 5px; place-items: center; color: #b9eaff; background: rgba(14, 116, 144, .28); border: 1px solid rgba(56, 189, 248, .18); border-radius: 999px; font-size: .68rem; }
        .neo-events { gap: 5px; }
        .neo-event-indicator {
          padding: 4px 6px;
          color: #cbd5e1;
          background: rgba(8, 15, 28, .4);
          border: 1px solid rgba(148, 163, 184, .09);
          border-radius: 7px;
          text-align: left;
          transition: background .16s ease, border-color .16s ease, transform .16s ease;
        }
        .neo-event-indicator:hover { background: rgba(8, 15, 28, .75); border-color: rgba(148, 163, 184, .22); transform: translateY(-1px); }
        .neo-event-bar { height: 14px; width: 3px; }
        .neo-event-title { font-size: .69rem; font-weight: 550; }
        .neo-event-more { padding-left: 5px; color: #93a4ba; font-size: .67rem; font-weight: 650; }
        .neo-sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
        @media (max-width: 1150px) {
          .neo-layout { grid-template-columns: minmax(0, 1fr); }
          .neo-agenda-section { width: 100%; }
        }
        @media (max-width: 700px) {
          .neo-toolbar { align-items: flex-start; flex-direction: column; gap: 14px; }
          .neo-toolbar-actions { width: 100%; justify-content: space-between; }
          .neo-month-summary { margin-right: auto; }
          .neo-days-header, .neo-grid { gap: 5px; }
          .neo-days-header div { padding: 0 2px 5px; text-align: center; font-size: .62rem; letter-spacing: .04em; }
          .neo-cell, .neo-cell.empty { min-height: 82px; padding: 6px 5px; border-radius: 10px; }
          .neo-date-num { font-size: .8rem; }
          .neo-date-num > span:first-child { width: 24px; height: 24px; border-radius: 7px; }
          .neo-date-count { min-width: 17px; height: 17px; padding: 0 3px; font-size: .6rem; }
          .neo-events { align-items: center; gap: 3px; }
          .neo-event-indicator { width: auto; padding: 3px; border: 0; background: transparent; }
          .neo-event-indicator:hover { background: rgba(8, 15, 28, .5); }
          .neo-event-title, .neo-event-more { display: none; }
          .neo-event-bar { height: 7px; width: 7px; border-radius: 50%; }
          .neo-select-wrap { min-width: 130px; }
          .neo-year-select { min-width: 94px; }
        }
      `})]})}export{C as default};