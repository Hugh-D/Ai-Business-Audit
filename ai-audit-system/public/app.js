const callIndustrySelect = document.querySelector('#callIndustrySelect');
const industrySelect = document.querySelector('#industrySelect');
const businessNameInput = document.querySelector('#businessNameInput');
const contactNameInput = document.querySelector('#contactNameInput');
const phoneNumberInput = document.querySelector('#phoneNumberInput');
const callForm = document.querySelector('#callForm');
const startCallButton = document.querySelector('#startCallButton');
const refreshCallsButton = document.querySelector('#refreshCallsButton');
const refreshReadinessButton = document.querySelector('#refreshReadinessButton');
const readinessSummary = document.querySelector('#readinessSummary');
const readinessChecks = document.querySelector('#readinessChecks');
const readinessNextSteps = document.querySelector('#readinessNextSteps');
const callList = document.querySelector('#callList');
const callCount = document.querySelector('#callCount');
const transcriptInput = document.querySelector('#transcriptInput');
const auditForm = document.querySelector('#auditForm');
const generateButton = document.querySelector('#generateButton');
const sampleButton = document.querySelector('#sampleButton');
const copyButton = document.querySelector('#copyButton');
const sheetButton = document.querySelector('#sheetButton');
const printButton = document.querySelector('#printButton');
const serviceStatus = document.querySelector('#serviceStatus');
const reportMeta = document.querySelector('#reportMeta');
const emptyState = document.querySelector('#emptyState');
const errorState = document.querySelector('#errorState');
const reportOutput = document.querySelector('#reportOutput');
const reviewPanel = document.querySelector('#reviewPanel');
const reviewForm = document.querySelector('#reviewForm');
const reviewStatusSelect = document.querySelector('#reviewStatusSelect');
const reviewNotesInput = document.querySelector('#reviewNotesInput');
const recipientEmailInput = document.querySelector('#recipientEmailInput');
const deliveryNotesInput = document.querySelector('#deliveryNotesInput');
const reviewStatusBadge = document.querySelector('#reviewStatusBadge');
const reviewHint = document.querySelector('#reviewHint');
const saveReviewButton = document.querySelector('#saveReviewButton');
const sendEmailButton = document.querySelector('#sendEmailButton');
const prepareEmailButton = document.querySelector('#prepareEmailButton');

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
  await Promise.all([loadIndustries(), checkHealth(), loadReadiness(), loadCalls()]);
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
refreshReadinessButton.addEventListener('click', loadReadiness);

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

