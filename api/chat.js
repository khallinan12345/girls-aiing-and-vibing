// api/chat.js - Vercel serverless function with model routing + prompt caching + multi-provider fallback
//
// ROUTING LOGIC:
//   page = 'AILearningPage' | 'EnglishSkillsPage' |
//          'SkillsDevelopmentPage' | consultant pages
//     → Groq (primary) → Gemini → Cerebras → OpenRouter → Mistral → Anthropic Haiku (final)
//
//   page = 'VibeCodingPage' | 'WebDevelopmentPage' |
//          'FullStackDevelopmentPage' | 'AIWorkflowDevPage'
//     → taskType === 'coding'
//         → Anthropic claude-sonnet-4-6 (best for code generation/debugging)
//     → taskType !== 'coding' (explanations, planning, general Q&A)
//         → Groq (primary) → Gemini → Cerebras → OpenRouter → Mistral → Anthropic Haiku (final)
//
//   page = 'AIPlaygroundPage'
//     → Anthropic claude-haiku-4-5-20251001 (default)
//        OR claude-sonnet-4-6 if playgroundModel === 'claude-sonnet-4-6'
//
//   all other pages / no page supplied
//     → Anthropic claude-haiku-4-5-20251001 (default)
//
// TASK TYPE (for coding pages):
//   The frontend should send taskType = 'coding' | 'non-coding' in the request body.
//   'coding' tasks include: code generation, debugging, refactoring, code review,
//     writing tests, implementing features, fixing errors.
//   'non-coding' tasks include: concept explanations, project planning, tool comparisons,
//     career advice, general Q&A, resource recommendations.
//   If taskType is omitted on a coding page, it defaults to 'coding' (preserves current behavior).
//
// FALLBACK CHAIN (for free-tier-routed pages):
//   Groq → Gemini 2.0 Flash → Cerebras → OpenRouter (free) → Mistral → Anthropic Haiku
//
// PROMPT CACHING: applied automatically on all Anthropic calls.
//   The system prompt is marked with cache_control so repeated calls within
//   the 5-minute TTL are charged at ~10% of normal input cost.

import { GoogleGenerativeAI } from '@google/generative-ai';

// ── Constants ──────────────────────────────────────────────────────────────────

// Pages that always use the free-tier fallback chain (no task-type distinction)
const FREE_TIER_PAGES = new Set([
  'AILearningPage',
  'EnglishSkillsPage',
  'SkillsDevelopmentPage',
  'AgricultureConsultantPage',
  'FishingConsultantPage',
  'HealthcareNavigatorPage',
  'EntrepreneurshipConsultantPage',
  'AIAmbassadorsPage',
]);

// Pages that use Sonnet for coding tasks, free-tier for non-coding tasks
const HYBRID_CODING_PAGES = new Set([
  'VibeCodingPage',
  'WebDevelopmentPage',
  'FullStackDevelopmentPage',
  'AIWorkflowDevPage',
]);

const ANTHROPIC_HAIKU  = 'claude-haiku-4-5-20251001';
const ANTHROPIC_SONNET = 'claude-sonnet-4-6';
const GROQ_MODEL       = 'llama-3.3-70b-versatile';

// ── Fallback provider models ───────────────────────────────────────────────────

const GEMINI_MODEL      = 'gemini-2.0-flash';
const CEREBRAS_MODEL    = 'llama-3.3-70b';
const OPENROUTER_MODEL  = 'meta-llama/llama-3.3-70b-instruct:free';
const MISTRAL_MODEL     = 'mistral-small-latest';

// ── Pricing table (per million tokens, USD) ───────────────────────────────────

