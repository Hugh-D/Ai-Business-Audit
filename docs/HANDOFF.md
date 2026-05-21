# AI Business Audit Handoff

## Product Intent

AI Business Audit is meant to be a phone-led business readiness audit.

Target flow:

1. A business owner receives or phones into an AI audit call.
2. The AI voice agent asks discovery questions about leads, follow-up, operations, tools, and customer experience.
3. Retell sends the completed call transcript to this app.
4. The app generates a structured readiness/revenue-leak report.
5. The report supports a follow-up consult or implementation offer.

The current wedge is trades and home services, with `trades`, `realtors`, and `lawn_care` configs already available.

## Current App State

The app lives in `ai-audit-system`.

It is a Node/Express app with:

- static MVP workbench at `GET /`
- health check at `GET /health`
- industry list at `GET /industries`
- manual transcript report generation at `POST /audit`
- editable spreadsheet export at `POST /export/xlsx`
- browser-based report export actions: Copy JSON, Download Sheet, and Print / PDF
- persisted report review/delivery workflow at `PATCH /voice/calls/:callId/review`
- SMTP workbook delivery at `POST /voice/calls/:callId/deliver`
- voice prompt session config at `POST /voice/session`
- outbound Retell call creation at `POST /voice/call`
- in-memory call list at `GET /voice/calls`
- single in-memory call lookup at `GET /voice/calls/:callId`
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
- `ai-audit-system/agents/call_store.js` - local disk-backed call/report storage
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

Required for outbound Retell phone calls:

```bash
RETELL_API_KEY=...
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
- `RETELL_FROM_NUMBER` is still the remaining live-call blocker until a Retell/imported number is available.

Useful defaults:

```bash
PORT=3000
NODE_ENV=development
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

- Call storage persists locally to `ai-audit-system/data/calls.json` by default.
- No user accounts or authentication.
- No external database.
- Editable report export is available as `.xlsx`, suitable for Excel or Google Sheets import.
- Completed phone-call reports can be marked `draft`, `reviewed`, or `sent`, with internal review notes, recipient email, and delivery notes.
- The UI can prepare a mailto email draft, or send the editable workbook by SMTP when SMTP env vars are configured.
- PDF export uses the browser print flow from the report preview; there is no server-side PDF renderer yet.
- No deployed public URL yet.
- Automated tests cover core pure modules, Retell signature verification, and key Express endpoints. Full live Retell/Anthropic integration is still manually verified.
- The Retell call can only work after `.env` contains real credentials and Retell webhook config is set.
- Real phone testing still requires a Retell/imported phone number and public webhook URL.

## Recommended Next Steps

1. Add/verify `RETELL_FROM_NUMBER`.
2. Set up ngrok or deploy the app so Retell can reach `/webhook/retell`.
3. Configure Retell webhook to `https://your-public-url/webhook/retell`.
4. Run the first real phone call to the builder's own phone.
5. Verify the full call-to-report loop with one test business audit.
6. Replace local JSON storage with a production database when moving beyond local MVP testing.
7. Add CRM handoff or a richer email provider integration if SMTP is not enough.
8. Add a server-side PDF renderer if browser-based PDF export is not enough for delivery.

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

- Opening tells callers they can pause, interrupt, correct the agent, or ask for repetition/clarification.
- Silence handling says: "No rush, take your time" before repeating or moving on.
- Tools/software question must be exactly: "What software or tools do you currently use to run the business?"
- Contact capture must repeat normalized email/mobile details and wait for confirmation.
- If contact details are corrected, the agent must repeat the corrected version and ask for confirmation again.
- The agent must not close the call until contact details are confirmed.

## Current Git State

There are local uncommitted changes from this build session. They have not been pushed to GitHub yet.

Before committing, review:

```bash
git status --short
git diff
```
