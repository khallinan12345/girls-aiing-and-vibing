// lib/api-logger.ts
// Shared error/event logger for all API routes.
// Writes to Supabase `system_events` table and sends email alerts on critical failures.
// Drop-in for any edge or serverless function.

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL  || process.env.SUPABASE_URL  || '';
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const RESEND_KEY    = process.env.RESEND_API_KEY            || '';
const ALERT_EMAIL   = process.env.TRIAGE_ALERT_EMAIL        || 'kevin@yourdomain.com'; // ← set in env

// ─── Types ────────────────────────────────────────────────────────────────────

export type EventSeverity = 'info' | 'warning' | 'error' | 'critical';

export interface SystemEvent {
  function_name: string;       // e.g. 'chat-stream', 'generate-site-code'
  event_type: string;          // e.g. 'max_tokens_hit', 'auth_error', 'rate_limit'
  severity: EventSeverity;
  payload: Record<string, unknown>;
  user_id?: string;
  cohort?: string;
}

// ─── Supabase insert (works in both Edge and Node runtimes) ──────────────────

async function insertEvent(event: SystemEvent): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return; // silently skip if not configured

  try {
    await fetch(`${SUPABASE_URL}/rest/v1/system_events`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'apikey':        SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer':        'return=minimal',
      },
      body: JSON.stringify({
        function_name: event.function_name,
        event_type:    event.event_type,
        severity:      event.severity,
        payload:       event.payload,
        user_id:       event.user_id  ?? null,
        cohort:        event.cohort   ?? null,
        created_at:    new Date().toISOString(),
      }),
    });
  } catch {
    // Never let logging crash the actual request
  }
}

// ─── Email alert via Resend ───────────────────────────────────────────────────

async function sendAlert(event: SystemEvent): Promise<void> {
  if (!RESEND_KEY || !ALERT_EMAIL) return;

  const subject = `[Girls AIing] ${event.severity.toUpperCase()}: ${event.event_type} in ${event.function_name}`;
  const body = `
<h2 style="color:#c0392b">${event.severity.toUpperCase()}: ${event.event_type}</h2>
<p><strong>Function:</strong> ${event.function_name}</p>
<p><strong>Time:</strong> ${new Date().toISOString()}</p>
${event.cohort  ? `<p><strong>Cohort:</strong> ${event.cohort}</p>`  : ''}
${event.user_id ? `<p><strong>User:</strong> ${event.user_id}</p>`   : ''}
<h3>Details</h3>
<pre style="background:#f4f4f4;padding:12px;border-radius:4px">${JSON.stringify(event.payload, null, 2)}</pre>
<hr/>
<p style="color:#888;font-size:12px">Girls AIing Triage Agent</p>
  `.trim();

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${RESEND_KEY}`,
      },
      body: JSON.stringify({
        from:    'triage@girlsaiing.com',       // ← must match your Resend verified domain
        to:      ALERT_EMAIL,
        subject,
        html:    body,
      }),
    });
  } catch {
    // Never let alerting crash the actual request
  }
}

// ─── Main logger ──────────────────────────────────────────────────────────────

export async function logEvent(event: SystemEvent): Promise<void> {
  // Always write to Supabase
  await insertEvent(event);

  // Email only on error or critical
  if (event.severity === 'error' || event.severity === 'critical') {
    await sendAlert(event);
  }
}

// ─── Anthropic-specific error classifier ─────────────────────────────────────
// Parses the Anthropic error response body and maps it to a structured event.

export interface AnthropicError {
  status: number;
  body: Record<string, unknown>;
}

export function classifyAnthropicError(status: number, body: Record<string, unknown>): {
  event_type: string;
  severity: EventSeverity;
  message: string;
} {
  const msg = (body?.error as any)?.message ?? String(body);

  if (status === 401) return { event_type: 'auth_error',        severity: 'critical', message: msg };
  if (status === 429) return { event_type: 'rate_limit',        severity: 'error',    message: msg };
  if (status === 400) return { event_type: 'invalid_request',   severity: 'error',    message: msg };
  if (status === 529) return { event_type: 'api_overloaded',    severity: 'warning',  message: msg };
  if (status >= 500)  return { event_type: 'anthropic_server',  severity: 'error',    message: msg };
  return               { event_type: `http_${status}`,         severity: 'error',    message: msg };
}

// ─── Wrapped Anthropic fetch (Node/serverless runtime) ───────────────────────
// Drop-in replacement for the raw fetch() calls in generate-*.ts files.

export async function anthropicFetch(
  payload: Record<string, unknown>,
  callerName: string,
  meta?: { user_id?: string; cohort?: string },
): Promise<Response> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    await logEvent({
      function_name: callerName,
      event_type:    'missing_api_key',
      severity:      'critical',
      payload:       { message: 'ANTHROPIC_API_KEY is not set' },
      ...meta,
    });
    throw new Error('ANTHROPIC_API_KEY is not configured');
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type':      'application/json',
      'x-api-key':         apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    // Clone before reading so callers can still consume the body if needed
    const cloned = response.clone();
    let body: Record<string, unknown> = {};
    try { body = await cloned.json(); } catch { /* ignore */ }

    const { event_type, severity, message } = classifyAnthropicError(response.status, body);

    await logEvent({
      function_name: callerName,
      event_type,
      severity,
      payload: {
        status:  response.status,
        message,
        model:   payload.model,
        max_tokens: payload.max_tokens,
      },
      ...meta,
    });
  }

  return response;
}

// ─── Usage token tracker ──────────────────────────────────────────────────────
// Call after a successful response to catch silent max_tokens truncations.

export async function checkUsage(
  completion: { stop_reason?: string; usage?: { input_tokens?: number; output_tokens?: number } },
  callerName: string,
  model: string,
  meta?: { user_id?: string; cohort?: string },
): Promise<void> {
  if (completion.stop_reason === 'max_tokens') {
    await logEvent({
      function_name: callerName,
      event_type:    'max_tokens_hit',
      severity:      'warning',
      payload: {
        stop_reason:    completion.stop_reason,
        input_tokens:   completion.usage?.input_tokens,
        output_tokens:  completion.usage?.output_tokens,
        model,
        note: 'Response was truncated — JSON may be malformed or content incomplete',
      },
      ...meta,
    });
  }
}