const PRICING = {
  'claude-sonnet-4-6':           { input: 3.00,  output: 15.00, cacheWrite: 3.75,  cacheRead: 0.30  },
  'claude-haiku-4-5-20251001':   { input: 1.00,  output: 5.00,  cacheWrite: 1.25,  cacheRead: 0.10  },
  'llama-3.3-70b-versatile':     { input: 0.00,  output: 0.00,  cacheWrite: 0.00,  cacheRead: 0.00  },
  'gemini-2.0-flash':            { input: 0.00,  output: 0.00,  cacheWrite: 0.00,  cacheRead: 0.00  },
  'llama-3.3-70b':               { input: 0.00,  output: 0.00,  cacheWrite: 0.00,  cacheRead: 0.00  },
  'meta-llama/llama-3.3-70b-instruct:free': { input: 0.00, output: 0.00, cacheWrite: 0.00, cacheRead: 0.00 },
  'mistral-small-latest':        { input: 0.00,  output: 0.00,  cacheWrite: 0.00,  cacheRead: 0.00  },
};

function estimateCost(model, inputTokens, outputTokens, cacheHitTokens = 0, cacheWriteTokens = 0) {
  const p = PRICING[model] || { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 };
  const MTok = 1_000_000;
  const standardInput = Math.max(0, inputTokens - cacheHitTokens - cacheWriteTokens);
  return (
    (standardInput    / MTok) * p.input      +
    (cacheWriteTokens / MTok) * p.cacheWrite  +
    (cacheHitTokens   / MTok) * p.cacheRead   +
    (outputTokens     / MTok) * p.output
  );
}

// ── Cooldown tracker ──────────────────────────────────────────────────────────

const providerCooldowns = new Map();
const COOLDOWN_DURATION        = 60 * 1000;
const MISSING_KEY_COOLDOWN     = 10 * 60 * 1000;

function isOnCooldown(providerName) {
  const until = providerCooldowns.get(providerName);
  if (!until) return false;
  if (Date.now() > until) {
    providerCooldowns.delete(providerName);
    return false;
  }
  return true;
}

function setCooldown(providerName, duration = COOLDOWN_DURATION) {
  providerCooldowns.set(providerName, Date.now() + duration);
}

// ── Error classification ──────────────────────────────────────────────────────

function isRateLimitOrQuotaError(error) {
  const status = error?.status || error?.statusCode;
  const message = error?.message?.toLowerCase() || '';
  return (
    status === 429 ||
    status === 403 ||
    message.includes('rate limit') ||
    message.includes('quota') ||
    message.includes('exceeded') ||
    message.includes('insufficient_quota') ||
    message.includes('resource_exhausted')
  );
}

function isMissingKeyError(error) {
  const message = error?.message?.toLowerCase() || '';
  return (
    error?.status === 401 ||
    message.includes('api key') ||
    message.includes('unauthorized') ||
    message.includes('authentication')
  );
}

// ── Cost logger ───────────────────────────────────────────────────────────────

async function logCost({ page, provider, model, inputTokens, outputTokens,
                          cacheHitTokens, cacheWriteTokens, userId, city, taskType }) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) return;

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
        logged_at:          new Date().toISOString(),
      }),
    });
  } catch { /* never block the response for logging */ }
}

// ── Route resolver ─────────────────────────────────────────────────────────────

function resolveRoute(page, playgroundModel, taskType) {
  // Free-tier pages (including SkillsDevelopmentPage) → fallback chain
  if (FREE_TIER_PAGES.has(page)) {
    return { provider: 'groq', model: GROQ_MODEL };
  }

  // Hybrid coding pages → Sonnet for coding, free-tier for everything else
  if (HYBRID_CODING_PAGES.has(page)) {
    if (taskType === 'non-coding') {
      return { provider: 'groq', model: GROQ_MODEL };
    }
    // Default to Sonnet (coding) if taskType is 'coding' or omitted
    return { provider: 'anthropic', model: ANTHROPIC_SONNET };
  }

  // SkillsDevelopmentPage-code → always Sonnet (explicit code variant)
  if (page === 'SkillsDevelopmentPage-code') {
    return { provider: 'anthropic', model: ANTHROPIC_SONNET };
  }

  // AIPlaygroundPage → user-selectable model
  if (page === 'AIPlaygroundPage') {
    const model = playgroundModel === ANTHROPIC_SONNET ? ANTHROPIC_SONNET : ANTHROPIC_HAIKU;
    return { provider: 'anthropic', model };
  }

  // Default → Haiku
  return { provider: 'anthropic', model: ANTHROPIC_HAIKU };
}

