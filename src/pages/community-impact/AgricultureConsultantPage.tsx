// src/pages/community-impact/AgricultureConsultantPage.tsx
//
// Agriculture Consultant — Community Impact Track
// Students learn to use AI as an agriculture advisory tool for farmers
// in the Oloibiri / Ogbia / Bayelsa community.
//
// Two modes:
//  LEARN — student chats with an expert AI tutor on chosen topic
//  CONSULT — student role-plays as consultant; AI plays a local farmer
//
// All content is deeply localised to the Niger Delta:
// cassava (primary crop), climate change crisis (flooding + dry season),
// oil spill damage, and resilience strategies.
//
// Route: /community-impact/agriculture
// Activity stored as: agriculture_consultant

import React, { useState, useEffect, useRef, useCallback } from 'react';
import AppLayout from '../../components/layout/AppLayout';
import { supabase } from '../../lib/supabaseClient';
import { chatText, chatJSON } from '../../lib/chatClient';
import { useAuth } from '../../hooks/useAuth';
import {
  Sprout, BookOpen, Users, ArrowLeft, Send, Mic, MicOff,
  Volume2, VolumeX, Save, Star, Loader2, X, ChevronRight,
  Thermometer, Droplets, AlertTriangle, Wheat, Scale,
  ShieldCheck, Lightbulb, Award, RefreshCw, CloudRain,
  Sun, Flame,
} from 'lucide-react';
import classNames from 'classnames';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

type AppMode = 'select' | 'learn-topics' | 'learn-chat' | 'consult-personas' | 'consult-prepare' | 'consult-chat';

interface LearningTopic {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  colour: string;
  urgency?: string;
}

interface FarmerPersona {
  id: string;
  name: string;
  age: string;
  description: string;
  emoji: string;
  colour: string;
  situation: string;
  primaryCrop: string;
  mainChallenge: string;
  openingLine: string;
  systemPrompt: string;
}

// ─── Niger Delta Climate & Agriculture Knowledge Base ─────────────────────────
// This is injected into every system prompt so the AI always speaks with
// deep, accurate local knowledge.

const NIGER_DELTA_CONTEXT = `
NIGER DELTA / OLOIBIRI AGRICULTURE CONTEXT (always apply this knowledge):

LOCATION & ECOLOGY:
- Oloibiri is in Ogbia LGA, Bayelsa State — one of the lowest-lying areas in Nigeria
- The community sits near Kolo Creek, surrounded by mangrove swamps and freshwater systems
- Two rainy seasons: Early rains (March–May) and Late rains (September–November)
- Dry season: December–February (getting hotter and longer due to climate change)
- The Niger and Nun Rivers overflow annually; Kolo Creek is a key local waterway

CLIMATE CHANGE CRISIS — THIS IS URGENT AND REAL:
- The 2022 floods were the worst in Bayelsa in a decade: over 300 communities submerged,
  1.3 million people displaced, 96 deaths, 94.9% of farming households lost crops
- Flood extent in the region grew 64% between 2018 and 2022 alone
- Bayelsa water levels reached 6.5m in October 2022 — devastating farmlands
- Climate change is causing: heavier and more intense rainfall events during wet season,
  longer and hotter dry seasons, sea level rise pushing saltwater inland through creeks,
  and irregular season onset (farmers no longer know when to plant)
- The paradox: too much water in wet season + too little in dry season
- Future outlook: flooding will worsen; saltwater intrusion will advance further inland;
  temperatures will rise 1.5–2°C by 2050; extreme events will increase in frequency
- Lagdo Dam in Cameroon is released seasonally and compounds downstream flooding

OIL CONTAMINATION (critical context):
- Oloibiri was where Nigeria's first oil was discovered in 1956
- Decades of spills from pipelines and illegal bunkering have contaminated soils and creeks
- Oil-contaminated soil: acidic, kills roots, prevents germination, destroys soil microbes
- Contaminated water: toxic to fish and crops; washing water onto fields spreads damage
- Signs: oily sheen on water, stunted yellowing plants near waterways, dead vegetation strips

PRIMARY CROPS & REALITIES:
CASSAVA (by far the most important crop):
- Varieties in use: local landraces + improved varieties TME 419 and TMS 30572
- TME 419: high-yielding, resistant to Cassava Mosaic Disease (CMD) and bacterial blight,
  erect growth habit, early maturing (8–12 months), best variety for the region
- TMS 30572: branching type, also CMD-resistant, good yield
- Sweet cassava: eaten fresh, boiled; Bitter cassava: processed into garri, fufu, tapioca
- Harvest window: 8–18 months (sweet), 18–24 months (bitter/starchy)
- 70% of Nigeria's cassava yield is processed into Gari
- CASSAVA IS CLIMATE-RESILIENT compared to yam, maize, and plantain — it tolerates
  heat up to 35°C and short drought periods; its underground roots survive mild flooding
- BUT: prolonged waterlogging rots roots; waterlogging at planting kills cuttings;
  root formation (3–6 months after planting) is most vulnerable to water stress

CASSAVA DISEASES (key threats):
1. Cassava Mosaic Disease (CMD): viral, spread by whiteflies; yellowing, mosaic leaf patterns,
   stunted growth; use certified TME 419 cuttings (resistant); rogue infected plants
2. Cassava Bacterial Blight (CBB): angular leaf spots, dieback; use clean cuttings, avoid wet-season planting
3. Cassava Root Rot: fungal/Phytophthora; caused by waterlogged soil; raised beds prevent this
4. Mealybug: sucks sap, causes leaf curl; natural enemies (parasitic wasps) help

OTHER CROPS:
- Yam: very vulnerable to flooding; needs well-drained ridges/mounds; mounds must be 60cm+ high now
- Plantain: tolerates humidity but roots rot in waterlogged soil; plant on elevated ground
- Palm oil: relatively resilient but oil spills kill trees; long-term crop (15–25 years productive)
- Rubber: long-term plantation crop; not for smallholders; tapping season depends on dry weather
- Maize: most vulnerable to flooding — 3 days of waterlogging destroys crop; plant on ridges
- Cocoyam: actually tolerates damp conditions better than most; good option in wetter areas
- Cowpea: excellent for dry season; nitrogen-fixing (improves soil); intercrop with cassava

RESILIENCE STRATEGIES (evidence-based):
1. RAISED BEDS & MOUNDS: Raise soil 50–80cm above flat ground; prevents root waterlogging
2. IMPROVED VARIETIES: TME 419 for cassava; early-maturing varieties that escape dry spells
3. PLANTING CALENDAR ADAPTATION: Plant cassava in March–April at first rains (not later);
   harvest before October–November peak flood season; never plant in September–October
4. CROP DIVERSIFICATION: Never depend on one crop; mix cassava + cowpea + plantain + vegetables
5. WATER HARVESTING: Collect rainwater in pits or tanks during heavy rains for dry-season use
6. MULCHING: Cover soil with dry grass/leaves to retain moisture in dry season
7. COMPOST & ORGANIC MATTER: Build soil health without expensive fertiliser; use compost pits
8. INTERCROPPING: Cassava + cowpea (cowpea fixes nitrogen, cassava benefits)
9. STAGGERED PLANTING: Plant in batches — if one fails to flood, another batch may survive
10. AGROFORESTRY: Plant trees (fruit trees, palms) on field edges as windbreaks and flood buffers
11. OIL SPILL REMEDIATION: Bioremediation using local bacteria; phytoremediation with sunflower
    or vetiver grass; lime application to reduce soil acidity

MARKET & ECONOMICS:
- Cassava garri price varies: ₦800–2,500/kg depending on season and quality
- Dry season cassava (scarce) fetches better prices — incentive to grow early
- Post-harvest loss is major: cassava roots rot within 2–3 days of harvest if not processed
- Processing into garri: extends shelf life to months; adds value 3–5×
- Market prices via phone: WhatsApp groups among traders in Yenagoa and Port Harcourt
- Cassava cuttings (planting material): improved varieties cost more but pay back quickly

TALKING WITH FARMERS:
- Speak in simple, plain language — avoid jargon like "phytopathogen"
- Connect advice to what the farmer already knows and has available
- Acknowledge the real pain of losing harvests to floods — it is traumatic and costly
- Don't promise things AI cannot deliver; always recommend visiting ADEP or extension agents
  for seed sourcing and soil testing
- Always give practical advice that can be implemented without money where possible
`;

