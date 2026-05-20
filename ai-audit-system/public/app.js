const callIndustrySelect = document.querySelector('#callIndustrySelect');
const industrySelect = document.querySelector('#industrySelect');
const businessNameInput = document.querySelector('#businessNameInput');
const contactNameInput = document.querySelector('#contactNameInput');
const phoneNumberInput = document.querySelector('#phoneNumberInput');
const callForm = document.querySelector('#callForm');
const startCallButton = document.querySelector('#startCallButton');
const refreshCallsButton = document.querySelector('#refreshCallsButton');
const callList = document.querySelector('#callList');
const callCount = document.querySelector('#callCount');
const transcriptInput = document.querySelector('#transcriptInput');
const auditForm = document.querySelector('#auditForm');
const generateButton = document.querySelector('#generateButton');
const sampleButton = document.querySelector('#sampleButton');
const copyButton = document.querySelector('#copyButton');
const serviceStatus = document.querySelector('#serviceStatus');
const reportMeta = document.querySelector('#reportMeta');
const emptyState = document.querySelector('#emptyState');
const errorState = document.querySelector('#errorState');
const reportOutput = document.querySelector('#reportOutput');

let lastAudit = null;

const samples = {
  trades: `Agent: Walk me through what happens when a new lead calls after hours.
Client: If they call after 5pm it goes to voicemail. We try to call back the next morning, but honestly some get missed.
Agent: How are bookings and follow-ups tracked?
Client: The office manager has a spreadsheet and some notes in ServiceTitan. Estimates are followed up when she remembers.
Agent: Do technicians offer maintenance plans?
Client: Only our senior tech does it consistently. We probably sell plans on 8 percent of jobs.
Agent: How do reviews get requested?
Client: Usually by text if the customer seemed happy, but it is not automatic.`,
  realtors: `Agent: How do new buyer or seller leads come in today?
Client: Mostly Zillow, referrals, and Facebook. I respond fast if I see the notification, but there is no central system.
Agent: What happens after the first conversation?
Client: I add them to my phone and sometimes send listings manually. Follow-up drops off if they are not ready now.
Agent: Do you have a nurture sequence?
Client: No, just calendar reminders when I remember.`,
  lawn_care: `Agent: How do quote requests arrive?
Client: Calls, website forms, and Facebook messages. We write addresses on a whiteboard.
Agent: How quickly do you respond?
Client: Same day when things are slow. During spring rush it can be two or three days.
Agent: Do you upsell recurring service?
Client: We mention it, but there is no standard script or follow-up.`
};

async function init() {
  await Promise.all([loadIndustries(), checkHealth(), loadCalls()]);
}

async function checkHealth() {
  try {
    const response = await fetch('/health');
    if (!response.ok) throw new Error('Health check failed');
    serviceStatus.textContent = 'API Online';
    serviceStatus.classList.add('ok');
  } catch (_err) {
    serviceStatus.textContent = 'API Offline';
    serviceStatus.classList.add('bad');
  }
}

async function loadIndustries() {
  try {
    const response = await fetch('/industries');
    if (!response.ok) throw new Error('Could not load industries');
    const { industries } = await response.json();
    const options = industries
      .map((industry) => `<option value="${escapeHtml(industry)}">${formatLabel(industry)}</option>`)
      .join('');
    industrySelect.innerHTML = options;
    callIndustrySelect.innerHTML = options;
  } catch (err) {
    industrySelect.innerHTML = '<option value="">Industries unavailable</option>';
    callIndustrySelect.innerHTML = '<option value="">Industries unavailable</option>';
    showError(err.message);
  }
}

refreshCallsButton.addEventListener('click', loadCalls);

callForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearError();

  const industry = callIndustrySelect.value;
  const phoneNumber = phoneNumberInput.value.trim();
  if (!industry || !phoneNumber) {
    showError('Choose an industry and enter the business phone number.');
    return;
  }

  setCallLoading(true);
  try {
    const response = await fetch('/voice/call', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        industry,
        businessName: businessNameInput.value.trim(),
        contactName: contactNameInput.value.trim(),
        phoneNumber,
      }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'Phone audit call failed');

    await loadCalls();
    reportMeta.textContent = `Call started - ${payload.call.callId}`;
  } catch (err) {
    showError(err.message);
  } finally {
    setCallLoading(false);
  }
});

sampleButton.addEventListener('click', () => {
  const industry = industrySelect.value || 'trades';
  industrySelect.value = industry;
  transcriptInput.value = samples[industry] || samples.trades;
});

auditForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearError();

  const industry = industrySelect.value;
  const transcript = transcriptInput.value.trim();
  if (!industry || !transcript) {
    showError('Choose an industry and paste a transcript first.');
    return;
  }

  setLoading(true);
  try {
    const response = await fetch('/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ industry, transcript }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'Audit generation failed');

    lastAudit = payload;
    renderReport(payload);
  } catch (err) {
    showError(err.message);
  } finally {
    setLoading(false);
  }
});

