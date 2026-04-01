/**
 * MONTHLY SKILLS ASSESSMENT v2.0 — Vercel Cron Handler
 *
 * Runs on the 1st of every month at 02:00 UTC (via vercel.json cron).
 * Assesses the PREVIOUS month's activity for all African users.
 *
 * Captures:
 *   • 5 core skill dimensions (cognitive, CT, PS, creativity, PUE score)
 *   • Site access count (sessions + engaged sessions)
 *   • PUE linkage — 7 domain metrics + learner-vs-AI source split
 *   • Scaffolding convergence — clarification, decomposition, correction trends
 *   • Reasoning level distribution (Levels 0–3)
 *   • Metacognitive markers (verification, reactive, strategic)
 *   • Role readiness & peer diffusion signals
 *   • Enterprise planning artifact rubric (6 dimensions, 0–18)
 *   • Narrative summaries for PUE, scaffolding, metacognition, role readiness
 *
 * Sends a rich longitudinal email report to khallinan1@udayton.edu.
 *
 * Required env vars:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY,
 *   RESEND_API_KEY, CRON_SECRET
 */

import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import type { VercelRequest, VercelResponse } from "@vercel/node";

// ─── Excluded Users (admins / facilitators — never assessed or reported) ─────
// All Kevin Hallinan and Bennywhite Davidson accounts — never assessed or shown in reports
const EXCLUDED_USER_IDS = new Set([
  "0e738663-a70e-4fd3-9ba6-718c02e116c2", // Kevin Hallinan (kevin.hallinan@udayton.edu)
  "8b3f70dc-e5d0-4eb0-af7d-ec6181968213", // Kevin Hallinan (khallinan1@udayton.edu)
  "5d5e0486-e768-4c5d-ba63-d1e4570a352d", // Kevin Hallinan (kevin.hallinan.ud@gmail.com)
  "40e9daa6-7ec1-49a9-9be7-814a3d607d86", // Bennywhite Davidson (benny090davidson@gmail.com)
  "73da14c1-e49a-4410-9390-6fe069fd7528", // Bennywhite Davidson (benny090davidson — duplicate)
  "f6157a9d-5ffd-4058-b0b3-af3ea897d876", // Bennywhite Davidson (bennywhite090d@gmail.com)
]);

// ─── Clients ─────────────────────────────────────────────────────────────────

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

// ─── Types ────────────────────────────────────────────────────────────────────

interface MonthlySkillsResult {
  cognitive_score: number;
  cognitive_evidence: string[];
  critical_thinking_score: number;
  critical_thinking_evidence: string[];
  problem_solving_score: number;
  problem_solving_evidence: string[];
  creativity_score: number;
  creativity_evidence: string[];
  pue_score: number;
  pue_evidence: string[];

  pue_energy_constraint_pct: number;
  pue_market_pricing_pct: number;
  pue_battery_load_pct: number;
  pue_enterprise_planning_pct: number;
  pue_learner_initiated_pct: number;
  pue_ai_introduced_pct: number;
  pue_multi_domain_pct: number;
  pue_local_context_pct: number;
  pue_summary: string;
  pue_evidence_quotes: string[];

  scaffold_clarification_per_session: number;
  scaffold_decomposition_per_session: number;
  scaffold_correction_total_per_session: number;
  scaffold_explicit_correction_per_session: number;
  scaffold_gentle_redirect_per_session: number;
  scaffold_consecutive_correction_runs: number;
  scaffold_convergence_trend: "converging" | "stable" | "diverging" | "insufficient_data";
  scaffold_convergence_narrative: string;

  reasoning_definitional_pct: number;
  reasoning_responsive_pct: number;
  reasoning_elaborative_pct: number;
  reasoning_structured_pct: number;
  reasoning_chain_count: number;

  metacog_verification_rate: number;
  metacog_reactive_rate: number;
  metacog_strategic_rate: number;
  metacog_narrative: string;

  role_teaching_intent_count: number;
  role_community_application_count: number;
  role_enterprise_orientation_count: number;
  role_intergenerational_count: number;
  role_readiness_narrative: string;
  role_readiness_signals: string[];

  enterprise_artifact_score: number;
  enterprise_artifact_goal_score: number;
  enterprise_artifact_resource_score: number;
  enterprise_artifact_plan_score: number;
  enterprise_artifact_constraint_score: number;
  enterprise_artifact_quant_score: number;
  enterprise_artifact_risk_score: number;
  enterprise_artifact_evidence: string[];

  // AI Playground
  ai_playground_session_count: number;
  ai_playground_word_count: number;
  ai_playground_summary: string;

  // AI Proficiency — GPT-inferred from transcripts (0–100)
  ai_prof_application_gpt: number;
  ai_prof_ethics_gpt: number;
  ai_prof_understanding_gpt: number;
  ai_prof_verification_gpt: number;
  ai_prof_gpt_narrative: string;

  // AI Proficiency — formal cert scores (from dashboard, filled post-GPT)
  ai_prof_application_score: number | null;
  ai_prof_ethics_score: number | null;
  ai_prof_understanding_score: number | null;
  ai_prof_verification_score: number | null;
  ai_prof_cert_level: string;

  // Certification summary
  cert_attempted_count: number;
  cert_passed_count: number;
  cert_names_attempted: string[];
  cert_names_passed: string[];
  cert_avg_score: number | null;
  cert_summary: string;

  // Community Impact — training (month-bounded)
  ci_training_sessions_total: number;
  ci_training_sessions_by_track: Record<string, number>;
  ci_training_eval_by_track: Record<string, { avg_overall: number; best_score: number; eval_count: number }>;
  ci_tracks_active_count: number;
  // Community Impact — certification (all-time snapshot)
  ci_cert_by_track: Record<string, { attempted: boolean; passed: boolean; overall_score: number | null; scores: Record<string, number> }>;
  ci_certs_passed_count: number;
  ci_summary: string;
}

interface AssessmentSummary {
  userId: string;
  name: string;
  sessionCount: number;
  engagedSessionCount: number;
  scores: MonthlySkillsResult | null;
  status: "success" | "skipped" | "no_activity" | "error";
  error?: string;
}

interface PlaygroundSummary {
  sessionCount: number;
  totalWords: number;
  pueSessionCount: number;       // sessions containing PUE / energy / enterprise language
  entrepreneurshipCount: number; // sessions focused on business / enterprise building
  topTopics: string[];           // 3–5 dominant themes the learner explored
  pueHighlights: string[];       // up to 3 direct learner quotes showing PUE/entrepreneurship thinking
  narrative: string;             // 3–4 sentence synthesis
  hasMeaningfulActivity: boolean;
}

interface HistoricalRecord {
  user_id: string;
  measured_at: string;
  cognitive_score: number;
  critical_thinking_score: number;
  problem_solving_score: number;
  creativity_score: number;
  pue_score: number;
  pue_energy_constraint_pct: number | null;
  pue_market_pricing_pct: number | null;
  pue_learner_initiated_pct: number | null;
  pue_summary: string | null;
  scaffold_convergence_trend: string | null;
  reasoning_structured_pct: number | null;
  metacog_verification_rate: number | null;
  role_teaching_intent_count: number | null;
  role_enterprise_orientation_count: number | null;
  enterprise_artifact_score: number | null;
  session_count: number | null;
  // AI Proficiency
  ai_prof_application_score: number | null;
  ai_prof_ethics_score: number | null;
  ai_prof_understanding_score: number | null;
  ai_prof_verification_score: number | null;
  ai_prof_cert_level: string | null;
  ai_prof_application_gpt: number | null;
  ai_prof_ethics_gpt: number | null;
  ai_prof_understanding_gpt: number | null;
  ai_prof_verification_gpt: number | null;
  // Certifications
  cert_attempted_count: number | null;
  cert_passed_count: number | null;
  cert_names_passed: string[] | null;
  cert_avg_score: number | null;
  // Community Impact
  ci_training_sessions_total: number | null;
  ci_tracks_active_count: number | null;
  ci_certs_passed_count: number | null;
  ci_cert_by_track: Record<string, { attempted: boolean; passed: boolean; overall_score: number | null; scores: Record<string, number> }> | null;
}

// ─── Assessment Prompt ────────────────────────────────────────────────────────

// ─── City Context Helpers ─────────────────────────────────────────────────────

function getCityContext(city: string): {
  name: string;
  description: string;
  localRefs: string;
  institution: string;
} {
  if (city === "Ibiade") {
    return {
      name: "Ibiade",
      description:
        "a lagoon-side community in Ogun Waterside LGA, Ogun State, Nigeria, where young learners " +
        "(ages 12–24) are developing AI and digital skills for the first time. Ibiade sits on the " +
        "Lekki Lagoon and the Bight of Benin; livelihoods centre on artisanal fishing, cassava and " +
        "yam farming, fish processing, and market trading. The community faces seasonal flooding, " +
        "contaminated creek water, no grid electricity, and limited road access. The learning " +
        "initiative is supported by Solardero Foundation. The central research framework tests " +
        "whether AI-facilitated capability formation can prime Productive Use of Energy (PUE) demand " +
        "ahead of solar infrastructure expansion.",
      localRefs: "Ibiade/Ogun/lagoon/mangrove/Bight of Benin/community/naira",
      institution: "Solardero Foundation — Ibiade",
    };
  }
  // Default: Oloibiri
  return {
    name: "Oloibiri",
    description:
      "a rural community in Ogbia LGA, Bayelsa State, Nigeria, with a new solar mini-grid where " +
      "young learners (ages 12–24) are developing AI and digital skills for the first time. Oloibiri " +
      "is the birthplace of Nigeria's oil industry yet has no grid electricity; livelihoods centre " +
      "on fishing the Otuabagi creeks, cassava and plantain farming, and small-scale trade. The " +
      "community has been severely damaged by decades of oil pollution. The central research " +
      "framework tests whether AI-facilitated capability formation can prime Productive Use of " +
      "Energy (PUE) demand ahead of infrastructure expansion.",
    localRefs: "Oloibiri/Bayelsa/village/Nigeria/community/naira",
    institution: "Davidson AI Innovation Center — Oloibiri",
  };
}

function buildAssessmentPrompt(
  transcript: string,
  sessionCount: number,
  playgroundTranscript: string,
  playgroundSessionCount: number,
  city: string
): string {
  const ctx = getCityContext(city);
  return `You are an expert educational assessment analyst with deep knowledge of the ${ctx.name} AI learning initiative — ${ctx.description}

Analyze these ${sessionCount} structured curriculum sessions${playgroundSessionCount > 0 ? ` AND ${playgroundSessionCount} AI Playground sessions` : ""}. Return a SINGLE valid JSON object with NO markdown, NO preamble.

Your scores should reflect the WHOLE learner — both structured curriculum activity and any free-form Playground use. Playground conversations reveal self-directed interests, PUE reasoning, and enterprise thinking that may not surface in the curriculum.

STRUCTURED CURRICULUM CONVERSATIONS:
${transcript}
${playgroundTranscript ? `
AI PLAYGROUND CONVERSATIONS (free-form, unconstrained — no curriculum scaffolding):
Note: scaffolding convergence metrics apply to curriculum sessions only. Playground sessions show purely learner-initiated behaviour.
${playgroundTranscript}
` : ""}
Return JSON with EXACTLY these fields. Use 0 for any metric where evidence is insufficient.

{
  "cognitive_score": <0-100>,
  "cognitive_evidence": ["<specific observation>"],
  "critical_thinking_score": <0-100>,
  "critical_thinking_evidence": ["..."],
  "problem_solving_score": <0-100>,
  "problem_solving_evidence": ["..."],
  "creativity_score": <0-100>,
  "creativity_evidence": ["..."],
  "pue_score": <0-100, overall productive use of energy capability>,
  "pue_evidence": ["..."],

  "pue_energy_constraint_pct": <0-100, % of sessions where solar/battery/kVA/electricity/power was discussed>,
  "pue_market_pricing_pct": <0-100, % of sessions involving naira/cost/profit/selling/customers/business>,
  "pue_battery_load_pct": <0-100, % of sessions involving load management/energy-efficient appliances/solar charging>,
  "pue_enterprise_planning_pct": <0-100, % of sessions with step-by-step business plans or 'I want to build/start' with energy context>,
  "pue_learner_initiated_pct": <0-100, % of sessions where LEARNER introduced PUE topics BEFORE AI did>,
  "pue_ai_introduced_pct": <0-100, % of sessions where AI scaffolded PUE scenarios first>,
  "pue_multi_domain_pct": <0-100, % of sessions where 3 or more PUE domains appeared simultaneously>,
  "pue_local_context_pct": <0-100, % of sessions with explicit local refs: ${ctx.localRefs}>,
  "pue_summary": "<2-3 sentences: how broadly and deeply is this learner connecting AI skills to productive energy use? What domains dominate? What does the learner-vs-AI source split reveal?>",
  "pue_evidence_quotes": ["<direct quote from LEARNER showing PUE reasoning>"],

  "scaffold_clarification_per_session": <mean AI clarification prompts per session>,
  "scaffold_decomposition_per_session": <mean AI decomposition scaffolds per session: 'let's break this down', 'step by step'>,
  "scaffold_correction_total_per_session": <mean total corrections per session>,
  "scaffold_explicit_correction_per_session": <mean explicit corrections: 'not quite', 'that's incorrect'>,
  "scaffold_gentle_redirect_per_session": <mean gentle redirects: 'actually', 'remember that', 'have you considered'>,
  "scaffold_consecutive_correction_runs": <mean consecutive correction runs where learner revision was itself insufficient>,
  "scaffold_convergence_trend": <"converging" if AI scaffolding clearly decreased over sessions | "stable" | "diverging" | "insufficient_data">,
  "scaffold_convergence_narrative": "<2-3 sentences: Is AI doing less scaffolding over time? Are corrections shifting from explicit toward gentle? What does this suggest about internalization?>",

  "reasoning_definitional_pct": <0-100, % sessions dominated by 'What is X?' queries>,
  "reasoning_responsive_pct": <0-100, % sessions with short phrase answers to AI prompts>,
  "reasoning_elaborative_pct": <0-100, % sessions with extended single-point responses ≥30 words but no multi-step chains>,
  "reasoning_structured_pct": <0-100, % sessions with multi-step chains, numbered sequences, or arithmetic reasoning>,
  "reasoning_chain_count": <integer: total multi-step reasoning chains across all sessions>,

  "metacog_verification_rate": <per 1000 learner words: 'this means', 'therefore', 'if X then Y', 'let me check', 'which means'>,
  "metacog_reactive_rate": <per 1000 learner words: 'I don't understand', 'please explain again', 'I'm confused'>,
  "metacog_strategic_rate": <per 1000 learner words: 'maybe I should', 'the problem is', 'on the other hand', 'my plan is'>,
  "metacog_narrative": "<2-3 sentences: Is the learner moving from reactive toward active verification? Any self-monitoring or constraint-aware reasoning? What does the metacognitive profile suggest?>",

  "role_teaching_intent_count": <integer: utterances expressing plans to teach/guide/share skills>,
  "role_community_application_count": <integer: references to applying skills in/for community>,
  "role_enterprise_orientation_count": <integer: utterances linking skills to business/market/solar/farming with collective referent>,
  "role_intergenerational_count": <integer: references to teaching or helping parents/elders/adults>,
  "role_readiness_narrative": "<2-3 sentences: Is this learner showing capability externalization — helping others, teaching, connecting to community enterprise? Does evidence suggest movement from individual acquisition toward social diffusion?>",
  "role_readiness_signals": ["<specific quote or observed behavior>"],

  "enterprise_artifact_goal_score": <0=no goal | 1=vague aspiration | 2=named service/product | 3=specific with target market>,
  "enterprise_artifact_resource_score": <0=none | 1=generic mention | 2=named components (solar panels, inverter) | 3=quantified specs (kVA ratings)>,
  "enterprise_artifact_plan_score": <0=none | 1=single action | 2=ordered steps | 3=detailed multi-step with dependencies>,
  "enterprise_artifact_constraint_score": <0=none | 1=single constraint mentioned | 2=specific constraint with relevance | 3=trade-off reasoning or mitigation>,
  "enterprise_artifact_quant_score": <0=no numbers | 1=vague numbers | 2=calculations present | 3=multi-step analysis with derived conclusions>,
  "enterprise_artifact_risk_score": <0=none | 1=general awareness | 2=specific risks named | 3=mitigation strategies proposed>,
  "enterprise_artifact_score": <SUM of the 6 scores above, 0-18>,
  "enterprise_artifact_evidence": ["<specific planning artifact quote from learner>"],

  "ai_playground_session_count": <integer: number of Playground sessions in this period, 0 if none>,
  "ai_playground_word_count": <integer: total learner words across Playground sessions, 0 if none>,
  "ai_playground_summary": "<3-4 sentences specifically about AI Playground use: What topics did the learner choose to explore with unconstrained AI access? Is there evidence of self-directed PUE reasoning, enterprise planning, or community problem-solving that goes beyond the structured curriculum? How does the learner's free-form use compare to their curriculum interactions — more confident? More creative? Different domains? If no Playground activity, write 'No AI Playground activity recorded this period.'>",

  "ai_prof_application_gpt": <0-100, learner's demonstrated ability to apply AI tools to real problems — prompt crafting, using AI outputs to accomplish tasks, integrating AI into workflows>,
  "ai_prof_ethics_gpt": <0-100, learner's engagement with ethical dimensions of AI — fairness, privacy, impact on community, responsible use, awareness of harms>,
  "ai_prof_understanding_gpt": <0-100, learner's conceptual grasp of how AI works — what AI can and cannot do, model limitations, training data, AI vs human reasoning>,
  "ai_prof_verification_gpt": <0-100, learner's ability to verify AI outputs — fact-checking, identifying bias or hallucination, questioning AI responses, not accepting outputs uncritically>,
  "ai_prof_gpt_narrative": "<2-3 sentences: What does the transcript evidence say about this learner's overall AI proficiency — their practical application, ethical awareness, conceptual understanding, and critical verification? Which dimension is strongest and which needs most development?>"
}`;
}
}

