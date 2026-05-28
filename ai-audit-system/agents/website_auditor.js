const SIGNALS = [
  {
    id: 'phoneVisibility',
    label: 'Phone Visibility',
    found: html => /href=["']tel:/i.test(html) || /\b(?:\+?61|0)[\s-]?[2378][\s-]?\d{4}[\s-]?\d{4}\b/.test(html),
    foundDetail: 'A phone number or tap-to-call link appears on the page.',
    missingDetail: 'No obvious phone number or tap-to-call link was found on the page.',
  },
  {
    id: 'primaryCta',
    label: 'Primary Call To Action',
    found: (_html, text) => /\b(request|get|book|schedule|contact|enquire|enquiry|call)\b.{0,24}\b(quote|estimate|booking|call|visit|consult|service|now|us)\b/i.test(text),
    foundDetail: 'The page appears to have a clear action such as quote, booking, contact, or call.',
    missingDetail: 'No clear quote, booking, contact, or call action was detected.',
  },
  {
    id: 'contactPath',
    label: 'Contact Path',
    found: html => /<form\b/i.test(html) || /href=["'][^"']*(contact|mailto:)/i.test(html),
    foundDetail: 'The page appears to include a form, email link, or contact page link.',
    missingDetail: 'No form, email link, or obvious contact page link was detected.',
  },
  {
    id: 'trustSignals',
    label: 'Trust Signals',
    found: (_html, text) => /\b(review|reviews|testimonial|testimonials|licensed|insured|guarantee|google rating|five star|5 star)\b/i.test(text),
    foundDetail: 'The page mentions reviews, testimonials, licensing, guarantees, or similar trust signals.',
    missingDetail: 'No obvious reviews, testimonials, licensing, or guarantee language was detected.',
  },
  {
    id: 'mobileReadiness',
    label: 'Mobile Readiness',
    found: html => /<meta[^>]+name=["']viewport["']/i.test(html),
    foundDetail: 'The page includes a viewport tag for mobile-friendly rendering.',
    missingDetail: 'No viewport tag was detected, which can indicate weak mobile rendering.',
  },
  {
    id: 'afterHoursCapture',
    label: 'After-hours Lead Capture',
    found: (_html, text) => /\b(after hours|24\/7|24 hours|emergency|online form|request a quote|request quote|book online)\b/i.test(text),
    foundDetail: 'The page mentions after-hours, emergency, online form, or online booking capture.',
    missingDetail: 'No after-hours, emergency, online form, or online booking capture was detected.',
  },
];

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
    });
  } catch (err) {
    const wrapped = new Error(`Could not review website: ${err.name === 'AbortError' ? 'request timed out' : err.message}`);
    wrapped.status = 502;
    throw wrapped;
  } finally {
    clearTimeout(timeout);
  }
}

function analyzeHtml({ html, websiteUrl, statusCode = 200, finalUrl = websiteUrl }) {
  const source = String(html || '');
  const text = decodeEntities(stripHtml(source)).replace(/\s+/g, ' ').trim();
  const signals = SIGNALS.map(signal => {
    const found = Boolean(signal.found(source, text));
    return {
      id: signal.id,
      label: signal.label,
      status: found ? 'found' : 'missing',
      detail: found ? signal.foundDetail : signal.missingDetail,
    };
  });

  const foundSignals = signals.filter(signal => signal.status === 'found');
  const missingSignals = signals.filter(signal => signal.status === 'missing');

  return {
    websiteUrl: normalizeWebsiteUrl(finalUrl || websiteUrl),
    checkedAt: new Date().toISOString(),
    statusCode,
    title: extractTitle(source),
    description: extractMetaDescription(source),
    logoUrl: extractLogoUrl(source, finalUrl || websiteUrl),
    signals,
    strengths: foundSignals.map(signal => signal.detail),
    opportunities: missingSignals.map(signal => signal.detail),
  };
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

module.exports = {
  analyzeHtml,
  normalizeWebsiteUrl,
  reviewWebsite,
};
