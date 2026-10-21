# Retell v32 draft checkpoint

Captured 21 October 2026, Australia/Sydney. **Unpublished and not release-ready.** Retell v31 remains published and unchanged. No application runtime or report contract is changed by these files.

## Configuration source

`voice-prompt.txt` is the prompt read from the Retell v32 editor after the Path B rate-limit handling change. Retell remains the source of truth for the complete hosted agent configuration. This folder is a reviewable checkpoint, not an importable agent export. Do not replace `ai-audit-system/prompts/voice_system.txt` with this snapshot: that file is a separate application prompt template.

Observed hosted settings: GPT 4.1, Elle Australian voice, interruption sensitivity 0.85, response wait 1.5 seconds with dynamic adjustment enabled. Earlier discussion mentioned 1.3 seconds; the current UI shows 1.5 seconds. No timing setting was changed during this work.

## Booking function changes

Both booking functions keep `timezone` as `Australia/Sydney` and use their existing Calendly API-key connection. No credential is included here. Execution waits for completion.

- Path A: `check_calendly_availability` and `book_calendly_appointment`, event `https://calendly.com/hugh-volvesolutions/30min`.
- Path B: `check_intro_availability` and `book_intro_appointment`, event `https://calendly.com/hugh-volvesolutions/volve-introductory-call`.
- Each booking function's `start_time` field now instructs the model to copy the complete selected availability timestamp, including its trailing `Z`, without reconstruction or timezone removal. Path A previously instructed local datetime without UTC conversion, conflicting with the main prompt.
- Path B `location_details` now instructs use of the confirmed callback number in E.164 format without spaces. A confirmed Australian leading zero becomes `+61`; clarify the country if unclear.
- Path B function description and main prompt failure section now stop same-call booking attempts after HTTP 429, including when the caller requests another time. Do not claim success or a guaranteed callback.

## Calendly change

The event titled `30 Minute Meeting` was configured for 20 minutes. Its duration was changed to 30 minutes and saved. The introductory call remains 15 minutes. Existing bookings retain their original durations.

## Verification

- Path A initially accepted a naive 17:00 timestamp while the conversation and XLSX said 18:00. Calendly independently showed 17:00-17:20, so the report was not proof of actual booking time.
- After the timestamp fix, a text scheduling test submitted the exact 07:00Z slot for 18:00 Sydney and created an active appointment.
- After the duration correction, a fresh text scheduling test submitted 06:30Z for 17:30 Sydney. Calendly independently showed Friday 23 October, 17:30-18:00 Australia/Sydney. The user confirmed email receipt and calendar entry.
- Path B earlier live function and text-conversation tests created active appointments. The user confirmed calendar entries and email receipt.
- The later Path B voice test sent correct UTC timestamps but failed four booking attempts with HTTP 429. Its callback number was still local format; that field instruction has since been corrected.
- After the latest Path B changes, regression testing converted the local Australian number to international format, stated that no appointment was confirmed after 429, and refused further booking attempts when pressed by the caller.

## Outstanding release checks

**Path B slot selection still needs work.** During the final evidence review, the last rate-limit regression was found to request Friday 17:00 Sydney but submit 05:00Z (16:00 Sydney). The previous regression and earlier successful booking used 06:00Z correctly. The rejected request created no appointment. Exact string preservation alone does not guarantee that the model selected the correct slot. Resolve and retest this before publication; do not describe quota as the only outstanding issue.

The Calendly account displays `Teams Plus free trial`. Calendly's current documentation limits trial Create Event Invitee requests to five per user per day, across event types. Five successful API bookings were observed before the later failures. The returned Retell errors expose HTTP 429 but no response body or reset headers. Further successful live verification must wait for the quota reset; the user has declined a paid subscription while validating customer demand. Do not purchase or upgrade.

Retest Path B by voice after quota resets, checking agreed local time, exact matching UTC slot, 15-minute duration, calendar entry and email receipt. Review contact-detail pacing, recording consent when callers interrupt the disclosure, and explicit audit authority confirmation before release. Do not infer voice quality from text-only tests.

The report's stated booking time reflects conversation data and is not independent Calendly verification. No report application change was made.

## References

- [Calendly API rate limits](https://developer.calendly.com/api-docs/overview/rate-limits)
- [Calendly Create Event Invitee](https://developer.calendly.com/api-docs/calendly-api/scheduled-events/create-event-invitee)

## Publication boundary

Pushing this checkpoint is a backup and review step only. Do not publish v32, merge to the deployment branch or deploy from this checkpoint. Preserve v31 until outstanding checks are resolved and publication is authorised.
