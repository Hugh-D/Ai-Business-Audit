# AI Business Audit Handoff

## Product Intent

AI Business Audit is meant to be a phone-led business readiness audit.

Target flow:

1. A business owner sees an ad or offer and calls the public AI Business Audit number.
2. The AI voice agent identifies itself, obtains consent for recording/transcription, and asks discovery questions about leads, follow-up, operations, tools, and customer experience.
3. Retell sends the completed call transcript to this app.
4. The app generates a structured readiness/revenue-leak report.
5. The business owner receives the report and can choose to book a follow-up call with Hugh.

The assessment is free during validation, with a later paid version expected to include an optional follow-up call as part of the fee.

The current wedge is trades and home services, with `trades`, `realtors`, and `lawn_care` configs already available.

## Current App State

The app lives in `ai-audit-system`.

It is a Node/Express app with:

- static MVP workbench at `GET /`
- health check at `GET /health`
- launch readiness checklist at `GET /readiness`
- industry list at `GET /industries`
- manual transcript report generation at `POST /audit`
- editable spreadsheet export at `POST /export/xlsx`
- browser-based report export actions: Copy JSON, Download Sheet, and Print / PDF
- persisted report review/delivery workflow at `PATCH /voice/calls/:callId/review`
- persisted follow-up booking capture within the report workflow: status, preferred timing, scheduled time, and notes
- website capture from the assessment transcript or report review form, stored with the report and editable export
- SMTP workbook delivery at `POST /voice/calls/:callId/deliver`
- voice prompt session config at `POST /voice/session`
- optional outbound Retell test-call creation at `POST /voice/call`
- persisted call list at `GET /voice/calls`
- single persisted call lookup at `GET /voice/calls/:callId`
- Retell webhook receiver at `POST /webhook/retell`

As of 2026-05-19, the local pre-number test path has been exercised:

- Anthropic report generation works with the real `.env` key.
- Retell API access works with the real `.env` key.
- The Retell voice agent ID in `.env` is valid.
- A simulated signed Retell `call_ended` webhook was accepted and generated a report.
- A bug where transcript keyword detection overrode `metadata.industry` was fixed; explicit metadata now wins.
- As of 2026-05-21, the app has a focused Node test suite for industry routing, transcript cleanup, report JSON parsing, Retell webhook signature verification, and key Express endpoints.

Important files:

- `ai-audit-system/index.js` - Express routes and webhook flow
- `ai-audit-system/agents/voice_agent.js` - Retell call creation and webhook verification
- `ai-audit-system/agents/report_engine.js` - Anthropic report generation and JSON parsing
- `ai-audit-system/agents/workbook_exporter.js` - editable XLSX report generation
- `ai-audit-system/agents/delivery_agent.js` - SMTP email delivery with workbook attachment
- `ai-audit-system/agents/call_store.js` - local SQLite-backed call/report storage
- `ai-audit-system/public/` - MVP phone audit UI
- `ai-audit-system/industries/` - industry audit configs
- `ai-audit-system/prompts/` - voice and report prompts

## Run Locally

From `ai-audit-system`:

```bash
npm install
npm start
```

Open:

```text
http://localhost:3000
```

## Required Environment

Create `ai-audit-system/.env` from `.env.example`.

Required for report generation:

```bash
ANTHROPIC_API_KEY=...
```

Required for inbound live audit testing:

```bash
AUDIT_PHONE_NUMBER=...
RETELL_API_KEY=...
RETELL_WEBHOOK_URL=...
```

Optional for internal outbound test calls:

```bash
RETELL_FROM_NUMBER=...
RETELL_AGENT_ID=...
```

Optional for sending completed reports by email:

```bash
SMTP_HOST=...
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=...
SMTP_PASS=...
SMTP_FROM="AI Business Audit <audit@example.com>"
```

Current known environment status:

- `ANTHROPIC_API_KEY` is set.
- `RETELL_API_KEY` is set.
- `RETELL_AGENT_ID` is set and verified against Retell.
- The customer path is now inbound-first; `RETELL_FROM_NUMBER` is not required for launch.
- SIPcity confirmed it can provide an Australian number connected to Retell for inbound calling, and permit AI service use for opt-in callers.

