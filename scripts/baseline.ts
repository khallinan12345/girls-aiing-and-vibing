/**
 * ═══════════════════════════════════════════════════════════════════
 * BASELINE PERSONALITY ASSESSMENT
 * Run ONCE per user - uses ALL data since Aug 1, 2025
 * Africa users only
 * ═══════════════════════════════════════════════════════════════════
 */

import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

// ────────────────────────────────────────────────────────────────────
// Configuration
// ────────────────────────────────────────────────────────────────────

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const openaiKey = process.env.OPENAI_API_KEY!;

if (!supabaseUrl || !supabaseKey || !openaiKey) {
  console.error("❌ Missing required environment variables:");
  console.error("   SUPABASE_URL:", !!supabaseUrl);
  console.error("   SUPABASE_SERVICE_ROLE_KEY:", !!supabaseKey);
  console.error("   OPENAI_API_KEY:", !!openaiKey);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const openai = new OpenAI({ apiKey: openaiKey });

// ────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────

interface PersonalityResult {
  openness_score: number;
  conscientiousness_score: number;
  extraversion_score: number;
  agreeableness_score: number;
  neuroticism_score: number;
  openness_evidence: string[];
  conscientiousness_evidence: string[];
  extraversion_evidence: string[];
  agreeableness_evidence: string[];
  neuroticism_evidence: string[];
  communication_strategy: {
    preferred_tone: string;
    interaction_style: string;
    detail_level: string;
    recommendations: string[];
  };
  learning_strategy: {
    learning_style: string;
    motivation_approach: string;
    pacing_preference: string;
    recommendations: string[];
  };
}

/**
 * Communication Maturity Scale (0–3)
 *
 * 0 — Pre-literate / Very Basic
 *     Single words, short fragments, or severely broken sentences.
 *     Spelling/grammar errors frequently obscure meaning.
 *     Cannot construct complete sentences consistently.
 *     Example signals: "i have know food sins lass week", one-word replies,
 *     repeated short fragments like "go again", inability to read noted.
 *
 * 1 — Emerging
 *     Simple short sentences, frequent grammar/spelling errors but meaning
 *     is usually recoverable. Basic vocabulary. Can express simple ideas
 *     with noticeable gaps. Most first-generation learners fall here.
 *     Example signals: "Good morning sir", "please explain it again",
 *     "honesty is a great gain", repetitive short questions.
 *
 * 2 — Developing
 *     Multi-sentence responses. Errors present but meaning is clear.
 *     Can express ideas with some structure. Growing vocabulary.
 *     Capable of explaining reasoning and considering alternatives.
 *     Example signals: "I will first of all check what I did if I make
 *     mistake I will correct it", considers community impact, structured goals.
 *
 * 3 — Proficient
 *     Well-structured paragraphs. Communicates complex or abstract ideas
 *     clearly. Mostly correct grammar. Extended vocabulary. Can construct
 *     arguments, compare options, or give detailed explanations unprompted.
 *     Example signals: Builds decision-making rubrics, explores AI in
 *     healthcare/business, multi-step reasoning without prompting.
 */
interface CommunicationLevelResult {
  communication_level: 0 | 1 | 2 | 3;
  communication_level_evidence: string;
}

// ────────────────────────────────────────────────────────────────────
// Communication Level Assessment (separate API call)
// ────────────────────────────────────────────────────────────────────

async function assessCommunicationLevel(
  userMessages: string,
  messageCount: number
): Promise<CommunicationLevelResult> {
  const prompt = `You are assessing the communication maturity of a young learner in rural Nigeria engaging with an AI learning platform. Their messages were written in English, which is their second or third language.

COMMUNICATION MATURITY SCALE:
  0 — Pre-literate / Very Basic: Single words, short fragments, or severely broken sentences. Spelling/grammar errors frequently obscure meaning. Cannot construct complete sentences consistently.
  1 — Emerging: Simple short sentences with frequent grammar/spelling errors, but meaning is usually recoverable. Basic vocabulary. Can express simple ideas with noticeable gaps. Most first-generation digital learners fall here.
  2 — Developing: Multi-sentence responses. Errors present but meaning is clear. Can express ideas with some structure. Growing vocabulary. Can explain reasoning and consider alternatives.
  3 — Proficient: Well-structured responses. Communicates complex or abstract ideas clearly. Mostly correct grammar. Extended vocabulary. Can construct arguments, compare options, or give detailed explanations unprompted.

LEARNER MESSAGES (${messageCount} total, sample shown):
${userMessages.slice(0, 3000)}

Assign a single integer score (0, 1, 2, or 3) that best characterises the overall communication maturity level across these messages. If messages vary widely, score the TYPICAL level — not the best or worst example.

Provide a 1–2 sentence justification citing specific language evidence from the messages.

Respond ONLY with valid JSON in this exact format:
{
  "communication_level": 1,
  "communication_level_evidence": "Learner typically writes short simple sentences with frequent spelling errors (e.g. 'i have know food sins lass week') but meaning is usually recoverable. Vocabulary is limited to familiar concrete concepts."
}`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content:
          "You are a specialist in assessing written communication maturity for first-generation digital learners in sub-Saharan Africa. Respond only with valid JSON.",
      },
      { role: "user", content: prompt },
    ],
    response_format: { type: "json_object" },
    temperature: 0.2, // Low temperature — we want consistent, calibrated scoring
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error("Empty response from OpenAI for communication level");

  const result = JSON.parse(content) as CommunicationLevelResult;

  // Clamp to valid range in case model drifts
  result.communication_level = Math.max(0, Math.min(3, Math.round(result.communication_level))) as 0 | 1 | 2 | 3;

  return result;
}

