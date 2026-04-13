// src/pages/tech-skills/WebDevelopmentPage.tsx
// React / Vite / Supabase Learning Platform
// API routes needed: /api/generate-react-code  /api/react-task-instruction  /api/evaluate-react-session

import React, { useState, useRef, useCallback, useEffect } from 'react';
import Navbar from '../../components/layout/Navbar';
import { supabase } from '../../lib/supabaseClient';
import Editor from '@monaco-editor/react';
import { useVoice } from '../../hooks/useVoice';
import { VoiceFallback } from '../../components/VoiceFallback';
import {
  Code, Sparkles, Loader2, Save, FolderOpen, Download, CheckCircle, ArrowUpCircle, SkipForward, CloudUpload, ImageIcon, ImagePlus, Trash2, MessageSquarePlus,
  ArrowRight, FileCode, Plus, X, ChevronDown, ChevronUp, Lightbulb,
  RefreshCw, BarChart3, Award, ExternalLink, Star, Wand2, Check, Copy,
  Volume2, VolumeX,
  Database, Layers, Package, Cpu, Globe, AlertCircle, ChevronRight,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

interface ProjectFile {
  path: string;
  content: string;
}

interface TaskDef {
  id: string;
  label: string;
  phase: 1 | 2 | 3;
  icon: string;
  isOnboarding?: boolean;
}

interface TaskInstruction {
  headline: string;
  context: string;
  subTasks: string[];
  subTaskTeaching: string[];  // one "why this matters" explanation per sub-task
  examplePrompt: string;
}

interface PromptEntry {
  id: string;
  taskId: string;
  subTaskIndex: number;
  subTaskQuestion?: string;   // the question the AI asked this step
  subTaskTeaching?: string;   // the teaching commentary that preceded it
  prompt: string;             // student's response
  aiExplanation?: string;     // what the AI built / explained
  aiCritique?: string;        // feedback on the student's response
  hasSuggestions?: boolean;   // did critique flag improvements?
  studentRefined?: boolean;   // did student resubmit after suggestions?
  timestamp: string;
  action: 'generate' | 'iterate' | 'critique' | 'feedback';
  filesModified?: string[];
}

interface SessionRecord {
  id: number;
  web_dev_session_id: string;
  web_dev_session_name: string;
  web_dev_pages: any[];
  web_dev_prompts: any[];
  web_dev_evaluation: any | null;
  web_dev_storage_path?: string | null;
  updated_at?: string;
}

interface SessionContext {
  siteName?: string;
  sitePurpose?: string;
  audience?: string;
  pages?: string;
  components?: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const makeId = () => Math.random().toString(36).substring(2, 9);

const WEB_DEV_ACTIVITY = 'web_development_vite';

const TASKS: TaskDef[] = [
  // Phase 1 — Plan
  { id: 'intro_structure', label: 'Vite + React Overview',   phase: 1, icon: '🏗️', isOnboarding: true },
  { id: 'define_site',     label: 'Define Your Website',     phase: 1, icon: '🎯' },
  { id: 'plan_pages',      label: 'Plan Pages & Components', phase: 1, icon: '🗺️' },
  // Phase 2 — Build
  { id: 'app_shell',       label: 'App Shell & Navigation',  phase: 2, icon: '🔗' },
  { id: 'home_page',       label: 'Home Page',               phase: 2, icon: '🏠' },
  { id: 'content_pages',   label: 'Content Pages',           phase: 2, icon: '📄' },
  { id: 'interactivity',   label: 'Interactivity & State',   phase: 2, icon: '✨' },
  // Phase 3 — Polish
  { id: 'styling',         label: 'Styling & Polish',        phase: 3, icon: '🎨' },
  { id: 'responsive',      label: 'Mobile Responsiveness',   phase: 3, icon: '📱' },
  { id: 'deploy_prep',     label: 'Deploy Preparation',      phase: 3, icon: '🚀' },
];

const PHASE_META: Record<number, { label: string; color: string; bg: string; border: string }> = {
  1: { label: 'Phase 1: Plan',   color: 'text-blue-400',    bg: 'bg-blue-500/15',    border: 'border-blue-500/30'   },
  2: { label: 'Phase 2: Build',  color: 'text-emerald-400', bg: 'bg-emerald-500/15', border: 'border-emerald-500/30' },
  3: { label: 'Phase 3: Polish', color: 'text-amber-400',   bg: 'bg-amber-500/15',   border: 'border-amber-500/30'  },
};

const STARTER_FILES: ProjectFile[] = [
  {
    path: 'package.json',
    content: JSON.stringify({
      name: 'my-react-site', private: true, version: '0.0.0', type: 'module',
      scripts: { dev: 'vite', build: 'vite build', preview: 'vite preview' },
      dependencies: {
        'react': '^18.2.0', 'react-dom': '^18.2.0', 'react-router-dom': '^6.21.0',
      },
      devDependencies: { '@vitejs/plugin-react': '^4.2.1', 'vite': '^5.0.8' },
    }, null, 2),
  },
  {
    path: 'vite.config.js',
    content: `import { defineConfig } from 'vite'\nimport react from '@vitejs/plugin-react'\n\nexport default defineConfig({\n  plugins: [react()],\n})\n`,
  },
  {
    path: 'index.html',
    content: `<!DOCTYPE html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>My Website</title>\n  </head>\n  <body>\n    <div id="root"></div>\n    <script type="module" src="/src/main.jsx"></script>\n  </body>\n</html>\n`,
  },

  {
    path: 'src/main.jsx',
    content: `import React from 'react'\nimport ReactDOM from 'react-dom/client'\nimport App from './App.jsx'\nimport './index.css'\n\nReactDOM.createRoot(document.getElementById('root')).render(\n  <React.StrictMode>\n    <App />\n  </React.StrictMode>,\n)\n`,
  },
  {
    path: 'src/App.jsx',
    content: `import React from 'react'\n\nfunction App() {\n  return (\n    <div>\n      <h1>My Website</h1>\n      <p>Use the prompt panel to start building!</p>\n    </div>\n  )\n}\n\nexport default App\n`,
  },
  {
    path: 'src/index.css',
    content: `* { margin: 0; padding: 0; box-sizing: border-box; }\nbody {\n  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;\n  background: #f8fafc;\n  color: #1e293b;\n}\n.app { max-width: 1200px; margin: 0 auto; padding: 2rem; }\n`,
  },

];

const getLanguage = (path: string) => {
  if (path.endsWith('.jsx') || path.endsWith('.js')) return 'javascript';
  if (path.endsWith('.tsx') || path.endsWith('.ts')) return 'typescript';
  if (path.endsWith('.css')) return 'css';
  if (path.endsWith('.html')) return 'html';
  if (path.endsWith('.json')) return 'json';
  if (path.endsWith('.md')) return 'markdown';
  return 'plaintext';
};

const mergeFiles = (existing: ProjectFile[], updates: ProjectFile[]): ProjectFile[] => {
  const result = [...existing];
  for (const u of updates) {
    const idx = result.findIndex(f => f.path === u.path);
    if (idx >= 0) result[idx] = u; else result.push(u);
  }
  return result;
};

// ─── API Helpers ──────────────────────────────────────────────────────────────

async function callGenerateAPI(body: Record<string, unknown>) {
  const res = await fetch('/api/generate-site-code', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'claude-sonnet-4-6', ...body }),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || `HTTP ${res.status}`); }
  return res.json();
}

// Separate path when a screenshot is attached — sends multipart so the API
// receives imageData / imageMediaType alongside the normal JSON fields.
// (We still use JSON since Claude's API takes base64 images inline in the body.)
// This is just a thin wrapper that adds the image fields to the same endpoint.

async function callInstructionAPI(body: Record<string, unknown>) {
  const res = await fetch('/api/site-task-instruction', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'claude-sonnet-4-6', ...body }),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || `HTTP ${res.status}`); }
  return res.json();
}

// ── Evaluation via /api/chat (Anthropic Sonnet — routed by chat.js) ────────────
// Replaces the old /api/evaluate-web-session (OpenAI) endpoint.
// chat.js routes page='WebDevelopmentPage' → Anthropic claude-sonnet-4-6.
//
// JSON shape returned MUST match what the evaluation modal renders:
//   evaluation.overall_score_average       (number, 0–3)
//   evaluation.phase_averages              ({ phase_1_think_first, … })
//   evaluation.module_averages             ({ m1_purpose_and_audience, …m8 })
//   evaluation.detailed_scores             ({ skill: { score, justification } })
//   evaluation.strengths_summary           (string)
//   evaluation.highest_leverage_improvements (string)
//   evaluation.certification_readiness    (string)
//   advice                                 (string)

const EVAL_SYSTEM = `You are an expert evaluator of student web development projects built with React and Vite.
Assess the student's planning and execution quality across all phases they have attempted.
Return ONLY valid JSON — no prose, no markdown fences, no extra keys.`;

function getCompletedPhases(promptHistory: PromptEntry[]): Set<string> {
  const taskIds = new Set(promptHistory.map(e => e.taskId));
  const phases = new Set<string>();
  if (['define_site', 'plan_pages'].some(t => taskIds.has(t))) phases.add('phase_1_think_first');
  if (['app_shell', 'home_page', 'content_pages', 'interactivity'].some(t => taskIds.has(t))) phases.add('phase_2_build_it');
  if (['styling', 'responsive', 'deploy_prep'].some(t => taskIds.has(t))) phases.add('phase_3_refine_it');
  return phases;
}

function buildEvalPrompt(
  promptHistory: PromptEntry[],
  projectFiles: { path: string; content: string }[],
  currentTaskIndex: number,
): string {
  const completedPhases = getCompletedPhases(promptHistory);
  const hasPhase1 = completedPhases.has('phase_1_think_first') || currentTaskIndex >= 1;
  const hasPhase2 = completedPhases.has('phase_2_build_it');
  const hasPhase3 = completedPhases.has('phase_3_refine_it');

  const historyText = promptHistory.length > 0
    ? promptHistory
        .map(e => `[${e.action.toUpperCase()}] Task:${e.taskId} | Student: ${e.prompt}${e.aiCritique ? ` | AI feedback: ${e.aiCritique}` : ''}`)
        .join('\n')
    : 'No prompts submitted yet — student is in early planning stage.';

  const fileText = projectFiles
    .filter(f => f.content.length > 30 && !f.path.startsWith('public/'))
    .map(f => `--- ${f.path} ---\n${f.content.substring(0, 600)}`)
    .join('\n\n') || 'Only starter files present — no student code yet.';

  const na = '"not yet reached this phase"';

  return `Evaluate this student's React/Vite web development session.
Student is at task index ${currentTaskIndex}/10. Only Phase 1 (planning) has been attempted${hasPhase2 ? ' and Phase 2 (build)' : ''}${hasPhase3 ? ' and Phase 3 (polish)' : ''}.

PROMPT HISTORY:
${historyText}

PROJECT FILES (student code, truncated to 600 chars each):
${fileText}

SCORING RULES:
- Score each module 0–3 based ONLY on phases attempted
- Modules from phases NOT YET reached must score 0 with justification ${na}
- Phase 1 modules (m1–m3): evaluate from the prompt history — this is planning, not code
- Phase 2 modules (m4–m7): evaluate from code files — use 0 + ${na} if not reached
- Phase 3 module (m8): evaluate iterative refinement — use 0 + ${na} if not reached
- overall_score_average = mean of m1..m8 scores (include the zeros), rounded to 1 decimal
- Be honest but encouraging — this is a first-generation digital learner

Return ONLY this exact JSON (no markdown, no extra text):
{
  "evaluation": {
    "overall_score_average": <mean of m1 through m8>,
    "phase_averages": {
      "phase_1_think_first": <average of m1+m2+m3 divided by 3>,
      "phase_2_build_it": ${hasPhase2 ? '<average of m4+m5+m6+m7 divided by 4>' : '0'},
      "phase_3_refine_it": ${hasPhase3 ? '<m8 score>' : '0'}
    },
    "module_averages": {
      "m1_purpose_and_audience": <0–3>,
      "m2_content_strategy": <0–3>,
      "m3_site_architecture": <0–3>,
      "m4_page_layout_and_structure": ${hasPhase2 ? '<0–3>' : '0'},
      "m5_visual_design_and_styling": ${hasPhase2 ? '<0–3>' : '0'},
      "m6_media_and_assets": ${hasPhase2 ? '<0–3>' : '0'},
      "m7_interactivity_and_data": ${hasPhase2 ? '<0–3>' : '0'},
      "m8_iteration_and_quality": ${hasPhase3 ? '<0–3>' : '0'}
    },
    "detailed_scores": {
      "m1_purpose_and_audience": { "score": <0–3>, "justification": "<evidence from prompts or lack thereof>" },
      "m2_content_strategy": { "score": <0–3>, "justification": "<evidence from prompts or lack thereof>" },
      "m3_site_architecture": { "score": <0–3>, "justification": "<evidence from prompts or lack thereof>" },
      "m4_page_layout_and_structure": { "score": ${hasPhase2 ? '<0–3>' : '0'}, "justification": ${hasPhase2 ? '"<evidence from code>"' : '"Not yet reached this phase"'} },
      "m5_visual_design_and_styling": { "score": ${hasPhase2 ? '<0–3>' : '0'}, "justification": ${hasPhase2 ? '"<evidence from code>"' : '"Not yet reached this phase"'} },
      "m6_media_and_assets": { "score": ${hasPhase2 ? '<0–3>' : '0'}, "justification": ${hasPhase2 ? '"<evidence from code>"' : '"Not yet reached this phase"'} },
      "m7_interactivity_and_data": { "score": ${hasPhase2 ? '<0–3>' : '0'}, "justification": ${hasPhase2 ? '"<evidence from code>"' : '"Not yet reached this phase"'} },
      "m8_iteration_and_quality": { "score": ${hasPhase3 ? '<0–3>' : '0'}, "justification": ${hasPhase3 ? '"<evidence from code>"' : '"Not yet reached this phase"'} }
    },
    "strengths_summary": "<2 sentences on what the student did well so far>",
    "highest_leverage_improvements": "<2–3 specific things that would most improve their current phase work>",
    "certification_readiness": "<honest 1-sentence assessment of where they are relative to completion>"
  },
  "advice": "<3–4 sentences of concrete next steps for where this student is right now>"
}`;
}