// ── Anthropic call (with prompt caching on system prompt) ──────────────────────

async function callAnthropic(model, messages, system, max_tokens, temperature) {
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
      cache_creation_input_tokens: data.usage?.cache_creation_input_tokens ?? 0,
      cache_read_input_tokens:     data.usage?.cache_read_input_tokens     ?? 0,
    },
    _route: { provider: 'anthropic', model: data.model },
  };
}

// ── Groq call ──────────────────────────────────────────────────────────────────

async function callGroq(model, messages, system, max_tokens, temperature) {
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

  const data = await upstream.json();

  if (!upstream.ok) {
    const err = new Error(data.error?.message || 'Groq API error');
    err.status = upstream.status;
    err.groq_error = data;
    throw err;
  }

  return { ...data, _route: { provider: 'groq', model } };
}

// ── Gemini call ────────────────────────────────────────────────────────────────

async function callGemini(model, messages, system, max_tokens, temperature) {
  const geminiClient = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const geminiModel = geminiClient.getGenerativeModel({ model });

  let prompt = '';
  if (system) prompt += `System instructions: ${system}\n\n`;
  for (const msg of messages) {
    const role = msg.role === 'assistant' ? 'Assistant' : 'User';
    prompt += `${role}: ${msg.content}\n`;
  }
  prompt += 'Assistant:';

  const result = await geminiModel.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { maxOutputTokens: max_tokens, temperature },
  });

  const text = result.response.text();

  return {
    id:     `gemini-${Date.now()}`,
    object: 'chat.completion',
    model,
    choices: [{
      index:         0,
      message:       { role: 'assistant', content: text },
      finish_reason: 'stop',
    }],
    usage: {
      prompt_tokens:     result.response.usageMetadata?.promptTokenCount     ?? 0,
      completion_tokens: result.response.usageMetadata?.candidatesTokenCount ?? 0,
      total_tokens:      result.response.usageMetadata?.totalTokenCount      ?? 0,
    },
    _route: { provider: 'gemini', model },
  };
}

// ── Cerebras call ──────────────────────────────────────────────────────────────

async function callCerebras(model, messages, system, max_tokens, temperature) {
  const cereMessages = [
    ...(system ? [{ role: 'system', content: system }] : []),
    ...messages,
  ];

  const upstream = await fetch('https://api.cerebras.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.CEREBRAS_API_KEY}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({ model, messages: cereMessages, max_tokens, temperature }),
  });

  const data = await upstream.json();

  if (!upstream.ok) {
    const err = new Error(data.error?.message || 'Cerebras API error');
    err.status = upstream.status;
    throw err;
  }

  return { ...data, _route: { provider: 'cerebras', model } };
}

// ── OpenRouter call ────────────────────────────────────────────────────────────

async function callOpenRouter(model, messages, system, max_tokens, temperature) {
  const orMessages = [
    ...(system ? [{ role: 'system', content: system }] : []),
    ...messages,
  ];

  const upstream = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({ model, messages: orMessages, max_tokens, temperature }),
  });

  const data = await upstream.json();

  if (!upstream.ok) {
    const err = new Error(data.error?.message || 'OpenRouter API error');
    err.status = upstream.status;
    throw err;
  }

  return { ...data, _route: { provider: 'openrouter', model } };
}

// ── Mistral call ───────────────────────────────────────────────────────────────

