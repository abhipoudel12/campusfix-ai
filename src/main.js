import './styles.css';
import { calculateScore, createDemoReport, scenarios, statuses, updateReportStatus, selectReports } from './demo.js';

const MAX_FILE_SIZE = 8 * 1024 * 1024;
const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
let reports = [];
let selectedFile = null;
let previewUrl = null;
let filter = 'All';
let sort = 'highest';

const app = document.querySelector('#app');
app.innerHTML = `
  <div class="site-shell">
    <header class="topbar">
      <a class="brand" href="#top" aria-label="CampusFix AI home"><span class="brand-mark" aria-hidden="true">✳</span><span>CampusFix <em>AI</em></span></a>
      <span class="topbar-tag">LOCAL FRONTEND DEMO</span>
    </header>
    <main id="top">
      <section class="hero" aria-labelledby="hero-title">
        <div class="hero-copy"><p class="eyebrow"><span class="eyebrow-line"></span> A clearer path to campus care</p><h1 id="hero-title">Notice it.<br><span>Report it.</span><br>Make it better.</h1><p class="hero-description">Give campus maintenance concerns a clear starting point. Add a photo and location, then explore how a structured report could help teams prioritize what needs attention.</p><a class="hero-link" href="#report-form">Create a sample report <span aria-hidden="true">↗</span></a></div>
        <div class="hero-art" aria-hidden="true"><div class="art-grid"></div><div class="art-circle art-circle-one"></div><div class="art-circle art-circle-two"></div><div class="art-card"><div class="art-card-top"><span class="art-symbol">✳</span><span>FIELD NOTE / 001</span></div><div class="art-lines"><i></i><i></i><i></i></div><div class="art-card-bottom"><span>SEE SOMETHING</span><span>→</span></div></div><div class="art-label">CAMPUS / CARE / COMMUNITY</div></div>
      </section>
      <section class="workspace" aria-label="CampusFix demo workspace">
        <div class="section-intro"><div><p class="eyebrow">01 / CREATE A REPORT</p><h2>Start with what you see.</h2></div><p>Your photo stays in this browser session. This demo does not analyze uploaded photos or send a report to a facilities team.</p></div>
        <div class="form-layout"><form id="report-form" class="form-card" novalidate>
          <div class="form-card-heading"><span class="step-number">01</span><div><h3>Issue details</h3><p>Fields marked <span aria-hidden="true">*</span> are required.</p></div></div>
          <div class="field"><label for="photo">Issue photo <span aria-hidden="true">*</span></label><p class="field-help" id="photo-help">JPEG, PNG, or WebP · up to 8 MB. Preview only; no image analysis in this demo.</p><div class="upload-area" id="upload-area"><input id="photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp" aria-describedby="photo-help photo-error" required /><div id="upload-prompt" class="upload-prompt"><span class="upload-icon" aria-hidden="true">↥</span><strong>Choose a photo</strong><span>or drag and drop it here</span></div><div id="preview-wrap" class="preview-wrap" hidden><img id="preview" alt="Preview of selected issue photo" /><div class="preview-info"><strong id="file-name"></strong><span id="file-size"></span></div><div class="preview-actions"><button type="button" class="text-button" id="replace-photo">Replace</button><button type="button" class="text-button danger" id="remove-photo">Remove</button></div></div></div><p class="field-error" id="photo-error" aria-live="polite"></p></div>
          <div class="field"><label for="location">Building or location <span aria-hidden="true">*</span></label><input id="location" name="location" type="text" maxlength="120" placeholder="e.g. Library south entrance" aria-describedby="location-help location-error" required /><p class="field-help" id="location-help">Be specific enough to help someone find it.</p><p class="field-error" id="location-error" aria-live="polite"></p></div>
          <div class="field"><label for="notes">Additional notes <span class="optional">Optional</span></label><textarea id="notes" name="notes" maxlength="500" rows="3" placeholder="Anything useful to know about this spot?"></textarea></div>
          <div class="scenario-box"><div class="scenario-heading"><span class="scenario-icon" aria-hidden="true">✦</span><div><h4>Demo scenario</h4><p>Choose a predefined example. Report details come from this choice, not your photo.</p></div></div><label for="scenario">Sample issue</label><select id="scenario" name="scenario">${Object.entries(scenarios).map(([key, scenario]) => `<option value="${key}">${scenario.label}</option>`).join('')}</select><p id="scenario-summary" class="scenario-summary"></p></div>
          <button class="submit-button" type="submit">Generate sample report <span aria-hidden="true">↗</span></button><p id="form-message" class="form-message" role="status" aria-live="polite"></p>
        </form><aside class="side-panel" aria-label="How this demo works"><div class="side-panel-top"><span class="side-kicker">THE PROCESS</span><span class="side-index">/ 03</span></div><div class="process-item"><span>01</span><div><h4>Add the context</h4><p>Choose a photo and pinpoint a campus location.</p></div></div><div class="process-item"><span>02</span><div><h4>Pick an example</h4><p>Select the sample issue used to fill the report.</p></div></div><div class="process-item"><span>03</span><div><h4>Explore the dashboard</h4><p>Review its score and move it through the status workflow.</p></div></div><div class="side-panel-footer"><span aria-hidden="true">✳</span><p>Built for a campus that keeps improving.</p></div></aside></div>
      </section>
      <section class="dashboard" id="dashboard" aria-labelledby="dashboard-title"><div class="section-intro dashboard-intro"><div><p class="eyebrow">02 / THE DASHBOARD</p><h2 id="dashboard-title">A shared view of what matters.</h2></div><p>Reports live in memory during this demo. Refreshing the page clears them.</p></div><div class="stats" id="stats"></div><div class="dashboard-toolbar"><div><h3>Reports <span id="report-total"></span></h3><p>Campus Attention Score is a demo triage aid, not a validated safety assessment.</p></div><div class="toolbar-controls"><label for="status-filter">Status <select id="status-filter"><option>All</option>${statuses.map((status) => `<option>${status}</option>`).join('')}</select></label><label for="score-sort">Sort by score <select id="score-sort"><option value="highest">Highest first</option><option value="lowest">Lowest first</option></select></label></div></div><div id="reports" class="reports" aria-live="polite"></div></section>
    </main><footer><span class="footer-brand">✳ CampusFix AI</span><span>Local demo · Campus care starts with a clear report</span></footer>
  </div>`;

