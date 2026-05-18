import { useState, useEffect, useRef, useCallback } from "react";

// ─── DESIGN TOKENS ─────────────────────────────────────────────────────────────
const C = {
  navy:    "#1B2A4A",
  navyDk:  "#111D33",
  navyMd:  "#253660",
  gold:    "#C8963E",
  goldLt:  "#E6B96A",
  teal:    "#2A7B88",
  tealLt:  "#3D9AA8",
  sage:    "#5B7A6A",
  cream:   "#FAF8F4",
  parchment: "#F2EFE8",
  sand:    "#E8E2D6",
  sandDk:  "#D4CCBC",
  charcoal:"#2D2D2D",
  mid:     "#6B6560",
  muted:   "#9A9490",
  white:   "#FFFFFF",
  success: "#2E7D32",
  successLt:"#E8F5E9",
  warn:    "#E65100",
  warnLt:  "#FFF3E0",
  blue:    "#3D6B99",
};

// ─── MOCK DATA ──────────────────────────────────────────────────────────────────
const RESEARCH_PROJECTS = [
  {
    id: "rq1",
    title: "Learning Outcomes Study",
    shortTitle: "Learning Outcomes",
    domain: "Domain A — Youth Impact",
    question: "Does sustained vAI engagement produce measurable gains in AI proficiency, digital literacy, and English language skills?",
    color: C.gold,
    icon: "📚",
    phases: [
      {
        id: 1, name: "Research Design", status: "complete", months: "1–2",
        badge: "Research Foundations",
        tasks: [
          { id: "t1_1", name: "Define sub-questions", status: "complete", validation: "Faculty review", due: "Week 2" },
          { id: "t1_2", name: "Literature review", status: "complete", validation: "AI summary audit", due: "Week 3" },
          { id: "t1_3", name: "Survey instrument design", status: "complete", validation: "Peer pilot test", due: "Week 6" },
          { id: "t1_4", name: "IRB consent scripts", status: "complete", validation: "Ethics check", due: "Week 8" },
        ]
      },
      {
        id: 2, name: "Data Collection", status: "active", months: "3–6",
        badge: "Field Research Methods",
        tasks: [
          { id: "t2_1", name: "Baseline surveys", status: "complete", validation: "87/100 responses verified", due: "Month 3" },
          { id: "t2_2", name: "Follow-up proficiency pull", status: "active", validation: "Auto-pull from vAI platform + manual cross-check", due: "Month 4" },
          { id: "t2_3", name: "Learner interviews", status: "pending", validation: "Transcript + code review", due: "Month 5" },
          { id: "t2_4", name: "Reflexivity journal entries", status: "pending", validation: "AI bias audit + self-review", due: "Ongoing" },
        ]
      },
      {
        id: 3, name: "Analysis", status: "locked", months: "6–9",
        badge: "Data Analysis",
        tasks: [
          { id: "t3_1", name: "Proficiency trend analysis", status: "locked", validation: "Statistical significance check (p<0.05)", due: "Month 7" },
          { id: "t3_2", name: "Interview thematic coding", status: "locked", validation: "Inter-rater reliability check", due: "Month 8" },
          { id: "t3_3", name: "Triangulation matrix", status: "locked", validation: "Faculty + ESSA review", due: "Month 8" },
          { id: "t3_4", name: "Negative case documentation", status: "locked", validation: "Explicit disconfirming evidence included", due: "Month 9" },
        ]
      },
      {
        id: 4, name: "Writing", status: "locked", months: "9–11",
        badge: "Research Communication",
        tasks: [
          { id: "t4_1", name: "Draft manuscript", status: "locked", validation: "AI plagiarism check + faculty review", due: "Month 10" },
          { id: "t4_2", name: "Policy brief", status: "locked", validation: "Plain language check", due: "Month 10" },
          { id: "t4_3", name: "Peer review participation", status: "locked", validation: "Review feedback submitted", due: "Month 11" },
        ]
      },
      {
        id: 5, name: "Completion", status: "locked", months: "12",
        badge: "Community Research Scholar",
        tasks: [
          { id: "t5_1", name: "Portfolio assembly", status: "locked", validation: "All prior artifacts included", due: "Month 12" },
          { id: "t5_2", name: "Community presentation", status: "locked", validation: "Community attendance + recording", due: "Month 12" },
          { id: "t5_3", name: "Mentorship onboarding", status: "locked", validation: "Cohort 2 match confirmed", due: "Month 12" },
        ]
      }
    ]
  },
  {
    id: "rq2",
    title: "Hope & Agency Study",
    shortTitle: "Hope & Agency",
    domain: "Domain A — Youth Impact",
    question: "How does AI-facilitated learning affect youth perceptions of future possibility, self-efficacy, and economic agency?",
    color: C.teal,
    icon: "🌱",
    phases: [
      { id: 1, name: "Research Design", status: "complete", months: "1–2", badge: "Research Foundations", tasks: [
        { id: "h1_1", name: "Hope scale instrument design", status: "complete", validation: "Validated against Snyder Hope Scale", due: "Week 6" },
        { id: "h1_2", name: "Agency indicators framework", status: "complete", validation: "Faculty review", due: "Week 8" },
      ]},
      { id: 2, name: "Data Collection", status: "active", months: "3–6", badge: "Field Research Methods", tasks: [
        { id: "h2_1", name: "Baseline hope surveys", status: "complete", validation: "62/80 responses verified", due: "Month 3" },
        { id: "h2_2", name: "Agency observation logs", status: "active", validation: "Coded observation review", due: "Ongoing" },
        { id: "h2_3", name: "Narrative interviews", status: "pending", validation: "Transcript + emotional coding", due: "Month 5" },
      ]},
      { id: 3, name: "Analysis", status: "locked", months: "6–9", badge: "Data Analysis", tasks: [] },
      { id: 4, name: "Writing", status: "locked", months: "9–11", badge: "Research Communication", tasks: [] },
      { id: 5, name: "Completion", status: "locked", months: "12", badge: "Community Research Scholar", tasks: [] },
    ]
  },
  {
    id: "rq4",
    title: "Community Spillover Study",
    shortTitle: "Community Spillover",
    domain: "Domain B — Community Impact",
    question: "What spillover effects does youth AI learning produce in households and communities, including productive use of energy?",
    color: C.sage,
    icon: "🏘️",
    phases: [
      { id: 1, name: "Research Design", status: "complete", months: "1–2", badge: "Research Foundations", tasks: [] },
      { id: 2, name: "Data Collection", status: "active", months: "3–6", badge: "Field Research Methods", tasks: [
        { id: "s2_1", name: "Household observation logs", status: "active", validation: "Coded by category + peer check", due: "Ongoing" },
        { id: "s2_2", name: "Elder and community leader interviews", status: "active", validation: "Transcript + cultural validation", due: "Month 5" },
        { id: "s2_3", name: "PUE energy demand tracking", status: "pending", validation: "Cross-check with energy infrastructure data", due: "Month 6" },
      ]},
      { id: 3, name: "Analysis", status: "locked", months: "6–9", badge: "Data Analysis", tasks: [] },
      { id: 4, name: "Writing", status: "locked", months: "9–11", badge: "Research Communication", tasks: [] },
      { id: 5, name: "Completion", status: "locked", months: "12", badge: "Community Research Scholar", tasks: [] },
    ]
  }
];

const MOCK_PLATFORM_DATA = {
  totalSessions: 1607,
  proficiencyAvg: 2.3,
  activeResearchers: 20,
  siteSurveys: { Oloibiri: 87, Ibiade: 62 },
  recentTrend: [
    { month: "Jan", score: 1.2 }, { month: "Feb", score: 1.5 },
    { month: "Mar", score: 1.8 }, { month: "Apr", score: 2.1 },
    { month: "May", score: 2.3 },
  ],
  topLearners: ["Silas Clergy", "Amara O.", "Chinwe I.", "Emmanuel B."],
};

