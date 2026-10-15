'use strict';

// ---------- State ----------
let summary = null;
let failureData = null;
let tests = [];
let byId = new Map();
let currentTest = null;
let lastFocus = null;
const filters = { q: '', status: 'all', dim: null, value: null };
let breakdownDim = 'priority';

const THEMES = [
  ['default', 'Light'],
  ['aquatic', 'Aquatic'],
  ['forest', 'Forest'],
  ['sunset', 'Sunset'],
  ['midnight', 'Midnight'],
  ['corporate', 'Corporate'],
  ['hc-black', 'High contrast black'],
  ['hc-white', 'High contrast white'],
];
const THEME_KEY = 'playwright-ai-reporter-theme';
const TABS = ['overview', 'tests', 'failures', 'api', 'timeline'];
const PRIORITY_RANK = { P0: 0, P1: 1, P2: 2, P3: 3, P4: 4 };
const SEVERITY_RANK = { blocker: 0, critical: 1, major: 2, minor: 3, trivial: 4 };
const HEADLINE_META = ['priority', 'severity', 'owner', 'feature'];
const VERDICT_LABELS = {
  flaky: 'Flaky',
  'consistent-failure': 'Known failure',
  'new-failure': 'New failure',
  stable: 'Stable',
};

// ---------- Helpers ----------
const $ = (id) => document.getElementById(id);

function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Terminal colour codes. Current reporters write clean text; older ones did not.
const ANSI = new RegExp(String.fromCharCode(27) + '\\[[0-9;?]*[ -/]*[@-~]', 'g');
const stripAnsi = (text) => (text ? String(text).replace(ANSI, '') : text);

function fmtDuration(ms) {
  if (!ms) return '0s';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  return `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
}

const baseName = (file) => String(file || '').split(/[/\\]/).pop();
const metaText = (v) => (Array.isArray(v) ? v.join(', ') : v && typeof v === 'object' ? JSON.stringify(v) : String(v));
const truncate = (s, n) => (s && s.length > n ? s.slice(0, n) + '...' : s || '');

function chips(meta, keys) {
  const entries = Object.entries(meta || {}).filter(([k, v]) => v != null && (!keys || keys.includes(k)));
  return entries
    .map(([k, v]) => {
      const text = metaText(v);
      const cls = `chip chip-${esc(k)} chip-${esc(text.toLowerCase().replace(/\W+/g, '-'))}`;
      return `<span class="${cls}" title="${esc(k)}">${esc(text)}</span>`;
    })
    .join('');
}

function toast(message) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.setAttribute('role', 'status');
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2500);
}

function copyText(text) {
  const done = () => toast('Copied to clipboard');
  if (navigator.clipboard && window.isSecureContext !== false) {
    navigator.clipboard.writeText(text).then(done, () => fallbackCopy(text, done));
  } else {
    fallbackCopy(text, done);
  }
}

function fallbackCopy(text, done) {
  const area = document.createElement('textarea');
  area.value = text;
  document.body.appendChild(area);
  area.select();
  try {
    document.execCommand('copy');
    done();
  } catch (e) {
    toast('Copy failed');
  }
  area.remove();
}

function download(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------- Data ----------
async function loadData() {
  if (window.EMBEDDED_TEST_SUMMARY) {
    summary = window.EMBEDDED_TEST_SUMMARY;
    const raw = window.EMBEDDED_TEST_FAILURES;
    failureData = Array.isArray(raw) ? { failures: raw } : raw || { failures: [] };
    return;
  }
  // Served over http next to the JSON files
  const get = (name) => fetch(name).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const [s, f] = await Promise.all([get('testSummary.json'), get('testFailures.json')]);
  summary = s || { allTestCases: [] };
  failureData = Array.isArray(f) ? { failures: f } : f || { failures: [] };
}

// Playwright's outcome decides the status: a test that failed and then passed on retry is flaky
function statusOf(testCase) {
  switch (testCase.outcome) {
    case 'expected': return 'passed';
    case 'flaky': return 'flaky';
    case 'skipped': return 'skipped';
    case 'unexpected': return 'failed';
    default: return testCase.status || 'failed';
  }
}

function buildTest(testCase, failure) {
  const attempts = testCase.attempts || (failure && failure.attempts) || [];
  const failedAttempt = attempts.find((a) => a.status !== 'passed' && a.status !== 'skipped');
  const last = attempts[attempts.length - 1];
  const flakiness = testCase.flakiness || (failure && failure.flakiness) || null;

  return {
    id: testCase.testId || 'test-' + Math.random().toString(36).slice(2, 10),
    name: testCase.testTitle,
    suite: testCase.suiteTitle,
    file: testCase.testFile || '',
    line: testCase.location && testCase.location.line,
    project: testCase.project || '',
    status: statusOf(testCase),
    duration: last ? last.durationMs : failure ? failure.duration * 1000 : testCase.duration || 0,
    start: last && last.startTime ? Date.parse(last.startTime) : null,
    worker: last && last.workerIndex != null ? last.workerIndex : null,
    error: stripAnsi(failure ? failure.errorMessage : failedAttempt ? failedAttempt.error : null),
    stack: stripAnsi(failure ? failure.errorStack : null),
    category: failure ? failure.errorCategory || 'Unknown' : flakiness ? flakiness.primaryPattern : '',
    attempts,
    artifacts: testCase.artifacts || (failure && failure.artifacts) || {},
    flakiness,
    analysis: (failure && failure.analysis) || null,
    analysisFile: (failure && failure.analysisFile) || null,
    fixAccepted: Boolean(failure && failure.fixAccepted),
    pullRequestUrl: (failure && failure.pullRequestUrl) || null,
    owner: testCase.owningTeam || '',
    meta: testCase.meta || (failure && failure.meta) || {},
    apiCalls: testCase.apiCalls || (failure && failure.apiCalls) || [],
  };
}

function processData() {
  const failures = failureData.failures || [];
  const failureById = new Map(failures.map((f) => [f.testId, f]));
  const cases = summary.allTestCases || [];
  tests = cases.length
    ? cases.map((c) => buildTest(c, failureById.get(c.testId)))
    : failures.map((f) => buildTest(f, f));
  byId = new Map(tests.map((t) => [t.id, t]));
}

const isBad = (t) => t.status === 'failed' || t.status === 'flaky';
const owner = (t) => t.meta.owner || (t.owner && t.owner !== 'Unknown' && t.owner !== 'Unknown Team' ? t.owner : '');

function counts(list) {
  const c = { passed: 0, failed: 0, flaky: 0, skipped: 0 };
  list.forEach((t) => { c[t.status] = (c[t.status] || 0) + 1; });
  return c;
}

function rank(t) {
  return [PRIORITY_RANK[t.meta.priority] ?? 9, SEVERITY_RANK[t.meta.severity] ?? 9];
}

function byImportance(a, b) {
  const [pa, sa] = rank(a);
  const [pb, sb] = rank(b);
  return pa - pb || sa - sb || a.name.localeCompare(b.name);
}

// ---------- Themes and tabs ----------
function applyTheme(name) {
  document.documentElement.setAttribute('data-theme', name);
  try { localStorage.setItem(THEME_KEY, name); } catch (e) { /* file:// may block storage */ }
}

function initTheme() {
  const select = $('themeSelect');
  select.innerHTML = THEMES.map(([id, label]) => `<option value="${id}">${esc(label)}</option>`).join('');
  let saved = null;
  try { saved = localStorage.getItem(THEME_KEY); } catch (e) { /* ignore */ }
  const dark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = THEMES.some(([id]) => id === saved) ? saved : dark ? 'midnight' : 'default';
  select.value = theme;
  applyTheme(theme);
  select.addEventListener('change', () => applyTheme(select.value));
}

function setTab(name, updateHash) {
  if (!TABS.includes(name)) name = 'overview';
  document.querySelectorAll('.tab').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.tab === name)));
  TABS.forEach((id) => { $('tab-' + id).hidden = id !== name; });
  if (updateHash !== false && location.hash !== '#' + name) history.replaceState(null, '', '#' + name);
}

// ---------- Header ----------
function renderHeader() {
  const info = summary.buildInfo || {};
  const c = counts(tests);
  const ran = tests.length - c.skipped;

  $('reportTitle').textContent = info.buildBranch ? `Test health · ${info.buildBranch}` : 'Test health report';
  $('reportSubtitle').textContent = [...new Set([info.executionSystem, summary.runEnvironment].filter(Boolean))].join(' · ') || 'Playwright AI Reporter';

  const pills = [];
  if (summary.runEnvironment) pills.push(`env <b>${esc(summary.runEnvironment)}</b>`);
  if (info.buildBranch) pills.push(`branch <b>${esc(info.buildBranch)}</b>`);
  if (info.buildId) pills.push(`build <b>#${esc(info.buildId)}</b>`);
  if (info.commitId) pills.push(`commit <b>${esc(String(info.commitId).slice(0, 7))}</b>`);
  $('runPills').innerHTML = pills.map((p) => `<span class="pill">${p}</span>`).join('');

  const workers = new Set(tests.map((t) => t.worker).filter((w) => w != null)).size;
  const when = summary.timestamp ? new Date(summary.timestamp).toLocaleString() : '';
  const total = summary.totalTimeDisplay || '';
  $('runTime').textContent = [when, total, workers ? `${workers} worker${workers > 1 ? 's' : ''}` : ''].filter(Boolean).join(' · ');

  $('countTests').textContent = tests.length;
  $('countFailures').textContent = c.failed + c.flaky;
  $('countApi').textContent = tests.reduce((n, t) => n + t.apiCalls.length, 0);

  const seg = (n, color) => (n ? `<i style="flex:${n};background:var(${color})"></i>` : '');
  $('statusStrip').innerHTML = seg(c.passed, '--pass') + seg(c.flaky, '--flaky') + seg(c.failed, '--fail') + seg(c.skipped, '--skip');
  void ran;
}

