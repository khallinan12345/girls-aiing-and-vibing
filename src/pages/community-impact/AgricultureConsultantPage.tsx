// src/pages/community-impact/AgricultureConsultantPage.tsx
//
// Agriculture Advisor — Community Impact Track
//
// TWO TRACKS — clean split-screen landing:
//
//  LEARN  — Youth studies a topic with an AI tutor. Sessions saved
//            to dashboard (activity: agriculture_consultant) and
//            scored with a 5-dimension evaluation after ≥3 exchanges.
//
//  APPLY  — Youth uses the tool live with a real farmer present.
//            Farmer registry, 5 consultation types, AI-guided triage,
//            case record saved per farmer with follow-up tracking.
//
// DB tables: agriculture_farmers (Apply track)
//            agriculture_consultations (Apply track)
//            dashboard (Learn track — existing table)
//
// Route: /community-impact/agriculture
// Activity: agriculture_consultant (Learn) / agriculture_advisor (Apply)

import React, { useState, useEffect, useRef, useCallback } from 'react';
import AppLayout from '../../components/layout/AppLayout';
import { supabase } from '../../lib/supabaseClient';
import { chatText, chatJSON } from '../../lib/chatClient';
import { useAuth } from '../../hooks/useAuth';
import {
  Sprout, ArrowLeft, Send, Save, Loader2, Plus, User,
  FileText, AlertTriangle, CheckCircle, Clock, ChevronRight,
  ClipboardList, RefreshCw, Calendar, Mic, MicOff,
  Volume2, VolumeX, X, Lightbulb, BookOpen, Briefcase,
  Star, Award,
} from 'lucide-react';
import classNames from 'classnames';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

type AppMode =
  | 'landing'
  | 'learn-topics'
  | 'learn-chat'
  | 'dashboard'
  | 'add-farmer'
  | 'farmer-detail'
  | 'new-consultation'
  | 'case-detail';

type LearnTopicId = 'climate' | 'cassava' | 'resilience' | 'other-crops' | 'oil-spills' | 'market';

type ConsultationType =
  | 'crop-problem'
  | 'yield-improvement'
  | 'market-strategy'
  | 'oil-contamination'
  | 'climate-adaptation';

type UrgencyLevel = 'low' | 'medium' | 'high' | 'urgent';

interface CropEntry { crop: string; acres: number; }

interface Farmer {
  id: string;
  youth_user_id: string;
  farmer_name: string;
  village: string;
  phone: string | null;
  crops: CropEntry[];
  notes: string | null;
  created_at: string;
  total_consultations?: number;
  open_cases?: number;
  last_consultation_at?: string | null;
}

interface Consultation {
  id: string;
  farmer_id: string;
  consultation_type: ConsultationType;
  problem_summary: string;
  ai_advice: string | null;
  urgency_level: UrgencyLevel | null;
  youth_actions_taken: string | null;
  conversation_history: ChatMessage[];
  follow_up_needed: boolean;
  follow_up_date: string | null;
  follow_up_notes: string | null;
  resolved: boolean;
  resolved_at: string | null;
  created_at: string;
}

interface LearnEvaluation {
  scores: Record<string, number>;
  evidence: Record<string, string>;
  overall_score: number;
  can_advance: boolean;
  encouragement: string;
  main_improvement: string;
}

// ─── Niger Delta Knowledge Base ───────────────────────────────────────────────

const NIGER_DELTA_CONTEXT = `
NIGER DELTA / OLOIBIRI AGRICULTURE CONTEXT — always apply this knowledge:

LOCATION & ECOLOGY:
- Oloibiri is in Ogbia LGA, Bayelsa State — one of the lowest-lying areas in Nigeria
- Sits near Kolo Creek, surrounded by mangrove swamps and freshwater systems
- Two rainy seasons: Early rains (March–May) and Late rains (September–November)
- Dry season: December–February (getting hotter and longer due to climate change)
- Niger and Nun Rivers overflow annually; Kolo Creek is a key local waterway
- Ibiade, Ogun State: different ecology — less flooding, more stable rainfall, drier soils

CLIMATE CHANGE CRISIS — URGENT AND REAL:
- The 2022 floods were the worst in Bayelsa in a decade: 300+ communities submerged,
  1.3 million displaced, 96 deaths, 94.9% of farming households lost crops
- Flood extent grew 64% between 2018 and 2022; Bayelsa water levels reached 6.5m in Oct 2022
- Causes: heavier wet-season rains, longer hotter dry seasons, sea level rise pushing
  saltwater inland through creeks, irregular season onset
- Future outlook: flooding will worsen; saltwater intrusion will advance further inland
- Lagdo Dam in Cameroon is released seasonally and compounds downstream flooding

OIL CONTAMINATION (critical for Oloibiri):
- Oloibiri was where Nigeria's first oil was discovered in 1956
- Decades of spills from pipelines and illegal bunkering have contaminated soils and creeks
- Oil-contaminated soil: acidic, kills roots, prevents germination, destroys soil microbes
- Signs: oily sheen on water/soil, iridescent puddles, black patches, petroleum smell,
  stunted yellowing plants near waterways or pipeline routes, dead vegetation strips
- NOSDRA (National Oil Spill Detection and Response Agency) handles spill reports
- Farmers have legal rights to compensation — document damage (photos, dates, losses)

PRIMARY CROPS & REALITIES:
CASSAVA (most important crop by far):
- Best variety: TME 419 — CMD-resistant, high yield, 8-12 month harvest, erect habit
- TMS 30572: branching type, also CMD-resistant
- 70% of Nigeria's cassava is processed into garri
- Climate-resilient BUT: prolonged waterlogging rots roots; root formation (3-6 months) most vulnerable
- Harvest window: 9-15 months for TME 419; harvest BEFORE October-November flood peak
- Post-harvest: fresh roots rot in 2-3 days — process into garri immediately

CASSAVA DISEASES:
1. CMD (Cassava Mosaic Disease): viral, whitefly-spread; yellow/mosaic leaf patterns. Use TME 419. Rogue infected plants.
2. CBB (Cassava Bacterial Blight): angular leaf spots, dieback. Use clean cuttings.
3. Root Rot: fungal/Phytophthora; caused by waterlogged soil. Raised beds prevent this.
4. Mealybug: sucks sap, leaf curl. Natural enemies (parasitic wasps) help.

OTHER CROPS:
- Yam: vulnerable to flooding; needs well-drained mounds 60cm+ high; plant Feb-March
- Plantain: roots rot in waterlogged soil; plant on elevated ground; sucker management critical
- Palm oil: most resilient tree crop; 5 years to first harvest; improved tenera hybrids give higher yield
- Maize: most flood-vulnerable — 3 days waterlogged = dead crop; plant on ridges
- Cocoyam: tolerates wetter conditions; good for low-lying areas; underrated
- Cowpea: excellent dry-season crop; nitrogen-fixing; intercrop with cassava; harvests in 60-90 days

RESILIENCE STRATEGIES:
1. RAISED BEDS & MOUNDS: 50-80cm above flat ground — prevents root waterlogging
2. IMPROVED VARIETIES: TME 419 for cassava; early-maturing varieties escape flood season
3. PLANTING CALENDAR: Plant cassava March-April; never plant Sep-Oct; harvest before October flood peak
4. CROP DIVERSIFICATION: cassava + cowpea + plantain + vegetables = never total failure
5. WATER HARVESTING: Collect rainwater in pits/tanks during wet season for dry-season use
6. MULCHING: dry grass/leaves on soil surface retains moisture in dry season (free)
7. COMPOST: build compost pit from kitchen/farm waste; improves soil for free
8. INTERCROPPING: Cassava + cowpea (cowpea fixes nitrogen; cassava benefits next season)
9. STAGGERED PLANTING: 3 batches over 3 months — if one batch floods, others survive
10. OIL SPILL REMEDIATION: Bioremediation (till + compost); phytoremediation (vetiver grass, sunflowers); lime to restore pH; 12-24 months

MARKET & INCOME:
- Dry season garri (Dec-Feb) fetches peak prices: N800-2,500/kg
- Farmers who harvest Oct-Nov flood the market and get lowest prices
- Quality garri (white, dry, no lumps) fetches 30-50% premium
- Post-harvest loss: fresh roots rot in 2-3 days — the hidden income killer
- WhatsApp trader groups in Yenagoa and Port Harcourt share daily prices
- Middlemen pay only 40-60% of final market value — direct selling improves income
- Cooperative selling: farmers selling together command better bulk prices
- Value-addition ladder: cassava to garri to fufu to starch (each step adds value)
- Palm oil: N4,000-8,000/litre for fresh red oil; price drops after rainy season

COMMUNICATION PRINCIPLES:
- Use simple, plain language — no jargon without explanation
- Connect advice to what the farmer already knows and already has available
- Acknowledge the real pain of losing harvests — it is traumatic and financially devastating
- Always give at least one action the farmer can take today at zero cost
- Recommend ADEP or local extension agents for seed sourcing and soil testing
`;

// ─── Learn track config ───────────────────────────────────────────────────────

interface LearnTopic {
  id: LearnTopicId;
  title: string;
  subtitle: string;
  emoji: string;
  colour: string;
  urgency?: string;
}