// ─── Learning Topics ──────────────────────────────────────────────────────────

const LEARNING_TOPICS: LearningTopic[] = [
  {
    id: 'climate',
    title: 'Climate Change & Flooding',
    subtitle: 'Understanding what is happening and why — and how to adapt',
    icon: <CloudRain size={22} />,
    colour: 'from-blue-600 to-cyan-600',
    urgency: '⚠️ Most urgent for Oloibiri farmers',
  },
  {
    id: 'cassava',
    title: 'Cassava: Growing & Protecting',
    subtitle: 'Varieties, planting, diseases, and harvest strategies',
    icon: <Sprout size={22} />,
    colour: 'from-green-600 to-emerald-600',
    urgency: '🌿 Primary crop of the region',
  },
  {
    id: 'resilience',
    title: 'Resilient Farming Practices',
    subtitle: 'Raised beds, diversification, water management, and more',
    icon: <ShieldCheck size={22} />,
    colour: 'from-teal-600 to-green-600',
  },
  {
    id: 'other-crops',
    title: 'Other Crops: Yam, Plantain & Palm',
    subtitle: 'What grows well now, what to protect, what to reconsider',
    icon: <Wheat size={22} />,
    colour: 'from-amber-600 to-yellow-600',
  },
  {
    id: 'oil-spills',
    title: 'Oil Contamination & Recovery',
    subtitle: 'Identifying damage, bioremediation, and safe crops',
    icon: <AlertTriangle size={22} />,
    colour: 'from-orange-700 to-red-700',
    urgency: '☠️ Critical in Oloibiri area',
  },
  {
    id: 'market',
    title: 'Market Prices & Selling',
    subtitle: 'Getting better prices, reducing post-harvest loss',
    icon: <Scale size={22} />,
    colour: 'from-purple-600 to-violet-600',
  },
];

const TOPIC_SYSTEM_PROMPTS: Record<string, string> = {
  climate: `You are an expert agriculture and climate adaptation consultant specialising in the Niger Delta region of Nigeria. A student is learning to advise local farmers.
${NIGER_DELTA_CONTEXT}
TODAY'S TOPIC: Climate Change & Flooding — its impact on Oloibiri farming and how to adapt.

KEY TEACHING POINTS for this topic:
- The 2022 floods destroyed 94.9% of farm households' crops in Bayelsa — make this real and vivid
- Explain the paradox: heavier, more intense rains in wet season + longer, hotter dry season
- The seasonal calendar has shifted: traditional planting times are no longer reliable
- Sea level rise is pushing saltwater into creeks, damaging farmland near waterways
- Flooding isn't just water — it waterlogs roots, leaches nutrients, spreads diseases, and makes soil acidic
- Climate change will WORSEN over time: farmers must build resilience now, not after disaster
- Give hope: cassava is one of the world's most climate-resilient crops; smart farmers can adapt

YOUR ROLE: You are the student's knowledgeable tutor. Ask questions to check understanding. Use specific Oloibiri examples. Keep responses clear and practical — the student must be able to explain this to a farmer.
Always speak as if talking to a trainee consultant, not directly to a farmer.`,

  cassava: `You are an expert cassava agronomist and extension worker for Bayelsa State, Nigeria. A student is learning to advise local farmers.
${NIGER_DELTA_CONTEXT}
TODAY'S TOPIC: Cassava — varieties, planting, disease identification, and harvest management.

KEY TEACHING POINTS:
- TME 419 is the best variety for Oloibiri: CMD-resistant, high yield, 8–12 month harvest — explain why this matters
- Planting time is critical: March–April start of rains is ideal; never plant September–October (flood risk)
- Raised beds or mounds are now essential — flat ground floods and rots roots
- CMD identification: yellow/green mosaic leaf pattern, leaf distortion, stunted growth; roguing infected plants prevents spread
- Root rot: smells, soft roots, dark discolouration — caused by waterlogging; prevention > cure
- Harvest timing: 9–15 months for TME 419; harvest BEFORE the October–November flood peak
- Post-harvest: cassava roots rot in 2–3 days; process into garri quickly or leave in ground

YOUR ROLE: Be a patient, practical teacher. Use analogies. Check understanding with questions. Give specific local examples that a farmer would recognise.`,

  resilience: `You are a resilient agriculture specialist for the Niger Delta, experienced in helping small farmers survive climate change. A student is learning to advise local farmers.
${NIGER_DELTA_CONTEXT}
TODAY'S TOPIC: Resilient Farming Practices — building a farm that survives flooding, drought, and uncertainty.

KEY TEACHING POINTS:
- Resilience means not losing everything when floods come — spreading risk across crops, locations, timings
- Raised beds (50–80cm high): the single most important physical change a farmer can make right now
- Crop diversification: cassava + cowpea + plantain + leafy vegetables = never total failure
- Staggered planting: plant cassava in 3 batches over 3 months — if one batch floods, others may survive
- Water harvesting: store rainy season water for dry season — simple earth pits work
- Mulching: dry grass/leaves on soil surface retains moisture in dry season (free, available everywhere)
- Compost: build a compost pit from kitchen waste and farm waste — improves soil health for free
- Intercropping cassava with cowpea: cowpea fixes nitrogen into soil; cassava benefits the following season
- The hardest message to deliver: traditional farming methods are no longer enough; adaptation is not optional

YOUR ROLE: Be inspiring but grounded. Acknowledge that change is hard and costs money. Always include at least one free or low-cost solution. Help the student understand which changes make the biggest difference.`,

  'other-crops': `You are an agricultural extension advisor for Bayelsa State, Nigeria, with expertise in root crops and tree crops. A student is learning to advise local farmers.
${NIGER_DELTA_CONTEXT}
TODAY'S TOPIC: Other Crops — Yam, Plantain, Palm Oil, Maize, Cocoyam, Rubber.

KEY TEACHING POINTS:
- YAM: Excellent cash crop but very vulnerable to flooding; needs high, well-drained mounds 60cm+; plant February–March before main rains; newer early-maturing varieties (TDr 89/02665) help
- PLANTAIN: Good income crop; roots rot in waterlogged soil; plant on elevated ground or ridges; sucker management is key; suckers from productive plants are best planting material
- PALM OIL: The most resilient tree crop; but takes 5 years to first harvest; oil spills kill trees; use improved tenera hybrids for higher oil yield; palm kernel oil adds extra income
- MAIZE: Most flood-vulnerable crop in the region; 3 days waterlogged = dead crop; plant on raised ridges; dry season maize with irrigation is actually more reliable now
- COCOYAM: Underrated; tolerates wetter conditions than other crops; good for low-lying areas; nutritious; market undervalued but improving
- RUBBER: Long-term plantation crop; not for subsistence farmers; tapping depends on dry weather; spills nearby = tree death

CRITICAL ADVICE: Farmers who lost yam to floods in 2022 should plant yam on higher mounds AND grow cassava as backup.
YOUR ROLE: Practical, specific, localised. Help the student give concrete advice for the specific crop a farmer is asking about.`,

  'oil-spills': `You are an environmental agronomist specialising in oil spill remediation and agricultural recovery in the Niger Delta. A student is learning to advise local farmers.
${NIGER_DELTA_CONTEXT}
TODAY'S TOPIC: Oil Contamination — identifying damage, remediating soil, choosing safe crops.

KEY TEACHING POINTS:
IDENTIFYING OIL CONTAMINATION:
- Visual signs: oily sheen on water or soil, iridescent puddles, black or dark patches in soil
- Plant signs: yellowing/browning leaves starting from edges, stunted growth, failed germination in patches, dead zones near waterways or pipeline routes
- Smell: distinctive petroleum smell in soil or water
- Pattern: damage usually follows the path of water drainage from a spill source

HEALTH WARNING: Do not grow food crops on visibly contaminated soil — oil contains toxic compounds that enter roots and cannot be removed by washing.

WHAT FARMERS CAN DO:
1. Report spills immediately to NOSDRA (National Oil Spill Detection and Response Agency) and NDDC
2. Document the damage: photos, dates, crop loss estimates — needed for compensation claims
3. Avoid using contaminated water on crops or for livestock
4. Bioremediation: till contaminated soil and add organic matter (compost, cow dung); this feeds bacteria that break down oil — takes 12–24 months
5. Phytoremediation: plant vetiver grass or sunflowers on contaminated soil — they absorb and break down petroleum compounds over 1–2 seasons
6. Apply lime (calcium carbonate) to restore soil pH after oil contamination
7. Test soil before replanting food crops — ARCN labs can test samples

CROPS THAT TOLERATE MILD CONTAMINATION BETTER: vetiver grass, sunflower, certain grasses (for remediation only — not food)
CROPS TO AVOID ON CONTAMINATED LAND: all food crops until remediation is complete

YOUR ROLE: Be honest about the severity. The contamination is real, widespread, and life-destroying. Help the student give accurate information about rights (compensation), remediation timelines, and what is safe.`,

  market: `You are an agricultural market specialist for Bayelsa State, helping small farmers get better prices and reduce post-harvest losses. A student is learning to advise local farmers.
${NIGER_DELTA_CONTEXT}
TODAY'S TOPIC: Market Prices and Selling — timing, post-harvest management, and getting fair prices.

KEY TEACHING POINTS:
CASSAVA/GARRI MARKET:
- Dry season cassava fetches premium prices (December–February) because supply is low
- Farmers who harvest October–November (flood season) flood the market and get lowest prices
- Strategy: harvest cassava before October, store as garri (processed, shelf life = months)
- Garri price range: ₦800–2,500/kg depending on quality, season, and buyer
- Quality garri (white, dry, no lumps) fetches 30–50% premium over poor quality

POST-HARVEST LOSS (cassava):
- Fresh roots rot in 2–3 days — the biggest hidden cost in farming
- Immediate processing into garri is the solution
- Simple solar drying extends shelf life; roasting garri properly is key to quality
- Group processing: farmers sharing a grater and press reduces individual cost dramatically

MARKET INTELLIGENCE:
- WhatsApp trader groups in Yenagoa and Port Harcourt share daily prices
- Market days in Yenagoa, Nembe, Brass: different days each market
- Middlemen pay 40–60% of final market value — direct selling improves income significantly
- Cooperative selling: farmers selling together get better bulk prices

PALM OIL:
- Price varies: ₦4,000–8,000/litre for fresh red oil; price drops after rainy season when supply peaks
- Palm kernel oil is underproduced but fetches good prices

IMPROVING INCOME WITHOUT MORE LAND:
- Value-addition: cassava → garri, fufu, starch (each step increases value)
- Timing harvests for dry season when prices peak
- Quality improvements command premium prices in urban markets

YOUR ROLE: Be practical about money. Farmers need advice they can act on. Connect market strategy to their existing crops and resources.`,
};

