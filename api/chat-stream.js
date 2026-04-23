// api/chat-stream.js — Edge function for AIPlaygroundPage streaming
// No timeout limit. Pipes Anthropic SSE directly to the browser.
// Used exclusively by AIPlaygroundPage; all other pages use /api/chat.

export const config = { runtime: 'edge' };

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default async function handler(req) {
  // CORS preflight
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
    userId      = null,
  } = body;

  if (!messages || !Array.isArray(messages)) {
    return new Response(JSON.stringify({ error: 'messages array required' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const systemPayload = system
    ? [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }]
    : undefined;

  // Call Anthropic with streaming
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
      messages,
      ...(systemPayload ? { system: systemPayload } : {}),
    }),
  });

  if (!upstream.ok) {
    const err = await upstream.json();
    return new Response(JSON.stringify({ error: err?.error?.message ?? 'Anthropic error' }), {
      status: upstream.status,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  // Transform Anthropic SSE → our simpler SSE format
  // Anthropic emits: data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"..."}}
  // We emit:         data: {"chunk":"..."}   and finally   data: {"done":true,"fullText":"..."}
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  // Process the upstream stream in the background
  (async () => {
    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    let sseBuffer = '';
    let fullText = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        sseBuffer += decoder.decode(value, { stream: true });
        const lines = sseBuffer.split('\n');
        sseBuffer = lines.pop(); // keep incomplete line

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (raw === '[DONE]') continue;
          try {
            const evt = JSON.parse(raw);
            if (evt.type === 'content_block_delta' && evt.delta?.type === 'text_delta') {
              const chunk = evt.delta.text;
              fullText += chunk;
              await writer.write(encoder.encode(`data: ${JSON.stringify({ chunk })}\n\n`));
            }
          } catch { /* skip malformed lines */ }
        }
      }
    } finally {
      // Always send done event and close
      await writer.write(encoder.encode(`data: ${JSON.stringify({ done: true, fullText })}\n\n`));

      // Log cost to Supabase (fire-and-forget)
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (supabaseUrl && supabaseKey && fullText) {
        // Rough token estimate: 1 token ≈ 4 chars
        const estimatedOutputTokens = Math.ceil(fullText.length / 4);
        fetch(`${supabaseUrl}/rest/v1/api_cost_log`, {
          method: 'POST',
          headers: {
            'Content-Type':  'application/json',
            'apikey':        supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Prefer':        'return=minimal',
          },
          body: JSON.stringify({
            page:               'AIPlaygroundPage',
            provider:           'anthropic',
            model,
            input_tokens:       0, // not tracked in edge stream
            output_tokens:      estimatedOutputTokens,
            cache_hit_tokens:   0,
            cache_write_tokens: 0,
            estimated_cost_usd: (estimatedOutputTokens / 1_000_000) * 15.0,
            user_id:            userId || null,
            city:               null,
            timestamp:          new Date().toISOString(),
          }),
        }).catch(() => {});
      }

      await writer.close();
    }
  })();

  return new Response(readable, {
    status: 200,
    headers: {
      ...CORS_HEADERS,
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
    },
  });
}