// ─── AI Proficiency Cert Data ─────────────────────────────────────────────────

interface CertData {
  // Formal AI Proficiency scores from dashboard (0–3 scale, null = not attempted)
  ai_prof_application_score: number | null;
  ai_prof_ethics_score: number | null;
  ai_prof_understanding_score: number | null;
  ai_prof_verification_score: number | null;
  ai_prof_min_score: number | null;
  ai_prof_cert_level: string;
  // All-cert summary
  cert_attempted_count: number;
  cert_passed_count: number;
  cert_names_attempted: string[];
  cert_names_passed: string[];
  cert_avg_score: number | null;
}

async function fetchUserCertData(userId: string): Promise<CertData> {
  const empty: CertData = {
    ai_prof_application_score: null, ai_prof_ethics_score: null,
    ai_prof_understanding_score: null, ai_prof_verification_score: null,
    ai_prof_min_score: null, ai_prof_cert_level: "Not Attempted",
    cert_attempted_count: 0, cert_passed_count: 0,
    cert_names_attempted: [], cert_names_passed: [], cert_avg_score: null,
  };
  try {
    // Fetch all dashboard rows that have a certification score for this user
    const { data: certRows } = await supabase
      .from("dashboard")
      .select(`
        title, activity, progress, certification_evaluation_score,
        certification_ai_proficiency_application_of_ai_score,
        certification_ai_proficiency_ethics_responsibility_score,
        certification_ai_proficiency_understanding_ai_score,
        certification_ai_proficiency_verification_bias_score
      `)
      .eq("user_id", userId)
      .not("certification_evaluation_score", "is", null);

    if (!certRows?.length) return empty;

    // Gather all-cert summary
    const names: string[] = [];
    const passed: string[] = [];
    let scoreSum = 0;
    let scoreCount = 0;

    for (const row of certRows) {
      const title = row.title || row.activity || "Unknown";
      names.push(title);
      const score = Number(row.certification_evaluation_score);
      if (!isNaN(score)) { scoreSum += score; scoreCount++; }
      if (score >= 2.25) passed.push(title);
    }

    // Find the AI Proficiency cert row specifically
    const aiProfRow = certRows.find(
      (r) => (r.activity || "").toLowerCase().includes("ai proficiency") ||
              (r.title || "").toLowerCase().includes("ai proficiency")
    );

    let appScore: number | null = null;
    let ethScore: number | null = null;
    let undScore: number | null = null;
    let verScore: number | null = null;

    if (aiProfRow) {
      appScore = aiProfRow.certification_ai_proficiency_application_of_ai_score ?? null;
      ethScore = aiProfRow.certification_ai_proficiency_ethics_responsibility_score ?? null;
      undScore = aiProfRow.certification_ai_proficiency_understanding_ai_score ?? null;
      verScore = aiProfRow.certification_ai_proficiency_verification_bias_score ?? null;
    }

    const dimScores = [appScore, ethScore, undScore, verScore].filter((s): s is number => s !== null);
    const minScore = dimScores.length === 4 ? Math.min(...dimScores) : null;
    const certLevel = minScore === null ? "Not Attempted"
      : minScore === 3 ? "Advanced"
      : minScore >= 2 ? "Proficient"
      : minScore >= 1 ? "Emerging"
      : "Not Attempted";

    return {
      ai_prof_application_score: appScore,
      ai_prof_ethics_score: ethScore,
      ai_prof_understanding_score: undScore,
      ai_prof_verification_score: verScore,
      ai_prof_min_score: minScore,
      ai_prof_cert_level: certLevel,
      cert_attempted_count: names.length,
      cert_passed_count: passed.length,
      cert_names_attempted: [...new Set(names)],
      cert_names_passed: [...new Set(passed)],
      cert_avg_score: scoreCount > 0 ? Math.round((scoreSum / scoreCount) * 100) / 100 : null,
    };
  } catch (err: any) {
    console.warn(`   fetchUserCertData error: ${err.message}`);
    return empty;
  }
}

// ─── Community Impact Data ────────────────────────────────────────────────────

// Maps the 5 CI track keys to their dashboard activity names, cert activity
// names, and the jsonb column on dashboard that holds the cert evaluation.
const CI_TRACKS = {
  ai_ambassadors:              { label: "AI Ambassadors",          certActivity: "AI Ambassadors Certification",          certEvalCol: "ambassador_cert_evaluation"     },
  agriculture_consultant:      { label: "Agriculture Consultant",   certActivity: "Agriculture Consultant Certification",   certEvalCol: "agriculture_cert_evaluation"    },
  fishing_consultant:          { label: "Fishing Consultant",       certActivity: "Fishing Consultant Certification",       certEvalCol: "fishing_cert_evaluation"        },
  healthcare_navigator:        { label: "Healthcare Navigator",     certActivity: "Healthcare Navigator Certification",     certEvalCol: "healthcare_cert_evaluation"     },
  entrepreneurship_consultant: { label: "Entrepreneurship Consultant", certActivity: "Entrepreneurship Consultant Certification", certEvalCol: "entrepreneurship_cert_evaluation" },
} as const;

type CITrackKey = keyof typeof CI_TRACKS;

interface CommunityImpactData {
  training_sessions_total: number;
  training_sessions_by_track: Record<string, number>;
  training_eval_by_track: Record<string, { avg_overall: number; best_score: number; eval_count: number }>;
  tracks_active_count: number;
  cert_by_track: Record<string, { attempted: boolean; passed: boolean; overall_score: number | null; scores: Record<string, number> }>;
  certs_passed_count: number;
  summary: string;
}

async function fetchCommunityImpactData(
  userId: string,
  startDate: Date,
  endDate: Date,
  city: string
): Promise<CommunityImpactData> {
  const empty: CommunityImpactData = {
    training_sessions_total: 0,
    training_sessions_by_track: {},
    training_eval_by_track: {},
    tracks_active_count: 0,
    cert_by_track: {},
    certs_passed_count: 0,
    summary: "",
  };

  try {
    // ── 1. Training sessions this month ────────────────────────────────────────
    // The 5 training pages write dashboard rows with activity = the track key.
    // In-app role-play evaluations are stored in english_skills_evaluation.
    const trainingActivities = Object.keys(CI_TRACKS);

    const { data: trainingRows } = await supabase
      .from("dashboard")
      .select("activity, english_skills_evaluation")
      .eq("user_id", userId)
      .in("activity", trainingActivities)
      .gte("created_at", startDate.toISOString())
      .lte("created_at", endDate.toISOString());

    const sessionsByTrack: Record<string, number> = {};
    const evalScoresByTrack: Record<string, number[]> = {};

    for (const row of trainingRows || []) {
      const track = row.activity as string;
      sessionsByTrack[track] = (sessionsByTrack[track] || 0) + 1;

      if (row.english_skills_evaluation) {
        const ev = typeof row.english_skills_evaluation === "string"
          ? JSON.parse(row.english_skills_evaluation)
          : row.english_skills_evaluation;
        // Training pages store overall_score at top level
        const overall = ev?.overall_score ?? ev?.overallScore;
        if (typeof overall === "number" && overall > 0) {
          if (!evalScoresByTrack[track]) evalScoresByTrack[track] = [];
          evalScoresByTrack[track].push(overall);
        }
      }
    }

    const trainingEvalByTrack: Record<string, { avg_overall: number; best_score: number; eval_count: number }> = {};
    for (const [track, scores] of Object.entries(evalScoresByTrack)) {
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      trainingEvalByTrack[track] = {
        eval_count: scores.length,
        avg_overall: Math.round(avg * 100) / 100,
        best_score: Math.max(...scores),
      };
    }

    const trainingTotal = Object.values(sessionsByTrack).reduce((a, b) => a + b, 0);
    const tracksActive  = Object.keys(sessionsByTrack).length;

    // ── 2. Cert results — all-time, not date-bounded ───────────────────────────
    // Each cert page writes a row with activity = the cert activity string and
    // stores the evaluation jsonb in its own named column (e.g. agriculture_cert_evaluation).
    const certActivities = Object.values(CI_TRACKS).map((t) => t.certActivity);
    const certEvalCols   = Object.values(CI_TRACKS).map((t) => t.certEvalCol);

    const { data: certRows } = await supabase
      .from("dashboard")
      .select(`activity, ${certEvalCols.join(", ")}`)
      .eq("user_id", userId)
      .in("activity", certActivities);

    const certByTrack: Record<string, { attempted: boolean; passed: boolean; overall_score: number | null; scores: Record<string, number> }> = {};
    let certsPassed = 0;

    for (const row of certRows || []) {
      const trackEntry = Object.entries(CI_TRACKS).find(([, v]) => v.certActivity === row.activity);
      if (!trackEntry) continue;
      const [trackKey, trackDef] = trackEntry;

      const rawEval = (row as Record<string, unknown>)[trackDef.certEvalCol];
      if (!rawEval) continue;

      const ev = typeof rawEval === "string" ? JSON.parse(rawEval) : rawEval as Record<string, unknown>;
      const overall = (ev.overall_score ?? ev.overallScore) as number | undefined;
      const rawScores = (ev.scores ?? {}) as Record<string, number>;
      // Passed if can_advance is true OR overall score ≥ 2.0 (Proficient threshold)
      const passed = ev.can_advance === true || (typeof overall === "number" && overall >= 2.0);

      if (passed) certsPassed++;

      // Keep the best result if the learner attempted this cert more than once
      const existing = certByTrack[trackKey];
      const newOverall = typeof overall === "number" ? Math.round(overall * 100) / 100 : null;
      if (!existing || (newOverall !== null && (existing.overall_score === null || newOverall > existing.overall_score))) {
        certByTrack[trackKey] = { attempted: true, passed, overall_score: newOverall, scores: rawScores };
      }
    }

    // ── 3. GPT narrative ────────────────────────────────────────────────────────
    let ciSummary = "";
    const hasActivity = trainingTotal > 0 || Object.keys(certByTrack).length > 0;

    if (hasActivity) {
      const trainingLines = Object.entries(sessionsByTrack).map(([t, n]) => {
        const label = CI_TRACKS[t as CITrackKey]?.label || t;
        const ev = trainingEvalByTrack[t];
        return ev
          ? `  • ${label}: ${n} session${n !== 1 ? "s" : ""} · avg eval ${ev.avg_overall}/3 · best ${ev.best_score}/3`
          : `  • ${label}: ${n} session${n !== 1 ? "s" : ""} (no evaluations recorded)`;
      }).join("\n");

      const certLines = Object.entries(certByTrack).map(([t, c]) => {
        const label = CI_TRACKS[t as CITrackKey]?.label || t;
        const scoreStr = c.overall_score !== null ? `${c.overall_score}/3` : "N/A";
        const dimStr = Object.entries(c.scores).map(([k, v]) => `${k}: ${v}/3`).join(", ");
        return `  • ${label}: ${c.passed ? "✅ PASSED" : "❌ Not yet passed"} (overall ${scoreStr}${dimStr ? " · " + dimStr : ""})`;
      }).join("\n");

      try {
        const comp = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [{
            role: "user",
            content: `Write a concise 2–3 sentence narrative for a monthly education report about a learner's Community Impact training and certification progress at a rural AI learning lab in ${city}, Nigeria.

The 5 Community Impact tracks train learners to advise their community as:
- AI Ambassadors (teaching others about AI in plain language)
- Agriculture Consultants (advising farmers on climate adaptation and cassava farming)
- Fishing Consultants (advising fishers on contamination safety and aquaculture)
- Healthcare Navigators (WHO IMCI triage, clinical assessment, referral writing)
- Entrepreneurship Consultants (advising young Nigerians starting businesses)

TRAINING this month:
${trainingLines || "  No training sessions this month."}

CERTIFICATIONS (all-time status):
${certLines || "  No certifications attempted yet."}

Note which tracks are most active, highlight any certs passed or strong eval scores, and suggest what the learner's pattern of engagement reveals. Be specific and encouraging. Avoid generic phrases.`,
          }],
          max_tokens: 140,
          temperature: 0.3,
        });
        ciSummary = comp.choices[0]?.message?.content?.trim() || "";
      } catch { /* non-fatal — summary stays empty */ }
    }

    return {
      training_sessions_total:    trainingTotal,
      training_sessions_by_track: sessionsByTrack,
      training_eval_by_track:     trainingEvalByTrack,
      tracks_active_count:        tracksActive,
      cert_by_track:              certByTrack,
      certs_passed_count:         certsPassed,
      summary:                    ciSummary,
    };
  } catch (err: any) {
    console.warn(`   fetchCommunityImpactData error: ${err.message}`);
    return empty;
  }
}