const LEARN_TOPICS: LearnTopic[] = [
  { id: 'climate',     title: 'Climate Change & Flooding',         subtitle: 'What is happening, why, and how farmers can adapt',           emoji: '🌧️', colour: 'from-blue-600 to-cyan-600',    urgency: '⚠️ Most urgent for Oloibiri farmers' },
  { id: 'cassava',     title: 'Cassava: Growing & Protecting',      subtitle: 'Varieties, planting, diseases, and harvest strategies',        emoji: '🌿', colour: 'from-green-600 to-emerald-600', urgency: '🌿 Primary crop of the region' },
  { id: 'resilience',  title: 'Resilient Farming Practices',        subtitle: 'Raised beds, diversification, water management, and more',     emoji: '🛡️', colour: 'from-teal-600 to-green-600'  },
  { id: 'other-crops', title: 'Other Crops: Yam, Plantain & Palm',  subtitle: 'What grows well now, what to protect, what to reconsider',     emoji: '🌴', colour: 'from-amber-600 to-yellow-600' },
  { id: 'oil-spills',  title: 'Oil Contamination & Recovery',       subtitle: "Identifying damage, bioremediation, and farmers' rights",      emoji: '⚠️', colour: 'from-orange-700 to-red-700',   urgency: '☠️ Critical in Oloibiri area' },
  { id: 'market',      title: 'Market Prices & Selling Strategy',   subtitle: 'Getting better prices, reducing post-harvest loss',            emoji: '💰', colour: 'from-purple-600 to-violet-600' },
];

const LEARN_SYSTEM_PROMPTS: Record<LearnTopicId, string> = {
  climate: `You are an expert agriculture and climate adaptation consultant specialising in the Niger Delta region of Nigeria. A youth agricultural advisor is learning to advise local farmers.
${NIGER_DELTA_CONTEXT}
TODAY'S TOPIC: Climate Change and Flooding — its impact on Oloibiri farming and how to adapt.

KEY TEACHING POINTS:
- The 2022 floods destroyed 94.9% of farm households' crops in Bayelsa — make this real and vivid
- Explain the paradox: heavier, more intense rains in wet season PLUS longer, hotter dry season
- The seasonal calendar has shifted: traditional planting times from parents and grandparents are no longer reliable
- Sea level rise is pushing saltwater into creeks, damaging farmland near waterways
- Climate change will WORSEN over time: farmers must build resilience now, not after disaster
- Give hope: cassava is one of the world's most climate-resilient crops; smart farmers can adapt

YOUR ROLE: You are the student's knowledgeable tutor. Ask questions to check understanding. Use specific Oloibiri examples. Keep responses clear and practical — the student must be able to explain this to a real farmer.`,

  cassava: `You are an expert cassava agronomist and extension worker for Bayelsa State, Nigeria. A youth agricultural advisor is learning to advise local farmers.
${NIGER_DELTA_CONTEXT}
TODAY'S TOPIC: Cassava — varieties, planting, disease identification, and harvest management.

KEY TEACHING POINTS:
- TME 419 is the best variety for Oloibiri: CMD-resistant, high yield, 8-12 month harvest — explain why this matters
- Planting time is critical: March-April start of rains is ideal; never plant September-October (flood risk)
- Raised beds or mounds are now essential — flat ground floods and rots roots
- CMD identification: yellow/green mosaic leaf pattern, leaf distortion, stunted growth; roguing infected plants prevents spread
- Root rot: smells, soft roots, dark discolouration — caused by waterlogging; prevention is always better than cure
- Harvest timing: 9-15 months for TME 419; harvest BEFORE the October-November flood peak
- Post-harvest: cassava roots rot in 2-3 days; process into garri quickly or leave in ground

YOUR ROLE: Be a patient, practical teacher. Use analogies. Check understanding with questions. Give specific local examples that a farmer would recognise.`,

  resilience: `You are a resilient agriculture specialist for the Niger Delta. A youth agricultural advisor is learning to advise local farmers.
${NIGER_DELTA_CONTEXT}
TODAY'S TOPIC: Resilient Farming Practices — building a farm that survives flooding, drought, and uncertainty.

KEY TEACHING POINTS:
- Resilience means not losing everything when floods come — spreading risk across crops, locations, timings
- Raised beds (50-80cm high): the single most important physical change a farmer can make right now
- Crop diversification: cassava + cowpea + plantain + leafy vegetables = never total failure
- Staggered planting: plant cassava in 3 batches over 3 months — if one batch floods, others may survive
- Water harvesting: store rainy season water for dry season — simple earth pits work
- Mulching: dry grass and leaves on soil surface retains moisture in dry season (free, available everywhere)
- Compost: build a compost pit from kitchen waste and farm waste — improves soil health for free
- Intercropping cassava with cowpea: cowpea fixes nitrogen into soil; cassava benefits the following season
- The hardest message to deliver: traditional farming methods are no longer enough; adaptation is not optional

YOUR ROLE: Be inspiring but grounded. Acknowledge that change is hard and costs money. Always include at least one free or low-cost solution.`,

  'other-crops': `You are an agricultural extension advisor for Bayelsa State, Nigeria. A youth agricultural advisor is learning to advise local farmers.
${NIGER_DELTA_CONTEXT}
TODAY'S TOPIC: Other Crops — Yam, Plantain, Palm Oil, Maize, Cocoyam, Rubber.

KEY TEACHING POINTS:
- YAM: Excellent cash crop but very vulnerable to flooding; needs high, well-drained mounds 60cm+; plant February-March before main rains; newer early-maturing varieties (TDr 89/02665) help
- PLANTAIN: Good income crop; roots rot in waterlogged soil; plant on elevated ground or ridges; sucker management is key
- PALM OIL: The most resilient tree crop; but takes 5 years to first harvest; oil spills kill trees; use improved tenera hybrids for higher oil yield
- MAIZE: Most flood-vulnerable crop in the region; 3 days waterlogged = dead crop; plant on raised ridges; dry season maize with irrigation is actually more reliable now
- COCOYAM: Underrated; tolerates wetter conditions than other crops; good for low-lying areas; nutritious; market improving
- Farmers who lost yam to floods in 2022 should plant yam on higher mounds AND grow cassava as backup

YOUR ROLE: Practical, specific, localised. Help the student give concrete advice for the specific crop a farmer is asking about.`,

  'oil-spills': `You are an environmental agronomist specialising in oil spill remediation and agricultural recovery in the Niger Delta. A youth agricultural advisor is learning to advise local farmers.
${NIGER_DELTA_CONTEXT}
TODAY'S TOPIC: Oil Contamination — identifying damage, remediating soil, choosing safe crops, and asserting legal rights.

KEY TEACHING POINTS:
IDENTIFYING CONTAMINATION:
- Visual signs: oily sheen on water or soil, iridescent puddles, black or dark patches in soil
- Plant signs: yellowing/browning leaves starting from edges, stunted growth, failed germination in patches, dead zones near waterways
- Smell: distinctive petroleum smell in soil or water

HEALTH WARNING: Do not grow food crops on visibly contaminated soil.

WHAT FARMERS CAN DO:
1. Report spills to NOSDRA (National Oil Spill Detection and Response Agency) and NDDC
2. Document the damage: photos, dates, crop loss estimates — needed for compensation claims
3. Bioremediation: till contaminated soil and add organic matter (compost, cow dung); takes 12-24 months
4. Phytoremediation: plant vetiver grass or sunflowers on contaminated soil — they absorb petroleum compounds over 1-2 seasons
5. Apply lime (calcium carbonate) to restore soil pH after contamination

YOUR ROLE: Be honest about the severity. Help the student give accurate information about rights (compensation), remediation timelines, and what is safe.`,

  market: `You are an agricultural market specialist for Bayelsa State, helping small farmers get better prices and reduce post-harvest losses. A youth agricultural advisor is learning to advise local farmers.
${NIGER_DELTA_CONTEXT}
TODAY'S TOPIC: Market Prices and Selling — timing, post-harvest management, and getting fair prices.

KEY TEACHING POINTS:
CASSAVA/GARRI MARKET:
- Dry season cassava fetches premium prices (December-February) because supply is low
- Farmers who harvest October-November flood the market and get lowest prices
- Strategy: harvest cassava before October, store as garri (processed, shelf life = months)
- Garri price range: N800-2,500/kg depending on quality, season, and buyer
- Quality garri (white, dry, no lumps) fetches 30-50% premium over poor quality

POST-HARVEST LOSS (cassava):
- Fresh roots rot in 2-3 days — the biggest hidden cost in farming
- Immediate processing into garri is the solution
- Group processing: farmers sharing a grater and press reduces individual cost dramatically

MARKET INTELLIGENCE:
- WhatsApp trader groups in Yenagoa and Port Harcourt share daily prices
- Market days in Yenagoa, Nembe, Brass: different days each market
- Middlemen pay 40-60% of final market value — direct selling improves income significantly
- Cooperative selling: farmers selling together get better bulk prices

YOUR ROLE: Be practical about money. Farmers need advice they can act on. Connect market strategy to their existing crops and resources.`,
};

const LEARN_EVAL_RUBRIC = [
  { id: 'understanding', label: 'Topic Understanding',    desc: 'Did the student grasp the core concepts and their local context?' },
  { id: 'application',   label: 'Practical Application', desc: 'Could the student translate knowledge into advice a farmer would act on?' },
  { id: 'local',         label: 'Local Grounding',        desc: 'Did the student use specific Oloibiri/Niger Delta context, not generic advice?' },
  { id: 'questions',     label: 'Quality of Questions',   desc: 'Did the student ask probing questions that deepen understanding?' },
  { id: 'communication', label: 'Communication Clarity',  desc: 'Were explanations clear, accurate, and appropriately framed?' },
];

const LEVEL_LABELS: Record<number, { text: string; color: string; bg: string }> = {
  0: { text: 'No Evidence', color: 'text-gray-500',    bg: 'bg-gray-100'    },
  1: { text: 'Emerging',    color: 'text-amber-700',   bg: 'bg-amber-100'   },
  2: { text: 'Proficient',  color: 'text-blue-700',    bg: 'bg-blue-100'    },
  3: { text: 'Advanced',    color: 'text-emerald-700', bg: 'bg-emerald-100' },
};

// ─── Apply track config ───────────────────────────────────────────────────────

