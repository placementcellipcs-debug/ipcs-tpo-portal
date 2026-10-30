import{r as e}from"./rolldown-runtime-XKyaHtl9.js";import{h as t,i as n,n as r,r as i}from"./index-BD-Kom3p.js";import{A as a,V as o,t as s}from"./Layout-BvvAqjRF.js";import{t as c}from"./CheckCircle.es-BGYum_Jy.js";import{t as l}from"./CircleNotch.es-DBcbrold.js";import{t as u}from"./FloppyDisk.es-C4cF29nD.js";import{t as d}from"./User.es-CTnj8DGm.js";import{t as f}from"./WarningCircle.es-JMmug-jf.js";import{t as p}from"./DataSourceStatus-CI4g-l6D.js";import{t as m}from"./statusTone-VMCf5tIT.js";var h=e(t(),1),g=r();function _(){let[e]=(0,h.useState)(()=>{try{return JSON.parse(localStorage.getItem(`tpoData`))}catch{return null}}),[t,r]=(0,h.useState)([]),[_,v]=(0,h.useState)(!0),[y,b]=(0,h.useState)(``),[x,S]=(0,h.useState)(null),[C,w]=(0,h.useState)(0),[T,E]=(0,h.useState)(null),[D,O]=(0,h.useState)({}),[k,A]=(0,h.useState)({});(0,h.useEffect)(()=>{if(!e){b(`Your sign-in session is missing or invalid. Please sign in again.`),v(!1);return}let t=!0;return(async()=>{try{v(!0),b(``);let a=await n.post(`${i}/api/tpo/issues`,{assignedBranchesArray:e.assignedBranchesArray||[],role:e.role,assignedCourse:e.assignedCourse},{timeout:3e4});if(!a.data?.success)throw Error(a.data?.message||`Issue records could not be loaded.`);t&&(r(a.data.issues||[]),S(a.data.dataMeta||null))}catch(e){console.error(`Failed to fetch issues`,e),t&&b(e.response?.data?.message||(e.code===`ECONNABORTED`?`Loading issues took too long. Please retry.`:e.message)||`Issue records could not be loaded.`)}finally{t&&v(!1)}})(),()=>{t=!1}},[e,C]);let j=(e,t,n)=>{O(r=>({...r,[e]:{...r[e],[t]:n}}))},M=async e=>{let t=e.rowNumber,i=D[t]||{},a=i.status===void 0?e.status:i.status,o=i.remarks===void 0?e.remarks:i.remarks;A(e=>({...e,[t]:`saving`}));try{(await n.post(`https://api-placement.ipcstalenzo.com/api/tpo/issues/update`,{rowNumber:t,status:a,remarks:o})).data.success?(A(e=>({...e,[t]:`success`})),setTimeout(()=>A(e=>({...e,[t]:null})),2e3),r(e=>e.map(e=>e.rowNumber===t?{...e,status:a,remarks:o}:e))):(A(e=>({...e,[t]:`error`})),setTimeout(()=>A(e=>({...e,[t]:null})),4500))}catch(e){console.error(`Save failed`,e),A(e=>({...e,[t]:`error`})),setTimeout(()=>A(e=>({...e,[t]:null})),4500)}},N={},P=0;(t||[]).forEach(e=>{let t=e.branch||`Unknown Branch`;N[t]||(N[t]={total:0,pending:0}),N[t].total++,(e.status||``).toLowerCase()===`pending`&&(N[t].pending++,P++)});let F=Object.keys(N).sort(),I=T?(t||[]).filter(e=>e.branch===T):[];return T?(0,g.jsxs)(s,{children:[(0,g.jsxs)(`div`,{className:`page-container`,style:{padding:0},children:[(0,g.jsxs)(`div`,{style:{display:`flex`,alignItems:`center`,marginBottom:`30px`,gap:`20px`},children:[(0,g.jsxs)(`button`,{onClick:()=>E(null),className:`back-btn`,children:[(0,g.jsx)(o,{weight:`bold`,size:18}),` Back to Branches`]}),(0,g.jsxs)(`div`,{children:[(0,g.jsxs)(`h1`,{style:{fontSize:`1.8rem`,margin:`0 0 5px 0`,color:`#fff`},children:[T,` Issues`]}),(0,g.jsx)(`p`,{style:{color:`#94a3b8`,margin:0,fontSize:`0.95rem`},children:`Manage and resolve student complaints for this branch.`})]})]}),x&&(0,g.jsx)(p,{source:x.sourceSheet,detail:`Issues are filtered to the signed-in account's assigned branches and access.`,health:x.sourceHealthy,lastSyncedAt:x.lastSuccessfulSyncAt,lastAttemptAt:x.lastRefreshAttemptAt,onRefresh:()=>w(e=>e+1),refreshing:_}),y&&(0,g.jsxs)(`div`,{role:`alert`,style:{marginBottom:`14px`,padding:`12px 15px`,border:`1px solid rgba(248,113,113,.35)`,borderRadius:`10px`,color:`#fecaca`,background:`rgba(127,29,29,.2)`},children:[y,` `,(0,g.jsx)(`button`,{type:`button`,onClick:()=>w(e=>e+1),disabled:_,style:{marginLeft:`10px`,padding:`5px 10px`,borderRadius:`7px`,border:`1px solid rgba(248,113,113,.5)`,background:`transparent`,color:`#fecaca`,cursor:`pointer`},children:`Retry`})]}),(0,g.jsxs)(`div`,{className:`issue-grid-container`,children:[(0,g.jsxs)(`div`,{className:`issue-grid-header`,children:[(0,g.jsx)(`span`,{children:`Student Details`}),(0,g.jsx)(`span`,{children:`Issue Reported`}),(0,g.jsx)(`span`,{children:`Status`}),(0,g.jsx)(`span`,{children:`Remarks Log`}),(0,g.jsx)(`span`,{style:{textAlign:`center`},children:`Action`})]}),(0,g.jsx)(`div`,{className:`issue-list`,children:y?null:I.length===0?(0,g.jsxs)(`div`,{className:`empty-state`,style:{padding:`3rem`,background:`#111827`,borderRadius:`16px`,border:`1px solid #1e293b`},children:[(0,g.jsx)(c,{size:48,color:`#10b981`,style:{marginBottom:`10px`}}),(0,g.jsx)(`p`,{style:{margin:0,color:`#94a3b8`},children:`All issues are resolved for this branch!`})]}):I.map((e,t)=>{let n=D[e.rowNumber]||{},r=n.status===void 0?e.status:n.status,i=n.remarks===void 0?e.remarks:n.remarks,a=k[e.rowNumber];return(0,g.jsxs)(`div`,{className:`issue-card hover-lift`,children:[(0,g.jsxs)(`div`,{className:`col-student`,children:[(0,g.jsxs)(`div`,{className:`stu-name`,children:[(0,g.jsx)(d,{size:16,color:`var(--accent-primary)`,weight:`bold`}),` `,e.name]}),(0,g.jsx)(`div`,{className:`stu-branch`,children:e.branch})]}),(0,g.jsx)(`div`,{className:`col-desc`,children:e.details}),(0,g.jsx)(`div`,{className:`col-status`,children:(0,g.jsxs)(`select`,{className:`issue-select status-${m(r)}`,value:r,onChange:t=>j(e.rowNumber,`status`,t.target.value),children:[(0,g.jsx)(`option`,{value:`Pending`,children:`Pending`}),(0,g.jsx)(`option`,{value:`Resolved`,children:`Resolved`})]})}),(0,g.jsx)(`div`,{className:`col-remarks`,children:(0,g.jsx)(`input`,{type:`text`,placeholder:`Add resolution notes...`,className:`issue-input`,value:i,onChange:t=>j(e.rowNumber,`remarks`,t.target.value)})}),(0,g.jsxs)(`div`,{className:`col-action`,children:[(0,g.jsx)(`button`,{className:`issue-save-btn ${a===`success`?`success`:a===`error`?`error`:``}`,onClick:()=>M(e),disabled:a===`saving`,children:a===`saving`?(0,g.jsx)(l,{size:18,className:`ph-spin`}):a===`success`?(0,g.jsx)(c,{size:18,weight:`bold`}):a===`error`?(0,g.jsx)(f,{size:18,weight:`bold`}):(0,g.jsxs)(g.Fragment,{children:[(0,g.jsx)(u,{size:18,weight:`bold`}),` Save`]})}),a===`success`&&(0,g.jsxs)(`span`,{className:`save-status-text success`,role:`status`,children:[(0,g.jsx)(c,{size:14,weight:`fill`}),` Saved`]}),a===`error`&&(0,g.jsxs)(`span`,{className:`save-status-text error`,role:`alert`,children:[(0,g.jsx)(f,{size:14,weight:`fill`}),` Could not save`]})]})]},t)})})]})]}),(0,g.jsx)(`style`,{children:`
        .back-btn {
          background: #111827;
          border: 1px solid #1e293b;
          color: #e2e8f0;
          padding: 10px 16px;
          border-radius: 10px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          font-weight: 600;
          transition: all 0.2s;
        }
        .back-btn:hover { background: #1e293b; color: #fff; border-color: #334155; }

        .issue-grid-container { width: 100%; }

        .issue-grid-header {
          display: grid;
          grid-template-columns: 2fr 3fr 1.5fr 2.5fr 1fr;
          gap: 15px;
          padding: 0 20px 12px 20px;
          font-size: 0.75rem;
          font-weight: 800;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .issue-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .issue-card {
          display: grid;
          grid-template-columns: 2fr 3fr 1.5fr 2.5fr 1fr;
          gap: 15px;
          background: #111827;
          border: 1px solid #1e293b;
          border-radius: 16px;
          padding: 20px;
          align-items: center;
          transition: 0.2s ease;
        }
        .issue-card.hover-lift:hover {
          border-color: color-mix(in srgb, var(--accent-primary) 40%, transparent);
          transform: translateY(-2px);
          box-shadow: 0 10px 20px -10px rgba(0,0,0,0.5);
        }

        .stu-name {
          color: #fff;
          font-size: 1.05rem;
          font-weight: 700;
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 4px;
        }
        .stu-branch {
          color: #94a3b8;
          font-size: 0.85rem;
          margin-left: 22px;
        }

        .col-desc {
          color: #cbd5e1;
          font-size: 0.9rem;
          line-height: 1.5;
          white-space: normal;
          word-wrap: break-word;
        }

        .issue-input, .issue-select {
          width: 100%;
          background: #09090e;
          border: 1px solid #1e293b;
          color: #f8fafc;
          padding: 10px 14px;
          border-radius: 8px;
          font-size: 0.9rem;
          outline: none;
          transition: all 0.2s ease;
          box-sizing: border-box;
        }
        .issue-input:focus, .issue-select:focus {
          border-color: var(--accent-primary);
          box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent-primary) 15%, transparent);
        }

        .issue-save-btn {
          width: 100%;
          background: var(--accent-primary);
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
        .issue-save-btn:hover:not(:disabled) {
          background: color-mix(in srgb, var(--accent-primary) 82%, #0f172a);
          transform: translateY(-2px);
          box-shadow: 0 4px 12px color-mix(in srgb, var(--accent-primary) 40%, transparent);
        }
        .col-action { display: flex; flex-direction: column; align-items: stretch; gap: 6px; }
        .issue-save-btn:disabled { opacity: 0.7; cursor: not-allowed; }
        .issue-save-btn.success { background: #10b981; color: #fff; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4); }
        .issue-save-btn.error { background: #ef4444; color: #fff; }
        .issue-select.status-success { border-color: rgba(16,185,129,.65); color: #10b981; }
        .issue-select.status-danger { border-color: rgba(239,68,68,.65); color: #ef4444; }
        .issue-select.status-warning { border-color: rgba(245,158,11,.65); color: #f59e0b; }

        /* Responsive Breakpoints */
        @media (max-width: 1024px) {
          .issue-grid-header { display: none; }
          .issue-card {
            grid-template-columns: 1fr;
            gap: 15px;
          }
          .stu-branch { margin-left: 0; }
        }
      `})]}):(0,g.jsxs)(s,{children:[(0,g.jsxs)(`div`,{className:`page-container`,style:{padding:0},children:[(0,g.jsxs)(`div`,{className:`hero-section`,children:[(0,g.jsx)(`h1`,{className:`hero-title`,children:`Issue Resolution Center`}),(0,g.jsx)(`p`,{className:`hero-subtitle`,children:`Select an assigned branch to view and resolve student complaints.`}),x&&(0,g.jsx)(p,{source:x.sourceSheet,detail:`Issues are filtered to the signed-in account's assigned branches and access.`,health:x.sourceHealthy,lastSyncedAt:x.lastSuccessfulSyncAt,lastAttemptAt:x.lastRefreshAttemptAt,onRefresh:()=>w(e=>e+1),refreshing:_}),y?(0,g.jsxs)(`div`,{className:`status-badge alert`,children:[(0,g.jsx)(f,{size:18,weight:`fill`}),` Issue records are unavailable until the data sync completes.`]}):P>0?(0,g.jsxs)(`div`,{className:`status-badge alert`,children:[(0,g.jsx)(f,{size:18,weight:`fill`}),` You have `,P,` pending issue(s) awaiting resolution.`]}):(0,g.jsxs)(`div`,{className:`status-badge success`,children:[(0,g.jsx)(c,{size:18,weight:`fill`}),` All issues across your branches are currently resolved.`]})]}),_?(0,g.jsx)(`div`,{style:{textAlign:`center`,marginTop:`4rem`,color:`var(--accent-primary)`},children:(0,g.jsx)(l,{size:50,className:`ph-spin`})}):y?(0,g.jsxs)(`div`,{className:`empty-state`,children:[(0,g.jsx)(f,{size:42}),(0,g.jsx)(`p`,{children:y}),(0,g.jsx)(`button`,{type:`button`,onClick:()=>w(e=>e+1),style:{marginTop:`10px`,padding:`8px 14px`,borderRadius:`8px`,border:`1px solid var(--card-border)`,background:`var(--card-bg)`,color:`var(--text-main)`,cursor:`pointer`},children:`Retry`})]}):F.length===0?(0,g.jsxs)(`div`,{className:`empty-state`,children:[(0,g.jsx)(a,{size:56,weight:`thin`}),(0,g.jsx)(`p`,{children:`No issues reported in any of your assigned branches!`})]}):(0,g.jsx)(`div`,{className:`branch-grid`,children:F.map(e=>{let t=N[e].pending;return(0,g.jsxs)(`div`,{className:`branch-tile`,onClick:()=>E(e),children:[t>0&&(0,g.jsxs)(`div`,{className:`pending-indicator`,children:[t,` Pending`]}),(0,g.jsx)(`h2`,{className:`branch-name`,children:e}),(0,g.jsxs)(`div`,{className:`branch-stats`,children:[(0,g.jsx)(a,{size:18,weight:`bold`}),(0,g.jsxs)(`span`,{children:[N[e].total,` Total Issues`]})]})]},e)})})]}),(0,g.jsx)(`style`,{children:`
          .hero-section { text-align: center; margin: 20px 0 40px 0; }
          .hero-title { font-size: 2.2rem; color: #fff; font-weight: 800; margin: 0 0 10px 0; }
          .hero-subtitle { color: #94a3b8; font-size: 1.05rem; margin: 0 0 20px 0; }
          
          .status-badge { display: inline-flex; align-items: center; gap: 8px; padding: 8px 16px; border-radius: 20px; font-size: 0.9rem; font-weight: bold; }
          .status-badge.alert { background: rgba(239, 68, 68, 0.15); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.3); }
          .status-badge.success { background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); }

          .empty-state { text-align: center; padding: 5rem 2rem; color: #64748b; }
          .empty-state p { font-size: 1.1rem; margin-top: 15px; }

          .branch-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 25px; padding: 0 10px; }
          
          .branch-tile {
            background: #111827;
            border: 1px solid #1e293b;
            border-radius: 24px;
            padding: 40px 20px;
            cursor: pointer;
            text-align: center;
            min-height: 200px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            position: relative;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            box-shadow: 0 10px 25px rgba(0,0,0,0.3);
          }
          .branch-tile:hover {
            background: #161e2e;
            border-color: var(--accent-primary);
            transform: translateY(-5px);
            box-shadow: 0 15px 35px -10px color-mix(in srgb, var(--accent-primary) 40%, transparent);
          }

          .pending-indicator {
            position: absolute;
            top: 20px;
            right: 20px;
            background: #ef4444;
            color: #fff;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 0.75rem;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            box-shadow: 0 4px 10px rgba(239, 68, 68, 0.4);
          }

          .branch-name {
            color: #fff;
            font-size: 2rem;
            font-weight: 800;
            margin: 0 0 15px 0;
          }

          .branch-stats {
            background: color-mix(in srgb, var(--accent-primary) 10%, transparent);
            color: #a855f7;
            padding: 8px 16px;
            border-radius: 30px;
            display: flex;
            align-items: center;
            gap: 8px;
            font-weight: bold;
            font-size: 0.95rem;
            border: 1px solid color-mix(in srgb, var(--accent-primary) 20%, transparent);
          }
        `})]})}export{_ as default};