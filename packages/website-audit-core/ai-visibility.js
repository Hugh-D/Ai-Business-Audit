'use strict';

const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_MODEL = 'gpt-4o-mini';
const DEFAULT_TIMEOUT_MS = 15000;

const CATEGORY_SYSTEM_PROMPT = [
  'You are a helpful assistant answering questions about local businesses and services.',
  'Respond only in valid JSON with this exact structure:',
  '{"businesses":[{"name":"Full Business Name","description":"One sentence description"}]}.',
  'List real, specific businesses you know about for this query. Include up to 10.',
  'If you do not know any specific businesses, return {"businesses":[]}.',
].join(' ');

const DIRECT_SYSTEM_PROMPT = [
  'You are a helpful assistant answering questions about a specific business.',
  'Respond only in valid JSON with this exact structure:',
  '{"recognised":true,"name":"The business name as you know it","location":"City or area","services":["service1","service2"],"sentiment":"positive","description":"Brief description"}.',
  'Set recognised to false with empty fields if you do not recognise this business.',
  'For sentiment use exactly one of: positive, neutral, negative.',
].join(' ');

const QUERY_TEMPLATES = [
  { id: 'general', template: 'Who are the best {industry} in {location}?' },
  { id: 'urgent', template: 'I need an emergency {industry} in {location}' },
  { id: 'recommendation', template: 'Can you recommend a good {industry} near {location}?' },
  { id: 'reviews', template: 'Which {industry} in {location} have the best reviews?' },
];

const AI_VISIBILITY_SIGNALS = [
  {
    id: 'aiCategoryMentioned',
    category: 'aiDiscovery',
    label: 'Mentioned In AI Recommendations',
    found: (results) => results.categoryResults.some(r => r.mentioned),
    foundDetail: 'The business was mentioned when an AI assistant was asked about this type of service in this area.',
    missingDetail: 'The business was not mentioned when an AI assistant was asked about this type of service in this area.',
  },
  {
    id: 'aiMentionBreadth',
    category: 'aiDiscovery',
    label: 'Mentioned Across Query Types',
    found: (results) => {
      const mentioned = results.categoryResults.filter(r => r.mentioned).length;
      return mentioned >= Math.ceil(results.categoryResults.length / 2);
    },
    foundDetail: 'The business appeared in the majority of query variations tested.',
    missingDetail: 'The business appeared in fewer than half the query variations tested.',
  },
  {
    id: 'aiCompetitorPosition',
    category: 'aiDiscovery',
    label: 'Top 3 AI Position',
    found: (results) => {
      const positions = results.categoryResults
        .filter(r => r.mentioned && r.position > 0)
        .map(r => r.position);
      return positions.length > 0 && Math.min(...positions) <= 3;
    },
    foundDetail: 'The business appeared in the top 3 when AI listed options for this category.',
    missingDetail: 'The business was not in the top 3 in any AI category response.',
  },
  {
    id: 'aiDirectRecognised',
    category: 'aiAccuracy',
    label: 'Recognised By AI',
    found: (results) => Boolean(results.directResult?.recognised),
    foundDetail: 'The AI assistant recognised this business when asked about it directly.',
    missingDetail: 'The AI assistant did not recognise this business when asked about it directly.',
  },
  {
    id: 'aiNameAccurate',
    category: 'aiAccuracy',
    label: 'Name Accurately Represented',
    found: (results) => Boolean(results.directResult?.nameAccurate),
    foundDetail: 'The business name was accurately represented in the AI response.',
    missingDetail: 'The business name was inaccurate or missing in the AI response.',
  },
  {
    id: 'aiLocationAccurate',
    category: 'aiAccuracy',
    label: 'Location Accurately Represented',
    found: (results) => Boolean(results.directResult?.locationAccurate),
    foundDetail: 'The business location or service area was accurately described.',
    missingDetail: 'The business location or service area was inaccurate or missing from the AI response.',
  },
  {
    id: 'aiServicesAccurate',
    category: 'aiAccuracy',
    label: 'Services Accurately Represented',
    found: (results) => Boolean(results.directResult?.servicesAccurate),
    foundDetail: 'The services offered were accurately described by the AI assistant.',
    missingDetail: 'The services offered were inaccurate or missing from the AI response.',
  },
  {
    id: 'aiSentimentPositive',
    category: 'aiReputation',
    label: 'Positive AI Sentiment',
    found: (results) => results.directResult?.sentiment === 'positive',
    foundDetail: 'The AI assistant described this business in a positive or recommending tone.',
    missingDetail: 'The AI assistant did not describe this business positively.',
  },
];