const CONSULT_TYPES: Record<ConsultationType, {
  label: string; emoji: string; colour: string;
  bgLight: string; border: string; textColour: string; description: string;
}> = {
  'crop-problem':       { label: 'Crop Problem',       emoji: '🌿', colour: 'from-red-500 to-orange-500',    bgLight: 'bg-red-50',    border: 'border-red-300',    textColour: 'text-red-700',    description: 'Disease, pests, poor growth, failed harvest' },
  'yield-improvement':  { label: 'Yield Improvement',  emoji: '📈', colour: 'from-green-600 to-emerald-600', bgLight: 'bg-green-50',  border: 'border-green-300',  textColour: 'text-green-700',  description: 'Varieties, planting, soil, water management' },
  'market-strategy':    { label: 'Market Strategy',    emoji: '💰', colour: 'from-purple-600 to-violet-600', bgLight: 'bg-purple-50', border: 'border-purple-300', textColour: 'text-purple-700', description: 'Prices, selling, garri processing, cooperatives' },
  'oil-contamination':  { label: 'Oil Contamination',  emoji: '⚠️', colour: 'from-orange-700 to-red-700',   bgLight: 'bg-orange-50', border: 'border-orange-300', textColour: 'text-orange-700', description: 'Identifying spill damage, rights, remediation' },
  'climate-adaptation': { label: 'Climate Adaptation', emoji: '🌧️', colour: 'from-blue-600 to-cyan-600',    bgLight: 'bg-blue-50',   border: 'border-blue-300',   textColour: 'text-blue-700',   description: 'Flood resilience, planting calendar, raised beds' },
};

