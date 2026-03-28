/**
 * DAILY ACTIVITY REPORT — Vercel Cron Handler
 *
 * Runs every day at 11:00 UTC (12:00 Nigerian WAT / West Africa Time = UTC+1).
 * Vercel cron: "0 11 * * *"
 *
 * Reports on Africa-cohort users who were active today:
 *   • Total users with dashboard sessions (chat_history not null)
 *   • Breakdown by category_activity
 *   • AI Playground users and chat counts
 *   • Certification attempt counts (all-time + today)
 *
 * Sends email to khallinan1@udayton.edu and bennywhite.davidson@renewvia.com
 * Writes a row to public.daily_activity_log in Supabase.
 *
 * Required env vars:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, CRON_SECRET
 */

import { createClient } from "@supabase/supabase-js";
import type { VercelRequest, VercelResponse } from "@vercel/node";

// ─── Excluded Users (admins / facilitators) ───────────────────────────────────
const EXCLUDED_USER_IDS = new Set([
  "0e738663-a70e-4fd3-9ba6-718c02e116c2", // Kevin Hallinan (kevin.hallinan@udayton.edu)
  "8b3f70dc-e5d0-4eb0-af7d-ec6181968213", // Kevin Hallinan (khallinan1@udayton.edu)
  "5d5e0486-e768-4c5d-ba63-d1e4570a352d", // Kevin Hallinan (kevin.hallinan.ud@gmail.com)
  "40e9daa6-7ec1-49a9-9be7-814a3d607d86", // Bennywhite Davidson (benny090davidson@gmail.com)
  "73da14c1-e49a-4410-9390-6fe069fd7528", // Bennywhite Davidson (duplicate)
  "f6157a9d-5ffd-4058-b0b3-af3ea897d876", // Bennywhite Davidson (bennywhite090d@gmail.com)
]);

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ─── Types ────────────────────────────────────────────────────────────────────

interface DailyMetrics {
  logDate: string;           // YYYY-MM-DD in WAT
  totalAfricaUsers: number;

  // Distinct active users today
  activeUsers: number;       // unique users with a dashboard session updated today
  totalActivities: number;   // total dashboard rows updated today (all categories)

  // By category — ROW counts (not distinct users)
  catAiLearning: number;
  catSkillsDevelopment: number;
  catEnglishSkills: number;
  catAiProficiencyCert: number;
  catOther: number;

  // Playground — distinct users and total chat rows
  playgroundUsers: number;       // unique users active in playground today
  playgroundChatsTotal: number;  // total playground chat rows created/updated today

  // Certifications
  certAttemptedUsers: number;   // all-time distinct users who attempted a cert
  certAttemptedToday: number;   // distinct users who updated a cert row today
}

interface UserProfile {
  id: string;
  name: string | null;
}

// ─── Data Fetching ────────────────────────────────────────────────────────────

/**
 * Returns today's date string in WAT (UTC+1), formatted as YYYY-MM-DD.
 * Called at 11:00 UTC which is 12:00 WAT — so the date is always correct.
 */
function todayWAT(): string {
  const now = new Date();
  // Shift to WAT = UTC+1
  const wat = new Date(now.getTime() + 60 * 60 * 1000);
  return wat.toISOString().split("T")[0];
}