// ────────────────────────────────────────────────────────────────────
// Assessment Function
// ────────────────────────────────────────────────────────────────────

async function assessPersonalityBaseline(userId: string): Promise<PersonalityResult | null> {
  console.log(`\n🧠 Assessing baseline personality for user ${userId}...`);

  // Check if already assessed
  const { data: existing } = await supabase
    .from("user_personality_baseline")
    .select("user_id, measured_at")
    .eq("user_id", userId)
    .single();

  if (existing) {
    console.log(`⚠️  User ${userId} already has baseline assessment.`);
    console.log(`   Measured at: ${existing.measured_at}`);
    console.log(`   Skipping.`);
    return null;
  }

  // Fetch ALL conversation history since August 1, 2025
  const startDate = new Date("2025-08-01T00:00:00Z");

  const { data: activities, error } = await supabase
    .from("dashboard")
    .select("chat_history, created_at")
    .eq("user_id", userId)
    .gte("created_at", startDate.toISOString())
    .order("created_at", { ascending: false });

  if (error || !activities || activities.length === 0) {
    console.log(`❌ No conversation history since Aug 1, 2025. Cannot assess.`);
    return null;
  }

  console.log(`   Found ${activities.length} activities since Aug 1, 2025`);

  // Extract user messages from chat_history (stored as TEXT, needs parsing)
  const parsedMessages = activities.flatMap((a) => {
    try {
      const chatHistory =
        typeof a.chat_history === "string"
          ? JSON.parse(a.chat_history)
          : a.chat_history || [];
      return chatHistory;
    } catch {
      return [];
    }
  });

  const userMessageObjects = parsedMessages.filter((m: any) => m.role === "user");
  const userMessages = userMessageObjects.map((m: any) => m.content).join("\n\n");

  if (!userMessages.trim()) {
    console.log(`❌ No user messages found`);
    return null;
  }

  const messageCount = userMessageObjects.length;
  console.log(`   Analyzing ${messageCount} user messages`);

  // ── CALL 1: Big Five personality + communication/learning strategies ──────
  const personalityPrompt = `You are a personality assessment expert. Analyze the following conversation excerpts from a learner in rural Africa engaging with an AI learning platform. The learner is developing AI proficiency and exploring productive use of energy concepts.

CONVERSATION EXCERPTS (All conversations since Aug 2025):
${userMessages}

Assess the learner's Big Five personality traits based on the conversation patterns, language use, question styles, persistence, engagement approach, and communication preferences.

For each trait, provide:
- Score (0-100)
- 3-5 specific evidence quotes or patterns from the conversation

Then provide:
- Communication strategy recommendations (tone, style, detail level) - how should an AI tutor communicate with this learner based on their personality?
- Learning strategy recommendations (learning style, motivation approach, pacing) - what teaching approaches work best for this learner?

Respond ONLY with valid JSON in this exact format:
{
  "openness_score": 75,
  "conscientiousness_score": 65,
  "extraversion_score": 50,
  "agreeableness_score": 80,
  "neuroticism_score": 35,
  "openness_evidence": ["shows curiosity about new AI applications", "asks 'what if' questions", "explores creative uses"],
  "conscientiousness_evidence": ["follows through on multi-step tasks", "reviews work carefully"],
  "extraversion_evidence": ["expresses enthusiasm", "shares ideas freely"],
  "agreeableness_evidence": ["collaborative language", "considers community impact"],
  "neuroticism_evidence": ["maintains steady engagement", "handles challenges calmly"],
  "communication_strategy": {
    "preferred_tone": "collaborative and encouraging",
    "interaction_style": "dialogue-driven with open-ended questions",
    "detail_level": "detailed explanations with examples",
    "recommendations": ["Use inclusive language", "Provide concrete examples", "Encourage exploration"]
  },
  "learning_strategy": {
    "learning_style": "experiential with hands-on practice",
    "motivation_approach": "intrinsic motivation through real-world application",
    "pacing_preference": "self-paced with checkpoints",
    "recommendations": ["Connect to local context", "Provide autonomy", "Celebrate incremental progress"]
  }
}`;

  try {
    console.log(`   [Call 1/2] Assessing Big Five personality traits...`);
    const personalityCompletion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a personality assessment expert. Respond only with valid JSON.",
        },
        { role: "user", content: personalityPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    const personalityContent = personalityCompletion.choices[0]?.message?.content;
    if (!personalityContent) throw new Error("Empty response from OpenAI (personality)");
    const personalityResult: PersonalityResult = JSON.parse(personalityContent);

    // ── CALL 2: Communication maturity level (0–3 integer) ──────────────────
    console.log(`   [Call 2/2] Assessing communication maturity level...`);
    const commResult = await assessCommunicationLevel(userMessages, messageCount);

    console.log(`   Communication level: ${commResult.communication_level}/3`);
    console.log(`   Evidence: ${commResult.communication_level_evidence}`);

    // ── Save to database ────────────────────────────────────────────────────
    console.log(`   Saving to database...`);
    const { error: insertError } = await supabase
      .from("user_personality_baseline")
      .insert({
        user_id: userId,
        openness_score: personalityResult.openness_score,
        conscientiousness_score: personalityResult.conscientiousness_score,
        extraversion_score: personalityResult.extraversion_score,
        agreeableness_score: personalityResult.agreeableness_score,
        neuroticism_score: personalityResult.neuroticism_score,
        openness_evidence: personalityResult.openness_evidence,
        conscientiousness_evidence: personalityResult.conscientiousness_evidence,
        extraversion_evidence: personalityResult.extraversion_evidence,
        agreeableness_evidence: personalityResult.agreeableness_evidence,
        neuroticism_evidence: personalityResult.neuroticism_evidence,
        communication_strategy: personalityResult.communication_strategy,
        learning_strategy: personalityResult.learning_strategy,
        communication_level: commResult.communication_level,
        assessment_model: "gpt-4o",
        assessment_version: "v1.1",
      });

    if (insertError) throw insertError;

    console.log(`✅ Baseline assessment saved`);
    console.log(`   Big 5 Scores:`);
    console.log(`   - Openness:           ${personalityResult.openness_score}`);
    console.log(`   - Conscientiousness:  ${personalityResult.conscientiousness_score}`);
    console.log(`   - Extraversion:       ${personalityResult.extraversion_score}`);
    console.log(`   - Agreeableness:      ${personalityResult.agreeableness_score}`);
    console.log(`   - Neuroticism:        ${personalityResult.neuroticism_score}`);
    console.log(`   - Communication Level: ${commResult.communication_level}/3`);

    return personalityResult;
  } catch (err: any) {
    console.error(`❌ Error assessing personality:`, err.message);
    return null;
  }
}

