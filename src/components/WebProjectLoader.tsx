import React from 'react';
import { supabase } from '../lib/supabaseClient';
import { Loader2, CheckCircle, ArrowRight } from 'lucide-react';

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
  const [showHelp, setShowHelp] = React.useState(false);
  const [helpMessages, setHelpMessages] = React.useState<{role:'assistant'|'user';text:string}[]>([]);
  const [helpInput, setHelpInput] = React.useState('');
  const [helpLoading, setHelpLoading] = React.useState(false);
  const [helpDraft, setHelpDraft] = React.useState('');

  const openHelp = () => {
    if (!selected) return;
    setHelpMessages([{role:'assistant',text:'I can help you think about what data your site needs. What kinds of things would you want visitors to be able to do — like submit a story, create a profile, or sign up for something?'}]);
    setHelpInput(''); setHelpDraft(''); setShowHelp(true);
  };

  const sendHelp = async () => {
    if (!helpInput.trim() || helpLoading) return;
    const msgs = [...helpMessages, {role:'user' as const, text:helpInput.trim()}];
    setHelpMessages(msgs); setHelpInput(''); setHelpLoading(true);
    try {
      const res = await fetch('/api/chat', {method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({page:'WebDevelopmentPage',max_tokens:300,
          system:'You are helping a learner plan what data their website needs. Site: ' + (selected?.name||'') + '. Guide them to think about what visitors would submit, save, or look up. Keep replies under 4 sentences. When you have a clear picture of their data needs, end with READY_TO_DRAFT.',
          messages:msgs.map(m=>({role:m.role,content:m.text}))})})
      const data = await res.json();
      const reply = data.choices?.[0]?.message?.content||'';
      const isReady = reply.includes('READY_TO_DRAFT');
      const clean = reply.replace('READY_TO_DRAFT','').trim();
      setHelpMessages(p=>[...p,{role:'assistant',text:clean}]);
      if (isReady) getDraft([...msgs,{role:'assistant',text:clean}]);
    } catch { setHelpMessages(p=>[...p,{role:'assistant',text:'Sorry, try again.'}]); }
    finally { setHelpLoading(false); }
  };

  const getDraft = async (msgs=helpMessages) => {
    try {
      const res = await fetch('/api/chat', {method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({page:'WebDevelopmentPage',max_tokens:200,
          system:'Based on the conversation, write 2-3 sentences in first person describing what data this learner wants their website to collect and why. Plain English, no jargon.',
          messages:[...msgs.map(m=>({role:m.role,content:m.text})),{role:'user',content:'Write my answer.'}]})})
      const data = await res.json();
      setHelpDraft(data.choices?.[0]?.message?.content||'');
    } catch {}
  };

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
        || 'What happens when a visitor wants to add their own content? Where would it go?');
      setTimeout(() => answerRef.current?.focus(), 80);
    } catch {
      setQuestion('What happens when a visitor wants to add their own content? Where would it go?');
    } finally { setQuestionLoading(false); }
  };

  const handleSubmit = () => {
    if (!selected || !answer.trim() || submitting) return;
    setSubmitting(true);
    onProjectLoaded(selected.name, answer.trim());
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      <div className="p-4 bg-blue-500/10 border border-blue-500/25 rounded-xl">
        <p className="text-xs font-bold text-blue-400 uppercase mb-2">Step 1 of 1 - Your Starting Point</p>
        <p className="text-sm text-gray-300 leading-relaxed">
          Full-stack development adds a real database to the site you already built.
          Select your web project - we will build the data layer on top of it.
        </p>
      </div>
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
                    {proj.files.length} files &middot; {proj.pageCount} page{proj.pageCount !== 1 ? 's' : ''}
                  </p>
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
                Think about what information visitors would want to <strong className="text-gray-300">submit, save, or look up</strong> on your site — stories, profiles, comments, registrations. Write your ideas below, or click <strong className="text-purple-300">Help Me Answer</strong> if you want to talk it through first.
              </p>
              <textarea ref={answerRef} value={answer} onChange={e => setAnswer(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSubmit(); }}
                placeholder="Write your answer here - there is no wrong answer..."
                rows={4}
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 resize-none outline-none focus:border-emerald-500 transition-colors" />
              {/* Help Me Answer — opens inline chat */}
              {showHelp ? (
                <div className="space-y-2">
                  <div className="rounded-xl border p-3 space-y-2" style={{background:'#1a1025',borderColor:'#6040a0',maxHeight:'220px',overflowY:'auto'}}>
                    {helpMessages.map((m,i) => (
                      <div key={i} className={`flex ${m.role==='user'?'justify-end':'justify-start'}`}>
                        <div className="rounded-2xl px-3 py-2 text-xs leading-relaxed" style={{maxWidth:'85%',background:m.role==='user'?'#4a20a0':'#2a1845',color:m.role==='user'?'white':'#e0d0ff'}}>{m.text}</div>
                      </div>
                    ))}
                    {helpLoading && <div className="flex gap-1 px-3 py-2"><div className="w-1.5 h-1.5 rounded-full animate-bounce bg-purple-400" /><div className="w-1.5 h-1.5 rounded-full animate-bounce bg-purple-400" style={{animationDelay:'0.15s'}} /><div className="w-1.5 h-1.5 rounded-full animate-bounce bg-purple-400" style={{animationDelay:'0.3s'}} /></div>}
                  </div>
                  <div className="flex gap-2">
                    <input value={helpInput} onChange={e=>setHelpInput(e.target.value)}
                      onKeyDown={e=>{if(e.key==='Enter')sendHelp();}}
                      placeholder="Ask me anything..."
                      className="flex-1 rounded-xl px-3 py-2 text-xs outline-none" style={{background:'#2a1845',border:'1px solid #6040a0',color:'white'}} />
                    <button onClick={sendHelp} disabled={helpLoading||!helpInput.trim()} className="px-3 py-2 rounded-xl text-xs font-bold disabled:opacity-40" style={{background:'#6040a0',color:'white'}}>Send</button>
                    <button onClick={()=>setShowHelp(false)} className="px-3 py-2 rounded-xl text-xs font-bold" style={{background:'#2a1845',color:'#a080e0'}}>Close</button>
                  </div>
                  {helpDraft && (
                    <div className="p-3 rounded-xl border" style={{background:'#0f2a0f',borderColor:'#3a7a3a'}}>
                      <p className="text-[10px] font-bold text-emerald-400 uppercase mb-1">Suggested answer</p>
                      <p className="text-xs text-emerald-200 leading-relaxed mb-2">{helpDraft}</p>
                      <button onClick={()=>{setAnswer(helpDraft);setShowHelp(false);}} className="w-full py-1.5 rounded-lg text-xs font-bold" style={{background:'#3a7a3a',color:'white'}}>Use this answer</button>
                    </div>
                  )}
                  {!helpDraft && helpMessages.length>=3 && (
                    <button onClick={getDraft} disabled={helpLoading} className="w-full py-2 rounded-xl text-xs font-bold disabled:opacity-40" style={{background:'#3a7a3a',color:'white'}}>✨ Get an AI response you can use</button>
                  )}
                </div>
              ) : (
                <button onClick={openHelp} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl border border-purple-500/40 text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 transition-colors">
                  💬 Help Me Answer
                </button>
              )}
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
