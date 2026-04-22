// src/pages/AIPlaygroundPage.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabaseClient';
import { useVoice } from '../hooks/useVoice';
import { VoiceFallback } from '../components/VoiceFallback';
import { useBranding } from '../lib/useBranding';
import {
  Plus, Search, Trash2, Download, Send, Paperclip,
  ChevronLeft, ChevronRight, Edit3, Check, X,
  MessageSquare, Loader2, Bot, User, Copy, FileText, Code2, Home,
  Mic, MicOff, Volume2, VolumeX, AlertCircle, ChevronDown, History,
} from 'lucide-react';

// ── Constants ──────────────────────────────────────────────────────────────────
const MAX_CHAR_LIMIT     = 4000;
const MAX_API_MESSAGES   = 20;
const REFLECTION_TRIGGER = 10;

// ── Interfaces ─────────────────────────────────────────────────────────────────
interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  attachment?: { name: string; content: string; type: string };
}
interface PlaygroundChat {
  id: string;
  user_id: string;
  title: string;
  messages: ChatMessage[];
  model?: string;
  created_at: string;
  updated_at: string;
}

// HistoryBlock: a code block accumulated across the whole session
interface HistoryBlock {
  id: string;           // unique id for keying
  language: string;
  content: string;
  label: string;        // bold label shown above the block in chat (e.g. "In src/pages/Foo.tsx, replace lines 42–55:")
  cursorHint?: string;  // Cursor search suggestion extracted from <!-- CURSOR: ... -->
  messageIndex: number; // which assistant message it came from
  blockIndex: number;   // which block within that message
}

interface ArtifactPanel {
  type: 'code' | 'document';
  content: string;
  title: string;
  historyId?: string;   // points into sessionCodeHistory
}

// ── Helpers ────────────────────────────────────────────────────────────────────
const formatTime = (iso: string) => {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7)  return d.toLocaleDateString([], { weekday: 'short' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

// ── parseCodeBlocks: extract all code blocks + their labels + cursor hints ─────
// Expected Claude output format:
//   **In src/pages/Foo.tsx, replace lines 42–55 with:**
//   ```tsx
//   ...code...
//   ```
//   <!-- CURSOR: search for "const detectArtifact" -->
interface ParsedBlock {
  language: string;
  content: string;
  label: string;
  cursorHint?: string;
}

const parseCodeBlocks = (text: string): ParsedBlock[] => {
  const result: ParsedBlock[] = [];
  // Match: optional bold label line, then code fence, then optional cursor hint
  const blockRegex = /(?:(?:^|\n)\*\*([^\n*]+)\*\*\n)?```(\w*)\n([\s\S]*?)```(?:\n<!-- CURSOR: ([^\n>]+) -->)?/g;
  let match;
  while ((match = blockRegex.exec(text)) !== null) {
    const label   = match[1]?.trim() ?? '';
    const lang    = match[2] || 'code';
    const content = match[3] ?? '';
    const hint    = match[4]?.trim();
    if (content.trim().length > 10) {
      result.push({ language: lang, content, label, cursorHint: hint });
    }
  }
  return result;
};

// ── InlineCode: styled pill with one-click copy ────────────────────────────────
const InlineCode: React.FC<{ code: string }> = ({ code }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      onClick={handleCopy}
      title="Click to copy"
      className="inline-flex items-center gap-1 bg-gray-100 hover:bg-purple-50 border border-gray-200 hover:border-purple-300 text-purple-800 font-mono text-sm px-1.5 py-0.5 rounded transition-colors cursor-pointer"
    >
      <span>{code}</span>
      <Copy size={10} className={`flex-shrink-0 ${copied ? 'text-green-500' : 'text-gray-400'}`} />
    </button>
  );
};

// ── renderInlineText: **bold** + `inline code` + plain text ───────────────────
const renderInlineText = (line: string) => {
  const parts = line.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return (
    <span>
      {parts.map((p, j) => {
        if (p.startsWith('**') && p.endsWith('**')) return <strong key={j}>{p.slice(2, -2)}</strong>;
        if (p.startsWith('`')  && p.endsWith('`'))  return <InlineCode key={j} code={p.slice(1, -1)} />;
        return <span key={j}>{p}</span>;
      })}
    </span>
  );
};

// ── InChatCodeBlock: formatted black-background block rendered in message ──────
const InChatCodeBlock: React.FC<{
  block: ParsedBlock;
  onOpenPanel: () => void;
}> = ({ block, onOpenPanel }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(block.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="my-3 rounded-xl overflow-hidden border border-gray-700 shadow-md">
      {/* Label bar */}
      <div className="bg-gray-800 px-4 py-2 flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-purple-300 leading-snug">
          {block.label || `${block.language} code`}
        </span>
        <div className="flex items-center gap-1 flex-shrink-0">
          <span className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded font-mono">{block.language}</span>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-gray-700 transition-colors"
          >
            <Copy size={11} />{copied ? 'Copied!' : 'Copy'}
          </button>
          <button
            onClick={onOpenPanel}
            className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-200 px-2 py-1 rounded hover:bg-gray-700 transition-colors"
            title="Open in code panel"
          >
            <Code2 size={11} />Panel
          </button>
        </div>
      </div>
      {/* Code area */}
      <pre className="bg-gray-950 text-green-300 font-mono text-xs px-4 py-3 overflow-x-auto leading-relaxed whitespace-pre-wrap">
        {block.content}
      </pre>
      {/* Cursor search hint */}
      {block.cursorHint && (
        <div className="bg-gray-900 border-t border-gray-700 px-4 py-2 flex items-center gap-2">
          <Search size={11} className="text-yellow-400 flex-shrink-0" />
          <span className="text-xs text-yellow-300">
            <span className="font-semibold">Cursor search: </span>
            <span className="font-mono bg-gray-800 px-1.5 py-0.5 rounded">{block.cursorHint}</span>
          </span>
          <button
            onClick={() => navigator.clipboard.writeText(block.cursorHint!)}
            className="ml-auto text-xs text-gray-500 hover:text-yellow-300 transition-colors"
            title="Copy search term"
          >
            <Copy size={10} />
          </button>
        </div>
      )}
    </div>
  );
};

// ── MessageContent: full renderer including formatted code blocks ───────────────
const MessageContent: React.FC<{
  text: string;
  parsedBlocks: ParsedBlock[];
  onOpenBlock: (idx: number) => void;
}> = ({ text, parsedBlocks, onOpenBlock }) => {

  // Strip code fences + cursor hints from display text, replace with InChatCodeBlock
  // We render line-by-line, but inject code blocks at the right positions
  const blockRegex = /(?:(?:^|\n)\*\*([^\n*]+)\*\*\n)?```(\w*)\n[\s\S]*?```(?:\n<!-- CURSOR: [^\n>]+ -->)?/g;
  const segments: Array<{ type: 'text'; content: string } | { type: 'block'; index: number }> = [];
  let lastIndex = 0;
  let blockIdx = 0;
  let match;
  const regex = new RegExp(blockRegex.source, 'g');
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', content: text.slice(lastIndex, match.index) });
    }
    segments.push({ type: 'block', index: blockIdx++ });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    segments.push({ type: 'text', content: text.slice(lastIndex) });
  }

  const renderTextSegment = (content: string) => {
    const lines = content.split('\n');
    return lines.map((line, i) => {
      if (line.startsWith('### ')) return <h3 key={i} className="font-bold text-base mt-2">{renderInlineText(line.slice(4))}</h3>;
      if (line.startsWith('## '))  return <h2 key={i} className="font-bold text-lg mt-3">{renderInlineText(line.slice(3))}</h2>;
      if (line.startsWith('# '))   return <h1 key={i} className="font-bold text-xl mt-3">{renderInlineText(line.slice(2))}</h1>;
      if (line.startsWith('- ') || line.startsWith('* ')) return (
        <div key={i} className="flex gap-2">
          <span className="mt-1 flex-shrink-0">•</span>
          <span>{renderInlineText(line.slice(2))}</span>
        </div>
      );
      if (/^\d+\.\s/.test(line)) {
        const dotIdx = line.indexOf('. ');
        return (
          <div key={i} className="flex gap-2">
            <span className="flex-shrink-0 font-semibold">{line.slice(0, dotIdx + 1)}</span>
            <span>{renderInlineText(line.slice(dotIdx + 2))}</span>
          </div>
        );
      }
      if (line.startsWith('```')) return null;
      if (line.trim() === '')     return <div key={i} className="h-1" />;
      // Skip bold label lines that are consumed by code block headers
      if (/^\*\*[^*]+\*\*$/.test(line.trim())) return null;
      return <p key={i}>{renderInlineText(line)}</p>;
    });
  };

  return (
    <div className="space-y-1 text-base leading-relaxed">
      {segments.map((seg, i) => {
        if (seg.type === 'text') return <React.Fragment key={i}>{renderTextSegment(seg.content)}</React.Fragment>;
        const block = parsedBlocks[seg.index];
        if (!block) return null;
        return (
          <InChatCodeBlock
            key={i}
            block={block}
            onOpenPanel={() => onOpenBlock(seg.index)}
          />
        );
      })}
    </div>
  );
};

