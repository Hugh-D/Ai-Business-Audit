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

  assert.equal(deliveryAgent.hasEmailConfig({
    RESEND_API_KEY: 're_test_key',
  }), true);

  assert.equal(deliveryAgent.hasEmailConfig({
    RESEND_API_KEY: 'your_resend_api_key',
    SMTP_HOST: 'smtp.example.com',
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

test('SMTP transport uses an IPv4 socket and keeps port 587 on STARTTLS', async () => {
  const { EventEmitter } = require('events');
  const net = require('net');
  const nodemailer = require('nodemailer');
  const previousTransport = nodemailer.createTransport;
  const previousConnect = net.connect;
  let options = null;
  nodemailer.createTransport = (opts) => {
    options = opts;
    return {
      sendMail: async (message) => ({ messageId: 'ipv4_1', accepted: [message.to], rejected: [] }),
    };
  };

  try {
    await deliveryAgent.sendReviewEmail({
      call: { callId: 'call_ipv4', businessName: 'Green Stripe' },
      workbookBuffer: Buffer.from('sheet'),
      filename: 'review.xlsx',
      env: {
        SMTP_HOST: 'smtp-mail.outlook.com',
        SMTP_PORT: '587',
        SMTP_USER: 'volvesolutions@outlook.com',
        SMTP_PASS: 'test-pass',
        SMTP_FROM: 'volvesolutions@outlook.com',
      },
    });

    assert.equal(options.family, 4);
    assert.equal(options.host, 'smtp-mail.outlook.com');
    assert.equal(options.port, 587);
    assert.equal(options.secure, false);
    assert.deepEqual(options.auth, {
      user: 'volvesolutions@outlook.com',
      pass: 'test-pass',
    });

    let connectOpts = null;
    net.connect = (opts) => {
      connectOpts = opts;
      const socket = new EventEmitter();
      socket.destroy = () => {};
      process.nextTick(() => socket.emit('connect'));
      return socket;
    };

    const socketOptions = await new Promise((resolve, reject) => {
      options.getSocket({}, (err, result) => (err ? reject(err) : resolve(result)));
    });

    assert.deepEqual(connectOpts, {
      host: 'smtp-mail.outlook.com',
      port: 587,
      family: 4,
    });
    assert.ok(socketOptions.connection);
    assert.equal(socketOptions.secured, undefined);
  } finally {
    nodemailer.createTransport = previousTransport;
    net.connect = previousConnect;
  }
});

test('sendReviewEmail prefers Resend HTTPS even when SMTP is also configured', async () => {
  const nodemailer = require('nodemailer');
  const previous = nodemailer.createTransport;
  let transportCalls = 0;
  let captured = null;
  nodemailer.createTransport = () => {
    transportCalls += 1;
    throw new Error('SMTP must not be used when RESEND_API_KEY is set');
  };
  const fetchImpl = async (url, options) => {
    captured = { url, options };
    return {
      ok: true,
      status: 200,
      json: async () => ({ id: 're_email_1' }),
    };
  };

  try {
    const workbook = Buffer.from('not-a-pdf');
    const result = await deliveryAgent.sendReviewEmail({
      call: {
        callId: 'call_1',
        businessName: 'Green Stripe',
        recipientEmail: 'mia@example.com',
      },
      workbookBuffer: workbook,
      filename: 'lawn-care-call-1.xlsx',
      env: {
        RESEND_API_KEY: 're_test_key',
        RESEND_FROM: 'Volve Solutions <reviews@example.com>',
        SMTP_HOST: 'smtp.example.com',
        SMTP_PORT: '587',
        SMTP_FROM: 'audit@example.com',
        REVIEW_EMAIL: 'volvesolutions@outlook.com',
      },
      fetchImpl,
    });

    assert.equal(transportCalls, 0);
    assert.equal(result.messageId, 're_email_1');
    assert.deepEqual(result.accepted, ['volvesolutions@outlook.com']);
    assert.deepEqual(result.rejected, []);
    assert.equal(captured.url, 'https://api.resend.com/emails');
    assert.equal(captured.options.method, 'POST');
    assert.equal(captured.options.headers.Authorization, 'Bearer re_test_key');
    assert.equal(captured.options.headers['Content-Type'], 'application/json');
    const body = JSON.parse(captured.options.body);
    assert.equal(body.from, 'Volve Solutions <reviews@example.com>');
    assert.deepEqual(body.to, ['volvesolutions@outlook.com']);
    assert.equal(body.subject, 'Call finished for Green Stripe');
    assert.match(body.text, /spreadsheet is attached/);
    assert.match(body.text, /customer PDF is held until you send it/);
    assert.equal(body.html, undefined);
    assert.equal(body.attachments.length, 1);
    assert.equal(body.attachments[0].filename, 'lawn-care-call-1.xlsx');
    assert.equal(body.attachments[0].content, workbook.toString('base64'));
    assert.equal(
      body.attachments[0].content_type,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    assert.notEqual(body.to[0], 'mia@example.com');
  } finally {
    nodemailer.createTransport = previous;
  }
});

test('sendReviewEmail uses SMTP_FROM then the review inbox when RESEND_FROM is unset', async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push(JSON.parse(options.body).from);
    return { ok: true, status: 200, json: async () => ({ id: 're_from' }) };
  };
  const call = { callId: 'call_from', businessName: 'Green Stripe' };
  const workbookBuffer = Buffer.from('sheet');

  await deliveryAgent.sendReviewEmail({
    call,
    workbookBuffer,
    filename: 'review.xlsx',
    env: {
      RESEND_API_KEY: 're_test_key',
      SMTP_FROM: 'volvesolutions@outlook.com',
    },
    fetchImpl,
  });
  await deliveryAgent.sendReviewEmail({
    call,
    workbookBuffer,
    filename: 'review.xlsx',
    env: { RESEND_API_KEY: 're_test_key' },
    fetchImpl,
  });

  assert.deepEqual(calls, [
    'volvesolutions@outlook.com',
    'volvesolutions@outlook.com',
  ]);
});

test('sendReviewEmail reports a Resend failure without calling SMTP', async () => {
  const nodemailer = require('nodemailer');
  const previous = nodemailer.createTransport;
  nodemailer.createTransport = () => {
    throw new Error('SMTP must not be used when RESEND_API_KEY is set');
  };
  const fetchImpl = async () => ({
    ok: false,
    status: 422,
    json: async () => ({ message: 'domain is not verified' }),
  });

  try {
    await assert.rejects(
      () => deliveryAgent.sendReviewEmail({
        call: { callId: 'call_fail', businessName: 'Green Stripe' },
        workbookBuffer: Buffer.from('sheet'),
        filename: 'review.xlsx',
        env: { RESEND_API_KEY: 're_test_key', SMTP_HOST: 'smtp.example.com', SMTP_PORT: '587', SMTP_FROM: 'audit@example.com' },
        fetchImpl,
      }),
      (err) => err.message === 'domain is not verified' && err.code !== 'SMTP_MISSING'
    );
  } finally {
    nodemailer.createTransport = previous;
  }
});

test('sendReportEmail still requires SMTP when only Resend is configured', async () => {
  const previousKey = process.env.RESEND_API_KEY;
  const previousHost = process.env.SMTP_HOST;
  const previousPort = process.env.SMTP_PORT;
  const previousFrom = process.env.SMTP_FROM;
  process.env.RESEND_API_KEY = 're_test_key';
  delete process.env.SMTP_HOST;
  delete process.env.SMTP_PORT;
  delete process.env.SMTP_FROM;

  try {
    await assert.rejects(
      () => deliveryAgent.sendReportEmail({
        call: { recipientEmail: 'mia@example.com' },
        pdfBuffer: Buffer.from('pdf'),
        filename: 'report.pdf',
      }),
      (err) => err.message === 'SMTP email delivery is not configured'
    );
  } finally {
    restoreEnvVar('RESEND_API_KEY', previousKey);
    restoreEnvVar('SMTP_HOST', previousHost);
    restoreEnvVar('SMTP_PORT', previousPort);
    restoreEnvVar('SMTP_FROM', previousFrom);
  }
});

function restoreEnvVar(key, value) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