const form = document.querySelector('#report-form');
const fileInput = document.querySelector('#photo');
const uploadArea = document.querySelector('#upload-area');
const locationInput = document.querySelector('#location');
const scenarioSelect = document.querySelector('#scenario');
const reportsEl = document.querySelector('#reports');
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

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
  if (!allowedTypes.has(file.type)) { clearPreview(); setError('photo', 'Choose a JPEG, PNG, or WebP image.'); return; }
  if (file.size > MAX_FILE_SIZE) { clearPreview(); setError('photo', 'This photo is too large. Choose an image under 8 MB.'); return; }
  if (file.size === 0) { clearPreview(); setError('photo', 'This file is empty. Choose another photo.'); return; }
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
}
fileInput.addEventListener('change', () => acceptFile(fileInput.files[0]));
document.querySelector('#replace-photo').addEventListener('click', () => fileInput.click());
document.querySelector('#remove-photo').addEventListener('click', () => { clearPreview(); setError('photo', ''); fileInput.focus(); });
for (const eventName of ['dragenter', 'dragover']) uploadArea.addEventListener(eventName, (event) => { event.preventDefault(); uploadArea.classList.add('dragging'); });
for (const eventName of ['dragleave', 'drop']) uploadArea.addEventListener(eventName, (event) => { event.preventDefault(); uploadArea.classList.remove('dragging'); });
uploadArea.addEventListener('drop', (event) => acceptFile(event.dataTransfer.files[0]));
locationInput.addEventListener('input', () => { if (locationInput.value.trim()) setError('location', ''); });
function updateScenarioSummary() { const scenario = scenarios[scenarioSelect.value]; document.querySelector('#scenario-summary').textContent = `${scenario.category} · ${scenario.severity} severity · Score ${calculateScore(scenario)}/100`; }
scenarioSelect.addEventListener('change', updateScenarioSummary);
updateScenarioSummary();