// ─── STYLES ─────────────────────────────────────────────────────────────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=Source+Serif+4:ital,wght@0,300;0,400;0,600;1,300;1,400&family=JetBrains+Mono:wght@400;500&display=swap');

  * { box-sizing: border-box; margin: 0; padding: 0; }

  .rp-root {
    font-family: 'Source Serif 4', Georgia, serif;
    background: ${C.cream};
    min-height: 100vh;
    color: ${C.charcoal};
  }

  .rp-root h1, .rp-root h2, .rp-root h3, .rp-root h4 {
    font-family: 'Playfair Display', Georgia, serif;
  }

  /* ── TOPBAR ── */
  .topbar {
    background: ${C.navyDk};
    padding: 0 32px;
    height: 56px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    position: sticky;
    top: 0;
    z-index: 100;
    border-bottom: 2px solid ${C.gold}44;
  }
  .topbar-brand {
    display: flex; align-items: center; gap: 10px;
  }
  .topbar-logo {
    font-family: 'Playfair Display', serif;
    font-size: 17px; font-weight: 700;
    color: ${C.white};
    letter-spacing: 0.5px;
  }
  .topbar-divider { width: 1px; height: 20px; background: ${C.gold}55; }
  .topbar-section {
    font-size: 12px; color: ${C.gold}; font-weight: 600;
    letter-spacing: 1.5px; text-transform: uppercase;
  }
  .topbar-user {
    display: flex; align-items: center; gap: 8px;
    font-size: 13px; color: rgba(255,255,255,0.7);
  }
  .topbar-avatar {
    width: 28px; height: 28px; border-radius: 50%;
    background: ${C.gold}33; border: 1px solid ${C.gold}55;
    display: flex; align-items: center; justify-content: center;
    font-size: 11px; color: ${C.gold}; font-weight: 700;
  }

  /* ── BREADCRUMB ── */
  .breadcrumb {
    display: flex; align-items: center; gap: 6px;
    padding: 12px 32px;
    background: ${C.navyMd}22;
    border-bottom: 1px solid ${C.sand};
    font-size: 12px; color: ${C.mid};
  }
  .breadcrumb-btn {
    background: none; border: none; cursor: pointer;
    color: ${C.teal}; font-size: 12px; padding: 2px 4px;
    border-radius: 4px; font-family: 'Source Serif 4', serif;
    transition: background 0.15s;
  }
  .breadcrumb-btn:hover { background: ${C.teal}18; }
  .breadcrumb-sep { color: ${C.sandDk}; }

  /* ── LANDING ── */
  .landing-hero {
    background: linear-gradient(160deg, ${C.navyDk} 0%, ${C.navyMd} 60%, ${C.teal}44 100%);
    padding: 64px 32px 56px;
    position: relative; overflow: hidden;
  }
  .landing-hero::before {
    content: '';
    position: absolute; inset: 0;
    background: radial-gradient(ellipse at 80% 50%, ${C.gold}0A 0%, transparent 70%);
    pointer-events: none;
  }
  .hero-eyebrow {
    font-size: 11px; letter-spacing: 2.5px; text-transform: uppercase;
    color: ${C.gold}; font-weight: 600; margin-bottom: 16px;
    font-family: 'Source Serif 4', serif;
  }
  .hero-title {
    font-size: 42px; font-weight: 700; color: ${C.white};
    line-height: 1.15; max-width: 680px; margin-bottom: 18px;
  }
  .hero-sub {
    font-size: 16px; color: rgba(255,255,255,0.65);
    max-width: 580px; line-height: 1.6; margin-bottom: 36px;
    font-weight: 300; font-style: italic;
  }
  .hero-stats {
    display: flex; gap: 32px; flex-wrap: wrap;
  }
  .hero-stat { text-align: center; }
  .hero-stat-val {
    font-size: 28px; font-weight: 700; color: ${C.white};
    font-family: 'Playfair Display', serif; line-height: 1;
  }
  .hero-stat-lbl {
    font-size: 11px; color: ${C.gold}; letter-spacing: 1px;
    text-transform: uppercase; margin-top: 4px;
  }

  /* ── SECTION ── */
  .section { padding: 40px 32px; }
  .section-title {
    font-size: 22px; font-weight: 600; color: ${C.navy};
    margin-bottom: 6px; display: flex; align-items: center; gap: 10px;
  }
  .section-sub { font-size: 14px; color: ${C.mid}; margin-bottom: 24px; font-style: italic; }

  /* ── PROJECT CARDS ── */
  .project-grid {
    display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 16px;
  }
  .project-card {
    background: ${C.white}; border: 1px solid ${C.sand};
    border-radius: 12px; padding: 22px;
    cursor: pointer; transition: all 0.25s;
    position: relative; overflow: hidden;
  }
  .project-card:hover {
    border-color: var(--accent);
    box-shadow: 0 8px 32px rgba(0,0,0,0.10);
    transform: translateY(-2px);
  }
  .project-card::before {
    content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px;
    background: var(--accent);
  }
  .project-card-domain {
    font-size: 10px; letter-spacing: 1.5px; text-transform: uppercase;
    color: var(--accent); font-weight: 600; margin-bottom: 8px;
    font-family: 'Source Serif 4', serif;
  }
  .project-card-title {
    font-size: 18px; font-weight: 600; color: ${C.navy}; margin-bottom: 8px;
    line-height: 1.2;
  }
  .project-card-q {
    font-size: 13px; color: ${C.mid}; line-height: 1.55; margin-bottom: 16px;
    font-style: italic;
  }
  .project-card-footer {
    display: flex; justify-content: space-between; align-items: center;
  }
  .phase-pills { display: flex; gap: 4px; }
  .phase-pill {
    width: 10px; height: 10px; border-radius: 50%;
    background: ${C.sand};
  }
  .phase-pill.done { background: var(--accent); }
  .phase-pill.active { background: var(--accent); opacity: 0.5; }
  .join-btn {
    padding: 6px 14px; border-radius: 20px; font-size: 12px; font-weight: 600;
    border: 1.5px solid var(--accent); background: none; color: var(--accent);
    cursor: pointer; transition: all 0.2s;
    font-family: 'Source Serif 4', serif;
  }
  .join-btn:hover { background: var(--accent); color: white; }

  /* ── SIGNUP PANEL ── */
  .signup-panel {
    background: ${C.white}; border: 1px solid ${C.sand};
    border-radius: 16px; padding: 32px; max-width: 600px; margin: 0 auto;
    box-shadow: 0 4px 40px rgba(0,0,0,0.08);
  }
  .signup-head {
    font-size: 26px; font-weight: 700; color: ${C.navy}; margin-bottom: 6px;
  }
  .signup-sub { font-size: 14px; color: ${C.mid}; margin-bottom: 28px; font-style: italic; }
  .member-row {
    display: flex; gap: 10px; margin-bottom: 10px; align-items: center;
  }
  .inp {
    flex: 1; padding: 10px 14px; border: 1.5px solid ${C.sand};
    border-radius: 8px; font-size: 14px; font-family: 'Source Serif 4', serif;
    background: ${C.cream}; color: ${C.charcoal}; outline: none;
    transition: border-color 0.2s;
  }
  .inp:focus { border-color: ${C.teal}; background: white; }
  .inp-select { cursor: pointer; }
  .remove-btn {
    width: 28px; height: 28px; border-radius: 50%;
    border: 1px solid ${C.sand}; background: none; cursor: pointer;
    color: ${C.muted}; font-size: 14px; display: flex; align-items: center; justify-content: center;
    transition: all 0.2s; flex-shrink: 0;
  }
  .remove-btn:hover { border-color: ${C.warn}; color: ${C.warn}; background: ${C.warnLt}; }
  .add-member-btn {
    background: none; border: 1.5px dashed ${C.sand};
    border-radius: 8px; padding: 8px 14px; cursor: pointer;
    color: ${C.teal}; font-size: 13px; font-family: 'Source Serif 4', serif;
    width: 100%; margin-top: 4px; transition: all 0.2s;
  }
  .add-member-btn:hover { border-color: ${C.teal}; background: ${C.teal}08; }
  .site-selector {
    display: flex; gap: 10px; flex-wrap: wrap; margin: 12px 0 20px;
  }
  .site-chip {
    padding: 7px 16px; border-radius: 20px; font-size: 13px; cursor: pointer;
    border: 1.5px solid ${C.sand}; background: none; color: ${C.mid};
    font-family: 'Source Serif 4', serif; transition: all 0.2s;
  }
  .site-chip.active {
    border-color: ${C.teal}; background: ${C.teal}14; color: ${C.teal}; font-weight: 600;
  }
  .form-label {
    font-size: 11px; letter-spacing: 1px; text-transform: uppercase;
    color: ${C.mid}; font-weight: 600; margin-bottom: 8px; display: block;
    font-family: 'Source Serif 4', serif;
  }
  .primary-btn {
    width: 100%; padding: 13px; border-radius: 10px; font-size: 15px;
    font-weight: 600; border: none; cursor: pointer;
    background: ${C.navy}; color: white;
    font-family: 'Playfair Display', serif; letter-spacing: 0.5px;
    transition: all 0.2s; margin-top: 8px;
  }
  .primary-btn:hover { background: ${C.navyMd}; transform: translateY(-1px); box-shadow: 0 4px 16px ${C.navy}44; }
  .primary-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

  /* ── PROJECT VIEW ── */
  .project-header {
    padding: 32px 32px 24px;
    border-bottom: 1px solid ${C.sand};
    background: ${C.white};
  }
  .project-header-domain {
    font-size: 11px; letter-spacing: 2px; text-transform: uppercase;
    font-weight: 600; margin-bottom: 8px;
    font-family: 'Source Serif 4', serif;
  }
  .project-header-title { font-size: 28px; font-weight: 700; color: ${C.navy}; margin-bottom: 8px; }
  .project-header-q {
    font-size: 14px; color: ${C.mid}; font-style: italic; line-height: 1.6;
    max-width: 680px; padding: 10px 14px;
    background: ${C.parchment}; border-left: 3px solid var(--accent);
    border-radius: 0 6px 6px 0; margin-top: 6px;
  }

  /* ── PHASE RAIL ── */
  .phase-rail {
    display: flex; gap: 0; overflow-x: auto;
    border-bottom: 1px solid ${C.sand};
    background: ${C.parchment};
    padding: 0 32px;
  }
  .phase-tab {
    padding: 14px 20px; cursor: pointer; border: none; background: none;
    font-family: 'Source Serif 4', serif; font-size: 13px; color: ${C.mid};
    border-bottom: 2px solid transparent; white-space: nowrap;
    transition: all 0.2s; position: relative; display: flex; align-items: center; gap: 6px;
  }
  .phase-tab.active { color: ${C.navy}; border-bottom-color: var(--accent); font-weight: 600; }
  .phase-tab.locked { opacity: 0.4; cursor: not-allowed; }
  .phase-tab-badge {
    font-size: 10px; padding: 1px 5px; border-radius: 8px;
    background: var(--accent); color: white; font-weight: 700;
  }
  .phase-tab-status {
    width: 6px; height: 6px; border-radius: 50%;
  }
  .phase-tab-status.complete { background: ${C.success}; }
  .phase-tab-status.active { background: ${C.gold}; }
  .phase-tab-status.locked { background: ${C.sandDk}; }

  /* ── PHASE BODY ── */
  .phase-body { display: flex; gap: 0; min-height: calc(100vh - 280px); }
  .task-list {
    width: 320px; flex-shrink: 0; border-right: 1px solid ${C.sand};
    background: ${C.white}; overflow-y: auto;
    padding: 20px 0;
  }
  .task-list-title {
    font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase;
    color: ${C.mid}; padding: 0 20px 10px; font-weight: 600;
    font-family: 'Source Serif 4', serif;
  }
  .task-item {
    padding: 14px 20px; cursor: pointer; transition: background 0.15s;
    border-left: 3px solid transparent; position: relative;
  }
  .task-item:hover { background: ${C.cream}; }
  .task-item.active { background: ${C.parchment}; border-left-color: var(--accent); }
  .task-item.locked { opacity: 0.45; cursor: not-allowed; }
  .task-item-name { font-size: 13px; font-weight: 600; color: ${C.navy}; margin-bottom: 4px; }
  .task-item-meta { font-size: 11px; color: ${C.muted}; display: flex; gap: 10px; }
  .task-status-dot {
    width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; margin-top: 3px;
  }
  .task-status-dot.complete { background: ${C.success}; }
  .task-status-dot.active { background: ${C.gold}; box-shadow: 0 0 0 3px ${C.gold}33; }
  .task-status-dot.pending { background: ${C.sandDk}; }
  .task-status-dot.locked { background: ${C.sand}; }

  /* ── TASK DETAIL ── */
  .task-detail {
    flex: 1; padding: 28px 32px; overflow-y: auto;
    background: ${C.cream};
  }
  .task-detail-empty {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    height: 300px; color: ${C.muted}; text-align: center; gap: 12px;
  }
  .task-detail-empty-icon { font-size: 40px; opacity: 0.4; }

  .detail-header {
    margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid ${C.sand};
  }
  .detail-phase-label {
    font-size: 10px; letter-spacing: 2px; text-transform: uppercase;
    color: var(--accent); font-weight: 600; margin-bottom: 6px;
    font-family: 'Source Serif 4', serif;
  }
  .detail-title { font-size: 22px; font-weight: 700; color: ${C.navy}; margin-bottom: 6px; }
  .detail-meta { display: flex; gap: 14px; flex-wrap: wrap; }
  .detail-chip {
    font-size: 11px; padding: 3px 10px; border-radius: 10px;
    border: 1px solid ${C.sand}; color: ${C.mid};
    font-family: 'Source Serif 4', serif;
  }

  .info-cards { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; }
  .info-card {
    background: ${C.white}; border: 1px solid ${C.sand};
    border-radius: 10px; padding: 14px 16px;
  }
  .info-card-label {
    font-size: 10px; letter-spacing: 1.5px; text-transform: uppercase;
    color: var(--accent); font-weight: 600; margin-bottom: 6px;
    font-family: 'Source Serif 4', serif;
  }
  .info-card-body { font-size: 13px; color: ${C.charcoal}; line-height: 1.55; }

  .progress-section { margin-bottom: 20px; }
  .progress-section-title {
    font-size: 13px; font-weight: 600; color: ${C.navy}; margin-bottom: 10px;
    display: flex; align-items: center; gap: 6px;
  }
  .prior-entry {
    background: ${C.white}; border: 1px solid ${C.sand}; border-radius: 8px;
    padding: 12px 14px; margin-bottom: 8px; font-size: 13px; line-height: 1.5;
  }
  .prior-entry-head {
    display: flex; justify-content: space-between; margin-bottom: 4px;
    font-size: 11px; color: ${C.muted};
  }

  /* ── AI PANEL ── */
  .ai-panel {
    background: ${C.white}; border: 1px solid ${C.sand};
    border-radius: 12px; overflow: hidden; margin-top: 20px;
    box-shadow: 0 2px 16px rgba(0,0,0,0.06);
  }
  .ai-panel-header {
    background: ${C.navy}; padding: 12px 16px;
    display: flex; align-items: center; gap: 8px;
  }
  .ai-panel-title { font-size: 13px; font-weight: 600; color: white; }
  .ai-status-dot {
    width: 7px; height: 7px; border-radius: 50%; background: ${C.gold};
    box-shadow: 0 0 0 3px ${C.gold}44;
    animation: pulse 2s infinite;
  }
  @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }

  .ai-msgs {
    max-height: 380px; overflow-y: auto; padding: 16px;
    display: flex; flex-direction: column; gap: 12px;
    background: ${C.cream};
    scroll-behavior: smooth;
  }
  .ai-msg { display: flex; gap: 10px; align-items: flex-start; }
  .ai-msg.user { flex-direction: row-reverse; }
  .msg-avatar {
    width: 28px; height: 28px; border-radius: 50%; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    font-size: 12px;
  }
  .msg-avatar.ai { background: ${C.navy}; color: ${C.gold}; font-weight: 700; font-family: 'Playfair Display', serif; }
  .msg-avatar.user { background: ${C.teal}22; color: ${C.teal}; font-size: 14px; }
  .msg-bubble {
    max-width: 82%; padding: 10px 14px; border-radius: 12px;
    font-size: 13px; line-height: 1.6;
  }
  .msg-bubble.ai {
    background: ${C.white}; border: 1px solid ${C.sand};
    color: ${C.charcoal}; border-radius: 2px 12px 12px 12px;
  }
  .msg-bubble.user {
    background: ${C.navy}; color: white;
    border-radius: 12px 2px 12px 12px;
  }
  .msg-bubble.typing {
    background: ${C.white}; border: 1px solid ${C.sand};
    color: ${C.muted}; font-style: italic;
  }
  .suggested-text {
    background: ${C.parchment}; border: 1px solid ${C.sand};
    border-radius: 8px; padding: 10px 12px; margin-top: 8px;
    font-size: 12px; color: ${C.navy}; font-style: italic;
    border-left: 3px solid ${C.gold};
  }
  .suggested-text-actions {
    display: flex; gap: 8px; margin-top: 6px;
  }
  .use-text-btn {
    font-size: 11px; padding: 3px 8px; border-radius: 4px;
    background: ${C.gold}; color: white; border: none; cursor: pointer;
    font-family: 'Source Serif 4', serif; font-weight: 600;
  }
  .dismiss-btn {
    font-size: 11px; padding: 3px 8px; border-radius: 4px;
    background: none; color: ${C.mid}; border: 1px solid ${C.sand}; cursor: pointer;
  }

  .ai-data-card {
    background: ${C.navy}0A; border: 1px solid ${C.navy}1A;
    border-radius: 8px; padding: 10px 12px; margin-top: 8px;
    font-size: 12px;
  }
  .ai-data-label { font-size: 10px; letter-spacing: 1px; text-transform: uppercase; color: ${C.teal}; font-weight: 600; margin-bottom: 4px; }
  .ai-data-val { font-size: 18px; font-weight: 700; color: ${C.navy}; font-family: 'Playfair Display', serif; }
  .ai-data-sub { font-size: 11px; color: ${C.mid}; margin-top: 1px; }

  .ai-input-row {
    display: flex; gap: 8px; padding: 12px 16px;
    border-top: 1px solid ${C.sand}; background: ${C.white};
  }
  .ai-inp {
    flex: 1; padding: 9px 12px; border: 1.5px solid ${C.sand};
    border-radius: 8px; font-size: 13px; outline: none;
    font-family: 'Source Serif 4', serif; background: ${C.cream};
    transition: border-color 0.2s;
  }
  .ai-inp:focus { border-color: ${C.teal}; background: white; }
  .ai-send-btn {
    width: 36px; height: 36px; border-radius: 8px;
    background: ${C.navy}; border: none; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    color: white; font-size: 14px; transition: background 0.2s;
    flex-shrink: 0;
  }
  .ai-send-btn:hover { background: ${C.navyMd}; }
  .ai-send-btn:disabled { opacity: 0.4; cursor: not-allowed; }

  /* ── FINDINGS BOX ── */
  .findings-box {
    background: ${C.white}; border: 1.5px solid ${C.sand};
    border-radius: 10px; overflow: hidden; margin-top: 16px;
  }
  .findings-header {
    background: ${C.parchment}; padding: 10px 14px;
    font-size: 11px; font-weight: 600; letter-spacing: 1.5px;
    text-transform: uppercase; color: ${C.mid}; border-bottom: 1px solid ${C.sand};
    font-family: 'Source Serif 4', serif; display: flex; justify-content: space-between;
    align-items: center;
  }
  .findings-area {
    width: 100%; min-height: 80px; padding: 12px 14px;
    border: none; outline: none; resize: vertical;
    font-size: 13px; line-height: 1.7; color: ${C.charcoal};
    font-family: 'Source Serif 4', serif; background: transparent;
  }
  .findings-footer {
    padding: 8px 14px; border-top: 1px solid ${C.sand};
    display: flex; justify-content: flex-end; gap: 8px;
  }
  .save-btn {
    padding: 6px 14px; border-radius: 6px; font-size: 12px; font-weight: 600;
    background: ${C.teal}; color: white; border: none; cursor: pointer;
    font-family: 'Source Serif 4', serif; transition: background 0.2s;
  }
  .save-btn:hover { background: ${C.tealLt}; }

  /* ── TOAST ── */
  .toast {
    position: fixed; bottom: 24px; right: 24px;
    background: ${C.navy}; color: white; padding: 12px 18px;
    border-radius: 10px; font-size: 13px; z-index: 1000;
    box-shadow: 0 4px 20px rgba(0,0,0,0.25);
    animation: slideUp 0.3s ease-out;
    border-left: 3px solid ${C.gold};
  }
  @keyframes slideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

  /* ── SIDEBAR ── */
  .rp-shell {
    display: flex; min-height: 100vh;
  }
  .sidebar {
    width: 220px; flex-shrink: 0;
    background: ${C.navyDk};
    border-right: 1px solid rgba(255,255,255,0.06);
    display: flex; flex-direction: column;
    position: sticky; top: 0; height: 100vh;
    overflow-y: auto; z-index: 90;
  }
  .sidebar-logo-row {
    padding: 18px 20px 14px;
    border-bottom: 1px solid rgba(255,255,255,0.07);
    display: flex; align-items: center; gap: 8px;
  }
  .sidebar-logo {
    font-family: 'Playfair Display', serif;
    font-size: 18px; font-weight: 700; color: ${C.white};
    letter-spacing: 0.5px;
  }
  .sidebar-tagline {
    font-size: 9px; color: ${C.gold}; letter-spacing: 1.5px;
    text-transform: uppercase; font-weight: 600;
    font-family: 'Source Serif 4', serif;
  }

  /* Home button */
  .sidebar-home-btn {
    display: flex; align-items: center; gap: 10px;
    margin: 14px 12px 4px;
    padding: 9px 12px; border-radius: 8px;
    background: ${C.gold}18; border: 1px solid ${C.gold}44;
    color: ${C.gold}; font-size: 12px; font-weight: 700;
    font-family: 'Source Serif 4', serif;
    cursor: pointer; text-decoration: none;
    letter-spacing: 0.3px;
    transition: background 0.18s, border-color 0.18s;
  }
  .sidebar-home-btn:hover {
    background: ${C.gold}30; border-color: ${C.gold}88;
  }
  .sidebar-home-icon { font-size: 14px; flex-shrink: 0; }

  .sidebar-section-label {
    padding: 16px 20px 6px;
    font-size: 9px; letter-spacing: 2px; text-transform: uppercase;
    color: rgba(255,255,255,0.3); font-weight: 600;
    font-family: 'Source Serif 4', serif;
  }
  .sidebar-nav-item {
    display: flex; align-items: center; gap: 10px;
    padding: 9px 20px; cursor: pointer;
    font-size: 13px; color: rgba(255,255,255,0.58);
    font-family: 'Source Serif 4', serif;
    border-left: 3px solid transparent;
    transition: all 0.15s; text-decoration: none;
    background: none; border-top: none; border-right: none; border-bottom: none;
    width: 100%; text-align: left;
  }
  .sidebar-nav-item:hover {
    color: ${C.white}; background: rgba(255,255,255,0.05);
  }
  .sidebar-nav-item.active {
    color: ${C.white}; background: rgba(255,255,255,0.07);
    border-left-color: ${C.gold};
    font-weight: 600;
  }
  .sidebar-nav-icon { font-size: 14px; flex-shrink: 0; width: 18px; text-align: center; }

  .sidebar-divider {
    margin: 10px 20px;
    border: none; border-top: 1px solid rgba(255,255,255,0.07);
  }
  .sidebar-footer {
    margin-top: auto; padding: 14px 20px;
    border-top: 1px solid rgba(255,255,255,0.07);
  }
  .sidebar-user-row {
    display: flex; align-items: center; gap: 8px;
  }
  .sidebar-avatar {
    width: 28px; height: 28px; border-radius: 50%;
    background: ${C.gold}33; border: 1px solid ${C.gold}55;
    display: flex; align-items: center; justify-content: center;
    font-size: 10px; color: ${C.gold}; font-weight: 700; flex-shrink: 0;
  }
  .sidebar-user-name { font-size: 12px; color: rgba(255,255,255,0.7); font-weight: 500; }
  .sidebar-user-site { font-size: 10px; color: ${C.gold}; margin-top: 1px; }

  /* Main content area beside sidebar */
  .rp-main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
