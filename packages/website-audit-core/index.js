const SIGNALS = [
  {
    id: 'phoneVisibility',
    category: 'conversion',
    label: 'Phone Visibility',
    found: html => /href=["']tel:/i.test(html) || /\b(?:\+?61|0|\(?0)[\s)-]?[2378][\s-]?\d{4}[\s-]?\d{4}\b/.test(html),
    foundDetail: 'A phone number or tap-to-call link appears on the page.',
    missingDetail: 'No obvious phone number or tap-to-call link was found on the page.',
  },
  {
    id: 'primaryCta',
    category: 'conversion',
    label: 'Primary Call To Action',
    found: (_html, text) => /\b(request|get|book|schedule|contact|enquire|enquiry|call)\b.{0,28}\b(quote|estimate|booking|call|visit|consult|service|now|us|help)\b/i.test(text),
    foundDetail: 'The page appears to have a clear action such as quote, booking, contact, or call.',
    missingDetail: 'No clear quote, booking, contact, or call action was detected.',
  },
  {
    id: 'contactPath',
    category: 'conversion',
    label: 'Contact Path',
    found: html => /<form\b/i.test(html) || /href=["'][^"']*(contact|mailto:)/i.test(html),
    foundDetail: 'The page appears to include a form, email link, or contact page link.',
    missingDetail: 'No form, email link, or obvious contact page link was detected.',
  },
  {
    id: 'trustSignals',
    category: 'trust',
    label: 'Trust Signals',
    found: (_html, text) => /\b(review|reviews|testimonial|testimonials|licensed|insured|guarantee|google rating|five star|5 star|years experience|family owned)\b/i.test(text),
    foundDetail: 'The page mentions reviews, testimonials, licensing, guarantees, or similar trust signals.',
    missingDetail: 'No obvious reviews, testimonials, licensing, or guarantee language was detected.',
  },
  {
    id: 'mobileReadiness',
    category: 'technical',
    label: 'Mobile Readiness',
    found: html => /<meta[^>]+name=["']viewport["']/i.test(html),
    foundDetail: 'The page includes a viewport tag for mobile-friendly rendering.',
    missingDetail: 'No viewport tag was detected, which can indicate weak mobile rendering.',
  },
  {
    id: 'afterHoursCapture',
    category: 'conversion',
    label: 'After-hours Lead Capture',
    found: (_html, text) => /\b(after hours|24\/7|24 hours|emergency|online form|request a quote|request quote|book online)\b/i.test(text),
    foundDetail: 'The page mentions after-hours, emergency, online form, or online booking capture.',
    missingDetail: 'No after-hours, emergency, online form, or online booking capture was detected.',
  },
  {
    id: 'seoTitle',
    category: 'seo',
    label: 'SEO Title',
    found: html => {
      const title = extractTitle(html);
      return title.length >= 20 && title.length <= 70;
    },
    foundDetail: 'The page title is present and within a useful search-result length range.',
    missingDetail: 'The page title is missing, very short, or likely too long for search results.',
  },
  {
    id: 'metaDescription',
    category: 'seo',
    label: 'Meta Description',
    found: html => {
      const description = extractMetaDescription(html);
      return description.length >= 50 && description.length <= 180;
    },
    foundDetail: 'The page has a meta description in a useful range for search snippets.',
    missingDetail: 'The page meta description is missing, too thin, or likely too long.',
  },
  {
    id: 'headingClarity',
    category: 'copy',
    label: 'Heading Clarity',
    found: html => extractHeadings(html, 'h1').some(heading => heading.length >= 8 && heading.length <= 90),
    foundDetail: 'The page has a reasonably clear primary heading.',
    missingDetail: 'No clear primary H1 heading was detected.',
  },
  {
    id: 'schemaMarkup',
    category: 'technical',
    label: 'Structured Data',
    found: html => /<script[^>]+type=["']application\/ld\+json["']/i.test(html),
    foundDetail: 'JSON-LD structured data appears in the page HTML.',
    missingDetail: 'No JSON-LD structured data was detected in the static page HTML.',
  },
];

const CATEGORY_LABELS = {
  conversion: 'Conversion',
  trust: 'Trust',
  technical: 'Technical',
  seo: 'SEO',
  copy: 'Copy',
};

async function reviewWebsite(websiteUrl, options = {}) {
  const normalizedUrl = normalizeWebsiteUrl(websiteUrl);
  if (!normalizedUrl) {
    const err = new Error('websiteUrl must be a valid website address');
    err.status = 400;
    throw err;
  }

  const fetchImpl = options.fetchImpl || fetch;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 8000);

  try {
    const response = await fetchImpl(normalizedUrl, {
      headers: {
        'User-Agent': 'AI-Business-Audit/1.0 website-review',
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: controller.signal,
    });
    const html = await response.text();
    return analyzeHtml({
      html,
      websiteUrl: normalizedUrl,
      statusCode: response.status,
      finalUrl: response.url || normalizedUrl,
      businessName: options.businessName,
      industry: options.industry,
    });
  } catch (err) {
    const wrapped = new Error(`Could not review website: ${err.name === 'AbortError' ? 'request timed out' : err.message}`);
    wrapped.status = 502;
    throw wrapped;
  } finally {
    clearTimeout(timeout);
  }
}

function analyzeHtml({ html, websiteUrl, statusCode = 200, finalUrl = websiteUrl, businessName = '', industry = '' }) {
  const source = String(html || '');
  const text = decodeEntities(stripHtml(source)).replace(/\s+/g, ' ').trim();
  const signals = SIGNALS.map(signal => {
    const found = Boolean(signal.found(source, text));
    return {
      id: signal.id,
      category: signal.category,
      categoryLabel: CATEGORY_LABELS[signal.category] || formatLabel(signal.category),
      label: signal.label,
      status: found ? 'found' : 'missing',
      detail: found ? signal.foundDetail : signal.missingDetail,
    };
  });

  const foundSignals = signals.filter(signal => signal.status === 'found');
  const missingSignals = signals.filter(signal => signal.status === 'missing');

  return {
    websiteUrl: normalizeWebsiteUrl(finalUrl || websiteUrl),
    businessName: String(businessName || '').trim(),
    industry: String(industry || '').trim(),
    checkedAt: new Date().toISOString(),
    statusCode,
    title: extractTitle(source),
    description: extractMetaDescription(source),
    h1: extractHeadings(source, 'h1')[0] || '',
    logoUrl: extractLogoUrl(source, finalUrl || websiteUrl),
    overallScore: calculateScore(signals),
    categoryScores: calculateCategoryScores(signals),
    signals,
    strengths: foundSignals.map(signal => signal.detail),
    opportunities: missingSignals.map(signal => signal.detail),
    actionPlan: buildActionPlan(missingSignals),
  };
}

function calculateScore(signals) {
  if (!signals.length) return 0;
  return Math.round((signals.filter(signal => signal.status === 'found').length / signals.length) * 10);
}

function calculateCategoryScores(signals) {
  return Object.entries(CATEGORY_LABELS).map(([category, label]) => {
    const categorySignals = signals.filter(signal => signal.category === category);
    return {
      category,
      label,
      score: calculateScore(categorySignals),
      found: categorySignals.filter(signal => signal.status === 'found').length,
      total: categorySignals.length,
    };
  }).filter(item => item.total > 0);
}

function buildActionPlan(missingSignals) {
  return missingSignals.slice(0, 5).map((signal) => ({
    priority: signal.category === 'conversion' ? 'High' : 'Medium',
    category: signal.categoryLabel,
    action: actionForSignal(signal.id),
    evidence: signal.detail,
  }));
}

function actionForSignal(id) {
  const actions = {
    phoneVisibility: 'Make the phone number highly visible and add tap-to-call links on mobile.',
    primaryCta: 'Add one obvious primary action such as Request a Quote, Book a Call, or Call Now.',
    contactPath: 'Add a simple contact or quote path with only the fields needed to respond.',
    trustSignals: 'Add trust proof near key decision points: reviews, licences, guarantees, or real testimonials.',
    mobileReadiness: 'Add mobile viewport support and verify the page works cleanly on phones.',
    afterHoursCapture: 'Add an after-hours lead capture option such as online booking, quote form, or call-back request.',
    seoTitle: 'Rewrite the page title so it clearly includes the service, location or audience, and brand.',
    metaDescription: 'Write a concise meta description that explains the offer and gives a reason to click.',
    headingClarity: 'Use a clear H1 that says what the business does and who it helps.',
    schemaMarkup: 'Add LocalBusiness or Organization JSON-LD that matches the visible business details.',
  };
  return actions[id] || 'Review and improve this website signal.';
}

function normalizeWebsiteUrl(value) {
  const input = String(value || '').trim();
  if (!input) return '';

  try {
    const url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(input) ? input : `https://${input}`);
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname.includes('.')) return '';
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  } catch (_err) {
    return '';
  }
}

function extractTitle(html) {
  const match = String(html).match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? decodeEntities(stripHtml(match[1])).trim() : '';
}

function extractMetaDescription(html) {
  const match = String(html).match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)
    || String(html).match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
  return match ? decodeEntities(match[1]).trim() : '';
}

function extractHeadings(html, tagName) {
  const pattern = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'gi');
  return Array.from(String(html).matchAll(pattern))
    .map(match => decodeEntities(stripHtml(match[1])).replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function extractLogoUrl(html, baseUrl) {
  const iconMatch = String(html).match(/<link[^>]+rel=["'][^"']*(?:icon|apple-touch-icon)[^"']*["'][^>]+href=["']([^"']+)["']/i);
  if (iconMatch) return resolveUrl(iconMatch[1], baseUrl);

  const imgMatch = String(html).match(/<img[^>]+(?:alt|class|id)=["'][^"']*logo[^"']*["'][^>]+src=["']([^"']+)["']/i)
    || String(html).match(/<img[^>]+src=["']([^"']+)["'][^>]+(?:alt|class|id)=["'][^"']*logo[^"']*["']/i);
  return imgMatch ? resolveUrl(imgMatch[1], baseUrl) : '';
}

function resolveUrl(value, baseUrl) {
  try {
    return new URL(value, baseUrl).toString();
  } catch (_err) {
    return '';
  }
}

function stripHtml(value) {
  return String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
}

function decodeEntities(value) {
  return String(value)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function formatLabel(value) {
  return String(value)
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

module.exports = {
  SIGNALS,
  analyzeHtml,
  normalizeWebsiteUrl,
  reviewWebsite,
};
