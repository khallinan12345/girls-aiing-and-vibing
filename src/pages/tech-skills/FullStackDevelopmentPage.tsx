// src/pages/tech-skills/FullStackDevelopmentPage.tsx
// Full-Stack Development with React + Supabase (PostgreSQL)
// API routes needed:
//   /api/generate-fullstack-code
//   /api/fullstack-task-instruction
//   /api/evaluate-fullstack-session

import React, { useState, useRef, useCallback, useEffect } from 'react';
import Navbar from '../../components/layout/Navbar';
import { supabase } from '../../lib/supabaseClient';
import Editor from '@monaco-editor/react';
import { useVoice } from '../../hooks/useVoice';
import { VoiceFallback } from '../../components/VoiceFallback';
import {
  Database, Table2, Play, CheckCircle, ArrowRight, FileCode,
  ChevronDown, ChevronRight, Loader2, Save, FolderOpen, Download,
  ArrowUpCircle, SkipForward, Lightbulb, RefreshCw, BarChart3,
  Award, X, Copy, Check, Volume2, VolumeX, AlertCircle, Star,
  Key, Globe, Link, Eye, EyeOff, Trash2, Plus, Code2,
  Package, Layers, Cpu, MessageSquarePlus,
  HelpCircle, FileText, ChevronRight, Lightbulb as LightbulbIcon,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

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
  id: number; fs_session_id: string; fs_session_name: string;
  fs_pages: any[]; fs_prompts: any[]; fs_evaluation: any | null;
  updated_at?: string;
}

interface SupaCredentials { url: string; anonKey: string; }

type RightTab = 'code' | 'tables' | 'sql';

// ─── Constants ───────────────────────────────────────────────────────────────

const makeId = () => Math.random().toString(36).substring(2, 9);
const FS_ACTIVITY = 'fullstack_development';
const LS_CREDS_KEY = 'fs_dev_supabase_creds';

const TASKS: TaskDef[] = [
  { id: 'intro_fullstack',  label: 'Full-Stack Overview',      phase: 1, icon: '🏗️', isOnboarding: true },
  { id: 'supabase_setup',   label: 'Set Up Supabase Project',   phase: 1, icon: '🔑' },
  { id: 'schema_design',    label: 'Design Your Schema',        phase: 1, icon: '📐' },
  { id: 'create_tables',    label: 'Create Tables',             phase: 2, icon: '🗄️' },
  { id: 'connect_react',    label: 'Connect React to Supabase', phase: 2, icon: '🔗' },
  { id: 'read_data',        label: 'Read Data (SELECT)',        phase: 2, icon: '📖' },
  { id: 'write_data',       label: 'Write Data (INSERT/UPDATE)',phase: 2, icon: '✏️' },
  { id: 'auth',             label: 'User Authentication',       phase: 2, icon: '🔐' },
  { id: 'rls',              label: 'Row Level Security',        phase: 3, icon: '🛡️' },
  { id: 'deploy_prep',      label: 'Deploy to Vercel',          phase: 3, icon: '🚀' },
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
      name: 'my-fullstack-app', private: true, version: '0.0.0', type: 'module',
      scripts: { dev: 'vite', build: 'vite build', preview: 'vite preview' },
      dependencies: {
        'react': '^18.2.0', 'react-dom': '^18.2.0',
        'react-router-dom': '^6.21.0',
        '@supabase/supabase-js': '^2.39.0',
      },
      devDependencies: { '@vitejs/plugin-react': '^4.2.1', 'vite': '^5.0.8' },
    }, null, 2),
  },
  {
    path: 'vite.config.js',
    content: `import { defineConfig } from 'vite'\nimport react from '@vitejs/plugin-react'\n\nexport default defineConfig({\n  plugins: [react()],\n})\n`,
  },
  {
    path: '.env.example',
    content: `# Copy this file to .env and fill in your Supabase project values\n# Get these from: https://supabase.com/dashboard → your project → Settings → API\n\nVITE_SUPABASE_URL=https://xxxx.supabase.co\nVITE_SUPABASE_ANON_KEY=your-anon-key-here\n`,
  },
  {
    path: 'index.html',
    content: `<!DOCTYPE html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>My Full-Stack App</title>\n  </head>\n  <body>\n    <div id="root"></div>\n    <script type="module" src="/src/main.jsx"></script>\n  </body>\n</html>\n`,
  },
  {
    path: 'src/main.jsx',
    content: `import React from 'react'\nimport ReactDOM from 'react-dom/client'\nimport App from './App.jsx'\nimport './index.css'\n\nReactDOM.createRoot(document.getElementById('root')).render(\n  <React.StrictMode>\n    <App />\n  </React.StrictMode>,\n)\n`,
  },
  {
    path: 'src/lib/supabase.js',
    content: `import { createClient } from '@supabase/supabase-js'\n\nconst supabaseUrl = import.meta.env.VITE_SUPABASE_URL\nconst supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY\n\nexport const supabase = createClient(supabaseUrl, supabaseAnonKey)\n`,
  },
  {
    path: 'src/App.jsx',
    content: `import React from 'react'\n\nfunction App() {\n  return (\n    <div className="app">\n      <h1>My Full-Stack App</h1>\n      <p>Use the prompt panel to start building your database-connected app!</p>\n    </div>\n  )\n}\n\nexport default App\n`,
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
  if (path.endsWith('.md') || path.endsWith('.example')) return 'markdown';
  if (path.endsWith('.sql')) return 'sql';
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
  const res = await fetch('/api/generate-fullstack-code', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'claude-sonnet-4-6', ...body }),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || `HTTP ${res.status}`); }
  return res.json();
}

async function callInstructionAPI(body: Record<string, unknown>) {
  const res = await fetch('/api/fullstack-task-instruction', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'claude-sonnet-4-6', ...body }),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || `HTTP ${res.status}`); }
  return res.json();
}

