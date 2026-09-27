import{h as e,i as t,r as n,t as r,v as i}from"./apiConfig-D7zxq80z.js";import{E as a,t as o,y as s}from"./Layout-BobqmMCQ.js";import{t as c}from"./CheckCircle.es-C1jzYLqH.js";import{t as l}from"./FloppyDisk.es-Ozmc0koZ.js";import{t as u}from"./User.es-CJXulPCR.js";import{t as d}from"./WarningCircle.es-DqvbFwIn.js";import{s as f}from"./index-Dz_mtIJL.js";var p=i(e(),1),m=n();function h(){let[e]=(0,p.useState)(()=>{try{return JSON.parse(localStorage.getItem(`tpoData`))}catch{return null}}),[n,i]=(0,p.useState)([]),[h,g]=(0,p.useState)(!0),[_,v]=(0,p.useState)(null),[y,b]=(0,p.useState)({}),[x,S]=(0,p.useState)({});(0,p.useEffect)(()=>{e&&(async()=>{try{let n=await t.post(`${r}/api/tpo/issues`,{assignedBranchesArray:e.assignedBranchesArray||[],role:e.role,assignedCourse:e.assignedCourse});n.data.success&&i(n.data.issues||[])}catch(e){console.error(`Failed to fetch issues`,e)}finally{g(!1)}})()},[e]);let C=(e,t,n)=>{b(r=>({...r,[e]:{...r[e],[t]:n}}))},w=async e=>{let n=e.rowNumber,a=y[n]||{},o=a.status===void 0?e.status:a.status,s=a.remarks===void 0?e.remarks:a.remarks;S(e=>({...e,[n]:`saving`}));try{(await t.post(`${r}/api/tpo/issues/update`,{rowNumber:n,status:o,remarks:s})).data.success&&(S(e=>({...e,[n]:`success`})),setTimeout(()=>S(e=>({...e,[n]:null})),2e3),i(e=>e.map(e=>e.rowNumber===n?{...e,status:o,remarks:s}:e)))}catch(e){console.error(`Save failed`,e),S(e=>({...e,[n]:`error`})),alert(`Failed to save. Check server logs.`)}},T={},E=0;(n||[]).forEach(e=>{let t=e.branch||`Unknown Branch`;T[t]||(T[t]={total:0,pending:0}),T[t].total++,(e.status||``).toLowerCase()===`pending`&&(T[t].pending++,E++)});let D=Object.keys(T).sort(),O=_?(n||[]).filter(e=>e.branch===_):[];return _?(0,m.jsxs)(o,{children:[(0,m.jsxs)(`div`,{className:`page-container`,style:{padding:0},children:[(0,m.jsxs)(`div`,{style:{display:`flex`,alignItems:`center`,marginBottom:`30px`,gap:`20px`},children:[(0,m.jsxs)(`button`,{onClick:()=>v(null),className:`back-btn`,children:[(0,m.jsx)(a,{weight:`bold`,size:18}),` Back to Branches`]}),(0,m.jsxs)(`div`,{children:[(0,m.jsxs)(`h1`,{style:{fontSize:`1.8rem`,margin:`0 0 5px 0`,color:`#fff`},children:[_,` Issues`]}),(0,m.jsx)(`p`,{style:{color:`#94a3b8`,margin:0,fontSize:`0.95rem`},children:`Manage and resolve student complaints for this branch.`})]})]}),(0,m.jsxs)(`div`,{className:`issue-grid-container`,children:[(0,m.jsxs)(`div`,{className:`issue-grid-header`,children:[(0,m.jsx)(`span`,{children:`Student Details`}),(0,m.jsx)(`span`,{children:`Issue Reported`}),(0,m.jsx)(`span`,{children:`Status`}),(0,m.jsx)(`span`,{children:`Remarks Log`}),(0,m.jsx)(`span`,{style:{textAlign:`center`},children:`Action`})]}),(0,m.jsx)(`div`,{className:`issue-list`,children:O.length===0?(0,m.jsxs)(`div`,{className:`empty-state`,style:{padding:`3rem`,background:`#111827`,borderRadius:`16px`,border:`1px solid #1e293b`},children:[(0,m.jsx)(c,{size:48,color:`#10b981`,style:{marginBottom:`10px`}}),(0,m.jsx)(`p`,{style:{margin:0,color:`#94a3b8`},children:`All issues are resolved for this branch!`})]}):O.map((e,t)=>{let n=y[e.rowNumber]||{},r=n.status===void 0?e.status:n.status,i=n.remarks===void 0?e.remarks:n.remarks,a=x[e.rowNumber];return(0,m.jsxs)(`div`,{className:`issue-card hover-lift`,children:[(0,m.jsxs)(`div`,{className:`col-student`,children:[(0,m.jsxs)(`div`,{className:`stu-name`,children:[(0,m.jsx)(u,{size:16,color:`#8b5cf6`,weight:`bold`}),` `,e.name]}),(0,m.jsx)(`div`,{className:`stu-branch`,children:e.branch})]}),(0,m.jsx)(`div`,{className:`col-desc`,children:e.details}),(0,m.jsx)(`div`,{className:`col-status`,children:(0,m.jsxs)(`select`,{className:`issue-select`,value:r,onChange:t=>C(e.rowNumber,`status`,t.target.value),children:[(0,m.jsx)(`option`,{value:`Pending`,children:`Pending`}),(0,m.jsx)(`option`,{value:`Resolved`,children:`Resolved`})]})}),(0,m.jsx)(`div`,{className:`col-remarks`,children:(0,m.jsx)(`input`,{type:`text`,placeholder:`Add resolution notes...`,className:`issue-input`,value:i,onChange:t=>C(e.rowNumber,`remarks`,t.target.value)})}),(0,m.jsx)(`div`,{className:`col-action`,children:(0,m.jsx)(`button`,{className:`issue-save-btn ${a===`success`?`success`:``}`,onClick:()=>w(e),disabled:a===`saving`,children:a===`saving`?(0,m.jsx)(f,{size:18,className:`ph-spin`}):a===`success`?(0,m.jsx)(c,{size:18,weight:`bold`}):(0,m.jsxs)(m.Fragment,{children:[(0,m.jsx)(l,{size:18,weight:`bold`}),` Save`]})})})]},t)})})]})]}),(0,m.jsx)(`style`,{children:`
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
          border-color: rgba(139, 92, 246, 0.4);
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
          border-color: #8b5cf6;
          box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.15);
        }

        .issue-save-btn {
          width: 100%;
          background: #8b5cf6;
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
          background: #7c3aed;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(139, 92, 246, 0.4);
        }
        .issue-save-btn:disabled { opacity: 0.7; cursor: not-allowed; }
        .issue-save-btn.success { background: #10b981; color: #fff; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4); }

        /* Responsive Breakpoints */
        @media (max-width: 1024px) {
          .issue-grid-header { display: none; }
          .issue-card {
            grid-template-columns: 1fr;
            gap: 15px;
          }
          .stu-branch { margin-left: 0; }
        }
      `})]}):(0,m.jsxs)(o,{children:[(0,m.jsxs)(`div`,{className:`page-container`,style:{padding:0},children:[(0,m.jsxs)(`div`,{className:`hero-section`,children:[(0,m.jsx)(`h1`,{className:`hero-title`,children:`Issue Resolution Center`}),(0,m.jsx)(`p`,{className:`hero-subtitle`,children:`Select an assigned branch to view and resolve student complaints.`}),E>0?(0,m.jsxs)(`div`,{className:`status-badge alert`,children:[(0,m.jsx)(d,{size:18,weight:`fill`}),` You have `,E,` pending issue(s) awaiting resolution.`]}):(0,m.jsxs)(`div`,{className:`status-badge success`,children:[(0,m.jsx)(c,{size:18,weight:`fill`}),` All issues across your branches are currently resolved.`]})]}),h?(0,m.jsx)(`div`,{style:{textAlign:`center`,marginTop:`4rem`,color:`#8b5cf6`},children:(0,m.jsx)(f,{size:50,className:`ph-spin`})}):D.length===0?(0,m.jsxs)(`div`,{className:`empty-state`,children:[(0,m.jsx)(s,{size:56,weight:`thin`}),(0,m.jsx)(`p`,{children:`No issues reported in any of your assigned branches!`})]}):(0,m.jsx)(`div`,{className:`branch-grid`,children:D.map(e=>{let t=T[e].pending;return(0,m.jsxs)(`div`,{className:`branch-tile`,onClick:()=>v(e),children:[t>0&&(0,m.jsxs)(`div`,{className:`pending-indicator`,children:[t,` Pending`]}),(0,m.jsx)(`h2`,{className:`branch-name`,children:e}),(0,m.jsxs)(`div`,{className:`branch-stats`,children:[(0,m.jsx)(s,{size:18,weight:`bold`}),(0,m.jsxs)(`span`,{children:[T[e].total,` Total Issues`]})]})]},e)})})]}),(0,m.jsx)(`style`,{children:`
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
            border-color: #8b5cf6;
            transform: translateY(-5px);
            box-shadow: 0 15px 35px -10px rgba(139, 92, 246, 0.4);
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
            background: rgba(139, 92, 246, 0.1);
            color: #a855f7;
            padding: 8px 16px;
            border-radius: 30px;
            display: flex;
            align-items: center;
            gap: 8px;
            font-weight: bold;
            font-size: 0.95rem;
            border: 1px solid rgba(139, 92, 246, 0.2);
          }
        `})]})}export{h as default};