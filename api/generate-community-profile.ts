// api/generate-community-profile.ts
// Vercel Serverless Function
// Usage: POST /api/generate-community-profile
// Body: { city_town, state, country, user_id? }

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

// ─── Clients ────────────────────────────────────────────────────────────────

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!   // service role needed for storage + inserts
);

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

// ─── Types ───────────────────────────────────────────────────────────────────

interface RequestBody {
  city_town: string;
  state: string;
  country: string;
}

interface CategoryGroup {
  category: string;
  sub_category: string;
  count: number;
  samples: { title: string; description: string; outcomes: string; grade_level: number }[];
  learning_or_certification: string;
  assessment_category: string | null;
}

interface GeneratedModule {
  title: string;
  description: string;
  category: string;
  sub_category: string;
  outcomes: string;
  metrics_for_success: string;
  grade_level: number;
  ai_facilitator_instructions: string;
  ai_assessment_instructions: string;
  learning_or_certification: string;
  assessment_category?: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getContinent(country: string): string {
  const map: Record<string, string> = {
    'Nigeria': 'Africa', 'Kenya': 'Africa', 'Ghana': 'Africa',
    'Ethiopia': 'Africa', 'Tanzania': 'Africa', 'Uganda': 'Africa',
    'Rwanda': 'Africa', 'Senegal': 'Africa', 'Cameroon': 'Africa',
    'South Africa': 'Africa', 'Mozambique': 'Africa', 'Zambia': 'Africa',
    'Zimbabwe': 'Africa', 'Malawi': 'Africa', 'Niger': 'Africa',
    'Mali': 'Africa', 'Burkina Faso': 'Africa', 'Ivory Coast': 'Africa',
    "Côte d'Ivoire": 'Africa', 'Sierra Leone': 'Africa', 'Liberia': 'Africa',
    'USA': 'North America', 'United States': 'North America',
    'Canada': 'North America', 'Mexico': 'North America',
    'India': 'Asia', 'Bangladesh': 'Asia', 'Pakistan': 'Asia',
    'Indonesia': 'Asia', 'Philippines': 'Asia', 'Vietnam': 'Asia',
    'UK': 'Europe', 'United Kingdom': 'Europe', 'France': 'Europe',
    'Germany': 'Europe', 'Spain': 'Europe', 'Italy': 'Europe',
    'Brazil': 'South America', 'Colombia': 'South America',
    'Argentina': 'South America', 'Peru': 'South America',
    'Australia': 'Oceania', 'New Zealand': 'Oceania',
  };
  return map[country] ?? 'Africa';
}

function sanitizeFilePath(value: string): string {
  return value.replace(/[^a-zA-Z0-9_\-\.]/g, '_').replace(/_{2,}/g, '_');
}

function extractJSON(raw: string): string {
  // Strip markdown fences if present
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();
  // Find first [ to last ]
  const start = raw.indexOf('[');
  const end = raw.lastIndexOf(']');
  if (start !== -1 && end !== -1) return raw.slice(start, end + 1);
  return raw.trim();
}

// ─── Step 1: Research community profile with web search ───────────────────

async function researchCommunity(
  city_town: string,
  state: string,
  country: string
): Promise<string> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4000,
    tools: [{ type: 'web_search_20250305' as const, name: 'web_search' }],
    tool_choice: { type: 'auto' },
    messages: [
      {
        role: 'user',
        content: `Research and write a comprehensive community profile for **${city_town}, ${state}, ${country}**.

Cover ALL of the following sections in detail:

## 1. Main Livelihoods
What are the primary economic activities, industries, and employment patterns? What do most people do to earn income?

## 2. Key Challenges
What are the major social, economic, infrastructure, health, and environmental challenges facing this community?

## 3. Key Assets
What natural resources, community strengths, cultural assets, infrastructure, and human capital does this community possess?

## 4. Climate Crisis Impact
How is climate change specifically affecting farming, food security, water availability, and daily life in this community?

## 5. Key Needs
What are the most critical unmet needs across education, health, economic opportunity, and infrastructure?

## 6. Key Aspirations
What are the community's development priorities, and what do youth and community leaders aspire toward?

## 7. Digital & AI Readiness
What is the current state of internet access, mobile usage, digital literacy, and openness to technology-based learning?

Write this as a detailed, well-structured Markdown report suitable for informing educational curriculum design. Be specific to this actual community — use real data where available.`,
      },
    ],
  });

  // Collect all text blocks (web search may produce multiple turns)
  const textBlocks = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n\n');

  if (!textBlocks.trim()) {
    throw new Error('Claude returned no text for the community profile.');
  }

  return `# Community Profile: ${city_town}, ${state}, ${country}\n\n_Generated: ${new Date().toISOString()}_\n\n${textBlocks}`;
}

