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
const deliveryAgent = require('./agents/delivery_agent');

const app = express();
app.use(express.json({ verify: (req, _res, buf) => { req.rawBody = buf; } }));
app.use(express.static(path.join(__dirname, 'public')));

const REVIEW_STATUSES = new Set(['draft', 'reviewed', 'sent']);
const FOLLOW_UP_STATUSES = new Set(['not_offered', 'declined', 'requested', 'booked', 'completed']);

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

// GET /readiness
// Summarizes local configuration needed for inbound audits, optional outbound testing, and delivery.
app.get('/readiness', (_req, res) => {
  res.json(buildReadiness());
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
// Starts an outbound Retell phone audit call and tracks its persisted status.
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
// Lists recent persisted call records.
app.get('/voice/calls', (_req, res) => {
  res.json({ calls: callStore.list() });
});

// GET /voice/calls/:callId
// Returns one persisted call record.
app.get('/voice/calls/:callId', (req, res) => {
  const call = callStore.get(req.params.callId);
  if (!call) return res.status(404).json({ error: 'Call not found' });
  res.json({ call });
});

// PATCH /voice/calls/:callId/review
// Body: review/delivery fields plus optional follow-up booking fields.
// Updates internal review, send, and follow-up workflow state for a completed report.
app.patch('/voice/calls/:callId/review', (req, res) => {
  try {
    const call = callStore.get(req.params.callId);
    if (!call) return res.status(404).json({ error: 'Call not found' });
    if (!call.report) return res.status(400).json({ error: 'Call does not have a report to review' });

    const {
      reviewStatus = call.reviewStatus || 'draft',
      reviewNotes = call.reviewNotes || '',
      recipientEmail = call.recipientEmail || '',
      websiteUrl = call.websiteUrl || '',
      deliveryNotes = call.deliveryNotes || '',
      followUpStatus = call.followUpStatus || 'not_offered',
      followUpPreferredTime = call.followUpPreferredTime || '',
      followUpScheduledFor = call.followUpScheduledFor || '',
      followUpNotes = call.followUpNotes || '',
    } = req.body || {};
    if (!REVIEW_STATUSES.has(reviewStatus)) {
      return res.status(400).json({ error: 'reviewStatus must be draft, reviewed, or sent' });
    }
    if (recipientEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(recipientEmail))) {
      return res.status(400).json({ error: 'recipientEmail must be a valid email address' });
    }
    const normalizedWebsiteUrl = normalizeWebsiteUrl(websiteUrl);
    if (websiteUrl && !normalizedWebsiteUrl) {
      return res.status(400).json({ error: 'websiteUrl must be a valid website address' });
    }
    if (!FOLLOW_UP_STATUSES.has(followUpStatus)) {
      return res.status(400).json({ error: 'followUpStatus must be not_offered, declined, requested, booked, or completed' });
    }
    if (followUpScheduledFor && Number.isNaN(Date.parse(String(followUpScheduledFor)))) {
      return res.status(400).json({ error: 'followUpScheduledFor must be a valid date and time' });
    }
    if (['booked', 'completed'].includes(followUpStatus) && !followUpScheduledFor) {
      return res.status(400).json({ error: 'followUpScheduledFor is required when followUpStatus is booked or completed' });
    }

    const now = new Date().toISOString();
    const patch = {
      reviewStatus,
      reviewNotes: String(reviewNotes),
      recipientEmail: String(recipientEmail),
      websiteUrl: normalizedWebsiteUrl,
      deliveryNotes: String(deliveryNotes),
      followUpStatus,
      followUpPreferredTime: String(followUpPreferredTime),
      followUpScheduledFor: String(followUpScheduledFor),
      followUpNotes: String(followUpNotes),
    };
    if (reviewStatus === 'reviewed') patch.reviewedAt = call.reviewedAt || now;
    if (reviewStatus === 'sent') {
      patch.reviewedAt = call.reviewedAt || now;
      patch.sentAt = call.sentAt || now;
    }
    if (['requested', 'booked', 'completed'].includes(followUpStatus)) {
      patch.followUpRequestedAt = call.followUpRequestedAt || now;
    }
    if (['booked', 'completed'].includes(followUpStatus)) {
      patch.followUpBookedAt = call.followUpBookedAt || now;
    }
    if (followUpStatus === 'completed') patch.followUpCompletedAt = call.followUpCompletedAt || now;

    const saved = callStore.save(call.callId, patch);
    res.json({ call: saved });
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message });
  }
});

// POST /voice/calls/:callId/deliver
// Sends the completed report workbook to the saved recipient email via SMTP.
app.post('/voice/calls/:callId/deliver', async (req, res) => {
  try {
    const call = callStore.get(req.params.callId);
    if (!call) return res.status(404).json({ error: 'Call not found' });
    if (!call.report) return res.status(400).json({ error: 'Call does not have a report to deliver' });
    if (!call.recipientEmail) return res.status(400).json({ error: 'recipientEmail is required before sending' });

    const audit = callToAudit(call);
    const workbookBuffer = await workbookExporter.buildAuditWorkbookBuffer(audit);
    const filename = workbookExporter.buildWorkbookFilename(audit);
    const delivery = await deliveryAgent.sendReportEmail({ call, workbookBuffer, filename });

    const now = new Date().toISOString();
    const saved = callStore.save(call.callId, {
      reviewStatus: 'sent',
      reviewedAt: call.reviewedAt || now,
      sentAt: now,
      lastDelivery: {
        messageId: delivery.messageId || null,
        accepted: delivery.accepted || [],
        rejected: delivery.rejected || [],
        sentAt: now,
      },
    });

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
    followUpStatus: 'not_offered',
    industry: config.id,
    transcript: cleaned,
    websiteUrl: normalizeWebsiteUrl(report.websiteUrl),
    report,
    auditId: uuidv4(),
  });
}