Useful defaults:

```bash
PORT=3000
NODE_ENV=development
CALL_STORE_PATH=./data/calls.sqlite
RETELL_WEBHOOK_URL=https://your-public-url/webhook/retell
AUDIT_MAX_TOKENS=2000
AUDIT_MODEL=claude-sonnet-4-20250514
VOICE_MODEL=claude-sonnet-4-20250514
```

## Retell Setup

Current Retell agent:

- Type: Voice Agent
- Setup: Single prompt, blank/custom
- Name: AI Business Audit assistant
- Language: English Australia (`en-AU`)
- Voice: Cimo
- Model: GPT 4.1
- V1 was published in the Retell UI; the API may still report the editable draft as unpublished.
- Current live prompt opening discloses that the assistant is AI and that the call will be recorded, then asks the caller to agree before the assessment proceeds.

Recommended Retell speech/transcription settings from testing:

- Response Eagerness: about `0.5`
- Dynamic adjustment: on for testing
- Interruption Sensitivity: about `0.7`
- Reminder: `25` seconds, `1` time
- Denoising: Remove noise
- Transcription: Optimize for accuracy
- Vocabulary: General

For local webhook testing, expose the app with a public tunnel such as ngrok:

```text
http://localhost:3000 -> https://your-public-url
```

Configure Retell webhooks to:

```text
https://your-public-url/webhook/retell
```

Set `RETELL_WEBHOOK_URL` or `PUBLIC_BASE_URL` in `.env` so the launch readiness panel can show whether public webhook setup has been filled in.

The app verifies Retell signatures using the current `x-retell-signature` format:

```text
v={timestamp},d={digest}
```

Webhook behavior:

- non-`call_ended` events are stored and acknowledged
- `call_ended` is acknowledged quickly with `204`
- report generation runs in the background
- call status moves through `generating_report`, `report_ready`, or `report_error`

## Current Limitations

- Call storage persists locally to `ai-audit-system/data/calls.sqlite` by default.
- No user accounts or authentication.
- No external database or CRM integration yet.
- Editable report export is available as `.xlsx`, suitable for Excel or Google Sheets import.
- Completed phone-call reports can be marked `draft`, `reviewed`, or `sent`, with website URL, internal review notes, recipient email, delivery notes, and follow-up booking status/timing.
- Website addresses are captured for future customer-journey review and optional report personalisation; logo/brand extraction is not implemented yet.
- The UI can prepare a mailto email draft, or send the editable workbook by SMTP when SMTP env vars are configured.
- PDF export uses the browser print flow from the report preview; there is no server-side PDF renderer yet.
- No deployed public URL yet.
- Automated tests cover core pure modules, Retell signature verification, and key Express endpoints. Full live Retell/Anthropic integration is still manually verified.
- The inbound Retell call flow can only work after `.env` contains the public audit number and webhook config, and SIPcity routing is connected to Retell.
- Real phone testing still requires purchasing/configuring a SIPcity number and a public webhook URL.
- SIPcity confirmed Australian SIP trunk compatibility with Retell, inbound and outbound support, and use of a SIPcity-account local number as outbound caller ID. It does not permit a `13`, `1300`, or `1800` number as outbound caller ID.

## Recommended Next Steps

1. Respond to SIPcity with the inbound, opt-in pilot traffic profile and request the recommended local/1300 inbound number setup for Retell.
2. Purchase/configure the inbound audit number, with `1300 AI HELP` retained as the preferred branded option if available.
3. Set up ngrok or deploy the app so Retell can reach `/webhook/retell`.
4. Configure Retell webhook to `https://your-public-url/webhook/retell` and set `AUDIT_PHONE_NUMBER` plus `RETELL_WEBHOOK_URL` in `.env`.
5. Call the advertised number yourself and verify the consent-first inbound call-to-report loop.
6. Replace local SQLite storage with a managed production database when moving beyond local MVP testing.
7. Add public website review signals and optional logo/brand accents to reports using the captured URL.
8. Add a scheduling/calendar link or integration once the preferred booking workflow is chosen.
9. Add a CRM handoff once the target CRM is chosen, or a richer email provider integration if SMTP is not enough.
10. Add a server-side PDF renderer if browser-based PDF export is not enough for delivery.

