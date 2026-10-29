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
const callTabs = document.querySelector('#callTabs');
const deleteTestCallsButton = document.querySelector('#deleteTestCallsButton');
const CALL_STATUS_OPTIONS = [
  ['new', 'New'], ['booked', 'Booked'], ['won', 'Won'], ['no_go', 'No go'], ['test', 'Test'],
];
let currentCallView = 'active';
const transcriptInput = document.querySelector('#transcriptInput');
const auditForm = document.querySelector('#auditForm');
const generateButton = document.querySelector('#generateButton');
const sampleButton = document.querySelector('#sampleButton');
const copyButton = document.querySelector('#copyButton');
const sheetButton = document.querySelector('#sheetButton');
const printButton = document.querySelector('#printButton');
const customerPdfButton = document.querySelector('#customerPdfButton');
const notesPdfButton = document.querySelector('#notesPdfButton');
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
const websiteUrlInput = document.querySelector('#websiteUrlInput');
const deliveryNotesInput = document.querySelector('#deliveryNotesInput');
const reviewStatusBadge = document.querySelector('#reviewStatusBadge');
const followUpStatusBadge = document.querySelector('#followUpStatusBadge');
const followUpStatusSelect = document.querySelector('#followUpStatusSelect');
const followUpPreferredTimeInput = document.querySelector('#followUpPreferredTimeInput');
const followUpScheduledForInput = document.querySelector('#followUpScheduledForInput');
const followUpNotesInput = document.querySelector('#followUpNotesInput');
const reviewHint = document.querySelector('#reviewHint');
const saveReviewButton = document.querySelector('#saveReviewButton');
const sendEmailButton = document.querySelector('#sendEmailButton');
const prepareEmailButton = document.querySelector('#prepareEmailButton');
const reviewWebsiteButton = document.querySelector('#reviewWebsiteButton');

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

customerPdfButton.addEventListener('click', () => {
  if (!lastAudit?.callId) return;
  window.open(`/voice/calls/${encodeURIComponent(lastAudit.callId)}/report.pdf`, '_blank', 'noopener');
});

