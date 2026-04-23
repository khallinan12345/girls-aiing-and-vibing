// api/chat.js - Vercel serverless function with model routing + prompt caching
//
// ROUTING LOGIC:
//   page = 'AILearningPage' | 'EnglishSkillsPage' |
//          'SkillsDevelopmentPage'
//     → Groq  llama-3.3-70b-versatile  (free, high volume learner chat)
//
//   page = 'VibeCodingPage' | 'WebDevelopmentPage' |
//          'FullStackDevelopmentPage' | 'AIWorkflowDevPage' |
//          'SkillsDevelopmentPage-code'
//     → Anthropic  claude-sonnet-4-6  (best for code generation/debugging)
//
//   page = 'AIPlaygroundPage'
//     → Anthropic  claude-haiku-4-5-20251001  (default)
//        OR claude-sonnet-4-6 if playgroundModel === 'claude-sonnet-4-6'
//
//   all other pages / no page supplied
//     → Anthropic  claude-haiku-4-5-20251001  (default)
//
// PROMPT CACHING: applied automatically on all Anthropic calls.
//   The system prompt is marked with cache_control so repeated calls within
//   the 5-minute TTL are charged at ~10% of normal input cost.

// ── Constants ──────────────────────────────────────────────────────────────────

const GROQ_PAGES   = new Set([
  'AILearningPage',
  'EnglishSkillsPage',
  'SkillsDevelopmentPage',
  'AgricultureConsultantPage',
  'FishingConsultantPage',
  'HealthcareNavigatorPage',
  'EntrepreneurshipConsultantPage',
  'AIAmbassadorsPage',
]);

const SONNET_PAGES = new Set([
  'VibeCodingPage',
  'WebDevelopmentPage',
  'FullStackDevelopmentPage',
  'AIWorkflowDevPage',
  'SkillsDevelopmentPage-code',   // code gen, vibe prompt, debugging inside SkillsDev
]);

const ANTHROPIC_HAIKU  = 'claude-haiku-4-5-20251001';
const ANTHROPIC_SONNET = 'claude-sonnet-4-6';
const GROQ_MODEL       = 'llama-3.3-70b-versatile';

// ── Pricing table (per million tokens, USD) ───────────────────────────────────
// Matches current Anthropic + Groq pricing as of April 2026

const PRICING = {
  // Anthropic models
  'claude-sonnet-4-6':           { input: 3.00,  output: 15.00, cacheWrite: 3.75,  cacheRead: 0.30  },
  'claude-haiku-4-5-20251001':   { input: 1.00,  output: 5.00,  cacheWrite: 1.25,  cacheRead: 0.10  },
  // Groq (free tier — effectively $0 for our usage level)
  'llama-3.3-70b-versatile':     { input: 0.00,  output: 0.00,  cacheWrite: 0.00,  cacheRead: 0.00  },
};

function estimateCost(model, inputTokens, outputTokens, cacheHitTokens = 0, cacheWriteTokens = 0) {
  const p = PRICING[model] || { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 };
  const MTok = 1_000_000;
  // Standard input — subtract cached tokens (they're billed separately)
  const standardInput = Math.max(0, inputTokens - cacheHitTokens - cacheWriteTokens);
  return (
    (standardInput    / MTok) * p.input      +
    (cacheWriteTokens / MTok) * p.cacheWrite  +
    (cacheHitTokens   / MTok) * p.cacheRead   +
    (outputTokens     / MTok) * p.output
  );
}

// ── Cost logger ───────────────────────────────────────────────────────────────
// Writes to Supabase api_cost_log table (fire-and-forget, non-blocking)

async function logCost({ page, provider, model, inputTokens, outputTokens,
                          cacheHitTokens, cacheWriteTokens, userId, city }) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) return; // skip if not configured

  const estimatedCost = estimateCost(model, inputTokens, outputTokens, cacheHitTokens, cacheWriteTokens);

  try {
    await fetch(`${supabaseUrl}/rest/v1/api_cost_log`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'apikey':        supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Prefer':        'return=minimal',
      },
      body: JSON.stringify({
        page:               page || 'unknown',
        provider,
        model,
        input_tokens:       inputTokens,
        output_tokens:      outputTokens,
        cache_hit_tokens:   cacheHitTokens,
        cache_write_tokens: cacheWriteTokens,
        estimated_cost_usd: estimatedCost,
        user_id:            userId || null,
        city:               city   || null,
      }),
    });
  } catch { /* never block the response for logging */ }
}

