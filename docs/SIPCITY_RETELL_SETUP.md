# SIPCity + Retell Setup

## Current SIPCity Quote

Received 2026-06-01.

SIPCity said the likely setup is:

- 1300 number plan: AUD $10/month.
- Inbound calls to the 1300 number: AUD $0.04/minute.
- SIP trunk plan: AUD $17.95/month.
- SIP trunk plan includes 1,000 outbound minutes.

Estimated fixed monthly cost before call usage:

- AUD $27.95/month.

Example inbound usage:

- 10 audits x 20 minutes = 200 inbound minutes.
- 200 minutes x $0.04 = AUD $8.
- Estimated month-one telecom cost for 10 audits: AUD $35.95 plus any setup fees, taxes, or Retell usage.

## Decision

This is acceptable for validation.

Do not keep shopping providers unless SIPCity cannot supply the routing details needed by Retell. The cost is low enough to test the first 10 electrician audits.

## What SIPCity Needs To Confirm

Ask SIPCity:

1. Can the selected 1300 number route inbound calls to a SIP trunk that can peer with Retell AI?
2. Will they provide the SIP trunk credentials or peering details required by Retell?
3. What exact SIP server/proxy/termination URI should be entered in Retell?
4. Does SIPCity need Retell's SIP server URI or IP allowlist for inbound routing?
5. Can we set the 1300 number as the inbound caller-facing number only, with call recording handled by Retell?
6. Are there setup fees, minimum terms, or cancellation fees?
7. What is the expected setup time once the 1300 number and SIP trunk are ordered?

## Retell Setup Notes

Retell supports using a custom telephony provider via SIP. Retell's own number purchasing currently focuses on US/Canada numbers, so an Australian number needs a custom provider/SIP path.

In Retell:

1. Go to Deploy / Phone Numbers.
2. Add or connect a phone number via SIP trunking.
3. Enter the SIPCity number in E.164 format if required, for example `+611300...`.
4. Assign the AI Business Audit assistant as the inbound agent.
5. Configure webhook delivery to the app's public `/webhook/retell` URL.
6. Test from a normal mobile phone.

## Consent Wording

This is operational wording, not legal advice.

Use a conservative opening that requires the caller to actively agree before discovery begins:

> Hi, this is the AI Business Audit assistant. I am an AI voice assistant. This call will be recorded and transcribed so we can prepare your business audit report. Do I have your permission to continue?

If yes:

> Thanks. You can pause, interrupt me, correct me, or ask me to repeat anything at any time.

If no:

> No problem. I cannot continue the recorded audit without permission. You can contact Hugh directly if you would prefer a non-recorded conversation.

## Privacy Notes

Treat call recordings and transcripts as personal information when an individual is reasonably identifiable. This can include a caller's voice, name, phone number, email address, or sole-trader business details.

For validation, collect only what is needed to prepare and deliver the audit report:

- business name
- contact name
- phone number
- email address
- website URL when relevant
- discovery answers
- follow-up preference

Avoid collecting sensitive information unless it is clearly necessary.

## Launch Checklist

Before advertising the number:

- SIPCity 1300 number active.
- SIP trunk active.
- Retell phone number/SIP trunk connected.
- Retell inbound agent assigned.
- Retell webhook URL configured.
- App public URL reachable.
- `.env` has `AUDIT_PHONE_NUMBER`.
- `.env` has `RETELL_WEBHOOK_URL` or `PUBLIC_BASE_URL`.
- Test call confirms consent opening.
- Test call generates a stored call record.
- Test call generates a report.
- Hugh can review and deliver the report.

## Sources To Recheck During Setup

- Retell docs: custom telephony via SIP and phone-number deployment.
- SIPCity docs: SIP trunking/trunk preferences.
- OAIC guidance: personal information, APP 3 collection, and consent principles.
