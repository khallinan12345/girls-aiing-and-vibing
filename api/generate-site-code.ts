// api/generate-site-code.ts
// Generates / iterates Vite + React static website code (no database).
//
// Request body:
//   action: 'generate' | 'iterate' | 'critique'
//   prompt: string
//   taskId: string
//   projectFiles: { path: string; content: string }[]
//   sessionContext: { siteName?, sitePurpose?, audience?, pages?, components? }
//   communicationStrategy?: any
//   learningStrategy?: any
//
// Response (generate/iterate):
//   { files: { path, content }[], explanation: string, sessionContext? }
// Response (critique):
//   { critique: string, feedback: string }

import type { NextApiRequest, NextApiResponse } from 'next';
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

// ─── Per-task guidance ────────────────────────────────────────────────────────

const TASK_GUIDANCE: Record<string, string> = {
  define_site: `
The student is defining their website's purpose, audience, and goals.
Do NOT write any component code yet.
Return a single file: README.md documenting:
- Site name and purpose (1–2 sentences)
- Target audience
- Key goals / what visitors will find (3–5 bullet points)
Also return sessionContext: { siteName, sitePurpose, audience }`,

  plan_pages: `
The student is planning the pages and component structure of their site.
Do NOT write full components yet.
Return a single file: src/PLAN.md listing:
- Which pages exist (e.g. Home, About, Projects, Contact) and their purpose
- Which reusable components are needed (Navbar, Footer, Card, etc.)
- The planned react-router-dom routes
Also return sessionContext: { pages: "comma-separated page names", components: "comma-separated component names" }`,

  app_shell: `
Build the application shell with react-router-dom v6 routing.
Return EXACTLY these four files — no more, no fewer:
1. src/App.jsx — BrowserRouter + Routes. One Route per planned page. Import each page component.
2. src/components/Navbar.jsx — navigation links using react-router-dom <Link>. Keep it concise.
3. src/components/Footer.jsx — site name, tagline, copyright year. Keep it concise.
4. src/index.css — CSS reset, font stack, 2–3 colour variables, minimal layout utilities only.

For pages not yet built, stub them inline in App.jsx as arrow-function placeholders — do NOT create separate placeholder files.
Keep every file SHORT. This is scaffolding only — detailed content and styling come in later tasks.
Return at most 4 files total.`,

  home_page: `
Build the Home page only. Return at most 2 files:
1. src/pages/HomePage.jsx — a complete home page with:
   - Hero section (headline, subheadline, one call-to-action button)
   - One feature/stats row (3 items)
   - One preview section linking to inner pages
   Keep the JSX concise — use CSS classes, not inline styles.
2. src/index.css — append only the new CSS classes used in HomePage.jsx. Do not rewrite existing rules.

Do NOT modify App.jsx, Navbar, Footer, or any other file.
Return at most 2 files total.`,

  content_pages: `
Build EXACTLY ONE content page based on the student's instruction.
Do NOT generate multiple pages in a single response — create only the page described in this prompt.
The page should:
- Have real, relevant content drawn from what the student wrote (not Lorem ipsum)
- Use consistent styling from index.css
- Import and use Navbar and Footer from src/components/
- Live at src/pages/<PageName>.jsx
Also return ONLY the updated src/App.jsx if and only if a new route needs to be added for this page.
Return at most 2 files total: the new page + App.jsx (if needed). Nothing else.`,

  interactivity: `
Add ONE interactive feature based on the student's instruction. Return at most 2 files:
1. The component or page file that contains the interactive feature (e.g. src/pages/ContactPage.jsx for a form, or src/components/FAQ.jsx for an accordion).
2. src/index.css — append only the new CSS classes needed. Do not rewrite existing rules.

Use useState and useEffect only — no external APIs, no Supabase.
Do NOT modify App.jsx, Navbar, Footer, or any other existing file unless a new route is strictly required.
One feature. Two files maximum.`,

  styling: `
Polish the site's visual design. Return ONLY src/index.css — no other files.
Update index.css to add or refine:
- CSS custom properties (--color-primary, --color-accent, --font-heading, --font-body, etc.)
- Typography scale (h1–h4, body, caption sizes)
- Spacing utilities (consistent margin/padding classes)
- Button and card styles
- Hover transitions (keep under 300ms)
Do NOT return any .jsx files. Components already use CSS classes — updating index.css is sufficient.
Return exactly 1 file: src/index.css.`,

  responsive: `
Make the site mobile-responsive. Return at most 2 files:
1. src/index.css — add media queries (mobile-first: 480px, 768px, 1024px). Cover layout, font sizes, touch targets. Do not rewrite existing rules — append the @media blocks.
2. src/components/Navbar.jsx — add a hamburger menu toggle (useState boolean) for screens under 768px.

Do NOT modify any page files. CSS media queries applied to existing classes are sufficient for page layouts.
Return at most 2 files total.`,

  deploy_prep: `
Prepare the project for deployment.
Return:
- README.md — full setup and deployment instructions:
  1. Clone / unzip
  2. npm install
  3. npm run dev  (local preview)
  4. npm run build  (production build)
  5. Deploy dist/ folder to Netlify, Vercel, or GitHub Pages
- vite.config.js — ensure base path is configurable for subdirectory hosting
- src/components/Navbar.jsx — verify all links use react-router-dom <Link>, not <a href>
Add a brief comment at the top of App.jsx explaining the project structure.`,
};

