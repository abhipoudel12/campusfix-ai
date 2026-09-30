import './styles.css';
import { calculateScore, scoreBreakdown, createDemoReport, scenarios, statuses, updateReportStatus, selectReports } from './demo.js';

const MAX_FILE_SIZE = 8 * 1024 * 1024;
const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
let reports = [];
let selectedFile = null;
let previewUrl = null;
let filter = 'All';
let sort = 'highest';
let isPreparing = false;
let dragDepth = 0;
let lastStatusChangeId = null;
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const app = document.querySelector('#app');
// Original campus building and completed-repair mark; decorative where the nearby text names the app.
const brandMark = `<svg class="campus-mark" viewBox="0 0 48 48" fill="none" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg"><path d="M7 19 24 9l17 10M11 20v17h20M17 24v9m7-9v9M9 38h22" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="36" cy="34" r="9" fill="#00F2FE"/><path d="m32 34 3 3 5-6" stroke="#0A0B10" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
app.innerHTML = `
  <div class="site-shell">
    <header class="topbar">
      <a class="brand" href="#top" aria-label="CampusFix AI home"><span class="brand-mark">${brandMark}</span><span>CampusFix <em>AI</em></span></a>
      <nav class="topbar-nav" aria-label="Main navigation"><a href="#top">Overview</a><a href="#report-form">Report issue</a><a href="#dashboard">Reports</a></nav>
      <a class="topbar-action" href="#report-form">Report an issue <span aria-hidden="true">↗</span></a>
    </header>
    <main id="top">
      <section class="hero" aria-labelledby="hero-title">
        <div class="hero-copy"><p class="eyebrow"><span class="eyebrow-line"></span> CAMPUS CARE / LOCAL DEMO</p><h1 id="hero-title">Spot an issue.<br><span>Make campus better.</span></h1><p class="hero-description">Add a photo and location, then use a clearly labeled sample scenario to preview a structured maintenance report. Your photo stays here and is not analyzed or uploaded.</p><div class="hero-actions"><a class="hero-link" href="#report-form">Report an issue <span aria-hidden="true">↗</span></a><a class="hero-secondary" href="#dashboard">View reports <span aria-hidden="true">↗</span></a></div><p class="hero-note"><span aria-hidden="true"></span> Demo reports live in this browser session</p></div>
        <div class="hero-art" aria-hidden="true"><div class="art-orbit art-orbit-one"></div><div class="art-orbit art-orbit-two"></div><div class="art-card"><div class="art-card-top"><span class="art-symbol">${brandMark}</span><span>HOW THIS DEMO WORKS</span></div><div class="art-process"><div><b>01</b><span>Add a photo + location</span></div><div><b>02</b><span>Choose a sample scenario</span></div><div><b>03</b><span>Explore a demo report</span></div></div><div class="art-card-bottom"><span>NO PHOTO ANALYSIS</span><span>LOCAL ONLY</span></div></div></div>
      </section>
      <section class="workspace" aria-label="CampusFix demo workspace">
        <div class="section-intro" data-reveal><div><p class="eyebrow">01 / CREATE A REPORT</p><h2>Start with what you see.</h2></div><p>Your photo stays in this browser session. This demo does not analyze uploaded photos or send a report to a facilities team.</p></div>
        <div class="form-layout"><form id="report-form" class="form-card" data-reveal novalidate>
          <div class="form-card-heading"><span class="step-number">01</span><div><h3>Issue details</h3><p>Fields marked <span aria-hidden="true">*</span> are required.</p></div></div>
          <div class="field"><label for="photo">Issue photo <span aria-hidden="true">*</span></label><p class="field-help" id="photo-help">JPEG, PNG, or WebP · up to 8 MB. Preview only; no image analysis in this demo.</p><div class="upload-area" id="upload-area"><input id="photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp" aria-describedby="photo-help photo-error photo-feedback" required /><div id="upload-prompt" class="upload-prompt"><span class="upload-icon" aria-hidden="true">↥</span><strong>Choose a photo</strong><span>or drag and drop it here</span></div><div id="preview-wrap" class="preview-wrap" hidden><img id="preview" alt="Preview of selected issue photo" /><div class="preview-info"><strong id="file-name"></strong><span id="file-size"></span></div><div class="preview-actions"><button type="button" class="text-button" id="replace-photo">Replace</button><button type="button" class="text-button danger" id="remove-photo">Remove</button></div></div></div><p class="field-error" id="photo-error" aria-live="polite"></p><p class="photo-feedback" id="photo-feedback" role="status" aria-live="polite"></p></div>
          <div class="field"><label for="location">Building or location <span aria-hidden="true">*</span></label><input id="location" name="location" type="text" maxlength="120" placeholder="e.g. Library south entrance" aria-describedby="location-help location-error" required /><p class="field-help" id="location-help">Be specific enough to help someone find it.</p><p class="field-error" id="location-error" aria-live="polite"></p></div>
          <div class="field"><label for="notes">Additional notes <span class="optional">Optional</span></label><textarea id="notes" name="notes" maxlength="500" rows="3" placeholder="Anything useful to know about this spot?"></textarea></div>
          <div class="scenario-box"><div class="scenario-heading"><span class="scenario-icon" aria-hidden="true">02</span><div><h4>Demo scenario</h4><p>Choose a predefined example. Report details come from this choice, not your photo.</p></div></div><label for="scenario">Sample issue</label><select id="scenario" name="scenario">${Object.entries(scenarios).map(([key, scenario]) => `<option value="${key}">${scenario.label}</option>`).join('')}</select><p id="scenario-summary" class="scenario-summary"></p></div>
          <button class="submit-button" type="submit"><span class="submit-label">Generate sample report</span><span class="submit-indicator" aria-hidden="true">↗</span></button><p id="form-message" class="form-message" role="status" aria-live="polite"></p>
        </form><aside class="side-panel" data-reveal aria-label="How this demo works"><div class="side-panel-top"><span class="side-kicker">THE PROCESS</span><span class="side-index">/ 03</span></div><div class="process-item"><span>01</span><div><h4>Add the context</h4><p>Choose a photo and pinpoint a campus location.</p></div></div><div class="process-item"><span>02</span><div><h4>Pick an example</h4><p>Select the sample issue used to fill the report.</p></div></div><div class="process-item"><span>03</span><div><h4>Explore the dashboard</h4><p>Review its score and move it through the status workflow.</p></div></div><div class="side-panel-footer"><span class="side-panel-mark">${brandMark}</span><p>Built for a campus that keeps improving.</p></div></aside></div>
      </section>
      <section class="dashboard" id="dashboard" aria-labelledby="dashboard-title"><div class="section-intro dashboard-intro" data-reveal><div><p class="eyebrow">02 / THE DASHBOARD</p><h2 id="dashboard-title">A shared view of what matters.</h2></div><p>Reports live in memory during this demo. Refreshing the page clears them.</p></div><div class="stats" id="stats" data-reveal></div><div class="dashboard-toolbar" data-reveal><div><h3>Reports <span id="report-total"></span></h3><p>Campus Attention Score is a demo triage aid, not a validated safety assessment.</p><p id="dashboard-feedback" class="dashboard-feedback" role="status" aria-live="polite"></p></div><div class="toolbar-controls"><label for="status-filter">Status <select id="status-filter"><option>All</option>${statuses.map((status) => `<option>${status}</option>`).join('')}</select></label><label for="score-sort">Sort by score <select id="score-sort"><option value="highest">Highest first</option><option value="lowest">Lowest first</option></select></label></div></div><div id="reports" class="reports" data-reveal aria-live="polite"></div></section>
    </main><footer><span class="footer-brand"><span class="footer-mark">${brandMark}</span>CampusFix AI</span><span>Local demo · Campus care starts with a clear report</span></footer>
  </div>`;

const form = document.querySelector('#report-form');
const fileInput = document.querySelector('#photo');
const uploadArea = document.querySelector('#upload-area');
const locationInput = document.querySelector('#location');
const scenarioSelect = document.querySelector('#scenario');
const reportsEl = document.querySelector('#reports');
const submitButton = form.querySelector('.submit-button');
const dashboardFeedback = document.querySelector('#dashboard-feedback');
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

if (!reduceMotion.matches && 'IntersectionObserver' in window) {
  document.documentElement.classList.add('motion-ready');
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    }
  }, { threshold: 0.08 });
  document.querySelectorAll('[data-reveal]').forEach((element) => observer.observe(element));
}

function setError(field, message) {
  document.querySelector(`#${field}-error`).textContent = message;
  document.querySelector(`#${field}`).setAttribute('aria-invalid', String(Boolean(message)));
}
function clearPreview() {
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = null;
  selectedFile = null;
  fileInput.value = '';
  document.querySelector('#preview-wrap').hidden = true;
  document.querySelector('#upload-prompt').hidden = false;
  uploadArea.classList.remove('has-image');
}
function acceptFile(file) {
  if (!file) return;
  const photoFeedback = document.querySelector('#photo-feedback');
  if (!allowedTypes.has(file.type)) { clearPreview(); photoFeedback.textContent = ''; setError('photo', 'Choose a JPEG, PNG, or WebP image.'); return; }
  if (file.size > MAX_FILE_SIZE) { clearPreview(); photoFeedback.textContent = ''; setError('photo', 'This photo is too large. Choose an image under 8 MB.'); return; }
  if (file.size === 0) { clearPreview(); photoFeedback.textContent = ''; setError('photo', 'This file is empty. Choose another photo.'); return; }
  clearPreview();
  selectedFile = file;
  previewUrl = URL.createObjectURL(file);
  document.querySelector('#preview').src = previewUrl;
  document.querySelector('#file-name').textContent = file.name;
  document.querySelector('#file-size').textContent = `${(file.size / 1024 / 1024).toFixed(2)} MB`;
  document.querySelector('#upload-prompt').hidden = true;
  document.querySelector('#preview-wrap').hidden = false;
  uploadArea.classList.add('has-image');
  setError('photo', '');
  photoFeedback.textContent = 'Photo ready for this local preview.';
}
fileInput.addEventListener('change', () => acceptFile(fileInput.files[0]));
document.querySelector('#replace-photo').addEventListener('click', () => {
  uploadArea.classList.add('responding');
  document.querySelector('#photo-feedback').textContent = 'Choose a replacement photo.';
  window.setTimeout(() => uploadArea.classList.remove('responding'), 260);
  fileInput.click();
});
document.querySelector('#remove-photo').addEventListener('click', () => {
  clearPreview(); setError('photo', '');
  document.querySelector('#photo-feedback').textContent = 'Photo removed. Choose another to make a sample report.';
  uploadArea.classList.add('responding');
  window.setTimeout(() => uploadArea.classList.remove('responding'), 260);
  fileInput.focus();
});
uploadArea.addEventListener('dragenter', (event) => { event.preventDefault(); dragDepth += 1; uploadArea.classList.add('dragging'); });
uploadArea.addEventListener('dragover', (event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; });
uploadArea.addEventListener('dragleave', (event) => { event.preventDefault(); dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) uploadArea.classList.remove('dragging'); });
uploadArea.addEventListener('drop', (event) => { event.preventDefault(); dragDepth = 0; uploadArea.classList.remove('dragging'); acceptFile(event.dataTransfer.files[0]); });
locationInput.addEventListener('input', () => { if (locationInput.value.trim()) setError('location', ''); });
function updateScenarioSummary() { const scenario = scenarios[scenarioSelect.value]; document.querySelector('#scenario-summary').textContent = `${scenario.category} · ${scenario.severity} severity · Score ${calculateScore(scenario)}/100`; }
scenarioSelect.addEventListener('change', updateScenarioSummary);
updateScenarioSummary();

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (isPreparing) return;
  let valid = true;
  if (!selectedFile) { setError('photo', 'Add a photo to create a sample report.'); valid = false; }
  if (!locationInput.value.trim()) { setError('location', 'Enter a building or location.'); valid = false; }
  if (!valid) { (selectedFile ? locationInput : fileInput).focus(); return; }
  const report = createDemoReport({ scenarioKey: scenarioSelect.value, location: locationInput.value, notes: document.querySelector('#notes').value });
  isPreparing = true;
  submitButton.disabled = true;
  submitButton.classList.add('is-preparing');
  submitButton.querySelector('.submit-label').textContent = 'Preparing demo report';
  document.querySelector('#form-message').textContent = 'Preparing a demo report from the selected scenario. No photo analysis is taking place.';
  await new Promise((resolve) => window.setTimeout(resolve, reduceMotion.matches ? 0 : 420));
  reports = [report, ...reports];
  renderReports({ animateId: report.id });
  document.querySelector('#form-message').textContent = 'Sample report added to the dashboard. No photo analysis was performed.';
  dashboardFeedback.textContent = 'Sample demo report added. No photo analysis was performed.';
  form.reset(); clearPreview(); setError('photo', ''); setError('location', ''); updateScenarioSummary();
  document.querySelector('#photo-feedback').textContent = '';
  submitButton.disabled = false;
  submitButton.classList.remove('is-preparing');
  submitButton.querySelector('.submit-label').textContent = 'Generate sample report';
  isPreparing = false;
  document.querySelector('#dashboard').scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth' });
});

