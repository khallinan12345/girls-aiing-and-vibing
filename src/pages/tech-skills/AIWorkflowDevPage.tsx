// src/pages/tech-skills/AIWorkflowDevPage.tsx
//
// AI Workflow Development Workshop
// Builds on WebDevelopmentPage patterns — same Monaco editor / coach / task flow.
// Key additions:
//   • API credentials panel (Anthropic key, stored in localStorage)
//   • "Test Workflow" right tab — students run live AI calls inside the platform
//   • Starter files include a pre-wired AI client (calls through proxy or direct)
//   • Curriculum focused on building apps that contain AI agents and chained calls
//
// API routes needed:
//   /api/generate-workflow-code
//   /api/workflow-task-instruction
//   /api/evaluate-workflow-session

import React, { useState, useRef, useCallback, useEffect } from 'react';
import Navbar from '../../components/layout/Navbar';
import { supabase } from '../../lib/supabaseClient';
import Editor from '@monaco-editor/react';
import { useVoice } from '../../hooks/useVoice';
import { VoiceFallback } from '../../components/VoiceFallback';
import {
  Cpu, Sparkles, Loader2, Save, FolderOpen, Download,
  CheckCircle, ArrowRight, ArrowUpCircle, SkipForward,
  Lightbulb, BarChart3, Award, X, Copy, Check,
  Volume2, VolumeX, AlertCircle, Star, ChevronDown, ChevronUp,
  Trash2, Plus, FileCode, Package, Play, Key, ExternalLink,
  Zap, GitBranch, RefreshCw, Eye, Terminal, Wand2,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProjectFile { path: string; content: string; }

interface TaskDef {
  id: string; label: string; phase: 1 | 2 | 3; icon: string; isOnboarding?: boolean;
}

interface TaskInstruction {
  headline: string; context: string;
  subTasks: string[]; subTaskTeaching: string[]; examplePrompt: string;
}

interface PromptEntry {
  id: string; taskId: string; subTaskIndex: number;
  subTaskQuestion?: string; subTaskTeaching?: string;
  prompt: string; aiExplanation?: string; aiCritique?: string;
  hasSuggestions?: boolean; studentRefined?: boolean;
  timestamp: string; action: 'generate' | 'iterate' | 'critique' | 'feedback';
  filesModified?: string[];
}

interface SessionRecord {
  id: number; workflow_session_id: string; workflow_session_name: string;
  workflow_pages: any[]; workflow_prompts: any[]; workflow_evaluation: any | null;
  updated_at?: string;
}

interface ApiCredentials { anthropicKey: string; useProxy: boolean; }

type RightTab = 'code' | 'test';

// ─── Constants ────────────────────────────────────────────────────────────────

const makeId = () => Math.random().toString(36).substring(2, 9);
const WORKFLOW_ACTIVITY = 'ai_workflow_development';
const LS_CREDS_KEY = 'workflow_dev_api_creds';

const TASKS: TaskDef[] = [
  { id: 'intro_workflow',    label: 'What is an AI Workflow?',    phase: 1, icon: '⚡', isOnboarding: true },
  { id: 'choose_idea',       label: 'Choose Your Workflow Idea',  phase: 1, icon: '💡' },
  { id: 'map_steps',         label: 'Map Your Workflow Steps',    phase: 1, icon: '🗺️' },
  { id: 'plan_io',           label: 'Plan Inputs & Outputs',      phase: 1, icon: '📐' },
  { id: 'setup_ai_client',   label: 'Set Up the AI Client',       phase: 2, icon: '🔑' },
  { id: 'first_ai_call',     label: 'Make Your First AI Call',    phase: 2, icon: '📡' },
  { id: 'display_response',  label: 'Display the AI Response',    phase: 2, icon: '📺' },
  { id: 'chain_calls',       label: 'Chain Multiple AI Calls',    phase: 2, icon: '🔗' },
  { id: 'build_ui',          label: 'Build the User Interface',   phase: 2, icon: '🖼️' },
  { id: 'prompts_polish',    label: 'Polish Your Prompts',        phase: 3, icon: '✨' },
  { id: 'error_handling',    label: 'Error Handling & Loading',   phase: 3, icon: '🛡️' },
  { id: 'deploy_prep',       label: 'Deploy & Share',             phase: 3, icon: '🚀' },
];

const PHASE_META: Record<number, { label: string; color: string; bg: string; border: string }> = {
  1: { label: 'Phase 1: Plan',   color: 'text-blue-400',    bg: 'bg-blue-500/15',    border: 'border-blue-500/30'   },
  2: { label: 'Phase 2: Build',  color: 'text-violet-400',  bg: 'bg-violet-500/15',  border: 'border-violet-500/30' },
  3: { label: 'Phase 3: Polish', color: 'text-amber-400',   bg: 'bg-amber-500/15',   border: 'border-amber-500/30'  },
};

const STARTER_FILES: ProjectFile[] = [
  {
    path: 'package.json',
    content: JSON.stringify({
      name: 'my-ai-workflow', private: true, version: '0.0.0', type: 'module',
      scripts: { dev: 'vite', build: 'vite build', preview: 'vite preview' },
      dependencies: {
        'react': '^18.2.0', 'react-dom': '^18.2.0', 'react-router-dom': '^6.21.0',
      },
      devDependencies: { '@vitejs/plugin-react': '^4.2.1', 'vite': '^5.0.8' },
    }, null, 2),
  },
  {
    path: 'vite.config.js',
    content: `import { defineConfig } from 'vite'\nimport react from '@vitejs/plugin-react'\n\nexport default defineConfig({\n  plugins: [react()],\n  // Proxy AI calls to your backend — avoids exposing API keys in browser code\n  server: {\n    proxy: {\n      '/api/ai': {\n        target: 'http://localhost:3001',\n        changeOrigin: true,\n      }\n    }\n  }\n})\n`,
  },
  {
    path: 'index.html',
    content: `<!DOCTYPE html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>My AI Workflow App</title>\n  </head>\n  <body>\n    <div id="root"></div>\n    <script type="module" src="/src/main.jsx"></script>\n  </body>\n</html>\n`,
  },
  {
    path: 'src/main.jsx',
    content: `import React from 'react'\nimport ReactDOM from 'react-dom/client'\nimport App from './App.jsx'\nimport './index.css'\n\nReactDOM.createRoot(document.getElementById('root')).render(\n  <React.StrictMode>\n    <App />\n  </React.StrictMode>,\n)\n`,
  },
  {
    path: 'src/lib/aiClient.js',
    content: `// ── AI Client ──────────────────────────────────────────────────────────────
// This file handles all communication with the AI API.
// Your API key lives ONLY in this file (or a .env variable) — never paste
// it directly into your components.

const AI_API_URL = 'https://api.anthropic.com/v1/messages';

// Replace this with import.meta.env.VITE_ANTHROPIC_API_KEY in production
// so the key is loaded from a .env file and never committed to git.
const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY || '';

/**
 * Send a single prompt to Claude and get a text response.
 * @param {string} userPrompt  - What the user (or your workflow) is asking
 * @param {string} systemPrompt - Instructions that shape how Claude behaves
 * @param {number} maxTokens   - Maximum length of the response
 */
export async function callAI(userPrompt, systemPrompt = 'You are a helpful assistant.', maxTokens = 500) {
  const response = await fetch(AI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
      // IMPORTANT: In a real app, never call the Anthropic API directly from
      // the browser — put it behind a server endpoint so the key stays secret.
      // For learning purposes, this pattern is fine.
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',  // Fast and cheap — good for workflows
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error?.error?.message || \`API error: \${response.status}\`);
  }

  const data = await response.json();
  return data.content[0].text;
}

/**
 * Chain multiple AI calls where each output feeds the next input.
 * @param {Array<{prompt: string, system?: string}>} steps
 */
export async function chainAICalls(steps) {
  let previousOutput = '';
  const results = [];

  for (const step of steps) {
    const fullPrompt = previousOutput
      ? \`Previous step output: \${previousOutput}\\n\\n\${step.prompt}\`
      : step.prompt;

    const output = await callAI(fullPrompt, step.system);
    results.push(output);
    previousOutput = output;
  }

  return results;
}
`,
  },
  {
    path: 'src/App.jsx',
    content: `import React, { useState } from 'react'
import { callAI } from './lib/aiClient.js'
import './index.css'

function App() {
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleRun = async () => {
    if (!input.trim()) return
    setLoading(true)
    setError(null)
    try {
      const result = await callAI(input)
      setOutput(result)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app">
      <h1>My AI Workflow</h1>
      <p>Use the prompt panel to start building your workflow!</p>

      {/* Basic test UI — you will replace this with your real workflow */}
      <div className="test-box">
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Type something for the AI to respond to…"
          rows={4}
        />
        <button onClick={handleRun} disabled={loading}>
          {loading ? 'Thinking…' : 'Run AI'}
        </button>
        {error && <p className="error">{error}</p>}
        {output && <div className="output"><strong>AI Response:</strong><p>{output}</p></div>}
      </div>
    </div>
  )
}

export default App
`,
  },
  {
    path: 'src/index.css',
    content: `* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Segoe UI', sans-serif; background: #f8fafc; color: #1e293b; }
.app { max-width: 800px; margin: 0 auto; padding: 2rem; }
h1 { font-size: 1.75rem; font-weight: bold; margin-bottom: 0.5rem; color: #1e293b; }
.test-box { margin-top: 2rem; display: flex; flex-direction: column; gap: 0.75rem; }
textarea { width: 100%; padding: 0.75rem; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 0.95rem; resize: vertical; font-family: inherit; }
button { padding: 0.6rem 1.5rem; background: #6d28d9; color: white; border: none; border-radius: 8px; font-size: 0.95rem; font-weight: 600; cursor: pointer; align-self: flex-start; }
button:disabled { opacity: 0.5; cursor: not-allowed; }
.output { background: #f1f5f9; padding: 1rem; border-radius: 8px; border-left: 3px solid #6d28d9; }
.output p { margin-top: 0.5rem; line-height: 1.6; white-space: pre-wrap; }
.error { color: #ef4444; font-size: 0.875rem; }
`,
  },
  {
    path: '.env.example',
    content: `# Copy this to .env (never commit .env to git)
# Get your API key from: https://console.anthropic.com/

VITE_ANTHROPIC_API_KEY=sk-ant-your-key-here
`,
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getLanguage = (path: string) => {
  if (path.endsWith('.jsx') || path.endsWith('.js')) return 'javascript';
  if (path.endsWith('.tsx') || path.endsWith('.ts')) return 'typescript';
  if (path.endsWith('.css')) return 'css';
  if (path.endsWith('.html')) return 'html';
  if (path.endsWith('.json')) return 'json';
  if (path.endsWith('.md') || path.endsWith('.example')) return 'markdown';
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

// ─── API helpers ──────────────────────────────────────────────────────────────

async function callGenerateAPI(body: Record<string, unknown>) {
  const res = await fetch('/api/generate-workflow-code', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'claude-sonnet-4-6', ...body }),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || `HTTP ${res.status}`); }
  return res.json();
}

async function callInstructionAPI(body: Record<string, unknown>) {
  const res = await fetch('/api/workflow-task-instruction', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'claude-sonnet-4-6', ...body }),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || `HTTP ${res.status}`); }
  return res.json();
}

