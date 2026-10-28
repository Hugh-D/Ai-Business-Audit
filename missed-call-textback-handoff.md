# Missed-Call Text-Back: Handoff Document

Last updated: 2026-10-28
Status: PLANNING COMPLETE, BUILD ON HOLD. No code, repo or infrastructure has been created for this project. Do not start building until the owner says "go".

This document is a reference for any LLM or developer picking up this project. It records what was decided, why, what is still unverified, and what to build first. Where a fact has not been verified, it is marked **UNVERIFIED**. Check those items before relying on them.

---

## 1. What this is

An automated tool that sends an SMS to a caller when a business misses their call. The caller can reply, and later a short LLM-driven conversation qualifies the lead and notifies the owner.

- **First client:** Volve AI Business Audit (the owner's own business). It acts as the pilot.
- **Longer-term intent:** productise and on-sell to other small businesses.
- **Markets:** Australia first, then New Zealand.
- **Relationship to this repo:** This is a separate tool from the AI Business Audit report tool in this repo. The build goes in a NEW repo. The audit tool may later recommend missed-call text-back as an item in its reports.

## 2. Who you are working with

- The owner is Buzzy (busterswazi@gmail.com). Solo builder, learning by doing. Favour clarity over cleverness.
- Workflow rules (also in this repo's CLAUDE.md):
  1. Plan first. For any multi-step task, write the plan and get confirmation before executing.
  2. No temporary fixes. Find root causes, keep the footprint minimal.
  3. Capture lessons after corrections in the project's CLAUDE.md.
  4. Verify before calling anything done. Show it working.
  5. Simplicity first.
- Build philosophy: AI is the brain (interprets, recommends, drafts). Code is the structure (captures input, routes data, formats output). Never use an LLM where deterministic logic will do.
- Writing style for anything addressed to the owner: direct, active voice, no em-dashes anywhere, no filler phrases, no over-hedging, action-oriented.

## 3. Decisions made

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | New repo, separate from Ai-Business-Audit | Different product, different lifecycle |
| 2 | Twilio for voice and SMS, wrapped behind a small provider interface | Best docs and test tooling; interface keeps AU providers (ClickSend, MessageMedia) swappable |
| 3 | Twilio handles call forwarding via TwiML `<Dial>`, not carrier conditional-forward codes | More reliable and fully under our control |
| 4 | Railway hosts the server, deploying from GitHub | Already in the owner's stack |
| 5 | Railway Postgres for storage, not SQLite | Railway container disk is not persistent across deploys unless a volume is attached |
| 6 | v1 has no LLM | The missed-call flow is fully deterministic |
| 7 | LLM is introduced in Phase 2 only, for two-way qualification | Keep the LLM boxed in: extract a few fields, draft replies, hand off to a human |
| 8 | Calendly link goes in the text-back message | Gives the caller a second way to respond with zero integration code |
| 9 | Landline filtering by number prefix, not a paid lookup | Deterministic and free |
| 10 | `business_id` on every table from day one, but only one business in v1 | Cheap to add now, avoids a rewrite when on-selling |

## 4. Current stack and assets

- **GitHub:** source control. New repo to be created.
- **Railway:** hosting and Postgres. Auto-deploy from GitHub. Secrets in Railway environment variables.
- **Twilio:** already an account in use.
  - The 1300 number **1300 244 769** is **being ported from SIPCity to Twilio**. The port is in progress. Do not point this number at any webhook until the port is confirmed complete.
  - The owner has a separate **local AU mobile number** on Twilio that currently runs the AI phone audit. It is the test line for development.
- **Calendly:** the owner's booking link, used in the message body.

## 5. Architecture (Phase 1)

### Call flow

1. Caller dials the business number (a Twilio number).
2. Twilio requests `POST /voice`. The server returns TwiML that dials the owner's mobile with a timeout of about 20 seconds and an `action` URL of `/dial-result`.
3. When the dial ends, Twilio requests `POST /dial-result` with `DialCallStatus`.
4. If `DialCallStatus` is `no-answer`, `busy` or `failed`, and the guards pass, the server sends the text-back SMS.
5. The call and message are logged.

Sketch of the TwiML returned by `/voice` (verify attribute names against current Twilio docs when implementing):

```xml
<Response>
  <Dial timeout="20" action="/dial-result" method="POST">
    <Number>+61XXXXXXXXX</Number>
  </Dial>
</Response>
```

### Endpoints

| Method and path | Purpose |
|-----------------|---------|
| `POST /voice` | Incoming call webhook. Returns TwiML to dial the owner |
| `POST /dial-result` | Dial outcome webhook. Decides whether to send the text-back |
| `POST /sms-inbound` | Customer replies. Phase 1: log only and handle STOP. Phase 2: LLM conversation |
| `GET /health` | Railway health check |

All Twilio webhooks must verify the `X-Twilio-Signature` header. Reject unsigned or invalid requests.

### Data model (starting point)

- `businesses`: id, name, timezone (IANA, e.g. `Australia/Sydney`), owner_mobile, inbound_number, sms_sender_number, calendly_url, business_hours (JSON), active
- `calls`: id, business_id, call_sid, from_number, to_number, dial_status, textback_sent (bool), skip_reason, created_at
- `messages`: id, business_id, call_id, direction (in/out), from_number, to_number, body, twilio_sid, created_at
- `opt_outs`: business_id, phone, created_at

### Guards (all deterministic, applied before sending)

1. Dial status is `no-answer`, `busy` or `failed`.
2. Caller number is a mobile: AU `+614...` or NZ `+642...`. Anything else gets no text.
3. Caller is not in `opt_outs` for this business.
4. No text-back to this caller from this business in the last 24 hours.
5. Caller is not on a skip list (staff, suppliers, known contacts).
6. Message variant chosen by business hours in the business's time zone (in-hours versus after-hours).

### Message templates (draft, owner to approve)

- In hours: `Hi, it's [Business]. Sorry we missed your call. Reply here with what you need, or book a time: [Calendly link]. Reply STOP to opt out.`
- After hours: `Hi, it's [Business]. We're closed right now and will call you back at [opening time]. Reply here with what you need, or book a time: [Calendly link]. Reply STOP to opt out.`

Messages must name the business and include an opt-out.

## 6. Known risks and gotchas

1. **Voicemail looks like an answer.** If the owner's mobile has carrier voicemail, voicemail may pick up inside the dial timeout. Twilio would then report `completed` and no text would be sent. Options to investigate: keep the dial timeout shorter than the carrier voicemail pickup, check `DialCallDuration` for very short "answered" calls, or use call screening on the `<Number>` (a whisper or keypress to accept the call). **UNVERIFIED:** test this on the real mobile early. It is the most likely cause of silent failure.
2. **1300 numbers probably cannot send or receive SMS.** **UNVERIFIED:** confirm against current Twilio AU documentation. Design assumes the text-back is sent from a separate AU mobile number, and customers reply to that number. Make that clear in the message so replies go somewhere monitored.
3. **AU mobile number requirements.** **UNVERIFIED:** Twilio typically requires a regulatory bundle (business identity documents) for AU numbers. The owner already has a working AU mobile on Twilio, so this may already be done. Confirm that this number can send SMS in addition to voice.
4. **Alphanumeric sender IDs are one-way.** Do not use them for text-back, because customers need to reply.
5. **Twilio STOP handling.** **UNVERIFIED:** confirm how automatic opt-out behaves for the chosen number type and whether the app also needs its own `opt_outs` check.
6. **Port in progress.** Cutting the 1300 over before the port completes will break calls.

## 7. Compliance (not legal advice)

- **Australia:** Spam Act 2003. Commercial electronic messages need consent, sender identification and an unsubscribe option. A reply to someone who just called is likely low risk, but get a legal opinion before on-selling.
- **New Zealand:** Unsolicited Electronic Messages Act 2007. Similar principles.
- **Privacy:** Privacy Act 1988 (AU) and Privacy Act 2020 (NZ) apply to stored caller numbers and conversation content, and to sending that content to an LLM in Phase 2. Disclose it (first message or the business's privacy policy) and check data hosting location.
- **Time zones:** AU states and NZ differ and observe daylight saving on different dates. Always store an IANA time zone per business.

Verify all of the above with current sources before onboarding anyone other than the owner.

## 8. Phases

**Phase 0: Confirm unknowns (before code)**
- Verify the items marked UNVERIFIED in section 6.
- Owner confirms message wording and owner notification channel (SMS or email).

**Phase 1: Deterministic MVP**
1. Create the new GitHub repo and a minimal server (FastAPI or Express), deployed to Railway with Postgres.
2. Implement `/voice`, `/dial-result`, `/health`, signature verification.
3. Implement guards and the text-back.
4. Implement `/sms-inbound` with logging and STOP handling.
5. Test end to end on the owner's local mobile test line.
6. After the 1300 port completes, point the 1300 at the app.

**Phase 2: Two-way qualification (LLM)**
- On a reply, an LLM extracts job type, location and urgency, then sends the owner a summary.
- Hard limits: maximum of a few turns, then hand off to a human. Code controls when the conversation starts, stops and escalates.

**Phase 3: Pilot**
- Run for about two weeks on the owner's own business. Measure missed calls, texts sent, replies and bookings.

**Phase 4: Productise**
- Multi-tenant onboarding, a simple dashboard, billing, and a compliance review.

## 9. Phase 1 acceptance criteria

Phase 1 is done only when all of these are demonstrated, not assumed:

- [ ] A call to the test number that the owner does not answer results in a text-back to the caller within about 30 seconds.
- [ ] A call that the owner answers sends no text.
- [ ] A call that goes to the owner's voicemail still triggers the text-back (or the risk in section 6.1 is documented with the chosen mitigation).
- [ ] A second missed call from the same number within 24 hours sends no second text.
- [ ] A call from a non-mobile number sends no text.
- [ ] After-hours calls get the after-hours message, using the business time zone.
- [ ] A caller replying STOP is recorded and never texted again.
- [ ] A forged webhook request without a valid Twilio signature is rejected.
- [ ] Everything is logged in Postgres and survives a Railway redeploy.

## 10. Environment variables (names only, never commit values)

- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `DATABASE_URL`
- `PUBLIC_BASE_URL` (used for signature verification and TwiML action URLs)
- Phase 2: an LLM API key

## 11. Out of scope for now

- A custom dashboard or reporting UI
- Calendar integration beyond a Calendly link
- Voice AI that answers the call
- Multi-tenant billing
- Any provider other than Twilio (the interface exists so they can be added later)

## 12. Open questions for the owner

1. Final message wording, and the owner notification channel for replies.
2. Which Twilio number will send the text-back and receive replies, and can it send SMS?
3. What name and repo name to use for the new project.
4. Expected date for the 1300 port to complete.
5. Who provides the legal review before on-selling.

## 13. Instructions for the next LLM

1. Read sections 2 and 3 first. Do not re-open decisions already made without a concrete reason.
2. Do not build until the owner says to. Present a plan and confirm it before multi-step work.
3. Treat every UNVERIFIED item as a question to check, not a fact.
4. Prefer the simplest deterministic solution. Add an LLM only where code cannot do the job.
5. After any correction from the owner, record the lesson in the new repo's CLAUDE.md.
6. Do not claim something works until you have shown it working end to end.
