const test = require('node:test');
const assert = require('node:assert/strict');

const deliveryAgent = require('../agents/delivery_agent');

test('hasEmailConfig requires SMTP host, port, and from address', () => {
  assert.equal(deliveryAgent.hasEmailConfig({
    SMTP_HOST: 'smtp.example.com',
    SMTP_PORT: '587',
    SMTP_FROM: 'audit@example.com',
  }), true);

  assert.equal(deliveryAgent.hasEmailConfig({
    SMTP_HOST: 'smtp.example.com',
    SMTP_PORT: '587',
  }), false);
});

test('buildDeliveryMessage creates a client-ready email body', () => {
  const message = deliveryAgent.buildDeliveryMessage({
    industry: 'trades',
    businessName: 'Demo Plumbing Co',
    contactName: 'Sam',
    websiteUrl: 'https://demoplumbing.com.au',
    deliveryNotes: 'Book a follow-up consult next week.',
    report: {
      overallScore: 8,
      criticalGaps: ['Missed after-hours calls'],
      actionPlan: [{ action: 'Add missed-call follow-up automation.' }],
    },
  });

  assert.equal(message.subject, 'Trades audit report for Demo Plumbing Co');
  assert.match(message.text, /Hi Sam/);
  assert.match(message.text, /Missed after-hours calls/);
  assert.match(message.text, /https:\/\/demoplumbing\.com\.au/);
  assert.match(message.text, /Book a follow-up consult next week/);
  assert.match(message.text, /two-page Revenue and Operations Readiness Report/);
  assert.match(message.text, /decision aid, not a financial forecast/);
  assert.doesNotMatch(message.text, /workbook|spreadsheet/i);
});

test('getReviewEmail defaults to the review inbox and honours a real override', () => {
  assert.equal(deliveryAgent.getReviewEmail({}), 'volvesolutions@outlook.com');
  assert.equal(deliveryAgent.getReviewEmail({
    REVIEW_EMAIL: 'your_review_email_here',
  }), 'volvesolutions@outlook.com');
  assert.equal(deliveryAgent.getReviewEmail({
    REVIEW_EMAIL: 'owner@example.com',
  }), 'owner@example.com');
});

test('extractCustomerEmail prefers report and metadata fields, then the last transcript address', () => {
  assert.equal(deliveryAgent.extractCustomerEmail({
    metadata: { email: 'from-metadata@example.com' },
    report: { email: 'from-report@example.com' },
    transcript: 'Client: use transcript@example.com',
  }), 'from-metadata@example.com');

  assert.equal(deliveryAgent.extractCustomerEmail({
    report: { recipientEmail: 'From-Report@Example.com' },
    transcript: 'Client: older@example.com then newer@example.com',
  }), 'from-report@example.com');

  assert.equal(deliveryAgent.extractCustomerEmail({
    transcript: 'Agent: I have clay@outlook.com. Client: No, clare@outlook.com.',
    env: { REVIEW_EMAIL: 'volvesolutions@outlook.com' },
  }), 'clare@outlook.com');

  assert.equal(deliveryAgent.extractCustomerEmail({
    transcript: 'Please write to volvesolutions@outlook.com',
    env: {},
  }), '');
});

test('buildReviewMessage is a short internal note and does not offer the customer PDF', () => {
  const message = deliveryAgent.buildReviewMessage({
    callId: 'call_99',
    businessName: 'Green Stripe',
    recipientEmail: 'mia@example.com',
  });

  assert.equal(message.subject, 'Call finished for Green Stripe');
  assert.match(message.text, /Hi Hugh/);
  assert.match(message.text, /Green Stripe/);
  assert.match(message.text, /Call id: call_99/);
  assert.match(message.text, /spreadsheet is attached/);
  assert.match(message.text, /customer PDF is held until you send it/);
  assert.match(message.text, /has not been sent to the customer/);
  assert.match(message.text, /mia@example.com/);
  assert.doesNotMatch(message.text, /—|–|delve|crucial|leverage|utilise|streamline/i);
});

test('sendReviewEmail sends the spreadsheet only to the review inbox', async () => {
  const nodemailer = require('nodemailer');
  const previous = nodemailer.createTransport;
  let sent = null;
  nodemailer.createTransport = () => ({
    sendMail: async (message) => {
      sent = message;
      return { messageId: 'review_1', accepted: [message.to], rejected: [] };
    },
  });

  try {
    const result = await deliveryAgent.sendReviewEmail({
      call: {
        callId: 'call_1',
        businessName: 'Green Stripe',
        recipientEmail: 'mia@example.com',
      },
      workbookBuffer: Buffer.from('not-a-pdf'),
      filename: 'lawn-care-call-1.xlsx',
      env: {
        SMTP_HOST: 'smtp.example.com',
        SMTP_PORT: '587',
        SMTP_FROM: 'audit@example.com',
        REVIEW_EMAIL: 'volvesolutions@outlook.com',
      },
    });

    assert.equal(result.messageId, 'review_1');
    assert.equal(sent.to, 'volvesolutions@outlook.com');
    assert.notEqual(sent.to, 'mia@example.com');
    assert.equal(sent.attachments.length, 1);
    assert.equal(sent.attachments[0].filename, 'lawn-care-call-1.xlsx');
    assert.equal(
      sent.attachments[0].contentType,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    assert.equal(sent.attachments[0].content.toString(), 'not-a-pdf');
    assert.equal(sent.html, undefined);
  } finally {
    nodemailer.createTransport = previous;
  }
});

test('sendReviewEmail refuses to send when SMTP is missing', async () => {
  await assert.rejects(
    () => deliveryAgent.sendReviewEmail({
      call: { callId: 'call_2', businessName: 'Green Stripe' },
      workbookBuffer: Buffer.from('sheet'),
      env: {},
    }),
    (err) => err.code === 'SMTP_MISSING'
  );
});
