import React from 'react';
import { supabase } from '../lib/supabaseClient';
import { Loader2, CheckCircle, ArrowRight, ArrowUp } from 'lucide-react';
import { useHelpMeAnswer } from '../hooks/useHelpMeAnswer';
import HelpMeAnswerPopup from './HelpMeAnswerPopup';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProjectFile { path: string; content: string; }
export interface WebProject { id: string; name: string; files: ProjectFile[]; pageCount: number; }

interface PlanningTask {
  id: string;
  icon: string;
  label: string;
  teaching: string;
  question: string;
  placeholder: string;
  helpTeaching: string;
}

// ─── Planning tasks ───────────────────────────────────────────────────────────
// Each task builds conceptual understanding before any tool is touched.
// Questions are generated for Task 0 (site-specific); Tasks 1-3 use fixed questions.

const PLANNING_TASKS: PlanningTask[] = [
  {
    id: 'what_is_possible',
    icon: '🌐',
    label: 'What Does Your Site Know?',
    teaching:
      'Right now your site is a static display — the words and numbers are written directly into the code and never change. A database changes that. It means your site can remember things: stories that visitors submit, profiles that people create, numbers that update automatically. The site stops being a poster and becomes a living platform.',
    question: '', // generated from the site content
    placeholder: 'Describe what you wish your site could do that it cannot do right now...',
    helpTeaching:
      'Think about the difference between a printed poster and a noticeboard where people can pin their own messages. Your static site is the poster. A database turns it into the noticeboard.',
  },
  {
    id: 'who_does_what',
    icon: '👥',
    label: 'Who Uses Your Site?',
    teaching:
      'Every database-connected site has different kinds of people using it differently. A visitor just reads. A contributor submits something — a story, a profile, a response. An administrator manages what gets published. Before you design any database, you need to know who your users are and what each of them needs to do.',
    question:
      'Think about your site. Who are the three kinds of people who would use it — someone who just reads, someone who wants to contribute something, and someone who manages everything? Describe each one in a sentence.',
    placeholder:
      'e.g. A visitor reads our stories without signing in. A community member submits their own story after registering. An admin reviews and publishes submissions...',
    helpTeaching:
      'Think about a community noticeboard. Some people walk past and read it. Some people pin a notice. One person maintains it and decides what stays up. Your site needs the same three roles.',
  },
  {
    id: 'what_gets_saved',
    icon: '💾',
    label: 'What Gets Saved?',
    teaching:
      'Every time someone does something on your site — submits a story, creates a profile, fills in a form — something needs to be remembered. That remembered information is a database row. A database table is just a collection of rows that all have the same shape. Before writing any SQL, you need to know: what are the things your site needs to remember, and what details does each one have?',
    question:
      'For your site, name two or three things that need to be saved in the database. For each one, list the pieces of information it would need — like a story needs a title, the text, the author\'s name, and the date it was submitted.',
    placeholder:
      'e.g. A story needs: title, content, author name, community name, date submitted, status (published or pending).\nA profile needs: name, photo, role, short bio, community...',
    helpTeaching:
      'Think of a database table like a contact list on a phone. Every contact has the same fields — name, number, email — but different values. What fields would every story have? Every profile?',
  },
  {
    id: 'who_sees_what',
    icon: '🔒',
    label: 'Who Can See What?',
    teaching:
      'Not everything in a database should be visible to everyone. A pending story should only be visible to the person who wrote it and the admin — not the public. A profile should be readable by anyone but editable only by the owner. These rules are called access policies, and they are written into the database itself. Thinking through them now prevents security problems later.',
    question:
      'For your site, describe the access rules. What can an anonymous visitor see? What can a logged-in community member do that a visitor cannot? What can only an admin do?',
    placeholder:
      'e.g. Anyone can read published stories and all profiles. Only logged-in members can submit a story. Only admins can publish or reject submissions. Members can only edit their own profile...',
    helpTeaching:
      'Think about a community meeting. Anyone can attend and listen. Only members can speak. Only the chair can decide who gets added to the agenda. Your database needs the same rules.',
  },
];