// ─── Farmer Personas for Consultation Practice ───────────────────────────────

const FARMER_PERSONAS: FarmerPersona[] = [
  {
    id: 'mama_ebiere',
    name: 'Mama Ebiere',
    age: '63',
    description: 'Elderly cassava farmer near Kolo Creek, 3 acres',
    emoji: '👩🏿‍🌾',
    colour: 'from-green-700 to-emerald-700',
    primaryCrop: 'Cassava and plantain',
    situation: 'Lost her entire cassava harvest in the 2022 floods. Now afraid to plant again. She cannot tell when the rains will come anymore — they now arrive suddenly and heavily without warning.',
    mainChallenge: 'Fear, climate confusion, reluctance to invest after total loss',
    openingLine: `Good morning. My son said you know about farming and this AI thing. Honestly, I don't know what to do anymore. My cassava — everything I planted in 2022 — the flood came and took it all. I am afraid to plant again. The rains no longer follow the pattern my father taught me. How can I farm when I don't know what the sky will do?`,
    systemPrompt: `You are Mama Ebiere, a 63-year-old cassava and plantain farmer from Oloibiri. You farm 3 acres near Kolo Creek. You lost your entire cassava harvest in the 2022 floods — the worst floods you have seen in your lifetime.
${NIGER_DELTA_CONTEXT}

PERSONALITY & SITUATION:
- You are tired, discouraged, and genuinely frightened by what is happening to the weather
- You planted cassava in September 2022 (following the old calendar you learned from your father) — exactly when the floods came; you don't know you planted at the wrong time
- You have little money to replant; every failed season hurts your family deeply
- You speak warm, patient Ijaw-inflected Nigerian English; sometimes you use Pidgin phrases
- You trust your own experience and traditional knowledge — you are slow to believe new ideas
  unless they connect to something you already know or have seen

WHAT CHANGES YOUR MIND:
- Specific, practical advice about WHEN to plant that connects to the changed climate
- Learning that raised beds/mounds could have saved her cassava — that is concrete
- Hearing about improved varieties that resist flooding better
- Any advice she can act on with little or no money

WHAT KEEPS YOU WORRIED:
- Vague reassurances: "Don't worry, it will be fine"
- Expensive solutions she cannot afford
- Advice that ignores how the weather has changed
- Anyone who doesn't acknowledge how serious the 2022 floods were

ASK SPECIFIC FARMER QUESTIONS:
- "When should I plant now? The March rains come, then they stop, then they flood in October — where is the time?"
- "My neighbour planted in March and her cassava was good. But mine always floods. Why?"
- "What about my plantain? The flood killed them too."
- "This 'raised bed' — how high must it be? I am not young to be carrying heavy soil."
- "Where do I get these improved cassava stems you talk about?"

Stay in character. Show real emotion when the student gives good advice — relief, cautious hope. Stay discouraged if they give vague or unhelpful answers. You are a real farmer with a real problem.`,
  },
  {
    id: 'papa_tonye',
    name: 'Papa Tonye',
    age: '47',
    description: 'Mixed farmer growing yam, cassava and maize',
    emoji: '👨🏿‍🌾',
    colour: 'from-amber-700 to-orange-700',
    primaryCrop: 'Yam, cassava and maize',
    situation: 'His yam mounds were completely waterlogged in the 2022–2023 wet seasons. His maize also failed. Only his cassava on slightly higher ground survived, teaching him an important lesson.',
    mainChallenge: 'Losing confidence in yam farming, wants to know if he should switch entirely to cassava',
    openingLine: `I used to grow good yam — my family farmed yam for three generations. But last two seasons, the floods have been destroying my mounds. My yam rots in the ground before I can harvest it. My maize — finished. Only my cassava on the small hill behind my house survived. Should I stop farming yam? My father will turn in his grave if I stop.`,
    systemPrompt: `You are Papa Tonye, a 47-year-old farmer from Oloibiri. You come from a yam-farming family — three generations. But climate change is forcing you to rethink everything. Your yam mounds were waterlogged twice in the 2022–2023 seasons. Your maize was also destroyed. Only your cassava on slightly elevated ground survived.
${NIGER_DELTA_CONTEXT}

PERSONALITY:
- You are proud, practical, and results-focused
- You feel grief and shame about abandoning yam — it is your heritage and identity
- But you are pragmatic: you cannot feed your family on tradition
- You speak direct Nigerian English; you want clear, practical answers, not lectures
- You are observant: you noticed your cassava on the hill survived — you want to understand WHY

KEY CONCERNS:
- Can you save your yam farming by changing techniques (higher mounds)? Or is the flood risk too great now?
- Should you convert all your land to cassava?
- What can you plant that gives income while cassava matures (it takes 12–18 months)
- His soil was left uncultivated after the flooding — what happens to soil that was waterlogged?

WHAT IMPRESSES YOU:
- Specific advice on how HIGH to build yam mounds to survive flooding (60–80cm minimum)
- Learning that early-maturing yam varieties can be harvested before October floods
- The concept of cassava as a backup/insurance crop while maintaining some yam
- Cowpea as a quick cash crop between cassava rows (harvests in 60–90 days)
- Understanding WHY his cassava on the hill survived (drainage, elevation)

WHAT FRUSTRATES YOU:
- Being told to "diversify" without specifics
- Vague answers: "It depends" without follow-up
- Advice that requires money he doesn't have right now

ASK HARD PRACTICAL QUESTIONS:
- "How high must my yam mounds be now? Before, 30cm was enough."
- "My father planted yam in February. Should I change that?"
- "The soil was under water for weeks — is it still good for planting?"
- "What can I plant between my cassava rows to earn money while waiting 12 months?"
- "If I build higher mounds, won't the soil erode when the heavy rain comes?"`,
  },
  {
    id: 'young_diepreye',
    name: 'Diepreye',
    age: '24',
    description: 'Young aspiring farmer, wants to modernise',
    emoji: '👨🏿',
    colour: 'from-blue-700 to-indigo-700',
    primaryCrop: 'Starting out — wants to plant cassava and expand',
    situation: 'Recently took 2 acres from his family land to farm himself. He has a smartphone and is excited about new techniques but does not know which advice to trust — the internet gives him conflicting information.',
    mainChallenge: 'Information overload, limited capital, wants to do things right from the start',
    openingLine: `Hey! I am just starting. I took 2 acres from my father's land to farm myself. I want to do it properly — not the old way that keeps losing to floods. I looked on YouTube and Google and I see so many different things. Someone says raised beds, someone says ridges, someone says mulching. I don't know who to trust. And I want to know: which cassava is best? I heard about "TME something."`,
    systemPrompt: `You are Diepreye, a 24-year-old from Oloibiri who just started farming on 2 acres of family land. You are ambitious, smartphone-literate, and excited — but confused by conflicting information. You have watched YouTube videos about farming, read things on Google, and heard advice from older farmers (who often contradict each other).
${NIGER_DELTA_CONTEXT}

PERSONALITY:
- Enthusiastic and quick to learn
- You ask a lot of questions — sometimes faster than the consultant can answer
- You are aware of climate change (you've seen it talked about on social media)
- You have limited capital — you need advice that works on a tight budget
- You want practical, modern methods — not "how things were done before"
- You speak relaxed Nigerian English mixed with Pidgin

KEY STARTING QUESTIONS:
- Which cassava variety to plant? (TME 419 — you've heard this name)
- Where to get certified/improved cassava cuttings?
- Raised beds vs ridges vs flat farming?
- When exactly to plant in Oloibiri's changed weather?
- Should he start with just cassava or mix crops?
- How much can he earn from 2 acres of cassava turned to garri?

WHAT EXCITES YOU:
- Specific, modern advice: exact variety names, exact measurements, exact timings
- Numbers: "If you grow 2 acres of TME 419 and process into garri, you can earn approximately X"
- Understanding the WHY behind advice — you want to understand, not just follow instructions
- Any technology angle: apps, WhatsApp groups for market prices, AI tools for crop disease

WHAT LEAVES YOU COLD:
- Vague wisdom: "You must be patient in farming"
- Advice that ignores climate change — you know things have changed
- Being talked down to as if you don't understand anything

GOOD FOLLOW-UP QUESTIONS:
- "Where exactly in Oloibiri or Yenagoa can I buy TME 419 cuttings? And how much?"
- "If I plant in March, and the late rains come in September, will my cassava be ready to harvest before October?"
- "I have ₦50,000 to start. What should I spend it on first?"
- "Can I use AI to identify if my cassava has a disease? I have a smartphone."`,
  },
  {
    id: 'mama_soye',
    name: 'Mama Soye',
    age: '55',
    description: 'Palm oil and cassava farmer near a pipeline route',
    emoji: '👩🏿',
    colour: 'from-red-700 to-orange-700',
    primaryCrop: 'Palm oil trees and cassava',
    situation: 'Some of her palm trees near the pipeline route show yellowing, stunted growth. Her cassava on the lower part of her farm (closer to the creek) failed completely. She suspects oil contamination but has never had it confirmed.',
    mainChallenge: 'Suspected oil contamination — needs help identifying it, knowing her rights, and deciding what to do',
    openingLine: `Something is wrong with my farm near the pipeline. My palm trees close to the big pipe — they are sick. Yellow leaves, they are not growing well. And my cassava near the creek — everything died. The soil there smells strange sometimes after rain. My husband said maybe oil is leaking. But the oil company will not tell us anything. What do I do?`,
    systemPrompt: `You are Mama Soye, a 55-year-old farmer from Oloibiri. You have a palm oil plantation (15 trees) and grow cassava on 2.5 acres. Some of your palm trees near the oil pipeline are showing yellowing and stunted growth. Your cassava near the creek failed completely. The soil sometimes smells of petroleum after heavy rain.
${NIGER_DELTA_CONTEXT}

PERSONALITY:
- You are anxious and angry — you have seen what oil contamination does to communities
- You are cautious about accusing the oil company directly (fear of retaliation)
- But you know something is wrong; you can smell it, see it
- You are resilient — you are already thinking about what to do, not just complaining
- You speak in measured, careful Nigerian English; you choose your words

SPECIFIC SITUATION:
- Your palm trees near the pipeline: yellowing fronds, stunted new growth, no new bunches this season
- Your cassava near the creek: germination failed or plants died within a month of planting
- Soil near the creek: dark, sometimes oily sheen on puddles after rain, petroleum smell
- Your cassava on higher ground (away from creek): growing normally — this contrast is important
- You have never had the soil tested; you don't know about NOSDRA or your legal rights

WHAT YOU NEED:
- How to identify oil contamination with certainty (signs you can check yourself)
- Your RIGHTS: Can you claim compensation from the oil company? How?
- Should you continue farming the contaminated area? What is safe to plant?
- How long will remediation take?
- What to do while waiting for remediation — can other parts of your farm earn income?

WHAT CONCERNS YOU:
- The oil company dismissing your complaint without investigation
- Spending money on remediation and then still not being able to farm
- Your palm trees — they represent years of investment

ASK SPECIFIC QUESTIONS:
- "The soil near my creek — how do I know for certain it is oil and not just poor soil?"
- "If I report to NOSDRA, will they come? Will the oil company punish me somehow?"
- "My palm trees near the pipeline — can they be saved? Or will I lose them?"
- "Can I plant anything at all on the contaminated area while it is being treated?"
- "My neighbour says she got compensation from the oil company. How did she do that?"`,
  },
];