async function callEvaluateAPI(
  promptHistory: PromptEntry[],
  projectFiles: { path: string; content: string }[],
  currentTaskIndex = 0,
): Promise<{ evaluation: any; advice: string | null }> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      page:        'WebDevelopmentPage',  // → chat.js routes to claude-sonnet-4-6
      system:      EVAL_SYSTEM,
      messages:    [{ role: 'user', content: buildEvalPrompt(promptHistory, projectFiles, currentTaskIndex) }],
      max_tokens:  1800,
      temperature: 0.2,
    }),
  });

  const rawText = await res.text();
  let data: any;
  try { data = JSON.parse(rawText); }
  catch { throw new Error(`Evaluation API error (${res.status}): ${rawText.slice(0, 200)}`); }
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);

  // chat.js wraps Anthropic response in OpenAI shape: choices[0].message.content
  const content: string = data?.choices?.[0]?.message?.content ?? '';
  const clean = content.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
  let parsed: any;
  try { parsed = JSON.parse(clean); }
  catch { throw new Error(`Evaluation returned invalid JSON: ${clean.slice(0, 300)}`); }

  return {
    evaluation: parsed.evaluation ?? null,
    advice:     parsed.advice     ?? null,
  };
}


// ─── Sub-components ───────────────────────────────────────────────────────────

const ScoreBadge: React.FC<{ score: number; max?: number }> = ({ score, max = 3 }) => {
  const pct = score / max;
  const color = pct >= 0.8 ? 'from-emerald-400 to-green-500 text-green-950'
    : pct >= 0.5 ? 'from-amber-400 to-yellow-500 text-yellow-950'
    : 'from-red-400 to-rose-500 text-rose-950';
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-gradient-to-r ${color}`}>
      <Star size={12} />{score}/{max}
    </span>
  );
};

// ─── Onboarding card ─────────────────────────────────────────────────────────

const ReactViteOnboarding: React.FC<{ onComplete: () => void }> = ({ onComplete }) => (
  <div className="flex-1 overflow-y-auto p-4 space-y-4">
    <div className="p-4 bg-blue-500/10 border border-blue-500/25 rounded-xl">
      <p className="text-xs font-bold text-blue-400 uppercase mb-3">🏗️ Welcome to Vite + React Website Builder</p>
      <p className="text-sm text-gray-300 leading-relaxed mb-4">
        You're going to build a real, multi-page website using <strong className="text-white">React</strong> and{' '}
        <strong className="text-white">Vite</strong> — the same tools used by professional developers worldwide.
        No database needed: this is a pure front-end site. A future workshop will add a Supabase backend.
      </p>

      <p className="text-xs font-bold text-gray-400 uppercase mb-2">Your Project Structure</p>
      <div className="bg-gray-900 rounded-lg p-3 font-mono text-xs leading-relaxed space-y-0.5">
        <div className="text-amber-300">📁 my-site/</div>
        <div className="ml-3 text-gray-400">├── <span className="text-cyan-300">index.html</span><span className="text-gray-600 ml-2">← Browser entry point</span></div>
        <div className="ml-3 text-gray-400">├── <span className="text-cyan-300">package.json</span><span className="text-gray-600 ml-2">← Dependencies &amp; scripts</span></div>
        <div className="ml-3 text-gray-400">├── <span className="text-cyan-300">vite.config.js</span><span className="text-gray-600 ml-2">← Build tool config</span></div>
        <div className="ml-3 text-amber-300">└── 📁 src/</div>
        <div className="ml-6 text-gray-400">├── <span className="text-emerald-300">main.jsx</span><span className="text-gray-600 ml-2">← Mounts React into the page</span></div>
        <div className="ml-6 text-gray-400">├── <span className="text-emerald-300">App.jsx</span><span className="text-gray-600 ml-2">← Root component &amp; routing</span></div>
        <div className="ml-6 text-gray-400">├── <span className="text-emerald-300">index.css</span><span className="text-gray-600 ml-2">← Global styles</span></div>
        <div className="ml-6 text-amber-300">├── 📁 components/<span className="text-gray-600 ml-2">← Reusable pieces (Navbar, Footer…)</span></div>
        <div className="ml-6 text-amber-300">└── 📁 pages/<span className="text-gray-600 ml-2">← One file per page (Home, About…)</span></div>
      </div>
    </div>

    <div className="grid grid-cols-2 gap-2">
      {[
        { icon: <Globe size={14} />,  title: 'Browser loads',   desc: 'index.html first',       col: 'text-blue-400' },
        { icon: <Cpu size={14} />,    title: 'Vite bundles',    desc: 'your src/ files fast',   col: 'text-purple-400' },
        { icon: <Layers size={14} />, title: 'React renders',   desc: 'components into pages',  col: 'text-emerald-400' },
        { icon: <Package size={14} />,title: 'You download',    desc: '.zip → run locally',     col: 'text-amber-400' },
      ].map((item, i) => (
        <div key={i} className="p-3 bg-gray-800/60 rounded-lg border border-gray-700">
          <div className={`flex items-center gap-1.5 mb-1 ${item.col}`}>{item.icon}<span className="text-xs font-bold">{item.title}</span></div>
          <p className="text-[11px] text-gray-400">{item.desc}</p>
        </div>
      ))}
    </div>

    <div className="p-3 bg-gray-800/40 rounded-lg border border-gray-700">
      <p className="text-xs font-bold text-gray-300 mb-1.5">💡 How Vibe Coding works here</p>
      <p className="text-xs text-gray-400 leading-relaxed">
        Describe what you want in plain English — one step at a time. The AI writes the React components
        and updates the right files. When you're done, click{' '}
        <strong className="text-white">Download .zip</strong> and run locally with{' '}
        <code className="bg-gray-700 px-1 rounded text-emerald-300">npm install && npm run dev</code>.
        Use <strong className="text-white">Visualize Website</strong> to preview it live in StackBlitz instantly.
      </p>
    </div>

    <button onClick={onComplete}
      className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors">
      Got it — let's start planning! <ArrowRight size={16} />
    </button>
  </div>
);

// ─── Task stepper ─────────────────────────────────────────────────────────────

const TaskStepper: React.FC<{
  tasks: TaskDef[];
  taskIndex: number;
  onJump: (idx: number) => void;
}> = ({ tasks, taskIndex, onJump }) => {
  const phases = [1, 2, 3] as const;
  return (
    <div className="px-3 py-3 border-b border-gray-700 space-y-2">
      {phases.map(phase => {
        const pm = PHASE_META[phase];
        const phaseTasks = tasks.filter(t => t.phase === phase);
        const firstIdx = tasks.findIndex(t => t.phase === phase);
        return (
          <div key={phase}>
            <p className={`text-[9px] font-bold uppercase tracking-wider mb-1 ${pm.color}`}>{pm.label}</p>
            <div className="space-y-0.5">
              {phaseTasks.map((task, i) => {
                const globalIdx = firstIdx + i;
                const isDone = globalIdx < taskIndex;
                const isCurrent = globalIdx === taskIndex;
                const isFuture = globalIdx > taskIndex;
                return (
                  <button key={task.id}
                    onClick={() => isDone && onJump(globalIdx)}
                    disabled={isFuture}
                    className={`w-full text-left flex items-center gap-2 px-2 py-1 rounded-lg text-xs transition-colors
                      ${isCurrent ? `${pm.bg} ${pm.border} border font-bold ${pm.color}` : ''}
                      ${isDone ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50 cursor-pointer' : ''}
                      ${isFuture ? 'text-gray-600 cursor-default' : ''}`}>
                    <span className="flex-shrink-0 text-sm">{isDone ? '✅' : isCurrent ? task.icon : '⬜'}</span>
                    <span className="truncate">{task.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ─── File tree ────────────────────────────────────────────────────────────────

const FileTreePanel: React.FC<{
  files: ProjectFile[];
  activeFile: string;
  onSelect: (path: string) => void;
}> = ({ files, activeFile, onSelect }) => {
  const [openFolders, setOpenFolders] = useState<Set<string>>(
    new Set(['src', 'src/components', 'src/pages', 'src/lib'])
  );
  const toggleFolder = (f: string) =>
    setOpenFolders(prev => { const n = new Set(prev); n.has(f) ? n.delete(f) : n.add(f); return n; });

  type TNode = { name: string; path: string; isFolder: boolean; children: TNode[] };
  const buildTree = (files: ProjectFile[]): TNode[] => {
    const root: TNode[] = [];
    for (const file of files) {
      const parts = file.path.split('/');
      let cur = root;
      for (let i = 0; i < parts.length; i++) {
        const name = parts[i];
        const isLast = i === parts.length - 1;
        let node = cur.find(n => n.name === name);
        if (!node) { node = { name, path: parts.slice(0, i + 1).join('/'), isFolder: !isLast, children: [] }; cur.push(node); }
        if (!isLast) cur = node.children;
      }
    }
    const sort = (nodes: TNode[]) => {
      nodes.sort((a, b) => (a.isFolder && !b.isFolder ? -1 : !a.isFolder && b.isFolder ? 1 : a.name.localeCompare(b.name)));
      nodes.forEach(n => sort(n.children));
    };
    sort(root);
    return root;
  };

  const renderTree = (nodes: TNode[], depth = 0): React.ReactNode =>
    nodes.map(node => (
      <React.Fragment key={node.path}>
        {node.isFolder ? (
          <button onClick={() => toggleFolder(node.path)}
            className="w-full flex items-center gap-1 py-0.5 text-xs text-gray-400 hover:text-gray-200 hover:bg-gray-700/40 rounded transition-colors"
            style={{ paddingLeft: `${8 + depth * 10}px` }}>
            {openFolders.has(node.path) ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
            <span className="text-amber-400 text-[10px]">📁</span>
            <span className="font-medium text-[11px]">{node.name}</span>
          </button>
        ) : (
          <button onClick={() => onSelect(node.path)}
            className={`w-full flex items-center gap-1.5 py-0.5 text-[11px] rounded transition-colors
              ${activeFile === node.path ? 'bg-emerald-500/20 text-emerald-300 font-semibold' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/40'}`}
            style={{ paddingLeft: `${8 + depth * 10}px` }}>
            <FileCode size={10} className="flex-shrink-0" />
            <span className="truncate">{node.name}</span>
          </button>
        )}
        {node.isFolder && openFolders.has(node.path) && renderTree(node.children, depth + 1)}
      </React.Fragment>
    ));

  return <div className="space-y-0">{renderTree(buildTree(files))}</div>;
};