// ─── Sub-task question card ───────────────────────────────────────────────────

interface TaskCardProps {
  task: PlanningTask;
  taskIndex: number;
  totalTasks: number;
  generatedQuestion?: string | null;
  generatingQuestion?: boolean;
  answer: string;
  submitting: boolean;
  onAnswer: (v: string) => void;
  onSubmit: () => void;
  onHelpOpen: () => void;
  answerRef: React.RefObject<HTMLTextAreaElement>;
}

const TaskCard: React.FC<TaskCardProps> = ({
  task, taskIndex, totalTasks, generatedQuestion, generatingQuestion,
  answer, submitting, onAnswer, onSubmit, onHelpOpen, answerRef,
}) => {
  const question = task.id === 'what_is_possible'
    ? (generatedQuestion ?? task.question)
    : task.question;

  return (
    <div className="space-y-3">

      {/* Progress */}
      <div className="flex items-center gap-2">
        <div className="flex gap-1">
          {Array.from({ length: totalTasks }).map((_, i) => (
            <div key={i} className={`h-1 rounded-full transition-all ${
              i < taskIndex ? 'bg-emerald-500 w-6' :
              i === taskIndex ? 'bg-blue-400 w-8' : 'bg-gray-700 w-4'
            }`} />
          ))}
        </div>
        <span className="text-[10px] text-gray-500 font-medium">
          Step {taskIndex + 1} of {totalTasks}
        </span>
      </div>

      {/* Task header */}
      <div className="flex items-center gap-2">
        <span className="text-xl">{task.icon}</span>
        <p className="text-sm font-bold text-white">{task.label}</p>
      </div>

      {/* Teaching */}
      <div className="p-3 bg-amber-500/8 border border-amber-500/20 rounded-xl">
        <p className="text-[10px] font-bold text-amber-400 uppercase tracking-wide mb-1.5">
          💡 Why this matters
        </p>
        <p className="text-xs text-gray-300 leading-relaxed">{task.teaching}</p>
      </div>

      {/* Question */}
      {task.id === 'what_is_possible' && generatingQuestion ? (
        <div className="flex items-center gap-2 py-2">
          <Loader2 size={13} className="animate-spin text-emerald-400" />
          <span className="text-xs text-gray-400">Reading your site...</span>
        </div>
      ) : question ? (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/25 rounded-xl">
          <p className="text-[10px] font-bold text-emerald-400 uppercase mb-1">
            Your question
          </p>
          <p className="text-sm text-white font-medium leading-relaxed">{question}</p>
        </div>
      ) : null}

      {/* Answer area */}
      {(question || task.id !== 'what_is_possible') && (
        <>
          {/* Textarea with inline submit arrow */}
          <div className="relative">
            <textarea
              ref={answerRef}
              value={answer}
              onChange={e => onAnswer(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && answer.trim()) {
                  e.preventDefault();
                  onSubmit();
                }
              }}
              placeholder={task.placeholder}
              rows={5}
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 pr-12 text-sm text-white placeholder-gray-600 resize-none outline-none focus:border-emerald-500 transition-colors leading-relaxed"
            />
            {/* Green up-arrow submit inside the textarea */}
            <button
              onClick={onSubmit}
              disabled={!answer.trim() || submitting}
              title="Submit your answer (Ctrl+Enter)"
              className="absolute bottom-3 right-3 w-8 h-8 flex items-center justify-center rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              {submitting
                ? <Loader2 size={14} className="animate-spin text-white" />
                : <ArrowUp size={14} className="text-white" />
              }
            </button>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-[9px] text-gray-600">Ctrl+Enter to submit</p>
            <button
              onClick={onHelpOpen}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded-lg border border-purple-500/40 text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 transition-colors">
              💬 Help Me Answer
            </button>
          </div>
        </>
      )}
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