// ── Route resolver ─────────────────────────────────────────────────────────────

function resolveRoute(page, playgroundModel) {
  if (GROQ_PAGES.has(page)) {
    return { provider: 'groq', model: GROQ_MODEL };
  }
  if (SONNET_PAGES.has(page)) {
    return { provider: 'anthropic', model: ANTHROPIC_SONNET };
  }
  if (page === 'AIPlaygroundPage') {
    const model = playgroundModel === ANTHROPIC_SONNET ? ANTHROPIC_SONNET : ANTHROPIC_HAIKU;
    return { provider: 'anthropic', model };
  }
  // Default: Haiku for all other pages (assessments, advice, JSON calls)
  return { provider: 'anthropic', model: ANTHROPIC_HAIKU };
}

// ── Anthropic call (with prompt caching on system prompt) ──────────────────────

async function callAnthropic(model, messages, system, max_tokens, temperature) {
  // Wrap system string in a content block with cache_control so Anthropic
  // caches it for 5 minutes. Repeated calls with the same system prompt
  // are charged at ~10% of normal input cost (cache reads).
  const systemPayload = system
    ? [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }]
    : undefined;

  const requestBody = {
    model,
    max_tokens,
    temperature,
    messages,
    ...(systemPayload ? { system: systemPayload } : {}),
  };

  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key':          process.env.ANTHROPIC_API_KEY,
      'anthropic-version':  '2023-06-01',
      'anthropic-beta':     'prompt-caching-2024-07-31',
      'Content-Type':       'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  const data = await upstream.json();

  if (!upstream.ok) {
    const err = new Error(data.error?.message || 'Anthropic API error');
    err.status = upstream.status;
    err.anthropic_error = data;
    throw err;
  }

  // Return OpenAI-shaped response so chatClient.ts needs no changes
  const text = data?.content?.[0]?.text ?? '';
  return {
    id:     data.id,
    object: 'chat.completion',
    model:  data.model,
    choices: [{
      index:         0,
      message:       { role: 'assistant', content: text },
      finish_reason: data.stop_reason ?? 'stop',
    }],
    usage: {
      prompt_tokens:     data.usage?.input_tokens  ?? 0,
      completion_tokens: data.usage?.output_tokens ?? 0,
      total_tokens: (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0),
      // Cache stats for monitoring — ignored by chatClient.ts
      cache_creation_input_tokens: data.usage?.cache_creation_input_tokens ?? 0,
      cache_read_input_tokens:     data.usage?.cache_read_input_tokens     ?? 0,
    },
    _route: { provider: 'anthropic', model: data.model },
  };
}

// ── Groq call ──────────────────────────────────────────────────────────────────

async function callGroq(model, messages, system, max_tokens, temperature) {
  // Groq uses the OpenAI chat completions format natively.
  // Prepend system as a system-role message.
  const groqMessages = [
    ...(system ? [{ role: 'system', content: system }] : []),
    ...messages,
  ];

  const upstream = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      model,
      messages: groqMessages,
      max_tokens,
      temperature,
    }),
  });

  const data = await upstream.json();

  if (!upstream.ok) {
    const err = new Error(data.error?.message || 'Groq API error');
    err.status = upstream.status;
    err.groq_error = data;
    throw err;
  }

  // Groq already returns OpenAI shape — pass through with route tag
  return { ...data, _route: { provider: 'groq', model } };
}

// ── Groq with 429 fallback ─────────────────────────────────────────────────────
// Attempts Groq first. On 429 (rate limit): waits retry-after header duration
// (capped at 8 s), retries once, then falls back to Haiku if still rate-limited.
// This keeps the English / Learning / Consultant pages resilient during peak usage
// without surfacing errors to learners.