async function callMistral(model, messages, system, max_tokens, temperature) {
  const mistralMessages = [
    ...(system ? [{ role: 'system', content: system }] : []),
    ...messages,
  ];

  const upstream = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.MISTRAL_API_KEY}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({ model, messages: mistralMessages, max_tokens, temperature }),
  });

  const data = await upstream.json();

  if (!upstream.ok) {
    const err = new Error(data.error?.message || 'Mistral API error');
    err.status = upstream.status;
    throw err;
  }

  return { ...data, _route: { provider: 'mistral', model } };
}

// ── Free-tier fallback chain ───────────────────────────────────────────────────

async function callWithFallbackChain(messages, system, max_tokens, temperature) {
  const chain = [
    {
      name:     'groq',
      model:    GROQ_MODEL,
      keyEnv:   'GROQ_API_KEY',
      fn:       () => callGroq(GROQ_MODEL, messages, system, max_tokens, temperature),
    },
    {
      name:     'gemini',
      model:    GEMINI_MODEL,
      keyEnv:   'GEMINI_API_KEY',
      fn:       () => callGemini(GEMINI_MODEL, messages, system, max_tokens, temperature),
    },
    {
      name:     'cerebras',
      model:    CEREBRAS_MODEL,
      keyEnv:   'CEREBRAS_API_KEY',
      fn:       () => callCerebras(CEREBRAS_MODEL, messages, system, max_tokens, temperature),
    },
    {
      name:     'openrouter',
      model:    OPENROUTER_MODEL,
      keyEnv:   'OPENROUTER_API_KEY',
      fn:       () => callOpenRouter(OPENROUTER_MODEL, messages, system, max_tokens, temperature),
    },
    {
      name:     'mistral',
      model:    MISTRAL_MODEL,
      keyEnv:   'MISTRAL_API_KEY',
      fn:       () => callMistral(MISTRAL_MODEL, messages, system, max_tokens, temperature),
    },
    {
      name:     'anthropic',
      model:    ANTHROPIC_HAIKU,
      keyEnv:   'ANTHROPIC_API_KEY',
      fn:       () => callAnthropic(ANTHROPIC_HAIKU, messages, system, max_tokens, temperature),
    },
  ];

  const errors = [];

  for (const provider of chain) {
    if (!process.env[provider.keyEnv]) {
      console.log(`[chat.js] ⏭️  Skipping ${provider.name} (no ${provider.keyEnv})`);
      errors.push({ provider: provider.name, error: `${provider.keyEnv} not set` });
      continue;
    }

    if (isOnCooldown(provider.name)) {
      console.log(`[chat.js] ⏭️  Skipping ${provider.name} (on cooldown)`);
      errors.push({ provider: provider.name, error: 'on cooldown' });
      continue;
    }

    try {
      console.log(`[chat.js] Trying ${provider.name} (${provider.model})...`);
      const result = await provider.fn();
      console.log(`[chat.js] ✅ Success via ${provider.name}`);
      return {
        result,
        actualProvider: provider.name,
        actualModel:    provider.model,
        wasFallback:    provider.name !== 'groq',
      };
    } catch (error) {
      console.warn(`[chat.js] ⚠️ ${provider.name} failed:`, error.message);
      errors.push({ provider: provider.name, error: error.message });

      if (isRateLimitOrQuotaError(error)) {
        setCooldown(provider.name, COOLDOWN_DURATION);
      } else if (isMissingKeyError(error)) {
        setCooldown(provider.name, MISSING_KEY_COOLDOWN);
      }

      continue;
    }
  }

  const err = new Error(
    `All AI providers failed:\n${errors.map(e => `  ${e.provider}: ${e.error}`).join('\n')}`
  );
  err.status = 503;
  throw err;
}