async function fetchMetrics(logDate: string): Promise<DailyMetrics> {
  // Day boundaries in UTC (WAT day starts at UTC-1 offset, i.e. 23:00 prev day)
  // Since we run at 11:00 UTC = 12:00 WAT, we use the WAT date's UTC window:
  // WAT 00:00 = UTC 23:00 previous day → WAT 23:59 = UTC 22:59 same day
  const dayStartUTC = new Date(`${logDate}T00:00:00+01:00`).toISOString();
  const dayEndUTC   = new Date(`${logDate}T23:59:59+01:00`).toISOString();

  // ── 1. Fetch all Africa user IDs ─────────────────────────────────────────
  const { data: africaProfiles } = await supabase
    .from("profiles")
    .select("id, name")
    .eq("continent", "Africa");

  const allProfiles: UserProfile[] = (africaProfiles || [])
    .filter((p) => !EXCLUDED_USER_IDS.has(p.id));
  const africaIds = allProfiles.map((p) => p.id);
  const totalAfricaUsers = africaIds.length;

  if (!africaIds.length) {
    return {
      logDate, totalAfricaUsers: 0,
      activeUsers: 0, totalActivities: 0,
      catAiLearning: 0, catSkillsDevelopment: 0, catEnglishSkills: 0,
      catAiProficiencyCert: 0, catOther: 0,
      playgroundUsers: 0, playgroundChatsTotal: 0,
      certAttemptedUsers: 0, certAttemptedToday: 0,
    };
  }

  // ── 2. Dashboard sessions started OR updated on this day ────────────────
  // Fetch rows matching created_at in range, and rows matching updated_at in range,
  // then merge by id so each row is counted once.
  const [{ data: createdRows }, { data: updatedRows }] = await Promise.all([
    supabase
      .from("dashboard")
      .select("id, user_id, category_activity, activity")
      .in("user_id", africaIds)
      .not("chat_history", "is", null)
      .gte("created_at", dayStartUTC)
      .lte("created_at", dayEndUTC),
    supabase
      .from("dashboard")
      .select("id, user_id, category_activity, activity")
      .in("user_id", africaIds)
      .not("chat_history", "is", null)
      .gte("updated_at", dayStartUTC)
      .lte("updated_at", dayEndUTC),
  ]);

  // Deduplicate by row id — a session updated on the same day it was created counts once
  const sessionMap = new Map<string, { id: string; user_id: string; category_activity: string; activity: string }>();
  for (const row of [...(createdRows || []), ...(updatedRows || [])]) {
    sessionMap.set(row.id, row);
  }
  const sessionRows = [...sessionMap.values()];
  const totalActivities = sessionRows.length;  // total rows — not distinct users

  // Unique users active today (distinct)
  const activeUserSet = new Set(sessionRows.map((r) => r.user_id));
  const activeUsers = activeUserSet.size;

  // ── 3. Category breakdown — ROW counts (not distinct users) ─────────────
  const catCounts: Record<string, number> = {
    aiLearning: 0, skillsDevelopment: 0,
    englishSkills: 0, aiProficiencyCert: 0, other: 0,
  };

  for (const row of sessionRows) {
    const cat = (row.category_activity || "").toLowerCase();
    const act = (row.activity || "").toLowerCase();

    if (cat.includes("ai learning") || (cat.includes("ai proficiency") && !act.includes("certification"))) {
      catCounts.aiLearning++;
    } else if (cat.includes("skills development") || cat.includes("vibe")) {
      catCounts.skillsDevelopment++;
    } else if (act.includes("english_skills") || cat.includes("english")) {
      catCounts.englishSkills++;
    } else if (act.includes("ai proficiency certification") || cat.includes("certification")) {
      catCounts.aiProficiencyCert++;
    } else {
      catCounts.other++;
    }
  }

  // ── 4. AI Playground usage on this day (created OR updated) ─────────────
  const [{ data: pgCreated }, { data: pgUpdated }] = await Promise.all([
    supabase
      .from("ai_playground_chats")
      .select("id, user_id")
      .in("user_id", africaIds)
      .gte("created_at", dayStartUTC)
      .lte("created_at", dayEndUTC),
    supabase
      .from("ai_playground_chats")
      .select("id, user_id")
      .in("user_id", africaIds)
      .gte("updated_at", dayStartUTC)
      .lte("updated_at", dayEndUTC),
  ]);

  const pgMap = new Map<string, string>();
  for (const row of [...(pgCreated || []), ...(pgUpdated || [])]) {
    pgMap.set(row.id, row.user_id);
  }
  const pgRowsToday = [...pgMap.entries()].map(([id, user_id]) => ({ id, user_id }));
  const playgroundUsers = new Set(pgRowsToday.map((r) => r.user_id)).size;
  const playgroundChatsTotal = pgRowsToday.length;

  // ── 5. Certifications — all-time attempted ───────────────────────────────
  const { data: certRowsAllTime } = await supabase
    .from("dashboard")
    .select("user_id, created_at, updated_at")
    .in("user_id", africaIds)
    .eq("activity", "AI Proficiency Certification")
    .not("certification_evaluation_score", "is", null);

  const certAllTime = certRowsAllTime || [];
  const certAttemptedUsers = new Set(certAllTime.map((r) => r.user_id)).size;

  // Certification rows started OR updated today
  const certAttemptedToday = new Set(
    certAllTime
      .filter((r) =>
        (r.created_at >= dayStartUTC && r.created_at <= dayEndUTC) ||
        (r.updated_at >= dayStartUTC && r.updated_at <= dayEndUTC)
      )
      .map((r) => r.user_id)
  ).size;

  return {
    logDate,
    totalAfricaUsers,
    activeUsers,
    totalActivities,
    catAiLearning:        catCounts.aiLearning,
    catSkillsDevelopment: catCounts.skillsDevelopment,
    catEnglishSkills:     catCounts.englishSkills,
    catAiProficiencyCert: catCounts.aiProficiencyCert,
    catOther:             catCounts.other,
    playgroundUsers,
    playgroundChatsTotal,
    certAttemptedUsers,
    certAttemptedToday,
  };
}