// ---------- Overview ----------
function donut(c, ran) {
  const R = 38;
  const C = 2 * Math.PI * R;
  let offset = 0;
  const arc = (n, color) => {
    if (!n || !ran) return '';
    const len = (n / ran) * C;
    const s = `<circle r="${R}" cx="50" cy="50" fill="none" stroke="var(${color})" stroke-width="12" stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-offset}" transform="rotate(-90 50 50)"/>`;
    offset += len;
    return s;
  };
  const rate = ran ? Math.round((c.passed / ran) * 100) : 0;
  return `<svg class="donut" width="104" height="104" viewBox="0 0 100 100" role="img" aria-label="Pass rate ${rate} percent">
    <circle r="${R}" cx="50" cy="50" fill="none" stroke="rgba(255,255,255,.22)" stroke-width="12"/>
    ${arc(c.passed, '--pass')}${arc(c.flaky, '--flaky')}${arc(c.failed, '--fail')}
    <text x="50" y="57" text-anchor="middle">${rate}%</text></svg>`;
}

function passRateOf(point) {
  const ran = point.passed + point.failed + point.flaky;
  return ran ? (point.passed / ran) * 100 : null;
}

function statCards() {
  const c = counts(tests);
  const ran = tests.length - c.skipped;
  const rate = ran ? Math.round((c.passed / ran) * 100) : 0;
  const trend = summary.trend || [];
  const prev = trend.length > 1 ? passRateOf(trend[trend.length - 2]) : null;
  const delta = prev == null ? 'First recorded run' : `${rate - Math.round(prev) >= 0 ? 'Up' : 'Down'} ${Math.abs(rate - Math.round(prev))} pts from the previous run`;
  const bad = tests.filter((t) => t.status === 'failed');
  const fresh = bad.filter((t) => t.flakiness && t.flakiness.verdict === 'new-failure').length;
  const total = ran || 1;
  const seg = (n, color) => `<i style="width:${(n / total) * 100}%;background:var(${color})"></i>`;

  return `
  <div class="stat hero">${donut(c, ran)}
    <div style="flex:1"><div class="label">Pass rate</div>
      <div class="value">${c.passed} <small>of ${ran} ran</small></div>
      <div class="meter">${seg(c.passed, '--pass')}${seg(c.flaky, '--flaky')}${seg(c.failed, '--fail')}</div>
      <div class="note">${esc(delta)}</div></div></div>
  <div class="stat pass"><div class="label">Passed</div><div class="value">${c.passed}</div><div class="note">Passed first time</div></div>
  <div class="stat fail"><div class="label">Failed</div><div class="value">${c.failed}</div>
    <div class="note ${c.failed ? 'bad' : ''}">${fresh} new &middot; ${c.failed - fresh} known</div></div>
  <div class="stat flaky"><div class="label">Flaky</div><div class="value">${c.flaky}</div><div class="note">Passed on retry</div></div>
  <div class="stat skip"><div class="label">Skipped</div><div class="value">${c.skipped}</div><div class="note">Not executed</div></div>`;
}