// ─── Core Assessment ──────────────────────────────────────────────────────────

async function assessMonthlySkills(
  userId: string,
  startDate: Date,
  endDate: Date,
  city: string
): Promise<{
  result: MonthlySkillsResult | null;
  sessionCount: number;
  engagedSessionCount: number;
  status: AssessmentSummary["status"];
  error?: string;
}> {
  const { data: existing } = await supabase
    .from("user_monthly_assessments")
    .select("id")
    .eq("user_id", userId)
    .gte("measured_at", startDate.toISOString())
    .lte("measured_at", endDate.toISOString())
    .single();

  if (existing) return { result: null, sessionCount: 0, engagedSessionCount: 0, status: "skipped" };

  const { data: activities, error } = await supabase
    .from("dashboard")
    .select("chat_history, created_at")
    .eq("user_id", userId)
    .gte("created_at", startDate.toISOString())
    .lte("created_at", endDate.toISOString())
    .order("created_at", { ascending: true });

  if (error || !activities?.length) {
    return { result: null, sessionCount: 0, engagedSessionCount: 0, status: "no_activity" };
  }

  const sessionCount = activities.length;

  type ChatMsg = { role: string; content: string };
  type ParsedSession = { messages: ChatMsg[] };

  const parsedSessions: ParsedSession[] = activities.map((a) => {
    try {
      const h = typeof a.chat_history === "string" ? JSON.parse(a.chat_history) : (a.chat_history || []);
      return { messages: Array.isArray(h) ? h : [] };
    } catch { return { messages: [] }; }
  });

  const engagedSessionCount = parsedSessions.filter(
    (s) => s.messages.filter((m) => m.role === "user").length >= 3
  ).length;

  if (engagedSessionCount === 0) {
    return { result: null, sessionCount, engagedSessionCount: 0, status: "no_activity" };
  }

  // Build full curriculum transcript preserving AI/user structure for scaffolding analysis
  const fullTranscript = parsedSessions
    .map((s, i) => {
      const msgs = s.messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => `[${m.role.toUpperCase()}]: ${(m.content || "").slice(0, 1000)}`)
        .join("\n");
      return msgs ? `--- SESSION ${i + 1} ---\n${msgs}` : null;
    })
    .filter(Boolean)
    .join("\n\n");

  if (!fullTranscript.trim()) {
    return { result: null, sessionCount, engagedSessionCount: 0, status: "no_activity" };
  }

  const truncated = fullTranscript.length > 70000
    ? fullTranscript.slice(0, 70000) + "\n\n[CURRICULUM TRANSCRIPT TRUNCATED]"
    : fullTranscript;

  // Fetch AI Playground chats for this period (free-form, unconstrained access)
  type PlayMsg = { role: string; content: string };
  let playgroundTranscript = "";
  let playgroundSessionCount = 0;
  let playgroundWordCount = 0;

  try {
    const { data: pgRows } = await supabase
      .from("ai_playground_chats")
      .select("id, title, messages, updated_at")
      .eq("user_id", userId)
      .gte("updated_at", startDate.toISOString())
      .lte("updated_at", endDate.toISOString())
      .order("updated_at", { ascending: true });

    if (pgRows?.length) {
      playgroundSessionCount = pgRows.length;
      const pgSections: string[] = [];
      for (const row of pgRows) {
        const msgs: PlayMsg[] = Array.isArray(row.messages) ? row.messages : [];
        const userMsgs = msgs.filter((m) => m.role === "user");
        playgroundWordCount += userMsgs.reduce((acc, m) => acc + (m.content || "").split(/\s+/).length, 0);
        const section = msgs
          .filter((m) => m.role === "user" || m.role === "assistant")
          .map((m) => `[${m.role.toUpperCase()}]: ${(m.content || "").slice(0, 800)}`)
          .join("\n");
        if (section) pgSections.push(`--- PLAYGROUND: ${(row.title || "Chat").slice(0, 60)} ---\n${section}`);
      }
      // Budget ~10k chars for playground so curriculum remains primary
      playgroundTranscript = pgSections.join("\n\n").slice(0, 10000);
      if (pgSections.join("\n\n").length > 10000) playgroundTranscript += "\n[PLAYGROUND TRANSCRIPT TRUNCATED]";
    }
  } catch (pgErr: any) {
    console.warn(`   Playground fetch skipped: ${pgErr.message}`);
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "Expert educational assessment analyst. Respond ONLY with valid JSON, no markdown." },
        { role: "user", content: buildAssessmentPrompt(truncated, engagedSessionCount, playgroundTranscript, playgroundSessionCount, city) },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
      max_tokens: 4000,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) throw new Error("Empty OpenAI response");

    const raw = JSON.parse(content);
    const artifactScore =
      (raw.enterprise_artifact_goal_score || 0) +
      (raw.enterprise_artifact_resource_score || 0) +
      (raw.enterprise_artifact_plan_score || 0) +
      (raw.enterprise_artifact_constraint_score || 0) +
      (raw.enterprise_artifact_quant_score || 0) +
      (raw.enterprise_artifact_risk_score || 0);

    const result: MonthlySkillsResult = {
      ...raw,
      enterprise_artifact_score: artifactScore,
      // Prefer our directly-counted values over GPT estimates for accuracy
      ai_playground_session_count: playgroundSessionCount,
      ai_playground_word_count: playgroundWordCount,
      ai_playground_summary: raw.ai_playground_summary || "No AI Playground activity recorded this period.",
      // GPT AI Proficiency scores (defaults to 0 if GPT didn't return them)
      ai_prof_application_gpt: raw.ai_prof_application_gpt || 0,
      ai_prof_ethics_gpt: raw.ai_prof_ethics_gpt || 0,
      ai_prof_understanding_gpt: raw.ai_prof_understanding_gpt || 0,
      ai_prof_verification_gpt: raw.ai_prof_verification_gpt || 0,
      ai_prof_gpt_narrative: raw.ai_prof_gpt_narrative || "",
      // Formal cert scores — filled below from fetchUserCertData
      ai_prof_application_score: null,
      ai_prof_ethics_score: null,
      ai_prof_understanding_score: null,
      ai_prof_verification_score: null,
      ai_prof_cert_level: "Not Attempted",
      // Cert summary — filled in below from fetchUserCertData
      cert_attempted_count: 0,
      cert_passed_count: 0,
      cert_names_attempted: [],
      cert_names_passed: [],
      cert_avg_score: null,
      cert_summary: "",
      // Community Impact — filled in below from fetchCommunityImpactData
      ci_training_sessions_total: 0,
      ci_training_sessions_by_track: {},
      ci_training_eval_by_track: {},
      ci_tracks_active_count: 0,
      ci_cert_by_track: {},
      ci_certs_passed_count: 0,
      ci_summary: "",
    };

    // Fetch formal cert data (not time-bounded — shows all-time cert status)
    const certData = await fetchUserCertData(userId);

    // Generate cert narrative using GPT if there's cert activity
    let certSummary = "No certifications attempted yet.";
    if (certData.cert_attempted_count > 0) {
      try {
        const certNarrCompletion = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [{
            role: "user",
            content: `Write a 2-sentence summary for a monthly report about a learner's certification activity at an AI learning lab in rural Nigeria.
Certifications attempted: ${certData.cert_names_attempted.join(", ")}
Certifications passed (score ≥ 2.25/3): ${certData.cert_names_passed.length > 0 ? certData.cert_names_passed.join(", ") : "None yet"}
Average cert score: ${certData.cert_avg_score ?? "N/A"}/3
AI Proficiency cert level: ${certData.ai_prof_cert_level}
AI Proficiency dimension scores (0-3): Application=${certData.ai_prof_application_score ?? "N/A"}, Ethics=${certData.ai_prof_ethics_score ?? "N/A"}, Understanding=${certData.ai_prof_understanding_score ?? "N/A"}, Verification=${certData.ai_prof_verification_score ?? "N/A"}
Be encouraging and specific. Note strongest and weakest dimensions if AI Proficiency scores exist.`,
          }],
          max_tokens: 150,
          temperature: 0.3,
        });
        certSummary = certNarrCompletion.choices[0]?.message?.content?.trim() || certSummary;
      } catch { /* non-fatal */ }
    }

    result.cert_attempted_count = certData.cert_attempted_count;
    result.cert_passed_count = certData.cert_passed_count;
    result.cert_names_attempted = certData.cert_names_attempted;
    result.cert_names_passed = certData.cert_names_passed;
    result.cert_avg_score = certData.cert_avg_score;
    result.cert_summary = certSummary;
    result.ai_prof_application_score = certData.ai_prof_application_score;
    result.ai_prof_ethics_score = certData.ai_prof_ethics_score;
    result.ai_prof_understanding_score = certData.ai_prof_understanding_score;
    result.ai_prof_verification_score = certData.ai_prof_verification_score;
    result.ai_prof_cert_level = certData.ai_prof_cert_level;

    // Fetch Community Impact training + certification data
    const ciData = await fetchCommunityImpactData(userId, startDate, endDate, city);
    result.ci_training_sessions_total    = ciData.training_sessions_total;
    result.ci_training_sessions_by_track = ciData.training_sessions_by_track;
    result.ci_training_eval_by_track     = ciData.training_eval_by_track;
    result.ci_tracks_active_count        = ciData.tracks_active_count;
    result.ci_cert_by_track              = ciData.cert_by_track;
    result.ci_certs_passed_count         = ciData.certs_passed_count;
    result.ci_summary                    = ciData.summary;

    const { error: insertError } = await supabase
      .from("user_monthly_assessments")
      .insert({
        user_id: userId,
        measured_at: endDate.toISOString(),
        assessment_model: "gpt-4o",
        assessment_version: "v2.1",
        cognitive_score: result.cognitive_score,
        cognitive_evidence: result.cognitive_evidence,
        critical_thinking_score: result.critical_thinking_score,
        critical_thinking_evidence: result.critical_thinking_evidence,
        problem_solving_score: result.problem_solving_score,
        problem_solving_evidence: result.problem_solving_evidence,
        creativity_score: result.creativity_score,
        creativity_evidence: result.creativity_evidence,
        pue_score: result.pue_score,
        pue_evidence: result.pue_evidence,
        session_count: sessionCount,
        engaged_session_count: engagedSessionCount,
        pue_energy_constraint_pct: result.pue_energy_constraint_pct,
        pue_market_pricing_pct: result.pue_market_pricing_pct,
        pue_battery_load_pct: result.pue_battery_load_pct,
        pue_enterprise_planning_pct: result.pue_enterprise_planning_pct,
        pue_learner_initiated_pct: result.pue_learner_initiated_pct,
        pue_ai_introduced_pct: result.pue_ai_introduced_pct,
        pue_multi_domain_pct: result.pue_multi_domain_pct,
        pue_local_context_pct: result.pue_local_context_pct,
        pue_summary: result.pue_summary,
        pue_evidence: result.pue_evidence_quotes,
        scaffold_clarification_per_session: result.scaffold_clarification_per_session,
        scaffold_decomposition_per_session: result.scaffold_decomposition_per_session,
        scaffold_correction_total_per_session: result.scaffold_correction_total_per_session,
        scaffold_explicit_correction_per_session: result.scaffold_explicit_correction_per_session,
        scaffold_gentle_redirect_per_session: result.scaffold_gentle_redirect_per_session,
        scaffold_consecutive_correction_runs: result.scaffold_consecutive_correction_runs,
        scaffold_convergence_trend: result.scaffold_convergence_trend,
        scaffold_convergence_narrative: result.scaffold_convergence_narrative,
        reasoning_definitional_pct: result.reasoning_definitional_pct,
        reasoning_responsive_pct: result.reasoning_responsive_pct,
        reasoning_elaborative_pct: result.reasoning_elaborative_pct,
        reasoning_structured_pct: result.reasoning_structured_pct,
        reasoning_chain_count: result.reasoning_chain_count,
        metacog_verification_rate: result.metacog_verification_rate,
        metacog_reactive_rate: result.metacog_reactive_rate,
        metacog_strategic_rate: result.metacog_strategic_rate,
        metacog_narrative: result.metacog_narrative,
        role_teaching_intent_count: result.role_teaching_intent_count,
        role_community_application_count: result.role_community_application_count,
        role_enterprise_orientation_count: result.role_enterprise_orientation_count,
        role_intergenerational_count: result.role_intergenerational_count,
        role_readiness_narrative: result.role_readiness_narrative,
        role_readiness_signals: result.role_readiness_signals,
        enterprise_artifact_score: result.enterprise_artifact_score,
        enterprise_artifact_goal_score: result.enterprise_artifact_goal_score,
        enterprise_artifact_resource_score: result.enterprise_artifact_resource_score,
        enterprise_artifact_plan_score: result.enterprise_artifact_plan_score,
        enterprise_artifact_constraint_score: result.enterprise_artifact_constraint_score,
        enterprise_artifact_quant_score: result.enterprise_artifact_quant_score,
        enterprise_artifact_risk_score: result.enterprise_artifact_risk_score,
        enterprise_artifact_evidence: result.enterprise_artifact_evidence,
        ai_playground_session_count: result.ai_playground_session_count,
        ai_playground_word_count: result.ai_playground_word_count,
        ai_playground_summary: result.ai_playground_summary,
        // AI Proficiency formal cert scores
        ai_prof_application_score: certData.ai_prof_application_score,
        ai_prof_ethics_score: certData.ai_prof_ethics_score,
        ai_prof_understanding_score: certData.ai_prof_understanding_score,
        ai_prof_verification_score: certData.ai_prof_verification_score,
        ai_prof_min_score: certData.ai_prof_min_score,
        ai_prof_cert_level: certData.ai_prof_cert_level,
        // AI Proficiency GPT scores
        ai_prof_application_gpt: result.ai_prof_application_gpt,
        ai_prof_ethics_gpt: result.ai_prof_ethics_gpt,
        ai_prof_understanding_gpt: result.ai_prof_understanding_gpt,
        ai_prof_verification_gpt: result.ai_prof_verification_gpt,
        ai_prof_gpt_narrative: result.ai_prof_gpt_narrative,
        // Certification summary
        cert_attempted_count: result.cert_attempted_count,
        cert_passed_count: result.cert_passed_count,
        cert_names_attempted: result.cert_names_attempted,
        cert_names_passed: result.cert_names_passed,
        cert_avg_score: result.cert_avg_score,
        cert_summary: result.cert_summary,
        // Community Impact
        ci_training_sessions_total:    result.ci_training_sessions_total,
        ci_training_sessions_by_track: result.ci_training_sessions_by_track,
        ci_training_eval_by_track:     result.ci_training_eval_by_track,
        ci_tracks_active_count:        result.ci_tracks_active_count,
        ci_cert_by_track:              result.ci_cert_by_track,
        ci_certs_passed_count:         result.ci_certs_passed_count,
        ci_summary:                    result.ci_summary,
      });

    if (insertError) throw insertError;
    return { result, sessionCount, engagedSessionCount, status: "success" };
  } catch (err: any) {
    return { result: null, sessionCount, engagedSessionCount: 0, status: "error", error: err.message };
  }
}

