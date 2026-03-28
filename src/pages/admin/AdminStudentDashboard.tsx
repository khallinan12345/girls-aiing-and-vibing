// src/pages/admin/AdminStudentDashboard.tsx
//
// Admin view: select any Nigerian learner from a dropdown and view their
// full dashboard — activity rows (progress, scores, sub-category) and
// certification scores with evidence.
//
// Access: /admin/student-dashboard

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../hooks/useAuth';
import {
  Users, ChevronDown, Loader2, AlertCircle, RefreshCw,
  Award, BookOpen, CheckCircle, Clock, Circle,
  ChevronUp, Trophy, User, BarChart2, Code, Brain,
  Target, Lightbulb, MessageSquare, Cpu, Briefcase,
} from 'lucide-react';
import classNames from 'classnames';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Learner {
  id: string;
  name: string | null;
  email: string | null;
  grade_level: number | null;
  continent: string | null;
  country: string | null;
}

interface ActivityRow {
  id: string;
  activity: string;
  category_activity: string;
  sub_category?: string | null;
  progress: string;
  updated_at: string;
  certificate_pdf_url?: string | null;
  web_dev_evaluation?: any;
  vibe_cert_evaluation?: any;
  [key: string]: any;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const progressColor = (p: string) => {
  if (p === 'completed') return 'bg-green-100 text-green-800 border-green-200';
  if (p === 'started')   return 'bg-yellow-100 text-yellow-800 border-yellow-200';
  return 'bg-gray-100 text-gray-600 border-gray-200';
};

const progressIcon = (p: string) => {
  if (p === 'completed') return <CheckCircle size={13} className="text-green-600" />;
  if (p === 'started')   return <Clock size={13} className="text-yellow-600" />;
  return <Circle size={13} className="text-gray-400" />;
};

const scoreLabel = (s: number | null) => {
  if (s === null) return '—';
  return ['No Evidence', 'Emerging', 'Proficient ✓', 'Advanced ✓'][s] ?? `${s}`;
};

const categoryIcon = (cat: string) => {
  switch ((cat || '').toLowerCase()) {
    case 'certification':     return <Trophy size={15} className="text-purple-600" />;
    case 'ai learning':       return <Brain size={15} className="text-blue-600" />;
    case 'tech workshop':
    case 'vibe coding':       return <Code size={15} className="text-pink-600" />;
    case 'skills':            return <BookOpen size={15} className="text-indigo-600" />;
    case 'critical thinking': return <Target size={15} className="text-red-600" />;
    case 'creativity':        return <Lightbulb size={15} className="text-orange-500" />;
    case 'communication':     return <MessageSquare size={15} className="text-purple-500" />;
    case 'digital fluency':   return <Cpu size={15} className="text-cyan-600" />;
    default:                  return <BarChart2 size={15} className="text-gray-500" />;
  }
};

// Extract certification_* score cols (not certification_evaluation_*)
const extractCertScores = (row: ActivityRow): { label: string; score: number }[] =>
  Object.entries(row)
    .filter(([k, v]) =>
      k.startsWith('certification_') &&
      k.endsWith('_score') &&
      !k.startsWith('certification_evaluation_') &&
      v !== null && v !== undefined
    )
    .map(([k, v]) => ({
      label: k.replace('certification_', '').replace('_score', '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      score: v as number,
    }));

// Extract certification_evaluation_* score cols (learning scores)
const extractEvalScores = (row: ActivityRow): { label: string; score: number }[] =>
  Object.entries(row)
    .filter(([k, v]) =>
      k.startsWith('certification_evaluation_') &&
      k.endsWith('_score') &&
      v !== null && v !== undefined
    )
    .map(([k, v]) => ({
      label: k.replace('certification_evaluation_', '').replace('_score', '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      score: v as number,
    }));

// ─── ScorePill ────────────────────────────────────────────────────────────────

const ScorePill: React.FC<{ score: number | null }> = ({ score }) => (
  <span className={classNames('text-xs px-2 py-0.5 rounded-full border font-medium', {
    'bg-emerald-50 text-emerald-700 border-emerald-200': score !== null && score >= 3,
    'bg-blue-50 text-blue-700 border-blue-200':           score !== null && score === 2,
    'bg-amber-50 text-amber-700 border-amber-200':        score !== null && score === 1,
    'bg-red-50 text-red-600 border-red-200':              score !== null && score === 0,
    'bg-gray-50 text-gray-400 border-gray-200':           score === null,
  })}>
    {scoreLabel(score)}
  </span>
);

// ─── ActivityCard ─────────────────────────────────────────────────────────────

const ActivityCard: React.FC<{ row: ActivityRow }> = ({ row }) => {
  const [open, setOpen] = useState(false);
  const isCert      = row.category_activity === 'Certification';
  const certScores  = isCert ? extractCertScores(row) : [];
  const evalScores  = !isCert ? extractEvalScores(row) : [];

  const webDevScores = row.web_dev_evaluation?.scores
    ? Object.entries(row.web_dev_evaluation.scores as Record<string, { score: number; evidence?: string }>)
    : [];
  const vibeCertScores = row.vibe_cert_evaluation?.scores
    ? Object.entries(row.vibe_cert_evaluation.scores as Record<string, { score: number; evidence?: string }>)
    : [];

  const hasDetail = certScores.length > 0 || evalScores.length > 0 || webDevScores.length > 0 || vibeCertScores.length > 0;
  const dateStr = row.updated_at
    ? new Date(row.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : '';

  return (
    <div className={classNames('border rounded-lg overflow-hidden', isCert ? 'border-purple-200' : 'border-gray-200')}>

      {/* Header */}
      <div
        className={classNames(
          'flex items-center gap-3 px-4 py-3',
          isCert ? 'bg-purple-50' : 'bg-white',
          hasDetail ? 'cursor-pointer hover:bg-gray-50 transition-colors' : ''
        )}
        onClick={() => hasDetail && setOpen(o => !o)}
      >
        <div className="flex-shrink-0">{categoryIcon(row.category_activity)}</div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{row.activity}</p>
          <p className="text-xs text-gray-500">
            {row.category_activity}
            {row.sub_category && ` · ${row.sub_category}`}
            {dateStr && <span className="ml-2 text-gray-400">{dateStr}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {progressIcon(row.progress)}
          <span className={classNames('text-xs px-2 py-0.5 rounded-full border font-medium', progressColor(row.progress))}>
            {row.progress}
          </span>
          {row.certificate_pdf_url && (
            <a
              href={row.certificate_pdf_url} target="_blank" rel="noopener noreferrer"
              className="text-xs px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full hover:bg-amber-100 transition-colors"
              onClick={e => e.stopPropagation()}
            >
              🏆 PDF
            </a>
          )}
          {hasDetail && (open
            ? <ChevronUp size={14} className="text-gray-400" />
            : <ChevronDown size={14} className="text-gray-400" />
          )}
        </div>
      </div>

      {/* Expanded scores */}
      {open && hasDetail && (
        <div className="px-4 pb-4 pt-3 border-t border-gray-100 bg-gray-50 space-y-3">

          {certScores.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">Certification Scores</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {certScores.map(({ label, score }) => (
                  <div key={label} className="flex items-center justify-between bg-white rounded px-3 py-1.5 border border-gray-100">
                    <span className="text-xs text-gray-700 truncate pr-2">{label}</span>
                    <ScorePill score={score} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {webDevScores.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">Web Dev Cert Scores</p>
              <div className="space-y-1.5">
                {webDevScores.map(([name, val]) => (
                  <div key={name} className="bg-white rounded px-3 py-2 border border-gray-100">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-gray-700">{name}</span>
                      <ScorePill score={val.score ?? null} />
                    </div>
                    {val.evidence && <p className="text-[11px] text-gray-500 leading-relaxed">{val.evidence}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {vibeCertScores.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">Vibe Coding Cert Scores</p>
              <div className="space-y-1.5">
                {vibeCertScores.map(([name, val]) => (
                  <div key={name} className="bg-white rounded px-3 py-2 border border-gray-100">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-gray-700">{name}</span>
                      <ScorePill score={val.score ?? null} />
                    </div>
                    {val.evidence && <p className="text-[11px] text-gray-500 leading-relaxed">{val.evidence}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {evalScores.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">Learning Scores</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {evalScores.map(({ label, score }) => (
                  <div key={label} className="flex items-center justify-between bg-white rounded px-3 py-1.5 border border-gray-100">
                    <span className="text-xs text-gray-700 truncate pr-2">{label}</span>
                    <ScorePill score={score} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Admin & excluded IDs ─────────────────────────────────────────────────────

const ADMIN_IDS = new Set([
  '0e738663-a70e-4fd3-9ba6-718c02e116c2',
  '5d5e0486-e768-4c5d-ba63-d1e4570a352d',
  '8b3f70dc-e5d0-4eb0-af7d-ec6181968213',
]);

const EXCLUDED_IDS = new Set([
  '0e738663-a70e-4fd3-9ba6-718c02e116c2',
  '8b3f70dc-e5d0-4eb0-af7d-ec6181968213',
  '5d5e0486-e768-4c5d-ba63-d1e4570a352d',
  '40e9daa6-7ec1-49a9-9be7-814a3d607d86',
  '73da14c1-e49a-4410-9390-6fe069fd7528',
  'f6157a9d-5ffd-4058-b0b3-af3ea897d876',
]);

// ═══════════════════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════════════════

const AdminStudentDashboard: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  // ── Auth guard ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (authLoading) return;
    if (!user || !ADMIN_IDS.has(user.id)) {
      navigate('/home', { replace: true });
    }
  }, [user, authLoading, navigate]);

  // Render nothing while auth resolves or if not admin
  if (authLoading || !user || !ADMIN_IDS.has(user.id)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 size={28} className="animate-spin text-purple-500" />
      </div>
    );
  }

  const [learners,        setLearners]        = useState<Learner[]>([]);
  const [loadingLearners, setLoadingLearners] = useState(true);
  const [learnersError,   setLearnersError]   = useState<string | null>(null);

  const [selectedId,  setSelectedId]  = useState<string>('');
  const [activities,  setActivities]  = useState<ActivityRow[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [dataError,   setDataError]   = useState<string | null>(null);
  const [filterCat,   setFilterCat]   = useState<string>('all');

  // Fetch all Nigerian learners
  useEffect(() => {
    (async () => {
      setLoadingLearners(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, name, email, grade_level, continent, country')
          .eq('continent', 'Africa')
          .order('name', { ascending: true });
        if (error) throw error;
        setLearners((data || []).filter(l => !EXCLUDED_IDS.has(l.id)));
      } catch (err: any) {
        setLearnersError(err.message || 'Failed to load learners');
      } finally {
        setLoadingLearners(false);
      }
    })();
  }, []);

  // Fetch selected learner's dashboard rows
  const fetchData = useCallback(async (userId: string) => {
    if (!userId) return;
    setLoadingData(true);
    setDataError(null);
    setActivities([]);
    setFilterCat('all');
    try {
      const { data, error } = await supabase
        .from('dashboard')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      setActivities(data || []);
    } catch (err: any) {
      setDataError(err.message || 'Failed to load dashboard data');
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => { if (selectedId) fetchData(selectedId); }, [selectedId, fetchData]);

  // Derived
  const selectedLearner = learners.find(l => l.id === selectedId) || null;
  const certRows        = activities.filter(a => a.category_activity === 'Certification');
  const learningRows    = activities.filter(a => a.category_activity !== 'Certification' && a.activity !== 'english_skills');
  const uniqueCategories = [...new Set(learningRows.map(a => a.category_activity).filter(Boolean))].sort();
  const filteredLearning = filterCat === 'all' ? learningRows : learningRows.filter(a => a.category_activity === filterCat);
  const completedLearning = learningRows.filter(a => a.progress === 'completed').length;
  const completedCerts    = certRows.filter(a => a.progress === 'completed').length;

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <Users size={22} className="text-purple-600" />
            <h1 className="text-2xl font-bold text-gray-900">Admin — Student Dashboard</h1>
          </div>
          <p className="text-sm text-gray-500 ml-9">View any Nigerian learner's activity progress and certification scores.</p>
        </div>

        {/* Learner selector */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-6">
          <label className="block text-sm font-semibold text-gray-700 mb-2">Select Learner</label>

          {loadingLearners ? (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 size={16} className="animate-spin" /> Loading learners…
            </div>
          ) : learnersError ? (
            <div className="flex items-center gap-2 text-sm text-red-600">
              <AlertCircle size={16} /> {learnersError}
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <select
                  value={selectedId}
                  onChange={e => setSelectedId(e.target.value)}
                  className="w-full appearance-none bg-white border border-gray-300 rounded-lg px-4 py-2.5 pr-10 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">— Choose a learner ({learners.length} total) —</option>
                  {learners.map(l => (
                    <option key={l.id} value={l.id}>
                      {l.name || '(no name)'} — {l.email || l.id.slice(0, 8)}
                      {l.grade_level ? ` · Grade ${l.grade_level}` : ''}
                    </option>
                  ))}
                </select>
                <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
              {selectedId && (
                <button
                  onClick={() => fetchData(selectedId)}
                  className="flex items-center gap-1.5 px-3 py-2.5 text-sm font-semibold text-purple-700 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors"
                >
                  <RefreshCw size={14} /> Refresh
                </button>
              )}
            </div>
          )}

          {/* Profile strip */}
          {selectedLearner && (
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-500 bg-gray-50 rounded-lg px-4 py-2.5 border border-gray-100">
              <span className="flex items-center gap-1"><User size={11} className="text-gray-400" />{selectedLearner.name || '—'}</span>
              <span className="text-gray-300">|</span>
              <span>{selectedLearner.email || '—'}</span>
              {selectedLearner.grade_level && <><span className="text-gray-300">|</span><span>Grade {selectedLearner.grade_level}</span></>}
              {selectedLearner.country && <><span className="text-gray-300">|</span><span>{selectedLearner.country}</span></>}
              <span className="text-gray-300">|</span>
              <span className="font-mono text-gray-400 text-[10px]">{selectedLearner.id}</span>
            </div>
          )}
        </div>

        {/* Loading */}
        {loadingData && (
          <div className="flex items-center justify-center gap-2 py-16 text-gray-500">
            <Loader2 size={20} className="animate-spin" /> Loading dashboard…
          </div>
        )}

        {/* Error */}
        {dataError && (
          <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 mb-4">
            <AlertCircle size={16} /> {dataError}
          </div>
        )}

        {/* Content */}
        {!loadingData && selectedId && activities.length > 0 && (
          <div className="space-y-6">

            {/* Summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Learning Activities', value: learningRows.length,  icon: <BookOpen size={18} className="text-blue-500" />,  bg: 'bg-blue-50'   },
                { label: 'Completed',           value: completedLearning,    icon: <CheckCircle size={18} className="text-green-500" />, bg: 'bg-green-50' },
                { label: 'Certifications',      value: certRows.length,      icon: <Trophy size={18} className="text-purple-500" />,   bg: 'bg-purple-50' },
                { label: 'Certs Completed',     value: completedCerts,       icon: <Award size={18} className="text-amber-500" />,     bg: 'bg-amber-50'  },
              ].map(({ label, value, icon, bg }) => (
                <div key={label} className={`${bg} rounded-xl p-4 flex items-center gap-3 border border-white shadow-sm`}>
                  {icon}
                  <div>
                    <p className="text-xl font-black text-gray-900">{value}</p>
                    <p className="text-xs text-gray-500 leading-tight">{label}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Certifications */}
            {certRows.length > 0 && (
              <section>
                <h2 className="text-base font-bold text-gray-800 mb-3 flex items-center gap-2">
                  <Trophy size={16} className="text-purple-600" /> Certifications
                  <span className="text-xs font-normal text-gray-400">({certRows.length})</span>
                </h2>
                <div className="space-y-2">
                  {certRows.map(row => <ActivityCard key={row.id} row={row} />)}
                </div>
              </section>
            )}

            {/* Learning activities */}
            {learningRows.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
                    <BookOpen size={16} className="text-blue-600" /> Learning Activities
                    <span className="text-xs font-normal text-gray-400">({filteredLearning.length}/{learningRows.length})</span>
                  </h2>
                  {uniqueCategories.length > 1 && (
                    <div className="flex flex-wrap gap-1.5">
                      {['all', ...uniqueCategories].map(cat => (
                        <button
                          key={cat}
                          onClick={() => setFilterCat(cat)}
                          className={classNames(
                            'px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors',
                            filterCat === cat
                              ? 'bg-purple-600 text-white border-purple-600'
                              : 'bg-white text-gray-600 border-gray-200 hover:border-purple-300 hover:text-purple-700'
                          )}
                        >
                          {cat === 'all' ? `All (${learningRows.length})` : cat}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  {filteredLearning.map(row => <ActivityCard key={row.id} row={row} />)}
                </div>
              </section>
            )}

          </div>
        )}

        {/* Empty state */}
        {!loadingData && selectedId && activities.length === 0 && !dataError && (
          <div className="text-center py-16 text-gray-400">
            <BarChart2 size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">No dashboard rows found for this learner.</p>
          </div>
        )}

        {/* No selection */}
        {!selectedId && !loadingLearners && (
          <div className="text-center py-20 text-gray-400">
            <Users size={44} className="mx-auto mb-4 opacity-20" />
            <p className="text-sm">Select a learner above to view their dashboard.</p>
          </div>
        )}

      </div>
    </AppLayout>
  );
};

export default AdminStudentDashboard;