function callToAudit(call) {
  return {
    auditId: call.auditId || call.callId,
    callId: call.callId,
    industry: call.industry,
    businessName: call.businessName,
    contactName: call.contactName,
    phoneNumber: call.phoneNumber,
    transcript: call.transcript,
    reviewStatus: call.reviewStatus || 'draft',
    reviewNotes: call.reviewNotes || '',
    recipientEmail: call.recipientEmail || '',
    websiteUrl: call.websiteUrl || '',
    deliveryNotes: call.deliveryNotes || '',
    followUpStatus: call.followUpStatus || 'not_offered',
    followUpPreferredTime: call.followUpPreferredTime || '',
    followUpScheduledFor: call.followUpScheduledFor || '',
    followUpNotes: call.followUpNotes || '',
    followUpRequestedAt: call.followUpRequestedAt,
    followUpBookedAt: call.followUpBookedAt,
    followUpCompletedAt: call.followUpCompletedAt,
    reviewedAt: call.reviewedAt,
    sentAt: call.sentAt,
    report: call.report,
  };
}

function buildReadiness(env = process.env) {
  const checks = [
    readinessCheck({
      id: 'anthropic_api_key',
      label: 'Report generation',
      ready: voiceAgent.hasUsableEnvValue(env.ANTHROPIC_API_KEY),
      detail: 'ANTHROPIC_API_KEY is required for AI report generation.',
    }),
    readinessCheck({
      id: 'retell_api_key',
      label: 'Retell webhook access',
      ready: voiceAgent.hasUsableEnvValue(env.RETELL_API_KEY),
      detail: 'RETELL_API_KEY is required to verify completed-call webhooks from Retell.',
    }),
    readinessCheck({
      id: 'audit_phone_number',
      label: 'Public audit number',
      ready: voiceAgent.hasUsableEnvValue(env.AUDIT_PHONE_NUMBER),
      detail: 'AUDIT_PHONE_NUMBER must be the SIPcity/Retell number customers call for an assessment.',
    }),
    readinessCheck({
      id: 'retell_webhook_url',
      label: 'Public webhook URL',
      ready: voiceAgent.hasUsableEnvValue(env.RETELL_WEBHOOK_URL || env.PUBLIC_BASE_URL),
      detail: 'Set RETELL_WEBHOOK_URL to /webhook/retell, or PUBLIC_BASE_URL to the public app URL.',
    }),
    readinessCheck({
      id: 'retell_agent_id',
      label: 'Outbound test agent',
      ready: voiceAgent.hasUsableEnvValue(env.RETELL_AGENT_ID),
      detail: 'RETELL_AGENT_ID is needed only for the optional outbound test-call tool.',
      optional: true,
    }),
    readinessCheck({
      id: 'retell_from_number',
      label: 'Outbound test number',
      ready: voiceAgent.hasUsableEnvValue(env.RETELL_FROM_NUMBER),
      detail: 'RETELL_FROM_NUMBER is needed only for optional outbound test calls.',
      optional: true,
    }),
    readinessCheck({
      id: 'smtp_delivery',
      label: 'SMTP email delivery',
      ready: deliveryAgent.hasEmailConfig(env),
      detail: 'SMTP_HOST, SMTP_PORT, and SMTP_FROM are required for one-click email delivery.',
      optional: true,
    }),
  ];

  const byId = Object.fromEntries(checks.map(check => [check.id, check]));
  const readyForManualAudit = byId.anthropic_api_key.ready;
  const readyForInboundAudits = [
    byId.anthropic_api_key,
    byId.retell_api_key,
    byId.audit_phone_number,
    byId.retell_webhook_url,
  ].every(check => check.ready);

  return {
    status: readyForInboundAudits ? 'ready' : 'blocked',
    readyForManualAudit,
    readyForInboundAudits,
    readyForEmailDelivery: byId.smtp_delivery.ready,
    checks,
    nextSteps: buildReadinessNextSteps(checks, readyForInboundAudits, env.AUDIT_PHONE_NUMBER),
  };
}

function readinessCheck({ id, label, ready, detail, optional = false }) {
  return {
    id,
    label,
    status: ready ? 'ready' : optional ? 'optional' : 'missing',
    ready,
    optional,
    detail,
  };
}

function buildReadinessNextSteps(checks, readyForInboundAudits, auditPhoneNumber) {
  if (readyForInboundAudits) {
    return [`Call ${auditPhoneNumber} and confirm Retell posts the completed assessment to /webhook/retell.`];
  }

  return checks
    .filter(check => !check.ready && !check.optional)
    .map(check => check.detail);
}

function normalizeWebsiteUrl(value) {
  const input = String(value || '').trim();
  if (!input) return '';

  try {
    const url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(input) ? input : `https://${input}`);
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname.includes('.')) return '';
    return url.toString().replace(/\/$/, '');
  } catch (_err) {
    return '';
  }
}

module.exports = { app, processEndedCall, buildReadiness, normalizeWebsiteUrl };