async function callEvaluateAPI(promptHistory: PromptEntry[], projectFiles: ProjectFile[]) {
  const res = await fetch('/api/evaluate-workflow-session', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      promptHistory: promptHistory.map(e => ({ action: e.action, prompt: e.prompt })),
      pages: projectFiles.filter(f => f.content.length > 30).map(f => ({ name: f.path, code: f.content })),
    }),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || `HTTP ${res.status}`); }
  return res.json();
}

// ─── Score badge ──────────────────────────────────────────────────────────────

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

// ─── Onboarding ───────────────────────────────────────────────────────────────

const WorkflowOnboarding: React.FC<{ onComplete: () => void }> = ({ onComplete }) => (
  <div className="flex-1 overflow-y-auto p-4 space-y-4">
    <div className="p-4 bg-violet-500/10 border border-violet-500/25 rounded-xl">
      <p className="text-xs font-bold text-violet-400 uppercase mb-3">⚡ Welcome to AI Workflow Development</p>
      <p className="text-sm text-gray-300 leading-relaxed mb-3">
        You're going to build a <strong className="text-white">real app that uses AI as a working part of it</strong> — not just a chatbot, but a workflow where AI automatically does jobs: summarising, translating, classifying, generating, extracting, or deciding.
      </p>
      <p className="text-sm text-gray-300 leading-relaxed">
        Companies everywhere are paying for people who can do this. Every business tool, app, and website in the world is being rebuilt right now to include AI. You are learning the skill that makes that happen.
      </p>
    </div>

    <div className="p-3 bg-gray-800/40 rounded-lg border border-gray-700">
      <p className="text-xs font-bold text-gray-300 mb-2">🤔 What is an AI Workflow?</p>
      <div className="space-y-2">
        {[
          { icon: '📄', ex: 'A user pastes a document → AI summarises it → user sees a 3-bullet summary' },
          { icon: '🌍', ex: 'A user types in Yoruba → AI translates it → AI improves the English → output shown' },
          { icon: '📸', ex: 'A user describes a problem → AI generates 3 solutions → AI scores each one' },
          { icon: '📋', ex: 'A user submits a form → AI checks it → AI writes a personalised response' },
        ].map((item, i) => (
          <div key={i} className="flex items-start gap-2 text-xs text-gray-400">
            <span className="text-base flex-shrink-0">{item.icon}</span>
            <span>{item.ex}</span>
          </div>
        ))}
      </div>
    </div>

    <div className="bg-gray-900 rounded-lg p-3 font-mono text-xs leading-relaxed space-y-1">
      <div className="text-violet-300 font-bold mb-1">⚡ A workflow in code:</div>
      <div className="text-gray-400">1. <span className="text-cyan-300">User</span> types a description of a business problem</div>
      <div className="text-gray-400 ml-4">↓</div>
      <div className="text-gray-400">2. <span className="text-violet-300">callAI()</span> sends it to Claude with a system prompt</div>
      <div className="text-gray-400 ml-4">↓</div>
      <div className="text-gray-400">3. Claude returns a structured analysis</div>
      <div className="text-gray-400 ml-4">↓</div>
      <div className="text-gray-400">4. <span className="text-violet-300">chainAICalls()</span> sends that to a second AI step</div>
      <div className="text-gray-400 ml-4">↓</div>
      <div className="text-gray-400">5. <span className="text-cyan-300">React</span> displays the final result beautifully</div>
    </div>

    <div className="p-3 bg-gray-800/40 rounded-lg border border-gray-700">
      <p className="text-xs font-bold text-gray-300 mb-1.5">🔑 About the API Key</p>
      <p className="text-xs text-gray-400 leading-relaxed">
        To call Claude from your code, you need an API key from{' '}
        <a href="https://console.anthropic.com" target="_blank" rel="noopener noreferrer" className="text-violet-400 underline">console.anthropic.com</a>.
        Your instructor may provide one, or you can create a free account. You'll enter it in the
        <strong className="text-white"> Credentials panel</strong> during the next task.
        The key stays in your browser — it is never sent to this platform.
      </p>
    </div>

    <div className="grid grid-cols-2 gap-2">
      {[
        { icon: <GitBranch size={14}/>, title: 'Chain AI calls', desc: 'Output of one becomes input of next', col: 'text-violet-400' },
        { icon: <Zap size={14}/>,       title: 'Automate tasks', desc: 'AI does the work, humans review it',  col: 'text-amber-400'  },
        { icon: <Cpu size={14}/>,       title: 'System prompts', desc: 'Shape how AI thinks and responds',    col: 'text-cyan-400'   },
        { icon: <Play size={14}/>,      title: 'Test live',      desc: 'Run your workflow right in this page', col: 'text-emerald-400'},
      ].map((item, i) => (
        <div key={i} className="p-3 bg-gray-800/60 rounded-lg border border-gray-700">
          <div className={`flex items-center gap-1.5 mb-1 ${item.col}`}>{item.icon}<span className="text-xs font-bold">{item.title}</span></div>
          <p className="text-[11px] text-gray-400">{item.desc}</p>
        </div>
      ))}
    </div>

    <button onClick={onComplete}
      className="w-full flex items-center justify-center gap-2 py-3 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-xl transition-colors">
      Let's build an AI workflow! <ArrowRight size={16} />
    </button>
  </div>
);

// ─── Task stepper ─────────────────────────────────────────────────────────────

