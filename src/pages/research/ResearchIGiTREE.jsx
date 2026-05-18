import { useState, useEffect, useRef, useCallback } from "react";

// ─── DESIGN TOKENS — iGiTREE palette ─────────────────────────────────────────
const C = {
  forest:   "#1A3A2A",
  forestMd: "#2A5A3F",
  forestLt: "#3D7A57",
  moss:     "#6B8F5E",
  sage:     "#A8C5A0",
  amber:    "#D4A843",
  amberLt:  "#E8C878",
  teal:     "#2A7B7B",
  tealLt:   "#3D9E9E",
  slate:    "#2D3F4A",
  ink:      "#1A2530",
  parchment:"#F4F1EB",
  cream:    "#FAFAF6",
  sand:     "#E8E4D8",
  sandDk:   "#D0CABC",
  white:    "#FFFFFF",
  charcoal: "#2D2D2D",
  mid:      "#6B6560",
  muted:    "#9A9490",
  success:  "#2E7D32",
  warn:     "#B35A00",
  warnLt:   "#FFF3E0",
  error:    "#C62828",
};

// ─── iGiTREE RESEARCH STRUCTURE ──────────────────────────────────────────────
const IGTREE_PROJECT = {
  id: "igitree",
  title: "iGiTREE Genomics & Biodiversity Platform",
  shortTitle: "iGiTREE Genomics",
  domain: "Applied Genomics & AI Surveillance",
  tagline: "African Genomic Equity · AI Disease Surveillance · Livestock Genetics",
  description: "Youth researchers contribute to supervised genomic data collection, laboratory workflows, and data quality assurance across human genomics, livestock genetics, and AI-driven disease surveillance.",
  icon: "🧬",
  sites: ["Kigali, Rwanda", "Accra, Ghana (Year 2)", "Dar es Salaam (Year 2)"],
  partners: ["iGiTREE (Kigali)", "Roslin Institute (Edinburgh)", "Rwanda Biomedical Centre", "Rwanda Agricultural Board", "Illumina"],
  credentialPartner: "University of Dayton / Temple University (proposed)",
  color: C.forestLt,
  supervisedResearch: true,
  phases: [
    {
      id: 1, phaseNum: 1, name: "Infrastructure & Consent", months: "1–3",
      badge: "Research Infrastructure",
      status: "active",
      description: "IRB protocol, community consent processes, sample collection SOPs, data governance charter. No data collection begins until this phase is fully complete.",
      safetyNote: "All activities in this phase are administrative and protocol-based. No biological samples are handled.",
      tasks: [
        {
          id: "g1_1", name: "IRB Protocol Orientation",
          status: "complete", due: "Week 2",
          validation: "Completion quiz score ≥ 80% + supervisor sign-off",
          description: "Study the approved IRB protocol for the human genomics component. Understand the scope of review, what Temple's IRB covers vs. Rwanda National Ethics Committee.",
          aiRole: "explain",
          outputs: ["IRB orientation quiz", "Protocol comprehension notes"],
          supervisionLevel: "direct",
        },
        {
          id: "g1_2", name: "Informed Consent Training",
          status: "complete", due: "Week 3",
          validation: "Role-play assessment with supervisor + documentation",
          description: "Learn and practice the informed consent process: community sensitization, individual written consent, Kinyarwanda/English back-translation, right to withdraw.",
          aiRole: "explain",
          outputs: ["Consent role-play record", "Language competency check"],
          supervisionLevel: "direct",
        },
        {
          id: "g1_3", name: "Sample Collection SOP Study",
          status: "active", due: "Week 4–6",
          validation: "SOP competency checklist signed by lab supervisor",
          description: "Study buccal swab and blood sample collection SOPs. Learn chain of custody, cold chain requirements, labeling protocols, and biohazard safety procedures.",
          aiRole: "explain",
          outputs: ["SOP competency checklist", "Safety certification"],
          supervisionLevel: "direct",
        },
        {
          id: "g1_4", name: "Data Governance Charter Review",
          status: "pending", due: "Week 6–8",
          validation: "Written summary demonstrating understanding of data sovereignty provisions",
          description: "Review the data governance charter covering Rwanda national data sovereignty, permitted uses, embargo periods, and community benefit return channels.",
          aiRole: "explain",
          outputs: ["Governance summary document"],
          supervisionLevel: "indirect",
        },
        {
          id: "g1_5", name: "Community Sensitization Support",
          status: "pending", due: "Week 8–12",
          validation: "Supervisor field observation + community feedback log",
          description: "Assist with community-level sensitization sessions under direct supervision. Document community questions, concerns, and consent rates.",
          aiRole: "document",
          outputs: ["Community sensitization log", "Enrollment baseline data"],
          supervisionLevel: "direct",
        },
      ]
    },
    {
      id: 2, phaseNum: 2, name: "Pilot Data Collection", months: "4–9",
      badge: "Field Research Methods (Genomics)",
      status: "locked",
      description: "Human DNA sample collection, livestock genotyping, environmental biodiversity sampling, AI model training data generation. All sample handling under direct scientific supervision.",
      safetyNote: "⚠️ Biological sample handling requires completion of Phase 1 and supervisor clearance. Youth researchers do not handle blood samples without a trained scientist present.",
      tasks: [
        {
          id: "g2_1", name: "Buccal Swab Collection (supervised)",
          status: "locked", due: "Month 4–5",
          validation: "Chain-of-custody log complete + supervisor countersignature on each sample batch",
          description: "Collect consented buccal swab samples under direct supervision. Apply SOP, complete chain-of-custody documentation, and maintain cold chain integrity.",
          aiRole: "document",
          outputs: ["Completed chain-of-custody logs", "Sample batch records"],
          supervisionLevel: "direct",
        },
        {
          id: "g2_2", name: "Livestock Sample Collection — Inyambo Cattle",
          status: "locked", due: "Month 5–6",
          validation: "RAB co-supervisor sign-off + genotyping submission confirmation",
          description: "Assist with ear tissue collection from Inyambo cattle and crossbreeds under Rwanda Agricultural Board and Roslin Institute supervision.",
          aiRole: "document",
          outputs: ["Livestock sample log", "RAB documentation"],
          supervisionLevel: "direct",
        },
        {
          id: "g2_3", name: "Environmental DNA (eDNA) Sampling",
          status: "locked", due: "Month 6–7",
          validation: "Sampling protocol adherence checklist + GPS coordinates logged",
          description: "Collect soil and water samples for environmental biodiversity eDNA analysis. Apply field sampling protocols; record GPS coordinates, collection conditions, and chain of custody.",
          aiRole: "scaffold",
          outputs: ["eDNA field collection log", "GPS-tagged sample manifest"],
          supervisionLevel: "indirect",
        },
        {
          id: "g2_4", name: "Data Quality Assurance — Genotyping Inputs",
          status: "locked", due: "Month 7–8",
          validation: "QA checklist reviewed by bioinformatics lead; error rate <2%",
          description: "Review incoming Illumina array data for completeness, labeling accuracy, and sample-to-manifest matching. Flag anomalies for the bioinformatics lead.",
          aiRole: "assist_qa",
          outputs: ["QA checklist", "Anomaly flag report"],
          supervisionLevel: "indirect",
        },
        {
          id: "g2_5", name: "AI Training Dataset Labeling",
          status: "locked", due: "Month 8–9",
          validation: "Inter-rater reliability ≥85% with reference labeler",
          description: "Label environmental and demographic metadata to support AI surveillance model training. Work from defined taxonomies.",
          aiRole: "scaffold",
          outputs: ["Labeled dataset contribution log", "Inter-rater reliability score"],
          supervisionLevel: "indirect",
        },
      ]
    },
    {
      id: 3, phaseNum: 3, name: "Analysis & Integration", months: "10–18",
      badge: "Bioinformatics & AI Analysis",
      status: "locked",
      description: "Bioinformatic pipeline analysis, AI model training and validation, national database integration, preliminary publication drafting.",
      safetyNote: "Analysis phase. No biological sample handling. AI assistance is most expansive here.",
      tasks: [
        {
          id: "g3_1", name: "Bioinformatic Pipeline Walkthrough",
          status: "locked", due: "Month 10–11",
          validation: "Pipeline comprehension assessment + documented run attempt",
          description: "Learn the bioinformatic analysis pipeline used for Illumina array data. Understand variant calling, QC filtering, and population stratification steps.",
          aiRole: "scaffold",
          outputs: ["Pipeline walkthrough notes", "Annotated pipeline diagram"],
          supervisionLevel: "indirect",
        },
        {
          id: "g3_2", name: "Population Genomics Data Exploration",
          status: "locked", due: "Month 11–13",
          validation: "Supervised data exploration report reviewed by co-PI",
          description: "Explore anonymized population genomic datasets. Identify population clusters, allele frequency distributions, and variants of potential clinical significance under bioinformatics supervision.",
          aiRole: "scaffold",
          outputs: ["Exploratory analysis report", "Annotated visualizations"],
          supervisionLevel: "indirect",
        },
        {
          id: "g3_3", name: "AI Surveillance Model — Evaluation Support",
          status: "locked", due: "Month 13–15",
          validation: "Evaluation metrics documented + reviewed by AI methods lead",
          description: "Support evaluation of AI infectious disease surveillance models. Learn precision/recall tradeoffs, subgroup performance analysis, and how to interpret model outputs responsibly.",
          aiRole: "scaffold",
          outputs: ["Model evaluation summary", "Subgroup analysis contribution"],
          supervisionLevel: "indirect",
        },
        {
          id: "g3_4", name: "Database Contribution — NCBI / H3Africa",
          status: "locked", due: "Month 15–16",
          validation: "Submission confirmation + accession numbers logged",
          description: "Assist with preparation of environmental and biodiversity eDNA datasets for deposit to NCBI and African genomic repositories. Understand open science data standards.",
          aiRole: "scaffold",
          outputs: ["Submission documentation", "Accession number log"],
          supervisionLevel: "indirect",
        },
        {
          id: "g3_5", name: "Manuscript Contribution — Methods & Youth Section",
          status: "locked", due: "Month 16–18",
          validation: "Co-author attribution confirmed by PI + draft section submitted",
          description: "Draft the methods section describing youth researcher contributions and the capacity-building model. This section is publishable as a standalone paper in Global Health Education.",
          aiRole: "scaffold",
          outputs: ["Draft methods section", "Capacity-building narrative"],
          supervisionLevel: "indirect",
        },
      ]
    }
  ]
};