// ─── Cohort History ──────────────────────────────────────────────────────────

interface CohortMonthRecord {
  monthLabel: string;
  measured_at: string;
  learnerCount: number;
  cognitive_score: number;
  critical_thinking_score: number;
  problem_solving_score: number;
  creativity_score: number;
  pue_score: number;
  pue_energy_constraint_pct: number;
  pue_market_pricing_pct: number;
  pue_learner_initiated_pct: number;
  reasoning_structured_pct: number;
  session_count: number;
  // AI Proficiency GPT averages (0–100)
  ai_prof_application_gpt: number;
  ai_prof_ethics_gpt: number;
  ai_prof_understanding_gpt: number;
  ai_prof_verification_gpt: number;
  // Certification averages
  cert_passed_pct: number; // total certs passed across cohort this month
}

async function fetchCohortHistory(excludeIds: Set<string>): Promise<CohortMonthRecord[]> {
  try {
    // Try full v2.0 column set first (requires alter_user_monthly_assessments.sql migration)
    const { data: allRows, error } = await supabase
      .from("user_monthly_assessments")
      .select(`
        user_id, measured_at,
        cognitive_score, critical_thinking_score,
        problem_solving_score, creativity_score, pue_score,
        pue_energy_constraint_pct, pue_market_pricing_pct,
        pue_learner_initiated_pct, reasoning_structured_pct,
        session_count,
        ai_prof_application_gpt, ai_prof_ethics_gpt,
        ai_prof_understanding_gpt, ai_prof_verification_gpt,
        cert_passed_count
      `)
      .order("measured_at", { ascending: true });

    // If the v2.0 columns don't exist yet, fall back to base columns only
    if (error) {
      console.warn("fetchCohortHistory: v2.0 columns not found, falling back to base columns:", error.message);
      return fetchCohortHistoryBase(excludeIds);
    }

    if (!allRows?.length) return [];

    // Group by calendar month, exclude facilitators
    const byMonth = new Map<string, typeof allRows>();
    for (const row of allRows) {
      if (excludeIds.has(row.user_id)) continue;
      const d = new Date(row.measured_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!byMonth.has(key)) byMonth.set(key, []);
      byMonth.get(key)!.push(row);
    }

    const records: CohortMonthRecord[] = [];
    for (const [key, rows] of byMonth.entries()) {
      const n = rows.length;
      const sum = (field: string) =>
        rows.reduce((acc, r) => acc + (Number((r as any)[field]) || 0), 0);
      const avg = (field: string) => Math.round(sum(field) / n);
      const certPassedCount = rows.filter((r) => (Number((r as any)["cert_passed_count"]) || 0) > 0).length;

      const d = new Date(key + "-01");
      records.push({
        monthLabel: d.toLocaleDateString("en-US", { month: "short", year: "numeric" }),
        measured_at: key,
        learnerCount: n,
        cognitive_score: avg("cognitive_score"),
        critical_thinking_score: avg("critical_thinking_score"),
        problem_solving_score: avg("problem_solving_score"),
        creativity_score: avg("creativity_score"),
        pue_score: avg("pue_score"),
        pue_energy_constraint_pct: avg("pue_energy_constraint_pct"),
        pue_market_pricing_pct: avg("pue_market_pricing_pct"),
        pue_learner_initiated_pct: avg("pue_learner_initiated_pct"),
        reasoning_structured_pct: avg("reasoning_structured_pct"),
        session_count: sum("session_count"),
        ai_prof_application_gpt: avg("ai_prof_application_gpt"),
        ai_prof_ethics_gpt: avg("ai_prof_ethics_gpt"),
        ai_prof_understanding_gpt: avg("ai_prof_understanding_gpt"),
        ai_prof_verification_gpt: avg("ai_prof_verification_gpt"),
        cert_passed_pct: rows.reduce((acc, r) => acc + (Number((r as any)["cert_passed_count"]) || 0), 0),
      });
    }

    return records.sort((a, b) => a.measured_at.localeCompare(b.measured_at));
  } catch (err: any) {
    console.error("fetchCohortHistory error:", err.message);
    return [];
  }
}

// Fallback: base columns only (pre-migration) ─────────────────────────────────
async function fetchCohortHistoryBase(excludeIds: Set<string>): Promise<CohortMonthRecord[]> {
  try {
    const { data: allRows } = await supabase
      .from("user_monthly_assessments")
      .select(`
        user_id, measured_at,
        cognitive_score, critical_thinking_score,
        problem_solving_score, creativity_score, pue_score
      `)
      .order("measured_at", { ascending: true });

    if (!allRows?.length) return [];

    const byMonth = new Map<string, typeof allRows>();
    for (const row of allRows) {
      if (excludeIds.has(row.user_id)) continue;
      const d = new Date(row.measured_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!byMonth.has(key)) byMonth.set(key, []);
      byMonth.get(key)!.push(row);
    }

    const records: CohortMonthRecord[] = [];
    for (const [key, rows] of byMonth.entries()) {
      const n = rows.length;
      const avg = (field: string) =>
        Math.round(rows.reduce((acc, r) => acc + (Number((r as any)[field]) || 0), 0) / n);

      const d = new Date(key + "-01");
      records.push({
        monthLabel: d.toLocaleDateString("en-US", { month: "short", year: "numeric" }),
        measured_at: key,
        learnerCount: n,
        cognitive_score: avg("cognitive_score"),
        critical_thinking_score: avg("critical_thinking_score"),
        problem_solving_score: avg("problem_solving_score"),
        creativity_score: avg("creativity_score"),
        pue_score: avg("pue_score"),
        pue_energy_constraint_pct: 0,
        pue_market_pricing_pct: 0,
        pue_learner_initiated_pct: 0,
        reasoning_structured_pct: 0,
        session_count: 0,
        ai_prof_application_gpt: 0,
        ai_prof_ethics_gpt: 0,
        ai_prof_understanding_gpt: 0,
        ai_prof_verification_gpt: 0,
        cert_passed_pct: 0,
      });
    }

    return records.sort((a, b) => a.measured_at.localeCompare(b.measured_at));
  } catch (err: any) {
    console.error("fetchCohortHistoryBase error:", err.message);
    return [];
  }
}

// ─── AI Playground Summary ────────────────────────────────────────────────────

async function fetchPlaygroundSummary(
  userId: string,
  startDate: Date,
  endDate: Date,
  city: string
): Promise<PlaygroundSummary | null> {
  // Playground chats live in ai_playground_chats — separate from dashboard.
  // messages is stored as a native JSON array: [{role, content, timestamp}]
  const { data: rows, error } = await supabase
    .from("ai_playground_chats")
    .select("id, title, messages, created_at, updated_at")
    .eq("user_id", userId)
    .gte("updated_at", startDate.toISOString())
    .lte("updated_at", endDate.toISOString())
    .order("updated_at", { ascending: true });

  if (error || !rows?.length) return null;

  // messages is already a parsed JSON array — no string-parsing needed
  type Msg = { role: string; content: string };
  const allMessages: Msg[] = [];
  for (const row of rows) {
    const msgs = Array.isArray(row.messages) ? row.messages : [];
    allMessages.push(...msgs);
  }

  const userMessages = allMessages.filter((m) => m.role === "user");
  if (userMessages.length < 2) return null; // too thin to summarise

  // Build a compact transcript — user messages only to keep tokens low
  const transcript = userMessages
    .map((m) => m.content?.slice(0, 600) || "")
    .filter(Boolean)
    .join("\n---\n")
    .slice(0, 40000);

  const totalWords = userMessages
    .reduce((acc, m) => acc + (m.content || "").split(/\s+/).length, 0);

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            `You are an educational analyst reviewing free-form AI Playground conversations from youth learners (ages 12–24) at the ${getCityContext(city).institution}. ` +
            "The AI Playground gives learners unrestricted access to Claude — no curriculum scaffolding, no activity structure. " +
            "Your job is to characterise how this learner is using free-form AI access and flag anything connected to Productive Use of Energy (PUE), entrepreneurship, or community enterprise. " +
            "Respond ONLY with valid JSON, no markdown.",
        },
        {
          role: "user",
          content: `Analyse these ${rows.length} AI Playground sessions (${totalWords} learner words total).

TRANSCRIPT (user messages only):
${transcript}

Return this exact JSON:
{
  "pueSessionCount": <integer: how many sessions contained energy/solar/battery/business/enterprise/market/farming language>,
  "entrepreneurshipCount": <integer: sessions focused on building a business, starting a venture, or enterprise planning>,
  "topTopics": ["<3-5 dominant themes this learner explored in free-form AI use — be specific, e.g. 'solar system sizing', 'football tactics', 'coding help', 'business planning'>"],
  "pueHighlights": ["<up to 3 direct learner quotes that show PUE or entrepreneurship thinking — use exact words from the transcript, max 120 chars each>"],
  "narrative": "<3-4 sentences: What is this learner actually doing with unconstrained AI access? Are they using it for personal curiosity, practical community/energy problems, entrepreneurship, or social conversation? Specifically call out any PUE or enterprise-relevant use. How does their free-form usage compare to what you'd expect from a structured curriculum?>",
  "hasMeaningfulActivity": <true if there are at least 2 substantive exchanges, false otherwise>
}`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
      max_tokens: 1000,
    });

    const raw = JSON.parse(completion.choices[0]?.message?.content || "{}");
    return {
      sessionCount: rows.length,
      totalWords,
      pueSessionCount: raw.pueSessionCount || 0,
      entrepreneurshipCount: raw.entrepreneurshipCount || 0,
      topTopics: raw.topTopics || [],
      pueHighlights: raw.pueHighlights || [],
      narrative: raw.narrative || "",
      hasMeaningfulActivity: raw.hasMeaningfulActivity ?? true,
    };
  } catch (err: any) {
    console.error(`   Playground summary error for ${userId.slice(0, 8)}: ${err.message}`);
    return null;
  }
}

// ─── User Discovery ───────────────────────────────────────────────────────────

async function getAfricanUsersNeedingAssessment(
  startDate: Date,
  endDate: Date
): Promise<Array<{ userId: string; city: string }>> {
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, city")
    .eq("continent", "Africa");
  if (!profiles?.length) return [];

  // city = "Ibiade" → Ibiade cohort; everything else → Oloibiri cohort
  const cityMap = new Map(profiles.map((p) => [p.id, p.city === "Ibiade" ? "Ibiade" : "Oloibiri"]));
  const ids = profiles.map((p) => p.id);

  const { data: activities } = await supabase
    .from("dashboard").select("user_id").in("user_id", ids)
    .gte("created_at", startDate.toISOString()).lte("created_at", endDate.toISOString());
  if (!activities?.length) return [];

  const activeIds = [...new Set(activities.map((a) => a.user_id).filter(Boolean))] as string[];

  const { data: assessed } = await supabase
    .from("user_monthly_assessments").select("user_id").in("user_id", activeIds)
    .gte("measured_at", startDate.toISOString()).lte("measured_at", endDate.toISOString());

  const doneSet = new Set((assessed || []).map((a) => a.user_id));
  return activeIds
    .filter((id) => !doneSet.has(id) && !EXCLUDED_USER_IDS.has(id))
    .map((id) => ({ userId: id, city: cityMap.get(id) ?? "Oloibiri" }));
}

// ─── Historical Data ──────────────────────────────────────────────────────────

async function fetchAllHistoricalData(userIds: string[]): Promise<Map<string, HistoricalRecord[]>> {
  if (!userIds.length) return new Map();
  const { data } = await supabase
    .from("user_monthly_assessments")
    .select(`user_id, measured_at, cognitive_score, critical_thinking_score,
      problem_solving_score, creativity_score, pue_score,
      pue_energy_constraint_pct, pue_market_pricing_pct, pue_learner_initiated_pct,
      pue_summary, scaffold_convergence_trend, reasoning_structured_pct,
      metacog_verification_rate, role_teaching_intent_count,
      role_enterprise_orientation_count, enterprise_artifact_score, session_count,
      ai_prof_application_score, ai_prof_ethics_score, ai_prof_understanding_score,
      ai_prof_verification_score, ai_prof_cert_level,
      ai_prof_application_gpt, ai_prof_ethics_gpt, ai_prof_understanding_gpt, ai_prof_verification_gpt,
      cert_attempted_count, cert_passed_count, cert_names_passed, cert_avg_score,
      ci_training_sessions_total, ci_tracks_active_count, ci_certs_passed_count, ci_cert_by_track`)
    .in("user_id", userIds)
    .order("measured_at", { ascending: true });

  const map = new Map<string, HistoricalRecord[]>();
  for (const row of data || []) {
    if (!map.has(row.user_id)) map.set(row.user_id, []);
    map.get(row.user_id)!.push(row as HistoricalRecord);
  }
  return map;
}