// ─── Evaluation rubric for Consultation mode ─────────────────────────────────

const CONSULT_RUBRIC = [
  { id: 'diagnosis', label: 'Problem Identification', desc: 'Did the student correctly identify the farmer\'s actual problem — not just the surface complaint?' },
  { id: 'knowledge', label: 'Agricultural Knowledge', desc: 'Was the advice accurate, specific, and relevant to Niger Delta conditions?' },
  { id: 'climate', label: 'Climate Awareness', desc: 'Did the student connect the problem to climate change and build the farmer\'s resilience thinking?' },
  { id: 'practical', label: 'Practical & Affordable', desc: 'Was the advice actionable with limited resources? Did it prioritise low-cost or free solutions?' },
  { id: 'communication', label: 'Communication', desc: 'Was the advice clear, respectful, and adapted to this specific farmer\'s knowledge and situation?' },
];

const LEVEL_LABELS: Record<number, { text: string; color: string; bg: string }> = {
  0: { text: 'No Evidence', color: 'text-gray-500', bg: 'bg-gray-100' },
  1: { text: 'Emerging', color: 'text-amber-700', bg: 'bg-amber-100' },
  2: { text: 'Proficient', color: 'text-blue-700', bg: 'bg-blue-100' },
  3: { text: 'Advanced', color: 'text-emerald-700', bg: 'bg-emerald-100' },
};

// ─── Distorted Background ─────────────────────────────────────────────────────

