// api/generate-site-code.ts
// Generates / iterates Vite + React static website code (no database).
//
// TRIAGE PATCH: all Anthropic errors now logged to system_events + email alert.
// Uses shared anthropicFetch + checkUsage + logEvent from lib/api-logger.

import type { NextApiRequest, NextApiResponse } from 'next';
import { anthropicFetch, checkUsage, logEvent } from '../lib/api-logger';

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
Return EXACTLY these four files (no more):
- src/App.jsx — BrowserRouter + Routes with one Route per planned page. Import each page component.
- src/components/Navbar.jsx — responsive navigation with <Link> to every route
- src/components/Footer.jsx — simple footer with site name and copyright year
- src/index.css — clean base styles: CSS reset, font stack, colour variables, basic layout utilities

For any page not yet built, create a minimal placeholder file in src/pages/ (just an <h1> and <p>).
Keep component code concise — save detailed styling for the styling task.`,

  home_page: `
Build the Home page — the most important page of the site.
Based on the site purpose and audience, create:
- src/pages/HomePage.jsx — a complete, visually engaging home page with:
  - Hero section (headline, subheadline, call-to-action button)
  - At least one content section relevant to the site's purpose
  - Professional, clean layout using CSS classes
Update src/index.css with any new styles needed.
Make it feel real — not a placeholder.`,

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
Add meaningful interactivity using React state and events.
Examples appropriate for a static site (no database needed):
- Contact form with validation and a success message (useState — no real submission)
- Accordion / FAQ section that expands/collapses
- Image gallery or tabs with active state
- Dark/light mode toggle
- Smooth scroll, animated counters, or other UX enhancements
Choose what fits the site's purpose. Use useState and useEffect only — no external APIs.`,

  styling: `
Elevate the visual design across the entire site.
Update src/index.css and any component styles to create a cohesive, polished look:
- Consistent colour palette (define CSS custom properties / variables)
- Typography scale (headings, body, captions)
- Spacing system (margin/padding utilities)
- Hover states and smooth transitions
- Card and button styles that match the site's personality
The result should look like a real, professional website.`,

  responsive: `
Make the site fully responsive for mobile, tablet, and desktop.
Update styles to use:
- Flexible layouts (flexbox / CSS grid)
- Media queries for breakpoints (mobile-first: 480px, 768px, 1024px)
- Responsive navigation (hamburger menu on mobile using useState)
- Readable font sizes and touch-friendly tap targets on small screens
Test every page at each breakpoint.`,

  deploy_prep: `
Prepare the project for deployment.
Return:
- README.md — full setup and deployment instructions
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

  const {
    action, prompt, taskId, projectFiles, sessionContext,
    communicationStrategy, learningStrategy,
    imageData, imageMediaType, imageName,
    freeFormFeedback, freeFormInstruction,
    user_id, cohort,                         // pass through for triage context
  } = req.body;

  if (!prompt?.trim()) return res.status(400).json({ error: 'Prompt is required' });

  const meta = { user_id, cohort };           // forwarded to every logEvent call

  try {
    const contentCap = taskId === 'content_pages' ? 250 : 600;
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

    const userContent: any = imageData
      ? [
          { type: 'image', source: { type: 'base64', media_type: imageMediaType || 'image/jpeg', data: imageData } },
          { type: 'text',  text: `${imageName ? `[Screenshot: ${imageName}]\n` : ''}${userMessage}` },
        ]
      : userMessage;

    const SINGLE_FILE_TASKS = new Set(['define_site', 'plan_pages']);
    const maxTokens = (action === 'critique' || SINGLE_FILE_TASKS.has(taskId)) ? 4000 : 8000;

    // ── TRIAGE: use wrapped fetch instead of raw fetch ────────────────────────
    const response = await anthropicFetch(
      {
        model: 'claude-sonnet-4-6',
        max_tokens: maxTokens,
        system: buildSystemPrompt(
          action, taskId, sessionContext,
          communicationStrategy, learningStrategy,
          freeFormFeedback ? freeFormInstruction : undefined,
        ),
        messages: [{ role: 'user', content: userContent }],
      },
      'generate-site-code',
      meta,
    );

    if (!response.ok) {
      // anthropicFetch already logged it; just return to the client
      const err = await response.json().catch(() => ({}));
      return res.status(response.status).json({
        error: (err as any)?.error?.message || `Anthropic API error (${response.status})`,
      });
    }

    const completion = await response.json();
    const raw: string = completion.content?.[0]?.text || '{}';
    const stopReason  = completion.stop_reason;

    console.log(`[generate-site-code] taskId=${taskId} stop_reason=${stopReason} raw_len=${raw.length} max_tokens=${maxTokens}`);

    // ── TRIAGE: log max_tokens truncation ─────────────────────────────────────
    await checkUsage(
      { stop_reason: stopReason, usage: completion.usage },
      'generate-site-code',
      'claude-sonnet-4-6',
      meta,
    );

    if (stopReason === 'max_tokens') {
      return res.status(200).json({
        files: [],
        explanation: `The AI ran out of space generating code for "${taskId}". Try asking for one file at a time, or break this task into smaller steps.`,
      });
    }

    function extractJSON(text: string): string {
      const stripped = text.replace(/^```(?:json)?\s*/im, '').replace(/\s*```\s*$/im, '').trim();
      const start = stripped.indexOf('{');
      const end   = stripped.lastIndexOf('}');
      if (start !== -1 && end !== -1 && end > start) return stripped.slice(start, end + 1);
      return stripped;
    }

    let result: any;
    try {
      result = JSON.parse(extractJSON(raw));
    } catch {
      // ── TRIAGE: JSON parse failure after a successful API call ───────────────
      await logEvent({
        function_name: 'generate-site-code',
        event_type:    'json_parse_failure',
        severity:      'error',
        payload: {
          taskId,
          stopReason,
          raw_length:  raw.length,
          raw_sample:  raw.slice(0, 300),
          maxTokens,
          note: 'Response was not valid JSON despite stop_reason=end_turn',
        },
        ...meta,
      });

      if (action === 'critique') return res.status(200).json({ critique: raw, feedback: raw });
      return res.status(500).json({
        error: `AI response could not be parsed. Raw output (first 200 chars): ${raw.slice(0, 200)}`,
      });
    }

    if (action === 'critique') {
      return res.status(200).json({
        critique:       result.critique  || result.feedback || raw,
        feedback:       result.feedback  || result.critique || raw,
        improvedPrompt: result.improvedPrompt,
        score:          result.score,
      });
    }

    return res.status(200).json({
      files:          result.files          || [],
      explanation:    result.explanation    || '',
      sessionContext: result.sessionContext,
    });

  } catch (err: any) {
    // ── TRIAGE: unexpected thrown error (network, env issue, etc.) ────────────
    await logEvent({
      function_name: 'generate-site-code',
      event_type:    'unhandled_exception',
      severity:      'critical',
      payload: {
        message: err.message,
        stack:   err.stack?.slice(0, 500),
        taskId,
        action,
      },
      ...meta,
    });

    console.error('[generate-site-code]', err);
    return res.status(500).json({ error: err.message || 'Generation failed' });
  }
}