// ─── Email HTML ───────────────────────────────────────────────────────────────

function chip(val: number | string, bg: string, color: string, label: string): string {
  return `
  <div style="flex:1;min-width:110px;background:${bg};border-radius:10px;padding:14px 12px;text-align:center;">
    <div style="font-size:24px;font-weight:800;color:${color};line-height:1;">${val}</div>
    <div style="font-size:9px;color:${color};font-weight:600;text-transform:uppercase;letter-spacing:0.9px;margin-top:4px;">${label}</div>
  </div>`;
}

function catRow(label: string, count: number, total: number): string {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  const w = Math.min(pct * 1.8, 180);
  const active = count > 0;
  return `
  <tr style="border-top:1px solid #e5e7eb;">
    <td style="padding:8px 12px;font-size:12px;color:#374151;">${label}</td>
    <td style="padding:8px 12px;text-align:center;font-size:13px;font-weight:700;color:${active ? "#1a3d2b" : "#9ca3af"};">${count}</td>
    <td style="padding:8px 16px;">
      <span style="display:inline-block;background:#e5e7eb;border-radius:3px;width:180px;height:8px;vertical-align:middle;">
        <span style="display:inline-block;background:${active ? "#2d6a4f" : "#e5e7eb"};border-radius:3px;height:8px;width:${w}px;"></span>
      </span>
      <span style="font-size:11px;color:#6b7280;margin-left:8px;">${pct}%</span>
    </td>
  </tr>`;
}