function runStrip() {
  const ordered = [...tests].sort((a, b) => (a.start || 0) - (b.start || 0));
  return `<div class="panel"><div class="runstrip">${ordered
    .map((t) => `<button class="dot s-${t.status}" data-open="${esc(t.id)}" title="${esc(t.name)} (${t.status})" aria-label="${esc(t.name)}, ${t.status}"></button>`)
    .join('')}</div>
    <p class="muted" style="margin:10px 0 0;font-size:.78rem">Every test in run order. Hover for the name, click to open.</p></div>`;
}

function attentionPanel() {
  const bad = tests.filter(isBad).sort(byImportance);
  const rows = bad
    .slice(0, 8)
    .map((t) => {
      const verdict = t.status === 'flaky' ? 'Flaky' : (VERDICT_LABELS[t.flakiness && t.flakiness.verdict] || 'Failed');
      const prio = t.meta.priority || '';
      return `<li class="row" tabindex="0" data-open="${esc(t.id)}">
        <div class="prio ${prio ? '' : 'p-none'}">${esc(prio || '-')}<small>${esc(t.meta.severity || '')}</small></div>
        <div class="row-main"><div class="row-title">${esc(t.name)}</div>
          <div class="row-sub">${esc(baseName(t.file))}${t.project ? ' · ' + esc(t.project) : ''} · ${esc(verdict)}</div></div>
        <div class="row-side">${esc(owner(t))}</div></li>`;
    })
    .join('');
  return `<div class="panel"><h3>Needs attention <small>${bad.length} open, ranked by priority and severity</small></h3>
    ${bad.length ? `<ul class="rows">${rows}</ul>${bad.length > 8 ? '<p class="muted" style="margin:8px 0 0"><a href="#failures" data-tab="failures">See all failures</a></p>' : ''}` : '<div class="empty">Nothing needs attention. Every test passed.</div>'}</div>`;
}

