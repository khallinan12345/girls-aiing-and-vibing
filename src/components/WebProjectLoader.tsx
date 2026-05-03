import React from 'react';
import { supabase } from '../lib/supabaseClient';
import { Loader2, CheckCircle, ArrowRight } from 'lucide-react';

interface ProjectFile { path: string; content: string; }
export interface WebProject { id: string; name: string; files: ProjectFile[]; pageCount: number; }

const WebProjectLoader: React.FC<{
  userId: string | null;
  onProjectLoaded: (project: WebProject, dataRoleAnswer: string) => void;
}> = ({ userId, onProjectLoaded }) => {
  const [projects, setProjects] = React.useState<WebProject[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selected, setSelected] = React.useState<WebProject | null>(null);
  const [question, setQuestion] = React.useState<string | null>(null);
  const [questionLoading, setQuestionLoading] = React.useState(false);
  const [answer, setAnswer] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const answerRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    if (!userId) { setLoading(false); return; }
    supabase.from('dashboard')
      .select('session_id, session_name, pages, updated_at')
      .eq('user_id', userId).eq('activity', 'web_development')
      .not('session_id', 'is', null).order('updated_at', { ascending: false })
      .then(({ data }) => {
        if (data?.length) setProjects(data.map((s: any) => {
          const files: ProjectFile[] = (s.pages || []).map((p: any) => ({ path: p.path || p.name, content: p.content || p.code || '' }));
          return { id: s.session_id, name: s.session_name || 'Unnamed Project', files, pageCount: files.filter((f: ProjectFile) => f.path.includes('/pages/')).length };
        }));
        setLoading(false);
      });
  }, [userId]);

  const handleSelect = async (proj: WebProject) => {
    setSelected(proj); setQuestion(null); setAnswer(''); setQuestionLoading(true);
    try {
      const pages = proj.files.filter(f => f.path.includes('/pages/')).map(f => f.path.split('/').pop()?.replace('.jsx','') || '').join(', ');
      const appCode = proj.files.find(f => f.path === 'src/App.jsx')?.content.slice(0, 300) || '';
      const desc = 'Site: ' + proj.name + '. Pages: ' + (pages || 'home') + '. Code: ' + appCode;
      const system = 'You are a full-stack educator. Ask ONE Socratic question (under 40 words, starting with What happens when or How would) revealing why this static site needs a real database. Be specific. No preamble.';
      const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page: 'WebDevelopmentPage', max_tokens: 80, system, messages: [{ role: 'user', content: 'What they built:\n' + desc + '\nAsk the question.' }] }) });
      const data = await res.json();
      setQuestion(data.choices?.[0]?.message?.content?.trim() || 'What happens when a visitor wants to add their own content? Where would it go?');
      setTimeout(() => answerRef.current?.focus(), 80);
    } catch { setQuestion('What happens when a visitor wants to add their own content? Where would it go?'); }
    finally { setQuestionLoading(false); }
  };

  const handleSubmit = () => { if (!selected || !answer.trim() || submitting) return; setSubmitting(true); onProjectLoaded(selected, answer.trim()); };

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      <div className="p-4 bg-blue-500/10 border border-blue-500/25 rounded-xl">
        <p className="text-xs font-bold text-blue-400 uppercase mb-2">Step 1 of 1 - Your Starting Point</p>
        <p className="text-sm text-gray-300 leading-relaxed">Full-stack development adds a real database to the site you already built. Select your web project - we will build the data layer on top of it.</p>
      </div>
      {loading ? (
        <div className="flex items-center gap-2 py-6 justify-center"><Loader2 size={16} className="animate-spin text-blue-400" /><span className="text-sm text-gray-400">Loading your web projects...</span></div>
      ) : projects.length === 0 ? (
        <div className="p-4 bg-amber-500/10 border border-amber-500/25 rounded-xl text-center">
          <p className="text-sm text-amber-300 font-medium mb-1">No completed Web Builder projects found</p>
          <p className="text-xs text-gray-400">Complete the Web Development track first, then come back to add the database layer.</p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Your completed web projects</p>
          {projects.map(proj => (
            <button key={proj.id} onClick={() => handleSelect(proj)}
              className={'w-full text-left p-3 rounded-xl border transition-all ' + (selected?.id === proj.id ? 'bg-blue-500/15 border-blue-500/50 text-white' : 'bg-gray-800/40 border-gray-700 text-gray-300 hover:border-blue-500/30 hover:bg-gray-800')}>
              <div className="flex items-center gap-2">
                <span className="text-lg">🌐</span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{proj.name}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">{proj.files.length} files</p>
                </div>
                {selected?.id === proj.id && <CheckCircle size={14} className="text-blue-400 ml-auto" />}
              </div>
            </button>
          ))}
        </div>
      )}
      {selected && (
        <div className="space-y-3">
          {questionLoading ? (
            <div className="flex items-center gap-2 py-3"><Loader2 size={13} className="animate-spin text-emerald-400" /><span className="text-xs text-gray-400">Thinking about your project...</span></div>
          ) : question ? (
            <>
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/25 rounded-xl">
                <p className="text-[10px] font-bold text-emerald-400 uppercase mb-1">Before we add the database...</p>
                <p className="text-sm text-white font-medium leading-relaxed">{question}</p>
              </div>
              <textarea ref={answerRef} value={answer} onChange={e => setAnswer(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSubmit(); }}
                placeholder="Write your answer here - there is no wrong answer..."
                rows={4} className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 resize-none outline-none focus:border-emerald-500 transition-colors" />
              <button onClick={handleSubmit} disabled={!answer.trim() || submitting}
                className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-colors disabled:opacity-40">
                {submitting ? <Loader2 size={15} className="animate-spin" /> : <ArrowRight size={15} />}
                Continue to Full-Stack Overview
              </button>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default WebProjectLoader;
