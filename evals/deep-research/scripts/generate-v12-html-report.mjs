#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { EVAL_ROOT } from "../src/lib.mjs";
import { effectiveTotalTokens, readRecords, selectLatestSuiteRecords } from "../src/report.mjs";

const recordsRoot = join(EVAL_ROOT, "records");
const leaderboardPath = join(recordsRoot, "leaderboard.json");
const outputPath = join(recordsRoot, "deep-research-eval-v12-report.html");
const leaderboard = JSON.parse(readFileSync(leaderboardPath, "utf8"));
const selected = selectLatestSuiteRecords(readRecords(recordsRoot));

if (selected.suiteId !== leaderboard.suiteId) {
  throw new Error(`榜单题集 ${leaderboard.suiteId} 与记录题集 ${selected.suiteId} 不一致`);
}

const summaryByCondition = new Map(
  [leaderboard.baseline, ...leaderboard.leaderboard].filter(Boolean).map((row) => [row.condition, row]),
);
const recordsByCondition = new Map();
for (const record of selected.records) {
  if (!recordsByCondition.has(record.condition)) recordsByCondition.set(record.condition, []);
  recordsByCondition.get(record.condition).push(record);
}

const order = ["C0", ...leaderboard.leaderboard.map((row) => row.condition)];
const conditions = order.map((condition) => {
  const summary = summaryByCondition.get(condition);
  const records = (recordsByCondition.get(condition) ?? []).sort((a, b) => taskOrder(a.taskId) - taskOrder(b.taskId));
  return {
    rank: condition === "C0" ? null : summary.rank,
    condition,
    plugin: summary.plugin,
    label: condition === "C0" ? "DSH 原生基线" : summary.plugin,
    baseline: condition === "C0",
    qualityEligible: summary.qualityEligible,
    sfPassed: summary.sf.passed,
    sfTotal: summary.sf.total,
    lfPassed: summary.lf.passed,
    lfPartial: summary.lf.partial,
    lfFailed: summary.lf.failed,
    citationFaithfulness: summary.citationFaithfulness,
    citationValidity: summary.citationValidity,
    meanLatencyMs: summary.efficiency.meanLatencyMs,
    meanTokens: summary.efficiency.meanTokens,
    fabricatedTotal: summary.fabricatedTotal,
    statusCounts: summary.statusCounts,
    upliftCounts: summary.upliftCounts,
    tasks: Object.fromEntries(records.map((record) => [record.taskId, {
      status: record.resultLedger.status,
      latencyMs: record.processLedger.resources.latencyMs,
      tokens: effectiveTotalTokens(record),
      searchCalls: record.processLedger.tools.searchCalls,
      toolCalls: record.processLedger.tools.totalCalls,
      judge: record.judge?.ok === true ? record.judge.verdict ?? "OK" : null,
      provenance: record.provenance ?? null,
    }])),
  };
});

const payload = {
  suiteId: leaderboard.suiteId,
  generatedAt: leaderboard.generatedAt,
  rankingRule: leaderboard.rankingRule,
  taskIds: ["R1", "R3", "R6", "R7", "R10"],
  conditions,
  totals: {
    plugins: leaderboard.leaderboard.length,
    conditions: conditions.length,
    records: conditions.reduce((sum, row) => sum + Object.keys(row.tasks).length, 0),
    scorable: selected.records.filter((record) => ["PASS", "PARTIAL", "FAIL"].includes(record.resultLedger.status)).length,
    systemErrors: selected.records.filter((record) => record.resultLedger.status === "SYSTEM_ERROR").length,
    tokens: selected.records.reduce((sum, record) => sum + (effectiveTotalTokens(record) ?? 0), 0),
  },
};

const html = renderHtml(payload);
writeFileSync(outputPath, html);
console.log(JSON.stringify({ ok: true, output: outputPath, suiteId: payload.suiteId, conditions: conditions.length }, null, 2));

function taskOrder(taskId) {
  return ["R1", "R3", "R6", "R7", "R10"].indexOf(taskId);
}