// ─── Email HTML ───────────────────────────────────────────────────────────────

function sc(n: number | null | undefined): string {
  if (n == null) return "—";
  const v = Math.round(n);
  if (v >= 75) return `<span style="background:#bbf7d0;color:#14532d;padding:2px 7px;border-radius:4px;font-family:monospace;font-size:12px;font-weight:700;">${v}</span>`;
  if (v >= 55) return `<span style="background:#bfdbfe;color:#1e40af;padding:2px 7px;border-radius:4px;font-family:monospace;font-size:12px;font-weight:700;">${v}</span>`;
  if (v >= 35) return `<span style="background:#fef08a;color:#713f12;padding:2px 7px;border-radius:4px;font-family:monospace;font-size:12px;font-weight:700;">${v}</span>`;
  return `<span style="background:#fecaca;color:#7f1d1d;padding:2px 7px;border-radius:4px;font-family:monospace;font-size:12px;font-weight:700;">${v}</span>`;
}

function pct(n: number | null | undefined): string {
  return n == null ? "—" : `${Math.round(n)}%`;
}
function fmt(n: number | null | undefined, dec = 1): string {
  return n == null ? "—" : n.toFixed(dec);
}

function trendChip(trend: string | null | undefined): string {
  if (!trend) return "";
  const cfg: Record<string, [string, string]> = {
    converging: ["#dcfce7", "#166534"],
    stable: ["#f1f5f9", "#475569"],
    diverging: ["#fee2e2", "#991b1b"],
    insufficient_data: ["#fef9c3", "#854d0e"],
  };
  const [bg, color] = cfg[trend] || ["#f1f5f9", "#475569"];
  return `<span style="background:${bg};color:${color};padding:2px 8px;border-radius:10px;font-size:10px;font-weight:600;">${trend.replace(/_/g, " ")}</span>`;
}

function trendArrow(history: HistoricalRecord[]): string {
  if (history.length < 2) return "";
  const avg5 = (r: HistoricalRecord) =>
    (r.cognitive_score + r.critical_thinking_score + r.problem_solving_score + r.creativity_score + r.pue_score) / 5;
  const diff = Math.round(avg5(history.at(-1)!) - avg5(history.at(-2)!));
  if (diff > 0) return `<span style="color:#166534;font-size:12px;"> ▲ +${diff}</span>`;
  if (diff < 0) return `<span style="color:#991b1b;font-size:12px;"> ▼ ${diff}</span>`;
  return `<span style="color:#6b7280;font-size:12px;"> → 0</span>`;
}

function pueDomainBar(label: string, val: number | null): string {
  const w = Math.round(Math.min((val || 0) * 1.2, 120));
  return `<div style="margin-bottom:5px;display:flex;align-items:center;gap:6px;">
    <span style="font-size:11px;color:#374151;width:150px;flex-shrink:0;">${label}</span>
    <span style="display:inline-block;background:#e5e7eb;border-radius:3px;width:120px;height:7px;">
      <span style="display:inline-block;background:#2d6a4f;border-radius:3px;height:7px;width:${w}px;"></span>
    </span>
    <span style="font-size:11px;color:#374151;">${pct(val)}</span>
  </div>`;
}