// ─── PLATFORM CONTEXT ────────────────────────────────────────────────────────
const PLATFORM_CONTEXT = {
  siteActive: "Kigali, Rwanda",
  pilotCohortSize: 12,
  samplesCollectedHuman: 0,
  samplesCollectedLivestock: 0,
  ednaSamplesCollected: 0,
  qaPassRate: null,
  phaseStatus: "Phase 1 active — consent and protocol training",
  keyPartners: "iGiTREE (Kigali), Roslin Institute, Rwanda Biomedical Centre, Rwanda Agricultural Board",
  illuminaPlatform: "iScan genotyping arrays",
  targetMechanisms: "NIH Fogarty D43, R21, NSF IRES, Wellcome Trust, Gates Grand Challenges",
};

// ─── STYLES ──────────────────────────────────────────────────────────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,600&family=DM+Sans:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');

  * { box-sizing: border-box; margin: 0; padding: 0; }

  .ig-root {
    font-family: 'DM Sans', system-ui, sans-serif;
    background: ${C.cream};
    min-height: 100vh;
    color: ${C.charcoal};
  }
  .ig-root h1, .ig-root h2, .ig-root h3 {
    font-family: 'Cormorant Garamond', Georgia, serif;
  }

  .ig-topbar {
    background: ${C.ink};
    padding: 0 28px;
    height: 52px;
    display: flex; align-items: center; justify-content: space-between;
    position: sticky; top: 0; z-index: 100;
    border-bottom: 1px solid ${C.forestLt}44;
  }
  .ig-brand { display: flex; align-items: center; gap: 10px; }
  .ig-logo {
    font-family: 'Cormorant Garamond', serif;
    font-size: 18px; font-weight: 700; color: ${C.white};
    letter-spacing: 1px;
  }
  .ig-logo span { color: ${C.amber}; }
  .ig-divider { width: 1px; height: 18px; background: ${C.forestLt}55; }
  .ig-section {
    font-size: 11px; letter-spacing: 2px; text-transform: uppercase;
    color: ${C.sage}; font-weight: 500;
  }
  .ig-user {
    display: flex; align-items: center; gap: 8px;
    font-size: 12px; color: rgba(255,255,255,0.6);
  }
  .ig-avatar {
    width: 26px; height: 26px; border-radius: 50%;
    background: ${C.forestMd}; border: 1px solid ${C.forestLt}66;
    display: flex; align-items: center; justify-content: center;
    font-size: 10px; color: ${C.sage}; font-weight: 700;
  }

  .ig-breadcrumb {
    display: flex; align-items: center; gap: 6px;
    padding: 10px 28px; background: ${C.forest}11;
    border-bottom: 1px solid ${C.sand};
    font-size: 12px; color: ${C.mid};
  }
  .ig-bc-btn {
    background: none; border: none; cursor: pointer;
    color: ${C.forestLt}; font-size: 12px; padding: 2px 4px;
    border-radius: 3px; font-family: 'DM Sans', sans-serif;
  }
  .ig-bc-btn:hover { background: ${C.forestLt}18; }

  .supervision-badge {
    display: inline-flex; align-items: center; gap: 5px;
    padding: 3px 10px; border-radius: 10px; font-size: 10px;
    font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase;
  }
  .supervision-badge.direct {
    background: ${C.error}18; color: ${C.error};
    border: 1px solid ${C.error}33;
  }
  .supervision-badge.indirect {
    background: ${C.amber}18; color: ${C.warn};
    border: 1px solid ${C.amber}44;
  }

  .ai-role-badge {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 2px 8px; border-radius: 8px; font-size: 10px;
    font-weight: 600; letter-spacing: 0.3px;
    background: ${C.slate}18; color: ${C.slate};
    border: 1px solid ${C.slate}22;
  }

  .ig-hero {
    background: linear-gradient(150deg, ${C.ink} 0%, ${C.forest} 55%, ${C.forestMd}99 100%);
    padding: 52px 28px 44px; position: relative; overflow: hidden;
  }
  .ig-hero::after {
    content: '';
    position: absolute; top: 0; right: 0; bottom: 0; width: 40%;
    background: radial-gradient(ellipse at right center, ${C.amber}0B 0%, transparent 70%);
    pointer-events: none;
  }
  .ig-hero-dna {
    position: absolute; right: 28px; top: 50%; transform: translateY(-50%);
    font-size: 120px; opacity: 0.04; pointer-events: none;
    user-select: none; line-height: 1;
  }
  .ig-eyebrow {
    font-size: 10px; letter-spacing: 3px; text-transform: uppercase;
    color: ${C.amber}; font-weight: 600; margin-bottom: 14px;
  }
  .ig-hero-title {
    font-size: 36px; font-weight: 700; color: ${C.white};
    line-height: 1.1; max-width: 600px; margin-bottom: 8px;
  }
  .ig-hero-title span { color: ${C.amber}; font-style: italic; }
  .ig-hero-tagline {
    font-size: 13px; color: ${C.sage}; margin-bottom: 20px;
    letter-spacing: 0.5px;
  }
  .ig-hero-desc {
    font-size: 14px; color: rgba(255,255,255,0.6);
    max-width: 560px; line-height: 1.65; margin-bottom: 28px;
    font-weight: 300;
  }
  .ig-hero-stats { display: flex; gap: 28px; flex-wrap: wrap; }
  .ig-stat-val {
    font-size: 24px; font-weight: 700; color: ${C.white};
    font-family: 'Cormorant Garamond', serif; line-height: 1;
  }
  .ig-stat-lbl {
    font-size: 10px; color: ${C.sage}; letter-spacing: 1px;
    text-transform: uppercase; margin-top: 3px;
  }

  .supervision-banner {
    background: ${C.forest}18; border: 1px solid ${C.forestLt}33;
    border-left: 4px solid ${C.amber};
    padding: 12px 28px; font-size: 13px; color: ${C.forest};
    display: flex; align-items: center; gap: 10px;
  }

  .partner-strip {
    background: ${C.parchment}; border-bottom: 1px solid ${C.sand};
    padding: 10px 28px; display: flex; gap: 8px; align-items: center;
    flex-wrap: wrap;
  }
  .partner-chip {
    font-size: 11px; padding: 3px 10px; border-radius: 10px;
    background: ${C.white}; border: 1px solid ${C.sand};
    color: ${C.mid}; white-space: nowrap;
  }
  .partner-label {
    font-size: 10px; letter-spacing: 1.5px; text-transform: uppercase;
    color: ${C.muted}; font-weight: 600; margin-right: 4px;
  }

  .ig-phase-rail {
    display: flex; overflow-x: auto;
    border-bottom: 1px solid ${C.sand};
    background: ${C.white};
    padding: 0 28px;
  }
  .ig-phase-tab {
    padding: 14px 18px; cursor: pointer; border: none; background: none;
    font-family: 'DM Sans', sans-serif; font-size: 13px; color: ${C.mid};
    border-bottom: 2px solid transparent; white-space: nowrap;
    transition: all 0.2s; display: flex; align-items: center; gap: 7px;
  }
  .ig-phase-tab.active {
    color: ${C.forest}; border-bottom-color: ${C.amber}; font-weight: 600;
  }
  .ig-phase-tab.locked { opacity: 0.35; cursor: not-allowed; }
  .ig-phase-dot { width: 7px; height: 7px; border-radius: 50%; }
  .ig-phase-dot.complete { background: ${C.success}; }
  .ig-phase-dot.active   { background: ${C.amber}; box-shadow: 0 0 0 3px ${C.amber}33; }
  .ig-phase-dot.locked   { background: ${C.sandDk}; }

  .ig-body { display: flex; min-height: calc(100vh - 300px); }

  .ig-task-list {
    width: 300px; flex-shrink: 0; border-right: 1px solid ${C.sand};
    background: ${C.white}; overflow-y: auto;
  }
  .ig-task-list-hdr {
    padding: 16px 18px 8px;
    font-size: 10px; letter-spacing: 1.5px; text-transform: uppercase;
    color: ${C.muted}; font-weight: 600; border-bottom: 1px solid ${C.sand}99;
  }
  .ig-task-item {
    padding: 13px 18px; cursor: pointer; transition: background 0.15s;
    border-left: 3px solid transparent;
  }
  .ig-task-item:hover { background: ${C.cream}; }
  .ig-task-item.active { background: ${C.parchment}; border-left-color: ${C.amber}; }
  .ig-task-item.locked { opacity: 0.4; cursor: not-allowed; }
  .ig-task-name { font-size: 13px; font-weight: 600; color: ${C.forest}; margin-bottom: 4px; }
  .ig-task-meta { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
  .ig-task-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
  .ig-task-dot.complete { background: ${C.success}; }
  .ig-task-dot.active   { background: ${C.amber}; }
  .ig-task-dot.pending  { background: ${C.sandDk}; }
  .ig-task-dot.locked   { background: ${C.sand}; }

  .ig-detail { flex: 1; padding: 24px 28px; background: ${C.cream}; overflow-y: auto; }
  .ig-detail-empty {
    display: flex; flex-direction: column; align-items: center;
    justify-content: center; height: 300px; color: ${C.muted};
    text-align: center; gap: 10px;
  }
  .ig-detail-phase {
    font-size: 10px; letter-spacing: 2px; text-transform: uppercase;
    color: ${C.amber}; font-weight: 600; margin-bottom: 6px;
  }
  .ig-detail-title {
    font-size: 22px; font-weight: 700; color: ${C.forest}; margin-bottom: 6px;
    font-family: 'Cormorant Garamond', serif;
  }
  .ig-detail-chips { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; }
  .ig-chip {
    font-size: 11px; padding: 3px 10px; border-radius: 8px;
    border: 1px solid ${C.sand}; color: ${C.mid}; background: ${C.white};
  }

  .safety-notice {
    padding: 10px 14px; border-radius: 8px; margin-bottom: 14px;
    background: ${C.warn}14; border: 1px solid ${C.amber}44;
    font-size: 12px; color: ${C.warn}; line-height: 1.55;
    display: flex; gap: 8px; align-items: flex-start;
  }

  .ig-info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 16px; }
  .ig-info-card {
    background: ${C.white}; border: 1px solid ${C.sand};
    border-radius: 8px; padding: 12px 14px;
    border-top: 2px solid ${C.amber}44;
  }
  .ig-info-lbl {
    font-size: 9px; letter-spacing: 1.5px; text-transform: uppercase;
    color: ${C.forestLt}; font-weight: 600; margin-bottom: 5px;
  }
  .ig-info-body { font-size: 12px; color: ${C.charcoal}; line-height: 1.55; }

  .output-list { margin: 0 0 14px; padding: 0; list-style: none; }
  .output-item {
    display: flex; align-items: center; gap: 7px;
    font-size: 12px; color: ${C.mid}; padding: 4px 0;
    border-bottom: 1px solid ${C.sand}88;
  }
  .output-item:last-child { border-bottom: none; }
  .output-dot { width: 5px; height: 5px; border-radius: 50%; background: ${C.amber}; flex-shrink: 0; }

  .ai-scope-notice {
    background: ${C.slate}08; border: 1px solid ${C.slate}22;
    border-left: 3px solid ${C.slate}; border-radius: 6px;
    padding: 10px 12px; margin-bottom: 14px;
    font-size: 12px; color: ${C.slate}; line-height: 1.55;
  }
  .ai-scope-notice strong { color: ${C.forest}; }

  .prior-entry {
    background: ${C.white}; border: 1px solid ${C.sand};
    border-radius: 7px; padding: 11px 13px; margin-bottom: 7px;
    font-size: 12px; line-height: 1.55;
  }
  .prior-entry-head {
    display: flex; justify-content: space-between; margin-bottom: 3px;
    font-size: 10px; color: ${C.muted};
  }

  .field-log-box {
    background: ${C.white}; border: 1.5px solid ${C.sand};
    border-radius: 8px; overflow: hidden; margin-top: 14px;
  }
  .field-log-hdr {
    background: ${C.parchment}; padding: 9px 13px; font-size: 10px;
    font-weight: 600; letter-spacing: 1.5px; text-transform: uppercase;
    color: ${C.mid}; border-bottom: 1px solid ${C.sand};
    display: flex; justify-content: space-between; align-items: center;
  }
  .field-log-area {
    width: 100%; min-height: 80px; padding: 11px 13px;
    border: none; outline: none; resize: vertical;
    font-size: 13px; line-height: 1.7; color: ${C.charcoal};
    font-family: 'DM Sans', sans-serif; background: transparent;
  }
  .field-log-footer {
    padding: 8px 13px; border-top: 1px solid ${C.sand};
    display: flex; justify-content: space-between; align-items: center;
  }
  .field-log-note { font-size: 11px; color: ${C.muted}; font-style: italic; }
  .save-btn {
    padding: 6px 14px; border-radius: 6px; font-size: 12px; font-weight: 600;
    background: ${C.forestLt}; color: white; border: none; cursor: pointer;
    font-family: 'DM Sans', sans-serif; transition: background 0.2s;
  }
  .save-btn:hover { background: ${C.forestMd}; }
  .save-btn:disabled { opacity: 0.4; cursor: not-allowed; }

  .ig-ai-panel {
    background: ${C.white}; border: 1px solid ${C.sand};
    border-radius: 10px; overflow: hidden; margin-top: 16px;
    box-shadow: 0 2px 12px rgba(0,0,0,0.05);
  }
  .ig-ai-header {
    background: ${C.ink}; padding: 11px 15px;
    display: flex; align-items: center; gap: 8px;
  }
  .ig-ai-title { font-size: 13px; font-weight: 500; color: white; }
  .ig-ai-dot {
    width: 6px; height: 6px; border-radius: 50%; background: ${C.amber};
    box-shadow: 0 0 0 3px ${C.amber}44;
    animation: igpulse 2.5s infinite;
  }
  @keyframes igpulse { 0%,100% { opacity:1; } 50% { opacity:0.3; } }
  .ig-ai-scope-tag {
    margin-left: auto; font-size: 10px; color: ${C.sage};
    padding: 2px 7px; border-radius: 8px;
    background: ${C.forestLt}22; border: 1px solid ${C.forestLt}33;
    letter-spacing: 0.5px;
  }

  .ig-msgs {
    max-height: 360px; overflow-y: auto; padding: 14px;
    display: flex; flex-direction: column; gap: 10px;
    background: ${C.cream};
  }
  .ig-msg { display: flex; gap: 8px; align-items: flex-start; }
  .ig-msg.user { flex-direction: row-reverse; }
  .ig-msg-av {
    width: 26px; height: 26px; border-radius: 50%; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center; font-size: 11px;
  }
  .ig-msg-av.ai { background: ${C.ink}; color: ${C.amber}; font-weight: 700; font-family: 'Cormorant Garamond', serif; font-size: 13px; }
  .ig-msg-av.user { background: ${C.forestLt}22; color: ${C.forestLt}; font-size: 13px; }
  .ig-bubble {
    max-width: 82%; padding: 9px 13px; border-radius: 10px;
    font-size: 13px; line-height: 1.6;
  }
  .ig-bubble.ai {
    background: ${C.white}; border: 1px solid ${C.sand};
    color: ${C.charcoal}; border-radius: 2px 10px 10px 10px;
    white-space: pre-wrap;
  }
  .ig-bubble.user {
    background: ${C.forest}; color: white;
    border-radius: 10px 2px 10px 10px;
  }
  .ig-bubble.typing {
    background: ${C.white}; border: 1px solid ${C.sand};
    color: ${C.muted}; font-style: italic;
  }
  .ig-draft {
    background: ${C.parchment}; border: 1px solid ${C.sand};
    border-left: 3px solid ${C.amber}; border-radius: 6px;
    padding: 9px 11px; margin-top: 7px; font-size: 12px;
    color: ${C.charcoal};
  }
  .ig-draft-label {
    font-size: 9px; text-transform: uppercase; letter-spacing: 1px;
    color: ${C.amber}; font-weight: 600; margin-bottom: 4px;
  }
  .ig-draft-actions { display: flex; gap: 7px; margin-top: 6px; }
  .use-draft-btn {
    font-size: 11px; padding: 3px 8px; border-radius: 4px;
    background: ${C.amber}; color: white; border: none; cursor: pointer;
    font-weight: 600;
  }

  .ig-input-row {
    display: flex; gap: 7px; padding: 10px 14px;
    border-top: 1px solid ${C.sand}; background: ${C.white};
  }
  .ig-inp {
    flex: 1; padding: 8px 11px; border: 1.5px solid ${C.sand};
    border-radius: 7px; font-size: 13px; outline: none;
    font-family: 'DM Sans', sans-serif; background: ${C.cream};
    transition: border-color 0.2s;
  }
  .ig-inp:focus { border-color: ${C.forestLt}; background: white; }
  .ig-send-btn {
    width: 34px; height: 34px; border-radius: 7px;
    background: ${C.forest}; border: none; cursor: pointer;
    color: white; font-size: 14px; display: flex; align-items: center; justify-content: center;
    transition: background 0.2s; flex-shrink: 0;
  }
  .ig-send-btn:hover { background: ${C.forestMd}; }
  .ig-send-btn:disabled { opacity: 0.35; cursor: not-allowed; }

  .ig-toast {
    position: fixed; bottom: 20px; right: 20px;
    background: ${C.forest}; color: white; padding: 10px 16px;
    border-radius: 8px; font-size: 13px; z-index: 1000;
    box-shadow: 0 4px 20px rgba(0,0,0,0.2);
    animation: igSlideUp 0.3s ease-out;
    border-left: 3px solid ${C.amber};
  }
  @keyframes igSlideUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