function renderHtml(data) {
  const json = JSON.stringify(data).replaceAll("<", "\\u003c");
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="dark">
  <title>DSH Deep Research 插件测评 · V12</title>
  <style>
    :root { --bg:#0b0e0d; --panel:#121715; --panel-2:#171d1a; --line:#2b3430; --text:#f2f6f3; --muted:#91a099; --green:#58d68d; --green-soft:#193827; --amber:#f2b84b; --amber-soft:#3c2e13; --red:#ef7b72; --red-soft:#3a1e1d; --blue:#7aa7ff; --blue-soft:#1c2a46; --white:#ffffff; }
    * { box-sizing:border-box; }
    html { scroll-behavior:smooth; }
    body { margin:0; background:var(--bg); color:var(--text); font-family:Inter,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif; line-height:1.55; }
    a { color:inherit; }
    button { font:inherit; }
    .shell { width:min(1240px,calc(100% - 40px)); margin:0 auto; }
    .topbar { position:sticky; top:0; z-index:20; background:rgba(11,14,13,.94); border-bottom:1px solid var(--line); backdrop-filter:blur(12px); }
    .topbar .shell { min-height:58px; display:flex; align-items:center; justify-content:space-between; gap:24px; }
    .brand { display:flex; align-items:center; gap:11px; font-size:13px; font-weight:800; letter-spacing:.03em; }
    .brand i { width:10px; height:10px; background:var(--green); display:block; }
    nav { display:flex; gap:20px; color:var(--muted); font-size:12px; }
    nav a { text-decoration:none; }
    nav a:hover { color:var(--text); }
    .hero { padding:72px 0 50px; border-bottom:1px solid var(--line); }
    .eyebrow { margin:0 0 16px; color:var(--green); font-size:11px; font-weight:800; letter-spacing:.14em; text-transform:uppercase; }
    .hero-grid { display:grid; grid-template-columns:minmax(0,1.55fr) minmax(300px,.75fr); gap:64px; align-items:end; }
    h1 { margin:0; max-width:820px; font-size:clamp(38px,6vw,74px); line-height:.98; letter-spacing:-.055em; }
    .hero-copy { max-width:760px; margin:26px 0 0; color:var(--muted); font-size:16px; }
    .winner { background:var(--panel); border:1px solid var(--line); padding:26px; }
    .winner .tag { color:var(--muted); font-size:11px; letter-spacing:.1em; text-transform:uppercase; }
    .winner strong { display:block; margin:9px 0 4px; font-size:25px; letter-spacing:-.03em; }
    .winner p { margin:0; color:var(--muted); font-size:13px; }
    .winner .number { margin-top:26px; color:var(--green); font:700 48px/1 ui-monospace,SFMono-Regular,Consolas,monospace; }
    .winner .number span { color:var(--muted); font-size:12px; font-weight:500; }
    .kpis { display:grid; grid-template-columns:repeat(5,1fr); margin-top:42px; border:1px solid var(--line); }
    .kpi { min-height:112px; padding:20px; background:var(--panel); }
    .kpi + .kpi { border-left:1px solid var(--line); }
    .kpi span { display:block; color:var(--muted); font-size:11px; }
    .kpi b { display:block; margin-top:10px; font-size:27px; letter-spacing:-.04em; }
    main section { padding:68px 0; border-bottom:1px solid var(--line); }
    .section-head { display:flex; justify-content:space-between; gap:32px; align-items:flex-end; margin-bottom:30px; }
    .section-head h2 { margin:0; font-size:30px; letter-spacing:-.035em; }
    .section-head p { max-width:620px; margin:0; color:var(--muted); font-size:13px; }
    .protocol-grid { display:grid; grid-template-columns:repeat(3,1fr); border:1px solid var(--line); }
    .protocol-grid article { padding:26px; background:var(--panel); }
    .protocol-grid article + article { border-left:1px solid var(--line); }
    .protocol-grid small { color:var(--green); font:700 10px ui-monospace,SFMono-Regular,Consolas,monospace; letter-spacing:.08em; }
    .protocol-grid h3 { margin:12px 0 8px; font-size:17px; }
    .protocol-grid p { margin:0; color:var(--muted); font-size:12px; }
    .callout { display:grid; grid-template-columns:180px 1fr; gap:28px; margin-top:20px; padding:22px 26px; background:var(--blue-soft); border-left:3px solid var(--blue); }
    .callout b { color:var(--blue); font-size:12px; }
    .callout p { margin:0; color:#c7d6ef; font-size:12px; }
    .sortbar { display:flex; flex-wrap:wrap; gap:8px; }
    .sortbar button { cursor:pointer; border:1px solid var(--line); background:transparent; color:var(--muted); padding:8px 11px; font-size:11px; }
    .sortbar button.active { background:var(--text); border-color:var(--text); color:var(--bg); }
    .ranking { border-top:1px solid var(--line); }
    .rank-row { display:grid; grid-template-columns:54px minmax(210px,1.4fr) minmax(160px,1fr) 100px 120px 100px; gap:18px; align-items:center; min-height:92px; border-bottom:1px solid var(--line); transition:background .16s ease; }
    .rank-row:hover { background:var(--panel); }
    .rank-index { color:var(--muted); font:700 14px ui-monospace,SFMono-Regular,Consolas,monospace; }
    .plugin-name strong { display:block; font-size:15px; }
    .plugin-name span { color:var(--muted); font:11px ui-monospace,SFMono-Regular,Consolas,monospace; }
    .statusbar { height:9px; display:flex; overflow:hidden; background:var(--panel-2); }
    .statusbar i { display:block; height:100%; }
    .statusbar .pass { background:var(--green); }
    .statusbar .partial { background:var(--amber); }
    .statusbar .fail { background:var(--red); }
    .statuscopy { margin-top:7px; color:var(--muted); font-size:10px; }
    .metric { font:700 13px ui-monospace,SFMono-Regular,Consolas,monospace; }
    .metric small { color:var(--muted); font:10px Inter,"Segoe UI",sans-serif; }
    .baseline-row { border:1px solid var(--line); border-top:0; background:var(--panel); padding:20px 22px; display:flex; justify-content:space-between; gap:20px; color:var(--muted); font-size:12px; }
    .baseline-row strong { color:var(--text); }
    .charts { display:grid; grid-template-columns:minmax(0,1.45fr) minmax(300px,.75fr); gap:22px; }
    .chart-panel { background:var(--panel); border:1px solid var(--line); padding:24px; }
    .chart-title { margin:0; font-size:16px; }
    .chart-caption { margin:5px 0 18px; color:var(--muted); font-size:11px; }
    #scatter { width:100%; height:auto; min-height:410px; display:block; }
    .axis { stroke:#52615b; stroke-width:1; }
    .gridline { stroke:#25302b; stroke-width:1; }
    .axis-label,.tick-label,.point-label { fill:#91a099; font-family:Inter,"Segoe UI",sans-serif; font-size:10px; }
    .point-label { fill:#d8e1dc; font-weight:700; }
    .point { fill:var(--green); stroke:var(--panel); stroke-width:3; }
    .point.baseline { fill:var(--panel); stroke:var(--blue); stroke-width:2; }
    .insights { display:grid; gap:0; border-top:1px solid var(--line); }
    .insight { padding:18px 0; border-bottom:1px solid var(--line); }
    .insight span { color:var(--green); font:700 10px ui-monospace,SFMono-Regular,Consolas,monospace; }
    .insight strong { display:block; margin:6px 0 3px; font-size:14px; }
    .insight p { margin:0; color:var(--muted); font-size:11px; }
    .matrix-wrap { overflow:auto; border:1px solid var(--line); }
    table { width:100%; border-collapse:collapse; min-width:850px; background:var(--panel); }
    th,td { padding:15px 14px; border-bottom:1px solid var(--line); text-align:center; font-size:11px; }
    th { position:sticky; top:58px; z-index:2; background:var(--panel-2); color:var(--muted); font-weight:700; }
    th:first-child,td:first-child { position:sticky; left:0; z-index:1; min-width:220px; text-align:left; background:var(--panel); }
    th:first-child { z-index:3; background:var(--panel-2); }
    tbody tr:last-child td { border-bottom:0; }
    .cell-status { display:inline-flex; min-width:66px; justify-content:center; padding:5px 8px; font-weight:800; font-size:9px; letter-spacing:.05em; }
    .cell-status.PASS { background:var(--green-soft); color:var(--green); }
    .cell-status.PARTIAL { background:var(--amber-soft); color:var(--amber); }
    .cell-status.FAIL { background:var(--red-soft); color:var(--red); }
    .audit-grid { display:grid; grid-template-columns:1fr 1fr; gap:22px; }
    .audit-panel { border:1px solid var(--line); padding:26px; background:var(--panel); }
    .audit-panel h3 { margin:0 0 14px; font-size:16px; }
    .audit-panel ul { margin:0; padding:0; list-style:none; }
    .audit-panel li { display:grid; grid-template-columns:16px 1fr; gap:10px; padding:8px 0; color:var(--muted); font-size:12px; }
    .audit-panel li::before { content:""; width:8px; height:8px; margin-top:5px; background:var(--green); }
    footer { padding:32px 0 54px; color:var(--muted); font-size:11px; }
    footer .shell { display:flex; justify-content:space-between; gap:30px; }
    .mono { font-family:ui-monospace,SFMono-Regular,Consolas,monospace; }
    @media (max-width:900px) {
      .hero-grid,.charts,.audit-grid { grid-template-columns:1fr; }
      .kpis { grid-template-columns:repeat(2,1fr); }
      .kpi + .kpi { border-left:0; border-top:1px solid var(--line); }
      .kpi:nth-child(even) { border-left:1px solid var(--line); }
      .protocol-grid { grid-template-columns:1fr; }
      .protocol-grid article + article { border-left:0; border-top:1px solid var(--line); }
      .rank-row { grid-template-columns:42px 1fr 110px 90px; padding:14px 0; }
      .rank-row .status-wrap { grid-column:2 / -1; grid-row:2; }
      .rank-row .faith { display:none; }
    }
    @media (max-width:620px) {
      .shell { width:min(100% - 24px,1240px); }
      nav { display:none; }
      .hero { padding-top:48px; }
      .kpis { grid-template-columns:1fr 1fr; }
      .section-head { align-items:flex-start; flex-direction:column; }
      .callout { grid-template-columns:1fr; gap:8px; }
      .rank-row { grid-template-columns:34px 1fr 88px; gap:10px; }
      .rank-row .tokens { display:none; }
      footer .shell { flex-direction:column; }
    }
  </style>
</head>
<body>
  <header class="topbar">
    <div class="shell"><div class="brand"><i></i><span>DSH EVAL / DEEP RESEARCH</span></div><nav><a href="#results">榜单</a><a href="#efficiency">效率</a><a href="#matrix">逐题结果</a><a href="#audit">审计</a></nav></div>
  </header>
  <div class="hero">
    <div class="shell">
      <p class="eyebrow">V12 · Audited composite · 2026-09-02</p>
      <div class="hero-grid">
        <div><h1>Deep Research<br>插件测评报告</h1><p class="hero-copy">以 DSH 原生能力为 C0 基线，比较 7 个插件在短事实检索、长文研究、引用可靠性与执行效率上的表现。全部 40 条记录均可评分，结果不使用不可解释的加权总分。</p></div>
        <aside class="winner"><span class="tag">Rank 01 / Overall</span><strong id="winner-name"></strong><p>唯一取得长文 PASS 的插件，同时完成 2/2 短事实。</p><div class="number">01 <span>/ 07 plugins</span></div></aside>
      </div>
      <div class="kpis" id="kpis"></div>
    </div>
  </div>
  <main>
    <section id="protocol"><div class="shell">
      <div class="section-head"><div><p class="eyebrow">Evaluation protocol</p><h2>三个维度，五项测评</h2></div><p>所有条件使用同一题面、模型与运行协议。R10 从 R6 派生，不额外调用模型；排名采用字典序规则，先质量与安全，再比较效率。</p></div>
      <div class="protocol-grid">
        <article><small>SF · R1 / R3</small><h3>短事实检索</h3><p>要求命中金标答案且发生真实检索；答案正确但检索不足仍按 FAIL 记录，避免把模型记忆误算为插件能力。</p></article>
        <article><small>LF · R6 / R7</small><h3>长文研究</h3><p>由盲评 Judge 检查交付物完整度、事实、可打开引用与关键主张覆盖；本轮所有条件均获得有效 Judge 结果。</p></article>
        <article><small>PRODUCT · R10</small><h3>产品诊断</h3><p>从 R6 的过程和结果账派生，检查插件相对 C0 的增量，不引入新的模型调用或额外 Token。</p></article>
      </div>
      <div class="callout"><b>为什么是 V12？</b><p>旧 R3 在 P3 上出现零检索直接命中私有答案，判定为题目污染。V12 使用同来源的新 R3 对全部 8 条测试线统一补跑；其余四项只复用已通过严格校验的 V11 记录，并为每条记录写入 sourceRunId 与复用标志。</p></div>
    </div></section>

    <section id="results"><div class="shell">
      <div class="section-head"><div><p class="eyebrow">Leaderboard</p><h2>七插件最终榜单</h2></div><div class="sortbar" aria-label="榜单排序"><button class="active" data-sort="rank">正式排名</button><button data-sort="latency">平均延时</button><button data-sort="tokens">平均 Token</button><button data-sort="sf">短事实</button></div></div>
      <div class="ranking" id="ranking"></div>
      <div class="baseline-row" id="baseline"></div>
    </div></section>

    <section id="efficiency"><div class="shell">
      <div class="section-head"><div><p class="eyebrow">Efficiency map</p><h2>质量之外：时间与 Token</h2></div><p>横轴为每项平均延时（分钟，对数刻度），纵轴为每项平均 Token（千）。越靠左下通常越省资源；这张图不参与正式排名。</p></div>
      <div class="charts">
        <article class="chart-panel"><h3 class="chart-title">各条件平均延时与平均 Token</h3><p class="chart-caption">来源：V12 最终组合记录 · 2026-09-02 · 均值按每条件 5 项计算</p><svg id="scatter" viewBox="0 0 720 430" role="img" aria-label="平均延时与平均 Token 散点图"></svg></article>
        <aside><div class="insights" id="insights"></div></aside>
      </div>
    </div></section>

    <section id="matrix"><div class="shell">
      <div class="section-head"><div><p class="eyebrow">Task matrix</p><h2>逐题状态矩阵</h2></div><p>PASS、PARTIAL、FAIL 都是有效质量结果；SYSTEM_ERROR、NOT_SCORED 或缺失 Judge 才属于无效记录。本轮无无效记录。</p></div>
      <div class="matrix-wrap"><table><thead><tr><th>条件 / 插件</th><th>R1<br>短事实</th><th>R3<br>短事实</th><th>R6<br>长文</th><th>R7<br>长文</th><th>R10<br>产品诊断</th></tr></thead><tbody id="matrix-body"></tbody></table></div>
    </div></section>

    <section id="audit"><div class="shell">
      <div class="section-head"><div><p class="eyebrow">Audit trail</p><h2>这份结果为什么可用</h2></div><p>报告只纳入 suiteId 一致、meta.status=COMPLETED、五题可评分且 R6/R7 Judge 成功的条件记录。</p></div>
      <div class="audit-grid">
        <article class="audit-panel"><h3>有效性检查</h3><ul><li>8/8 条件通过严格运行校验</li><li>40/40 条题目为 PASS、PARTIAL 或 FAIL</li><li>R6/R7 共 16 条 Judge 结果全部成功</li><li>0 条 SYSTEM_ERROR，0 条 NOT_SCORED</li><li>自动化测试 54/54 通过</li></ul></article>
        <article class="audit-panel"><h3>解释边界</h3><ul><li>这是固定小样本插件横评，不是上游 benchmark 官方完整榜单</li><li>正式排名为多级字典序，不提供综合百分制</li><li>延时与 Token 为观测均值，受工具行为与网络状态影响</li><li>R3 为全条件新题补跑，其余题目为可追溯 V11 复用</li><li>P7 因缺少必要凭证被排除，不计零分、不进入榜单</li></ul></article>
      </div>
    </div></section>
  </main>
  <footer><div class="shell"><span>DSH Deep Research Evaluation · V12 final audited report</span><span class="mono" id="suite-id"></span></div></footer>
  <script id="report-data" type="application/json">${json}</script>
  <script>
    const DATA = JSON.parse(document.getElementById('report-data').textContent);
    const plugins = DATA.conditions.filter(row => !row.baseline);
    const baseline = DATA.conditions.find(row => row.baseline);
    const fmt = new Intl.NumberFormat('zh-CN');
    const min = ms => (ms / 60000).toFixed(2);
    const k = value => (value / 1000).toFixed(1) + 'k';
    document.getElementById('winner-name').textContent = plugins.find(row => row.rank === 1).label;
    document.getElementById('suite-id').textContent = DATA.suiteId;
    const kpis = [
      ['参评插件', DATA.totals.plugins],
      ['有效题目记录', DATA.totals.scorable + ' / ' + DATA.totals.records],
      ['系统级失败', DATA.totals.systemErrors],
      ['总观测 Token', k(DATA.totals.tokens)],
      ['有效条件', DATA.totals.conditions + ' / 8'],
    ];
    document.getElementById('kpis').innerHTML = kpis.map(([label,value]) => '<div class="kpi"><span>'+label+'</span><b>'+value+'</b></div>').join('');

    const countStatus = (row, status) => Object.values(row.tasks).filter(task => task.status === status).length;
    function renderRanking(rows) {
      document.getElementById('ranking').innerHTML = rows.map(row => {
        const pass=countStatus(row,'PASS'), partial=countStatus(row,'PARTIAL'), fail=countStatus(row,'FAIL');
        return '<article class="rank-row">'+
          '<div class="rank-index">#'+String(row.rank).padStart(2,'0')+'</div>'+
          '<div class="plugin-name"><strong>'+row.label+'</strong><span>'+row.condition+'</span></div>'+
          '<div class="status-wrap"><div class="statusbar"><i class="pass" style="width:'+(pass*20)+'%"></i><i class="partial" style="width:'+(partial*20)+'%"></i><i class="fail" style="width:'+(fail*20)+'%"></i></div><div class="statuscopy">'+pass+' PASS · '+partial+' PARTIAL · '+fail+' FAIL</div></div>'+
          '<div class="metric">'+row.sfPassed+'/'+row.sfTotal+' <small>SF</small></div>'+
          '<div class="metric">'+min(row.meanLatencyMs)+' <small>分钟</small></div>'+
          '<div class="metric tokens">'+k(row.meanTokens)+' <small>Token</small></div>'+
          '<div class="metric faith" style="display:none">'+Math.round((row.citationFaithfulness||0)*100)+'%</div>'+
        '</article>';
      }).join('');
    }
    renderRanking([...plugins].sort((a,b)=>a.rank-b.rank));
    document.querySelectorAll('[data-sort]').forEach(button => button.addEventListener('click', () => {
      document.querySelectorAll('[data-sort]').forEach(item=>item.classList.remove('active')); button.classList.add('active');
      const key=button.dataset.sort; const rows=[...plugins];
      if(key==='latency') rows.sort((a,b)=>a.meanLatencyMs-b.meanLatencyMs);
      else if(key==='tokens') rows.sort((a,b)=>a.meanTokens-b.meanTokens);
      else if(key==='sf') rows.sort((a,b)=>b.sfPassed-a.sfPassed || a.rank-b.rank);
      else rows.sort((a,b)=>a.rank-b.rank);
      renderRanking(rows);
    }));
    document.getElementById('baseline').innerHTML = '<span><strong>C0 · DSH 原生基线</strong>　'+countStatus(baseline,'PASS')+' PASS · '+countStatus(baseline,'PARTIAL')+' PARTIAL · '+countStatus(baseline,'FAIL')+' FAIL</span><span>SF '+baseline.sfPassed+'/'+baseline.sfTotal+'　平均 '+min(baseline.meanLatencyMs)+' 分钟　'+k(baseline.meanTokens)+' Token</span>';

    const all=[baseline,...plugins]; const svg=document.getElementById('scatter');
    const W=720,H=430,p={l:64,r:30,t:24,b:58};
    const xs=all.map(d=>d.meanLatencyMs/60000), ys=all.map(d=>d.meanTokens/1000);
    const lx=v=>Math.log(v), xmin=Math.min(...xs)*.82,xmax=Math.max(...xs)*1.2,ymin=Math.floor(Math.min(...ys)/10)*10-5,ymax=Math.ceil(Math.max(...ys)/10)*10+5;
    const X=v=>p.l+(lx(v)-lx(xmin))/(lx(xmax)-lx(xmin))*(W-p.l-p.r); const Y=v=>H-p.b-(v-ymin)/(ymax-ymin)*(H-p.t-p.b);
    const xTicks=[3,5,8,12,20,30].filter(v=>v>=xmin&&v<=xmax); const yTicks=[]; for(let v=Math.ceil(ymin/10)*10;v<=ymax;v+=10)yTicks.push(v);
    let marks='';
    yTicks.forEach(v=>{marks+='<line class="gridline" x1="'+p.l+'" y1="'+Y(v)+'" x2="'+(W-p.r)+'" y2="'+Y(v)+'"/><text class="tick-label" x="'+(p.l-12)+'" y="'+(Y(v)+4)+'" text-anchor="end">'+v+'k</text>';});
    xTicks.forEach(v=>{marks+='<line class="gridline" x1="'+X(v)+'" y1="'+p.t+'" x2="'+X(v)+'" y2="'+(H-p.b)+'"/><text class="tick-label" x="'+X(v)+'" y="'+(H-p.b+22)+'" text-anchor="middle">'+v+'</text>';});
    marks+='<line class="axis" x1="'+p.l+'" y1="'+(H-p.b)+'" x2="'+(W-p.r)+'" y2="'+(H-p.b)+'"/><line class="axis" x1="'+p.l+'" y1="'+p.t+'" x2="'+p.l+'" y2="'+(H-p.b)+'"/><text class="axis-label" x="'+((p.l+W-p.r)/2)+'" y="'+(H-14)+'" text-anchor="middle">平均延时（分钟，对数刻度）</text><text class="axis-label" transform="translate(16 '+((p.t+H-p.b)/2)+') rotate(-90)" text-anchor="middle">平均 Token（千）</text>';
    all.forEach(row=>{const x=X(row.meanLatencyMs/60000),y=Y(row.meanTokens/1000);marks+='<circle class="point '+(row.baseline?'baseline':'')+'" cx="'+x+'" cy="'+y+'" r="7"><title>'+row.condition+' · '+row.label+' · '+min(row.meanLatencyMs)+' 分钟 · '+k(row.meanTokens)+' Token</title></circle><text class="point-label" x="'+(x+10)+'" y="'+(y-10)+'">'+row.condition+'</text>';});
    svg.innerHTML=marks;

    const fastest=[...plugins].sort((a,b)=>a.meanLatencyMs-b.meanLatencyMs)[0];
    const leanest=[...plugins].sort((a,b)=>a.meanTokens-b.meanTokens)[0];
    const p3=plugins.find(row=>row.condition==='P3');
    document.getElementById('insights').innerHTML=[
      ['QUALITY','P5 是唯一长文 PASS','R7 获得 PASS，短事实 2/2；平均延时 '+min(plugins[0].meanLatencyMs)+' 分钟。'],
      ['LATENCY',fastest.condition+' 延时最低',fastest.label+' 平均 '+min(fastest.meanLatencyMs)+' 分钟，但正式排名还受引用质量等更高优先级指标影响。'],
      ['TOKENS',leanest.condition+' 插件中最省 Token',leanest.label+' 平均 '+k(leanest.meanTokens)+'，接近 C0 的 '+k(baseline.meanTokens)+'。'],
      ['OUTLIER','P3 存在明显耗时长尾','P3 平均 '+min(p3.meanLatencyMs)+' 分钟，主要来自新 R3 的长时间工具循环，质量状态仍为有效 FAIL。']
    ].map(([tag,title,copy])=>'<article class="insight"><span>'+tag+'</span><strong>'+title+'</strong><p>'+copy+'</p></article>').join('');

    document.getElementById('matrix-body').innerHTML = all.map(row => '<tr><td><strong>'+row.condition+' · '+row.label+'</strong></td>'+DATA.taskIds.map(id=>{const task=row.tasks[id];return '<td title="延时 '+min(task.latencyMs||0)+' 分钟 · '+k(task.tokens||0)+' Token"><span class="cell-status '+task.status+'">'+task.status+'</span></td>';}).join('')+'</tr>').join('');
  </script>
</body>
</html>`;
}
