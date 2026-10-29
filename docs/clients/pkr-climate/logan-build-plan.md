# PKR Climate Services: Missed-Call Build Plan (final draft for Hugh)

*Volve Solutions, 28 Oct 2026. Builds on Hugh's Claude handoff doc. Nothing has been built, bought or sent.*

## 1. The outcome we are building for

Logan misses about 5 enquiries a week on $5–10k jobs. Win one extra job a month and the $349/month pays for itself many times over. Success after 2 free months means: every missed call gets either Elle or a text within 60 seconds, Logan gets a one-line summary on his phone, every enquiry sits in one log, and quotes get chased automatically. We measure it (section 8) so the $349 conversation sells itself.

## 2. What we keep from the Claude draft

- **Deterministic code first, AI only where needed.** Guards, routing, opt-outs and timing are plain code.
- **New repo, Railway + Postgres, `business_id` on every table.** Right call for on-selling later.
- **Twilio for voice and SMS**, behind a small provider interface.
- **The guards:** mobile-only text-back, one text per caller per 24 hours, skip list, STOP list, business-hours message variants, IANA time zone per business.
- **Twilio signature checks on every webhook**, env vars by name only, "show it working" acceptance tests.
- **Voicemail risk** flagged as the top silent failure. Correct, and solved below.
- **Text from a real AU mobile number, not an alphanumeric sender ID**, so customers can reply.

## 3. What we change or add, and why

| # | Change | Why |
|---|---|---|
| 1 | **Logan keeps his mobile number. We use carrier conditional call forwarding (no answer, busy, unreachable) to his own Twilio number**, instead of the draft's "Twilio number dials the owner" flow. | His customers, van and Google listing all show 0408 412 559. Asking him to advertise a new number would kill the deal and take months to bite. The draft's `<Dial>` flow stays for Volve's own 1300 line after the port. |
| 2 | **Elle (a new PKR Retell agent) answers forwarded calls; the text-back is the fallback**, not the only path. | Elle answering overflow is in the offer Logan agreed to. The draft put "voice AI" out of scope; for Logan it is the main feature. |
| 3 | **The text-back fires when the caller hangs up on or before Elle, or Elle fails**, not on Twilio `DialCallStatus`. | With forwarding, Twilio sees the call arrive. Its status is not "no-answer". The trigger is our own logic on the Retell call result. |
| 4 | **Voicemail problem goes away by design**: we ask Logan's carrier to turn off voicemail diversion (or set no-answer forward to ~15 to 20 seconds), so missed calls go to Elle instead of MessageBank. | That was the draft's top risk. Must still be tested on his real phone. |
| 5 | **Logan gets an instant SMS summary** of each Elle call or text reply, with a hot/warm/cold tag and a tap-to-call link. Daily email digest via Resend. | He is on the tools. SMS is the only thing he will see. |
| 6 | **Enquiry log = simple Google Sheet he can open on his phone** (written by the app), Postgres stays the source of truth. | No dashboard to build. Logan doesn't need to log in anywhere. |
| 7 | **Quote follow-up is Phase 3**, sent only to people who asked for a quote, with STOP in every message, max 2 nudges (day 3, day 7). | Spam Act: inferred consent from an enquiry covers relevant follow-ups, but every message must identify PKR and offer an unsubscribe. |
| 8 | **Calendly link replaced with "Logan will call you back by [time]"** unless Logan already uses a booking tool. | HVAC quotes need a site visit; Logan decides. Calendly is Volve's tool, not his. |
| 9 | **Spam, robocalls and existing customers handled by rules**: skip list (suppliers, family, regulars), blocked numbers, and Elle ends obvious sales calls politely without texting Logan. | Stops Logan getting noise and keeps text costs down. |
| 10 | **Separate cost tracking per client** (Twilio subaccount for PKR, own Retell agent). | Shows real margin on the $349, and makes on-selling clean. |
| 11 | **Call-recording notice at the start of every Elle call.** | NSW Surveillance Devices Act requires consent to record private conversations. A clear notice plus caller continuing is the standard approach. |

## 4. How it works (architecture)