`;

// ─── AI ROLE DESCRIPTIONS ────────────────────────────────────────────────────
const AI_ROLE_LABELS = {
  explain:   { label: "Explain only",        desc: "AI explains concepts and background. No procedural guidance — all process decisions go to your supervisor." },
  document:  { label: "Document help",       desc: "AI helps you structure and write field logs and records. AI does not guide sample handling or consent decisions." },
  assist_qa: { label: "QA pattern detection",desc: "AI can flag data patterns. All actual QA decisions must be reviewed by the bioinformatics lead." },
  scaffold:  { label: "Scaffold & draft",    desc: "AI can guide you through analysis steps, suggest drafts, and explain methods in depth." },
};

// ─── AI HOOK ─────────────────────────────────────────────────────────────────
function useIGAI(taskContext) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);

  const systemPrompt = useCallback(() => {
    const role = taskContext?.aiRole || "explain";
    const roleDesc = AI_ROLE_LABELS[role]?.desc || "";
    const ctx = PLATFORM_CONTEXT;

    const boundaryInstructions = {
      explain: `Your role is EXPLAIN ONLY. You can explain scientific concepts, terminology, and background. You CANNOT guide specific procedural steps in sample collection or consent. Always remind the researcher to verify procedural questions with their supervisor.`,
      document: `Your role is DOCUMENTATION HELP. You can help structure field log entries and draft text the researcher can edit. You CANNOT guide consent conversations or sample handling steps. Note that required fields should be confirmed with the supervisor.`,
      assist_qa: `Your role is QA PATTERN DETECTION SUPPORT. You can explain what makes a good vs. anomalous data record and help draft anomaly flag reports. You CANNOT make final QA decisions. All flagging decisions must go to the bioinformatics lead.`,
      scaffold: `Your role is SCAFFOLD & DRAFT. You can walk the researcher through analysis steps, explain bioinformatic methods, and generate clearly marked draft text. Note when a question exceeds your scope and needs the PI or bioinformatics lead.`,
    };

    return `You are a research assistant for the iGiTREE Genomics & Biodiversity Platform, supporting youth researchers (ages 18–26) in Kigali, Rwanda.

