// src/pages/AIPlaygroundPage.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabaseClient';
import { useVoice } from '../hooks/useVoice';
import { VoiceFallback } from '../components/VoiceFallback';
import {
  Plus, Search, Trash2, Download, Send, Paperclip,
  ChevronLeft, ChevronRight, Edit3, Check, X,
  MessageSquare, Loader2, Bot, User, Copy, FileText, Code2, Home,
  Mic, MicOff, Volume2, VolumeX,
} from 'lucide-react';

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
  created_at: string;
  updated_at: string;
}
interface ArtifactPanel {
  type: 'code' | 'document';
  language?: string;
  content: string;
  title: string;
}

const formatTime = (iso: string) => {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: 'short' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

const detectArtifact = (content: string): ArtifactPanel | null => {
  const codeMatch = content.match(/```(\w*)\n([\s\S]*?)```/);
  if (codeMatch) {
    const lang = codeMatch[1] || 'code';
    const code = codeMatch[2];
    if (code.trim().length > 80) return { type: 'code', language: lang, content: code, title: `${lang || 'Code'} snippet` };
  }
  const headerCount = (content.match(/^#{1,3} /gm) || []).length;
  const wordCount = content.split(/\s+/).length;
  if (headerCount >= 2 && wordCount > 150) {
    const firstHeader = content.match(/^#{1,3} (.+)/m);
    return { type: 'document', content, title: firstHeader?.[1] ?? 'Document' };
  }
  return null;
};

const MessageContent: React.FC<{ text: string; hasArtifact: boolean }> = ({ text, hasArtifact }) => {
  const display = hasArtifact
    ? text.replace(/```[\s\S]*?```/g, '[→ See code panel]').replace(/^#{1,3} .+\n?/gm, '')
    : text;
  const lines = display.split('\n');
  return (
    <div className="space-y-1 text-base leading-relaxed">
      {lines.map((line, i) => {
        if (line.startsWith('### ')) return <h3 key={i} className="font-bold text-base mt-2">{line.slice(4)}</h3>;
        if (line.startsWith('## ')) return <h2 key={i} className="font-bold text-lg mt-3">{line.slice(3)}</h2>;
        if (line.startsWith('# ')) return <h1 key={i} className="font-bold text-xl mt-3">{line.slice(2)}</h1>;
        if (line.startsWith('- ') || line.startsWith('* ')) return (
          <div key={i} className="flex gap-2"><span className="mt-1 flex-shrink-0">•</span><span>{line.slice(2)}</span></div>
        );
        if (/^\d+\.\s/.test(line)) {
          const dotIdx = line.indexOf('. ');
          return <div key={i} className="flex gap-2"><span className="flex-shrink-0 font-semibold">{line.slice(0, dotIdx + 1)}</span><span>{line.slice(dotIdx + 2)}</span></div>;
        }
        if (line.startsWith('```')) return null;
        if (line.trim() === '') return <div key={i} className="h-1" />;
        if (line === '[→ See code panel]') return <p key={i} className="text-purple-500 italic text-xs">↗ Opened in code panel</p>;
        const parts = line.split(/(\*\*[^*]+\*\*)/g);
        return (
          <p key={i}>
            {parts.map((p, j) => p.startsWith('**') && p.endsWith('**') ? <strong key={j}>{p.slice(2, -2)}</strong> : p)}
          </p>
        );
      })}
    </div>
  );
};

const ArtifactPanelView: React.FC<{ artifact: ArtifactPanel; onClose: () => void }> = ({ artifact, onClose }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(artifact.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="flex flex-col h-full bg-gray-950 text-gray-100">
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-700 flex-shrink-0">
        <div className="flex items-center gap-2">
          {artifact.type === 'code' ? <Code2 size={15} className="text-purple-400" /> : <FileText size={15} className="text-blue-400" />}
          <span className="text-sm font-medium text-gray-200 truncate">{artifact.title}</span>
          {artifact.language && <span className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded">{artifact.language}</span>}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={handleCopy} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-200 px-2 py-1 rounded hover:bg-gray-700 transition-colors">
            <Copy size={12} />{copied ? 'Copied!' : 'Copy'}
          </button>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-gray-200 transition-colors" title="Close panel">
            <X size={15} />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-4">
        {artifact.type === 'code' ? (
          <pre className="text-xs font-mono text-green-300 whitespace-pre-wrap leading-relaxed">{artifact.content}</pre>
        ) : (
          <div className="space-y-1">
            {artifact.content.split('\n').map((line, i) => {
              if (line.startsWith('### ')) return <h3 key={i} className="text-gray-100 font-bold text-base mt-4 mb-1">{line.slice(4)}</h3>;
              if (line.startsWith('## ')) return <h2 key={i} className="text-gray-100 font-bold text-lg mt-5 mb-2">{line.slice(3)}</h2>;
              if (line.startsWith('# ')) return <h1 key={i} className="text-gray-100 font-bold text-xl mt-6 mb-2">{line.slice(2)}</h1>;
              if (line.startsWith('- ') || line.startsWith('* ')) return (
                <div key={i} className="flex gap-2 text-sm text-gray-300"><span>•</span><span>{line.slice(2)}</span></div>
              );
              if (line.trim() === '') return <div key={i} className="h-2" />;
              const parts = line.split(/(\*\*[^*]+\*\*)/g);
              return (
                <p key={i} className="text-sm text-gray-300 leading-relaxed">
                  {parts.map((p, j) => p.startsWith('**') && p.endsWith('**') ? <strong key={j} className="text-gray-100">{p.slice(2, -2)}</strong> : p)}
                </p>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

const MODEL_OPTIONS = [
  { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku' },
  { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
];

const getModelDisplayName = (modelId: string): string => {
  const trimmed = (modelId || '').trim();
  const match = MODEL_OPTIONS.find((m) => m.value === trimmed);
  if (match) return match.label;
  // Friendly fallback for unrecognised IDs
  if (trimmed.includes('sonnet')) return 'Claude Sonnet 4.6';
  if (trimmed.includes('haiku'))  return 'Claude Haiku';
  return trimmed || 'Claude';
};

const AIPlaygroundPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [chats, setChats] = useState<PlaygroundChat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [loadingChats, setLoadingChats] = useState(true);
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [editingTitleValue, setEditingTitleValue] = useState('');
  const [userInput, setUserInput] = useState('');
  const [sending, setSending] = useState(false);
  const [attachment, setAttachment] = useState<{ name: string; content: string; type: string } | null>(null);
  const [artifact, setArtifact] = useState<ArtifactPanel | null>(null);
  const [playgroundModel, setPlaygroundModel] = useState<string>('claude-haiku-4-5-20251001');
  const [modelLoaded, setModelLoaded] = useState(false); // true once profile fetch resolves
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── Voice state ────────────────────────────────────────────────────────────
  const [continent, setContinent] = useState<string | null>(null);
  const [voiceOutputEnabled, setVoiceOutputEnabled] = useState(false);
  const [voiceInputEnabled, setVoiceInputEnabled] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const isAfrica = continent === 'Africa';

  // useVoice: en-NG priority for Africa, en-GB for others; local voices preferred
  const {
    speak,
    cancel: cancelSpeech,
    speaking: isSpeaking,
    fallbackText,
    clearFallback,
    recognitionLang,
    selectedVoice,
  } = useVoice(isAfrica);

  // Fetch both continent + ai_playground_model in one query to avoid race conditions.
  // playgroundModel must be set before the first message is sent.
  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from('profiles')
      .select('continent, ai_playground_model')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (data?.continent) setContinent(data.continent);
        setPlaygroundModel(data?.ai_playground_model || 'claude-haiku-4-5-20251001');
        setModelLoaded(true);
        console.log('[Playground] model loaded from profile:', data?.ai_playground_model ?? 'haiku (default)');
      })
      .catch(() => setModelLoaded(true)); // on error, allow sending with default
  }, [user?.id]);

  // Cancel speech when switching chats
  useEffect(() => { cancelSpeech(); setArtifact(null); }, [activeChatId]);

  const activeChat = chats.find(c => c.id === activeChatId) ?? null;
  const messages = activeChat?.messages ?? [];

  const fetchChats = useCallback(async () => {
    if (!user?.id) return;
    setLoadingChats(true);
    try {
      const { data, error } = await supabase
        .from('ai_playground_chats').select('*').eq('user_id', user.id).order('updated_at', { ascending: false });
      if (error) throw error;
      setChats(data ?? []);
    } catch (err) { console.error('[Playground] fetch error:', err); }
    finally { setLoadingChats(false); }
  }, [user?.id]);

  useEffect(() => { fetchChats(); }, [fetchChats]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length, sending]);
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
    }
  }, [userInput]);


  const handleNewChat = () => { setActiveChatId(null); setUserInput(''); setAttachment(null); setArtifact(null); };

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
      const data = await res.json();
      return data.choices?.[0]?.message?.content?.trim() ?? 'New Chat';
    } catch { return firstMessage.slice(0, 40) || 'New Chat'; }
  };

  const handleSend = async () => {
    if ((!userInput.trim() && !attachment) || sending || !user?.id) return;
    const userMsg: ChatMessage = { role: 'user', content: userInput.trim(), timestamp: new Date().toISOString(), ...(attachment ? { attachment } : {}) };
    const currentInput = userInput.trim();
    setUserInput(''); setAttachment(null); setSending(true);
    const updatedMessages = [...messages, userMsg];
    const apiMessages = updatedMessages.map(m => ({ role: m.role, content: m.attachment ? `[Attached file: ${m.attachment.name}]\n\n${m.attachment.content}\n\n${m.content}` : m.content }));
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          page:           'AIPlaygroundPage',
          playgroundModel: playgroundModel,
          messages:       apiMessages,
          system:         'You are a helpful AI assistant. Be clear, thoughtful, and concise.',
          max_tokens:     2000,
          temperature:    0.7,
        }),
      });
      const data = await res.json();
      const assistantText = data.choices?.[0]?.message?.content ?? 'Sorry, I could not generate a response.';
      const assistantMsg: ChatMessage = { role: 'assistant', content: assistantText, timestamp: new Date().toISOString() };
      const finalMessages = [...updatedMessages, assistantMsg];
      const detected = detectArtifact(assistantText);
      if (detected) setArtifact(detected);
      // Speak AI response if voice output is enabled
      if (voiceOutputEnabled) speak(assistantText);
      if (activeChatId) {
        const { error } = await supabase.from('ai_playground_chats').update({ messages: finalMessages, updated_at: new Date().toISOString() }).eq('id', activeChatId);
        if (error) throw error;
        setChats(prev => prev.map(c => c.id === activeChatId ? { ...c, messages: finalMessages, updated_at: new Date().toISOString() } : c).sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()));
      } else {
        const title = await generateTitle(currentInput);
        const { data: newChat, error } = await supabase.from('ai_playground_chats').insert({ user_id: user.id, title, messages: finalMessages, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }).select().single();
        if (error) throw error;
        setChats(prev => [newChat, ...prev]);
        setActiveChatId(newChat.id);
      }
    } catch (err) {
      console.error('[Playground] send error:', err);
      const errorMsg: ChatMessage = { role: 'assistant', content: 'Sorry, something went wrong. Please check your API key and try again.', timestamp: new Date().toISOString() };
      if (activeChatId) setChats(prev => prev.map(c => c.id === activeChatId ? { ...c, messages: [...updatedMessages, errorMsg] } : c));
    } finally { setSending(false); }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setAttachment({ name: file.name, content: reader.result as string, type: file.type });
    reader.readAsText(file); e.target.value = '';
  };

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

  const handleDownload = () => {
    if (!activeChat) return;
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${activeChat.title}</title>
    <style>body{font-family:Georgia,serif;max-width:800px;margin:40px auto;padding:0 20px;color:#1a1a1a;line-height:1.7}
    h1{font-size:1.5rem;border-bottom:2px solid #7c3aed;padding-bottom:8px;color:#4c1d95}
    .meta{color:#6b7280;font-size:.85rem;margin-bottom:32px}.msg{margin:20px 0}
    .role{font-weight:bold;font-size:.8rem;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px}
    .user .role{color:#7c3aed}.assistant .role{color:#059669}
    .bubble{padding:14px 18px;border-radius:8px;white-space:pre-wrap}
    .user .bubble{background:#f5f3ff;border-left:3px solid #7c3aed}
    .assistant .bubble{background:#f0fdf4;border-left:3px solid #059669}
    .time{font-size:.75rem;color:#9ca3af;margin-top:4px}</style></head><body>
    <h1>${activeChat.title}</h1>
    <div class="meta">${new Date(activeChat.created_at).toLocaleString()} · ${messages.length} messages</div>
    ${messages.map(m => `<div class="msg ${m.role}"><div class="role">${m.role === 'user' ? '👤 You' : '🤖 Claude'}</div>
    <div class="bubble">${m.content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
    <div class="time">${new Date(m.timestamp).toLocaleTimeString()}</div></div>`).join('')}
    </body></html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (win) win.onload = () => win.print();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  };

  const filteredChats = chats.filter(c => c.title.toLowerCase().includes(searchQuery.toLowerCase()));

  // ── Voice input toggle ─────────────────────────────────────────────────────
  const toggleVoiceInput = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert('Voice input is not supported. Try Chrome or Edge.'); return; }

    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }

    const rec = new SR();
    recognitionRef.current = rec;
    rec.lang = recognitionLang; // en-NG for Africa, en-US otherwise
    rec.continuous = false;
    rec.interimResults = false;

    rec.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      setUserInput(prev => prev ? `${prev} ${transcript}` : transcript);
    };
    rec.onend = () => setIsListening(false);
    rec.onerror = () => setIsListening(false);

    try { rec.start(); setIsListening(true); }
    catch (err) { console.error('[Playground] voice input error:', err); }
  }, [isListening, recognitionLang]);

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">

      {/* ── Chat Sidebar ─────────────────────────────────────────────────────── */}
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
                      ) : (
                        <p className="text-xs font-medium truncate">{chat.title}</p>
                      )}
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
        <div className={`flex flex-col min-w-0 transition-all duration-300 ${artifact ? 'w-1/2' : 'flex-1'}`}>

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <Bot size={13} className="text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">{activeChat?.title ?? 'AI Playground'}</p>
                <p className="text-xs text-gray-400">Claude Haiku · Free access</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/')}
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-purple-600 px-3 py-1.5 rounded-lg hover:bg-purple-50 transition-colors border border-gray-200 hover:border-purple-200"
              >
                <Home size={13} />Home
              </button>
              {/* Voice output toggle */}
              <button
                onClick={() => { setVoiceOutputEnabled(v => !v); if (voiceOutputEnabled) cancelSpeech(); }}
                title={voiceOutputEnabled ? 'Turn off voice output' : `Turn on voice output${isAfrica ? ' (Nigerian English)' : ''}`}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors border ${
                  voiceOutputEnabled
                    ? 'bg-purple-600 text-white border-purple-600 hover:bg-purple-700'
                    : 'text-gray-500 border-gray-200 hover:bg-purple-50 hover:text-purple-600 hover:border-purple-200'
                }`}
              >
                {voiceOutputEnabled
                  ? <><Volume2 size={13} /><span className="hidden sm:inline">{isAfrica ? '🇳🇬' : '🔊'} On</span></>
                  : <><VolumeX size={13} /><span className="hidden sm:inline">Voice</span></>
                }
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
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mb-4 shadow-lg">
                  <Bot size={28} className="text-white" />
                </div>
                <h2 className="text-xl font-bold text-gray-800 mb-2">AI Playground</h2>
                <p className="text-gray-500 text-sm max-w-sm leading-relaxed">
                  Ask anything. Code and documents automatically open in a side panel.
                </p>
              </div>
            )}

            {messages.map((msg, i) => {
              const msgArtifact = msg.role === 'assistant' ? detectArtifact(msg.content) : null;
              return (
                <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'assistant' && (
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0 mt-1">
                      <Bot size={13} className="text-white" />
                    </div>
                  )}
                  <div className={`${artifact ? 'max-w-sm' : 'max-w-2xl'}`}>
                    {msg.attachment && (
                      <div className="mb-2 flex items-center gap-2 text-xs bg-purple-50 border border-purple-100 rounded-lg px-3 py-2 text-purple-700">
                        <Paperclip size={12} /><span className="font-medium">{msg.attachment.name}</span>
                      </div>
                    )}
                    <div className={`rounded-2xl px-4 py-3 ${msg.role === 'user' ? 'bg-gradient-to-br from-purple-600 to-pink-600 text-white rounded-tr-sm' : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm shadow-sm'}`}>
                      {msg.role === 'assistant'
                        ? <MessageContent text={msg.content} hasArtifact={!!artifact && !!msgArtifact} />
                        : <p className="text-base leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                      }
                    </div>
                    {msgArtifact && !artifact && (
                      <button onClick={() => setArtifact(msgArtifact)} className="mt-1.5 flex items-center gap-1.5 text-xs text-purple-600 hover:text-purple-700 font-medium">
                        {msgArtifact.type === 'code' ? <Code2 size={11} /> : <FileText size={11} />}
                        Open {msgArtifact.type === 'code' ? 'code' : 'document'} panel
                      </button>
                    )}
                    <p className={`text-xs text-gray-400 mt-1 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  {msg.role === 'user' && (
                    <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 mt-1">
                      <User size={13} className="text-gray-500" />
                    </div>
                  )}
                </div>
              );
            })}

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

          {/* Voice fallback — shown when TTS unavailable (e.g. slow connection in Nigeria) */}
          {fallbackText && (
            <div className="px-6 pb-2">
              <VoiceFallback text={fallbackText} onDismiss={clearFallback} />
            </div>
          )}

          {/* Input */}
          <div className="px-6 py-4 bg-white border-t border-gray-200 flex-shrink-0">
            {attachment && (
              <div className="mb-2 flex items-center gap-2 bg-purple-50 border border-purple-100 rounded-lg px-3 py-2 text-purple-700 text-xs">
                <Paperclip size={12} /><span className="font-medium flex-1 truncate">{attachment.name}</span>
                <button onClick={() => setAttachment(null)} className="hover:text-purple-900"><X size={12} /></button>
              </div>
            )}
            <div className="flex items-end gap-2 bg-white border border-gray-300 rounded-2xl px-4 py-3 shadow-sm focus-within:border-purple-400 focus-within:ring-2 focus-within:ring-purple-100 transition-all">
              <button onClick={() => fileInputRef.current?.click()} className="flex-shrink-0 p-1 text-gray-400 hover:text-purple-600 transition-colors mb-0.5" title="Attach file"><Paperclip size={17} /></button>
              <input ref={fileInputRef} type="file" onChange={handleFileChange} className="hidden" accept=".txt,.md,.csv,.json,.py,.js,.ts,.tsx,.jsx,.html,.css" />
              <textarea ref={textareaRef} value={userInput} onChange={e => setUserInput(e.target.value)} onKeyDown={handleKeyDown}
                placeholder="Message Claude..." rows={1} disabled={sending || !modelLoaded}
                className="flex-1 resize-none outline-none text-base text-gray-800 placeholder-gray-400 bg-transparent min-h-[24px] max-h-[200px] leading-6" />
              <span className="flex-shrink-0 text-xs mb-0.5 pr-1" style={{
                color: playgroundModel.includes('sonnet') ? '#7c3aed' : '#9ca3af',
                fontWeight: playgroundModel.includes('sonnet') ? 600 : 400,
              }}>
                {modelLoaded ? getModelDisplayName(playgroundModel) : '…'}
              </span>
              {/* Voice input button */}
              <button
                onClick={toggleVoiceInput}
                disabled={sending}
                title={isListening ? 'Stop listening' : `Voice input${isAfrica ? ' (Nigerian English)' : ''}`}
                className={`flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all mb-0.5 ${
                  isListening
                    ? 'bg-red-500 text-white animate-pulse'
                    : 'text-gray-400 hover:text-purple-600 hover:bg-purple-50'
                }`}
              >
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

        {/* ── Artifact Panel ─────────────────────────────────────────────────── */}
        {artifact && (
          <div className="w-1/2 border-l border-gray-200 flex-shrink-0 overflow-hidden">
            <ArtifactPanelView artifact={artifact} onClose={() => setArtifact(null)} />
          </div>
        )}
      </div>
    </div>
  );
};

export default AIPlaygroundPage;