async function callGroqWithFallback(model, messages, system, max_tokens, temperature) {
  const attempt = async () => {
    const groqMessages = [
      ...(system ? [{ role: 'system', content: system }] : []),
      ...messages,
    ];
    const upstream = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({ model, messages: groqMessages, max_tokens, temperature }),
    });
    return upstream;
  };

  let upstream = await attempt();

  // First attempt: handle 429 with a single retry after the retry-after delay
  if (upstream.status === 429) {
    const retryAfterMs = Math.min(
      parseFloat(upstream.headers.get('retry-after') || '2') * 1000,
      8000,  // never wait more than 8 s on a serverless function
    );
    console.warn(`[chat.js] Groq 429 — retrying after ${retryAfterMs}ms`);
    await new Promise(r => setTimeout(r, retryAfterMs));
    upstream = await attempt();
  }

  // Second 429 (or still rate-limited) → fall back to Haiku silently
  if (upstream.status === 429) {
    console.warn('[chat.js] Groq still 429 after retry — falling back to Haiku');
    return { ...(await callAnthropic(ANTHROPIC_HAIKU, messages, system, max_tokens, temperature)), _fallback: true };
  }

  const data = await upstream.json();

  if (!upstream.ok) {
    const err = new Error(data.error?.message || 'Groq API error');
    err.status = upstream.status;
    err.groq_error = data;
    throw err;
  }

  return { ...data, _route: { provider: 'groq', model } };
}

// ── Streaming Anthropic call (for AIPlaygroundPage) ───────────────────────────
// Pipes Anthropic's SSE stream directly to the client so Vercel never has to
// buffer the full response — keeps the function alive for long code outputs.

async function callAnthropicStreaming(model, messages, system, max_tokens, temperature, res) {
  const systemPayload = system
    ? [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }]
    : undefined;

  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key':          process.env.ANTHROPIC_API_KEY,
      'anthropic-version':  '2023-06-01',
      'anthropic-beta':     'prompt-caching-2024-07-31',
      'Content-Type':       'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens,
      temperature,
      messages,
      stream: true,
      ...(systemPayload ? { system: systemPayload } : {}),
    }),
  });

  if (!upstream.ok) {
    const errData = await upstream.json();
    throw Object.assign(
      new Error(errData.error?.message || 'Anthropic API error'),
      { status: upstream.status, anthropic_error: errData }
    );
  }

  // Set SSE headers before we start writing
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('X-Accel-Buffering', 'no');

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';
  let inputTokens = 0, outputTokens = 0, cacheHitTokens = 0, cacheWriteTokens = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop(); // keep incomplete line in buffer

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const raw = line.slice(6).trim();
      if (raw === '[DONE]') continue;
      try {
        const evt = JSON.parse(raw);

        if (evt.type === 'content_block_delta' && evt.delta?.type === 'text_delta') {
          const chunk = evt.delta.text;
          fullText += chunk;
          // Forward as SSE so the client can render tokens as they arrive
          res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
        }

        if (evt.type === 'message_delta' && evt.usage) {
          outputTokens = evt.usage.output_tokens ?? 0;
        }

        if (evt.type === 'message_start' && evt.message?.usage) {
          inputTokens      = evt.message.usage.input_tokens                   ?? 0;
          cacheHitTokens   = evt.message.usage.cache_read_input_tokens        ?? 0;
          cacheWriteTokens = evt.message.usage.cache_creation_input_tokens    ?? 0;
        }
      } catch { /* skip malformed SSE lines */ }
    }
  }

  // Send a final event with the complete text and usage so the client can
  // parse code blocks and update state in one shot
  res.write(`data: ${JSON.stringify({ done: true, fullText, usage: { inputTokens, outputTokens, cacheHitTokens, cacheWriteTokens } })}\n\n`);
  res.end();

  return { inputTokens, outputTokens, cacheHitTokens, cacheWriteTokens };
}

