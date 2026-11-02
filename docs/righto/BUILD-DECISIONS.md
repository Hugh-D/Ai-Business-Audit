# Volve Righto: TEST build decisions (2 Nov 2026, night)

Built by Rex on Hugh's go (10:19pm, 2 Nov) while he was asleep. Each decision: what, why, how to change.
Nothing customer-facing, no numbers bought or repointed, Elle untouched.

| # | Decision | Reason | How to change |
|---|---|---|---|
| 1 | Retell agent **Righto Receptionist (TEST)** `agent_a248b5cd96684035e931f897d2`, LLM `llm_2d02efd4d597273c5b2653617c96` | New agent so Elle (`agent_d2b88a467c67ff42d74bbb5e5f`) is never touched | Rename in the Retell dashboard |
| 2 | Voice **Noah (en-AU), ElevenLabs** (`11labs-Noah`) | Natural Australian, male so callers don't confuse it with Elle, not Pauline as asked. ElevenLabs is about US$0.04/min vs US$0.015 for platform voices | Retell dashboard > agent > Voice. Other AU options in the account: Charlie (male), Clara, Lily, Amelia, Sophia (female) |
| 3 | Model **gpt-4.1**, same as Elle | Known good on Elle, about US$0.045/min | Retell LLM > model (GPT 5.1 is a bit cheaper) |
| 4 | Template prompt uses dynamic variables `business_name, owner_name, trade, service_area, hours, emergency_rules, greeting`, defaults set to the Volve/Hugh test profile | One template for every customer; per-customer values come from the number or call | Edit defaults on the LLM, or pass them per call |
| 5 | Recording notice in the first line; captures name, callback number (read back), suburb, job, urgency, preferred time; never quotes prices or ETAs; tells callers to ring 000 for danger | Matches the /ai-receptionist page promises | Edit the LLM prompt |
| 6 | Post-call analysis fields: caller_name, callback_number, suburb, job_description, urgency (emergency/urgent/flexible/unknown), preferred_time, is_emergency, is_spam | These drive the text and email | Retell agent > post-call analysis |
| 7 | Agent webhook = existing `/webhook/retell` (same signature check). A Righto branch runs first and returns early for agents listed in `config/righto_customers.json`; Elle is hard-excluded by id | Reuses proven signature verification; Elle's path is byte-for-byte unchanged for her calls | Remove the agent from the JSON file to disable |
| 8 | Alerts only on `call_analyzed` (call_started/ended are ignored for Righto) | That's when the captured details exist | `agents/righto.js` handleEvent |
| 9 | SMS via **Twilio REST** when `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` and `TWILIO_FROM` (or `TWILIO_MESSAGING_SERVICE_SID`) are set and `RIGHTO_TEST_SMS_TO` holds Hugh's mobile. Otherwise logs `sms skipped: no credentials` | No Twilio creds in env tonight; no purchases allowed | Add the env vars on Railway (via Hugh / Secure Form) |
| 10 | Email via **Resend** (existing key and From) to `RIGHTO_TEST_EMAIL_TO`, falling back to `REVIEW_EMAIL` (Hugh's review inbox) | Hugh's address isn't committed to the repo | Set `RIGHTO_TEST_EMAIL_TO` on Railway |
| 11 | 3 attempts with backoff on 5xx/429/network errors; no retry on 4xx. Duplicate `call_analyzed` for an already-sent call is ignored | Retell can resend webhooks | `withRetry` in `agents/righto.js` |
| 12 | Sent log in the same SQLite file as calls, separate table `righto_log` | Same storage pattern, keeps Righto out of the workbench call list | — |
| 13 | Dry run: `RIGHTO_DRY_RUN=true` env, or call metadata `righto_dry_run: true`, logs but sends nothing | Safe testing | — |
| 14 | Customer list is a committed JSON (`config/righto_customers.json`) keyed by agent id and number; no phone numbers or emails in it | Small, no DB migration; secrets and contact details stay in env | Move to a DB table once there are real customers |
| 15 | Trial length 14 days recorded on the customer entry (not enforced yet) | Hugh's decision | Billing/trial enforcement is a later step |
| 16 | No phone number bound to the Righto agent | Hard limit: no number changes or purchases | After the 10 Nov port and a number decision, bind one in Retell |
