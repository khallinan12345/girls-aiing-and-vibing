// api/chat-stream.js — Edge function for AIPlaygroundPage streaming
// No timeout limit. Pipes Anthropic SSE directly to the browser.
// Used exclusively by AIPlaygroundPage; all other pages use /api/chat.
//
// PATCH 2026-05-07: Rolling compression
//   When messages.length > COMPRESSION_THRESHOLD (20), the oldest messages
//   are compressed into a single summary pair using Haiku before the main
//   Anthropic call. The compressed history is returned in the done event
//   so the frontend can update its local state and Supabase.
//
// TRIAGE PATCH: errors now logged to Supabase system_events + email alert.

export const config = { runtime: 'edge' };

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// How many recent messages to keep verbatim — older ones get compressed
const COMPRESSION_THRESHOLD = 20;
const KEEP_RECENT           = 20;

// ─── Inline logger (Edge-safe — no Node imports) ─────────────────────────────
// Mirrors api-logger.ts but inline because Edge runtime can't import Node modules.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const RESEND_KEY   = process.env.RESEND_API_KEY || '';
const ALERT_EMAIL  = process.env.TRIAGE_ALERT_EMAIL || '';

async function logEvent({ function_name, event_type, severity, payload, user_id, cohort }) {
  // Write to Supabase (fire-and-forget — never blocks the stream)
  if (SUPABASE_URL && SUPABASE_KEY) {
    fetch(`${SUPABASE_URL}/rest/v1/system_events`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'apikey':        SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer':        'return=minimal',
      },
      body: JSON.stringify({
        function_name,
        event_type,
        severity,
        payload,
        user_id:    user_id  ?? null,
        cohort:     cohort   ?? null,
        created_at: new Date().toISOString(),
      }),
    }).catch(() => {}); // swallow — logging must never crash the stream
  }

  // Email on error/critical
  if ((severity === 'error' || severity === 'critical') && RESEND_KEY && ALERT_EMAIL) {
    fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${RESEND_KEY}`,
      },
      body: JSON.stringify({
        from:    'triage@girlsaiing.com',
        to:      ALERT_EMAIL,
        subject: `[Girls AIing] ${severity.toUpperCase()}: ${event_type} in ${function_name}`,
        html: `<h2>${event_type}</h2><p><strong>Function:</strong> ${function_name}</p>
               <pre>${JSON.stringify(payload, null, 2)}</pre>`,
      }),
    }).catch(() => {});
  }
}

// ─── Rolling compression ──────────────────────────────────────────────────────
//
// When a conversation exceeds COMPRESSION_THRESHOLD messages, compress the
// oldest (messages.length - KEEP_RECENT) messages into a single summary pair
// using Haiku (cheap, fast). The last KEEP_RECENT messages remain verbatim.
//
// Returns:
//   { compressed: true,  messages: [...summaryPair, ...recentMessages] }  — compression happened
//   { compressed: false, messages: originalMessages }                      — no compression needed

async function compressOldMessages(messages, apiKey) {
  if (messages.length <= COMPRESSION_THRESHOLD) {
    return { compressed: false, messages };
  }

  const splitAt      = messages.length - KEEP_RECENT;
  const toCompress   = messages.slice(0, splitAt);
  const recentMessages = messages.slice(splitAt);

  // Build a compact transcript of the messages to compress
  const transcript = toCompress
    .map(m => `[${m.role.toUpperCase()}]: ${(m.content || '').slice(0, 800)}`)
    .join('\n');

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
        'content-type':      'application/json',
      },
      body: JSON.stringify({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 600,
        temperature: 0.1,
        system: 'You are a conversation summariser. Write a concise factual summary of a chat history for use as context in an ongoing conversation. Include: key topics discussed, decisions made, important facts the user shared, and any code or artifacts produced. Write in third person. Be specific and dense — this replaces the full history.',
        messages: [{
          role:    'user',
          content: `Summarise this conversation history (${toCompress.length} messages) into a compact context summary:\n\n${transcript}`,
        }],
      }),
    });

    if (!res.ok) {
      // Compression failed — fall back to keeping all messages (safe default)
      console.warn('[chat-stream] Compression Haiku call failed:', res.status);
      return { compressed: false, messages };
    }

    const data   = await res.json();
    const summary = data.content?.[0]?.text ?? '';

    if (!summary) return { compressed: false, messages };

    // Inject as a synthetic user/assistant pair that looks natural in history
    const summaryPair = [
      {
        role:    'user',
        content: `[Earlier conversation summary — ${toCompress.length} messages compressed]`,
      },
      {
        role:    'assistant',
        content: `[SUMMARY OF EARLIER CONVERSATION]\n${summary}`,
      },
    ];

    return {
      compressed: true,
      messages:   [...summaryPair, ...recentMessages],
    };

  } catch (err) {
    // Never let compression crash the stream
    console.warn('[chat-stream] Compression error:', err.message);
    return { compressed: false, messages };
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const {
    messages,
    system,
    model       = 'claude-sonnet-4-6',
    max_tokens  = 16000,
    temperature = 0.3,
    user_id,    // pass through from AIPlaygroundPage if available
    cohort,
  } = body;

  if (!messages || !Array.isArray(messages)) {
    return new Response(JSON.stringify({ error: 'messages array required' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // TRIAGE: missing key is critical — platform is down
    await logEvent({
      function_name: 'chat-stream',
      event_type:    'missing_api_key',
      severity:      'critical',
      payload:       { message: 'ANTHROPIC_API_KEY is not set' },
      user_id, cohort,
    });
    return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const systemPayload = system
    ? [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }]
    : undefined;

  // ── Rolling compression ────────────────────────────────────────────────────
  // If the conversation is long, compress old messages before sending to Anthropic.
  // The frontend receives compressedMessages in the done event and updates Supabase.
  const { compressed, messages: messagesForApi } = await compressOldMessages(messages, apiKey);

  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key':         apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-beta':    'prompt-caching-2024-07-31',
      'content-type':      'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens,
      temperature,
      stream: true,
      messages: messagesForApi,
      ...(systemPayload ? { system: systemPayload } : {}),
    }),
  });

  // TRIAGE: catch upstream errors (401, 429, 500, etc.) before opening a stream
  if (!upstream.ok) {
    let errBody = {};
    try { errBody = await upstream.json(); } catch { /* ignore */ }

    // Classify severity
    const severity =
      upstream.status === 401 ? 'critical' :
      upstream.status === 429 ? 'error'    :
      upstream.status >= 500  ? 'error'    : 'warning';

    const event_type =
      upstream.status === 401 ? 'auth_error'       :
      upstream.status === 429 ? 'rate_limit'       :
      upstream.status === 400 ? 'invalid_request'  :
      upstream.status === 529 ? 'api_overloaded'   : `http_${upstream.status}`;

    await logEvent({
      function_name: 'chat-stream',
      event_type,
      severity,
      payload: {
        status:     upstream.status,
        message:    errBody?.error?.message ?? 'Anthropic error',
        model,
        max_tokens,
        user_id,
        cohort,
      },
      user_id, cohort,
    });

    return new Response(
      JSON.stringify({ error: errBody?.error?.message ?? 'Anthropic error' }),
      {
        status: upstream.status,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      }
    );
  }

  // ── Stream transform ────────────────────────────────────────────────────────

  const { readable, writable } = new TransformStream();
  const writer  = writable.getWriter();
  const encoder = new TextEncoder();

  (async () => {
    const reader    = upstream.body.getReader();
    const decoder   = new TextDecoder();
    let sseBuffer   = '';
    let fullText    = '';
    let chunkCount  = 0;
    let parseErrors = 0;
    let streamError = null;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        sseBuffer += decoder.decode(value, { stream: true });
        const lines = sseBuffer.split('\n');
        sseBuffer = lines.pop();

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (raw === '[DONE]') continue;

          try {
            const evt = JSON.parse(raw);
            if (evt.type === 'content_block_delta' && evt.delta?.type === 'text_delta') {
              const chunk = evt.delta.text;
              fullText += chunk;
              chunkCount++;
              await writer.write(encoder.encode(`data: ${JSON.stringify({ chunk })}\n\n`));
            }
            // TRIAGE: catch max_tokens at the stream level
            if (evt.type === 'message_delta' && evt.usage) {
              if (evt.delta?.stop_reason === 'max_tokens') {
                logEvent({                           // fire-and-forget
                  function_name: 'chat-stream',
                  event_type:    'max_tokens_hit',
                  severity:      'warning',
                  payload: {
                    stop_reason:   'max_tokens',
                    output_tokens: evt.usage.output_tokens,
                    model,
                    max_tokens_requested: max_tokens,
                    full_text_length: fullText.length,
                    note: 'Stream ended early — learner saw truncated response',
                  },
                  user_id, cohort,
                });
              }
            }
          } catch (parseErr) {
            // TRIAGE: count parse errors; log if excessive
            parseErrors++;
            if (parseErrors >= 5) {
              logEvent({
                function_name: 'chat-stream',
                event_type:    'sse_parse_errors',
                severity:      'warning',
                payload: { parseErrors, raw_sample: raw.slice(0, 200), model },
                user_id, cohort,
              });
              parseErrors = 0; // reset counter to avoid spam
            }
          }
        }
      }
    } catch (err) {
      streamError = err;
      // TRIAGE: mid-stream read failure (network drop, upstream hang)
      logEvent({
        function_name: 'chat-stream',
        event_type:    'stream_read_error',
        severity:      'error',
        payload: {
          message:    err.message,
          chunkCount,
          full_text_length: fullText.length,
          model,
          note: 'Stream interrupted mid-response',
        },
        user_id, cohort,
      });
    } finally {
      // Always close cleanly — send what we have
      // If compression happened, include the new compressed history so the
      // frontend can update its local state and write it back to Supabase.
      await writer.write(
        encoder.encode(
          `data: ${JSON.stringify({
            done: true,
            fullText,
            ...(streamError        ? { error: 'Stream interrupted' }          : {}),
            ...(compressed        ? { compressedMessages: messagesForApi }    : {}),
          })}\n\n`
        )
      );
      await writer.close();
    }
  })();

  return new Response(readable, {
    status: 200,
    headers: {
      ...CORS_HEADERS,
      'Content-Type':      'text/event-stream',
      'Cache-Control':     'no-cache',
      'X-Accel-Buffering': 'no',
    },
  });
}