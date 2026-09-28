import{h as e,i as t,r as n,t as r,v as i}from"./apiConfig-Ci5fqGtT.js";import{k as a,t as o}from"./Layout-BinFYLo4.js";import{t as s}from"./CheckCircle.es-CxcgA4aV.js";import{t as c}from"./EnvelopeSimple.es-CTEeH4aK.js";import{t as l}from"./FilePdf.es-DWvuMYYq.js";import{t as u}from"./FloppyDisk.es-BHjgLrXD.js";import{t as d}from"./WarningCircle.es-Dmviow6g.js";import{t as f}from"./WhatsappLogo.es-DYIPkebU.js";import{r as p,s as m}from"./index-DqI9Sr3A.js";import{n as h}from"./StatusBadge-DvepW6lO.js";var g=i(e(),1),_=n();function v(){let[e,n]=(0,g.useState)({isOpen:!1,appRowNumber:null,status:``,date:``,time:``,venue:``}),i=localStorage.getItem(`tpoData`),v=i?JSON.parse(i):null,y=String(v?.role||``).toUpperCase(),b=String(v?.accessType||``).toLowerCase()===`superadmin`||y.includes(`ADMIN`)||y.includes(`HEAD`)||y.includes(`MANAGER`),x=y.includes(`TPO`)&&!b,[S,C]=(0,g.useState)([]),[w,T]=(0,g.useState)(!0),[E,D]=(0,g.useState)(``),[O,k]=(0,g.useState)(``),[A,j]=(0,g.useState)(`All`),[M,N]=(0,g.useState)(`newest`),[P,F]=(0,g.useState)({}),[I,L]=(0,g.useState)({}),[R,z]=(0,g.useState)({});(0,g.useEffect)(()=>{if(v){if(!x){window.location.href=`/dashboard`;return}(async()=>{try{let e=await t.post(`${r}/api/tpo/applications`,{assignedBranchesArray:v.assignedBranchesArray,tpoName:v.name});if(e.data.success){let t=(v.name||``).toLowerCase().trim(),n=e.data.applications.filter(e=>(e.tpoName||``).toLowerCase().trim()===t);C(n)}}catch(e){console.error(`Failed to load data`,e)}finally{T(!1)}})()}},[]);let B=e=>F(t=>({...t,[e]:!t[e]})),V=(e,t,n)=>{z(r=>({...r,[e]:{...r[e],[t]:n}}))},H=e=>{if(!e||typeof e!=`string`)return null;let t=e.match(/(?:file\/d\/|id=|\/d\/)([\w-]{25,})/);return t?`https://drive.google.com/file/d/${t[1]}/view`:e},U=async i=>{let a=i.rowNumber,o=R[a]||{},s=o.status===void 0?i.status:o.status,c=o.remarks===void 0?i.remarks:o.remarks;L(e=>({...e,[a]:`saving`}));try{let o={rowNumber:a,status:s,remarks:c,fullApp:i,currentUserEmail:v?.email||``,interviewDate:e.appRowNumber===a?e.date:``,interviewTime:e.appRowNumber===a?e.time:``,interviewVenue:e.appRowNumber===a?e.venue:``};(await t.post(`${r}/api/tpo/applications/update`,o)).data.success?(L(e=>({...e,[a]:`success`})),e.isOpen&&e.appRowNumber===a&&n({isOpen:!1,appRowNumber:null,status:``,date:``,time:``,venue:``}),setTimeout(()=>L(e=>({...e,[a]:null})),2500)):(L(e=>({...e,[a]:`error`})),setTimeout(()=>L(e=>({...e,[a]:null})),4500))}catch{L(e=>({...e,[a]:`error`})),setTimeout(()=>L(e=>({...e,[a]:null})),4500)}},W=S.filter(e=>{let t=new Date(e.date),n=isNaN(t)?``:`${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,`0`)}`,r=!O||n===O,i=A===`All`||e.course.toLowerCase().includes(A.toLowerCase()),a=E===``||e.name.toLowerCase().includes(E.toLowerCase())||e.jobId.toLowerCase().includes(E.toLowerCase())||e.company.toLowerCase().includes(E.toLowerCase());return r&&i&&a}),G={};W.forEach(e=>{let t=e.jobId?e.jobId:`${e.company} - ${e.position}`;!e.jobId&&e.company===`Unknown Company`&&(t=`Unspecified Job - Row ${e.rowNumber}`),G[t]||(G[t]={jobId:e.jobId,company:e.company,position:e.position,apps:[]}),G[t].apps.push(e)});let K=Object.keys(G).map(e=>({groupKey:e,...G[e]}));K.sort((e,t)=>{if(M===`jobId-az`)return(e.jobId||``).localeCompare(t.jobId||``);if(M===`jobId-za`)return(t.jobId||``).localeCompare(e.jobId||``);if(M===`company-az`)return(e.company||``).localeCompare(t.company||``);if(M===`company-za`)return(t.company||``).localeCompare(e.company||``);if(M===`newest`){let n=Math.max(...e.apps.map(e=>new Date(e.date).getTime()||0));return Math.max(...t.apps.map(e=>new Date(e.date).getTime()||0))-n}return 0});let q=[`Applied`,`Interview Scheduled`,`Interview Not Attended`,`No Response from Student`,`Got Offer`,`Placed`,`Student Rejected Offer`,`Company Rejected`];return x?(0,_.jsxs)(o,{children:[(0,_.jsxs)(`div`,{className:`page-container jt-premium-wrapper`,children:[(0,_.jsxs)(`div`,{className:`jt-hero-section`,children:[(0,_.jsx)(`h1`,{className:`jt-title`,children:`Job Tracker (Action)`}),(0,_.jsx)(`p`,{className:`jt-subtitle`,children:`Search, sort, and track interview statuses across your active jobs.`})]}),(0,_.jsxs)(`div`,{className:`jt-filter-bar`,children:[(0,_.jsx)(`input`,{type:`text`,className:`jt-input`,placeholder:`Search student, company, or ID...`,value:E,onChange:e=>D(e.target.value)}),(0,_.jsx)(`input`,{type:`month`,className:`jt-input`,value:O,onChange:e=>k(e.target.value)}),(0,_.jsxs)(`select`,{className:`jt-select`,value:A,onChange:e=>j(e.target.value),children:[(0,_.jsx)(`option`,{value:`All`,children:`All Courses`}),(0,_.jsx)(`option`,{value:`Industrial Automation`,children:`Industrial Automation`}),(0,_.jsx)(`option`,{value:`BMS & CCTV`,children:`BMS & CCTV`}),(0,_.jsx)(`option`,{value:`Embedded and IOT`,children:`Embedded and IOT`}),(0,_.jsx)(`option`,{value:`Python and Data Science`,children:`Python`}),(0,_.jsx)(`option`,{value:`Artificial Intelligence`,children:`AI`}),(0,_.jsx)(`option`,{value:`Digital Marketing`,children:`Digital Marketing`})]}),(0,_.jsxs)(`select`,{className:`jt-select`,value:M,onChange:e=>N(e.target.value),children:[(0,_.jsx)(`option`,{value:`newest`,children:`Sort: Recent Activity`}),(0,_.jsx)(`option`,{value:`jobId-az`,children:`Sort: Job ID (A-Z)`}),(0,_.jsx)(`option`,{value:`jobId-za`,children:`Sort: Job ID (Z-A)`}),(0,_.jsx)(`option`,{value:`company-az`,children:`Sort: Company Name (A-Z)`}),(0,_.jsx)(`option`,{value:`company-za`,children:`Sort: Company Name (Z-A)`})]})]}),(0,_.jsx)(`div`,{className:`jt-content-area`,children:w?(0,_.jsxs)(`div`,{className:`jt-loading`,children:[(0,_.jsx)(m,{size:48,className:`ph-spin`}),(0,_.jsx)(`p`,{children:`Syncing job opening data...`})]}):K.length===0?(0,_.jsx)(`div`,{className:`jt-empty-state`,children:`No applications found for your job openings.`}):K.map(e=>{let t=P[e.groupKey],r=e.position&&!e.position.includes(`undefined`)?e.position:``,i=e.company&&!e.company.includes(`Unknown`)?e.company:`Company Not Specified`,o=e.jobId?e.jobId:i,p=e.jobId?[i,r].filter(Boolean).join(` - `):r;return(0,_.jsxs)(`div`,{className:`jt-accordion-wrapper`,children:[(0,_.jsxs)(`div`,{className:`jt-accordion-header ${t?`active`:``}`,onClick:()=>B(e.groupKey),children:[(0,_.jsxs)(`div`,{children:[(0,_.jsx)(`strong`,{className:`jt-acc-title`,children:o}),(0,_.jsxs)(`span`,{className:`jt-acc-sub`,children:[p,` • `,e.apps.length,` Application(s)`]})]}),(0,_.jsx)(a,{size:20,className:`jt-chevron`,style:{transform:t?`rotate(180deg)`:`none`}})]}),t&&(0,_.jsxs)(`div`,{className:`jt-accordion-body`,children:[(0,_.jsxs)(`div`,{className:`jt-grid-header`,children:[(0,_.jsx)(`span`,{children:`STUDENT INFO & CONTACT`}),(0,_.jsx)(`span`,{style:{textAlign:`center`},children:`DATE APPLIED`}),(0,_.jsx)(`span`,{children:`STATUS UPDATE`}),(0,_.jsx)(`span`,{children:`REMARKS LOG`}),(0,_.jsx)(`span`,{style:{textAlign:`center`},children:`SAVE`})]}),(0,_.jsx)(`div`,{className:`jt-app-list`,children:e.apps.map(e=>{let t=R[e.rowNumber]||{},r=t.status===void 0?e.status:t.status,i=t.remarks===void 0?e.remarks:t.remarks,a=I[e.rowNumber],o=e.phone?String(e.phone).trim():``,p=e.email?String(e.email).trim():``,g=e.resume?String(e.resume).trim():``,v=o!==``&&o!==`N/A`,y=p!==``&&p!==`N/A`,b=g!==``&&g!==`N/A`;return(0,_.jsxs)(`div`,{className:`jt-app-card`,children:[(0,_.jsxs)(`div`,{className:`jt-col-student`,children:[(0,_.jsxs)(`div`,{className:`jt-stu-name`,children:[e.name,` `,(0,_.jsxs)(`span`,{className:`jt-stu-roll`,children:[`(`,e.roll,`)`]})]}),(0,_.jsxs)(`div`,{className:`jt-stu-course`,children:[e.branch,` • `,e.qual||e.course]}),(0,_.jsxs)(`div`,{className:`jt-badge-row`,children:[(0,_.jsxs)(`a`,{href:v?`https://wa.me/91${o.replace(/\D/g,``)}`:`#`,target:v?`_blank`:`_self`,rel:`noreferrer`,className:`jt-badge ${v?`chat`:`disabled`}`,onClick:e=>{v||e.preventDefault()},children:[(0,_.jsx)(f,{weight:`fill`,size:14}),` Chat`]}),(0,_.jsxs)(`a`,{href:y?`mailto:${p}`:`#`,className:`jt-badge ${y?`mail`:`disabled`}`,onClick:e=>{y||e.preventDefault()},children:[(0,_.jsx)(c,{weight:`bold`,size:14}),` Mail`]}),(0,_.jsxs)(`a`,{href:b?H(g)||g:`#`,target:b?`_blank`:`_self`,rel:`noreferrer`,className:`jt-badge ${b?`cv`:`disabled`}`,onClick:e=>{b||e.preventDefault()},children:[(0,_.jsx)(l,{weight:`fill`,size:14}),` CV`]})]})]}),(0,_.jsx)(`div`,{className:`jt-col-date`,children:e.date.split(` `)[0]}),(0,_.jsx)(`div`,{className:`jt-col-status`,children:(0,_.jsx)(`select`,{className:`jt-select status-${h(r)}`,value:r,onChange:t=>{let r=t.target.value;V(e.rowNumber,`status`,r),r===`Interview Scheduled`&&n({isOpen:!0,appRowNumber:e.rowNumber,status:r,date:``,time:``,venue:``})},children:q.map(e=>(0,_.jsx)(`option`,{value:e,children:e},e))})}),(0,_.jsx)(`div`,{className:`jt-col-remarks`,children:(0,_.jsx)(`input`,{type:`text`,placeholder:`Add remarks...`,className:`jt-input`,value:i,onChange:t=>V(e.rowNumber,`remarks`,t.target.value)})}),(0,_.jsxs)(`div`,{className:`jt-col-save`,children:[(0,_.jsx)(`button`,{className:`jt-save-btn ${a===`success`?`success`:a===`error`?`error`:``}`,onClick:()=>U(e),disabled:a===`saving`,children:a===`saving`?(0,_.jsx)(m,{size:18,className:`ph-spin`}):a===`success`?(0,_.jsx)(s,{size:18,weight:`bold`}):a===`error`?(0,_.jsx)(d,{size:18,weight:`bold`}):(0,_.jsxs)(_.Fragment,{children:[(0,_.jsx)(u,{size:18,weight:`bold`}),` Save`]})}),a===`success`&&(0,_.jsxs)(`span`,{className:`save-status-text success`,role:`status`,children:[(0,_.jsx)(s,{size:14,weight:`fill`}),` Saved`]}),a===`error`&&(0,_.jsxs)(`span`,{className:`save-status-text error`,role:`alert`,children:[(0,_.jsx)(d,{size:14,weight:`fill`}),` Could not save`]})]})]},e.rowNumber)})})]})]},e.groupKey)})})]}),e.isOpen&&(0,_.jsx)(`div`,{style:{position:`fixed`,top:0,left:0,right:0,bottom:0,backgroundColor:`rgba(0,0,0,0.85)`,zIndex:99999,display:`flex`,justifyContent:`center`,alignItems:`center`,padding:`20px`},children:(0,_.jsxs)(`div`,{className:`modal-card`,style:{maxWidth:`500px`,width:`100%`,background:`#0f1523`,border:`1px solid #1e293b`,borderRadius:`16px`,padding:`2rem`},children:[(0,_.jsxs)(`div`,{style:{borderBottom:`1px solid #1e293b`,paddingBottom:`1rem`,marginBottom:`1.5rem`,display:`flex`,justifyContent:`space-between`,alignItems:`flex-start`},children:[(0,_.jsxs)(`div`,{children:[(0,_.jsx)(`h2`,{style:{margin:0,color:`var(--accent-primary)`,fontSize:`1.4rem`},children:`Schedule Interview`}),(0,_.jsx)(`p`,{style:{margin:`5px 0 0 0`,color:`#94a3b8`,fontSize:`0.85rem`},children:`These details will be emailed to the student and recorded.`})]}),(0,_.jsx)(p,{size:24,style:{cursor:`pointer`,color:`#94a3b8`},onClick:()=>{V(e.appRowNumber,`status`,`Applied`),n({...e,isOpen:!1})}})]}),(0,_.jsxs)(`div`,{style:{display:`grid`,gridTemplateColumns:`1fr 1fr`,gap:`15px`,marginBottom:`15px`},children:[(0,_.jsxs)(`div`,{children:[(0,_.jsx)(`label`,{style:{display:`block`,fontSize:`0.8rem`,color:`#94a3b8`,marginBottom:`5px`,fontWeight:`bold`},children:`Interview Date *`}),(0,_.jsx)(`input`,{type:`date`,className:`jt-input`,value:e.date,onChange:t=>n({...e,date:t.target.value})})]}),(0,_.jsxs)(`div`,{children:[(0,_.jsx)(`label`,{style:{display:`block`,fontSize:`0.8rem`,color:`#94a3b8`,marginBottom:`5px`,fontWeight:`bold`},children:`Interview Time *`}),(0,_.jsx)(`input`,{type:`time`,className:`jt-input`,value:e.time,onChange:t=>n({...e,time:t.target.value})})]})]}),(0,_.jsxs)(`div`,{style:{marginBottom:`25px`},children:[(0,_.jsx)(`label`,{style:{display:`block`,fontSize:`0.8rem`,color:`#94a3b8`,marginBottom:`5px`,fontWeight:`bold`},children:`Venue / Google Meet Link *`}),(0,_.jsx)(`input`,{type:`text`,className:`jt-input`,placeholder:`e.g., Calicut Branch or Meet Link`,value:e.venue,onChange:t=>n({...e,venue:t.target.value})})]}),(0,_.jsxs)(`div`,{style:{display:`flex`,justifyContent:`flex-end`,gap:`10px`,borderTop:`1px solid #1e293b`,paddingTop:`1.5rem`},children:[(0,_.jsx)(`button`,{className:`jt-btn-cancel`,onClick:()=>{V(e.appRowNumber,`status`,`Applied`),n({...e,isOpen:!1})},children:`Cancel`}),(0,_.jsx)(`button`,{className:`jt-save-btn`,style:{width:`auto`},onClick:()=>{if(!e.date||!e.time||!e.venue)return alert(`Please fill in all interview details to proceed.`);let t=S.find(t=>t.rowNumber===e.appRowNumber);t&&U(t)},children:`Confirm & Send Mail`})]})]})}),(0,_.jsx)(`style`,{children:`
        /* Global Page Adjustments */
        .jt-premium-wrapper {
          font-family: 'Inter', sans-serif;
        }

        /* Top Hero Section */
        .jt-hero-section {
          margin-bottom: 25px;
        }
        .jt-title {
          font-size: 2.2rem;
          font-weight: 800;
          color: #fff;
          margin: 0 0 5px 0;
        }
        .jt-subtitle {
          color: #94a3b8;
          font-size: 1.05rem;
          margin: 0;
        }

        /* Sleek Filter Bar */
        .jt-filter-bar {
          display: flex;
          gap: 15px;
          margin-bottom: 30px;
          flex-wrap: wrap;
        }

        /* Inputs & Selects matching the Dark Theme */
        .jt-input, .jt-select {
          background: #0b1121; /* Very dark inner background */
          border: 1px solid #1e293b;
          color: #f8fafc;
          padding: 12px 16px;
          border-radius: 8px;
          font-size: 0.9rem;
          outline: none;
          transition: all 0.2s ease;
        }
        .jt-input:focus, .jt-select:focus {
          border-color: var(--accent-primary);
          box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.1);
        }
        .jt-input::placeholder { color: #475569; }
        .jt-select option { background: #0f1523; color: #fff; padding: 10px; }
        
        /* Loading & Empty States */
        .jt-loading, .jt-empty-state {
          text-align: center;
          padding: 4rem 0;
          color: var(--accent-primary);
        }
        .jt-empty-state {
          color: #64748b;
          font-size: 1.1rem;
        }

        /* Accordion Wrapper */
        .jt-accordion-wrapper {
          margin-bottom: 20px;
        }

        /* Accordion Header */
        .jt-accordion-header {
          background: #111827; /* Dark card background */
          border: 1px solid #1e293b;
          padding: 1.2rem 1.5rem;
          border-radius: 12px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          cursor: pointer;
          transition: 0.2s ease;
        }
        .jt-accordion-header:hover {
          background: #161e2e;
          border-color: #334155;
        }
        .jt-accordion-header.active {
          border-bottom-left-radius: 0;
          border-bottom-right-radius: 0;
          border-bottom: 1px solid transparent;
        }
        
        .jt-acc-title {
          font-size: 1.1rem;
          color: var(--accent-primary); /* Vibrant Cyan */
          display: block;
          margin-bottom: 4px;
        }
        .jt-acc-sub {
          font-size: 0.85rem;
          color: #64748b;
        }
        .jt-chevron {
          color: #94a3b8;
          transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        /* Accordion Body */
        .jt-accordion-body {
          background: transparent;
          padding: 10px 0 0 0;
          animation: fadeIn 0.3s ease;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-5px); }
          to { opacity: 1; transform: translateY(0); }
        }

        /* Grid Based Table Header */
        .jt-grid-header {
          display: grid;
          grid-template-columns: 2.5fr 1fr 1.5fr 1.5fr 0.8fr;
          gap: 15px;
          padding: 0 20px 12px 20px;
          font-size: 0.75rem;
          font-weight: 800;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        /* The Application Cards (Mockup accurate) */
        .jt-app-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .jt-app-card {
          display: grid;
          grid-template-columns: 2.5fr 1fr 1.5fr 1.5fr 0.8fr;
          gap: 15px;
          background: #111827; /* Same dark tone as accordion header */
          border: 1px solid #1e293b;
          border-radius: 12px;
          padding: 20px;
          align-items: center;
          transition: 0.2s;
        }
        .jt-app-card:hover {
          border-color: rgba(255,255,255,0.1);
        }

        /* Columns Content */
        .jt-stu-name {
          color: #fff;
          font-size: 1.05rem;
          font-weight: 700;
          margin-bottom: 4px;
        }
        .jt-stu-roll {
          color: #64748b;
          font-size: 0.85rem;
          font-weight: 600;
        }
        .jt-stu-course {
          color: #94a3b8;
          font-size: 0.8rem;
          margin-bottom: 12px;
        }

        .jt-col-date {
          color: #94a3b8;
          font-size: 0.9rem;
          text-align: center;
        }

        /* Action Badges */
        .jt-badge-row {
          display: flex;
          gap: 8px;
          align-items: center;
          flex-wrap: wrap;
        }
        
        .jt-badge {
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 4px 10px;
          border-radius: 6px;
          font-size: 0.75rem;
          font-weight: 700;
          text-decoration: none;
          transition: 0.2s;
        }
        
        .jt-badge.chat { color: #10b981; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); }
        .jt-badge.chat:hover { background: rgba(16, 185, 129, 0.25); }
        
        .jt-badge.mail { color: var(--accent-primary); background: rgba(56, 189, 248, 0.15); border: 1px solid rgba(56, 189, 248, 0.3); }
        .jt-badge.mail:hover { background: rgba(56, 189, 248, 0.25); }
        
        .jt-badge.cv { color: #f59e0b; background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.3); }
        .jt-badge.cv:hover { background: rgba(245, 158, 11, 0.25); }
        
        .jt-badge.disabled { color: #475569; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); cursor: not-allowed; }

        /* Save & Cancel Buttons */
        .jt-save-btn {
          width: 100%;
          background: var(--accent-primary); /* The signature Cyan from mockup */
          color: #ffffff;
          border: none;
          padding: 10px 16px;
          border-radius: 8px;
          font-weight: 800;
          font-size: 0.85rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          transition: all 0.2s;
        }
        .jt-save-btn:hover:not(:disabled) {
          background: color-mix(in srgb, var(--accent-primary) 82%, #0f172a);
          color: #fff;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px color-mix(in srgb, var(--accent-primary) 35%, transparent);
        }
        .jt-col-save { display: flex; flex-direction: column; align-items: stretch; gap: 6px; }
        .jt-save-btn:disabled { opacity: 0.7; cursor: not-allowed; }
        .jt-save-btn.success { background: #10b981; color: #fff; }
        .jt-save-btn.error { background: #ef4444; color: #fff; }
        .jt-select.status-success { border-color: rgba(16,185,129,.65); color: #10b981; }
        .jt-select.status-danger { border-color: rgba(239,68,68,.65); color: #ef4444; }
        .jt-select.status-warning { border-color: rgba(245,158,11,.65); color: #f59e0b; }
        .jt-select.status-info { border-color: rgba(59,130,246,.65); color: #60a5fa; }
        
        .jt-btn-cancel {
          background: transparent;
          border: 1px solid #334155;
          color: #cbd5e1;
          padding: 10px 20px;
          border-radius: 8px;
          cursor: pointer;
          font-weight: bold;
          transition: 0.2s;
        }
        .jt-btn-cancel:hover { background: rgba(255,255,255,0.05); color: #fff; }

        /* Responsive Breakpoints */
        @media (max-width: 1024px) {
          .jt-grid-header { display: none; } /* Hide headers on small screens */
          .jt-app-card {
            grid-template-columns: 1fr;
            gap: 20px;
          }
          .jt-col-date { text-align: left; }
          .jt-col-date::before { content: "Date Applied: "; color: #64748b; font-size: 0.8rem; margin-right: 5px; }
        }
      `})]}):(0,_.jsx)(_.Fragment,{})}export{v as default};