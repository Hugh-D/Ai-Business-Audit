const auditForm = document.querySelector('#auditForm');
const businessNameInput = document.querySelector('#businessNameInput');
const industryInput = document.querySelector('#industryInput');
const websiteUrlInput = document.querySelector('#websiteUrlInput');
const auditButton = document.querySelector('#auditButton');
const serviceStatus = document.querySelector('#serviceStatus');
const errorState = document.querySelector('#errorState');
const emptyState = document.querySelector('#emptyState');
const reportOutput = document.querySelector('#reportOutput');
const downloadJsonButton = document.querySelector('#downloadJsonButton');
const printButton = document.querySelector('#printButton');

let lastReview = null;

checkHealth();

auditForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearError();

  if (!websiteUrlInput.value.trim()) {
    showError('Enter a website URL first.');
    return;
  }

  setLoading(true);
  try {
    const response = await fetch('/api/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessName: businessNameInput.value.trim(),
        industry: industryInput.value.trim(),
        websiteUrl: websiteUrlInput.value.trim(),
      }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'Website audit failed');

    lastReview = payload.review;
    renderReport(lastReview);
  } catch (err) {
    showError(err.message);
  } finally {
    setLoading(false);
  }
});

downloadJsonButton.addEventListener('click', () => {
  if (!lastReview) return;
  const blob = new Blob([JSON.stringify(lastReview, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${slugify(lastReview.businessName || lastReview.title || 'website-audit')}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
});

printButton.addEventListener('click', () => {
  if (!lastReview) return;
  window.print();
});

async function checkHealth() {
  try {
    const response = await fetch('/health');
    if (!response.ok) throw new Error('offline');
    serviceStatus.textContent = 'Online';
    serviceStatus.classList.add('ok');
  } catch (_err) {
    serviceStatus.textContent = 'Offline';
    serviceStatus.classList.add('bad');
  }
}

function renderReport(review) {
  emptyState.hidden = true;
  reportOutput.hidden = false;
  downloadJsonButton.disabled = false;
  printButton.disabled = false;

  reportOutput.innerHTML = [
    renderHero(review),
    renderCategoryScores(review.categoryScores),
    renderSignals(review.signals),
    renderListBlock('Priority Opportunities', review.opportunities),
    renderActionPlan(review.actionPlan),
  ].join('');
}

function renderHero(review) {
  return `
    <section class="score-row">
      <div class="score-badge">
        <strong>${escapeHtml(String(review.overallScore ?? '-'))}</strong>
        <span>/10</span>
      </div>
      <div>
        <p class="eyebrow">Overall Website Readiness</p>
        <h2>${escapeHtml(review.businessName || review.title || 'Website Audit')}</h2>
        <p>${escapeHtml(review.websiteUrl || '')}</p>
        ${review.description ? `<p>${escapeHtml(review.description)}</p>` : ''}
      </div>
    </section>
  `;
}

function renderCategoryScores(scores = []) {
  if (!Array.isArray(scores) || !scores.length) return '';
  return `
    <section>
      <h3>Category Scores</h3>
      <div class="metric-grid">
        ${scores.map(score => `
          <div class="metric">
            <span>${escapeHtml(score.label)}</span>
            <strong>${escapeHtml(String(score.score))}/10</strong>
            <p>${escapeHtml(String(score.found))} of ${escapeHtml(String(score.total))} signals found</p>
          </div>
        `).join('')}
      </div>
    </section>
  `;
}

function renderSignals(signals = []) {
  return `
    <section>
      <h3>Signals</h3>
      <div class="signal-grid">
        ${signals.map(signal => `
          <div class="signal ${escapeHtml(signal.status)}">
            <strong>${escapeHtml(signal.label)}</strong>
            <span>${escapeHtml(formatLabel(signal.status))}</span>
            <p>${escapeHtml(signal.detail)}</p>
          </div>
        `).join('')}
      </div>
    </section>
  `;
}

function renderListBlock(title, items = []) {
  if (!Array.isArray(items) || !items.length) return '';
  return `
    <section class="list-block">
      <h3>${escapeHtml(title)}</h3>
      <ul>${items.slice(0, 6).map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
    </section>
  `;
}

function renderActionPlan(items = []) {
  if (!Array.isArray(items) || !items.length) return '';
  return `
    <section>
      <h3>Action Plan</h3>
      <div class="action-list">
        ${items.map(item => `
          <div class="action-item">
            <span>${escapeHtml(item.priority)} - ${escapeHtml(item.category)}</span>
            <strong>${escapeHtml(item.action)}</strong>
            <p>${escapeHtml(item.evidence)}</p>
          </div>
        `).join('')}
      </div>
    </section>
  `;
}

function setLoading(isLoading) {
  auditButton.disabled = isLoading;
  auditButton.textContent = isLoading ? 'Auditing...' : 'Run Audit';
}

function showError(message) {
  errorState.textContent = message;
  errorState.hidden = false;
}

function clearError() {
  errorState.textContent = '';
  errorState.hidden = true;
}

function formatLabel(value) {
  return String(value)
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, char => char.toUpperCase());
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
    .slice(0, 80) || 'website-audit';
}