// ── Main handler ───────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json({
      message:   'Chat API is working (model routing enabled)',
      providers: ['anthropic/haiku', 'anthropic/sonnet', 'groq/llama-3.3-70b'],
      method:    'GET',
      timestamp: new Date().toISOString(),
    });
  }

  if (req.method !== 'POST') {
    res.setHeader('Content-Type', 'application/json');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      messages,
      system,
      max_tokens      = 500,
      temperature     = 0.7,
      page            = '',
      playgroundModel = null,
      userId          = null,
      city            = null,
      stream          = false,  // client opts in to streaming
    } = req.body || {};

    if (!messages || !Array.isArray(messages)) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(400).json({ error: 'Messages array is required' });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(500).json({ error: 'Anthropic API key not configured' });
    }

    const { provider, model } = resolveRoute(page, playgroundModel);

    console.log(`[chat.js] page="${page}" stream=${stream} → provider=${provider} model=${model}`);

    // ── Streaming path (AIPlaygroundPage opts in) ──────────────────────────────
    if (stream && provider === 'anthropic') {
      const usage = await callAnthropicStreaming(model, messages, system, max_tokens, temperature, res);
      logCost({
        page, provider: 'anthropic', model,
        inputTokens:       usage.inputTokens,
        outputTokens:      usage.outputTokens,
        cacheHitTokens:    usage.cacheHitTokens,
        cacheWriteTokens:  usage.cacheWriteTokens,
        userId, city,
      });
      return; // res already ended by callAnthropicStreaming
    }

    // ── Non-streaming path (all other pages, unchanged) ────────────────────────
    res.setHeader('Content-Type', 'application/json');

    if (provider === 'groq') {
      if (!process.env.GROQ_API_KEY) {
        console.warn('[chat.js] GROQ_API_KEY not set — falling back to Haiku');
        const result = await callAnthropic(ANTHROPIC_HAIKU, messages, system, max_tokens, temperature);
        logCost({
          page, provider: 'anthropic', model: ANTHROPIC_HAIKU,
          inputTokens:       result.usage?.prompt_tokens     ?? 0,
          outputTokens:      result.usage?.completion_tokens ?? 0,
          cacheHitTokens:    result.usage?.cache_read_input_tokens    ?? 0,
          cacheWriteTokens:  result.usage?.cache_creation_input_tokens ?? 0,
          userId, city,
        });
        return res.status(200).json(result);
      }
      const result = await callGroqWithFallback(model, messages, system, max_tokens, temperature);
      const wasFallback = result._fallback === true;
      logCost({
        page,
        provider:    wasFallback ? 'anthropic'    : 'groq',
        model:       wasFallback ? ANTHROPIC_HAIKU : model,
        inputTokens:       result.usage?.prompt_tokens               ?? 0,
        outputTokens:      result.usage?.completion_tokens           ?? 0,
        cacheHitTokens:    result.usage?.cache_read_input_tokens     ?? 0,
        cacheWriteTokens:  result.usage?.cache_creation_input_tokens ?? 0,
        userId, city,
      });
      return res.status(200).json(result);
    }

    // provider === 'anthropic' non-streaming
    const result = await callAnthropic(model, messages, system, max_tokens, temperature);
    logCost({
      page, provider: 'anthropic', model,
      inputTokens:       result.usage?.prompt_tokens     ?? 0,
      outputTokens:      result.usage?.completion_tokens ?? 0,
      cacheHitTokens:    result.usage?.cache_read_input_tokens    ?? 0,
      cacheWriteTokens:  result.usage?.cache_creation_input_tokens ?? 0,
      userId, city,
    });
    return res.status(200).json(result);

  } catch (error) {
    console.error('[chat.js] Error:', error);
    const status = error.status || 500;
    // If headers already sent (streaming started), we can't send JSON error
    if (!res.headersSent) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(status).json({
        error:           `Server error: ${error.message}`,
        anthropic_error: error.anthropic_error,
        groq_error:      error.groq_error,
        type:            error.constructor?.name,
        stack:           process.env.NODE_ENV === 'development' ? error.stack : undefined,
      });
    }
    res.end();
  }
}