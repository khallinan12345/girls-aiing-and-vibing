/**
 * MONTHLY SKILLS ASSESSMENT v2.4 — Vercel Cron Handler
 * FIXES:
 * 1. Direct Anthropic API call (no internal /api/chat hop)
 * 2. Correct Anthropic response format (data.content[0].text)
 * 3. System message extracted to top-level param
 * 4. Empty chat_history filtered before no_activity check
 * 5. Correct engaged session counts passed to prompt
 * 6. offset + limit params to avoid 300s timeout on large cohorts
 */

import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import type { VercelRequest, VercelResponse } from "@vercel/node";

// ─── CONFIGURATION & EXCLUSIONS ─────────────────────────────────────────────

const EXCLUDED_USER_IDS = new Set([
  "0e738663-a70e-4fd3-9ba6-718c02e116c2", "8b3f70dc-e5d0-4eb0-af7d-ec6181968213",
  "5d5e0486-e768-4c5d-ba63-d1e4570a352d", "40e9daa6-7ec1-49a9-9be7-814a3d607d86",
  "73da14c1-e49a-4410-9390-6fe069fd7528", "f6157a9d-5ffd-4058-b0b3-af3ea897d876",
]);

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const resend = new Resend(process.env.RESEND_API_KEY);

// ─── ANTHROPIC DIRECT INTEGRATION ───────────────────────────────────────────

