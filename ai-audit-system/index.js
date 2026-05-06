require('dotenv').config();
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const industryRouter = require('./agents/industry_router');
const reportEngine = require('./agents/report_engine');
const voiceAgent = require('./agents/voice_agent');
const transcriptCleaner = require('./agents/transcript_cleaner');

const app = express();
app.use(express.json({ verify: (req, _res, buf) => { req.rawBody = buf; } }));

// POST /audit
// Body: { industry: string, transcript: string }
// Returns a structured audit report for the given industry and raw transcript.
app.post('/audit', async (req, res) => {
  try {
    const { industry, transcript } = req.body;
    if (!industry || !transcript) {
      return res.status(400).json({ error: 'industry and transcript are required' });
    }

    const config = industryRouter.resolve(industry);
    const cleaned = transcriptCleaner.clean(transcript);
    const report = await reportEngine.generate({ config, transcript: cleaned });

    res.json({ auditId: uuidv4(), industry: config.id, report });
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message });
  }
});

// POST /voice/session
// Body: { industry: string }
// Returns a system prompt and config scoped to the industry for a voice session.
app.post('/voice/session', async (req, res) => {
  try {
    const { industry } = req.body;
    if (!industry) return res.status(400).json({ error: 'industry is required' });

    const config = industryRouter.resolve(industry);
    const session = await voiceAgent.createSession(config);

    res.json({ sessionId: uuidv4(), ...session });
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message });
  }
});

// POST /webhook/retell
// Retell.ai POSTs here on call events. Only call_ended carries a completed transcript.
// The industry must be set in call.metadata.industry when creating the Retell call.
app.post('/webhook/retell', async (req, res) => {
  try {
    const signature = req.headers['x-retell-signature'];
    const payload = voiceAgent.parseRetellWebhook(req.rawBody, signature);

    if (payload.event !== 'call_ended') return res.sendStatus(200);

    const { transcript, metadata = {}, call_id } = payload.call;

    if (!transcript || !metadata.industry) {
      return res.status(400).json({
        error: 'call.transcript and call.metadata.industry are required',
      });
    }

    const config = industryRouter.resolve(metadata.industry);
    const cleaned = transcriptCleaner.clean(transcript);
    const report = await reportEngine.generate({ config, transcript: cleaned });

    res.json({ auditId: uuidv4(), callId: call_id, industry: config.id, report });
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message });
  }
});

// GET /industries
// Lists all available industry slugs.
app.get('/industries', (_req, res) => {
  const industries = require('./industries').list();
  res.json({ industries });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`ai-audit-system running on port ${PORT}`));
