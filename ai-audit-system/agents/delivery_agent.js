const net = require('net');
const nodemailer = require('nodemailer');

const DEFAULT_REVIEW_EMAIL = 'volvesolutions@outlook.com';
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const XLSX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function hasEmailConfig(env = process.env) {
  return Boolean(
    hasUsableEnvValue(env.SMTP_HOST) &&
    hasUsableEnvValue(env.SMTP_PORT) &&
    hasUsableEnvValue(env.SMTP_FROM)
  );
}

function getReviewEmail(env = process.env) {
  const configured = String(env.REVIEW_EMAIL || '').trim();
  if (hasUsableEnvValue(configured) && isEmailAddress(configured)) {
    return configured;
  }
  return DEFAULT_REVIEW_EMAIL;
}

function extractCustomerEmail({ metadata = {}, report = {}, transcript = '', env = process.env } = {}) {
  const blocked = new Set([getReviewEmail(env).toLowerCase()]);
  const fromAddress = firstEmailAddress(env.SMTP_FROM);
  if (fromAddress) blocked.add(fromAddress);

  const structured = [
    metadata.email,
    metadata.recipientEmail,
    metadata.contactEmail,
    report.email,
    report.recipientEmail,
    report.contactEmail,
  ];
  for (const value of structured) {
    const email = customerEmail(value, blocked);
    if (email) return email;
  }

  const matches = String(transcript || '').match(EMAIL_PATTERN) || [];
  for (let index = matches.length - 1; index >= 0; index -= 1) {
    const email = customerEmail(matches[index], blocked);
    if (email) return email;
  }
  return '';
}

async function sendReportEmail({ call, pdfBuffer, filename }) {
  if (!call?.recipientEmail) {
    const err = new Error('recipientEmail is required before sending');
    err.status = 400;
    throw err;
  }
  if (!hasEmailConfig()) {
    const err = new Error('SMTP email delivery is not configured');
    err.status = 500;
    throw err;
  }

  if (!pdfBuffer) {
    const err = new Error('report PDF is required before sending');
    err.status = 500;
    throw err;
  }

  const message = buildDeliveryMessage(call);
  return createTransport().sendMail({
    from: process.env.SMTP_FROM,
    to: call.recipientEmail,
    subject: message.subject,
    text: message.text,
    attachments: [
      {
        filename: filename || 'revenue-operations-readiness-report.pdf',
        content: Buffer.from(pdfBuffer),
        contentType: 'application/pdf',
      },
    ],
  });
}

async function sendReviewEmail({ call, workbookBuffer, filename, env = process.env }) {
  if (!hasEmailConfig(env)) {
    const err = new Error('Review email skipped because SMTP is missing');
    err.code = 'SMTP_MISSING';
    err.status = 500;
    throw err;
  }
  if (!workbookBuffer) {
    const err = new Error('review spreadsheet is required before sending');
    err.status = 500;
    throw err;
  }

  const message = buildReviewMessage(call);
  return createTransport(env).sendMail({
    from: env.SMTP_FROM,
    to: getReviewEmail(env),
    subject: message.subject,
    text: message.text,
    attachments: [
      {
        filename: filename || 'audit-review.xlsx',
        content: Buffer.from(workbookBuffer),
        contentType: XLSX_CONTENT_TYPE,
      },
    ],
  });
}

function buildDeliveryMessage(call) {
  const report = call.report || {};
  const business = call.businessName || call.contactName || 'your business';
  const subject = `${formatLabel(call.industry || 'Business')} audit report for ${business}`;
  const gaps = firstItems(report.criticalGaps, 3).map(item => `- ${item}`).join('\n');
  const actions = firstItems(report.actionPlan, 3)
    .map(item => `- ${item.action || item}`)
    .join('\n');

  const text = [
    `Hi ${call.contactName || 'there'},`,
    '',
    'Thanks again for taking the time to complete the AI Business Audit.',
    '',
    `Your overall readiness score is ${report.overallScore ?? '-'}/10.`,
    '',
    gaps ? `The biggest opportunities we identified:\n${gaps}` : '',
    actions ? `Recommended next actions:\n${actions}` : '',
    call.websiteUrl ? `Website noted for assessment context: ${call.websiteUrl}` : '',
    call.deliveryNotes ? `Notes:\n${call.deliveryNotes}` : '',
    'I have attached your two-page Revenue and Operations Readiness Report.',
    'The score is a decision aid, not a financial forecast.',
    '',
    'Best,',
  ].filter(Boolean).join('\n');

  return { subject, text };
}

function buildReviewMessage(call) {
  const business = String(call?.businessName || '').trim();
  const callId = call?.callId || 'unknown';
  const subject = business ? `Call finished for ${business}` : 'Call finished, review needed';
  const lines = [
    'Hi Hugh,',
    '',
    business
      ? `A call has just finished for ${business}.`
      : 'A call has just finished.',
    `Call id: ${callId}.`,
    '',
    'The spreadsheet is attached for your review.',
    'The customer PDF is held until you send it. It has not been sent to the customer.',
  ];
  if (call?.recipientEmail) {
    lines.push('', `Customer email on file: ${call.recipientEmail}.`);
  }
  lines.push('', 'Best,');
  return { subject, text: lines.join('\n') };
}

function createTransport(env = process.env) {
  const transport = {
    host: env.SMTP_HOST,
    port: Number(env.SMTP_PORT),
    secure: String(env.SMTP_SECURE || '').toLowerCase() === 'true',
    // Railway has no IPv6 route. Nodemailer 8 ignores this flag in its own
    // resolver, so getSocket below opens the connection with family 4.
    family: 4,
    auth: hasUsableEnvValue(env.SMTP_USER)
      ? {
          user: env.SMTP_USER,
          pass: env.SMTP_PASS || '',
        }
      : undefined,
  };

  transport.getSocket = (_options, callback) => {
    const socket = net.connect({
      host: transport.host,
      port: transport.port,
      family: transport.family,
    });
    const fail = (err) => {
      socket.removeListener('connect', ready);
      socket.destroy();
      callback(err);
    };
    const ready = () => {
      socket.removeListener('error', fail);
      // Plain socket. secure:false stays STARTTLS; secure:true is upgraded by nodemailer.
      callback(null, { connection: socket });
    };
    socket.once('error', fail);
    socket.once('connect', ready);
  };

  return nodemailer.createTransport(transport);
}

function hasUsableEnvValue(value) {
  return Boolean(value && !String(value).startsWith('your_') && !String(value).endsWith('_here'));
}

function isEmailAddress(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

function firstEmailAddress(value) {
  const match = String(value || '').match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match ? match[0].toLowerCase() : '';
}

function customerEmail(value, blocked) {
  const email = firstEmailAddress(value);
  if (!email || !isEmailAddress(email) || blocked.has(email)) return '';
  return email;
}

function firstItems(value, count) {
  return Array.isArray(value) ? value.filter(Boolean).slice(0, count) : [];
}

function formatLabel(value) {
  return String(value)
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

module.exports = {
  buildDeliveryMessage,
  buildReviewMessage,
  extractCustomerEmail,
  getReviewEmail,
  hasEmailConfig,
  sendReportEmail,
  sendReviewEmail,
};