document.querySelector('#status-filter').addEventListener('change', (event) => { filter = event.target.value; lastStatusChangeId = null; renderReports({ animateList: true }); dashboardFeedback.textContent = `Showing ${filter === 'All' ? 'all' : filter.toLowerCase()} demo reports.`; });
document.querySelector('#score-sort').addEventListener('change', (event) => { sort = event.target.value; lastStatusChangeId = null; renderReports({ animateList: true }); dashboardFeedback.textContent = `Demo reports sorted by score, ${sort === 'highest' ? 'highest' : 'lowest'} first.`; });
reportsEl.addEventListener('change', (event) => {
  if (!event.target.matches('[data-status-id]')) return;
  const { statusId } = event.target.dataset;
  const status = event.target.value;
  reports = updateReportStatus(reports, statusId, status);
  lastStatusChangeId = statusId;
  renderReports();
  const updatedControl = [...reportsEl.querySelectorAll('[data-status-id]')].find((control) => control.dataset.statusId === statusId);
  (updatedControl || document.querySelector('#status-filter')).focus({ preventScroll: true });
  dashboardFeedback.textContent = `Demo report status changed to ${status}. This does not notify a facilities team.`;
});
reportsEl.addEventListener('click', (event) => {
  const summary = event.target.closest('.score-explainer summary');
  if (!summary) return;
  event.preventDefault();
  const details = summary.parentElement;
  if (reduceMotion.matches) { details.open = !details.open; return; }
  if (details.classList.contains('is-closing')) {
    window.clearTimeout(details.closeTimer);
    details.classList.remove('is-closing');
  } else if (details.open) {
    details.classList.add('is-closing');
    details.closeTimer = window.setTimeout(() => { details.open = false; details.classList.remove('is-closing'); }, 190);
  } else {
    details.open = true;
    details.classList.add('is-opening');
    void details.querySelector('.score-breakdown').offsetHeight;
    details.classList.remove('is-opening');
  }
});
function renderScoreBreakdown(report) {
  const scenario = scenarios[report.scenarioKey];
  const points = scoreBreakdown(scenario);
  return `<p>Predefined points for the ${escapeHtml(scenario.label)} demo scenario:</p><dl><div><dt>${escapeHtml(scenario.severity)} severity</dt><dd>+${points.severity}</dd></div><div><dt>Hazard ${scenario.hazard ? 'present' : 'absent'}</dt><dd>+${points.hazard}</dd></div><div><dt>Recurring issue ${scenario.recurring ? 'yes' : 'no'}</dt><dd>+${points.recurring}</dd></div><div class="score-total"><dt>Total (capped at 100)</dt><dd>${points.total}</dd></div></dl><p>This is a demo triage aid, not a validated safety assessment. The photo and notes do not affect the score.</p>`;
}
function renderReports({ animateId = null, animateList = false } = {}) {
  const openIds = new Set([...reportsEl.querySelectorAll('.score-explainer[open]')].map((details) => details.dataset.reportId));
  const counts = Object.fromEntries(statuses.map((status) => [status, reports.filter((report) => report.status === status).length]));
  const statsEl = document.querySelector('#stats');
  const statsHtml = `<div class="stat"><span>Total reports</span><strong>${reports.length}</strong><small>Submitted this session</small></div><div class="stat"><span>Open</span><strong>${counts.Open}</strong><small>Awaiting attention</small></div><div class="stat"><span>In progress</span><strong>${counts['In progress']}</strong><small>Being addressed</small></div><div class="stat"><span>Resolved</span><strong>${counts.Resolved}</strong><small>Marked complete</small></div>`;
  if (statsEl.innerHTML !== statsHtml) statsEl.innerHTML = statsHtml;
  document.querySelector('#report-total').textContent = `(${reports.length})`;
  const visible = selectReports(reports, { status: filter, sort });
  if (!visible.length) {
    reportsEl.innerHTML = reports.length ? `<div class="empty-state"><span aria-hidden="true">⌕</span><h4>No reports match this filter.</h4><p>Try another status to see your sample reports.</p></div>` : `<div class="empty-state"><span class="empty-mark">${brandMark}</span><h4>No reports yet.</h4><p>Add a photo and location above to create your first sample report.</p><a href="#report-form">Create a sample report ↗</a></div>`;
  } else {
    reportsEl.innerHTML = visible.map((report) => `<article class="report-card${report.id === animateId && !reduceMotion.matches ? ' is-new' : ''}" data-report-id="${escapeHtml(report.id)}"><div class="report-main"><div class="report-meta"><span class="category-pill">${escapeHtml(report.category)}</span><span class="report-date">${new Date(report.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span></div><h4>${escapeHtml(report.title)}</h4><p class="report-location"><span aria-hidden="true">⌖</span> ${escapeHtml(report.location)}</p><div class="report-detail"><span>Description</span><p>${escapeHtml(report.description)}</p></div>${report.notes ? `<div class="report-detail"><span>Your notes</span><p>${escapeHtml(report.notes)}</p></div>` : ''}<div class="report-detail"><span>Recommended action</span><p>${escapeHtml(report.action)}</p></div></div><div class="report-side"><div class="score"><span>Campus Attention Score</span><strong aria-label="${report.score} out of 100"><span class="score-value" aria-hidden="true">${report.id === animateId && !reduceMotion.matches ? 0 : report.score}</span><small aria-hidden="true">/100</small></strong><div class="score-meter" role="meter" aria-label="Campus Attention Score" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${report.score}"><span class="score-meter-fill" style="width: ${report.id === animateId && !reduceMotion.matches ? 0 : report.score}%"></span></div><em>Demo triage aid · not a validated safety assessment</em><details class="score-explainer" data-report-id="${escapeHtml(report.id)}"${openIds.has(report.id) ? ' open' : ''}><summary>How is this score calculated?</summary><div class="score-breakdown">${renderScoreBreakdown(report)}</div></details></div><div class="severity"><span>Severity</span><strong>${escapeHtml(report.severity)}</strong></div><span class="status-badge status-${report.status.toLowerCase().replaceAll(' ', '-')}">${escapeHtml(report.status)}</span><label class="status-control">Status<select data-status-id="${escapeHtml(report.id)}" aria-label="Status for ${escapeHtml(report.title)} at ${escapeHtml(report.location)}">${statuses.map((status) => `<option${report.status === status ? ' selected' : ''}>${status}</option>`).join('')}</select></label>${lastStatusChangeId === report.id ? '<span class="status-confirmation">Updated in this demo</span>' : ''}</div></article>`).join('');
  }
  if (animateId && !reduceMotion.matches) {
    const card = [...reportsEl.querySelectorAll('.report-card')].find((element) => element.dataset.reportId === animateId);
    if (card) {
      const value = card.querySelector('.score-value');
      const meter = card.querySelector('.score-meter-fill');
      const target = reports.find((report) => report.id === animateId).score;
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => { meter.style.width = `${target}%`; }));
      let start;
      const count = (time) => {
        if (!value.isConnected) return;
        start ??= time;
        const progress = Math.min(1, (time - start) / 650);
        const eased = 1 - (1 - progress) ** 3;
        value.textContent = String(Math.round(target * eased));
        if (progress < 1) window.requestAnimationFrame(count);
        else value.textContent = String(target);
      };
      window.requestAnimationFrame(count);
    }
  }
  if (animateList && !reduceMotion.matches) {
    reportsEl.classList.remove('list-refresh');
    void reportsEl.offsetWidth;
    reportsEl.classList.add('list-refresh');
  }
}
renderReports();