// ────────────────────────────────────────────────────────────────────
// Helper: Get African users without baseline
// ────────────────────────────────────────────────────────────────────

async function getAfricanUsersWithoutBaseline(): Promise<string[]> {
  console.log(`\n🔍 Finding African users without baseline assessment...`);

  const { data: africanProfiles, error: profileError } = await supabase
    .from("profiles")
    .select("id")
    .eq("continent", "Africa");

  if (profileError) {
    console.error(`❌ Error fetching African profiles:`, profileError.message);
    return [];
  }

  const africanUserIds = africanProfiles?.map((p) => p.id) || [];
  console.log(`   Found ${africanUserIds.length} African users in profiles`);

  if (africanUserIds.length === 0) return [];

  const startDate = new Date("2025-08-01T00:00:00Z");

  const { data: activities, error: activityError } = await supabase
    .from("dashboard")
    .select("user_id")
    .in("user_id", africanUserIds)
    .gte("created_at", startDate.toISOString());

  if (activityError) {
    console.error(`❌ Error fetching activities:`, activityError.message);
    return [];
  }

  const activeUserIds = [
    ...new Set(activities?.map((a) => a.user_id).filter((id) => id !== null)),
  ] as string[];
  console.log(`   Found ${activeUserIds.length} African users with activity since Aug 2025`);

  const { data: baselines, error: baselineError } = await supabase
    .from("user_personality_baseline")
    .select("user_id")
    .in(
      "user_id",
      activeUserIds.length > 0
        ? activeUserIds
        : ["00000000-0000-0000-0000-000000000000"]
    );

  if (baselineError) {
    console.error(`❌ Error fetching baselines:`, baselineError.message);
    return activeUserIds;
  }

  const userIdsWithBaseline = new Set(baselines?.map((b) => b.user_id) || []);
  const usersWithoutBaseline = activeUserIds.filter(
    (id) => !userIdsWithBaseline.has(id)
  );

  console.log(`   Users already assessed: ${userIdsWithBaseline.size}`);
  console.log(`   Users needing baseline: ${usersWithoutBaseline.length}`);

  return usersWithoutBaseline;
}