copyButton.addEventListener('click', async () => {
  if (!lastAudit) return;
  await navigator.clipboard.writeText(JSON.stringify(lastAudit, null, 2));
  copyButton.textContent = 'Copied';
  setTimeout(() => {
    copyButton.textContent = 'Copy JSON';
  }, 1400);
});

async function loadCalls() {
  try {
    const response = await fetch('/voice/calls');
    if (!response.ok) throw new Error('Could not load recent calls');
    const { calls } = await response.json();
    renderCalls(calls);
  } catch (err) {
    showError(err.message);
  }
}

function renderCalls(calls = []) {
  callCount.textContent = String(calls.length);
  if (!calls.length) {
    callList.innerHTML = '<div class="empty-state compact">No calls tracked in this server session.</div>';
    return;
  }

  callList.innerHTML = calls.map((call) => `
    <div class="call-card">
      <div class="call-title">
        <strong>${escapeHtml(call.businessName || call.contactName || call.phoneNumber || 'Phone audit')}</strong>
        <span class="status-tag ${call.report ? 'ready' : ''}">${escapeHtml(formatLabel(call.status || 'started'))}</span>
      </div>
      <p>${escapeHtml(formatLabel(call.industry || 'unknown'))} - ${escapeHtml(call.phoneNumber || call.callId)}</p>
      ${call.report ? `<button class="secondary-button" type="button" data-call-id="${escapeHtml(call.callId)}">View Report</button>` : ''}
    </div>
  `).join('');

  callList.querySelectorAll('[data-call-id]').forEach((button) => {
    button.addEventListener('click', () => loadCallReport(button.dataset.callId));
  });
}

async function loadCallReport(callId) {
  clearError();
  try {
    const response = await fetch(`/voice/calls/${encodeURIComponent(callId)}`);
    const { call } = await response.json();
    if (!response.ok) throw new Error('Could not load call report');
    if (!call.report) throw new Error('That call does not have a report yet.');

    lastAudit = {
      auditId: call.callId,
      industry: call.industry,
      report: call.report,
    };
    renderReport(lastAudit);
  } catch (err) {
    showError(err.message);
  }
}

function renderReport(payload) {
  const { auditId, industry, report } = payload;
  emptyState.hidden = true;
  reportOutput.hidden = false;
  copyButton.disabled = false;
  reportMeta.textContent = `${formatLabel(industry)} audit - ${auditId}`;

  reportOutput.innerHTML = [
    renderScores(report),
    renderListBlock('Key Strengths', report.keyStrengths),
    renderListBlock('Critical Gaps', report.criticalGaps),
    renderSections(report.sections),
    renderActionPlan(report.actionPlan),
  ].join('');
}

function renderScores(report) {
  const scores = report.scores || {};
  const metrics = Object.entries(scores).map(([label, value]) => `
    <div class="metric">
      <span>${escapeHtml(formatLabel(label))}</span>
      <strong>${escapeHtml(String(value))}/10</strong>
    </div>
  `).join('');

  return `
    <section class="score-row" aria-label="Audit scores">
      <div class="score-badge">
        <strong>${escapeHtml(String(report.overallScore ?? '-'))}</strong>
        <span>/10</span>
      </div>
      <div class="score-grid">${metrics || '<p>No dimension scores returned.</p>'}</div>
    </section>
  `;
}

function renderListBlock(title, items = []) {
  if (!Array.isArray(items) || items.length === 0) return '';
  return `
    <section class="list-block">
      <h3>${escapeHtml(title)}</h3>
      <ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
    </section>
  `;
}

function renderSections(sections = {}) {
  return Object.entries(sections).map(([title, body]) => `
    <section class="report-section">
      <h3>${escapeHtml(formatLabel(title))}</h3>
      <p>${formatMarkdownLite(String(body))}</p>
    </section>
  `).join('');
}

function renderActionPlan(actions = []) {
  if (!Array.isArray(actions) || actions.length === 0) return '';
  const items = actions.map((item) => `
    <div class="action-item">
      <div class="priority">${escapeHtml(item.priority || 'next')}</div>
      <p><strong>${escapeHtml(item.action || 'Action needed')}</strong></p>
      <p>${escapeHtml(item.timeframe || 'Set timeframe')}</p>
    </div>
  `).join('');

  return `
    <section>
      <h3>Action Plan</h3>
      <div class="action-list">${items}</div>
    </section>
  `;
}

function setLoading(isLoading) {
  generateButton.disabled = isLoading;
  generateButton.textContent = isLoading ? 'Generating...' : 'Generate Audit';
}

function setCallLoading(isLoading) {
  startCallButton.disabled = isLoading;
  startCallButton.textContent = isLoading ? 'Starting...' : 'Start Phone Audit';
}

function showError(message) {
  errorState.textContent = message;
  errorState.hidden = false;
}

function clearError() {
  errorState.hidden = true;
  errorState.textContent = '';
}

function formatLabel(value) {
  return String(value)
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatMarkdownLite(value) {
  return escapeHtml(value).replace(/\n/g, '<br>');
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

init();
