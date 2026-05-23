// src/pages/PublicLandingPage.tsx
//
// Public-facing landing page — no auth required.
// Pulls live cohort data from assessments_monthly_global.
//
// Add to App.tsx:
//   import PublicLandingPage from './pages/PublicLandingPage';
//   <Route path="/" element={<PublicLandingPage />} />
//   (remove or keep the existing Navigate to="/home" fallback as preferred)

import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import {
  ArrowRight, Mail, Linkedin, MessageCircle, Sparkles,
  Globe, ChevronDown, Brain, Code, ImagePlus, Briefcase, Heart,
  BookOpen, ExternalLink,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface GlobalRow {
  period_label:              string;
  organization_name:         string | null;
  learner_count:             number;
  assessed_count:            number;
  sessions_count:            number;
  avg_mean:                  number | null;
  avg_delta:                 number | null;
  role_ready_count:          number | null;
  converging_count:          number | null;
  structured_l3_pct:         number | null;
  pue_learner_pct:           number | null;
  certs_total:               number | null;
  cognitive_mean:            number | null;
  critical_thinking_mean:    number | null;
  problem_solving_mean:      number | null;
  creativity_mean:           number | null;
  pue_mean:                  number | null;
}

// ─── Research types ──────────────────────────────────────────────────────────

interface ResearchProgram {
  id: string;
  slug: string;
  title: string;
  description: string;
  sites: string[];
  is_active: boolean;
}

interface GuidingQuestion {
  id: string;
  program_id: string;
  slug: string;
  title: string;
  short_title: string;
  domain: string;
  research_question: string;
  icon: string;
  color_hex: string;
  sites: string[];
}

// ─── Animated counter hook ────────────────────────────────────────────────────

function useCountUp(target: number, duration = 1600) {
  const [count, setCount] = useState(0);
  const started = useRef(false);
  const isVisible = useRef(false);
  const ref = useRef<HTMLDivElement>(null);

  // When target arrives (data loads), re-trigger if already visible
  useEffect(() => {
    if (!target) return;
    started.current = false; // reset so animation can fire with real value
    if (isVisible.current) {
      started.current = true;
      const t0 = performance.now();
      const tick = (now: number) => {
        const p = Math.min((now - t0) / duration, 1);
        const e = 1 - Math.pow(1 - p, 3);
        setCount(Math.floor(e * target));
        if (p < 1) requestAnimationFrame(tick);
        else setCount(target);
      };
      requestAnimationFrame(tick);
    }
  }, [target, duration]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        isVisible.current = entry.isIntersecting;
        if (entry.isIntersecting && !started.current && target > 0) {
          started.current = true;
          const t0 = performance.now();
          const tick = (now: number) => {
            const p = Math.min((now - t0) / duration, 1);
            const e = 1 - Math.pow(1 - p, 3);
            setCount(Math.floor(e * target));
            if (p < 1) requestAnimationFrame(tick);
            else setCount(target);
          };
          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []); // mount/unmount only — target changes handled above

  return { count, ref };
}

// ─── Stat card ────────────────────────────────────────────────────────────────

const StatCard: React.FC<{
  value: number; suffix?: string; label: string; sub?: string; accent: string;
}> = ({ value, suffix = "", label, sub, accent }) => {
  const { count, ref } = useCountUp(value);
  return (
    <div ref={ref} style={{
      background: "rgba(255,255,255,0.06)",
      border: "1px solid rgba(255,255,255,0.11)",
      borderRadius: 14, padding: "1.75rem 1.25rem",
      textAlign: "center", backdropFilter: "blur(8px)",
      position: "relative", overflow: "hidden",
    }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: accent }} />
      <div style={{
        fontFamily: "'Playfair Display', serif",
        fontSize: "clamp(2.2rem,5vw,3.2rem)",
        fontWeight: 900, color: "#fff", lineHeight: 1, marginBottom: "0.4rem",
      }}>
        {count.toLocaleString()}{suffix}
      </div>
      <div style={{ fontSize: "0.75rem", fontWeight: 700, color: accent, textTransform: "uppercase", letterSpacing: "0.1em" }}>
        {label}
      </div>
      {sub && <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.38)", marginTop: "0.2rem" }}>{sub}</div>}
    </div>
  );
};

// ─── Score bar ────────────────────────────────────────────────────────────────

const ScoreBar: React.FC<{ label: string; value: number | null; color: string }> = ({ label, value, color }) => {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!value) return;
    // Small delay ensures the browser paints width:0 first, then transitions to target
    const t = setTimeout(() => setWidth(value), 120);
    return () => clearTimeout(t);
  }, [value]);
  return (
    <div style={{ marginBottom: "0.8rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.28rem" }}>
        <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "rgba(255,255,255,0.65)" }}>{label}</span>
        <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#fff" }}>{value?.toFixed(0) ?? "—"}</span>
      </div>
      <div style={{ height: 5, background: "rgba(255,255,255,0.09)", borderRadius: 99, overflow: "hidden" }}>
        <div style={{
          height: "100%", width: `${width}%`,
          background: color, borderRadius: 99,
          transition: "width 1.4s cubic-bezier(0.16,1,0.3,1)",
        }} />
      </div>
    </div>
  );
};

// ─── Programme card ───────────────────────────────────────────────────────────

const ProgramCard: React.FC<{
  icon: React.ReactNode; title: string; desc: string;
  items: string[]; accent: string; bg: string;
}> = ({ icon, title, desc, items, accent, bg }) => (
  <div style={{
    background: bg, borderRadius: 16,
    border: `1px solid ${accent}28`,
    padding: "1.75rem", position: "relative", overflow: "hidden",
    transition: "transform 0.2s, box-shadow 0.2s",
  }}
    onMouseEnter={e => {
      (e.currentTarget as HTMLDivElement).style.transform = "translateY(-4px)";
      (e.currentTarget as HTMLDivElement).style.boxShadow = `0 16px 40px ${accent}22`;
    }}
    onMouseLeave={e => {
      (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
      (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
    }}
  >
    <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: accent }} />
    <div style={{
      width: 44, height: 44, borderRadius: 12, background: `${accent}18`,
      display: "flex", alignItems: "center", justifyContent: "center",
      color: accent, marginBottom: "1rem",
    }}>{icon}</div>
    <h3 style={{
      fontFamily: "'Playfair Display', serif", fontSize: "1.1rem",
      fontWeight: 700, color: "#1a1208", margin: "0 0 0.5rem",
    }}>{title}</h3>
    <p style={{ fontSize: "0.87rem", color: "rgba(26,18,8,0.63)", lineHeight: 1.65, margin: "0 0 1rem" }}>{desc}</p>
    <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
      {items.map(item => (
        <li key={item} style={{
          fontSize: "0.79rem", color: "rgba(26,18,8,0.68)",
          display: "flex", alignItems: "flex-start", gap: "0.4rem", marginBottom: "0.32rem",
        }}>
          <span style={{ color: accent, fontWeight: 700, flexShrink: 0 }}>→</span> {item}
        </li>
      ))}
    </ul>
  </div>
);

// ─── Main component ───────────────────────────────────────────────────────────