// ── Streaming Anthropic call (for AIPlaygroundPage) ───────────────────────────

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
    buffer = lines.pop();

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const raw = line.slice(6).trim();
      if (raw === '[DONE]') continue;
      try {
        const evt = JSON.parse(raw);

        if (evt.type === 'content_block_delta' && evt.delta?.type === 'text_delta') {
          const chunk = evt.delta.text;
          fullText += chunk;
          res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
        }

        if (evt.type === 'message_delta' && evt.usage) {
          outputTokens = evt.usage.output_tokens ?? 0;
        }

        if (evt.type === 'message_start' && evt.message?.usage) {
          inputTokens      = evt.message.usage.input_tokens                ?? 0;
          cacheHitTokens   = evt.message.usage.cache_read_input_tokens     ?? 0;
          cacheWriteTokens = evt.message.usage.cache_creation_input_tokens ?? 0;
        }
      } catch { /* skip malformed SSE lines */ }
    }
  }

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
      message:   'Chat API is working (multi-provider fallback enabled)',
      providers: [
        'groq/llama-3.3-70b (primary free)',
        'gemini/2.0-flash (free fallback)',
        'cerebras/llama-3.3-70b (free fallback)',
        'openrouter/llama-3.3-70b:free (free fallback)',
        'mistral/small (free fallback)',
        'anthropic/haiku (paid fallback)',
        'anthropic/sonnet (coding tasks)',
      ],
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
      taskType        = null,
      userId          = null,
      city            = null,
      stream          = false,
    } = req.body || {};

    if (!messages || !Array.isArray(messages)) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(400).json({ error: 'Messages array is required' });
    }

    const { provider, model } = resolveRoute(page, playgroundModel, taskType);

    console.log(`[chat.js] page="${page}" taskType="${taskType}" stream=${stream} → provider=${provider} model=${model}`);

    // ── Streaming path (AIPlaygroundPage opts in) ──────────────────────────────
    if (stream && provider === 'anthropic') {
      if (!process.env.ANTHROPIC_API_KEY) {
        res.setHeader('Content-Type', 'application/json');
        return res.status(500).json({ error: 'Anthropic API key not configured' });
      }
      const usage = await callAnthropicStreaming(model, messages, system, max_tokens, temperature, res);
      logCost({
        page, provider: 'anthropic', model,
        inputTokens:       usage.inputTokens,
        outputTokens:      usage.outputTokens,
        cacheHitTokens:    usage.cacheHitTokens,
        cacheWriteTokens:  usage.cacheWriteTokens,
        userId, city, taskType,
      });
      return;
    }

    // ── Non-streaming path ─────────────────────────────────────────────────────
    res.setHeader('Content-Type', 'application/json');

    // FREE-TIER-ROUTED → use full fallback chain
    if (provider === 'groq') {
      const { result, actualProvider, actualModel, wasFallback } =
        await callWithFallbackChain(messages, system, max_tokens, temperature);

      logCost({
        page,
        provider:          actualProvider,
        model:             actualModel,
        inputTokens:       result.usage?.prompt_tokens               ?? 0,
        outputTokens:      result.usage?.completion_tokens           ?? 0,
        cacheHitTokens:    result.usage?.cache_read_input_tokens     ?? 0,
        cacheWriteTokens:  result.usage?.cache_creation_input_tokens ?? 0,
        userId, city, taskType,
      });

      if (wasFallback) {
        console.log(`[chat.js] 📋 Fallback used: ${actualProvider}/${actualModel} for page="${page}"`);
      }

      return res.status(200).json(result);
    }

    // ANTHROPIC-ROUTED (Sonnet for coding, Haiku for default/playground)
    if (!process.env.ANTHROPIC_API_KEY) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(500).json({ error: 'Anthropic API key not configured' });
    }

    const result = await callAnthropic(model, messages, system, max_tokens, temperature);
    logCost({
      page, provider: 'anthropic', model,
      inputTokens:       result.usage?.prompt_tokens     ?? 0,
      outputTokens:      result.usage?.completion_tokens ?? 0,
      cacheHitTokens:    result.usage?.cache_read_input_tokens    ?? 0,
      cacheWriteTokens:  result.usage?.cache_creation_input_tokens ?? 0,
      userId, city, taskType,
    });
    return res.status(200).json(result);

  } catch (error) {
    console.error('[chat.js] Error:', error);
    const status = error.status || 500;
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