// ═══════════════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════════════

const WebDevelopmentPage: React.FC = () => {
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => { supabase.auth.getUser().then(({ data }) => setUserId(data?.user?.id || null)); }, []);

  // ── Personality baseline ─────────────────────────────────────────────
  // Fetched once on mount; shapes how the AI communicates and teaches
  const [communicationStrategy, setCommunicationStrategy] = useState<any>(null);
  const [learningStrategy, setLearningStrategy]           = useState<any>(null);

  useEffect(() => {
    if (!userId) return;
    supabase
      .from('user_personality_baseline')
      .select('communication_strategy, learning_strategy')
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) { console.warn('[ReactDev] No personality baseline:', error.message); return; }
        if (data?.communication_strategy) setCommunicationStrategy(data.communication_strategy);
        if (data?.learning_strategy)       setLearningStrategy(data.learning_strategy);
        console.log('[ReactDev] ✅ Personality baseline loaded');
      });
  }, [userId]);

  // ── Voice narration ─────────────────────────────────────────────────
  const [voiceOutputEnabled, setVoiceOutputEnabled] = useState(true);
  const [voiceMode, setVoiceMode]                   = useState<'english' | 'pidgin'>('pidgin');
  const [userContinent, setUserContinent]           = useState<string | null>(null);
  const [userGradeLevel, setUserGradeLevel]         = useState<number | null>(null);

  // Fetch continent + grade_level from profiles
  useEffect(() => {
    if (!userId) return;
    supabase
      .from('profiles')
      .select('grade_level, continent')
      .eq('id', userId)
      .single()
      .then(({ data }) => {
        if (data?.continent)   { setUserContinent(data.continent); setVoiceMode(data.continent === 'Africa' ? 'pidgin' : 'english'); }
        if (data?.grade_level) setUserGradeLevel(data.grade_level);
        console.log('[ReactDev] ✅ Profile loaded — continent:', data?.continent, 'grade:', data?.grade_level);
      });
  }, [userId]);

  const {
    speak: hookSpeak,
    cancel: cancelSpeech,
    speaking: isSpeaking,
    fallbackText,
    clearFallback,
    selectedVoice,
  } = useVoice(voiceMode === 'pidgin');

  // ── speakText — must be declared before fetchTaskInstruction to avoid TDZ ──
  const speakTextRef = useRef<(text: string) => void>(() => {});
  const speakText = useCallback((text: string) => {
    if (!voiceOutputEnabled || !text.trim()) return;
    hookSpeak(text);
  }, [voiceOutputEnabled, hookSpeak]);
  useEffect(() => { speakTextRef.current = speakText; }, [speakText]);

  // speakSequence: joins strings and speaks as one utterance via the hook.
  const speakSequence = useCallback((texts: string[], onDone?: () => void) => {
    if (!voiceOutputEnabled) { onDone?.(); return; }
    const joined = texts.filter(t => t?.trim()).join(' ');
    if (!joined) { onDone?.(); return; }
    hookSpeak(joined);
    onDone?.();
  }, [voiceOutputEnabled, hookSpeak]);
  const [sessionId, setSessionId]               = useState<string | null>(null);
  const [sessionName, setSessionName]           = useState('Untitled Project');
  const [sessions, setSessions]                 = useState<SessionRecord[]>([]);
  const [showSessionPicker, setShowSessionPicker] = useState(false);
  const sessionIdRef                            = useRef<string | null>(null);
  useEffect(() => { sessionIdRef.current = sessionId; }, [sessionId]);

  // ── Project files ────────────────────────────────────────────────────
  const [projectFiles, setProjectFiles]   = useState<ProjectFile[]>(STARTER_FILES);
  const [activeFilePath, setActiveFilePath] = useState('src/App.jsx');
  const activeFile = projectFiles.find(f => f.path === activeFilePath) ?? projectFiles[0];

  // ── Task progression ─────────────────────────────────────────────────
  const [taskIndex, setTaskIndex]                 = useState(0);
  const [taskInstruction, setTaskInstruction]     = useState<TaskInstruction | null>(null);
  const [loadingInstruction, setLoadingInstruction] = useState(false);
  const [taskHasGeneration, setTaskHasGeneration] = useState(false);
  const [subTaskIndex, setSubTaskIndex]           = useState(0);
  const [subTaskCritique, setSubTaskCritique]     = useState<{ hasSuggestions: boolean; feedback: string } | null>(null);
  const [isCritiquingResponse, setIsCritiquingResponse] = useState(false);
  const [sessionContext, setSessionContext]       = useState<SessionContext>({});

  // ── Prompt ───────────────────────────────────────────────────────────
  const [prompt, setPrompt]           = useState('');
  const [promptHistory, setPromptHistory] = useState<PromptEntry[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCritiquing, setIsCritiquing] = useState(false);
  const [errorMsg, setErrorMsg]         = useState<string | null>(null);
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);

  // ── Evaluation ───────────────────────────────────────────────────────
  const [showEvaluation, setShowEvaluation] = useState(false);
  const [isEvaluating, setIsEvaluating]     = useState(false);
  const [isSaving, setIsSaving]             = useState(false);
  const [lastSaved, setLastSaved]           = useState<Date | null>(null);
  const [saveError, setSaveError]           = useState<string | null>(null);
  const [evaluation, setEvaluation]         = useState<any>(null);
  const [evalAdvice, setEvalAdvice]         = useState<string | null>(null);
  const [evalError, setEvalError]           = useState<string | null>(null);

  // ── Misc ─────────────────────────────────────────────────────────────
  const [downloading, setDownloading]         = useState(false);
  // Problem screenshot — sent to Claude vision with the next generate call, then cleared
  const [screenshotFile, setScreenshotFile]   = useState<{ base64: string; mediaType: string; name: string } | null>(null);
  // Asset image upload to Storage
  const [isUploadingAsset, setIsUploadingAsset] = useState(false);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  // Site feedback modal
  const [showFeedbackModal, setShowFeedbackModal]   = useState(false);
  const [feedbackText, setFeedbackText]             = useState('');
  const [feedbackImage, setFeedbackImage]           = useState<{ base64: string; mediaType: string; name: string } | null>(null);
  const [isFeedbackSubmitting, setIsFeedbackSubmitting] = useState(false);
  const [feedbackError, setFeedbackError]           = useState<string | null>(null);
  const feedbackInputRef  = useRef<HTMLInputElement>(null);
  const feedbackTextaRef  = useRef<HTMLTextAreaElement>(null);
  const screenshotInputRef = useRef<HTMLInputElement>(null);
  const assetInputRef      = useRef<HTMLInputElement>(null);
  const [copied, setCopied]                   = useState(false);
  const [showStackBlitzModal, setShowStackBlitzModal] = useState(false);

  const currentTask  = TASKS[taskIndex];
  const currentPhase = currentTask?.phase ?? 1;
  const pm           = PHASE_META[currentPhase];

  // ═════════════════════════════════════════════════════════════════════
  // Session management
  // ═════════════════════════════════════════════════════════════════════

  const loadSessions = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from('dashboard')
      .select('id, web_dev_session_id, web_dev_session_name, web_dev_pages, web_dev_prompts, web_dev_evaluation, updated_at')
      .eq('user_id', userId).eq('activity', WEB_DEV_ACTIVITY)
      .not('web_dev_session_id', 'is', null).order('updated_at', { ascending: false });
    if (data?.length) { setSessions(data as SessionRecord[]); if (!sessionId) setShowSessionPicker(true); }
  }, [userId, sessionId]);

  useEffect(() => { if (userId) loadSessions(); }, [userId, loadSessions]);

  const handleDeleteSession = useCallback(async (e: React.MouseEvent, sid: string) => {
    e.stopPropagation(); // don't trigger loadSession on the parent button
    if (!userId) return;
    setDeletingSessionId(sid);
    try {
      // 1. Delete all files in the storage bucket folder for this session
      const folderPrefix = `${userId}/${sid}/`;
      const { data: listed } = await supabase.storage
        .from('web-projects')
        .list(`${userId}/${sid}`, { limit: 100 });
      if (listed?.length) {
        const paths = listed.map((f: any) => `${folderPrefix}${f.name}`);
        await supabase.storage.from('web-projects').remove(paths);
      }
      // Also remove any public/ subfolder assets
      const { data: publicListed } = await supabase.storage
        .from('web-projects')
        .list(`${userId}/${sid}/public`, { limit: 100 });
      if (publicListed?.length) {
        const publicPaths = publicListed.map((f: any) => `${folderPrefix}public/${f.name}`);
        await supabase.storage.from('web-projects').remove(publicPaths);
      }

      // 2. Null out all web_dev fields on the dashboard row (keep the row itself)
      await supabase.from('dashboard').update({
        web_dev_session_id:   null,
        web_dev_session_name: null,
        web_dev_pages:        null,
        web_dev_prompts:      null,
        web_dev_evaluation:   null,
        web_dev_storage_path: null,
      }).eq('user_id', userId).eq('web_dev_session_id', sid);

      // 3. Remove from local state
      setSessions(prev => prev.filter(s => s.web_dev_session_id !== sid));
    } catch (err: any) {
      console.error('[deleteSession]', err);
    } finally {
      setDeletingSessionId(null);
    }
  }, [userId]);

  const ensureSession = useCallback(async (): Promise<string> => {
    if (sessionIdRef.current) return sessionIdRef.current;
    const sid = makeId();
    sessionIdRef.current = sid;
    setSessionId(sid);
    if (userId) {
      await supabase.from('dashboard').insert({
        user_id: userId, activity: WEB_DEV_ACTIVITY,
        web_dev_session_id: sid, web_dev_session_name: sessionName,
        web_dev_pages: STARTER_FILES.map(f => ({ path: f.path, content: f.content })),
        web_dev_prompts: [], web_dev_evaluation: { taskIndex: 0, sessionContext: {} },
      });
    }
    return sid;
  }, [userId, sessionName]);

  const persistSession = useCallback(async (
    files: ProjectFile[], prompts: PromptEntry[], tIdx: number, ctx: SessionContext, scores?: any,
  ) => {
    const sid = sessionIdRef.current;
    if (!userId || !sid) return;
    await supabase.from('dashboard').update({
      web_dev_pages: files.map(f => ({ path: f.path, content: f.content })),
      web_dev_prompts: prompts,
      web_dev_evaluation: { taskIndex: tIdx, sessionContext: ctx, ...(scores ? { scores } : {}) },
      web_dev_session_name: sessionName, updated_at: new Date().toISOString(),
    }).eq('user_id', userId).eq('web_dev_session_id', sid);
  }, [userId, sessionName]);

  const createNewSession = useCallback(async () => {
    if (!userId) return;
    const sid = makeId();
    await supabase.from('dashboard').insert({
      user_id: userId, activity: WEB_DEV_ACTIVITY,
      web_dev_session_id: sid, web_dev_session_name: 'Untitled Project',
      web_dev_pages: STARTER_FILES.map(f => ({ path: f.path, content: f.content })),
      web_dev_prompts: [], web_dev_evaluation: { taskIndex: 0, sessionContext: {} },
    });
    setSessionId(sid); sessionIdRef.current = sid;
    setSessionName('Untitled Project'); setProjectFiles(STARTER_FILES);
    setActiveFilePath('src/App.jsx'); setTaskIndex(0);
    setPromptHistory([]); setEvaluation(null); setSessionContext({});
    setTaskHasGeneration(false); setShowSessionPicker(false);
    setTaskInstruction(null); setPrompt(''); setAiExplanation(null); setErrorMsg(null);
  }, [userId]);

  const loadSession = useCallback((s: SessionRecord) => {
    setSessionId(s.web_dev_session_id); sessionIdRef.current = s.web_dev_session_id;
    setSessionName(s.web_dev_session_name);
    const files: ProjectFile[] = (s.web_dev_pages || []).map((p: any) => ({
      path: p.path || p.name, content: p.content || p.code || '',
    }));
    setProjectFiles(files.length > 0 ? files : STARTER_FILES);
    setActiveFilePath('src/App.jsx');
    const ev = s.web_dev_evaluation || {};
    const tIdx = ev.taskIndex ?? 0;
    setTaskIndex(tIdx); setSessionContext(ev.sessionContext ?? {});
    setEvaluation(ev.scores || null); setPromptHistory(s.web_dev_prompts || []);
    setTaskHasGeneration(false); setShowSessionPicker(false);
    setTaskInstruction(null); setPrompt(''); setAiExplanation(null); setErrorMsg(null); setSubTaskCritique(null);
  }, []);

  // ═════════════════════════════════════════════════════════════════════
  // Task instruction (adaptive, AI-generated per task)
  // ═════════════════════════════════════════════════════════════════════

  const fetchTaskInstruction = useCallback(async (
    idx: number, files: ProjectFile[], ctx: SessionContext,
  ) => {
    // communicationStrategy and learningStrategy come from component state (closure)
    const task = TASKS[idx];
    if (!task || task.isOnboarding) return;
    setLoadingInstruction(true); setTaskInstruction(null);
    try {
      const fileSummary = files
        .filter(f => f.content.length > 10)
        .map(f => ({ path: f.path, preview: f.content.substring(0, 400) }));
      const result = await callInstructionAPI({
        taskId: task.id, taskLabel: task.label, phase: task.phase,
        projectFiles: fileSummary, sessionContext: ctx,
        completedTasks: TASKS.slice(0, idx).map(t => t.id),
        communicationStrategy,
        learningStrategy,
      });
      setTaskInstruction(result as TaskInstruction);
      // Narrate the first sub-task aloud
      if (result?.subTaskTeaching?.[0] && result?.subTasks?.[0]) {
        speakTextRef.current(result.subTaskTeaching[0] + ' ' + result.subTasks[0]);
      } else if (result?.subTasks?.[0]) {
        speakTextRef.current(result.subTasks[0]);
      }
    } catch {
      // Graceful fallback — questions must directly follow their teaching text
      // Each question asks specifically about the concept the teaching just explained
      const fallbackSeeds: Record<string, { teaching: string; question: string }[]> = {
        define_site: [
          { teaching: 'Every professional website project begins with a single clear statement of purpose. Without it, developers often build the wrong thing — spending weeks on features nobody needs.',
            question: 'What is the main purpose of this website? Describe in 1–2 sentences what it does and why someone would visit it.' },
          { teaching: 'Knowing your audience shapes every design decision — layout, language, and what content to show first. A website for teenagers looks and reads completely differently from one for professionals.',
            question: 'Who is your target audience? Describe their age, background, and what they are looking for when they arrive.' },
          { teaching: 'Listing what your site will offer before writing any code is called scoping. It prevents the project from growing endlessly and keeps the visitor experience focused.',
            question: 'List 3–5 key things a visitor should be able to find or do on this website.' },
        ],
        plan_pages: [
          { teaching: 'Each page should have exactly one job. Planning pages before building means you never end up with a page that tries to do too much — one of the most common beginner mistakes.',
            question: 'What pages does your site need? List each one and its single job (e.g. Home — first impression, About — build trust, Contact — reach you).' },
          { teaching: 'In React, a component is a reusable piece of UI. Identifying shared components before building saves enormous time — write the code once and use it everywhere.',
            question: 'Which elements appear on every page and should be reusable components? (e.g. Navbar at the top, Footer at the bottom, Card for repeated items)' },
          { teaching: 'Visitor flow is the path someone takes through your site from arrival to goal. Mapping it before building ensures your navigation and page order guide visitors naturally.',
            question: 'Walk through the path a typical visitor takes — from the moment they land to the moment they accomplish their goal. What pages do they visit in order?' },
        ],
      };
      const seeds = fallbackSeeds[task.id] ?? [
        { teaching: 'Starting with a clear definition keeps every future decision focused on what actually matters.',
          question: `What is the goal of this step: ${task.label}?` },
        { teaching: 'Every professional decision at this stage is driven by who will use the result and what they need.',
          question: 'Who is this for, and what do they need from it?' },
        { teaching: 'Thinking through specific details before building prevents costly changes later.',
          question: 'What specific requirements or constraints should the AI know about?' },
      ];
      setTaskInstruction({
        headline: task.label,
        context: `Let's work on ${task.label.toLowerCase()} for your website.`,
        subTasks:        seeds.map(s => s.question),
        subTaskTeaching: seeds.map(s => s.teaching),
        examplePrompt:   seeds[0].question,
      });
    } finally {
      setLoadingInstruction(false);
    }
  }, [communicationStrategy, learningStrategy]);

  // ─── Upload project ZIP to Supabase Storage ─────────────────────────────
  const uploadProjectToStorage = useCallback(async (
    files: ProjectFile[], uid: string, sid: string
  ): Promise<string> => {
    const { default: JSZip } = await import('jszip' as any);
    const zip = new JSZip();
    for (const file of files) zip.file(file.path, file.content);
    const blob = await zip.generateAsync({ type: 'blob' });
    const storagePath = `${uid}/${sid}/project.zip`;
    const { error } = await supabase.storage
      .from('web-projects')
      .upload(storagePath, blob, { contentType: 'application/zip', upsert: true });
    if (error) throw new Error(`Storage upload failed: ${error.message}`);
    return storagePath;
  }, []);

  // ─── Full save: upload to Storage + evaluate + persist ───────────────────
  const handleSaveProject = useCallback(async () => {
    if (!userId || !sessionIdRef.current) return;
    setIsSaving(true); setSaveError(null);
    await ensureSession();
    try {
      // 1. Upload ZIP to storage
      const storagePath = await uploadProjectToStorage(
        projectFiles, userId, sessionIdRef.current
      );

      // 2. Full session evaluation
      let evalScores: any = null;
      let advice: string | null = null;
      try {
        const evalResult = await callEvaluateAPI(promptHistory, projectFiles, taskIndex);
        evalScores = evalResult.evaluation ?? null;
        advice     = evalResult.advice     ?? null;
      } catch { /* evaluation failure does not block save */ }

      // 3. Persist everything — files, enriched chat history, evaluation, storage path
      await supabase.from('dashboard').update({
        web_dev_pages:        projectFiles.map(f => ({ path: f.path, content: f.content })),
        web_dev_prompts:      promptHistory,
        web_dev_evaluation:   { taskIndex, sessionContext, scores: evalScores, savedAt: new Date().toISOString() },
        web_dev_storage_path: storagePath,
        web_dev_session_name: sessionName,
        updated_at:           new Date().toISOString(),
      }).eq('user_id', userId).eq('web_dev_session_id', sessionIdRef.current);

      if (evalScores) {
        setEvaluation(evalScores);
        setEvalAdvice(advice);
        setShowEvaluation(true);
      }
      setLastSaved(new Date());
    } catch (err: any) {
      setSaveError(err.message || 'Save failed');
    } finally { setIsSaving(false); }
  }, [userId, projectFiles, promptHistory, taskIndex, sessionContext, sessionName,
      ensureSession, uploadProjectToStorage]);

  // Re-fetch instruction whenever taskIndex changes (useCallback dep ensures fresh sessionContext)
  useEffect(() => {
    if (taskIndex > 0) fetchTaskInstruction(taskIndex, projectFiles, sessionContext);
  // projectFiles and sessionContext intentionally omitted — we only want this
  // to fire on task navigation, not on every keystroke or context update.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskIndex]);

  // ═════════════════════════════════════════════════════════════════════
  // Task navigation
  // ═════════════════════════════════════════════════════════════════════

  const handleCompleteTask = useCallback(async () => {
    if (taskIndex >= TASKS.length - 1) return;
    const completedTaskId = currentTask?.id;
    const nextIdx = taskIndex + 1;
    setTaskIndex(nextIdx); setTaskHasGeneration(false);
    setSubTaskIndex(0); setSubTaskCritique(null);
    setPrompt(''); setAiExplanation(null); setErrorMsg(null);
    await persistSession(projectFiles, promptHistory, nextIdx, sessionContext);

    // Non-blocking per-task evaluation — builds up evaluation data task by task
    // Per-task evaluation: fire-and-forget, stores scores keyed by task
    const taskPrompts = promptHistory.filter(e => e.taskId === completedTaskId);
    if (taskPrompts.length > 0) {
      fetch('/api/site-evaluate-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          mode: 'task',
          taskId: completedTaskId,
          chatHistory: taskPrompts,
          projectFiles: projectFiles.map(f => ({ path: f.path, content: f.content.substring(0, 600) })),
          sessionContext,
        }),
      }).then(r => r.ok ? r.json() : null).then(data => {
        if (data?.evaluation) {
          setEvaluation(prev => ({ ...(prev || {}), [`task_${completedTaskId}`]: data.evaluation }));
        }
      }).catch(() => { /* silent — task eval failures never block navigation */ });
    }
  }, [taskIndex, currentTask, projectFiles, promptHistory, sessionContext, evaluation, persistSession]);

  const handleOnboardingComplete = useCallback(async () => {
    await ensureSession();
    setTaskIndex(1); setTaskHasGeneration(false); setSubTaskIndex(0); setSubTaskCritique(null);
    speakText("Welcome to the planning phase. Let's start by defining your website.");
    await fetchTaskInstruction(1, projectFiles, sessionContext);
    setTimeout(() => persistSession(projectFiles, promptHistory, 1, sessionContext), 100);
  }, [ensureSession, projectFiles, promptHistory, sessionContext, persistSession, fetchTaskInstruction]);

  // ═════════════════════════════════════════════════════════════════════
  // Code generation
  // ═════════════════════════════════════════════════════════════════════

  // ── Site Feedback modal handlers ─────────────────────────────────────────────
  const openFeedbackModal = useCallback(() => {
    setFeedbackText(''); setFeedbackImage(null); setFeedbackError(null);
    setShowFeedbackModal(true);
    // Small delay so modal is mounted before focusing
    setTimeout(() => feedbackTextaRef.current?.focus(), 80);
  }, []);

  const handleFeedbackImageSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const [header, base64] = (reader.result as string).split(',');
      const mediaType = header.match(/data:([^;]+)/)?.[1] || 'image/png';
      setFeedbackImage({ base64, mediaType, name: file.name });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }, []);

  // Ctrl-V paste anywhere inside the modal
  const handleFeedbackPaste = useCallback((e: React.ClipboardEvent) => {
    const item = Array.from(e.clipboardData.items).find(i => i.type.startsWith('image/'));
    if (!item) return;
    e.preventDefault();
    const file = item.getAsFile();
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const [header, base64] = (reader.result as string).split(',');
      const mediaType = header.match(/data:([^;]+)/)?.[1] || 'image/png';
      setFeedbackImage({ base64, mediaType, name: 'pasted-screenshot.png' });
    };
    reader.readAsDataURL(file);
  }, []);

  const handleFeedbackSubmit = useCallback(async () => {
    if (!feedbackText.trim()) return;
    setIsFeedbackSubmitting(true); setFeedbackError(null);
    await ensureSession();
    try {
      // Build a targeted system override: free-form improvement request, not task-gated
      const overridePrompt =
        `The student wants to improve their website. This is a free-form improvement request — ` +
        `NOT tied to any current learning step. Examine ALL current project files, identify which ` +
        `page(s) are most relevant to the feedback, and make the requested changes directly. ` +
        `Return only the files that changed. In the explanation field, summarise in plain English ` +
        `what you changed and why. Do not ask the student to stay on topic or redirect them.`;

      const apiKey = (import.meta as any).env?.VITE_ANTHROPIC_API_KEY
                  || (import.meta as any).env?.ANTHROPIC_API_KEY
                  || '';

      // Build multimodal content if image is attached
      const userContent: any = feedbackImage
        ? [
            { type: 'image', source: { type: 'base64', media_type: feedbackImage.mediaType, data: feedbackImage.base64 } },
            { type: 'text',  text: `${feedbackImage.name ? `[Screenshot: ${feedbackImage.name}]
` : ''}${feedbackText}` },
          ]
        : feedbackText;

      // Call generate API — pass freeFormMode flag so it uses the override system prompt
      const result = await callGenerateAPI({
        action: 'iterate',
        prompt: feedbackText,
        taskId: currentTask?.id,
        projectFiles: projectFiles.map(f => ({ path: f.path, content: f.content })),
        sessionContext,
        communicationStrategy,
        learningStrategy,
        freeFormFeedback: true,          // signals API to skip task guidance
        freeFormInstruction: overridePrompt,
        ...(feedbackImage ? {
          imageData:      feedbackImage.base64,
          imageMediaType: feedbackImage.mediaType,
          imageName:      feedbackImage.name,
        } : {}),
      });

      // Apply file changes
      if (result.files?.length) {
        setProjectFiles(prev => {
          const merged = [...prev];
          for (const updated of result.files) {
            const idx = merged.findIndex(f => f.path === updated.path);
            if (idx >= 0) merged[idx] = { ...merged[idx], content: updated.content };
            else merged.push(updated);
          }
          return merged;
        });
        if (result.files.length === 1) setActiveFilePath(result.files[0].path);
      }
      if (result.explanation) setAiExplanation(result.explanation);

      // Store in promptHistory so it shows in dashboard
      const entry: PromptEntry = {
        id: makeId(), taskId: currentTask?.id || 'feedback',
        subTaskIndex, prompt: feedbackText,
        aiExplanation: result.explanation || undefined,
        timestamp: new Date().toISOString(),
        action: 'feedback',
        filesModified: result.files?.map((f: any) => f.path) || [],
      };
      setPromptHistory(prev => {
        const updated = [...prev, entry];
        persistSession(projectFiles, updated, taskIndex, sessionContext);
        return updated;
      });

      setShowFeedbackModal(false);
      setFeedbackText(''); setFeedbackImage(null);
    } catch (err: any) {
      setFeedbackError(err.message || 'Feedback submission failed');
    } finally { setIsFeedbackSubmitting(false); }
  }, [feedbackText, feedbackImage, projectFiles, sessionContext, communicationStrategy,
      learningStrategy, currentTask, subTaskIndex, taskIndex, ensureSession, persistSession]);

  // ── Screenshot upload (problem documentation — not stored) ────────────────
  const handleScreenshotSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const [header, base64] = dataUrl.split(',');
      const mediaType = header.match(/data:([^;]+)/)?.[1] || 'image/jpeg';
      setScreenshotFile({ base64, mediaType: mediaType as any, name: file.name });
    };
    reader.readAsDataURL(file);
    // Reset input so same file can be re-selected
    e.target.value = '';
  }, []);

  // ── Asset image upload to Storage → adds public/ entry to projectFiles ───────
  const handleAssetUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userId || !sessionIdRef.current) return;
    e.target.value = '';
    setIsUploadingAsset(true);
    try {
      const storagePath = `${userId}/${sessionIdRef.current}/public/${file.name}`;
      const { error } = await supabase.storage
        .from('web-projects')
        .upload(storagePath, file, { contentType: file.type, upsert: true });
      if (error) throw new Error(error.message);

      // Get public URL — we store it as the file "content" so the AI knows the filename
      const { data: urlData } = supabase.storage.from('web-projects').getPublicUrl(storagePath);
      const publicUrl = urlData?.publicUrl ?? '';

      // Add to projectFiles as public/filename so the AI can reference it
      const projectPath = `public/${file.name}`;
      setProjectFiles(prev => {
        const filtered = prev.filter(f => f.path !== projectPath);
        return [...filtered, {
          path: projectPath,
          content: `/* Asset image — reference in your code as: /public/${file.name} */
/* Storage URL: ${publicUrl} */`,
          preview: `[image: ${file.name}]`,
        }];
      });
      setActiveFilePath(projectPath);
    } catch (err: any) {
      setErrorMsg(`Asset upload failed: ${err.message}`);
    } finally { setIsUploadingAsset(false); }
  }, [userId]);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) return;
    const submittedPrompt = prompt.trim();
    setIsGenerating(true); setErrorMsg(null); setAiExplanation(null); setSubTaskCritique(null);
    await ensureSession();
    const hasCode = projectFiles.some(f => f.path.startsWith('src/') && f.content.length > 100 && f.path !== 'src/index.css');
    try {
      const result = await callGenerateAPI({
        action: hasCode ? 'iterate' : 'generate',
        prompt: submittedPrompt, taskId: currentTask?.id,
        projectFiles: projectFiles.map(f => ({ path: f.path, content: f.content })),
        sessionContext, communicationStrategy, learningStrategy,
        // Attach screenshot if student uploaded one — API passes to Claude vision
        ...(screenshotFile ? {
          imageData:      screenshotFile.base64,
          imageMediaType: screenshotFile.mediaType,
          imageName:      screenshotFile.name,
        } : {}),
      });
      // Clear screenshot after submission — it was a one-shot problem description
      setScreenshotFile(null);
      const updatedFiles = result.files ? mergeFiles(projectFiles, result.files) : projectFiles;
      setProjectFiles(updatedFiles);
      if (result.files?.length === 1) setActiveFilePath(result.files[0].path);
      else if (result.files?.length > 1) {
        const main = result.files.find((f: ProjectFile) => f.path.includes('App.jsx') || f.path.startsWith('src/pages/'));
        if (main) setActiveFilePath(main.path);
      }
      setAiExplanation(result.explanation || null);
      if (result.sessionContext) setSessionContext(prev => ({ ...prev, ...result.sessionContext }));
      // Snapshot instruction state — will be stale in async callbacks below
      const snapInstruction = taskInstruction;
      const snapSubIdx      = subTaskIndex;
      // Detect refinement: was the previous entry for this task+step flagged hasSuggestions?
      const prevEntry = [...promptHistory].reverse()
        .find(e => e.taskId === currentTask?.id && e.subTaskIndex === snapSubIdx);
      const isRefinement = prevEntry?.hasSuggestions === true;

      const entryId = makeId();
      const entry: PromptEntry = {
        id: entryId,
        taskId:           currentTask?.id ?? '',
        subTaskIndex:     snapSubIdx,
        subTaskQuestion:  snapInstruction?.subTasks?.[snapSubIdx]  ?? '',
        subTaskTeaching:  snapInstruction?.subTaskTeaching?.[snapSubIdx] ?? '',
        prompt:           submittedPrompt,
        aiExplanation:    result.explanation || undefined,
        studentRefined:   isRefinement,
        timestamp:        new Date().toISOString(),
        action:           hasCode ? 'iterate' : 'generate',
        filesModified:    result.files?.map((f: ProjectFile) => f.path),
      };
      const newHistory = [...promptHistory, entry];
      setPromptHistory(newHistory); setTaskHasGeneration(true);
      setPrompt(''); promptRef.current?.focus();
      await persistSession(updatedFiles, newHistory, taskIndex, sessionContext);
      // Auto-upload to Storage on every generate (fire-and-forget, never blocks UI)
      if (userId && sessionIdRef.current) {
        uploadProjectToStorage(updatedFiles, userId, sessionIdRef.current)
          .then(path => {
            supabase.from('dashboard').update({ web_dev_storage_path: path, updated_at: new Date().toISOString() })
              .eq('user_id', userId).eq('web_dev_session_id', sessionIdRef.current!).then(() => {});
          }).catch(() => {});
      }

      // ── Fetch critique, update entry with result, chain all speech ─────────
      setIsCritiquingResponse(true);
      try {
        const critiqueRes = await fetch('/api/site-response-critique', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'claude-sonnet-4-6',
            studentResponse:  submittedPrompt,
            subTaskQuestion:  snapInstruction?.subTasks?.[snapSubIdx]  ?? '',
            subTaskTeaching:  snapInstruction?.subTaskTeaching?.[snapSubIdx] ?? '',
            taskId:           currentTask?.id,
            sessionContext, communicationStrategy, learningStrategy,
          }),
        });
        if (critiqueRes.ok) {
          const cr = await critiqueRes.json();
          setSubTaskCritique(cr);

          // Update the entry we just created with critique data
          setPromptHistory(prev => {
            const updated = prev.map(e =>
              e.id === entryId
                ? { ...e, aiCritique: cr.feedback, hasSuggestions: cr.hasSuggestions }
                : e
            );
            // Persist the enriched history asynchronously
            persistSession(updatedFiles, updated, taskIndex, sessionContext);
            return updated;
          });

          if (!cr.hasSuggestions) {
            speakSequence(
              [result.explanation, cr.feedback].filter(Boolean),
              () => {
                setTimeout(() => {
                  setSubTaskCritique(null);
                  setSubTaskIndex(prev => {
                    const maxSub = (snapInstruction?.subTasks?.length ?? 1) - 1;
                    const next   = prev < maxSub ? prev + 1 : prev;
                    if (next !== prev && snapInstruction?.subTasks?.[next]) {
                      const t = snapInstruction?.subTaskTeaching?.[next] ?? '';
                      const q = snapInstruction!.subTasks[next];
                      setTimeout(() => speakSequence([t, q].filter(Boolean)), 400);
                    }
                    return next;
                  });
                }, 500);
              }
            );
          } else {
            speakSequence([result.explanation, cr.feedback].filter(Boolean));
          }
        } else {
          if (result.explanation) speakText(result.explanation);
        }
      } catch {
        if (result.explanation) speakText(result.explanation);
      }
      finally { setIsCritiquingResponse(false); }

    } catch (err: any) { setErrorMsg(err.message || 'Generation failed'); }
    finally { setIsGenerating(false); }
  }, [prompt, projectFiles, sessionContext, promptHistory, taskIndex, subTaskIndex, taskInstruction, currentTask, ensureSession, persistSession]);

  // Advances to next sub-task when student chooses to move on after critique
  const handleMoveToNextStep = useCallback(() => {
    setSubTaskCritique(null);
    setSubTaskIndex(prev => {
      const maxSub = (taskInstruction?.subTasks?.length ?? 1) - 1;
      const next   = prev < maxSub ? prev + 1 : prev;
      if (next !== prev && taskInstruction?.subTasks?.[next]) {
        const t = taskInstruction?.subTaskTeaching?.[next] ?? '';
        const q = taskInstruction!.subTasks[next];
        // Speak teaching then question in sequence, not concatenated
        setTimeout(() => speakSequence([t, q].filter(Boolean)), 300);
      }
      return next;
    });
  }, [taskInstruction, speakText, speakSequence]);

  const handleCritique = useCallback(async () => {
    if (!prompt.trim()) return;
    setIsCritiquing(true); setErrorMsg(null);
    await ensureSession();
    try {
      const result = await callGenerateAPI({
        action: 'critique', prompt: prompt.trim(), taskId: currentTask?.id,
        projectFiles: projectFiles.map(f => ({ path: f.path, content: f.content.substring(0, 500) })),
        sessionContext,
        communicationStrategy,
        learningStrategy,
      });
      const critiqueText = result.critique || result.feedback || 'No feedback returned.';
      setAiExplanation(critiqueText);
      speakText(critiqueText);
      const entry: PromptEntry = {
        id: makeId(), taskId: currentTask?.id ?? '', prompt: prompt.trim(),
        timestamp: new Date().toISOString(), action: 'critique',
      };
      const newHistory = [...promptHistory, entry];
      setPromptHistory(newHistory);
      await persistSession(projectFiles, newHistory, taskIndex, sessionContext);
    } catch (err: any) { setErrorMsg(err.message || 'Critique failed'); }
    finally { setIsCritiquing(false); }
  }, [prompt, projectFiles, sessionContext, promptHistory, taskIndex, currentTask, ensureSession, persistSession]);

  // ═════════════════════════════════════════════════════════════════════
  // Download as ZIP  (requires: npm install jszip)
  // ═════════════════════════════════════════════════════════════════════

  const handleDownload = useCallback(async () => {
    setDownloading(true);
    try {
      const { default: JSZip } = await import('jszip' as any);
      const zip = new JSZip();
      for (const file of projectFiles) zip.file(file.path, file.content);
      const blob = await zip.generateAsync({ type: 'blob' });
      // Local download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${sessionName.replace(/[^a-z0-9]/gi, '-').toLowerCase() || 'react-project'}.zip`;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(url);
      // Also upload to Storage in background so the project is always cloud-backed
      if (userId && sessionIdRef.current) {
        uploadProjectToStorage(projectFiles, userId, sessionIdRef.current)
          .then(storagePath => {
            setLastSaved(new Date());
            supabase.from('dashboard').update({
              web_dev_storage_path: storagePath,
              updated_at: new Date().toISOString(),
            }).eq('user_id', userId).eq('web_dev_session_id', sessionIdRef.current!);
          })
          .catch(() => { /* non-blocking */ });
      }
    } catch {
      setErrorMsg('Install jszip to enable downloads: npm install jszip');
    } finally { setDownloading(false); }
  }, [projectFiles, sessionName, userId, uploadProjectToStorage]);

  // ─── Open in StackBlitz (live preview without local install) ─────────
  const handleOpenStackBlitz = useCallback(() => {
    const form = document.createElement('form');
    form.method = 'POST'; form.action = 'https://stackblitz.com/run'; form.target = '_blank';
    const add = (name: string, value: string) => {
      const i = document.createElement('input'); i.type = 'hidden'; i.name = name; i.value = value; form.appendChild(i);
    };
    add('project[title]', sessionName);
    add('project[description]', 'React + Vite static website — built with Girls AIing and Vibing');
    add('project[template]', 'node');
    for (const file of projectFiles) add(`project[files][${file.path}]`, file.content);
    document.body.appendChild(form); form.submit(); document.body.removeChild(form);
  }, [projectFiles, sessionName]);

  // ─── Evaluate ────────────────────────────────────────────────────────
  const handleEvaluate = useCallback(async () => {
    if (!userId) return;
    setIsEvaluating(true); setEvalError(null); setShowEvaluation(true);
    await ensureSession();
    try {
      const result = await callEvaluateAPI(promptHistory, projectFiles, taskIndex);
      setEvaluation(result.evaluation);
      setEvalAdvice(result.advice || null);
      await persistSession(projectFiles, promptHistory, taskIndex, sessionContext, result.evaluation);
    } catch (err: any) { setEvalError(err.message || 'Evaluation failed'); }
    finally { setIsEvaluating(false); }
  }, [userId, projectFiles, promptHistory, taskIndex, sessionContext, ensureSession, persistSession]);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(activeFile?.content || '');
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }, [activeFile]);

  const handleEditorChange = useCallback((value: string | undefined) => {
    setProjectFiles(prev => prev.map(f => f.path === activeFilePath ? { ...f, content: value || '' } : f));
  }, [activeFilePath]);



  // ═════════════════════════════════════════════════════════════════════
  // Render
  // ═════════════════════════════════════════════════════════════════════

  const taskPrompts = promptHistory.filter(e => e.taskId === currentTask?.id);

  return (
    <div className="flex flex-col h-screen">
      <Navbar />

      {/* Voice fallback — fixed overlay when TTS unavailable (e.g. no network voice in Nigeria) */}
      {fallbackText && (
        <div className="fixed bottom-4 right-4 z-50 max-w-sm">
          <VoiceFallback text={fallbackText} onDismiss={clearFallback} />
        </div>
      )}

      <main className="flex-1 flex flex-col bg-gray-900 overflow-hidden">

        {/* ── StackBlitz Confirmation Modal ─────────────────────── */}
        {showStackBlitzModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-gray-800 border border-gray-600 rounded-2xl w-[460px] shadow-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-700 flex justify-between items-center">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <ExternalLink size={18} className="text-blue-400" /> Visualize Your Website
                </h2>
                <button onClick={() => setShowStackBlitzModal(false)} className="p-1 text-gray-400 hover:text-white rounded">
                  <X size={18} />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <p className="text-sm text-gray-300 leading-relaxed">
                  Your project files will be transferred to{' '}
                  <strong className="text-white">StackBlitz</strong>, an online development
                  environment that can run your React app live in the browser.
                </p>

                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                    <span className="text-lg flex-shrink-0">📦</span>
                    <div>
                      <p className="text-xs font-bold text-blue-300 mb-0.5">All {projectFiles.length} project files will be transferred</p>
                      <p className="text-xs text-gray-400 leading-relaxed">
                        Your current code is sent as a one-time snapshot. Changes you make here afterward will not appear there automatically — click this button again to get a fresh transfer.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                    <span className="text-lg flex-shrink-0">👤</span>
                    <div>
                      <p className="text-xs font-bold text-amber-300 mb-0.5">You may need to sign up for StackBlitz</p>
                      <p className="text-xs text-gray-400 leading-relaxed">
                        StackBlitz is free. If prompted, create an account to save your preview. Your code is not stored on their platform unless you save it.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 bg-gray-700/50 border border-gray-600 rounded-xl">
                    <span className="text-lg flex-shrink-0">🔄</span>
                    <div>
                      <p className="text-xs font-bold text-gray-300 mb-0.5">Come back here to keep learning</p>
                      <p className="text-xs text-gray-400 leading-relaxed">
                        StackBlitz is just for previewing. Your guided tasks, AI coaching, and progress all live here — keep this tab open.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="px-6 pb-6 flex gap-3">
                <button
                  onClick={() => setShowStackBlitzModal(false)}
                  className="flex-1 py-2.5 text-sm text-gray-400 hover:text-white border border-gray-600 hover:border-gray-400 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => { setShowStackBlitzModal(false); handleOpenStackBlitz(); }}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors"
                >
                  <ExternalLink size={15} /> Continue to StackBlitz
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Session Picker Modal ───────────────────────────────── */}
        {showSessionPicker && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-gray-800 border border-gray-600 rounded-2xl w-[480px] max-h-[80vh] overflow-hidden shadow-2xl flex flex-col">
              <div className="px-6 py-4 border-b border-gray-700">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <FolderOpen size={20} className="text-emerald-400" /> Your React Projects
                </h2>
                <p className="text-sm text-gray-400 mt-1">Resume a project or start fresh</p>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {sessions.map(s => (
                  <div key={s.web_dev_session_id}
                    className="group relative flex items-stretch gap-2">
                    {/* Main clickable card */}
                    <button onClick={() => loadSession(s)}
                      className="flex-1 text-left p-4 bg-gray-700/50 hover:bg-gray-700 rounded-xl border border-gray-600 transition-colors min-w-0">
                      <div className="flex justify-between items-start gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-white truncate">{s.web_dev_session_name}</p>
                          <p className="text-xs text-gray-400 mt-1">
                            Task {(s.web_dev_evaluation?.taskIndex ?? 0) + 1}/{TASKS.length} • {(s.web_dev_prompts || []).length} prompts • {(s.web_dev_pages || []).length} files
                          </p>
                        </div>
                        {(() => {
                          const sc = s.web_dev_evaluation?.scores;
                          const score = sc?.overall_score_average ?? sc?.overall ?? null;
                          return score !== null
                            ? <ScoreBadge score={Number(Number(score).toFixed(1))} />
                            : null;
                        })()}
                      </div>
                      {s.updated_at && <p className="text-[10px] text-gray-500 mt-2">Last edited {new Date(s.updated_at).toLocaleDateString()}</p>}
                    </button>

                    {/* Delete button — always visible on mobile, hover-revealed on desktop */}
                    <button
                      onClick={e => handleDeleteSession(e, s.web_dev_session_id)}
                      disabled={deletingSessionId === s.web_dev_session_id}
                      title="Delete project"
                      className="flex-shrink-0 flex items-center justify-center w-10 rounded-xl border border-gray-700 bg-gray-800
                        text-gray-600 hover:text-red-400 hover:border-red-500/50 hover:bg-red-500/10
                        transition-colors disabled:opacity-40 sm:opacity-0 sm:group-hover:opacity-100">
                      {deletingSessionId === s.web_dev_session_id
                        ? <Loader2 size={14} className="animate-spin text-red-400" />
                        : <Trash2 size={14} />}
                    </button>
                  </div>
                ))}
              </div>
              <div className="p-4 border-t border-gray-700 space-y-2">
                <button onClick={createNewSession}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-colors">
                  <Plus size={18} /> Start New Project
                </button>
                {sessions.length > 0 && (
                  <button onClick={() => setShowSessionPicker(false)}
                    className="w-full px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">
                    Continue without loading
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Site Feedback Modal ─────────────────────────────────── */}
        {showFeedbackModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onPaste={handleFeedbackPaste}
          >
            <div className="bg-gray-800 border border-gray-600 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col overflow-hidden">

              {/* Header */}
              <div className="px-5 py-4 border-b border-gray-700 flex items-center justify-between flex-shrink-0">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <MessageSquarePlus size={17} className="text-blue-400" />
                  Site Feedback
                </h2>
                <button onClick={() => setShowFeedbackModal(false)}
                  className="p-1 text-gray-400 hover:text-white rounded transition-colors">
                  <X size={17} />
                </button>
              </div>

              {/* Body */}
              <div className="p-5 space-y-4">
                <p className="text-xs text-gray-400 leading-relaxed">
                  Describe what you'd like to improve on your website. Claude will identify the
                  relevant page(s) and make the changes directly — this won't interrupt your
                  current learning step.
                </p>

                {/* Screenshot attach — file picker or Ctrl-V */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <button
                      onClick={() => feedbackInputRef.current?.click()}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                        feedbackImage
                          ? 'text-purple-300 border-purple-500/50 bg-purple-500/10'
                          : 'text-gray-400 border-gray-600 hover:text-gray-200 hover:border-gray-400'
                      }`}>
                      <ImageIcon size={12} />
                      {feedbackImage ? feedbackImage.name : 'Attach screenshot'}
                    </button>
                    {feedbackImage && (
                      <button onClick={() => setFeedbackImage(null)}
                        className="text-gray-600 hover:text-red-400 transition-colors" title="Remove">
                        <X size={12} />
                      </button>
                    )}
                    <span className="text-[10px] text-gray-600 ml-1">or Ctrl-V to paste</span>
                  </div>
                  <input ref={feedbackInputRef} type="file" accept="image/*" className="hidden"
                    onChange={handleFeedbackImageSelect} />

                  {/* Preview pasted/attached image */}
                  {feedbackImage && (
                    <div className="mt-1 rounded-lg overflow-hidden border border-gray-700 max-h-36 flex items-center justify-center bg-gray-900">
                      <img
                        src={`data:${feedbackImage.mediaType};base64,${feedbackImage.base64}`}
                        alt="Feedback screenshot"
                        className="max-h-36 object-contain"
                      />
                    </div>
                  )}
                </div>

                {/* Feedback description textarea */}
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1.5 block">
                    What would you like to improve?
                  </label>
                  <textarea
                    ref={feedbackTextaRef}
                    value={feedbackText}
                    onChange={e => setFeedbackText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleFeedbackSubmit(); }}
                    placeholder="e.g. The hero section font feels too small and the button colour doesn't match the rest of the page…"
                    rows={5}
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 resize-y outline-none focus:border-blue-500 transition-colors leading-relaxed"
                  />
                  <p className="text-[9px] text-gray-700 mt-1">Ctrl+Enter to submit</p>
                </div>

                {feedbackError && (
                  <div className="p-3 bg-red-500/15 border border-red-500/30 rounded-lg text-xs text-red-300 flex gap-2">
                    <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />{feedbackError}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-5 pb-5 flex gap-2 flex-shrink-0">
                <button
                  onClick={handleFeedbackSubmit}
                  disabled={isFeedbackSubmitting || !feedbackText.trim()}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors disabled:opacity-40">
                  {isFeedbackSubmitting
                    ? <><Loader2 size={15} className="animate-spin" /> Improving site…</>
                    : <><ArrowUpCircle size={15} /> Apply Feedback</>}
                </button>
                <button
                  onClick={() => setShowFeedbackModal(false)}
                  className="px-4 py-2.5 text-sm font-medium text-gray-400 hover:text-white border border-gray-600 hover:border-gray-400 rounded-xl transition-colors">
                  Cancel
                </button>
              </div>

            </div>
          </div>
        )}

        {/* ── Evaluation Modal ───────────────────────────────────── */}
        {showEvaluation && (() => {
          // Phase meta for colour coding
          const phaseMeta: Record<string, { label: string; color: string; bg: string; border: string }> = {
            phase_1_think_first: { label: 'Phase 1 — Think First',  color: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/25'   },
            phase_2_build_it:    { label: 'Phase 2 — Build It',     color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/25' },
            phase_3_refine_it:   { label: 'Phase 3 — Refine It',    color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/25'   },
          };
          const moduleMeta: Record<string, string> = {
            m1_purpose_and_audience:    'M1 · Purpose & Audience',
            m2_content_strategy:        'M2 · Content Strategy',
            m3_site_architecture:       'M3 · Site Architecture',
            m4_page_layout_and_structure: 'M4 · Page Layout',
            m5_visual_design_and_styling: 'M5 · Visual Design',
            m6_media_and_assets:        'M6 · Media & Assets',
            m7_interactivity_and_data:  'M7 · Interactivity',
            m8_iteration_and_quality:   'M8 · Iteration & Quality',
          };
          const scoreColor = (s: number) =>
            s >= 2.5 ? 'text-emerald-400' : s >= 1.5 ? 'text-amber-400' : 'text-red-400';
          const skillLabel = (k: string) =>
            k.replace(/_/g, ' ').replace(/\w/g, c => c.toUpperCase());

          return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="bg-gray-800 border border-gray-600 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
              {/* Header */}
              <div className="px-6 py-4 border-b border-gray-700 flex justify-between items-center flex-shrink-0">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <BarChart3 size={20} className="text-purple-400" /> Session Evaluation
                </h2>
                <button onClick={() => setShowEvaluation(false)} className="p-1 text-gray-400 hover:text-white rounded"><X size={18} /></button>
              </div>

              <div className="flex-1 overflow-y-auto">
                {/* Loading */}
                {isEvaluating && (
                  <div className="flex flex-col items-center justify-center py-16">
                    <Loader2 size={36} className="animate-spin text-purple-400 mb-4" />
                    <p className="text-gray-300 font-medium">Evaluating your project…</p>
                    <p className="text-xs text-gray-500 mt-1">Reviewing 34 skills across 3 phases</p>
                  </div>
                )}

                {/* Error */}
                {evalError && !isEvaluating && (
                  <div className="m-6 p-4 bg-red-500/15 border border-red-500/30 rounded-xl text-red-300 flex gap-2">
                    <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />{evalError}
                  </div>
                )}

                {evaluation && !isEvaluating && (
                  <div className="p-6 space-y-6">

                    {/* Overall score + phase averages */}
                    <div className="grid grid-cols-4 gap-3">
                      {evaluation.overall_score_average !== undefined && (
                        <div className="col-span-1 flex flex-col items-center justify-center p-4 bg-gray-700/60 rounded-2xl border border-gray-600">
                          <Award size={22} className="text-amber-400 mb-1" />
                          <p className="text-[10px] text-gray-400 uppercase font-bold mb-0.5">Overall</p>
                          <p className={`text-2xl font-black ${scoreColor(evaluation.overall_score_average)}`}>
                            {Number(evaluation.overall_score_average).toFixed(1)}
                          </p>
                          <p className="text-[10px] text-gray-500">/ 3.0</p>
                        </div>
                      )}
                      {evaluation.phase_averages && Object.entries(evaluation.phase_averages).map(([k, v]) => {
                        const m = phaseMeta[k];
                        return (
                          <div key={k} className={`flex flex-col items-center justify-center p-3 rounded-xl border ${m.bg} ${m.border}`}>
                            <p className={`text-[9px] font-bold uppercase mb-0.5 ${m.color}`}>{m.label}</p>
                            <p className={`text-xl font-black ${scoreColor(Number(v))}`}>{Number(v).toFixed(1)}</p>
                            <p className="text-[9px] text-gray-500">/ 3.0</p>
                          </div>
                        );
                      })}
                    </div>

                    {/* Module averages bar chart */}
                    {evaluation.module_averages && (
                      <div className="p-4 bg-gray-700/30 rounded-xl border border-gray-700 space-y-2">
                        <p className="text-[10px] font-bold text-gray-400 uppercase mb-3">Module Scores</p>
                        {Object.entries(evaluation.module_averages).map(([k, v]) => {
                          const pct = (Number(v) / 3) * 100;
                          const col = Number(v) >= 2 ? 'bg-emerald-500' : Number(v) >= 1 ? 'bg-amber-500' : 'bg-red-500';
                          return (
                            <div key={k} className="flex items-center gap-3">
                              <p className="text-[10px] text-gray-400 w-36 flex-shrink-0">{moduleMeta[k] || k}</p>
                              <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full transition-all ${col}`} style={{ width: `${pct}%` }} />
                              </div>
                              <p className={`text-xs font-bold w-8 text-right ${scoreColor(Number(v))}`}>{Number(v).toFixed(1)}</p>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Strengths + Improvements + Certification */}
                    <div className="grid grid-cols-1 gap-3">
                      {evaluation.strengths_summary && (
                        <div className="p-4 bg-emerald-500/10 border border-emerald-500/25 rounded-xl">
                          <p className="text-[10px] font-bold text-emerald-400 uppercase mb-2">💪 Strengths</p>
                          <p className="text-xs text-gray-300 leading-relaxed">{evaluation.strengths_summary}</p>
                        </div>
                      )}
                      {evaluation.highest_leverage_improvements && (
                        <div className="p-4 bg-amber-500/10 border border-amber-500/25 rounded-xl">
                          <p className="text-[10px] font-bold text-amber-400 uppercase mb-2">🎯 Highest-Leverage Improvements</p>
                          <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-line">{evaluation.highest_leverage_improvements}</p>
                        </div>
                      )}
                      {evaluation.certification_readiness && (
                        <div className="p-4 bg-purple-500/10 border border-purple-500/25 rounded-xl">
                          <p className="text-[10px] font-bold text-purple-400 uppercase mb-2">🏆 Certification Readiness</p>
                          <p className="text-xs text-gray-300 leading-relaxed">{evaluation.certification_readiness}</p>
                        </div>
                      )}
                    </div>

                    {/* Detailed skill scores */}
                    {evaluation.detailed_scores && (
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-gray-400 uppercase mb-3">Skill-by-Skill Breakdown</p>
                        {Object.entries(evaluation.detailed_scores as Record<string, { score: number; justification: string }>).map(([skill, data]) => (
                          <details key={skill} className="group border border-gray-700 rounded-lg overflow-hidden">
                            <summary className="flex items-center gap-3 px-3 py-2 bg-gray-700/30 hover:bg-gray-700/50 cursor-pointer list-none">
                              <span className={`text-sm font-black w-5 text-right flex-shrink-0 ${scoreColor(data.score)}`}>{data.score}</span>
                              <span className="text-[11px] text-gray-300 flex-1">{skillLabel(skill)}</span>
                              <div className="w-16 h-1.5 bg-gray-700 rounded-full overflow-hidden flex-shrink-0">
                                <div className={`h-full rounded-full ${data.score >= 2 ? 'bg-emerald-500' : data.score >= 1 ? 'bg-amber-500' : 'bg-red-500'}`}
                                  style={{ width: `${(data.score / 3) * 100}%` }} />
                              </div>
                            </summary>
                            {data.justification && (
                              <div className="px-4 py-2.5 bg-gray-900/40 border-t border-gray-700">
                                <p className="text-xs text-gray-400 leading-relaxed">{data.justification}</p>
                              </div>
                            )}
                          </details>
                        ))}
                      </div>
                    )}

                    {/* Advice */}
                    {evalAdvice && (
                      <div className="p-4 bg-blue-500/10 border border-blue-500/25 rounded-xl">
                        <p className="text-[10px] font-bold text-blue-400 uppercase mb-3">📋 Coaching Advice</p>
                        <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-line">{evalAdvice}</p>
                      </div>
                    )}

                  </div>
                )}
              </div>
            </div>
          </div>
          );
        })()}

        {/* ── Top Toolbar ───────────────────────────────────────── */}
        <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center gap-2 flex-shrink-0">
              <Package size={18} className="text-emerald-400" />
              <span className="text-sm font-bold text-white">Website Builder</span>
            </div>
            <div className="w-px h-5 bg-gray-600 flex-shrink-0" />
            <input
              className="text-sm text-gray-300 bg-transparent border-b border-transparent hover:border-gray-600 focus:border-emerald-500 outline-none px-1 py-0.5 min-w-0 w-40"
              value={sessionName} onChange={e => setSessionName(e.target.value)} placeholder="Project name…"
            />
            <div className="w-px h-5 bg-gray-600 flex-shrink-0" />
            {/* Phase pills */}
            <div className="flex items-center gap-1 flex-shrink-0">
              {[1, 2, 3].map(p => {
                const meta = PHASE_META[p];
                const isActive = currentPhase === p;
                const isDone = currentPhase > p;
                return (
                  <span key={p} className={`px-2 py-0.5 rounded-full text-[10px] font-bold border transition-colors
                    ${isDone ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                    isActive ? `${meta.bg} ${meta.color} ${meta.border}` :
                    'text-gray-600 border-gray-700'}`}>
                    {isDone ? `✓ P${p}` : `P${p}`}
                  </span>
                );
              })}
              <span className="text-[10px] text-gray-500 ml-1">
                {taskIndex + 1}/{TASKS.length}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Voice mode toggle + mute */}
            <div className="flex items-center gap-1 flex-shrink-0">
              <div className="flex rounded-lg overflow-hidden border border-gray-600">
                <button
                  onClick={() => setVoiceMode('english')}
                  title="British English — Google UK English Female"
                  className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold transition-all border-r border-gray-600
                    ${voiceMode === 'english'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-800 text-gray-500 hover:bg-gray-700 hover:text-white'}`}
                >
                  🇬🇧 <span className="hidden lg:inline">English</span>
                </button>
                <button
                  onClick={() => setVoiceMode('pidgin')}
                  title="Nigerian English / Pidgin voice"
                  className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold transition-all
                    ${voiceMode === 'pidgin'
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-800 text-gray-500 hover:bg-gray-700 hover:text-white'}`}
                >
                  🇳🇬 <span className="hidden lg:inline">Pidgin</span>
                </button>
              </div>
              <button
                onClick={() => {
                  setVoiceOutputEnabled(prev => {
                    if (prev) cancelSpeech();
                    return !prev;
                  });
                }}
                title={voiceOutputEnabled ? 'Mute AI narration' : 'Enable AI narration'}
                className={`p-1.5 rounded-lg transition-colors border ${
                  voiceOutputEnabled
                    ? 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20'
                    : 'text-gray-600 border-gray-700 hover:text-gray-400'
                }`}>
                {voiceOutputEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
              </button>
            </div>
            <button onClick={() => setShowStackBlitzModal(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-blue-300 hover:text-white hover:bg-blue-600/30 rounded-lg transition-colors border border-blue-500/30">
              <ExternalLink size={12} /> Visualize Website
            </button>
            <button onClick={handleDownload} disabled={downloading}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition-colors">
              {downloading ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />} .zip
            </button>
            <button onClick={() => { loadSessions(); setShowSessionPicker(true); }}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors">
              <FolderOpen size={15} />
            </button>
            {/* Last saved indicator */}
            {lastSaved && !isSaving && (
              <span className="text-[10px] text-gray-600 hidden sm:block">
                Saved {lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            {saveError && (
              <span className="text-[10px] text-red-500 hidden sm:block" title={saveError}>Save failed</span>
            )}
            {/* Save Project — uploads ZIP to Storage + full evaluation */}
            <button onClick={handleSaveProject} disabled={isSaving || !taskHasGeneration}
              title="Save project to cloud & evaluate"
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-lg transition-colors disabled:opacity-40">
              {isSaving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
              {isSaving ? 'Saving…' : 'Save'}
            </button>
            <button onClick={handleEvaluate} disabled={isEvaluating}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-lg transition-colors shadow disabled:opacity-50">
              {isEvaluating ? <Loader2 size={12} className="animate-spin" /> : <BarChart3 size={12} />} Evaluate
            </button>
          </div>
        </div>

        {/* ── Main Content ──────────────────────────────────────── */}
        <div className="flex-1 flex overflow-hidden">

          {/* ═══ LEFT: Task + Prompt Panel ═══ */}
          <div className="w-80 flex-shrink-0 flex flex-col bg-[#1a1d23] border-r border-gray-700 overflow-hidden">

            {currentTask?.isOnboarding ? (
              /* Onboarding fills the whole panel */
              <div className="flex-1 overflow-y-auto">
                <ReactViteOnboarding onComplete={handleOnboardingComplete} />
              </div>
            ) : (
              <>
                {/* ── Fixed header: phase + task only ── */}
                <div className={`flex-shrink-0 flex items-center gap-2.5 px-4 py-3 border-b ${pm.border} ${pm.bg}`}>
                  <span className="text-lg">{currentTask?.icon}</span>
                  <div className="min-w-0">
                    <p className={`text-[9px] font-bold uppercase tracking-wider ${pm.color}`}>{pm.label}</p>
                    <p className="text-sm font-bold text-white truncate">{currentTask?.label}</p>
                  </div>
                  {/* Sub-task progress dots */}
                  {taskInstruction?.subTasks && taskInstruction.subTasks.length > 1 && (
                    <div className="flex gap-1 ml-auto flex-shrink-0">
                      {taskInstruction.subTasks.map((_, i) => (
                        <span key={i} className={`w-1.5 h-1.5 rounded-full transition-colors ${
                          i < subTaskIndex ? 'bg-emerald-400' :
                          i === subTaskIndex ? pm.color.replace('text-', 'bg-') :
                          'bg-gray-700'}`} />
                      ))}
                    </div>
                  )}
                </div>

                {/* ── Scrollable middle: instruction + textarea together ── */}
                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">

                  {/* Instruction card */}
                  {loadingInstruction ? (
                    <div className="flex items-center gap-2 py-2">
                      <Loader2 size={14} className="animate-spin text-purple-400" />
                      <span className="text-xs text-gray-400">Preparing your instruction…</span>
                    </div>
                  ) : taskInstruction ? (
                    <div className="rounded-xl border border-gray-700 overflow-hidden">
                      {/* Teaching commentary */}
                      {taskInstruction.subTaskTeaching?.[subTaskIndex] && (
                        <div className="px-3 pt-2.5 pb-2 bg-gray-800/80 border-b border-gray-700">
                          <p className={`text-[9px] font-bold uppercase tracking-wide mb-1 ${pm.color}`}>
                            Why this matters — Step {subTaskIndex + 1} of {taskInstruction.subTasks.length}
                          </p>
                          <p className="text-xs text-gray-300 leading-relaxed italic">
                            {taskInstruction.subTaskTeaching[subTaskIndex]}
                          </p>
                        </div>
                      )}
                      {/* The question */}
                      <div className={`px-3 py-2.5 ${pm.bg}`}>
                        {!taskInstruction.subTaskTeaching?.[subTaskIndex] && (
                          <p className={`text-[9px] font-bold uppercase tracking-wide mb-1 ${pm.color}`}>
                            Step {subTaskIndex + 1} of {taskInstruction.subTasks.length}
                          </p>
                        )}
                        <p className="text-sm text-white leading-relaxed font-medium">
                          {taskInstruction.subTasks[subTaskIndex]}
                        </p>
                        {subTaskIndex === 0 && taskInstruction.examplePrompt && (
                          <button
                            onClick={() => { setPrompt(taskInstruction!.examplePrompt); promptRef.current?.focus(); }}
                            className={`mt-2 text-[10px] font-bold ${pm.color} hover:opacity-70 transition-opacity`}>
                            See example →
                          </button>
                        )}
                      </div>
                    </div>
                  ) : null}

                  {/* AI code explanation */}
                  {aiExplanation && (
                    <div className="p-2.5 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                      <p className="text-[9px] font-bold text-blue-400 uppercase mb-1">What was built</p>
                      <p className="text-xs text-gray-300 leading-relaxed">{aiExplanation}</p>
                    </div>
                  )}

                  {/* Response critique */}
                  {isCritiquingResponse && (
                    <div className="flex items-center gap-2 py-1">
                      <Loader2 size={12} className="animate-spin text-purple-400 flex-shrink-0" />
                      <span className="text-xs text-gray-400">Reviewing your response…</span>
                    </div>
                  )}
                  {subTaskCritique && (
                    <div className={`rounded-xl border overflow-hidden ${
                      subTaskCritique.hasSuggestions
                        ? 'border-amber-500/30 bg-amber-500/5'
                        : 'border-emerald-500/30 bg-emerald-500/5'
                    }`}>
                      <div className="px-3 pt-2.5 pb-1 border-b border-inherit">
                        <p className={`text-[9px] font-bold uppercase tracking-wide ${
                          subTaskCritique.hasSuggestions ? 'text-amber-400' : 'text-emerald-400'
                        }`}>
                          {subTaskCritique.hasSuggestions ? '💡 Feedback on your response' : '✅ Step complete'}
                        </p>
                      </div>
                      <p className="px-3 py-2.5 text-xs text-gray-200 leading-relaxed">
                        {subTaskCritique.feedback}
                      </p>
                      {subTaskCritique.hasSuggestions && (
                        <div className="px-3 pb-2.5 text-[10px] text-gray-500 italic">
                          Refine your response above, or move on when ready.
                        </div>
                      )}
                    </div>
                  )}

                  {/* Error */}
                  {errorMsg && (
                    <div className="p-2.5 bg-red-500/10 border border-red-500/20 rounded-lg flex gap-2">
                      <AlertCircle size={12} className="flex-shrink-0 text-red-400 mt-0.5" />
                      <p className="text-xs text-red-300">{errorMsg}</p>
                    </div>
                  )}

                  {/* Response textarea — min-height ensures it's always usable */}
                  <div>
                    {/* Screenshot attach row */}
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <button
                        onClick={() => screenshotInputRef.current?.click()}
                        title="Attach a screenshot to describe the problem"
                        className={`flex items-center gap-1.5 px-2 py-1 text-[10px] font-medium rounded-lg border transition-colors ${
                          screenshotFile
                            ? 'text-purple-300 border-purple-500/50 bg-purple-500/10'
                            : 'text-gray-500 border-gray-700 hover:text-gray-300 hover:border-gray-500'
                        }`}>
                        <ImageIcon size={11} />
                        {screenshotFile ? screenshotFile.name : 'Attach screenshot'}
                      </button>
                      {screenshotFile && (
                        <button onClick={() => setScreenshotFile(null)}
                          className="text-gray-600 hover:text-gray-400 transition-colors" title="Remove screenshot">
                          <X size={11} />
                        </button>
                      )}
                      {/* Site Feedback button */}
                      <button
                        onClick={openFeedbackModal}
                        title="Give feedback on your website to improve it"
                        className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-medium rounded-lg border border-blue-500/40 text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 transition-colors">
                        <MessageSquarePlus size={11} />
                        Site Feedback
                      </button>
                    </div>
                    <input ref={screenshotInputRef} type="file" accept="image/*" className="hidden"
                      onChange={handleScreenshotSelect} />

                    <textarea
                      ref={promptRef}
                      value={prompt}
                      onChange={e => setPrompt(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleGenerate(); }}
                      placeholder={
                        taskInstruction?.subTasks[subTaskIndex]
                          ? taskInstruction.subTasks[subTaskIndex].replace(/^[^:]+:\s*/, '').substring(0, 80) + '…'
                          : 'Describe what you want to build in plain English…'
                      }
                      style={{ minHeight: '160px' }}
                      className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 resize-y outline-none focus:border-purple-500 transition-colors leading-relaxed"
                    />
                    <p className="text-[9px] text-gray-700 mt-1">Ctrl+Enter to submit</p>
                  </div>

                </div>

                {/* ── Fixed bottom: action buttons + navigation ── */}
                <div className="flex-shrink-0 px-4 pb-4 space-y-2">
                  <div className="flex gap-2">
                    <button onClick={handleGenerate} disabled={isGenerating || !prompt.trim()}
                      title="Submit"
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors disabled:opacity-40">
                      {isGenerating ? <Loader2 size={15} className="animate-spin" /> : <ArrowUpCircle size={18} />}
                      {isGenerating && <span className="text-sm">Working…</span>}
                    </button>
                    <button onClick={handleCritique} disabled={isCritiquing || !prompt.trim()}
                      title="Critique my prompt"
                      className="flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-xl transition-colors disabled:opacity-40">
                      {isCritiquing ? <Loader2 size={14} className="animate-spin" /> : <Lightbulb size={14} />}
                    </button>
                  </div>

                  {/* Move to next step — visible when critique has suggestions and more sub-tasks remain */}
                  {subTaskCritique?.hasSuggestions &&
                   subTaskIndex < (taskInstruction?.subTasks?.length ?? 1) - 1 && (
                    <button onClick={handleMoveToNextStep}
                      className="w-full flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-xl border border-gray-600 text-gray-300 hover:border-gray-400 hover:text-white transition-all">
                      <SkipForward size={13} />
                      Move to next step
                    </button>
                  )}

                  {/* Complete Task — visible when all sub-tasks done */}
                  {taskIndex < TASKS.length - 1 && taskHasGeneration &&
                   (subTaskIndex >= (taskInstruction?.subTasks?.length ?? 1) - 1) &&
                   (!subTaskCritique || !subTaskCritique.hasSuggestions) && (
                    <button onClick={handleCompleteTask}
                      className={`w-full flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-xl border transition-all ${pm.bg} ${pm.color} ${pm.border} hover:opacity-90`}>
                      <CheckCircle size={13} />
                      Complete Task & Continue
                      <ArrowRight size={13} />
                    </button>
                  )}

                  {/* Complete Task with suggestions — always allow if student insists */}
                  {taskIndex < TASKS.length - 1 && taskHasGeneration &&
                   subTaskIndex >= (taskInstruction?.subTasks?.length ?? 1) - 1 &&
                   subTaskCritique?.hasSuggestions && (
                    <button onClick={handleCompleteTask}
                      className="w-full flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-xl border border-gray-700 text-gray-500 hover:border-gray-500 hover:text-gray-300 transition-all">
                      <CheckCircle size={13} />
                      Complete anyway & continue
                      <ArrowRight size={13} />
                    </button>
                  )}
                </div>
              </>
            )}
          </div>

          {/* ═══ RIGHT: File Tree + Editor ═══ */}
          <div className="flex-1 flex overflow-hidden">

            {/* File tree (narrow sidebar) */}
            <div className="w-44 flex-shrink-0 border-r border-gray-700 flex flex-col" style={{ background: '#161820' }}>
              <div className="flex items-center justify-between px-3 pt-2 pb-1 flex-shrink-0">
                <p className="text-[9px] font-bold text-gray-700 uppercase tracking-wide">Files</p>
                <button
                  onClick={() => assetInputRef.current?.click()}
                  disabled={isUploadingAsset}
                  title="Upload image asset to public folder"
                  className="flex items-center gap-1 px-1.5 py-0.5 text-[9px] text-gray-500 hover:text-emerald-400 border border-gray-700 hover:border-emerald-500/40 rounded-md transition-colors disabled:opacity-40">
                  {isUploadingAsset
                    ? <Loader2 size={9} className="animate-spin" />
                    : <ImagePlus size={9} />}
                  {isUploadingAsset ? 'Uploading…' : 'Add image'}
                </button>
                <input ref={assetInputRef} type="file" accept="image/*" className="hidden"
                  onChange={handleAssetUpload} />
              </div>
              <div className="flex-1 overflow-y-auto pb-2">
                <FileTreePanel files={projectFiles} activeFile={activeFilePath} onSelect={setActiveFilePath} />
              </div>
            </div>

            {/* Monaco editor */}
            <div className="flex-1 flex flex-col min-w-0">
              {/* Tab bar */}
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-800/80 border-b border-gray-700 flex-shrink-0">
                <FileCode size={12} className="text-emerald-400 flex-shrink-0" />
                <span className="text-xs text-gray-300 font-medium flex-1 truncate">{activeFilePath}</span>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-[10px] text-gray-600">{activeFile?.content.split('\n').length}L</span>
                  <button onClick={handleCopy}
                    className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors">
                    {copied ? <Check size={11} /> : <Copy size={11} />}{copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>

              <div className="flex-1">
                <Editor
                  height="100%"
                  language={getLanguage(activeFilePath)}
                  value={activeFile?.content || ''}
                  onChange={handleEditorChange}
                  theme="vs-dark"
                  options={{
                    fontSize: 13, minimap: { enabled: false }, padding: { top: 12 },
                    lineNumbers: 'on', wordWrap: 'on', scrollBeyondLastLine: false,
                    automaticLayout: true, tabSize: 2,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default WebDevelopmentPage;