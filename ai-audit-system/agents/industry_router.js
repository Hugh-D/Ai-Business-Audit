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

module.exports = { resolve };
