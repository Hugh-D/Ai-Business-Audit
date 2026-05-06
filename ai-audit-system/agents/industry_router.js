const industries = require('../industries');

// Maps an incoming industry identifier to its config object.
// Accepts exact IDs ("realtors") or common aliases ("real estate" → "realtors").
const ALIASES = {
  'real estate': 'realtors',
  'realtor': 'realtors',
  'landscaping': 'lawn_care',
  'lawn': 'lawn_care',
  'plumbing': 'trades',
  'hvac': 'trades',
  'electrical': 'trades',
  'roofing': 'trades',
};

// Domain keywords used to detect industry from transcript content.
// Add entries here when a new industry JSON is introduced.
const INDUSTRY_KEYWORDS = {
  realtors: [
    'listing', 'buyer', 'seller', 'realtor', 'agent', 'property', 'properties',
    'closing', 'escrow', 'mortgage', 'open house', 'mls', 'commission',
    'days on market', 'home', 'real estate', 'contract', 'offer',
  ],
  trades: [
    'plumber', 'plumbing', 'electrician', 'electrical', 'hvac', 'roofer', 'roofing',
    'technician', 'dispatch', 'service call', 'membership', 'maintenance plan',
    'warranty', 'callback', 'furnace', 'wiring', 'install', 'repair',
  ],
  lawn_care: [
    'lawn', 'grass', 'mowing', 'mow', 'landscaping', 'landscape', 'aeration',
    'fertilization', 'fertilizer', 'seasonal', 'crew', 'mulch', 'trimming',
    'irrigation', 'sprinkler', 'quote', 'estimate',
  ],
};

function resolve(industryInput) {
  const normalized = industryInput.trim().toLowerCase().replace(/[-\s]+/g, '_');
  const aliased = ALIASES[industryInput.trim().toLowerCase()] || normalized;
  return industries.get(aliased);
}

// Scores transcript content against each industry's keyword set and returns
// the best-matching config, or null if no keywords matched.
function detect(transcript) {
  const lower = transcript.toLowerCase();
  let best = null;
  let bestScore = 0;

  for (const [id, keywords] of Object.entries(INDUSTRY_KEYWORDS)) {
    const score = keywords.reduce((n, kw) => n + (lower.includes(kw) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      best = id;
    }
  }

  if (!best) return null;
  try {
    return industries.get(best);
  } catch {
    return null;
  }
}

module.exports = { resolve, detect };