const URGENCY_CONFIG: Record<UrgencyLevel, {
  label: string; colour: string; bg: string; border: string; icon: React.ReactNode;
}> = {
  low:    { label: 'Low',    colour: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-300',  icon: <CheckCircle size={13}/> },
  medium: { label: 'Medium', colour: 'text-yellow-700', bg: 'bg-yellow-50', border: 'border-yellow-300', icon: <Clock size={13}/> },
  high:   { label: 'High',   colour: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-300', icon: <AlertTriangle size={13}/> },
  urgent: { label: 'URGENT', colour: 'text-red-700',    bg: 'bg-red-50',    border: 'border-red-400',    icon: <AlertTriangle size={13}/> },
};

const CROPS_LIST = ['Cassava', 'Yam', 'Plantain', 'Palm Oil', 'Maize', 'Cocoyam', 'Cowpea', 'Rubber', 'Vegetables', 'Other'];
const VILLAGES   = ['Oloibiri', 'Ibiade', 'Nembe', 'Brass', 'Yenagoa', 'Ogbia', 'Other'];

function buildApplyPrompt(type: ConsultationType, farmer: Farmer): string {
  const cropList = farmer.crops.map(c => `${c.acres} acres of ${c.crop}`).join(', ') || 'crops not specified';

  const typeInstructions: Record<ConsultationType, string> = {
    'crop-problem': `CONSULTATION TYPE: Crop Problem Diagnosis
Step 1 — Identify the crop and scale: which crop, how many acres affected, when did signs appear
Step 2 — Gather symptom observations: leaves, stems, roots, soil, water, pattern of damage
Step 3 — Identify likely cause: disease, pest, waterlogging, oil contamination, nutrient deficiency
Step 4 — Give diagnosis with confidence level, and a clear action plan (immediate + preventive)
- Always ask about pattern of damage first (random spread vs. near waterways vs. in patches)
- For cassava: distinguish CMD (mosaic leaf patterns), CBB (angular leaf spots), root rot (smell, soft roots)
- If oil contamination is suspected, flag it urgently
- Always end with at least one thing the farmer can do TODAY at zero cost`,
    'yield-improvement': `CONSULTATION TYPE: Yield Improvement
Step 1 — Understand current system: which varieties, planting dates, spacing, soil management, inputs used
Step 2 — Identify key yield gaps: variety, timing, spacing, soil health, water, pest/disease
Step 3 — Prioritise improvements by impact and cost (free first, then affordable, then investment)
Step 4 — Give specific, measurable recommendations (exact variety names, bed heights, dates, spacing)
- TME 419 for cassava is the biggest single yield improvement available
- Raised beds: 50-80cm for all root crops on flood-prone land — single highest-impact practice
- Processing cassava into garri vs. selling fresh roots = 3-5x value increase
- Always give yield estimates where possible`,
    'market-strategy': `CONSULTATION TYPE: Market Strategy
Step 1 — Understand what the farmer currently produces, when they harvest, and how they sell
Step 2 — Identify the main income leakage: timing, post-harvest loss, middlemen, low quality, no processing
Step 3 — Give a specific strategy to improve price received or reduce losses
Step 4 — Connect to local market intelligence: WhatsApp groups, market days, cooperative opportunities
- Garri storage is the most powerful tool: sell dry-season garri (Dec-Feb) for peak prices
- Middlemen: 40-60% of market value — cooperative or direct selling transforms income
- Quality premium: white, dry, lump-free garri fetches 30-50% more
- Always give real price ranges in Naira to make advice concrete and credible`,
    'oil-contamination': `CONSULTATION TYPE: Oil Contamination Assessment and Response
THIS IS A SERIOUS SITUATION — treat it with urgency and honesty.
Step 1 — Gather observation evidence: soil colour/smell, water sheen, plant damage pattern, proximity to pipelines
Step 2 — Assess contamination likelihood (definite / probable / possible / unlikely)
Step 3 — Immediate safety actions: what not to plant, what not to eat, water safety
Step 4 — Rights and documentation: NOSDRA report, photo evidence, compensation claim process
Step 5 — Remediation roadmap: bioremediation timeline, phytoremediation, lime application
- Do NOT grow food crops on visibly contaminated soil
- The farmer has legal rights; oil companies are required to remediate and compensate
- Acknowledge the severity — this represents years of lost income and is deeply unjust`,
    'climate-adaptation': `CONSULTATION TYPE: Climate Adaptation Planning
Step 1 — Understand the farmer's current exposure: location, flooding history, crops lost, current practices
Step 2 — Identify the highest-risk vulnerabilities in their specific farm system
Step 3 — Build a practical adaptation plan ranked by impact and cost
Step 4 — Update their planting calendar for the changed climate reality
- Raised beds (50-80cm) are the single most important physical change
- Crop diversification = insurance: cassava + cowpea + plantain + vegetables = never total failure
- March-April planting for cassava; harvest before October is the single most important calendar change
- Acknowledge grief: traditional farming knowledge from generations is no longer enough
- Always give at least one free adaptation action the farmer can start this week`,
  };

  return `You are an expert agricultural advisor supporting a youth advisor working directly with farmers in Oloibiri (Bayelsa State) and Ibiade (Ogun State), Nigeria. The youth advisor is conducting a real consultation with a farmer who is present.

${NIGER_DELTA_CONTEXT}

CURRENT CONSULTATION:
- Farmer: ${farmer.farmer_name}, ${farmer.village}
- Farmer's crops: ${cropList}

${typeInstructions[type]}

YOUR ROLE: You are the AI knowledge engine behind the youth advisor. Respond with:
1. Targeted clarifying questions (ask 1-2 at a time)
2. Clear diagnosis or advice with your reasoning
3. Urgency level where relevant: LOW / MEDIUM / HIGH / URGENT
4. Specific farmer actions — prioritise free and low-cost actions first
5. What to follow up on, or when to refer to extension agents / ADEP

FORMAT: Short paragraphs and bullet points. Specific and local — variety names, Naira amounts, local references. Plain language the farmer can understand when the youth reads it aloud. End every response with at least one concrete action the farmer can take TODAY.

${type === 'oil-contamination' ? 'If contamination is confirmed or highly probable: lead with URGENT and state clearly what the farmer should stop doing immediately.' : ''}`;
}

// ─── Background ───────────────────────────────────────────────────────────────

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
  const [mode, setMode] = useState<AppMode>('landing');

  // ── Learn state
  const [selectedTopic, setSelectedTopic]   = useState<LearnTopic | null>(null);
  const [learnMessages, setLearnMessages]   = useState<ChatMessage[]>([]);
  const [learnDashId, setLearnDashId]       = useState<string | null>(null);
  const [isEvaluating, setIsEvaluating]     = useState(false);
  const [evaluation, setEvaluation]         = useState<LearnEvaluation | null>(null);
  const [showEvalModal, setShowEvalModal]   = useState(false);
  const [isSavingLearn, setIsSavingLearn]   = useState(false);

  // ── Apply state
  const [selectedFarmer, setSelectedFarmer]             = useState<Farmer | null>(null);
  const [selectedConsultation, setSelectedConsultation] = useState<Consultation | null>(null);
  const [consultationType, setConsultationType]         = useState<ConsultationType | null>(null);
  const [farmers, setFarmers]                           = useState<Farmer[]>([]);
  const [consultations, setConsultations]               = useState<Consultation[]>([]);
  const [loadingFarmers, setLoadingFarmers]             = useState(false);
  const [loadingConsults, setLoadingConsults]           = useState(false);
  const [newName, setNewName]                           = useState('');
  const [newVillage, setNewVillage]                     = useState('');
  const [newPhone, setNewPhone]                         = useState('');
  const [newCrops, setNewCrops]                         = useState<CropEntry[]>([]);
  const [newNotes, setNewNotes]                         = useState('');
  const [savingFarmer, setSavingFarmer]                 = useState(false);
  const [applyMessages, setApplyMessages]               = useState<ChatMessage[]>([]);
  const [savingConsult, setSavingConsult]               = useState(false);
  const [consultSaved, setConsultSaved]                 = useState(false);
  const [detectedUrgency, setDetectedUrgency]           = useState<UrgencyLevel | null>(null);
  const [youthActions, setYouthActions]                 = useState('');
  const [followUpNeeded, setFollowUpNeeded]             = useState(false);
  const [followUpDate, setFollowUpDate]                 = useState('');
  const [followUpNotes, setFollowUpNotes]               = useState('');

  // ── Shared
  const [inputText, setInputText]     = useState('');
  const [isSending, setIsSending]     = useState(false);
  const [voices, setVoices]           = useState<SpeechSynthesisVoice[]>([]);
  const [voiceMode, setVoiceMode]     = useState<'english' | 'pidgin'>('pidgin');
  const [speechOn, setSpeechOn]       = useState(false);
  const [isListening, setIsListening] = useState(false);

  const learnEndRef  = useRef<HTMLDivElement>(null);
  const applyEndRef  = useRef<HTMLDivElement>(null);
  const inputRef     = useRef<HTMLTextAreaElement>(null);
  const recogRef     = useRef<any>(null);
  const learnInit    = useRef(false);

  // ─── Voice ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.addEventListener('voiceschanged', load);
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
    window.speechSynthesis.speak(utt);
  }, [speechOn, voices, voiceMode]);

  useEffect(() => { learnEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [learnMessages, isSending]);
  useEffect(() => { applyEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [applyMessages, isSending]);

  // ─── Load farmers ─────────────────────────────────────────────────────────
  const loadFarmers = useCallback(async () => {
    if (!user) return;
    setLoadingFarmers(true);
    try {
      const { data, error } = await supabase
        .from('agriculture_farmer_summary').select('*')
        .eq('youth_user_id', user.id).order('farmer_name');
      if (!error && data) setFarmers(data as Farmer[]);
    } finally { setLoadingFarmers(false); }
  }, [user]);

  useEffect(() => { if (mode === 'dashboard') loadFarmers(); }, [mode, loadFarmers]);

  const loadConsultations = useCallback(async (farmerId: string) => {
    setLoadingConsults(true);
    try {
      const { data, error } = await supabase
        .from('agriculture_consultations').select('*')
        .eq('farmer_id', farmerId).order('created_at', { ascending: false });
      if (!error && data) setConsultations(data as Consultation[]);
    } finally { setLoadingConsults(false); }
  }, []);

  // ─── Learn: init session ──────────────────────────────────────────────────
  useEffect(() => {
    if (mode === 'learn-chat' && selectedTopic && !learnInit.current) {
      learnInit.current = true;
      (async () => {
        if (!user || !selectedTopic) return;
        setIsSending(true);
        try {
          const { data } = await supabase.from('dashboard').insert({
            user_id: user.id, activity: 'agriculture_consultant',
            category_activity: 'Community Impact', sub_category: selectedTopic.id,
            title: `Agriculture Learning — ${selectedTopic.title}`,
            progress: 'started', chat_history: JSON.stringify([]),
            created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
          }).select('id').single();
          if (data?.id) setLearnDashId(data.id);
          const reply = await chatText(LEARN_SYSTEM_PROMPTS[selectedTopic.id], [{
            role: 'user',
            content: 'Start with a warm, engaging 2-3 sentence introduction to this topic. Tell me the 2 or 3 most important things I will learn. Then ask one question to begin exploring what I already know.',
          }]);
          const msg: ChatMessage = { id: crypto.randomUUID(), role: 'assistant', content: reply, timestamp: new Date() };
          setLearnMessages([msg]);
          speak(reply);
        } catch {
          setLearnMessages([{ id: crypto.randomUUID(), role: 'assistant', content: 'Welcome! Ask me anything about this topic.', timestamp: new Date() }]);
        } finally { setIsSending(false); }
      })();
    }
    if (mode !== 'learn-chat') learnInit.current = false;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, selectedTopic]);

  const persistLearn = useCallback(async (msgs: ChatMessage[], eval_: LearnEvaluation | null = null) => {
    if (!learnDashId) return;
    await supabase.from('dashboard').update({
      chat_history: JSON.stringify(msgs),
      ...(eval_ && { english_skills_evaluation: eval_ }),
      progress: eval_?.can_advance ? 'completed' : 'started',
      updated_at: new Date().toISOString(),
    }).eq('id', learnDashId);
  }, [learnDashId]);

  // ─── Learn: send ──────────────────────────────────────────────────────────
  const sendLearn = useCallback(async () => {
    if (!inputText.trim() || isSending || !selectedTopic) return;
    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: inputText.trim(), timestamp: new Date() };
    const withUser = [...learnMessages, userMsg];
    setLearnMessages(withUser); setInputText(''); setIsSending(true);
    try {
      const reply = await chatText(LEARN_SYSTEM_PROMPTS[selectedTopic.id], withUser.map(m => ({ role: m.role, content: m.content })));
      const aiMsg: ChatMessage = { id: crypto.randomUUID(), role: 'assistant', content: reply, timestamp: new Date() };
      const final = [...withUser, aiMsg];
      setLearnMessages(final); speak(reply); await persistLearn(final);
    } catch {
      setLearnMessages(p => [...p, { id: crypto.randomUUID(), role: 'assistant', content: 'Technical issue — please try again.', timestamp: new Date() }]);
    } finally { setIsSending(false); setTimeout(() => inputRef.current?.focus(), 100); }
  }, [inputText, isSending, learnMessages, selectedTopic, speak, persistLearn]);

  // ─── Learn: evaluate ──────────────────────────────────────────────────────
  const handleEvaluate = async () => {
    if (isEvaluating || learnMessages.length < 4 || !selectedTopic) return;
    setIsEvaluating(true);
    const userTurns = learnMessages.filter(m => m.role === 'user').length;
    const conversation = learnMessages.map(m => `${m.role === 'user' ? 'STUDENT' : 'AI TUTOR'}: ${m.content}`).join('\n\n');
    try {
      const result = await chatJSON({
        page: 'AgricultureConsultantPage',
        messages: [{ role: 'user', content: `You are evaluating a youth agricultural advisor's learning session on "${selectedTopic.title}" in the Niger Delta / Oloibiri context.\n\nConversation:\n${conversation}\n\nStudent turns: ${userTurns}\n\nEvaluate on 5 dimensions (0-3 each):\n1. Topic Understanding: Did the student grasp the core concepts and their local context?\n2. Practical Application: Could the student translate knowledge into advice a farmer would act on?\n3. Local Grounding: Did the student use specific Oloibiri/Niger Delta context, not generic advice?\n4. Quality of Questions: Did the student ask probing questions that deepen understanding?\n5. Communication Clarity: Were explanations clear, accurate, and appropriately framed?\n\nReturn valid JSON only:\n{\n  "scores": { "understanding": 0-3, "application": 0-3, "local": 0-3, "questions": 0-3, "communication": 0-3 },\n  "evidence": { "understanding": "1-2 sentences", "application": "1-2 sentences", "local": "1-2 sentences", "questions": "1-2 sentences", "communication": "1-2 sentences" },\n  "overall_score": 0.0-3.0,\n  "can_advance": true/false,\n  "encouragement": "2-3 warm, specific sentences about what the student did well",\n  "main_improvement": "1-2 sentences on the single most important improvement"\n}` }],
        system: 'You are an expert agricultural education evaluator. Be specific, cite actual things said. Be fair and constructive. Keep each evidence field to 1-2 sentences maximum.',
        max_tokens: 2000, temperature: 0.3,
      });
      setEvaluation(result as LearnEvaluation);
      await persistLearn(learnMessages, result as LearnEvaluation);
      setShowEvalModal(true);
    } catch (e) { console.error(e); }
    finally { setIsEvaluating(false); }
  };

  // ─── Apply: urgency ───────────────────────────────────────────────────────
  const extractUrgency = (text: string): UrgencyLevel | null => {
    const lower = text.toLowerCase();
    if (lower.includes('🚨') || lower.includes('urgent')) return 'urgent';
    if (lower.includes('urgency: high') || lower.includes('**high**')) return 'high';
    if (lower.includes('urgency: medium') || lower.includes('**medium**')) return 'medium';
    if (lower.includes('urgency: low') || lower.includes('**low**')) return 'low';
    return null;
  };

  // ─── Apply: send ──────────────────────────────────────────────────────────
  const sendApply = useCallback(async () => {
    if (!inputText.trim() || isSending || !selectedFarmer || !consultationType) return;
    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: inputText.trim(), timestamp: new Date() };
    setApplyMessages(prev => [...prev, userMsg]); setInputText(''); setIsSending(true);
    try {
      const history = [...applyMessages, userMsg];
      const reply = await chatText(buildApplyPrompt(consultationType, selectedFarmer), history.map(m => ({ role: m.role, content: m.content })));
      const aiMsg: ChatMessage = { id: crypto.randomUUID(), role: 'assistant', content: reply, timestamp: new Date() };
      setApplyMessages(prev => [...prev, aiMsg]); speak(reply);
      const urgency = extractUrgency(reply);
      const order: UrgencyLevel[] = ['low', 'medium', 'high', 'urgent'];
      if (urgency && (!detectedUrgency || order.indexOf(urgency) > order.indexOf(detectedUrgency))) setDetectedUrgency(urgency);
    } catch { setApplyMessages(p => [...p, { id: crypto.randomUUID(), role: 'assistant', content: 'Technical issue — please try again.', timestamp: new Date() }]); }
    finally { setIsSending(false); setTimeout(() => inputRef.current?.focus(), 100); }
  }, [inputText, isSending, applyMessages, selectedFarmer, consultationType, speak, detectedUrgency]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); mode === 'learn-chat' ? sendLearn() : sendApply(); }
  };

  // ─── Voice input ──────────────────────────────────────────────────────────
  const toggleListening = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    if (isListening) { recogRef.current?.stop(); setIsListening(false); return; }
    const rec = new SR(); recogRef.current = rec;
    rec.lang = 'en-NG'; rec.continuous = false; rec.interimResults = false;
    rec.onresult = (e: any) => setInputText(p => p ? `${p} ${e.results[0][0].transcript}` : e.results[0][0].transcript);
    rec.onend = () => setIsListening(false); rec.onerror = () => setIsListening(false);
    rec.start(); setIsListening(true);
  };

  // ─── Apply: start consultation ────────────────────────────────────────────
  const startConsultation = (farmer: Farmer, type: ConsultationType) => {
    setSelectedFarmer(farmer); setConsultationType(type);
    setApplyMessages([]); setInputText(''); setDetectedUrgency(null);
    setYouthActions(''); setFollowUpNeeded(false); setFollowUpDate(''); setFollowUpNotes('');
    setConsultSaved(false); setMode('new-consultation');
    const ct = CONSULT_TYPES[type];
    const cropList = farmer.crops.map(c => c.crop).join(', ') || 'various crops';
    setApplyMessages([{
      id: crypto.randomUUID(), role: 'assistant',
      content: `Ready to assist with **${ct.emoji} ${ct.label}** for **${farmer.farmer_name}** (${farmer.village} · ${cropList}).\n\n${ct.description}.\n\nDescribe what you and the farmer are seeing — I will ask the right questions and guide you to a clear recommendation.`,
      timestamp: new Date(),
    }]);
  };

  // ─── Apply: save consultation ─────────────────────────────────────────────
  const saveConsultation = async () => {
    if (!user || !selectedFarmer || !consultationType || applyMessages.length < 2) return;
    setSavingConsult(true);
    const lastAI = [...applyMessages].reverse().find(m => m.role === 'assistant');
    const problemSummary = applyMessages.find(m => m.role === 'user')?.content ?? '';
    try {
      const { error } = await supabase.from('agriculture_consultations').insert({
        youth_user_id: user.id, farmer_id: selectedFarmer.id, consultation_type: consultationType,
        problem_summary: problemSummary, ai_advice: lastAI?.content ?? null,
        urgency_level: detectedUrgency, youth_actions_taken: youthActions || null,
        conversation_history: applyMessages, follow_up_needed: followUpNeeded,
        follow_up_date: followUpDate || null, follow_up_notes: followUpNotes || null, resolved: false,
      });
      if (!error) { setConsultSaved(true); await loadFarmers(); }
    } finally { setSavingConsult(false); }
  };

  // ─── Apply: save farmer ───────────────────────────────────────────────────
  const saveFarmer = async () => {
    if (!user || !newName.trim() || !newVillage) return;
    setSavingFarmer(true);
    try {
      const { error } = await supabase.from('agriculture_farmers').insert({
        youth_user_id: user.id, farmer_name: newName.trim(), village: newVillage,
        phone: newPhone || null, crops: newCrops, notes: newNotes || null,
      });
      if (!error) { await loadFarmers(); resetAddFarmer(); setMode('dashboard'); }
    } finally { setSavingFarmer(false); }
  };

  const resetAddFarmer = () => { setNewName(''); setNewVillage(''); setNewPhone(''); setNewCrops([]); setNewNotes(''); };
  const addCropEntry = () => {
    const used = new Set(newCrops.map(c => c.crop));
    const next = CROPS_LIST.find(c => !used.has(c));
    if (next) setNewCrops(prev => [...prev, { crop: next, acres: 0 }]);
  };

  const formatDate = (iso: string) => new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });

  const urgencyBadge = (level: UrgencyLevel | null) => {
    if (!level) return null;
    const cfg = URGENCY_CONFIG[level];
    return <span className={classNames('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border', cfg.colour, cfg.bg, cfg.border)}>{cfg.icon} {cfg.label}</span>;
  };

  const markResolved = async (consultId: string) => {
    await supabase.from('agriculture_consultations').update({ resolved: true }).eq('id', consultId);
    if (selectedFarmer) loadConsultations(selectedFarmer.id);
    await loadFarmers();
  };

  const resetLearn = () => {
    window.speechSynthesis.cancel();
    setLearnMessages([]); setEvaluation(null); setShowEvalModal(false);
    setLearnDashId(null); setSelectedTopic(null); setMode('landing');
  };

  const learnTurns = learnMessages.filter(m => m.role === 'user').length;
  const applyTurns = applyMessages.filter(m => m.role === 'user').length;

  // ─── Voice toggle buttons ────────────────────────────────────────────────
  const VoiceToggle = () => (
    <div className="flex items-center gap-2">
      <div className="flex rounded-lg overflow-hidden border border-gray-300">
        {(['pidgin', 'english'] as const).map(m => (
          <button key={m} onClick={() => setVoiceMode(m)}
            className={`px-2.5 py-1.5 text-xs font-bold border-r border-gray-300 last:border-0 transition-all ${voiceMode===m?(m==='english'?'bg-blue-600 text-white':'bg-green-600 text-white'):'bg-white text-gray-500'}`}>
            {m==='english'?'🇬🇧':'🇳🇬'}
          </button>
        ))}
      </div>
      <button onClick={() => { setSpeechOn(s => !s); if (speechOn) window.speechSynthesis.cancel(); }}
        className={classNames('p-2 rounded-lg', speechOn ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400')}>
        {speechOn ? <Volume2 size={15}/> : <VolumeX size={15}/>}
      </button>
    </div>
  );

  // ─── Chat input ───────────────────────────────────────────────────────────
  const ChatInput = ({ placeholder, disabled, accentColour }: { placeholder: string; disabled?: boolean; accentColour: string }) => (
    <div className="border-t p-4 rounded-b-2xl">
      <div className="flex items-end gap-2">
        <textarea ref={inputRef} value={inputText} onChange={e => setInputText(e.target.value)} onKeyDown={handleKeyDown} rows={2}
          placeholder={placeholder} disabled={disabled || isSending}
          className="flex-1 px-4 py-3 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-400 resize-none leading-relaxed disabled:opacity-50"/>
        <div className="flex flex-col gap-2">
          <button onClick={toggleListening} disabled={disabled}
            className={classNames('p-2.5 rounded-xl transition-all', isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-100 text-gray-500 hover:bg-gray-200')}>
            {isListening ? <MicOff size={16}/> : <Mic size={16}/>}
          </button>
          <button onClick={() => mode === 'learn-chat' ? sendLearn() : sendApply()}
            disabled={!inputText.trim() || isSending || !!disabled}
            className={classNames('p-2.5 rounded-xl transition-all',
              inputText.trim() && !isSending && !disabled ? `bg-gradient-to-br ${accentColour} text-white hover:opacity-90` : 'bg-gray-100 text-gray-400 cursor-not-allowed')}>
            <Send size={16}/>
          </button>
        </div>
      </div>
    </div>
  );

  // ════════════════════════════════════════════════════════════════════════════
  // RENDER: LANDING
  // ════════════════════════════════════════════════════════════════════════════

  if (mode === 'landing') {
    return (
      <AppLayout>
        <AgricultureBackground />
        <div className="relative z-10 max-w-4xl mx-auto px-6 py-12">
          {/* Hero */}
          <div className="bg-black/40 backdrop-blur-sm rounded-2xl p-7 mb-8 text-center">
            <div className="flex justify-center mb-3">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-3xl">🌿</div>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Agriculture Advisor</h1>
            <p className="text-green-200 text-base max-w-xl mx-auto">
              Helping youth agricultural advisors serve farmers across Oloibiri and Ibiade — on cassava, climate change, oil contamination, and building resilient farms.
            </p>
          </div>

          {/* Split-screen */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* LEARN */}
            <button
              onClick={() => setMode('learn-topics')}
              className="group bg-white/90 backdrop-blur-sm hover:bg-white rounded-2xl p-7 text-left transition-all border-2 border-transparent hover:border-emerald-400 shadow-md hover:shadow-xl">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                  <BookOpen size={26} className="text-white"/>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Learn</h2>
                  <p className="text-sm text-emerald-600 font-semibold">Study with an AI tutor</p>
                </div>
              </div>
              <p className="text-sm text-gray-600 mb-4 leading-relaxed">
                Deepen your agricultural knowledge on six core topics — from cassava diseases to climate adaptation to market strategy. Each session is saved to your dashboard and scored with a 5-dimension evaluation.
              </p>
              <div className="flex flex-wrap gap-1.5 mb-5">
                {LEARN_TOPICS.map(t => (
                  <span key={t.id} className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-2 py-0.5 font-medium">
                    {t.emoji} {t.title.split(':')[0]}
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-2 text-emerald-600 font-bold text-sm">
                Start learning <ChevronRight size={16}/>
              </div>
            </button>

            {/* APPLY */}
            <button
              onClick={() => { loadFarmers(); setMode('dashboard'); }}
              className="group bg-white/90 backdrop-blur-sm hover:bg-white rounded-2xl p-7 text-left transition-all border-2 border-transparent hover:border-green-500 shadow-md hover:shadow-xl">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-green-600 to-emerald-700 flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                  <Briefcase size={26} className="text-white"/>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Apply</h2>
                  <p className="text-sm text-green-600 font-semibold">Work with a real farmer</p>
                </div>
              </div>
              <p className="text-sm text-gray-600 mb-4 leading-relaxed">
                Use AI as your expert partner during live farmer visits. Register farmers, run AI-guided consultations across five topic areas, and build a professional case record over time.
              </p>
              <div className="flex flex-wrap gap-1.5 mb-5">
                {Object.values(CONSULT_TYPES).map(ct => (
                  <span key={ct.label} className="text-xs bg-green-50 text-green-700 border border-green-200 rounded-full px-2 py-0.5 font-medium">
                    {ct.emoji} {ct.label}
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-2 text-green-700 font-bold text-sm">
                Open casebook <ChevronRight size={16}/>
              </div>
            </button>
          </div>
        </div>
      </AppLayout>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // RENDER: LEARN — topic picker
  // ════════════════════════════════════════════════════════════════════════════

  if (mode === 'learn-topics') {
    return (
      <AppLayout>
        <AgricultureBackground />
        <div className="relative z-10 max-w-2xl mx-auto px-4 py-6">
          <div className="bg-black/40 backdrop-blur-sm rounded-2xl p-5 mb-5">
            <div className="flex items-center gap-3">
              <button onClick={() => setMode('landing')} className="text-white/70 hover:text-white p-1"><ArrowLeft size={20}/></button>
              <div>
                <h2 className="text-xl font-bold text-white">Learn — Choose a Topic</h2>
                <p className="text-sm text-green-200">Each session is saved to your dashboard and evaluated</p>
              </div>
            </div>
          </div>
          <div className="space-y-3">
            {LEARN_TOPICS.map(topic => (
              <button key={topic.id}
                onClick={() => { setSelectedTopic(topic); setLearnMessages([]); setEvaluation(null); setShowEvalModal(false); setLearnDashId(null); setMode('learn-chat'); }}
                className="w-full bg-white/90 backdrop-blur-sm hover:bg-white rounded-2xl p-5 text-left border-2 border-transparent hover:border-emerald-400 transition-all shadow-sm">
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${topic.colour} flex items-center justify-center text-2xl flex-shrink-0 shadow-sm`}>{topic.emoji}</div>
                  <div className="flex-1">
                    <p className="font-bold text-gray-900">{topic.title}</p>
                    <p className="text-sm text-gray-500 mt-0.5">{topic.subtitle}</p>
                    {topic.urgency && <p className="text-xs text-orange-600 font-semibold mt-1.5">{topic.urgency}</p>}
                  </div>
                  <ChevronRight size={17} className="text-gray-400 flex-shrink-0 mt-1"/>
                </div>
              </button>
            ))}
          </div>
        </div>
      </AppLayout>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // RENDER: LEARN — chat
  // ════════════════════════════════════════════════════════════════════════════

  if (mode === 'learn-chat' && selectedTopic) {
    const ac = selectedTopic.colour;
    return (
      <AppLayout>
        <AgricultureBackground />
        <div className="relative z-10 max-w-2xl mx-auto px-4 py-6">

          {/* Evaluation modal */}
          {showEvalModal && evaluation && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <div className={`bg-gradient-to-r ${ac} rounded-t-2xl p-5 flex items-center justify-between`}>
                  <div className="flex items-center gap-2"><Award size={20} className="text-white"/><h2 className="text-white font-bold text-lg">Learning Session Evaluation</h2></div>
                  <button onClick={() => setShowEvalModal(false)} className="text-white/80 hover:text-white"><X size={20}/></button>
                </div>
                <div className="p-6 space-y-4">
                  <div className="text-center p-4 bg-gray-50 rounded-xl">
                    <p className="text-sm text-gray-500 uppercase font-bold mb-1">Overall Score</p>
                    <p className="text-5xl font-black text-gray-900">{evaluation.overall_score?.toFixed(1)}<span className="text-2xl text-gray-400">/3.0</span></p>
                    <p className={classNames('text-base font-bold mt-1', evaluation.can_advance ? 'text-emerald-600' : 'text-amber-600')}>
                      {evaluation.can_advance ? '✅ Ready to advise farmers on this topic' : '🌱 Keep practising — every session builds skill'}
                    </p>
                  </div>
                  <div className="space-y-3">
                    {LEARN_EVAL_RUBRIC.map(dim => {
                      const score = evaluation.scores?.[dim.id] ?? 0;
                      const ll = LEVEL_LABELS[score];
                      return (
                        <div key={dim.id} className={`rounded-xl p-4 ${ll.bg}`}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-gray-900 text-sm">{dim.label}</span>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full bg-white ${ll.color}`}>{score}/3 — {ll.text}</span>
                          </div>
                          <div className="w-full bg-white/60 rounded-full h-1.5 mb-1.5">
                            <div className={`h-full rounded-full ${score===3?'bg-emerald-500':score===2?'bg-blue-500':score===1?'bg-amber-500':'bg-gray-300'}`} style={{ width: `${(score/3)*100}%` }}/>
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
                    <button onClick={resetLearn} className="flex-1 py-3 rounded-xl font-bold text-white bg-gray-700 hover:bg-gray-800">New Session</button>
                    <button onClick={() => setShowEvalModal(false)} className={`flex-1 py-3 rounded-xl font-bold text-white bg-gradient-to-r ${ac} hover:opacity-95`}>Continue</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Header */}
          <div className="bg-white/93 backdrop-blur-sm rounded-2xl shadow-lg p-4 mb-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <button onClick={() => { window.speechSynthesis.cancel(); setMode('learn-topics'); setLearnMessages([]); }} className="text-gray-400 hover:text-gray-700 p-1"><ArrowLeft size={20}/></button>
                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${ac} flex items-center justify-center text-xl`}>{selectedTopic.emoji}</div>
                <div>
                  <h2 className="text-base font-bold text-gray-900">{selectedTopic.title}</h2>
                  <p className="text-xs text-gray-500">Learn track · session saved to dashboard</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <VoiceToggle />
                <button onClick={async () => { setIsSavingLearn(true); await persistLearn(learnMessages); setIsSavingLearn(false); }}
                  disabled={isSavingLearn || learnMessages.length < 2}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:border-gray-400 disabled:opacity-40">
                  {isSavingLearn ? <Loader2 size={13} className="animate-spin"/> : <Save size={13}/>} Save
                </button>
                <button onClick={handleEvaluate} disabled={isEvaluating || learnTurns < 3}
                  className={classNames('flex items-center gap-1.5 px-3 py-1.5 text-sm font-bold rounded-lg transition-colors',
                    learnTurns >= 3 && !isEvaluating ? `bg-gradient-to-r ${ac} text-white hover:opacity-90` : 'bg-gray-200 text-gray-400 cursor-not-allowed')}>
                  {isEvaluating ? <Loader2 size={13} className="animate-spin"/> : <Star size={13}/>}
                  {isEvaluating ? 'Evaluating…' : 'Evaluate'}
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-sm rounded-xl px-4 py-2.5 mb-4 flex items-center gap-2">
            <Lightbulb size={14} className="text-emerald-700 flex-shrink-0"/>
            <p className="text-xs text-gray-700">Ask the AI tutor anything about this topic. The more questions you ask, the stronger your evaluation. Evaluate after 3+ exchanges.</p>
          </div>

          {/* Chat */}
          <div className="bg-white rounded-2xl shadow-lg mb-4 flex flex-col" style={{ height: '460px' }}>
            <div className="flex items-center justify-between px-5 py-3 border-b bg-gray-50 rounded-t-2xl text-xs text-gray-500">
              <span className="font-semibold text-gray-700">AI Tutor · {selectedTopic.title}</span>
              <span>{learnTurns} exchange{learnTurns !== 1 ? 's' : ''} · {learnTurns >= 3 ? '✅ Ready to evaluate' : `${3 - learnTurns} more to unlock`}</span>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {learnMessages.map(msg => (
                <div key={msg.id} className={classNames('flex items-start gap-3', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                  {msg.role === 'assistant' && <div className={`flex-shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br ${ac} flex items-center justify-center text-lg`}>{selectedTopic.emoji}</div>}
                  <div className={classNames('max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed', msg.role === 'user' ? 'bg-emerald-600 text-white rounded-tr-sm' : 'bg-gray-100 text-gray-900 rounded-tl-sm')}>
                    {msg.role === 'assistant' && <p className="text-xs font-bold mb-1 opacity-50">AI Tutor</p>}
                    {msg.role === 'user' && <p className="text-xs font-bold mb-1 opacity-75">You</p>}
                    <MarkdownText text={msg.content}/>
                  </div>
                  {msg.role === 'user' && <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center"><User size={15} className="text-white"/></div>}
                </div>
              ))}
              {isSending && mode === 'learn-chat' && (
                <div className="flex items-start gap-3">
                  <div className={`flex-shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br ${ac} flex items-center justify-center text-lg`}>{selectedTopic.emoji}</div>
                  <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3"><div className="flex gap-1.5 items-center h-4">{[0,150,300].map(d=><div key={d} className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{animationDelay:`${d}ms`}}/>)}</div></div>
                </div>
              )}
              <div ref={learnEndRef}/>
            </div>
            <ChatInput placeholder="Ask a question or explore the topic…" accentColour={ac}/>
          </div>

          {learnTurns >= 3 && !showEvalModal && (
            <div className="bg-white/90 backdrop-blur-sm rounded-xl p-4 flex items-center justify-between shadow">
              <div className="flex items-center gap-2"><Award size={18} className="text-emerald-600"/><p className="text-sm font-semibold text-gray-800">Good session — get your evaluation when ready.</p></div>
              <button onClick={handleEvaluate} disabled={isEvaluating} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-white bg-gradient-to-r ${ac} hover:opacity-90`}>
                {isEvaluating ? <><Loader2 size={15} className="animate-spin"/>Evaluating…</> : <><Star size={15}/>Evaluate</>}
              </button>
            </div>
          )}
          <div className="mt-3 flex justify-center">
            <button onClick={resetLearn} className="text-sm text-white/60 hover:text-white/90 underline transition-colors">Back to home</button>
          </div>
        </div>
      </AppLayout>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // RENDER: APPLY — dashboard
  // ════════════════════════════════════════════════════════════════════════════

  if (mode === 'dashboard') {
    return (
      <AppLayout>
        <AgricultureBackground />
        <div className="relative z-10 max-w-2xl mx-auto px-4 py-6">
          <div className="bg-black/40 backdrop-blur-sm rounded-2xl p-5 mb-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button onClick={() => setMode('landing')} className="text-white/70 hover:text-white p-1"><ArrowLeft size={20}/></button>
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-2xl">🌿</div>
                <div><h1 className="text-xl font-bold text-white">Apply — Farmer Casebook</h1><p className="text-sm text-green-200">Oloibiri & Ibiade · live advisory sessions</p></div>
              </div>
              <button onClick={() => { resetAddFarmer(); setMode('add-farmer'); }}
                className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-semibold text-sm hover:opacity-90">
                <Plus size={16}/> Add Farmer
              </button>
            </div>
          </div>

          {farmers.length > 0 && (
            <div className="grid grid-cols-3 gap-3 mb-5">
              {[
                { label: 'Farmers', value: farmers.length, icon: '👨🏿‍🌾' },
                { label: 'Open Cases', value: farmers.reduce((s, f) => s + (f.open_cases ?? 0), 0), icon: '📋' },
                { label: 'This Month', value: farmers.filter(f => f.last_consultation_at && new Date(f.last_consultation_at) > new Date(Date.now() - 30*24*60*60*1000)).length, icon: '📅' },
              ].map(stat => (
                <div key={stat.label} className="bg-white/90 backdrop-blur-sm rounded-xl p-4 text-center">
                  <div className="text-2xl mb-1">{stat.icon}</div>
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                  <p className="text-xs text-gray-500">{stat.label}</p>
                </div>
              ))}
            </div>
          )}

          {loadingFarmers ? (
            <div className="flex justify-center py-12"><Loader2 size={28} className="animate-spin text-green-300"/></div>
          ) : farmers.length === 0 ? (
            <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-10 text-center">
              <div className="text-5xl mb-4">🌾</div>
              <h2 className="text-lg font-bold text-gray-800 mb-2">No farmers registered yet</h2>
              <p className="text-sm text-gray-500 mb-5">Add your first farmer to start building your casebook.</p>
              <button onClick={() => { resetAddFarmer(); setMode('add-farmer'); }}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-semibold hover:opacity-90">
                <Plus size={16}/> Register First Farmer
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {farmers.map(farmer => (
                <button key={farmer.id}
                  onClick={() => { setSelectedFarmer(farmer); loadConsultations(farmer.id); setMode('farmer-detail'); }}
                  className="w-full bg-white/90 backdrop-blur-sm rounded-2xl p-4 text-left hover:bg-white transition-colors border border-transparent hover:border-green-300">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-100 to-emerald-100 flex items-center justify-center text-lg">👨🏿‍🌾</div>
                      <div>
                        <p className="font-bold text-gray-900">{farmer.farmer_name}</p>
                        <p className="text-sm text-gray-500">{farmer.village}</p>
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {(farmer.crops as CropEntry[]).map(c => (
                            <span key={c.crop} className="text-xs bg-green-100 text-green-700 rounded-full px-2 py-0.5">{c.acres}ac {c.crop}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <ChevronRight size={17} className="text-gray-400"/>
                      {(farmer.open_cases ?? 0) > 0 && <span className="text-xs bg-orange-100 text-orange-700 rounded-full px-2 py-0.5 font-semibold">{farmer.open_cases} open</span>}
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-3 text-xs text-gray-400">
                    <span>{farmer.total_consultations ?? 0} consultation{farmer.total_consultations !== 1 ? 's' : ''}</span>
                    {farmer.last_consultation_at && <span>Last: {formatDate(farmer.last_consultation_at)}</span>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </AppLayout>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // RENDER: ADD FARMER
  // ════════════════════════════════════════════════════════════════════════════

  if (mode === 'add-farmer') {
    return (
      <AppLayout>
        <AgricultureBackground />
        <div className="relative z-10 max-w-2xl mx-auto px-4 py-6">
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-md p-5">
            <div className="flex items-center gap-3 mb-5">
              <button onClick={() => setMode('dashboard')} className="text-gray-400 hover:text-gray-700 p-1"><ArrowLeft size={20}/></button>
              <div><h2 className="text-xl font-bold text-gray-900">Register Farmer</h2><p className="text-sm text-gray-500">Add to your casebook</p></div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Farmer Name *</label>
                <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Mama Ebiere"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-400 text-base"/>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Village *</label>
                <select value={newVillage} onChange={e => setNewVillage(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-400 text-base bg-white">
                  <option value="">Select village…</option>
                  {VILLAGES.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Phone (optional)</label>
                <input value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder="+234 801 234 5678"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-400 text-base"/>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-semibold text-gray-700">Crops Grown</label>
                  <button onClick={addCropEntry} disabled={newCrops.length >= 6} className="text-xs text-green-700 font-semibold hover:underline disabled:opacity-40">+ Add crop</button>
                </div>
                {newCrops.length === 0 && <p className="text-sm text-gray-400 italic">No crops added yet.</p>}
                <div className="space-y-2">
                  {newCrops.map((c, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <select value={c.crop} onChange={e => setNewCrops(prev => prev.map((x, i) => i === idx ? { ...x, crop: e.target.value } : x))}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-400">
                        {CROPS_LIST.map(cr => <option key={cr} value={cr}>{cr}</option>)}
                      </select>
                      <input type="number" min="0" value={c.acres} onChange={e => setNewCrops(prev => prev.map((x, i) => i === idx ? { ...x, acres: Number(e.target.value) } : x))}
                        className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-green-400" placeholder="ac"/>
                      <button onClick={() => setNewCrops(prev => prev.filter((_, i) => i !== idx))} className="text-gray-400 hover:text-red-500 p-1"><X size={16}/></button>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Notes (optional)</label>
                <textarea value={newNotes} onChange={e => setNewNotes(e.target.value)} rows={2}
                  placeholder="Past problems, land type, special concerns…"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-400 text-sm resize-none"/>
              </div>
              <button onClick={saveFarmer} disabled={!newName.trim() || !newVillage || savingFarmer}
                className={classNames('w-full py-3.5 rounded-xl font-bold text-white text-base transition-opacity',
                  newName.trim() && newVillage && !savingFarmer ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:opacity-90' : 'bg-gray-300 cursor-not-allowed')}>
                {savingFarmer ? <span className="flex items-center justify-center gap-2"><Loader2 size={16} className="animate-spin"/>Saving…</span> : 'Register Farmer'}
              </button>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // RENDER: FARMER DETAIL
  // ════════════════════════════════════════════════════════════════════════════

  if (mode === 'farmer-detail' && selectedFarmer) {
    const farmer = selectedFarmer;
    return (
      <AppLayout>
        <AgricultureBackground />
        <div className="relative z-10 max-w-2xl mx-auto px-4 py-6 space-y-4">
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-md p-5">
            <div className="flex items-center gap-3 mb-4">
              <button onClick={() => setMode('dashboard')} className="text-gray-400 hover:text-gray-700 p-1"><ArrowLeft size={20}/></button>
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-green-100 to-emerald-100 flex items-center justify-center text-2xl">👨🏿‍🌾</div>
              <div className="flex-1"><h2 className="text-xl font-bold text-gray-900">{farmer.farmer_name}</h2><p className="text-sm text-gray-500">{farmer.village}{farmer.phone ? ` · ${farmer.phone}` : ''}</p></div>
            </div>
            {(farmer.crops as CropEntry[]).length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {(farmer.crops as CropEntry[]).map(c => (
                  <div key={c.crop} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold border bg-green-50 border-green-300 text-green-700">🌿 {c.acres}ac {c.crop}</div>
                ))}
              </div>
            )}
            {farmer.notes && <p className="text-sm text-gray-600 italic bg-gray-50 rounded-lg px-3 py-2 mb-4">{farmer.notes}</p>}
            <p className="text-sm font-bold text-gray-700 mb-3">Start new consultation:</p>
            <div className="grid grid-cols-1 gap-2">
              {(Object.entries(CONSULT_TYPES) as [ConsultationType, typeof CONSULT_TYPES[ConsultationType]][]).map(([key, ct]) => (
                <button key={key} onClick={() => startConsultation(farmer, key)}
                  className={classNames('flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-white text-sm bg-gradient-to-r hover:opacity-90 transition-opacity text-left', ct.colour)}>
                  <span className="text-xl flex-shrink-0">{ct.emoji}</span>
                  <div><div>{ct.label}</div><div className="text-xs font-normal opacity-80">{ct.description}</div></div>
                </button>
              ))}
            </div>
          </div>
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-md p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2"><ClipboardList size={16} className="text-green-600"/> Case History</h3>
              <button onClick={() => loadConsultations(farmer.id)} className="text-gray-400 hover:text-gray-700"><RefreshCw size={14}/></button>
            </div>
            {loadingConsults ? (
              <div className="flex justify-center py-6"><Loader2 size={20} className="animate-spin text-green-600"/></div>
            ) : consultations.length === 0 ? (
              <p className="text-sm text-gray-400 italic text-center py-4">No consultations yet.</p>
            ) : (
              <div className="space-y-3">
                {consultations.map(c => {
                  const ct = CONSULT_TYPES[c.consultation_type];
                  return (
                    <div key={c.id} onClick={() => { setSelectedConsultation(c); setMode('case-detail'); }}
                      className="border border-gray-200 rounded-xl p-4 hover:border-green-300 transition-colors cursor-pointer">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{ct.emoji}</span>
                          <div><p className="font-semibold text-gray-900 text-sm">{ct.label}</p><p className="text-xs text-gray-500">{formatDate(c.created_at)}</p></div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          {c.urgency_level && urgencyBadge(c.urgency_level)}
                          {c.resolved ? <span className="text-xs text-green-600 font-semibold flex items-center gap-1"><CheckCircle size={11}/> Resolved</span> : <span className="text-xs text-orange-600 font-semibold">Open</span>}
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 mt-2 line-clamp-2">{c.problem_summary}</p>
                      {c.follow_up_needed && !c.resolved && c.follow_up_date && (
                        <p className="text-xs text-blue-600 mt-1.5 flex items-center gap-1"><Calendar size={11}/> Follow-up: {formatDate(c.follow_up_date)}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </AppLayout>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // RENDER: NEW CONSULTATION
  // ════════════════════════════════════════════════════════════════════════════

  if (mode === 'new-consultation' && selectedFarmer && consultationType) {
    const ct = CONSULT_TYPES[consultationType];
    return (
      <AppLayout>
        <AgricultureBackground />
        <div className="relative z-10 max-w-2xl mx-auto px-4 py-6">
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-md p-4 mb-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <button onClick={() => { window.speechSynthesis.cancel(); setMode('farmer-detail'); loadConsultations(selectedFarmer.id); }} className="text-gray-400 hover:text-gray-700 p-1"><ArrowLeft size={20}/></button>
                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${ct.colour} flex items-center justify-center text-2xl`}>{ct.emoji}</div>
                <div><h2 className="text-base font-bold text-gray-900">{ct.label}</h2><p className="text-xs text-gray-500">{selectedFarmer.farmer_name} · {selectedFarmer.village}</p></div>
              </div>
              <div className="flex items-center gap-2">
                {detectedUrgency && urgencyBadge(detectedUrgency)}
                <VoiceToggle/>
              </div>
            </div>
          </div>

          {detectedUrgency === 'urgent' && (
            <div className="bg-red-600 text-white rounded-xl p-4 mb-4 flex items-start gap-3 animate-pulse">
              <AlertTriangle size={20} className="flex-shrink-0 mt-0.5"/>
              <div><p className="font-bold">URGENT SITUATION</p><p className="text-sm opacity-90">Follow the AI's immediate action instructions. Do not delay.</p></div>
            </div>
          )}

          <div className="bg-white/80 backdrop-blur-sm rounded-xl px-4 py-2.5 mb-4 flex items-center gap-2">
            <Lightbulb size={14} className="text-green-700 flex-shrink-0"/>
            <p className="text-xs text-gray-700">Describe what you and {selectedFarmer.farmer_name} are seeing. The AI will ask the right questions and guide you to a clear recommendation.</p>
          </div>

          <div className="bg-white rounded-2xl shadow-lg mb-4 flex flex-col" style={{ height: '460px' }}>
            <div className="flex items-center justify-between px-5 py-3 border-b bg-gray-50 rounded-t-2xl text-xs text-gray-500">
              <span className="font-semibold text-gray-700 flex items-center gap-1.5">🌿 Agriculture AI Advisor</span>
              <span>{applyTurns} exchange{applyTurns !== 1 ? 's' : ''}</span>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {applyMessages.map(msg => (
                <div key={msg.id} className={classNames('flex items-start gap-3', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                  {msg.role === 'assistant' && <div className={`flex-shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br ${ct.colour} flex items-center justify-center text-lg`}>{ct.emoji}</div>}
                  <div className={classNames('max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed', msg.role === 'user' ? 'bg-green-600 text-white rounded-tr-sm' : 'bg-gray-100 text-gray-900 rounded-tl-sm')}>
                    {msg.role === 'assistant' && <p className="text-xs font-bold mb-1 opacity-50">AI Advisor</p>}
                    {msg.role === 'user' && <p className="text-xs font-bold mb-1 opacity-75">You (Advisor)</p>}
                    <MarkdownText text={msg.content}/>
                  </div>
                  {msg.role === 'user' && <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-green-600 flex items-center justify-center"><User size={15} className="text-white"/></div>}
                </div>
              ))}
              {isSending && mode === 'new-consultation' && (
                <div className="flex items-start gap-3">
                  <div className={`flex-shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br ${ct.colour} flex items-center justify-center text-lg`}>{ct.emoji}</div>
                  <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3"><div className="flex gap-1.5 items-center h-4">{[0,150,300].map(d=><div key={d} className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{animationDelay:`${d}ms`}}/>)}</div></div>
                </div>
              )}
              <div ref={applyEndRef}/>
            </div>
            <ChatInput placeholder="Describe what the farmer is seeing — symptoms, crop, how long…" disabled={consultSaved} accentColour={ct.colour}/>
          </div>

          {applyTurns >= 1 && (
            <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-md p-5 space-y-4">
              <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2"><Save size={14} className="text-green-600"/> Save Case Record</h3>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">What did you advise / do on the ground?</label>
                <textarea value={youthActions} onChange={e => setYouthActions(e.target.value)} rows={2}
                  placeholder="e.g. Told farmer to rogue the infected cassava plants. Advised TME 419 for next planting."
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-400"/>
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" id="followup" checked={followUpNeeded} onChange={e => setFollowUpNeeded(e.target.checked)} className="w-4 h-4 accent-green-600"/>
                <label htmlFor="followup" className="text-sm font-semibold text-gray-700">Follow-up visit needed</label>
              </div>
              {followUpNeeded && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Follow-up date</label>
                    <input type="date" value={followUpDate} onChange={e => setFollowUpDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400"/>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">What to check</label>
                    <input value={followUpNotes} onChange={e => setFollowUpNotes(e.target.value)} placeholder="e.g. Check if CMD spreading"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400"/>
                  </div>
                </div>
              )}
              {consultSaved ? (
                <div className="flex items-center gap-2 text-green-700 font-semibold text-sm bg-green-50 rounded-xl px-4 py-3">
                  <CheckCircle size={16}/> Case saved to {selectedFarmer.farmer_name}'s record.
                </div>
              ) : (
                <button onClick={saveConsultation} disabled={savingConsult}
                  className="w-full py-3 rounded-xl font-bold text-white bg-gradient-to-r from-green-600 to-emerald-600 hover:opacity-90 disabled:opacity-50">
                  {savingConsult ? <span className="flex items-center justify-center gap-2"><Loader2 size={15} className="animate-spin"/>Saving…</span> : 'Save Case Record'}
                </button>
              )}
            </div>
          )}
        </div>
      </AppLayout>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // RENDER: CASE DETAIL
  // ════════════════════════════════════════════════════════════════════════════

  if (mode === 'case-detail' && selectedConsultation && selectedFarmer) {
    const c = selectedConsultation;
    const ct = CONSULT_TYPES[c.consultation_type];
    return (
      <AppLayout>
        <AgricultureBackground />
        <div className="relative z-10 max-w-2xl mx-auto px-4 py-6 space-y-4">
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-md p-5">
            <div className="flex items-center gap-3 mb-4">
              <button onClick={() => setMode('farmer-detail')} className="text-gray-400 hover:text-gray-700 p-1"><ArrowLeft size={20}/></button>
              <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${ct.colour} flex items-center justify-center text-2xl`}>{ct.emoji}</div>
              <div className="flex-1"><h2 className="text-base font-bold text-gray-900">{ct.label} — {selectedFarmer.farmer_name}</h2><p className="text-xs text-gray-500">{formatDate(c.created_at)}</p></div>
              <div className="flex flex-col items-end gap-1">
                {c.urgency_level && urgencyBadge(c.urgency_level)}
                {c.resolved ? <span className="text-xs text-green-600 font-semibold flex items-center gap-1"><CheckCircle size={11}/> Resolved</span> : <span className="text-xs text-orange-600 font-semibold">Open</span>}
              </div>
            </div>
            <div className="space-y-4">
              <div><p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Problem Described</p><p className="text-sm text-gray-800 bg-gray-50 rounded-lg px-3 py-2">{c.problem_summary}</p></div>
              {c.ai_advice && <div><p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">AI Recommendation</p><div className="text-sm text-gray-800 bg-gray-50 rounded-lg px-3 py-2"><MarkdownText text={c.ai_advice}/></div></div>}
              {c.youth_actions_taken && <div><p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Actions Taken</p><p className="text-sm text-gray-800 bg-green-50 rounded-lg px-3 py-2">{c.youth_actions_taken}</p></div>}
              {c.follow_up_needed && (
                <div className="flex items-start gap-2 text-blue-700 bg-blue-50 rounded-lg px-3 py-2">
                  <Calendar size={14} className="mt-0.5 flex-shrink-0"/>
                  <div><p className="text-sm font-semibold">Follow-up{c.follow_up_date ? `: ${formatDate(c.follow_up_date)}` : ' needed'}</p>{c.follow_up_notes && <p className="text-xs mt-0.5">{c.follow_up_notes}</p>}</div>
                </div>
              )}
              {!c.resolved && (
                <button onClick={async () => { await markResolved(c.id); setSelectedConsultation({...c, resolved: true}); }}
                  className="w-full py-3 rounded-xl font-bold text-white bg-gradient-to-r from-green-600 to-emerald-600 hover:opacity-90">
                  Mark as Resolved ✓
                </button>
              )}
            </div>
          </div>
          {c.conversation_history?.length > 0 && (
            <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-md p-5">
              <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2"><FileText size={14} className="text-green-600"/> Full Consultation Transcript</h3>
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {c.conversation_history.map((msg, i) => (
                  <div key={i} className={classNames('flex items-start gap-2', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                    {msg.role === 'assistant' && <div className={`flex-shrink-0 w-7 h-7 rounded-lg bg-gradient-to-br ${ct.colour} flex items-center justify-center text-sm`}>{ct.emoji}</div>}
                    <div className={classNames('max-w-[80%] rounded-xl px-3 py-2 text-xs leading-relaxed', msg.role === 'user' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-800')}>
                      <MarkdownText text={msg.content}/>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </AppLayout>
    );
  }

  return null;
};

export default AgricultureConsultantPage;