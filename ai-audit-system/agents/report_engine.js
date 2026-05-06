const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const BASE_PROMPT = fs.readFileSync(
  path.join(__dirname, '../prompts/base_report.txt'),
  'utf8'
);

// Generates a structured audit report from a cleaned transcript and industry config.
async function generate({ config, transcript }) {
  const systemPrompt = buildSystemPrompt(config);
  const userMessage = buildUserMessage(config, transcript);

  const response = await client.messages.create({
    model: process.env.AUDIT_MODEL || 'claude-sonnet-4-20250514',
    max_tokens: parseInt(process.env.AUDIT_MAX_TOKENS || '2000', 10),
    system: systemPrompt,
    messages: [
      { role: 'user', content: userMessage },
    ],
  });

  const raw = response.content.find(b => b.type === 'text')?.text;
  if (!raw) throw new Error('No text content in Anthropic response');
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
