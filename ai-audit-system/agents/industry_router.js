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


function resolve(industryInput) {
  const normalized = industryInput.trim().toLowerCase().replace(/[-\s]+/g, '_');
  const aliased = ALIASES[industryInput.trim().toLowerCase()] || normalized;
  return industries.get(aliased);
}

// Scores transcript content against each industry's detectionKeywords and returns
// the best-matching config, or null if no keywords matched.
// The keyword list is read directly from each industry's JSON config, so adding
// a new industry JSON with detectionKeywords requires no code changes here.
function detect(transcript) {
  const lower = transcript.toLowerCase();
  const all = industries.list();
  let best = null;
  let bestScore = 0;

  for (const id of all) {
    const config = industries.get(id);
    const keywords = config.detectionKeywords || [];
    const score = keywords.reduce((n, kw) => n + (lower.includes(kw) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      best = config;
    }
  }

  return bestScore > 0 ? best : null;
}

module.exports = { resolve, detect };
