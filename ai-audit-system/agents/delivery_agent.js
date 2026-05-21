const nodemailer = require('nodemailer');

function hasEmailConfig(env = process.env) {
  return Boolean(
    hasUsableEnvValue(env.SMTP_HOST) &&
    hasUsableEnvValue(env.SMTP_PORT) &&
    hasUsableEnvValue(env.SMTP_FROM)
  );
}

async function sendReportEmail({ call, workbookBuffer, filename }) {
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

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: String(process.env.SMTP_SECURE || '').toLowerCase() === 'true',
    auth: hasUsableEnvValue(process.env.SMTP_USER)
      ? {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS || '',
        }
      : undefined,
  });

  const message = buildDeliveryMessage(call);
  return transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: call.recipientEmail,
    subject: message.subject,
    text: message.text,
    attachments: [
      {
        filename,
        content: Buffer.from(workbookBuffer),
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
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
    call.deliveryNotes ? `Notes:\n${call.deliveryNotes}` : '',
    'I have attached the editable audit workbook with the detailed scores, findings, and action plan.',
    '',
    'Best,',
  ].filter(Boolean).join('\n');

  return { subject, text };
}

function hasUsableEnvValue(value) {
  return Boolean(value && !String(value).startsWith('your_') && !String(value).endsWith('_here'));
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
  hasEmailConfig,
  sendReportEmail,
};