// ── ArtifactPanelView: code panel with session history dropdown ────────────────
const ArtifactPanelView: React.FC<{
  artifact: ArtifactPanel;
  sessionHistory: HistoryBlock[];
  onSelectHistory: (block: HistoryBlock) => void;
  onClose: () => void;
  onEdit: () => void;
  editInput: string;
  setEditInput: (v: string) => void;
  isEditing: boolean;
}> = ({ artifact, sessionHistory, onSelectHistory, onClose, onEdit, editInput, setEditInput, isEditing }) => {
  const [copied, setCopied]       = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(artifact.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Find current block in history for cursor hint
  const currentHistoryBlock = sessionHistory.find(b => b.id === artifact.historyId);

  return (
    <div className="flex flex-col h-full bg-gray-950 text-gray-100">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-700 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          {artifact.type === 'code'
            ? <Code2 size={15} className="text-purple-400 flex-shrink-0" />
            : <FileText size={15} className="text-blue-400 flex-shrink-0" />}
          <span className="text-sm font-medium text-gray-200 truncate">{artifact.title}</span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-200 px-2 py-1 rounded hover:bg-gray-700 transition-colors"
          >
            <Copy size={12} />{copied ? 'Copied!' : 'Copy'}
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-gray-200 transition-colors"
            title="Close panel"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Session history dropdown */}
      {sessionHistory.length > 0 && (
        <div className="px-3 py-2 bg-gray-900 border-b border-gray-700 flex-shrink-0 relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(v => !v)}
            className="w-full flex items-center justify-between gap-2 text-xs bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-gray-300 transition-colors"
          >
            <div className="flex items-center gap-2 min-w-0">
              <History size={12} className="text-purple-400 flex-shrink-0" />
              <span className="truncate">
                {currentHistoryBlock
                  ? (currentHistoryBlock.label || `${currentHistoryBlock.language} block`)
                  : 'Select from session history…'}
              </span>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <span className="bg-purple-900 text-purple-300 text-xs px-1.5 py-0.5 rounded-full">{sessionHistory.length}</span>
              <ChevronDown size={12} className={`transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
            </div>
          </button>

          {dropdownOpen && (
            <div className="absolute left-3 right-3 top-full mt-1 z-50 bg-gray-800 border border-gray-600 rounded-xl shadow-2xl overflow-hidden max-h-72 overflow-y-auto">
              {sessionHistory.map((block, idx) => (
                <button
                  key={block.id}
                  onClick={() => { onSelectHistory(block); setDropdownOpen(false); }}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-700 transition-colors border-b border-gray-700 last:border-0 ${block.id === artifact.historyId ? 'bg-gray-700' : ''}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono bg-gray-900 text-purple-300 px-1.5 py-0.5 rounded flex-shrink-0">{block.language}</span>
                    <span className="text-xs text-gray-200 truncate font-medium">
                      {block.label || `Block ${idx + 1}`}
                    </span>
                  </div>
                  {block.cursorHint && (
                    <p className="text-xs text-yellow-400 mt-1 truncate pl-1">🔍 {block.cursorHint}</p>
                  )}
                  <p className="text-xs text-gray-500 mt-0.5 font-mono truncate pl-1">
                    {block.content.trim().slice(0, 60)}…
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Cursor hint strip */}
      {currentHistoryBlock?.cursorHint && (
        <div className="px-4 py-2 bg-gray-900 border-b border-gray-700 flex items-center gap-2 flex-shrink-0">
          <Search size={11} className="text-yellow-400 flex-shrink-0" />
          <span className="text-xs text-yellow-300">
            <span className="font-semibold">Cursor search: </span>
            <span className="font-mono bg-gray-800 px-1.5 py-0.5 rounded">{currentHistoryBlock.cursorHint}</span>
          </span>
          <button
            onClick={() => navigator.clipboard.writeText(currentHistoryBlock.cursorHint!)}
            className="ml-auto text-xs text-gray-500 hover:text-yellow-300 transition-colors"
            title="Copy search term"
          >
            <Copy size={10} />
          </button>
        </div>
      )}

      {/* Label strip */}
      {(currentHistoryBlock?.label || artifact.title) && (
        <div className="px-4 py-2 bg-gray-900 border-b border-gray-700 flex-shrink-0">
          <p className="text-xs font-bold text-purple-300 leading-snug">
            {currentHistoryBlock?.label || artifact.title}
          </p>
        </div>
      )}

      {/* Code content */}
      <div className="flex-1 overflow-auto p-4">
        {artifact.type === 'code' ? (
          <pre className="text-xs font-mono text-green-300 whitespace-pre-wrap leading-relaxed">{artifact.content}</pre>
        ) : (
          <div className="space-y-1">
            {artifact.content.split('\n').map((line, i) => {
              if (line.startsWith('### ')) return <h3 key={i} className="text-gray-100 font-bold text-base mt-4 mb-1">{line.slice(4)}</h3>;
              if (line.startsWith('## '))  return <h2 key={i} className="text-gray-100 font-bold text-lg mt-5 mb-2">{line.slice(3)}</h2>;
              if (line.startsWith('# '))   return <h1 key={i} className="text-gray-100 font-bold text-xl mt-6 mb-2">{line.slice(2)}</h1>;
              if (line.startsWith('- ') || line.startsWith('* ')) return (
                <div key={i} className="flex gap-2 text-sm text-gray-300"><span>•</span><span>{line.slice(2)}</span></div>
              );
              if (line.trim() === '') return <div key={i} className="h-2" />;
              const parts = line.split(/(\*\*[^*]+\*\*)/g);
              return (
                <p key={i} className="text-sm text-gray-300 leading-relaxed">
                  {parts.map((p, j) => p.startsWith('**') && p.endsWith('**')
                    ? <strong key={j} className="text-gray-100">{p.slice(2, -2)}</strong>
                    : p)}
                </p>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Artifact edit bar ──────────────────────────────────────────────── */}
      <div className="flex-shrink-0 border-t border-gray-700 bg-gray-900 px-3 py-2">
        <div className="flex items-center gap-2 bg-gray-800 border border-gray-600 rounded-xl px-3 py-2 focus-within:border-purple-500 transition-colors">
          <Edit3 size={13} className="text-purple-400 flex-shrink-0" />
          <input
            value={editInput}
            onChange={e => setEditInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onEdit(); } }}
            placeholder="Edit this code… (e.g. add error handling, rename function)"
            disabled={isEditing}
            className="flex-1 bg-transparent text-xs text-gray-200 placeholder-gray-500 outline-none"
          />
          <button
            onClick={onEdit}
            disabled={!editInput.trim() || isEditing}
            className="flex-shrink-0 w-7 h-7 rounded-lg bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center text-white disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
            title="Apply edit"
          >
            {isEditing ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />}
          </button>
        </div>
        <p className="text-xs text-gray-600 mt-1 text-center">Enter to apply · Claude rewrites the full code with your change</p>
      </div>
    </div>
  );
};

// ── Model options ──────────────────────────────────────────────────────────────
const MODEL_OPTIONS = [
  { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku' },
  { value: 'claude-sonnet-4-6',         label: 'Claude Sonnet 4.6' },
];
const getModelDisplayName = (modelId: string): string => {
  const trimmed = (modelId || '').trim();
  const match = MODEL_OPTIONS.find(m => m.value === trimmed);
  if (match) return match.label;
  if (trimmed.includes('sonnet')) return 'Claude Sonnet 4.6';
  if (trimmed.includes('haiku'))  return 'Claude Haiku';
  return trimmed || 'Claude';
};

// ── System prompt ──────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are a learning assistant for young women in Nigeria building real skills with AI and technology. Strengthen their minds — never think for them.

SAFETY
- No instructions for violence, weapons, dangerous substances, or self-harm.
- If a user expresses distress or danger, respond with care and direct them to a trusted adult or community leader.
- No content that deceives, exploits, sexualizes, or demeans anyone.
- Do not engage with community conflicts, land disputes, or political tensions — these need human judgment.

HELP USERS UNDERSTAND YOUR RESPONSES
- While you may provide answers or script changes, explain everything.

APPROPRIATE USE
- Stay on learning: coding, writing, English, digital skills, problem-solving.
- No content for other platforms or in someone else's name unless clearly a learning exercise.
- If conversation drifts, redirect: "Let's bring this back to what you're working on."

CODE FORMAT — follow exactly:

1. LABEL (bold, own line): **In src/pages/Foo.tsx, replace lines 42–55 with:**
2. CODE BLOCK: fenced with correct language tag (\`\`\`tsx, \`\`\`bash, etc.) — self-contained, no explanation inside
3. CURSOR HINT (line immediately after closing fence): <!-- CURSOR: search for "unique line near the change" -->
   - Replacement: use a distinctive line from the replaced code
   - Insertion: use a distinctive line just before the insertion point
   - New file: omit hint
4. FOLLOW-UP: plain-English next steps after the block (e.g. "Then run \`npm install\`")
5. UNDERSTANDING CHECK: ask the user what they think the code does before moving on

Be warm, precise, and encouraging. The user is capable — help them get there.`;
// ══════════════════════════════════════════════════════════════════════════════
// Main component
// ══════════════════════════════════════════════════════════════════════════════
const AIPlaygroundPage: React.FC = () => {
  const { user }  = useAuth();
  const navigate  = useNavigate();
  const branding  = useBranding();

  const [sidebarOpen, setSidebarOpen]             = useState(true);
  const [searchQuery, setSearchQuery]             = useState('');
  const [chats, setChats]                         = useState<PlaygroundChat[]>([]);
  const [activeChatId, setActiveChatId]           = useState<string | null>(null);
  const [loadingChats, setLoadingChats]           = useState(true);
  const [editingTitleId, setEditingTitleId]       = useState<string | null>(null);
  const [editingTitleValue, setEditingTitleValue] = useState('');
  const [userInput, setUserInput]                 = useState('');
  const [sending, setSending]                     = useState(false);
  const [attachment, setAttachment]               = useState<{ name: string; content: string; type: string } | null>(null);
  const [artifact, setArtifact]                   = useState<ArtifactPanel | null>(null);
  const [artifactEditInput, setArtifactEditInput] = useState('');
  const [artifactEditing, setArtifactEditing]     = useState(false);
  const [playgroundModel, setPlaygroundModel]     = useState<string>('claude-haiku-4-5-20251001');
  const [modelLoaded, setModelLoaded]             = useState(false);
  const [showReflection, setShowReflection]       = useState(false);
  const [isDragging, setIsDragging]               = useState(false);

  // ── Session code history: accumulates ALL code blocks seen this session ────────
  const [sessionCodeHistory, setSessionCodeHistory] = useState<HistoryBlock[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef   = useRef<HTMLDivElement>(null);
  const textareaRef  = useRef<HTMLTextAreaElement>(null);
  const dropZoneRef  = useRef<HTMLDivElement>(null);
  // Tracks when activeChatId changes because WE just created a new chat mid-send,
  // so the reset effect below doesn't wipe the artifact we just opened.
  const justCreatedChatRef = useRef(false);

  // ── Voice state ──────────────────────────────────────────────────────────────
  const [continent, setContinent]                   = useState<string | null>(null);
  const [profileName, setProfileName]               = useState<string | null>(null);
  const [voiceOutputEnabled, setVoiceOutputEnabled] = useState(false);
  const [isListening, setIsListening]               = useState(false);
  const recognitionRef = useRef<any>(null);
  const isAfrica = continent === 'Africa';

  const {
    speak,
    cancel: cancelSpeech,
    speaking: isSpeaking,
    fallbackText,
    clearFallback,
    recognitionLang,
    selectedVoice,
  } = useVoice(isAfrica);

  // ── Load profile ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from('profiles')
      .select('continent, ai_playground_model, full_name')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (data?.continent) setContinent(data.continent);
        if (data?.full_name) setProfileName(data.full_name);
        setPlaygroundModel(data?.ai_playground_model || 'claude-haiku-4-5-20251001');
        setModelLoaded(true);
        console.log('[Playground] model loaded:', data?.ai_playground_model ?? 'haiku (default)');
      })
      .catch(() => setModelLoaded(true));
  }, [user?.id]);

  // ── Reset on chat switch — clear history too ──────────────────────────────────
  useEffect(() => {
    // Skip the reset when the activeChatId changed because we just created
    // a new chat during handleSend — the artifact is already set correctly.
    if (justCreatedChatRef.current) {
      justCreatedChatRef.current = false;
      return;
    }
    cancelSpeech();
    setArtifact(null);
    setShowReflection(false);
    setSessionCodeHistory([]);
  }, [activeChatId]);

  const activeChat = chats.find(c => c.id === activeChatId) ?? null;
  const messages   = activeChat?.messages ?? [];

  // ── Reflection trigger ────────────────────────────────────────────────────────
  useEffect(() => {
    if (messages.length > 0 && messages.length % REFLECTION_TRIGGER === 0) {
      setShowReflection(true);
    }
  }, [messages.length]);

  // ── Fetch chats ───────────────────────────────────────────────────────────────
  const fetchChats = useCallback(async () => {
    if (!user?.id) return;
    setLoadingChats(true);
    try {
      const { data, error } = await supabase
        .from('ai_playground_chats')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      setChats(data ?? []);
    } catch (err) {
      console.error('[Playground] fetch error:', err);
    } finally {
      setLoadingChats(false);
    }
  }, [user?.id]);

  useEffect(() => { fetchChats(); }, [fetchChats]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length, sending]);
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
    }
  }, [userInput]);

  const handleNewChat = () => {
    setActiveChatId(null);
    setUserInput('');
    setAttachment(null);
    setArtifact(null);
    setShowReflection(false);
    setSessionCodeHistory([]);
  };

  // ── Generate title ────────────────────────────────────────────────────────────
  const generateTitle = async (firstMessage: string): Promise<string> => {
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          page: 'AIPlaygroundPage',
          messages: [{ role: 'user', content: `Generate a short 3-5 word title for a chat that starts with: "${firstMessage.slice(0, 200)}". Reply with ONLY the title, no quotes or punctuation.` }],
          max_tokens: 20,
          temperature: 0.3,
        }),
      });
      const rawTitle = await res.text();
      let data: any;
      try { data = JSON.parse(rawTitle); } catch { return firstMessage.slice(0, 40) || 'New Chat'; }
      return data?.content?.[0]?.text?.trim() ?? data?.choices?.[0]?.message?.content?.trim() ?? 'New Chat';
    } catch { return firstMessage.slice(0, 40) || 'New Chat'; }
  };

  // ── openBlockInPanel: add to history, set artifact ───────────────────────────
  const openBlockInPanel = useCallback((
    block: ParsedBlock,
    messageIndex: number,
    blockIndex: number
  ) => {
    const id = `msg${messageIndex}-block${blockIndex}`;
    const historyBlock: HistoryBlock = {
      id,
      language: block.language,
      content: block.content,
      label: block.label,
      cursorHint: block.cursorHint,
      messageIndex,
      blockIndex,
    };
    // Add to history if not already present
    setSessionCodeHistory(prev => {
      if (prev.find(b => b.id === id)) return prev;
      return [...prev, historyBlock];
    });
    setArtifact({
      type: 'code',
      content: block.content,
      title: block.label || `${block.language} snippet`,
      historyId: id,
    });
  }, []);

  // ── selectFromHistory ─────────────────────────────────────────────────────────
  const selectFromHistory = useCallback((block: HistoryBlock) => {
    setArtifact({
      type: 'code',
      content: block.content,
      title: block.label || `${block.language} snippet`,
      historyId: block.id,
    });
  }, []);

  // ── Edit code in artifact panel ───────────────────────────────────────────────
  const handleArtifactEdit = async () => {
    if (!artifactEditInput.trim() || !artifact || artifactEditing) return;
    setArtifactEditing(true);
    const instruction = artifactEditInput.trim();
    setArtifactEditInput('');
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          page:            'AIPlaygroundPage',
          playgroundModel: playgroundModel,
          system: `You are a precise code editor. The user will give you code and an edit instruction.
Return ONLY the complete updated code inside a single fenced code block with the correct language tag.
No explanation before or after — just the fenced block. Preserve all logic not explicitly changed.`,
          messages: [{
            role: 'user',
            content: `Here is the current code (${artifact.title}):\n\`\`\`${artifact.type === 'code' ? 'tsx' : 'text'}\n${artifact.content}\n\`\`\`\n\nEdit instruction: ${instruction}`,
          }],
          max_tokens:  64000,
          temperature: 0.2,
        }),
      });
      const rawText = await res.text();
      let data: any;
      try { data = JSON.parse(rawText); } catch { throw new Error(`API error: ${rawText.slice(0, 200)}`); }
      if (!res.ok) throw new Error(data?.error ?? `API error ${res.status}`);
      const responseText: string = data?.content?.[0]?.text ?? data?.choices?.[0]?.message?.content ?? '';
      const parsed = parseCodeBlocks(responseText);
      if (parsed.length > 0) {
        const updated = parsed[0];
        const newId = `edit-${Date.now()}`;
        const historyBlock: HistoryBlock = {
          id: newId,
          language: updated.language,
          content: updated.content,
          label: `Edited: ${instruction.slice(0, 60)}`,
          messageIndex: -1,
          blockIndex: 0,
        };
        setSessionCodeHistory(prev => [...prev, historyBlock]);
        setArtifact({
          type: 'code',
          content: updated.content,
          title: artifact.title,
          historyId: newId,
        });
      }
    } catch (err) {
      console.error('[Playground] artifact edit error:', err);
    } finally {
      setArtifactEditing(false);
    }
  };


  const handleSend = async () => {
    if ((!userInput.trim() && !attachment) || sending || !user?.id) return;
    const userMsg: ChatMessage = {
      role: 'user',
      content: userInput.trim(),
      timestamp: new Date().toISOString(),
      ...(attachment ? { attachment } : {}),
    };
    const currentInput = userInput.trim();
    setUserInput('');
    setAttachment(null);
    setSending(true);
    setShowReflection(false);

    const updatedMessages = [...messages, userMsg];
    const recentMessages  = updatedMessages.slice(-MAX_API_MESSAGES);
    const apiMessages = recentMessages.map(m => ({
      role: m.role,
      content: m.attachment
        ? `[Attached file: ${m.attachment.name}]\n\n${m.attachment.content}\n\n${m.content}`
        : m.content,
    }));

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          page:            'AIPlaygroundPage',
          playgroundModel: playgroundModel,
          messages:        apiMessages,
          system:          SYSTEM_PROMPT,
          max_tokens:      64000,
          temperature:     0.3,
        }),
      });
      let data: any;
      const rawText = await res.text();
      try { data = JSON.parse(rawText); }
      catch { throw new Error(`API error (${res.status}): ${rawText.slice(0, 200)}`); }
      if (!res.ok) throw new Error(data?.error ?? `API error ${res.status}`);

      const assistantText: string =
        data?.content?.[0]?.text ??
        data?.choices?.[0]?.message?.content ??
        'Sorry, I could not generate a response.';

      const assistantMsg: ChatMessage = { role: 'assistant', content: assistantText, timestamp: new Date().toISOString() };
      const finalMessages = [...updatedMessages, assistantMsg];

      // Parse code blocks from new response and add to session history
      const newMsgIndex = finalMessages.length - 1;
      const parsedBlocks = parseCodeBlocks(assistantText);
      if (parsedBlocks.length > 0) {
        const newHistoryBlocks: HistoryBlock[] = parsedBlocks.map((b, idx) => ({
          id: `msg${newMsgIndex}-block${idx}`,
          language: b.language,
          content: b.content,
          label: b.label,
          cursorHint: b.cursorHint,
          messageIndex: newMsgIndex,
          blockIndex: idx,
        }));
        setSessionCodeHistory(prev => {
          const existingIds = new Set(prev.map(b => b.id));
          const toAdd = newHistoryBlocks.filter(b => !existingIds.has(b.id));
          return [...prev, ...toAdd];
        });
        // Auto-open first block if panel is closed
        if (!artifact) {
          const first = newHistoryBlocks[0];
          setArtifact({
            type: 'code',
            content: first.content,
            title: first.label || `${first.language} snippet`,
            historyId: first.id,
          });
        }
      }

      if (voiceOutputEnabled) speak(assistantText);

      if (activeChatId) {
        const { error } = await supabase
          .from('ai_playground_chats')
          .update({ messages: finalMessages, updated_at: new Date().toISOString() })
          .eq('id', activeChatId);
        if (error) throw error;
        setChats(prev =>
          prev
            .map(c => c.id === activeChatId ? { ...c, messages: finalMessages, updated_at: new Date().toISOString() } : c)
            .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
        );
      } else {
        const title = await generateTitle(currentInput);
        const { data: newChat, error } = await supabase
          .from('ai_playground_chats')
          .insert({ user_id: user.id, title, messages: finalMessages, model: playgroundModel, created_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .select().single();
        if (error) throw error;
        setChats(prev => [newChat, ...prev]);
        justCreatedChatRef.current = true; // prevent reset effect from clearing the artifact
        setActiveChatId(newChat.id);
      }
    } catch (err) {
      console.error('[Playground] send error:', err);
      const errorMsg: ChatMessage = { role: 'assistant', content: 'Sorry, something went wrong. Please try again.', timestamp: new Date().toISOString() };
      if (activeChatId) setChats(prev => prev.map(c => c.id === activeChatId ? { ...c, messages: [...updatedMessages, errorMsg] } : c));
    } finally { setSending(false); }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  // ── File handling ─────────────────────────────────────────────────────────────
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setAttachment({ name: file.name, content: reader.result as string, type: file.type });
    reader.readAsText(file); e.target.value = '';
  };
  const readFileAsText = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => setAttachment({ name: file.name, content: reader.result as string, type: file.type });
    reader.readAsText(file);
  };
  const handleDragOver  = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { if (!dropZoneRef.current?.contains(e.relatedTarget as Node)) setIsDragging(false); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const file = e.dataTransfer.files?.[0]; if (file) readFileAsText(file);
  };

  // ── Chat management ───────────────────────────────────────────────────────────
  const handleDeleteChat = async (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await supabase.from('ai_playground_chats').delete().eq('id', chatId);
      setChats(prev => prev.filter(c => c.id !== chatId));
      if (activeChatId === chatId) setActiveChatId(null);
    } catch (err) { console.error('[Playground] delete error:', err); }
  };
  const startEditTitle = (chat: PlaygroundChat, e: React.MouseEvent) => {
    e.stopPropagation(); setEditingTitleId(chat.id); setEditingTitleValue(chat.title);
  };
  const saveTitle = async (chatId: string) => {
    if (!editingTitleValue.trim()) return;
    try {
      await supabase.from('ai_playground_chats').update({ title: editingTitleValue.trim() }).eq('id', chatId);
      setChats(prev => prev.map(c => c.id === chatId ? { ...c, title: editingTitleValue.trim() } : c));
    } catch (err) { console.error('[Playground] title update error:', err); }
    finally { setEditingTitleId(null); }
  };

  // ── Download transcript ───────────────────────────────────────────────────────
  const handleDownload = () => {
    if (!activeChat) return;
    const modelLabel = getModelDisplayName(activeChat.model ?? playgroundModel);
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${activeChat.title}</title>
    <style>
      body { font-family: Georgia, serif; max-width: 800px; margin: 40px auto; padding: 0 20px; color: #1a1a1a; line-height: 1.7; }
      h1 { font-size: 1.5rem; border-bottom: 2px solid #7c3aed; padding-bottom: 8px; color: #4c1d95; }
      .meta { color: #6b7280; font-size: .85rem; margin-bottom: 32px; }
      .msg { margin: 20px 0; }
      .role { font-weight: bold; font-size: .8rem; text-transform: uppercase; letter-spacing: .08em; margin-bottom: 4px; }
      .user .role { color: #7c3aed; } .assistant .role { color: #059669; }
      .bubble { padding: 14px 18px; border-radius: 8px; white-space: pre-wrap; }
      .user .bubble { background: #f5f3ff; border-left: 3px solid #7c3aed; }
      .assistant .bubble { background: #f0fdf4; border-left: 3px solid #059669; }
      pre { background: #1e1e1e; color: #86efac; padding: 12px; border-radius: 6px; overflow-x: auto; font-size: .85rem; }
      code { background: #f3f4f6; padding: 2px 5px; border-radius: 3px; font-size: .9em; }
      .time { font-size: .75rem; color: #9ca3af; margin-top: 4px; }
    </style></head><body>
    <h1>${activeChat.title}</h1>
    <div class="meta">${new Date(activeChat.created_at).toLocaleString()} · ${messages.length} messages · Model: ${modelLabel}</div>
    ${messages.map(m => `<div class="msg ${m.role}"><div class="role">${m.role === 'user' ? '👤 You' : '🤖 Claude'}</div><div class="bubble">${m.content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div><div class="time">${new Date(m.timestamp).toLocaleTimeString()}</div></div>`).join('')}
    </body></html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const url  = URL.createObjectURL(blob);
    const win  = window.open(url, '_blank');
    if (win) win.onload = () => win.print();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  };

  const filteredChats = chats.filter(c => c.title.toLowerCase().includes(searchQuery.toLowerCase()));
  const charCount     = userInput.length;
  const charWarning   = charCount > MAX_CHAR_LIMIT;

  // ── Voice input ───────────────────────────────────────────────────────────────
  const toggleVoiceInput = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert('Voice input is not supported. Try Chrome or Edge.'); return; }
    if (isListening) { recognitionRef.current?.stop(); return; }
    const rec = new SR();
    recognitionRef.current = rec;
    rec.lang = recognitionLang; rec.continuous = false; rec.interimResults = false;
    rec.onresult = (e: any) => { const t = e.results[0][0].transcript; setUserInput(prev => prev ? `${prev} ${t}` : t); };
    rec.onend = () => setIsListening(false);
    rec.onerror = () => setIsListening(false);
    try { rec.start(); setIsListening(true); }
    catch (err) { console.error('[Playground] voice input error:', err); }
  }, [isListening, recognitionLang]);

  // ══════════════════════════════════════════════════════════════════════════════
  // Render
  // ══════════════════════════════════════════════════════════════════════════════
  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">

      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <div className={`flex flex-col bg-white border-r border-gray-200 transition-all duration-300 flex-shrink-0 ${sidebarOpen ? 'w-64' : 'w-14'}`}>
        <div className="flex items-center justify-between px-3 py-3 border-b border-gray-100 flex-shrink-0">
          {sidebarOpen && <span className="text-sm font-semibold text-gray-700">Chats</span>}
          <div className={`flex items-center gap-1 ${!sidebarOpen ? 'flex-col w-full' : ''}`}>
            <button onClick={handleNewChat} title="New chat" className="p-2 rounded-lg hover:bg-purple-50 text-gray-500 hover:text-purple-600 transition-colors"><Plus size={17} /></button>
            <button onClick={() => setSidebarOpen(!sidebarOpen)} title={sidebarOpen ? 'Collapse' : 'Expand'} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
              {sidebarOpen ? <ChevronLeft size={17} /> : <ChevronRight size={17} />}
            </button>
          </div>
        </div>

        {sidebarOpen && (
          <div className="px-3 py-2 border-b border-gray-100">
            <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 border border-gray-200">
              <Search size={13} className="text-gray-400 flex-shrink-0" />
              <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search chats..." className="bg-transparent text-xs text-gray-700 placeholder-gray-400 outline-none w-full" />
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto py-2">
          {loadingChats ? (
            <div className="flex items-center justify-center py-8"><Loader2 size={16} className="animate-spin text-gray-400" /></div>
          ) : filteredChats.length === 0 ? (
            sidebarOpen && <div className="px-4 py-8 text-center"><MessageSquare size={22} className="text-gray-300 mx-auto mb-2" /><p className="text-xs text-gray-400">No chats yet</p></div>
          ) : (
            filteredChats.map(chat => (
              <div key={chat.id} onClick={() => setActiveChatId(chat.id)}
                className={`group relative flex items-start gap-2 px-3 py-2.5 mx-1 rounded-lg cursor-pointer transition-colors ${activeChatId === chat.id ? 'bg-purple-50 text-purple-700' : 'hover:bg-gray-50 text-gray-700'}`}>
                <MessageSquare size={13} className="flex-shrink-0 mt-0.5 text-gray-400" />
                {sidebarOpen && (
                  <>
                    <div className="flex-1 min-w-0">
                      {editingTitleId === chat.id ? (
                        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                          <input autoFocus value={editingTitleValue} onChange={e => setEditingTitleValue(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') saveTitle(chat.id); if (e.key === 'Escape') setEditingTitleId(null); }}
                            className="text-xs border border-purple-300 rounded px-1 py-0.5 w-full outline-none" />
                          <button onClick={() => saveTitle(chat.id)} className="text-green-600"><Check size={11} /></button>
                          <button onClick={() => setEditingTitleId(null)} className="text-gray-400"><X size={11} /></button>
                        </div>
                      ) : <p className="text-xs font-medium truncate">{chat.title}</p>}
                      <p className="text-xs text-gray-400 mt-0.5">{formatTime(chat.updated_at)}</p>
                    </div>
                    {editingTitleId !== chat.id && (
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                        <button onClick={e => startEditTitle(chat, e)} className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600" title="Rename"><Edit3 size={11} /></button>
                        <button onClick={e => handleDeleteChat(chat.id, e)} className="p-1 rounded hover:bg-red-100 text-gray-400 hover:text-red-500" title="Delete"><Trash2 size={11} /></button>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Main content ─────────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-w-0 overflow-hidden">

        {/* Chat panel */}
        <div ref={dropZoneRef} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
          className={`relative flex flex-col min-w-0 transition-all duration-300 ${artifact ? 'w-1/2' : 'flex-1'}`}>

          {/* Drag overlay */}
          {isDragging && (
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-purple-50/90 border-4 border-dashed border-purple-400 rounded-xl pointer-events-none">
              <div className="w-16 h-16 rounded-2xl bg-purple-100 flex items-center justify-center mb-3"><Paperclip size={28} className="text-purple-500" /></div>
              <p className="text-lg font-bold text-purple-700">Drop file to attach</p>
              <p className="text-sm text-purple-500 mt-1">Text, code, CSV, JSON and more</p>
            </div>
          )}

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center"><Bot size={13} className="text-white" /></div>
              <p className="text-sm font-semibold text-gray-800">{activeChat?.title ?? 'AI Playground'}</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => navigate('/')} className="flex items-center gap-1.5 text-sm font-bold text-purple-700 px-3 py-1.5 rounded-lg bg-purple-100 hover:bg-purple-200 transition-colors border border-purple-200">
                <Home size={15} />Home
              </button>
              <button
                onClick={() => { setVoiceOutputEnabled(v => !v); if (voiceOutputEnabled) cancelSpeech(); }}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors border ${voiceOutputEnabled ? 'bg-purple-600 text-white border-purple-600 hover:bg-purple-700' : 'text-gray-500 border-gray-200 hover:bg-purple-50 hover:text-purple-600 hover:border-purple-200'}`}
              >
                {voiceOutputEnabled ? <><Volume2 size={13} /><span className="hidden sm:inline">{isAfrica ? '🇳🇬' : '🔊'} On</span></> : <><VolumeX size={13} /><span className="hidden sm:inline">Voice</span></>}
              </button>
              {activeChat && messages.length > 0 && (
                <button onClick={handleDownload} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-purple-600 px-3 py-1.5 rounded-lg hover:bg-purple-50 transition-colors border border-gray-200 hover:border-purple-200">
                  <Download size={13} />Download
                </button>
              )}
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">

            {messages.length === 0 && !sending && (
              <div className="flex flex-col items-center justify-center h-full text-center pb-20">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mb-4 shadow-lg"><Bot size={28} className="text-white" /></div>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">
                  {profileName ? `Welcome, ${profileName.split(' ')[0]}!` : 'AI Playground'}
                </h2>
                <p className="text-gray-500 text-sm max-w-sm leading-relaxed">
                  Ask a question, explore an idea, or get help with your code.<br />
                  I'll help you think it through — not just give you the answer.
                </p>
                {branding.isReady && (
                  <p className="mt-3 text-xs italic text-purple-600 max-w-xs">
                    Built for the young people using {branding.institutionName}.
                  </p>
                )}
              </div>
            )}

            {messages.map((msg, msgIdx) => {
              const parsedBlocks = msg.role === 'assistant' ? parseCodeBlocks(msg.content) : [];
              return (
                <div key={msgIdx} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'assistant' && (
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0 mt-1"><Bot size={13} className="text-white" /></div>
                  )}
                  <div className={`${artifact ? 'max-w-md' : 'max-w-2xl'}`}>
                    {msg.attachment && (
                      <div className="mb-2 flex items-center gap-2 text-xs bg-purple-50 border border-purple-100 rounded-lg px-3 py-2 text-purple-700">
                        <Paperclip size={12} /><span className="font-medium">{msg.attachment.name}</span>
                      </div>
                    )}
                    <div className={`rounded-2xl px-4 py-3 ${msg.role === 'user' ? 'bg-gradient-to-br from-purple-600 to-pink-600 text-white rounded-tr-sm' : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm shadow-sm'}`}>
                      {msg.role === 'assistant'
                        ? (
                          <MessageContent
                            text={msg.content}
                            parsedBlocks={parsedBlocks}
                            onOpenBlock={(blockIdx) => openBlockInPanel(parsedBlocks[blockIdx], msgIdx, blockIdx)}
                          />
                        )
                        : <p className="text-base leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                      }
                    </div>
                    <p className={`text-xs text-gray-400 mt-1 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  {msg.role === 'user' && (
                    <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 mt-1"><User size={13} className="text-gray-500" /></div>
                  )}
                </div>
              );
            })}

            {/* Reflection prompt */}
            {showReflection && !sending && (
              <div className="flex justify-center">
                <div className="bg-purple-50 border border-purple-200 rounded-2xl px-5 py-4 max-w-sm text-center shadow-sm">
                  <p className="text-sm font-semibold text-purple-700 mb-1">🌱 Pause and reflect</p>
                  <p className="text-xs text-purple-600 leading-relaxed">You've had a good session. Before you continue — what's one thing you've learned or understood better today?</p>
                  <button onClick={() => setShowReflection(false)} className="mt-3 text-xs text-purple-500 hover:text-purple-700 underline">Dismiss</button>
                </div>
              </div>
            )}

            {/* Typing indicator */}
            {sending && (
              <div className="flex gap-3 justify-start">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0 mt-1"><Bot size={13} className="text-white" /></div>
                <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                  <div className="flex gap-1.5 items-center h-5">
                    <div className="w-2 h-2 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Voice fallback */}
          {fallbackText && <div className="px-6 pb-2"><VoiceFallback text={fallbackText} onDismiss={clearFallback} /></div>}

          {/* Input area */}
          <div className="px-6 py-4 bg-white border-t border-gray-200 flex-shrink-0">
            {attachment && (
              <div className="mb-2 flex items-center gap-2 bg-purple-50 border border-purple-100 rounded-lg px-3 py-2 text-purple-700 text-xs">
                <Paperclip size={12} /><span className="font-medium flex-1 truncate">{attachment.name}</span>
                <button onClick={() => setAttachment(null)} className="hover:text-purple-900"><X size={12} /></button>
              </div>
            )}
            {charWarning && (
              <div className="mb-2 flex items-center gap-2 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <AlertCircle size={13} />
                <span>Your message is long ({charCount.toLocaleString()} characters). Consider breaking it into shorter questions for better results.</span>
              </div>
            )}
            {!modelLoaded && (
              <div className="mb-2 flex items-center gap-2 text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                <Loader2 size={13} className="animate-spin" />
                <span>Loading your model settings — please wait a moment before sending.</span>
              </div>
            )}
            <div className="flex items-end gap-2 bg-white border border-gray-300 rounded-2xl px-4 py-3 shadow-sm focus-within:border-purple-400 focus-within:ring-2 focus-within:ring-purple-100 transition-all">
              <button onClick={() => fileInputRef.current?.click()} className="flex-shrink-0 p-1 text-gray-400 hover:text-purple-600 transition-colors mb-0.5" title="Attach file"><Paperclip size={17} /></button>
              <input ref={fileInputRef} type="file" onChange={handleFileChange} className="hidden" accept=".txt,.md,.csv,.json,.py,.js,.ts,.tsx,.jsx,.html,.css" />
              <textarea ref={textareaRef} value={userInput} onChange={e => setUserInput(e.target.value)} onKeyDown={handleKeyDown}
                placeholder="Message Claude..." rows={1} disabled={sending || !modelLoaded}
                className="flex-1 resize-none outline-none text-base text-gray-800 placeholder-gray-400 bg-transparent min-h-[24px] max-h-[200px] leading-6" />
              <span className="flex-shrink-0 text-xs mb-0.5 pr-1" style={{ color: '#4b5563', fontWeight: 500 }} title={`model: ${playgroundModel} | loaded: ${modelLoaded}`}>
                {modelLoaded ? getModelDisplayName(playgroundModel) : '…'}
              </span>
              <button onClick={toggleVoiceInput} disabled={sending}
                className={`flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all mb-0.5 ${isListening ? 'bg-red-500 text-white animate-pulse' : 'text-gray-400 hover:text-purple-600 hover:bg-purple-50'}`}>
                {isListening ? <MicOff size={13} /> : <Mic size={13} />}
              </button>
              <button onClick={handleSend} disabled={(!userInput.trim() && !attachment) || sending || !modelLoaded}
                className="flex-shrink-0 w-8 h-8 rounded-xl bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center text-white disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity mb-0.5">
                {sending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
              </button>
            </div>
            <p className="text-center text-xs text-gray-400 mt-2">
              Enter to send · Shift+Enter for new line
              {voiceOutputEnabled && selectedVoice && (
                <span className="ml-2 text-purple-500">· 🔊 {selectedVoice.name.split(' ').slice(0, 3).join(' ')}{selectedVoice.localService ? ' (offline)' : ''}</span>
              )}
            </p>
            <p className="text-center text-xs text-gray-300 mt-1">Claude is AI and can make mistakes. Please double-check cited sources.</p>
          </div>
        </div>

        {/* ── Artifact panel ──────────────────────────────────────────────────── */}
        {artifact && (
          <div className="w-1/2 border-l border-gray-200 flex-shrink-0 overflow-hidden">
            <ArtifactPanelView
              artifact={artifact}
              sessionHistory={sessionCodeHistory}
              onSelectHistory={selectFromHistory}
              onClose={() => setArtifact(null)}
              onEdit={handleArtifactEdit}
              editInput={artifactEditInput}
              setEditInput={setArtifactEditInput}
              isEditing={artifactEditing}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default AIPlaygroundPage;