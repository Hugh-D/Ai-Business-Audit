// Workbench pipeline status for each call (separate from the Retell/report `status` field).
const CALL_STATUSES = ['new', 'booked', 'won', 'no_go', 'test'];
const CALL_STATUS_SET = new Set(CALL_STATUSES);
const DEFAULT_CALL_STATUS = 'new';
const BOOKING_TOOLS = new Set(['book_intro_appointment', 'book_calendly_appointment']);

function normalizeCallStatus(value) {
  const key = String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (key === 'nogo') return 'no_go';
  return CALL_STATUS_SET.has(key) ? key : null;
}

// Older records have no callStatus; treat them as New without rewriting them.
function withCallStatus(call) {
  if (!call) return call;
  const callStatus = normalizeCallStatus(call.callStatus) || DEFAULT_CALL_STATUS;
  return { ...call, callStatus, callStatusSource: call.callStatusSource || (call.callStatus ? 'manual' : 'default') };
}

function isTruthySuccess(value) {
  return value === true || value === 'true';
}

// True when Retell post-call data shows a successful intro booking tool call.
function hasSuccessfulIntroBooking(retellCall) {
  if (!retellCall || typeof retellCall !== 'object') return false;
  const toolCalls = Array.isArray(retellCall.tool_calls) ? retellCall.tool_calls : [];
  if (toolCalls.some(t => t && BOOKING_TOOLS.has(t.name) && isTruthySuccess(t.success ?? t.successful))) return true;

  const turns = Array.isArray(retellCall.transcript_with_tool_calls) ? retellCall.transcript_with_tool_calls : [];
  const bookingIds = new Set(turns
    .filter(t => t && t.role === 'tool_call_invocation' && BOOKING_TOOLS.has(t.name))
    .map(t => t.tool_call_id));
  return turns.some(t => t && t.role === 'tool_call_result' && bookingIds.has(t.tool_call_id)
    && isTruthySuccess(t.successful ?? t.success));
}

// Patch to auto-mark a call Booked, or null. Never overrides a status Hugh set by hand.
function autoBookedPatch(existing, retellCall) {
  if (!hasSuccessfulIntroBooking(retellCall)) return null;
  if (existing && existing.callStatusSource === 'manual') return null;
  const current = normalizeCallStatus(existing && existing.callStatus) || DEFAULT_CALL_STATUS;
  if (current !== DEFAULT_CALL_STATUS) return null;
  return { callStatus: 'booked', callStatusSource: 'auto', callStatusUpdatedAt: new Date().toISOString() };
}

module.exports = {
  CALL_STATUSES, DEFAULT_CALL_STATUS, BOOKING_TOOLS,
  normalizeCallStatus, withCallStatus, hasSuccessfulIntroBooking, autoBookedPatch,
};