function buildEmailHtml(m: DailyMetrics, dateLabel: string): string {
  const participationPct = m.totalAfricaUsers > 0
    ? Math.round((m.activeUsers / m.totalAfricaUsers) * 100)
    : 0;

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f2f8f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<div style="max-width:660px;margin:20px auto;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

  <!-- Header -->
  <div style="background:linear-gradient(135deg,#1a3d2b 0%,#2d6a4f 100%);padding:28px 32px;">
    <div style="font-size:10px;letter-spacing:2.5px;text-transform:uppercase;color:#52b788;margin-bottom:6px;font-weight:600;">Girls AIing &amp; Vibing · Oloibiri · Davidson AI Innovation Center</div>
    <div style="font-size:22px;font-weight:800;color:#fff;margin-bottom:3px;">Daily Activity Report</div>
    <div style="font-size:13px;color:rgba(255,255,255,0.55);">${dateLabel} · 12:00 Nigerian Time (WAT)</div>
  </div>

  <div style="padding:24px 32px;">

    <!-- Stat chips -->
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:24px;">
      ${chip(m.activeUsers,        "#dcfce7", "#166534", "Active Today")}
      ${chip(`${participationPct}%`, "#dbeafe", "#1e40af", "Participation")}
      ${chip(m.playgroundUsers,    "#fef3c7", "#92400e", "Playground")}
      ${chip(m.certAttemptedUsers, "#f3e8ff", "#6b21a8", "Cert Attempted")}
      ${chip(m.totalAfricaUsers,   "#f1f5f9", "#475569", "Total Cohort")}
    </div>

    <!-- Session overview -->
    <div style="background:#f0fff4;border:1px solid #a7f3d0;border-radius:10px;padding:14px 16px;margin-bottom:20px;">
      <div style="font-size:12px;font-weight:600;color:#065f46;margin-bottom:6px;">📊 Session Overview — Today</div>
      <div style="display:flex;gap:24px;flex-wrap:wrap;font-size:12px;color:#374151;">
        <div>Unique active users: <strong>${m.activeUsers}</strong></div>
        <div>Total activity rows updated: <strong>${m.totalActivities}</strong></div>
        <div>Avg activities/active user: <strong>${m.activeUsers > 0 ? (m.totalActivities / m.activeUsers).toFixed(1) : "—"}</strong></div>
      </div>
    </div>

    <!-- Category breakdown -->
    <div style="margin-bottom:20px;">
      <div style="font-size:13px;font-weight:600;color:#1a3d2b;margin-bottom:4px;">📚 Activity Rows by Category — Today</div>
      <div style="font-size:10px;color:#6b7280;margin-bottom:8px;">Session counts with non-null chat history (one user may have multiple sessions across categories)</div>
      <table style="width:100%;border-collapse:collapse;font-size:12px;">
        <thead>
          <tr style="background:#f5faf6;">
            <th style="padding:7px 12px;text-align:left;font-size:9px;color:#5a7060;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;">Category</th>
            <th style="padding:7px 12px;text-align:center;font-size:9px;color:#5a7060;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;">Sessions</th>
            <th style="padding:7px 16px;text-align:left;font-size:9px;color:#5a7060;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;">Share of total</th>
          </tr>
        </thead>
        <tbody>
          ${catRow("🤖 AI Learning",              m.catAiLearning,        m.totalActivities)}
          ${catRow("⚡ Skills Development",        m.catSkillsDevelopment, m.totalActivities)}
          ${catRow("🌍 English Skills",            m.catEnglishSkills,     m.totalActivities)}
          ${catRow("🏆 AI Proficiency Cert",       m.catAiProficiencyCert, m.totalActivities)}
          ${m.catOther > 0 ? catRow("📁 Other", m.catOther, m.totalActivities) : ""}
        </tbody>
      </table>
    </div>

    <!-- Playground -->
    <div style="background:#fffdf0;border:2px solid #fde68a;border-radius:10px;padding:14px 16px;margin-bottom:20px;">
      <div style="font-size:12px;font-weight:600;color:#92400e;margin-bottom:6px;">🎮 AI Playground — Today</div>
      <div style="display:flex;gap:24px;flex-wrap:wrap;font-size:12px;color:#374151;">
        <div>Users active: <strong style="color:${m.playgroundUsers > 0 ? "#065f46" : "#9ca3af"};">${m.playgroundUsers}</strong></div>
        <div>Chat sessions created/updated: <strong>${m.playgroundChatsTotal}</strong></div>
      </div>
    </div>

    <!-- Certifications -->
    <div style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:10px;padding:14px 16px;margin-bottom:24px;">
      <div style="font-size:12px;font-weight:600;color:#4c1d95;margin-bottom:6px;">🏆 Certifications</div>
      <div style="display:flex;gap:24px;flex-wrap:wrap;font-size:12px;color:#374151;">
        <div>Ever attempted (all-time): <strong style="color:#4c1d95;">${m.certAttemptedUsers}</strong> of ${m.totalAfricaUsers} learners</div>
        <div>Updated today: <strong style="color:${m.certAttemptedToday > 0 ? "#166534" : "#9ca3af"};">${m.certAttemptedToday}</strong></div>
      </div>
    </div>

    <!-- Footer -->
    <div style="border-top:1px solid #e5e7eb;padding-top:14px;color:#9ca3af;font-size:10px;">
      <div>🕛 Generated at 12:00 WAT (11:00 UTC) &nbsp;·&nbsp; 🌍 Africa cohort &nbsp;·&nbsp;
        <a href="https://girls-aiing-and-vibing.vercel.app" style="color:#2d6a4f;text-decoration:none;">Open App ↗</a>
      </div>
      <div style="margin-top:3px;">Facilitator accounts excluded. <strong>Active users</strong> and <strong>Playground users</strong> are distinct user counts. Category rows and Total Activities are dashboard row counts (one user may have multiple rows).</div>
    </div>

  </div>
</div>
</body></html>`;
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const cronSecret = process.env.CRON_SECRET;
  const isVercelCron    = req.headers["authorization"] === `Bearer ${cronSecret}`;
  const isManualTrigger = req.headers["x-cron-secret"] === cronSecret && !!cronSecret;
  if (!isVercelCron && !isManualTrigger) return res.status(401).json({ error: "Unauthorized" });

  // Allow manual override of the date via query param: ?date=2026-03-21
  const logDate = (req.query.date as string) || todayWAT();
  const dateLabel = new Date(logDate).toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  console.log(`\n${"─".repeat(50)}\nDAILY REPORT — ${dateLabel}\n${"─".repeat(50)}`);

  try {
    const metrics = await fetchMetrics(logDate);

    console.log(`  Africa users:       ${metrics.totalAfricaUsers}`);
    console.log(`  Active today:       ${metrics.activeUsers} unique users`);
    console.log(`  Total activities:   ${metrics.totalActivities} rows`);
    console.log(`  AI Learning:        ${metrics.catAiLearning}`);
    console.log(`  Skills Dev:         ${metrics.catSkillsDevelopment}`);
    console.log(`  English Skills:     ${metrics.catEnglishSkills}`);
    console.log(`  AI Prof Cert:       ${metrics.catAiProficiencyCert}`);
    console.log(`  Other:              ${metrics.catOther}`);
    console.log(`  Playground users:   ${metrics.playgroundUsers}`);
    console.log(`  Playground chats:   ${metrics.playgroundChatsTotal}`);
    console.log(`  Cert attempted:     ${metrics.certAttemptedUsers} (all-time)`);
    console.log(`  Cert today:         ${metrics.certAttemptedToday}`);

    // Upsert — capture error explicitly
    let upsertError: string | null = null;
    try {
      const { error } = await supabase
        .from("daily_activity_log")
        .upsert({
          log_date:                metrics.logDate,
          logged_at:               new Date().toISOString(),
          active_users:            metrics.activeUsers,
          cat_ai_learning:         metrics.catAiLearning,
          cat_skills_development:  metrics.catSkillsDevelopment,
          cat_english_skills:      metrics.catEnglishSkills,
          cat_ai_proficiency_cert: metrics.catAiProficiencyCert,
          cat_other:               metrics.catOther,
          playground_users:        metrics.playgroundUsers,
          playground_chats_total:  metrics.playgroundChatsTotal,
          cert_attempted_users:    metrics.certAttemptedUsers,
          cert_attempted_today:    metrics.certAttemptedToday,
          total_activities:        metrics.totalActivities,
          total_africa_users:      metrics.totalAfricaUsers,
        }, { onConflict: "log_date" });
      if (error) { upsertError = error.message; console.error("❌ Upsert error:", error.message); }
      else console.log(`✅ daily_activity_log upserted for ${metrics.logDate}`);
    } catch (e: any) {
      upsertError = e.message;
      console.error("❌ Upsert threw:", e.message);
    }

    // Email — capture error explicitly
    let emailError: string | null = null;
    try {
      const resendKey = process.env.RESEND_API_KEY;
      if (!resendKey) {
        emailError = "RESEND_API_KEY not set";
        console.warn("⚠️  RESEND_API_KEY not set — skipping email");
      } else {
        const html = buildEmailHtml(metrics, dateLabel);
        const activeLabel = `${metrics.activeUsers} active · ${metrics.playgroundUsers} playground · ${metrics.certAttemptedUsers} cert`;
        const emailRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "Girls AIing & Vibing <onboarding@resend.dev>",
            to: ["khallinan1@udayton.edu"],
            subject: `📅 Daily Report — ${dateLabel} · ${activeLabel}`,
            html,
          }),
        });
        if (!emailRes.ok) {
          const txt = await emailRes.text();
          emailError = `Resend ${emailRes.status}: ${txt}`;
          console.error("❌ Resend error:", emailError);
        } else {
          console.log("✉️  Daily report emailed");
        }
      }
    } catch (e: any) {
      emailError = e.message;
      console.error("❌ Email threw:", e.message);
    }

    return res.status(200).json({
      date: logDate,
      metrics: {
        activeUsers:       metrics.activeUsers,
        totalActivities:   metrics.totalActivities,
        totalAfricaUsers:  metrics.totalAfricaUsers,
        categories: {
          aiLearning:        metrics.catAiLearning,
          skillsDevelopment: metrics.catSkillsDevelopment,
          englishSkills:     metrics.catEnglishSkills,
          aiProficiencyCert: metrics.catAiProficiencyCert,
          other:             metrics.catOther,
        },
        playgroundUsers:    metrics.playgroundUsers,
        certAttemptedUsers: metrics.certAttemptedUsers,
      },
      upsertOk:    upsertError === null,
      upsertError: upsertError,
      emailOk:     emailError === null,
      emailError:  emailError,
    });
  } catch (err: any) {
    console.error("❌ Fatal:", err.message);
    return res.status(500).json({ error: err.message });
  }
}