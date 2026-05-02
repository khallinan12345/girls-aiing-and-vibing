// api/ai-proxy.ts
// Thin proxy that forwards Anthropic API calls from the browser to Claude.
// The ANTHROPIC_API_KEY environment variable lives only on the server —
// it is never exposed in the browser bundle.
//
// Request body: standard Anthropic /v1/messages payload
//   { model, max_tokens, system?, messages, tools? }
//
// Response: raw Anthropic /v1/messages response
//   { content: [{ type, text }], ... }

import type { NextApiRequest, NextApiResponse } from 'next';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only accept POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY is not configured on the server' });
  }

  try {
    const { model, max_tokens, system, messages, tools } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages array is required' });
    }

    const payload: Record<string, any> = {
      model: model || 'claude-sonnet-4-6',
      max_tokens: max_tokens || 1000,
      messages,
    };
    if (system)   payload.system = system;
    if (tools)    payload.tools  = tools;

    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error?.message || `Anthropic API error ${response.status}`,
      });
    }

    return res.status(200).json(data);

  } catch (err: any) {
    console.error('[ai-proxy] Error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
