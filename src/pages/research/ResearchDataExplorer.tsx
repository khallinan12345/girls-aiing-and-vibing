// src/pages/research/ResearchDataExplorer.tsx
// Research data exploration interface with AI assistant.
// Pulls from get_research_snapshot RPC → dashboard_stats → research_data_view
// Accessible only to research_lead, site_leader, platform_administrator.

import React, { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../hooks/useAuth";
import { useNavigate } from "react-router-dom";

// ─── DESIGN TOKENS ───────────────────────────────────────────────────────────
const C = {
  navy:    "#1B2A4A",
  navyDk:  "#111D33",
  gold:    "#C8963E",
  goldLt:  "#E6B96A",
  teal:    "#2A7B88",
  sage:    "#5B7A6A",
  cream:   "#FAF8F4",
  sand:    "#E8E2D6",
  charcoal:"#2D2D2D",
  mid:     "#6B6560",
  muted:   "#9A9490",
  white:   "#FFFFFF",
  success: "#2E7D32",
  warn:    "#E65100",
  blue:    "#3D6B99",
};

// ─── TYPES ───────────────────────────────────────────────────────────────────
interface Field {
  key: string;
  label: string;
}

interface FieldGroup {
  label: string;
  fields: Field[];
}

interface DataRow {
  [key: string]: string | number | string[] | null | undefined;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface Summary {
  learners: number;
  sites: number;
  months: number;
  avgAIProf: string;
  avgPUE: string;
  roleReady: number;
  certsEarned: number;
  totalRows: number;
}

// ─── FIELD DEFINITIONS ───────────────────────────────────────────────────────
// Used to render the data table headers and schema context for the AI.
const FIELD_GROUPS: FieldGroup[] = [
  {
    label: "Session Activity",
    fields: [
      { key: "site",                  label: "Site"                   },
      { key: "cohort_month",          label: "Month"                  },
      { key: "grade_band",            label: "Grade Band"             },
      { key: "session_count",         label: "Sessions"               },
      { key: "engaged_session_count", label: "Engaged Sessions"       },
      { key: "avg_words_per_session", label: "Avg Words/Session"      },
      { key: "cohort_size",           label: "Cohort Size"            },
    ]
  },
  {
    label: "AI Proficiency (0–3)",
    fields: [
      { key: "ai_prof_application_score",   label: "Application"    },
      { key: "ai_prof_ethics_score",        label: "Ethics"         },
      { key: "ai_prof_understanding_score", label: "Understanding"  },
      { key: "ai_prof_verification_score",  label: "Verification"   },
      { key: "ai_prof_min_score",           label: "Min Score"      },
      { key: "ai_prof_cert_level",          label: "Cert Level"     },
    ]
  },
  {
    label: "Cognitive Skills (0–3)",
    fields: [
      { key: "cognitive_score",          label: "Cognitive"          },
      { key: "critical_thinking_score",  label: "Critical Thinking"  },
      { key: "problem_solving_score",    label: "Problem Solving"    },
      { key: "creativity_score",         label: "Creativity"         },
    ]
  },
  {
    label: "Reasoning Levels",
    fields: [
      { key: "reasoning_level_0", label: "Level 0 (Definitional)"  },
      { key: "reasoning_level_1", label: "Level 1 (Responsive)"    },
      { key: "reasoning_level_2", label: "Level 2 (Elaborative)"   },
      { key: "reasoning_level_3", label: "Level 3 (Structured)"    },
      { key: "reasoning_chain_count", label: "Chain Count"         },
    ]
  },
  {
    label: "Metacognition",
    fields: [
      { key: "metacog_verification_rate", label: "Verification Rate" },
      { key: "metacog_reactive_rate",     label: "Reactive Rate"     },
      { key: "metacog_strategic_rate",    label: "Strategic Rate"    },
    ]
  },
  {
    label: "Scaffolding",
    fields: [
      { key: "scaffold_convergence_trend",               label: "Convergence Trend"       },
      { key: "scaffold_clarification_per_session",       label: "Clarifications/Session"  },
      { key: "scaffold_decomposition_per_session",       label: "Decompositions/Session"  },
      { key: "scaffold_consecutive_correction_runs",     label: "Correction Runs"         },
    ]
  },
  {
    label: "Productive Use of Energy (PUE)",
    fields: [
      { key: "pue_score",                  label: "PUE Score"            },
      { key: "pue_energy_constraint_pct",  label: "Energy Constraint %"  },
      { key: "pue_market_pricing_pct",     label: "Market Pricing %"     },
      { key: "pue_enterprise_planning_pct",label: "Enterprise Planning %" },
      { key: "pue_learner_initiated_pct",  label: "Learner Initiated %"  },
      { key: "pue_multi_domain_pct",       label: "Multi-Domain %"       },
      { key: "pue_local_context_pct",      label: "Local Context %"      },
    ]
  },
  {
    label: "Role Readiness",
    fields: [
      { key: "role_readiness_signal",              label: "Readiness Signal"       },
      { key: "role_teaching_intent_count",         label: "Teaching Intent"        },
      { key: "role_community_application_count",   label: "Community Application"  },
      { key: "role_enterprise_orientation_count",  label: "Enterprise Orientation" },
      { key: "role_intergenerational_count",       label: "Intergenerational"      },
      { key: "peer_diffusion_signal",              label: "Peer Diffusion"         },
    ]
  },
  {
    label: "Certifications & Activities",
    fields: [
      { key: "cert_attempted_count",  label: "Certs Attempted"   },
      { key: "cert_passed_count",     label: "Certs Passed"      },
      { key: "cert_avg_score",        label: "Avg Cert Score"    },
      { key: "activities_started",    label: "Activities Started" },
      { key: "activities_completed",  label: "Activities Completed" },
      { key: "certifications_earned", label: "Certificates Earned"  },
      { key: "ci_tracks_active_count",label: "CI Tracks Active"     },
      { key: "ci_certs_passed_count", label: "CI Certs Passed"      },
    ]
  },
];

const ALL_FIELDS: Field[] = FIELD_GROUPS.flatMap((g: FieldGroup) => g.fields);

// Schema description for AI context
const SCHEMA_CONTEXT = `
You are a research data assistant for the vAI AI Learning Lab — a solar-powered AI education program in off-grid communities in Nigeria (Oloibiri, Ibiade) and expanding to Lagos and Ghana.

The dataset contains anonymized monthly learner assessment snapshots. Each row represents one learner (identified only by a stable learner_token — no names or IDs) for one month at one site.

KEY FIELDS:
- site: community location (Oloibiri, Ibiade, Lagos, Accra, Kigali)
- cohort_month: first day of the assessment month
- grade_band: learner grade grouping (1-4, 5-8, 9-12)
- cohort_size: number of learners in this site+month group (minimum 5 due to k-anonymization)
- session_count / engaged_session_count: total and engaged AI sessions that month
- ai_prof_*_score: AI proficiency sub-scores on 0–3 scale (application, ethics, understanding, verification)
- cognitive_score, critical_thinking_score, problem_solving_score, creativity_score: 0–3 scale
- reasoning_level_0–3: percentage of interactions at each reasoning depth level
- metacog_*_rate: metacognitive behavior rates per session
- scaffold_convergence_trend: 'converging' | 'stable' | 'diverging' — whether learner needs less AI help over time
- pue_score: Productive Use of Energy score — whether learner applies AI to real economic/community problems
- pue_*_pct: breakdown of PUE by category (energy constraints, market pricing, enterprise planning, etc.)
- role_readiness_signal: 0/1 — whether learner shows signs of mentoring others or community leadership
- peer_diffusion_signal: 0/1 — whether learner is spreading AI knowledge to peers
- cert_passed_count: certifications earned that month
- ci_*: Community Impact track metrics

RESEARCH QUESTIONS THIS DATA CAN HELP ANSWER:
1. Learning Outcomes: Do AI proficiency scores improve over time? Is engagement correlated with proficiency gains?
2. Hope & Agency: Do role readiness and peer diffusion signals increase with sustained engagement?
3. Community Spillover: Does PUE score and community application increase as learners mature?

DATA NOTES:
- All data is k-anonymized: cohorts smaller than 5 learners are suppressed
- learner_token is stable across months so you can track individuals longitudinally
- Scores are on a 0–3 scale (UNESCO-aligned): 0=none, 1=emerging, 2=developing, 3=proficient
`.trim();

// ─── CSS ─────────────────────────────────────────────────────────────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Source+Serif+4:wght@300;400;600&family=JetBrains+Mono:wght@400;500&display=swap');

  * { box-sizing: border-box; margin: 0; padding: 0; }

  .rde-root {
    font-family: 'Source Serif 4', Georgia, serif;
    background: ${C.cream};
    min-height: 100vh;
    color: ${C.charcoal};
    margin-left: 224px;
  }

  /* ── TOPBAR ── */
  .rde-topbar {
    background: ${C.navyDk};
    padding: 0 32px;
    height: 54px;
    display: flex; align-items: center; justify-content: space-between;
    position: sticky; top: 0; z-index: 100;
    border-bottom: 2px solid ${C.gold}44;
  }
  .rde-brand { display: flex; align-items: center; gap: 10px; }
  .rde-logo {
    font-family: 'Playfair Display', serif;
    font-size: 17px; font-weight: 700; color: ${C.white};
  }
  .rde-divider { width: 1px; height: 18px; background: ${C.gold}55; }
  .rde-section {
    font-size: 11px; color: ${C.gold}; font-weight: 600;
    letter-spacing: 1.5px; text-transform: uppercase;
  }
  .rde-home-btn {
    padding: 6px 14px; border-radius: 7px;
    background: ${C.gold}18; border: 1px solid ${C.gold}44;
    color: ${C.gold}; font-size: 12px; font-weight: 600;
    cursor: pointer; font-family: 'Source Serif 4', serif;
    transition: all 0.2s;
  }
  .rde-home-btn:hover { background: ${C.gold}30; }

  /* ── LAYOUT ── */
  .rde-layout {
    display: grid;
    grid-template-columns: 1fr 380px;
    grid-template-rows: auto 1fr;
    gap: 0;
    min-height: calc(100vh - 54px);
  }

  /* ── FILTERS ── */
  .rde-filters {
    grid-column: 1 / -1;
    background: ${C.white};
    border-bottom: 1px solid ${C.sand};
    padding: 14px 28px;
    display: flex; align-items: center; gap: 16px; flex-wrap: wrap;
  }
  .rde-filter-label {
    font-size: 11px; font-weight: 600; color: ${C.muted};
    letter-spacing: 1px; text-transform: uppercase;
  }
  .rde-select {
    padding: 6px 12px; border-radius: 6px;
    border: 1px solid ${C.sand}; background: ${C.cream};
    font-family: 'Source Serif 4', serif; font-size: 13px;
    color: ${C.charcoal}; cursor: pointer;
  }
  .rde-btn {
    padding: 7px 16px; border-radius: 7px;
    background: ${C.navy}; border: none; cursor: pointer;
    color: ${C.white}; font-size: 13px; font-weight: 600;
    font-family: 'Source Serif 4', serif; transition: all 0.2s;
  }
  .rde-btn:hover { background: ${C.navyDk}; }
  .rde-btn.secondary {
    background: transparent; border: 1px solid ${C.sand};
    color: ${C.charcoal};
  }
  .rde-btn.secondary:hover { background: ${C.sand}; }
  .rde-btn.gold {
    background: ${C.gold}; color: ${C.white};
  }
  .rde-btn.gold:hover { background: ${C.goldLt}; }

  /* ── DATA PANEL ── */
  .rde-data-panel {
    padding: 24px 28px;
    overflow-y: auto;
  }

  /* ── SUMMARY CARDS ── */
  .rde-summary-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 12px;
    margin-bottom: 24px;
  }
  .rde-stat-card {
    background: ${C.white};
    border: 1px solid ${C.sand};
    border-radius: 10px;
    padding: 14px 16px;
  }
  .rde-stat-val {
    font-family: 'Playfair Display', serif;
    font-size: 26px; font-weight: 700; color: ${C.navy};
    line-height: 1;
  }
  .rde-stat-lbl {
    font-size: 11px; color: ${C.muted};
    letter-spacing: 0.5px; margin-top: 4px;
  }

  /* ── FIELD GROUP SELECTOR ── */
  .rde-group-tabs {
    display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 16px;
  }
  .rde-group-tab {
    padding: 5px 12px; border-radius: 20px;
    border: 1px solid ${C.sand}; background: ${C.white};
    font-size: 12px; font-weight: 500; cursor: pointer;
    color: ${C.mid}; transition: all 0.15s;
    font-family: 'Source Serif 4', serif;
  }
  .rde-group-tab.active {
    background: ${C.navy}; border-color: ${C.navy};
    color: ${C.white};
  }

  /* ── DATA TABLE ── */
  .rde-table-wrap {
    overflow-x: auto;
    background: ${C.white};
    border: 1px solid ${C.sand};
    border-radius: 10px;
  }
  .rde-table {
    width: 100%; border-collapse: collapse; font-size: 13px;
  }
  .rde-table th {
    padding: 10px 12px; text-align: left;
    font-size: 10px; font-weight: 600; color: ${C.muted};
    letter-spacing: 0.8px; text-transform: uppercase;
    background: ${C.cream}; border-bottom: 1px solid ${C.sand};
    white-space: nowrap;
  }
  .rde-table td {
    padding: 9px 12px; border-bottom: 1px solid ${C.sand}88;
    color: ${C.charcoal}; font-size: 13px;
  }
  .rde-table tr:last-child td { border-bottom: none; }
  .rde-table tr:hover td { background: ${C.cream}; }
  .score-pill {
    display: inline-block; padding: 2px 8px; border-radius: 10px;
    font-size: 11px; font-weight: 600; font-family: 'JetBrains Mono', monospace;
  }
  .score-0 { background: #FFF3E0; color: #E65100; }
  .score-1 { background: #FFF8E1; color: #F57F17; }
  .score-2 { background: #E8F5E9; color: #2E7D32; }
  .score-3 { background: #E3F2FD; color: #1565C0; }

  .rde-empty {
    padding: 48px; text-align: center; color: ${C.muted};
    font-size: 14px; font-style: italic;
  }

  /* ── AI ASSISTANT PANEL ── */
  .rde-ai-panel {
    border-left: 1px solid ${C.sand};
    background: ${C.white};
    display: flex; flex-direction: column;
    height: calc(100vh - 54px);
    position: sticky; top: 54px;
  }
  .rde-ai-header {
    padding: 16px 20px;
    border-bottom: 1px solid ${C.sand};
    background: linear-gradient(135deg, ${C.navy}08 0%, ${C.gold}08 100%);
  }
  .rde-ai-title {
    font-family: 'Playfair Display', serif;
    font-size: 15px; font-weight: 700; color: ${C.navy};
    display: flex; align-items: center; gap: 8px;
  }
  .rde-ai-subtitle {
    font-size: 11px; color: ${C.muted}; margin-top: 3px;
  }

  .rde-ai-messages {
    flex: 1; overflow-y: auto;
    padding: 16px 20px;
    display: flex; flex-direction: column; gap: 12px;
  }
  .rde-msg {
    max-width: 92%;
  }
  .rde-msg.user { align-self: flex-end; }
  .rde-msg.assistant { align-self: flex-start; }
  .rde-msg-bubble {
    padding: 10px 14px; border-radius: 12px;
    font-size: 13px; line-height: 1.6;
  }
  .rde-msg.user .rde-msg-bubble {
    background: ${C.navy}; color: ${C.white};
    border-bottom-right-radius: 4px;
  }
  .rde-msg.assistant .rde-msg-bubble {
    background: ${C.cream}; color: ${C.charcoal};
    border: 1px solid ${C.sand};
    border-bottom-left-radius: 4px;
  }
  .rde-msg-bubble pre {
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px; background: ${C.sand};
    padding: 8px; border-radius: 6px; margin-top: 6px;
    overflow-x: auto; white-space: pre-wrap;
  }

  .rde-quick-prompts {
    padding: 0 20px 12px;
    display: flex; flex-direction: column; gap: 6px;
  }
  .rde-quick-prompt-label {
    font-size: 10px; color: ${C.muted}; letter-spacing: 1px;
    text-transform: uppercase; font-weight: 600; margin-bottom: 2px;
  }
  .rde-quick-btn {
    padding: 7px 12px; border-radius: 7px;
    border: 1px solid ${C.sand}; background: ${C.cream};
    font-size: 12px; color: ${C.mid}; cursor: pointer;
    text-align: left; font-family: 'Source Serif 4', serif;
    transition: all 0.15s; line-height: 1.4;
  }
  .rde-quick-btn:hover { background: ${C.sand}; color: ${C.charcoal}; }

  .rde-ai-input-row {
    padding: 14px 20px;
    border-top: 1px solid ${C.sand};
    display: flex; gap: 8px; align-items: flex-end;
  }
  .rde-ai-textarea {
    flex: 1; padding: 9px 12px; border-radius: 8px;
    border: 1px solid ${C.sand}; resize: none;
    font-family: 'Source Serif 4', serif; font-size: 13px;
    line-height: 1.5; min-height: 56px; max-height: 120px;
    background: ${C.cream}; color: ${C.charcoal};
  }
  .rde-ai-textarea:focus { outline: none; border-color: ${C.navy}55; }
  .rde-send-btn {
    padding: 9px 16px; border-radius: 8px;
    background: ${C.navy}; border: none; cursor: pointer;
    color: ${C.white}; font-size: 13px; font-weight: 600;
    font-family: 'Source Serif 4', serif; align-self: flex-end;
    transition: all 0.2s; white-space: nowrap;
  }
  .rde-send-btn:hover { background: ${C.gold}; }
  .rde-send-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  .rde-thinking {
    display: flex; align-items: center; gap: 6px;
    font-size: 12px; color: ${C.muted}; font-style: italic;
    padding: 8px 14px; background: ${C.cream};
    border-radius: 10px; border: 1px solid ${C.sand};
    align-self: flex-start;
  }
  .rde-thinking-dot {
    width: 6px; height: 6px; border-radius: 50%;
    background: ${C.gold}; animation: pulse 1.2s infinite;
  }
  .rde-thinking-dot:nth-child(2) { animation-delay: 0.2s; }
  .rde-thinking-dot:nth-child(3) { animation-delay: 0.4s; }
  @keyframes pulse { 0%,100% { opacity:0.3; } 50% { opacity:1; } }

  /* ── DOWNLOAD BAR ── */
  .rde-download-bar {
    padding: 10px 28px;
    background: ${C.white};
    border-top: 1px solid ${C.sand};
    display: flex; align-items: center; gap: 12px;
    font-size: 12px; color: ${C.mid};
  }
`;

// ─── UTILS ───────────────────────────────────────────────────────────────────
function scoreClass(val: number | string | null | undefined): string {
  if (val === null || val === undefined) return "";
  const n = parseFloat(val);
  if (n < 1) return "score-0";
  if (n < 2) return "score-1";
  if (n < 3) return "score-2";
  return "score-3";
}

function formatCell(key: string, val: DataRow[string]): React.ReactNode {
  if (val === null || val === undefined) return <span style={{ color: "#ccc" }}>—</span>;
  if (typeof val === "number" && key.includes("score")) {
    return <span className={`score-pill ${scoreClass(val)}`}>{val.toFixed(2)}</span>;
  }
  if (key === "cohort_month") return new Date(val).toLocaleDateString("en-US", { year: "numeric", month: "short" });
  if (Array.isArray(val)) return val.join(", ");
  if (typeof val === "number") return val % 1 === 0 ? val : val.toFixed(1);
  return String(val);
}

function toCSV(data: DataRow[], fields: Field[]): string {
  const headers = fields.map(f => f.label).join(",");
  const rows = data.map((row: DataRow) =>
    fields.map((f: Field) => {
      const v = row[f.key];
      if (v === null || v === undefined) return "";
      if (Array.isArray(v)) return `"${v.join("; ")}"`;
      if (typeof v === "string" && v.includes(",")) return `"${v}"`;
      return v;
    }).join(",")
  );
  return [headers, ...rows].join("\n");
}

const QUICK_PROMPTS: string[] = [
  "Summarise the key trends in this dataset",
  "Which learners show the strongest proficiency growth over time?",
  "How does PUE score correlate with session engagement?",
  "What statistical approach would you recommend for the Learning Outcomes study?",
  "Are there differences in hope/agency indicators between Oloibiri and Ibiade?",
  "What does the scaffolding convergence trend tell us about learner independence?",
];

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
export default function ResearchDataExplorer() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Access guard
  const allowed = ["research_lead", "platform_administrator", "site_leader"];
  if (user && !allowed.includes(user.role)) {
    return (
      <div style={{ padding: 48, textAlign: "center", color: C.mid }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🔒</div>
        <div style={{ fontSize: 16, fontWeight: 600 }}>Access restricted to research team members.</div>
      </div>
    );
  }

  const [data, setData]             = useState<DataRow[]>([]);
  const [loading, setLoading]       = useState<boolean>(false);
  const [error, setError]           = useState<string | null>(null);
  const [activeGroup, setActiveGroup] = useState<number>(0);

  // Filters
  const [site, setSite]             = useState<string>("");
  const [fromMonth, setFromMonth]   = useState<string>("");
  const [toMonth, setToMonth]       = useState<string>("");

  // AI
  const [messages, setMessages]     = useState<Message[]>([{
    role: "assistant",
    content: "Hello! I'm your research data assistant. Load data using the filters above, then ask me anything — I can help you interpret trends, suggest analyses, or advise on statistical methods for your study."
  }]);
  const [inputText, setInputText]   = useState<string>("");
  const [aiThinking, setAiThinking] = useState<boolean>(false);
  const messagesEndRef              = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, aiThinking]);

  // ── Load data ───────────────────────────────────────────────────────────────
  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: rows, error: rpcErr } = await supabase.rpc("get_research_snapshot", {
        p_site:       site       || null,
        p_from_month: fromMonth  || null,
        p_to_month:   toMonth    || null,
      });
      if (rpcErr) throw new Error(rpcErr.message);
      setData(rows ?? []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Summary stats ───────────────────────────────────────────────────────────
  const summary: Summary | null = data.length > 0 ? {
    learners:    new Set(data.map(r => r.learner_token)).size,
    sites:       new Set(data.map(r => r.site)).size,
    months:      new Set(data.map(r => r.cohort_month)).size,
    avgAIProf:   (data.reduce((s,r) => s + (r.ai_prof_min_score ?? 0), 0) / data.length).toFixed(2),
    avgPUE:      (data.reduce((s,r) => s + (r.pue_score ?? 0), 0) / data.length).toFixed(2),
    roleReady:   data.filter(r => r.role_readiness_signal === 1).length,
    certsEarned: data.reduce((s,r) => s + (r.cert_passed_count ?? 0), 0),
    totalRows:   data.length,
  } : null;

  // ── AI message send ─────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (text) => {
    if (!text.trim() || aiThinking) return;
    const userMsg = text.trim();
    setInputText("");
    setMessages(m => [...m, { role: "user", content: userMsg }]);
    setAiThinking(true);

    try {
      // Build data summary for context (top 20 rows to stay within token limits)
      const dataSample = data.length > 0
        ? JSON.stringify(data.slice(0, 20).map(r => {
            const s = {};
            ALL_FIELDS.forEach(f => { if (r[f.key] !== null && r[f.key] !== undefined) s[f.key] = r[f.key]; });
            return s;
          }), null, 2)
        : "No data loaded yet.";

      const dataContext = data.length > 0
        ? `\n\nCURRENT DATASET SUMMARY:\n- ${summary?.learners} unique learners\n- ${summary?.sites} site(s)\n- ${summary?.months} month(s)\n- ${data.length} total rows\n- Avg AI Proficiency: ${summary?.avgAIProf}/3\n- Avg PUE Score: ${summary?.avgPUE}/3\n\nSAMPLE DATA (first 20 rows):\n${dataSample}`
        : "\n\nNo data is currently loaded.";

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: SCHEMA_CONTEXT + dataContext,
          messages: [
            ...messages.filter(m => m.role !== "assistant" || messages.indexOf(m) > 0).map(m => ({
              role: m.role,
              content: m.content,
            })),
            { role: "user", content: userMsg },
          ],
        }),
      });

      const result = await response.json();
      const reply = result.content?.[0]?.text ?? "Sorry, I couldn't generate a response.";
      setMessages(m => [...m, { role: "assistant", content: reply }]);
    } catch (e) {
      setMessages(m => [...m, { role: "assistant", content: `Error: ${e.message}` }]);
    } finally {
      setAiThinking(false);
    }
  }, [data, messages, aiThinking, summary]);

  // ── Download CSV ─────────────────────────────────────────────────────────────
  const downloadCSV = () => {
    const fields = FIELD_GROUPS[activeGroup].fields;
    const csv = toCSV(data, fields);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vai-research-${FIELD_GROUPS[activeGroup].label.toLowerCase().replace(/\s+/g, "-")}-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const currentFields = FIELD_GROUPS[activeGroup].fields;

  return (
    <div className="rde-root">
      <style>{css}</style>

      {/* Topbar */}
      <div className="rde-topbar">
        <div className="rde-brand">
          <span className="rde-logo">vAI</span>
          <div className="rde-divider" />
          <span className="rde-section">Research Data Explorer</span>
        </div>
        <button className="rde-home-btn" onClick={() => navigate("/home")}>🏠 Home</button>
      </div>

      <div className="rde-layout">

        {/* Filters */}
        <div className="rde-filters">
          <span className="rde-filter-label">Filter:</span>
          <select className="rde-select" value={site} onChange={e => setSite(e.target.value)}>
            <option value="">All Sites</option>
            <option value="Oloibiri">Oloibiri</option>
            <option value="Ibiade">Ibiade</option>
            <option value="Lagos">Lagos</option>
            <option value="Accra">Accra</option>
            <option value="Kigali">Kigali</option>
          </select>
          <input type="month" className="rde-select" value={fromMonth}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFromMonth(e.target.value)} title="From month" />
          <span style={{ fontSize: 12, color: C.muted }}>to</span>
          <input type="month" className="rde-select" value={toMonth}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setToMonth(e.target.value)} title="To month" />
          <button className="rde-btn" onClick={loadData} disabled={loading}>
            {loading ? "Loading…" : "Load Data"}
          </button>
          {data.length > 0 && (
            <button className="rde-btn secondary" onClick={downloadCSV}>
              ⬇ Download CSV
            </button>
          )}
          {data.length > 0 && (
            <span style={{ marginLeft: "auto", fontSize: 12, color: C.muted }}>
              {data.length} rows · k-anonymized · no user IDs
            </span>
          )}
        </div>

        {/* Data Panel */}
        <div className="rde-data-panel">

          {error && (
            <div style={{ padding: 16, background: "#FFEBEE", borderRadius: 8, color: C.warn, marginBottom: 16 }}>
              {error}
            </div>
          )}

          {/* Summary cards */}
          {summary && (
            <div className="rde-summary-grid">
              <div className="rde-stat-card">
                <div className="rde-stat-val">{summary.learners}</div>
                <div className="rde-stat-lbl">Unique Learners</div>
              </div>
              <div className="rde-stat-card">
                <div className="rde-stat-val">{summary.sites}</div>
                <div className="rde-stat-lbl">Sites</div>
              </div>
              <div className="rde-stat-card">
                <div className="rde-stat-val">{summary.months}</div>
                <div className="rde-stat-lbl">Months</div>
              </div>
              <div className="rde-stat-card">
                <div className="rde-stat-val" style={{ color: C.teal }}>{summary.avgAIProf}</div>
                <div className="rde-stat-lbl">Avg AI Proficiency</div>
              </div>
              <div className="rde-stat-card">
                <div className="rde-stat-val" style={{ color: C.sage }}>{summary.avgPUE}</div>
                <div className="rde-stat-lbl">Avg PUE Score</div>
              </div>
              <div className="rde-stat-card">
                <div className="rde-stat-val" style={{ color: C.gold }}>{summary.roleReady}</div>
                <div className="rde-stat-lbl">Role Ready</div>
              </div>
              <div className="rde-stat-card">
                <div className="rde-stat-val">{summary.certsEarned}</div>
                <div className="rde-stat-lbl">Certs Earned</div>
              </div>
              <div className="rde-stat-card">
                <div className="rde-stat-val">{summary.totalRows}</div>
                <div className="rde-stat-lbl">Total Rows</div>
              </div>
            </div>
          )}

          {/* Field group tabs */}
          <div className="rde-group-tabs">
            {FIELD_GROUPS.map((g, i) => (
              <button
                key={i}
                className={`rde-group-tab ${activeGroup === i ? "active" : ""}`}
                onClick={() => setActiveGroup(i)}
              >
                {g.label}
              </button>
            ))}
          </div>

          {/* Data table */}
          {data.length === 0 ? (
            <div className="rde-table-wrap">
              <div className="rde-empty">
                {loading ? "Loading data…" : "Use the filters above to load anonymized learner data."}
              </div>
            </div>
          ) : (
            <div className="rde-table-wrap">
              <table className="rde-table">
                <thead>
                  <tr>
                    {currentFields.map(f => (
                      <th key={f.key}>{f.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.map((row, i) => (
                    <tr key={i}>
                      {currentFields.map(f => (
                        <td key={f.key}>{formatCell(f.key, row[f.key])}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

        </div>

        {/* AI Assistant Panel */}
        <div className="rde-ai-panel">
          <div className="rde-ai-header">
            <div className="rde-ai-title">
              <span>🤖</span>
              Research Assistant
            </div>
            <div className="rde-ai-subtitle">
              Ask about the data, analysis methods, or research design
            </div>
          </div>

          <div className="rde-ai-messages">
            {messages.map((m, i) => (
              <div key={i} className={`rde-msg ${m.role}`}>
                <div className="rde-msg-bubble">
                  {m.content.split("```").map((part, j) =>
                    j % 2 === 1
                      ? <pre key={j}>{part}</pre>
                      : <span key={j}>{part}</span>
                  )}
                </div>
              </div>
            ))}
            {aiThinking && (
              <div className="rde-thinking">
                <div className="rde-thinking-dot" />
                <div className="rde-thinking-dot" />
                <div className="rde-thinking-dot" />
                Thinking…
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick prompts — only show when no data or few messages */}
          {messages.length < 3 && (
            <div className="rde-quick-prompts">
              <div className="rde-quick-prompt-label">Suggested questions</div>
              {QUICK_PROMPTS.slice(0, 4).map((p, i) => (
                <button key={i} className="rde-quick-btn" onClick={() => sendMessage(p)}>
                  {p}
                </button>
              ))}
            </div>
          )}

          <div className="rde-ai-input-row">
            <textarea
              className="rde-ai-textarea"
              placeholder="Ask about the data or research methodology…"
              value={inputText}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setInputText(e.target.value)}
              onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage(inputText);
                }
              }}
              rows={2}
            />
            <button
              className="rde-send-btn"
              onClick={() => sendMessage(inputText)}
              disabled={!inputText.trim() || aiThinking}
            >
              Send
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