// ─── System prompt ────────────────────────────────────────────────────────────

function buildSystemPrompt(
  action: string,
  taskId: string,
  sessionContext: any,
  communicationStrategy?: any,
  learningStrategy?: any,
  freeFormInstruction?: string,
): string {
  // Personality block — shapes explanation tone
  const commStr  = communicationStrategy ? JSON.stringify(communicationStrategy) : null;
  const learnStr = learningStrategy      ? JSON.stringify(learningStrategy)      : null;
  const personalityBlock = (commStr || learnStr)
    ? '\n\nLEARNER PERSONALITY PROFILE — adapt your explanation and feedback to match:\n'
      + (commStr  ? `Communication strategy: ${commStr}\n` : '')
      + (learnStr ? `Learning strategy: ${learnStr}\n`     : '')
      + "- Match the learner's preferred communication style in the \"explanation\" field\n"
      + '- Adjust detail level and encouragement to their learning strategy\n'
    : '';

  const taskGuidance = freeFormInstruction || TASK_GUIDANCE[taskId] || '';

  if (action === 'critique') {
    return `You are an expert React developer reviewing a student's vibe coding prompt for a Vite + React static website.${personalityBlock}

Evaluate the prompt on:
1. Clarity — is it clear what they want?
2. Specificity — do they name components, pages, or styles?
3. React-appropriateness — is it thinking in components, props, and state?
4. Completeness — does it cover edge cases (empty states, mobile, etc.)?

Return JSON only:
{ "critique": "what's missing or unclear", "improvedPrompt": "a better version of their prompt", "score": 1-3, "feedback": "encouraging summary" }`;
  }

  const ctx = sessionContext || {};
  const ctxStr = [
    ctx.siteName    && `Site name: ${ctx.siteName}`,
    ctx.sitePurpose && `Purpose: ${ctx.sitePurpose}`,
    ctx.audience    && `Audience: ${ctx.audience}`,
    ctx.pages       && `Planned pages: ${ctx.pages}`,
    ctx.components  && `Planned components: ${ctx.components}`,
  ].filter(Boolean).join('\n');

  return `You are an expert Vite + React developer helping a student build a static informational website (no database).${personalityBlock}

${ctxStr ? `PROJECT CONTEXT:\n${ctxStr}\n` : ''}
TASK GUIDANCE:\n${taskGuidance}

RULES FOR ALL CODE:
- React 18 functional components with hooks
- react-router-dom v6 for routing (<BrowserRouter>, <Routes>, <Route>, <Link>)
- NO Supabase, NO database, NO external API calls
- Plain CSS (no Tailwind) — styles in index.css or component-level <style> in same file
- .jsx files only (no TypeScript)
- Production-quality code with meaningful comments
- Real content appropriate to the site's purpose — not Lorem Ipsum

RESPONSE FORMAT (JSON only — no markdown fences):
{
  "files": [
    { "path": "src/pages/HomePage.jsx", "content": "full file content here" }
  ],
  "explanation": "2–3 sentences explaining what was built, written directly to the student",
  "sessionContext": { "siteName": "...", "sitePurpose": "...", "audience": "..." }
}
Only include sessionContext fields you learned from this prompt.
Return only the JSON object — no extra text, no backticks.`;
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { action, prompt, taskId, projectFiles, sessionContext, communicationStrategy, learningStrategy,
          imageData, imageMediaType, imageName,
          freeFormFeedback, freeFormInstruction } = req.body;

  if (!prompt?.trim()) return res.status(400).json({ error: 'Prompt is required' });

  try {
    // For content_pages, existing files can already be 150+ lines each.
    // Truncate more aggressively so the input payload doesn't crowd out the output budget.
    // Phase 3 tasks (styling, responsive) operate on a fully-built project — cap tightly.
    const INPUT_CAPS: Record<string, number> = {
      define_site:   600,
      plan_pages:    600,
      app_shell:     300,  // project is mostly empty at this point, but be safe
      home_page:     300,  // App/Navbar/Footer already exist; don't let them eat the budget
      content_pages: 250,  // most files already written
      interactivity: 250,
      styling:       200,  // entire project exists; only need file names + class names
      responsive:    200,
      deploy_prep:   400,
    };
    const contentCap = INPUT_CAPS[taskId] ?? 400;

    const relevantFiles = (projectFiles || [])
      .filter((f: any) => f.content?.length > 10)
      .slice(0, 8)
      .map((f: any) => `=== ${f.path} ===\n${f.content.substring(0, contentCap)}`)
      .join('\n\n');

    const userMessage = action === 'critique'
      ? `Review this prompt for a Vite + React static website:\n\n"${prompt}"`
      : `Task: ${taskId || 'general'}\n\nStudent instruction:\n${prompt}\n\n${
          relevantFiles ? `Current project files:\n${relevantFiles}` : ''
        }`;

    // Build user message — plain text, or multimodal when a screenshot is attached
    const userContent: any = imageData
      ? [
          { type: 'image', source: { type: 'base64', media_type: imageMediaType || 'image/jpeg', data: imageData } },
          { type: 'text',  text: `${imageName ? `[Screenshot: ${imageName}]\n` : ''}${userMessage}` },
        ]
      : userMessage;

    const apiKey = process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not configured');

    // Phase 1 planning tasks return a single markdown file — 4000 tokens is enough.
    // Phase 2+ tasks generate multiple JSX files simultaneously (App + Navbar + Footer + pages).
    // Those routinely exceed 4000 tokens, causing silent JSON truncation → empty files response.
    const SINGLE_FILE_TASKS = new Set(['define_site', 'plan_pages']);
    const maxTokens = (action === 'critique' || SINGLE_FILE_TASKS.has(taskId)) ? 4000 : 8000;

    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: maxTokens,
        system: buildSystemPrompt(action, taskId, sessionContext, communicationStrategy, learningStrategy, freeFormFeedback ? freeFormInstruction : undefined),
        messages: [{ role: 'user', content: userContent }],
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(`Anthropic API error (${response.status}): ${(err as any)?.error?.message || 'Unknown'}`);
    }
    const completion = await response.json();
    const raw: string = completion.content?.[0]?.text || '{}';

    // Log stop_reason — 'max_tokens' means the response was truncated (the primary cause of
    // silent empty-files failures in Phase 2). Surface it immediately rather than swallowing it.
    const stopReason = completion.stop_reason;
    console.log(`[generate-site-code] taskId=${taskId} stop_reason=${stopReason} raw_len=${raw.length} max_tokens=${maxTokens}`);
    if (stopReason === 'max_tokens') {
      console.error('[generate-site-code] Response truncated — JSON will be malformed. Increase max_tokens or reduce file scope.');
      return res.status(200).json({
        files: [],
        explanation: `The AI ran out of space generating code for "${taskId}". Try asking for one file at a time, or break this task into smaller steps.`,
      });
    }

    // Robustly extract the JSON object even when Claude adds preamble or closing text.
    // Strategy: find the outermost { ... } block in the response.
    function extractJSON(text: string): string {
      // 1. Strip markdown fences
      const stripped = text.replace(/^```(?:json)?\s*/im, '').replace(/\s*```\s*$/im, '').trim();
      // 2. Find first { and last } to isolate the JSON object
      const start = stripped.indexOf('{');
      const end   = stripped.lastIndexOf('}');
      if (start !== -1 && end !== -1 && end > start) return stripped.slice(start, end + 1);
      return stripped;
    }

    let result: any;
    try {
      result = JSON.parse(extractJSON(raw));
    } catch (parseErr: any) {
      // JSON parse failure after stop_reason=end_turn is unexpected — log the raw output for debugging
      console.error('[generate-site-code] JSON parse failed. stop_reason:', stopReason, 'raw (first 500):', raw.slice(0, 500));
      if (action === 'critique') return res.status(200).json({ critique: raw, feedback: raw });
      return res.status(500).json({ error: `AI response could not be parsed. Raw output (first 200 chars): ${raw.slice(0, 200)}` });
    }

    if (action === 'critique') {
      return res.status(200).json({
        critique:        result.critique  || result.feedback || raw,
        feedback:        result.feedback  || result.critique || raw,
        improvedPrompt:  result.improvedPrompt,
        score:           result.score,
      });
    }

    return res.status(200).json({
      files:          result.files          || [],
      explanation:    result.explanation    || '',
      sessionContext: result.sessionContext,
    });
  } catch (err: any) {
    console.error('[generate-site-code]', err);
    return res.status(500).json({ error: err.message || 'Generation failed' });
  }
}