// ---------- Failure clusters: failures that most likely share one cause ----------
function errorSignature(t) {
  const line = (t.error || '').split('\n').find((l) => l.trim()) || 'No error message';
  return line
    .replace(/https?:\/\/\S+/g, '<url>')
    .replace(/"[^"]*"|'[^']*'|`[^`]*`/g, '<value>')
    .replace(/\b[0-9a-f]{8,}\b/gi, '<id>')
    .replace(/\d+(\.\d+)?/g, '<n>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 150);
}

function buildClusters() {
  const groups = new Map();
  tests.filter((t) => isBad(t) && t.error).forEach((t) => {
    const signature = errorSignature(t);
    const key = `${t.category}|${signature}`;
    if (!groups.has(key)) groups.set(key, { category: t.category, signature, tests: [] });
    groups.get(key).tests.push(t);
  });
  return [...groups.values()].sort((a, b) => b.tests.length - a.tests.length || byImportance(a.tests[0], b.tests[0]));
}

function clustersPanel() {
  const clusters = buildClusters();
  const failures = clusters.reduce((n, c) => n + c.tests.length, 0);
  const body = clusters
    .slice(0, 6)
    .map((c) => `<div class="cluster"><div class="cluster-n">${c.tests.length}<small>test${c.tests.length > 1 ? 's' : ''}</small></div>
      <div style="flex:1;min-width:0"><div class="muted" style="font-size:.72rem;font-weight:700;text-transform:uppercase">${esc(c.category)}</div>
      <code class="cluster-sig">${esc(c.signature)}</code>
      <div class="cluster-tests">${c.tests.map((t) => `<a tabindex="0" data-open="${esc(t.id)}">${esc(t.name)}</a>`).join('')}</div></div></div>`)
    .join('');
  return `<div class="panel"><h3>Failure clusters <small>${clusters.length} root cause${clusters.length === 1 ? '' : 's'} &middot; ${failures} failure${failures === 1 ? '' : 's'}</small></h3>
    ${body || '<div class="empty">No failures to group.</div>'}</div>`;
}

// ---------- Breakdown ----------
function dimensions() {
  const dims = [['priority', 'Priority'], ['severity', 'Severity'], ['feature', 'Feature'], ['owner', 'Owner'], ['file', 'Spec file']];
  if (tests.some((t) => t.project)) dims.push(['project', 'Project']);
  return dims;
}

function dimValue(t, dim) {
  if (dim === 'file') return baseName(t.file);
  if (dim === 'project') return t.project;
  if (dim === 'owner') return owner(t);
  const v = t.meta[dim];
  return v == null ? '' : metaText(v);
}

function breakdownPanel() {
  const groups = new Map();
  let without = 0;
  tests.forEach((t) => {
    const v = dimValue(t, breakdownDim);
    if (!v) { without++; return; }
    if (!groups.has(v)) groups.set(v, []);
    groups.get(v).push(t);
  });
  const entries = [...groups.entries()].sort((a, b) =>
    breakdownDim === 'priority' ? (PRIORITY_RANK[a[0]] ?? 9) - (PRIORITY_RANK[b[0]] ?? 9) || a[0].localeCompare(b[0])
    : breakdownDim === 'severity' ? (SEVERITY_RANK[a[0]] ?? 9) - (SEVERITY_RANK[b[0]] ?? 9)
    : b[1].length - a[1].length);
  const rows = entries.map(([value, list]) => {
    const c = counts(list);
    const seg = (n, color) => (n ? `<i style="width:${(n / list.length) * 100}%;background:var(${color})"></i>` : '');
    return `<div class="bar-row" tabindex="0" data-dim="${esc(breakdownDim)}" data-value="${esc(value)}" title="Show these tests">
      <div class="bar-label">${esc(value)}</div>
      <div class="bar">${seg(c.passed, '--pass')}${seg(c.flaky, '--flaky')}${seg(c.failed, '--fail')}${seg(c.skipped, '--skip')}</div>
      <div class="bar-n">${c.failed ? `<b>${c.failed}</b> &times; ` : ''}${list.length}</div></div>`;
  }).join('');
  return `<div class="panel"><h3>Breakdown <small>click a row to filter</small></h3>
    <div class="seg-tabs" role="group" aria-label="Group by">${dimensions().map(([id, label]) =>
      `<button class="seg" data-breakdown="${id}" aria-pressed="${id === breakdownDim}">${label}</button>`).join('')}</div>
    ${rows || `<div class="empty">No test declares a ${esc(breakdownDim)}. Add <code>meta({ ${esc(breakdownDim)}: ... })</code> to your tests.</div>`}
    <div class="legend"><span style="--c:var(--pass)">Passed</span><span style="--c:var(--flaky)">Flaky</span><span style="--c:var(--fail)">Failed</span><span style="--c:var(--skip)">Skipped</span>
      ${without ? `<span style="margin-left:auto">${without} without ${esc(breakdownDim)}</span>` : ''}</div></div>`;
}

function slowestPanel() {
  const slow = [...tests].filter((t) => t.status !== 'skipped').sort((a, b) => b.duration - a.duration).slice(0, 5);
  const max = slow[0] ? slow[0].duration || 1 : 1;
  return `<div class="panel"><h3>Slowest tests</h3>${slow.map((t) => `<div class="hbar" tabindex="0" data-open="${esc(t.id)}">
    <div class="hbar-top"><span>${esc(t.name)}</span><span>${fmtDuration(t.duration)}</span></div>
    <div class="hbar-track"><i style="width:${(t.duration / max) * 100}%"></i></div></div>`).join('') || '<div class="empty">No timings.</div>'}</div>`;
}

function trendPanel() {
  const trend = (summary.trend || []).slice(-30);
  if (trend.length === 0) {
    return `<div class="panel"><h3>Trend</h3><div class="empty">Run history is off. Set <code>historyFile</code> to keep the last runs.</div></div>`;
  }
  const W = 600, H = 140, gap = 4;
  const max = Math.max(...trend.map((p) => p.passed + p.failed + p.flaky + p.skipped), 1);
  const bw = Math.min(36, Math.max(4, (W - gap * (trend.length - 1)) / trend.length));
  const bars = trend.map((p, i) => {
    let y = H;
    const piece = (n, color) => {
      if (!n) return '';
      const h = (n / max) * (H - 6);
      y -= h;
      return `<rect x="${i * (bw + gap)}" y="${y}" width="${bw}" height="${h}" rx="2" fill="var(${color})"/>`;
    };
    const label = `${new Date(p.time).toLocaleString()}: ${p.passed} passed, ${p.failed} failed, ${p.flaky} flaky`;
    return `<g><title>${esc(label)}</title>${piece(p.passed, '--pass')}${piece(p.flaky, '--flaky')}${piece(p.failed, '--fail')}</g>`;
  }).join('');
  return `<div class="panel trend"><h3>Trend <small>last ${trend.length} run${trend.length > 1 ? 's' : ''}</small></h3>
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Results of the last runs">${bars}</svg>
    ${trend.length < 2 ? '<p class="muted" style="margin:8px 0 0;font-size:.78rem">Only this run is recorded. The trend fills in as the history file grows.</p>' : ''}</div>`;
}

function flakyPanel() {
  const list = tests.filter((t) => t.flakiness && (t.flakiness.verdict === 'flaky' || (t.flakiness.failureRate > 0 && t.status !== 'failed')))
    .sort((a, b) => b.flakiness.failureRate - a.flakiness.failureRate).slice(0, 5);
  return `<div class="panel"><h3>Flakiest tests <small>from retries and history</small></h3>
    ${list.map((t) => `<div class="hbar" tabindex="0" data-open="${esc(t.id)}">
      <div class="hbar-top"><span>${esc(t.name)}</span><span>${t.flakiness.failureRate}% of ${t.flakiness.runs} run${t.flakiness.runs > 1 ? 's' : ''}</span></div>
      <div class="row-sub">${esc(t.flakiness.primaryPattern)}</div></div>`).join('') || '<div class="empty">No flaky test found in this run or its history.</div>'}
    <p style="margin:10px 0 0"><button class="mini" data-act="flaky-analysis">Analyze flaky patterns</button></p></div>`;
}

function skippedPanel() {
  const list = tests.filter((t) => t.status === 'skipped');
  return `<div class="panel"><h3>Skipped <small>${list.length} test${list.length === 1 ? '' : 's'}</small></h3>
    ${list.slice(0, 6).map((t) => `<div class="hbar" tabindex="0" data-open="${esc(t.id)}"><div class="hbar-top"><span>${esc(t.name)}</span></div>
      <div class="row-sub">${esc(baseName(t.file))}</div></div>`).join('') || '<div class="empty">Nothing was skipped.</div>'}</div>`;
}

function environmentPanel() {
  const info = summary.buildInfo || {};
  const rows = [
    ['Environment', summary.runEnvironment],
    ['CI system', info.executionSystem],
    ['Branch', info.buildBranch],
    ['Commit', info.commitId && String(info.commitId).slice(0, 12)],
    ['Build', info.buildId],
    ['Duration', summary.totalTimeDisplay],
    ['Average', summary.averageTime ? fmtDuration(summary.averageTime * 1000) : ''],
  ].filter(([, v]) => v);
  const link = info.buildLink ? `<p style="margin:10px 0 0"><a href="${esc(info.buildLink)}" target="_blank" rel="noopener">Open the build</a></p>` : '';
  return `<div class="panel"><h3>Environment</h3><dl class="kv">${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>${link}</div>`;
}

function renderOverview() {
  $('tab-overview').innerHTML = `
    <div class="grid stats" style="margin-bottom:18px">${statCards()}</div>
    ${runStrip()}
    <div class="grid two" style="margin-bottom:18px">${attentionPanel()}${clustersPanel()}</div>
    <div class="grid breakdown-row" style="margin-bottom:18px">${breakdownPanel()}${slowestPanel()}</div>
    <div class="grid three">${trendPanel()}${flakyPanel()}${skippedPanel()}</div>
    <div style="margin-top:18px">${environmentPanel()}</div>`;
}

// ---------- Tests tab ----------
function matches(t) {
  const q = filters.q.trim().toLowerCase();
  if (q) {
    const hay = [t.name, t.file, t.suite, t.project, owner(t), ...Object.values(t.meta).map(metaText)].join(' ').toLowerCase();
    if (!hay.includes(q)) return false;
  }
  if (filters.status !== 'all' && t.status !== filters.status) return false;
  if (filters.dim && dimValue(t, filters.dim) !== filters.value) return false;
  return true;
}

function renderTests() {
  const list = tests.filter(matches);
  $('activeFilter').innerHTML = filters.dim
    ? `${esc(filters.dim)}: ${esc(filters.value)} <button class="mini" data-act="clear-filter">Clear</button>`
    : '';
  $('testsTable').innerHTML = list.length
    ? `<table><thead><tr><th>Status</th><th>Test</th><th>Meta</th><th>File</th><th>Duration</th></tr></thead><tbody>${list
        .map((t) => `<tr tabindex="0" data-open="${esc(t.id)}"><td><span class="badge b-${t.status}">${t.status}</span></td>
          <td><div class="ellipsis" title="${esc(t.name)}"><b>${esc(t.name)}</b></div></td>
          <td><div class="chips">${chips(t.meta, HEADLINE_META)}</div></td>
          <td class="muted">${esc(baseName(t.file))}</td><td class="muted">${fmtDuration(t.duration)}</td></tr>`).join('')}</tbody></table>`
    : '<div class="empty">No test matches the filter.</div>';
}

// ---------- Failures tab ----------
function failureCard(t) {
  const verdict = t.status === 'flaky' ? 'flaky' : (t.flakiness && t.flakiness.verdict) || 'failed';
  const has = (k) => t.artifacts && t.artifacts[k];
  return `<article class="fcard ${t.status === 'flaky' ? 'is-flaky' : ''}">
    <div class="fcard-head"><h4>${esc(t.name)}</h4>
      <span class="badge b-${verdict}">${esc(VERDICT_LABELS[verdict] || 'Failed')}</span>${chips(t.meta, HEADLINE_META)}</div>
    <div class="row-sub">${esc(baseName(t.file))}${t.line ? ':' + t.line : ''}${t.project ? ' · ' + esc(t.project) : ''} · ${esc(t.category || 'Uncategorised')}</div>
    <pre class="err">${esc(truncate(t.error || 'No error message was recorded.', 600))}</pre>
    ${t.flakiness ? `<p class="next"><b>Next step:</b> ${esc(t.flakiness.recommendation)}</p>` : ''}
    <div class="fcard-actions">
      <button class="mini" data-open="${esc(t.id)}">Details</button>
      ${t.analysis ? `<button class="mini" data-open="${esc(t.id)}" data-focus="analysis">AI analysis</button>` : ''}
      ${has('screenshot') || has('video') ? `<button class="mini" data-open="${esc(t.id)}" data-focus="evidence">Evidence</button>` : ''}
      ${has('trace') ? `<button class="mini" data-open="${esc(t.id)}" data-focus="trace">Trace</button>` : ''}
      ${t.apiCalls.length ? `<button class="mini" data-open="${esc(t.id)}" data-focus="api">API calls (${t.apiCalls.length})</button>` : ''}
      ${t.pullRequestUrl ? `<a class="mini" href="${esc(t.pullRequestUrl)}" target="_blank" rel="noopener">Pull request</a>` : ''}
    </div></article>`;
}

function renderFailures() {
  const bad = tests.filter(isBad).sort(byImportance);
  $('failuresSummary').textContent = bad.length ? `${bad.length} test(s) did not pass first time.` : '';
  $('failuresList').innerHTML = bad.length ? bad.map(failureCard).join('') : '<div class="panel empty">No failures. Every test passed.</div>';
}

// ---------- API tab ----------
const stClass = (s) => (!s ? 'st-err' : s >= 500 ? 'st-5xx' : s >= 400 ? 'st-4xx' : s >= 300 ? 'st-3xx' : 'st-2xx');
function apiPath(url) {
  try { const u = new URL(url); return u.pathname + u.search; } catch (e) { return url; }
}

function renderApi() {
  const q = $('apiSearch').value.trim().toLowerCase();
  const onlyBad = $('apiFailedOnly').checked;
  const rows = [];
  tests.forEach((t) => t.apiCalls.forEach((c) => rows.push({ t, c })));
  const list = rows.filter(({ t, c }) => (!onlyBad || !c.status || c.status >= 400) && (!q || `${c.method} ${c.url} ${t.name}`.toLowerCase().includes(q)));
  $('apiSummary').textContent = rows.length ? `${list.length} of ${rows.length} call(s)` : '';
  $('apiTable').innerHTML = rows.length
    ? `<table><thead><tr><th>Method</th><th>Status</th><th>URL</th><th>Time</th><th>Test</th></tr></thead><tbody>${list
        .map(({ t, c }) => `<tr tabindex="0" data-open="${esc(t.id)}" data-focus="api"><td><b>${esc(c.method)}</b></td>
          <td><span class="st ${stClass(c.status)}">${c.status || 'ERR'}</span></td>
          <td><div class="ellipsis mono" title="${esc(c.url)}">${esc(apiPath(c.url))}</div></td>
          <td class="muted">${c.durationMs} ms</td><td class="muted"><div class="ellipsis">${esc(t.name)}</div></td></tr>`).join('')}</tbody></table>`
    : `<div class="empty"><p>No API calls were recorded.</p><p>Add <code>recordApi(page)</code> from <code>playwright-ai-reporter/recorder</code>, or its <code>apiRecorderFixture</code>, to see every fetch and XHR call of a failing test here. Secrets are masked.</p></div>`;
}

// ---------- Timeline ----------
function renderTimeline() {
  const timed = tests.filter((t) => t.start);
  if (!timed.length) {
    $('timelineView').innerHTML = '<div class="empty">No start times were recorded. Run the tests again with the current reporter.</div>';
    return;
  }
  const t0 = Math.min(...timed.map((t) => t.start));
  const t1 = Math.max(...timed.map((t) => t.start + t.duration));
  const span = Math.max(t1 - t0, 1);
  const lanes = new Map();
  timed.forEach((t) => {
    const w = t.worker == null ? 0 : t.worker;
    if (!lanes.has(w)) lanes.set(w, []);
    lanes.get(w).push(t);
  });
  const html = [...lanes.entries()].sort((a, b) => a[0] - b[0]).map(([w, list]) => `<div class="lane"><div class="lane-label">Worker ${w}</div>
    <div class="lane-track">${list.map((t) => `<button class="tbar s-${t.status}" data-open="${esc(t.id)}"
      style="left:${((t.start - t0) / span) * 100}%;width:${(t.duration / span) * 100}%" title="${esc(t.name)} · ${fmtDuration(t.duration)}">${esc(t.name)}</button>`).join('')}</div></div>`).join('');
  $('timelineView').innerHTML = `<h3 style="margin-top:0">Timeline <small class="muted">${fmtDuration(span)} wall time, one lane per worker</small></h3>${html}
    <div class="axis"><span>0s</span><span>${fmtDuration(span / 2)}</span><span>${fmtDuration(span)}</span></div>`;
}

// ---------- Detail modal ----------
function section(id, title, body) {
  return `<section id="sec-${id}"><h4>${title}</h4>${body}</section>`;
}

function metaTable(meta) {
  const rows = Object.entries(meta).filter(([, v]) => v != null);
  return rows.length ? `<table class="meta-table"><tbody>${rows.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(metaText(v))}</td></tr>`).join('')}</tbody></table>` : '';
}

function flakinessBlock(t) {
  const f = t.flakiness;
  if (!f) return '';
  const attempts = (t.attempts || []).map((a) => `<li>Attempt ${a.retry + 1}: <b>${esc(a.status)}</b> in ${fmtDuration(a.durationMs)}${a.error ? ' &mdash; ' + esc(a.error) : ''}</li>`).join('');
  return `<p><span class="badge b-${f.verdict}">${esc(VERDICT_LABELS[f.verdict] || f.verdict)}</span>
    &nbsp;failed ${f.failureRate}% of ${f.runs} run(s) &middot; pattern: ${esc(f.primaryPattern)}</p>
    <ul>${(f.evidence || []).map((e) => `<li>${esc(e)}</li>`).join('')}</ul>
    <p><b>Next step:</b> ${esc(f.recommendation)}</p>
    ${attempts ? `<details><summary>Attempts</summary><ul>${attempts}</ul></details>` : ''}`;
}

function evidenceBlock(t) {
  const a = t.artifacts || {};
  const href = (l) => encodeURI(l.href);
  let html = '';
  if (a.screenshot) html += `<p><a href="${href(a.screenshot)}" target="_blank" rel="noopener"><img src="${a.screenshot.inline || href(a.screenshot)}" alt="Screenshot of the failure"></a></p>`;
  if (a.video) html += `<p><video controls preload="none" src="${href(a.video)}"></video></p>`;
  if (a.errorContext) html += `<p><a href="${href(a.errorContext)}" target="_blank" rel="noopener">Error context</a></p>`;
  if (a.video || a.errorContext) {
    html += '<p class="muted" style="font-size:.78rem">Screenshots are embedded in this report. Videos, traces and error context are separate files: download the results artifact and keep them next to this report to open them.</p>';
  }
  return html || '<p class="muted">No screenshot or video was recorded. Set <code>screenshot</code> and <code>video</code> to <code>retain-on-failure</code> in the Playwright config.</p>';
}

function traceBlock(t) {
  const trace = t.artifacts && t.artifacts.trace;
  if (!trace) return '<p class="muted">No trace was recorded. Set <code>trace: \'retain-on-failure\'</code> in the Playwright config.</p>';
  const command = `npx playwright show-trace "${trace.path}"`;
  // A trace is a zip: a file:// page cannot open it, so offer the command and the download
  const hosted = location.protocol === 'file:' ? '' :
    `<a class="btn btn-primary" target="_blank" rel="noopener" href="https://trace.playwright.dev/?trace=${encodeURIComponent(new URL(encodeURI(trace.href), location.href).href)}">Open in trace.playwright.dev</a>`;
  return `<pre id="traceCmd">${esc(command)}</pre>
    <p style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-ghost" data-act="copy" data-text="${esc(command)}">Copy command</button>
    <a class="btn btn-ghost" href="${encodeURI(trace.href)}" download="trace.zip">Download trace.zip</a>${hosted}</p>
    <p class="muted" style="font-size:.78rem">On trace.playwright.dev you can drag the zip into the page. It is processed in your browser, not uploaded.</p>`;
}

function headersBlock(h) {
  const rows = Object.entries(h || {});
  return rows.length ? `<pre>${esc(rows.map(([k, v]) => `${k}: ${v}`).join('\n'))}</pre>` : '<p class="muted">None</p>';
}

function apiBlock(t) {
  if (!t.apiCalls.length) {
    return '<p class="muted">No API calls were recorded. Add <code>recordApi(page)</code> from <code>playwright-ai-reporter/recorder</code>.</p>';
  }
  const failed = t.apiCalls.filter((c) => !c.status || c.status >= 400).length;
  return `<p class="muted">${t.apiCalls.length} call(s)${failed ? `, ${failed} failed` : ''}. Secrets are masked.</p>` + t.apiCalls.map((c) => `<details class="api-call">
    <summary><span class="api-method">${esc(c.method)}</span><span class="st ${stClass(c.status)}">${c.status || 'ERR'}</span>
      <span class="api-url" title="${esc(c.url)}">${esc(apiPath(c.url))}</span><span class="api-time">${c.durationMs} ms</span></summary>
    <div class="api-detail">${c.failure ? `<p><b>${esc(c.failure)}</b></p>` : ''}<p class="muted mono">${esc(c.url)}</p>
      <h4>Request headers</h4>${headersBlock(c.requestHeaders)}
      ${c.requestBody ? `<h4>Request body</h4><pre>${esc(c.requestBody)}</pre>` : ''}
      <h4>Response headers</h4>${headersBlock(c.responseHeaders)}
      ${c.responseBody ? `<h4>Response body</h4><pre>${esc(c.responseBody)}</pre>` : ''}</div></details>`).join('');
}

function analysisBlock(t) {
  if (!t.analysis) {
    return '<p class="muted">No AI analysis was produced for this test. Turn it on with <code>generateFix: true</code> and an <code>AI_PROVIDER</code> such as <code>copilot</code>, then run the tests again.</p>';
  }
  return `${t.fixAccepted ? '<p><span class="badge b-passed">Fix validated</span></p>' : ''}<pre>${esc(t.analysis)}</pre>
    ${t.analysisFile ? `<p class="muted" style="font-size:.78rem">Saved as <code>${esc(t.analysisFile)}</code></p>` : ''}`;
}

function openTest(id, focus) {
  const t = byId.get(id);
  if (!t) return;
  currentTest = t;
  lastFocus = document.activeElement;

  $('modalTitle').textContent = t.name;
  $('modalSub').innerHTML = `<span class="badge b-${t.status}">${t.status}</span> &nbsp;${esc(baseName(t.file))}${t.line ? ':' + t.line : ''}${t.project ? ' · ' + esc(t.project) : ''} · ${fmtDuration(t.duration)}`;

  const meta = metaTable(t.meta);
  $('modalBody').innerHTML =
    (meta ? section('meta', 'Test details', meta) : '') +
    (t.error ? section('error', 'Error', `<pre>${esc(t.error)}</pre>`) : '') +
    (t.flakiness ? section('flakiness', 'Is it flaky?', flakinessBlock(t)) : '') +
    section('analysis', 'AI analysis', analysisBlock(t)) +
    section('evidence', 'Evidence', evidenceBlock(t)) +
    section('trace', 'Trace', traceBlock(t)) +
    section('api', 'API calls', apiBlock(t));

  const pr = $('modalPrLink');
  pr.hidden = !t.pullRequestUrl;
  if (t.pullRequestUrl) pr.href = t.pullRequestUrl;

  $('detailModal').hidden = false;
  document.body.style.overflow = 'hidden';
  const target = focus && $('sec-' + focus);
  if (target) target.scrollIntoView({ block: 'start' });
  else $('modalBody').scrollTop = 0;
  $('detailModal').querySelector('.icon-btn').focus();
}

function closeModal() {
  $('detailModal').hidden = true;
  $('flakyModal').hidden = true;
  document.body.style.overflow = '';
  if (lastFocus && lastFocus.focus) lastFocus.focus();
}

// ---------- Flaky analysis ----------
function flakyReportMarkdown() {
  const lines = ['# Flaky test analysis', ''];
  const rows = tests.filter((t) => t.flakiness && t.flakiness.verdict !== 'stable');
  if (!rows.length) lines.push('No flaky or failing tests.');
  rows.forEach((t) => {
    const f = t.flakiness;
    lines.push(`## ${t.name}`, '', `- Verdict: ${VERDICT_LABELS[f.verdict]}`, `- Failed ${f.failureRate}% of ${f.runs} run(s); pattern: ${f.primaryPattern}`);
    f.evidence.forEach((e) => lines.push(`- Evidence: ${e}`));
    lines.push(`- Next step: ${f.recommendation}`, '');
  });
  return lines.join('\n');
}