1. Customer rings Logan on 0408 412 559.
2. Logan answers: nothing happens. Logan busy, doesn't answer in ~20s, or phone off: carrier forwards the call to PKR's Twilio AU mobile number.
3. Twilio routes the call over the existing Elastic SIP trunk to the new **PKR Retell agent** ("Hi, you've reached PKR Climate, Logan's on a job. I'm his assistant, this call is recorded...").
4. Elle collects: name, suburb, job type (install, service, repair, commercial), property type, timeframe, best callback time, and whether they have other quotes. Out-of-area or time-waster rules are agreed with Logan.
5. Retell's call-ended webhook hits our app. The app:
   - Logs the enquiry (Postgres + Sheet row).
   - SMSes Logan the summary and tag.
   - If the caller hung up before giving details, and is a mobile, and passes the guards: sends the text-back from PKR's number ("Hi, it's Logan from PKR Climate Services. Sorry I missed you. What's the job and suburb? I'll call you back today. Reply STOP to opt out.").
6. Caller replies by SMS: app logs it and forwards to Logan. (Phase 2b: an LLM extracts job, suburb and urgency, max 3 turns, then hands to Logan.)
7. If Elle or the app is down: Twilio's fallback URL plays a short message and the text-back still fires from a fallback handler. Retell outage = calls go to Logan's voicemail number via fallback, never dead air.

**Where it lives:** new repo (e.g. `Hugh-D/volve-missed-call`), Railway service + Postgres, Twilio subaccount "PKR", Retell agent "PKR Elle", Resend for the digest.

## 5. Phased build with acceptance tests

**Phase 0: Confirm facts (1 day, before code)**
- Logan's carrier and plan; whether forwarding costs him per call; turn off MessageBank diversion.
- Buy-list for Hugh's go: one Twilio AU mobile number (needs the AU regulatory bundle; check if Volve's existing bundle covers a number used for a client or whether PKR's ABN details are needed).
- Confirm the Twilio AU mobile number is SMS-capable (AU mobile numbers are; 1300 and toll-free are voice only).
- Logan approves Elle's questions, the text wording and his skip list.

**Phase 1: Forwarding + Elle + summary SMS (target: week 1)**
Accept when shown working:
- [ ] Unanswered call to Logan's mobile reaches PKR Elle within 25 seconds.
- [ ] Busy call and phone-off call both reach Elle.
- [ ] Answered call: nothing sent, nothing logged as missed.
- [ ] Logan receives the summary SMS within 60 seconds of hang-up, with correct name, suburb, job and callback time.
- [ ] Every call appears in the Sheet and survives a Railway redeploy.
- [ ] Elle states the recording notice in every call.

**Phase 2: Text-back + replies (week 1–2)**
- [ ] Caller hangs up before Elle gets details: text-back within 60 seconds (mobiles only).
- [ ] Same number twice in 24 hours: one text only.
- [ ] Landline or skip-list caller: no text.
- [ ] After-hours call gets the after-hours wording (Australia/Sydney, checked across the 5 Apr 2027 DST change).
- [ ] Reply STOP: recorded, never texted again. Reply with details: forwarded to Logan and logged.
- [ ] Forged webhook (bad Twilio or Retell signature) rejected.
- [ ] Retell agent disabled: fallback still texts the caller and Logan.

**Phase 3: Quote follow-ups + weekly report (weeks 3–4)**
- Logan marks "quoted" by texting a keyword (e.g. `Q 0412...`) or ticking the Sheet.
- [ ] Follow-up texts on day 3 and day 7 unless he marks won/lost; each has PKR's name and STOP.
- [ ] Monday email to Logan and Hugh: calls caught, Elle-handled, texts, replies, quotes, wins.

