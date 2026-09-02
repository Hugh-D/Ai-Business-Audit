const form = document.querySelector('#websiteAuditForm');
const submitButton = document.querySelector('#auditSubmit');
const errorBox = document.querySelector('#auditError');
const results = document.querySelector('#auditResults');

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  setError('');
  setLoading(true);

  try {
    const gbpPanel = form.querySelector('.gbp-panel');
    const payload = {
      businessName: value('#businessName'),
      industry: value('#industry'),
      websiteUrl: value('#websiteUrl'),
    };

    if (gbpPanel?.open) {
      payload.gbpProfile = {
        categoryAccurate: checked('#gbpCategory'),
        napMatchesWebsite: checked('#gbpNap'),
        descriptionComplete: checked('#gbpDescription'),
        ownerRespondsToReviews: checked('#gbpResponds'),
        appearsInLocalPack: checked('#gbpPack'),
        citationsConsistent: checked('#gbpCitations'),
        photoCount: numberValue('#gbpPhotos'),
        reviewCount: numberValue('#gbpReviews'),
        averageRating: numberValue('#gbpRating'),
      };
    }

    const response = await fetch('/api/website-audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || 'The website audit could not be completed.');

    renderResults(body.review);
    results.hidden = false;
    results.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
  } catch (error) {
    setError(error.message);
  } finally {
    setLoading(false);
  }
});

function renderResults(review) {
  document.querySelector('#resultName').textContent = review.businessName || review.title || 'Website review';
  document.querySelector('#resultUrl').textContent = review.websiteUrl || '';
  document.querySelector('#resultScore').textContent = String(review.overallScore ?? 0);

  const scoreRoot = document.querySelector('#categoryScores');
  scoreRoot.replaceChildren(...(review.categoryScores || []).map((item) => {
    const card = document.createElement('div');
    card.className = 'score-card';
    const label = document.createElement('span');
    label.textContent = item.label;
    const score = document.createElement('strong');
    score.textContent = `${item.score}/10`;
    card.append(label, score);
    return card;
  }));

  const actionRoot = document.querySelector('#actionPlan');
  actionRoot.replaceChildren(...(review.actionPlan || []).map((item) => {
    const card = document.createElement('article');
    card.className = 'action-item';
    const meta = document.createElement('span');
    meta.textContent = `${item.priority} priority · ${item.category}`;
    const action = document.createElement('strong');
    action.textContent = item.action;
    card.append(meta, action);
    return card;
  }));

  const signalRoot = document.querySelector('#signalList');
  signalRoot.replaceChildren(...(review.signals || []).map((item) => {
    const card = document.createElement('article');
    card.className = `signal-item ${item.status === 'found' ? 'found' : 'missing'}`;
    const status = document.createElement('span');
    status.textContent = `${item.status} · ${item.categoryLabel || item.category}`;
    const label = document.createElement('strong');
    label.textContent = item.label;
    card.append(status, label);
    return card;
  }));
}

function value(selector) {
  return String(document.querySelector(selector)?.value || '').trim();
}

function checked(selector) {
  return Boolean(document.querySelector(selector)?.checked);
}

function numberValue(selector) {
  return Number(document.querySelector(selector)?.value || 0);
}

function setLoading(loading) {
  submitButton.disabled = loading;
  submitButton.textContent = loading ? 'Reviewing website...' : 'Run website audit';
  form.setAttribute('aria-busy', String(loading));
}

function setError(message) {
  errorBox.textContent = message;
  errorBox.hidden = !message;
}

function reducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