function buildUserCard(
  summary: AssessmentSummary,
  history: HistoricalRecord[],
  playground: PlaygroundSummary | null
): string {
  if (summary.status !== "success" || !summary.scores) return "";
  const { name, sessionCount, engagedSessionCount, scores: s } = summary;
  const initials = name.split(" ").slice(0, 2).map((w) => w[0] || "").join("").toUpperCase();

  const historyRows = history.map((h, i) => {
    const isLatest = i === history.length - 1;
    const dot = isLatest ? `<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#52b788;margin-right:4px;vertical-align:middle;"></span>` : "";
    const mo = new Date(h.measured_at).toLocaleDateString("en-US", { month: "short", year: "numeric" });
    return `<tr style="${isLatest ? "background:rgba(82,183,136,0.06);" : ""}border-top:1px solid #e5e7eb;">
      <td style="padding:7px 10px;font-family:monospace;font-size:11px;color:#6b7280;">${dot}${mo}</td>
      <td style="padding:7px 10px;text-align:center;">${sc(h.cognitive_score)}</td>
      <td style="padding:7px 10px;text-align:center;">${sc(h.critical_thinking_score)}</td>
      <td style="padding:7px 10px;text-align:center;">${sc(h.problem_solving_score)}</td>
      <td style="padding:7px 10px;text-align:center;">${sc(h.creativity_score)}</td>
      <td style="padding:7px 10px;text-align:center;">${sc(h.pue_score)}</td>
      <td style="padding:7px 10px;text-align:center;">${h.ai_prof_application_gpt != null ? sc(h.ai_prof_application_gpt) : "<span style='color:#d1d5db;font-size:10px;'>—</span>"}</td>
      <td style="padding:7px 10px;text-align:center;">${h.ai_prof_ethics_gpt != null ? sc(h.ai_prof_ethics_gpt) : "<span style='color:#d1d5db;font-size:10px;'>—</span>"}</td>
      <td style="padding:7px 10px;text-align:center;">${h.ai_prof_understanding_gpt != null ? sc(h.ai_prof_understanding_gpt) : "<span style='color:#d1d5db;font-size:10px;'>—</span>"}</td>
      <td style="padding:7px 10px;text-align:center;">${h.ai_prof_verification_gpt != null ? sc(h.ai_prof_verification_gpt) : "<span style='color:#d1d5db;font-size:10px;'>—</span>"}</td>
      <td style="padding:7px 10px;text-align:center;font-family:monospace;font-size:11px;color:${(h.cert_passed_count ?? 0) > 0 ? "#166534" : "#9ca3af"};">${h.cert_passed_count ?? "—"}</td>
      <td style="padding:7px 10px;text-align:center;font-family:monospace;font-size:11px;color:#1a3d2b;">${h.session_count ?? "—"}</td>
    </tr>`;
  }).join("");

  return `
<div style="margin-bottom:24px;border:1px solid #d0e8d8;border-radius:12px;overflow:hidden;">

  <div style="background:linear-gradient(135deg,#f4fbf6,#fff);padding:13px 16px;display:flex;align-items:center;gap:11px;border-bottom:1px solid #d0e8d8;">
    <div style="width:38px;height:38px;border-radius:50%;background:#1a3d2b;display:flex;align-items:center;justify-content:center;color:#52b788;font-weight:700;font-size:14px;flex-shrink:0;">${initials}</div>
    <div style="flex:1;">
      <strong style="font-size:14px;color:#0d1b14;">${name}</strong>${trendArrow(history)}
      <div style="font-size:11px;color:#5a7060;margin-top:1px;">${history.length} assessment${history.length !== 1 ? "s" : ""} · ${sessionCount} sessions (${engagedSessionCount} engaged) this period</div>
    </div>
  </div>

  <table style="width:100%;border-collapse:collapse;font-size:12px;">
    <tr style="background:#f5faf6;">
      <th style="padding:6px 10px;text-align:left;font-size:9px;color:#5a7060;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;">Period</th>
      <th style="padding:6px 10px;text-align:center;font-size:9px;color:#5a7060;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;">Cog</th>
      <th style="padding:6px 10px;text-align:center;font-size:9px;color:#5a7060;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;">CT</th>
      <th style="padding:6px 10px;text-align:center;font-size:9px;color:#5a7060;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;">PS</th>
      <th style="padding:6px 10px;text-align:center;font-size:9px;color:#5a7060;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;">Cre</th>
      <th style="padding:6px 10px;text-align:center;font-size:9px;color:#5a7060;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;">PUE</th>
      <th style="padding:6px 10px;text-align:center;font-size:9px;color:#6b21a8;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;">App</th>
      <th style="padding:6px 10px;text-align:center;font-size:9px;color:#6b21a8;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;">Eth</th>
      <th style="padding:6px 10px;text-align:center;font-size:9px;color:#6b21a8;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;">Und</th>
      <th style="padding:6px 10px;text-align:center;font-size:9px;color:#6b21a8;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;">Ver</th>
      <th style="padding:6px 10px;text-align:center;font-size:9px;color:#92400e;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;">Certs</th>
      <th style="padding:6px 10px;text-align:center;font-size:9px;color:#5a7060;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;">Sessions</th>
    </tr>
    ${historyRows}
  </table>

  <div style="padding:13px 16px;border-top:1px solid #d0e8d8;background:#fafffe;">
    <div style="font-size:11px;font-weight:600;color:#1a3d2b;margin-bottom:8px;">⚡ PUE Domain Coverage</div>
    <div style="display:flex;gap:20px;flex-wrap:wrap;">
      <div>
        ${pueDomainBar("🔋 Energy Constraint", s.pue_energy_constraint_pct)}
        ${pueDomainBar("📈 Market Pricing", s.pue_market_pricing_pct)}
        ${pueDomainBar("⚙️ Battery/Load", s.pue_battery_load_pct)}
        ${pueDomainBar("🏪 Enterprise Planning", s.pue_enterprise_planning_pct)}
      </div>
      <div>
        ${pueDomainBar("🗣 Learner-Initiated", s.pue_learner_initiated_pct)}
        ${pueDomainBar("🤖 AI-Introduced", s.pue_ai_introduced_pct)}
        ${pueDomainBar("🌐 Multi-Domain (3+)", s.pue_multi_domain_pct)}
        ${pueDomainBar("📍 Local Context", s.pue_local_context_pct)}
      </div>
    </div>
    ${s.pue_summary ? `<div style="margin-top:8px;font-size:11px;color:#374151;line-height:1.5;font-style:italic;">${s.pue_summary}</div>` : ""}
    ${s.pue_evidence_quotes?.[0] ? `<div style="margin-top:6px;padding-left:8px;border-left:2px solid #52b788;font-size:11px;color:#5a7060;font-style:italic;">"${s.pue_evidence_quotes[0].slice(0, 200)}"</div>` : ""}
  </div>

  <div style="display:flex;border-top:1px solid #d0e8d8;">
    <div style="flex:1;padding:11px 14px;border-right:1px solid #d0e8d8;">
      <div style="font-size:10px;font-weight:600;color:#1a3d2b;margin-bottom:6px;">🔧 Scaffolding ${trendChip(s.scaffold_convergence_trend)}</div>
      <div style="font-size:10px;color:#374151;line-height:1.8;">
        <div>Clarification: <strong>${fmt(s.scaffold_clarification_per_session)}/session</strong></div>
        <div>Decomposition: <strong>${fmt(s.scaffold_decomposition_per_session)}/session</strong></div>
        <div>Explicit corrections: <strong>${fmt(s.scaffold_explicit_correction_per_session)}/session</strong></div>
        <div>Gentle redirects: <strong>${fmt(s.scaffold_gentle_redirect_per_session)}/session</strong></div>
      </div>
      ${s.scaffold_convergence_narrative ? `<div style="margin-top:6px;font-size:10px;color:#5a7060;font-style:italic;line-height:1.4;">${s.scaffold_convergence_narrative.slice(0, 180)}…</div>` : ""}
    </div>
    <div style="flex:1;padding:11px 14px;border-right:1px solid #d0e8d8;">
      <div style="font-size:10px;font-weight:600;color:#1a3d2b;margin-bottom:6px;">🧩 Reasoning Levels</div>
      <div style="font-size:10px;color:#374151;line-height:1.8;">
        <div>L0 Definitional: <strong>${pct(s.reasoning_definitional_pct)}</strong></div>
        <div>L1 Responsive: <strong>${pct(s.reasoning_responsive_pct)}</strong></div>
        <div>L2 Elaborative: <strong>${pct(s.reasoning_elaborative_pct)}</strong></div>
        <div>L3 Structured: <strong style="color:${(s.reasoning_structured_pct||0)>=20?"#166534":"inherit"};">${pct(s.reasoning_structured_pct)}</strong></div>
        <div>Chains: <strong>${s.reasoning_chain_count || 0}</strong></div>
      </div>
    </div>
    <div style="flex:1;padding:11px 14px;">
      <div style="font-size:10px;font-weight:600;color:#1a3d2b;margin-bottom:6px;">🧠 Metacognition</div>
      <div style="font-size:10px;color:#374151;line-height:1.8;">
        <div>Verification: <strong>${fmt(s.metacog_verification_rate)}/1k words</strong></div>
        <div>Reactive: <strong>${fmt(s.metacog_reactive_rate)}/1k words</strong></div>
        <div>Strategic: <strong>${fmt(s.metacog_strategic_rate)}/1k words</strong></div>
      </div>
      ${s.metacog_narrative ? `<div style="margin-top:6px;font-size:10px;color:#5a7060;font-style:italic;line-height:1.4;">${s.metacog_narrative.slice(0, 180)}…</div>` : ""}
    </div>
  </div>

  <div style="display:flex;border-top:1px solid #d0e8d8;">
    <div style="flex:1;padding:11px 14px;border-right:1px solid #d0e8d8;">
      <div style="font-size:10px;font-weight:600;color:#1a3d2b;margin-bottom:6px;">🌍 Role Readiness</div>
      <div style="font-size:10px;color:#374151;line-height:1.8;">
        <div>Teaching intent: <strong>${s.role_teaching_intent_count || 0}</strong></div>
        <div>Community application: <strong>${s.role_community_application_count || 0}</strong></div>
        <div>Enterprise orientation: <strong>${s.role_enterprise_orientation_count || 0}</strong></div>
        <div>Intergenerational: <strong>${s.role_intergenerational_count || 0}</strong></div>
      </div>
      ${s.role_readiness_narrative ? `<div style="margin-top:6px;font-size:10px;color:#5a7060;font-style:italic;line-height:1.4;">${s.role_readiness_narrative.slice(0, 200)}…</div>` : ""}
    </div>
    <div style="flex:1;padding:11px 14px;">
      <div style="font-size:10px;font-weight:600;color:#1a3d2b;margin-bottom:6px;">📋 Enterprise Artifact <span style="font-weight:400;color:#5a7060;">(${s.enterprise_artifact_score || 0}/18)</span></div>
      <div style="font-size:10px;color:#374151;line-height:1.8;">
        <div>Goal: ${s.enterprise_artifact_goal_score}/3 &nbsp;·&nbsp; Resources: ${s.enterprise_artifact_resource_score}/3 &nbsp;·&nbsp; Plan: ${s.enterprise_artifact_plan_score}/3</div>
        <div>Constraints: ${s.enterprise_artifact_constraint_score}/3 &nbsp;·&nbsp; Quant: ${s.enterprise_artifact_quant_score}/3 &nbsp;·&nbsp; Risk: ${s.enterprise_artifact_risk_score}/3</div>
      </div>
      ${s.enterprise_artifact_evidence?.[0] ? `<div style="margin-top:6px;padding-left:6px;border-left:2px solid #52b788;font-size:10px;color:#5a7060;font-style:italic;">"${s.enterprise_artifact_evidence[0].slice(0, 160)}…"</div>` : ""}
    </div>
  </div>

  <!-- AI Proficiency Panel -->
  <div style="border-top:1px solid #d0e8d8;background:#f5f0ff;padding:13px 16px;">
    <div style="font-size:11px;font-weight:600;color:#4c1d95;margin-bottom:8px;">🤖 AI Proficiency</div>
    <div style="display:flex;gap:0;flex-wrap:wrap;margin-bottom:8px;">
      <!-- Formal cert scores from AIProficiencyPage -->
      <div style="flex:1;min-width:200px;padding-right:16px;">
        <div style="font-size:9px;font-weight:700;color:#6b21a8;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:5px;">Formal Cert Scores (0–3)</div>
        <div style="font-size:10px;color:#374151;line-height:1.8;">
          <div>Application: <strong>${s.ai_prof_application_score != null ? `${s.ai_prof_application_score}/3` : "—"}</strong> &nbsp; Ethics: <strong>${s.ai_prof_ethics_score != null ? `${s.ai_prof_ethics_score}/3` : "—"}</strong></div>
          <div>Understanding: <strong>${s.ai_prof_understanding_score != null ? `${s.ai_prof_understanding_score}/3` : "—"}</strong> &nbsp; Verification: <strong>${s.ai_prof_verification_score != null ? `${s.ai_prof_verification_score}/3` : "—"}</strong></div>
          <div>Cert level: <strong style="color:${s.ai_prof_cert_level === "Advanced" ? "#166534" : s.ai_prof_cert_level === "Proficient" ? "#1e40af" : s.ai_prof_cert_level === "Emerging" ? "#713f12" : "#6b7280"};">${s.ai_prof_cert_level || "Not Attempted"}</strong></div>
        </div>
      </div>
      <!-- GPT-inferred scores from transcript analysis -->
      <div style="flex:1;min-width:200px;">
        <div style="font-size:9px;font-weight:700;color:#6b21a8;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:5px;">GPT-Assessed from Transcripts (0–100)</div>
        <div style="font-size:10px;color:#374151;line-height:1.8;">
          <div>Application: ${sc(s.ai_prof_application_gpt)} &nbsp; Ethics: ${sc(s.ai_prof_ethics_gpt)}</div>
          <div>Understanding: ${sc(s.ai_prof_understanding_gpt)} &nbsp; Verification: ${sc(s.ai_prof_verification_gpt)}</div>
        </div>
      </div>
    </div>
    ${s.ai_prof_gpt_narrative ? `<div style="font-size:10px;color:#5a7060;font-style:italic;line-height:1.4;">${s.ai_prof_gpt_narrative}</div>` : ""}
  </div>

  <!-- Certification Summary Panel -->
  <div style="border-top:1px solid #d0e8d8;background:#fffef5;padding:13px 16px;">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
      <span style="font-size:13px;">🏆</span>
      <div style="font-size:11px;font-weight:600;color:#1a3d2b;">Certifications</div>
      <span style="margin-left:auto;font-size:10px;color:#6b7280;">${s.cert_attempted_count || 0} attempted · ${s.cert_passed_count || 0} passed${s.cert_avg_score != null ? ` · avg ${s.cert_avg_score}/3` : ""}</span>
    </div>
    ${(s.cert_names_passed?.length ?? 0) > 0 ? `
    <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px;">
      ${(s.cert_names_passed || []).map((n) =>
        `<span style="background:#dcfce7;color:#166534;padding:2px 8px;border-radius:12px;font-size:10px;font-weight:600;">✅ ${n}</span>`
      ).join("")}
    </div>` : `<div style="font-size:10px;color:#9ca3af;margin-bottom:4px;">No certifications passed yet</div>`}
    ${(s.cert_names_attempted?.length ?? 0) > 0 && (s.cert_passed_count || 0) < (s.cert_attempted_count || 0) ? `
    <div style="font-size:10px;color:#6b7280;margin-bottom:4px;">Also attempted: ${(s.cert_names_attempted || []).filter((n) => !(s.cert_names_passed || []).includes(n)).join(", ")}</div>` : ""}
    ${s.cert_summary && s.cert_summary !== "No certifications attempted yet." ? `<div style="font-size:10px;color:#374151;font-style:italic;line-height:1.4;">${s.cert_summary}</div>` : ""}
  </div>

  <!-- Community Impact Panel -->
  ${(() => {
    const ciTracks: Record<string, string> = {
      ai_ambassadors: "AI Ambassadors",
      agriculture_consultant: "Agriculture",
      fishing_consultant: "Fishing",
      healthcare_navigator: "Healthcare",
      entrepreneurship_consultant: "Entrepreneurship",
    };
    const hasCI = (s.ci_training_sessions_total || 0) > 0 || Object.keys(s.ci_cert_by_track || {}).length > 0;
    if (!hasCI) return `<div style="border-top:1px solid #e5e7eb;background:#fafafa;padding:9px 16px;"><span style="font-size:10px;color:#9ca3af;">🌍 Community Impact: No training activity this period.</span></div>`;

    const trackRows = Object.entries(ciTracks).map(([key, label]) => {
      const sessions = s.ci_training_sessions_by_track?.[key] || 0;
      const ev = s.ci_training_eval_by_track?.[key];
      const cert = s.ci_cert_by_track?.[key];
      if (sessions === 0 && !cert) return "";
      const evalStr = ev ? `avg ${ev.avg_overall}/3 · best ${ev.best_score}/3 · ${ev.eval_count} eval${ev.eval_count !== 1 ? "s" : ""}` : sessions > 0 ? "no eval yet" : "";
      const certBadge = cert
        ? cert.passed
          ? `<span style="background:#dcfce7;color:#166534;padding:1px 6px;border-radius:8px;font-size:10px;font-weight:700;margin-left:6px;">✅ CERT PASSED ${cert.overall_score !== null ? cert.overall_score + "/3" : ""}</span>`
          : `<span style="background:#fee2e2;color:#991b1b;padding:1px 6px;border-radius:8px;font-size:10px;font-weight:600;margin-left:6px;">cert: ${cert.overall_score !== null ? cert.overall_score + "/3" : "attempted"}</span>`
        : "";
      const dimStr = cert?.scores && Object.keys(cert.scores).length > 0
        ? `<div style="font-size:9px;color:#6b7280;margin-top:2px;padding-left:10px;">${Object.entries(cert.scores).map(([k, v]) => `${k.split(" ").slice(-1)[0]}: ${v}/3`).join(" · ")}</div>`
        : "";
      return `<div style="padding:5px 0;border-bottom:1px solid #f0faf3;display:flex;align-items:flex-start;gap:6px;flex-wrap:wrap;">
        <span style="font-size:10px;font-weight:600;color:#1a3d2b;min-width:120px;">${label}</span>
        <span style="font-size:10px;color:#374151;">${sessions > 0 ? `${sessions} session${sessions !== 1 ? "s" : ""}${evalStr ? " · " + evalStr : ""}` : ""}${certBadge}</span>
        ${dimStr}
      </div>`;
    }).filter(Boolean).join("");

    return `<div style="border-top:1px solid #d0e8d8;background:#f0faf3;padding:13px 16px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
        <span style="font-size:13px;">🌍</span>
        <div style="font-size:11px;font-weight:600;color:#065f46;">Community Impact Training &amp; Certification</div>
        <span style="margin-left:auto;font-size:10px;color:#6b7280;">${s.ci_training_sessions_total || 0} sessions · ${s.ci_tracks_active_count || 0} track${(s.ci_tracks_active_count || 0) !== 1 ? "s" : ""} · ${s.ci_certs_passed_count || 0} cert${(s.ci_certs_passed_count || 0) !== 1 ? "s" : ""} passed</span>
      </div>
      ${trackRows}
      ${s.ci_summary ? `<div style="margin-top:8px;font-size:10px;color:#374151;font-style:italic;line-height:1.5;background:#e6f7ef;padding:7px 10px;border-radius:6px;">${s.ci_summary}</div>` : ""}
    </div>`;
  })()}

  ${playground && playground.hasMeaningfulActivity ? `
  <div style="border-top:2px solid #fde68a;background:#fffdf0;padding:13px 16px;">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
      <span style="font-size:14px;">🎮</span>
      <div style="font-size:11px;font-weight:700;color:#92400e;">AI Playground — Free-Form Usage</div>
      <span style="margin-left:auto;font-size:10px;color:#92400e;opacity:0.7;">${playground.sessionCount} session${playground.sessionCount !== 1 ? "s" : ""} · ${playground.totalWords.toLocaleString()} learner words</span>
    </div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:10px;">
      <div style="background:#fff;border:1px solid #fde68a;border-radius:8px;padding:8px 12px;text-align:center;min-width:80px;">
        <div style="font-size:20px;font-weight:700;color:${playground.pueSessionCount > 0 ? "#065f46" : "#9ca3af"};">${playground.pueSessionCount}</div>
        <div style="font-size:9px;color:#6b7280;text-transform:uppercase;letter-spacing:0.8px;font-weight:600;">PUE Sessions</div>
      </div>
      <div style="background:#fff;border:1px solid #fde68a;border-radius:8px;padding:8px 12px;text-align:center;min-width:80px;">
        <div style="font-size:20px;font-weight:700;color:${playground.entrepreneurshipCount > 0 ? "#7c3aed" : "#9ca3af"};">${playground.entrepreneurshipCount}</div>
        <div style="font-size:9px;color:#6b7280;text-transform:uppercase;letter-spacing:0.8px;font-weight:600;">Enterprise Sessions</div>
      </div>
      <div style="flex:1;min-width:160px;">
        <div style="font-size:10px;font-weight:600;color:#374151;margin-bottom:5px;">Topics Explored</div>
        <div style="display:flex;flex-wrap:wrap;gap:4px;">
          ${playground.topTopics.map((t) => `<span style="background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:12px;font-size:10px;font-weight:500;">${t}</span>`).join("")}
        </div>
      </div>
    </div>
    ${(s.ai_playground_summary && s.ai_playground_summary !== "No AI Playground activity recorded this period.") ? `<div style="font-size:11px;color:#374151;line-height:1.6;margin-bottom:8px;font-style:italic;background:#fffbeb;padding:8px 10px;border-radius:6px;">${s.ai_playground_summary}</div>` : playground.narrative ? `<div style="font-size:11px;color:#374151;line-height:1.6;margin-bottom:8px;">${playground.narrative}</div>` : ""}
    ${playground.pueHighlights?.length ? `
    <div style="font-size:10px;font-weight:700;color:#065f46;margin-bottom:5px;text-transform:uppercase;letter-spacing:0.8px;">PUE &amp; Entrepreneurship Highlights</div>
    ${playground.pueHighlights.map((q) =>
      `<div style="padding:5px 10px;border-left:3px solid #f0c040;background:#fffbeb;border-radius:0 6px 6px 0;font-size:11px;color:#374151;font-style:italic;margin-bottom:4px;">"${q}"</div>`
    ).join("")}` : ""}
  </div>` : `
  <div style="border-top:1px solid #e5e7eb;background:#fafafa;padding:9px 16px;">
    <span style="font-size:10px;color:#9ca3af;">🎮 AI Playground: ${playground ? `${playground.sessionCount} session${playground.sessionCount !== 1 ? "s" : ""} recorded — too brief to summarise.` : "No sessions this period."}</span>
  </div>`}

</div>`;
}

