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
  city: string;              // "Oloibiri" | "Ibiade"
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

async function fetchMetrics(logDate: string, cohortIds: string[], city: string): Promise<DailyMetrics> {
  // Day boundaries in UTC (WAT day starts at UTC-1 offset, i.e. 23:00 prev day)
  // Since we run at 11:00 UTC = 12:00 WAT, we use the WAT date's UTC window:
  // WAT 00:00 = UTC 23:00 previous day → WAT 23:59 = UTC 22:59 same day
  const dayStartUTC = new Date(`${logDate}T00:00:00+01:00`).toISOString();
  const dayEndUTC   = new Date(`${logDate}T23:59:59+01:00`).toISOString();

  const totalAfricaUsers = cohortIds.length;

  if (!cohortIds.length) {
    return {
      logDate, city, totalAfricaUsers: 0,
      activeUsers: 0, totalActivities: 0,
      catAiLearning: 0, catSkillsDevelopment: 0, catEnglishSkills: 0,
      catAiProficiencyCert: 0, catOther: 0,
      playgroundUsers: 0, playgroundChatsTotal: 0,
      certAttemptedUsers: 0, certAttemptedToday: 0,
    };
  }

  // ── 2. Dashboard sessions started OR updated on this day ────────────────
  const [{ data: createdRows }, { data: updatedRows }] = await Promise.all([
    supabase
      .from("dashboard")
      .select("id, user_id, category_activity, activity")
      .in("user_id", cohortIds)
      .not("chat_history", "is", null)
      .gte("created_at", dayStartUTC)
      .lte("created_at", dayEndUTC),
    supabase
      .from("dashboard")
      .select("id, user_id, category_activity, activity")
      .in("user_id", cohortIds)
      .not("chat_history", "is", null)
      .gte("updated_at", dayStartUTC)
      .lte("updated_at", dayEndUTC),
  ]);

  const sessionMap = new Map<string, { id: string; user_id: string; category_activity: string; activity: string }>();
  for (const row of [...(createdRows || []), ...(updatedRows || [])]) {
    sessionMap.set(row.id, row);
  }
  const sessionRows = [...sessionMap.values()];
  const totalActivities = sessionRows.length;
  const activeUserSet = new Set(sessionRows.map((r) => r.user_id));
  const activeUsers = activeUserSet.size;

  // ── 3. Category breakdown ────────────────────────────────────────────────
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

  // ── 4. AI Playground ─────────────────────────────────────────────────────
  const [{ data: pgCreated }, { data: pgUpdated }] = await Promise.all([
    supabase.from("ai_playground_chats").select("id, user_id")
      .in("user_id", cohortIds).gte("created_at", dayStartUTC).lte("created_at", dayEndUTC),
    supabase.from("ai_playground_chats").select("id, user_id")
      .in("user_id", cohortIds).gte("updated_at", dayStartUTC).lte("updated_at", dayEndUTC),
  ]);
  const pgMap = new Map<string, string>();
  for (const row of [...(pgCreated || []), ...(pgUpdated || [])]) pgMap.set(row.id, row.user_id);
  const pgRowsToday = [...pgMap.entries()].map(([id, user_id]) => ({ id, user_id }));
  const playgroundUsers = new Set(pgRowsToday.map((r) => r.user_id)).size;
  const playgroundChatsTotal = pgRowsToday.length;

  // ── 5. Certifications ─────────────────────────────────────────────────────
  const { data: certRowsAllTime } = await supabase
    .from("dashboard").select("user_id, created_at, updated_at")
    .in("user_id", cohortIds)
    .eq("activity", "AI Proficiency Certification")
    .not("certification_evaluation_score", "is", null);
  const certAllTime = certRowsAllTime || [];
  const certAttemptedUsers = new Set(certAllTime.map((r) => r.user_id)).size;
  const certAttemptedToday = new Set(
    certAllTime
      .filter((r) =>
        (r.created_at >= dayStartUTC && r.created_at <= dayEndUTC) ||
        (r.updated_at >= dayStartUTC && r.updated_at <= dayEndUTC)
      )
      .map((r) => r.user_id)
  ).size;

  return {
    logDate, city, totalAfricaUsers,
    activeUsers, totalActivities,
    catAiLearning:        catCounts.aiLearning,
    catSkillsDevelopment: catCounts.skillsDevelopment,
    catEnglishSkills:     catCounts.englishSkills,
    catAiProficiencyCert: catCounts.aiProficiencyCert,
    catOther:             catCounts.other,
    playgroundUsers, playgroundChatsTotal,
    certAttemptedUsers, certAttemptedToday,
  };
}