`;


// ─── INJECT STYLES ──────────────────────────────────────────────────────────────
function StyleTag() {
  return <style>{css}</style>;
}

// ─── SIDEBAR ─────────────────────────────────────────────────────────────────────
// src/components/layout/Sidebar
const SIDEBAR_NAV = [
  { icon: "🔬", label: "Research",    key: "research",   href: null },
  { icon: "🧠", label: "AI Playground", key: "playground", href: "/playground" },
  { icon: "📋", label: "Assessments",  key: "assess",     href: "/assessments" },
  { icon: "🏅", label: "Certifications", key: "certs",    href: "/certifications" },
  { icon: "📊", label: "Dashboard",   key: "dashboard",  href: "/dashboard" },
  { icon: "❤️", label: "Health",      key: "health",     href: "/health" },
];

function Sidebar({ activeKey = "research", user }) {
  const handleNav = (href) => {
    if (href) window.location.href = href;
  };

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo-row">
        <div>
          <div className="sidebar-logo">vAI</div>
          <div className="sidebar-tagline">Next Village</div>
        </div>
      </div>

      {/* Home Button */}
      <a
        className="sidebar-home-btn"
        href="https://nextvillage.community/home"
      >
        <span className="sidebar-home-icon">🏠</span>
        Home
      </a>

      <hr className="sidebar-divider" />

      {/* Nav */}
      <div className="sidebar-section-label">Platform</div>
      {SIDEBAR_NAV.map(item => (
        <button
          key={item.key}
          className={`sidebar-nav-item${activeKey === item.key ? " active" : ""}`}
          onClick={() => handleNav(item.href)}
        >
          <span className="sidebar-nav-icon">{item.icon}</span>
          {item.label}
        </button>
      ))}

      {/* Footer / User */}
      {user && (
        <div className="sidebar-footer">
          <div className="sidebar-user-row">
            <div className="sidebar-avatar">{user.initials}</div>
            <div>
              <div className="sidebar-user-name">{user.name}</div>
              <div className="sidebar-user-site">{user.site}</div>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

// ─── HELPERS ────────────────────────────────────────────────────────────────────
function setAccent(color) {
  return { "--accent": color };
}

function statusIcon(s) {
  if (s === "complete") return "✓";
  if (s === "active") return "●";
  if (s === "pending") return "○";
  return "🔒";
}

// ─── AI ASSISTANT HOOK ──────────────────────────────────────────────────────────
function useAI(taskContext) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);

  const getSystemPrompt = useCallback(() => {
    const pd = MOCK_PLATFORM_DATA;
    return `You are a research assistant embedded in the vAI Community Research Platform, helping youth researchers in Oloibiri and Ibiade, Nigeria conduct participatory action research.