**Phase 4: Productise** (after Logan's 2 months): onboarding checklist, per-client config, legal review.

## 6. Testing and evals (second model as referee)

- **Script bank:** 15 test calls before go-live (normal install, urgent breakdown, out of area, price shopper, spam caller, angry customer, caller who hangs up early, poor line, after hours). Hugh or Rex play the callers.
- **Auto-grading:** every real PKR call transcript is scored by a different model (Claude or ChatGPT via API) against a fixed rubric: details captured correctly, recording notice given, no promises on price or dates, polite, summary SMS matches transcript. Scores go into the Sheet; anything under threshold flags Hugh.
- **Regression bank:** any failed call becomes a new test. Re-run the bank before any prompt change is published.
- Grader prompt and rubric are versioned in the repo so drift is visible.

## 7. Monthly running cost estimate (Logan alone)

Assumes ~25 forwarded calls/month at ~3 min, ~40 outbound SMS (summaries, text-backs, follow-ups), ~15 inbound. USD converted at ~A$1.55.

| Item | Basis | ~A$/month |
|---|---|---|
| Twilio AU mobile number | US$8.25/mo [1] | 13 |
| Outbound SMS | 40 x US$0.0515/segment [1] | 3–6 |
| Inbound SMS | 15 x US$0.0075 [1] | <1 |
| Twilio SIP trunk minutes to Retell | 75 min, ~US$0.01–0.02/min (check AU termination rate) | 2–3 |
| Retell voice minutes | 75 min at ~US$0.07–0.12/min incl. LLM and voice (check current pricing page) [2] | 8–14 |
| Grader model API (evals) | ~25 transcripts | 1–3 |
| Railway + Postgres share | existing plan | 5–10 |
| **Total** | | **~A$35–50** |

Margin at $349: roughly A$300/month. Even at 4x the call volume, cost stays under A$120. Hugh's time for support is the real cost. Logan pays his own carrier for forwarded calls (usually included on post-paid plans; check).

Sources: [1] twilio.com/en-us/sms/pricing/au (Oct 2026). [2] retellai.com/pricing (check before quoting). ACMA Sender ID Register: acma.gov.au/sms-sender-id-register (live from 1 Jul 2026).

## 8. Compliance in plain English (not legal advice)

- **Sender ID:** we text from a real mobile number, so the ACMA Sender ID Register (live since 1 July 2026, branded names only) doesn't apply. Branded "PKRClimate" texts would need registration and can't take replies, so we don't use them.
- **Spam Act 2003:** text-back and follow-ups are to people who contacted PKR about a job (inferred consent). Every message names PKR and has "Reply STOP". Honour opt-outs immediately (we do it in code within seconds; law allows 5 working days).
- **Privacy Act / APPs:** PKR is likely under the $3m small-business threshold, but Volve handles the data, so we act as if the APPs apply: collect only job details, store in AU-accessible services, give Logan a short privacy note for his website, delete on request, hand over his data if he leaves.
- **Recording (NSW):** Elle announces recording at the start. Logan's own customers expect it from a business line.

## 9. Risks and failure modes

| Risk | Fix |
|---|---|
| Carrier voicemail grabs the call before forwarding | Turn off MessageBank diversion; test all 3 conditions on his phone day 1 |
| Logan's carrier charges per forwarded call or blocks forwarding on his plan | Check on the call; if needed, move his no-answer forward or plan |
| Elle/Retell down | Twilio fallback URL texts caller and Logan; health check alerts Hugh |
| Spam/robocalls flood Elle | Spam rule in Elle, skip summaries for spam, cap texts per hour |
| SMS pumping fraud | Mobile-only, 24h limit, AU-only numbers, hourly cap |
| Elle says something wrong (price, promise) | Prompt forbids pricing/dates; evals flag it |
| Daylight saving shift breaks hours | IANA zone, tested across 5 Apr 2027 |
| Logan stops using it | Weekly report shows the value; 2-month review call booked up front |
| Port of Volve 1300 on 10 Nov clashes | Logan's build uses its own number and subaccount; no dependency |

## 10. Questions for Logan tomorrow

1. Which carrier and plan is 0408 412 559 on (Telstra, Optus, Vodafone, other)? Is it his business-only phone?
2. Happy for missed calls to go to "PKR's assistant" instead of voicemail? Ok to turn off voicemail?
3. How many rings before it diverts? (Suggest ~20 seconds.)
4. Business hours, service area (suburbs or km from base), and what he won't take on.
5. What makes someone a time-waster? Which questions should Elle ask?
6. Who should never get a text: suppliers, family, regular clients? Can he send us a list?
7. Summary by SMS only, or SMS + daily email? Which email?
8. How does he quote now (software, paper, Tradify/ServiceM8/Fergus)? Where would he mark a quote sent/won?
9. How should texts sign off: "Logan from PKR Climate Services"?
10. Any current website, Google Business Profile or booking tool?
11. OK to record calls for quality, with a notice at the start?
12. ABN and business name exactly as registered (for the Twilio number paperwork).

## 11. What Hugh needs to approve before build

- Buying one Twilio AU mobile number (~A$13/mo) and creating a Twilio subaccount.
- Creating the PKR Retell agent and the new repo.
- Hand the build to Rex once Logan's answers are in.