THIS IS SUPERVISED SCIENTIFIC RESEARCH. Youth work under direct scientific supervision. Role boundaries are defined by IRB protocol.

CURRENT TASK CONTEXT:
- Phase: ${taskContext?.phaseName}
- Task: ${taskContext?.taskName}
- Supervision level: ${taskContext?.supervisionLevel === "direct" ? "DIRECT — supervisor must be physically present" : "Indirect — supervisor available by communication"}
- Validation required: ${taskContext?.validation}

YOUR SPECIFIC ROLE FOR THIS TASK:
${boundaryInstructions[role] || boundaryInstructions.explain}

STUDY CONTEXT:
- Site: ${ctx.siteActive}
- Cohort size: ${ctx.pilotCohortSize} youth researchers
- Current phase: ${ctx.phaseStatus}
- Partners: ${ctx.keyPartners}
- Technology: Illumina ${ctx.illuminaPlatform}

KEY SCIENTIFIC BACKGROUND:
- Less than 3% of GWAS participants are of African ancestry — this research directly fills that gap
- Inyambo cattle are genetically under-characterized; data supports food security and conservation goals
- Rwanda retains national data sovereignty over all genomic data generated in-country

TONE: Clear and accessible (researchers are 18–26, new to genomics). Encouraging but precise. When generating draft text, mark it: <<DRAFT START>> ... <<DRAFT END>>. Keep responses to 2–4 paragraphs unless more detail is requested.`;
  }, [taskContext]);

  const initConversation = useCallback(async () => {
    setLoading(true);
    setMessages([]);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": import.meta.env.VITE_ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-calls": "true",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-5",
          max_tokens: 1000,
          system: systemPrompt(),
          messages: [{ role: "user", content: "I'm starting this task. Please introduce yourself, tell me what you can help with, and ask me one focused question to get started." }],
        }),
      });
      const data = await res.json();
      const text = data.content?.find(b => b.type === "text")?.text || "";
      setMessages([{ role: "ai", text, ts: Date.now() }]);
    } catch {
      setMessages([{ role: "ai", text: `Hi — I'm your research assistant for the iGiTREE study. For this task (${taskContext?.taskName}), I can help you ${AI_ROLE_LABELS[taskContext?.aiRole]?.desc?.toLowerCase() || "understand the background"}. Where would you like to start?`, ts: Date.now() }]);
    }
    setLoading(false);
  }, [systemPrompt, taskContext]);

  const send = useCallback(async (userMsg, history) => {
    setLoading(true);
    const msgs = [
      ...history.map(m => ({ role: m.role === "ai" ? "assistant" : "user", content: m.text })),
      { role: "user", content: userMsg },
    ];
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": import.meta.env.VITE_ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-calls": "true",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-5",
          max_tokens: 1000,
          system: systemPrompt(),
          messages: msgs,
        }),
      });
      const data = await res.json();
      const text = data.content?.find(b => b.type === "text")?.text || "Connection issue — please try again.";
      setMessages(prev => [...prev, { role: "ai", text, ts: Date.now() }]);
    } catch {
      setMessages(prev => [...prev, { role: "ai", text: "Connection issue — please try again.", ts: Date.now() }]);
    }
    setLoading(false);
  }, [systemPrompt]);

  return { messages, loading, initConversation, send, setMessages };
}