function openFlakyAnalysis() {
  lastFocus = document.activeElement;
  const flaky = tests.filter((t) => t.flakiness && t.flakiness.verdict === 'flaky');
  const failing = tests.filter((t) => t.status === 'failed' && t.flakiness && t.flakiness.verdict !== 'flaky');
  const runs = Math.max(1, ...tests.map((t) => (t.flakiness ? t.flakiness.runs : 0)));
  const counts = {};
  flaky.forEach((t) => (t.flakiness.patterns.length ? t.flakiness.patterns : [t.flakiness.primaryPattern]).forEach((p) => { counts[p] = (counts[p] || 0) + 1; }));
  const card = (t, note) => `<div class="panel" style="margin-bottom:10px"><b>${esc(t.name)}</b> ${note || ''}
    <p class="muted" style="margin:4px 0">${esc(t.flakiness.evidence.join('; '))}</p><p style="margin:0"><b>Next step:</b> ${esc(t.flakiness.recommendation)}</p></div>`;

  $('flakyBody').innerHTML = `
    <p><b>${flaky.length}</b> flaky &middot; <b>${failing.length}</b> failing but not flaky &middot; <b>${runs}</b> run(s) considered
      ${runs <= 1 ? '<span class="muted">(no history yet: only retries in this run can show flakiness)</span>' : ''}</p>
    <h4>Patterns</h4>
    ${Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([p, n]) => `<p style="margin:4px 0"><b>${esc(p)}</b>: ${n} test(s)</p>`).join('') || '<p class="muted">No flaky pattern found.</p>'}
    <h4>Flaky tests</h4>${flaky.map((t) => card(t)).join('') || '<p class="muted">None.</p>'}
    <h4>Failing, not flaky</h4>${failing.map((t) => card(t, `<span class="badge b-${t.flakiness.verdict}">${esc(VERDICT_LABELS[t.flakiness.verdict])}</span>`)).join('') || '<p class="muted">None.</p>'}`;
  $('flakyModal').hidden = false;
  document.body.style.overflow = 'hidden';
  $('flakyModal').querySelector('.icon-btn').focus();
}