// ─── Step 2: Upload profile to Supabase Storage ───────────────────────────

async function uploadProfile(
  city_town: string,
  state: string,
  country: string,
  content: string
): Promise<string> {
  const filePath = `${sanitizeFilePath(country)}/${sanitizeFilePath(state)}/${sanitizeFilePath(city_town)}_profile.md`;

  const { error } = await supabase.storage
    .from('city_town_profile')
    .upload(filePath, content, {
      contentType: 'text/markdown; charset=utf-8',
      upsert: true,
    });

  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  return filePath;
}

// ─── Step 3: Fetch existing module structure from Supabase ────────────────

async function fetchModuleStructure(): Promise<Map<string, CategoryGroup>> {
  const { data, error } = await supabase
    .from('learning_modules')
    .select(
      'category, sub_category, title, description, outcomes, grade_level, learning_or_certification, assessment_category'
    )
    .in('category', ['AI Proficiency', 'Skills'])
    .order('category')
    .order('sub_category');

  if (error) throw new Error(`Failed to query learning_modules: ${error.message}`);
  if (!data || data.length === 0) throw new Error('No existing AI Proficiency or Skills modules found.');

  const groups = new Map<string, CategoryGroup>();

  for (const row of data) {
    const key = `${row.category}|||${row.sub_category ?? ''}`;
    if (!groups.has(key)) {
      groups.set(key, {
        category: row.category,
        sub_category: row.sub_category ?? '',
        count: 0,
        samples: [],
        learning_or_certification: row.learning_or_certification ?? 'learning',
        assessment_category: row.assessment_category ?? null,
      });
    }
    const group = groups.get(key)!;
    group.count++;
    if (group.samples.length < 4) {
      group.samples.push({
        title: row.title ?? '',
        description: row.description ?? '',
        outcomes: row.outcomes ?? '',
        grade_level: row.grade_level ?? 1,
      });
    }
  }

  return groups;
}

// ─── Step 4: Generate contextually aligned modules via Claude ──────────────

async function generateModules(
  city_town: string,
  state: string,
  country: string,
  profile: string,
  groups: Map<string, CategoryGroup>
): Promise<GeneratedModule[]> {

  const groupDescriptions = Array.from(groups.values())
    .map((g) => {
      const sampleTitles = g.samples.map((s) => `"${s.title}"`).join(', ');
      const sampleDesc = g.samples[0]?.description ?? '';
      return (
        `CATEGORY: "${g.category}" | SUB_CATEGORY: "${g.sub_category}" | ` +
        `ROWS_NEEDED: ${g.count} | SAMPLE_TITLES: [${sampleTitles}] | ` +
        `SAMPLE_DESC: "${sampleDesc.substring(0, 150)}..." | ` +
        `LEARNING_OR_CERT: "${g.learning_or_certification}" | ` +
        `ASSESSMENT_CATEGORY: "${g.assessment_category ?? 'null'}"`
      );
    })
    .join('\n');

  const prompt = `You are an expert curriculum designer creating hyper-local learning modules for an AI literacy platform.

COMMUNITY PROFILE (use this to ground every module in local context):
${profile}

TASK:
Generate new learning_modules rows for the category/sub_category groups below. Each module must be:
- 100% contextually aligned with ${city_town}, ${state}, ${country} (reference local livelihoods, crops, businesses, challenges)
- Following the same thematic structure as the sample titles (same pedagogy, same depth, same type of activity)
- Producing exactly ROWS_NEEDED rows per group

GROUPS TO GENERATE:
${groupDescriptions}

REQUIRED JSON FIELDS for each object:
- title: string (concise, specific to this community)
- description: string (2-3 sentences, locally grounded)
- category: string (EXACT value from CATEGORY above)
- sub_category: string (EXACT value from SUB_CATEGORY above)
- outcomes: string (3-5 measurable learning outcomes)
- metrics_for_success: string (how mastery is measured)
- grade_level: number (1-5, match existing samples)
- ai_facilitator_instructions: string (specific guidance for the AI facilitator, referencing local context)
- ai_assessment_instructions: string (how the AI should assess this module)
- learning_or_certification: string (EXACT value from LEARNING_OR_CERT above)
- assessment_category: string or null (EXACT value from ASSESSMENT_CATEGORY above)

Return ONLY a raw JSON array. No preamble, no explanation, no markdown fences.`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 8000,
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');

  let parsed: GeneratedModule[];
  try {
    parsed = JSON.parse(extractJSON(raw));
  } catch (e) {
    throw new Error(`Failed to parse generated modules JSON. Raw response preview: ${raw.substring(0, 300)}`);
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('Generated modules response was not a non-empty array.');
  }

  return parsed;
}