// ─── Email HTML ───────────────────────────────────────────────────────────────

function catRow(label: string, count: number, total: number): string {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  const w = Math.min(pct * 1.2, 120);
  const active = count > 0;
  return `
  <tr style="border-top:1px solid #e5e7eb;">
    <td style="padding:6px 10px;font-size:11px;color:#374151;">${label}</td>
    <td style="padding:6px 10px;text-align:center;font-size:12px;font-weight:700;color:${active ? "#1a3d2b" : "#9ca3af"};">${count}</td>
    <td style="padding:6px 16px;">
      <span style="display:inline-block;background:#e5e7eb;border-radius:3px;width:120px;height:7px;vertical-align:middle;">
        <span style="display:inline-block;background:${active ? "#2d6a4f" : "#e5e7eb"};border-radius:3px;height:7px;width:${w}px;"></span>
      </span>
      <span style="font-size:10px;color:#6b7280;margin-left:6px;">${pct}%</span>
    </td>
  </tr>`;
}

function buildCohortPanel(m: DailyMetrics): string {
  const participationPct = m.totalAfricaUsers > 0
    ? Math.round((m.activeUsers / m.totalAfricaUsers) * 100)
    : 0;
  const isIbiade = m.city === "Ibiade";
  const accentBg    = isIbiade ? "#dbeafe" : "#dcfce7";
  const accentColor = isIbiade ? "#1e3a8a" : "#166534";
  const headerBg    = isIbiade
    ? "linear-gradient(135deg,#1a3d5c 0%,#1d6a8f 100%)"
    : "linear-gradient(135deg,#1a3d2b 0%,#2d6a4f 100%)";
  const subtitleColor = isIbiade ? "#52b0d0" : "#52b788";
  const institution   = isIbiade
    ? "Solardero Foundation · Ibiade, Ogun State"
    : "Davidson AI Innovation Center · Oloibiri, Bayelsa";

  return `
  <div style="margin-bottom:24px;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
    <div style="background:${headerBg};padding:16px 20px;">
      <div style="font-size:9px;letter-spacing:2px;text-transform:uppercase;color:${subtitleColor};margin-bottom:4px;font-weight:600;">${institution}</div>
      <div style="font-size:16px;font-weight:700;color:#fff;">${m.city} Cohort</div>
      <div style="font-size:11px;color:rgba(255,255,255,0.5);">${m.totalAfricaUsers} total learners</div>
    </div>
    <div style="padding:16px 20px;">
      <!-- Chips -->
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;">
        <div style="flex:1;min-width:90px;background:${accentBg};border-radius:8px;padding:10px;text-align:center;">
          <div style="font-size:20px;font-weight:800;color:${accentColor};">${m.activeUsers}</div>
          <div style="font-size:8px;color:${accentColor};font-weight:600;text-transform:uppercase;letter-spacing:0.9px;margin-top:3px;">Active Today</div>
        </div>
        <div style="flex:1;min-width:90px;background:#dbeafe;border-radius:8px;padding:10px;text-align:center;">
          <div style="font-size:20px;font-weight:800;color:#1e40af;">${participationPct}%</div>
          <div style="font-size:8px;color:#1e40af;font-weight:600;text-transform:uppercase;letter-spacing:0.9px;margin-top:3px;">Participation</div>
        </div>
        <div style="flex:1;min-width:90px;background:#fef3c7;border-radius:8px;padding:10px;text-align:center;">
          <div style="font-size:20px;font-weight:800;color:#92400e;">${m.playgroundUsers}</div>
          <div style="font-size:8px;color:#92400e;font-weight:600;text-transform:uppercase;letter-spacing:0.9px;margin-top:3px;">Playground</div>
        </div>
        <div style="flex:1;min-width:90px;background:#f3e8ff;border-radius:8px;padding:10px;text-align:center;">
          <div style="font-size:20px;font-weight:800;color:#6b21a8;">${m.certAttemptedUsers}</div>
          <div style="font-size:8px;color:#6b21a8;font-weight:600;text-transform:uppercase;letter-spacing:0.9px;margin-top:3px;">Cert Attempted</div>
        </div>
      </div>
      <!-- Session overview -->
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:10px 12px;margin-bottom:12px;font-size:11px;color:#374151;">
        <div style="display:flex;gap:20px;flex-wrap:wrap;">
          <div>Unique active users: <strong>${m.activeUsers}</strong></div>
          <div>Total activity rows: <strong>${m.totalActivities}</strong></div>
          <div>Avg/user: <strong>${m.activeUsers > 0 ? (m.totalActivities / m.activeUsers).toFixed(1) : "—"}</strong></div>
        </div>
      </div>
      <!-- Category table -->
      <table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:12px;">
        <thead>
          <tr style="background:#f5faf6;">
            <th style="padding:6px 10px;text-align:left;font-size:9px;color:#5a7060;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;">Category</th>
            <th style="padding:6px 10px;text-align:center;font-size:9px;color:#5a7060;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;">Sessions</th>
            <th style="padding:6px 16px;text-align:left;font-size:9px;color:#5a7060;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;">Share</th>
          </tr>
        </thead>
        <tbody>
          ${catRow("🤖 AI Learning",         m.catAiLearning,        m.totalActivities)}
          ${catRow("⚡ Skills Development",   m.catSkillsDevelopment, m.totalActivities)}
          ${catRow("🌍 English Skills",       m.catEnglishSkills,     m.totalActivities)}
          ${catRow("🏆 AI Proficiency Cert",  m.catAiProficiencyCert, m.totalActivities)}
          ${m.catOther > 0 ? catRow("📁 Other", m.catOther, m.totalActivities) : ""}
        </tbody>
      </table>
      <!-- Playground + cert row -->
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <div style="flex:1;background:#fffdf0;border:1px solid #fde68a;border-radius:8px;padding:10px 12px;">
          <div style="font-size:10px;font-weight:600;color:#92400e;margin-bottom:4px;">🎮 Playground</div>
          <div style="font-size:11px;color:#374151;">Users: <strong>${m.playgroundUsers}</strong> &nbsp; Chats: <strong>${m.playgroundChatsTotal}</strong></div>
        </div>
        <div style="flex:1;background:#f5f3ff;border:1px solid #ddd6fe;border-radius:8px;padding:10px 12px;">
          <div style="font-size:10px;font-weight:600;color:#4c1d95;margin-bottom:4px;">🏆 Certifications</div>
          <div style="font-size:11px;color:#374151;">Ever attempted: <strong>${m.certAttemptedUsers}</strong> &nbsp; Today: <strong>${m.certAttemptedToday}</strong></div>
        </div>
      </div>
    </div>
  </div>`;
}

