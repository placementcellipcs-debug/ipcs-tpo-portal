import{g as e,i as t,m as n,r,t as i,y as a}from"./apiConfig-DolS5KJD.js";import{_ as o,k as s,s as c,t as l}from"./Layout-BGwENcMh.js";import{t as u}from"./CalendarBlank.es-DfLlD_st.js";import{t as d}from"./CheckCircle.es-U0qpg7ap.js";import{t as f}from"./EnvelopeSimple.es-msF9yMog.js";import{t as p}from"./FilePdf.es-CZUUWpfQ.js";import{t as m}from"./FloppyDisk.es-BSrHAoGZ.js";import{t as h}from"./MagnifyingGlass.es-DsfyxACz.js";import{t as g}from"./WarningCircle.es-BKMOZQag.js";import{t as _}from"./WhatsappLogo.es-Dw1aWxVX.js";import{r as v,s as y}from"./index-Bqe7eqzn.js";import{t as b}from"./statusTone-VMCf5tIT.js";var x=a(e(),1),S=r(),C=[`Pending`,`Shortlisted`,`Interview Scheduled`,`Interview Attended`,`Interview Not Attended`,`Got Offer`,`Placed`,`Student Not Interested`,`Student Rejected Offer`,`Company Rejected`,`No Response from Student`];function w(){let[e,n]=(0,x.useState)([]),[r,a]=(0,x.useState)(!0),[l,f]=(0,x.useState)(``),[p,_]=(0,x.useState)(``),[v,w]=(0,x.useState)({}),[T,E]=(0,x.useState)({}),[D,O]=(0,x.useState)({});(0,x.useEffect)(()=>{let e=!0;return t.get(`${i}/api/tpo/drives`).then(t=>{if(e){if(!t.data?.success)throw Error(t.data?.message||`Could not load placement drives.`);n(t.data.drives||[])}}).catch(t=>{e&&f(t.response?.data?.message||t.message||`Could not load placement drives.`)}).finally(()=>{e&&a(!1)}),()=>{e=!1}},[]);let k=(0,x.useMemo)(()=>{let t=new Map;return e.forEach(e=>{e.driveId&&(t.has(e.driveId)||t.set(e.driveId,{driveId:e.driveId,driveTpo:e.driveTpo,driveDate:e.driveDate,driveLocation:e.driveLocation,applicants:[]}),e.name!==`NO_APPLICANTS`&&Number(e.rowNumber)>=2&&Number.isInteger(Number(e.rowNumber))&&t.get(e.driveId).applicants.push(e))}),[...t.values()].filter(e=>[e.driveId,e.driveTpo,e.driveLocation,...e.applicants.flatMap(e=>[e.name,e.course,e.branch,e.email])].join(` `).toLowerCase().includes(p.trim().toLowerCase())).sort((e,t)=>String(t.driveDate||``).localeCompare(String(e.driveDate||``)))},[e,p]),A=k.reduce((e,t)=>e+t.applicants.length,0),j=k.reduce((e,t)=>e+t.applicants.filter(e=>!e.studentStatus||/pending|unknown/i.test(e.studentStatus)).length,0),M=(e,t,n)=>E(r=>({...r,[e.rowNumber]:{...r[e.rowNumber],[t]:n}})),N=async e=>{let r=T[e.rowNumber]||{},a=r.studentStatus??e.studentStatus??`Pending`,o=r.remarks??e.remarks??``;O(t=>({...t,[e.rowNumber]:`saving`}));try{let r=await t.post(`${i}/api/tpo/drives/update`,{rowNumber:e.rowNumber,studentStatus:a,remarks:o});if(!r.data?.success)throw Error(r.data?.message||`Unable to save this student.`);f(``),n(t=>t.map(t=>t.rowNumber===e.rowNumber?{...t,studentStatus:a,remarks:o}:t)),E(t=>{let n={...t};return delete n[e.rowNumber],n}),O(t=>({...t,[e.rowNumber]:`success`})),window.setTimeout(()=>O(t=>({...t,[e.rowNumber]:null})),2600)}catch(t){O(t=>({...t,[e.rowNumber]:`error`})),f(t.response?.data?.message||t.message||`Unable to save this student.`)}};return(0,S.jsxs)(`section`,{className:`pdt-shell`,"aria-label":`Placement drive tracking`,children:[(0,S.jsxs)(`div`,{className:`pdt-summary-row`,children:[(0,S.jsxs)(`div`,{children:[(0,S.jsx)(`span`,{className:`pdt-summary-label`,children:`CONDUCTED DRIVES`}),(0,S.jsx)(`strong`,{children:k.length})]}),(0,S.jsxs)(`div`,{children:[(0,S.jsx)(`span`,{className:`pdt-summary-label`,children:`REGISTERED STUDENTS`}),(0,S.jsx)(`strong`,{children:A})]}),(0,S.jsxs)(`div`,{children:[(0,S.jsx)(`span`,{className:`pdt-summary-label`,children:`PENDING UPDATES`}),(0,S.jsx)(`strong`,{children:j})]}),(0,S.jsxs)(`label`,{className:`pdt-search`,children:[(0,S.jsx)(h,{size:19}),(0,S.jsx)(`input`,{value:p,onChange:e=>_(e.target.value),placeholder:`Search drives or students`})]})]}),l&&(0,S.jsxs)(`div`,{className:`pdt-alert`,role:`alert`,children:[(0,S.jsx)(g,{size:18}),l]}),r?(0,S.jsxs)(`div`,{className:`pdt-empty`,children:[(0,S.jsx)(y,{className:`ph-spin`,size:32}),`Loading your placement drives…`]}):k.length===0?(0,S.jsx)(`div`,{className:`pdt-empty`,children:p?`No placement drives match this search.`:`No placement drives are assigned to your account yet.`}):(0,S.jsx)(`div`,{className:`pdt-drive-list`,children:k.map(e=>{let t=!!v[e.driveId],n=e.applicants.filter(e=>/placed|offer/i.test(e.studentStatus||``)).length;return(0,S.jsxs)(`article`,{className:`pdt-drive-card ${t?`expanded`:``}`,children:[(0,S.jsxs)(`button`,{type:`button`,className:`pdt-drive-heading`,"aria-expanded":t,onClick:()=>w(t=>({...t,[e.driveId]:!t[e.driveId]})),children:[(0,S.jsx)(`div`,{className:`pdt-drive-mark`,children:(0,S.jsx)(u,{size:22,weight:`fill`})}),(0,S.jsxs)(`div`,{className:`pdt-drive-title`,children:[(0,S.jsx)(`span`,{className:`pdt-eyebrow`,children:`PLACEMENT DRIVE`}),(0,S.jsx)(`strong`,{children:e.driveId}),(0,S.jsxs)(`span`,{className:`pdt-drive-meta`,children:[(0,S.jsxs)(`span`,{children:[(0,S.jsx)(u,{size:15}),e.driveDate||`Date not set`]}),(0,S.jsxs)(`span`,{children:[(0,S.jsx)(o,{size:15}),e.driveLocation||`Location not set`]})]})]}),(0,S.jsxs)(`div`,{className:`pdt-drive-metrics`,children:[(0,S.jsxs)(`span`,{children:[(0,S.jsx)(c,{size:17}),e.applicants.length,` students`]}),(0,S.jsxs)(`span`,{className:`pdt-placed-count`,children:[n,` offer / placed`]})]}),(0,S.jsx)(s,{className:`pdt-chevron`,size:20})]}),t&&(0,S.jsx)(`div`,{className:`pdt-student-list`,children:e.applicants.length===0?(0,S.jsx)(`div`,{className:`pdt-no-students`,children:`This drive has no registrations yet.`}):e.applicants.map(e=>{let t=T[e.rowNumber]||{},n=t.studentStatus??e.studentStatus??`Pending`,r=t.remarks??e.remarks??``,i=D[e.rowNumber];return(0,S.jsxs)(`div`,{className:`pdt-student-row`,children:[(0,S.jsxs)(`div`,{className:`pdt-student-info`,children:[(0,S.jsx)(`div`,{className:`pdt-student-avatar`,children:String(e.name||`?`).trim().charAt(0).toUpperCase()}),(0,S.jsxs)(`div`,{children:[(0,S.jsx)(`strong`,{children:e.name||`Unnamed student`}),(0,S.jsx)(`span`,{children:[e.roll,e.course||e.branch].filter(Boolean).join(` · `)||`Course details unavailable`})]})]}),(0,S.jsxs)(`div`,{className:`pdt-student-registration`,children:[(0,S.jsx)(`span`,{className:`pdt-eyebrow`,children:`REGISTRATION`}),(0,S.jsx)(`span`,{children:e.regStatus||`Registered`})]}),(0,S.jsxs)(`label`,{className:`pdt-field`,children:[(0,S.jsx)(`span`,{children:`Status`}),(0,S.jsxs)(`select`,{className:`tone-${b(n)}`,value:n,onChange:t=>M(e,`studentStatus`,t.target.value),children:[n&&!C.includes(n)&&(0,S.jsx)(`option`,{value:n,children:n}),C.map(e=>(0,S.jsx)(`option`,{value:e,children:e},e))]})]}),(0,S.jsxs)(`label`,{className:`pdt-field pdt-remarks`,children:[(0,S.jsx)(`span`,{children:`Remarks`}),(0,S.jsx)(`textarea`,{rows:2,value:r,onChange:t=>M(e,`remarks`,t.target.value),placeholder:`Add an update for this student`})]}),(0,S.jsx)(`div`,{className:`pdt-save-wrap`,children:(0,S.jsxs)(`button`,{type:`button`,className:`pdt-save ${i||``}`,disabled:i===`saving`,onClick:()=>N(e),children:[i===`saving`?(0,S.jsx)(y,{className:`ph-spin`,size:18}):i===`success`?(0,S.jsx)(d,{size:18,weight:`fill`}):i===`error`?(0,S.jsx)(g,{size:18,weight:`fill`}):(0,S.jsx)(m,{size:18,weight:`bold`}),i===`success`?`Saved`:i===`error`?`Retry`:`Save`]})})]},e.rowNumber)})})]},e.driveId)})})]})}function T(){let[e,r]=n(),a=e.get(`tab`)===`drives`?`drives`:`jobs`,[o,c]=(0,x.useState)({isOpen:!1,appRowNumber:null,status:``,date:``,time:``,venue:``}),u=localStorage.getItem(`tpoData`),h=u?JSON.parse(u):null,C=String(h?.role||``).toUpperCase(),T=String(h?.accessType||``).toLowerCase()===`superadmin`||C.includes(`ADMIN`)||C.includes(`HEAD`)||C.includes(`MANAGER`),E=(C.includes(`TPO`)||C.includes(`PLACEMENT OFFICER`))&&!T,D=E,[O,k]=(0,x.useState)([]),[A,j]=(0,x.useState)(!0),[M,N]=(0,x.useState)(``),[P,F]=(0,x.useState)(``),[I,L]=(0,x.useState)(`All`),[R,z]=(0,x.useState)(`newest`),[B,V]=(0,x.useState)({}),[H,U]=(0,x.useState)({}),[W,G]=(0,x.useState)({});(0,x.useEffect)(()=>{if(h){if(!E){window.location.href=`/dashboard`;return}(async()=>{try{let e=await t.post(`${i}/api/tpo/applications`,{assignedBranchesArray:h.assignedBranchesArray,tpoName:h.name});if(e.data.success){let t=(h.name||``).toLowerCase().trim(),n=e.data.applications.filter(e=>(e.tpoName||``).toLowerCase().trim()===t);k(n)}}catch(e){console.error(`Failed to load data`,e)}finally{j(!1)}})()}},[a]);let K=e=>V(t=>({...t,[e]:!t[e]})),q=(e,t,n)=>{G(r=>({...r,[e]:{...r[e],[t]:n}}))},J=e=>{if(!e||typeof e!=`string`)return null;let t=e.match(/(?:file\/d\/|id=|\/d\/)([\w-]{25,})/);return t?`https://drive.google.com/file/d/${t[1]}/view`:e},Y=async e=>{let n=e.rowNumber,r=W[n]||{},i=r.status===void 0?e.status:r.status,a=r.remarks===void 0?e.remarks:r.remarks;U(e=>({...e,[n]:`saving`}));try{let r={rowNumber:n,status:i,remarks:a,fullApp:e,currentUserEmail:h?.email||``,interviewDate:o.appRowNumber===n?o.date:``,interviewTime:o.appRowNumber===n?o.time:``,interviewVenue:o.appRowNumber===n?o.venue:``};(await t.post(`https://ipcs-tpo-portal-u0l6.onrender.com/api/tpo/applications/update`,r)).data.success?(U(e=>({...e,[n]:`success`})),o.isOpen&&o.appRowNumber===n&&c({isOpen:!1,appRowNumber:null,status:``,date:``,time:``,venue:``}),setTimeout(()=>U(e=>({...e,[n]:null})),2500)):(U(e=>({...e,[n]:`error`})),setTimeout(()=>U(e=>({...e,[n]:null})),4500))}catch{U(e=>({...e,[n]:`error`})),setTimeout(()=>U(e=>({...e,[n]:null})),4500)}},X=O.filter(e=>{let t=new Date(e.date),n=isNaN(t)?``:`${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,`0`)}`,r=!P||n===P,i=I===`All`||e.course.toLowerCase().includes(I.toLowerCase()),a=M===``||e.name.toLowerCase().includes(M.toLowerCase())||e.jobId.toLowerCase().includes(M.toLowerCase())||e.company.toLowerCase().includes(M.toLowerCase());return r&&i&&a}),Z={};X.forEach(e=>{let t=e.jobId?e.jobId:`${e.company} - ${e.position}`;!e.jobId&&e.company===`Unknown Company`&&(t=`Unspecified Job - Row ${e.rowNumber}`),Z[t]||(Z[t]={jobId:e.jobId,company:e.company,position:e.position,apps:[]}),Z[t].apps.push(e)});let Q=Object.keys(Z).map(e=>({groupKey:e,...Z[e]}));Q.sort((e,t)=>{if(R===`jobId-az`)return(e.jobId||``).localeCompare(t.jobId||``);if(R===`jobId-za`)return(t.jobId||``).localeCompare(e.jobId||``);if(R===`company-az`)return(e.company||``).localeCompare(t.company||``);if(R===`company-za`)return(t.company||``).localeCompare(e.company||``);if(R===`newest`){let n=Math.max(...e.apps.map(e=>new Date(e.date).getTime()||0));return Math.max(...t.apps.map(e=>new Date(e.date).getTime()||0))-n}return 0});let $=[`Applied`,`Shortlisted`,`Interview Scheduled`,`Interview Not Attended`,`No Response from Student`,`Got Offer`,`Placed`,`Student Not Interested`,`Student Rejected Offer`,`Company Rejected`];return D?(0,S.jsxs)(l,{children:[(0,S.jsxs)(`div`,{className:`page-container jt-premium-wrapper`,children:[(0,S.jsxs)(`div`,{className:`jt-hero-section`,children:[(0,S.jsx)(`h1`,{className:`jt-title`,children:`Placement workspace`}),(0,S.jsx)(`p`,{className:`jt-subtitle`,children:`Manage job applications and placement drive registrations from one place.`})]}),(0,S.jsxs)(`div`,{className:`jt-workspace-tabs`,role:`tablist`,"aria-label":`Placement tracking`,children:[E&&(0,S.jsxs)(`button`,{type:`button`,role:`tab`,"aria-selected":a===`jobs`,className:a===`jobs`?`active`:``,onClick:()=>r({}),children:[`Job Tracker`,(0,S.jsx)(`span`,{children:O.length})]}),(0,S.jsx)(`button`,{type:`button`,role:`tab`,"aria-selected":a===`drives`,className:a===`drives`?`active`:``,onClick:()=>r({tab:`drives`}),children:`Placement Drives`})]}),a===`drives`?(0,S.jsx)(w,{}):(0,S.jsxs)(S.Fragment,{children:[(0,S.jsxs)(`div`,{className:`jt-filter-bar`,children:[(0,S.jsx)(`input`,{type:`text`,className:`jt-input`,placeholder:`Search student, company, or ID...`,value:M,onChange:e=>N(e.target.value)}),(0,S.jsx)(`input`,{type:`month`,className:`jt-input`,value:P,onChange:e=>F(e.target.value)}),(0,S.jsxs)(`select`,{className:`jt-select`,value:I,onChange:e=>L(e.target.value),children:[(0,S.jsx)(`option`,{value:`All`,children:`All Courses`}),(0,S.jsx)(`option`,{value:`Industrial Automation`,children:`Industrial Automation`}),(0,S.jsx)(`option`,{value:`BMS & CCTV`,children:`BMS & CCTV`}),(0,S.jsx)(`option`,{value:`Embedded and IOT`,children:`Embedded and IOT`}),(0,S.jsx)(`option`,{value:`Python and Data Science`,children:`Python`}),(0,S.jsx)(`option`,{value:`Artificial Intelligence`,children:`AI`}),(0,S.jsx)(`option`,{value:`Digital Marketing`,children:`Digital Marketing`})]}),(0,S.jsxs)(`select`,{className:`jt-select`,value:R,onChange:e=>z(e.target.value),children:[(0,S.jsx)(`option`,{value:`newest`,children:`Sort: Recent Activity`}),(0,S.jsx)(`option`,{value:`jobId-az`,children:`Sort: Job ID (A-Z)`}),(0,S.jsx)(`option`,{value:`jobId-za`,children:`Sort: Job ID (Z-A)`}),(0,S.jsx)(`option`,{value:`company-az`,children:`Sort: Company Name (A-Z)`}),(0,S.jsx)(`option`,{value:`company-za`,children:`Sort: Company Name (Z-A)`})]})]}),(0,S.jsx)(`div`,{className:`jt-content-area`,children:A?(0,S.jsxs)(`div`,{className:`jt-loading`,children:[(0,S.jsx)(y,{size:48,className:`ph-spin`}),(0,S.jsx)(`p`,{children:`Syncing job opening data...`})]}):Q.length===0?(0,S.jsx)(`div`,{className:`jt-empty-state`,children:`No applications found for your job openings.`}):Q.map(e=>{let t=B[e.groupKey],n=e.position&&!e.position.includes(`undefined`)?e.position:``,r=e.company&&!e.company.includes(`Unknown`)?e.company:`Company Not Specified`,i=e.jobId?e.jobId:r,a=e.jobId?[r,n].filter(Boolean).join(` - `):n;return(0,S.jsxs)(`div`,{className:`jt-accordion-wrapper`,children:[(0,S.jsxs)(`div`,{className:`jt-accordion-header ${t?`active`:``}`,onClick:()=>K(e.groupKey),children:[(0,S.jsxs)(`div`,{children:[(0,S.jsx)(`strong`,{className:`jt-acc-title`,children:i}),(0,S.jsxs)(`span`,{className:`jt-acc-sub`,children:[a,` • `,e.apps.length,` Application(s)`]})]}),(0,S.jsx)(s,{size:20,className:`jt-chevron`,style:{transform:t?`rotate(180deg)`:`none`}})]}),t&&(0,S.jsxs)(`div`,{className:`jt-accordion-body`,children:[(0,S.jsxs)(`div`,{className:`jt-grid-header`,children:[(0,S.jsx)(`span`,{children:`STUDENT INFO & CONTACT`}),(0,S.jsx)(`span`,{style:{textAlign:`center`},children:`DATE APPLIED`}),(0,S.jsx)(`span`,{children:`STATUS UPDATE`}),(0,S.jsx)(`span`,{children:`REMARKS LOG`}),(0,S.jsx)(`span`,{style:{textAlign:`center`},children:`SAVE`})]}),(0,S.jsx)(`div`,{className:`jt-app-list`,children:e.apps.map(e=>{let t=W[e.rowNumber]||{},n=t.status===void 0?e.status:t.status,r=t.remarks===void 0?e.remarks:t.remarks,i=H[e.rowNumber],a=e.phone?String(e.phone).trim():``,o=e.email?String(e.email).trim():``,s=e.resume?String(e.resume).trim():``,l=a!==``&&a!==`N/A`,u=o!==``&&o!==`N/A`,h=s!==``&&s!==`N/A`;return(0,S.jsxs)(`div`,{className:`jt-app-card`,children:[(0,S.jsxs)(`div`,{className:`jt-col-student`,children:[(0,S.jsxs)(`div`,{className:`jt-stu-name`,children:[e.name,` `,(0,S.jsxs)(`span`,{className:`jt-stu-roll`,children:[`(`,e.roll,`)`]})]}),(0,S.jsxs)(`div`,{className:`jt-stu-course`,children:[e.branch,` • `,e.qual||e.course]}),(0,S.jsxs)(`div`,{className:`jt-badge-row`,children:[(0,S.jsxs)(`a`,{href:l?`https://wa.me/91${a.replace(/\D/g,``)}`:`#`,target:l?`_blank`:`_self`,rel:`noreferrer`,className:`jt-badge ${l?`chat`:`disabled`}`,onClick:e=>{l||e.preventDefault()},children:[(0,S.jsx)(_,{weight:`fill`,size:14}),` Chat`]}),(0,S.jsxs)(`a`,{href:u?`mailto:${o}`:`#`,className:`jt-badge ${u?`mail`:`disabled`}`,onClick:e=>{u||e.preventDefault()},children:[(0,S.jsx)(f,{weight:`bold`,size:14}),` Mail`]}),(0,S.jsxs)(`a`,{href:h?J(s)||s:`#`,target:h?`_blank`:`_self`,rel:`noreferrer`,className:`jt-badge ${h?`cv`:`disabled`}`,onClick:e=>{h||e.preventDefault()},children:[(0,S.jsx)(p,{weight:`fill`,size:14}),` CV`]})]})]}),(0,S.jsx)(`div`,{className:`jt-col-date`,children:e.date.split(` `)[0]}),(0,S.jsx)(`div`,{className:`jt-col-status`,children:(0,S.jsx)(`select`,{className:`jt-select status-${b(n)}`,value:n,onChange:t=>{let n=t.target.value;q(e.rowNumber,`status`,n),n===`Interview Scheduled`&&c({isOpen:!0,appRowNumber:e.rowNumber,status:n,date:``,time:``,venue:``})},children:$.map(e=>(0,S.jsx)(`option`,{value:e,children:e},e))})}),(0,S.jsx)(`div`,{className:`jt-col-remarks`,children:(0,S.jsx)(`input`,{type:`text`,placeholder:`Add remarks...`,className:`jt-input`,value:r,onChange:t=>q(e.rowNumber,`remarks`,t.target.value)})}),(0,S.jsxs)(`div`,{className:`jt-col-save`,children:[(0,S.jsx)(`button`,{className:`jt-save-btn ${i===`success`?`success`:i===`error`?`error`:``}`,onClick:()=>Y(e),disabled:i===`saving`,children:i===`saving`?(0,S.jsx)(y,{size:18,className:`ph-spin`}):i===`success`?(0,S.jsx)(d,{size:18,weight:`bold`}):i===`error`?(0,S.jsx)(g,{size:18,weight:`bold`}):(0,S.jsxs)(S.Fragment,{children:[(0,S.jsx)(m,{size:18,weight:`bold`}),` Save`]})}),i===`success`&&(0,S.jsxs)(`span`,{className:`save-status-text success`,role:`status`,children:[(0,S.jsx)(d,{size:14,weight:`fill`}),` Saved`]}),i===`error`&&(0,S.jsxs)(`span`,{className:`save-status-text error`,role:`alert`,children:[(0,S.jsx)(g,{size:14,weight:`fill`}),` Could not save`]})]})]},e.rowNumber)})})]})]},e.groupKey)})})]})]}),o.isOpen&&(0,S.jsx)(`div`,{style:{position:`fixed`,top:0,left:0,right:0,bottom:0,backgroundColor:`rgba(0,0,0,0.85)`,zIndex:99999,display:`flex`,justifyContent:`center`,alignItems:`center`,padding:`20px`},onClick:e=>{e.target===e.currentTarget&&c(e=>({...e,isOpen:!1}))},children:(0,S.jsxs)(`div`,{className:`modal-card`,style:{maxWidth:`500px`,width:`100%`,background:`#0f1523`,border:`1px solid #1e293b`,borderRadius:`16px`,padding:`2rem`},children:[(0,S.jsxs)(`div`,{style:{borderBottom:`1px solid #1e293b`,paddingBottom:`1rem`,marginBottom:`1.5rem`,display:`flex`,justifyContent:`space-between`,alignItems:`flex-start`},children:[(0,S.jsxs)(`div`,{children:[(0,S.jsx)(`h2`,{style:{margin:0,color:`var(--accent-primary)`,fontSize:`1.4rem`},children:`Schedule Interview`}),(0,S.jsx)(`p`,{style:{margin:`5px 0 0 0`,color:`#94a3b8`,fontSize:`0.85rem`},children:`These details will be emailed to the student and recorded.`})]}),(0,S.jsx)(v,{size:24,style:{cursor:`pointer`,color:`#94a3b8`},onClick:()=>{q(o.appRowNumber,`status`,`Applied`),c({...o,isOpen:!1})}})]}),(0,S.jsxs)(`div`,{style:{display:`grid`,gridTemplateColumns:`1fr 1fr`,gap:`15px`,marginBottom:`15px`},children:[(0,S.jsxs)(`div`,{children:[(0,S.jsx)(`label`,{style:{display:`block`,fontSize:`0.8rem`,color:`#94a3b8`,marginBottom:`5px`,fontWeight:`bold`},children:`Interview Date *`}),(0,S.jsx)(`input`,{type:`date`,className:`jt-input`,value:o.date,onChange:e=>c({...o,date:e.target.value})})]}),(0,S.jsxs)(`div`,{children:[(0,S.jsx)(`label`,{style:{display:`block`,fontSize:`0.8rem`,color:`#94a3b8`,marginBottom:`5px`,fontWeight:`bold`},children:`Interview Time *`}),(0,S.jsx)(`input`,{type:`time`,className:`jt-input`,value:o.time,onChange:e=>c({...o,time:e.target.value})})]})]}),(0,S.jsxs)(`div`,{style:{marginBottom:`25px`},children:[(0,S.jsx)(`label`,{style:{display:`block`,fontSize:`0.8rem`,color:`#94a3b8`,marginBottom:`5px`,fontWeight:`bold`},children:`Venue / Google Meet Link *`}),(0,S.jsx)(`input`,{type:`text`,className:`jt-input`,placeholder:`e.g., Calicut Branch or Meet Link`,value:o.venue,onChange:e=>c({...o,venue:e.target.value})})]}),(0,S.jsxs)(`div`,{style:{display:`flex`,justifyContent:`flex-end`,gap:`10px`,borderTop:`1px solid #1e293b`,paddingTop:`1.5rem`},children:[(0,S.jsx)(`button`,{className:`jt-btn-cancel`,onClick:()=>{q(o.appRowNumber,`status`,`Applied`),c({...o,isOpen:!1})},children:`Cancel`}),(0,S.jsx)(`button`,{className:`jt-save-btn`,style:{width:`auto`},onClick:()=>{if(!o.date||!o.time||!o.venue)return alert(`Please fill in all interview details to proceed.`);let e=O.find(e=>e.rowNumber===o.appRowNumber);e&&Y(e)},children:`Confirm & Send Mail`})]})]})}),(0,S.jsx)(`style`,{children:`
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
      `})]}):(0,S.jsx)(S.Fragment,{})}export{T as default};