async function callEvaluateAPI(promptHistory: PromptEntry[], projectFiles: ProjectFile[]) {
  const res = await fetch('/api/evaluate-fullstack-session', {
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

// ─── Onboarding card ──────────────────────────────────────────────────────────

const FullStackOnboarding: React.FC<{ onComplete: () => void }> = ({ onComplete }) => (
  <div className="flex-1 overflow-y-auto p-4 space-y-4">
    <div className="p-4 bg-emerald-500/10 border border-emerald-500/25 rounded-xl">
      <p className="text-xs font-bold text-emerald-400 uppercase mb-3">🏗️ Welcome to Full-Stack Development</p>
      <p className="text-sm text-gray-300 leading-relaxed mb-4">
        You're going to build a real, database-connected app using <strong className="text-white">React</strong> on
        the front-end and <strong className="text-white">Supabase</strong> (PostgreSQL) as your backend — the exact
        same stack used by startups and professional developers worldwide.
      </p>
      <p className="text-xs font-bold text-gray-400 uppercase mb-2">Your Full-Stack Architecture</p>
      <div className="bg-gray-900 rounded-lg p-3 font-mono text-xs leading-relaxed space-y-0.5 mb-3">
        <div className="text-sky-300">🌐 Browser (React + Vite)</div>
        <div className="ml-3 text-gray-400">├── <span className="text-cyan-300">src/App.jsx</span><span className="text-gray-600 ml-2">← UI components</span></div>
        <div className="ml-3 text-gray-400">└── <span className="text-cyan-300">src/lib/supabase.js</span><span className="text-gray-600 ml-2">← DB client</span></div>
        <div className="text-gray-600 ml-3 my-0.5">↕ REST API / WebSockets</div>
        <div className="text-purple-300">🗄️ Supabase (PostgreSQL)</div>
        <div className="ml-3 text-gray-400">├── <span className="text-emerald-300">Tables</span><span className="text-gray-600 ml-2">← your data lives here</span></div>
        <div className="ml-3 text-gray-400">├── <span className="text-emerald-300">Auth</span><span className="text-gray-600 ml-2">← login / signup built-in</span></div>
        <div className="ml-3 text-gray-400">└── <span className="text-emerald-300">RLS Policies</span><span className="text-gray-600 ml-2">← who can see what</span></div>
      </div>
    </div>

    <div className="grid grid-cols-2 gap-2">
      {[
        { icon: <Database size={14}/>, title: 'Supabase = your backend', desc: 'Free PostgreSQL + API, no server code needed', col: 'text-emerald-400' },
        { icon: <Table2 size={14}/>,   title: 'Tables store data',        desc: 'Like Excel sheets — rows & columns',            col: 'text-blue-400'    },
        { icon: <Code2 size={14}/>,    title: 'React reads & writes',     desc: 'useEffect fetches, forms insert rows',           col: 'text-purple-400'  },
        { icon: <Key size={14}/>,      title: 'Auth + RLS = secure',      desc: 'Each user only sees their own data',             col: 'text-amber-400'   },
      ].map((item, i) => (
        <div key={i} className="p-3 bg-gray-800/60 rounded-lg border border-gray-700">
          <div className={`flex items-center gap-1.5 mb-1 ${item.col}`}>{item.icon}<span className="text-xs font-bold">{item.title}</span></div>
          <p className="text-[11px] text-gray-400">{item.desc}</p>
        </div>
      ))}
    </div>

    <div className="p-3 bg-gray-800/40 rounded-lg border border-gray-700">
      <p className="text-xs font-bold text-gray-300 mb-1.5">🔑 What you need first</p>
      <p className="text-xs text-gray-400 leading-relaxed">
        Create a <strong className="text-white">free Supabase account</strong> at{' '}
        <a href="https://supabase.com" target="_blank" rel="noopener noreferrer" className="text-emerald-400 underline">supabase.com</a>.
        It takes 2 minutes. Every account gets one free project with a full PostgreSQL database,
        visual table editor, and SQL runner. The next task walks you through it step by step.
      </p>
    </div>

    <div className="p-3 bg-gray-800/40 rounded-lg border border-gray-700">
      <p className="text-xs font-bold text-gray-300 mb-1.5">💡 How this workshop works</p>
      <p className="text-xs text-gray-400 leading-relaxed">
        The <strong className="text-white">Tables tab</strong> on the right lets you browse your live Supabase tables.
        The <strong className="text-white">SQL tab</strong> shows SQL to run — copy it into your Supabase Dashboard SQL editor.
        The <strong className="text-white">Code tab</strong> holds your React files. All three update as you progress.
      </p>
    </div>

    <button onClick={onComplete}
      className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-colors">
      Got it — let's create my Supabase project! <ArrowRight size={16} />
    </button>
  </div>
);

// ─── Task stepper ─────────────────────────────────────────────────────────────

const TaskStepper: React.FC<{ tasks: TaskDef[]; taskIndex: number; onJump: (idx: number) => void }> = ({ tasks, taskIndex, onJump }) => {
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
                  <button key={task.id} onClick={() => isDone && onJump(globalIdx)} disabled={isFuture}
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

const FileTreePanel: React.FC<{ files: ProjectFile[]; activeFile: string; onSelect: (p: string) => void }> = ({ files, activeFile, onSelect }) => {
  const [openFolders, setOpenFolders] = useState<Set<string>>(new Set(['src', 'src/lib', 'src/components', 'src/pages']));
  const toggleFolder = (f: string) => setOpenFolders(prev => { const n = new Set(prev); n.has(f) ? n.delete(f) : n.add(f); return n; });

  type TNode = { name: string; path: string; isFolder: boolean; children: TNode[] };
  const buildTree = (files: ProjectFile[]): TNode[] => {
    const root: TNode[] = [];
    for (const file of files) {
      const parts = file.path.split('/');
      let cur = root;
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

// ─── Table Viewer panel ───────────────────────────────────────────────────────

const TableViewerPanel: React.FC<{ creds: SupaCredentials | null }> = ({ creds }) => {
  const [tables,       setTables]       = useState<string[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [rows,         setRows]         = useState<any[]>([]);
  const [columns,      setColumns]      = useState<string[]>([]);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  const fetchTables = useCallback(async () => {
    if (!creds?.url || !creds?.anonKey) return;
    setLoading(true); setError(null);
    try {
      // Supabase REST API root returns OpenAPI spec with all tables
      const res = await fetch(`${creds.url}/rest/v1/`, {
        headers: { 'apikey': creds.anonKey, 'Authorization': `Bearer ${creds.anonKey}` }
      });
      if (!res.ok) throw new Error(`Connection failed (${res.status}) — check your URL and anon key`);
      const spec = await res.json();
      const tableNames = Object.keys(spec?.definitions || spec?.paths || {})
        .filter(k => !k.startsWith('/') && !k.includes('{'))
        .sort();
      setTables(tableNames);
      if (tableNames.length === 0) setError('No tables found. Create some tables first in your Supabase dashboard.');
    } catch (e: any) {
      setError(e.message || 'Could not connect to Supabase');
    } finally { setLoading(false); }
  }, [creds]);

  const fetchRows = useCallback(async (tableName: string) => {
    if (!creds?.url || !creds?.anonKey) return;
    setLoading(true); setError(null); setRows([]); setColumns([]);
    try {
      const res = await fetch(`${creds.url}/rest/v1/${tableName}?limit=50`, {
        headers: { 'apikey': creds.anonKey, 'Authorization': `Bearer ${creds.anonKey}`, 'Accept': 'application/json' }
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail?.message || detail?.hint || `Failed to fetch ${tableName} (${res.status})`);
      }
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
      setColumns(data.length > 0 ? Object.keys(data[0]) : []);
    } catch (e: any) {
      setError(e.message || 'Could not fetch rows');
    } finally { setLoading(false); }
  }, [creds]);

  useEffect(() => { if (creds?.url && creds?.anonKey) fetchTables(); }, [creds, fetchTables]);

  useEffect(() => { if (selectedTable) fetchRows(selectedTable); }, [selectedTable, fetchRows]);

  if (!creds?.url || !creds?.anonKey) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 text-center">
        <div>
          <Database size={32} className="text-gray-600 mx-auto mb-3" />
          <p className="text-sm text-gray-400 font-medium">No Supabase project connected</p>
          <p className="text-xs text-gray-600 mt-1">Enter your credentials in the prompt panel to connect</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Table list */}
      <div className="w-40 flex-shrink-0 border-r border-gray-700 flex flex-col" style={{ background: '#161820' }}>
        <div className="flex items-center justify-between px-3 pt-2 pb-1 border-b border-gray-700 flex-shrink-0">
          <p className="text-[9px] font-bold text-gray-600 uppercase tracking-wide">Tables</p>
          <button onClick={fetchTables} disabled={loading} title="Refresh tables"
            className="text-gray-600 hover:text-emerald-400 transition-colors disabled:opacity-40">
            <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto py-1">
          {loading && tables.length === 0 && (
            <div className="flex items-center gap-1.5 px-3 py-2">
              <Loader2 size={11} className="animate-spin text-emerald-400" />
              <span className="text-[10px] text-gray-500">Loading…</span>
            </div>
          )}
          {tables.map(t => (
            <button key={t} onClick={() => setSelectedTable(t)}
              className={`w-full text-left flex items-center gap-1.5 px-3 py-1 text-[11px] rounded transition-colors
                ${selectedTable === t ? 'bg-emerald-500/20 text-emerald-300 font-semibold' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/40'}`}>
              <Table2 size={10} className="flex-shrink-0" />
              <span className="truncate">{t}</span>
            </button>
          ))}
          {!loading && tables.length === 0 && !error && (
            <p className="text-[10px] text-gray-600 px-3 py-2">No tables yet</p>
          )}
        </div>
      </div>

      {/* Row viewer */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {error && (
          <div className="m-3 p-3 bg-red-500/10 border border-red-500/25 rounded-lg flex gap-2">
            <AlertCircle size={13} className="text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-300">{error}</p>
          </div>
        )}

        {!selectedTable && !error && (
          <div className="flex-1 flex items-center justify-center text-center p-6">
            <div>
              <Table2 size={28} className="text-gray-600 mx-auto mb-2" />
              <p className="text-xs text-gray-500">Select a table to view its rows</p>
            </div>
          </div>
        )}

        {selectedTable && !error && (
          <>
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700 flex-shrink-0 bg-gray-800/50">
              <div className="flex items-center gap-2">
                <Table2 size={13} className="text-emerald-400" />
                <span className="text-xs font-semibold text-white">{selectedTable}</span>
                {rows.length > 0 && <span className="text-[10px] text-gray-500">{rows.length} rows</span>}
              </div>
              <button onClick={() => fetchRows(selectedTable)} disabled={loading}
                className="text-gray-600 hover:text-emerald-400 transition-colors disabled:opacity-40">
                <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>

            {loading ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 size={20} className="animate-spin text-emerald-400" />
              </div>
            ) : rows.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-center p-6">
                <div>
                  <Table2 size={24} className="text-gray-600 mx-auto mb-2" />
                  <p className="text-xs text-gray-500">This table is empty</p>
                  <p className="text-[10px] text-gray-600 mt-1">Insert some rows using the SQL tab or your app</p>
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-auto">
                <table className="w-full text-[11px] border-collapse">
                  <thead className="bg-gray-800 sticky top-0 z-10">
                    <tr>
                      {columns.map(col => (
                        <th key={col} className="text-left px-3 py-1.5 text-gray-400 font-semibold border-b border-gray-700 whitespace-nowrap">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr key={i} className={i % 2 === 0 ? 'bg-gray-900/30' : 'bg-gray-800/20'}>
                        {columns.map(col => (
                          <td key={col} className="px-3 py-1.5 text-gray-300 border-b border-gray-800/60 whitespace-nowrap max-w-[200px] truncate">
                            {row[col] === null
                              ? <span className="text-gray-600 italic">null</span>
                              : typeof row[col] === 'object'
                              ? <span className="text-blue-400">{JSON.stringify(row[col]).slice(0, 50)}</span>
                              : String(row[col]).slice(0, 80)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// ─── SQL Runner panel ─────────────────────────────────────────────────────────

const SqlRunnerPanel: React.FC<{ creds: SupaCredentials | null; generatedSql: string }> = ({ creds, generatedSql }) => {
  const [sql, setSql]           = useState('');
  const [results, setResults]   = useState<any[] | null>(null);
  const [columns, setColumns]   = useState<string[]>([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [copied, setCopied]     = useState(false);
  const [ranConfirm, setRanConfirm] = useState(false);

  // When the AI generates SQL, populate it automatically
  useEffect(() => { if (generatedSql) { setSql(generatedSql); setResults(null); setError(null); setRanConfirm(false); } }, [generatedSql]);

  const handleCopy = () => {
    navigator.clipboard.writeText(sql).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
  };

  const openDashboard = () => {
    if (!creds?.url) return;
    const projectRef = creds.url.replace('https://', '').replace('.supabase.co', '').split('.')[0];
    window.open(`https://supabase.com/dashboard/project/${projectRef}/sql/new`, '_blank');
  };

  // For simple SELECT queries, try to execute via REST API
  const handleRunSelect = useCallback(async () => {
    if (!creds?.url || !creds?.anonKey) { setError('Connect your Supabase project first'); return; }
    const trimmed = sql.trim().toUpperCase();
    if (!trimmed.startsWith('SELECT')) {
      setError('Direct execution only works for SELECT queries. For CREATE TABLE, INSERT, and other statements — copy the SQL and paste it into your Supabase Dashboard SQL Editor.');
      return;
    }
    // Extract table name from SELECT ... FROM tablename
    const fromMatch = sql.match(/FROM\s+["']?(\w+)["']?/i);
    if (!fromMatch) { setError('Could not determine the table name from your SELECT query.'); return; }
    const tableName = fromMatch[1];

    setLoading(true); setError(null); setResults(null);
    try {
      const res = await fetch(`${creds.url}/rest/v1/${tableName}?limit=100`, {
        headers: { 'apikey': creds.anonKey, 'Authorization': `Bearer ${creds.anonKey}`, 'Accept': 'application/json' }
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.message || d?.hint || `Query failed (${res.status})`);
      }
      const data = await res.json();
      setResults(Array.isArray(data) ? data : []);
      setColumns(data.length > 0 ? Object.keys(data[0]) : []);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [sql, creds]);

  const isSelect = sql.trim().toUpperCase().startsWith('SELECT');

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Editor area */}
      <div className="flex-shrink-0 border-b border-gray-700">
        <div className="flex items-center justify-between px-3 py-1.5 bg-gray-800/60 border-b border-gray-700">
          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">SQL Editor</span>
          <div className="flex items-center gap-1.5">
            <button onClick={handleCopy} disabled={!sql.trim()}
              className="flex items-center gap-1 px-2 py-0.5 text-[10px] text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors disabled:opacity-40">
              {copied ? <Check size={11} /> : <Copy size={11} />} {copied ? 'Copied' : 'Copy'}
            </button>
            {creds?.url && (
              <button onClick={openDashboard}
                className="flex items-center gap-1 px-2 py-0.5 text-[10px] text-emerald-400 hover:text-white hover:bg-emerald-600/30 border border-emerald-500/30 rounded transition-colors">
                <Globe size={11} /> Open Dashboard
              </button>
            )}
          </div>
        </div>
        <textarea
          value={sql} onChange={e => setSql(e.target.value)}
          rows={8} spellCheck={false}
          placeholder="-- SQL generated by the AI coach will appear here&#10;-- You can also type your own queries&#10;&#10;SELECT * FROM my_table LIMIT 10;"
          className="w-full bg-gray-900 font-mono text-xs text-gray-200 px-3 py-2.5 outline-none resize-none placeholder-gray-700 leading-relaxed"
          style={{ fontFamily: "'Fira Code', 'Consolas', monospace" }}
        />
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-800/40 border-b border-gray-700 flex-shrink-0">
        {isSelect ? (
          <button onClick={handleRunSelect} disabled={loading || !sql.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors disabled:opacity-40">
            {loading ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
            Run SELECT
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <p className="text-xs text-amber-300 font-medium">📋 DDL / DML — run in Supabase Dashboard:</p>
            <button onClick={handleCopy}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-white bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors">
              {copied ? <Check size={11} /> : <Copy size={11} />} {copied ? 'Copied!' : '1. Copy SQL'}
            </button>
            {creds?.url && (
              <button onClick={openDashboard}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-lg transition-colors">
                <Globe size={11} /> 2. Open Dashboard
              </button>
            )}
            <button onClick={() => setRanConfirm(r => !r)}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg border transition-colors ${ranConfirm ? 'bg-blue-600 text-white border-blue-500' : 'text-gray-400 border-gray-600 hover:text-white hover:border-gray-400'}`}>
              <CheckCircle size={11} /> {ranConfirm ? 'Ran it ✓' : '3. I ran it'}
            </button>
          </div>
        )}
      </div>

      {/* Guide for non-SELECT */}
      {!isSelect && sql.trim() && (
        <div className="mx-3 mt-3 p-3 bg-blue-500/10 border border-blue-500/25 rounded-lg text-xs text-gray-300 leading-relaxed flex-shrink-0">
          <p className="font-bold text-blue-400 mb-1">How to run this SQL</p>
          <ol className="list-decimal ml-4 space-y-1 text-gray-400">
            <li>Click <strong className="text-white">Copy SQL</strong> above</li>
            <li>Click <strong className="text-white">Open Dashboard</strong> — your Supabase SQL editor opens</li>
            <li>Paste the SQL and click the green <strong className="text-white">Run</strong> button</li>
            <li>Come back here and click <strong className="text-white">I ran it ✓</strong></li>
          </ol>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mx-3 mt-3 p-2.5 bg-red-500/10 border border-red-500/20 rounded-lg flex gap-2 flex-shrink-0">
          <AlertCircle size={12} className="flex-shrink-0 text-red-400 mt-0.5" />
          <p className="text-xs text-red-300">{error}</p>
        </div>
      )}

      {/* Results */}
      {results !== null && (
        <div className="flex-1 overflow-auto mt-2">
          {results.length === 0 ? (
            <p className="text-xs text-gray-500 px-3 py-2">Query returned 0 rows</p>
          ) : (
            <table className="w-full text-[11px] border-collapse">
              <thead className="bg-gray-800 sticky top-0">
                <tr>
                  {columns.map(col => (
                    <th key={col} className="text-left px-3 py-1.5 text-gray-400 font-semibold border-b border-gray-700 whitespace-nowrap">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {results.map((row, i) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-gray-900/30' : 'bg-gray-800/20'}>
                    {columns.map(col => (
                      <td key={col} className="px-3 py-1.5 text-gray-300 border-b border-gray-800/60 whitespace-nowrap max-w-[200px] truncate">
                        {row[col] === null ? <span className="text-gray-600 italic">null</span> : String(row[col]).slice(0, 80)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Credentials panel (shown during setup task) ─────────────────────────────

const CredentialsPanel: React.FC<{
  creds: SupaCredentials; onChange: (c: SupaCredentials) => void; onTest: () => void;
  testStatus: 'idle' | 'testing' | 'ok' | 'fail'; testMsg: string;
}> = ({ creds, onChange, onTest, testStatus, testMsg }) => {
  const [showKey, setShowKey] = useState(false);
  return (
    <div className="p-3 bg-gray-800/60 border border-emerald-500/20 rounded-xl space-y-3">
      <p className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
        <Key size={12} /> Connect Your Supabase Project
      </p>
      <div className="space-y-2">
        <div>
          <label className="text-[10px] text-gray-500 uppercase font-bold block mb-1">Project URL</label>
          <input
            type="text" value={creds.url} placeholder="https://xxxx.supabase.co"
            onChange={e => onChange({ ...creds, url: e.target.value })}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-gray-600 outline-none focus:border-emerald-500 transition-colors font-mono"
          />
        </div>
        <div>
          <label className="text-[10px] text-gray-500 uppercase font-bold block mb-1">Anon / Public Key</label>
          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'} value={creds.anonKey} placeholder="eyJhbGci…"
              onChange={e => onChange({ ...creds, anonKey: e.target.value })}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-2.5 py-1.5 pr-8 text-xs text-white placeholder-gray-600 outline-none focus:border-emerald-500 transition-colors font-mono"
            />
            <button onClick={() => setShowKey(s => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-300">
              {showKey ? <EyeOff size={11} /> : <Eye size={11} />}
            </button>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={onTest} disabled={!creds.url || !creds.anonKey || testStatus === 'testing'}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors disabled:opacity-40">
          {testStatus === 'testing' ? <Loader2 size={11} className="animate-spin" /> : <Play size={11} />}
          Test Connection
        </button>
        {testStatus === 'ok'   && <span className="text-xs text-emerald-400 flex items-center gap-1"><CheckCircle size={11} /> {testMsg}</span>}
        {testStatus === 'fail' && <span className="text-xs text-red-400 flex items-center gap-1"><AlertCircle size={11} /> {testMsg}</span>}
      </div>
      <p className="text-[9px] text-gray-600">
        Find these in your Supabase project → Settings → API. Your anon key is safe to use in the browser.
      </p>
    </div>
  );
};

// ─── Voice helper ─────────────────────────────────────────────────────────────

// ═══════════════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════════════

const FullStackDevelopmentPage: React.FC = () => {
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
        // Default Nigerian voice for Africa; British for everyone else
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

  const speakTextRef = useRef<(text: string) => void>(() => {});
  const speakText = useCallback((text: string) => {
    if (!voiceOutputEnabled || !text.trim()) return;
    hookSpeak(text);
  }, [voiceOutputEnabled, hookSpeak]);
  useEffect(() => { speakTextRef.current = speakText; }, [speakText]);

  // ── Supabase student credentials ─────────────────────────────────────
  const [creds, setCreds] = useState<SupaCredentials>(() => {
    try { const s = localStorage.getItem(LS_CREDS_KEY); return s ? JSON.parse(s) : { url: '', anonKey: '' }; }
    catch { return { url: '', anonKey: '' }; }
  });
  const [credTestStatus, setCredTestStatus] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle');
  const [credTestMsg,    setCredTestMsg]    = useState('');

  const updateCreds = (c: SupaCredentials) => {
    setCreds(c); setCredTestStatus('idle');
    try { localStorage.setItem(LS_CREDS_KEY, JSON.stringify(c)); } catch {}
  };

  const testConnection = async () => {
    if (!creds.url || !creds.anonKey) return;
    setCredTestStatus('testing');
    try {
      const res = await fetch(`${creds.url}/rest/v1/`, {
        headers: { 'apikey': creds.anonKey, 'Authorization': `Bearer ${creds.anonKey}` }
      });
      if (res.ok) { setCredTestStatus('ok'); setCredTestMsg('Connected!'); }
      else { setCredTestStatus('fail'); setCredTestMsg(`Error ${res.status}`); }
    } catch {
      setCredTestStatus('fail'); setCredTestMsg('Network error — check your URL');
    }
  };

  // ── Session ──────────────────────────────────────────────────────────
  const [sessionId, setSessionId]             = useState<string | null>(null);
  const [sessionName, setSessionName]         = useState('Untitled App');
  const [sessions, setSessions]               = useState<SessionRecord[]>([]);
  const [showSessionPicker, setShowSessionPicker] = useState(false);
  const sessionIdRef = useRef<string | null>(null);
  useEffect(() => { sessionIdRef.current = sessionId; }, [sessionId]);

  // ── Project files ────────────────────────────────────────────────────
  const [projectFiles, setProjectFiles]     = useState<ProjectFile[]>(STARTER_FILES);
  const [activeFilePath, setActiveFilePath] = useState('src/App.jsx');
  const activeFile = projectFiles.find(f => f.path === activeFilePath) ?? projectFiles[0];

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
  const [prompt, setPrompt]                 = useState('');
  const [promptHistory, setPromptHistory]   = useState<PromptEntry[]>([]);
  const [isGenerating, setIsGenerating]     = useState(false);
  const [isCritiquing, setIsCritiquing]     = useState(false);
  const [errorMsg, setErrorMsg]             = useState<string | null>(null);
  const [aiExplanation, setAiExplanation]   = useState<string | null>(null);
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

  // ── Right panel ──────────────────────────────────────────────────────
  const [rightTab, setRightTab]       = useState<RightTab>('code');
  const [generatedSql, setGeneratedSql] = useState('');
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  const [copied, setCopied]           = useState(false);
  const [stepperOpen, setStepperOpen]         = useState(false);
  const [editorTab, setEditorTab]             = useState<'teaching' | 'code' | 'tables' | 'sql'>('teaching');
  const [showTeachingPopup, setShowTeachingPopup] = useState(false);
  const [showBuiltPopup, setShowBuiltPopup]   = useState(false);
  const [showHelpPopup, setShowHelpPopup]     = useState(false);
  const [helpLoading, setHelpLoading]         = useState(false);
  const [helpResponse, setHelpResponse]       = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const currentTask  = TASKS[taskIndex];
  const currentPhase = currentTask?.phase ?? 1;
  const pm           = PHASE_META[currentPhase];

  // ── Load sessions ─────────────────────────────────────────────────────
  const loadSessions = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase.from('dashboard')
      .select('id, fs_session_id, fs_session_name, fs_pages, fs_prompts, fs_evaluation, updated_at')
      .eq('user_id', userId).eq('activity', FS_ACTIVITY)
      .not('fs_session_id', 'is', null).order('updated_at', { ascending: false });
    if (data?.length) { setSessions(data as SessionRecord[]); if (!sessionId) setShowSessionPicker(true); }
  }, [userId, sessionId]);
  useEffect(() => { if (userId) loadSessions(); }, [userId, loadSessions]);

  const ensureSession = useCallback(async (): Promise<string> => {
    if (sessionIdRef.current) return sessionIdRef.current;
    const sid = makeId(); sessionIdRef.current = sid; setSessionId(sid);
    if (userId) {
      await supabase.from('dashboard').insert({
        user_id: userId, activity: FS_ACTIVITY,
        fs_session_id: sid, fs_session_name: sessionName,
        fs_pages: STARTER_FILES.map(f => ({ path: f.path, content: f.content })),
        fs_prompts: [], fs_evaluation: { taskIndex: 0, sessionContext: {} },
      });
    }
    return sid;
  }, [userId, sessionName]);

  const persistSession = useCallback(async (
    files: ProjectFile[], prompts: PromptEntry[], tIdx: number, ctx: Record<string, any>,
  ) => {
    const sid = sessionIdRef.current; if (!userId || !sid) return;
    await supabase.from('dashboard').update({
      fs_pages: files.map(f => ({ path: f.path, content: f.content })),
      fs_prompts: prompts,
      fs_evaluation: { taskIndex: tIdx, sessionContext: ctx },
      fs_session_name: sessionName, updated_at: new Date().toISOString(),
    }).eq('user_id', userId).eq('fs_session_id', sid);
  }, [userId, sessionName]);

  const createNewSession = useCallback(async () => {
    if (!userId) return;
    const sid = makeId();
    await supabase.from('dashboard').insert({
      user_id: userId, activity: FS_ACTIVITY,
      fs_session_id: sid, fs_session_name: 'Untitled App',
      fs_pages: STARTER_FILES.map(f => ({ path: f.path, content: f.content })),
      fs_prompts: [], fs_evaluation: { taskIndex: 0, sessionContext: {} },
    });
    setSessionId(sid); sessionIdRef.current = sid;
    setSessionName('Untitled App'); setProjectFiles(STARTER_FILES);
    setActiveFilePath('src/App.jsx'); setTaskIndex(0);
    setPromptHistory([]); setEvaluation(null); setSessionContext({});
    setTaskHasGeneration(false); setShowSessionPicker(false);
    setTaskInstruction(null); setPrompt(''); setAiExplanation(null); setErrorMsg(null);
  }, [userId]);

  const loadSession = useCallback((s: SessionRecord) => {
    setSessionId(s.fs_session_id); sessionIdRef.current = s.fs_session_id;
    setSessionName(s.fs_session_name);
    const files: ProjectFile[] = (s.fs_pages || []).map((p: any) => ({ path: p.path || p.name, content: p.content || p.code || '' }));
    setProjectFiles(files.length > 0 ? files : STARTER_FILES);
    setActiveFilePath('src/App.jsx');
    const ev = s.fs_evaluation || {};
    setTaskIndex(ev.taskIndex ?? 0); setSessionContext(ev.sessionContext ?? {});
    setEvaluation(ev.scores || null); setPromptHistory(s.fs_prompts || []);
    setTaskHasGeneration(false); setShowSessionPicker(false);
    setTaskInstruction(null); setPrompt(''); setAiExplanation(null); setErrorMsg(null); setSubTaskCritique(null);
  }, []);

  const handleDeleteSession = useCallback(async (e: React.MouseEvent, sid: string) => {
    e.stopPropagation(); if (!userId) return;
    setDeletingSessionId(sid);
    try {
      await supabase.from('dashboard').update({
        fs_session_id: null, fs_session_name: null, fs_pages: null, fs_prompts: null, fs_evaluation: null,
      }).eq('user_id', userId).eq('fs_session_id', sid);
      setSessions(prev => prev.filter(s => s.fs_session_id !== sid));
    } finally { setDeletingSessionId(null); }
  }, [userId]);

  // Script-authoritative questions
  const SCRIPT_SEEDS: Record<string, { teaching: string; question: string }[]> = {
    supabase_setup: [
      { teaching: "Every full-stack app needs a backend. Supabase gives you a free PostgreSQL database, API, and authentication in minutes. The anon key is public-safe but never expose the service role key.",
        question: "Have you created a free account at supabase.com? Paste your Project URL here, or describe the app you want to build." },
      { teaching: "The anon key controls what unauthenticated users can access. Row Level Security policies determine what it can and cannot read or write. Understanding this now prevents the most common full-stack security mistake.",
        question: "Find your anon key in Supabase Settings > API. Paste it into the Credentials panel, then click Test Connection. What status does it show?" },
      { teaching: "Environment variables keep secrets out of your source code. The .env file is never pushed to GitHub. This pattern is used by every production application.",
        question: "Confirm your .env file has VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY set. Is your .env file listed in .gitignore?" },
    ],
    schema_design: [
      { teaching: "A schema is the blueprint of your database. Designing it before creating tables prevents mistakes that are costly to fix later.",
        question: "What is the main purpose of your app? What is the single most important type of data it stores?" },
      { teaching: "Every table needs a clear, single purpose. Naming tables as plural nouns is universal convention. Primary keys should be UUIDs for distributed systems.",
        question: "List the 2-4 tables your app needs. For each, describe its purpose and list the most important columns with their data types." },
      { teaching: "Relationships connect tables through foreign keys. They enforce data integrity and enable joins -- fetching related data in one query.",
        question: "Describe the relationships between your tables. Which column in which table references which other table?" },
    ],
    create_tables: [
      { teaching: "CREATE TABLE defines a table structure. Each column has a name, a data type, and optional constraints. DEFAULT NOW() records the timestamp automatically.",
        question: "Generate the SQL to create your main content table with all columns, primary key, foreign keys, and default values." },
      { teaching: "Indexes make queries fast. Without an index, fetching rows by a column requires scanning every row. Index the columns your app filters and sorts by most often.",
        question: "What queries will your app run most often? Which columns should have indexes? Generate CREATE INDEX statements for those columns." },
      { teaching: "A trigger automatically runs a function when something happens -- like updating updated_at whenever a row changes. Written once, it works everywhere.",
        question: "Create a trigger to automatically update the updated_at column whenever a row is modified. Show the function and the trigger definition." },
    ],
    connect_react: [
      { teaching: "The Supabase client knows how to talk to your database. Created once in src/lib/supabase.js and imported anywhere you need database access.",
        question: "Look at src/lib/supabase.js in your file tree. Describe what createClient does and how you would import the client in a component." },
      { teaching: "A custom hook encapsulates data-fetching logic. Instead of writing the same useEffect and useState pattern everywhere, write it once in a hook and call it anywhere.",
        question: "Design a custom hook for your main data type. What state does it manage, what query does it run, and what does it return?" },
      { teaching: "A connection test component verifies the database is reachable before building the full UI. Build this first -- a failed test tells you immediately if credentials are wrong.",
        question: "Build a DatabaseStatus component that tests the connection and shows how many rows are in your main table." },
    ],
    read_data: [
      { teaching: "Reading data uses the select method. Real queries filter with .eq(), sort with .order(), limit with .limit(), and join related tables by naming them in the select string.",
        question: "Build your main listing page. Fetch all active records from your primary table and display them as cards. Include loading and error states." },
      { teaching: "Filtering narrows results. .eq() for exact matches, .ilike() for partial matches, .in() for a list of values. Combining filters applies multiple conditions at once.",
        question: "Add filtering to your listing page. What filters make sense for your data? Describe the filter UI and the queries it generates." },
      { teaching: "A detail page shows the full content of one record, fetched by ID from the URL. React Router useParams() extracts the ID. .single() returns one object instead of an array.",
        question: "Build the single record detail page. How does it get the ID from the URL and what does the full-detail view show?" },
    ],
    write_data: [
      { teaching: "INSERT adds a new row. The user_id comes from the authenticated session -- never trust the client to say who they are. Read the user ID from supabase.auth.getUser().",
        question: "Build the submission form. What fields does it have, how does it validate, and what happens on successful submission?" },
      { teaching: "UPDATE modifies an existing row. Always chain .update() with a .eq() filter on the primary key. Always verify the user owns the record before updating.",
        question: "Build the edit interface. How does a user reach their own records and what can they change? Show the update query with the ownership check." },
      { teaching: "Optimistic updates improve perceived performance -- update the UI immediately and roll back if the database call fails.",
        question: "Add a status change button. How does optimistic update work here? What happens if the database call fails?" },
    ],
    auth: [
      { teaching: "Supabase Auth handles email/password signup, login, and session management with no server code. supabase.auth.getUser() works anywhere in your app.",
        question: "Build the sign-up and sign-in forms. What fields do they have and what happens after successful authentication?" },
      { teaching: "Auth context makes the current user available everywhere without prop drilling. A React context wraps the entire application and exposes the current user to any component.",
        question: "Build an AuthContext and ProtectedRoute component. Which pages require authentication and which are public?" },
      { teaching: "The navigation bar should reflect auth state without a page reload. Subscribe to auth state changes directly in the nav component.",
        question: "Update your Navbar to show different options based on auth state. What does the signed-in navigation look like?" },
    ],
    rls: [
      { teaching: "Row Level Security is the most important security feature. Without RLS, anyone with your anon key can read or write every row. Enable RLS on every table. Default deny. Explicit allow.",
        question: "Enable RLS on your tables and write the policy that allows the right users to read your public content." },
      { teaching: "Write policies use auth.uid() -- a Supabase function that returns the current user ID. A policy using auth.uid() = user_id means each user can only touch rows they created.",
        question: "Write the INSERT, UPDATE, and DELETE policies with auth.uid() checks for authenticated users." },
      { teaching: "Test RLS by signing in with two different accounts and confirming each only sees their own private data. Test before deploying.",
        question: "Test your RLS policies. What did you test and what did you find? Describe any fix needed." },
    ],
    deploy_prep: [
      { teaching: "Deploying a Vite + React + Supabase app to Vercel takes under five minutes. The connection between Vercel and Supabase is the environment variables set in Vercel's dashboard -- not your .env file.",
        question: "Walk through the deployment steps. What environment variables does Vercel need and where do you set them?" },
      { teaching: "Supabase needs to know which URLs are allowed to make requests. After deployment, add your Vercel URL to allowed redirect URLs and CORS origins.",
        question: "What Supabase settings need to be updated after deployment? Check Authentication > URL Configuration and Settings > API > CORS." },
      { teaching: "A production checklist prevents common deployment mistakes: RLS enabled, no sensitive keys in source code, .env in .gitignore, user-friendly error messages.",
        question: "Walk through the production readiness checklist. Confirm RLS, environment variables, error handling, and protected routes are all correct." },
    ],
  };

  const handleJumpToTask = useCallback(async (idx: number) => {
    if (idx === taskIndex || idx >= taskIndex) return;
    setTaskIndex(idx); setSubTaskIndex(0); setSubTaskCritique(null);
    setPrompt(''); setAiExplanation(null); setErrorMsg(null);
    setEditorTab('teaching'); setStepperOpen(false);
    const lastEntry = [...promptHistory].reverse().find((e: any) => e.taskId === TASKS[idx]?.id);
    if (lastEntry?.aiExplanation) setAiExplanation(lastEntry.aiExplanation);
    await fetchTaskInstruction(idx, projectFiles, sessionContext);
  }, [taskIndex, projectFiles, promptHistory, sessionContext]);

  const handleHelpRequest = useCallback(async () => {
    if (!taskInstruction?.subTasks?.[subTaskIndex]) return;
    setShowHelpPopup(true); setHelpLoading(true); setHelpResponse(null);
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6', max_tokens: 600,
          system: 'You are a friendly full-stack development coach. Explain what the question is asking in simple terms. Give a short concrete example of a good answer. Under 150 words. No jargon.',
          messages: [{ role: 'user', content: 'Task: "' + currentTask?.label + '". Question: "' + taskInstruction.subTasks[subTaskIndex] + '". Explain and give an example answer.' }],
        }),
      });
      const data = await res.json();
      setHelpResponse(data.content?.[0]?.text || 'Sorry, could not load help right now.');
    } catch { setHelpResponse('Sorry, could not load help right now.'); }
    finally { setHelpLoading(false); }
  }, [taskInstruction, subTaskIndex, currentTask]);

  const handleSkipSubTask = useCallback(() => {
    if (!taskInstruction) return;
    const nextIdx = subTaskIndex + 1;
    if (nextIdx >= taskInstruction.subTasks.length) { handleCompleteTask(); }
    else { setSubTaskIndex(nextIdx); setSubTaskCritique(null); setPrompt(''); }
  }, [subTaskIndex, taskInstruction, handleCompleteTask]);


  // ── Fetch task instruction ────────────────────────────────────────────
  const fetchTaskInstruction = useCallback(async (idx: number, files: ProjectFile[], ctx: Record<string, any>) => {
    const task = TASKS[idx]; if (!task || task.isOnboarding) return;
    setLoadingInstruction(true); setTaskInstruction(null);
    const canonicalSeeds = SCRIPT_SEEDS[task.id] ?? [
      { teaching: `This task builds a core full-stack skill: ${task.label}.`, question: `Describe what you want to achieve: ${task.label}` },
    ];
    try {
      const fileSummary = files.filter(f => f.content.length > 10).map(f => ({ path: f.path, preview: f.content.substring(0, 400) }));
      const result = await callInstructionAPI({
        taskId: task.id, taskLabel: task.label, phase: task.phase,
        projectFiles: fileSummary, sessionContext: ctx,
        completedTasks: TASKS.slice(0, idx).map(t => t.id),
        communicationStrategy, learningStrategy,
        supabaseConnected: !!(creds.url && creds.anonKey),
        scriptSubTasks: canonicalSeeds.map((s: any) => s.question),
        scriptTeaching: canonicalSeeds.map((s: any) => s.teaching),
      });
      setTaskInstruction({
        headline: result.headline || task.label,
        context: result.context || `Working on: ${task.label}`,
        subTasks: canonicalSeeds.map((s: any) => s.question),
        subTaskTeaching: canonicalSeeds.map((s: any) => s.teaching),
        examplePrompt: canonicalSeeds[0].question,
      });
      speakTextRef.current(canonicalSeeds[0].teaching + ' ' + canonicalSeeds[0].question);
      setEditorTab('teaching');
    } catch {
      // Fallback instruction seeds per task
      const fallbacks: Record<string, { teaching: string; question: string }[]> = {
        supabase_setup: [
          { teaching: 'Every full-stack app needs a backend. Supabase gives you a free PostgreSQL database, an API, and authentication in minutes — no server code required.',
            question: 'Have you created a free account at supabase.com? Tell me your project URL (e.g. https://xxxx.supabase.co) — or describe what app you want to build.' },
          { teaching: 'The anon key is a safe public key — it identifies your project but only allows what your security rules permit. You will use it in your React code.',
            question: 'Find your anon key in Supabase → Settings → API. Paste it into the Credentials panel on the right, then click Test Connection.' },
        ],
        schema_design: [
          { teaching: 'A database schema is a blueprint of your tables. Designing it before creating tables prevents mistakes that are costly to fix later.',
            question: 'What is the main purpose of your app? Describe it in one sentence — e.g. "A task tracker where users log daily goals".' },
          { teaching: 'Every table needs a clear purpose. Naming tables as plural nouns (users, posts, tasks) is a universal convention that makes your code easier to read.',
            question: 'What are the 2–3 main things your app stores? List each one — e.g. "users, goals, completions". These will become your tables.' },
          { teaching: 'Columns define what data each row holds. For now focus on the most essential data — you can always add columns later.',
            question: 'For your most important table, list the columns it needs. Include the data type — e.g. "id (uuid), title (text), created_at (timestamp), user_id (uuid)".' },
        ],
        create_tables: [
          { teaching: 'SQL is the universal language for creating and querying databases. CREATE TABLE is the first command every developer learns.',
            question: 'Based on your schema design, describe the first table you want to create. I will generate the CREATE TABLE SQL for you to run in your Supabase Dashboard.' },
          { teaching: 'After running SQL, always verify it worked. SELECT * FROM table_name in the SQL tab confirms your table exists and the structure is correct.',
            question: 'Run the SQL I generated in your Supabase Dashboard (SQL Editor tab). Did it work? Tell me what you see in your Tables panel.' },
        ],
        connect_react: [
          { teaching: 'The Supabase JavaScript client is a small library that connects your React app to your database. It is already in your package.json.',
            question: 'Look at src/lib/supabase.js in your code. Describe what it does — what is createClient, and what are the two values it needs?' },
          { teaching: 'Environment variables (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY) keep secrets out of your code. Never hardcode API keys directly in .jsx files.',
            question: 'Create a .env file in your project root (copy from .env.example) and fill in your URL and anon key. Then tell me what your app should display on the home page.' },
        ],
        read_data: [
          { teaching: 'useEffect with an empty dependency array runs once when the component mounts — perfect for fetching initial data from Supabase.',
            question: 'Which table do you want to display on your home page? Describe what a typical row looks like.' },
          { teaching: 'useState stores your fetched rows so React can re-render when data arrives. You need two states: one for the data array, one for a loading boolean.',
            question: 'Describe how the data should look on screen — as a list, a grid, a table? What columns from the row should be visible to the user?' },
        ],
        write_data: [
          { teaching: 'Every app that creates data needs a form. In React, controlled inputs use useState to track what the user types before submitting.',
            question: 'What data does the user need to enter in your form? List the fields — e.g. "title (text input), due_date (date picker), description (textarea)".' },
          { teaching: 'supabase.from(table).insert({}) sends a new row to your database. The .select() at the end returns the created row so you can add it to local state immediately.',
            question: 'After inserting a row, what should happen in the UI? Should the form clear, the new item appear in the list, or a success message show?' },
        ],
        auth: [
          { teaching: 'Supabase Auth handles email/password signup, login, and session management out of the box. You never store passwords — Supabase does it securely.',
            question: 'Do you want email/password auth, or magic link (passwordless)? Describe how users will sign up and log in to your app.' },
          { teaching: 'useEffect watching supabase.auth.onAuthStateChange keeps your app in sync with the user session — when they log in or out, your UI updates automatically.',
            question: 'What should logged-in users see that guests cannot? Describe the protected parts of your app.' },
        ],
        rls: [
          { teaching: 'Row Level Security (RLS) is PostgreSQL\'s built-in security system. Without it, any user with your anon key could read or write everyone\'s data.',
            question: 'For each of your tables, describe who should be allowed to read and who should be allowed to write. Example: "Only the owner can see their own tasks".' },
          { teaching: 'RLS policies use auth.uid() to identify the current logged-in user. A policy like "user_id = auth.uid()" means each user only sees rows they created.',
            question: 'Run the RLS policies I generate for your main table. Then test it — create two accounts and confirm each one only sees their own data.' },
        ],
        deploy_prep: [
          { teaching: 'Vercel is the standard deployment platform for Vite + React apps. It connects to GitHub, auto-deploys on every push, and is free for personal projects.',
            question: 'Is your project in a GitHub repository? If not, create one now. Paste the repo URL here so I can generate the final deployment checklist.' },
          { teaching: 'Environment variables must be set in Vercel separately — they are never read from your .env file in production. This is the most common deployment mistake.',
            question: 'Tell me your VITE_SUPABASE_URL and confirm you have added it as an environment variable in Vercel (Settings → Environment Variables). What is the live URL of your deployed app?' },
        ],
      };
      const seeds = fallbacks[task.id] ?? [
        { teaching: `This task — ${task.label} — builds a core skill every full-stack developer uses daily.`,
          question: `Describe what you want to achieve in this step: ${task.label}` },
      ];
      setTaskInstruction({
        headline: task.label, context: `Working on: ${task.label}`,
        subTasks: seeds.map(s => s.question), subTaskTeaching: seeds.map(s => s.teaching),
        examplePrompt: seeds[0].question,
      });
    } finally { setLoadingInstruction(false); }
  }, [communicationStrategy, learningStrategy, creds]);

  useEffect(() => {
    if (taskIndex > 0) fetchTaskInstruction(taskIndex, projectFiles, sessionContext);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskIndex]);

  // ── Generate code ────────────────────────────────────────────────────
  const handleGenerate = useCallback(async () => {
    if (!prompt.trim() || isGenerating) return;
    setIsGenerating(true); setErrorMsg(null); setAiExplanation(null); setSubTaskCritique(null);
    await ensureSession();
    const entry: PromptEntry = {
      id: makeId(), taskId: currentTask?.id, subTaskIndex,
      subTaskQuestion: taskInstruction?.subTasks[subTaskIndex],
      subTaskTeaching: taskInstruction?.subTaskTeaching?.[subTaskIndex],
      prompt, timestamp: new Date().toISOString(), action: taskHasGeneration ? 'iterate' : 'generate',
    };
    try {
      const result = await callGenerateAPI({
        action: entry.action, prompt,
        taskId: currentTask?.id, taskLabel: currentTask?.label, phase: currentTask?.phase,
        projectFiles: projectFiles.map(f => ({ path: f.path, content: f.content })),
        sessionContext, communicationStrategy, learningStrategy,
        supabaseUrl: creds.url, supabaseConnected: !!(creds.url && creds.anonKey),
      });

      // Update files
      if (result.files?.length) {
        const updated = mergeFiles(projectFiles, result.files);
        setProjectFiles(updated);
        if (result.files.length === 1) setActiveFilePath(result.files[0].path);
        entry.filesModified = result.files.map((f: any) => f.path);

        // If the result includes SQL, populate the SQL runner and switch to that tab
        const sqlFile = result.files.find((f: any) => f.path.endsWith('.sql'));
        if (sqlFile) { setGeneratedSql(sqlFile.content); setRightTab('sql'); }
        else if (result.sql) { setGeneratedSql(result.sql); setRightTab('sql'); }
      }
      // Also handle SQL returned outside files
      if (result.sql && !result.files?.find((f: any) => f.path.endsWith('.sql'))) {
        setGeneratedSql(result.sql); setRightTab('sql');
      }

      entry.aiExplanation = result.explanation;
      setAiExplanation(result.explanation || null);

      // Critique the student's prompt
      if (prompt.trim().length > 10) {
        setIsCritiquingResponse(true);
        const subQ = taskInstruction?.subTasks[subTaskIndex] || '';
        fetch('/api/fullstack-task-instruction', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'claude-sonnet-4-6', mode: 'critique', prompt, subTaskQuestion: subQ, taskId: currentTask?.id, communicationStrategy, learningStrategy }),
        }).then(r => r.ok ? r.json() : null).then(d => {
          if (d?.feedback) {
            entry.aiCritique = d.feedback; entry.hasSuggestions = d.hasSuggestions;
            setSubTaskCritique({ hasSuggestions: !!d.hasSuggestions, feedback: d.feedback });
            if (!d.hasSuggestions) speakTextRef.current(d.feedback.substring(0, 200));
          }
        }).catch(() => {}).finally(() => setIsCritiquingResponse(false));
      }

      // Advance sub-task if no critique suggestions
      const newHistory = [...promptHistory, entry];
      setPromptHistory(newHistory); setTaskHasGeneration(true); setPrompt('');

      // Update session context
      const newCtx = { ...sessionContext };
      if (currentTask?.id === 'supabase_setup' && creds.url) newCtx.supabaseUrl = creds.url;
      if (currentTask?.id === 'schema_design') newCtx.schemaNotes = (newCtx.schemaNotes || '') + '\n' + prompt;
      setSessionContext(newCtx);

      await persistSession(projectFiles, newHistory, taskIndex, newCtx);
      if (voiceOutputEnabled) speakTextRef.current(result.explanation?.substring(0, 180) || 'Done!');

    } catch (err: any) {
      setErrorMsg(err.message || 'Something went wrong'); entry.action = 'feedback';
      setPromptHistory(prev => [...prev, entry]);
    } finally { setIsGenerating(false); }
  }, [prompt, isGenerating, currentTask, taskInstruction, subTaskIndex, projectFiles,
      sessionContext, promptHistory, taskHasGeneration, creds, communicationStrategy,
      learningStrategy, ensureSession, persistSession, voiceOutputEnabled]);

  const handleCritique = useCallback(async () => {
    if (!prompt.trim() || isCritiquing) return;
    setIsCritiquing(true); setSubTaskCritique(null);
    try {
      const res = await fetch('/api/fullstack-task-instruction', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'claude-sonnet-4-6', mode: 'critique', prompt, subTaskQuestion: taskInstruction?.subTasks[subTaskIndex] || '', taskId: currentTask?.id, communicationStrategy, learningStrategy }),
      });
      if (res.ok) {
        const d = await res.json();
        if (d?.feedback) setSubTaskCritique({ hasSuggestions: !!d.hasSuggestions, feedback: d.feedback });
      }
    } catch {} finally { setIsCritiquing(false); }
  }, [prompt, isCritiquing, currentTask, taskInstruction, subTaskIndex, communicationStrategy, learningStrategy]);

  const handleMoveToNextStep = () => {
    const next = subTaskIndex + 1;
    if (next < (taskInstruction?.subTasks?.length ?? 1)) {
      setSubTaskIndex(next); setSubTaskCritique(null); setPrompt(''); setAiExplanation(null);
      if (taskInstruction?.subTaskTeaching?.[next] && taskInstruction?.subTasks?.[next]) {
        speakTextRef.current(taskInstruction.subTaskTeaching[next] + ' ' + taskInstruction.subTasks[next]);
      }
    }
  };

  const handleCompleteTask = useCallback(async () => {
    if (taskIndex >= TASKS.length - 1) return;
    const nextIdx = taskIndex + 1;
    setTaskIndex(nextIdx); setTaskHasGeneration(false);
    setSubTaskIndex(0); setSubTaskCritique(null);
    setPrompt(''); setAiExplanation(null); setErrorMsg(null);
    // Auto-switch to Tables tab when entering create_tables task
    if (TASKS[nextIdx]?.id === 'create_tables') setRightTab('tables');
    if (TASKS[nextIdx]?.id === 'read_data' || TASKS[nextIdx]?.id === 'write_data') setRightTab('code');
    await persistSession(projectFiles, promptHistory, nextIdx, sessionContext);
  }, [taskIndex, projectFiles, promptHistory, sessionContext, persistSession]);

  const handleOnboardingComplete = useCallback(async () => {
    await ensureSession();
    setTaskIndex(1); setTaskHasGeneration(false); setSubTaskIndex(0); setSubTaskCritique(null);
    speakText('Welcome! Let\'s start by setting up your Supabase project.');
    await fetchTaskInstruction(1, projectFiles, sessionContext);
    setTimeout(() => persistSession(projectFiles, promptHistory, 1, sessionContext), 100);
  }, [ensureSession, projectFiles, promptHistory, sessionContext, persistSession, fetchTaskInstruction, speakText]);

  // ── Save + evaluate ──────────────────────────────────────────────────
  const handleSaveProject = useCallback(async () => {
    if (!userId || !sessionIdRef.current) return;
    setIsSaving(true); setSaveError(null); await ensureSession();
    try {
      let evalScores: any = null; let advice: string | null = null;
      try {
        const r = await callEvaluateAPI(promptHistory, projectFiles);
        evalScores = r.evaluation ?? null; advice = r.advice ?? null;
      } catch {}
      await supabase.from('dashboard').update({
        fs_pages: projectFiles.map(f => ({ path: f.path, content: f.content })),
        fs_prompts: promptHistory,
        fs_evaluation: { taskIndex, sessionContext, scores: evalScores, savedAt: new Date().toISOString() },
        fs_session_name: sessionName, updated_at: new Date().toISOString(),
      }).eq('user_id', userId).eq('fs_session_id', sessionIdRef.current);
      if (evalScores) { setEvaluation(evalScores); setEvalAdvice(advice); setShowEvaluation(true); }
      setLastSaved(new Date());
    } catch (err: any) { setSaveError(err.message || 'Save failed'); }
    finally { setIsSaving(false); }
  }, [userId, projectFiles, promptHistory, taskIndex, sessionContext, sessionName, ensureSession]);

  const handleEvaluate = async () => {
    setShowEvaluation(true); setIsEvaluating(true); setEvalError(null);
    try {
      const r = await callEvaluateAPI(promptHistory, projectFiles);
      setEvaluation(r.evaluation ?? null); setEvalAdvice(r.advice ?? null);
    } catch (err: any) { setEvalError(err.message || 'Evaluation failed'); }
    finally { setIsEvaluating(false); }
  };

  // ── Download ZIP ─────────────────────────────────────────────────────
  const handleDownload = useCallback(async () => {
    setDownloading(true);
    try {
      const { default: JSZip } = await import('jszip' as any);
      const zip = new JSZip();
      for (const f of projectFiles) zip.file(f.path, f.content);
      // Add a README with setup instructions
      zip.file('README.md', `# ${sessionName}\n\nFull-stack React + Supabase app.\n\n## Setup\n\n1. \`cp .env.example .env\`\n2. Fill in your Supabase URL and anon key in \`.env\`\n3. \`npm install\`\n4. \`npm run dev\`\n\n## Deploy to Vercel\n\nPush to GitHub, connect to Vercel, and add your env vars in the Vercel dashboard.\n`);
      const blob = await zip.generateAsync({ type: 'blob' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = `${sessionName.replace(/\s+/g, '-').toLowerCase()}.zip`; a.click();
    } catch (e) { console.error(e); }
    finally { setDownloading(false); }
  }, [projectFiles, sessionName]);

  const handleEditorChange = (val: string | undefined) => {
    if (!activeFilePath || val === undefined) return;
    setProjectFiles(prev => prev.map(f => f.path === activeFilePath ? { ...f, content: val } : f));
  };

  const handleCopy = () => {
    if (activeFile?.content) navigator.clipboard.writeText(activeFile.content).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
  };

  // Tabs for the right panel
  const RIGHT_TABS: { id: RightTab; label: string; icon: React.ReactNode }[] = [
    { id: 'code',   label: 'Code',   icon: <Code2 size={12} />   },
    { id: 'tables', label: 'Tables', icon: <Table2 size={12} />  },
    { id: 'sql',    label: 'SQL',    icon: <Database size={12} /> },
  ];

  // ── Show supabase credentials panel on setup task ─────────────────────
  const showCredPanel = currentTask?.id === 'supabase_setup';

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

      {/* Session picker */}
      {showSessionPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-gray-800 border border-gray-600 rounded-2xl w-full max-w-lg max-h-[80vh] overflow-hidden shadow-2xl flex flex-col">
            <div className="px-5 py-4 border-b border-gray-700 flex justify-between items-center flex-shrink-0">
              <h2 className="text-base font-bold text-white flex items-center gap-2"><FolderOpen size={18} className="text-emerald-400" /> Your Full-Stack Projects</h2>
              <button onClick={() => setShowSessionPicker(false)} className="p-1 text-gray-400 hover:text-white"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {sessions.map(s => (
                <button key={s.fs_session_id} onClick={() => loadSession(s)}
                  className="w-full text-left p-3 bg-gray-700/40 hover:bg-gray-700 border border-gray-600 hover:border-emerald-500/40 rounded-xl transition-colors">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{s.fs_session_name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Task {(s.fs_evaluation as any)?.taskIndex ?? 0 + 1}/{TASKS.length} · Updated {s.updated_at ? new Date(s.updated_at).toLocaleDateString() : '—'}
                      </p>
                    </div>
                    <button onClick={e => handleDeleteSession(e, s.fs_session_id)}
                      disabled={deletingSessionId === s.fs_session_id}
                      className="p-1.5 text-gray-600 hover:text-red-400 rounded transition-colors flex-shrink-0">
                      {deletingSessionId === s.fs_session_id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    </button>
                  </div>
                </button>
              ))}
            </div>
            <div className="px-5 pb-4 flex-shrink-0">
              <button onClick={createNewSession}
                className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors">
                <Plus size={15} /> Start New App
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Evaluation modal */}
      {showEvaluation && (() => {
        const scoreColor = (s: number) => s >= 2.5 ? 'text-emerald-400' : s >= 1.5 ? 'text-amber-400' : 'text-red-400';
        const skillLabel = (k: string) => k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="bg-gray-800 border border-gray-600 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
              <div className="px-6 py-4 border-b border-gray-700 flex justify-between items-center flex-shrink-0">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <BarChart3 size={20} className="text-purple-400" /> Session Evaluation
                </h2>
                <button onClick={() => setShowEvaluation(false)} className="p-1 text-gray-400 hover:text-white"><X size={18} /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {isEvaluating && (
                  <div className="flex flex-col items-center justify-center py-12">
                    <Loader2 size={36} className="animate-spin text-purple-400 mb-3" />
                    <p className="text-gray-300 font-medium">Evaluating your project…</p>
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
                      <div className="flex items-center gap-3 p-4 bg-gray-700/60 rounded-xl border border-gray-600">
                        <Award size={28} className="text-amber-400" />
                        <div>
                          <p className="text-xs text-gray-400 uppercase font-bold">Overall Score</p>
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
        );
      })()}

      {/* ── Main Layout ───────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col overflow-hidden" style={{ marginTop: '64px' }}>

        {/* Top toolbar */}
        <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center gap-2 flex-shrink-0">
              <Database size={18} className="text-emerald-400" />
              <span className="text-sm font-bold text-white">Full-Stack Builder</span>
            </div>
            <div className="w-px h-5 bg-gray-600 flex-shrink-0" />
            <input
              className="text-sm text-gray-300 bg-transparent border-b border-transparent hover:border-gray-600 focus:border-emerald-500 outline-none px-1 py-0.5 w-40"
              value={sessionName} onChange={e => setSessionName(e.target.value)} placeholder="App name…"
            />
            <div className="w-px h-5 bg-gray-600 flex-shrink-0" />
            <div className="flex items-center gap-1 flex-shrink-0">
              {[1, 2, 3].map(p => {
                const meta = PHASE_META[p]; const isActive = currentPhase === p; const isDone = currentPhase > p;
                return (
                  <span key={p} className={`px-2 py-0.5 rounded-full text-[10px] font-bold border transition-colors
                    ${isDone ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                    isActive ? `${meta.bg} ${meta.color} ${meta.border}` : 'text-gray-600 border-gray-700'}`}>
                    {isDone ? `✓ P${p}` : `P${p}`}
                  </span>
                );
              })}
              <span className="text-[10px] text-gray-500 ml-1">{taskIndex + 1}/{TASKS.length}</span>
            </div>
            {/* Creds status */}
            {creds.url && creds.anonKey && (
              <div className="hidden md:flex items-center gap-1 px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/25 rounded-full flex-shrink-0">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] text-emerald-400 font-medium truncate max-w-[120px]">{creds.url.replace('https://', '').split('.')[0]}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Voice toggle */}
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
                className={`p-1.5 rounded-lg transition-colors border ${voiceOutputEnabled ? 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10' : 'text-gray-600 border-gray-700 hover:text-gray-400'}`}>
                {voiceOutputEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
              </button>
            </div>
            <button onClick={handleDownload} disabled={downloading}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition-colors">
              {downloading ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />} .zip
            </button>
            <button onClick={() => { loadSessions(); setShowSessionPicker(true); }}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors">
              <FolderOpen size={15} />
            </button>
            {lastSaved && !isSaving && <span className="text-[10px] text-gray-600 hidden sm:block">Saved {lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
            {saveError && <span className="text-[10px] text-red-500 hidden sm:block">Save failed</span>}
            <button onClick={handleSaveProject} disabled={isSaving || !taskHasGeneration}
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

        {/* Main content */}
        <div className="flex-1 flex overflow-hidden">

          {/* ═══ LEFT: Task + Prompt ═══ */}
          <div className="w-80 flex-shrink-0 flex flex-col bg-[#1a1d23] border-r border-gray-700 overflow-hidden">

            {currentTask?.isOnboarding ? (
              <div className="flex-1 overflow-y-auto">
                <FullStackOnboarding onComplete={handleOnboardingComplete} />
              </div>
            ) : (
              <>
                {/* Task header -- collapsible stepper */}
                <div className="flex-shrink-0 border-b border-gray-700">
                  <button onClick={() => setStepperOpen(prev => !prev)}
                    className={`w-full flex items-center gap-2.5 px-4 py-3 text-left transition-colors ${pm.bg} hover:opacity-90`}>
                    <span className="text-lg flex-shrink-0">{currentTask?.icon}</span>
                    <div className="min-w-0 flex-1">
                      <p className={`text-[9px] font-bold uppercase tracking-wider ${pm.color}`}>{pm.label}</p>
                      <p className="text-sm font-bold text-white truncate">{currentTask?.label}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {taskInstruction?.subTasks && taskInstruction.subTasks.length > 1 && (
                        <div className="flex gap-1">
                          {taskInstruction.subTasks.map((_, i) => (
                            <span key={i} className={`w-1.5 h-1.5 rounded-full transition-colors ${
                              i < subTaskIndex ? 'bg-emerald-400' : i === subTaskIndex ? pm.color.replace('text-', 'bg-') : 'bg-gray-700'}`} />
                          ))}
                        </div>
                      )}
                      <ChevronDown size={13} className={`text-gray-500 transition-transform duration-200 ${stepperOpen ? 'rotate-180' : ''}`} />
                    </div>
                  </button>
                  {stepperOpen && (
                    <div className="border-t border-gray-700/60 bg-gray-900/60">
                      <TaskStepper tasks={TASKS} taskIndex={taskIndex}
                        onJump={(idx) => { handleJumpToTask(idx); setStepperOpen(false); }} />
                    </div>
                  )}
                </div>

                {/* Scrollable middle */}
                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">

                  {/* Credentials panel for setup task */}
                  {showCredPanel && (
                    <CredentialsPanel creds={creds} onChange={updateCreds} onTest={testConnection} testStatus={credTestStatus} testMsg={credTestMsg} />
                  )}

                  {/* Instruction card */}
                  {loadingInstruction ? (
                    <div className="flex items-center gap-2 py-2">
                      <Loader2 size={14} className="animate-spin text-purple-400" />
                      <span className="text-xs text-gray-400">Preparing instruction...</span>
                    </div>
                  ) : taskInstruction ? (
                    <div className="rounded-xl border border-gray-700 overflow-hidden">
                      {taskInstruction.subTaskTeaching?.[subTaskIndex] && (
                        <button onClick={() => setShowTeachingPopup(true)}
                          className="w-full flex items-center justify-between px-3 py-2 bg-gray-800/80 border-b border-gray-700 hover:bg-gray-800 transition-colors group">
                          <div className="flex items-center gap-2 min-w-0">
                            <LightbulbIcon size={12} className={`flex-shrink-0 ${pm.color}`} />
                            <p className={`text-[10px] font-bold uppercase tracking-wide ${pm.color}`}>Why this matters</p>
                          </div>
                          <ChevronRight size={11} className="text-gray-600 group-hover:text-gray-400 flex-shrink-0" />
                        </button>
                      )}
                      <div className={`px-3 py-3 ${pm.bg}`}>
                        <div className="flex items-center justify-between mb-1.5">
                          <p className={`text-[9px] font-bold uppercase tracking-wide ${pm.color}`}>
                            Step {subTaskIndex + 1} of {taskInstruction.subTasks.length}
                          </p>
                          <div className="flex items-center gap-1.5">
                            <button onClick={handleHelpRequest} title="What does this question mean?"
                              className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold text-gray-400 hover:text-white hover:bg-white/10 transition-colors">
                              <HelpCircle size={11} /> Help
                            </button>
                            <button onClick={handleSkipSubTask} title="Skip this question"
                              className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold text-gray-500 hover:text-gray-300 hover:bg-white/10 transition-colors">
                              <SkipForward size={11} /> Skip
                            </button>
                          </div>
                        </div>
                        <p className="text-sm text-white leading-relaxed font-medium">
                          {taskInstruction.subTasks[subTaskIndex]}
                        </p>
                        {subTaskIndex === 0 && taskInstruction.examplePrompt && (
                          <button onClick={() => { setPrompt(taskInstruction!.examplePrompt); promptRef.current?.focus(); }}
                            className={`mt-2 text-[10px] font-bold ${pm.color} hover:opacity-70 transition-opacity`}>
                            See example
                          </button>
                        )}
                      </div>
                    </div>
                  ) : null}

                  {/* What was built -- popup trigger */}
                  {aiExplanation && (
                    <button onClick={() => setShowBuiltPopup(true)}
                      className="w-full flex items-center justify-between p-2.5 bg-amber-500/10 border border-amber-500/25 rounded-lg hover:bg-amber-500/15 transition-colors group text-left">
                      <div className="flex items-center gap-2 min-w-0">
                        <Sparkles size={12} className="text-amber-400 flex-shrink-0" />
                        <p className="text-[10px] font-bold text-amber-400 uppercase">What was built</p>
                      </div>
                      <ChevronRight size={11} className="text-gray-600 group-hover:text-amber-400 flex-shrink-0" />
                    </button>
                  )}

                  {/* Tutorial Script download */}
                  <a href="https://wohmsbeygxrbwogrggkq.supabase.co/storage/v1/object/public/platform-assets/My_Community_My_Voice_FullStack_Tutorial_Script.pdf"
                    target="_blank" rel="noopener noreferrer"
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 transition-colors">
                    <div className="flex items-center gap-2">
                      <FileText size={13} className="text-amber-400 flex-shrink-0" />
                      <div>
                        <p className="text-[10px] font-bold text-amber-400 uppercase tracking-wide">Tutorial Script</p>
                        <p className="text-[9px] text-amber-300/70">Download PDF guide</p>
                      </div>
                    </div>
                    <Download size={11} className="text-amber-400 flex-shrink-0" />
                  </a>

                  {/* Critique */}
                  {isCritiquingResponse && (
                    <div className="flex items-center gap-2 py-1">
                      <Loader2 size={12} className="animate-spin text-purple-400 flex-shrink-0" />
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

                  {/* Error */}
                  {errorMsg && (
                    <div className="p-2.5 bg-red-500/10 border border-red-500/20 rounded-lg flex gap-2">
                      <AlertCircle size={12} className="flex-shrink-0 text-red-400 mt-0.5" />
                      <p className="text-xs text-red-300">{errorMsg}</p>
                    </div>
                  )}

                  {/* Prompt textarea */}
                  <div>
                    <textarea
                      ref={promptRef} value={prompt}
                      onChange={e => setPrompt(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleGenerate(); }}
                      placeholder={taskInstruction?.subTasks[subTaskIndex]?.replace(/^[^:]+:\s*/, '').substring(0, 80) + '…' || 'Describe what you want to build…'}
                      style={{ minHeight: '140px' }}
                      className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 resize-y outline-none focus:border-emerald-500 transition-colors leading-relaxed"
                    />
                    <p className="text-[9px] text-gray-700 mt-1">Ctrl+Enter to submit</p>
                  </div>
                </div>

                {/* Fixed bottom buttons */}
                <div className="flex-shrink-0 px-4 pb-4 space-y-2">
                  <div className="flex gap-2">
                    <button onClick={handleGenerate} disabled={isGenerating || !prompt.trim()}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors disabled:opacity-40">
                      {isGenerating ? <Loader2 size={15} className="animate-spin" /> : <ArrowUpCircle size={18} />}
                      {isGenerating && <span className="text-sm">Working…</span>}
                    </button>
                    <button onClick={handleCritique} disabled={isCritiquing || !prompt.trim()}
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
                      <CheckCircle size={13} /> Complete Task & Continue <ArrowRight size={13} />
                    </button>
                  )}

                  {taskIndex < TASKS.length - 1 && taskHasGeneration && subTaskIndex >= (taskInstruction?.subTasks?.length ?? 1) - 1 && subTaskCritique?.hasSuggestions && (
                    <button onClick={handleCompleteTask}
                      className="w-full flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-xl border border-gray-700 text-gray-500 hover:border-gray-500 hover:text-gray-300 transition-all">
                      <CheckCircle size={13} /> Complete anyway & continue <ArrowRight size={13} />
                    </button>
                  )}
                </div>
              </>
            )}
          </div>

          {/* RIGHT: Teaching / Code / Tables / SQL */}
          <div className="flex-1 flex flex-col overflow-hidden">

            {/* Tab bar */}
            <div className="flex items-center border-b border-gray-700 flex-shrink-0" style={{ background: '#1e2128' }}>
              <button onClick={() => setEditorTab('teaching')}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold border-b-2 transition-colors ${editorTab === 'teaching' ? 'border-amber-400 text-amber-300 bg-amber-500/5' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
                <LightbulbIcon size={12} /> Teaching
              </button>
              <button onClick={() => setEditorTab('code')}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold border-b-2 transition-colors ${editorTab === 'code' ? 'border-emerald-400 text-emerald-300 bg-emerald-500/5' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
                <FileCode size={12} /> Code
              </button>
              <button onClick={() => setEditorTab('tables')}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold border-b-2 transition-colors ${editorTab === 'tables' ? 'border-blue-400 text-blue-300 bg-blue-500/5' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
                <Database size={12} /> Tables
              </button>
              <button onClick={() => setEditorTab('sql')}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold border-b-2 transition-colors ${editorTab === 'sql' ? 'border-purple-400 text-purple-300 bg-purple-500/5' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
                <Code2 size={12} /> SQL
                {generatedSql && editorTab !== 'sql' && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 ml-0.5" />}
              </button>
              <div className="flex-1" />
              {editorTab === 'code' && (
                <div className="flex items-center gap-2 pr-3">
                  <button onClick={handleCopy} className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors">
                    {copied ? <Check size={11} /> : <Copy size={11} />}{copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
              )}
            </div>

            {/* Tab content */}
            <div className="flex-1 flex overflow-hidden">

              {/* Teaching tab */}
              {editorTab === 'teaching' && (
                <div className="flex-1 overflow-y-auto" style={{ background: '#f9f6ef' }}>
                  <div className="px-6 pt-5 pb-3 border-b" style={{ borderColor: '#e8e0d0' }}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-base">{currentTask?.icon}</span>
                      <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#8a6d3b' }}>{pm.label} {currentTask?.label}</p>
                    </div>
                    <p className="text-xs" style={{ color: '#6b5c45' }}>Step {subTaskIndex + 1} of {taskInstruction?.subTasks?.length ?? 1}</p>
                  </div>
                  <div className="px-6 py-5 space-y-5">
                    {aiExplanation ? (
                      <div className="rounded-xl p-4 border" style={{ background: '#fff8ed', borderColor: '#f0c060' }}>
                        <div className="flex items-center gap-2 mb-2">
                          <Sparkles size={13} style={{ color: '#c07020' }} />
                          <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: '#c07020' }}>What was built</p>
                        </div>
                        <p className="text-sm leading-relaxed" style={{ color: '#3d2b00' }}>{aiExplanation}</p>
                        <button onClick={() => setShowBuiltPopup(true)} className="mt-3 text-[10px] font-bold hover:opacity-70 transition-opacity" style={{ color: '#c07020' }}>Read full analysis</button>
                      </div>
                    ) : (
                      <div className="rounded-xl p-4 border border-dashed" style={{ borderColor: '#d4c4a0' }}>
                        <p className="text-xs text-center" style={{ color: '#a08060' }}>Submit your first response -- the AI explanation will appear here.</p>
                      </div>
                    )}
                    {taskInstruction?.subTaskTeaching?.[subTaskIndex] && (
                      <div className="rounded-xl p-4 border" style={{ background: '#f0f8f0', borderColor: '#7ab87a' }}>
                        <div className="flex items-center gap-2 mb-2">
                          <LightbulbIcon size={13} style={{ color: '#3a7a3a' }} />
                          <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: '#3a7a3a' }}>Why this step matters</p>
                        </div>
                        <p className="text-sm leading-relaxed italic" style={{ color: '#1a3a1a' }}>{taskInstruction.subTaskTeaching[subTaskIndex]}</p>
                      </div>
                    )}
                    {subTaskCritique && (
                      <div className="rounded-xl p-4 border" style={{ background: subTaskCritique.hasSuggestions ? '#fffbf0' : '#f0fff4', borderColor: subTaskCritique.hasSuggestions ? '#e8c840' : '#68b868' }}>
                        <p className="text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: subTaskCritique.hasSuggestions ? '#9a7800' : '#2d7a2d' }}>
                          {subTaskCritique.hasSuggestions ? 'Feedback on your response' : 'Step complete'}
                        </p>
                        <p className="text-sm leading-relaxed" style={{ color: '#2a2a1a' }}>{subTaskCritique.feedback}</p>
                      </div>
                    )}
                    {isCritiquingResponse && (
                      <div className="flex items-center gap-2 py-1">
                        <Loader2 size={12} className="animate-spin" style={{ color: '#8a6d3b' }} />
                        <span className="text-xs" style={{ color: '#8a6d3b' }}>Reviewing your response...</span>
                      </div>
                    )}
                    {taskInstruction?.subTasks?.[subTaskIndex] && (
                      <div className="rounded-xl p-4 border" style={{ background: '#f5f0ff', borderColor: '#b090e0' }}>
                        <p className="text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: '#6040a0' }}>Your current question</p>
                        <p className="text-sm font-medium leading-relaxed" style={{ color: '#2a1a4a' }}>{taskInstruction.subTasks[subTaskIndex]}</p>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <button onClick={() => setEditorTab('code')} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-xs font-bold transition-colors hover:opacity-80" style={{ borderColor: '#b0c8b0', color: '#3a6a3a', background: '#e8f4e8' }}>
                        <FileCode size={12} /> View code
                      </button>
                      <button onClick={() => setEditorTab('sql')} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-xs font-bold transition-colors hover:opacity-80" style={{ borderColor: '#b0a0d0', color: '#5030a0', background: '#ede8f8' }}>
                        <Code2 size={12} /> View SQL
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Code tab */}
              {editorTab === 'code' && (
                <>
                  <div className="w-44 flex-shrink-0 border-r border-gray-700 flex flex-col" style={{ background: '#161820' }}>
                    <div className="px-3 pt-2 pb-1 flex-shrink-0">
                      <p className="text-[9px] font-bold text-gray-700 uppercase tracking-wide">Files</p>
                    </div>
                    <div className="flex-1 overflow-y-auto pb-2">
                      <FileTreePanel files={projectFiles} activeFile={activeFilePath} onSelect={setActiveFilePath} />
                    </div>
                  </div>
                  <div className="flex-1 flex flex-col min-w-0">
                    <div className="flex-1">
                      <Editor height="100%" language={getLanguage(activeFilePath)} value={activeFile?.content || ''} onChange={handleEditorChange} theme="vs-dark"
                        options={{ fontSize: 13, minimap: { enabled: false }, padding: { top: 12 }, lineNumbers: 'on', wordWrap: 'on', scrollBeyondLastLine: false, automaticLayout: true, tabSize: 2 }} />
                    </div>
                  </div>
                </>
              )}

              {/* Tables tab */}
              {editorTab === 'tables' && (
                <div className="flex-1 overflow-hidden">
                  <TableViewerPanel creds={creds.url && creds.anonKey ? creds : null} />
                </div>
              )}

              {/* SQL tab */}
              {editorTab === 'sql' && (
                <div className="flex-1 overflow-hidden">
                  <SqlRunnerPanel creds={creds.url && creds.anonKey ? creds : null} generatedSql={generatedSql} />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Teaching Popup */}
        {showTeachingPopup && taskInstruction?.subTaskTeaching?.[subTaskIndex] && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
            <div className="w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col rounded-2xl shadow-2xl border" style={{ background: '#f9f6ef', borderColor: '#d4c4a0' }}>
              <div className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0" style={{ borderColor: '#e0d4b8', background: '#f0e8d8' }}>
                <div className="flex items-center gap-2">
                  <LightbulbIcon size={16} style={{ color: '#3a7a3a' }} />
                  <p className="text-sm font-bold" style={{ color: '#2a1800' }}>Why This Step Matters</p>
                </div>
                <button onClick={() => setShowTeachingPopup(false)} className="p-1.5 rounded-lg hover:bg-black/10">
                  <X size={16} style={{ color: '#5a4a30' }} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
                <div className="rounded-xl p-4 border" style={{ background: '#f0f8f0', borderColor: '#7ab87a' }}>
                  <p className="text-sm leading-relaxed italic" style={{ color: '#1a3a1a', lineHeight: '1.75' }}>
                    {taskInstruction.subTaskTeaching[subTaskIndex]}
                  </p>
                </div>
                <div className="rounded-xl p-4 border" style={{ background: '#f5f0ff', borderColor: '#b090e0' }}>
                  <p className="text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: '#6040a0' }}>Your question for this step</p>
                  <p className="text-sm font-medium leading-relaxed" style={{ color: '#2a1a4a' }}>{taskInstruction.subTasks[subTaskIndex]}</p>
                </div>
              </div>
              <div className="px-5 py-4 border-t flex-shrink-0" style={{ borderColor: '#e0d4b8' }}>
                <button onClick={() => setShowTeachingPopup(false)} className="w-full py-2.5 rounded-xl text-sm font-bold hover:opacity-90" style={{ background: '#3a7a3a', color: 'white' }}>
                  Got it -- back to writing
                </button>
              </div>
            </div>
          </div>
        )}

        {/* What Was Built Popup */}
        {showBuiltPopup && aiExplanation && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
            <div className="w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col rounded-2xl shadow-2xl border" style={{ background: '#f9f6ef', borderColor: '#d4c4a0' }}>
              <div className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0" style={{ borderColor: '#e0d4b8', background: '#fff8ed' }}>
                <div className="flex items-center gap-2">
                  <Sparkles size={16} style={{ color: '#c07020' }} />
                  <p className="text-sm font-bold" style={{ color: '#2a1800' }}>What Was Built</p>
                </div>
                <button onClick={() => setShowBuiltPopup(false)} className="p-1.5 rounded-lg hover:bg-black/10">
                  <X size={16} style={{ color: '#5a4a30' }} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-5 py-5">
                <div className="rounded-xl p-4 border" style={{ background: '#fff8ed', borderColor: '#f0c060' }}>
                  <p className="text-sm leading-relaxed" style={{ color: '#3d2b00', lineHeight: '1.75' }}>{aiExplanation}</p>
                </div>
              </div>
              <div className="px-5 py-4 border-t flex-shrink-0 flex gap-2" style={{ borderColor: '#e0d4b8' }}>
                <button onClick={() => { setEditorTab('code'); setShowBuiltPopup(false); }} className="flex-1 py-2.5 rounded-xl text-sm font-bold hover:opacity-90 flex items-center justify-center gap-2" style={{ background: '#2a5a2a', color: 'white' }}>
                  <FileCode size={13} /> View code
                </button>
                <button onClick={() => setShowBuiltPopup(false)} className="flex-1 py-2.5 rounded-xl text-sm font-bold border hover:opacity-80" style={{ borderColor: '#c8b890', color: '#5a4a30' }}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Help Popup */}
        {showHelpPopup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
            <div className="w-full max-w-md flex flex-col rounded-2xl shadow-2xl border overflow-hidden" style={{ background: '#f9f6ef', borderColor: '#d4c4a0' }}>
              <div className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0" style={{ borderColor: '#e0d4b8', background: '#f0e8d8' }}>
                <div className="flex items-center gap-2">
                  <HelpCircle size={16} style={{ color: '#6040a0' }} />
                  <p className="text-sm font-bold" style={{ color: '#2a1800' }}>What does this question mean?</p>
                </div>
                <button onClick={() => setShowHelpPopup(false)} className="p-1.5 rounded-lg hover:bg-black/10">
                  <X size={16} style={{ color: '#5a4a30' }} />
                </button>
              </div>
              <div className="px-5 pt-4 pb-2">
                <p className="text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: '#8a6d3b' }}>The question</p>
                <p className="text-sm font-medium leading-relaxed" style={{ color: '#2a1a4a' }}>{taskInstruction?.subTasks?.[subTaskIndex]}</p>
              </div>
              <div className="px-5 pb-5">
                <div className="rounded-xl p-4 border mt-3" style={{ background: '#f5f0ff', borderColor: '#b090e0' }}>
                  {helpLoading ? (
                    <div className="flex items-center gap-2">
                      <Loader2 size={14} className="animate-spin" style={{ color: '#6040a0' }} />
                      <p className="text-sm" style={{ color: '#6040a0' }}>Getting a plain-English explanation...</p>
                    </div>
                  ) : (
                    <p className="text-sm leading-relaxed" style={{ color: '#2a1a4a', lineHeight: '1.75' }}>{helpResponse}</p>
                  )}
                </div>
              </div>
              <div className="px-5 pb-5 flex gap-2">
                <button onClick={() => setShowHelpPopup(false)} className="flex-1 py-2.5 rounded-xl text-sm font-bold hover:opacity-90" style={{ background: '#6040a0', color: 'white' }}>
                  Got it -- I will give it a try
                </button>
                <button onClick={() => { setShowHelpPopup(false); handleSkipSubTask(); }} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold border hover:opacity-80" style={{ borderColor: '#c8b890', color: '#5a4a30' }}>
                  <SkipForward size={13} /> Skip
                </button>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
};

export default FullStackDevelopmentPage;