// api/generate-react-code.ts
// Handles: generate | iterate | critique actions for Vite/React/Supabase projects
//
// Request body:
//   action: 'generate' | 'iterate' | 'critique'
//   prompt: string
//   taskId: string
//   projectFiles: { path: string; content: string }[]
//   sessionContext: { appName?, appPurpose?, audience?, tables?, components? }
//
// Response (generate/iterate):
//   { files: { path, content }[], explanation: string, sessionContext? }
//
// Response (critique):
//   { critique: string, feedback: string }

import type { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ─── Task context strings (guide the AI per task) ────────────────────────────

const TASK_GUIDANCE: Record<string, string> = {
  define_app: `
The student is defining their app's purpose. Their prompt describes what they want to build.
Return a single file update to README.md documenting:
- App name and purpose
- Target audience
- Key features (3-5 bullet points)
Also return sessionContext with: { appName, appPurpose, audience }
Keep it as plain markdown, well-structured.`,

  plan_data: `
The student is planning their Supabase data model. Their prompt describes what data they need.
Return a single file: src/lib/schema.sql with CREATE TABLE statements for their Supabase backend.
Include: appropriate column types, primary keys, foreign keys, Row Level Security policies.
Also return a comment at the top explaining each table's purpose.
Also return sessionContext with: { tables: "comma-separated table names" }`,

  plan_components: `
The student is planning their React component architecture.
Return a single file: src/COMPONENTS.md listing:
- Which pages they'll have (as page-level components in src/pages/)
- Which reusable components they'll need (in src/components/)
- For each component: props, purpose, which Supabase table it uses
Also return sessionContext with: { components: "summary of planned components" }`,

  app_shell: `
Build the app shell with react-router-dom routing.
Return these files:
- src/App.jsx — with BrowserRouter, Routes, Route for each planned page
- src/components/Layout.jsx — wrapper with consistent header/nav/footer
- src/components/Navbar.jsx — navigation bar with links to each route
- src/pages/HomePage.jsx — placeholder home page
Create one Route per major page the student described. Use clean, professional styling.`,

  supabase_setup: `
Configure the Supabase connection and demonstrate it working.
Return:
- src/lib/supabase.js — already exists, may need updating based on context
- src/hooks/useSupabase.js — a custom hook showing how to fetch data
- src/pages/DatabaseTest.jsx — a test page that fetches from a Supabase table and displays results
Show loading states, error handling, and real data display patterns.`,

  first_page: `
Build the student's first real page component.
Based on their app purpose and planned components, create:
- The main page component in src/pages/ (e.g. DashboardPage.jsx, HomePage.jsx)
- Any sub-components it needs in src/components/
The page should have real UI structure, not just placeholder text.
Use the student's stated purpose and audience to write appropriate content.`,

  data_display: `
Implement real data fetching from Supabase and display it.
Use useEffect + useState pattern (or the custom hook from supabase_setup).
Include: loading spinner while fetching, error message on failure, empty state if no data.
Display data in a visually appropriate way (table, cards, list) based on the app type.`,

  user_input: `
Add forms and user interaction.
Create components that let users:
- Input data (forms with controlled inputs)
- Submit data to Supabase (insert or update)
- Get feedback (success message, error handling)
Include input validation and optimistic UI updates where appropriate.`,

  styling: `
Polish the visual design throughout the app.
Update src/index.css and component-level styles to create a cohesive, professional look.
Apply: consistent color palette, typography scale, spacing system, hover states, transitions.
Make it responsive (works on mobile and desktop).
The aesthetic should match the app's purpose and target audience.`,

  error_states: `
Add robust error and loading state handling throughout the app.
Create:
- src/components/LoadingSpinner.jsx — reusable loading indicator
- src/components/ErrorMessage.jsx — reusable error display
- src/components/EmptyState.jsx — for when there's no data
Apply these to all pages that fetch data.
Add try-catch to all Supabase calls. Add user-facing error messages.`,

  deploy_prep: `
Prepare the project for deployment.
Return:
- README.md — updated with complete setup instructions, environment variables, deployment steps
- .env.example — all required environment variables documented
- src/lib/supabase.js — ensure environment variable checks with helpful error messages
Add comments explaining the deployment process (Vercel recommended for Vite+React).`,
};

// ─── System prompt ────────────────────────────────────────────────────────────

function buildSystemPrompt(action: string, taskId: string, sessionContext: any, communicationStrategy?: any, learningStrategy?: any): string {
  const taskGuidance = TASK_GUIDANCE[taskId] || '';

  // Personality adaptation block — shapes explanation tone for all branches
  const commStr = communicationStrategy ? JSON.stringify(communicationStrategy) : null;
  const learnStr = learningStrategy ? JSON.stringify(learningStrategy) : null;
  const personalityBlock = (commStr || learnStr)
    ? '\n\nLEARNER PERSONALITY PROFILE — adapt your explanation and feedback to match:\n'
      + (commStr  ? `Communication strategy: ${commStr}\n` : '')
      + (learnStr ? `Learning strategy: ${learnStr}\n` : '')
      + '- Match the learner\'s preferred communication style in the "explanation" field\n'
      + '- Adjust detail level, vocabulary, and encouragement to their learning strategy\n'
    : '';

  if (action === 'critique') {
    return `You are an expert React developer and educator reviewing a student's prompt for a React/Vite/Supabase project.${personalityBlock}

Evaluate the prompt on:
1. Clarity — Is it clear what they want?
2. Specificity — Do they include enough detail for React (component names, props, state, Supabase table)?
3. Completeness — Does it cover edge cases (loading, error, empty states)?
4. React-appropriateness — Is it thinking in components and state?

Respond with:
- critique: What's missing or unclear (2-3 sentences)
- improvedPrompt: A rewritten version of their prompt that would generate better React code
- score: 1-3 (1=needs work, 2=good, 3=excellent)

Return as JSON: { "critique": "...", "improvedPrompt": "...", "score": 2, "feedback": "..." }`;
  }

  const ctx = sessionContext || {};
  const ctxStr = [
    ctx.appName    && `App name: ${ctx.appName}`,
    ctx.appPurpose && `Purpose: ${ctx.appPurpose}`,
    ctx.audience   && `Audience: ${ctx.audience}`,
    ctx.tables     && `Supabase tables: ${ctx.tables}`,
    ctx.components && `Planned components: ${ctx.components}`,
  ].filter(Boolean).join('\n');

  return `You are an expert React/Vite/Supabase developer helping a student build a real web application.${personalityBlock}

${ctxStr ? `PROJECT CONTEXT:\n${ctxStr}\n` : ''}
TASK GUIDANCE:\n${taskGuidance}

RULES FOR ALL CODE:
- Use React 18 with functional components and hooks
- Use react-router-dom v6 for routing
- Use @supabase/supabase-js v2 for database
- Import Supabase from '../lib/supabase' or the appropriate relative path
- Always use: import { supabase } from '../lib/supabase'
- Environment variables via import.meta.env.VITE_*
- NO TypeScript — use .jsx files
- NO Tailwind — use plain CSS classes or inline styles, or standard CSS modules
- Keep styles in separate CSS or style objects within the file
- Write production-quality code, not toy examples
- Include meaningful comments explaining React concepts

RESPONSE FORMAT (JSON only, no markdown wrapper):
{
  "files": [
    { "path": "src/App.jsx", "content": "full file content..." },
    { "path": "src/components/Navbar.jsx", "content": "..." }
  ],
  "explanation": "What I built and why (2-3 sentences for the student)",
  "sessionContext": { "appName": "...", "appPurpose": "...", "audience": "..." }
}

Only include sessionContext if you learned new information about the app from this prompt.
Only return the JSON object, no markdown backticks or extra text.`;
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { action, prompt, taskId, projectFiles, sessionContext, communicationStrategy, learningStrategy } = req.body;

  if (!prompt?.trim()) return res.status(400).json({ error: 'Prompt is required' });

  try {
    // Build the user message — include relevant existing files for context
    const relevantFiles = (projectFiles || [])
      .filter((f: any) => f.content?.length > 10)
      .slice(0, 8) // cap at 8 files to stay within token limits
      .map((f: any) => `=== ${f.path} ===\n${f.content.substring(0, 600)}`)
      .join('\n\n');

    const userMessage = action === 'critique'
      ? `Review this prompt for a React/Vite/Supabase project:\n\n"${prompt}"`
      : `Task: ${taskId || 'general'}\n\nStudent's instruction:\n${prompt}\n\n${
          relevantFiles ? `Current project files:\n${relevantFiles}` : ''
        }`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 4000,
      temperature: 0.2,
      messages: [
        { role: 'system', content: buildSystemPrompt(action, taskId, sessionContext, communicationStrategy, learningStrategy) },
        { role: 'user', content: userMessage },
      ],
    });

    const raw = completion.choices[0]?.message?.content || '{}';

    // Strip markdown fences if present
    const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();

    let result: any;
    try {
      result = JSON.parse(cleaned);
    } catch {
      // If JSON parse fails, return as explanation text
      if (action === 'critique') {
        return res.status(200).json({ critique: raw, feedback: raw });
      }
      return res.status(200).json({ files: [], explanation: raw });
    }

    if (action === 'critique') {
      return res.status(200).json({
        critique: result.critique || result.feedback || raw,
        feedback: result.feedback || result.critique || raw,
        improvedPrompt: result.improvedPrompt,
        score: result.score,
      });
    }

    return res.status(200).json({
      files: result.files || [],
      explanation: result.explanation || '',
      sessionContext: result.sessionContext,
    });
  } catch (err: any) {
    console.error('[generate-react-code]', err);
    return res.status(500).json({ error: err.message || 'Generation failed' });
  }
}