require('dotenv').config();
const express = require('express');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const industryRouter = require('./agents/industry_router');
const reportEngine = require('./agents/report_engine');
const voiceAgent = require('./agents/voice_agent');
const transcriptCleaner = require('./agents/transcript_cleaner');
const callStore = require('./agents/call_store');
const workbookExporter = require('./agents/workbook_exporter');

const app = express();
app.use(express.json({ verify: (req, _res, buf) => { req.rawBody = buf; } }));
app.use(express.static(path.join(__dirname, 'public')));

const REVIEW_STATUSES = new Set(['draft', 'reviewed', 'sent']);

// GET /
// MVP audit workbench.
app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// GET /health
// Minimal health check for deployment platforms.
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

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

// POST /export/xlsx
// Body: { auditId, industry, businessName?, contactName?, phoneNumber?, transcript?, report }
// Returns an editable workbook for Excel or Google Sheets.
app.post('/export/xlsx', async (req, res) => {
  try {
    const { industry, report } = req.body;
    if (!industry || !report) {
      return res.status(400).json({ error: 'industry and report are required' });
    }

    const buffer = await workbookExporter.buildAuditWorkbookBuffer(req.body);
    const filename = workbookExporter.buildWorkbookFilename(req.body);
    res
      .status(200)
      .set({
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      })
      .send(Buffer.from(buffer));
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message });
  }
});

// POST /voice/call
// Body: { industry: string, businessName?: string, contactName?: string, phoneNumber: string }
// Starts an outbound Retell phone audit call and tracks its status in memory.
app.post('/voice/call', async (req, res) => {
  try {
    const { industry, businessName = '', contactName = '', phoneNumber } = req.body;
    if (!industry || !phoneNumber) {
      return res.status(400).json({ error: 'industry and phoneNumber are required' });
    }

    const config = industryRouter.resolve(industry);
    const call = await voiceAgent.createPhoneAuditCall({
      config,
      businessName,
      contactName,
      phoneNumber,
    });

    const saved = callStore.save(call.call_id, {
      status: call.call_status || 'registered',
      industry: config.id,
      businessName,
      contactName,
      phoneNumber,
      direction: call.direction || 'outbound',
      retell: call,
      createdAt: new Date().toISOString(),
    });

    res.status(201).json({ call: saved });
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message });
  }
});

// GET /voice/calls
// Lists recent in-memory call records captured during this server run.
app.get('/voice/calls', (_req, res) => {
  res.json({ calls: callStore.list() });
});

// GET /voice/calls/:callId
// Returns one in-memory call record.
app.get('/voice/calls/:callId', (req, res) => {
  const call = callStore.get(req.params.callId);
  if (!call) return res.status(404).json({ error: 'Call not found' });
  res.json({ call });
});

// PATCH /voice/calls/:callId/review
// Body: { reviewStatus?: "draft"|"reviewed"|"sent", reviewNotes?: string }
// Updates internal review/send workflow state for a completed report.
app.patch('/voice/calls/:callId/review', (req, res) => {
  try {
    const call = callStore.get(req.params.callId);
    if (!call) return res.status(404).json({ error: 'Call not found' });
    if (!call.report) return res.status(400).json({ error: 'Call does not have a report to review' });

    const { reviewStatus = call.reviewStatus || 'draft', reviewNotes = call.reviewNotes || '' } = req.body || {};
    if (!REVIEW_STATUSES.has(reviewStatus)) {
      return res.status(400).json({ error: 'reviewStatus must be draft, reviewed, or sent' });
    }

    const now = new Date().toISOString();
    const patch = {
      reviewStatus,
      reviewNotes: String(reviewNotes),
    };
    if (reviewStatus === 'reviewed') patch.reviewedAt = call.reviewedAt || now;
    if (reviewStatus === 'sent') {
      patch.reviewedAt = call.reviewedAt || now;
      patch.sentAt = call.sentAt || now;
    }

    const saved = callStore.save(call.callId, patch);
    res.json({ call: saved });
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

    const call = payload.call || {};
    const callId = call.call_id;
    callStore.save(callId, {
      status: payload.event,
      direction: call.direction,
      industry: call.metadata?.industry,
      businessName: call.metadata?.businessName,
      contactName: call.metadata?.contactName,
      phoneNumber: call.direction === 'inbound' ? call.from_number : call.to_number,
      retell: call,
    });

    if (payload.event === 'call_ended') {
      processEndedCall(call).catch(err => {
        console.error(err);
        callStore.save(callId, {
          status: 'report_error',
          error: err.message,
        });
      });
    }

    res.sendStatus(204);
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

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`ai-audit-system running on port ${PORT}`));
}

async function processEndedCall(call) {
  const { transcript, metadata = {}, call_id } = call;
  if (!transcript) {
    throw new Error('call.transcript is required');
  }

  callStore.save(call_id, { status: 'generating_report' });

  const cleaned = transcriptCleaner.clean(transcript);
  let config = null;
  if (metadata.industry) {
    try {
      config = industryRouter.resolve(metadata.industry);
    } catch (err) {
      console.warn(`Could not resolve metadata industry "${metadata.industry}"; falling back to transcript detection.`);
    }
  }
  if (!config) {
    config = industryRouter.detect(cleaned);
  }
  if (!config) {
    throw new Error('Could not detect industry from transcript and no metadata.industry fallback was provided');
  }

  const report = await reportEngine.generate({ config, transcript: cleaned });
  callStore.save(call_id, {
    status: 'report_ready',
    reviewStatus: 'draft',
    industry: config.id,
    transcript: cleaned,
    report,
    auditId: uuidv4(),
  });
}

module.exports = { app, processEndedCall };