// ─── Step 5: Insert modules into Supabase ─────────────────────────────────

async function insertModules(
  modules: GeneratedModule[],
  city_town: string,
  state: string,
  country: string
): Promise<{ learning_module_id: string; title: string; category: string; sub_category: string }[]> {

  const now = new Date().toISOString();
  const continent = getContinent(country);

  const rows = modules.map((m) => ({
    title: m.title ?? null,
    description: m.description ?? null,
    category: m.category ?? null,
    sub_category: m.sub_category ?? null,
    outcomes: m.outcomes ?? null,
    metrics_for_success: m.metrics_for_success ?? null,
    grade_level: m.grade_level ?? 1,
    ai_facilitator_instructions: m.ai_facilitator_instructions ?? null,
    ai_assessment_instructions: m.ai_assessment_instructions ?? null,
    learning_or_certification: m.learning_or_certification ?? 'learning',
    assessment_category: m.assessment_category ?? null,
    city_town,
    state,
    country,
    continent,
    user_id: null,
    public: 0,
    application: 0,
    created_at: now,
    updated_at: now,
  }));

  const { data, error } = await supabase
    .from('learning_modules')
    .insert(rows)
    .select('learning_module_id, title, category, sub_category');

  if (error) throw new Error(`Module insert failed: ${error.message}`);
  return data ?? [];
}

// ─── Main Handler ─────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  // Auth check (optional bearer token guard)
  const authHeader = req.headers.authorization;
  if (process.env.API_SECRET && authHeader !== `Bearer ${process.env.API_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }

  const { city_town, state, country } = (req.body ?? {}) as RequestBody;

  if (!city_town?.trim() || !state?.trim() || !country?.trim()) {
    return res.status(400).json({
      error: 'Missing required fields.',
      required: ['city_town', 'state', 'country'],
    });
  }

  const log: string[] = [];
  const startTime = Date.now();

  try {
    log.push(`▶ Starting profile generation for ${city_town}, ${state}, ${country}`);

    // 1. Research
    log.push('🔍 Researching community with web search...');
    const profile = await researchCommunity(city_town.trim(), state.trim(), country.trim());
    log.push(`✅ Profile generated (${profile.length} chars)`);

    // 2. Upload
    log.push('📤 Uploading profile to Supabase storage...');
    const profilePath = await uploadProfile(city_town.trim(), state.trim(), country.trim(), profile);
    log.push(`✅ Uploaded to: ${profilePath}`);

    // 3. Fetch structure
    log.push('📋 Fetching existing module structure...');
    const groups = await fetchModuleStructure();
    const groupSummary = Array.from(groups.values()).map(
      (g) => `  • ${g.category} / ${g.sub_category}: ${g.count} rows`
    );
    log.push(`✅ Found ${groups.size} category/sub_category groups:\n${groupSummary.join('\n')}`);

    // 4. Generate modules
    log.push('🤖 Generating contextually aligned modules...');
    const generated = await generateModules(city_town.trim(), state.trim(), country.trim(), profile, groups);
    log.push(`✅ Generated ${generated.length} modules`);

    // 5. Insert
    log.push('💾 Inserting modules into learning_modules...');
    const inserted = await insertModules(generated, city_town.trim(), state.trim(), country.trim());
    log.push(`✅ Inserted ${inserted.length} rows`);

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    log.push(`🏁 Completed in ${duration}s`);

    return res.status(200).json({
      success: true,
      community: { city_town: city_town.trim(), state: state.trim(), country: country.trim() },
      profile_storage_path: profilePath,
      groups_processed: groups.size,
      modules_generated: generated.length,
      modules_inserted: inserted.length,
      modules: inserted,
      log,
      duration_seconds: parseFloat(duration),
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    log.push(`❌ Error: ${message}`);
    console.error('[generate-community-profile] Error:', message);
    return res.status(500).json({ success: false, error: message, log });
  }
}