CURRENT TASK CONTEXT:
- Project: ${taskContext?.projectTitle || "Unknown"}
- Research Question: ${taskContext?.researchQuestion || ""}
- Phase: ${taskContext?.phaseName || ""}
- Sub-task: ${taskContext?.taskName || ""}
- Validation Required: ${taskContext?.validation || ""}

REAL PLATFORM DATA (from vAI Supabase):
- Total AI sessions across platform: ${pd.totalSessions}
- Average proficiency score: ${pd.proficiencyAvg}/3.0 (UNESCO 0–3 scale)
- Active researchers: ${pd.activeResearchers}
- Oloibiri survey responses: ${pd.siteSurveys.Oloibiri}/100
- Ibiade survey responses: ${pd.siteSurveys.Ibiade}/80
- Proficiency trend (Jan–May 2026): ${pd.recentTrend.map(d => `${d.month}: ${d.score}`).join(", ")}

YOUR ROLE:
1. SCAFFOLD the task step by step — break it into clear, manageable actions
2. REFERENCE real platform data when relevant to ground the research
3. SUGGEST draft text that the researcher can edit and use directly (clearly marked with <<DRAFT TEXT START>> and <<DRAFT TEXT END>>)
4. ASK clarifying questions to deepen the researcher's thinking
5. FLAG when a finding needs validation and explain what that means

