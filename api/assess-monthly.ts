function buildKudosSection(
  name: string,
  s: MonthlySkillsResult,
  sessionCount: number,
  engagedSessionCount: number,
  history: HistoricalRecord[],
  playground: PlaygroundSummary | null
): string {
  const firstName = name.split(" ")[0] || "Learner";
  const kudos: string[] = [];

  // ── Engagement kudos ──────────────────────────────────────────────────────
  if (engagedSessionCount >= 10) {
    kudos.push(`You completed <strong>${engagedSessionCount} engaged sessions</strong> this month — that's outstanding dedication! 💪`);
  } else if (engagedSessionCount >= 5) {
    kudos.push(`You showed up for <strong>${engagedSessionCount} engaged sessions</strong> this month — great consistency!`);
  } else if (engagedSessionCount >= 1) {
    kudos.push(`You participated in <strong>${engagedSessionCount} session${engagedSessionCount > 1 ? "s" : ""}</strong> this month — every session counts!`);
  }

  // ── Strongest skill kudos ─────────────────────────────────────────────────
  const skills: Array<[string, number]> = [
    ["Cognitive Skills", s.cognitive_score],
    ["Critical Thinking", s.critical_thinking_score],
    ["Problem Solving", s.problem_solving_score],
    ["Creativity", s.creativity_score],
    ["Productive Use of Energy", s.pue_score],
  ];
  const sorted = [...skills].sort((a, b) => b[1] - a[1]);
  const strongest = sorted[0];
  if (strongest[1] >= 75) {
    kudos.push(`Your strongest area is <strong>${strongest[0]}</strong> — scoring ${strongest[1]}/100 puts you at a strong level! 🌟`);
  } else if (strongest[1] >= 55) {
    kudos.push(`Your strongest area is <strong>${strongest[0]}</strong> at ${strongest[1]}/100 — you're developing real skill here!`);
  } else if (strongest[1] >= 35) {
    kudos.push(`You're building your <strong>${strongest[0]}</strong> skills (${strongest[1]}/100) — keep going, you're making progress!`);
  }

  // ── Improvement trend kudos ───────────────────────────────────────────────
  if (history.length >= 2) {
    const prev = history[history.length - 2];
    const curr = history[history.length - 1];
    const prevAvg = (prev.cognitive_score + prev.critical_thinking_score + prev.problem_solving_score + prev.creativity_score + prev.pue_score) / 5;
    const currAvg = (curr.cognitive_score + curr.critical_thinking_score + curr.problem_solving_score + curr.creativity_score + curr.pue_score) / 5;
    const diff = Math.round(currAvg - prevAvg);
    if (diff > 0) {
      kudos.push(`Your overall scores went <strong>up by ${diff} points</strong> compared to last month — real growth! 📈`);
    } else if (diff === 0) {
      kudos.push(`You maintained your skill levels from last month — staying consistent is important!`);
    }

    // Check for individual skill improvements
    const improvements: string[] = [];
    if (curr.cognitive_score > prev.cognitive_score) improvements.push("Cognitive");
    if (curr.critical_thinking_score > prev.critical_thinking_score) improvements.push("Critical Thinking");
    if (curr.problem_solving_score > prev.problem_solving_score) improvements.push("Problem Solving");
    if (curr.creativity_score > prev.creativity_score) improvements.push("Creativity");
    if (curr.pue_score > prev.pue_score) improvements.push("PUE");
    if (improvements.length >= 3) {
      kudos.push(`You improved in <strong>${improvements.length} out of 5</strong> skill areas — that's broad growth across the board! 🎯`);
    } else if (improvements.length > 0) {
      kudos.push(`You showed improvement in <strong>${improvements.join(" and ")}</strong> — nice work!`);
    }
  }

  // ── PUE / Enterprise kudos ────────────────────────────────────────────────
  if (s.pue_learner_initiated_pct >= 30) {
    kudos.push(`You brought up energy and business topics on your own <strong>${Math.round(s.pue_learner_initiated_pct)}%</strong> of the time — that shows real initiative as a future entrepreneur! ⚡`);
  } else if (s.pue_learner_initiated_pct >= 10) {
    kudos.push(`You're starting to bring up energy and business ideas on your own — that entrepreneurial thinking is growing!`);
  }

  if (s.enterprise_artifact_score >= 12) {
    kudos.push(`Your enterprise planning skills scored <strong>${s.enterprise_artifact_score}/18</strong> — you're thinking like a real business planner! 🏪`);
  } else if (s.enterprise_artifact_score >= 6) {
    kudos.push(`You're developing enterprise planning skills (${s.enterprise_artifact_score}/18) — keep building those business ideas!`);
  }

  // ── Role readiness kudos ──────────────────────────────────────────────────
  const roleTotal = (s.role_teaching_intent_count || 0) + (s.role_community_application_count || 0) +
    (s.role_enterprise_orientation_count || 0) + (s.role_intergenerational_count || 0);
  if (roleTotal >= 5) {
    kudos.push(`You showed <strong>${roleTotal} signs</strong> of wanting to teach others and help your community — you're becoming a leader! 🌍`);
  } else if (s.role_teaching_intent_count >= 1) {
    kudos.push(`You expressed interest in teaching and sharing what you've learned — that's the mark of a true leader!`);
  }

  // ── Scaffolding convergence kudos ─────────────────────────────────────────
  if (s.scaffold_convergence_trend === "converging") {
    kudos.push(`The AI needed to help you less and less over time — you're becoming more independent in your learning! 🧠`);
  }

  // ── Reasoning kudos ───────────────────────────────────────────────────────
  if (s.reasoning_structured_pct >= 20) {
    kudos.push(`<strong>${Math.round(s.reasoning_structured_pct)}%</strong> of your sessions showed structured, multi-step reasoning — that's advanced thinking!`);
  }
  if (s.reasoning_chain_count >= 3) {
    kudos.push(`You built <strong>${s.reasoning_chain_count} multi-step reasoning chains</strong> — you're learning to think through complex problems step by step!`);
  }

  // ── Certification kudos ───────────────────────────────────────────────────
  if (s.cert_passed_count >= 1) {
    kudos.push(`You passed <strong>${s.cert_passed_count} certification${s.cert_passed_count > 1 ? "s" : ""}</strong> — that's a real achievement you can be proud of! 🏆`);
  } else if (s.cert_attempted_count >= 1) {
    kudos.push(`You attempted <strong>${s.cert_attempted_count} certification${s.cert_attempted_count > 1 ? "s" : ""}</strong> — taking that step shows courage!`);
  }

  // ── AI Playground kudos ───────────────────────────────────────────────────
  if (playground && playground.hasMeaningfulActivity) {
    kudos.push(`You explored the AI Playground on your own with <strong>${playground.sessionCount} free-form session${playground.sessionCount > 1 ? "s" : ""}</strong> — that curiosity and self-direction is exactly what innovators do! 🎮`);
    if (playground.pueSessionCount > 0) {
      kudos.push(`Even in free-form AI use, you explored energy and business topics — you're connecting your learning to real-world opportunities!`);
    }
  }

  // ── AI Proficiency kudos ──────────────────────────────────────────────────
  const aiProfScores = [s.ai_prof_application_gpt, s.ai_prof_ethics_gpt, s.ai_prof_understanding_gpt, s.ai_prof_verification_gpt];
  const aiProfAvg = aiProfScores.reduce((a, b) => a + (b || 0), 0) / 4;
  if (aiProfAvg >= 60) {
    kudos.push(`Your AI proficiency is strong — you're learning to use AI tools effectively and responsibly! 🤖`);
  } else if (s.ai_prof_ethics_gpt >= 50) {
    kudos.push(`You're showing good awareness of AI ethics and responsibility — that's important for using AI wisely!`);
  }

  // Ensure at least 2 kudos items
  if (kudos.length === 0) {
    kudos.push(`You showed up and engaged with the learning — that takes commitment, and it matters!`);
    kudos.push(`Every session you complete builds your skills for the future. Keep going, ${firstName}!`);
  } else if (kudos.length === 1) {
    kudos.push(`Keep up the effort, ${firstName} — you're building skills that will make a real difference in your community!`);
  }

  // Cap at 5 most impactful kudos to keep it focused
  const displayKudos = kudos.slice(0, 5);

  return `
  <div style="background:linear-gradient(135deg,#fef9c3,#fff7ed);border:2px solid #f59e0b;border-radius:10px;padding:16px 18px;margin:12px 0 16px 0;">
    <div style="font-size:14px;font-weight:700;color:#92400e;margin-bottom:10px;">🌟 Great Work This Month, ${firstName}!</div>
    <ul style="margin:0;padding-left:18px;font-size:12px;color:#374151;line-height:2;">
      ${displayKudos.map((k) => `<li style="margin-bottom:4px;">${k}</li>`).join("")}
    </ul>
    <div style="margin-top:10px;font-size:11px;color:#92400e;font-style:italic;">Keep learning, keep growing — your future is bright! ☀️</div>
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

  // Build the kudos section from actual data
  const kudosHtml = buildKudosSection(name, s, sessionCount, engagedSessionCount, history, playground);

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
<div style="margin-bottom:24px;border:1px solid #d0e8d8;border-radius:12px;overflow:hidden;page-break-before:always;">

  <div style="background:linear-gradient(135deg,#f4fbf6,#fff);padding:13px 16px;display:flex;align-items:center;gap:11px;border-bottom:1px solid #d0e8d8;">
    <div style="width:38px;height:38px;border-radius:50%;background:#1a3d2b;display:flex;align-items:center;justify-content:center;color:#52b788;font-weight:700;font-size:14px;flex-shrink:0;">${initials}</div>
    <div style="flex:1;">
      <strong style="font-size:14px;color:#0d1b14;">${name}</strong>${trendArrow(history)}
      <div style="font-size:11px;color:#5a7060;margin-top:1px;">${history.length} assessment${history.length !== 1 ? "s" : ""} · ${sessionCount} sessions (${engagedSessionCount} engaged) this period</div>
    </div>
  </div>

  ${kudosHtml}

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

  <!-- ── Score Evidence ──────────────────────────────────────── -->
  <div style="border-top:1px solid #d0e8d8;background:#f8fbf9;padding:13px 16px;">
    <div style="font-size:11px;font-weight:600;color:#1a3d2b;margin-bottom:10px;">📝 Score Evidence</div>
    <div style="display:flex;gap:12px;flex-wrap:wrap;">
      ${([
        ["🧠 Cognitive", s.cognitive_score, s.cognitive_evidence],
        ["🔍 Critical Thinking", s.critical_thinking_score, s.critical_thinking_evidence],
        ["⚙️ Problem Solving", s.problem_solving_score, s.problem_solving_evidence],
        ["🎨 Creativity", s.creativity_score, s.creativity_evidence],
        ["⚡ PUE", s.pue_score, s.pue_evidence],
      ] as [string, number, string[]][]).map(([label, score, evidence]) => `
      <div style="flex:1;min-width:180px;background:#fff;border:1px solid #d0e8d8;border-radius:8px;padding:8px 10px;">
        <div style="font-size:10px;font-weight:700;color:#1a3d2b;margin-bottom:5px;display:flex;align-items:center;gap:5px;">
          ${label} ${sc(score)}
        </div>
        <ul style="margin:0;padding-left:14px;font-size:10px;color:#374151;line-height:1.7;">
          ${(evidence || []).map((e) => `<li style="margin-bottom:2px;">${e}</li>`).join("") || `<li style="color:#9ca3af;">No evidence recorded.</li>`}
        </ul>
      </div>`).join("")}
    </div>
  </div>

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
        <div>Goal: ${s.enterprise_artifact_goal_score}/3  ·  Resources: ${s.enterprise_artifact_resource_score}/3  ·  Plan: ${s.enterprise_artifact_plan_score}/3</div>
        <div>Constraints: ${s.enterprise_artifact_constraint_score}/3  ·  Quant: ${s.enterprise_artifact_quant_score}/3  ·  Risk: ${s.enterprise_artifact_risk_score}/3</div>
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
          <div>Application: <strong>${s.ai_prof_application_score != null ? `${s.ai_prof_application_score}/3` : "—"}</strong>   Ethics: <strong>${s.ai_prof_ethics_score != null ? `${s.ai_prof_ethics_score}/3` : "—"}</strong></div>
          <div>Understanding: <strong>${s.ai_prof_understanding_score != null ? `${s.ai_prof_understanding_score}/3` : "—"}</strong>   Verification: <strong>${s.ai_prof_verification_score != null ? `${s.ai_prof_verification_score}/3` : "—"}</strong></div>
          <div>Cert level: <strong style="color:${s.ai_prof_cert_level === "Advanced" ? "#166534" : s.ai_prof_cert_level === "Proficient" ? "#1e40af" : s.ai_prof_cert_level === "Emerging" ? "#713f12" : "#6b7280"};">${s.ai_prof_cert_level || "Not Attempted"}</strong></div>
        </div>
      </div>
      <!-- GPT-inferred scores from transcript analysis -->
      <div style="flex:1;min-width:200px;">
        <div style="font-size:9px;font-weight:700;color:#6b21a8;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:5px;">GPT-Assessed from Transcripts (0–100)</div>
        <div style="font-size:10px;color:#374151;line-height:1.8;">
          <div>Application: ${sc(s.ai_prof_application_gpt)}   Ethics: ${sc(s.ai_prof_ethics_gpt)}</div>
          <div>Understanding: ${sc(s.ai_prof_understanding_gpt)}   Verification: ${sc(s.ai_prof_verification_gpt)}</div>
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