const WebProjectLoader: React.FC<{
  userId: string | null;
  onProjectLoaded: (projName: string, planSummary: string) => void;
}> = ({ userId, onProjectLoaded }) => {

  // Project loading
  const [projects, setProjects]       = React.useState<WebProject[]>([]);
  const [loading, setLoading]         = React.useState(true);
  const [selected, setSelected]       = React.useState<WebProject | null>(null);

  // Planning phase state
  const [phase, setPhase]             = React.useState<'pick' | 'plan'>('pick');
  const [taskIndex, setTaskIndex]     = React.useState(0);
  const [answers, setAnswers]         = React.useState<string[]>(Array(PLANNING_TASKS.length).fill(''));
  const [currentAnswer, setCurrentAnswer] = React.useState('');
  const [submitting, setSubmitting]   = React.useState(false);
  const [generatedQ, setGeneratedQ]   = React.useState<string | null>(null);
  const [generatingQ, setGeneratingQ] = React.useState(false);

  const answerRef = React.useRef<HTMLTextAreaElement>(null);

  const currentTask = PLANNING_TASKS[taskIndex];

  // Help Me Answer hook — updates when task changes
  const helpMe = useHelpMeAnswer({
    question: taskIndex === 0
      ? (generatedQ ?? 'What could your site do if visitors could add their own content?')
      : currentTask.question,
    teaching:           currentTask.helpTeaching || currentTask.teaching,
    taskLabel:          currentTask.label,
    taskContext:        selected?.name,
    chatPage:           'WebDevelopmentPage',
    systemPromptPreset: 'web-dev',
  });

  // Load web projects from dashboard
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
            path: p.path || p.name, content: p.content || p.code || '',
          }));
          return {
            id:        s.web_dev_session_id,
            name:      s.web_dev_session_name || 'Unnamed Project',
            files,
            pageCount: files.filter(f => f.path.includes('/pages/')).length,
          };
        }));
        setLoading(false);
      });
  }, [userId]);

  // When a project is selected, generate a site-specific opening question
  const handleSelectProject = async (proj: WebProject) => {
    setSelected(proj);
    setPhase('plan');
    setTaskIndex(0);
    setAnswers(Array(PLANNING_TASKS.length).fill(''));
    setCurrentAnswer('');
    setGeneratedQ(null);
    setGeneratingQ(true);
    setTimeout(() => answerRef.current?.focus(), 200);

    try {
      const pages = proj.files
        .filter(f => f.path.includes('/pages/'))
        .map(f => f.path.split('/').pop()?.replace('.jsx', '') || '')
        .join(', ');
      const appSnippet = proj.files.find(f => f.path === 'src/App.jsx')?.content.slice(0, 400) || '';
      const desc = `Site: ${proj.name}. Pages: ${pages || 'home'}. App.jsx snippet: ${appSnippet}`;

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          page: 'WebDevelopmentPage',
          max_tokens: 100,
          system:
            'You are a full-stack educator. A learner just finished a static React website and is now going to add a real database. '
            + 'Ask ONE question (under 50 words) that helps them imagine what their site could do if visitors could submit, save, or retrieve their own information. '
            + 'Be specific to THEIR site — name the site or reference its content. '
            + 'Start with "Imagine if" or "What if visitors could". No preamble.',
          messages: [{ role: 'user', content: `What they built:\n${desc}\n\nAsk the opening question.` }],
        }),
      });
      const data = await res.json();
      setGeneratedQ(
        data.choices?.[0]?.message?.content?.trim()
        || `Imagine if visitors to ${proj.name} could submit their own content — what would they most want to share or save?`
      );
    } catch {
      setGeneratedQ(`Imagine if visitors to ${proj.name} could submit their own content — what would they most want to share or save?`);
    } finally {
      setGeneratingQ(false);
    }
  };

  // Submit current task answer and advance
  const handleSubmitAnswer = () => {
    if (!currentAnswer.trim() || submitting) return;
    setSubmitting(true);

    const newAnswers = [...answers];
    newAnswers[taskIndex] = currentAnswer.trim();
    setAnswers(newAnswers);

    setTimeout(() => {
      setSubmitting(false);
      if (taskIndex < PLANNING_TASKS.length - 1) {
        // Advance to next task
        setTaskIndex(taskIndex + 1);
        setCurrentAnswer('');
        setTimeout(() => answerRef.current?.focus(), 100);
      } else {
        // All tasks done — build summary and call parent
        const summary = PLANNING_TASKS.map((t, i) =>
          `${t.label}: ${newAnswers[i]}`
        ).join('\n\n');
        onProjectLoaded(selected!.name, summary);
      }
    }, 300);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Help Me Answer popup */}
      <HelpMeAnswerPopup
        {...helpMe}
        onUseDraft={draft => {
          setCurrentAnswer(draft);
          setTimeout(() => answerRef.current?.focus(), 80);
        }}
        phaseLabel="Phase 0 — Data Planning"
      />

      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* ── Header ── */}
        <div className="p-4 bg-blue-500/10 border border-blue-500/25 rounded-xl">
          <p className="text-xs font-bold text-blue-400 uppercase mb-1">
            Phase 0 — Data Planning
          </p>
          <p className="text-sm text-gray-300 leading-relaxed">
            {phase === 'pick'
              ? 'Before we touch any database tools, we plan. Select the web project you built — then we will work through what data it needs.'
              : `Planning for: ${selected?.name}`
            }
          </p>
        </div>

        {/* ── Project picker ── */}
        {phase === 'pick' && (
          <>
            {loading ? (
              <div className="flex items-center gap-2 py-6 justify-center">
                <Loader2 size={16} className="animate-spin text-blue-400" />
                <span className="text-sm text-gray-400">Loading your web projects...</span>
              </div>
            ) : projects.length === 0 ? (
              <div className="p-4 bg-amber-500/10 border border-amber-500/25 rounded-xl text-center">
                <p className="text-sm text-amber-300 font-medium mb-1">No completed Web Builder projects found</p>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Complete the Web Development track first, then come back to add the database layer.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">
                  Your completed web projects
                </p>
                {projects.map(proj => (
                  <button
                    key={proj.id}
                    onClick={() => handleSelectProject(proj)}
                    className="w-full text-left p-3 rounded-xl border border-gray-700 bg-gray-800/40 text-gray-300 hover:border-blue-500/40 hover:bg-gray-800 transition-all">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🌐</span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{proj.name}</p>
                        <p className="text-[10px] text-gray-500 mt-0.5">
                          {proj.files.length} files · {proj.pageCount} page{proj.pageCount !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <ArrowRight size={14} className="text-gray-600 ml-auto flex-shrink-0" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Planning tasks ── */}
        {phase === 'plan' && selected && (
          <>
            {/* Completed tasks summary */}
            {taskIndex > 0 && (
              <div className="space-y-1">
                {PLANNING_TASKS.slice(0, taskIndex).map((t, i) => (
                  <div key={t.id} className="flex items-start gap-2 p-2.5 bg-gray-800/30 rounded-lg border border-gray-700/50">
                    <CheckCircle size={13} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold text-gray-500 uppercase">{t.label}</p>
                      <p className="text-xs text-gray-400 leading-relaxed line-clamp-2">{answers[i]}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Current task */}
            <TaskCard
              task={currentTask}
              taskIndex={taskIndex}
              totalTasks={PLANNING_TASKS.length}
              generatedQuestion={generatedQ}
              generatingQuestion={generatingQ}
              answer={currentAnswer}
              submitting={submitting}
              onAnswer={setCurrentAnswer}
              onSubmit={handleSubmitAnswer}
              onHelpOpen={helpMe.open}
              answerRef={answerRef}
            />

            {/* Final task completion note */}
            {taskIndex === PLANNING_TASKS.length - 1 && (
              <p className="text-[10px] text-gray-600 text-center">
                This is the last planning step — submitting will take you into the full-stack builder.
              </p>
            )}
          </>
        )}
      </div>
    </>
  );
};

export default WebProjectLoader;