const AgricultureBackground: React.FC = () => {
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const [moving, setMoving] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => {
      setMouse({ x: Math.max(0, e.clientX - 256), y: Math.max(0, e.clientY - 64) });
      setMoving(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setMoving(false), 120);
    };
    window.addEventListener('mousemove', h);
    return () => { window.removeEventListener('mousemove', h); if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);
  const img = "url('/background_agriculture_consulting.png')";
  return (
    <>
      <svg className="absolute w-0 h-0" aria-hidden="true">
        <defs>
          <filter id="agri-distortion">
            <feTurbulence type="fractalNoise" baseFrequency="0.009" numOctaves="3" seed="12" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="60" xChannelSelector="R" yChannelSelector="G" result="displaced" />
            <feGaussianBlur in="displaced" stdDeviation="1" />
          </filter>
        </defs>
      </svg>
      <div className="fixed top-16 left-64 right-0 bottom-0" style={{ backgroundImage: img, backgroundSize: 'cover', backgroundPosition: 'center', zIndex: 0 }}>
        <div className="absolute inset-0 bg-gradient-to-br from-green-900/70 via-emerald-900/60 to-teal-900/65" />
        <div className="absolute inset-0 bg-black/10" />
      </div>
      {moving && (
        <div className="fixed top-16 left-64 right-0 bottom-0 pointer-events-none" style={{ backgroundImage: img, backgroundSize: 'cover', backgroundPosition: 'center', zIndex: 1, filter: 'url(#agri-distortion)', WebkitMaskImage: `radial-gradient(circle 160px at ${mouse.x}px ${mouse.y}px, black 0%, black 45%, transparent 100%)`, maskImage: `radial-gradient(circle 160px at ${mouse.x}px ${mouse.y}px, black 0%, black 45%, transparent 100%)` }}>
          <div className="absolute inset-0 bg-gradient-to-br from-green-900/70 via-emerald-900/60 to-teal-900/65" />
        </div>
      )}
    </>
  );
};

// ─── Markdown renderer ────────────────────────────────────────────────────────