// ────────────────────────────────────────────────────────────────────
// Backfill: Update communication_level for rows that already have
// a baseline but were assessed before v1.1 (communication_level = 0)
// Run with: npx tsx baseline.ts --backfill
// ────────────────────────────────────────────────────────────────────

async function backfillCommunicationLevel(): Promise<void> {
  console.log("\n🔄 Backfilling communication_level for existing assessments...");

  const { data: rows, error } = await supabase
    .from("user_personality_baseline")
    .select("user_id, communication_level")
    .eq("communication_level", 0);

  if (error) { console.error("❌ Error fetching rows:", error.message); return; }
  if (!rows || rows.length === 0) {
    console.log("✅ No rows to backfill (all already have non-zero communication_level).");
    return;
  }

  console.log(`   Found ${rows.length} rows with communication_level = 0`);

  let updated = 0;
  for (const row of rows) {
    const { data: activities } = await supabase
      .from("dashboard")
      .select("chat_history")
      .eq("user_id", row.user_id)
      .gte("created_at", "2025-08-01T00:00:00Z");

    const userMessages = (activities || [])
      .flatMap((a) => {
        try {
          const h = typeof a.chat_history === "string" ? JSON.parse(a.chat_history) : a.chat_history || [];
          return h;
        } catch { return []; }
      })
      .filter((m: any) => m.role === "user");

    if (userMessages.length < 3) {
      console.log(`   ⚠️  ${row.user_id}: not enough messages, skipping`);
      continue;
    }

    try {
      const commResult = await assessCommunicationLevel(
        userMessages.map((m: any) => m.content).join("\n\n"),
        userMessages.length
      );

      await supabase
        .from("user_personality_baseline")
        .update({ communication_level: commResult.communication_level, updated_at: new Date().toISOString() })
        .eq("user_id", row.user_id);

      console.log(`   ✅ ${row.user_id}: level ${commResult.communication_level} — ${commResult.communication_level_evidence.slice(0, 80)}...`);
      updated++;
    } catch (err: any) {
      console.error(`   ❌ ${row.user_id}: ${err.message}`);
    }

    await new Promise((r) => setTimeout(r, 1500));
  }

  console.log(`\n✅ Backfill complete: ${updated}/${rows.length} rows updated.`);
}

// ────────────────────────────────────────────────────────────────────
// Main Execution
// ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n═══════════════════════════════════════════════════════════════════");
  console.log("BASELINE PERSONALITY ASSESSMENT - AFRICA USERS  (v1.1)");
  console.log("Includes: Big Five · Communication/Learning Strategy · Communication Level");
  console.log("═══════════════════════════════════════════════════════════════════");

  // --backfill flag: re-assess communication_level for existing rows only
  if (process.argv.includes("--backfill")) {
    await backfillCommunicationLevel();
    return;
  }

  // Optional: target a specific user
  const specificUserId = process.argv[2];
  if (specificUserId && !specificUserId.startsWith("--")) {
    console.log(`\n🎯 Running for specific user: ${specificUserId}`);
    await assessPersonalityBaseline(specificUserId);
    return;
  }

  const userIds = await getAfricanUsersWithoutBaseline();

  if (userIds.length === 0) {
    console.log("\n✅ All African users already have baseline assessments!");
    return;
  }

  console.log(`\n📋 Processing ${userIds.length} users...`);

  let successCount = 0;
  let skipCount = 0;

  for (const userId of userIds) {
    const result = await assessPersonalityBaseline(userId);
    if (result) { successCount++; } else { skipCount++; }

    if (userIds.indexOf(userId) < userIds.length - 1) {
      console.log(`   Waiting 2 seconds before next assessment...`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  console.log("\n═══════════════════════════════════════════════════════════════════");
  console.log("BASELINE ASSESSMENT COMPLETE");
  console.log(`✅ Successful: ${successCount}`);
  console.log(`⚠️  Skipped:   ${skipCount}`);
  console.log("═══════════════════════════════════════════════════════════════════\n");
}

main().catch((err) => {
  console.error("\n❌ Fatal error:", err.message);
  process.exit(1);
});