function buildEmailHtml(
  monthLabel: string,
  oloibiriSummaries: AssessmentSummary[],
  ibiadeSummaries: AssessmentSummary[],
  historyMap: Map<string, HistoricalRecord[]>,
  playgroundMap: Map<string, PlaygroundSummary | null>,
  profileCityMap: Record<string, string>,
  cohortHistory: CohortMonthRecord[],
  durationMs: number
): string {
  // Helper to build one cohort's section HTML
  function buildCohortSection(
    summaries: AssessmentSummary[],
    city: string,
    label: string,
    institution: string
  ): string {
    const successes = summaries.filter((s) => s.status === "success");
    const totalSessions = summaries.reduce((a, s) => a + (s.sessionCount || 0), 0);
    const cohortAvg = (key: keyof MonthlySkillsResult) =>
      successes.length ? Math.round(successes.reduce((a, s) => a + ((s.scores?.[key] as number) || 0), 0) / successes.length) : 0;
    const converging = successes.filter((s) => s.scores?.scaffold_convergence_trend === "converging").length;
    const roleReady  = successes.filter((s) => (s.scores?.role_teaching_intent_count || 0) + (s.scores?.role_enterprise_orientation_count || 0) > 0).length;
    const playgroundActive = [...playgroundMap.entries()]
      .filter(([id]) => (profileCityMap[id] ?? "Oloibiri") === city)
      .filter(([, p]) => p && p.hasMeaningfulActivity).length;

    const userCards = summaries
      .filter((s) => s.status === "success")
      .sort((a, b) => (historyMap.get(b.userId) || []).length - (historyMap.get(a.userId) || []).length)
      .map((s) => buildUserCard(s, historyMap.get(s.userId) || [], playgroundMap.get(s.userId) || null))
      .join("");

    // Playground summary for this cohort
    const pgEntries = [...playgroundMap.entries()]
      .filter(([id]) => (profileCityMap[id] ?? "Oloibiri") === city)
      .map(([, p]) => p)
      .filter((p): p is PlaygroundSummary => p !== null && p.hasMeaningfulActivity);

    const topicFreq: Record<string, number> = {};
    for (const pg of pgEntries) {
      for (const t of pg.topTopics) {
        const k = t.toLowerCase().trim();
        topicFreq[k] = (topicFreq[k] || 0) + 1;
      }
    }
    const sortedTopics = Object.entries(topicFreq).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const totalPgSessions  = pgEntries.reduce((a, p) => a + p.sessionCount, 0);
    const totalPgWords     = pgEntries.reduce((a, p) => a + p.totalWords, 0);
    const totalPueSessions = pgEntries.reduce((a, p) => a + p.pueSessionCount, 0);
    const totalEntSessions = pgEntries.reduce((a, p) => a + p.entrepreneurshipCount, 0);
    const allPueHighlights: Array<{ name: string; quote: string }> = [];
    for (const s of summaries.filter((x) => x.status === "success")) {
      const pg = playgroundMap.get(s.userId);
      if (pg?.pueHighlights?.length) allPueHighlights.push({ name: s.name, quote: pg.pueHighlights[0] });
    }
    const featuredHighlights = allPueHighlights.slice(0, 4);

    const bgGrad = city === "Ibiade"
      ? "linear-gradient(135deg,#1a3d5c 0%,#1d6a8f 100%)"
      : "linear-gradient(135deg,#1a3d2b 0%,#2d6a4f 100%)";
    const accentColor = city === "Ibiade" ? "#52b0d0" : "#52b788";
    const chipBg1 = city === "Ibiade" ? "#dbeafe" : "#dcfce7";
    const chipColor1 = city === "Ibiade" ? "#1e3a8a" : "#166534";

    return `
  <!-- ── ${label} Cohort Section ── -->
  <div style="margin-bottom:32px;">
    <div style="background:${bgGrad};padding:20px 28px;border-radius:12px 12px 0 0;">
      <div style="font-size:10px;letter-spacing:2.5px;text-transform:uppercase;color:${accentColor};margin-bottom:5px;font-weight:600;">${institution}</div>
      <div style="font-size:18px;font-weight:800;color:#fff;">${label} — ${monthLabel}</div>
      <div style="font-size:11px;color:rgba(255,255,255,0.5);margin-top:2px;">${summaries.length} learner${summaries.length !== 1 ? "s" : ""} with history · ${successes.length} assessed this period</div>
    </div>

    <div style="border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;padding:18px 20px;">
      <!-- Stat chips -->
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px;">
        ${[
          ["✅", "Assessed", successes.length, chipBg1, chipColor1],
          ["📊", "Sessions", totalSessions, "#dbeafe", "#1e40af"],
          ["⚡", "PUE Learner %", `${cohortAvg("pue_learner_initiated_pct")}%`, "#fef3c7", "#92400e"],
          ["🔧", "Converging", converging, "#e0f2fe", "#0369a1"],
          ["🌍", "Role-Ready", roleReady, "#f3e8ff", "#6b21a8"],
          ["🎮", "Playground", playgroundActive, "#fef9c3", "#92400e"],
        ].map(([icon, lbl, val, bg, color]) => `
        <div style="flex:1;min-width:90px;background:${bg};border-radius:8px;padding:10px;text-align:center;">
          <div style="font-size:13px;margin-bottom:2px;">${icon}</div>
          <div style="font-size:17px;font-weight:700;color:${color};">${val}</div>
          <div style="font-size:8px;color:${color};font-weight:600;text-transform:uppercase;letter-spacing:0.8px;">${lbl}</div>
        </div>`).join("")}
      </div>

      ${pgEntries.length > 0 ? `
      <!-- Playground summary for this cohort -->
      <div style="background:#fffdf0;border:2px solid #fde68a;border-radius:10px;padding:14px 16px;margin-bottom:18px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
          <span style="font-size:14px;">🎮</span>
          <div style="font-size:12px;font-weight:700;color:#92400e;">AI Playground — ${label}</div>
          <span style="margin-left:auto;font-size:10px;color:#92400e;opacity:0.7;">${pgEntries.length} active · ${totalPgSessions} sessions · ${totalPgWords.toLocaleString()} words</span>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;">
          <div style="background:#fff;border:1px solid #fde68a;border-radius:6px;padding:8px 12px;text-align:center;min-width:75px;">
            <div style="font-size:18px;font-weight:700;color:${totalPueSessions > 0 ? "#065f46" : "#9ca3af"};">${totalPueSessions}</div>
            <div style="font-size:8px;color:#6b7280;text-transform:uppercase;letter-spacing:0.8px;font-weight:600;">PUE Sessions</div>
          </div>
          <div style="background:#fff;border:1px solid #fde68a;border-radius:6px;padding:8px 12px;text-align:center;min-width:75px;">
            <div style="font-size:18px;font-weight:700;color:${totalEntSessions > 0 ? "#7c3aed" : "#9ca3af"};">${totalEntSessions}</div>
            <div style="font-size:8px;color:#6b7280;text-transform:uppercase;letter-spacing:0.8px;font-weight:600;">Enterprise</div>
          </div>
          <div style="flex:1;min-width:160px;">
            <div style="font-size:9px;font-weight:600;color:#374151;margin-bottom:4px;">Top Topics</div>
            <div style="display:flex;flex-wrap:wrap;gap:4px;">
              ${sortedTopics.map(([topic, count]) =>
                `<span style="background:#fef3c7;color:#92400e;padding:2px 7px;border-radius:10px;font-size:9px;font-weight:500;">${topic} <span style="opacity:0.6;">(${count})</span></span>`
              ).join("")}
            </div>
          </div>
        </div>
        ${featuredHighlights.length ? `
        <div style="font-size:9px;font-weight:700;color:#065f46;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.8px;">PUE Highlights</div>
        ${featuredHighlights.map(({ name, quote }) =>
          `<div style="display:flex;gap:6px;margin-bottom:4px;align-items:flex-start;">
            <span style="font-size:9px;font-weight:600;color:#92400e;white-space:nowrap;padding-top:1px;">${name.split(" ")[0]}:</span>
            <div style="padding:3px 8px;border-left:3px solid #f0c040;background:#fffbeb;border-radius:0 4px 4px 0;font-size:10px;color:#374151;font-style:italic;flex:1;">"${quote}"</div>
          </div>`
        ).join("")}` : ""}
      </div>` : ""}

      <!-- Individual learner cards -->
      <div style="font-size:12px;font-weight:600;color:#1a3d2b;margin-bottom:10px;">Individual Learner Progress — Longitudinal View</div>
      ${userCards || `<div style="background:#fef9c3;border-radius:8px;padding:14px;color:#854d0e;font-size:12px;">No new assessments this period for ${label}.</div>`}
    </div>
  </div>`;
  } // end buildCohortSection

  const oloibiriHtml = buildCohortSection(oloibiriSummaries, "Oloibiri", "Oloibiri", "Davidson AI Innovation Center · Oloibiri, Bayelsa");
  const ibiadeHtml   = buildCohortSection(ibiadeSummaries,   "Ibiade",   "Ibiade",   "Solardero Foundation · Ibiade, Ogun State");

  const totalAssessed = [...oloibiriSummaries, ...ibiadeSummaries].filter((s) => s.status === "success").length;
  const totalSessions = [...oloibiriSummaries, ...ibiadeSummaries].reduce((a, s) => a + (s.sessionCount || 0), 0);

  // Combined average across both cohorts — used in outer PUE linkage summary
  const allSuccesses = [...oloibiriSummaries, ...ibiadeSummaries].filter((s) => s.status === "success");
  const allAvg = (key: keyof MonthlySkillsResult) =>
    allSuccesses.length ? Math.round(allSuccesses.reduce((a, s) => a + ((s.scores?.[key] as number) || 0), 0) / allSuccesses.length) : 0;

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f2f8f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<div style="max-width:780px;margin:20px auto;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

  <!-- ── Master header ── -->
  <div style="background:linear-gradient(135deg,#0d1b14 0%,#1a3d2b 60%,#1a3d5c 100%);padding:28px 32px;">
    <div style="font-size:10px;letter-spacing:2.5px;text-transform:uppercase;color:#52b788;margin-bottom:6px;font-weight:600;">
      Girls AIing &amp; Vibing · Oloibiri (Davidson AI) &amp; Ibiade (Solardero)
    </div>
    <div style="font-size:24px;font-weight:800;color:#fff;margin-bottom:3px;">Monthly Assessment Report</div>
    <div style="font-size:12px;color:rgba(255,255,255,0.5);">${monthLabel} · PUE Linkage + Longitudinal Analysis · v2.1</div>
    <div style="display:flex;gap:16px;margin-top:12px;flex-wrap:wrap;">
      <div style="background:rgba(255,255,255,0.1);border-radius:8px;padding:8px 14px;text-align:center;">
        <div style="font-size:20px;font-weight:700;color:#fff;">${totalAssessed}</div>
        <div style="font-size:9px;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:0.8px;">Assessed</div>
      </div>
      <div style="background:rgba(255,255,255,0.1);border-radius:8px;padding:8px 14px;text-align:center;">
        <div style="font-size:20px;font-weight:700;color:#fff;">${totalSessions}</div>
        <div style="font-size:9px;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:0.8px;">Total Sessions</div>
      </div>
      <div style="background:rgba(82,183,136,0.25);border-radius:8px;padding:8px 14px;text-align:center;">
        <div style="font-size:20px;font-weight:700;color:#52b788;">${oloibiriSummaries.length}</div>
        <div style="font-size:9px;color:#52b788;text-transform:uppercase;letter-spacing:0.8px;">Oloibiri</div>
      </div>
      <div style="background:rgba(82,176,208,0.25);border-radius:8px;padding:8px 14px;text-align:center;">
        <div style="font-size:20px;font-weight:700;color:#52b0d0;">${ibiadeSummaries.length}</div>
        <div style="font-size:9px;color:#52b0d0;text-transform:uppercase;letter-spacing:0.8px;">Ibiade</div>
      </div>
    </div>
  </div>

  <div style="padding:24px 32px;">

    <!-- Column Key -->
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;margin-bottom:24px;">
      <div style="font-size:10px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">Column Key</div>
      <div style="display:flex;flex-wrap:wrap;gap:8px 20px;font-size:11px;color:#374151;">
        <div><strong style="color:#1a3d2b;">COG</strong> — Cognitive</div>
        <div><strong style="color:#1a3d2b;">CT</strong> — Critical Thinking</div>
        <div><strong style="color:#1a3d2b;">PS</strong> — Problem Solving</div>
        <div><strong style="color:#1a3d2b;">CRE</strong> — Creativity</div>
        <div><strong style="color:#1a3d2b;">PUE</strong> — Productive Use of Energy</div>
        <div><strong style="color:#6b21a8;">App / Eth / Und / Ver</strong> — AI Proficiency (GPT, 0–100)</div>
        <div><strong style="color:#92400e;">Certs</strong> — Certifications passed (all-time)</div>
      </div>
      <div style="margin-top:8px;font-size:10px;color:#6b7280;">
        <span style="background:#bbf7d0;color:#14532d;padding:1px 6px;border-radius:3px;font-weight:600;">≥75 Strong</span> &nbsp;
        <span style="background:#bfdbfe;color:#1e40af;padding:1px 6px;border-radius:3px;font-weight:600;">55–74 Developing</span> &nbsp;
        <span style="background:#fef08a;color:#713f12;padding:1px 6px;border-radius:3px;font-weight:600;">35–54 Emerging</span> &nbsp;
        <span style="background:#fecaca;color:#7f1d1d;padding:1px 6px;border-radius:3px;font-weight:600;">&lt;35 Needs Support</span>
      </div>
    </div>

    <!-- ── Longitudinal cohort averages (combined) ── -->
    <div style="margin-bottom:24px;">
      <div style="font-size:13px;font-weight:600;color:#1a3d2b;margin-bottom:4px;">Combined Cohort Skill Averages — Longitudinal</div>
      <div style="font-size:10px;color:#6b7280;margin-bottom:12px;">All months · cohort mean across both sites · ● = ${monthLabel}</div>
      <div style="overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;font-size:11px;min-width:560px;">
        <thead>
          <tr style="background:#1a3d2b;">
            <th style="padding:8px 10px;text-align:left;color:#a7f3d0;font-weight:600;font-size:9px;text-transform:uppercase;letter-spacing:0.8px;white-space:nowrap;">Period</th>
            <th style="padding:8px 10px;text-align:center;color:#a7f3d0;font-weight:600;font-size:9px;text-transform:uppercase;letter-spacing:0.8px;">N</th>
            <th style="padding:8px 10px;text-align:center;color:#a7f3d0;font-weight:600;font-size:9px;text-transform:uppercase;letter-spacing:0.8px;">Cog</th>
            <th style="padding:8px 10px;text-align:center;color:#a7f3d0;font-weight:600;font-size:9px;text-transform:uppercase;letter-spacing:0.8px;">CT</th>
            <th style="padding:8px 10px;text-align:center;color:#a7f3d0;font-weight:600;font-size:9px;text-transform:uppercase;letter-spacing:0.8px;">PS</th>
            <th style="padding:8px 10px;text-align:center;color:#a7f3d0;font-weight:600;font-size:9px;text-transform:uppercase;letter-spacing:0.8px;">Cre</th>
            <th style="padding:8px 10px;text-align:center;color:#a7f3d0;font-weight:600;font-size:9px;text-transform:uppercase;letter-spacing:0.8px;">PUE</th>
            <th style="padding:8px 10px;text-align:center;color:#a7f3d0;font-weight:600;font-size:9px;text-transform:uppercase;letter-spacing:0.8px;">Avg</th>
            <th style="padding:8px 10px;text-align:center;color:#c4b5fd;font-weight:600;font-size:9px;text-transform:uppercase;letter-spacing:0.8px;">App</th>
            <th style="padding:8px 10px;text-align:center;color:#c4b5fd;font-weight:600;font-size:9px;text-transform:uppercase;letter-spacing:0.8px;">Eth</th>
            <th style="padding:8px 10px;text-align:center;color:#c4b5fd;font-weight:600;font-size:9px;text-transform:uppercase;letter-spacing:0.8px;">Und</th>
            <th style="padding:8px 10px;text-align:center;color:#c4b5fd;font-weight:600;font-size:9px;text-transform:uppercase;letter-spacing:0.8px;">Ver</th>
            <th style="padding:8px 10px;text-align:center;color:#fde68a;font-weight:600;font-size:9px;text-transform:uppercase;letter-spacing:0.8px;">Certs</th>
          </tr>
        </thead>
        <tbody>
          ${cohortHistory.map((row, i) => {
            const isLatest = i === cohortHistory.length - 1;
            const rowAvg = Math.round((row.cognitive_score + row.critical_thinking_score + row.problem_solving_score + row.creativity_score + row.pue_score) / 5);
            // Trend arrow vs previous month
            let trend = "";
            if (i > 0) {
              const prev = cohortHistory[i - 1];
              const prevAvg = Math.round((prev.cognitive_score + prev.critical_thinking_score + prev.problem_solving_score + prev.creativity_score + prev.pue_score) / 5);
              const diff = rowAvg - prevAvg;
              if (diff > 0) trend = `<span style="color:#166534;font-size:9px;"> ▲${diff}</span>`;
              else if (diff < 0) trend = `<span style="color:#991b1b;font-size:9px;"> ▼${Math.abs(diff)}</span>`;
            }
            return `<tr style="${isLatest ? "background:rgba(82,183,136,0.08);font-weight:600;" : i % 2 === 0 ? "background:#fff;" : "background:#f8fafc;"}border-top:1px solid #e5e7eb;">
              <td style="padding:8px 10px;font-family:monospace;font-size:11px;color:${isLatest ? "#1a3d2b" : "#6b7280"};white-space:nowrap;">${isLatest ? "● " : ""}${row.monthLabel}</td>
              <td style="padding:8px 10px;text-align:center;font-size:11px;color:#6b7280;">${row.learnerCount}</td>
              <td style="padding:8px 10px;text-align:center;">${sc(row.cognitive_score)}</td>
              <td style="padding:8px 10px;text-align:center;">${sc(row.critical_thinking_score)}</td>
              <td style="padding:8px 10px;text-align:center;">${sc(row.problem_solving_score)}</td>
              <td style="padding:8px 10px;text-align:center;">${sc(row.creativity_score)}</td>
              <td style="padding:8px 10px;text-align:center;">${sc(row.pue_score)}</td>
              <td style="padding:8px 10px;text-align:center;">${sc(rowAvg)}${trend}</td>
              <td style="padding:8px 10px;text-align:center;font-family:monospace;font-size:11px;color:#374151;">${row.pue_energy_constraint_pct}%</td>
              <td style="padding:8px 10px;text-align:center;font-family:monospace;font-size:11px;color:${row.pue_learner_initiated_pct >= 20 ? "#065f46" : "#374151"};">${row.pue_learner_initiated_pct}%</td>
              <td style="padding:8px 10px;text-align:center;">${sc(row.ai_prof_application_gpt)}</td>
              <td style="padding:8px 10px;text-align:center;">${sc(row.ai_prof_ethics_gpt)}</td>
              <td style="padding:8px 10px;text-align:center;">${sc(row.ai_prof_understanding_gpt)}</td>
              <td style="padding:8px 10px;text-align:center;">${sc(row.ai_prof_verification_gpt)}</td>
              <td style="padding:8px 10px;text-align:center;font-family:monospace;font-size:11px;color:${row.cert_passed_pct > 0 ? "#166534" : "#9ca3af"};">${row.cert_passed_pct}%</td>
            </tr>`;
          }).join("")}
          ${cohortHistory.length > 1 ? (() => {
            // All-time aggregate row
            const n = cohortHistory.length;
            const allAvg = (field: keyof CohortMonthRecord) =>
              Math.round(cohortHistory.reduce((a, r) => a + (Number(r[field]) || 0), 0) / n);
            const overallAvg = Math.round((allAvg("cognitive_score") + allAvg("critical_thinking_score") + allAvg("problem_solving_score") + allAvg("creativity_score") + allAvg("pue_score")) / 5);
            const totalLearners = Math.max(...cohortHistory.map(r => r.learnerCount));
            return `<tr style="background:#1a3d2b;border-top:2px solid #2d6a4f;">
              <td style="padding:8px 10px;font-size:11px;font-weight:700;color:#a7f3d0;white-space:nowrap;">All-Time Avg</td>
              <td style="padding:8px 10px;text-align:center;font-size:11px;color:#52b788;">${totalLearners}</td>
              <td style="padding:8px 10px;text-align:center;">${sc(allAvg("cognitive_score"))}</td>
              <td style="padding:8px 10px;text-align:center;">${sc(allAvg("critical_thinking_score"))}</td>
              <td style="padding:8px 10px;text-align:center;">${sc(allAvg("problem_solving_score"))}</td>
              <td style="padding:8px 10px;text-align:center;">${sc(allAvg("creativity_score"))}</td>
              <td style="padding:8px 10px;text-align:center;">${sc(allAvg("pue_score"))}</td>
              <td style="padding:8px 10px;text-align:center;">${sc(overallAvg)}</td>
              <td style="padding:8px 10px;text-align:center;font-family:monospace;font-size:11px;color:#52b788;">${allAvg("pue_energy_constraint_pct")}%</td>
              <td style="padding:8px 10px;text-align:center;font-family:monospace;font-size:11px;color:#52b788;">${allAvg("pue_learner_initiated_pct")}%</td>
              <td style="padding:8px 10px;text-align:center;">${sc(allAvg("ai_prof_application_gpt"))}</td>
              <td style="padding:8px 10px;text-align:center;">${sc(allAvg("ai_prof_ethics_gpt"))}</td>
              <td style="padding:8px 10px;text-align:center;">${sc(allAvg("ai_prof_understanding_gpt"))}</td>
              <td style="padding:8px 10px;text-align:center;">${sc(allAvg("ai_prof_verification_gpt"))}</td>
              <td style="padding:8px 10px;text-align:center;font-family:monospace;font-size:11px;color:#fde68a;font-weight:700;">${cohortHistory.reduce((a, r) => a + (r.cert_passed_pct || 0), 0)}</td>
            </tr>`;
          })() : ""}
        </tbody>
      </table>
      </div>
    </div>

    <div style="background:#f0fff4;border:1px solid #a7f3d0;border-radius:10px;padding:16px;margin-bottom:24px;">
      <div style="font-size:12px;font-weight:600;color:#065f46;margin-bottom:8px;">⚡ Cohort PUE Linkage — ${monthLabel}</div>
      <div style="display:flex;gap:20px;flex-wrap:wrap;font-size:11px;color:#374151;line-height:1.8;">
        <div>🔋 Energy Constraint: <strong>${allAvg("pue_energy_constraint_pct")}%</strong></div>
        <div>📈 Market Pricing: <strong>${allAvg("pue_market_pricing_pct")}%</strong></div>
        <div>🏪 Enterprise Planning: <strong>${allAvg("pue_enterprise_planning_pct")}%</strong></div>
        <div>🗣 Learner-Initiated: <strong>${allAvg("pue_learner_initiated_pct")}%</strong></div>
        <div>🤖 AI-Introduced: <strong>${allAvg("pue_ai_introduced_pct")}%</strong></div>
        <div>🌐 Multi-Domain: <strong>${allAvg("pue_multi_domain_pct")}%</strong></div>
        <div>📍 Local Context: <strong>${allAvg("pue_local_context_pct")}%</strong></div>
      </div>
    </div>

    <!-- ── Cohort Playground Summary ───────────────────────────────── -->
    <!-- ── Oloibiri Cohort ── -->
    ${oloibiriHtml}

    <!-- ── Ibiade Cohort ── -->
    ${ibiadeHtml}

    <div style="border-top:1px solid #e5e7eb;padding-top:16px;color:#9ca3af;font-size:11px;">
      <div>⏱️ ${(durationMs/1000).toFixed(1)}s &nbsp;·&nbsp; 🤖 GPT-4o v2.1 &nbsp;·&nbsp; 🌍 Oloibiri + Ibiade &nbsp;·&nbsp;
        <a href="https://girls-aiing-and-vibing.vercel.app" style="color:#2d6a4f;text-decoration:none;">Open App ↗</a></div>
      <div style="margin-top:3px;">v2.1: separate Oloibiri (Davidson AI) and Ibiade (Solardero) cohorts derived from profiles.city. Captures PUE domain linkage, scaffolding convergence, reasoning levels, metacognition, role readiness, enterprise artifacts, AI Proficiency (formal + GPT), certifications, and Community Impact.</div>
    </div>
  </div>
</div>
</body></html>`;
}

// ─── Email Sender ─────────────────────────────────────────────────────────────

async function sendEmailReport(
  monthLabel: string,
  summaries: AssessmentSummary[],
  startDate: Date,
  endDate: Date,
  durationMs: number
): Promise<void> {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) { console.warn("⚠️  RESEND_API_KEY not set"); return; }

  // Fetch all Africa profiles with city so we can route each user to their cohort
  const { data: africanProfiles } = await supabase
    .from("profiles").select("id, name, city").eq("continent", "Africa");

  const nameMap: Record<string, string> = {};
  const profileCityMap: Record<string, string> = {};
  for (const p of africanProfiles || []) {
    nameMap[p.id] = p.name || "Unknown";
    profileCityMap[p.id] = p.city === "Ibiade" ? "Ibiade" : "Oloibiri";
  }
  const allIds = (africanProfiles || []).map((p) => p.id);

  const { data: anyAssessments } = await supabase
    .from("user_monthly_assessments").select("user_id").in("user_id", allIds);
  const idsWithHistory = [...new Set((anyAssessments || []).map((a) => a.user_id))]
    .filter((id) => !EXCLUDED_USER_IDS.has(id)) as string[];
  const historyMap = await fetchAllHistoricalData(idsWithHistory);

  const summaryMap = new Map(summaries.map((s) => [s.userId, s]));
  const allSummaries: AssessmentSummary[] = idsWithHistory.map((id) => {
    if (summaryMap.has(id)) { const s = summaryMap.get(id)!; s.name = nameMap[id] || "Unknown"; return s; }
    return { userId: id, name: nameMap[id] || "Unknown", sessionCount: 0, engagedSessionCount: 0, scores: null, status: "skipped" };
  });

  const newCount = summaries.filter((s) => s.status === "success").length;

  // Fetch playground summaries — pass each user's city for context-aware GPT prompts
  const playgroundMap = new Map<string, PlaygroundSummary | null>();
  const assessedIds = allSummaries.filter((s) => s.status === "success").map((s) => s.userId);
  await Promise.all(
    assessedIds.map(async (id) => {
      const city = profileCityMap[id] ?? "Oloibiri";
      const pg = await fetchPlaygroundSummary(id, startDate, endDate, city);
      playgroundMap.set(id, pg);
    })
  );

  // Fetch all-time cohort history for the longitudinal averages table
  let cohortHistory: CohortMonthRecord[] = [];
  try {
    cohortHistory = await fetchCohortHistory(EXCLUDED_USER_IDS);
    console.log(`   Cohort history: ${cohortHistory.length} months loaded`);
  } catch (err: any) {
    console.warn("   Cohort history fetch failed (non-fatal):", err.message);
  }

  // Split summaries by city cohort for separate sections
  const oloibiriSummaries = allSummaries.filter((s) => (profileCityMap[s.userId] ?? "Oloibiri") === "Oloibiri");
  const ibiadeSummaries   = allSummaries.filter((s) => profileCityMap[s.userId] === "Ibiade");

  const html = buildEmailHtml(
    monthLabel,
    oloibiriSummaries,
    ibiadeSummaries,
    historyMap,
    playgroundMap,
    profileCityMap,
    cohortHistory,
    durationMs
  );

  const totalLearners = idsWithHistory.length;
  const oloibiriCount = oloibiriSummaries.length;
  const ibiadeCount   = ibiadeSummaries.length;

  const emailRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Girls AIing & Vibing <onboarding@resend.dev>",
      to: ["khallinan1@udayton.edu"],
      subject: `📊 Monthly Report — ${monthLabel} · ${newCount} assessed · Oloibiri (${oloibiriCount}) + Ibiade (${ibiadeCount})`,
      html,
    }),
  });

  if (!emailRes.ok) console.error("❌ Resend error:", await emailRes.text());
  else console.log(`✉️  Email sent to khallinan1@udayton.edu (${totalLearners} learners total)`);
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const cronSecret = process.env.CRON_SECRET;
  const isVercelCron = req.headers["authorization"] === `Bearer ${cronSecret}`;
  const isManualTrigger = req.headers["x-cron-secret"] === cronSecret && !!cronSecret;
  if (!isVercelCron && !isManualTrigger) return res.status(401).json({ error: "Unauthorized" });

  const qStart = req.query.start as string | undefined;
  const qEnd = req.query.end as string | undefined;
  let startDate: Date, endDate: Date;

  if (qStart && qEnd) {
    startDate = new Date(`${qStart}T00:00:00.000Z`);
    endDate = new Date(`${qEnd}T23:59:59.999Z`);
  } else {
    const now = new Date();
    startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
  }

  const monthLabel = startDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  console.log(`\n${"═".repeat(60)}\nASSESSMENT v2.0 — ${monthLabel}\n${"═".repeat(60)}`);
  console.log(`ENV: RESEND=${process.env.RESEND_API_KEY?"✅":"❌"} OPENAI=${process.env.OPENAI_API_KEY?"✅":"❌"}`);

  const startTime = Date.now();
  try {
    const userEntries = await getAfricanUsersNeedingAssessment(startDate, endDate);
    console.log(`\n📋 Users to assess: ${userEntries.length}`);

    const userIds = userEntries.map((e) => e.userId);
    const { data: profiles } = await supabase.from("profiles").select("id, name").in("id", userIds);
    const nameMap: Record<string, string> = {};
    for (const p of profiles || []) nameMap[p.id] = p.name || "Unknown";

    const summaries: AssessmentSummary[] = [];
    for (let i = 0; i < userEntries.length; i++) {
      const { userId, city } = userEntries[i];
      const name = nameMap[userId] || userId.slice(0, 8) + "…";
      console.log(`\n[${i + 1}/${userEntries.length}] ${name} (${city})`);
      const { result, sessionCount, engagedSessionCount, status, error } =
        await assessMonthlySkills(userId, startDate, endDate, city);
      summaries.push({ userId, name, sessionCount, engagedSessionCount, scores: result, status, error });
      console.log(`   → ${status} | sessions: ${sessionCount} | engaged: ${engagedSessionCount}`);
      if (i < userEntries.length - 1) await new Promise((r) => setTimeout(r, 2000));
    }

    const durationMs = Date.now() - startTime;
    const successCount = summaries.filter((s) => s.status === "success").length;
    console.log(`\n✅ Done — ${successCount}/${userIds.length} in ${(durationMs/1000).toFixed(1)}s`);

    await sendEmailReport(monthLabel, summaries, startDate, endDate, durationMs);

    return res.status(200).json({
      month: monthLabel,
      period: `${startDate.toISOString().split("T")[0]} → ${endDate.toISOString().split("T")[0]}`,
      assessed: successCount,
      skipped: summaries.filter((s) => s.status === "skipped").length,
      noActivity: summaries.filter((s) => s.status === "no_activity").length,
      errors: summaries.filter((s) => s.status === "error").length,
      durationMs,
    });
  } catch (err: any) {
    console.error("❌ Fatal:", err.message);
    return res.status(500).json({ error: err.message });
  }
}