const TaskStepper: React.FC<{ tasks: TaskDef[]; taskIndex: number; onJump: (i: number) => void }> = ({ tasks, taskIndex, onJump }) => (
  <div className="px-3 py-3 border-b border-gray-700 space-y-2">
    {([1, 2, 3] as const).map(phase => {
      const pm = PHASE_META[phase];
      const phaseTasks = tasks.filter(t => t.phase === phase);
      const firstIdx = tasks.findIndex(t => t.phase === phase);
      return (
        <div key={phase}>
          <p className={`text-[9px] font-bold uppercase tracking-wider mb-1 ${pm.color}`}>{pm.label}</p>
          <div className="space-y-0.5">
            {phaseTasks.map((task, i) => {
              const gi = firstIdx + i;
              const isDone = gi < taskIndex; const isCur = gi === taskIndex; const isFut = gi > taskIndex;
              return (
                <button key={task.id} onClick={() => isDone && onJump(gi)} disabled={isFut}
                  className={`w-full text-left flex items-center gap-2 px-2 py-1 rounded-lg text-xs transition-colors
                    ${isCur ? `${pm.bg} ${pm.border} border font-bold ${pm.color}` : ''}
                    ${isDone ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50 cursor-pointer' : ''}
                    ${isFut ? 'text-gray-600 cursor-default' : ''}`}>
                  <span className="flex-shrink-0 text-sm">{isDone ? '✅' : isCur ? task.icon : '⬜'}</span>
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

// ─── File tree ────────────────────────────────────────────────────────────────

const FileTreePanel: React.FC<{ files: ProjectFile[]; activeFile: string; onSelect: (p: string) => void }> = ({ files, activeFile, onSelect }) => {
  const [open, setOpen] = useState<Set<string>>(new Set(['src', 'src/lib', 'src/components', 'src/pages']));
  const toggle = (f: string) => setOpen(prev => { const n = new Set(prev); n.has(f) ? n.delete(f) : n.add(f); return n; });

  type TNode = { name: string; path: string; isFolder: boolean; children: TNode[] };
  const buildTree = (files: ProjectFile[]): TNode[] => {
    const root: TNode[] = [];
    for (const file of files) {
      const parts = file.path.split('/'); let cur = root;
      for (let i = 0; i < parts.length; i++) {
        const name = parts[i]; const isLast = i === parts.length - 1;
        let node = cur.find(n => n.name === name);
        if (!node) { node = { name, path: parts.slice(0, i + 1).join('/'), isFolder: !isLast, children: [] }; cur.push(node); }
        if (!isLast) cur = node.children;
      }
    }
    const sort = (nodes: TNode[]) => { nodes.sort((a, b) => (a.isFolder && !b.isFolder ? -1 : !a.isFolder && b.isFolder ? 1 : a.name.localeCompare(b.name))); nodes.forEach(n => sort(n.children)); };
    sort(root); return root;
  };
  const renderTree = (nodes: TNode[], depth = 0): React.ReactNode =>
    nodes.map(node => (
      <React.Fragment key={node.path}>
        {node.isFolder ? (
          <button onClick={() => toggle(node.path)}
            className="w-full flex items-center gap-1 py-0.5 text-xs text-gray-400 hover:text-gray-200 hover:bg-gray-700/40 rounded"
            style={{ paddingLeft: `${8 + depth * 10}px` }}>
            {open.has(node.path) ? <ChevronDown size={10} /> : <ChevronDown size={10} style={{ transform: 'rotate(-90deg)' }} />}
            <span className="text-amber-400 text-[10px]">📁</span>
            <span className="font-medium text-[11px]">{node.name}</span>
          </button>
        ) : (
          <button onClick={() => onSelect(node.path)}
            className={`w-full flex items-center gap-1.5 py-0.5 text-[11px] rounded transition-colors
              ${activeFile === node.path ? 'bg-violet-500/20 text-violet-300 font-semibold' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/40'}`}
            style={{ paddingLeft: `${8 + depth * 10}px` }}>
            <FileCode size={10} className="flex-shrink-0" />
            <span className="truncate">{node.name}</span>
          </button>
        )}
        {node.isFolder && open.has(node.path) && renderTree(node.children, depth + 1)}
      </React.Fragment>
    ));
  return <div className="space-y-0">{renderTree(buildTree(files))}</div>;
};

// ─── API Credentials panel ────────────────────────────────────────────────────

const ApiCredentialsPanel: React.FC<{
  creds: ApiCredentials; onChange: (c: ApiCredentials) => void;
  testStatus: 'idle' | 'testing' | 'ok' | 'fail'; testMsg: string; onTest: () => void;
}> = ({ creds, onChange, testStatus, testMsg, onTest }) => {
  const [show, setShow] = useState(false);
  return (
    <div className="p-3 bg-gray-800/60 border border-violet-500/20 rounded-xl space-y-3">
      <p className="text-xs font-bold text-violet-400 flex items-center gap-1.5"><Key size={12} /> API Key</p>
      <div>
        <label className="text-[10px] text-gray-500 uppercase font-bold block mb-1">Anthropic API Key</label>
        <div className="relative">
          <input
            type={show ? 'text' : 'password'} value={creds.anthropicKey}
            onChange={e => onChange({ ...creds, anthropicKey: e.target.value })}
            placeholder="sk-ant-…"
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-2.5 py-1.5 pr-8 text-xs text-white placeholder-gray-600 outline-none focus:border-violet-500 font-mono"
          />
          <button onClick={() => setShow(s => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-300 text-[10px]">
            {show ? '🙈' : '👁️'}
          </button>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={onTest} disabled={!creds.anthropicKey || testStatus === 'testing'}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-colors disabled:opacity-40">
          {testStatus === 'testing' ? <Loader2 size={11} className="animate-spin" /> : <Play size={11} />}
          Test Key
        </button>
        {testStatus === 'ok'   && <span className="text-xs text-emerald-400 flex items-center gap-1"><CheckCircle size={11} /> {testMsg}</span>}
        {testStatus === 'fail' && <span className="text-xs text-red-400 flex items-center gap-1"><AlertCircle size={11} /> {testMsg}</span>}
      </div>
      <p className="text-[9px] text-gray-600">
        Get a free key at console.anthropic.com · Stored in your browser only · Never sent to this platform.
      </p>
    </div>
  );
};

// ─── Test Workflow panel ──────────────────────────────────────────────────────

const TestWorkflowPanel: React.FC<{ apiKey: string; projectFiles: ProjectFile[] }> = ({ apiKey, projectFiles }) => {
  const [userPrompt,   setUserPrompt]   = useState('');
  const [systemPrompt, setSystemPrompt] = useState('You are a helpful assistant.');
  const [model,        setModel]        = useState('claude-sonnet-4-6');
  const [maxTokens,    setMaxTokens]    = useState(300);
  const [response,     setResponse]     = useState('');
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleTest = async () => {
    if (!userPrompt.trim()) return;
    if (!apiKey) { setError('Enter your Anthropic API key in the Credentials panel first'); return; }
    setLoading(true); setError(''); setResponse('');
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model, max_tokens: maxTokens,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.error?.message || `API error ${res.status}`);
      }
      const data = await res.json();
      setResponse(data.content?.[0]?.text ?? '(empty response)');
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700 bg-gray-800/50 flex-shrink-0">
        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
          <Terminal size={11} /> Live AI Test Runner
        </span>
        <button onClick={() => setShowAdvanced(a => !a)} className="text-[10px] text-gray-500 hover:text-gray-300 flex items-center gap-1">
          {showAdvanced ? <ChevronUp size={10} /> : <ChevronDown size={10} />} Advanced
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* System prompt */}
        <div>
          <label className="text-[10px] text-gray-500 uppercase font-bold block mb-1">System Prompt (how the AI behaves)</label>
          <textarea value={systemPrompt} onChange={e => setSystemPrompt(e.target.value)} rows={3}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-2 text-xs text-gray-200 placeholder-gray-600 resize-y outline-none focus:border-violet-500 font-mono leading-relaxed" />
        </div>

        {/* User prompt */}
        <div>
          <label className="text-[10px] text-gray-500 uppercase font-bold block mb-1">User Message (the input to your workflow)</label>
          <textarea value={userPrompt} onChange={e => setUserPrompt(e.target.value)} rows={4}
            onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleTest(); }}
            placeholder="Type something to test your AI call…"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-2 text-xs text-gray-200 placeholder-gray-600 resize-y outline-none focus:border-violet-500 leading-relaxed" />
          <p className="text-[9px] text-gray-700 mt-0.5">Ctrl+Enter to run</p>
        </div>

        {/* Advanced */}
        {showAdvanced && (
          <div className="space-y-2 p-2.5 bg-gray-800/60 rounded-lg border border-gray-700">
            <div>
              <label className="text-[10px] text-gray-500 uppercase font-bold block mb-1">Model</label>
              <select value={model} onChange={e => setModel(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-2 py-1 text-xs text-gray-200 outline-none">
                <option value="claude-haiku-4-5-20251001">Claude Haiku (fast, cheap)</option>
                <option value="claude-sonnet-4-6">Claude Sonnet (smarter)</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] text-gray-500 uppercase font-bold block mb-1">Max Tokens: {maxTokens}</label>
              <input type="range" min={50} max={2000} step={50} value={maxTokens} onChange={e => setMaxTokens(Number(e.target.value))}
                className="w-full accent-violet-500" />
            </div>
          </div>
        )}

        {/* Run button */}
        <button onClick={handleTest} disabled={loading || !userPrompt.trim() || !apiKey}
          className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-bold bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white rounded-lg transition-colors">
          {loading ? <><Loader2 size={14} className="animate-spin" /> Running…</> : <><Play size={14} /> Run AI Call</>}
        </button>

        {!apiKey && (
          <p className="text-[10px] text-amber-400 text-center flex items-center justify-center gap-1">
            <Key size={10} /> Enter your API key in the Credentials panel to enable testing
          </p>
        )}

        {/* Error */}
        {error && (
          <div className="p-2.5 bg-red-500/10 border border-red-500/20 rounded-lg flex gap-2">
            <AlertCircle size={12} className="flex-shrink-0 text-red-400 mt-0.5" />
            <p className="text-xs text-red-300">{error}</p>
          </div>
        )}

        {/* Response */}
        {response && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold text-emerald-400 uppercase">AI Response</p>
              <button onClick={() => navigator.clipboard.writeText(response)}
                className="text-[10px] text-gray-500 hover:text-gray-300 flex items-center gap-1">
                <Copy size={10} /> Copy
              </button>
            </div>
            <div className="p-3 bg-violet-500/10 border border-violet-500/25 rounded-lg">
              <p className="text-xs text-gray-200 leading-relaxed whitespace-pre-wrap">{response}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Voice helper ─────────────────────────────────────────────────────────────

// ═══════════════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════════════

const AIWorkflowDevPage: React.FC = () => {
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => { supabase.auth.getUser().then(({ data }) => setUserId(data?.user?.id || null)); }, []);

  // ── Personality baseline ─────────────────────────────────────────────
  const [communicationStrategy, setCommunicationStrategy] = useState<any>(null);
  const [learningStrategy, setLearningStrategy]           = useState<any>(null);
  useEffect(() => {
    if (!userId) return;
    supabase.from('user_personality_baseline').select('communication_strategy, learning_strategy')
      .eq('user_id', userId).maybeSingle()
      .then(({ data }) => {
        if (data?.communication_strategy) setCommunicationStrategy(data.communication_strategy);
        if (data?.learning_strategy)       setLearningStrategy(data.learning_strategy);
      });
  }, [userId]);

  // ── Voice ────────────────────────────────────────────────────────────
  const [voiceOutputEnabled, setVoiceOutputEnabled] = useState(true);
  const [voiceMode, setVoiceMode]                   = useState<'english' | 'pidgin'>('pidgin'); // Africa default
  const [userGradeLevel, setUserGradeLevel]         = useState<number | null>(null);

  useEffect(() => {
    if (!userId) return;
    supabase.from('profiles').select('grade_level, continent').eq('id', userId).single()
      .then(({ data }) => {
        if (data?.grade_level) setUserGradeLevel(data.grade_level);
        setVoiceMode(data?.continent === 'Africa' ? 'pidgin' : 'english');
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

  const speakTextRef = useRef<(t: string) => void>(() => {});
  const speakText = useCallback((text: string) => {
    if (!voiceOutputEnabled || !text.trim()) return;
    hookSpeak(text.slice(0, 400));
  }, [voiceOutputEnabled, hookSpeak]);
  useEffect(() => { speakTextRef.current = speakText; }, [speakText]);

  // ── API credentials ──────────────────────────────────────────────────
  const [creds, setCreds] = useState<ApiCredentials>(() => {
    try { const s = localStorage.getItem(LS_CREDS_KEY); return s ? JSON.parse(s) : { anthropicKey: '', useProxy: false }; }
    catch { return { anthropicKey: '', useProxy: false }; }
  });
  const [credTestStatus, setCredTestStatus] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle');
  const [credTestMsg, setCredTestMsg]       = useState('');

  const updateCreds = (c: ApiCredentials) => {
    setCreds(c); setCredTestStatus('idle');
    try { localStorage.setItem(LS_CREDS_KEY, JSON.stringify(c)); } catch {}
  };

  const testApiKey = async () => {
    if (!creds.anthropicKey) return;
    setCredTestStatus('testing');
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': creds.anthropicKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 10, messages: [{ role: 'user', content: 'Hi' }] }),
      });
      if (res.ok) { setCredTestStatus('ok'); setCredTestMsg('Key works!'); }
      else { const d = await res.json().catch(() => ({})); setCredTestStatus('fail'); setCredTestMsg(d?.error?.message || `Error ${res.status}`); }
    } catch { setCredTestStatus('fail'); setCredTestMsg('Network error'); }
  };

  // ── Session ──────────────────────────────────────────────────────────
  const [sessionId, setSessionId]               = useState<string | null>(null);
  const [sessionName, setSessionName]           = useState('Untitled Workflow');
  const [sessions, setSessions]                 = useState<SessionRecord[]>([]);
  const [showSessionPicker, setShowSessionPicker] = useState(false);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  useEffect(() => { sessionIdRef.current = sessionId; }, [sessionId]);

  // ── Files ────────────────────────────────────────────────────────────
  const [projectFiles, setProjectFiles]   = useState<ProjectFile[]>(STARTER_FILES);
  const [activeFilePath, setActiveFilePath] = useState('src/App.jsx');
  const activeFile = projectFiles.find(f => f.path === activeFilePath) ?? projectFiles[0];

  // ── Right panel ──────────────────────────────────────────────────────
  const [rightTab, setRightTab] = useState<RightTab>('code');

  // ── Task ─────────────────────────────────────────────────────────────
  const [taskIndex, setTaskIndex]               = useState(0);
  const [taskInstruction, setTaskInstruction]   = useState<TaskInstruction | null>(null);
  const [loadingInstruction, setLoadingInstruction] = useState(false);
  const [taskHasGeneration, setTaskHasGeneration] = useState(false);
  const [subTaskIndex, setSubTaskIndex]         = useState(0);
  const [subTaskCritique, setSubTaskCritique]   = useState<{ hasSuggestions: boolean; feedback: string } | null>(null);
  const [isCritiquingResponse, setIsCritiquingResponse] = useState(false);
  const [sessionContext, setSessionContext]     = useState<Record<string, any>>({});

  // ── Prompt ───────────────────────────────────────────────────────────
  const [prompt, setPrompt]               = useState('');
  const [promptHistory, setPromptHistory] = useState<PromptEntry[]>([]);
  const [isGenerating, setIsGenerating]   = useState(false);
  const [isCritiquing, setIsCritiquing]   = useState(false);
  const [errorMsg, setErrorMsg]           = useState<string | null>(null);
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
  const [downloading, setDownloading]       = useState(false);
  const [copied, setCopied]                 = useState(false);
  const [showStackBlitzModal, setShowStackBlitzModal] = useState(false);

  const currentTask  = TASKS[taskIndex];
  const currentPhase = currentTask?.phase ?? 1;
  const pm           = PHASE_META[currentPhase];

  // ── Session management ───────────────────────────────────────────────
  const loadSessions = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase.from('dashboard')
      .select('id, workflow_session_id, workflow_session_name, workflow_pages, workflow_prompts, workflow_evaluation, updated_at')
      .eq('user_id', userId).eq('activity', WORKFLOW_ACTIVITY)
      .not('workflow_session_id', 'is', null).order('updated_at', { ascending: false });
    if (data?.length) { setSessions(data as SessionRecord[]); if (!sessionId) setShowSessionPicker(true); }
  }, [userId, sessionId]);
  useEffect(() => { if (userId) loadSessions(); }, [userId, loadSessions]);

  const ensureSession = useCallback(async (): Promise<string> => {
    if (sessionIdRef.current) return sessionIdRef.current;
    const sid = makeId(); sessionIdRef.current = sid; setSessionId(sid);
    if (userId) {
      await supabase.from('dashboard').insert({
        user_id: userId, activity: WORKFLOW_ACTIVITY,
        workflow_session_id: sid, workflow_session_name: sessionName,
        workflow_pages: STARTER_FILES.map(f => ({ path: f.path, content: f.content })),
        workflow_prompts: [], workflow_evaluation: { taskIndex: 0, sessionContext: {} },
      });
    }
    return sid;
  }, [userId, sessionName]);

  const persistSession = useCallback(async (
    files: ProjectFile[], prompts: PromptEntry[], tIdx: number, ctx: Record<string, any>, scores?: any,
  ) => {
    const sid = sessionIdRef.current; if (!userId || !sid) return;
    await supabase.from('dashboard').update({
      workflow_pages: files.map(f => ({ path: f.path, content: f.content })),
      workflow_prompts: prompts,
      workflow_evaluation: { taskIndex: tIdx, sessionContext: ctx, ...(scores ? { scores } : {}) },
      workflow_session_name: sessionName, updated_at: new Date().toISOString(),
    }).eq('user_id', userId).eq('workflow_session_id', sid);
  }, [userId, sessionName]);

  const createNewSession = useCallback(async () => {
    if (!userId) return;
    const sid = makeId();
    await supabase.from('dashboard').insert({
      user_id: userId, activity: WORKFLOW_ACTIVITY,
      workflow_session_id: sid, workflow_session_name: 'Untitled Workflow',
      workflow_pages: STARTER_FILES.map(f => ({ path: f.path, content: f.content })),
      workflow_prompts: [], workflow_evaluation: { taskIndex: 0, sessionContext: {} },
    });
    setSessionId(sid); sessionIdRef.current = sid;
    setSessionName('Untitled Workflow'); setProjectFiles(STARTER_FILES);
    setActiveFilePath('src/App.jsx'); setTaskIndex(0);
    setPromptHistory([]); setEvaluation(null); setSessionContext({});
    setTaskHasGeneration(false); setShowSessionPicker(false);
    setTaskInstruction(null); setPrompt(''); setAiExplanation(null); setErrorMsg(null);
  }, [userId]);

  const loadSession = useCallback((s: SessionRecord) => {
    setSessionId(s.workflow_session_id); sessionIdRef.current = s.workflow_session_id;
    setSessionName(s.workflow_session_name);
    const files: ProjectFile[] = (s.workflow_pages || []).map((p: any) => ({ path: p.path || p.name, content: p.content || p.code || '' }));
    setProjectFiles(files.length ? files : STARTER_FILES);
    setActiveFilePath('src/App.jsx');
    const ev = s.workflow_evaluation || {};
    setTaskIndex(ev.taskIndex ?? 0); setSessionContext(ev.sessionContext ?? {});
    setEvaluation(ev.scores || null); setPromptHistory(s.workflow_prompts || []);
    setTaskHasGeneration(false); setShowSessionPicker(false);
    setTaskInstruction(null); setPrompt(''); setAiExplanation(null); setErrorMsg(null); setSubTaskCritique(null);
  }, []);

  const handleDeleteSession = useCallback(async (e: React.MouseEvent, sid: string) => {
    e.stopPropagation(); if (!userId) return;
    setDeletingSessionId(sid);
    try {
      await supabase.from('dashboard').update({
        workflow_session_id: null, workflow_session_name: null,
        workflow_pages: null, workflow_prompts: null, workflow_evaluation: null,
      }).eq('user_id', userId).eq('workflow_session_id', sid);
      setSessions(prev => prev.filter(s => s.workflow_session_id !== sid));
    } finally { setDeletingSessionId(null); }
  }, [userId]);

  // ── Fetch task instruction ────────────────────────────────────────────
  const fetchTaskInstruction = useCallback(async (idx: number, files: ProjectFile[], ctx: Record<string, any>) => {
    const task = TASKS[idx]; if (!task || task.isOnboarding) return;
    setLoadingInstruction(true); setTaskInstruction(null);
    try {
      const fileSummary = files.filter(f => f.content.length > 10).map(f => ({ path: f.path, preview: f.content.substring(0, 400) }));
      const result = await callInstructionAPI({
        taskId: task.id, taskLabel: task.label, phase: task.phase,
        projectFiles: fileSummary, sessionContext: ctx,
        completedTasks: TASKS.slice(0, idx).map(t => t.id),
        communicationStrategy, learningStrategy,
        hasApiKey: !!creds.anthropicKey,
      });
      setTaskInstruction(result as TaskInstruction);
      if (result?.subTaskTeaching?.[0] && result?.subTasks?.[0]) {
        speakTextRef.current(result.subTaskTeaching[0] + ' ' + result.subTasks[0]);
      } else if (result?.subTasks?.[0]) {
        speakTextRef.current(result.subTasks[0]);
      }
    } catch {
      const fallbacks: Record<string, { teaching: string; question: string }[]> = {
        choose_idea: [
          { teaching: 'The best AI workflows solve a real problem that someone actually has. The most successful ones save time on a boring, repetitive task — or do something a person cannot do at all.',
            question: 'What problem would you like your AI workflow to solve? Describe in 2–3 sentences: who has this problem, what do they currently do without AI, and how could AI help?' },
          { teaching: 'A workflow idea should be specific enough that you can describe the exact input and output. "AI helps with writing" is too vague. "User pastes a job description → AI writes a cover letter" is a workflow.',
            question: 'Describe your workflow input and output. Fill in: "A user gives the AI ___ and gets back ___."' },
        ],
        map_steps: [
          { teaching: 'Every AI workflow is a sequence of steps. Before writing any code, mapping the steps on paper (or in plain English) prevents confusion later and helps you spot problems early.',
            question: 'List every step in your workflow in order. Start with "User types/uploads/selects..." and end with "App shows/saves/sends...". Number each step.' },
          { teaching: 'Some steps in your workflow do not need AI at all — they are just JavaScript or React state management. Identifying which steps need AI and which do not helps you build faster.',
            question: 'For each step you listed, mark it as AI (uses Claude) or Code (just JavaScript/React). This is your workflow blueprint.' },
        ],
        plan_io: [
          { teaching: 'Data types matter. An AI call that receives a long unstructured text needs a different approach than one that receives a short command. Planning inputs and outputs before coding prevents wasted effort.',
            question: 'For each AI step in your workflow, describe: (1) what exact text goes into the AI call, (2) what format you expect the AI to return (paragraph, list, JSON, etc.).' },
          { teaching: 'System prompts are the instructions you give the AI — they define how it behaves, what format it uses, and what constraints to follow. A good system prompt is the difference between a useful workflow and an unpredictable one.',
            question: 'Write a draft system prompt for your main AI call. What persona should the AI have? What format should it return? What should it never do?' },
        ],
        setup_ai_client: [
          { teaching: 'The aiClient.js file in your starter project already has the callAI() function ready. Your task is to add your API key via a .env file — never hardcode a key directly in your component code.',
            question: 'Look at src/lib/aiClient.js in your file tree. Describe what callAI() does in your own words. What are the three parameters it takes?' },
          { teaching: 'Environment variables (VITE_ANTHROPIC_API_KEY) keep secrets safe. They are loaded at build time and are never visible in your source code. This is how every professional app handles API keys.',
            question: 'Have you entered your API key in the Credentials panel? Click Test Workflow tab, enter your key, and click Test Key. What result do you get?' },
        ],
        first_ai_call: [
          { teaching: 'The fastest way to learn is to make your first AI call as simple as possible — one input, one output, no fancy logic. You can add complexity once the basic call works.',
            question: 'Using the aiClient.js pattern, describe what your first AI call should do. What will the user type in? What system prompt will you use? What will the response look like?' },
          { teaching: 'Always test in the Test Workflow panel before putting a call into your React code. This separates two problems: "is my API call correct" and "is my React code correct."',
            question: 'Use the Test Workflow tab (right panel) to test your system prompt and a sample input. What response do you get? Does it match what you expected?' },
        ],
        display_response: [
          { teaching: 'useState is how React remembers the AI response between renders. You need at least three states: the input the user typed, the AI response, and a loading boolean.',
            question: 'What three useState variables will you need in your component? Describe each one: its name, initial value, and what it tracks.' },
          { teaching: 'The loading state prevents the user from submitting again while the AI is thinking, and lets you show a spinner. Without it, users click the button multiple times and get confused.',
            question: 'Describe how you want the UI to look while the AI is generating a response. Should it show a spinner, a message, or disable the button? Describe the before/during/after states.' },
        ],
        chain_calls: [
          { teaching: 'Chaining means the output of one AI call becomes part of the input for the next. This is what separates a "chatbot" from a true workflow — the AI is doing several intelligent jobs in sequence.',
            question: 'For your workflow, describe the chain. Step 1: AI does ___. The output is ___. Step 2: AI takes that output and also ___. The final result is ___.' },
          { teaching: 'The chainAICalls() function in your starter project handles this for you — you just pass in an array of steps. Each step automatically receives the previous step\'s output as context.',
            question: 'How many AI steps does your workflow chain? Describe each step\'s system prompt in one sentence. I will generate the chainAICalls() code for you.' },
        ],
        build_ui: [
          { teaching: 'Your UI has one job: make the workflow so simple that anyone can use it without reading instructions. The best workflow UIs have three parts: input, a clear action button, and a clean output display.',
            question: 'Describe your ideal UI. What does the user see when they first arrive? What do they type or select? What does the result look like? Sketch it in words.' },
          { teaching: 'Error messages should tell the user what went wrong and what they can do about it. "Something went wrong" is useless. "Your input was too long — try a shorter version" is helpful.',
            question: 'What could go wrong in your workflow? List the 2–3 most likely errors and describe how you would explain each one to a non-technical user.' },
        ],
        prompts_polish: [
          { teaching: 'Prompt engineering is iterative. Your first system prompt will almost never be your best one. Professional developers test 5–10 variations before settling on the final version.',
            question: 'Share your current system prompt. Run it 3 times with different inputs in the Test Workflow tab. Paste the best and worst responses — I will help you improve the prompt.' },
          { teaching: 'Output formatting instructions in your system prompt dramatically improve how easy it is to display the AI\'s response. "Respond in exactly 3 bullet points" or "Respond in JSON format" removes ambiguity.',
            question: 'Does your system prompt specify the output format? If not, add a clear format instruction and test it again. What format works best for your use case?' },
        ],
        error_handling: [
          { teaching: 'A workflow without error handling will break in production. Network failures, API rate limits, empty inputs, and unexpected AI responses are all normal — your code needs to handle them gracefully.',
            question: 'Find the try/catch block in your current code. What happens right now if the API call fails? Describe how you want to improve the error handling.' },
          { teaching: 'Loading states should disable inputs while the AI is working. Otherwise users type more text, click the button again, and create confusing parallel requests.',
            question: 'Is your submit button disabled while the AI is running? Is the input field disabled or locked? Describe the current behaviour and how you want it to work.' },
        ],
        deploy_prep: [
          { teaching: 'Deploying to Vercel is the same process as any React/Vite app — but workflow apps have one extra step: adding your API key as an environment variable in the Vercel dashboard, not in your code.',
            question: 'Is your project in a GitHub repository? If yes, paste the URL. If not, describe the steps you have taken to get ready to deploy.' },
          { teaching: 'NEVER commit your .env file to git. Add it to .gitignore before your first commit. Your API key exposed in a public GitHub repository can be used by anyone in the world within minutes.',
            question: 'Check your project files. Does .env.example exist? Is .env listed in .gitignore? Tell me your deployment plan — where will this workflow live and who will use it?' },
        ],
      };
      const seeds = fallbacks[task.id] ?? [
        { teaching: `This step — ${task.label} — is a core skill in professional AI workflow development.`,
          question: `Describe what you want to achieve in this step: ${task.label}` },
      ];
      setTaskInstruction({
        headline: task.label, context: `Working on: ${task.label}`,
        subTasks: seeds.map(s => s.question), subTaskTeaching: seeds.map(s => s.teaching),
        examplePrompt: seeds[0].question,
      });
    } finally { setLoadingInstruction(false); }
  }, [communicationStrategy, learningStrategy, creds.anthropicKey]);

  useEffect(() => {
    if (taskIndex > 0) fetchTaskInstruction(taskIndex, projectFiles, sessionContext);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskIndex]);

  // Auto-switch to Test tab on AI-call tasks
  useEffect(() => {
    if (['first_ai_call', 'chain_calls', 'prompts_polish'].includes(currentTask?.id ?? '')) {
      setRightTab('test');
    } else {
      setRightTab('code');
    }
  }, [currentTask?.id]);

  // ── Generate ──────────────────────────────────────────────────────────
  const handleGenerate = useCallback(async () => {
    if (!prompt.trim() || isGenerating) return;
    setIsGenerating(true); setErrorMsg(null); setAiExplanation(null); setSubTaskCritique(null);
    await ensureSession();
    const hasCode = projectFiles.some(f => f.path.startsWith('src/') && f.content.length > 100 && f.path !== 'src/index.css');
    const entry: PromptEntry = {
      id: makeId(), taskId: currentTask?.id ?? '', subTaskIndex,
      subTaskQuestion: taskInstruction?.subTasks[subTaskIndex] ?? '',
      subTaskTeaching: taskInstruction?.subTaskTeaching?.[subTaskIndex] ?? '',
      prompt: prompt.trim(), timestamp: new Date().toISOString(),
      action: hasCode ? 'iterate' : 'generate',
    };
    try {
      const result = await callGenerateAPI({
        action: entry.action, prompt: prompt.trim(), taskId: currentTask?.id,
        projectFiles: projectFiles.map(f => ({ path: f.path, content: f.content })),
        sessionContext, communicationStrategy, learningStrategy,
        hasApiKey: !!creds.anthropicKey,
      });
      const updatedFiles = result.files ? mergeFiles(projectFiles, result.files) : projectFiles;
      setProjectFiles(updatedFiles);
      if (result.files?.length === 1) setActiveFilePath(result.files[0].path);
      else if (result.files?.length > 1) {
        const main = result.files.find((f: any) => f.path === 'src/App.jsx' || f.path === 'src/lib/aiClient.js');
        if (main) setActiveFilePath(main.path);
      }
      setAiExplanation(result.explanation || null);
      entry.filesModified = result.files?.map((f: any) => f.path);
      if (result.sessionContext) setSessionContext(prev => ({ ...prev, ...result.sessionContext }));

      // Fire-and-forget critique
      if (prompt.trim().length > 15) {
        setIsCritiquingResponse(true);
        fetch('/api/workflow-task-instruction', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'claude-sonnet-4-6', mode: 'critique', prompt: prompt.trim(), subTaskQuestion: taskInstruction?.subTasks[subTaskIndex] || '', taskId: currentTask?.id, communicationStrategy, learningStrategy }),
        }).then(r => r.ok ? r.json() : null).then(d => {
          if (d?.feedback) {
            entry.aiCritique = d.feedback; entry.hasSuggestions = d.hasSuggestions;
            setSubTaskCritique({ hasSuggestions: !!d.hasSuggestions, feedback: d.feedback });
            if (!d.hasSuggestions) speakTextRef.current(d.feedback.slice(0, 200));
          }
        }).catch(() => {}).finally(() => setIsCritiquingResponse(false));
      }

      const newHistory = [...promptHistory, entry];
      setPromptHistory(newHistory); setTaskHasGeneration(true); setPrompt('');
      promptRef.current?.focus();
      await persistSession(updatedFiles, newHistory, taskIndex, sessionContext);
      if (voiceOutputEnabled && result.explanation) speakTextRef.current(result.explanation.slice(0, 200));
    } catch (err: any) { setErrorMsg(err.message || 'Something went wrong'); }
    finally { setIsGenerating(false); }
  }, [prompt, isGenerating, currentTask, taskInstruction, subTaskIndex, projectFiles,
      sessionContext, promptHistory, creds.anthropicKey, communicationStrategy,
      learningStrategy, ensureSession, persistSession, voiceOutputEnabled]);

  const handleCritique = useCallback(async () => {
    if (!prompt.trim() || isCritiquing) return;
    setIsCritiquing(true); setSubTaskCritique(null);
    try {
      const res = await fetch('/api/workflow-task-instruction', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'claude-sonnet-4-6', mode: 'critique', prompt: prompt.trim(), subTaskQuestion: taskInstruction?.subTasks[subTaskIndex] || '', taskId: currentTask?.id, communicationStrategy, learningStrategy }),
      });
      if (res.ok) { const d = await res.json(); if (d?.feedback) setSubTaskCritique({ hasSuggestions: !!d.hasSuggestions, feedback: d.feedback }); }
    } catch {} finally { setIsCritiquing(false); }
  }, [prompt, isCritiquing, currentTask, taskInstruction, subTaskIndex, communicationStrategy, learningStrategy]);

  const handleMoveToNextStep = () => {
    const next = subTaskIndex + 1;
    if (next < (taskInstruction?.subTasks?.length ?? 1)) {
      setSubTaskIndex(next); setSubTaskCritique(null); setPrompt(''); setAiExplanation(null);
      if (taskInstruction?.subTaskTeaching?.[next]) speakTextRef.current(taskInstruction.subTaskTeaching[next] + ' ' + taskInstruction.subTasks[next]);
    }
  };

  const handleCompleteTask = useCallback(async () => {
    if (taskIndex >= TASKS.length - 1) return;
    const nextIdx = taskIndex + 1;
    setTaskIndex(nextIdx); setTaskHasGeneration(false);
    setSubTaskIndex(0); setSubTaskCritique(null); setPrompt(''); setAiExplanation(null); setErrorMsg(null);
    await persistSession(projectFiles, promptHistory, nextIdx, sessionContext);
  }, [taskIndex, projectFiles, promptHistory, sessionContext, persistSession]);

  const handleOnboardingComplete = useCallback(async () => {
    await ensureSession();
    setTaskIndex(1); setTaskHasGeneration(false); setSubTaskIndex(0); setSubTaskCritique(null);
    speakText("Welcome! Let's start by choosing your workflow idea.");
    await fetchTaskInstruction(1, projectFiles, sessionContext);
    setTimeout(() => persistSession(projectFiles, promptHistory, 1, sessionContext), 100);
  }, [ensureSession, projectFiles, promptHistory, sessionContext, persistSession, fetchTaskInstruction, speakText]);

  // ── Evaluate ──────────────────────────────────────────────────────────
  const handleEvaluate = useCallback(async () => {
    setIsEvaluating(true); setEvalError(null); setShowEvaluation(true);
    try {
      const r = await callEvaluateAPI(promptHistory, projectFiles);
      setEvaluation(r.evaluation ?? null); setEvalAdvice(r.advice ?? null);
    } catch (err: any) { setEvalError(err.message || 'Evaluation failed'); }
    finally { setIsEvaluating(false); }
  }, [promptHistory, projectFiles]);

  const handleSaveProject = useCallback(async () => {
    if (!userId || !sessionIdRef.current) return;
    setIsSaving(true); setSaveError(null); await ensureSession();
    try {
      let evalScores: any = null; let advice: string | null = null;
      try { const r = await callEvaluateAPI(promptHistory, projectFiles); evalScores = r.evaluation ?? null; advice = r.advice ?? null; } catch {}
      await supabase.from('dashboard').update({
        workflow_pages: projectFiles.map(f => ({ path: f.path, content: f.content })),
        workflow_prompts: promptHistory,
        workflow_evaluation: { taskIndex, sessionContext, scores: evalScores, savedAt: new Date().toISOString() },
        workflow_session_name: sessionName, updated_at: new Date().toISOString(),
      }).eq('user_id', userId).eq('workflow_session_id', sessionIdRef.current);
      if (evalScores) { setEvaluation(evalScores); setEvalAdvice(advice); setShowEvaluation(true); }
      setLastSaved(new Date());
    } catch (err: any) { setSaveError(err.message || 'Save failed'); }
    finally { setIsSaving(false); }
  }, [userId, projectFiles, promptHistory, taskIndex, sessionContext, sessionName, ensureSession]);

  const handleDownload = useCallback(async () => {
    setDownloading(true);
    try {
      const { default: JSZip } = await import('jszip' as any);
      const zip = new JSZip();
      for (const f of projectFiles) zip.file(f.path, f.content);
      zip.file('README.md', `# ${sessionName}\n\nAI Workflow app built with React + Vite + Anthropic API.\n\n## Setup\n\n1. \`cp .env.example .env\`\n2. Add your Anthropic API key to \`.env\`\n3. \`npm install\`\n4. \`npm run dev\`\n\n## Deploy\n\nPush to GitHub, connect to Vercel. Add VITE_ANTHROPIC_API_KEY as an environment variable in Vercel dashboard.\n`);
      const blob = await zip.generateAsync({ type: 'blob' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = `${sessionName.replace(/\s+/g, '-').toLowerCase()}.zip`; a.click();
    } catch {} finally { setDownloading(false); }
  }, [projectFiles, sessionName]);

  const handleOpenStackBlitz = useCallback(() => {
    const form = document.createElement('form');
    form.method = 'POST'; form.action = 'https://stackblitz.com/run'; form.target = '_blank';
    const add = (name: string, value: string) => { const i = document.createElement('input'); i.type = 'hidden'; i.name = name; i.value = value; form.appendChild(i); };
    add('project[title]', sessionName);
    add('project[description]', 'React + Vite AI Workflow app');
    add('project[template]', 'node');
    for (const f of projectFiles) add(`project[files][${f.path}]`, f.content);
    document.body.appendChild(form); form.submit(); document.body.removeChild(form);
  }, [projectFiles, sessionName]);

  const handleEditorChange = (val: string | undefined) => {
    setProjectFiles(prev => prev.map(f => f.path === activeFilePath ? { ...f, content: val || '' } : f));
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(activeFile?.content || '').then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
  };

  const showCredPanel = currentTask?.id === 'setup_ai_client';
  const scoreColor = (s: number) => s >= 2.5 ? 'text-emerald-400' : s >= 1.5 ? 'text-amber-400' : 'text-red-400';
  const skillLabel = (k: string) => k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  // ─────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white overflow-hidden">
      <Navbar />

      {/* Voice fallback — fixed overlay when TTS unavailable (e.g. no network voice in Nigeria) */}
      {fallbackText && (
        <div className="fixed bottom-4 right-4 z-50 max-w-sm">
          <VoiceFallback text={fallbackText} onDismiss={clearFallback} />
        </div>
      )}

      {/* ── Session picker ──────────────────────────────────────────── */}
      {showSessionPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-gray-800 border border-gray-600 rounded-2xl w-full max-w-lg max-h-[80vh] overflow-hidden shadow-2xl flex flex-col">
            <div className="px-5 py-4 border-b border-gray-700 flex justify-between items-center flex-shrink-0">
              <h2 className="text-base font-bold text-white flex items-center gap-2"><FolderOpen size={18} className="text-violet-400" /> Your Workflow Projects</h2>
              <button onClick={() => setShowSessionPicker(false)} className="p-1 text-gray-400 hover:text-white"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {sessions.map(s => (
                <button key={s.workflow_session_id} onClick={() => loadSession(s)}
                  className="w-full text-left p-3 bg-gray-700/40 hover:bg-gray-700 border border-gray-600 hover:border-violet-500/40 rounded-xl transition-colors">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{s.workflow_session_name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Task {(s.workflow_evaluation as any)?.taskIndex ?? 0}/{TASKS.length - 1} · {s.updated_at ? new Date(s.updated_at).toLocaleDateString() : '—'}
                      </p>
                    </div>
                    <button onClick={e => handleDeleteSession(e, s.workflow_session_id)} disabled={deletingSessionId === s.workflow_session_id}
                      className="p-1.5 text-gray-600 hover:text-red-400 rounded transition-colors flex-shrink-0">
                      {deletingSessionId === s.workflow_session_id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    </button>
                  </div>
                </button>
              ))}
            </div>
            <div className="px-5 pb-4 flex-shrink-0">
              <button onClick={createNewSession}
                className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-bold bg-violet-600 hover:bg-violet-700 text-white rounded-xl transition-colors">
                <Plus size={15} /> Start New Workflow
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Evaluation modal ─────────────────────────────────────────── */}
      {showEvaluation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-gray-800 border border-gray-600 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
            <div className="px-6 py-4 border-b border-gray-700 flex justify-between items-center flex-shrink-0">
              <h2 className="text-lg font-bold text-white flex items-center gap-2"><BarChart3 size={20} className="text-violet-400" /> Workflow Evaluation</h2>
              <button onClick={() => setShowEvaluation(false)} className="p-1 text-gray-400 hover:text-white"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {isEvaluating && (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 size={36} className="animate-spin text-violet-400 mb-3" />
                  <p className="text-gray-300 font-medium">Evaluating your workflow…</p>
                </div>
              )}
              {evalError && !isEvaluating && (
                <div className="p-4 bg-red-500/15 border border-red-500/30 rounded-xl text-red-300 flex gap-2">
                  <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />{evalError}
                </div>
              )}
              {evaluation && !isEvaluating && (
                <>
                  {evaluation.overall_score_average !== undefined && (
                    <div className="flex items-center gap-4 p-4 bg-gray-700/60 rounded-xl border border-gray-600">
                      <Award size={32} className="text-amber-400 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-gray-400 uppercase font-bold">Overall</p>
                        <p className={`text-3xl font-black ${scoreColor(evaluation.overall_score_average)}`}>
                          {Number(evaluation.overall_score_average).toFixed(1)}<span className="text-base font-normal text-gray-500"> / 3.0</span>
                        </p>
                      </div>
                    </div>
                  )}
                  {evaluation.strengths_summary && (
                    <div className="p-4 bg-emerald-500/10 border border-emerald-500/25 rounded-xl">
                      <p className="text-[10px] font-bold text-emerald-400 uppercase mb-2">💪 Strengths</p>
                      <p className="text-xs text-gray-300 leading-relaxed">{evaluation.strengths_summary}</p>
                    </div>
                  )}
                  {evaluation.highest_leverage_improvements && (
                    <div className="p-4 bg-amber-500/10 border border-amber-500/25 rounded-xl">
                      <p className="text-[10px] font-bold text-amber-400 uppercase mb-2">🎯 Key Improvements</p>
                      <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-line">{evaluation.highest_leverage_improvements}</p>
                    </div>
                  )}
                  {evalAdvice && (
                    <div className="p-4 bg-blue-500/10 border border-blue-500/25 rounded-xl">
                      <p className="text-[10px] font-bold text-blue-400 uppercase mb-2">📋 Coaching Advice</p>
                      <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-line">{evalAdvice}</p>
                    </div>
                  )}
                  {evaluation.detailed_scores && (
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">Skill Breakdown</p>
                      {Object.entries(evaluation.detailed_scores as Record<string, { score: number; justification: string }>).map(([skill, data]) => (
                        <details key={skill} className="border border-gray-700 rounded-lg overflow-hidden">
                          <summary className="flex items-center gap-3 px-3 py-2 bg-gray-700/30 hover:bg-gray-700/50 cursor-pointer list-none">
                            <span className={`text-sm font-black w-5 text-right flex-shrink-0 ${scoreColor(data.score)}`}>{data.score}</span>
                            <span className="text-[11px] text-gray-300 flex-1">{skillLabel(skill)}</span>
                            <div className="w-16 h-1.5 bg-gray-700 rounded-full overflow-hidden flex-shrink-0">
                              <div className={`h-full rounded-full ${data.score >= 2 ? 'bg-emerald-500' : data.score >= 1 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${(data.score / 3) * 100}%` }} />
                            </div>
                          </summary>
                          {data.justification && (
                            <div className="px-4 py-2 bg-gray-900/40 border-t border-gray-700">
                              <p className="text-xs text-gray-400 leading-relaxed">{data.justification}</p>
                            </div>
                          )}
                        </details>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── StackBlitz modal ─────────────────────────────────────────── */}
      {showStackBlitzModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-gray-800 border border-gray-600 rounded-2xl w-[460px] shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-700 flex justify-between items-center">
              <h2 className="text-base font-bold text-white flex items-center gap-2"><ExternalLink size={18} className="text-violet-400" /> Open in StackBlitz</h2>
              <button onClick={() => setShowStackBlitzModal(false)} className="p-1 text-gray-400 hover:text-white"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-3">
              <p className="text-sm text-gray-300 leading-relaxed">Your workflow app will open in StackBlitz for live preview. Note that direct Anthropic API calls may not work there without adding your API key as an environment variable.</p>
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-300">
                ⚠️ If AI calls fail in StackBlitz, it's because the API key isn't set. Use the Test Workflow tab here to test AI calls instead.
              </div>
            </div>
            <div className="px-6 pb-5 flex gap-2">
              <button onClick={() => { handleOpenStackBlitz(); setShowStackBlitzModal(false); }}
                className="flex-1 py-2.5 text-sm font-bold bg-violet-600 hover:bg-violet-700 text-white rounded-xl transition-colors">
                Open in StackBlitz →
              </button>
              <button onClick={() => setShowStackBlitzModal(false)} className="px-4 py-2.5 text-sm text-gray-400 hover:text-white border border-gray-600 rounded-xl transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Main Layout ───────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col overflow-hidden" style={{ marginTop: '64px' }}>

        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center gap-2 flex-shrink-0">
              <Zap size={18} className="text-violet-400" />
              <span className="text-sm font-bold text-white">AI Workflow Builder</span>
            </div>
            <div className="w-px h-5 bg-gray-600 flex-shrink-0" />
            <input className="text-sm text-gray-300 bg-transparent border-b border-transparent hover:border-gray-600 focus:border-violet-500 outline-none px-1 py-0.5 w-44"
              value={sessionName} onChange={e => setSessionName(e.target.value)} placeholder="Workflow name…" />
            <div className="w-px h-5 bg-gray-600 flex-shrink-0" />
            <div className="flex items-center gap-1 flex-shrink-0">
              {[1, 2, 3].map(p => {
                const meta = PHASE_META[p]; const isActive = currentPhase === p; const isDone = currentPhase > p;
                return (
                  <span key={p} className={`px-2 py-0.5 rounded-full text-[10px] font-bold border transition-colors
                    ${isDone ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                    : isActive ? `${meta.bg} ${meta.color} ${meta.border}` : 'text-gray-600 border-gray-700'}`}>
                    {isDone ? `✓ P${p}` : `P${p}`}
                  </span>
                );
              })}
              <span className="text-[10px] text-gray-500 ml-1">{taskIndex + 1}/{TASKS.length}</span>
            </div>
            {/* API key indicator */}
            {creds.anthropicKey && (
              <div className="hidden md:flex items-center gap-1 px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/25 rounded-full flex-shrink-0">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] text-emerald-400 font-medium">API key set</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="flex items-center gap-1">
              <div className="flex rounded-lg overflow-hidden border border-gray-600">
                <button onClick={() => setVoiceMode('english')}
                  className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold transition-all border-r border-gray-600
                    ${voiceMode === 'english' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-500 hover:bg-gray-700 hover:text-white'}`}>
                  🇬🇧 <span className="hidden lg:inline">English</span>
                </button>
                <button onClick={() => setVoiceMode('pidgin')}
                  className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold transition-all
                    ${voiceMode === 'pidgin' ? 'bg-green-600 text-white' : 'bg-gray-800 text-gray-500 hover:bg-gray-700 hover:text-white'}`}>
                  🇳🇬 <span className="hidden lg:inline">Pidgin</span>
                </button>
              </div>
              <button onClick={() => { setVoiceOutputEnabled(prev => { if (prev) cancelSpeech(); return !prev; }); }}
                className={`p-1.5 rounded-lg transition-colors border ${voiceOutputEnabled ? 'text-violet-400 border-violet-500/40 bg-violet-500/10' : 'text-gray-600 border-gray-700'}`}>
                {voiceOutputEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
              </button>
            </div>
            <button onClick={() => setShowStackBlitzModal(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-violet-300 hover:text-white hover:bg-violet-600/30 rounded-lg transition-colors border border-violet-500/30">
              <ExternalLink size={12} /> Preview
            </button>
            <button onClick={handleDownload} disabled={downloading}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition-colors">
              {downloading ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />} .zip
            </button>
            <button onClick={() => { loadSessions(); setShowSessionPicker(true); }} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"><FolderOpen size={15} /></button>
            {lastSaved && !isSaving && <span className="text-[10px] text-gray-600 hidden sm:block">Saved {lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
            {saveError && <span className="text-[10px] text-red-500">Save failed</span>}
            <button onClick={handleSaveProject} disabled={isSaving || !taskHasGeneration}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-violet-300 bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/30 rounded-lg transition-colors disabled:opacity-40">
              {isSaving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} {isSaving ? 'Saving…' : 'Save'}
            </button>
            <button onClick={handleEvaluate} disabled={isEvaluating || promptHistory.length < 2}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-700 hover:to-pink-700 text-white rounded-lg transition-colors shadow disabled:opacity-50">
              {isEvaluating ? <Loader2 size={12} className="animate-spin" /> : <BarChart3 size={12} />} Evaluate
            </button>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 flex overflow-hidden">

          {/* ═══ LEFT: Task + Prompt ═══ */}
          <div className="w-80 flex-shrink-0 flex flex-col bg-[#1a1d23] border-r border-gray-700 overflow-hidden">
            {currentTask?.isOnboarding ? (
              <div className="flex-1 overflow-y-auto">
                <WorkflowOnboarding onComplete={handleOnboardingComplete} />
              </div>
            ) : (
              <>
                <div className={`flex-shrink-0 flex items-center gap-2.5 px-4 py-3 border-b ${pm.border} ${pm.bg}`}>
                  <span className="text-lg">{currentTask?.icon}</span>
                  <div className="min-w-0">
                    <p className={`text-[9px] font-bold uppercase tracking-wider ${pm.color}`}>{pm.label}</p>
                    <p className="text-sm font-bold text-white truncate">{currentTask?.label}</p>
                  </div>
                  {taskInstruction?.subTasks && taskInstruction.subTasks.length > 1 && (
                    <div className="flex gap-1 ml-auto flex-shrink-0">
                      {taskInstruction.subTasks.map((_, i) => (
                        <span key={i} className={`w-1.5 h-1.5 rounded-full transition-colors ${i < subTaskIndex ? 'bg-emerald-400' : i === subTaskIndex ? 'bg-violet-400' : 'bg-gray-700'}`} />
                      ))}
                    </div>
                  )}
                </div>

                <TaskStepper tasks={TASKS} taskIndex={taskIndex} onJump={idx => { setTaskIndex(idx); setSubTaskIndex(0); setSubTaskCritique(null); setPrompt(''); setAiExplanation(null); setErrorMsg(null); }} />

                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">

                  {/* API credentials panel on setup task */}
                  {showCredPanel && (
                    <ApiCredentialsPanel creds={creds} onChange={updateCreds} testStatus={credTestStatus} testMsg={credTestMsg} onTest={testApiKey} />
                  )}

                  {/* Instruction card */}
                  {loadingInstruction ? (
                    <div className="flex items-center gap-2 py-2">
                      <Loader2 size={14} className="animate-spin text-violet-400" />
                      <span className="text-xs text-gray-400">Preparing instruction…</span>
                    </div>
                  ) : taskInstruction ? (
                    <div className="rounded-xl border border-gray-700 overflow-hidden">
                      {taskInstruction.subTaskTeaching?.[subTaskIndex] && (
                        <div className="px-3 pt-2.5 pb-2 bg-gray-800/80 border-b border-gray-700">
                          <p className={`text-[9px] font-bold uppercase tracking-wide mb-1 ${pm.color}`}>
                            Why this matters — Step {subTaskIndex + 1} of {taskInstruction.subTasks.length}
                          </p>
                          <p className="text-xs text-gray-300 leading-relaxed italic">{taskInstruction.subTaskTeaching[subTaskIndex]}</p>
                        </div>
                      )}
                      <div className={`px-3 py-2.5 ${pm.bg}`}>
                        {!taskInstruction.subTaskTeaching?.[subTaskIndex] && (
                          <p className={`text-[9px] font-bold uppercase tracking-wide mb-1 ${pm.color}`}>Step {subTaskIndex + 1} of {taskInstruction.subTasks.length}</p>
                        )}
                        <p className="text-sm text-white leading-relaxed font-medium">{taskInstruction.subTasks[subTaskIndex]}</p>
                        {subTaskIndex === 0 && taskInstruction.examplePrompt && (
                          <button onClick={() => { setPrompt(taskInstruction!.examplePrompt); promptRef.current?.focus(); }}
                            className={`mt-2 text-[10px] font-bold ${pm.color} hover:opacity-70 transition-opacity`}>
                            See example →
                          </button>
                        )}
                      </div>
                    </div>
                  ) : null}

                  {aiExplanation && (
                    <div className="p-2.5 bg-violet-500/10 border border-violet-500/20 rounded-lg">
                      <p className="text-[9px] font-bold text-violet-400 uppercase mb-1">What was built</p>
                      <p className="text-xs text-gray-300 leading-relaxed">{aiExplanation}</p>
                    </div>
                  )}

                  {isCritiquingResponse && (
                    <div className="flex items-center gap-2 py-1">
                      <Loader2 size={12} className="animate-spin text-violet-400 flex-shrink-0" />
                      <span className="text-xs text-gray-400">Reviewing your response…</span>
                    </div>
                  )}
                  {subTaskCritique && (
                    <div className={`rounded-xl border overflow-hidden ${subTaskCritique.hasSuggestions ? 'border-amber-500/30 bg-amber-500/5' : 'border-emerald-500/30 bg-emerald-500/5'}`}>
                      <div className="px-3 pt-2.5 pb-1 border-b border-inherit">
                        <p className={`text-[9px] font-bold uppercase tracking-wide ${subTaskCritique.hasSuggestions ? 'text-amber-400' : 'text-emerald-400'}`}>
                          {subTaskCritique.hasSuggestions ? '💡 Feedback on your response' : '✅ Step complete'}
                        </p>
                      </div>
                      <p className="px-3 py-2.5 text-xs text-gray-200 leading-relaxed">{subTaskCritique.feedback}</p>
                      {subTaskCritique.hasSuggestions && <div className="px-3 pb-2.5 text-[10px] text-gray-500 italic">Refine your response, or move on when ready.</div>}
                    </div>
                  )}

                  {errorMsg && (
                    <div className="p-2.5 bg-red-500/10 border border-red-500/20 rounded-lg flex gap-2">
                      <AlertCircle size={12} className="flex-shrink-0 text-red-400 mt-0.5" />
                      <p className="text-xs text-red-300">{errorMsg}</p>
                    </div>
                  )}

                  <div>
                    <textarea ref={promptRef} value={prompt} onChange={e => setPrompt(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleGenerate(); }}
                      placeholder={taskInstruction?.subTasks[subTaskIndex]?.substring(0, 80) + '…' || 'Describe what you want to build…'}
                      style={{ minHeight: '140px' }}
                      className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 resize-y outline-none focus:border-violet-500 transition-colors leading-relaxed" />
                    <p className="text-[9px] text-gray-700 mt-1">Ctrl+Enter to submit</p>
                  </div>
                </div>

                <div className="flex-shrink-0 px-4 pb-4 space-y-2">
                  <div className="flex gap-2">
                    <button onClick={handleGenerate} disabled={isGenerating || !prompt.trim()}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-bold bg-violet-600 hover:bg-violet-700 text-white rounded-xl transition-colors disabled:opacity-40">
                      {isGenerating ? <Loader2 size={15} className="animate-spin" /> : <ArrowUpCircle size={18} />}
                      {isGenerating && <span className="text-sm">Working…</span>}
                    </button>
                    <button onClick={handleCritique} disabled={isCritiquing || !prompt.trim()}
                      title="Critique my prompt"
                      className="flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-xl transition-colors disabled:opacity-40">
                      {isCritiquing ? <Loader2 size={14} className="animate-spin" /> : <Lightbulb size={14} />}
                    </button>
                  </div>

                  {subTaskCritique?.hasSuggestions && subTaskIndex < (taskInstruction?.subTasks?.length ?? 1) - 1 && (
                    <button onClick={handleMoveToNextStep}
                      className="w-full flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-xl border border-gray-600 text-gray-300 hover:border-gray-400 hover:text-white transition-all">
                      <SkipForward size={13} /> Move to next step
                    </button>
                  )}

                  {taskIndex < TASKS.length - 1 && taskHasGeneration && subTaskIndex >= (taskInstruction?.subTasks?.length ?? 1) - 1 && (!subTaskCritique || !subTaskCritique.hasSuggestions) && (
                    <button onClick={handleCompleteTask}
                      className={`w-full flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-xl border transition-all ${pm.bg} ${pm.color} ${pm.border} hover:opacity-90`}>
                      <CheckCircle size={13} /> Complete & Continue <ArrowRight size={13} />
                    </button>
                  )}

                  {taskIndex < TASKS.length - 1 && taskHasGeneration && subTaskIndex >= (taskInstruction?.subTasks?.length ?? 1) - 1 && subTaskCritique?.hasSuggestions && (
                    <button onClick={handleCompleteTask}
                      className="w-full flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-xl border border-gray-700 text-gray-500 hover:border-gray-500 hover:text-gray-300 transition-all">
                      <CheckCircle size={13} /> Complete anyway <ArrowRight size={13} />
                    </button>
                  )}
                </div>
              </>
            )}
          </div>

          {/* ═══ RIGHT: Code / Test ═══ */}
          <div className="flex-1 flex flex-col overflow-hidden">

            {/* Tab bar */}
            <div className="flex items-center gap-1 px-3 py-2 bg-gray-800/80 border-b border-gray-700 flex-shrink-0">
              {[
                { id: 'code' as RightTab, label: 'Code', icon: <FileCode size={12} /> },
                { id: 'test' as RightTab, label: 'Test Workflow', icon: <Play size={12} /> },
              ].map(tab => (
                <button key={tab.id} onClick={() => setRightTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all
                    ${rightTab === tab.id ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-700/40'}`}>
                  {tab.icon} {tab.label}
                  {tab.id === 'test' && ['first_ai_call', 'chain_calls', 'prompts_polish'].includes(currentTask?.id ?? '') && rightTab !== 'test' && (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 ml-0.5" />
                  )}
                </button>
              ))}
              {/* File info on code tab */}
              {rightTab === 'code' && (
                <div className="ml-auto flex items-center gap-2">
                  <FileCode size={12} className="text-violet-400" />
                  <span className="text-xs text-gray-400 truncate max-w-40">{activeFilePath}</span>
                  <span className="text-[10px] text-gray-600">{activeFile?.content.split('\n').length}L</span>
                  <button onClick={handleCopy} className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors">
                    {copied ? <Check size={11} /> : <Copy size={11} />}{copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
              )}
            </div>

            {/* Tab content */}
            <div className="flex-1 flex overflow-hidden">

              {rightTab === 'code' && (
                <>
                  {/* File tree */}
                  <div className="w-44 flex-shrink-0 border-r border-gray-700 flex flex-col" style={{ background: '#161820' }}>
                    <div className="px-3 pt-2 pb-1 flex-shrink-0">
                      <p className="text-[9px] font-bold text-gray-700 uppercase tracking-wide">Files</p>
                    </div>
                    <div className="flex-1 overflow-y-auto pb-2">
                      <FileTreePanel files={projectFiles} activeFile={activeFilePath} onSelect={setActiveFilePath} />
                    </div>
                  </div>
                  {/* Monaco */}
                  <div className="flex-1 flex flex-col min-w-0">
                    <div className="flex-1">
                      <Editor height="100%" language={getLanguage(activeFilePath)}
                        value={activeFile?.content || ''} onChange={handleEditorChange}
                        theme="vs-dark"
                        options={{ fontSize: 13, minimap: { enabled: false }, padding: { top: 12 }, lineNumbers: 'on', wordWrap: 'on', scrollBeyondLastLine: false, automaticLayout: true, tabSize: 2 }}
                      />
                    </div>
                  </div>
                </>
              )}

              {rightTab === 'test' && (
                <div className="flex-1 overflow-hidden">
                  <TestWorkflowPanel apiKey={creds.anthropicKey} projectFiles={projectFiles} />
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AIWorkflowDevPage;