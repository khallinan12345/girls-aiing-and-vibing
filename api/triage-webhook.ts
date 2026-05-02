// api/triage-webhook.ts
// Receives POST from Supabase Database Webhook on system_events INSERT.
// Filters for actionable errors and triggers the GitHub Actions triage workflow
// via repository_dispatch.
//
// Supabase Webhook config:
//   Table:  system_events
//   Events: INSERT
//   URL:    https://your-vercel-domain.vercel.app/api/triage-webhook
//   Secret: set TRIAGE_WEBHOOK_SECRET in Vercel env vars

import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';

// ─── Error types that trigger the GitHub Action ───────────────────────────────

const ACTIONABLE_EVENTS = new Set([
  // Auto-fix path
  'rate_limit',
  'max_tokens_hit',
  'api_overloaded',
  'stream_read_error',
  'json_parse_failure',
  'sse_parse_errors',
  // PR path
  'unhandled_exception',
  'anthropic_server',
  'invalid_request',
  // Issue path
  'auth_error',
  'missing_api_key',
]);

// Severities that trigger the action (ignore 'info')
const ACTIONABLE_SEVERITIES = new Set(['warning', 'error', 'critical']);

// ─── Deduplicate — don't fire for the same error more than once per 10 min ───
// Simple in-memory dedup (good enough for serverless — resets on cold start)
const recentEvents = new Map<string, number>();
const DEDUP_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

function isDuplicate(key: string): boolean {
  const last = recentEvents.get(key);
  if (last && Date.now() - last < DEDUP_WINDOW_MS) return true;
  recentEvents.set(key, Date.now());
  // Prune old entries
  for (const [k, t] of recentEvents.entries()) {
    if (Date.now() - t > DEDUP_WINDOW_MS) recentEvents.delete(k);
  }
  return false;
}

// ─── Trigger GitHub Actions via repository_dispatch ──────────────────────────

async function triggerGitHubAction(event: {
  event_type: string;
  function_name: string;
  severity: string;
  payload: Record<string, unknown>;
}): Promise<void> {
  const token = process.env.TRIAGE_GITHUB_TOKEN;
  const repo  = process.env.GITHUB_REPO; // e.g. "kevinhallinan/girls-aiing-and-vibing"

  if (!token || !repo) {
    console.error('[triage-webhook] Missing TRIAGE_GITHUB_TOKEN or GITHUB_REPO env vars');
    return;
  }

  const response = await fetch(
    `https://api.github.com/repos/${repo}/dispatches`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept':        'application/vnd.github+json',
        'Content-Type':  'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({
        event_type:     'api_error_detected',
        client_payload: {
          event_type:    event.event_type,
          function_name: event.function_name,
          severity:      event.severity,
          payload:       event.payload,
          triggered_at:  new Date().toISOString(),
        },
      }),
    }
  );

  if (!response.ok) {
    const body = await response.text();
    console.error(`[triage-webhook] GitHub dispatch failed: ${response.status}`, body);
  } else {
    console.log(`[triage-webhook] GitHub Action triggered for ${event.event_type} in ${event.function_name}`);
  }
}

// ─── Verify Supabase webhook signature ───────────────────────────────────────

function verifySignature(req: VercelRequest, rawBody: string): boolean {
  const secret = process.env.TRIAGE_WEBHOOK_SECRET;
  if (!secret) return true; // skip verification if secret not configured (dev mode)

  const signature = req.headers['x-supabase-signature'] as string;
  if (!signature) return false;

  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(`sha256=${expected}`),
  );
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only accept POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Read raw body for signature verification
  const rawBody = JSON.stringify(req.body);

  // Verify signature
  if (!verifySignature(req, rawBody)) {
    console.warn('[triage-webhook] Invalid signature — request rejected');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // Supabase sends: { type: 'INSERT', table: 'system_events', record: {...}, ... }
  const { type, record } = req.body || {};

  if (type !== 'INSERT' || !record) {
    return res.status(200).json({ message: 'Ignored — not an INSERT event' });
  }

  const { event_type, function_name, severity, payload } = record;

  // Filter: only act on actionable events/severities
  if (!ACTIONABLE_EVENTS.has(event_type) || !ACTIONABLE_SEVERITIES.has(severity)) {
    return res.status(200).json({ message: `Ignored — ${event_type} / ${severity} not actionable` });
  }

  // Deduplicate — same error type + function within 10 minutes = skip
  const dedupKey = `${event_type}:${function_name}`;
  if (isDuplicate(dedupKey)) {
    console.log(`[triage-webhook] Deduped ${dedupKey} — already triggered recently`);
    return res.status(200).json({ message: 'Deduplicated — already triggered' });
  }

  // Fire the GitHub Action
  await triggerGitHubAction({ event_type, function_name, severity, payload });

  return res.status(200).json({
    message: 'Triage action triggered',
    event_type,
    function_name,
    severity,
  });
}
