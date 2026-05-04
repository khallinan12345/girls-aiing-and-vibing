import React from 'react';
import { supabase } from '../lib/supabaseClient';
import { Loader2, CheckCircle, ArrowRight } from 'lucide-react';
import { useHelpMeAnswer } from '../hooks/useHelpMeAnswer';
import HelpMeAnswerPopup from './HelpMeAnswerPopup';

interface ProjectFile { path: string; content: string; }
export interface WebProject { id: string; name: string; files: ProjectFile[]; pageCount: number; }

const WebProjectLoader: React.FC<{
  userId: string | null;
  onProjectLoaded: (projName: string, dataAnswer: string) => void;
}> = ({ userId, onProjectLoaded }) => {
  const [projects, setProjects] = React.useState<WebProject[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selected, setSelected] = React.useState<WebProject | null>(null);
  const [question, setQuestion] = React.useState<string | null>(null);
  const [questionLoading, setQuestionLoading] = React.useState(false);
  const [answer, setAnswer] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const answerRef = React.useRef<HTMLTextAreaElement>(null);

  // Help Me Answer — uses the same hook + popup as WebDevelopmentPage
  const helpMe = useHelpMeAnswer({
    question:           question ?? '',
    teaching:           'Think about what information visitors would want to submit, save, or look up on your site — stories, profiles, comments, registrations, survey answers.',
    taskLabel:          'Planning Your Data',
    taskContext:        selected?.name,
    chatPage:           'WebDevelopmentPage',
    systemPromptPreset: 'web-dev',
  });

  React.useEffect(() => {
    if (!userId) { setLoading(false); return; }
    supabase.from('dashboard')
      .select('web_dev_session_id, web_dev_session_name, web_dev_pages, updated_at')
      .eq('user_id', userId)
      .not('web_dev_session_id', 'is', null)
      .order('updated_at', { ascending: false })
      .then(({ data }) => {
        if (data?.length) setProjects(data.map((s: any) => {
          const files: ProjectFile[] = (s.web_dev_pages || []).map((p: any) => ({
            path: p.path || p.name, content: p.content || p.code || ''
          }));
          return {
            id: s.web_dev_session_id,
            name: s.web_dev_session_name || 'Unnamed Project',
            files,
            pageCount: files.filter(f => f.path.includes('/pages/')).length
          };
        }));
        setLoading(false);
      });
  }, [userId]);

  const handleSelect = async (proj: WebProject) => {
    setSelected(proj); setQuestion(null); setAnswer(''); setQuestionLoading(true);
    try {
      const pages = proj.files.filter(f => f.path.includes('/pages/'))
        .map(f => f.path.split('/').pop()?.replace('.jsx', '') || '').join(', ');
      const appCode = proj.files.find(f => f.path === 'src/App.jsx')?.content.slice(0, 300) || '';
      const desc = 'Site: ' + proj.name + '. Pages: ' + (pages || 'home') + '. Code: ' + appCode;
      const system = 'You are a full-stack educator helping a learner plan how to add real data to their website. '
        + 'Look at what they built and ask ONE question (under 40 words) that helps them discover '
        + 'what information VISITORS would want to submit, save, or retrieve from their site. '
        + 'Think about: forms people could fill in, stories they could share, profiles they could create, '
        + 'or community data they could contribute. Be specific to THEIR site. No preamble. '
        + 'Start with "What if visitors could" or "Imagine if people could".';
      const res = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page: 'WebDevelopmentPage', max_tokens: 80, system,
          messages: [{ role: 'user', content: 'What they built:\n' + desc + '\nAsk the question.' }] })
      });
      const data = await res.json();
      setQuestion(data.choices?.[0]?.message?.content?.trim()
        || 'What if visitors could submit their own stories or profiles — what would they want to share?');
      setTimeout(() => answerRef.current?.focus(), 80);
    } catch {
      setQuestion('What if visitors could submit their own stories or profiles — what would they want to share?');
    } finally { setQuestionLoading(false); }
  };

  const handleSubmit = () => {
    if (!selected || !answer.trim() || submitting) return;
    setSubmitting(true);
    onProjectLoaded(selected.name, answer.trim());
  };

  return (
    <>
      {/* Help Me Answer popup — renders over everything when open */}
      <HelpMeAnswerPopup
        {...helpMe}
        onUseDraft={draft => { setAnswer(draft); setTimeout(() => answerRef.current?.focus(), 80); }}
        phaseLabel="Load Your Web Project"
      />

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Header */}
        <div className="p-4 bg-blue-500/10 border border-blue-500/25 rounded-xl">
          <p className="text-xs font-bold text-blue-400 uppercase mb-2">Step 1 of 1 — Your Starting Point</p>
          <p className="text-sm text-gray-300 leading-relaxed">
            Full-stack development adds a real database to the site you already built.
            Select your web project — we will build the data layer on top of it.
          </p>
        </div>

        {/* Project list */}
        {loading ? (
          <div className="flex items-center gap-2 py-6 justify-center">
            <Loader2 size={16} className="animate-spin text-blue-400" />
            <span className="text-sm text-gray-400">Loading your web projects...</span>
          </div>
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
                className={'w-full text-left p-3 rounded-xl border transition-all ' +
                  (selected?.id === proj.id
                    ? 'bg-blue-500/15 border-blue-500/50 text-white'
                    : 'bg-gray-800/40 border-gray-700 text-gray-300 hover:border-blue-500/30 hover:bg-gray-800')}>
                <div className="flex items-center gap-2">
                  <span className="text-lg">🌐</span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{proj.name}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">
                      {proj.files.length} files · {proj.pageCount} page{proj.pageCount !== 1 ? 's' : ''}
                    </p>
                  </div>
                  {selected?.id === proj.id && <CheckCircle size={14} className="text-blue-400 ml-auto" />}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Socratic question + answer */}
        {selected && (
          <div className="space-y-3">
            {questionLoading ? (
              <div className="flex items-center gap-2 py-3">
                <Loader2 size={13} className="animate-spin text-emerald-400" />
                <span className="text-xs text-gray-400">Thinking about your project...</span>
              </div>
            ) : question ? (
              <>
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/25 rounded-xl">
                  <p className="text-[10px] font-bold text-emerald-400 uppercase mb-1">Before we add the database...</p>
                  <p className="text-sm text-white font-medium leading-relaxed">{question}</p>
                </div>

                <p className="text-xs text-gray-400 leading-relaxed">
                  Think about what visitors would want to <span className="text-gray-300 font-medium">submit, save, or look up</span> — stories, profiles, comments, registrations. Write your ideas below, or click <span className="text-purple-300 font-medium">Help Me Answer</span> to talk it through first.
                </p>

                <textarea
                  ref={answerRef}
                  value={answer}
                  onChange={e => setAnswer(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSubmit(); }}
                  placeholder="Write your answer here — there is no wrong answer..."
                  rows={4}
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 resize-none outline-none focus:border-emerald-500 transition-colors"
                />

                <p className="text-[9px] text-gray-600">Ctrl+Enter to continue</p>

                {/* Help Me Answer button */}
                <button
                  onClick={helpMe.open}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl border border-purple-500/40 text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 transition-colors">
                  💬 Help Me Answer
                </button>

                {/* Submit button */}
                <button
                  onClick={handleSubmit}
                  disabled={!answer.trim() || submitting}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-colors disabled:opacity-40">
                  {submitting ? <Loader2 size={15} className="animate-spin" /> : <ArrowRight size={15} />}
                  Continue to Full-Stack Overview
                </button>
              </>
            ) : null}
          </div>
        )}
      </div>
    </>
  );
};

export default WebProjectLoader;
