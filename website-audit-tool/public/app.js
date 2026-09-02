const auditForm = document.querySelector('#auditForm');
const businessNameInput = document.querySelector('#businessNameInput');
const industryInput = document.querySelector('#industryInput');
const websiteUrlInput = document.querySelector('#websiteUrlInput');
const auditButton = document.querySelector('#auditButton');
const serviceStatus = document.querySelector('#serviceStatus');
const errorState = document.querySelector('#errorState');
const emptyState = document.querySelector('#emptyState');
const reportOutput = document.querySelector('#reportOutput');
const copySummaryButton = document.querySelector('#copySummaryButton');
const downloadJsonButton = document.querySelector('#downloadJsonButton');
const printButton = document.querySelector('#printButton');
const toast = document.querySelector('#toast');

const gbpToggle = document.querySelector('#gbpToggle');
const gbpCategoryAccurate = document.querySelector('#gbpCategoryAccurate');
const gbpNapConsistent = document.querySelector('#gbpNapConsistent');
const gbpDescriptionComplete = document.querySelector('#gbpDescriptionComplete');
const gbpOwnerResponds = document.querySelector('#gbpOwnerResponds');
const gbpAppearsInPack = document.querySelector('#gbpAppearsInPack');
const gbpCitationsConsistent = document.querySelector('#gbpCitationsConsistent');
const gbpPhotoCount = document.querySelector('#gbpPhotoCount');
const gbpReviewCount = document.querySelector('#gbpReviewCount');
const gbpAverageRating = document.querySelector('#gbpAverageRating');

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
const gbpProfile = buildGbpProfile();
const response = await fetch('/api/audit', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({
businessName: businessNameInput.value.trim(),
industry: industryInput.value.trim(),
websiteUrl: websiteUrlInput.value.trim(),
...(gbpProfile ? { gbpProfile } : {}),
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

function buildGbpProfile() {
if (!gbpToggle || !gbpToggle.checked) return null;
return {
categoryAccurate: gbpCategoryAccurate.checked,
napMatchesWebsite: gbpNapConsistent.checked,
descriptionComplete: gbpDescriptionComplete.checked,
ownerRespondsToReviews: gbpOwnerResponds.checked,
appearsInLocalPack: gbpAppearsInPack.checked,
citationsConsistent: gbpCitationsConsistent.checked,
photoCount: Number(gbpPhotoCount.value || 0),
reviewCount: Number(gbpReviewCount.value || 0),
averageRating: Number(gbpAverageRating.value || 0),
};
}

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

copySummaryButton.addEventListener('click', async () => {
if (!lastReview) return;
const summary = buildShareSummary(lastReview);

try {
await navigator.clipboard.writeText(summary);
showToast('Report copied');
} catch (_err) {
showError('Could not copy automatically. Select the summary text and copy it manually.');
}
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
copySummaryButton.disabled = false;
downloadJsonButton.disabled = false;
printButton.disabled = false;

reportOutput.innerHTML = [
renderHero(review),
renderQuickRead(review),
renderTopLeaks(review),
renderActionPlan(review.actionPlan),
renderCategoryScores(review.categoryScores),
renderSignals(review.signals),
renderListBlock('Priority Opportunities', review.opportunities),
renderFollowUpPrompt(review),
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
<p class="eyebrow">Website Revenue Readiness</p>
<h2>${escapeHtml(review.businessName || review.title || 'Website Audit')}</h2>
<p>${escapeHtml(review.websiteUrl || '')}</p>
${review.description ? `<p>${escapeHtml(review.description)}</p>` : ''}
</div>
</section>
`;
}

function renderQuickRead(review) {
const summary = buildReviewSummary(review);
const topActions = Array.isArray(review.actionPlan) ? review.actionPlan.slice(0, 3) : [];

return `
<section class="quick-read">
<div>
<p class="eyebrow">Executive Summary</p>
<h3>${escapeHtml(summary.headline)}</h3>
<p>${escapeHtml(summary.detail)}</p>
</div>
${topActions.length ? `
<div>
<p class="eyebrow">Recommended First Fixes</p>
<ol>
${topActions.map(item => `<li>${escapeHtml(item.action)}</li>`).join('')}
</ol>
</div>
` : ''}
</section>
`;
}

function renderTopLeaks(review) {
const missing = getMissingSignals(review).slice(0, 3);
if (!missing.length) return '';

return `
<section>
<h3>Top Revenue Leaks</h3>
<div class="leak-list">
${missing.map(signal => `
<div class="leak-item">
<span>${escapeHtml(signal.categoryLabel || formatLabel(signal.category))}</span>
<strong>${escapeHtml(signal.label)}</strong>
<p>${escapeHtml(customerImpactForSignal(signal.id))}</p>
</div>
`).join('')}
</div>
</section>
`;
}

function renderCategoryScores(scores = []) {
if (!Array.isArray(scores) || !scores.length) return '';
return `
<section>
<h3>Audit Breakdown</h3>
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
<h3>Evidence Checked</h3>
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
<h3>Recommended Fixes</h3>
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

function renderFollowUpPrompt(review) {
const score = Number(review.overallScore || 0);
const message = score >= 8
? 'The site has a solid foundation. The next step is testing whether visitors are turning into calls, quotes, or bookings.'
: 'The next step is to fix the highest-friction enquiry paths first, then measure whether more visitors turn into calls, quotes, or bookings.';

return `
<section class="follow-up-block">
<h3>Suggested Next Step</h3>
<p>${escapeHtml(message)}</p>
</section>
`;
}

function buildReviewSummary(review) {
const score = Number(review.overallScore || 0);
const missing = getMissingSignals(review);
const missingLabels = missing.slice(0, 3).map(signal => signal.label.toLowerCase());
const businessName = review.businessName || review.title || 'This website';

if (score >= 8) {
return {
headline: `${businessName} has a strong website foundation.`,
detail: missingLabels.length
? `The main opportunities are ${formatSeries(missingLabels)}. These are polish items that could improve conversion, trust, and enquiry quality.`
: 'The key conversion, trust, SEO, copy, and technical signals are present. The next step is measuring whether visitors turn into calls, quotes, or bookings.',
};
}

if (score >= 5) {
return {
headline: `${businessName} has useful basics in place, but it is likely leaking some enquiries.`,
detail: missingLabels.length
? `The biggest gaps are ${formatSeries(missingLabels)}. Fixing those first should make the site easier to trust and easier to contact from.`
: 'The site has mixed signals. Review the priority fixes before investing in deeper website work.',
};
}

return {
headline: `${businessName} is probably losing website enquiries.`,
detail: missingLabels.length
? `Start with ${formatSeries(missingLabels)} before spending more on ads or traffic.`
: 'The site is missing several basic conversion and trust signals. Start with the action plan before adding new features.',
};
}

function buildShareSummary(review) {
const summary = buildReviewSummary(review);
const lines = [
`${review.businessName || review.title || 'Website'} - Website Revenue Readiness Report`,
`${review.websiteUrl || ''}`,
'',
`Overall score: ${review.overallScore ?? '-'} / 10`,
'',
summary.headline,
summary.detail,
];

const topLeaks = getMissingSignals(review).slice(0, 3);
if (topLeaks.length) {
lines.push('', 'Top revenue leaks:');
topLeaks.forEach((signal, index) => {
lines.push(`${index + 1}. ${signal.label}: ${customerImpactForSignal(signal.id)}`);
});
}

const topActions = Array.isArray(review.actionPlan) ? review.actionPlan.slice(0, 3) : [];
if (topActions.length) {
lines.push('', 'Recommended fixes:');
topActions.forEach((item, index) => {
lines.push(`${index + 1}. ${item.action}`);
});
}

lines.push('', 'Suggested next step: Review the highest-friction enquiry path first, then measure whether more visitors turn into calls, quotes, or bookings.');

return lines.join('\n').trim();
}

function getMissingSignals(review) {
return Array.isArray(review.signals)
? review.signals.filter(signal => signal.status === 'missing')
: [];
}

function customerImpactForSignal(id) {
const impacts = {
phoneVisibility: 'Customers who are ready to call may not find the fastest path to contact you, especially on mobile.',
primaryCta: 'Visitors may understand what you do but still leave without taking the next step.',
contactPath: 'Interested customers may have to work too hard to request a quote or ask for help.',
trustSignals: 'New visitors may hesitate if they cannot quickly see proof, reviews, licences, or guarantees.',
mobileReadiness: 'Mobile visitors may get a poor experience, which matters because many urgent searches happen on phones.',
afterHoursCapture: 'After-hours or busy-period enquiries may be lost instead of captured for follow-up.',
seoTitle: 'Searchers may not immediately understand the service, location, or reason to click.',
metaDescription: 'The site may be missing a chance to earn more clicks from search results.',
headingClarity: 'Visitors may not quickly understand what the business does and whether it fits their need.',
schemaMarkup: 'Search engines may have less structured business information to work with.',
schemaBusinessType: 'AI systems and search engines may not clearly recognise what type of business this is without a declared schema type.',
schemaContactDetails: 'Missing machine-readable name, address, or phone details can make it harder for AI systems to confirm core business facts.',
schemaSameAs: 'Without linked profiles, AI systems may treat this business as several different entities instead of one consistent one.',
schemaFaqPresent: 'Without FAQ schema, the business may miss chances to be quoted directly in AI-generated answers.',
gbpCategoryAccurate: 'Google may show the profile for the wrong searches if the category is too broad or inaccurate.',
gbpNapConsistent: 'Mismatched business details can quietly hurt local ranking and confuse customers checking details.',
gbpDescriptionComplete: 'An empty description is a missed chance to explain services before the customer even visits the website.',
gbpPhotosSufficient: 'A thin photo gallery can make the business look less established than nearby competitors.',
gbpReviewCountHealthy: 'A lower review count can make the business look less proven next to competitors in the map pack.',
gbpReviewRatingHealthy: 'A lower average rating can push potential customers toward a higher-rated competitor.',
gbpOwnerRespondsToReviews: 'Not replying to reviews can look less engaged than competitors who respond to every review.',
gbpAppearsInLocalPack: 'Missing the local 3-pack for core searches means losing visibility to competitors who do appear there.',
gbpCitationConsistency: 'Inconsistent directory listings can quietly work against local ranking and confuse customers.',
};
return impacts[id] || 'This gap may reduce trust, clarity, or enquiry conversion.';
}

function formatSeries(items) {
if (items.length <= 1) return items[0] || '';
if (items.length === 2) return `${items[0]} and ${items[1]}`;
return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
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

function showToast(message) {
toast.textContent = message;
toast.hidden = false;
window.clearTimeout(showToast.timeoutId);
showToast.timeoutId = window.setTimeout(() => {
toast.hidden = true;
}, 2200);
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