const AI_VISIBILITY_CATEGORY_LABELS = {
  aiDiscovery: 'AI Discovery',
  aiAccuracy: 'AI Accuracy',
  aiReputation: 'AI Reputation',
};

const AI_VISIBILITY_ACTIONS = {
  aiCategoryMentioned: 'Strengthen the business presence across directories, review platforms, and structured data so AI systems have more signals to draw from.',
  aiMentionBreadth: 'Add content that addresses different customer intents: emergency, routine service, specific job types, and general recommendations.',
  aiCompetitorPosition: 'Improve prominence signals such as review volume, structured data completeness, and consistent directory listings to rank higher in AI responses.',
  aiDirectRecognised: 'Ensure the business has a consistent presence across Google Business Profile, directories, and its own website with structured data.',
  aiNameAccurate: 'Use the exact business name consistently across the website, structured data, Google Business Profile, and all directory listings.',
  aiLocationAccurate: 'Make the service area or location explicit on the website, in structured data, and across directory listings.',
  aiServicesAccurate: 'List specific services clearly on the website and in structured data so AI systems can accurately describe what the business offers.',
  aiSentimentPositive: 'Build review volume and quality, respond to reviews, and ensure the website communicates competence and reliability clearly.',
};

function buildQueries({ industry, location, services, customQueries }) {
  const queries = QUERY_TEMPLATES.map(t => ({
    id: t.id,
    query: t.template
      .replace('{industry}', industry)
      .replace('{location}', location),
  }));

  if (Array.isArray(services) && services.length) {
    services.slice(0, 3).forEach((service, i) => {
      queries.push({
        id: `service_${i}`,
        query: `Who can help with ${service} in ${location}?`,
      });
    });
  }

  if (Array.isArray(customQueries) && customQueries.length) {
    customQueries.slice(0, 5).forEach((query, i) => {
      queries.push({ id: `custom_${i}`, query: String(query).trim() });
    });
  }

  return queries.filter(q => q.query);
}