## Conversation Notes

- The first Retell simulation asked the right kinds of questions and did not ramble or get stuck.
- When asking about tools/software, the agent should ask only: "What software or tools do you currently use to run the business?" It must then stop and wait. It should only give examples if the caller asks what that means, says they are not sure, or gives no usable answer.
- A less confident test caller paused while thinking, and the agent sometimes treated the silence as no answer and moved on. Opening message and prompt should explicitly say the caller can pause, interrupt, correct the agent, or ask for clarification.
- If the caller mentions a tool name that is unclear, such as "Karbon", the agent should reflect it back and confirm spelling/context rather than ignore it.
- Retell test feedback: the agent asked the right kinds of questions, did not ramble, and did not get stuck. The two refinements were slower turn-taking for thoughtful speakers and better confirmation of unclear software/tool names.
- 2026-05-20 test feedback: the agent still sometimes gave examples immediately after asking what software/tools the caller uses. The prompt rule was tightened to forbid examples in the same turn as the initial tools/software question.
- 2026-05-20 V2 test feedback: the agent did better on the tools/software question, but sometimes added more context while the caller was still answering. It also used stiff phrasing like "thanks for clarifying" in response to vague human answers. Prompt should emphasize waiting until the caller finishes and using more natural acknowledgements.
- 2026-05-20 fuller test transcript feedback: the agent completed the audit, but overused "thanks", accepted some vague/non-answer replies as if they were clear, repeated one question after a poor answer, and did not normalize/confirm the email address. Prompt should instruct it to vary acknowledgements, ask simpler follow-ups for non-answers, and repeat contact details back in normalized form.
- 2026-05-20 carpet/upholstery test feedback: the agent found a useful opportunity around client education before jobs, but got awkward when the caller was confused by "connected tools" and started explaining integrations. It also failed to normalize/confirm a spoken Australian mobile number. Prompt should tell it to simplify confused questions, avoid giving integration advice during discovery, and confirm mobile numbers in readable form.
- 2026-05-20 car detailing test feedback: the agent confirmed `clay@outlook.com` but immediately began closing before waiting for confirmation. Caller interrupted and corrected to `clare@outlook.com`. Prompt should require a hard wait after repeating contact details, and should re-confirm corrected contact details before ending.
- 2026-05-20 latest Retell prompt was consolidated and confirmed for publishing as `V6 - confirm contact details`. Key behavior requirements: one question at a time, wait through pauses, no examples in the same turn as the initial tools/software question, simplify confused questions, vary acknowledgements, normalize and confirm email/mobile details, and do not end until corrected contact details are confirmed.

## Latest Retell Prompt Notes

Use the Retell dashboard prompt version named `V6 - confirm contact details`.

Important wording in that prompt:

- The opening identifies the voice as an AI assistant, says the call will be recorded/transcribed for the assessment report, and asks for agreement before discovery begins.
- Opening tells callers they can pause, interrupt, correct the agent, or ask for repetition/clarification.
- Silence handling says: "No rush, take your time" before repeating or moving on.
- Tools/software question must be exactly: "What software or tools do you currently use to run the business?"
- Contact capture must repeat normalized email/mobile details and wait for confirmation.
- The agent asks whether the caller has a website they want included in the assessment, then repeats and confirms it when supplied.
- If contact details are corrected, the agent must repeat the corrected version and ask for confirmation again.
- The agent must not close the call until contact details are confirmed.
- The closing asks whether the caller would like a follow-up call with Hugh; when they do, it gathers and confirms preferred timing.

## Current Git State

Before starting a new work session or committing, review:

```bash
git status --short
git log -1 --oneline
git diff
```