sheetButton.addEventListener('click', async () => {
  if (!lastAudit) return;

  sheetButton.disabled = true;
  sheetButton.textContent = 'Building...';

  try {
    const response = await fetch('/export/xlsx', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(lastAudit),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || 'Spreadsheet export failed');
    }

    const blob = await response.blob();
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${slugify(lastAudit.industry || 'audit')}-${slugify(lastAudit.auditId || 'report')}.xlsx`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
  } catch (err) {
    showError(err.message);
  } finally {
    sheetButton.disabled = false;
    sheetButton.textContent = 'Download Sheet';
  }
});

printButton.addEventListener('click', () => {
  if (!lastAudit) return;

  const win = window.open('', '_blank');
  if (!win) {
    showError('Allow pop-ups for this page to print or save the report as PDF.');
    return;
  }

  win.document.open();
  win.document.write(buildExportDocument(lastAudit));
  win.document.close();
  win.addEventListener('load', () => {
    win.focus();
    win.print();
  }, { once: true });
});

reviewForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  await saveReviewWorkflow();
});

prepareEmailButton.addEventListener('click', async () => {
  if (!lastAudit?.callId) {
    showError('Load a saved phone-call report before preparing an email.');
    return;
  }
  if (!recipientEmailInput.value.trim()) {
    showError('Enter a recipient email before preparing the handoff.');
    return;
  }

  const saved = await saveReviewWorkflow({ quiet: true });
  if (!saved) return;

  window.location.href = buildMailtoUrl(lastAudit);
  reviewHint.textContent = 'Email draft opened. Attach the downloaded sheet before sending.';
});

sendEmailButton.addEventListener('click', async () => {
  if (!lastAudit?.callId) {
    showError('Load a saved phone-call report before sending email.');
    return;
  }
  if (!recipientEmailInput.value.trim()) {
    showError('Enter a recipient email before sending.');
    return;
  }

  const saved = await saveReviewWorkflow({ quiet: true });
  if (!saved) return;

  sendEmailButton.disabled = true;
  sendEmailButton.textContent = 'Sending...';
  clearError();

  try {
    const response = await fetch(`/voice/calls/${encodeURIComponent(lastAudit.callId)}/deliver`, {
      method: 'POST',
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'Could not send report email');

    applyCallToAudit(payload.call);
    renderReviewWorkflow(lastAudit);
    await loadCalls();
    reviewHint.textContent = 'Report email sent.';
  } catch (err) {
    showError(err.message);
  } finally {
    sendEmailButton.disabled = false;
    sendEmailButton.textContent = 'Send Email';
  }
});

async function saveReviewWorkflow(options = {}) {
  if (!lastAudit?.callId) {
    showError('Load a saved phone-call report before saving review status.');
    return null;
  }
  saveReviewButton.disabled = true;
  prepareEmailButton.disabled = true;
  sendEmailButton.disabled = true;
  saveReviewButton.textContent = 'Saving...';
  clearError();

  try {
    const response = await fetch(`/voice/calls/${encodeURIComponent(lastAudit.callId)}/review`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reviewStatus: reviewStatusSelect.value,
        reviewNotes: reviewNotesInput.value.trim(),
        recipientEmail: recipientEmailInput.value.trim(),
        deliveryNotes: deliveryNotesInput.value.trim(),
      }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'Could not save review status');

    applyCallToAudit(payload.call);
    renderReviewWorkflow(lastAudit);
    await loadCalls();
    if (!options.quiet) reviewHint.textContent = 'Review status saved.';
    return payload.call;
  } catch (err) {
    showError(err.message);
    return null;
  } finally {
    saveReviewButton.disabled = false;
    prepareEmailButton.disabled = false;
    sendEmailButton.disabled = false;
    saveReviewButton.textContent = 'Save Review';
  }
}

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

async function loadReadiness() {
  try {
    const response = await fetch('/readiness');
    if (!response.ok) throw new Error('Could not load launch readiness');
    const readiness = await response.json();
    renderReadiness(readiness);
  } catch (err) {
    readinessSummary.textContent = err.message;
    readinessChecks.innerHTML = '';
    readinessNextSteps.hidden = true;
  }
}

function renderReadiness(readiness) {
  const readyCount = readiness.checks.filter(check => check.ready).length;
  const totalCount = readiness.checks.length;
  readinessSummary.textContent = readiness.readyForPhoneCalls
    ? `Ready for live phone testing. ${readyCount}/${totalCount} checks ready.`
    : `Phone testing blocked. ${readyCount}/${totalCount} checks ready.`;

  readinessChecks.innerHTML = readiness.checks.map(check => `
    <div class="readiness-check ${escapeHtml(check.status)}">
      <span aria-hidden="true">${check.ready ? 'OK' : check.optional ? 'OPT' : '!'}</span>
      <div>
        <strong>${escapeHtml(check.label)}</strong>
        <p>${escapeHtml(check.ready ? 'Configured' : check.detail)}</p>
      </div>
    </div>
  `).join('');

  if (readiness.nextSteps?.length) {
    readinessNextSteps.hidden = false;
    readinessNextSteps.innerHTML = `
      <strong>Next</strong>
      <ul>${readiness.nextSteps.map(step => `<li>${escapeHtml(step)}</li>`).join('')}</ul>
    `;
  } else {
    readinessNextSteps.hidden = true;
    readinessNextSteps.innerHTML = '';
  }
}

function renderCalls(calls = []) {
  callCount.textContent = String(calls.length);
  if (!calls.length) {
    callList.innerHTML = '<div class="empty-state compact">No persisted calls yet.</div>';
    return;
  }

  callList.innerHTML = calls.map((call) => `
    <div class="call-card">
      <div class="call-title">
        <strong>${escapeHtml(call.businessName || call.contactName || call.phoneNumber || 'Phone audit')}</strong>
        <div class="status-stack">
          <span class="status-tag ${call.report ? 'ready' : ''}">${escapeHtml(formatLabel(call.status || 'started'))}</span>
          ${call.report ? `<span class="status-tag review-${escapeHtml(call.reviewStatus || 'draft')}">${escapeHtml(formatLabel(call.reviewStatus || 'draft'))}</span>` : ''}
        </div>
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

    applyCallToAudit(call);
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
  sheetButton.disabled = false;
  printButton.disabled = false;
  reportMeta.textContent = `${formatLabel(industry)} audit - ${auditId}`;

  reportOutput.innerHTML = [
    renderScores(report),
    renderListBlock('Key Strengths', report.keyStrengths),
    renderListBlock('Critical Gaps', report.criticalGaps),
    renderSections(report.sections),
    renderActionPlan(report.actionPlan),
  ].join('');

  renderReviewWorkflow(payload);
}

function applyCallToAudit(call) {
  lastAudit = {
    auditId: call.auditId || call.callId,
    callId: call.callId,
    industry: call.industry,
    businessName: call.businessName,
    contactName: call.contactName,
    phoneNumber: call.phoneNumber,
    transcript: call.transcript,
    reviewStatus: call.reviewStatus || 'draft',
    reviewNotes: call.reviewNotes || '',
    recipientEmail: call.recipientEmail || '',
    deliveryNotes: call.deliveryNotes || '',
    reviewedAt: call.reviewedAt,
    sentAt: call.sentAt,
    lastDelivery: call.lastDelivery,
    report: call.report,
  };
}

function renderReviewWorkflow(payload) {
  reviewPanel.hidden = false;
  const hasSavedCall = Boolean(payload.callId);
  const status = payload.reviewStatus || 'draft';
  reviewStatusSelect.value = status;
  reviewNotesInput.value = payload.reviewNotes || '';
  recipientEmailInput.value = payload.recipientEmail || '';
  deliveryNotesInput.value = payload.deliveryNotes || '';
  reviewStatusBadge.textContent = formatLabel(status);
  reviewStatusBadge.className = `review-badge review-${status}`;
  saveReviewButton.disabled = !hasSavedCall;
  prepareEmailButton.disabled = !hasSavedCall;
  sendEmailButton.disabled = !hasSavedCall;
  reviewStatusSelect.disabled = !hasSavedCall;
  reviewNotesInput.disabled = !hasSavedCall;
  recipientEmailInput.disabled = !hasSavedCall;
  deliveryNotesInput.disabled = !hasSavedCall;
  reviewHint.textContent = hasSavedCall
    ? buildReviewHint(payload)
    : 'Manual transcript reports can be exported, but review status is only saved for phone-call reports.';
}

function buildReviewHint(payload) {
  if (payload.lastDelivery?.sentAt) return `Email sent ${formatDateTime(payload.lastDelivery.sentAt)}.`;
  if (payload.sentAt) return `Sent ${formatDateTime(payload.sentAt)}.`;
  if (payload.reviewedAt) return `Reviewed ${formatDateTime(payload.reviewedAt)}.`;
  return 'Track edits, approval, and send status before delivery.';
}

function buildMailtoUrl(payload) {
  const subject = `${formatLabel(payload.industry || 'Business')} audit report for ${payload.businessName || payload.contactName || 'your business'}`;
  const body = [
    `Hi ${payload.contactName || 'there'},`,
    '',
    `Thanks again for taking the time to complete the AI Business Audit.`,
    '',
    `Your overall readiness score is ${payload.report?.overallScore ?? '-'}/10.`,
    '',
    'The biggest opportunities we identified:',
    ...firstItems(payload.report?.criticalGaps, 3).map(item => `- ${item}`),
    '',
    'Recommended next actions:',
    ...firstItems(payload.report?.actionPlan, 3).map(item => `- ${item.action || item}`),
    '',
    payload.deliveryNotes ? `Notes:\n${payload.deliveryNotes}\n` : '',
    'I have also prepared an editable audit workbook for the detailed scores, findings, and action plan.',
    '',
    'Best,',
  ].filter(Boolean).join('\n');

  return `mailto:${encodeURIComponent(payload.recipientEmail || '')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function firstItems(value, count) {
  return Array.isArray(value) ? value.filter(Boolean).slice(0, count) : [];
}

function buildExportDocument(payload) {
  const { auditId, industry, businessName, contactName, phoneNumber, transcript, report } = payload;
  const title = `${formatLabel(industry || 'Business')} Readiness Audit`;
  const preparedFor = businessName || contactName || phoneNumber || 'Business Owner';
  const generatedAt = new Date().toLocaleString();

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(title)}</title>
    <style>
      :root {
        color: #202524;
        font-family: Inter, Arial, sans-serif;
      }

      body {
        margin: 0;
        background: #f5f4ef;
      }

      main {
        max-width: 920px;
        margin: 0 auto;
        padding: 42px 28px;
        background: #ffffff;
      }

      header {
        border-bottom: 2px solid #0d6b57;
        padding-bottom: 22px;
        margin-bottom: 24px;
      }

      .eyebrow {
        margin: 0 0 8px;
        color: #0d6b57;
        font-size: 12px;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      h1, h2, h3, p {
        margin-top: 0;
      }

      h1 {
        margin-bottom: 10px;
        font-size: 34px;
        line-height: 1.05;
      }

      h2 {
        margin-bottom: 12px;
        font-size: 19px;
      }

      h3 {
        margin-bottom: 8px;
        font-size: 15px;
      }

      .meta {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px 18px;
        color: #65706d;
        font-size: 13px;
      }

      .score {
        display: flex;
        align-items: center;
        gap: 18px;
        margin-bottom: 24px;
      }

      .score strong {
        display: grid;
        place-items: center;
        width: 86px;
        aspect-ratio: 1;
        border-radius: 8px;
        background: #084c3e;
        color: #ffffff;
        font-size: 30px;
      }

      .score span {
        color: #65706d;
        font-weight: 700;
      }

      .grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
        margin-bottom: 24px;
      }

      section {
        break-inside: avoid;
        margin-bottom: 22px;
      }

      .box {
        border: 1px solid #d9dfdc;
        border-radius: 8px;
        padding: 14px;
      }

      .box p,
      li {
        color: #38413f;
        line-height: 1.55;
      }

      ul {
        margin-bottom: 0;
        padding-left: 20px;
      }

      .metric-label {
        color: #65706d;
        font-size: 12px;
        font-weight: 800;
        text-transform: uppercase;
      }

      .metric-value {
        display: block;
        margin-top: 4px;
        font-size: 22px;
        font-weight: 850;
      }

      .transcript {
        white-space: pre-wrap;
      }

      @media print {
        body {
          background: #ffffff;
        }

        main {
          padding: 0;
        }
      }

      @media (max-width: 700px) {
        .meta,
        .grid {
          grid-template-columns: 1fr;
        }
      }
    </style>
  </head>
  <body>
    <main>
      <header>
        <p class="eyebrow">AI Business Audit</p>
        <h1>${escapeHtml(title)}</h1>
        <div class="meta">
          <div><strong>Prepared for:</strong> ${escapeHtml(preparedFor)}</div>
          <div><strong>Industry:</strong> ${escapeHtml(formatLabel(industry || 'unknown'))}</div>
          <div><strong>Audit ID:</strong> ${escapeHtml(auditId || 'draft')}</div>
          <div><strong>Generated:</strong> ${escapeHtml(generatedAt)}</div>
        </div>
      </header>
      ${renderExportReport(report || {})}
      ${transcript ? `<section><h2>Transcript</h2><div class="box transcript">${escapeHtml(transcript)}</div></section>` : ''}
    </main>
  </body>
</html>`;
}

function renderExportReport(report) {
  return [
    `<section class="score"><strong>${escapeHtml(String(report.overallScore ?? '-'))}</strong><span>Overall readiness score out of 10</span></section>`,
    renderExportScores(report.scores),
    renderExportList('Key Strengths', report.keyStrengths),
    renderExportList('Critical Gaps', report.criticalGaps),
    renderExportSections(report.sections),
    renderExportActions(report.actionPlan),
  ].join('');
}

function renderExportScores(scores = {}) {
  const metrics = Object.entries(scores).map(([label, value]) => `
    <div class="box">
      <span class="metric-label">${escapeHtml(formatLabel(label))}</span>
      <strong class="metric-value">${escapeHtml(String(value))}/10</strong>
    </div>
  `).join('');

  if (!metrics) return '';
  return `<section><h2>Score Breakdown</h2><div class="grid">${metrics}</div></section>`;
}

function renderExportList(title, items = []) {
  if (!Array.isArray(items) || items.length === 0) return '';
  return `
    <section>
      <h2>${escapeHtml(title)}</h2>
      <div class="box"><ul>${items.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div>
    </section>
  `;
}

function renderExportSections(sections = {}) {
  return Object.entries(sections).map(([title, body]) => `
    <section>
      <h2>${escapeHtml(formatLabel(title))}</h2>
      <div class="box"><p>${formatMarkdownLite(String(body))}</p></div>
    </section>
  `).join('');
}

function renderExportActions(actions = []) {
  if (!Array.isArray(actions) || actions.length === 0) return '';
  const items = actions.map((item) => `
    <div class="box">
      <h3>${escapeHtml(item.priority || 'Next')}</h3>
      <p><strong>${escapeHtml(item.action || 'Action needed')}</strong></p>
      <p>${escapeHtml(item.timeframe || 'Set timeframe')}</p>
    </div>
  `).join('');

  return `<section><h2>Action Plan</h2><div class="grid">${items}</div></section>`;
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

function formatDateTime(value) {
  return new Date(value).toLocaleString();
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function slugify(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'report';
}

init();