async function queryOpenAI({ messages, apiKey, fetchImpl, model, timeoutMs }) {
  const impl = fetchImpl || fetch;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs || DEFAULT_TIMEOUT_MS);

  try {
    const response = await impl(OPENAI_CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model || DEFAULT_MODEL,
        messages,
        response_format: { type: 'json_object' },
        temperature: 0.2,
        max_tokens: 1000,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`OpenAI API error ${response.status}: ${text.slice(0, 200)}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('No content in OpenAI response');
    return JSON.parse(content);
  } finally {
    clearTimeout(timeout);
  }
}

async function runCategoryQuery({ query, businessName, apiKey, fetchImpl }) {
  const parsed = await queryOpenAI({
    messages: [
      { role: 'system', content: CATEGORY_SYSTEM_PROMPT },
      { role: 'user', content: query },
    ],
    apiKey,
    fetchImpl,
  });

  const businesses = Array.isArray(parsed.businesses) ? parsed.businesses : [];
  const targetName = businessName.toLowerCase().trim();
  const matchIndex = businesses.findIndex(b => {
    if (!b.name) return false;
    const name = b.name.toLowerCase().trim();
    return name.includes(targetName) || targetName.includes(name);
  });

  return {
    mentioned: matchIndex >= 0,
    position: matchIndex >= 0 ? matchIndex + 1 : 0,
    competitorCount: matchIndex >= 0 ? businesses.length - 1 : businesses.length,
    competitors: businesses
      .filter((_, i) => i !== matchIndex)
      .map(b => b.name)
      .filter(Boolean),
  };
}

async function runDirectQuery({ businessName, location, industry, apiKey, fetchImpl }) {
  const parsed = await queryOpenAI({
    messages: [
      { role: 'system', content: DIRECT_SYSTEM_PROMPT },
      { role: 'user', content: `What can you tell me about ${businessName} in ${location}? They are in the ${industry} industry.` },
    ],
    apiKey,
    fetchImpl,
  });

  if (!parsed.recognised) {
    return {
      recognised: false,
      nameAccurate: false,
      locationAccurate: false,
      servicesAccurate: false,
      sentiment: 'neutral',
      description: '',
    };
  }

  const responseName = (parsed.name || '').toLowerCase().trim();
  const inputName = businessName.toLowerCase().trim();
  const nameAccurate = responseName.includes(inputName) || inputName.includes(responseName);

  return {
    recognised: true,
    nameAccurate,
    locationAccurate: Boolean(parsed.location && parsed.location.trim()),
    servicesAccurate: Array.isArray(parsed.services) && parsed.services.length > 0,
    sentiment: ['positive', 'neutral', 'negative'].includes(parsed.sentiment) ? parsed.sentiment : 'neutral',
    description: parsed.description || '',
  };
}

async function checkAiVisibility({ businessName, location, industry, services, customQueries, apiKey, fetchImpl }) {
  if (!apiKey) throw Object.assign(new Error('OPENAI_API_KEY is required for AI visibility checks'), { status: 400 });
  if (!businessName) throw Object.assign(new Error('businessName is required for AI visibility checks'), { status: 400 });
  if (!location) throw Object.assign(new Error('location is required for AI visibility checks'), { status: 400 });
  if (!industry) throw Object.assign(new Error('industry is required for AI visibility checks'), { status: 400 });

  const queries = buildQueries({ industry, location, services, customQueries });

  const categorySettled = await Promise.allSettled(
    queries.map(q => runCategoryQuery({ query: q.query, businessName, apiKey, fetchImpl }))
  );

  const categoryResults = categorySettled.map((result, i) => ({
    queryId: queries[i].id,
    query: queries[i].query,
    ...(result.status === 'fulfilled'
      ? result.value
      : { mentioned: false, position: 0, competitorCount: 0, competitors: [], error: result.reason?.message }),
  }));

  let directResult;
  try {
    directResult = await runDirectQuery({ businessName, location, industry, apiKey, fetchImpl });
  } catch (err) {
    directResult = {
      recognised: false,
      nameAccurate: false,
      locationAccurate: false,
      servicesAccurate: false,
      sentiment: 'neutral',
      description: '',
      error: err.message,
    };
  }

  return {
    categoryResults,
    directResult,
    provider: 'openai',
    model: DEFAULT_MODEL,
    queriedAt: new Date().toISOString(),
  };
}

function evaluateAiVisibilitySignals(results) {
  if (!results || !results.categoryResults) return [];

  return AI_VISIBILITY_SIGNALS.map((signal) => {
    const found = Boolean(signal.found(results));
    return {
      id: signal.id,
      category: signal.category,
      categoryLabel: AI_VISIBILITY_CATEGORY_LABELS[signal.category],
      label: signal.label,
      status: found ? 'found' : 'missing',
      detail: found ? signal.foundDetail : signal.missingDetail,
    };
  });
}

module.exports = {
  AI_VISIBILITY_SIGNALS,
  AI_VISIBILITY_CATEGORY_LABELS,
  AI_VISIBILITY_ACTIONS,
  QUERY_TEMPLATES,
  buildQueries,
  checkAiVisibility,
  evaluateAiVisibilitySignals,
};