async function callClaudeChat(messages: any[]) {
  // Anthropic requires system as a top-level param, not inside messages
  const systemMessage = messages.find(m => m.role === "system");
  const userMessages = messages.filter(m => m.role !== "system");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5",
      max_tokens: 4000,
      temperature: 0.2,
      ...(systemMessage && { system: systemMessage.content }),
      messages: userMessages,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Anthropic API Error: ${JSON.stringify(errorData.error)}`);
  }

  const data = await response.json();
  return data.content[0].text;
}

// ─── PROMPT & CONTEXT LOGIC ──────────────────────────────────────────────────

function getCityContext(city: string) {
  if (city === "Ibiade") {
    return {
      name: "Ibiade",
      description: "a lagoon-side community in Ogun State...",
      localRefs: "Ibiade/Ogun/lagoon/mangrove/naira",
    };
  }
  return {
    name: "Oloibiri",
    description: "a rural community in Bayelsa State with a solar mini-grid...",
    localRefs: "Oloibiri/Bayelsa/village/Nigeria/naira",
  };
}

function buildAssessmentPrompt(
  transcript: string,
  engagedCount: number,
  pgTranscript: string,
  pgCount: number,
  city: string
) {
  const ctx = getCityContext(city);

  return `You are an expert educational data scientist and assessment analyst specializing in AI-mediated learning in emerging markets.
  
Your task is to conduct a deep longitudinal assessment of a learner based in ${ctx.name}, ${ctx.description}.

### EVALUATION CONTEXT
- **Community:** ${ctx.name}
- **Local Context:** ${ctx.description}
- **Keywords to Watch For:** ${ctx.localRefs}
- **Curriculum Sessions:** ${engagedCount}
- **Playground Sessions:** ${pgCount}

### THE DATA FOR ANALYSIS
---
CURRICULUM TRANSCRIPT:
${transcript}

PLAYGROUND TRANSCRIPT:
${pgTranscript}
---

### ASSESSMENT RUBRIC & DIMENSIONS

1. **Core Skills (0-10):** - cognitive_score: Bloom's Taxonomy level (Remembering to Creating).
   - critical_thinking_score: Evidence of questioning, skepticism, or logic.
   - problem_solving_score: Ability to define and resolve friction.
   - creativity_score: Novelty of ideas or prompt engineering.

2. **PUE (Productive Use of Energy) Analysis:**
   - pue_score (0-10): Alignment with local economic value (Solar, Agriculture, Small Business).
   - pue_summary: Narrative of how they link AI to local productivity.
   - PUE Domain Metrics (Binary 0/1): agriculture, cold_storage, e_mobility, processing, water_pumping, tailoring, hair_styling.
   - source_split: "learner_driven" vs "ai_suggested" percentage.

3. **Scaffolding & Metacognition:**
   - scaffold_convergence_trend: "improving", "stagnant", or "declining" based on how they use AI assistance.
   - reasoning_level_dist: Levels 0 (Surface) to 3 (Strategic).
   - metacog_markers: "verification", "reactive", or "strategic".
   - metacog_narrative: Observations on the learner's self-awareness of their learning process.

4. **Role Readiness & Peer Diffusion:**
   - role_readiness_signal: Does the learner sound like a potential mentor or lead?
   - peer_diffusion_signal: Mentions of sharing knowledge with others in ${ctx.name}.

5. **Enterprise Planning Artifact Rubric (0-18):**
   - Total score based on: Value Prop, Operations, Technical Feasibility, Local Integration, Scalability, and Sustainability.

6. **Narrative Summaries:**
   - ai_prof_gpt_narrative: A technical summary of their AI proficiency.
   - role_readiness_narrative: Specific evidence of leadership potential.

### OUTPUT INSTRUCTIONS
- Respond ONLY with a single valid JSON object.
- DO NOT include markdown formatting (like \`\`\`json).
- Ensure all 25+ dimensions are present.
- Use the learner's local context (${ctx.name}) to ground your narrative assessments.

REQUIRED JSON STRUCTURE:
{
  "cognitive_score": number,
  "critical_thinking_score": number,
  "problem_solving_score": number,
  "creativity_score": number,
  "pue_score": number,
  "pue_summary": "string",
  "pue_metrics": {
    "agriculture": number,
    "cold_storage": number,
    "e_mobility": number,
    "processing": number,
    "water_pumping": number,
    "tailoring": number,
    "hair_styling": number
  },
  "pue_source_split": "string",
  "scaffold_convergence_trend": "string",
  "scaffold_narrative": "string",
  "reasoning_level_0": number,
  "reasoning_level_1": number,
  "reasoning_level_2": number,
  "reasoning_level_3": number,
  "metacog_markers": ["string"],
  "metacog_narrative": "string",
  "role_readiness_signal": number,
  "role_readiness_narrative": "string",
  "peer_diffusion_signal": number,
  "enterprise_planning_total": number,
  "ai_prof_gpt_narrative": "string"
}`;
}

// ─── CORE ASSESSMENT ENGINE ──────────────────────────────────────────────────

async function assessMonthlySkills(userId: string, startDate: Date, endDate: Date, city: string) {
  try {
    const { data: existing } = await supabase.from("user_monthly_assessments")
      .select("id").eq("user_id", userId)
      .gte("measured_at", startDate.toISOString()).lte("measured_at", endDate.toISOString()).single();

    if (existing) return { status: "skipped", sessionCount: 0, engagedSessionCount: 0 };

    const { data: dashboard } = await supabase.from("dashboard")
      .select("chat_history, created_at, activity").eq("user_id", userId)
      .gte("created_at", startDate.toISOString()).lte("created_at", endDate.toISOString());

    if (!dashboard || dashboard.length === 0) {
      return { status: "no_activity", sessionCount: 0, engagedSessionCount: 0 };
    }

    // Filter to only rows with real chat_history before the engaged check
    const isEngaged = (r: any) =>
      r.chat_history &&
      r.chat_history.trim() !== "" &&
      r.chat_history.trim() !== "[]" &&
      r.chat_history.trim() !== "null";

    const engagedCurriculumRows = dashboard.filter(d => d.activity !== "playground" && isEngaged(d));
    const engagedPlaygroundRows = dashboard.filter(d => d.activity === "playground" && isEngaged(d));

    if (engagedCurriculumRows.length === 0 && engagedPlaygroundRows.length === 0) {
      return { status: "no_activity", sessionCount: dashboard.length, engagedSessionCount: 0 };
    }

    const curriculumTranscripts = engagedCurriculumRows.map(d => d.chat_history).join("\n\n");
    const playgroundTranscripts = engagedPlaygroundRows.map(d => d.chat_history).join("\n\n");

    const rawResponse = await callClaudeChat([
      { role: "system", content: "You are an expert educational data scientist. You output ONLY valid JSON." },
      {
        role: "user",
        content: buildAssessmentPrompt(
          curriculumTranscripts, engagedCurriculumRows.length,
          playgroundTranscripts, engagedPlaygroundRows.length,
          city
        )
      }
    ]);

    const result = JSON.parse(rawResponse.replace(/```json/g, "").replace(/```/g, "").trim());

    const { error: upsertError } = await supabase.from("user_monthly_assessments").upsert({
      user_id: userId,
      measured_at: endDate.toISOString(),
      ...result,
      session_count: dashboard.length,
      engaged_session_count: engagedCurriculumRows.length + engagedPlaygroundRows.length,
    });

    if (upsertError) throw upsertError;

    return {
      status: "success",
      result,
      sessionCount: dashboard.length,
      engagedSessionCount: engagedCurriculumRows.length + engagedPlaygroundRows.length,
    };
  } catch (err: any) {
    console.error(`Error for ${userId}:`, err.message);
    return { status: "error", error: err.message, sessionCount: 0, engagedSessionCount: 0 };
  }
}

// ─── MAIN CRON HANDLER (BATCHED) ────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.headers["x-cron-secret"] !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const startTime = Date.now();
  const { start, end, offset: offsetParam, limit: limitParam } = req.query;

  const startDate = start
    ? new Date(start as string)
    : new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);
  const endDate = end
    ? new Date(end as string)
    : new Date(new Date().getFullYear(), new Date().getMonth(), 0, 23, 59, 59);

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, name, city")
    .eq("continent", "Africa");

  // offset + limit allow chunked backfills to avoid the 300s Vercel timeout
  const offset = offsetParam ? parseInt(offsetParam as string) : 0;
  const limit  = limitParam  ? parseInt(limitParam  as string) : 15;
  const users  = (profiles || [])
    .filter(p => !EXCLUDED_USER_IDS.has(p.id))
    .slice(offset, offset + limit);

  const summaries: any[] = [];
  const BATCH_SIZE = 2; // 2 concurrent Anthropic calls keeps well under timeout

  for (let i = 0; i < users.length; i += BATCH_SIZE) {
    const batch = users.slice(i, i + BATCH_SIZE);

    const batchResults = await Promise.all(batch.map(async (u) => {
      const assessment = await assessMonthlySkills(u.id, startDate, endDate, u.city || "Oloibiri");
      return { ...assessment, userId: u.id, name: u.name || u.id.slice(0, 8) };
    }));

    summaries.push(...batchResults);

    if (i + BATCH_SIZE < users.length) await new Promise(r => setTimeout(r, 1000));
  }

  const monthLabel = startDate.toLocaleString("default", { month: "long", year: "numeric" });
  const durationMs = Date.now() - startTime;

  await resend.emails.send({
    from: "AI Assessment <assessments@girls-aiing-and-vibing.vercel.app>",
    to: "khallinan1@udayton.edu",
    subject: `Monthly Assessment: ${monthLabel} (offset ${offset})`,
    html: `
      <h2>Monthly Progress Report: ${monthLabel}</h2>
      <p>Chunk: users ${offset}–${offset + limit - 1} &nbsp;|&nbsp; Duration: ${(durationMs / 1000).toFixed(1)}s</p>
      <hr/>
      <table border="1" cellpadding="5" style="border-collapse: collapse;">
        <thead>
          <tr><th>Name</th><th>Status</th><th>Sessions</th><th>Cognitive</th><th>PUE Score</th></tr>
        </thead>
        <tbody>
          ${summaries.map(s => `
            <tr>
              <td>${s.name}</td>
              <td>${s.status}</td>
              <td>${s.sessionCount || 0}</td>
              <td>${s.result?.cognitive_score ?? "--"}</td>
              <td>${s.result?.pue_score ?? "--"}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `,
  });

  return res.status(200).json({
    month: monthLabel,
    period: `${startDate.toISOString().slice(0, 10)} → ${endDate.toISOString().slice(0, 10)}`,
    chunk: `users ${offset}–${offset + limit - 1}`,
    assessed:   summaries.filter(s => s.status === "success").length,
    skipped:    summaries.filter(s => s.status === "skipped").length,
    noActivity: summaries.filter(s => s.status === "no_activity").length,
    errors:     summaries.filter(s => s.status === "error").length,
    errorDetails: summaries
      .filter(s => s.status === "error")
      .map(s => ({ name: s.name, error: s.error })),
    durationMs,
  });
}