notesPdfButton?.addEventListener('click', () => {
  if (!lastAudit?.callId) return;
  window.open(`/voice/calls/${encodeURIComponent(lastAudit.callId)}/notes.pdf`, '_blank', 'noopener');
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
    // Wait for the bundled Inter font so the saved PDF never falls back to another face.
    const fontsReady = win.document.fonts ? win.document.fonts.ready : Promise.resolve();
    fontsReady.then(() => {
      win.focus();
      win.print();
    });
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

reviewWebsiteButton.addEventListener('click', async () => {
  if (!lastAudit?.callId) {
    showError('Load a saved phone-call report before reviewing the website.');
    return;
  }
  if (!websiteUrlInput.value.trim()) {
    showError('Enter the customer website before reviewing it.');
    return;
  }

  const saved = await saveReviewWorkflow({ quiet: true });
  if (!saved) return;

  reviewWebsiteButton.disabled = true;
  reviewWebsiteButton.textContent = 'Reviewing...';
  clearError();

  try {
    const response = await fetch(`/voice/calls/${encodeURIComponent(lastAudit.callId)}/website-review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ websiteUrl: websiteUrlInput.value.trim() }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'Could not review website');

    applyCallToAudit(payload.call);
    renderReport(lastAudit);
    await loadCalls();
    reviewHint.textContent = 'Website customer journey review added to the report.';
  } catch (err) {
    showError(err.message);
  } finally {
    reviewWebsiteButton.disabled = false;
    reviewWebsiteButton.textContent = 'Review Website';
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
        websiteUrl: websiteUrlInput.value.trim(),
        deliveryNotes: deliveryNotesInput.value.trim(),
        followUpStatus: followUpStatusSelect.value,
        followUpPreferredTime: followUpPreferredTimeInput.value.trim(),
        followUpScheduledFor: followUpScheduledForInput.value,
        followUpNotes: followUpNotesInput.value.trim(),
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
    const response = await fetch(`/voice/calls?view=${encodeURIComponent(currentCallView)}`);
    if (!response.ok) throw new Error('Could not load recent calls');
    const { calls, counts = {} } = await response.json();
    renderCallTabs(counts);
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
  readinessSummary.textContent = readiness.readyForInboundAudits
    ? `Ready for inbound assessment testing. ${readyCount}/${totalCount} checks ready.`
    : `Inbound assessment testing blocked. ${readyCount}/${totalCount} checks ready.`;

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

function renderCallTabs(counts = {}) {
  const viewCounts = {
    active: (counts.new || 0) + (counts.booked || 0),
    won: counts.won || 0,
    archived: counts.no_go || 0,
    test: counts.test || 0,
  };
  callTabs.querySelectorAll('[data-view]').forEach((tab) => {
    tab.classList.toggle('active', tab.dataset.view === currentCallView);
    const badge = tab.querySelector('[data-count]');
    if (badge) badge.textContent = `(${viewCounts[tab.dataset.view] || 0})`;
  });
  deleteTestCallsButton.hidden = !(currentCallView === 'test' && viewCounts.test > 0);
}

function callStatusSelect(call, extraClass = '') {
  const current = call.callStatus || 'new';
  return `<label class="call-status-row ${extraClass}">Status
    <select data-status-call-id="${escapeHtml(call.callId)}" aria-label="Call status">
      ${CALL_STATUS_OPTIONS.map(([value, label]) => `<option value="${value}" ${value === current ? 'selected' : ''}>${label}</option>`).join('')}
    </select>
  </label>`;
}

function bindCallStatusSelects(root) {
  root.querySelectorAll('[data-status-call-id]').forEach((select) => {
    select.addEventListener('change', () => setCallStatus(select.dataset.statusCallId, select.value));
  });
}

async function setCallStatus(callId, value) {
  clearError();
  try {
    const response = await fetch(`/voice/calls/${encodeURIComponent(callId)}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callStatus: value }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || 'Could not update call status');
    if (lastAudit && lastAudit.callId === callId) lastAudit.callStatus = body.call.callStatus;
    await loadCalls();
  } catch (err) {
    showError(err.message);
  }
}

async function deleteTestCall(callId, label) {
  if (!window.confirm(`Permanently delete test call "${label}"? This cannot be undone.`)) return;
  clearError();
  try {
    const response = await fetch(`/voice/calls/${encodeURIComponent(callId)}`, { method: 'DELETE' });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || 'Could not delete call');
    await loadCalls();
  } catch (err) {
    showError(err.message);
  }
}

async function deleteAllTestCalls() {
  if (!window.confirm('Permanently delete ALL calls marked Test? This cannot be undone.')) return;
  clearError();
  try {
    const response = await fetch('/voice/calls/test/delete-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirm: true }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || 'Could not delete test calls');
    await loadCalls();
  } catch (err) {
    showError(err.message);
  }
}

callTabs.querySelectorAll('[data-view]').forEach((tab) => {
  tab.addEventListener('click', () => {
    currentCallView = tab.dataset.view;
    loadCalls();
  });
});
deleteTestCallsButton.addEventListener('click', deleteAllTestCalls);

function renderCalls(calls = []) {
  callCount.textContent = String(calls.length);
  if (!calls.length) {
    callList.innerHTML = '<div class="empty-state compact">No calls in this view.</div>';
    return;
  }

  callList.innerHTML = calls.map((call) => `
    <div class="call-card">
      <div class="call-title">
        <strong>${escapeHtml(call.businessName || call.contactName || call.phoneNumber || 'Phone audit')}</strong>
        <div class="status-stack">
          <span class="status-tag call-status-${escapeHtml(call.callStatus || 'new')}">${escapeHtml((CALL_STATUS_OPTIONS.find(([v]) => v === (call.callStatus || 'new')) || [, 'New'])[1])}</span>
          <span class="status-tag ${call.report ? 'ready' : ''}">${escapeHtml(formatLabel(call.status || 'started'))}</span>
          ${call.report ? `<span class="status-tag review-${escapeHtml(call.reviewStatus || 'draft')}">${escapeHtml(formatLabel(call.reviewStatus || 'draft'))}</span>` : ''}
          ${call.report && call.followUpStatus && call.followUpStatus !== 'not_offered' ? `<span class="status-tag follow-up-${escapeHtml(call.followUpStatus)}">${escapeHtml(formatLabel(call.followUpStatus))}</span>` : ''}
        </div>
      </div>
      <p>${escapeHtml(formatLabel(call.industry || 'unknown'))} - ${escapeHtml(call.phoneNumber || call.callId)}</p>
      ${callStatusSelect(call)}
      ${call.report ? `<button class="secondary-button" type="button" data-call-id="${escapeHtml(call.callId)}">View Report</button>
      <a class="secondary-button" href="/voice/calls/${encodeURIComponent(call.callId)}/report.pdf" target="_blank" rel="noopener">Preview customer PDF</a>` : ''}
      ${call.callStatus === 'test' ? `<button class="ghost-button danger-button" type="button" data-delete-call-id="${escapeHtml(call.callId)}" data-delete-label="${escapeHtml(call.businessName || call.contactName || call.phoneNumber || call.callId)}">Delete test call</button>` : ''}
    </div>
  `).join('');

  callList.querySelectorAll('[data-call-id]').forEach((button) => {
    button.addEventListener('click', () => loadCallReport(button.dataset.callId));
  });
  callList.querySelectorAll('[data-delete-call-id]').forEach((button) => {
    button.addEventListener('click', () => deleteTestCall(button.dataset.deleteCallId, button.dataset.deleteLabel));
  });
  bindCallStatusSelects(callList);
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
  customerPdfButton.disabled = !payload.callId;
  if (notesPdfButton) notesPdfButton.disabled = !payload.callId;
  reportMeta.textContent = `${formatLabel(industry)} audit - ${auditId}`;

  reportOutput.innerHTML = [
    payload.callId ? callStatusSelect(payload, 'report-call-status') : '',
    renderScores(report),
    renderWebsiteReview(payload.websiteReview),
    renderListBlock('Key Strengths', report.keyStrengths),
    renderListBlock('Critical Gaps', report.criticalGaps),
    renderPriorityAnalysis(report.priorityAnalysis),
    renderDiagnosticFindings(report.diagnosticFindings),
    renderSections(report.sections),
    renderActionPlan(report.actionPlan),
  ].join('');
  bindCallStatusSelects(reportOutput);

  renderReviewWorkflow(payload);
}

function applyCallToAudit(call) {
  lastAudit = {
    auditId: call.auditId || call.callId,
    callId: call.callId,
    callStatus: call.callStatus || 'new',
    industry: call.industry,
    businessName: call.businessName,
    contactName: call.contactName,
    phoneNumber: call.phoneNumber,
    transcript: call.transcript,
    reviewStatus: call.reviewStatus || 'draft',
    reviewNotes: call.reviewNotes || '',
    recipientEmail: call.recipientEmail || '',
    websiteUrl: call.websiteUrl || '',
    websiteReview: call.websiteReview,
    deliveryNotes: call.deliveryNotes || '',
    followUpStatus: call.followUpStatus || 'not_offered',
    followUpPreferredTime: call.followUpPreferredTime || '',
    followUpScheduledFor: call.followUpScheduledFor || '',
    followUpNotes: call.followUpNotes || '',
    followUpRequestedAt: call.followUpRequestedAt,
    followUpBookedAt: call.followUpBookedAt,
    followUpCompletedAt: call.followUpCompletedAt,
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
  websiteUrlInput.value = payload.websiteUrl || '';
  deliveryNotesInput.value = payload.deliveryNotes || '';
  const followUpStatus = payload.followUpStatus || 'not_offered';
  followUpStatusSelect.value = followUpStatus;
  followUpPreferredTimeInput.value = payload.followUpPreferredTime || '';
  followUpScheduledForInput.value = payload.followUpScheduledFor || '';
  followUpNotesInput.value = payload.followUpNotes || '';
  reviewStatusBadge.textContent = formatLabel(status);
  reviewStatusBadge.className = `review-badge review-${status}`;
  followUpStatusBadge.textContent = formatLabel(followUpStatus);
  followUpStatusBadge.className = `review-badge follow-up-${followUpStatus}`;
  saveReviewButton.disabled = !hasSavedCall;
  prepareEmailButton.disabled = !hasSavedCall;
  sendEmailButton.disabled = !hasSavedCall;
  reviewWebsiteButton.disabled = !hasSavedCall;
  reviewStatusSelect.disabled = !hasSavedCall;
  reviewNotesInput.disabled = !hasSavedCall;
  recipientEmailInput.disabled = !hasSavedCall;
  websiteUrlInput.disabled = !hasSavedCall;
  deliveryNotesInput.disabled = !hasSavedCall;
  followUpStatusSelect.disabled = !hasSavedCall;
  followUpPreferredTimeInput.disabled = !hasSavedCall;
  followUpScheduledForInput.disabled = !hasSavedCall;
  followUpNotesInput.disabled = !hasSavedCall;
  reviewHint.textContent = hasSavedCall
    ? buildReviewHint(payload)
    : 'Manual transcript reports can be exported, but review status is only saved for phone-call reports.';
}

function buildReviewHint(payload) {
  if (payload.followUpStatus === 'completed' && payload.followUpCompletedAt) {
    return `Follow-up completed ${formatDateTime(payload.followUpCompletedAt)}.`;
  }
  if (payload.followUpStatus === 'booked' && payload.followUpScheduledFor) {
    return `Follow-up booked for ${formatDateTime(payload.followUpScheduledFor)}.`;
  }
  if (payload.followUpStatus === 'requested') return 'Follow-up requested. Confirm a suitable time with the caller.';
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
    payload.report?.priorityAnalysis?.fastestVisibleWin ? `\nFastest visible win: ${payload.report.priorityAnalysis.fastestVisibleWin}` : '',
    '',
    'Recommended next actions:',
    ...firstItems(payload.report?.actionPlan, 3).map(item => `- ${item.action || item}`),
    '',
    payload.websiteUrl ? `Website noted for assessment context: ${payload.websiteUrl}` : '',
    payload.websiteReview ? `Website review completed: ${payload.websiteReview.strengths?.length || 0} strengths and ${payload.websiteReview.opportunities?.length || 0} opportunities found.` : '',
    '',
    payload.deliveryNotes ? `Notes:\n${payload.deliveryNotes}\n` : '',
    'The report that follows is your two-page Revenue and Operations Readiness Report. The score is a decision aid, not a financial forecast.',
    '',
    'Best,',
  ].filter(Boolean).join('\n');

  return `mailto:${encodeURIComponent(payload.recipientEmail || '')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function firstItems(value, count) {
  return Array.isArray(value) ? value.filter(Boolean).slice(0, count) : [];
}

// Internal Trades Readiness Audit print page (v4). Same order and finding pattern as the
// customer Business Check, denser, with confidence, a quote from the call and the Volve fix.
// Print-safe: dark text on white only, no fills or panels, system fonts only.
function buildExportDocument(payload) {
  const { industry, contactName, phoneNumber, websiteUrl, transcript } = payload;
  const notesFrom = (input, key) => (input && typeof input.value === 'string' && input.value.trim()) || payload[key] || '';
  const model = window.ReportModel.buildModel({
    ...payload,
    reviewNotes: notesFrom(typeof reviewNotesInput !== 'undefined' ? reviewNotesInput : null, 'reviewNotes'),
    deliveryNotes: notesFrom(typeof deliveryNotesInput !== 'undefined' ? deliveryNotesInput : null, 'deliveryNotes'),
    followUpNotes: notesFrom(typeof followUpNotesInput !== 'undefined' ? followUpNotesInput : null, 'followUpNotes'),
  });
  const title = `${formatLabel(industry || 'Business')} Readiness Audit`;
  const e = escapeHtml;
  const tagHtml = (f) => `<span class="tag tag-${e(f.priority)}"><span class="mark" aria-hidden="true">${e(f.tag.glyph)}</span> ${e(f.tag.label)}</span>`;
  const li = (label, text) => `<li>${label ? `<strong>${e(label)}:</strong> ` : ''}${e(text)}</li>`;
  const scores = Object.entries(model.scores || {}).map(([k, v]) => `${e(formatLabel(k))}: ${e(String(v))}/10`).join(' &nbsp;|&nbsp; ');
  const findings = model.findings.map(f => `
    <article class="finding">
      <div class="finding-head">${tagHtml(f)}<h3>${f.number}. ${e(f.title)}</h3><span class="effort">Effort: ${e(f.effortLabel)}</span></div>
      <ul>
        ${f.bullets.map(b => li(b.label, b.text)).join('')}
        ${f.customerQuote ? li('Evidence', `"${f.customerQuote}"`) : (f.evidence ? li('Evidence', f.evidence) : '')}
        ${li('Confidence', formatLabel(f.confidence))}
        ${f.volveFix ? li('Volve fix', f.volveFix) : ''}
        ${f.moneyAtStake ? li('Estimate from call', f.moneyAtStake) : ''}
      </ul>
    </article>`).join('');
  const fixes = model.topFixes.map(f => `<li><strong>${e(f.title)}.</strong> ${e(f.action)} <span class="ref">(finding ${f.number})</span>${f.estimate ? `<div class="estimate">${e(f.estimate)} (estimate only)</div>` : ''}</li>`).join('');
  const notes = [['Internal notes', model.notes.reviewNotes], ['Delivery notes', model.notes.deliveryNotes], ['Follow-up notes', model.notes.followUpNotes]];

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>${e(title)} - ${e(model.businessName)}</title>
    <style>
      /* Print-safe by design: dark text on white, borders only, system fonts. */
      * { box-sizing: border-box; background: #fff !important; color: #1C1410; text-shadow: none !important; box-shadow: none !important; filter: none !important; opacity: 1 !important; }
      html, body { margin: 0; font-family: Arial, Helvetica, sans-serif; font-size: 12px; line-height: 1.4; }
      main { max-width: 820px; margin: 0 auto; padding: 24px 28px; }
      .kicker { color: #C47B2E; font-weight: 700; font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; margin: 0; }
      h1 { font-size: 26px; margin: 2px 0 2px; }
      .meta { font-size: 11px; margin: 2px 0; }
      h2 { color: #C47B2E; font-size: 14px; text-transform: uppercase; letter-spacing: 0.04em; margin: 16px 0 6px; padding-bottom: 3px; border-bottom: 2px solid #E8A84A; }
      .bottom { display: flex; gap: 14px; align-items: center; }
      .score { width: 78px; height: 78px; border: 2.5px solid #C47B2E; border-radius: 8px; text-align: center; padding-top: 12px; flex: none; }
      .score strong { display: block; font-size: 28px; color: #1C1410; }
      .score span { font-size: 10px; }
      .bottom p { font-weight: 700; font-size: 14px; margin: 0; }
      ol.fixes { margin: 0; padding-left: 20px; }
      ol.fixes li { margin-bottom: 4px; }
      .estimate { font-weight: 700; font-size: 11px; }
      .ref { font-size: 11px; }
      .finding { border: 1px solid #1C1410; border-radius: 6px; padding: 6px 10px; margin-bottom: 7px; break-inside: avoid; }
      .finding-head { display: flex; align-items: center; gap: 8px; }
      .finding h3 { font-size: 13px; margin: 0; flex: 1; }
      .effort { font-size: 11px; font-weight: 700; }
      .finding ul { margin: 4px 0 0; padding-left: 18px; }
      .tag { display: inline-block; font-size: 10px; font-weight: 700; padding: 1px 6px; border-radius: 3px; white-space: nowrap; }
      .tag-high { color: #1C1410; border: 2px solid #C47B2E; }
      .tag-high .mark, .tag-medium .mark { color: #C47B2E; }
      .tag-medium { color: #1C1410; border: 1px solid #C47B2E; }
      .tag-low { color: #5E5148; border: 1px solid #6B6058; }
      .tag-low .mark { color: #5E5148; }
      .notes div { white-space: pre-wrap; margin-bottom: 4px; }
      .transcript { white-space: pre-wrap; font-size: 10.5px; }
      footer { margin-top: 18px; padding-top: 6px; border-top: 1px solid #B8AEA4; font-size: 10px; }
      @media print {
        @page { size: A4; margin: 14mm 12mm; }
        main { padding: 0; max-width: none; }
        *, *::before, *::after { background: #fff !important; -webkit-text-fill-color: currentColor; }
      }
    </style>
  </head>
  <body>
    <main>
      <p class="kicker">Internal - not for the customer</p>
      <h1>${e(model.businessName)}</h1>
      <p class="meta">${e(title)} &nbsp;|&nbsp; ${e(model.date)} &nbsp;|&nbsp; Reviewed by ${e(model.reviewedBy)}</p>
      <p class="meta">${[contactName && `Contact: ${e(contactName)}`, phoneNumber && `Phone: ${e(phoneNumber)}`, websiteUrl && `Website: ${e(websiteUrl)}`, model.callId && `Call: ${e(model.callId)}`].filter(Boolean).join(' &nbsp;|&nbsp; ')}</p>
      <h2>The bottom line</h2>
      <div class="bottom"><div class="score"><strong>${model.score != null ? e(model.score.toFixed(1)) : '-'}</strong><span>out of 10</span></div><p>${e(model.bottomLine)}</p></div>
      ${scores ? `<p class="meta">${scores}</p>` : ''}
      ${fixes ? `<h2>Top 3 fixes</h2><ol class="fixes">${fixes}</ol>` : ''}
      ${findings ? `<h2>Findings</h2>${findings}` : ''}
      ${model.whatsWorking.length ? `<h2>What's working</h2><ul>${model.whatsWorking.map(w => `<li>${e(w)}</li>`).join('')}</ul>` : ''}
      <h2>Notes</h2>
      <section class="notes">${notes.map(([k, v]) => `<div><strong>${e(k)}:</strong> ${e(v || '(none)')}</div>`).join('')}</section>
      ${transcript ? `<h2>Transcript</h2><div class="transcript">${e(transcript)}</div>` : ''}
      <footer>volvesolutions.com.au &nbsp;|&nbsp; 02 5700 0037 &nbsp;|&nbsp; Prepared by Hugh Douglas</footer>
    </main>
  </body>
</html>`;
}

function renderExportNotes(payload = {}) {
  const read = (input, key) => (input && typeof input.value === 'string' && input.value.trim()) || payload[key] || '';
  const entries = [
    ['Internal Notes', read(typeof reviewNotesInput !== 'undefined' ? reviewNotesInput : null, 'reviewNotes')],
    ['Delivery Notes', read(typeof deliveryNotesInput !== 'undefined' ? deliveryNotesInput : null, 'deliveryNotes')],
    ['Follow-up Notes', read(typeof followUpNotesInput !== 'undefined' ? followUpNotesInput : null, 'followUpNotes')],
  ].filter(([, value]) => value);
  if (!entries.length) return '';
  return `<section><h2>Internal Notes</h2>${entries.map(([label, value]) => `
    <div class="box"><span class="metric-label">${escapeHtml(label)}</span><div class="notes-print">${escapeHtml(value)}</div></div>
  `).join('')}</section>`;
}

function renderExportReport(report) {
  return [
    `<section class="score"><strong>${escapeHtml(String(report.overallScore ?? '-'))}</strong><span>Overall readiness score out of 10</span></section>`,
    renderExportScores(report.scores),
    renderExportList('Key Strengths', report.keyStrengths),
    renderExportList('Critical Gaps', report.criticalGaps),
    renderExportPriorityAnalysis(report.priorityAnalysis),
    renderExportDiagnosticFindings(report.diagnosticFindings),
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

function renderExportPriorityAnalysis(analysis = {}) {
  const entries = [
    ['Highest Impact Issue', analysis.highestImpactIssue],
    ['Fastest Visible Win', analysis.fastestVisibleWin],
    ['Implementation Confidence', analysis.implementationConfidence ? formatLabel(analysis.implementationConfidence) : ''],
    ['Reasoning', analysis.reasoning],
  ].filter(([, value]) => value);

  if (!entries.length) return '';
  return `
    <section>
      <h2>Priority Analysis</h2>
      <div class="grid">
        ${entries.map(([label, value]) => `
          <div class="box">
            <span class="metric-label">${escapeHtml(label)}</span>
            <p>${escapeHtml(String(value))}</p>
          </div>
        `).join('')}
      </div>
    </section>
  `;
}

function renderExportDiagnosticFindings(findings = []) {
  if (!Array.isArray(findings) || findings.length === 0) return '';
  return `
    <section>
      <h2>Diagnostic Findings</h2>
      <div class="grid">
        ${findings.map(finding => `
          <div class="box">
            <span class="metric-label">${escapeHtml(formatLabel(finding.status || 'unknown'))}</span>
            <h3>${escapeHtml(finding.problemArea || 'Problem Area')}</h3>
            <p><strong>Maturity:</strong> ${escapeHtml(finding.maturity || '')}</p>
            <p><strong>Evidence:</strong> ${escapeHtml(finding.evidence || '')}</p>
            <p><strong>Impact:</strong> ${escapeHtml(finding.likelyImpact || '')}</p>
            <p><strong>Urgency:</strong> ${escapeHtml(formatLabel(finding.urgency || ''))}</p>
            <p><strong>Implementation:</strong> ${escapeHtml(formatLabel(finding.implementationPotential || ''))}</p>
            <p><strong>Fastest win:</strong> ${escapeHtml(finding.fastestWin || '')}</p>
          </div>
        `).join('')}
      </div>
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

function renderWebsiteReview(review) {
  if (!review) return '';
  const signals = Array.isArray(review.signals) ? review.signals : [];
  const strengths = firstItems(review.strengths, 3);
  const opportunities = firstItems(review.opportunities, 3);

  return `
    <section class="website-review">
      <div>
        <span class="section-kicker">Website Customer Journey</span>
        <h3>${escapeHtml(review.title || review.websiteUrl || 'Website Review')}</h3>
        ${review.websiteUrl ? `<p>${escapeHtml(review.websiteUrl)}</p>` : ''}
      </div>
      <div class="website-signal-grid">
        ${signals.map(signal => `
          <div class="website-signal ${escapeHtml(signal.status || 'missing')}">
            <strong>${escapeHtml(signal.label || formatLabel(signal.id || 'Signal'))}</strong>
            <span>${escapeHtml(formatLabel(signal.status || 'missing'))}</span>
            <p>${escapeHtml(signal.detail || '')}</p>
          </div>
        `).join('')}
      </div>
      ${strengths.length ? renderListBlock('Website Strengths', strengths) : ''}
      ${opportunities.length ? renderListBlock('Website Opportunities', opportunities) : ''}
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
      ${item.problemArea ? `<p>${escapeHtml(item.problemArea)}</p>` : ''}
      ${item.expectedImpact ? `<p>${escapeHtml(item.expectedImpact)}</p>` : ''}
    </div>
  `).join('');

  return `
    <section>
      <h3>Action Plan</h3>
      <div class="action-list">${items}</div>
    </section>
  `;
}

function renderPriorityAnalysis(analysis = {}) {
  const entries = [
    ['Highest Impact Issue', analysis.highestImpactIssue],
    ['Fastest Visible Win', analysis.fastestVisibleWin],
    ['Implementation Confidence', analysis.implementationConfidence ? formatLabel(analysis.implementationConfidence) : ''],
    ['Reasoning', analysis.reasoning],
  ].filter(([, value]) => value);

  if (!entries.length) return '';
  return `
    <section>
      <h3>Priority Analysis</h3>
      <div class="action-list">
        ${entries.map(([label, value]) => `
          <div class="action-item">
            <div class="priority">${escapeHtml(label)}</div>
            <p>${escapeHtml(String(value))}</p>
          </div>
        `).join('')}
      </div>
    </section>
  `;
}

function renderDiagnosticFindings(findings = []) {
  if (!Array.isArray(findings) || findings.length === 0) return '';
  const items = findings.map((finding) => `
    <div class="action-item">
      <div class="priority">${escapeHtml(formatLabel(finding.status || 'unknown'))}</div>
      <p><strong>${escapeHtml(finding.problemArea || 'Problem Area')}</strong></p>
      ${finding.maturity ? `<p>${escapeHtml(finding.maturity)}</p>` : ''}
      ${finding.evidence ? `<p><strong>Evidence:</strong> ${escapeHtml(finding.evidence)}</p>` : ''}
      ${finding.likelyImpact ? `<p><strong>Impact:</strong> ${escapeHtml(finding.likelyImpact)}</p>` : ''}
      ${finding.urgency ? `<p><strong>Urgency:</strong> ${escapeHtml(formatLabel(finding.urgency))}</p>` : ''}
      ${finding.implementationPotential ? `<p><strong>Implementation:</strong> ${escapeHtml(formatLabel(finding.implementationPotential))}</p>` : ''}
      ${finding.fastestWin ? `<p><strong>Fastest win:</strong> ${escapeHtml(finding.fastestWin)}</p>` : ''}
    </div>
  `).join('');

  return `
    <section>
      <h3>Diagnostic Findings</h3>
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
  startCallButton.textContent = isLoading ? 'Starting...' : 'Start Test Call';
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