function buildEmailHtml(oloibiri: DailyMetrics, ibiade: DailyMetrics, dateLabel: string): string {
  const totalActive = oloibiri.activeUsers + ibiade.activeUsers;
  const totalLearners = oloibiri.totalAfricaUsers + ibiade.totalAfricaUsers;

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f2f8f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<div style="max-width:700px;margin:20px auto;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

  <!-- Header -->
  <div style="background:linear-gradient(135deg,#0d1b14 0%,#1a3d2b 60%,#1a3d5c 100%);padding:24px 28px;">
    <div style="font-size:9px;letter-spacing:2.5px;text-transform:uppercase;color:#52b788;margin-bottom:5px;font-weight:600;">
      Girls AIing &amp; Vibing · Oloibiri (Davidson AI) &amp; Ibiade (Solardero)
    </div>
    <div style="font-size:20px;font-weight:800;color:#fff;margin-bottom:2px;">Daily Activity Report</div>
    <div style="font-size:11px;color:rgba(255,255,255,0.5);">${dateLabel} · 12:00 Nigerian Time (WAT)</div>
    <div style="display:flex;gap:12px;margin-top:12px;flex-wrap:wrap;">
      <div style="background:rgba(255,255,255,0.12);border-radius:7px;padding:7px 12px;text-align:center;">
        <div style="font-size:18px;font-weight:700;color:#fff;">${totalActive}</div>
        <div style="font-size:8px;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:0.8px;">Total Active</div>
      </div>
      <div style="background:rgba(82,183,136,0.2);border-radius:7px;padding:7px 12px;text-align:center;">
        <div style="font-size:18px;font-weight:700;color:#52b788;">${oloibiri.activeUsers}</div>
        <div style="font-size:8px;color:#52b788;text-transform:uppercase;letter-spacing:0.8px;">Oloibiri</div>
      </div>
      <div style="background:rgba(82,176,208,0.2);border-radius:7px;padding:7px 12px;text-align:center;">
        <div style="font-size:18px;font-weight:700;color:#52b0d0;">${ibiade.activeUsers}</div>
        <div style="font-size:8px;color:#52b0d0;text-transform:uppercase;letter-spacing:0.8px;">Ibiade</div>
      </div>
      <div style="background:rgba(255,255,255,0.08);border-radius:7px;padding:7px 12px;text-align:center;">
        <div style="font-size:18px;font-weight:700;color:rgba(255,255,255,0.7);">${totalLearners}</div>
        <div style="font-size:8px;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:0.8px;">Total Cohort</div>
      </div>
    </div>
  </div>

  <div style="padding:20px 24px;">
    ${buildCohortPanel(oloibiri)}
    ${buildCohortPanel(ibiade)}

    <!-- Footer -->
    <div style="border-top:1px solid #e5e7eb;padding-top:12px;color:#9ca3af;font-size:10px;">
      <div>🕛 Generated at 12:00 WAT (11:00 UTC) &nbsp;·&nbsp; 🌍 Oloibiri + Ibiade cohorts &nbsp;·&nbsp;
        <a href="https://girls-aiing-and-vibing.vercel.app" style="color:#2d6a4f;text-decoration:none;">Open App ↗</a>
      </div>
      <div style="margin-top:3px;">Facilitator accounts excluded. Active users and Playground users are distinct user counts per cohort. Cohorts derived from profiles.city.</div>
    </div>
  </div>
</div>
</body></html>`;
// ─── Handler ─────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const cronSecret = process.env.CRON_SECRET;
  const isVercelCron    = req.headers["authorization"] === `Bearer ${cronSecret}`;
  const isManualTrigger = req.headers["x-cron-secret"] === cronSecret && !!cronSecret;
  if (!isVercelCron && !isManualTrigger) return res.status(401).json({ error: "Unauthorized" });

  const logDate = (req.query.date as string) || todayWAT();
  const dateLabel = new Date(logDate).toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  console.log(`\n${"─".repeat(50)}\nDAILY REPORT — ${dateLabel}\n${"─".repeat(50)}`);

  try {
    // ── Fetch all Africa profiles with city to split into cohorts ────────────
    const { data: africaProfiles } = await supabase
      .from("profiles")
      .select("id, city")
      .eq("continent", "Africa");

    const allProfiles = (africaProfiles || []).filter((p) => !EXCLUDED_USER_IDS.has(p.id));
    const oloibiriIds = allProfiles.filter((p) => p.city !== "Ibiade").map((p) => p.id);
    const ibiadeIds   = allProfiles.filter((p) => p.city === "Ibiade").map((p) => p.id);

    console.log(`  Oloibiri cohort: ${oloibiriIds.length} users`);
    console.log(`  Ibiade cohort:   ${ibiadeIds.length} users`);

    // ── Fetch metrics for both cohorts in parallel ───────────────────────────
    const [oloibiriMetrics, ibiadeMetrics] = await Promise.all([
      fetchMetrics(logDate, oloibiriIds, "Oloibiri"),
      fetchMetrics(logDate, ibiadeIds,   "Ibiade"),
    ]);

    const logMetrics = (label: string, m: DailyMetrics) => {
      console.log(`  [${label}] Active: ${m.activeUsers} · Activities: ${m.totalActivities} · Playground: ${m.playgroundUsers} · Certs: ${m.certAttemptedUsers}`);
    };
    logMetrics("Oloibiri", oloibiriMetrics);
    logMetrics("Ibiade",   ibiadeMetrics);

    // ── Upsert one row per cohort into daily_activity_log ───────────────────
    // Note: daily_activity_log needs composite unique key on (log_date, city)
    let upsertError: string | null = null;
    try {
      const upsertRows = [oloibiriMetrics, ibiadeMetrics].map((m) => ({
        log_date:                m.logDate,
        city:                    m.city,
        logged_at:               new Date().toISOString(),
        active_users:            m.activeUsers,
        cat_ai_learning:         m.catAiLearning,
        cat_skills_development:  m.catSkillsDevelopment,
        cat_english_skills:      m.catEnglishSkills,
        cat_ai_proficiency_cert: m.catAiProficiencyCert,
        cat_other:               m.catOther,
        playground_users:        m.playgroundUsers,
        playground_chats_total:  m.playgroundChatsTotal,
        cert_attempted_users:    m.certAttemptedUsers,
        cert_attempted_today:    m.certAttemptedToday,
        total_activities:        m.totalActivities,
        total_africa_users:      m.totalAfricaUsers,
      }));
      const { error } = await supabase
        .from("daily_activity_log")
        .upsert(upsertRows, { onConflict: "log_date,city" });
      if (error) { upsertError = error.message; console.error("❌ Upsert error:", error.message); }
      else console.log(`✅ daily_activity_log upserted for ${logDate} (Oloibiri + Ibiade)`);
    } catch (e: any) {
      upsertError = e.message;
      console.error("❌ Upsert threw:", e.message);
    }

    // ── Email ────────────────────────────────────────────────────────────────
    let emailError: string | null = null;
    try {
      const resendKey = process.env.RESEND_API_KEY;
      if (!resendKey) {
        emailError = "RESEND_API_KEY not set";
        console.warn("⚠️  RESEND_API_KEY not set — skipping email");
      } else {
        const html = buildEmailHtml(oloibiriMetrics, ibiadeMetrics, dateLabel);
        const totalActive = oloibiriMetrics.activeUsers + ibiadeMetrics.activeUsers;
        const activeLabel = `${totalActive} active (${oloibiriMetrics.activeUsers} Oloibiri · ${ibiadeMetrics.activeUsers} Ibiade)`;
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
          emailError = `Resend ${emailRes.status}: ${await emailRes.text()}`;
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
      oloibiri: {
        activeUsers: oloibiriMetrics.activeUsers,
        totalActivities: oloibiriMetrics.totalActivities,
        totalLearners: oloibiriMetrics.totalAfricaUsers,
      },
      ibiade: {
        activeUsers: ibiadeMetrics.activeUsers,
        totalActivities: ibiadeMetrics.totalActivities,
        totalLearners: ibiadeMetrics.totalAfricaUsers,
      },
      upsertOk: upsertError === null,
      upsertError,
      emailOk: emailError === null,
      emailError,
    });
  } catch (err: any) {
    console.error("❌ Fatal:", err.message);
    return res.status(500).json({ error: err.message });
  }
}