form.addEventListener('submit', (event) => {
  event.preventDefault();
  let valid = true;
  if (!selectedFile) { setError('photo', 'Add a photo to create a sample report.'); valid = false; }
  if (!locationInput.value.trim()) { setError('location', 'Enter a building or location.'); valid = false; }
  if (!valid) { (selectedFile ? locationInput : fileInput).focus(); return; }
  const report = createDemoReport({ scenarioKey: scenarioSelect.value, location: locationInput.value, notes: document.querySelector('#notes').value });
  reports = [report, ...reports];
  renderReports();
  document.querySelector('#form-message').textContent = 'Sample report added to the dashboard. No photo analysis was performed.';
  form.reset(); clearPreview(); setError('photo', ''); setError('location', ''); updateScenarioSummary();
  document.querySelector('#dashboard').scrollIntoView({ behavior: 'smooth' });
});

document.querySelector('#status-filter').addEventListener('change', (event) => { filter = event.target.value; renderReports(); });
document.querySelector('#score-sort').addEventListener('change', (event) => { sort = event.target.value; renderReports(); });
reportsEl.addEventListener('change', (event) => {
  if (!event.target.matches('[data-status-id]')) return;
  reports = updateReportStatus(reports, event.target.dataset.statusId, event.target.value);
  renderReports();
  document.querySelector('#dashboard-announcement').textContent = `Report status changed to ${event.target.value}.`;
});
function renderReports() {
  const counts = Object.fromEntries(statuses.map((status) => [status, reports.filter((report) => report.status === status).length]));
  document.querySelector('#stats').innerHTML = `<div class="stat"><span>Total reports</span><strong>${reports.length}</strong><small>Submitted this session</small></div><div class="stat"><span>Open</span><strong>${counts.Open}</strong><small>Awaiting attention</small></div><div class="stat"><span>In progress</span><strong>${counts['In progress']}</strong><small>Being addressed</small></div><div class="stat"><span>Resolved</span><strong>${counts.Resolved}</strong><small>Marked complete</small></div>`;
  document.querySelector('#report-total').textContent = `(${reports.length})`;
  const visible = selectReports(reports, { status: filter, sort });
  if (!visible.length) {
    reportsEl.innerHTML = reports.length ? `<div class="empty-state"><span aria-hidden="true">⌕</span><h4>No reports match this filter.</h4><p>Try another status to see your sample reports.</p></div>` : `<div class="empty-state"><span aria-hidden="true">✳</span><h4>No reports yet.</h4><p>Add a photo and location above to create your first sample report.</p><a href="#report-form">Create a sample report ↗</a></div>`;
  } else {
    reportsEl.innerHTML = visible.map((report) => `<article class="report-card"><div class="report-main"><div class="report-meta"><span class="category-pill">${escapeHtml(report.category)}</span><span class="report-date">${new Date(report.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span></div><h4>${escapeHtml(report.title)}</h4><p class="report-location"><span aria-hidden="true">⌖</span> ${escapeHtml(report.location)}</p><div class="report-detail"><span>Description</span><p>${escapeHtml(report.description)}</p></div>${report.notes ? `<div class="report-detail"><span>Your notes</span><p>${escapeHtml(report.notes)}</p></div>` : ''}<div class="report-detail"><span>Recommended action</span><p>${escapeHtml(report.action)}</p></div></div><div class="report-side"><div class="score"><span>Campus Attention Score</span><strong>${report.score}<small>/100</small></strong><em>Demo triage aid</em></div><div class="severity"><span>Severity</span><strong>${escapeHtml(report.severity)}</strong></div><label class="status-control">Status<select data-status-id="${escapeHtml(report.id)}" aria-label="Status for ${escapeHtml(report.title)} at ${escapeHtml(report.location)}">${statuses.map((status) => `<option${report.status === status ? ' selected' : ''}>${status}</option>`).join('')}</select></label></div></article>`).join('');
  }
  if (!document.querySelector('#dashboard-announcement')) reportsEl.insertAdjacentHTML('afterend', '<p id="dashboard-announcement" class="sr-only" role="status" aria-live="polite"></p>');
}
renderReports();
