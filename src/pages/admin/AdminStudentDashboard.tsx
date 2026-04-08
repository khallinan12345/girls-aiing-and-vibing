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
  DollarSign, TrendingUp, Zap, Activity, Filter,
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

// ─── Cost types ──────────────────────────────────────────────────────────────

interface CostRow {
  id: string;
  logged_at: string;
  page: string;
  provider: 'anthropic' | 'groq';
  model: string;
  input_tokens: number;
  output_tokens: number;
  cache_hit_tokens: number;
  cache_write_tokens: number;
  estimated_cost_usd: number;
  user_id: string | null;
  city: string | null;
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


// ─── Cost helpers ─────────────────────────────────────────────────────────────

const PRICING: Record<string, { input: number; output: number; label: string }> = {
  'claude-sonnet-4-6':         { input: 3.00,  output: 15.00, label: 'Sonnet 4.6'   },
  'claude-haiku-4-5-20251001': { input: 1.00,  output: 5.00,  label: 'Haiku 4.5'    },
  'llama-3.3-70b-versatile':   { input: 0.00,  output: 0.00,  label: 'Groq Llama 70B'},
};

const modelLabel = (m: string) => PRICING[m]?.label || m;

const fmtCost = (n: number) => n < 0.001 ? '<$0.001' : `$${n.toFixed(3)}`;
const fmtTokens = (n: number) => n >= 1_000_000 ? `${(n/1_000_000).toFixed(1)}M` : n >= 1000 ? `${(n/1000).toFixed(0)}k` : `${n}`;

function groupCostRows(rows: CostRow[], by: 'page' | 'model' | 'provider') {
  const map = new Map<string, { cost: number; calls: number; inTok: number; outTok: number; cacheHit: number; provider: string }>();
  rows.forEach(r => {
    const key = by === 'page' ? r.page : by === 'model' ? modelLabel(r.model) : r.provider;
    const existing = map.get(key) || { cost: 0, calls: 0, inTok: 0, outTok: 0, cacheHit: 0, provider: r.provider };
    map.set(key, {
      cost:     existing.cost + r.estimated_cost_usd,
      calls:    existing.calls + 1,
      inTok:    existing.inTok + r.input_tokens,
      outTok:   existing.outTok + r.output_tokens,
      cacheHit: existing.cacheHit + r.cache_hit_tokens,
      provider: r.provider,
    });
  });
  return [...map.entries()].sort((a, b) => b[1].cost - a[1].cost);
}

// ─── CostOverviewPanel ────────────────────────────────────────────────────────

interface CostOverviewProps {
  rows: CostRow[];
  loading: boolean;
  error: string | null;
  days: number;
  setDays: (d: number) => void;
  groupBy: 'page' | 'model' | 'provider';
  setGroupBy: (g: 'page' | 'model' | 'provider') => void;
  onRefresh: () => void;
}

const CostOverviewPanel: React.FC<CostOverviewProps> = ({
  rows, loading, error, days, setDays, groupBy, setGroupBy, onRefresh
}) => {
  const totalCost      = rows.reduce((s, r) => s + r.estimated_cost_usd, 0);
  const anthropicCost  = rows.filter(r => r.provider === 'anthropic').reduce((s, r) => s + r.estimated_cost_usd, 0);
  const totalInTok     = rows.reduce((s, r) => s + r.input_tokens, 0);
  const totalCacheHit  = rows.reduce((s, r) => s + r.cache_hit_tokens, 0);
  const cacheRate      = totalInTok > 0 ? (totalCacheHit / totalInTok * 100) : 0;
  const groqCalls      = rows.filter(r => r.provider === 'groq').length;
  const anthropicCalls = rows.filter(r => r.provider === 'anthropic').length;
  const cacheSaved     = (totalCacheHit / 1_000_000) * 1.00 * 0.90; // ~90% savings on cached input

  // Daily cost breakdown
  const byDay = new Map<string, number>();
  rows.forEach(r => {
    const day = r.logged_at.slice(0, 10);
    byDay.set(day, (byDay.get(day) || 0) + r.estimated_cost_usd);
  });
  const dayEntries = [...byDay.entries()].sort().slice(-14); // last 14 days

  const grouped = groupCostRows(rows, groupBy);
  const maxCost = grouped[0]?.[1].cost || 1;

  const providerColor = (p: string) => p === 'groq' ? 'bg-emerald-500' : 'bg-blue-500';
  const providerBadge = (p: string) => p === 'groq'
    ? <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">Groq</span>
    : <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-semibold">Anthropic</span>;

  if (loading) return (
    <div className="flex items-center justify-center gap-2 py-20 text-gray-500">
      <Loader2 size={20} className="animate-spin" /> Loading cost data…
    </div>
  );

  if (error) return (
    <div className="p-5 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
      <p className="font-semibold mb-1">Cost data unavailable</p>
      <p>{error}</p>
      <p className="mt-2 text-xs">Deploy the updated <code className="bg-amber-100 px-1 rounded">chat.js</code> and run <code className="bg-amber-100 px-1 rounded">create_api_cost_log.sql</code> in Supabase to enable cost tracking.</p>
    </div>
  );

  return (
    <div className="space-y-6">

      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {([7, 30, 90] as const).map(d => (
            <button key={d} onClick={() => setDays(d)}
              className={classNames('px-3 py-1.5 rounded text-xs font-semibold transition-colors',
                days === d ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
              {d}d
            </button>
          ))}
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {(['page', 'model', 'provider'] as const).map(g => (
            <button key={g} onClick={() => setGroupBy(g)}
              className={classNames('px-3 py-1.5 rounded text-xs font-semibold transition-colors capitalize',
                groupBy === g ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
              {g}
            </button>
          ))}
        </div>
        <button onClick={onRefresh} className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors ml-auto">
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Anthropic cost', value: `$${anthropicCost.toFixed(2)}`, sub: `last ${days} days`, icon: <DollarSign size={16} className="text-blue-500" />, bg: 'bg-blue-50' },
          { label: 'Cache savings',  value: `$${cacheSaved.toFixed(2)}`,    sub: `${cacheRate.toFixed(0)}% hit rate`,    icon: <Zap size={16} className="text-amber-500" />,  bg: 'bg-amber-50' },
          { label: 'Groq requests',  value: groqCalls.toLocaleString(),      sub: '$0 — free tier',    icon: <TrendingUp size={16} className="text-emerald-500" />, bg: 'bg-emerald-50' },
          { label: 'Anthropic reqs', value: anthropicCalls.toLocaleString(), sub: `${fmtTokens(totalInTok)} tokens in`, icon: <Activity size={16} className="text-purple-500" />, bg: 'bg-purple-50' },
        ].map(({ label, value, sub, icon, bg }) => (
          <div key={label} className={`${bg} rounded-xl p-4 flex items-center gap-3 border border-white shadow-sm`}>
            {icon}
            <div>
              <p className="text-xl font-black text-gray-900">{value}</p>
              <p className="text-xs text-gray-500 leading-tight">{label}</p>
              <p className="text-[10px] text-gray-400">{sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Cost by group */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
          <DollarSign size={14} className="text-gray-400" />
          <span className="text-sm font-bold text-gray-700">Cost by {groupBy}</span>
          <span className="text-xs text-gray-400 ml-auto">{rows.length} requests</span>
        </div>
        {grouped.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">No cost data yet — calls logged here after chat.js is deployed</div>
        ) : (
          <div className="p-5 space-y-3">
            {grouped.map(([key, val]) => (
              <div key={key} className="flex items-center gap-3">
                <div className="w-40 flex-shrink-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-gray-700 truncate">{key}</span>
                    {providerBadge(val.provider)}
                  </div>
                  <div className="text-[10px] text-gray-400 mt-0.5">{val.calls.toLocaleString()} calls · {fmtTokens(val.inTok + val.outTok)} tokens</div>
                </div>
                <div className="flex-1 bg-gray-100 rounded-full h-2">
                  <div
                    className={classNames('h-2 rounded-full transition-all', providerColor(val.provider))}
                    style={{ width: `${(val.cost / maxCost * 100).toFixed(1)}%` }}
                  />
                </div>
                <div className="w-16 text-right text-xs font-semibold text-gray-700 flex-shrink-0">{fmtCost(val.cost)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Daily trend */}
      {dayEntries.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <span className="text-sm font-bold text-gray-700">Daily cost trend</span>
          </div>
          <div className="p-5">
            <div className="flex items-end gap-1.5 h-24">
              {dayEntries.map(([day, cost]) => {
                const maxDay = Math.max(...dayEntries.map(([,c]) => c), 0.001);
                const pct = Math.max(cost / maxDay * 100, 2);
                return (
                  <div key={day} className="flex-1 flex flex-col items-center gap-1 group relative">
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[10px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none">
                      {day}: {fmtCost(cost)}
                    </div>
                    <div className="w-full bg-blue-400 rounded-t transition-all" style={{ height: `${pct}%` }} />
                    <div className="text-[9px] text-gray-400 rotate-45 origin-left mt-1 whitespace-nowrap">{day.slice(5)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Provider split */}
      <div className="grid grid-cols-2 gap-4">
        {(['anthropic', 'groq'] as const).map(provider => {
          const pRows = rows.filter(r => r.provider === provider);
          const pCost = pRows.reduce((s, r) => s + r.estimated_cost_usd, 0);
          const pInTok = pRows.reduce((s, r) => s + r.input_tokens, 0);
          const pOutTok = pRows.reduce((s, r) => s + r.output_tokens, 0);
          const pCache = pRows.reduce((s, r) => s + r.cache_hit_tokens, 0);
          return (
            <div key={provider} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                {provider === 'groq'
                  ? <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">Groq · Free</span>
                  : <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-bold">Anthropic · Paid</span>}
              </div>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between"><span className="text-gray-500">Total cost</span><span className="font-semibold text-gray-800">{fmtCost(pCost)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Requests</span><span className="font-semibold text-gray-800">{pRows.length.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Input tokens</span><span className="font-semibold text-gray-800">{fmtTokens(pInTok)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Output tokens</span><span className="font-semibold text-gray-800">{fmtTokens(pOutTok)}</span></div>
                {provider === 'anthropic' && <div className="flex justify-between"><span className="text-gray-500">Cache hits</span><span className="font-semibold text-emerald-700">{fmtTokens(pCache)}</span></div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── LearnerCostPanel ─────────────────────────────────────────────────────────
// Two-view design:
//   VIEW 1 (default): Summary table — all students, sortable, click a name to drill in
//   VIEW 2 (detail):  Individual student breakdown — back button returns to table

interface LearnerCostProps {
  learners: Learner[];
  selectedId: string;
  setSelectedId: (id: string) => void;
  allCostRows: CostRow[];   // all rows across all learners (fetched once)
  learnerRows: CostRow[];   // rows for the currently selected learner
  loading: boolean;
  loadingDetail: boolean;
  onRefresh: () => void;
}

type SortKey = 'name' | 'cost' | 'requests' | 'groq' | 'anthropic' | 'city';

const LearnerCostPanel: React.FC<LearnerCostProps> = ({
  learners, selectedId, setSelectedId, allCostRows, learnerRows, loading, loadingDetail, onRefresh
}) => {
  const [sortKey,  setSortKey]  = useState<SortKey>('cost');
  const [sortAsc,  setSortAsc]  = useState(false);
  const [groupBy,  setGroupBy]  = useState<'page' | 'model' | 'provider'>('page');
  const [search,   setSearch]   = useState('');

  // ── Build per-learner summary from allCostRows ──────────────────────────────
  type LearnerSummary = {
    id: string; name: string; email: string; city: string;
    totalCost: number; requests: number; groqReqs: number; anthReqs: number;
    topPage: string;
  };

  const summaries: LearnerSummary[] = learners.map(l => {
    const lRows = allCostRows.filter(r => r.user_id === l.id);
    const groqReqs = lRows.filter(r => r.provider === 'groq').length;
    const anthReqs = lRows.filter(r => r.provider === 'anthropic').length;
    // find top page by call count
    const pageCounts: Record<string, number> = {};
    lRows.forEach(r => { pageCounts[r.page] = (pageCounts[r.page] || 0) + 1; });
    const topPage = Object.entries(pageCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';
    return {
      id: l.id,
      name: l.name || '(no name)',
      email: l.email || '',
      city: (l as any).city || '—',
      totalCost: lRows.reduce((s, r) => s + r.estimated_cost_usd, 0),
      requests: lRows.length,
      groqReqs,
      anthReqs,
      topPage,
    };
  });

  const filtered = summaries.filter(s =>
    search === '' ||
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.email.toLowerCase().includes(search.toLowerCase())
  );

  const sorted = [...filtered].sort((a, b) => {
    let av: any, bv: any;
    if (sortKey === 'name')      { av = a.name;      bv = b.name; }
    else if (sortKey === 'cost') { av = a.totalCost;  bv = b.totalCost; }
    else if (sortKey === 'requests') { av = a.requests; bv = b.requests; }
    else if (sortKey === 'groq')     { av = a.groqReqs; bv = b.groqReqs; }
    else if (sortKey === 'anthropic') { av = a.anthReqs; bv = b.anthReqs; }
    else                              { av = a.city;     bv = b.city; }
    if (av < bv) return sortAsc ? -1 :  1;
    if (av > bv) return sortAsc ?  1 : -1;
    return 0;
  });

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(a => !a);
    else { setSortKey(key); setSortAsc(false); }
  };

  const SortIcon = ({ k }: { k: SortKey }) => sortKey !== k ? null : sortAsc
    ? <ChevronUp size={11} className="inline ml-0.5 text-purple-500" />
    : <ChevronDown size={11} className="inline ml-0.5 text-purple-500" />;

  const maxCost = Math.max(...summaries.map(s => s.totalCost), 0.001);

  // ── Detail view helpers ─────────────────────────────────────────────────────
  const selectedLearner = learners.find(l => l.id === selectedId);
  const totalCost   = learnerRows.reduce((s, r) => s + r.estimated_cost_usd, 0);
  const totalInTok  = learnerRows.reduce((s, r) => s + r.input_tokens, 0);
  const totalOutTok = learnerRows.reduce((s, r) => s + r.output_tokens, 0);
  const groqRows    = learnerRows.filter(r => r.provider === 'groq');
  const anthRows    = learnerRows.filter(r => r.provider === 'anthropic');
  const grouped     = groupCostRows(learnerRows, groupBy);
  const maxGroupCost = grouped[0]?.[1].cost || 1;

  // ── VIEW 2: Individual detail ───────────────────────────────────────────────
  if (selectedId) {
    return (
      <div className="space-y-5">

        {/* Back button + learner name */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSelectedId('')}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <ChevronUp size={14} className="rotate-[-90deg]" /> All students
          </button>
          <div>
            <span className="text-base font-bold text-gray-900">{selectedLearner?.name || '(no name)'}</span>
            <span className="text-xs text-gray-400 ml-2">{selectedLearner?.email}</span>
          </div>
          <button onClick={onRefresh} className="ml-auto flex items-center gap-1 px-3 py-2 text-xs font-semibold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <RefreshCw size={12} /> Refresh
          </button>
        </div>

        {loadingDetail && (
          <div className="flex items-center justify-center gap-2 py-12 text-gray-500">
            <Loader2 size={18} className="animate-spin" /> Loading…
          </div>
        )}

        {!loadingDetail && learnerRows.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <DollarSign size={36} className="mx-auto mb-3 opacity-20" />
            <p className="text-sm">No cost data for this learner yet.</p>
            <p className="text-xs mt-1 text-gray-300">Requires userId passed in chat requests.</p>
          </div>
        )}

        {!loadingDetail && learnerRows.length > 0 && (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Total cost',      value: fmtCost(totalCost),              bg: 'bg-blue-50',    icon: <DollarSign size={16} className="text-blue-500" /> },
                { label: 'Total requests',  value: learnerRows.length.toLocaleString(), bg: 'bg-purple-50', icon: <Activity size={16} className="text-purple-500" /> },
                { label: 'Groq requests',   value: groqRows.length.toLocaleString(), bg: 'bg-emerald-50', icon: <Zap size={16} className="text-emerald-500" /> },
                { label: 'Anthropic reqs',  value: anthRows.length.toLocaleString(), bg: 'bg-amber-50',   icon: <TrendingUp size={16} className="text-amber-500" /> },
              ].map(({ label, value, bg, icon }) => (
                <div key={label} className={`${bg} rounded-xl p-4 flex items-center gap-3 border border-white shadow-sm`}>
                  {icon}<div><p className="text-xl font-black text-gray-900">{value}</p><p className="text-xs text-gray-500">{label}</p></div>
                </div>
              ))}
            </div>

            {/* Group by + breakdown bars */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-3">
                <DollarSign size={14} className="text-gray-400" />
                <span className="text-sm font-bold text-gray-700">Cost breakdown</span>
                <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5 ml-auto">
                  {(['page', 'model', 'provider'] as const).map(g => (
                    <button key={g} onClick={() => setGroupBy(g)}
                      className={classNames('px-2.5 py-1 rounded text-xs font-semibold transition-colors capitalize',
                        groupBy === g ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
                      {g}
                    </button>
                  ))}
                </div>
                <span className="text-xs text-gray-400">{fmtTokens(totalInTok + totalOutTok)} tokens</span>
              </div>
              <div className="p-5 space-y-3">
                {grouped.map(([key, val]) => (
                  <div key={key} className="flex items-center gap-3">
                    <div className="w-48 flex-shrink-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs text-gray-700 truncate">{key}</span>
                        <span className={classNames('text-[10px] px-1.5 py-0.5 rounded border font-semibold',
                          val.provider === 'groq' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-blue-50 text-blue-700 border-blue-200')}>
                          {val.provider === 'groq' ? 'Groq' : 'Anthropic'}
                        </span>
                      </div>
                      <div className="text-[10px] text-gray-400 mt-0.5">{val.calls} calls</div>
                    </div>
                    <div className="flex-1 bg-gray-100 rounded-full h-2">
                      <div className={classNames('h-2 rounded-full', val.provider === 'groq' ? 'bg-emerald-500' : 'bg-blue-500')}
                        style={{ width: `${(val.cost / maxGroupCost * 100).toFixed(1)}%` }} />
                    </div>
                    <div className="w-16 text-right text-xs font-semibold text-gray-700 flex-shrink-0">{fmtCost(val.cost)}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent requests */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100">
                <span className="text-sm font-bold text-gray-700">Recent requests</span>
                <span className="text-xs text-gray-400 ml-2">(last 50)</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>{['Time','Page','Provider','In tok','Out tok','Cache','Cost'].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider">{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {learnerRows.slice(0, 50).map(r => (
                      <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{new Date(r.logged_at).toLocaleString('en-GB', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })}</td>
                        <td className="px-3 py-2 text-gray-700 font-medium max-w-[120px] truncate">{r.page}</td>
                        <td className="px-3 py-2">
                          <span className={classNames('px-1.5 py-0.5 rounded border text-[10px] font-semibold',
                            r.provider === 'groq' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-blue-50 text-blue-700 border-blue-200')}>
                            {r.provider === 'groq' ? 'Groq' : 'Anthropic'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-gray-600 font-mono">{r.input_tokens.toLocaleString()}</td>
                        <td className="px-3 py-2 text-gray-600 font-mono">{r.output_tokens.toLocaleString()}</td>
                        <td className="px-3 py-2 text-emerald-600 font-mono">{r.cache_hit_tokens.toLocaleString()}</td>
                        <td className="px-3 py-2 font-semibold text-gray-800">{fmtCost(r.estimated_cost_usd)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {learnerRows.length > 50 && (
                  <div className="px-5 py-3 text-xs text-gray-400 border-t border-gray-100">Showing 50 of {learnerRows.length}</div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  // ── VIEW 1: Summary table of all students ───────────────────────────────────
  return (
    <div className="space-y-4">

      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <input
          type="text"
          placeholder="Search by name or email…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 min-w-48 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
        <button onClick={onRefresh} className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
          <RefreshCw size={14} /> Refresh
        </button>
        <span className="text-xs text-gray-400">{sorted.length} learners</span>
      </div>

      {loading && (
        <div className="flex items-center justify-center gap-2 py-16 text-gray-500">
          <Loader2 size={18} className="animate-spin" /> Loading cost data…
        </div>
      )}

      {!loading && (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '22%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '18%' }} />
                <col style={{ width: '18%' }} />
              </colgroup>
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {([
                    { key: 'name' as SortKey,       label: 'Student' },
                    { key: 'city' as SortKey,       label: 'City'    },
                    { key: 'cost' as SortKey,       label: 'Total cost' },
                    { key: 'requests' as SortKey,   label: 'Requests' },
                    { key: 'groq' as SortKey,       label: 'Groq' },
                    { key: 'anthropic' as SortKey,  label: 'Anthropic' },
                    { key: null,                    label: 'Top page'  },
                  ] as { key: SortKey | null; label: string }[]).map(({ key, label }) => (
                    <th
                      key={label}
                      onClick={() => key && toggleSort(key)}
                      className={classNames(
                        'px-4 py-3 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider',
                        key ? 'cursor-pointer hover:text-purple-700 select-none' : ''
                      )}
                    >
                      {label}{key && <SortIcon k={key} />}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sorted.map(s => (
                  <tr
                    key={s.id}
                    className="hover:bg-purple-50 transition-colors cursor-pointer group"
                    onClick={() => setSelectedId(s.id)}
                  >
                    {/* Name — clickable, highlighted */}
                    <td className="px-4 py-3">
                      <div className="font-semibold text-purple-700 group-hover:underline truncate">{s.name}</div>
                      <div className="text-[11px] text-gray-400 truncate">{s.email}</div>
                    </td>
                    {/* City */}
                    <td className="px-4 py-3 text-xs text-gray-500">{s.city}</td>
                    {/* Cost with mini bar */}
                    <td className="px-4 py-3">
                      <div className="font-semibold text-gray-800 text-xs">{fmtCost(s.totalCost)}</div>
                      <div className="mt-1 bg-gray-100 rounded-full h-1.5 w-full">
                        <div className="h-1.5 rounded-full bg-blue-400"
                          style={{ width: `${(s.totalCost / maxCost * 100).toFixed(1)}%` }} />
                      </div>
                    </td>
                    {/* Requests */}
                    <td className="px-4 py-3 text-xs text-gray-600 font-mono">{s.requests.toLocaleString()}</td>
                    {/* Groq */}
                    <td className="px-4 py-3">
                      <span className="text-xs font-mono text-emerald-700">{s.groqReqs.toLocaleString()}</span>
                      {s.requests > 0 && <div className="text-[10px] text-gray-400">{(s.groqReqs / s.requests * 100).toFixed(0)}%</div>}
                    </td>
                    {/* Anthropic */}
                    <td className="px-4 py-3">
                      <span className="text-xs font-mono text-blue-700">{s.anthReqs.toLocaleString()}</span>
                      {s.requests > 0 && <div className="text-[10px] text-gray-400">{(s.anthReqs / s.requests * 100).toFixed(0)}%</div>}
                    </td>
                    {/* Top page */}
                    <td className="px-4 py-3 text-[11px] text-gray-500 truncate">{s.topPage}</td>
                  </tr>
                ))}
                {sorted.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-gray-400">
                    {search ? 'No learners match that search.' : 'No cost data yet — deploy updated chat.js and run the SQL migration.'}
                  </td></tr>
                )}
              </tbody>
              {/* Totals footer */}
              {sorted.length > 0 && (
                <tfoot className="bg-gray-50 border-t border-gray-200">
                  <tr>
                    <td className="px-4 py-2.5 text-xs font-bold text-gray-600">Total ({sorted.length} learners)</td>
                    <td></td>
                    <td className="px-4 py-2.5 text-xs font-bold text-gray-800">{fmtCost(sorted.reduce((s, r) => s + r.totalCost, 0))}</td>
                    <td className="px-4 py-2.5 text-xs font-bold text-gray-800 font-mono">{sorted.reduce((s, r) => s + r.requests, 0).toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-xs font-bold text-emerald-700 font-mono">{sorted.reduce((s, r) => s + r.groqReqs, 0).toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-xs font-bold text-blue-700 font-mono">{sorted.reduce((s, r) => s + r.anthReqs, 0).toLocaleString()}</td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
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

  // ── Tab state ───────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'student' | 'cost-overview' | 'cost-learner'>('student');

  // ── Cost data ───────────────────────────────────────────────────────────────
  const [costRows,        setCostRows]        = useState<CostRow[]>([]);
  const [loadingCost,     setLoadingCost]     = useState(false);
  const [costError,       setCostError]       = useState<string | null>(null);
  const [costDays,        setCostDays]        = useState<number>(30);
  const [costGroupBy,     setCostGroupBy]     = useState<'page' | 'model' | 'provider'>('page');
  const [learnerCostRows, setLearnerCostRows] = useState<CostRow[]>([]);
  const [loadingLearnerCost, setLoadingLearnerCost] = useState(false);

  // Fetch overall cost data
  const fetchCostData = useCallback(async (days: number) => {
    setLoadingCost(true);
    setCostError(null);
    try {
      const since = new Date(Date.now() - days * 86400000).toISOString();
      const { data, error } = await supabase
        .from('api_cost_log')
        .select('*')
        .gte('logged_at', since)
        .order('logged_at', { ascending: false })
        .limit(5000);
      if (error) throw error;
      setCostRows(data || []);
    } catch (err: any) {
      setCostError(err.message || 'Failed to load cost data — run create_api_cost_log.sql migration first');
    } finally {
      setLoadingCost(false);
    }
  }, []);

  // Fetch per-learner cost data (detail view — filtered by userId)
  const fetchLearnerCost = useCallback(async (userId: string) => {
    if (!userId) return;
    setLoadingLearnerCost(true);
    try {
      const { data } = await supabase
        .from('api_cost_log')
        .select('*')
        .eq('user_id', userId)
        .order('logged_at', { ascending: false })
        .limit(1000);
      setLearnerCostRows(data || []);
    } catch { setLearnerCostRows([]); }
    finally { setLoadingLearnerCost(false); }
  }, []);

  useEffect(() => { fetchCostData(costDays); }, [costDays, fetchCostData]);
  // When a learner is selected in the cost-learner tab, fetch their detail rows
  useEffect(() => {
    if (selectedId && activeTab === 'cost-learner') fetchLearnerCost(selectedId);
    if (!selectedId) setLearnerCostRows([]);
  }, [selectedId, activeTab, fetchLearnerCost]);

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

  // ── Session counts ──────────────────────────────────────────────────────────
  // A "session" = a dashboard row that has chat_history (learner engaged)
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  // All categories we want to count — including english_skills from activity field
  const SESSION_CATEGORIES = [
    { key: 'AI Learning',          label: 'AI Learning',          match: (a: ActivityRow) => a.category_activity === 'AI Learning' || (a.category_activity === 'AI Proficiency' && !a.activity?.toLowerCase().includes('certification')) },
    { key: 'Skills Development',   label: 'Skills Development',   match: (a: ActivityRow) => a.category_activity === 'Skills Development' || a.category_activity === 'Vibe Coding' },
    { key: 'English Skills',       label: 'English Skills',       match: (a: ActivityRow) => a.activity === 'english_skills' || a.category_activity?.toLowerCase().includes('english') },
    { key: 'Certifications',       label: 'Certifications',       match: (a: ActivityRow) => a.category_activity === 'Certification' },
    { key: 'Community Impact',     label: 'Community Impact',     match: (a: ActivityRow) => ['Agriculture Consultant','Fishing Consultant','Healthcare Navigator','Entrepreneurship Consultant','AI Ambassadors'].some(c => a.activity?.includes(c) || a.category_activity?.includes(c)) },
    { key: 'Other',                label: 'Other',                match: (a: ActivityRow) => true }, // catch-all — computed last
  ];

  // Only rows with chat history (engaged sessions)
  const engaged = activities.filter(a => a.chat_history && a.chat_history !== '[]' && a.chat_history !== 'null');

  // Build session table rows
  const sessionRows = SESSION_CATEGORIES.map((cat, idx) => {
    const isOther = idx === SESSION_CATEGORIES.length - 1;
    const prior = SESSION_CATEGORIES.slice(0, idx);
    const rows = isOther
      ? engaged.filter(a => !prior.some(p => p.match(a)))
      : engaged.filter(a => cat.match(a));
    const thisMonth = rows.filter(a => (a.updated_at || a.created_at) >= monthStart);
    return { label: cat.label, allTime: rows.length, thisMonth: thisMonth.length };
  }).filter(r => r.allTime > 0 || r.label !== 'Other');

  const totalAllTime   = engaged.length;
  const totalThisMonth = engaged.filter(a => (a.updated_at || a.created_at) >= monthStart).length;

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="mb-5">
          <div className="flex items-center gap-3 mb-1">
            <Users size={22} className="text-purple-600" />
            <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
          </div>
          <p className="text-sm text-gray-500 ml-9">Student activity, certification scores, and API cost analytics.</p>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 mb-5 bg-gray-100 rounded-xl p-1 w-fit">
          {([
            { id: 'student',      label: 'Student Activity', icon: <BookOpen size={14} /> },
            { id: 'cost-overview',label: 'Cost Overview',    icon: <DollarSign size={14} /> },
            { id: 'cost-learner', label: 'Per-Learner Cost', icon: <Activity size={14} /> },
          ] as const).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={classNames(
                'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-colors',
                activeTab === tab.id
                  ? 'bg-white text-purple-700 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              )}
            >
              {tab.icon}{tab.label}
            </button>
          ))}
        </div>

        {/* ── STUDENT ACTIVITY TAB ────────────────────────────────────── */}
        {activeTab === 'student' && <div>
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

            {/* ── Session Summary Table ───────────────────────────────────── */}
            {sessionRows.length > 0 && (
              <section>
                <h2 className="text-base font-bold text-gray-800 mb-3 flex items-center gap-2">
                  <BarChart2 size={16} className="text-blue-600" /> Sessions
                </h2>
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-2.5 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">Category</th>
                        <th className="px-4 py-2.5 text-center text-[11px] font-bold text-gray-500 uppercase tracking-wider">All time</th>
                        <th className="px-4 py-2.5 text-center text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                          This month
                          <span className="ml-1 text-gray-400 font-normal normal-case">
                            ({new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' })})
                          </span>
                        </th>
                        <th className="px-4 py-2.5 text-center text-[11px] font-bold text-gray-500 uppercase tracking-wider w-32">Trend</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {sessionRows.map(row => {
                        const maxAllTime = Math.max(...sessionRows.map(r => r.allTime), 1);
                        const pct = Math.round(row.allTime / maxAllTime * 100);
                        return (
                          <tr key={row.label} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3 text-sm font-medium text-gray-700">{row.label}</td>
                            <td className="px-4 py-3 text-center">
                              <span className="text-lg font-black text-gray-900">{row.allTime}</span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              {row.thisMonth > 0
                                ? <span className="text-sm font-bold text-purple-700">{row.thisMonth}</span>
                                : <span className="text-sm text-gray-300">—</span>}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                                  <div className="h-1.5 rounded-full bg-blue-400 transition-all" style={{ width: `${pct}%` }} />
                                </div>
                                <span className="text-[10px] text-gray-400 w-6 text-right">{pct}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-gray-50 border-t border-gray-200">
                      <tr>
                        <td className="px-4 py-2.5 text-xs font-bold text-gray-600">Total</td>
                        <td className="px-4 py-2.5 text-center text-sm font-black text-gray-900">{totalAllTime}</td>
                        <td className="px-4 py-2.5 text-center text-sm font-bold text-purple-700">{totalThisMonth > 0 ? totalThisMonth : '—'}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </section>
            )}

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
        </div>}

        {/* ── COST OVERVIEW TAB ─────────────────────────────────────────── */}
        {activeTab === 'cost-overview' && (
          <CostOverviewPanel
            rows={costRows}
            loading={loadingCost}
            error={costError}
            days={costDays}
            setDays={setCostDays}
            groupBy={costGroupBy}
            setGroupBy={setCostGroupBy}
            onRefresh={() => fetchCostData(costDays)}
          />
        )}

        {/* ── PER-LEARNER COST TAB ─────────────────────────────────────── */}
        {activeTab === 'cost-learner' && (
          <LearnerCostPanel
            learners={learners}
            selectedId={selectedId}
            setSelectedId={(id) => { setSelectedId(id); if (id) fetchLearnerCost(id); }}
            allCostRows={costRows}
            learnerRows={learnerCostRows}
            loading={loadingCost}
            loadingDetail={loadingLearnerCost}
            onRefresh={() => selectedId ? fetchLearnerCost(selectedId) : fetchCostData(costDays)}
          />
        )}

      </div>
    </AppLayout>
  );
};

export default AdminStudentDashboard;