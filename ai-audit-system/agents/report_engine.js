const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const BASE_PROMPT = fs.readFileSync(
  path.join(__dirname, '../prompts/base_report.txt'),
  'utf8'
);

// Generates a structured audit report from a cleaned transcript and industry config.
async function generate({ config, transcript }) {
  const systemPrompt = buildSystemPrompt(config);
  const userMessage = buildUserMessage(config, transcript);

  const response = await client.chat.completions.create({
    model: process.env.AUDIT_MODEL || 'gpt-4o',
    max_tokens: parseInt(process.env.AUDIT_MAX_TOKENS || '2000', 10),
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    response_format: { type: 'json_object' },
  });

  const raw = response.choices[0].message.content;
  return JSON.parse(raw);
}

function buildSystemPrompt(config) {
  return BASE_PROMPT
    .replace('{{INDUSTRY_LABEL}}', config.label)
    .replace('{{REPORT_SECTIONS}}', config.reportSections.join('\n- '))
    .replace('{{AUDIT_FOCUS}}', config.auditFocus.join('\n- '))
    .replace('{{SCORING_WEIGHTS}}', JSON.stringify(config.scoringWeights, null, 2));
}

function buildUserMessage(config, transcript) {
  return [
    `Industry: ${config.label}`,
    `Benchmarks: ${JSON.stringify(config.benchmarks)}`,
    '',
    '--- TRANSCRIPT ---',
    transcript,
    '--- END TRANSCRIPT ---',
    '',
    'Generate the audit report as a JSON object following the system prompt structure.',
  ].join('\n');
}

module.exports = { generate };