// ─── PARSED AI MESSAGE ────────────────────────────────────────────────────────
function IGMessage({ text, onUseDraft }) {
  const draftMatch = text.match(/<<DRAFT START>>([\s\S]*?)<<DRAFT END>>/);
  const draft = draftMatch ? draftMatch[1].trim() : null;
  const clean = text.replace(/<<DRAFT START>>[\s\S]*?<<DRAFT END>>/, "").trim();
  return (
    <div>
      <div style={{ whiteSpace: "pre-wrap" }}>{clean}</div>
      {draft && (
        <div className="ig-draft">
          <div className="ig-draft-label">Suggested Draft</div>
          <div>{draft}</div>
          <div className="ig-draft-actions">
            <button className="use-draft-btn" onClick={() => onUseDraft(draft)}>Use This</button>
            <span style={{ fontSize: 11, color: C.muted, alignSelf: "center" }}>Edit before saving</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── AI PANEL ────────────────────────────────────────────────────────────────
function IGAIPanel({ task, phase, onUseDraft }) {
  const taskContext = {
    phaseName: phase?.name,
    taskName: task?.name,
    validation: task?.validation,
    aiRole: task?.aiRole,
    supervisionLevel: task?.supervisionLevel,
  };
  const { messages, loading, initConversation, send, setMessages } = useIGAI(taskContext);
  const [input, setInput] = useState("");
  const msgsRef = useRef(null);

  useEffect(() => { if (task) initConversation(); }, [task?.id]);
  useEffect(() => {
    if (msgsRef.current) msgsRef.current.scrollTop = msgsRef.current.scrollHeight;
  }, [messages]);

  const handleSend = () => {
    if (!input.trim() || loading) return;
    const msg = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", text: msg, ts: Date.now() }]);
    send(msg, messages);
  };

  const roleInfo = AI_ROLE_LABELS[task?.aiRole] || AI_ROLE_LABELS.explain;

  return (
    <div className="ig-ai-panel">
      <div className="ig-ai-header">
        <div className="ig-ai-dot" />
        <span className="ig-ai-title">Research Assistant</span>
        <span className="ig-ai-scope-tag">{roleInfo.label}</span>
      </div>
      <div className="ai-scope-notice" style={{ margin: "12px 12px 0", borderRadius: 6 }}>
        <strong>AI scope for this task:</strong> {roleInfo.desc}
      </div>
      <div className="ig-msgs" ref={msgsRef}>
        {messages.length === 0 && !loading && (
          <div style={{ textAlign: "center", color: C.muted, fontSize: 13, fontStyle: "italic", padding: "16px 0" }}>
            Starting session…
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`ig-msg ${m.role === "user" ? "user" : ""}`}>
            <div className={`ig-msg-av ${m.role}`}>{m.role === "ai" ? "G" : "You"}</div>
            <div className={`ig-bubble ${m.role}`}>
              {m.role === "ai" ? <IGMessage text={m.text} onUseDraft={onUseDraft} /> : m.text}
            </div>
          </div>
        ))}
        {loading && (
          <div className="ig-msg">
            <div className="ig-msg-av ai">G</div>
            <div className="ig-bubble typing">Thinking…</div>
          </div>
        )}
      </div>
      <div className="ig-input-row">
        <input
          className="ig-inp"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSend()}
          placeholder="Ask a question, request an explanation, or get help drafting…"
          disabled={loading}
        />
        <button className="ig-send-btn" onClick={handleSend} disabled={loading || !input.trim()}>↑</button>
      </div>
    </div>
  );
}

// ─── TASK DETAIL ─────────────────────────────────────────────────────────────
function IGTaskDetail({ task, phase }) {
  const [log, setLog] = useState("");
  const [saved, setSaved] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  const handleUseDraft = (text) => {
    setLog(prev => prev ? prev + "\n\n" + text : text);
    showToast("Draft added to your field log — review and edit.");
  };

  const priorEntries = (task?.status === "active" || task?.status === "complete") ? [
    {
      date: "May 15, 2026", researcher: "Kagiso M.",
      text: "Completed SOP study sections 1–3 (buccal swab collection). Passed safety checklist items 1–8. Pending: cold chain and biohazard disposal sections. Supervisor note: strong on documentation, review chain-of-custody numbering protocol before sign-off."
    }
  ] : [];

  return (
    <div className="ig-detail">
      {/* Header */}
      <div style={{ marginBottom: 16, paddingBottom: 14, borderBottom: `1px solid ${C.sand}` }}>
        <div className="ig-detail-phase">{phase?.name} · iGiTREE Genomics</div>
        <div className="ig-detail-title">{task?.name}</div>
        <div className="ig-detail-chips">
          <span className="ig-chip">Due: {task?.due}</span>
          <span className={`supervision-badge ${task?.supervisionLevel}`}>
            {task?.supervisionLevel === "direct" ? "🔴 Direct supervision required" : "🟡 Indirect supervision"}
          </span>
          <span className="ai-role-badge">
            🤖 AI: {AI_ROLE_LABELS[task?.aiRole]?.label}
          </span>
        </div>
      </div>

      {task?.supervisionLevel === "direct" && (
        <div className="safety-notice">
          <span>⚠️</span>
          <span>This task requires your supervisor to be physically present. Do not begin sample handling or consent procedures without supervisor confirmation.</span>
        </div>
      )}

      <div className="ig-info-grid">
        <div className="ig-info-card">
          <div className="ig-info-lbl">Validation Required</div>
          <div className="ig-info-body">{task?.validation}</div>
        </div>
        <div className="ig-info-card">
          <div className="ig-info-lbl">Task Description</div>
          <div className="ig-info-body">{task?.description}</div>
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", color: C.forestLt, fontWeight: 600, marginBottom: 8 }}>
          Required Outputs
        </div>
        <ul className="output-list">
          {task?.outputs?.map((o, i) => (
            <li key={i} className="output-item">
              <div className="output-dot" />
              {o}
            </li>
          ))}
        </ul>
      </div>

      {priorEntries.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.forest, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ color: C.success }}>✓</span> Prior Progress
          </div>
          {priorEntries.map((e, i) => (
            <div key={i} className="prior-entry">
              <div className="prior-entry-head">
                <span style={{ fontWeight: 600, color: C.forest }}>{e.researcher}</span>
                <span>{e.date}</span>
              </div>
              {e.text}
            </div>
          ))}
        </div>
      )}

      <div className="field-log-box">
        <div className="field-log-hdr">
          <span>Field Log / Documentation Entry</span>
          <span style={{ color: C.muted, fontWeight: 400, textTransform: "none", letterSpacing: 0, fontSize: 11 }}>
            Record what you did, observed, or completed
          </span>
        </div>
        <textarea
          className="field-log-area"
          value={log}
          onChange={e => setLog(e.target.value)}
          placeholder="Document your work on this task. Include: what you did, when, who supervised, any issues encountered, and what you still need to complete."
        />
        <div className="field-log-footer">
          <span className="field-log-note">
            {task?.supervisionLevel === "direct" ? "Supervisor countersignature required for final submission." : "Faculty review before badge issuance."}
          </span>
          <button
            className="save-btn"
            onClick={() => { setSaved(true); showToast("Field log saved ✓"); setTimeout(() => setSaved(false), 2000); }}
            disabled={!log.trim()}
          >
            {saved ? "Saved ✓" : "Save Log"}
          </button>
        </div>
      </div>

      <IGAIPanel task={task} phase={phase} onUseDraft={handleUseDraft} />

      {toast && <div className="ig-toast">{toast}</div>}
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function IGiTREEResearchPage() {
  const proj = IGTREE_PROJECT;
  const [activePhaseId, setActivePhaseId] = useState(1);
  const [activeTaskId, setActiveTaskId] = useState(null);

  const activePhase = proj.phases.find(p => p.id === activePhaseId);
  const activeTask = activePhase?.tasks?.find(t => t.id === activeTaskId);

  return (
    <div className="ig-root">
      <style>{css}</style>

      {/* Topbar */}
      <div className="ig-topbar">
        <div className="ig-brand">
          <span className="ig-logo">i<span>Gi</span>TREE</span>
          <div className="ig-divider" />
          <span className="ig-section">Genomics Research</span>
        </div>
        <div className="ig-user">
          <div className="ig-avatar">KM</div>
          <span>Kagiso M.</span>
          <span style={{ color: C.amber, fontSize: 11, marginLeft: 4 }}>Kigali</span>
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="ig-breadcrumb">
        <span style={{ color: C.charcoal, fontWeight: 500 }}>iGiTREE Genomics</span>
        {activeTask && (
          <>
            <span style={{ color: C.sandDk }}>›</span>
            <span>{activePhase?.name}</span>
            <span style={{ color: C.sandDk }}>›</span>
            <span>{activeTask?.name}</span>
          </>
        )}
      </div>

      {/* Hero */}
      <div className="ig-hero">
        <div className="ig-hero-dna">🧬</div>
        <div style={{ maxWidth: 900 }}>
          <div className="ig-eyebrow">Unova Labs · iGiTREE Platform · Supervised Scientific Research</div>
          <h1 className="ig-hero-title">
            African <span>Genomics</span> &amp;<br />Biodiversity Research
          </h1>
          <div className="ig-hero-tagline">{proj.tagline}</div>
          <p className="ig-hero-desc">{proj.description}</p>
          <div className="ig-hero-stats">
            {[
              { val: "18 mo", lbl: "Pilot Program" },
              { val: "3",     lbl: "Research Domains" },
              { val: "5",     lbl: "Partner Institutions" },
              { val: "5+",    lbl: "Target Publications" },
            ].map(s => (
              <div key={s.lbl}>
                <div className="ig-stat-val">{s.val}</div>
                <div className="ig-stat-lbl">{s.lbl}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Supervision banner */}
      <div className="supervision-banner">
        <span>🔬</span>
        <span>
          <strong>Supervised scientific research.</strong> All biological sample handling and human subject interactions require direct supervisor presence. This platform supports documentation, learning, and field logging — not independent procedural decisions.
        </span>
      </div>

      {/* Partner strip */}
      <div className="partner-strip">
        <span className="partner-label">Partners</span>
        {proj.partners.map(p => <span key={p} className="partner-chip">{p}</span>)}
        <span className="partner-chip" style={{ background: C.parchment, color: C.forestLt, fontWeight: 600 }}>
          Credential: {proj.credentialPartner}
        </span>
      </div>

      {/* Phase Tabs */}
      <div className="ig-phase-rail">
        {proj.phases.map(ph => (
          <button
            key={ph.id}
            className={`ig-phase-tab ${ph.id === activePhaseId ? "active" : ""} ${ph.status === "locked" ? "locked" : ""}`}
            onClick={() => { if (ph.status !== "locked") { setActivePhaseId(ph.id); setActiveTaskId(null); } }}
          >
            <div className={`ig-phase-dot ${ph.status}`} />
            Phase {ph.phaseNum}: {ph.name}
            {ph.status === "complete" && (
              <span style={{ fontSize: 10, background: C.success, color: "white", padding: "1px 5px", borderRadius: 7, fontWeight: 700 }}>✓</span>
            )}
          </button>
        ))}
      </div>

      {/* Phase context bar */}
      {activePhase && (
        <div style={{
          padding: "10px 28px", background: C.white, borderBottom: `1px solid ${C.sand}`,
          display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap"
        }}>
          <div style={{ fontSize: 12, color: C.mid, flex: 1, fontStyle: "italic" }}>{activePhase.description}</div>
          {activePhase.safetyNote && (
            <div style={{ fontSize: 11, color: C.warn, background: C.warnLt, padding: "4px 10px", borderRadius: 6, border: `1px solid ${C.amber}44` }}>
              {activePhase.safetyNote}
            </div>
          )}
        </div>
      )}

      {/* Body */}
      <div className="ig-body">
        {/* Task list */}
        <div className="ig-task-list">
          <div className="ig-task-list-hdr">Sub-Tasks — {activePhase?.name}</div>
          {activePhase?.tasks?.map(task => (
            <div
              key={task.id}
              className={`ig-task-item ${task.id === activeTaskId ? "active" : ""} ${task.status === "locked" ? "locked" : ""}`}
              onClick={() => { if (task.status !== "locked") setActiveTaskId(task.id === activeTaskId ? null : task.id); }}
            >
              <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <div className={`ig-task-dot ${task.status}`} style={{ marginTop: 5 }} />
                <div>
                  <div className="ig-task-name">{task.name}</div>
                  <div className="ig-task-meta">
                    <span style={{ fontSize: 11, color: C.muted }}>Due: {task.due}</span>
                    <span className={`supervision-badge ${task.supervisionLevel}`} style={{ fontSize: 9, padding: "1px 5px" }}>
                      {task.supervisionLevel === "direct" ? "Direct" : "Indirect"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}

          <div style={{ margin: "16px 14px 0", padding: "11px 13px", background: C.parchment, borderRadius: 7, border: `1px solid ${C.sand}` }}>
            <div style={{ fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase", color: C.amber, fontWeight: 600, marginBottom: 3 }}>Phase Badge</div>
            <div style={{ fontSize: 13, color: C.forest, fontWeight: 600 }}>{activePhase?.badge}</div>
            <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>Credentialed by UD / Temple</div>
          </div>
        </div>

        {/* Task detail or empty state */}
        {activeTask ? (
          <IGTaskDetail task={activeTask} phase={activePhase} />
        ) : (
          <div className="ig-detail">
            <div className="ig-detail-empty">
              <div style={{ fontSize: 40, opacity: 0.35 }}>🧬</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: C.forest, fontFamily: "'Cormorant Garamond', serif" }}>
                Select a sub-task
              </div>
              <div style={{ fontSize: 13, color: C.muted, maxWidth: 240 }}>
                Choose a task to see requirements, prior progress, and your AI research assistant.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
