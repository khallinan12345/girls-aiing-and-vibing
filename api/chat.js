// api/chat.js - Vercel serverless function for Vite project
// Model: Claude Sonnet 4.6 (Anthropic)
export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    return res.status(200).json({
      message: 'Chat API is working (Claude Sonnet 4.6)',
      method: 'GET',
      timestamp: new Date().toISOString(),
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('Chat API - POST request received');

    const { messages, system, max_tokens = 500, temperature = 0.7 } = req.body || {};

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: 'Anthropic API key not configured' });
    }

    console.log('Making Anthropic request...');

    const requestBody = {
      model: 'claude-sonnet-4-6',
      max_tokens,
      temperature,
      messages, // Anthropic uses the same [{role, content}] format
      ...(system ? { system } : {}),
    };

    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    console.log('Anthropic response status:', upstream.status);
    const data = await upstream.json();

    if (!upstream.ok) {
      console.log('Anthropic API error:', data);
      return res.status(upstream.status).json({
        error: `Anthropic API error: ${data.error?.message || 'Unknown error'}`,
        anthropic_error: data,
      });
    }

    // Transform Anthropic response → OpenAI shape so chatClient.ts needs no changes
    // Anthropic: data.content[0].text
    // OpenAI:    data.choices[0].message.content  ← what chatClient.ts reads
    const text = data?.content?.[0]?.text ?? '';
    const openAiShaped = {
      id: data.id,
      object: 'chat.completion',
      model: data.model,
      choices: [
        {
          index: 0,
          message: { role: 'assistant', content: text },
          finish_reason: data.stop_reason ?? 'stop',
        },
      ],
      usage: {
        prompt_tokens:     data.usage?.input_tokens  ?? 0,
        completion_tokens: data.usage?.output_tokens ?? 0,
        total_tokens: (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0),
      },
    };

    console.log('Returning successful response');
    return res.status(200).json(openAiShaped);

  } catch (error) {
    console.log('Server error:', error);
    return res.status(500).json({
      error: `Server error: ${error.message}`,
      type: error.constructor.name,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
}