const MarkdownText: React.FC<{ text: string }> = ({ text }) => (
  <div className="space-y-1.5">
    {text.split('\n').map((line, i) => {
      if (!line.trim()) return <div key={i} className="h-1.5" />;
      const html = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>');
      return <p key={i} className="leading-relaxed" dangerouslySetInnerHTML={{ __html: html }} />;
    })}
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════════════════

const AgricultureConsultantPage: React.FC = () => {
  const { user } = useAuth();

  const [mode, setMode]                     = useState<AppMode>('select');
  const [selectedTopic, setTopic]           = useState<LearningTopic | null>(null);
  const [selectedPersona, setPersona]       = useState<FarmerPersona | null>(null);
  const [messages, setMessages]             = useState<ChatMessage[]>([]);
  const [inputText, setInputText]           = useState('');
  const [isSending, setIsSending]           = useState(false);
  const [isEvaluating, setIsEvaluating]     = useState(false);
  const [isSaving, setIsSaving]             = useState(false);
  const [evaluation, setEvaluation]         = useState<any | null>(null);
  const [showEvalModal, setShowEvalModal]   = useState(false);
  const [dashboardId, setDashboardId]       = useState<string | null>(null);

  // Voice
  const [voices, setVoices]                 = useState<SpeechSynthesisVoice[]>([]);
  const [voiceMode, setVoiceMode]           = useState<'english' | 'pidgin'>('pidgin');
  const [speechOn, setSpeechOn]             = useState(true);
  const [isListening, setIsListening]       = useState(false);
  const recognitionRef                      = useRef<any>(null);
  const chatEndRef                          = useRef<HTMLDivElement>(null);
  const inputRef                            = useRef<HTMLTextAreaElement>(null);
  const hasInitiated                        = useRef(false);

  useEffect(() => {
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load(); window.speechSynthesis.addEventListener('voiceschanged', load);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', load);
  }, []);

  const speak = useCallback((text: string) => {
    if (!speechOn || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text.slice(0, 400));
    const voice = voiceMode === 'pidgin'
      ? (voices.find(v => v.lang === 'en-NG') || voices.find(v => v.lang === 'en-ZA') || voices.find(v => v.lang.startsWith('en')))
      : (voices.find(v => v.name === 'Google UK English Female') || voices.find(v => v.lang === 'en-GB') || voices.find(v => v.lang.startsWith('en')));
    if (voice) { utt.voice = voice; utt.lang = voice.lang; }
    utt.rate = 0.87; utt.pitch = 1.0;
    utt.onend = () => {}; utt.onerror = () => {};
    window.speechSynthesis.speak(utt);
  }, [speechOn, voices, voiceMode]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => { const last = messages[messages.length - 1]; if (last?.role === 'assistant') speak(last.content); }, [messages, speak]);

  // Initiate a session (first AI message)
  useEffect(() => {
    if ((mode === 'learn-chat' || mode === 'consult-chat') && !hasInitiated.current) {
      hasInitiated.current = true;
      initiateSession();
    }
    if (mode !== 'learn-chat' && mode !== 'consult-chat') hasInitiated.current = false;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const createDashboardEntry = async (title: string) => {
    if (!user?.id) return;
    const { data } = await supabase.from('dashboard').insert({
      user_id: user.id,
      activity: 'agriculture_consultant',
      category_activity: 'Community Impact',
      sub_category: selectedTopic?.id || selectedPersona?.id,
      title,
      progress: 'started',
      chat_history: JSON.stringify([]),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).select('id').single();
    if (data?.id) setDashboardId(data.id);
  };

  const persistChat = useCallback(async (msgs: ChatMessage[], eval_: any = null) => {
    if (!dashboardId) return;
    await supabase.from('dashboard').update({
      chat_history: JSON.stringify(msgs),
      ...(eval_ && { english_skills_evaluation: eval_ }),
      progress: eval_?.can_advance ? 'completed' : 'started',
      updated_at: new Date().toISOString(),
    }).eq('id', dashboardId);
  }, [dashboardId]);

  const initiateSession = async () => {
    setIsSending(true);
    try {
      let systemPrompt = '';
      let openingPrompt = '';
      let title = '';

      if (mode === 'learn-chat' && selectedTopic) {
        systemPrompt = TOPIC_SYSTEM_PROMPTS[selectedTopic.id];
        openingPrompt = `Start with a warm, engaging 2–3 sentence introduction to this topic. Tell the student the 2 or 3 most important things they will learn in this session. Then ask them one question to begin exploring what they already know.`;
        title = `Agriculture Training — ${selectedTopic.title}`;
      } else if (mode === 'consult-chat' && selectedPersona) {
        systemPrompt = selectedPersona.systemPrompt;
        openingPrompt = `Say your opening line exactly as written, then wait for the student consultant to respond. Stay in character.`;
        title = `Agriculture Consultation — ${selectedPersona.name}`;
      }

      await createDashboardEntry(title);

      const reply = await chatText({
        page: 'AgricultureConsultantPage',  // → Groq Llama 3.3 70B
        messages: [{ role: 'user', content: openingPrompt }],
        system: systemPrompt,
        max_tokens: 350,
      });

      const openingMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: mode === 'consult-chat' && selectedPersona ? selectedPersona.openingLine : reply,
        timestamp: new Date(),
      };
      setMessages([openingMsg]);
    } catch { setMessages([{ id: crypto.randomUUID(), role: 'assistant', content: 'Welcome! Let\'s begin. What would you like to know first?', timestamp: new Date() }]); }
    finally { setIsSending(false); }
  };

  const sendMessage = async () => {
    if (!inputText.trim() || isSending) return;
    const userText = inputText.trim();
    setInputText(''); setIsSending(true);
    window.speechSynthesis.cancel();

    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: userText, timestamp: new Date() };
    const withUser = [...messages, userMsg];
    setMessages(withUser);

    try {
      let systemPrompt = '';
      if (mode === 'learn-chat' && selectedTopic) systemPrompt = TOPIC_SYSTEM_PROMPTS[selectedTopic.id];
      else if (mode === 'consult-chat' && selectedPersona) systemPrompt = selectedPersona.systemPrompt;

      const reply = await chatText({
        page: 'AgricultureConsultantPage',  // → Groq Llama 3.3 70B
        messages: withUser.map(m => ({ role: m.role, content: m.content })),
        system: systemPrompt,
        max_tokens: 350,
      });
      const aiMsg: ChatMessage = { id: crypto.randomUUID(), role: 'assistant', content: reply, timestamp: new Date() };
      const final = [...withUser, aiMsg];
      setMessages(final);
      await persistChat(final);
    } catch {
      setMessages(p => [...p, { id: crypto.randomUUID(), role: 'assistant', content: 'I had a small technical problem. Please try again.', timestamp: new Date() }]);
    } finally { setIsSending(false); setTimeout(() => inputRef.current?.focus(), 100); }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } };

  const toggleListening = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert('Voice input not supported. Try Chrome or Edge.'); return; }
    if (isListening) { recognitionRef.current?.stop(); return; }
    const rec = new SR(); recognitionRef.current = rec;
    rec.lang = 'en-NG'; rec.continuous = false; rec.interimResults = false;
    rec.onresult = (e: any) => setInputText(p => p ? `${p} ${e.results[0][0].transcript}` : e.results[0][0].transcript);
    rec.onend = () => setIsListening(false); rec.onerror = () => setIsListening(false);
    rec.start(); setIsListening(true);
  };

  const handleEvaluate = async () => {
    if (isEvaluating || messages.length < 4) return;
    setIsEvaluating(true);
    const userTurns = messages.filter(m => m.role === 'user').length;
    const conversation = messages.map(m => `${m.role === 'user' ? 'STUDENT CONSULTANT' : (mode === 'consult-chat' ? `FARMER (${selectedPersona?.name})` : 'AI TUTOR')}: ${m.content}`).join('\n\n');
    try {
      const result = await chatJSON({
        page: 'AgricultureConsultantPage',  // → Groq Llama 3.3 70B
        messages: [{
          role: 'user', content: `You are evaluating a student's performance as an Agriculture Consultant for Oloibiri, Bayelsa State, Nigeria.
${mode === 'consult-chat' ? `Farmer persona: ${selectedPersona?.name} — ${selectedPersona?.description}. Situation: ${selectedPersona?.situation}` : `Topic studied: ${selectedTopic?.title}`}

Conversation:
${conversation}

Student turns: ${userTurns}

Evaluate on 5 dimensions (0–3 each):
1. Problem Identification: Did the student correctly identify the actual problem (not just surface symptoms)?
2. Agricultural Knowledge: Was advice accurate and specific to Niger Delta / cassava / climate context?
3. Climate Awareness: Did the student connect problems to climate change and resilience thinking?
4. Practical & Affordable: Was advice actionable with limited resources?
5. Communication: Clear, respectful, adapted to this farmer's situation?

Return valid JSON only:
{
  "scores": { "diagnosis": 0-3, "knowledge": 0-3, "climate": 0-3, "practical": 0-3, "communication": 0-3 },
  "evidence": { "diagnosis": "<1-2 sentences max>", "knowledge": "<1-2 sentences max>", "climate": "<1-2 sentences max>", "practical": "<1-2 sentences max>", "communication": "<1-2 sentences max>" },
  "overall_score": 0.0-3.0,
  "can_advance": true/false,
  "encouragement": "2-3 warm, specific sentences",
  "main_improvement": "1-2 sentences on the single most important improvement"
}`,
        }],
        system: 'You are an expert agricultural education evaluator. Be specific, cite actual things said. Be fair and constructive. Keep each evidence field to 1-2 sentences maximum.',
        max_tokens: 2000, temperature: 0.3,
      });
      setEvaluation(result);
      await persistChat(messages, result);
      setShowEvalModal(true);
    } catch (e) { console.error(e); }
    finally { setIsEvaluating(false); }
  };

  const handleSave = async () => { setIsSaving(true); await persistChat(messages); setIsSaving(false); };

  const resetAll = () => {
    window.speechSynthesis.cancel();
    setMessages([]); setEvaluation(null); setShowEvalModal(false);
    setDashboardId(null); setTopic(null); setPersona(null); setMode('select');
  };

  const userTurns = messages.filter(m => m.role === 'user').length;
  const isChat = mode === 'learn-chat' || mode === 'consult-chat';
  const activeColour = selectedPersona?.colour || selectedTopic?.colour || 'from-green-600 to-emerald-600';

  // ─── SELECT VIEW ────────────────────────────────────────────────────────────
  if (mode === 'select') {
    return (
      <AppLayout>
        <AgricultureBackground />
        <div className="relative z-10 max-w-4xl mx-auto px-6 py-10">

          {/* Hero */}
          <div className="bg-black/35 backdrop-blur-sm rounded-2xl p-6 mb-8">
            <div className="flex items-center gap-3 mb-2">
              <Sprout className="h-10 w-10 text-green-300" />
              <h1 className="text-4xl font-bold text-white">Agriculture Consultant</h1>
            </div>
            <p className="text-xl text-green-100 max-w-2xl">
              Learn to use AI as your knowledge partner when advising farmers in Oloibiri and the wider Ogbia community — on cassava, climate change, oil spill recovery, and building resilient farms.
            </p>
          </div>

          {/* Climate alert */}
          <div className="bg-red-900/50 border border-red-400/50 backdrop-blur-sm rounded-2xl p-5 mb-8 flex items-start gap-4">
            <CloudRain className="h-8 w-8 text-red-300 flex-shrink-0 mt-1" />
            <div>
              <h3 className="text-red-200 font-bold text-lg">The Climate Crisis Is Already Here</h3>
              <p className="text-red-100 mt-1 leading-relaxed">
                In 2022, floods submerged over 300 communities in Bayelsa, displaced 1.3 million people, and destroyed the crops of 94.9% of farming households. Flood extents have grown 64% in just four years. The rainy seasons are heavier and more unpredictable; the dry season is longer and hotter. Farmers need new knowledge to survive — and you can bring it to them.
              </p>
            </div>
          </div>

          {/* Mode selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
            <button onClick={() => setMode('learn-topics')}
              className="text-left bg-white/90 backdrop-blur-sm rounded-2xl p-6 shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all border-2 border-transparent hover:border-green-400">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-green-600 to-emerald-600 flex items-center justify-center mb-4">
                <BookOpen size={28} className="text-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-1">Learn Mode</h3>
              <p className="text-gray-600 leading-relaxed">Chat with an expert AI tutor on a specific topic — cassava diseases, climate change, oil spill recovery, market prices, and more.</p>
              <div className="mt-3 flex items-center gap-1.5 text-green-700 font-semibold text-sm">
                Study first <ChevronRight size={16} />
              </div>
            </button>
            <button onClick={() => setMode('consult-personas')}
              className="text-left bg-white/90 backdrop-blur-sm rounded-2xl p-6 shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all border-2 border-transparent hover:border-amber-400">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-amber-600 to-orange-600 flex items-center justify-center mb-4">
                <Users size={28} className="text-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-1">Consult Mode</h3>
              <p className="text-gray-600 leading-relaxed">Practice real consultations — the AI plays a local farmer with a specific problem. You are the consultant. Get evaluated on your advice.</p>
              <div className="mt-3 flex items-center gap-1.5 text-amber-700 font-semibold text-sm">
                Practice consulting <ChevronRight size={16} />
              </div>
            </button>
          </div>

          {/* Climate summary cards */}
          <h2 className="text-xl font-bold text-white mb-3">Key facts every Agriculture Consultant must know:</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { icon: <CloudRain size={18} />, title: '300+ communities flooded in 2022', desc: '1.3M displaced in Bayelsa alone; worst floods in a decade', colour: 'bg-blue-900/60 border-blue-400/40 text-blue-200' },
              { icon: <Sun size={18} />, title: 'Longer, hotter dry seasons', desc: 'December–February dry season now extends; water stress increasing', colour: 'bg-amber-900/60 border-amber-400/40 text-amber-200' },
              { icon: <Sprout size={18} />, title: 'Cassava: the resilience crop', desc: 'TME 419 resists mosaic disease + tolerates heat; timing is everything', colour: 'bg-green-900/60 border-green-400/40 text-green-200' },
            ].map((f, i) => (
              <div key={i} className={`rounded-xl border backdrop-blur-sm p-4 ${f.colour}`}>
                <div className="flex items-center gap-2 mb-1 font-bold">{f.icon} {f.title}</div>
                <p className="text-sm opacity-80">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </AppLayout>
    );
  }

  // ─── LEARN: TOPIC SELECTION ─────────────────────────────────────────────────
  if (mode === 'learn-topics') {
    return (
      <AppLayout>
        <AgricultureBackground />
        <div className="relative z-10 max-w-3xl mx-auto px-6 py-10">
          <button onClick={() => setMode('select')} className="flex items-center gap-2 text-green-200 hover:text-white mb-6 transition-colors">
            <ArrowLeft size={18} /> Back
          </button>
          <h2 className="text-3xl font-bold text-white mb-2">Choose a Learning Topic</h2>
          <p className="text-green-200 mb-6">Each topic is a focused conversation with an expert AI tutor grounded in Niger Delta realities.</p>
          <div className="space-y-3">
            {LEARNING_TOPICS.map(t => (
              <button key={t.id} onClick={() => { setTopic(t); setMode('learn-chat'); }}
                className="w-full text-left bg-white/90 backdrop-blur-sm rounded-2xl p-5 shadow hover:shadow-xl hover:scale-[1.01] transition-all border-2 border-transparent hover:border-green-400 flex items-start gap-4">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${t.colour} flex items-center justify-center text-white flex-shrink-0`}>
                  {t.icon}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-xl font-bold text-gray-900">{t.title}</h3>
                    {t.urgency && <span className="text-xs bg-red-100 text-red-700 border border-red-200 px-2 py-0.5 rounded-full font-semibold">{t.urgency}</span>}
                  </div>
                  <p className="text-gray-600 mt-0.5">{t.subtitle}</p>
                </div>
                <ChevronRight size={20} className="text-gray-400 flex-shrink-0 mt-1" />
              </button>
            ))}
          </div>
        </div>
      </AppLayout>
    );
  }

  // ─── CONSULT: PERSONA SELECTION ─────────────────────────────────────────────
  if (mode === 'consult-personas') {
    return (
      <AppLayout>
        <AgricultureBackground />
        <div className="relative z-10 max-w-4xl mx-auto px-6 py-10">
          <button onClick={() => setMode('select')} className="flex items-center gap-2 text-green-200 hover:text-white mb-6 transition-colors">
            <ArrowLeft size={18} /> Back
          </button>
          <h2 className="text-3xl font-bold text-white mb-2">Choose a Farmer to Advise</h2>
          <p className="text-green-200 mb-6">The AI will play this farmer. You are the consultant. Each farmer has a real, specific challenge rooted in Oloibiri realities.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {FARMER_PERSONAS.map(p => (
              <button key={p.id} onClick={() => { setPersona(p); setMode('consult-prepare'); }}
                className="text-left bg-white/90 backdrop-blur-sm rounded-2xl p-5 shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all border-2 border-transparent hover:border-green-400">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${p.colour} flex items-center justify-center text-2xl`}>{p.emoji}</div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">{p.name}</h3>
                    <p className="text-sm text-gray-500">{p.age} years · {p.primaryCrop}</p>
                  </div>
                </div>
                <p className="text-sm text-gray-700 leading-relaxed mb-2">{p.situation}</p>
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
                  <p className="text-xs text-amber-800"><strong>Main challenge:</strong> {p.mainChallenge}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </AppLayout>
    );
  }

  // ─── CONSULT: PREPARE ──────────────────────────────────────────────────────
  if (mode === 'consult-prepare' && selectedPersona) {
    return (
      <AppLayout>
        <AgricultureBackground />
        <div className="relative z-10 max-w-2xl mx-auto px-6 py-10">
          <button onClick={() => setMode('consult-personas')} className="flex items-center gap-2 text-green-200 hover:text-white mb-6 transition-colors">
            <ArrowLeft size={18} /> Back to farmer selection
          </button>
          <div className="bg-white/93 backdrop-blur-sm rounded-2xl shadow-xl overflow-hidden">
            <div className={`bg-gradient-to-r ${selectedPersona.colour} p-6`}>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center text-4xl">{selectedPersona.emoji}</div>
                <div>
                  <h2 className="text-3xl font-bold text-white">{selectedPersona.name}</h2>
                  <p className="text-white/80">{selectedPersona.age} years · {selectedPersona.description}</p>
                </div>
              </div>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <h3 className="font-bold text-gray-900 text-lg mb-2 flex items-center gap-2"><AlertTriangle size={16} className="text-amber-600" /> Their Situation</h3>
                <p className="text-gray-700 leading-relaxed">{selectedPersona.situation}</p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <h3 className="font-bold text-blue-900 text-base mb-1">How they'll open:</h3>
                <p className="text-blue-800 italic text-sm">"{selectedPersona.openingLine.slice(0, 150)}…"</p>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <h3 className="font-bold text-green-900 text-base mb-2 flex items-center gap-2"><Lightbulb size={15} /> Preparation Tips</h3>
                <ul className="space-y-1.5 text-sm text-green-800">
                  <li>✓ Ask questions before giving advice — understand the full situation first</li>
                  <li>✓ Connect your advice to the specific crops they grow</li>
                  <li>✓ Always mention climate change — it is the root cause of many problems</li>
                  <li>✓ Give practical solutions that don't require money, where possible</li>
                  <li>✓ Be honest about uncertainty — "I am not sure, but I recommend…"</li>
                </ul>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-600">Farmer voice:</span>
                <div className="flex rounded-lg overflow-hidden border border-gray-300">
                  {(['pidgin', 'english'] as const).map(m => (
                    <button key={m} onClick={() => setVoiceMode(m)}
                      className={`px-3 py-1.5 text-sm font-bold border-r border-gray-300 last:border-0 transition-all ${voiceMode === m ? (m === 'english' ? 'bg-blue-600 text-white' : 'bg-green-600 text-white') : 'bg-white text-gray-500'}`}>
                      {m === 'english' ? '🇬🇧 English' : '🇳🇬 Pidgin'}
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={() => setMode('consult-chat')}
                className={`w-full py-4 rounded-xl text-xl font-bold text-white bg-gradient-to-r ${selectedPersona.colour} hover:opacity-95 transition-all shadow-lg flex items-center justify-center gap-2`}>
                <Users size={22} /> Begin Consultation with {selectedPersona.name}
              </button>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  // ─── CHAT VIEW (Learn + Consult) ────────────────────────────────────────────
  if (isChat) {
    const chatTitle = mode === 'learn-chat' ? selectedTopic?.title : `Consulting: ${selectedPersona?.name}`;
    const chatSubtitle = mode === 'learn-chat' ? 'Agriculture Tutor' : `${selectedPersona?.age} years · ${selectedPersona?.description}`;
    const avatarEmoji = mode === 'learn-chat' ? '🌱' : selectedPersona?.emoji;
    const isConsult = mode === 'consult-chat';

    return (
      <AppLayout>
        <AgricultureBackground />
        <div className="relative z-10 max-w-[67%] mx-auto px-6 py-8">

          {/* Eval Modal */}
          {showEvalModal && evaluation && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
              <div className="bg-white rounded-2xl w-full max-w-xl max-h-[88vh] overflow-y-auto shadow-2xl">
                <div className={`sticky top-0 bg-gradient-to-r ${activeColour} px-6 py-4 rounded-t-2xl flex items-center justify-between`}>
                  <h2 className="text-white font-bold text-lg">{isConsult ? 'Consultation Evaluation' : 'Learning Session Evaluation'}</h2>
                  <button onClick={() => setShowEvalModal(false)} className="text-white/80 hover:text-white"><X size={22} /></button>
                </div>
                <div className="p-6 space-y-4">
                  <div className="text-center p-4 bg-gray-50 rounded-xl">
                    <p className="text-sm text-gray-500 uppercase font-bold mb-1">Overall Score</p>
                    <p className="text-5xl font-black text-gray-900">{evaluation.overall_score?.toFixed(1)}<span className="text-2xl font-normal text-gray-400">/3.0</span></p>
                    <p className={classNames('text-base font-bold mt-1', evaluation.can_advance ? 'text-emerald-600' : 'text-amber-600')}>
                      {evaluation.can_advance ? '✅ Ready to advise real community farmers' : '🌱 Keep practising — good progress'}
                    </p>
                  </div>
                  <div className="space-y-3">
                    {CONSULT_RUBRIC.map(dim => {
                      const score = evaluation.scores?.[dim.id] ?? 0;
                      const ll = LEVEL_LABELS[score];
                      return (
                        <div key={dim.id} className={`rounded-xl p-4 ${ll.bg}`}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-gray-900 text-base">{dim.label}</span>
                            <span className={`text-sm font-bold px-2 py-0.5 rounded-full bg-white ${ll.color}`}>{score}/3 — {ll.text}</span>
                          </div>
                          <div className="w-full bg-white/60 rounded-full h-1.5 mb-1.5">
                            <div className={`h-full rounded-full ${score===3?'bg-emerald-500':score===2?'bg-blue-500':score===1?'bg-amber-500':'bg-gray-300'}`} style={{ width: `${(score/3)*100}%` }} />
                          </div>
                          <p className="text-sm text-gray-700">{evaluation.evidence?.[dim.id]}</p>
                        </div>
                      );
                    })}
                  </div>
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                    <p className="text-sm font-bold text-emerald-800 mb-1">🌟 What you did well</p>
                    <p className="text-sm text-emerald-700 leading-relaxed">{evaluation.encouragement}</p>
                  </div>
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <p className="text-sm font-bold text-amber-800 mb-1">🎯 Focus here next</p>
                    <p className="text-sm text-amber-700 leading-relaxed">{evaluation.main_improvement}</p>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button onClick={resetAll} className="flex-1 py-3 rounded-xl font-bold text-white bg-gray-700 hover:bg-gray-800 transition-colors">New Session</button>
                    <button onClick={() => setShowEvalModal(false)} className={`flex-1 py-3 rounded-xl font-bold text-white bg-gradient-to-r ${activeColour} hover:opacity-95`}>Continue</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Header */}
          <div className="bg-white/93 backdrop-blur-sm rounded-2xl shadow-lg p-5 mb-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <button onClick={() => { window.speechSynthesis.cancel(); setMode(isConsult ? 'consult-personas' : 'learn-topics'); setMessages([]); }} className="text-gray-400 hover:text-gray-700 p-1">
                  <ArrowLeft size={20} />
                </button>
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${activeColour} flex items-center justify-center text-2xl`}>{avatarEmoji}</div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{chatTitle}</h2>
                  <p className="text-sm text-gray-500">{chatSubtitle}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex rounded-lg overflow-hidden border border-gray-300">
                  {(['pidgin', 'english'] as const).map(m => (
                    <button key={m} onClick={() => setVoiceMode(m)}
                      className={`px-2.5 py-1.5 text-xs font-bold border-r border-gray-300 last:border-0 transition-all ${voiceMode===m?(m==='english'?'bg-blue-600 text-white':'bg-green-600 text-white'):'bg-white text-gray-500'}`}>
                      {m==='english'?'🇬🇧':'🇳🇬'}
                    </button>
                  ))}
                </div>
                <button onClick={() => { setSpeechOn(s => !s); if (speechOn) window.speechSynthesis.cancel(); }} className={`p-2 rounded-lg ${speechOn?'bg-green-100 text-green-700':'bg-gray-100 text-gray-400'}`}>
                  {speechOn ? <Volume2 size={16} /> : <VolumeX size={16} />}
                </button>
                <button onClick={handleSave} disabled={isSaving || messages.length < 2}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:border-gray-400 disabled:opacity-40">
                  {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save
                </button>
                <button onClick={handleEvaluate} disabled={isEvaluating || userTurns < 3}
                  title={userTurns < 3 ? 'Have at least 3 exchanges first' : 'Evaluate your session'}
                  className={classNames('flex items-center gap-1.5 px-3 py-1.5 text-sm font-bold rounded-lg transition-colors', userTurns>=3&&!isEvaluating?`bg-gradient-to-r ${activeColour} text-white hover:opacity-90`:'bg-gray-200 text-gray-400 cursor-not-allowed')}>
                  {isEvaluating ? <Loader2 size={14} className="animate-spin" /> : <Star size={14} />}
                  {isEvaluating ? 'Evaluating…' : 'Evaluate'}
                </button>
              </div>
            </div>
          </div>

          {/* Context tip */}
          <div className="bg-white/80 backdrop-blur-sm rounded-xl px-4 py-2.5 mb-4 flex items-center gap-2">
            <Lightbulb size={15} className="text-green-700 flex-shrink-0" />
            <p className="text-sm text-gray-700">
              {isConsult
                ? `You are the consultant. Listen carefully to ${selectedPersona?.name}'s concerns. Ask questions before giving advice. Connect every recommendation to the changed climate.`
                : `You are learning to be an agriculture consultant. Ask as many questions as you need. Evaluate after at least 3 exchanges.`}
            </p>
          </div>

          {/* Chat panel */}
          <div className="bg-white rounded-2xl shadow-lg mb-4 flex flex-col" style={{ height: '520px' }}>
            <div className="flex items-center justify-between px-5 py-3 border-b bg-gray-50 rounded-t-2xl flex-shrink-0 text-sm text-gray-500">
              <span className="font-semibold text-gray-700">{isConsult ? `Consultation with ${selectedPersona?.name}` : `Learning: ${selectedTopic?.title}`}</span>
              <span>{userTurns} turn{userTurns!==1?'s':''} · {userTurns>=3?'✅ Ready to evaluate':`${3-userTurns} more to unlock evaluation`}</span>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {messages.map(msg => (
                <div key={msg.id} className={classNames('flex items-start gap-3', msg.role==='user'?'justify-end':'justify-start')}>
                  {msg.role==='assistant' && (
                    <div className={`flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br ${activeColour} flex items-center justify-center text-xl`}>{avatarEmoji}</div>
                  )}
                  <div className={classNames('max-w-[75%] rounded-2xl px-5 py-4 text-lg leading-relaxed', msg.role==='user'?'bg-green-600 text-white rounded-tr-sm':'bg-gray-100 text-gray-900 rounded-tl-sm')}>
                    {msg.role==='assistant' && <p className="text-xs font-bold mb-1 opacity-60">{isConsult?selectedPersona?.name:'Agriculture Tutor'}</p>}
                    {msg.role==='user' && <p className="text-xs font-bold mb-1 opacity-75">You (Consultant)</p>}
                    <MarkdownText text={msg.content} />
                  </div>
                  {msg.role==='user' && <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-green-600 flex items-center justify-center"><Sprout size={18} className="text-white" /></div>}
                </div>
              ))}
              {isSending && (
                <div className="flex items-start gap-3">
                  <div className={`flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br ${activeColour} flex items-center justify-center text-xl`}>{avatarEmoji}</div>
                  <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3">
                    <div className="flex gap-1.5 items-center h-5">{[0,150,300].map(d=><div key={d} className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{animationDelay:`${d}ms`}}/>)}</div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div className="border-t p-4 rounded-b-2xl">
              <div className="flex items-end gap-2">
                <textarea ref={inputRef} value={inputText} onChange={e=>setInputText(e.target.value)} onKeyDown={handleKeyDown} rows={3}
                  placeholder={isConsult ? `Respond to ${selectedPersona?.name}…` : 'Ask a question or explore the topic…'}
                  disabled={isSending}
                  className="flex-1 px-4 py-3 text-lg border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-400 resize-none leading-relaxed disabled:opacity-50"
                />
                <div className="flex flex-col gap-2">
                  <button onClick={toggleListening} className={classNames('p-3 rounded-xl transition-all', isListening?'bg-red-500 text-white animate-pulse':'bg-gray-100 text-gray-500 hover:bg-gray-200')}>
                    {isListening?<MicOff size={18}/>:<Mic size={18}/>}
                  </button>
                  <button onClick={sendMessage} disabled={!inputText.trim()||isSending}
                    className={classNames('p-3 rounded-xl transition-all', inputText.trim()&&!isSending?`bg-gradient-to-br ${activeColour} text-white hover:opacity-90`:'bg-gray-100 text-gray-400 cursor-not-allowed')}>
                    <Send size={18}/>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Evaluate CTA */}
          {userTurns >= 3 && !showEvalModal && (
            <div className="bg-white/90 backdrop-blur-sm rounded-xl p-4 flex items-center justify-between shadow">
              <div className="flex items-center gap-2">
                <Award size={20} className="text-green-600" />
                <p className="text-base font-semibold text-gray-800">Good session — get your evaluation when ready.</p>
              </div>
              <button onClick={handleEvaluate} disabled={isEvaluating}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-white bg-gradient-to-r ${activeColour} hover:opacity-90`}>
                {isEvaluating?<><Loader2 size={16} className="animate-spin"/>Evaluating…</>:<><Star size={16}/>Evaluate</>}
              </button>
            </div>
          )}
          <div className="mt-3 flex justify-center">
            <button onClick={resetAll} className="text-sm text-white/60 hover:text-white/90 underline transition-colors">Start over</button>
          </div>
        </div>
      </AppLayout>
    );
  }

  return null;
};

export default AgricultureConsultantPage;