// ---------- Summary, export ----------
function summaryMarkdown() {
  const c = counts(tests);
  const ran = tests.length - c.skipped;
  const info = summary.buildInfo || {};
  const lines = [`# Test run: ${c.passed}/${ran} passed (${ran ? Math.round((c.passed / ran) * 100) : 0}%)`, ''];
  lines.push(`- Failed: ${c.failed}, flaky: ${c.flaky}, skipped: ${c.skipped}`);
  if (info.buildBranch) lines.push(`- Branch: ${info.buildBranch}`);
  if (info.buildLink) lines.push(`- Build: ${info.buildLink}`);
  const bad = tests.filter(isBad).sort(byImportance);
  if (bad.length) {
    lines.push('', '## Needs attention');
    bad.forEach((t) => lines.push(`- ${t.meta.priority ? `**${t.meta.priority}** ` : ''}${t.name} (${baseName(t.file)})${owner(t) ? ' — ' + owner(t) : ''}: ${truncate((t.error || '').split('\n')[0], 120)}`));
  }
  const clusters = buildClusters();
  if (clusters.length) {
    lines.push('', '## Failure clusters');
    clusters.forEach((cl) => lines.push(`- ${cl.tests.length} test(s): \`${cl.signature}\``));
  }
  return lines.join('\n');
}

