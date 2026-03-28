// api/generate-web-code.ts — AI code generation & prompt critique using OpenAI
import type { VercelRequest, VercelResponse } from '@vercel/node';

interface ImageMeta {
  id: string;
  label: string;
  role: 'background' | 'icon' | 'logo' | 'hero' | 'photo' | 'other';
  width: number;
  height: number;
}

interface GenerateRequest {
  action: 'generate' | 'critique' | 'iterate';
  prompt: string;
  existingCode?: string;
  pageContext?: { name: string; code: string }[];
  images?: ImageMeta[];
}

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

async function callOpenAI(systemPrompt: string, userMessage: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.7,
      max_tokens: 8000,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error('OpenAI API error:', response.status, errorBody);
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

// ── Generate HTML/CSS/JS from a prompt ──────────────────────────────────────

async function generateCode(
  prompt: string,
  existingCode?: string,
  pageContext?: { name: string; code: string }[],
  images?: ImageMeta[]
): Promise<{ code: string; explanation: string }> {
  const contextBlock = pageContext?.length
    ? `\n\nThe learner's project already has these pages (maintain visual consistency):\n${pageContext
        .map((p) => `--- ${p.name} ---\n${p.code.substring(0, 500)}...`)
        .join('\n\n')}`
    : '';

  const existingBlock = existingCode
    ? `\n\nThe current code in the editor is:\n\`\`\`html\n${existingCode}\n\`\`\``
    : '';

  const imageBlock = images?.length
    ? `\n\nAVAILABLE UPLOADED IMAGES:\n${images
        .map((img) => `- ID: "${img.id}" | Label: "${img.label}" | Role: ${img.role} | Size: ${img.width}×${img.height}`)
        .join('\n')}\n\nTo use an uploaded image, set the src attribute to exactly: %%IMAGE_${'{id}'}%% (replacing {id} with the actual image ID). For example: <img src="%%IMAGE_abc1234%%" /> or as a CSS background: background-image: url('%%IMAGE_abc1234%%');`
    : '';

  const imageRule = images?.length
    ? `\n- The learner has uploaded images. When the prompt references an uploaded image (by label or role), use the placeholder %%IMAGE_{id}%% as the src or url value. NEVER use placeholder.com or other fake URLs. Only use the %%IMAGE_{id}%% syntax for uploaded images.`
    : '';

  const systemPrompt = `You are an expert web developer and teacher helping students learn to build web pages through "vibe coding" — turning natural language descriptions into working code.

RULES:
- Generate a COMPLETE, self-contained HTML file with embedded CSS and JavaScript.
- The code must be production-quality, well-structured, and visually polished.
- Use modern CSS (flexbox, grid, custom properties, gradients, transitions).
- Include helpful HTML comments explaining key sections so the learner can study the code.
- Make it responsive and visually impressive — students should feel proud of what they built.
- If the prompt is vague, make creative decisions and note them in your explanation.
- Do NOT use external frameworks or CDNs unless specifically asked.${imageRule}

RESPONSE FORMAT — you MUST follow this exactly:
Return your response in two clearly labeled sections:

===CODE===
(the complete HTML file here)
===END_CODE===

===EXPLANATION===
(2-3 sentences explaining what you built and any creative decisions you made)
===END_EXPLANATION===`;

  const userMessage = `${prompt}${contextBlock}${existingBlock}${imageBlock}`;

  const raw = await callOpenAI(systemPrompt, userMessage);

  const codeMatch = raw.match(/===CODE===\s*([\s\S]*?)\s*===END_CODE===/);
  const explainMatch = raw.match(
    /===EXPLANATION===\s*([\s\S]*?)\s*===END_EXPLANATION===/
  );

  const code = codeMatch?.[1]?.trim() || raw;
  const explanation =
    explainMatch?.[1]?.trim() || 'Code generated from your prompt.';

  return { code, explanation };
}

// ── Iterate on existing code with a new prompt ──────────────────────────────

async function iterateCode(
  prompt: string,
  existingCode: string,
  pageContext?: { name: string; code: string }[],
  images?: ImageMeta[]
): Promise<{ code: string; explanation: string }> {
  const contextBlock = pageContext?.length
    ? `\n\nOther pages in the project:\n${pageContext
        .map((p) => `--- ${p.name} ---\n${p.code.substring(0, 300)}...`)
        .join('\n\n')}`
    : '';

  const imageBlock = images?.length
    ? `\n\nAVAILABLE UPLOADED IMAGES:\n${images
        .map((img) => `- ID: "${img.id}" | Label: "${img.label}" | Role: ${img.role} | Size: ${img.width}×${img.height}`)
        .join('\n')}\n\nTo use an uploaded image, set the src attribute to exactly: %%IMAGE_${'{id}'}%% (replacing {id} with the actual image ID). For example: <img src="%%IMAGE_abc1234%%" /> or as a CSS background: background-image: url('%%IMAGE_abc1234%%');`
    : '';

  const imageRule = images?.length
    ? `\n- The learner has uploaded images. When the prompt references an uploaded image (by label or role), use the placeholder %%IMAGE_{id}%% as the src or url value. NEVER use placeholder.com or other fake URLs. Only use the %%IMAGE_{id}%% syntax for uploaded images.`
    : '';

  const systemPrompt = `You are an expert web developer and teacher. The learner has existing code and wants to modify or improve it based on a new prompt. This is an ITERATIVE process.

RULES:
- Modify the existing code to incorporate the learner's request.
- Preserve existing functionality unless the learner asks to change it.
- Keep the same overall structure and style unless told otherwise.
- Add helpful HTML comments for any NEW sections you add.
- Return a COMPLETE updated HTML file (not just a diff).${imageRule}

RESPONSE FORMAT — you MUST follow this exactly:
===CODE===
(the complete updated HTML file)
===END_CODE===

===EXPLANATION===
(2-3 sentences about what you changed and why)
===END_EXPLANATION===`;

  const userMessage = `Here is my current code:\n\`\`\`html\n${existingCode}\n\`\`\`\n\nPlease make these changes: ${prompt}${contextBlock}${imageBlock}`;

  const raw = await callOpenAI(systemPrompt, userMessage);

  const codeMatch = raw.match(/===CODE===\s*([\s\S]*?)\s*===END_CODE===/);
  const explainMatch = raw.match(
    /===EXPLANATION===\s*([\s\S]*?)\s*===END_EXPLANATION===/
  );

  return {
    code: codeMatch?.[1]?.trim() || raw,
    explanation: explainMatch?.[1]?.trim() || 'Code updated based on your prompt.',
  };
}

// ── Critique a prompt to help the learner improve ───────────────────────────

async function critiquePrompt(
  prompt: string,
  existingCode?: string
): Promise<{ critique: string; improvedPrompt: string; score: number }> {
  const codeBlock = existingCode
    ? `\n\nTheir current code in the editor:\n\`\`\`html\n${existingCode.substring(0, 1000)}\n\`\`\``
    : '';

  const systemPrompt = `You are a prompt engineering coach helping students learn to write better prompts for AI code generation (a skill called "vibe coding").

Evaluate their prompt on these dimensions:
1. SPECIFICITY — Did they describe what they want clearly?
2. VISUAL DETAIL — Did they mention colors, layout, spacing, fonts, or visual style?
3. CONTENT — Did they specify what text, images, or data to include?
4. INTERACTIVITY — Did they describe any user interactions or behaviors?
5. STRUCTURE — Did they mention sections, components, or page organization?

Be encouraging but specific. Students are learning — celebrate what they did well and give concrete suggestions.

RESPONSE FORMAT — you MUST follow this exactly:
===CRITIQUE===
(your friendly, constructive feedback in 3-5 bullet points — use emoji for visual flair)
===END_CRITIQUE===

===IMPROVED_PROMPT===
(rewrite their prompt as a stronger version they can learn from)
===END_IMPROVED_PROMPT===

===SCORE===
(a number from 1-10 rating the prompt quality)
===END_SCORE===`;

  const userMessage = `Here is the student's prompt:\n"${prompt}"${codeBlock}`;

  const raw = await callOpenAI(systemPrompt, userMessage);

  const critiqueMatch = raw.match(
    /===CRITIQUE===\s*([\s\S]*?)\s*===END_CRITIQUE===/
  );
  const improvedMatch = raw.match(
    /===IMPROVED_PROMPT===\s*([\s\S]*?)\s*===END_IMPROVED_PROMPT===/
  );
  const scoreMatch = raw.match(/===SCORE===\s*(\d+)\s*===END_SCORE===/);

  return {
    critique: critiqueMatch?.[1]?.trim() || 'Could not generate critique.',
    improvedPrompt: improvedMatch?.[1]?.trim() || prompt,
    score: parseInt(scoreMatch?.[1] || '5', 10),
  };
}

// ── Main handler ────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')
    return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { action, prompt, existingCode, pageContext, images }: GenerateRequest =
      req.body;

    if (!action || !prompt) {
      return res.status(400).json({ error: 'Missing action or prompt' });
    }

    if (prompt.length > 5000) {
      return res.status(400).json({ error: 'Prompt too long (max 5,000 chars)' });
    }

    console.log(`[generate-web-code] action=${action}, prompt="${prompt.substring(0, 80)}...", images=${images?.length || 0}`);

    switch (action) {
      case 'generate': {
        const result = await generateCode(prompt, existingCode, pageContext, images);
        return res.status(200).json({ success: true, ...result });
      }
      case 'iterate': {
        if (!existingCode) {
          return res.status(400).json({ error: 'Existing code required for iterate' });
        }
        const result = await iterateCode(prompt, existingCode, pageContext, images);
        return res.status(200).json({ success: true, ...result });
      }
      case 'critique': {
        const result = await critiquePrompt(prompt, existingCode);
        return res.status(200).json({ success: true, ...result });
      }
      default:
        return res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error: any) {
    console.error('[generate-web-code] Error:', error);
    return res.status(500).json({
      error: error.message || 'Internal server error',
      success: false,
    });
  }
}