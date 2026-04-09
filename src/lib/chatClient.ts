// src/lib/chatClient.ts
export type Role = 'user' | 'assistant' | 'system';
export type ChatMessage = { role: Role; content: string };

// ── Identity store ────────────────────────────────────────────────────────────
// Call setChatIdentity once after login (in App.tsx).
// Every subsequent chatText/chatJSON call automatically forwards userId + city
// to chat.js for per-learner cost attribution in api_cost_log.
let _chatUserId: string | null = null;
let _chatCity:   string | null = null;

export function setChatIdentity(userId: string | null, city: string | null): void {
  _chatUserId = userId;
  _chatCity   = city;
}

type BaseArgs = {
  messages: ChatMessage[];
  system?: string;
  max_tokens?: number;
  temperature?: number;
  page?: string;             // routes to correct model in chat.js
  playgroundModel?: string | null;
};

// Returns plain text from /api/chat
export async function chatText({
  messages,
  system,
  max_tokens = 800,
  temperature = 0.7,
  page,
  playgroundModel,
}: BaseArgs): Promise<string> {
  const r = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages, system, max_tokens, temperature,
      page:            page            ?? '',
      playgroundModel: playgroundModel ?? null,
      userId:          _chatUserId,
      city:            _chatCity,
    }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data?.error || `Chat proxy error ${r.status}`);

  // OpenAI-like response passthrough; return the assistant text
  return data?.choices?.[0]?.message?.content ?? '';
}

// Returns a parsed JSON object (for rubric/evaluation responses)
export async function chatJSON({
  messages,
  system,
  max_tokens = 800,
  temperature = 0.2,
  page,
  playgroundModel,
}: BaseArgs): Promise<any> {
  const r = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages, system, max_tokens, temperature,
      page:            page            ?? '',
      playgroundModel: playgroundModel ?? null,
      userId:          _chatUserId,
      city:            _chatCity,
    }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data?.error || `Chat proxy error ${r.status}`);

  let raw = data?.choices?.[0]?.message?.content || '{}';
  
  // Strip markdown code fences if present (e.g., ```json ... ``` or ``` ... ```)
  raw = raw.trim();
  if (raw.startsWith('```')) {
    // Remove opening fence (```json or ```)
    raw = raw.replace(/^```(?:json)?\s*\n?/, '');
    // Remove closing fence (```)
    raw = raw.replace(/\n?```\s*$/, '');
    raw = raw.trim();
  }
  
  try {
    return JSON.parse(raw);
  } catch (error) {
    console.error('[chatJSON] Failed to parse JSON:', error);
    console.error('[chatJSON] Raw content:', raw);
    // Fallback: return raw if model sent non-JSON
    return raw;
  }
}

// Optional image generation helper (if your page needs it)
export async function generateImageViaServer({
  prompt,
  size = '1024x1024',
}: {
  prompt: string;
  size?: '512x512' | '1024x1024' | '2048x2048';
}) {
  const r = await fetch('/api/image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, size }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data?.error || `Image proxy error ${r.status}`);
  return data; // { b64: string }
}