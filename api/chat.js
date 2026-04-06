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
  'SkillsDevelopmentPage',        // conversation turns, reflection, English coaching
  'AgricultureConsultantPage',    // farmer persona chat + evaluation
  'HealthcareNavigatorPage',      // clinical navigator chat + assessment
  'EntrepreneurshipAdvisorPage',  // startup advisor chat + evaluation
  'FishingConsultantPage',
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

// ── Main handler ───────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    return res.status(200).json({
      message:   'Chat API is working (model routing enabled)',
      providers: ['anthropic/haiku', 'anthropic/sonnet', 'groq/llama-3.3-70b'],
      method:    'GET',
      timestamp: new Date().toISOString(),
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      messages,
      system,
      max_tokens      = 500,
      temperature     = 0.7,
      page            = '',    // e.g. 'AILearningPage', 'SkillsDevelopmentPage-code'
      playgroundModel = null,  // e.g. 'claude-sonnet-4-6' or null
    } = req.body || {};

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: 'Anthropic API key not configured' });
    }

    const { provider, model } = resolveRoute(page, playgroundModel);

    console.log(`[chat.js] page="${page}" → provider=${provider} model=${model}`);

    if (provider === 'groq') {
      if (!process.env.GROQ_API_KEY) {
        // Graceful fallback to Haiku if Groq key is missing
        console.warn('[chat.js] GROQ_API_KEY not set — falling back to Haiku');
        const result = await callAnthropic(ANTHROPIC_HAIKU, messages, system, max_tokens, temperature);
        return res.status(200).json(result);
      }
      const result = await callGroq(model, messages, system, max_tokens, temperature);
      return res.status(200).json(result);
    }

    // provider === 'anthropic' (haiku or sonnet)
    const result = await callAnthropic(model, messages, system, max_tokens, temperature);
    return res.status(200).json(result);

  } catch (error) {
    console.error('[chat.js] Error:', error);
    const status = error.status || 500;
    return res.status(status).json({
      error:           `Server error: ${error.message}`,
      anthropic_error: error.anthropic_error,
      groq_error:      error.groq_error,
      type:            error.constructor?.name,
      stack:           process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
}