function exportAnalyses() {
  const done = tests.filter((t) => t.status === 'failed' && t.analysis);
  if (!done.length) return toast('No AI analysis in this run. Enable generateFix and set AI_PROVIDER.');
  download('ai-analysis.md', '# AI analysis of failed tests\n\n' + done.map((t) => `## ${t.name}\n\n- File: ${t.file}\n\n${t.analysis}\n`).join('\n---\n\n'));
}

// ---------- Events ----------
function onClick(event) {
  const el = event.target.closest('[data-open],[data-act],[data-tab],[data-dim],[data-breakdown]');
  if (event.target.classList && event.target.classList.contains('modal')) return closeModal();
  if (!el) return;

  if (el.dataset.breakdown) { breakdownDim = el.dataset.breakdown; renderOverview(); return; }
  if (el.dataset.dim) {
    filters.dim = el.dataset.dim; filters.value = el.dataset.value;
    renderTests(); setTab('tests'); return;
  }
  if (el.dataset.tab) { event.preventDefault(); setTab(el.dataset.tab); return; }
  if (el.dataset.open) { event.preventDefault(); openTest(el.dataset.open, el.dataset.focus); return; }

  switch (el.dataset.act) {
    case 'close-modal': case 'close-flaky': closeModal(); break;
    case 'copy': copyText(el.dataset.text); break;
    case 'copy-summary': copyText(summaryMarkdown()); break;
    case 'copy-analysis':
      if (currentTest && currentTest.analysis) copyText(currentTest.analysis);
      else toast('This test has no AI analysis to copy.');
      break;
    case 'flaky-analysis': openFlakyAnalysis(); break;
    case 'copy-flaky': copyText(flakyReportMarkdown()); break;
    case 'export-analyses': exportAnalyses(); break;
    case 'clear-filter': filters.dim = null; filters.value = null; renderTests(); break;
    default: break;
  }
}

function onKey(event) {
  if (event.key === 'Escape' && (!$('detailModal').hidden || !$('flakyModal').hidden)) closeModal();
  if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('[tabindex][data-open],[tabindex][data-dim]')) {
    event.preventDefault();
    event.target.click();
  }
}

function bind() {
  document.addEventListener('click', onClick);
  document.addEventListener('keydown', onKey);
  $('testSearch').addEventListener('input', (e) => { filters.q = e.target.value; renderTests(); });
  $('statusFilter').addEventListener('change', (e) => { filters.status = e.target.value; renderTests(); });
  $('apiSearch').addEventListener('input', renderApi);
  $('apiFailedOnly').addEventListener('change', renderApi);
  window.addEventListener('hashchange', () => setTab(location.hash.slice(1), false));
}

async function init() {
  initTheme();
  try {
    await loadData();
    processData();
  } catch (error) {
    console.error('Could not load the test data', error);
    summary = { allTestCases: [] };
    failureData = { failures: [] };
    processData();
  }
  renderHeader();
  renderOverview();
  renderTests();
  renderFailures();
  renderApi();
  renderTimeline();
  bind();
  setTab(location.hash.slice(1), false);
}

document.addEventListener('DOMContentLoaded', init);
