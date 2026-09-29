import{g as e,i as t,r as n,t as r,y as i}from"./apiConfig-DolS5KJD.js";import{O as a,_ as o,c as s,k as c,m as l,t as u}from"./Layout-BuQYVVRA.js";import{t as d}from"./CalendarBlank.es-DfLlD_st.js";import{t as f}from"./CaretRight.es-Cdq07nKF.js";import{t as p}from"./Clock.es-Bz-0gg1h.js";import{t as m}from"./Image.es-BFlfxnrN.js";import{r as h,s as g}from"./index-BlpkG1bY.js";var _=i(e(),1),v=n(),y=e=>{if(!e)return null;let t=new Date(e);if(!isNaN(t))return t;let n=typeof e==`string`?e.split(` `)[0].replace(/st|nd|rd|th/g,``):e;if(typeof n==`string`&&(n.includes(`/`)||n.includes(`-`))){let e=n.split(/[/-]/);if(e.length===3&&e[2].length===4)return new Date(`${e[2]}-${e[1].padStart(2,`0`)}-${e[0].padStart(2,`0`)}`)}return null};function b(){let e=localStorage.getItem(`tpoData`),n=e?JSON.parse(e):null,i=String(n?.role||``).toUpperCase(),b=[`DESIGN`,`MEDIA`,`CREATIVE`].some(e=>i.includes(e)),x=n?.accessType===`superadmin`||i.includes(`TPO`)||i.includes(`PLACEMENT OFFICER`),[S,C]=(0,_.useState)([]),[w,T]=(0,_.useState)([]),[E,D]=(0,_.useState)(!0),[O,k]=(0,_.useState)(new Date),[A,j]=(0,_.useState)(new Date),[M,N]=(0,_.useState)(!1),[P,F]=(0,_.useState)(null),[I,L]=(0,_.useState)(!1),[R,z]=(0,_.useState)({date:``,time:``,branch:n?.assignedBranchesArray?.[0]||`All Branches`,type:`Placement Drive`,title:``,description:``,location:``}),[B,V]=(0,_.useState)(null),H=async()=>{try{D(!0);let e=await t.get(`${r}/api/tpo/events`);e.data.success&&C(e.data.events||[])}catch(e){console.error(`Failed to fetch events`,e)}finally{D(!1)}},U=async()=>{try{let e=await t.get(`${r}/api/admin/branches`);if(e.data.success){let t=e.data.branches.map(e=>e.branch).filter(Boolean).sort((e,t)=>e.localeCompare(t));T(t)}}catch(e){console.error(`Failed to fetch branches`,e)}};(0,_.useEffect)(()=>{H(),x&&U()},[x]);let W=async()=>{if(!R.title||!R.date||!R.type)return alert(`Please fill in the Event Title, Date, and Event Type.`);L(!0);try{let e=new FormData;e.append(`tpo`,n?.name||`Unknown`),Object.keys(R).forEach(t=>e.append(t,R[t])),B&&e.append(`posterFile`,B),(await t.post(`https://ipcs-tpo-portal-u0l6.onrender.com/api/tpo/events/add`,e,{headers:{"Content-Type":`multipart/form-data`}})).data.success&&(N(!1),z({date:``,time:``,branch:n?.assignedBranchesArray?.[0]||`All Branches`,type:`Placement Drive`,title:``,description:``,location:``}),V(null),H())}catch{alert(`Failed to save event`)}finally{L(!1)}},G=e=>{if(!e)return`var(--accent-primary)`;let t=String(e).toLowerCase();return t.includes(`talentino`)?`#a855f7`:t.includes(`placement drive`)?`#ef4444`:`#10b981`},K=()=>{let e=new Date(O);e.setMonth(e.getMonth()+1),k(e)},q=()=>{let e=new Date(O);e.setMonth(e.getMonth()-1),k(e)},J=e=>{if(b)return!0;let t=n?.assignedBranchesArray||[];if(n?.accessType===`superadmin`||t.length===0||t.includes(`all`)||t.includes(`All`))return!0;if((e.type||``).toLowerCase().includes(`talentino`)){let n=(e.branch||``).toLowerCase();return n===`all branches`||n===`all`||t.some(e=>n.includes(e.toLowerCase())||e.toLowerCase().includes(n))}return!0},Y=()=>{let e=O.getFullYear(),t=O.getMonth(),n=new Date(e,t,1).getDay(),r=new Date(e,t+1,0).getDate(),i=[];for(let e=0;e<n;e++)i.push((0,v.jsx)(`div`,{className:`neo-cell empty`},`empty-${e}`));for(let n=1;n<=r;n++){let r=new Date(e,t,n),a=n===new Date().getDate()&&t===new Date().getMonth()&&e===new Date().getFullYear(),o=A&&r.toDateString()===A.toDateString(),s=S.filter(e=>{if(!J(e))return!1;let t=y(e.date);return t&&t.getFullYear()===r.getFullYear()&&t.getMonth()===r.getMonth()&&t.getDate()===r.getDate()});i.push((0,v.jsxs)(`div`,{className:`neo-cell ${o?`selected`:``}`,onClick:()=>j(r),children:[(0,v.jsx)(`div`,{className:`neo-date-num ${a&&!o?`today`:``}`,children:n}),(0,v.jsxs)(`div`,{className:`neo-events`,children:[s.slice(0,3).map((e,t)=>(0,v.jsxs)(`div`,{className:`neo-event-indicator hover-lift`,style:{cursor:`pointer`},onClick:t=>{t.stopPropagation(),F(e)},children:[(0,v.jsx)(`span`,{className:`neo-event-bar`,style:{background:o?`rgba(255,255,255,0.8)`:G(e.type)}}),(0,v.jsx)(`span`,{className:`neo-event-title`,style:{color:o?`#fff`:`#cbd5e1`},children:e.title})]},t)),s.length>3&&(0,v.jsxs)(`div`,{className:`neo-event-more`,style:{color:o?`rgba(255,255,255,0.7)`:`#64748b`},children:[`+`,s.length-3,` more`]})]})]},n))}return i},X=A?S.filter(e=>{if(!J(e))return!1;let t=y(e.date);return t&&t.toDateString()===A.toDateString()}):[];return(0,v.jsxs)(u,{children:[(0,v.jsxs)(`div`,{className:`page-container`,style:{padding:0},children:[(0,v.jsxs)(`div`,{style:{display:`flex`,justifyContent:`space-between`,alignItems:`center`,marginBottom:`1.5rem`,flexWrap:`wrap`,gap:`15px`},children:[(0,v.jsxs)(`div`,{children:[(0,v.jsxs)(`h1`,{style:{fontSize:`2rem`,margin:`0 0 5px 0`,color:`#fff`},children:[`Morning, `,String(n?.name||`Alex`).split(` `)[0],`!`]}),(0,v.jsx)(`p`,{style:{color:`#94a3b8`,margin:0,fontSize:`1.05rem`},children:`Here's what's on your agenda today.`})]}),x&&(0,v.jsxs)(`button`,{className:`btn-action`,style:{width:`auto`,borderRadius:`12px`,display:`flex`,alignItems:`center`,gap:`8px`,padding:`12px 20px`,background:`var(--accent-primary)`,color:`#0f172a`},onClick:()=>N(!0),children:[(0,v.jsx)(l,{weight:`bold`}),` Add Event`]})]}),(0,v.jsxs)(`div`,{className:`neo-layout`,children:[(0,v.jsxs)(`div`,{className:`neo-calendar-section`,children:[(0,v.jsxs)(`div`,{className:`neo-toolbar`,children:[(0,v.jsxs)(`div`,{className:`neo-month-display`,children:[O.toLocaleString(`default`,{month:`long`}),` `,(0,v.jsx)(c,{size:14,weight:`bold`,style:{marginLeft:`8px`,marginRight:`20px`,color:`#64748b`}}),O.getFullYear(),` `,(0,v.jsx)(c,{size:14,weight:`bold`,style:{marginLeft:`8px`,color:`#64748b`}})]}),(0,v.jsxs)(`div`,{className:`neo-nav-arrows`,children:[(0,v.jsx)(`button`,{onClick:q,children:(0,v.jsx)(a,{size:16,weight:`bold`})}),(0,v.jsx)(`button`,{onClick:K,children:(0,v.jsx)(f,{size:16,weight:`bold`})})]})]}),(0,v.jsx)(`div`,{className:`neo-days-header`,children:[`Sunday`,`Monday`,`Tuesday`,`Wednesday`,`Thursday`,`Friday`,`Saturday`].map(e=>(0,v.jsx)(`div`,{children:e},e))}),(0,v.jsx)(`div`,{className:`neo-grid`,children:E?(0,v.jsx)(`div`,{style:{gridColumn:`1 / -1`,textAlign:`center`,padding:`5rem`,color:`var(--accent-primary)`},children:(0,v.jsx)(g,{size:48,className:`ph-spin`})}):Y()})]}),A&&(0,v.jsxs)(`div`,{className:`neo-agenda-section`,children:[(0,v.jsxs)(`div`,{className:`neo-agenda-header`,style:{display:`flex`,justifyContent:`space-between`,alignItems:`flex-start`},children:[(0,v.jsxs)(`div`,{children:[(0,v.jsx)(`h3`,{children:`Scheduled`}),(0,v.jsx)(`div`,{className:`neo-agenda-date`,children:A.toLocaleDateString(`en-GB`,{day:`numeric`,month:`long`,year:`numeric`})})]}),(0,v.jsx)(`button`,{onClick:()=>j(null),style:{background:`rgba(255,255,255,0.05)`,border:`none`,color:`#94a3b8`,padding:`6px`,borderRadius:`50%`,cursor:`pointer`,display:`flex`,transition:`0.2s`},title:`Close Agenda`,children:(0,v.jsx)(h,{size:18,weight:`bold`})})]}),(0,v.jsx)(`div`,{className:`neo-agenda-list`,children:X.length===0?(0,v.jsxs)(`div`,{style:{color:`#64748b`,fontSize:`0.9rem`,textAlign:`center`,marginTop:`2rem`},children:[(0,v.jsx)(d,{size:32,style:{opacity:.5,marginBottom:`10px`}}),(0,v.jsx)(`br`,{}),`No events scheduled for this day.`]}):X.map((e,t)=>(0,v.jsxs)(`div`,{className:`neo-agenda-card hover-lift`,onClick:()=>F(e),style:{cursor:`pointer`},children:[(0,v.jsx)(`div`,{className:`neo-ac-accent`,style:{background:G(e.type)}}),(0,v.jsx)(`div`,{className:`neo-ac-time-row`,children:(0,v.jsx)(`span`,{style:{color:`#fff`,fontWeight:`bold`},children:e.time||`09:00`})}),(0,v.jsxs)(`div`,{className:`neo-ac-content`,children:[(0,v.jsx)(`h4`,{className:`neo-ac-title`,children:e.title}),(0,v.jsx)(`p`,{className:`neo-ac-desc`,children:e.type}),(0,v.jsxs)(`div`,{className:`neo-ac-footer`,children:[(0,v.jsxs)(`div`,{className:`neo-ac-detail`,children:[(0,v.jsx)(p,{size:14}),` `,e.time||`All Day`]}),(0,v.jsxs)(`div`,{className:`neo-ac-detail`,children:[(0,v.jsx)(o,{size:14}),` `,e.location||`Online`]})]}),(0,v.jsxs)(`div`,{className:`neo-ac-members`,children:[(0,v.jsx)(`div`,{className:`neo-avatar`,children:(0,v.jsx)(s,{size:14})}),(0,v.jsxs)(`span`,{style:{fontSize:`0.8rem`,color:`#cbd5e1`},children:[e.tpo||`System`,` • `,e.branch===`All Branches`?`Global`:e.branch]})]})]})]},t))})]})]})]}),M&&(0,v.jsx)(`div`,{style:{position:`fixed`,top:0,left:0,right:0,bottom:0,backgroundColor:`rgba(0,0,0,0.85)`,zIndex:99999,display:`flex`,justifyContent:`center`,alignItems:`center`,padding:`20px`},onClick:e=>{e.target===e.currentTarget&&N(!1)},children:(0,v.jsxs)(`div`,{className:`modal-card`,style:{maxWidth:`600px`,width:`100%`,maxHeight:`90vh`,overflowY:`auto`,background:`#0f172a`,border:`1px solid #1e293b`,borderRadius:`24px`,padding:`2rem`,boxShadow:`0 25px 50px rgba(0,0,0,0.5)`},children:[(0,v.jsxs)(`div`,{style:{display:`flex`,justifyContent:`space-between`,alignItems:`center`,marginBottom:`1.5rem`,borderBottom:`1px solid #1e293b`,paddingBottom:`15px`},children:[(0,v.jsx)(`h3`,{style:{margin:0,fontSize:`1.4rem`,color:`#fff`},children:`Add New Event`}),(0,v.jsx)(h,{size:24,style:{cursor:`pointer`,color:`#94a3b8`},onClick:()=>N(!1)})]}),(0,v.jsxs)(`div`,{className:`form-group`,style:{marginBottom:`15px`},children:[(0,v.jsx)(`label`,{style:{display:`block`,fontSize:`0.8rem`,color:`#94a3b8`,marginBottom:`5px`,fontWeight:`bold`},children:`Event Title`}),(0,v.jsx)(`input`,{type:`text`,className:`sleek-input`,style:{width:`100%`},value:R.title,onChange:e=>z({...R,title:e.target.value}),placeholder:`e.g. Wipro Placement Drive`})]}),(0,v.jsxs)(`div`,{style:{display:`grid`,gridTemplateColumns:`1fr 1fr`,gap:`15px`,marginBottom:`15px`},children:[(0,v.jsxs)(`div`,{className:`form-group`,children:[(0,v.jsx)(`label`,{style:{display:`block`,fontSize:`0.8rem`,color:`#94a3b8`,marginBottom:`5px`,fontWeight:`bold`},children:`Date *`}),(0,v.jsx)(`input`,{type:`date`,className:`sleek-input`,style:{width:`100%`},value:R.date,onChange:e=>z({...R,date:e.target.value})})]}),(0,v.jsxs)(`div`,{className:`form-group`,children:[(0,v.jsx)(`label`,{style:{display:`block`,fontSize:`0.8rem`,color:`#94a3b8`,marginBottom:`5px`,fontWeight:`bold`},children:`Time`}),(0,v.jsx)(`input`,{type:`time`,className:`sleek-input`,style:{width:`100%`},value:R.time,onChange:e=>z({...R,time:e.target.value})})]})]}),(0,v.jsxs)(`div`,{style:{display:`grid`,gridTemplateColumns:`1fr 1fr`,gap:`15px`,marginBottom:`15px`},children:[(0,v.jsxs)(`div`,{className:`form-group`,children:[(0,v.jsx)(`label`,{style:{display:`block`,fontSize:`0.8rem`,color:`#94a3b8`,marginBottom:`5px`,fontWeight:`bold`},children:`Event Type *`}),(0,v.jsxs)(`select`,{className:`sleek-input`,style:{width:`100%`},value:R.type,onChange:e=>z({...R,type:e.target.value}),children:[(0,v.jsx)(`option`,{value:`Placement Drive`,children:`Placement Drive`}),(0,v.jsx)(`option`,{value:`Talentino`,children:`Talentino`}),(0,v.jsx)(`option`,{value:`Training`,children:`Training`})]})]}),(0,v.jsxs)(`div`,{className:`form-group`,children:[(0,v.jsx)(`label`,{style:{display:`block`,fontSize:`0.8rem`,color:`#94a3b8`,marginBottom:`5px`,fontWeight:`bold`},children:`Event Location`}),(0,v.jsx)(`input`,{type:`text`,className:`sleek-input`,style:{width:`100%`},value:R.location,onChange:e=>z({...R,location:e.target.value}),placeholder:`e.g. Bangalore Branch, Online`})]})]}),(0,v.jsxs)(`div`,{className:`form-group`,style:{marginBottom:`15px`},children:[(0,v.jsx)(`label`,{style:{display:`block`,fontSize:`0.8rem`,color:`#94a3b8`,marginBottom:`5px`,fontWeight:`bold`},children:`Eligible Branch`}),(0,v.jsxs)(`select`,{className:`sleek-input`,style:{width:`100%`},value:R.branch,onChange:e=>z({...R,branch:e.target.value}),children:[(0,v.jsx)(`option`,{value:`All Branches`,children:`All Branches`}),w.map((e,t)=>(0,v.jsx)(`option`,{value:e,children:e},t))]})]}),(0,v.jsxs)(`div`,{className:`form-group`,style:{marginBottom:`20px`},children:[(0,v.jsx)(`label`,{style:{display:`block`,fontSize:`0.8rem`,color:`#94a3b8`,marginBottom:`5px`,fontWeight:`bold`},children:`Description`}),(0,v.jsx)(`textarea`,{className:`sleek-input`,style:{width:`100%`,minHeight:`80px`,resize:`vertical`},value:R.description,onChange:e=>z({...R,description:e.target.value}),placeholder:`Add instructions or meeting links...`})]}),R.type===`Placement Drive`&&(0,v.jsxs)(`div`,{className:`form-group`,style:{marginBottom:`25px`,background:`rgba(56, 189, 248, 0.05)`,padding:`15px`,borderRadius:`12px`,border:`1px dashed var(--accent-primary)`},children:[(0,v.jsx)(`label`,{style:{display:`block`,fontSize:`0.8rem`,color:`var(--accent-primary)`,marginBottom:`8px`,fontWeight:`bold`},children:`Upload Drive Poster (Optional)`}),(0,v.jsx)(`input`,{type:`file`,accept:`image/*`,className:`sleek-input`,style:{width:`100%`,padding:`8px`},onChange:e=>V(e.target.files[0])})]}),(0,v.jsxs)(`div`,{style:{display:`flex`,justifyContent:`flex-end`,gap:`10px`,borderTop:`1px solid #1e293b`,paddingTop:`1.5rem`},children:[(0,v.jsx)(`button`,{className:`btn-secondary`,style:{background:`transparent`,border:`1px solid #334155`,color:`#f8fafc`,padding:`10px 20px`,borderRadius:`10px`,cursor:`pointer`,fontWeight:`bold`},onClick:()=>N(!1),children:`Cancel`}),(0,v.jsx)(`button`,{className:`btn-action`,style:{background:`var(--accent-primary)`,color:`#0f172a`,padding:`10px 20px`,borderRadius:`10px`,cursor:`pointer`,fontWeight:`bold`,border:`none`},onClick:W,disabled:I,children:I?(0,v.jsx)(g,{size:18,className:`ph-spin`}):`Save Event`})]})]})}),P&&(0,v.jsx)(`div`,{style:{position:`fixed`,top:0,left:0,right:0,bottom:0,backgroundColor:`rgba(0,0,0,0.85)`,zIndex:99999,display:`flex`,justifyContent:`center`,alignItems:`center`,padding:`20px`,backdropFilter:`blur(5px)`},onClick:e=>{e.target===e.currentTarget&&F(null)},children:(0,v.jsxs)(`div`,{className:`modal-card`,style:{maxWidth:`650px`,width:`100%`,maxHeight:`90vh`,overflowY:`auto`,background:`#0f172a`,border:`1px solid #1e293b`,borderRadius:`24px`,padding:`2rem`,boxShadow:`0 25px 50px rgba(0,0,0,0.5)`,position:`relative`},children:[(0,v.jsxs)(`div`,{style:{borderBottom:`1px solid #1e293b`,paddingBottom:`15px`,marginBottom:`20px`,display:`flex`,justifyContent:`space-between`,alignItems:`flex-start`},children:[(0,v.jsxs)(`div`,{children:[(0,v.jsx)(`span`,{style:{background:`rgba(255,255,255,0.05)`,color:G(P.type),padding:`6px 12px`,borderRadius:`8px`,fontSize:`0.75rem`,fontWeight:`bold`,display:`inline-block`,marginBottom:`10px`},children:String(P.type||`Event`)}),(0,v.jsx)(`h2`,{style:{margin:`0 0 5px 0`,fontSize:`1.6rem`,color:`#fff`},children:String(P.title||`Untitled Event`)}),P.eventId&&(0,v.jsxs)(`div`,{style:{color:`var(--accent-primary)`,fontSize:`0.85rem`,fontWeight:`bold`},children:[`Event ID: `,String(P.eventId)]})]}),(0,v.jsx)(`button`,{style:{background:`rgba(255,255,255,0.05)`,border:`none`,color:`#94a3b8`,padding:`8px`,borderRadius:`50%`,cursor:`pointer`,display:`flex`,transition:`0.2s`},onClick:()=>F(null),title:`Close`,children:(0,v.jsx)(h,{size:20,weight:`bold`})})]}),(0,v.jsxs)(`div`,{style:{display:`grid`,gridTemplateColumns:`1fr 1fr`,gap:`15px`,marginBottom:`20px`},children:[(0,v.jsxs)(`div`,{style:{background:`#1e293b`,padding:`15px`,borderRadius:`12px`},children:[(0,v.jsx)(`div`,{style:{fontSize:`0.7rem`,color:`#94a3b8`,textTransform:`uppercase`,fontWeight:`bold`,marginBottom:`5px`},children:`Date & Time`}),(0,v.jsxs)(`div`,{style:{color:`#fff`,fontSize:`0.95rem`,fontWeight:600,display:`flex`,alignItems:`center`,gap:`6px`},children:[(0,v.jsx)(p,{size:16,color:`var(--accent-primary)`}),` `,String(P.date||`TBD`),` • `,String(P.time||`TBD`)]})]}),(0,v.jsxs)(`div`,{style:{background:`#1e293b`,padding:`15px`,borderRadius:`12px`},children:[(0,v.jsx)(`div`,{style:{fontSize:`0.7rem`,color:`#94a3b8`,textTransform:`uppercase`,fontWeight:`bold`,marginBottom:`5px`},children:`Location & Branch`}),(0,v.jsxs)(`div`,{style:{color:`#fff`,fontSize:`0.95rem`,fontWeight:600,display:`flex`,alignItems:`center`,gap:`6px`},children:[(0,v.jsx)(o,{size:16,color:`#f59e0b`}),` `,String(P.location||`Online`)]}),(0,v.jsxs)(`div`,{style:{color:`#cbd5e1`,fontSize:`0.85rem`,marginTop:`4px`},children:[`Branch: `,String(P.branch||`Global`)]})]})]}),P.description&&(0,v.jsxs)(`div`,{style:{background:`rgba(255,255,255,0.02)`,padding:`20px`,borderRadius:`12px`,border:`1px solid rgba(255,255,255,0.05)`,marginBottom:`20px`},children:[(0,v.jsx)(`div`,{style:{fontSize:`0.75rem`,color:`#94a3b8`,textTransform:`uppercase`,fontWeight:`bold`,marginBottom:`8px`},children:`Description`}),(0,v.jsx)(`div`,{style:{color:`#e2e8f0`,fontSize:`0.95rem`,lineHeight:`1.6`,whiteSpace:`pre-wrap`},children:String(P.description)})]}),P.poster&&P.poster!==`N/A`&&(0,v.jsxs)(`div`,{style:{marginTop:`20px`},children:[(0,v.jsx)(`div`,{style:{fontSize:`0.75rem`,color:`#94a3b8`,textTransform:`uppercase`,fontWeight:`bold`,marginBottom:`10px`},children:`Event Poster Attached`}),(0,v.jsxs)(`button`,{className:`btn-secondary hover-lift`,style:{background:`rgba(56, 189, 248, 0.1)`,border:`1px solid rgba(56, 189, 248, 0.3)`,color:`var(--accent-primary)`,width:`100%`,padding:`15px`,borderRadius:`12px`,cursor:`pointer`,display:`flex`,justifyContent:`center`,alignItems:`center`,gap:`8px`,fontWeight:`bold`,fontSize:`1rem`,transition:`0.2s`},onClick:()=>window.open(P.poster,`_blank`),children:[(0,v.jsx)(m,{size:22,weight:`fill`}),` View Full Event Poster`]})]})]})}),(0,v.jsx)(`style`,{children:`
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
      `})]})}export{b as default};