BOUNDARIES:
- Do not interpret findings FOR them — ask questions that help them interpret
- Celebrate progress and maintain motivation
- Write at a clear, accessible level — many researchers are 16–22 years old
- Keep responses focused and practical — 2–4 short paragraphs max unless they ask for more
- When showing draft text, make it genuine and grounded in the actual data

Always start a new conversation by introducing yourself briefly and asking one specific question about where they are in the task.`;
  }, [taskContext]);

  const initConversation = useCallback(async () => {
    setLoading(true);
    setMessages([]);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: getSystemPrompt(),
          messages: [{ role: "user", content: "I'm starting this task. Please introduce yourself and help me get started." }],
        }),
      });
      const data = await res.json();
      const text = data.content?.find(b => b.type === "text")?.text || "";
      setMessages([{ role: "ai", text, ts: Date.now() }]);
    } catch (e) {
      setMessages([{ role: "ai", text: "Hi! I'm your research assistant. I'm here to help you work through this task step by step. What have you done so far, and where are you feeling stuck?", ts: Date.now() }]);
    }
    setLoading(false);
  }, [getSystemPrompt]);

  const send = useCallback(async (userMsg, history) => {
    setLoading(true);
    const msgs = [...history.map(m => ({ role: m.role === "ai" ? "assistant" : "user", content: m.text })), { role: "user", content: userMsg }];
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: getSystemPrompt(),
          messages: msgs,
        }),
      });
      const data = await res.json();
      const text = data.content?.find(b => b.type === "text")?.text || "I'm having trouble connecting. Please try again.";
      setMessages(prev => [...prev, { role: "ai", text, ts: Date.now() }]);
    } catch {
      setMessages(prev => [...prev, { role: "ai", text: "Connection issue — please try again.", ts: Date.now() }]);
    }
    setLoading(false);
  }, [getSystemPrompt]);

  return { messages, loading, initConversation, send, setMessages };
}

// ─── PARSE AI MESSAGE for draft text ────────────────────────────────────────────
function ParsedMessage({ text, onUseDraft }) {
  const draftMatch = text.match(/<<DRAFT TEXT START>>([\s\S]*?)<<DRAFT TEXT END>>/);
  const draftText = draftMatch ? draftMatch[1].trim() : null;
  const cleanText = text.replace(/<<DRAFT TEXT START>>[\s\S]*?<<DRAFT TEXT END>>/, "").trim();

  return (
    <div>
      <div style={{ whiteSpace: "pre-wrap" }}>{cleanText}</div>
      {draftText && (
        <div className="suggested-text">
          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: C.gold, fontWeight: 600, marginBottom: 4 }}>Suggested Draft Text</div>
          <div style={{ fontStyle: "normal", lineHeight: 1.6 }}>{draftText}</div>
          <div className="suggested-text-actions">
            <button className="use-text-btn" onClick={() => onUseDraft(draftText)}>Use This</button>
            <span style={{ fontSize: 11, color: C.muted, alignSelf: "center" }}>Edit freely before saving</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── AI CHAT PANEL ───────────────────────────────────────────────────────────────
function AIChatPanel({ task, phase, project, onUseDraft }) {
  const taskContext = {
    projectTitle: project?.title,
    researchQuestion: project?.question,
    phaseName: phase?.name,
    taskName: task?.name,
    validation: task?.validation,
  };
  const { messages, loading, initConversation, send, setMessages } = useAI(taskContext);
  const [input, setInput] = useState("");
  const msgsRef = useRef(null);

  useEffect(() => {
    if (task) initConversation();
  }, [task?.id]);

  useEffect(() => {
    if (msgsRef.current) msgsRef.current.scrollTop = msgsRef.current.scrollHeight;
  }, [messages]);

  const handleSend = () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", text: userMsg, ts: Date.now() }]);
    send(userMsg, messages);
  };

  if (!task) return null;

  return (
    <div className="ai-panel">
      <div className="ai-panel-header">
        <div className="ai-status-dot" />
        <span className="ai-panel-title">Research Assistant — AI Facilitator</span>
        <div style={{ marginLeft: "auto", fontSize: 11, color: "rgba(255,255,255,0.5)" }}>
          Live platform data connected
        </div>
      </div>
      <div className="ai-msgs" ref={msgsRef}>
        {messages.length === 0 && !loading && (
          <div style={{ textAlign: "center", color: C.muted, fontSize: 13, fontStyle: "italic", padding: "20px 0" }}>
            Starting session…
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`ai-msg ${m.role === "user" ? "user" : ""}`}>
            <div className={`msg-avatar ${m.role}`}>
              {m.role === "ai" ? "A" : "You"}
            </div>
            <div className={`msg-bubble ${m.role}`}>
              {m.role === "ai" ? (
                <ParsedMessage text={m.text} onUseDraft={onUseDraft} />
              ) : m.text}
            </div>
          </div>
        ))}
        {loading && (
          <div className="ai-msg">
            <div className="msg-avatar ai">A</div>
            <div className="msg-bubble typing">Thinking…</div>
          </div>
        )}
      </div>
      <div className="ai-input-row">
        <input
          className="ai-inp"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSend()}
          placeholder="Ask for help, share what you found, or request a draft…"
          disabled={loading}
        />
        <button className="ai-send-btn" onClick={handleSend} disabled={loading || !input.trim()}>
          ↑
        </button>
      </div>
    </div>
  );
}

// ─── TASK DETAIL VIEW ────────────────────────────────────────────────────────────
function TaskDetail({ task, phase, project }) {
  const [findings, setFindings] = useState("");
  const [saved, setSaved] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  const handleUseDraft = (text) => {
    setFindings(prev => prev ? prev + "\n\n" + text : text);
    showToast("Draft text added to your findings — edit freely.");
  };

  const handleSave = () => {
    setSaved(true);
    showToast("Findings saved ✓");
    setTimeout(() => setSaved(false), 2000);
  };

  const pd = MOCK_PLATFORM_DATA;

  // Mock prior entries for the active task
  const priorEntries = task?.status === "active" || task?.status === "complete" ? [
    { date: "May 14, 2026", researcher: "Amara O.", text: "Completed 12 follow-up proficiency assessments in Oloibiri. Average score moved from 1.8 to 2.1 between February and April. Noticed that learners who used the AI Playground more than 5x per week showed bigger gains." },
    { date: "May 11, 2026", researcher: "Silas Clergy", text: "Cross-checked 8 learner records against session logs. All 8 showed proficiency gains. One outlier — Emmanuel B. dropped from 2.3 to 1.9 — flagging for interview follow-up." },
  ] : [];

  return (
    <div className="task-detail">
      {/* Header */}
      <div className="detail-header">
        <div className="detail-phase-label">{phase?.name} · {project?.shortTitle}</div>
        <div className="detail-title">{task?.name}</div>
        <div className="detail-meta">
          <span className="detail-chip">Due: {task?.due}</span>
          <span className="detail-chip" style={{ color: task?.status === "complete" ? C.success : task?.status === "active" ? C.warn : C.muted }}>
            {statusIcon(task?.status)} {task?.status}
          </span>
        </div>
      </div>

      {/* Info Cards */}
      <div className="info-cards">
        <div className="info-card" style={setAccent(project?.color)}>
          <div className="info-card-label">Validation Required</div>
          <div className="info-card-body">{task?.validation}</div>
        </div>
        <div className="info-card" style={setAccent(project?.color)}>
          <div className="info-card-label">Live Platform Data</div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, color: project?.color, fontFamily: "'Playfair Display', serif" }}>{pd.proficiencyAvg}</div>
              <div style={{ fontSize: 10, color: C.muted }}>Avg proficiency</div>
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, color: project?.color, fontFamily: "'Playfair Display', serif" }}>{pd.totalSessions}</div>
              <div style={{ fontSize: 10, color: C.muted }}>Total sessions</div>
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, color: project?.color, fontFamily: "'Playfair Display', serif" }}>{pd.siteSurveys.Oloibiri}</div>
              <div style={{ fontSize: 10, color: C.muted }}>Surveys (Oloibiri)</div>
            </div>
          </div>
        </div>
      </div>

      {/* Prior Progress */}
      {priorEntries.length > 0 && (
        <div className="progress-section">
          <div className="progress-section-title">
            <span style={{ color: C.success }}>✓</span> Prior Progress on This Task
          </div>
          {priorEntries.map((e, i) => (
            <div key={i} className="prior-entry">
              <div className="prior-entry-head">
                <span style={{ fontWeight: 600, color: C.navy }}>{e.researcher}</span>
                <span>{e.date}</span>
              </div>
              {e.text}
            </div>
          ))}
        </div>
      )}

      {/* Findings Input */}
      <div className="findings-box">
        <div className="findings-header">
          <span>Record Your Findings</span>
          <span style={{ color: C.muted, fontWeight: 400, textTransform: "none", letterSpacing: 0, fontSize: 11 }}>
            Use the AI assistant below for help drafting
          </span>
        </div>
        <textarea
          className="findings-area"
          value={findings}
          onChange={e => setFindings(e.target.value)}
          placeholder="Describe what you found, observed, or concluded during this sub-task. The AI assistant can help you draft text — it will appear here for you to edit."
        />
        <div className="findings-footer">
          <button className="save-btn" onClick={handleSave} disabled={!findings.trim()}>
            {saved ? "Saved ✓" : "Save Findings"}
          </button>
        </div>
      </div>

      {/* AI Panel */}
      <AIChatPanel task={task} phase={phase} project={project} onUseDraft={handleUseDraft} />

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

// ─── PROJECT PAGE ────────────────────────────────────────────────────────────────
function ProjectPage({ project, onBack }) {
  const [activePhaseId, setActivePhaseId] = useState(
    project.phases.find(p => p.status === "active")?.id || 1
  );
  const [activeTaskId, setActiveTaskId] = useState(null);

  const activePhase = project.phases.find(p => p.id === activePhaseId);
  const activeTask = activePhase?.tasks?.find(t => t.id === activeTaskId);

  const phaseDoneCount = project.phases.filter(p => p.status === "complete").length;

  return (
    <div style={setAccent(project.color)}>
      {/* Project Header */}
      <div className="project-header" style={setAccent(project.color)}>
        <div className="project-header-domain" style={{ color: project.color }}>{project.domain}</div>
        <div className="project-header-title">{project.icon} {project.title}</div>
        <div className="project-header-q">{project.question}</div>
        <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ fontSize: 12, color: C.mid }}>
            Phase {phaseDoneCount} of 5 complete ·
          </div>
          {project.phases.map(ph => (
            <div key={ph.id} style={{
              width: 28, height: 6, borderRadius: 3,
              background: ph.status === "complete" ? project.color : ph.status === "active" ? project.color + "55" : C.sand,
              transition: "background 0.3s"
            }} />
          ))}
        </div>
      </div>

      {/* Phase Tabs */}
      <div className="phase-rail" style={setAccent(project.color)}>
        {project.phases.map(ph => (
          <button
            key={ph.id}
            className={`phase-tab ${ph.id === activePhaseId ? "active" : ""} ${ph.status === "locked" ? "locked" : ""}`}
            style={setAccent(project.color)}
            onClick={() => { if (ph.status !== "locked") { setActivePhaseId(ph.id); setActiveTaskId(null); } }}
          >
            <div className={`phase-tab-status ${ph.status}`} />
            Phase {ph.id}: {ph.name}
            {ph.status === "complete" && <div className="phase-tab-badge" style={{ background: project.color }}>✓</div>}
          </button>
        ))}
      </div>

      {/* Phase Body */}
      <div className="phase-body" style={setAccent(project.color)}>
        {/* Task List */}
        <div className="task-list">
          <div className="task-list-title">Sub-Tasks — {activePhase?.name}</div>
          {activePhase?.tasks?.length === 0 && (
            <div style={{ padding: "20px", fontSize: 13, color: C.muted, fontStyle: "italic" }}>
              {activePhase.status === "locked" ? "Complete prior phases to unlock tasks." : "Tasks will appear here."}
            </div>
          )}
          {activePhase?.tasks?.map(task => (
            <div
              key={task.id}
              className={`task-item ${task.id === activeTaskId ? "active" : ""} ${task.status === "locked" ? "locked" : ""}`}
              style={setAccent(project.color)}
              onClick={() => { if (task.status !== "locked") setActiveTaskId(task.id === activeTaskId ? null : task.id); }}
            >
              <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <div className={`task-status-dot ${task.status}`} style={{ marginTop: 5 }} />
                <div>
                  <div className="task-item-name">{task.name}</div>
                  <div className="task-item-meta">
                    <span>Due: {task.due}</span>
                    <span style={{ color: task.status === "complete" ? C.success : task.status === "active" ? C.gold : C.muted }}>
                      {task.status}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Badge info */}
          <div style={{ margin: "20px 16px 0", padding: "12px 14px", background: C.parchment, borderRadius: 8, border: `1px solid ${C.sand}` }}>
            <div style={{ fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: project.color, fontWeight: 600, marginBottom: 4 }}>Phase Badge</div>
            <div style={{ fontSize: 13, color: C.navy, fontWeight: 600 }}>{activePhase?.badge}</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Certified by University of Dayton</div>
          </div>
        </div>

        {/* Task Detail or Empty */}
        {activeTask ? (
          <TaskDetail task={activeTask} phase={activePhase} project={project} />
        ) : (
          <div className="task-detail">
            <div className="task-detail-empty">
              <div className="task-detail-empty-icon">🔬</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: C.navy }}>Select a sub-task to begin</div>
              <div style={{ fontSize: 13, color: C.muted, maxWidth: 260 }}>
                Choose from the list to see your progress, validation requirements, and AI research assistant.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── SIGNUP FORM ─────────────────────────────────────────────────────────────────
function SignupForm({ project, onSuccess, onCancel }) {
  const [site, setSite] = useState("Oloibiri");
  const [members, setMembers] = useState([{ name: "", email: "" }]);
  const [submitting, setSubmitting] = useState(false);

  const addMember = () => setMembers(m => [...m, { name: "", email: "" }]);
  const removeMember = (i) => setMembers(m => m.filter((_, j) => j !== i));
  const updateMember = (i, field, val) => setMembers(m => m.map((mb, j) => j === i ? { ...mb, [field]: val } : mb));

  const valid = members.every(m => m.name.trim() && m.email.trim()) && site;

  const handleSubmit = async () => {
    setSubmitting(true);
    await new Promise(r => setTimeout(r, 1000));
    setSubmitting(false);
    onSuccess({ members, site, project });
  };

  return (
    <div style={{ padding: "40px 32px", maxWidth: 680, margin: "0 auto" }}>
      <div className="signup-panel" style={setAccent(project.color)}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 36 }}>{project.icon}</div>
          <div>
            <div className="signup-head">Join Research Team</div>
            <div style={{ fontSize: 13, color: C.mid, fontStyle: "italic" }}>{project.title}</div>
          </div>
        </div>

        <label className="form-label">Research Site</label>
        <div className="site-selector">
          {["Oloibiri", "Ibiade"].map(s => (
            <button key={s} className={`site-chip ${site === s ? "active" : ""}`} onClick={() => setSite(s)}>{s}</button>
          ))}
        </div>

        <label className="form-label">Team Members</label>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 10, fontStyle: "italic" }}>
          Add everyone joining this research project — each person will use their existing vAI account.
        </div>

        {members.map((m, i) => (
          <div key={i} className="member-row">
            <input
              className="inp"
              placeholder="Full name"
              value={m.name}
              onChange={e => updateMember(i, "name", e.target.value)}
            />
            <input
              className="inp"
              placeholder="Email / vAI username"
              value={m.email}
              onChange={e => updateMember(i, "email", e.target.value)}
            />
            {members.length > 1 && (
              <button className="remove-btn" onClick={() => removeMember(i)}>×</button>
            )}
          </div>
        ))}

        <button className="add-member-btn" onClick={addMember}>+ Add team member</button>

        <div style={{ marginTop: 20, padding: "12px 14px", background: C.parchment, borderRadius: 8, border: `1px solid ${C.sand}`, fontSize: 12, color: C.mid, lineHeight: 1.6 }}>
          <strong style={{ color: C.navy }}>What you're signing up for:</strong> 12-month research program with monthly commitments (~4–6 hours/month). All research earns a University of Dayton credential on completion.
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <button className="primary-btn" onClick={handleSubmit} disabled={!valid || submitting} style={{ flex: 1 }}>
            {submitting ? "Registering…" : "Join Research Program"}
          </button>
          <button onClick={onCancel} style={{ padding: "13px 18px", border: `1.5px solid ${C.sand}`, background: "none", borderRadius: 10, cursor: "pointer", fontSize: 14, color: C.mid, fontFamily: "'Playfair Display', serif" }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN LANDING ────────────────────────────────────────────────────────────────
function ResearchLanding({ onSelectProject, onSignup }) {
  return (
    <div>
      <div className="landing-hero">
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <div className="hero-eyebrow">vAI Research Platform</div>
          <h1 className="hero-title">Youth-Led Community Research</h1>
          <p className="hero-sub">You are not just a learner — you are a researcher. Join a study team, investigate real questions, and earn a University of Dayton research credential.</p>
          <div className="hero-stats">
            <div className="hero-stat">
              <div className="hero-stat-val">20</div>
              <div className="hero-stat-lbl">Active Researchers</div>
            </div>
            <div className="hero-stat">
              <div className="hero-stat-val">3</div>
              <div className="hero-stat-lbl">Open Studies</div>
            </div>
            <div className="hero-stat">
              <div className="hero-stat-val">1,607</div>
              <div className="hero-stat-lbl">AI Sessions Tracked</div>
            </div>
            <div className="hero-stat">
              <div className="hero-stat-val">5</div>
              <div className="hero-stat-lbl">Credential Badges</div>
            </div>
          </div>
        </div>
      </div>

      {/* Research Projects */}
      <div className="section" style={{ maxWidth: 960 + 64, margin: "0 auto" }}>
        <div className="section-title">Open Research Projects</div>
        <div className="section-sub">Choose a study to join. You can participate in more than one.</div>
        <div className="project-grid">
          {RESEARCH_PROJECTS.map(proj => {
            const donePhases = proj.phases.filter(p => p.status === "complete").length;
            const activePhase = proj.phases.find(p => p.status === "active");
            return (
              <div key={proj.id} className="project-card" style={setAccent(proj.color)} onClick={() => onSelectProject(proj)}>
                <div className="project-card-domain">{proj.domain}</div>
                <div className="project-card-title">{proj.icon} {proj.title}</div>
                <div className="project-card-q">{proj.question}</div>
                <div className="project-card-footer">
                  <div>
                    <div style={{ fontSize: 10, color: C.muted, marginBottom: 4 }}>Phase Progress</div>
                    <div className="phase-pills">
                      {proj.phases.map(ph => (
                        <div key={ph.id} className={`phase-pill ${ph.status === "complete" ? "done" : ph.status === "active" ? "active" : ""}`} style={{ background: ph.status === "complete" ? proj.color : ph.status === "active" ? proj.color + "66" : C.sand }} />
                      ))}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button className="join-btn" style={setAccent(proj.color)} onClick={e => { e.stopPropagation(); onSignup(proj); }}>Join Team</button>
                    <button onClick={e => { e.stopPropagation(); onSelectProject(proj); }} style={{ padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, border: `1.5px solid ${C.sand}`, background: "none", color: C.mid, cursor: "pointer", fontFamily: "'Source Serif 4', serif" }}>Open</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* How It Works */}
        <div style={{ marginTop: 48 }}>
          <div className="section-title">How the Research Program Works</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14, marginTop: 20 }}>
            {[
              { step: "01", title: "Join a Team", desc: "Sign yourself and collaborators up. No join code needed." },
              { step: "02", title: "Work Through Phases", desc: "Each phase has specific tasks with clear validation requirements." },
              { step: "03", title: "AI-Assisted Research", desc: "Your AI assistant scaffolds tasks, pulls platform data, and drafts text for you to edit." },
              { step: "04", title: "Earn Your Credential", desc: "Complete all 5 phases to earn the University of Dayton Community Research Scholar certificate." },
            ].map(item => (
              <div key={item.step} style={{ background: C.white, border: `1px solid ${C.sand}`, borderRadius: 10, padding: "18px 16px" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.gold, letterSpacing: 2, marginBottom: 6 }}>{item.step}</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: C.navy, marginBottom: 6, fontFamily: "'Playfair Display', serif" }}>{item.title}</div>
                <div style={{ fontSize: 12, color: C.mid, lineHeight: 1.55 }}>{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── ROOT APP ────────────────────────────────────────────────────────────────────
export default function ResearchPlatform() {
  const [view, setView] = useState("landing"); // landing | project | signup | success
  const [selectedProject, setSelectedProject] = useState(null);
  const [signupProject, setSignupProject] = useState(null);
  const [mockUser] = useState({ name: "Amara Osei", site: "Oloibiri", initials: "AO" });

  const handleSelectProject = (proj) => {
    setSelectedProject(proj);
    setView("project");
  };

  const handleSignup = (proj) => {
    setSignupProject(proj);
    setView("signup");
  };

  const handleSignupSuccess = (data) => {
    setView("success");
  };

  const getBreadcrumbs = () => {
    if (view === "landing") return [{ label: "Research", action: null }];
    if (view === "project") return [{ label: "Research", action: () => setView("landing") }, { label: selectedProject?.shortTitle }];
    if (view === "signup") return [{ label: "Research", action: () => setView("landing") }, { label: "Join Team" }];
    return [{ label: "Research", action: () => setView("landing") }];
  };

  return (
    <div className="rp-root">
      <StyleTag />

      <div className="rp-shell">
        {/* ── Sidebar ── */}
        <Sidebar activeKey="research" user={mockUser} />

        {/* ── Main content ── */}
        <div className="rp-main">

          {/* Topbar */}
          <div className="topbar">
            <div className="topbar-brand">
              <span className="topbar-logo">vAI</span>
              <div className="topbar-divider" />
              <span className="topbar-section">Research Program</span>
            </div>
            {/* Home button in topbar (mirrors sidebar, visible on narrow viewports) */}
            <a
              href="https://nextvillage.community/home"
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "5px 12px", borderRadius: 6,
                background: `${C.gold}18`, border: `1px solid ${C.gold}44`,
                color: C.gold, fontSize: 12, fontWeight: 700,
                fontFamily: "'Source Serif 4', serif",
                textDecoration: "none", letterSpacing: 0.3,
              }}
            >
              🏠 Home
            </a>
          </div>

          {/* Breadcrumb */}
          <div className="breadcrumb">
            {getBreadcrumbs().map((crumb, i) => (
              <span key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {i > 0 && <span className="breadcrumb-sep">›</span>}
                {crumb.action ? (
                  <button className="breadcrumb-btn" onClick={crumb.action}>{crumb.label}</button>
                ) : (
                  <span style={{ color: C.charcoal, fontWeight: 500 }}>{crumb.label}</span>
                )}
              </span>
            ))}
          </div>

          {/* Views */}
          {view === "landing" && (
            <ResearchLanding onSelectProject={handleSelectProject} onSignup={handleSignup} />
          )}

          {view === "project" && selectedProject && (
            <ProjectPage project={selectedProject} onBack={() => setView("landing")} />
          )}

          {view === "signup" && signupProject && (
            <SignupForm
              project={signupProject}
              onSuccess={handleSignupSuccess}
              onCancel={() => setView("landing")}
            />
          )}

          {view === "success" && (
            <div style={{ padding: "80px 32px", textAlign: "center", maxWidth: 500, margin: "0 auto" }}>
              <div style={{ fontSize: 56, marginBottom: 16 }}>🎉</div>
              <h2 style={{ fontSize: 26, color: C.navy, marginBottom: 10 }}>You're on the research team!</h2>
              <p style={{ fontSize: 15, color: C.mid, marginBottom: 28, lineHeight: 1.6, fontStyle: "italic" }}>
                Your team has been registered. You can now access all active phases and begin working with the AI research assistant.
              </p>
              <button className="primary-btn" style={{ maxWidth: 300, margin: "0 auto" }} onClick={() => setView("landing")}>
                Go to Research Dashboard
              </button>
            </div>
          )}

        </div>{/* /rp-main */}
      </div>{/* /rp-shell */}
    </div>
  );
}