const PublicLandingPage: React.FC = () => {
  const [latestRow, setLatestRow] = useState<GlobalRow | null>(null);
  const [allRows, setAllRows]     = useState<GlobalRow[]>([]);
  const [loading, setLoading]     = useState(true);
  const [programs, setPrograms]   = useState<ResearchProgram[]>([]);
  const [questions, setQuestions] = useState<GuidingQuestion[]>([]);

  useEffect(() => {
    (async () => {
      const COLS = [
        "period_label", "organization_name", "learner_count", "assessed_count",
        "sessions_count", "avg_mean", "avg_delta", "role_ready_count",
        "converging_count", "structured_l3_pct", "pue_learner_pct", "certs_total",
        "cognitive_mean", "critical_thinking_mean", "problem_solving_mean",
        "creativity_mean", "pue_mean"
      ].join(", ");

      // Fetch Davidson AI Innovation Center rows by name.
      // When additional orgs join, this becomes a dropdown — one query per selected org.
      const { data, error } = await supabase
        .from("assessments_monthly_global")
        .select(COLS)
        .ilike("organization_name", "%Davidson%")
        .order("period_start", { ascending: false });

      if (error) {
        console.error("[PublicLandingPage] Supabase error:", error.message, error.code);
      }
      console.log("[PublicLandingPage] rows returned:", data?.length ?? 0, data?.[0]);

      if (data?.length) {
        setLatestRow(data[0] as GlobalRow);
        setAllRows(data as GlobalRow[]);
      }
      setLoading(false);

      // Fetch research programs and guiding questions (public, no auth)
      const [{ data: progData }, { data: qData }] = await Promise.all([
        supabase.from('research_programs').select('id,slug,title,description,sites,is_active').eq('is_active', true).order('created_at'),
        supabase.from('research_guiding_questions').select('id,program_id,slug,title,short_title,domain,research_question,icon,color_hex,sites').eq('is_active', true).order('domain'),
      ]);
      if (progData) setPrograms(progData as ResearchProgram[]);
      if (qData)    setQuestions(qData as GuidingQuestion[]);
    })();
  }, []);

  const latest = latestRow;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=DM+Sans:wght@400;500;600;700&display=swap');
        .lp *, .lp *::before, .lp *::after { box-sizing: border-box; }
        .lp { font-family: 'DM Sans', sans-serif; color: #1a1208; overflow-x: hidden; }
        .lp a { text-decoration: none; }

        .pub-btn {
          display: inline-flex; align-items: center; gap: 0.4rem;
          padding: 0.7rem 1.5rem; border-radius: 8px;
          font-size: 0.9rem; font-weight: 700; cursor: pointer;
          border: none; transition: transform 0.15s, opacity 0.15s;
          text-decoration: none;
        }
        .pub-btn:hover { transform: translateY(-2px); opacity: 0.9; }
        .btn-amber { background: #d97706; color: #fff; }
        .btn-outline { background: transparent; color: #fff; border: 2px solid rgba(255,255,255,0.38); }
        .btn-outline:hover { border-color: #fff; }

        .nav-lnk {
          font-size: 0.85rem; font-weight: 600;
          color: rgba(255,255,255,0.8); text-decoration: none;
          border-bottom: 2px solid transparent;
          padding-bottom: 2px;
          transition: color 0.15s, border-color 0.15s;
        }
        .nav-lnk:hover { color: #fff; border-color: #d97706; }

        .prog-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 1.25rem;
        }

        .contact-card {
          background: #fff; border-radius: 14px;
          border: 1px solid rgba(26,18,8,0.08);
          padding: 1.75rem;
          box-shadow: 0 2px 14px rgba(26,18,8,0.05);
          display: flex; flex-direction: column; gap: 0.6rem;
        }

        .long-table { width: 100%; border-collapse: collapse; font-size: 0.81rem; }
        .long-table th {
          padding: 0.55rem 1rem; text-align: left;
          font-size: 0.69rem; font-weight: 700; text-transform: uppercase;
          letter-spacing: 0.08em; color: rgba(255,255,255,0.38);
          border-bottom: 1px solid rgba(255,255,255,0.07);
        }
        .long-table td {
          padding: 0.65rem 1rem;
          color: rgba(255,255,255,0.72);
          border-bottom: 1px solid rgba(255,255,255,0.04);
        }
        .long-table tbody tr:first-child td { color: #fff; font-weight: 600; }
        .long-table tbody tr:hover td { background: rgba(255,255,255,0.03); }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(22px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .fu  { animation: fadeUp 0.7s ease both; }
        .fu1 { animation-delay: 0.08s; }
        .fu2 { animation-delay: 0.2s; }
        .fu3 { animation-delay: 0.32s; }

        @keyframes bob {
          0%,100% { transform: translateX(-50%) translateY(0); }
          50%      { transform: translateX(-50%) translateY(8px); }
        }

        @media (max-width: 640px) {
          .hide-sm { display: none !important; }
          .stat-g  { grid-template-columns: 1fr 1fr !important; }
          .score-g { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <div className="lp" style={{ paddingTop: 60 }}>

        {/* ── Navbar ──────────────────────────────────────────────────────── */}
        <nav style={{
          position: "fixed", top: 0, left: 0, right: 0, zIndex: 50,
          background: "rgba(12,18,10,0.9)", backdropFilter: "blur(14px)",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          padding: "0 2rem", height: 60,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.55rem" }}>
            <Sparkles size={17} color="#d97706" />
            <span style={{
              fontFamily: "'Playfair Display', serif",
              fontWeight: 700, fontSize: "0.98rem", color: "#fff",
            }}>
              vAI · Girls AIing &amp; Vibing
            </span>
          </div>
          <div className="hide-sm" style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
            <a href="#impact"     className="nav-lnk">Impact</a>
            <a href="#programmes" className="nav-lnk">Programmes</a>
            <a href="#community"  className="nav-lnk">Join Us</a>
            <a href="#research"   className="nav-lnk">Research</a>
            <a href="#support"    className="nav-lnk">Support</a>
            <Link to="/login" className="pub-btn btn-amber" style={{ padding: "0.42rem 1.1rem", fontSize: "0.82rem" }}>
              Log In / Sign Up
            </Link>
          </div>
        </nav>

        {/* ── Hero ────────────────────────────────────────────────────────── */}
        <div style={{
          position: "relative", minHeight: "100vh",
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          textAlign: "center", padding: "6rem 2rem 4rem",
          overflow: "hidden",
        }}>
          <div style={{
            position: "absolute", inset: 0, zIndex: 0,
            backgroundImage: "url('/home_page_africa.png')",
            backgroundSize: "cover", backgroundPosition: "center 30%",
            filter: "brightness(0.35)",
          }} />
          <div style={{
            position: "absolute", inset: 0, zIndex: 1,
            background: "linear-gradient(180deg,rgba(8,14,6,0.25) 0%,rgba(8,14,6,0.1) 45%,rgba(8,14,6,0.72) 100%)",
          }} />

          <div style={{ position: "relative", zIndex: 2, maxWidth: 840 }}>
            <div className="fu" style={{
              display: "inline-flex", alignItems: "center", gap: "0.45rem",
              background: "rgba(217,119,6,0.16)", border: "1px solid rgba(217,119,6,0.38)",
              borderRadius: 999, padding: "0.32rem 0.9rem",
              fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.1em",
              color: "#fbbf24", textTransform: "uppercase", marginBottom: "1.5rem",
            }}>
              <Globe size={11} /> Nigeria · Ohio · Sub-Saharan Africa &amp; Beyond
            </div>

            <h1 className="fu fu1" style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: "clamp(2.4rem,6.5vw,4.8rem)",
              fontWeight: 900, lineHeight: 1.07, color: "#fff",
              marginBottom: "1.2rem", marginTop: 0,
            }}>
              vAI AIing and Vibing<br />
              <span style={{
                background: "linear-gradient(135deg,#d97706,#fbbf24)",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
              }}>
                Learning &amp; Certification
              </span>
            </h1>

            <p className="fu fu2" style={{
              fontSize: "clamp(0.95rem,2vw,1.15rem)",
              color: "rgba(255,255,255,0.7)", lineHeight: 1.78,
              maxWidth: 660, margin: "0 auto 2.5rem",
            }}>
              AI-scaffolded learning in English skills, artificial intelligence, and tech skills —
              coding, web development, AI agents, image, voice &amp; video creation — plus
              community-impact AI support for farming, fishing, healthcare, animal husbandry,
              and entrepreneurship, along with open-source, community impactful, youth-led distributed 
              research across Sub-Saharan Africa and beyond.
            </p>

            <div className="fu fu3" style={{ display: "flex", gap: "0.9rem", justifyContent: "center", flexWrap: "wrap" }}>
              <a href="#impact" className="pub-btn btn-amber" style={{ fontSize: "1rem", padding: "0.8rem 1.9rem" }}>
                See Our Impact <ArrowRight size={15} />
              </a>
              <a href="#support" className="pub-btn btn-outline" style={{ fontSize: "1rem", padding: "0.8rem 1.9rem" }}>
                Support the Mission
              </a>
            </div>
          </div>

          <div style={{
            position: "absolute", bottom: "2rem", left: "50%",
            zIndex: 2, color: "rgba(255,255,255,0.28)",
            animation: "bob 2s infinite",
          }}>
            <ChevronDown size={22} />
          </div>
        </div>

        {/* ── Impact Stats ─────────────────────────────────────────────────── */}
        <div id="impact" style={{
          background: "linear-gradient(135deg,#0c160a 0%,#162612 50%,#0c160a 100%)",
          padding: "5rem 2rem", position: "relative", overflow: "hidden",
        }}>
          <div style={{
            position: "absolute", top: -80, right: -80,
            width: 340, height: 340, borderRadius: "50%",
            border: "1px solid rgba(217,119,6,0.08)", pointerEvents: "none",
          }} />

          <div style={{ maxWidth: 1100, margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: "2.75rem" }}>
              <div style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#fbbf24", marginBottom: "0.6rem" }}>
                {latest?.organization_name ?? "Davidson AI Innovation Center"} · {latest?.period_label ?? "Live Data"}
              </div>
              <h2 style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: "clamp(1.7rem,4vw,2.7rem)",
                fontWeight: 700, color: "#fff",
                marginBottom: "0.6rem", marginTop: 0,
              }}>
                Real learners. Real communities. Real change.
              </h2>
              {latest?.avg_delta != null && (
                <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "0.88rem", margin: 0 }}>
                  Cohort average{" "}
                  <span style={{ color: latest.avg_delta >= 0 ? "#4ade80" : "#f87171", fontWeight: 700 }}>
                    {latest.avg_delta >= 0 ? "▲" : "▼"}{Math.abs(latest.avg_delta).toFixed(1)} pts
                  </span>{" "}
                  vs prior month
                </p>
              )}
            </div>

            {loading ? (
              <p style={{ color: "rgba(255,255,255,0.35)", textAlign: "center" }}>Loading data…</p>
            ) : (
              <>
                {/* Primary stat grid */}
                <div className="stat-g" style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(155px, 1fr))",
                  gap: "1rem", marginBottom: "2rem",
                }}>
                  <StatCard value={latest?.learner_count  ?? 0} label="Learners Enrolled"    accent="#d97706" />
                  <StatCard value={latest?.assessed_count ?? 0} label="Assessed This Month"  accent="#0d9488" />
                  <StatCard value={latest?.sessions_count ?? 0} label="Learning Sessions"    accent="#7c3aed" />
                  <StatCard value={latest?.certs_total    ?? 0} label="Proficiency Sessions" sub="sessions achieving mastery" accent="#fbbf24" />
                  <StatCard value={latest?.role_ready_count ?? 0} label="Role-Ready" sub="applying skills beyond the platform" accent="#4ade80" />
                  <StatCard value={latest?.converging_count ?? 0} label="Reducing AI Reliance" sub="needing less scaffolding" accent="#a78bfa" />
                </div>

                {/* Score breakdown */}
                <div className="score-g" style={{
                  display: "grid", gridTemplateColumns: "1fr 1fr",
                  gap: "1.5rem",
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  borderRadius: 16, padding: "2rem",
                }}>
                  <div>
                    <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#d97706", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "1.1rem" }}>
                      Skill Dimensions (0–100)
                    </div>
                    <ScoreBar label="Cognitive"         value={latest?.cognitive_mean}         color="#d97706" />
                    <ScoreBar label="Critical Thinking" value={latest?.critical_thinking_mean}  color="#0d9488" />
                    <ScoreBar label="Problem Solving"   value={latest?.problem_solving_mean}    color="#7c3aed" />
                    <ScoreBar label="Creativity"        value={latest?.creativity_mean}         color="#f472b6" />
                    <ScoreBar label="Productive Use"    value={latest?.pue_mean}                color="#4ade80" />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
                    <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#0d9488", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.75rem" }}>
                      Cohort Overall Average
                    </div>
                    <div style={{
                      fontFamily: "'Playfair Display', serif",
                      fontSize: "clamp(3rem,8vw,5rem)",
                      fontWeight: 900, color: "#fff", lineHeight: 1,
                    }}>
                      {latest?.avg_mean?.toFixed(1) ?? "—"}
                    </div>
                    <div style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.38)", marginTop: "0.4rem", marginBottom: "1rem" }}>out of 100</div>

                    {/* Scaffolding convergence bar */}
                    {latest?.structured_l3_pct != null && (
                      <div style={{ width: "100%", marginBottom: "1rem" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.25rem" }}>
                          <span style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.55)" }}>Independent AI Use</span>
                          <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#a78bfa" }}>{latest.structured_l3_pct.toFixed(0)}%</span>
                        </div>
                        <div style={{ height: 4, background: "rgba(255,255,255,0.09)", borderRadius: 99, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${latest.structured_l3_pct}%`, background: "#a78bfa", borderRadius: 99, transition: "width 1.4s cubic-bezier(0.16,1,0.3,1)" }} />
                        </div>
                        <div style={{ fontSize: "0.68rem", color: "rgba(255,255,255,0.35)", marginTop: "0.2rem" }}>learners using AI without guided scaffolding</div>
                      </div>
                    )}

                    <p style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.45)", lineHeight: 1.68, margin: 0, maxWidth: 260 }}>
                      Scores are AI-assessed monthly. As learners grow, many move from structured guided modules toward independent, self-directed AI use — asking their own questions, exploring beyond the curriculum.
                    </p>
                  </div>
                </div>

                {/* Longitudinal table */}
                {allRows.length > 1 && (
                  <div style={{ marginTop: "2rem" }}>
                    <div style={{ fontSize: "0.69rem", fontWeight: 700, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.7rem" }}>
                      Month-over-Month Progress
                    </div>
                    <div style={{ overflowX: "auto" }}>
                      <table className="long-table">
                        <thead>
                          <tr>
                            <th>Period</th>
                            <th>Learners</th>
                            <th>Assessed</th>
                            <th>Sessions</th>
                            <th>Avg Score</th>
                            <th>Δ</th>
                            <th>Role-Ready</th>
                            <th>Certs</th>
                          </tr>
                        </thead>
                        <tbody>
                          {allRows.map((row, i) => (
                            <tr key={i}>
                              <td>{row.period_label}</td>
                              <td>{row.learner_count}</td>
                              <td>{row.assessed_count}</td>
                              <td>{row.sessions_count?.toLocaleString()}</td>
                              <td>{row.avg_mean?.toFixed(1) ?? "—"}</td>
                              <td style={{
                                color: row.avg_delta == null ? "rgba(255,255,255,0.25)"
                                  : row.avg_delta >= 0 ? "#4ade80" : "#f87171",
                                fontWeight: 700,
                              }}>
                                {row.avg_delta == null ? "—"
                                  : `${row.avg_delta >= 0 ? "+" : ""}${row.avg_delta.toFixed(1)}`}
                              </td>
                              <td>{row.role_ready_count ?? "—"}</td>
                              <td>{row.certs_total ?? "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Cohort growth note */}
                    <div style={{
                      marginTop: "1.25rem",
                      background: "rgba(217,119,6,0.1)",
                      border: "1px solid rgba(217,119,6,0.25)",
                      borderRadius: 10,
                      padding: "1rem 1.25rem",
                      display: "flex", alignItems: "flex-start", gap: "0.75rem",
                    }}>
                      <span style={{ fontSize: "1.1rem", flexShrink: 0, marginTop: "0.05rem" }}>📈</span>
                      <p style={{ margin: 0, fontSize: "0.82rem", color: "rgba(255,255,255,0.6)", lineHeight: 1.72 }}>
                        <strong style={{ color: "#fbbf24", fontWeight: 700 }}>We are continuously enrolling new learners.</strong>{" "}
                        Month-over-month score changes reflect cohort composition as much as individual growth —
                        when many new learners join at once, the cohort average naturally shifts downward even as
                        established learners continue to progress. A growing learner count is itself a sign of
                        expanding reach, not declining performance.
                      </p>
                    </div>
                  </div>
                )}

                {/* ── Longitudinal: Persistent Learner Trajectories ─────── */}
                <div style={{
                  marginTop: "2.5rem",
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 16, padding: "2rem",
                }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem", marginBottom: "1.75rem" }}>
                    <div>
                      <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#a78bfa", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.45rem" }}>
                        Longitudinal Evidence · Persistent Learners
                      </div>
                      <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(1.1rem,3vw,1.55rem)", fontWeight: 700, color: "#fff", margin: "0 0 0.4rem" }}>
                        What happens when learners stay
                      </h3>
                      <p style={{ fontSize: "0.83rem", color: "rgba(255,255,255,0.45)", lineHeight: 1.65, margin: 0, maxWidth: 560 }}>
                        33 learners with 2+ monthly assessments across 11 months. Zero prior computer access.
                        Data from: <em>Hallinan, Hao, Davidson &amp; Clergy (2026), World Development submission.</em>
                      </p>
                    </div>
                    <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", flexShrink: 0 }}>
                      {[
                        { num: "2.3×", label: "L3 reasoning growth", color: "#a78bfa" },
                        { num: "58%", label: "less AI scaffolding", color: "#4ade80" },
                        { num: "$6.69", label: "per certification", color: "#fbbf24" },
                      ].map(s => (
                        <div key={s.label} style={{
                          background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
                          borderRadius: 10, padding: "0.75rem 1rem", textAlign: "center", minWidth: 90,
                        }}>
                          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.5rem", fontWeight: 900, color: s.color, lineHeight: 1 }}>{s.num}</div>
                          <div style={{ fontSize: "0.67rem", color: "rgba(255,255,255,0.38)", marginTop: "0.25rem", lineHeight: 1.4 }}>{s.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Reasoning composition stacked bars */}
                  <div style={{ marginBottom: "1.75rem" }}>
                    <div style={{ fontSize: "0.69rem", fontWeight: 700, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.9rem" }}>
                      Reasoning level composition — from prompted response to self-directed enterprise planning
                    </div>
                    {[
                      { label: "1st assess. (n=19)", l0: 8.1, l1: 68.5, l2: 21.5, l3: 10.9, highlight: false },
                      { label: "2nd assess. (n=24)", l0: 8.0, l1: 60.0, l2: 25.1, l3: 18.8, highlight: false },
                      { label: "3rd assess. (n=16)", l0: 8.9, l1: 54.2, l2: 23.2, l3: 24.8, highlight: false },

                    ].map(row => (
                      <div key={row.label} style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "8px" }}>
                        <div style={{ width: 128, fontSize: "0.72rem", color: "rgba(255,255,255,0.38)", textAlign: "right", flexShrink: 0 }}>{row.label}</div>
                        <div style={{ flex: 1, height: 26, display: "flex", borderRadius: 5, overflow: "hidden" }}>
                          <div style={{ width: `${row.l0}%`, background: "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            {row.l0 > 5 && <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", fontWeight: 600 }}>{row.l0}%</span>}
                          </div>
                          <div style={{ width: `${row.l1}%`, background: "#1a4a6e", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <span style={{ fontSize: "9px", color: "#5a9abf", fontWeight: 600 }}>L1 {row.l1}%</span>
                          </div>
                          <div style={{ width: `${row.l2}%`, background: "#1a5c5c", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <span style={{ fontSize: "9px", color: "#4aabab", fontWeight: 600 }}>{row.l2}%</span>
                          </div>
                          <div style={{
                            width: `${row.l3}%`,
                            background: row.highlight ? "#22c58b" : "#15764a",
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}>
                            <span style={{ fontSize: "9px", color: row.highlight ? "#093c25" : "#4adb96", fontWeight: 700 }}>
                              L3 {row.l3}%{row.highlight ? " ↑3×" : ""}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                    <div style={{ display: "flex", gap: "1rem", marginTop: "0.65rem", flexWrap: "wrap" }}>
                      {[
                        { bg: "rgba(255,255,255,0.06)", label: "L0 Definitional" },
                        { bg: "#1a4a6e", label: "L1 Responsive (prompted)" },
                        { bg: "#1a5c5c", label: "L2 Elaborative" },
                        { bg: "#22c58b", label: "L3 Structured — enterprise-ready" },
                      ].map(l => (
                        <div key={l.label} style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "0.7rem", color: "rgba(255,255,255,0.38)" }}>
                          <div style={{ width: 10, height: 10, borderRadius: 2, background: l.bg, border: "1px solid rgba(255,255,255,0.1)", flexShrink: 0 }} />
                          {l.label}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Three columns: scaffolding + role readiness + enterprise */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: "1rem" }}>

                    {/* Scaffolding decline */}
                    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "1.25rem" }}>
                      <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "#4ade80", textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: "0.75rem" }}>
                        AI scaffolding demand
                      </div>
                      {[
                        { label: "1st (n=19)", val: 6.63, pct: 100, caution: false },
                        { label: "2nd (n=24)", val: 3.97, pct: 60, caution: false },
                        { label: "3rd (n=16)", val: 2.79, pct: 42, caution: false },
                      ].map(row => (
                        <div key={row.label} style={{ marginBottom: "0.6rem" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
                            <span style={{ fontSize: "0.71rem", color: row.caution ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.5)" }}>{row.label}</span>
                            <span style={{ fontSize: "0.71rem", fontWeight: 700, color: row.caution ? "rgba(255,255,255,0.2)" : "#4ade80" }}>{row.val}</span>
                          </div>
                          <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 99, overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${row.pct}%`, background: row.caution ? "rgba(255,255,255,0.1)" : "#4ade80", borderRadius: 99 }} />
                          </div>
                        </div>
                      ))}
                      <div style={{ fontSize: "0.69rem", color: "rgba(255,255,255,0.25)", marginTop: "0.5rem", lineHeight: 1.5 }}>
                        Clarifications/session. 58% decline by 3rd cycle.
                      </div>
                      <div style={{ marginTop: "0.85rem", padding: "0.6rem 0.75rem", background: "rgba(74,222,128,0.07)", borderRadius: 8 }}>
                        <div style={{ fontSize: "0.68rem", color: "rgba(255,255,255,0.35)", marginBottom: "2px" }}>Converging at 3rd assessment</div>
                        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.5rem", color: "#4ade80", lineHeight: 1 }}>37.5%</div>
                        <div style={{ fontSize: "0.67rem", color: "rgba(255,255,255,0.25)", marginTop: "2px" }}>up from 10.5% · 0% diverging</div>
                      </div>
                    </div>

                    {/* Role readiness */}
                    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "1.25rem" }}>
                      <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "#d97706", textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: "0.75rem" }}>
                        Role readiness signals
                      </div>
                      {[
                        { label: "Teaching intent",       a1: 30, a2: 39, a3: 67 },
                        { label: "Community application", a1: 36, a2: 52, a3: 67 },
                        { label: "Enterprise orient.",    a1: 30, a2: 45, a3: 61 },
                        { label: "Intergenerational",     a1: 27, a2: 48, a3: 50 },
                      ].map(row => (
                        <div key={row.label} style={{ marginBottom: "0.85rem" }}>
                          <div style={{ fontSize: "0.71rem", color: "rgba(255,255,255,0.5)", marginBottom: "5px" }}>{row.label}</div>
                          <div style={{ display: "flex", gap: "4px", alignItems: "flex-end", height: 28 }}>
                            {[
                              { val: row.a1, color: "rgba(217,119,6,0.3)" },
                              { val: row.a2, color: "rgba(217,119,6,0.6)" },
                              { val: row.a3, color: "#d97706" },
                            ].map((bar, bi) => (
                              <div key={bi} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%" }}>
                                <div style={{ width: "100%", height: `${bar.val / 100 * 28}px`, background: bar.color, borderRadius: "2px 2px 0 0" }} />
                              </div>
                            ))}
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "3px" }}>
                            {[row.a1, row.a2, row.a3].map((v, vi) => (
                              <span key={vi} style={{ fontSize: "0.65rem", color: vi === 2 ? "#d97706" : "rgba(255,255,255,0.25)", fontWeight: vi === 2 ? 700 : 400 }}>{v}%</span>
                            ))}
                          </div>
                        </div>
                      ))}
                      <div style={{ fontSize: "0.68rem", color: "rgba(255,255,255,0.22)", marginTop: "0.3rem", lineHeight: 1.5 }}>
                        Bars = assess. 1 → 2 → 3. All indicators roughly double.
                      </div>
                    </div>

                    {/* Enterprise artifacts */}
                    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "1.25rem" }}>
                      <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "#a78bfa", textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: "0.75rem" }}>
                        Enterprise capability
                      </div>
                      {[
                        { label: "Artifact quality score", a1: "4.1", a3: "6.5", change: "↑60%", color: "#a78bfa" },
                        { label: "Mean certs per learner",  a1: "1.7", a3: "31.8", change: "↑19×", color: "#fbbf24" },
                        { label: "Certified by cycle 3",   a1: "—",  a3: "83%",  change: "",      color: "#4ade80" },
                        { label: "Producing artifacts",    a1: "68%", a3: "81%", change: "↑13pp", color: "#a78bfa" },
                      ].map(row => (
                        <div key={row.label} style={{
                          display: "flex", justifyContent: "space-between", alignItems: "center",
                          padding: "0.55rem 0", borderBottom: "1px solid rgba(255,255,255,0.05)",
                        }}>
                          <div>
                            <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.45)" }}>{row.label}</div>
                            <div style={{ fontSize: "0.67rem", color: "rgba(255,255,255,0.22)", marginTop: "1px" }}>
                              {row.a1 !== "—" ? `${row.a1} →` : ""} <span style={{ color: row.color }}>{row.a3}</span>
                            </div>
                          </div>
                          {row.change && (
                            <span style={{ fontSize: "0.78rem", fontWeight: 700, color: row.color, flexShrink: 0 }}>{row.change}</span>
                          )}
                        </div>
                      ))}

                      {/* Natural experiment callout */}
                      <div style={{ marginTop: "1rem", padding: "0.9rem", background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.18)", borderRadius: 10 }}>
                        <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "#a78bfa", marginBottom: "0.35rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                          Natural experiment
                        </div>
                        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.75rem", color: "#fff", lineHeight: 1, marginBottom: "0.3rem" }}>5.4×</div>
                        <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.4)", lineHeight: 1.55 }}>
                          engagement when mentor present vs. absent — technology, connectivity, and curriculum unchanged.
                          The facilitator is the mechanism.
                        </div>
                      </div>
                    </div>

                  </div>

                  <div style={{ marginTop: "1.1rem", fontSize: "0.73rem", color: "rgba(255,255,255,0.22)", lineHeight: 1.6 }}>
                    All longitudinal claims are associative; no control group was employed.
                  </div>
                </div>

                {/* What does this data mean? */}
                <div style={{
                  marginTop: "2.5rem",
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 14, padding: "1.75rem 2rem",
                }}>
                  <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#d97706", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "1rem" }}>
                    Understanding the Data
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1.25rem" }}>
                    {[
                      {
                        icon: "🧠",
                        term: "Skill Scores (0–100)",
                        def: "Five dimensions assessed monthly by AI from learner conversations: Cognitive (comprehension & recall), Critical Thinking (analysis & reasoning), Problem Solving, Creativity, and Productive Use of Energy (PUE — applying learning to real energy and enterprise challenges in their community)."
                      },
                      {
                        icon: "🌍",
                        term: "Role-Ready",
                        def: "Learners showing evidence they are applying skills beyond the platform — teaching peers, advising on community problems, planning micro-enterprises, or sharing knowledge across generations. This is the platform's core mission outcome."
                      },
                      {
                        icon: "🔧",
                        term: "Reducing AI Reliance",
                        def: "Learners whose conversations show decreasing dependence on AI scaffolding — they ask more independent questions, self-correct, and explore topics the AI didn't introduce. A sign of genuine capability formation."
                      },
                      {
                        icon: "🎯",
                        term: "Proficiency Sessions",
                        def: "Learning sessions where a learner demonstrated mastery of a module's objectives — assessed by rubric, not just completion. Distinct from AI-tutored sessions, these require the learner to demonstrate knowledge independently."
                      },
                      {
                        icon: "⚡",
                        term: "PUE Linkage",
                        def: "% of learners who connected their AI learning to real productive uses of energy in their community — energy access, market pricing, enterprise planning, or healthcare. This is the dissertation-level outcome this platform is designed to measure."
                      },
                      {
                        icon: "📈",
                        term: "Independent AI Use",
                        def: "The share of learners operating at Level 3 structured reasoning — using AI as a tool they direct, rather than a guide they follow. Persistent learners increasingly move from curriculum-guided sessions to self-initiated, open-ended AI conversations."
                      },
                    ].map(item => (
                      <div key={item.term} style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <span style={{ fontSize: "1.1rem" }}>{item.icon}</span>
                          <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#fff" }}>{item.term}</span>
                        </div>
                        <p style={{ fontSize: "0.76rem", color: "rgba(255,255,255,0.5)", lineHeight: 1.68, margin: 0 }}>{item.def}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── Video ──────────────────────────────────────────────────────── */}
        <section style={{ background: "#0c160a", padding: "4rem 2rem" }}>
          <div style={{ maxWidth: 860, margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: "2rem" }}>
              <div style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#d97706", marginBottom: "0.6rem" }}>
                See It In Action
              </div>
              <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(1.7rem,4vw,2.5rem)", fontWeight: 700, color: "#fff", margin: "0 0 0.6rem" }}>
                AI learning, grounded in community
              </h2>
              <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.92rem", lineHeight: 1.7, maxWidth: 560, margin: "0 auto" }}>
                A look at the Girls AIing &amp; Vibing platform and the communities it serves.
              </p>
            </div>
            <div style={{
              position: "relative", width: "100%", aspectRatio: "16/9",
              borderRadius: 16, overflow: "hidden",
              boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}>
              <iframe
                src="https://www.youtube.com/embed/1mFbtVEiEpY"
                title="Girls AIing and Vibing — AI learning in community"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" }}
              />
            </div>
          </div>
        </section>

        {/* ── Origin Story ─────────────────────────────────────────────────────── */}
        <section style={{ background: "#faf7f2", padding: "5rem 2rem" }}>
          <div style={{ maxWidth: 900, margin: "0 auto" }}>

            <div style={{ textAlign: "center", marginBottom: "3rem" }}>
              <div style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#d97706", marginBottom: "0.6rem" }}>
                How We Got Started
              </div>
              <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(1.8rem,4vw,2.8rem)", fontWeight: 700, color: "#1a1208", margin: "0 0 1rem" }}>
                A vacant room in Oloibiri.<br />A $5,000 bet on human potential.
              </h2>
              <p style={{ color: "rgba(26,18,8,0.6)", fontSize: "1.05rem", lineHeight: 1.8, maxWidth: 680, margin: "0 auto" }}>
                In June 2025, a disused space in Oloibiri — a town of 8,000 people in Bayelsa State, Nigeria,
                where the first oil well in West Africa once pumped and went dry — became the Davidson AI Innovation Center.
                Four computers. Solar power. A Starlink connection. And two young men who knocked on doors
                and told parents whose children could not afford school:{" "}
                <em style={{ color: "#92400e" }}>"There is no cost. We want them."</em>
              </p>
            </div>

            {/* Three story beats */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "1.5rem", marginBottom: "3rem" }}>
              {[
                {
                  icon: "🤝",
                  heading: "People before technology",
                  body: "Bennywhite Davidson and Michael Amada had no formal training in technology education. What they had was courage and love for their community. They organised children from the poorest households, stood at the front of the room and explained why the AI asked questions — not to test the children, but to help them think. When typing was too hard, children used voice chat. Suddenly AI felt personal, accessible, and even fun.",
                },
                {
                  icon: "📡",
                  heading: "What nobody planned for",
                  body: "Eight months in, the lab became something no one had designed it to be. A 12-year-old helped a poultry farmer write a business proposal. Market women and entrepreneurs arrived with needs and left with solutions. Two Anglican priests now come every Saturday — their only internet access — to research and compose sermons. Community elders formally encouraged all residents to learn AI. In one week, 513 people walked through the lab and registered to vote for the first time in their lives.",
                },
                {
                  icon: "🌱",
                  heading: "The model that scales",
                  body: "The first cohort does not just find jobs — they become teachers and mentors who prime the next community. 66% of early learners volunteered intent to teach others before being asked. 41% explicitly planned to teach peers, family, or neighbours. One young man who came through the programme is now being mentored to maintain and grow the platform itself. This is what sustainability looks like: a locally owned digital asset with a local steward.",
                },
              ].map(beat => (
                <div key={beat.heading} style={{
                  background: "#fff",
                  border: "1px solid rgba(26,18,8,0.08)",
                  borderRadius: 14,
                  padding: "1.75rem",
                  boxShadow: "0 2px 14px rgba(26,18,8,0.05)",
                }}>
                  <div style={{ fontSize: "1.75rem", marginBottom: "0.75rem" }}>{beat.icon}</div>
                  <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.05rem", fontWeight: 700, color: "#1a1208", margin: "0 0 0.6rem" }}>
                    {beat.heading}
                  </h3>
                  <p style={{ fontSize: "0.86rem", color: "rgba(26,18,8,0.62)", lineHeight: 1.75, margin: 0 }}>
                    {beat.body}
                  </p>
                </div>
              ))}
            </div>

            {/* Pull quote + links */}
            <div style={{
              background: "linear-gradient(135deg, #0c160a, #162612)",
              borderRadius: 16,
              padding: "2.5rem 3rem",
              textAlign: "center",
              position: "relative",
              overflow: "hidden",
            }}>
              <div style={{
                position: "absolute", top: -40, right: -40,
                width: 200, height: 200, borderRadius: "50%",
                background: "rgba(217,119,6,0.06)",
                pointerEvents: "none",
              }} />
              <div style={{ fontSize: "2.5rem", lineHeight: 1, color: "#d97706", marginBottom: "0.75rem" }}>"</div>
              <p style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: "clamp(1.05rem,2.5vw,1.4rem)",
                fontWeight: 700, color: "#fff",
                lineHeight: 1.55, fontStyle: "italic",
                maxWidth: 620, margin: "0 auto 1.25rem",
              }}>
                Opportunities in life versus the complete absence of opportunities — that is what Bennywhite and Michael are bringing to these kids.
              </p>
              <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.38)", fontWeight: 600, letterSpacing: "0.06em", marginBottom: "1.75rem" }}>
                — Kevin Hallinan, University of Dayton
              </div>
              <div style={{ display: "flex", gap: "0.9rem", justifyContent: "center", flexWrap: "wrap" }}>
                <a
                  href="https://kevinhallinan.substack.com/p/the-oliobiri-nigeria-story-when-human"
                  target="_blank" rel="noopener noreferrer"
                  style={{
                    display: "inline-flex", alignItems: "center", gap: "0.4rem",
                    padding: "0.55rem 1.2rem", borderRadius: 7,
                    background: "rgba(255,255,255,0.08)",
                    border: "1px solid rgba(255,255,255,0.18)",
                    fontSize: "0.8rem", fontWeight: 600,
                    color: "rgba(255,255,255,0.8)", textDecoration: "none",
                  }}
                >
                  The Oloibiri story →
                </a>
                <a
                  href="https://kevinhallinan.substack.com/p/when-an-ai-learning-lab-in-rural"
                  target="_blank" rel="noopener noreferrer"
                  style={{
                    display: "inline-flex", alignItems: "center", gap: "0.4rem",
                    padding: "0.55rem 1.2rem", borderRadius: 7,
                    background: "rgba(255,255,255,0.08)",
                    border: "1px solid rgba(255,255,255,0.18)",
                    fontSize: "0.8rem", fontWeight: 600,
                    color: "rgba(255,255,255,0.8)", textDecoration: "none",
                  }}
                >
                  When the lab became something more →
                </a>
              </div>
            </div>

          </div>
        </section>

        {/* ── Voices from the Community ───────────────────────────────────── */}
        <section style={{ background: "#0c160a", padding: "5rem 2rem" }}>
          <div style={{ maxWidth: 1100, margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: "3rem" }}>
              <div style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#4ade80", marginBottom: "0.6rem" }}>
                In Their Own Words
              </div>
              <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(1.7rem,4vw,2.6rem)", fontWeight: 700, color: "#fff", margin: "0 0 0.75rem" }}>
                Voices from the community
              </h2>
              <p style={{ color: "rgba(255,255,255,0.52)", maxWidth: 600, margin: "0 auto", lineHeight: 1.75, fontSize: "0.97rem" }}>
                The people closest to this work are writing about it — from Oloibiri, Nigeria and Dayton, Ohio.
                These are not reports written about communities. They are written by the people living the change.
              </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "1.5rem" }}>

              {/* Solomon */}
              <a href="https://substack.com/@solomonmatthiassolomon" target="_blank" rel="noopener noreferrer"
                style={{ textDecoration: "none", display: "block" }}
                onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.transform = "translateY(-4px)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.transform = "translateY(0)"; }}
              >
                <div style={{
                  background: "rgba(255,255,255,0.05)", border: "1px solid rgba(74,222,128,0.2)",
                  borderRadius: 16, padding: "1.75rem", height: "100%",
                  transition: "transform 0.2s, box-shadow 0.2s",
                  position: "relative", overflow: "hidden",
                }}>
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "#4ade80" }} />
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
                    <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(74,222,128,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.3rem", flexShrink: 0 }}>
                      🏥
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, color: "#fff", fontSize: "0.95rem" }}>Solomon Matthias Solomon</div>
                      <div style={{ fontSize: "0.75rem", color: "#4ade80", fontWeight: 600 }}>Lead Community Health Navigator · Oloibiri, Nigeria</div>
                    </div>
                  </div>
                  <p style={{ fontSize: "0.87rem", color: "rgba(255,255,255,0.6)", lineHeight: 1.72, margin: "0 0 1.25rem" }}>
                    Writing about healthcare navigation, community trust-building, and what it means to bring AI into a place where formal health systems barely reach. A health navigator's eye view from the ground.
                  </p>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.8rem", fontWeight: 600, color: "#4ade80" }}>
                    <BookOpen size={13} /> Read on Substack <ExternalLink size={11} />
                  </div>
                </div>
              </a>

              {/* Kevin + Bennywhite — AI for Equity */}
              <a href="https://kevinhallinan.substack.com" target="_blank" rel="noopener noreferrer"
                style={{ textDecoration: "none", display: "block" }}
                onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.transform = "translateY(-4px)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.transform = "translateY(0)"; }}
              >
                <div style={{
                  background: "rgba(255,255,255,0.05)", border: "1px solid rgba(217,119,6,0.25)",
                  borderRadius: 16, padding: "1.75rem", height: "100%",
                  transition: "transform 0.2s, box-shadow 0.2s",
                  position: "relative", overflow: "hidden",
                }}>
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "#d97706" }} />
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
                    <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(217,119,6,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.3rem", flexShrink: 0 }}>
                      ✊
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, color: "#fff", fontSize: "0.95rem" }}>AI for Equity in Education</div>
                      <div style={{ fontSize: "0.75rem", color: "#fbbf24", fontWeight: 600 }}>Kevin Hallinan &amp; Bennywhite Davidson · UD / vAI</div>
                    </div>
                  </div>
                  <p style={{ fontSize: "0.87rem", color: "rgba(255,255,255,0.6)", lineHeight: 1.72, margin: "0 0 1.25rem" }}>
                    The story of what happens when a vacant room in rural Nigeria becomes a laboratory for human potential. Written by the co-founders of vAI — an Emeritus Professor in Dayton and a community leader in Oloibiri — in equal voice.
                  </p>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.8rem", fontWeight: 600, color: "#d97706" }}>
                    <BookOpen size={13} /> Read on Substack <ExternalLink size={11} />
                  </div>
                </div>
              </a>

            </div>
          </div>
        </section>

        {/* ── Open Research ────────────────────────────────────────────────── */}
        <section id="research" style={{ background: "#f0fdf4", padding: "5rem 2rem" }}>
          <div style={{ maxWidth: 1100, margin: "0 auto" }}>

            {/* Header */}
            <div style={{ textAlign: "center", marginBottom: "3.5rem" }}>
              <div style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#16a34a", marginBottom: "0.6rem" }}>
                Community-Led · Open-Source · Youth-Driven
              </div>
              <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(1.8rem,4vw,2.8rem)", fontWeight: 700, color: "#1a1208", margin: "0 0 1rem" }}>
                Research by the community,<br />for the community
              </h2>
              <p style={{ color: "rgba(26,18,8,0.62)", maxWidth: 700, margin: "0 auto", lineHeight: 1.8, fontSize: "0.97rem" }}>
                This is not research conducted <em>about</em> communities. Learners are not subjects —
                they are co-researchers. Youth participants self-enroll, document their own capability
                formation, and lead the inquiry. The methodology is open. The findings belong to everyone.
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.65rem", justifyContent: "center", marginTop: "1.5rem" }}>
                {["🔬 Open methodology", "👩‍💻 Youth-led", "📊 Live platform data", "🌍 Community ownership", "✊ Self-enrolled learners"].map(tag => (
                  <span key={tag} style={{
                    padding: "0.32rem 0.9rem", borderRadius: 99,
                    background: "rgba(22,163,74,0.1)", border: "1px solid rgba(22,163,74,0.22)",
                    fontSize: "0.78rem", fontWeight: 600, color: "#15803d",
                  }}>{tag}</span>
                ))}
              </div>
            </div>

            {/* ── Block 1: Active Research Programs ── */}
            <div style={{ marginBottom: "4rem" }}>
              <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.4rem", fontWeight: 700, color: "#1a1208", margin: "0 0 1.5rem", paddingBottom: "0.75rem", borderBottom: "2px solid rgba(22,163,74,0.15)" }}>
                Active Research Programs
              </h3>

              {programs.map(program => {
                const qs = questions.filter(q => q.program_id === program.id);
                const isVAI = program.slug === 'vai-ai-learning-lab-impact';
                return (
                  <div key={program.id} style={{ marginBottom: "2.5rem" }}>
                    {/* Program header card */}
                    <div style={{
                      background: "linear-gradient(135deg,#0c160a,#162612)",
                      borderRadius: 18, padding: "2rem 2.25rem", marginBottom: "1.25rem",
                      border: "1px solid rgba(22,163,74,0.15)",
                    }}>
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
                        <div style={{ flex: 1, minWidth: 260 }}>
                          <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "#4ade80", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.45rem" }}>
                            Active Research Program
                          </div>
                          <h4 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(1.1rem,3vw,1.55rem)", fontWeight: 700, color: "#fff", margin: "0 0 0.75rem" }}>
                            {program.title}
                          </h4>
                          <p style={{ fontSize: "0.88rem", color: "rgba(255,255,255,0.58)", lineHeight: 1.75, margin: "0 0 1rem", maxWidth: 620 }}>
                            {program.description}
                          </p>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                            {program.sites.map((site: string) => (
                              <span key={site} style={{
                                padding: "0.25rem 0.75rem", borderRadius: 99,
                                background: "rgba(74,222,128,0.12)", border: "1px solid rgba(74,222,128,0.2)",
                                fontSize: "0.74rem", fontWeight: 600, color: "#4ade80",
                              }}>📍 {site}</span>
                            ))}
                          </div>
                        </div>
                        {/* Live data for vAI */}
                        {isVAI && latestRow && (
                          <div style={{
                            background: "rgba(255,255,255,0.05)", borderRadius: 14,
                            border: "1px solid rgba(255,255,255,0.08)",
                            padding: "1.25rem 1.5rem", minWidth: 180, textAlign: "center", flexShrink: 0,
                          }}>
                            <div style={{ fontSize: "0.66rem", fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.5rem" }}>Live Cohort</div>
                            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "2.6rem", fontWeight: 900, color: "#fff", lineHeight: 1 }}>{latestRow.learner_count}</div>
                            <div style={{ fontSize: "0.72rem", color: "#4ade80", fontWeight: 600, marginTop: "0.3rem" }}>Active Learners</div>
                            <div style={{ height: 1, background: "rgba(255,255,255,0.08)", margin: "0.85rem 0" }} />
                            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.8rem", fontWeight: 900, color: "#fff", lineHeight: 1 }}>{latestRow.sessions_count?.toLocaleString()}</div>
                            <div style={{ fontSize: "0.72rem", color: "#fbbf24", fontWeight: 600, marginTop: "0.3rem" }}>AI Sessions</div>
                          </div>
                        )}
                        {/* iGiTREE — coming soon data badge */}
                        {!isVAI && (
                          <div style={{
                            background: "rgba(255,255,255,0.05)", borderRadius: 14,
                            border: "1px solid rgba(255,255,255,0.08)",
                            padding: "1.25rem 1.5rem", minWidth: 180, textAlign: "center", flexShrink: 0,
                          }}>
                            <div style={{ fontSize: "0.66rem", fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.75rem" }}>Live Data</div>
                            <span style={{ fontSize: "1.8rem" }}>🧬</span>
                            <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.35)", marginTop: "0.5rem", lineHeight: 1.5 }}>Coming as cohort<br />data matures</div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Guiding question cards */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))", gap: "1rem" }}>
                      {qs.map(q => (
                        <div key={q.id} style={{
                          background: "#fff", borderRadius: 14,
                          border: `1px solid ${q.color_hex}28`,
                          padding: "1.5rem", boxShadow: "0 2px 12px rgba(26,18,8,0.05)",
                          position: "relative", overflow: "hidden",
                        }}>
                          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: q.color_hex }} />
                          <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem", marginBottom: "0.9rem" }}>
                            <span style={{ fontSize: "1.4rem", flexShrink: 0, lineHeight: 1 }}>{q.icon}</span>
                            <div>
                              <div style={{ fontSize: "0.66rem", fontWeight: 700, color: q.color_hex, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.2rem" }}>{q.domain}</div>
                              <div style={{ fontWeight: 700, color: "#1a1208", fontSize: "0.92rem", lineHeight: 1.35 }}>{q.title}</div>
                            </div>
                          </div>
                          <p style={{ fontSize: "0.82rem", color: "rgba(26,18,8,0.62)", lineHeight: 1.72, margin: "0 0 1rem", fontStyle: "italic" }}>
                            "{q.research_question}"
                          </p>
                          {/* Live indicators for vAI questions */}
                          {isVAI && latestRow && q.slug === 'learning-outcomes' && (
                            <div style={{ display: "flex", gap: "0.65rem", flexWrap: "wrap" }}>
                              {[
                                { label: "AI Proficiency", value: `${latestRow.avg_mean?.toFixed(0) ?? "—"}/100`, color: "#C8963E" },
                                { label: "Role-Ready", value: `${latestRow.role_ready_count ?? "—"} learners`, color: "#16a34a" },
                              ].map(stat => (
                                <div key={stat.label} style={{ background: `${stat.color}12`, border: `1px solid ${stat.color}28`, borderRadius: 8, padding: "0.4rem 0.75rem" }}>
                                  <div style={{ fontSize: "0.62rem", color: stat.color, fontWeight: 700, textTransform: "uppercase" }}>{stat.label}</div>
                                  <div style={{ fontSize: "0.88rem", fontWeight: 700, color: "#1a1208" }}>{stat.value}</div>
                                </div>
                              ))}
                            </div>
                          )}
                          {isVAI && latestRow && q.slug === 'community-spillover' && (
                            <div style={{ display: "flex", gap: "0.65rem", flexWrap: "wrap" }}>
                              {[
                                { label: "PUE Linkage", value: `${latestRow.pue_learner_pct?.toFixed(0) ?? "—"}%`, color: "#5B7A6A" },
                                { label: "Reducing AI Reliance", value: `${latestRow.converging_count ?? "—"}`, color: "#16a34a" },
                              ].map(stat => (
                                <div key={stat.label} style={{ background: `${stat.color}12`, border: `1px solid ${stat.color}28`, borderRadius: 8, padding: "0.4rem 0.75rem" }}>
                                  <div style={{ fontSize: "0.62rem", color: stat.color, fontWeight: 700, textTransform: "uppercase" }}>{stat.label}</div>
                                  <div style={{ fontSize: "0.88rem", fontWeight: 700, color: "#1a1208" }}>{stat.value}</div>
                                </div>
                              ))}
                            </div>
                          )}
                          {isVAI && latestRow && q.slug === 'hope-agency' && (
                            <div style={{ background: "rgba(42,123,136,0.07)", borderRadius: 8, padding: "0.55rem 0.85rem", fontSize: "0.76rem", color: "rgba(26,18,8,0.55)", lineHeight: 1.6 }}>
                              📊 {latestRow.assessed_count ?? "—"} learners assessed this period via monthly AI rubrics
                            </div>
                          )}
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginTop: "0.85rem" }}>
                            {q.sites.map((site: string) => (
                              <span key={site} style={{ fontSize: "0.68rem", fontWeight: 600, color: "rgba(26,18,8,0.4)", background: "rgba(26,18,8,0.05)", borderRadius: 99, padding: "0.2rem 0.6rem" }}>
                                {site}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── Block 2: Open Research Network ── */}
            <div style={{
              background: "linear-gradient(135deg,#1e1b4b,#312e81)",
              borderRadius: 22, padding: "3rem 2.5rem",
              border: "1px solid rgba(139,92,246,0.2)",
            }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "3rem", alignItems: "start" }}>

                {/* Left: vision */}
                <div>
                  <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "#a78bfa", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "0.6rem" }}>
                    Coming Soon · Open to Researchers Worldwide
                  </div>
                  <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(1.3rem,3vw,2rem)", fontWeight: 700, color: "#fff", margin: "0 0 1rem", lineHeight: 1.25 }}>
                    A distributed research network — proposed by anyone, vetted for equity, led by communities
                  </h3>
                  <p style={{ fontSize: "0.88rem", color: "rgba(255,255,255,0.58)", lineHeight: 1.8, margin: "0 0 1.5rem" }}>
                    Any researcher — from any university or institution — will be able to propose a study.
                    A review board vets each proposal for scientific merit and, critically, whether it empowers
                    or exploits its participants. Approved studies are then offered to communities, who choose
                    whether to participate. Learners who join become co-researchers: AI-mentored, team-based,
                    and eligible for university research certification upon documented completion.
                  </p>

                  {/* How it works */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                    {[
                      { step: "01", icon: "💡", title: "Researcher proposes a study", detail: "Any institution worldwide. Open submission." },
                      { step: "02", icon: "🛡️", title: "AI + board vetting", detail: "Reviewed by the vAI Research Board and an AI IRB for equity, scientific merit, and community empowerment — not exploitation." },
                      { step: "03", icon: "🌍", title: "Community chooses to participate", detail: "Communities are invited, never assigned. They select the studies that matter to them." },
                      { step: "04", icon: "👩‍🔬", title: "Learners join as co-researchers", detail: "AI-mentored, team-based participation. Learners document, analyze, and contribute." },
                      { step: "05", icon: "🎓", title: "University research certification", detail: "Successful participants earn credentials recognized by University of Dayton, Temple University, and partner institutions." },
                    ].map(item => (
                      <div key={item.step} style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                          background: "rgba(139,92,246,0.2)", border: "1px solid rgba(139,92,246,0.3)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: "1rem",
                        }}>{item.icon}</div>
                        <div>
                          <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#fff", marginBottom: "0.15rem" }}>{item.title}</div>
                          <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.45)", lineHeight: 1.6 }}>{item.detail}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right: board + CTA */}
                <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

                  {/* Review Board */}
                  <div style={{
                    background: "rgba(255,255,255,0.05)", borderRadius: 16,
                    border: "1px solid rgba(139,92,246,0.2)", padding: "1.75rem",
                  }}>
                    <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "#a78bfa", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "1rem" }}>
                      Research Review Board
                    </div>
                    {[
                      { name: "Bennywhite Davidson", role: "vAI Co-Founder · Oloibiri, Nigeria", emoji: "🇳🇬" },
                      { name: "Silas Clergy", role: "Youth Representative · vAI Learner & Developer", emoji: "👨‍💻" },
                      { name: "Kevin Hallinan", role: "Emeritus Professor · University of Dayton", emoji: "🎓" },
                      { name: "Jean Akingeneye", role: "Research Partner · iGiTREE", emoji: "🧬" },
                      { name: "UD Representative", role: "University of Dayton · Incoming", emoji: "🏛️" },
                      { name: "Temple Representative", role: "Temple University · Incoming", emoji: "🏛️" },
                    ].map(member => (
                      <div key={member.name} style={{
                        display: "flex", alignItems: "center", gap: "0.75rem",
                        padding: "0.6rem 0", borderBottom: "1px solid rgba(255,255,255,0.06)",
                      }}>
                        <span style={{ fontSize: "1.1rem", flexShrink: 0 }}>{member.emoji}</span>
                        <div>
                          <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#fff" }}>{member.name}</div>
                          <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.4)", lineHeight: 1.4 }}>{member.role}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* CTA */}
                  <div style={{
                    background: "rgba(139,92,246,0.12)", borderRadius: 16,
                    border: "1px solid rgba(139,92,246,0.25)", padding: "1.75rem",
                    textAlign: "center",
                  }}>
                    <div style={{ fontSize: "1.6rem", marginBottom: "0.75rem" }}>🔬</div>
                    <div style={{ fontWeight: 700, color: "#fff", fontSize: "1rem", marginBottom: "0.5rem" }}>Are you a researcher?</div>
                    <p style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.5)", lineHeight: 1.65, margin: "0 0 1.25rem" }}>
                      We are building the proposal portal now. Register your interest and we will contact you when submissions open.
                    </p>
                    <a
                      href="mailto:bennywhite.davidson@renewvia.com?subject=Research%20Network%20Interest&body=Hello%2C%20I%20am%20interested%20in%20proposing%20a%20study%20through%20the%20vAI%20Open%20Research%20Network.%0A%0AName%3A%20%0AInstitution%3A%20%0AResearch%20area%3A%20%0A%0APlease%20keep%20me%20informed%20of%20when%20submissions%20open."
                      style={{
                        display: "inline-flex", alignItems: "center", gap: "0.5rem",
                        padding: "0.75rem 1.75rem", borderRadius: 10,
                        background: "#7c3aed", color: "#fff",
                        fontSize: "0.88rem", fontWeight: 700, textDecoration: "none",
                        transition: "opacity 0.15s",
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.opacity = "0.85"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.opacity = "1"; }}
                    >
                      ✉️ Register Interest
                    </a>
                  </div>

                  {/* Findings placeholder */}
                  <div style={{
                    background: "rgba(22,163,74,0.08)", border: "1px dashed rgba(22,163,74,0.3)",
                    borderRadius: 12, padding: "1.1rem 1.4rem",
                    display: "flex", alignItems: "center", gap: "0.85rem",
                  }}>
                    <span style={{ fontSize: "1.2rem" }}>📊</span>
                    <div>
                      <div style={{ fontWeight: 700, color: "#15803d", fontSize: "0.82rem", marginBottom: "0.15rem" }}>Findings emerging</div>
                      <div style={{ fontSize: "0.75rem", color: "rgba(26,18,8,0.5)", lineHeight: 1.6 }}>
                        Formal research findings will appear here as the research community documents them.
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            </div>

          </div>
        </section>

        {/* ── Programmes ──────────────────────────────────────────────────── */}
        <section id="programmes" style={{ background: "#fff", padding: "5rem 2rem" }}>
          <div style={{ maxWidth: 1100, margin: "0 auto" }}>
            <div style={{ marginBottom: "2.5rem" }}>
              <div style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#d97706", marginBottom: "0.6rem" }}>
                What We Teach
              </div>
              <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(1.7rem,4vw,2.6rem)", fontWeight: 700, color: "#1a1208", margin: "0 0 0.75rem" }}>
                Four pathways to capability
              </h2>
              <p style={{ color: "rgba(26,18,8,0.58)", maxWidth: 580, lineHeight: 1.72, margin: 0 }}>
                Every pathway is AI-scaffolded, locally grounded, and designed to meet learners
                exactly where they are — from zero digital experience to job-ready skills.
              </p>
            </div>
            <div className="prog-grid">
              <ProgramCard
                icon={<Brain size={22} />}
                title="English Skills & AI Learning"
                accent="#0d9488" bg="#f0fdfa"
                desc="Foundation-first learning that builds English fluency alongside AI literacy — starting from zero, adapted to each learner's communication level."
                items={[
                  "Adaptive English reading and writing",
                  "AI concepts, ethics, and responsible use",
                  "AI-900 and AI Ready Skills certification prep",
                  "Socratic tutoring that meets you at your level",
                ]}
              />
              <ProgramCard
                icon={<Code size={22} />}
                title="Tech Skills Workshop"
                accent="#7c3aed" bg="#faf5ff"
                desc="Hands-on technical training in the tools that open doors to remote work, freelancing, and entrepreneurship."
                items={[
                  "Vibe coding and web development",
                  "Full-stack app development",
                  "AI workflow and agent development",
                  "AI for business — strategy and operations",
                  "Microsoft AI-900, AB-730, GitHub GH-300",
                ]}
              />
              <ProgramCard
                icon={<ImagePlus size={22} />}
                title="AI Creative Studio"
                accent="#d97706" bg="#fffbeb"
                desc="Creative AI tools that unlock new income streams and community storytelling capabilities."
                items={[
                  "AI image generation and editing",
                  "AI voice creation and narration",
                  "AI video production and studio",
                  "AI content creation for business",
                ]}
              />
              <ProgramCard
                icon={<Globe size={22} />}
                title="Community Impact AI"
                accent="#16a34a" bg="#f0fdf4"
                desc="AI-assisted consulting grounded in the real economic and ecological contexts of Oloibiri, Ibiade, and similar communities."
                items={[
                  "Agriculture and cassava farming consultant",
                  "Fishing and creek ecology advisor",
                  "Healthcare navigator",
                  "Entrepreneurship and enterprise planning",
                  "Animal husbandry advisor",
                ]}
              />
            </div>
          </div>
        </section>

        {/* ── New Communities ──────────────────────────────────────────────── */}
        <div id="community" style={{ position: "relative" }}>
          <div style={{
            position: "absolute", inset: 0, zIndex: 0,
            backgroundImage: "url('/home_page_africa.png')",
            backgroundSize: "cover", backgroundPosition: "center 55%",
            filter: "brightness(0.3)",
          }} />
          <div style={{
            position: "absolute", inset: 0, zIndex: 1,
            background: "linear-gradient(135deg,rgba(8,20,6,0.88),rgba(13,148,136,0.55))",
          }} />
          <div style={{ position: "relative", zIndex: 2, padding: "5rem 2rem" }}>
            <div style={{ maxWidth: 860, margin: "0 auto", textAlign: "center" }}>
              <div style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#5eead4", marginBottom: "0.6rem" }}>
                For New Communities
              </div>
              <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(1.7rem,4vw,2.6rem)", fontWeight: 700, color: "#fff", margin: "0 0 1rem" }}>
                Bring vAI to your community
              </h2>
              <p style={{ color: "rgba(255,255,255,0.68)", lineHeight: 1.8, fontSize: "1.03rem", maxWidth: 620, margin: "0 auto 2rem" }}>
                We partner with community leaders, NGOs, schools, and organisations
                across Sub-Saharan Africa and beyond to establish local AI learning cohorts.
                Each cohort is anchored by a trained on-the-ground facilitator and supported
                by our platform's AI tutoring infrastructure.
              </p>
              <div style={{
                display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))",
                gap: "1rem", marginBottom: "2.5rem",
              }}>
                {[
                  { icon: "🌍", label: "Community cohorts",  desc: "Structured groups with local facilitators" },
                  { icon: "🔑", label: "Join codes",         desc: "Controlled access — contact us to start" },
                  { icon: "📊", label: "Progress reports",   desc: "Monthly AI-assessed data per learner" },
                  { icon: "🤝", label: "Human mentorship",   desc: "On-the-ground support alongside AI" },
                ].map(item => (
                  <div key={item.label} style={{
                    background: "rgba(255,255,255,0.07)",
                    border: "1px solid rgba(255,255,255,0.11)",
                    borderRadius: 12, padding: "1.2rem",
                    backdropFilter: "blur(8px)",
                  }}>
                    <div style={{ fontSize: "1.4rem", marginBottom: "0.45rem" }}>{item.icon}</div>
                    <div style={{ fontWeight: 700, color: "#fff", marginBottom: "0.28rem", fontSize: "0.88rem" }}>{item.label}</div>
                    <div style={{ fontSize: "0.76rem", color: "rgba(255,255,255,0.52)", lineHeight: 1.6 }}>{item.desc}</div>
                  </div>
                ))}
              </div>
              <p style={{ color: "rgba(255,255,255,0.48)", fontSize: "0.88rem", marginBottom: "1.5rem" }}>
                Access is managed — community leaders receive join codes directly from our team.
              </p>
              <a href="mailto:bennywhite.davidson@renewvia.com?subject=New Community Interest — vAI Platform"
                className="pub-btn btn-amber" style={{ fontSize: "1rem", padding: "0.82rem 1.9rem" }}>
                Contact Us to Get Started <ArrowRight size={15} />
              </a>
            </div>
          </div>
        </div>

        {/* ── Support & Donate ─────────────────────────────────────────────── */}
        <section id="support" style={{ background: "#faf7f2", padding: "5rem 2rem" }}>
          <div style={{ maxWidth: 1100, margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: "2.75rem" }}>
              <div style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#d97706", marginBottom: "0.6rem" }}>
                Support the Mission
              </div>
              <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(1.7rem,4vw,2.6rem)", fontWeight: 700, color: "#1a1208", margin: "0 0 0.75rem" }}>
                Help us expand human-centred AI learning
              </h2>
              <p style={{ color: "rgba(26,18,8,0.58)", maxWidth: 600, margin: "0 auto", lineHeight: 1.75 }}>
                vAI (Davidson AI Innovation Center) is building toward registered NGO status in Nigeria.
                We welcome partnerships with donors, foundations, universities, and organisations
                who share our conviction that AI capability should reach every community — not just the connected few.
              </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(270px,1fr))", gap: "1.25rem", marginBottom: "2.5rem" }}>
              {[
                {
                  icon: <Heart size={20} color="#d97706" />,
                  bg: "#d97706",
                  title: "Individual Donors",
                  desc: "Support a learner's journey directly. Every contribution funds platform infrastructure, facilitator training, and on-the-ground mentorship in communities with no prior digital access.",
                },
                {
                  icon: <Briefcase size={20} color="#7c3aed" />,
                  bg: "#7c3aed",
                  title: "Institutional Partners",
                  desc: "Universities, foundations, and corporations can sponsor cohorts, fund certification pathways, or partner on research. We are actively pursuing Microsoft AI for Good and similar grants.",
                },
                {
                  icon: <Globe size={20} color="#0d9488" />,
                  bg: "#0d9488",
                  title: "NGO & Field Partners",
                  desc: "Organisations working in Sub-Saharan Africa can integrate our AI learning platform into existing community programmes. We provide the tech; you provide the trust.",
                },
              ].map(card => (
                <div key={card.title} className="contact-card">
                  <div style={{
                    width: 42, height: 42, borderRadius: 11,
                    background: `${card.bg}14`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {card.icon}
                  </div>
                  <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.05rem", fontWeight: 700, color: "#1a1208", margin: 0 }}>
                    {card.title}
                  </h3>
                  <p style={{ fontSize: "0.87rem", color: "rgba(26,18,8,0.6)", lineHeight: 1.7, margin: 0 }}>
                    {card.desc}
                  </p>
                </div>
              ))}
            </div>

            {/* Contact block */}
            <div style={{
              background: "#1a1208", borderRadius: 20,
              padding: "2.5rem", textAlign: "center",
            }}>
              <div style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#d97706", marginBottom: "0.6rem" }}>
                Get In Touch
              </div>
              <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.55rem", color: "#fff", margin: "0 0 0.65rem" }}>
                Let's build this together
              </h3>
              <p style={{ color: "rgba(255,255,255,0.48)", fontSize: "0.88rem", maxWidth: 460, margin: "0 auto 2rem", lineHeight: 1.7 }}>
                Whether you want to support, partner, or simply learn more about what we're building —
                we'd love to hear from you.
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.9rem", justifyContent: "center" }}>
                <a href="mailto:bennywhite.davidson@renewvia.com" className="pub-btn btn-amber">
                  <Mail size={15} /> bennywhite.davidson@renewvia.com
                </a>
                <a href="https://www.linkedin.com/in/kevinhallinanenergyinnovator123"
                  target="_blank" rel="noopener noreferrer"
                  className="pub-btn" style={{ background: "#0077b5", color: "#fff" }}>
                  <Linkedin size={15} /> LinkedIn
                </a>
                <a href="https://wa.me/19377601499"
                  target="_blank" rel="noopener noreferrer"
                  className="pub-btn" style={{ background: "#25d366", color: "#fff" }}>
                  <MessageCircle size={15} /> WhatsApp
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <footer style={{
          background: "#080e06", padding: "2.5rem 2rem",
          textAlign: "center",
          borderTop: "1px solid rgba(255,255,255,0.05)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", justifyContent: "center", marginBottom: "0.65rem" }}>
            <Sparkles size={15} color="#d97706" />
            <span style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: "0.92rem", color: "rgba(255,255,255,0.5)" }}>
              vAI · Davidson AI Innovation Center · Girls AIing &amp; Vibing
            </span>
          </div>
          <p style={{ fontSize: "0.76rem", color: "rgba(255,255,255,0.22)", margin: "0 0 0.4rem" }}>
            Oloibiri, Bayelsa State, Nigeria · Dayton, Ohio, USA
          </p>
          <p style={{ fontSize: "0.73rem", color: "rgba(255,255,255,0.16)", margin: 0 }}>
            © {new Date().getFullYear()} Davidson AI Innovation Center. ·{" "}
            <Link to="/login" style={{ color: "rgba(255,255,255,0.28)" }}>Log In / Sign Up</Link>
          </p>
        </footer>

      </div>
    </>
  );
};

export default PublicLandingPage;