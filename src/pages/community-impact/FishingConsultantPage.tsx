// src/pages/community-impact/FishingConsultantPage.tsx
//
// Fishing Advisor — Community Impact Track
// A professional casebook tool for youth fishing advisors
// serving fishers, fish farmers, and fish traders in Oloibiri
// (Bayelsa State) and surrounding Niger Delta communities.
//
// The youth advisor registers clients, runs AI-assisted consultations
// on catch problems, aquaculture, fish processing, market strategy,
// and oil contamination — with the client present — and maintains
// a case history per client.
//
// DB tables: fishing_clients
//            fishing_consultations
//
// Route: /community-impact/fishing
// Activity stored as: fishing_advisor

import React, { useState, useEffect, useRef, useCallback } from 'react';
import AppLayout from '../../components/layout/AppLayout';
import { supabase } from '../../lib/supabaseClient';
import { chatText } from '../../lib/chatClient';
import { useAuth } from '../../hooks/useAuth';
import {
  Fish, ArrowLeft, Send, Save, Loader2, Plus, User,
  FileText, AlertTriangle, CheckCircle, Clock, ChevronRight,
  ClipboardList, RefreshCw, Calendar, Mic, MicOff,
  Volume2, VolumeX, X, Lightbulb, Waves, Scale, Droplets,
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
  | 'dashboard'
  | 'add-client'
  | 'client-detail'
  | 'new-consultation'
  | 'case-detail';

type ConsultationType =
  | 'catch-problem'
  | 'aquaculture'
  | 'processing-market'
  | 'oil-contamination'
  | 'climate-safety';

type UrgencyLevel = 'low' | 'medium' | 'high' | 'urgent';

type ActivityType =
  | 'wild-fishing'
  | 'aquaculture'
  | 'fish-trading'
  | 'fish-processing'
  | 'shellfish-gathering';

interface Client {
  id: string;
  youth_user_id: string;
  client_name: string;
  village: string;
  phone: string | null;
  activities: ActivityType[];
  waterways: string[];
  notes: string | null;
  created_at: string;
  // from summary view
  total_consultations?: number;
  open_cases?: number;
  last_consultation_at?: string | null;
}

interface Consultation {
  id: string;
  client_id: string;
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

// ─── Niger Delta Fishing Knowledge Base ───────────────────────────────────────

const NIGER_DELTA_FISHING_CONTEXT = `
NIGER DELTA / OLOIBIRI FISHING CONTEXT — always apply this knowledge:

WATERWAYS & GEOGRAPHY:
- Oloibiri sits in Ogbia LGA, Bayelsa State — surrounded by creeks, rivers, and mangrove swamps
- Key waterways: Kolo Creek (sacred to Ogbia/Ijaw people), River Nun (major river),
  Taylor Creek, Ekole River, San Bartholomew River, Brass River, Ikebiri Creek
- Over 200 fish species recorded in Bayelsa State waters
- ~2,370 km² of flowing freshwater + ~8,600 km² of swampland
- Tidal influence in lower creeks near coast; affects best fishing times
- Wet season: April–November (heavy rains, flooding, higher water, fish dispersed)
- Dry season: December–March (lower water, fish concentrated in deeper pools — often best catches)

FISH SPECIES (local names + commercial importance):
FRESHWATER — rivers and creeks like Kolo Creek:
- Catfish / "Eja aro" — Clarias gariepinus: most important commercial species; grows fast
  (fingerling to 500–800g in 5–6 months in ponds); tolerates low oxygen; top aquaculture species
- Tilapia / "Eja pupa" — Oreochromis niloticus: second most important; hardy; prolifically breeding;
  ideal for pond farming; prefers shallow warm water
- Chrysichthys (bagrid catfish / "Oporo") — Chrysichthys nigrodigitatus: bottom-dwelling;
  premium eating quality; highest wild market value; declining due to oil contamination
- Synodontis (upside-down catfish): caught in traps in creeks
- Labeo (African carp / "Eja funfun") — Labeo coubie: large; caught in gill nets; good value
- Bonga / "Shawa" — Ethmalosa fimbriata: most abundant estuarine species; very affordable protein;
  important for smoking/drying; sells well dried in markets up to Lagos

ESTUARINE & COASTAL — lower creeks, mangroves:
- Croaker / "Eja dudu" — Pseudotolithus spp.: high-value white fish; popular in city markets
- Mullet — Mugil cephalus: schooling fish; cast nets at dawn; good fresh price
- Snapper / Grunter — Pomadadasys peroteti: good table fish; commands premium price

SHELLFISH & INVERTEBRATES — important women's livelihoods:
- Shrimp / "Ẹja okun kekere": highest value per kg (₦4,000–8,000/kg); seasonal; hand-gathered
  or fine-mesh traps; sells immediately — no storage needed
- Crabs — mangrove and mud crabs; caught in traps; good local demand
- Oysters: attached to mangrove roots; hand-gathered; important for women's income
- Periwinkle / "Isawuru" — Tympanotonus fuscatus: common in mangrove mudflats; women and children
  gather by hand; ₦1,000–2,500/kg in Yenagoa/Port Harcourt markets
- Clams / "Isami" — Egeria radiata: freshwater clam; important food and income;
  found in creek beds; WARNING — heavy metal contamination risk near oil infrastructure

FISHING GEAR (what local fishers actually use):
- Cast nets: used from canoe or bank; good for mullet, tilapia, small bonga
- Gill nets: set across channels; most versatile; mesh size critical (2.5–5 inch for different species)
- Drift nets: carried by current; good for open-water bonga and croaker
- Dugout canoes: primary vessel; paddle or small outboard motor
- Round/drum traps: passive; set overnight in channels for catfish and Chrysichthys
- Long-lines with hooks: set overnight; large catfish and Labeo
- Hook and line: from canoe or bank; bait — worms, small fish, bread
- Atalla (lift nets): used at night with light attraction; effective for bonga and tilapia
- Basket traps: for shallow creeks and flooded areas

OIL CONTAMINATION — CRITICAL FOR OLOIBIRI:
- Oloibiri was Nigeria's first oil field (1956); decades of spills have contaminated waterways
- Oil on water: blocks oxygen exchange → fish suffocate in heavy spills
- Contaminated water: carcinogenic hydrocarbons accumulate in fish flesh — serious health risk
- Contaminated sediment: clams and periwinkle absorb heavy metals from polluted mud
- Signs: oily sheen on creek surface, dead fish floating, petroleum smell, dark/black sediment
  near pipeline crossings, stunted mangrove vegetation nearby
- FOOD SAFETY: Fish from heavily contaminated stretches should NOT be eaten — be honest
- LEGAL RIGHTS: Report spills to NOSDRA (0800-NOSDRA-9); document with photos, dates,
  GPS location, and catch records for compensation claims
- Recovery timeline: after a spill is cleaned, 18–36 months before fish populations return significantly
- Clams and periwinkle: particularly dangerous near oil infrastructure — absorb heavy metals

AQUACULTURE — KEY OPPORTUNITY:
- Pond catfish farming (Clarias gariepinus) is the highest-income aquaculture option
- Simple earthen pond (10m × 10m = 100m²): dig 1–1.5m deep; fill with freshwater
- Fingerlings: available from hatcheries in Yenagoa (NIOMR, ADP) — cost ~₦50–80 each
- Feed: commercial catfish pellets (₦8,000–15,000/bag) supplemented with kitchen waste/worms
- 100m² pond: produces 300–500kg per harvest cycle (5–6 months) — significant income
- Tilapia ponds: simpler; breeds fast — must manage population (remove males or separate)
- CRITICAL RISK: flooding destroys ponds — locate on higher ground; build raised earthen bunds
- Pond disease signs: fish gasping at surface, loss of appetite, unusual swimming behaviour,
  ulcers on skin, fin/tail rot; most common causes are poor water quality and overcrowding
- Water quality: change 30% of pond water weekly; avoid runoff from latrines; test for ammonia
- MARKET: live catfish ₦2,500–4,500/kg; smoked catfish ₦3,500–6,000/kg
- Tilapia: ₦1,800–3,500/kg live; smoking adds 50–80% value

FISH PROCESSING & MARKET:
- SMOKING: Traditional kiln smoking preserves fish 2–6 weeks; dramatically extends market reach;
  smoked catfish from Bayelsa sold in markets from Yenagoa to Lagos; adds 40–80% value
- DRYING: Sun-dried bonga/small fish; simple; reduces weight; good for transport to distant markets
- FERMENTATION: Some communities ferment small fish into condiments — underexplored income
- MARKET PRICES (approximate, Bayelsa 2024):
  • Live catfish: ₦2,500–4,500/kg (₦4,000+ in city markets, dry-season scarcity)
  • Smoked catfish: ₦3,500–6,000/kg
  • Live tilapia: ₦1,800–3,500/kg
  • Smoked bonga: ₦800–2,000/kg (varies by size and quality)
  • Fresh shrimp: ₦4,000–8,000/kg (highest value per kg; sells immediately)
  • Periwinkle: ₦1,000–2,500/kg in Yenagoa/PH markets
  • Clams: ₦600–1,500/kg
  • Fresh croaker: ₦3,000–6,000/kg
- Key selling points: Yenagoa market, Nembe market, Brass port
- Women fish traders: operate transport-and-resale networks; critical economic actors
- Cold chain almost non-existent: speed and smoking/drying are the only preservation tools
- Cooperative selling: fishers together command better bulk prices from traders

CLIMATE CHANGE IMPACTS ON FISHING:
- More intense wet-season floods (2022: 300+ Bayelsa communities submerged) displace fish from
  usual habitats; destroy fish ponds; damage/lose gear; make canoe access dangerous
- Irregular seasons: dry season later and shorter; traditional fish-concentration knowledge unreliable
- Sea level rise: saltwater intrusion advancing up creeks; affects freshwater species; shifts shellfish habitat
- Temperature rise: warmer water = lower dissolved oxygen = fish stress; breeding cycles disrupted

SAFETY — NON-NEGOTIABLE:
- Fishing on open water during heavy rains or storms = canoe capsize risk; do NOT go out
- Waterborne disease: exposure to contaminated water causes skin rashes, eye infections,
  respiratory problems — protect skin; wash after contact with creek water
- Personal flotation devices (life jackets): rarely used but critical — advocate for them
- Never eat fish or shellfish from areas with visible oil contamination signs

RESOURCES FOR REFERRAL:
- NIOMR Yenagoa office: fingerlings, aquaculture technical support
- ADP (Agricultural Development Programme): fingerlings, extension support
- NOSDRA: oil spill reporting and compensation
- WhatsApp trader groups: Yenagoa and Port Harcourt daily market prices

COMMUNICATION PRINCIPLES:
- Use plain language; no jargon (say "how much air is in the water" not "dissolved oxygen")
- Acknowledge the deep cultural connection to Kolo Creek and the waterways in Ijaw/Ogbia culture
- Be honest about contamination risks — fishers already know something is wrong
- Acknowledge the real loss when a traditional fishing ground is destroyed — it is cultural, not just economic
- Connect every recommendation to tools the fisher already has (canoe, existing gear, phone)
- Always give at least one action the client can take TODAY at zero cost
`;

// ─── Consultation type config ─────────────────────────────────────────────────

const CONSULT_TYPES: Record<ConsultationType, {
  label: string;
  emoji: string;
  colour: string;
  bgLight: string;
  border: string;
  textColour: string;
  description: string;
}> = {
  'catch-problem':      { label: 'Catch Problem',         emoji: '🎣', colour: 'from-blue-600 to-cyan-600',    bgLight: 'bg-blue-50',   border: 'border-blue-300',   textColour: 'text-blue-700',   description: 'Declining catches, gear problems, wrong fishing spots or times' },
  'aquaculture':        { label: 'Fish Pond / Aquaculture',emoji: '🐟', colour: 'from-teal-600 to-green-600',  bgLight: 'bg-teal-50',   border: 'border-teal-300',   textColour: 'text-teal-700',   description: 'Starting or fixing a catfish or tilapia pond, disease, feed, water quality' },
  'processing-market':  { label: 'Processing & Market',   emoji: '💰', colour: 'from-amber-600 to-orange-500', bgLight: 'bg-amber-50',  border: 'border-amber-300',  textColour: 'text-amber-700',  description: 'Smoking, drying, pricing, when and where to sell' },
  'oil-contamination':  { label: 'Oil Contamination',     emoji: '⚠️', colour: 'from-red-700 to-orange-700',  bgLight: 'bg-red-50',    border: 'border-red-300',    textColour: 'text-red-700',    description: 'Identifying pollution, food safety, legal rights, compensation' },
  'climate-safety':     { label: 'Climate & Safety',      emoji: '🌊', colour: 'from-indigo-600 to-blue-600', bgLight: 'bg-indigo-50', border: 'border-indigo-300', textColour: 'text-indigo-700', description: 'Flood risk, safe fishing seasons, weather, adapting to change' },
};

const URGENCY_CONFIG: Record<UrgencyLevel, {
  label: string; colour: string; bg: string; border: string; icon: React.ReactNode;
}> = {
  low:    { label: 'Low',    colour: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-300',  icon: <CheckCircle size={13}/> },
  medium: { label: 'Medium', colour: 'text-yellow-700', bg: 'bg-yellow-50', border: 'border-yellow-300', icon: <Clock size={13}/> },
  high:   { label: 'High',   colour: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-300', icon: <AlertTriangle size={13}/> },
  urgent: { label: 'URGENT', colour: 'text-red-700',    bg: 'bg-red-50',    border: 'border-red-400',    icon: <AlertTriangle size={13}/> },
};

const ACTIVITY_OPTIONS: { value: ActivityType; label: string; emoji: string }[] = [
  { value: 'wild-fishing',       label: 'Wild fishing (creek/river)',     emoji: '🎣' },
  { value: 'aquaculture',        label: 'Fish pond / aquaculture',        emoji: '🐟' },
  { value: 'fish-trading',       label: 'Fish trading / selling',         emoji: '🛒' },
  { value: 'fish-processing',    label: 'Fish processing / smoking',      emoji: '🔥' },
  { value: 'shellfish-gathering',label: 'Shellfish gathering (periwinkle/clam/oyster)', emoji: '🦪' },
];

const WATERWAY_OPTIONS = [
  'Kolo Creek', 'River Nun', 'Taylor Creek', 'Ekole River',
  'Brass River', 'Ikebiri Creek', 'San Bartholomew River', 'Other',
];

const VILLAGES = ['Oloibiri', 'Otuabagi', 'Nembe', 'Brass', 'Ogbia', 'Yenagoa', 'Ikebiri', 'Other'];

// ─── Build system prompt per consultation type ────────────────────────────────

function buildSystemPrompt(type: ConsultationType, client: Client): string {
  const ct = CONSULT_TYPES[type];
  const activityList = client.activities.map(a => ACTIVITY_OPTIONS.find(o => o.value === a)?.label ?? a).join(', ') || 'not specified';
  const waterwayList = client.waterways.join(', ') || 'local creeks';

  const typeInstructions: Record<ConsultationType, string> = {
    'catch-problem': `
CONSULTATION TYPE: Catch Problem Diagnosis
Help the youth advisor identify why catches are declining or disappointing, and give a practical action plan.

DIAGNOSTIC FLOW:
Step 1 — Establish baseline: what species, what gear, which waterway, what time of day/season
Step 2 — Identify the change: when did catches decline? Gradually or suddenly? Which species affected most?
Step 3 — Investigate causes: oil contamination nearby? Seasonal change? Gear issue? Wrong fishing location or time? Overfishing of a small area? Water level changes?
Step 4 — Recommend specific improvements: gear adjustment, timing, location change, species shift

KEY DIAGNOSTIC QUESTIONS:
- Is the decline in a specific species or all fish? (Species-specific decline often = contamination or habitat loss)
- Is it recent and sudden or gradual over years? (Sudden = spill or seasonal event; gradual = long-term habitat damage)
- What does the water look like/smell like? (Contamination indicators)
- What mesh size on gill nets? (Wrong mesh = wrong species or undersized fish)
- What time of day/night are they fishing? (Catfish most active at night; mullet at dawn)
- Dry season vs. wet season techniques differ — is the fisher adapting to the season?

ALWAYS:
- Mention at least one gear or technique adjustment the fisher can try TODAY for free
- If contamination is suspected, flag it and move to oil contamination triage
- Be honest if the fishing ground has been permanently damaged
`,
    'aquaculture': `
CONSULTATION TYPE: Aquaculture / Fish Pond Advisory
Help the youth advisor guide the client on starting, improving, or troubleshooting a fish pond.

ADVISORY FLOW:
Step 1 — Understand current situation: existing pond or planning to start? What species? What size? What problems?
Step 2 — For existing ponds: diagnose problems (fish deaths, slow growth, disease signs, water quality, feed issues)
Step 3 — For new ponds: guide through site selection, construction, stocking, feeding, and market planning
Step 4 — Give a specific improvement or action plan with cost estimates where possible

KEY AQUACULTURE PRINCIPLES:
POND SETUP:
- Catfish (Clarias gariepinus): best choice; tolerates low oxygen; grows 500–800g in 5–6 months
- Tilapia: easier to start; breeds fast (manage males); good for beginners
- Pond size: 10m × 10m minimum (100m²); 1–1.5m deep; freshwater only
- Location: AWAY from flood zones; higher ground; build earthen bunds (raised walls)
- Stocking density: 100–200 catfish fingerlings per 100m² for good growth rate
- Fingerlings: from NIOMR or ADP hatcheries in Yenagoa (₦50–80 each)

FEEDING:
- Commercial catfish pellets (₦8,000–15,000/bag) + kitchen waste + worms
- Feed 5% of body weight daily; 2× per day (morning and evening)
- Do NOT overfeed — excess feed rots and pollutes water

WATER QUALITY (most common problem source):
- Change 30% of pond water weekly or when fish gasp at surface
- Fish gasping at surface = low oxygen = change water urgently
- Avoid any runoff from latrines, fertiliser, or oil into pond
- Algae (green water) is normal and good; dark or smelly water = problem

DISEASE SIGNS AND RESPONSES:
- Gasping at surface: low oxygen → change water NOW
- Not eating: check water quality first; reduce feed; observe for 48 hours
- Ulcers / open sores on body: bacterial infection; isolate affected fish; reduce stocking density; improve water flow
- Fin/tail rot: bacterial; caused by stress and poor water quality; isolate; improve water
- Belly-up or erratic swimming: serious; reduce stocking density; change water; call NIOMR
- Prevention is always cheaper than treatment — maintain water quality consistently

ECONOMICS:
- 100m² pond × 300kg harvest × ₦2,500/kg live = ₦750,000 per cycle (5–6 months)
- Smoked catfish: ₦3,500–6,000/kg → smoking doubles income potential
- Start small (100–200 fingerlings) to learn before scaling
`,
    'processing-market': `
CONSULTATION TYPE: Fish Processing & Market Strategy
Help the youth advisor give the client a concrete plan to get more income from their catch or produce.

ADVISORY FLOW:
Step 1 — Understand current practice: what species, how do they currently sell (fresh/smoked/dried), to whom, at what price
Step 2 — Identify the biggest income leakage: post-harvest loss? Selling too cheap? Wrong market? No processing?
Step 3 — Give specific, actionable strategy to improve income received or reduce losses
Step 4 — Connect to local market intelligence and timing

KEY MARKET PRINCIPLES:
SMOKING AND PROCESSING:
- Traditional kiln smoking: preserves catfish 2–6 weeks; extends market reach from local to Yenagoa/Lagos
- Smoking adds 40–80% value to fresh fish — this is the single most powerful income lever
- Good smoked catfish: properly dried (not soft in middle), clean (no burning), golden-brown colour
- Bonga drying: simple sun drying on elevated racks; reduces weight by 70% for easy transport
- Quality matters: buyers in city markets pay 30–50% premium for consistent quality smoking

TIMING AND PRICING:
- Dry season (Dec–March): fish scarce → prices highest; smoked fish stored from wet season sells at peak
- Wet season: fish plentiful → prices lowest; best time to buy cheaply for smoking/drying and storage
- Never sell when everyone else sells — store smoked fish and sell 4–8 weeks later for better price
- Shrimp and croaker: sell immediately (fresh); do NOT attempt to store without cold chain

MARKETS AND BUYERS:
- Yenagoa market, Nembe market, Brass port: key selling points
- WhatsApp trader groups (Yenagoa, Port Harcourt): share daily prices; join or form one
- Middlemen pay only 40–60% of final market value — direct selling to consumers or market women improves income significantly
- Cooperative selling: fishers pooling catch get better bulk prices and can access larger buyers
- Periwinkle and oysters: sell to female traders who transport to Yenagoa/PH — these networks are established

SPECIFIC INCOME CALCULATIONS:
- 100kg fresh catfish at ₦2,500/kg = ₦250,000
- Same fish smoked (loses 60% weight = 40kg smoked) at ₦4,500/kg smoked = ₦180,000
  WAIT: factor in fuel cost for smoking — if fuel costs ₦20,000, net gain from smoking = ₦180,000 - ₦20,000 - ₦250,000 = still better if selling price is ₦5,000+
- Always calculate net income, not gross — fuel, transport, and time all cost money
`,
    'oil-contamination': `
CONSULTATION TYPE: Oil Contamination Assessment & Response
Help the youth advisor assess suspected oil contamination and give the client a clear safety and legal response plan.

⚠️ THIS IS A SERIOUS SITUATION — address it with honesty and urgency.

ASSESSMENT FLOW:
Step 1 — Gather evidence: water appearance/smell, dead fish signs, proximity to pipeline infrastructure, skin/health symptoms
Step 2 — Assess contamination likelihood (definite / probable / possible / unlikely)
Step 3 — Immediate safety actions: what to stop doing, food safety, health protection
Step 4 — Rights and documentation: NOSDRA report, photo evidence, compensation claim process
Step 5 — Alternative income while avoiding contaminated areas

KEY PRINCIPLES:
IDENTIFYING CONTAMINATION:
- Definite signs: oily sheen on water, petroleum smell, dead fish floating, dark/black sediment near pipelines
- Probable signs: fish with unusual taste/smell, skin rashes after water contact, stunted shellfish near pipelines
- Possible signs: declining catches in specific creek stretches near oil infrastructure (could also be other causes)

FOOD SAFETY RULES — NON-NEGOTIABLE:
- Do NOT eat fish or shellfish from areas with visible contamination signs — hydrocarbons accumulate in flesh
- Clams and periwinkle near oil infrastructure: highest risk — absorb heavy metals from sediment
- If uncertain about a fishing ground's safety, err on the side of caution — illness from contaminated fish is real

LEGAL RIGHTS:
- NOSDRA (0800-NOSDRA-9): receives spill reports; required to investigate
- Documentation needed: photos with dates, GPS location if possible, descriptions of dead fish/damage, catch records showing decline before and after spill
- Compensation claims: oil companies are legally required to remediate and compensate; community documentation is essential evidence
- Community unity: compensation claims made by groups of affected fishers are harder to dismiss than individual claims

ALTERNATIVE INCOME DURING CONTAMINATION:
- Shift to uncontaminated waterways (identify nearest clean creek)
- Aquaculture pond (on land) is not affected by waterway contamination
- Shellfish gathering: move to mangrove areas away from pipeline routes
- Fish trading: buy from uncontaminated areas and sell in local markets

RECOVERY TIMELINE — BE HONEST:
- After active spill cleaned: 18–36 months before fish populations return significantly
- Clam and periwinkle populations: 2–5 years for full recovery
- Heavily contaminated sediment: contamination persists in creek beds for decades even after surface appears clean
`,
    'climate-safety': `
CONSULTATION TYPE: Climate Change & Safety Advisory
Help the youth advisor build the client's awareness of changing conditions and give practical adaptation advice.

ADVISORY FLOW:
Step 1 — Understand current exposure: which waterways, what season, what changes they have noticed
Step 2 — Identify the main risks: flood danger, irregular seasons, waterway changes, health exposure
Step 3 — Give a practical adaptation plan: when to fish, when not to, what to change
Step 4 — Update their seasonal fishing calendar for changed conditions

KEY CLIMATE MESSAGES:
SEASONAL CHANGES:
- Traditional dry-season fishing calendars (when fish concentrate in pools) are shifting — fish concentration timing is 2–4 weeks later than 20 years ago
- Wet season (April–November) is becoming more intense: heavier rain events, more sudden floods
- Dry season (December–March) now shorter — fewer weeks of concentrated-fish conditions
- Best adaptation: fish more frequently in early dry season (December–January) before conditions change

FLOOD SAFETY — CRITICAL:
- Do NOT fish on open water during heavy rain or approaching storm — canoe capsize risk is real and fatal
- If water rises 30cm+ overnight: do not cross open stretches; stick to creek edges with trees
- Warning signs of dangerous conditions: sudden wind increase, darkening sky, rapid current increase
- Life jackets/personal flotation: advocate strongly — a plastic container tied to a rope is better than nothing
- Leave gear rather than risk life in a storm — gear can be replaced, lives cannot

FISH POND AND FLOOD RISK:
- Ponds on low ground: will flood in 2022-level events; losses can be total
- Mitigation: build earthen bunds 50–80cm above normal flood level; locate ponds on elevated ground
- Wet-season pond management: reduce stocking density before wet season; have drain pipes ready

ADAPTING GEAR AND TECHNIQUE:
- In flood conditions: fish the edges of flooded land (fish move into newly flooded vegetation to feed)
- In high water: fish use different movement patterns — long-lines and traps work better than cast nets
- In dry season: concentrate effort at deeper channel bends where fish aggregate

HEALTH RISKS FROM CONTAMINATED WATER:
- Creek water contact with contaminated areas: skin rashes, eye infections, respiratory issues
- Protect skin: wear covering clothing in contaminated areas; wash thoroughly after contact
- Do not drink or cook with creek water near oil infrastructure
`,
  };

  return `You are an expert fisheries and aquaculture advisor supporting a youth advisor working directly with fishing communities in Oloibiri (Bayelsa State) and surrounding Niger Delta communities, Nigeria. The youth advisor is conducting a real consultation with a client who is present.

${NIGER_DELTA_FISHING_CONTEXT}

CURRENT CONSULTATION:
- Client: ${client.client_name}, ${client.village}
- Client's activities: ${activityList}
- Waterways used: ${waterwayList}
${typeInstructions[type]}

YOUR ROLE IN THIS CONSULTATION:
You are the AI knowledge engine behind the youth advisor. The youth types what the client describes. You respond with:
1. Targeted clarifying questions (1–2 at a time; build a clear picture before advising)
2. Clear diagnosis or recommendation with your reasoning shown
3. Urgency level where relevant: LOW / MEDIUM / HIGH / URGENT
4. Specific actions — always prioritise free and low-cost actions first
5. When to refer to NIOMR, ADP, NOSDRA, or other support

FORMAT YOUR RESPONSES:
- Short paragraphs and bullet points
- Specific and local — species names, Naira amounts, waterway names, local references
- Plain language the client can understand when the youth reads it aloud
- End every response with at least one concrete action the client can take TODAY

${type === 'oil-contamination' ? '🚨 If contamination is confirmed or highly probable: lead with URGENT and state clearly what the client should STOP doing immediately (eating contaminated fish, fishing contaminated area).' : ''}
${type === 'climate-safety' ? '⛵ If dangerous weather conditions are described: prioritise safety above all other advice. State clearly if it is NOT safe to go out on the water.' : ''}`;
}

// ─── Fishing background (preserved from original) ─────────────────────────────

const FishingBackground: React.FC = () => {
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
  const img = "url('/background_fishing_consultant.webp')";
  return (
    <>
      <svg className="absolute w-0 h-0" aria-hidden="true">
        <defs>
          <filter id="fish-distortion">
            <feTurbulence type="fractalNoise" baseFrequency="0.008" numOctaves="3" seed="17" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="65" xChannelSelector="R" yChannelSelector="G" result="displaced" />
            <feGaussianBlur in="displaced" stdDeviation="1" />
          </filter>
        </defs>
      </svg>
      <div className="fixed top-16 left-64 right-0 bottom-0" style={{ backgroundImage: img, backgroundSize: 'cover', backgroundPosition: 'center', zIndex: 0 }}>
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/70 via-teal-900/60 to-cyan-900/65" />
        <div className="absolute inset-0 bg-black/10" />
      </div>
      {moving && (
        <div className="fixed top-16 left-64 right-0 bottom-0 pointer-events-none" style={{ backgroundImage: img, backgroundSize: 'cover', backgroundPosition: 'center', zIndex: 1, filter: 'url(#fish-distortion)', WebkitMaskImage: `radial-gradient(circle 160px at ${mouse.x}px ${mouse.y}px, black 0%, black 45%, transparent 100%)`, maskImage: `radial-gradient(circle 160px at ${mouse.x}px ${mouse.y}px, black 0%, black 45%, transparent 100%)` }}>
          <div className="absolute inset-0 bg-gradient-to-br from-blue-900/70 via-teal-900/60 to-cyan-900/65" />
        </div>
      )}
    </>
  );
};

// ─── Markdown renderer (preserved from original) ──────────────────────────────

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

const FishingConsultantPage: React.FC = () => {
  const { user } = useAuth();

  // ── Navigation
  const [mode, setMode] = useState<AppMode>('dashboard');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedConsultation, setSelectedConsultation] = useState<Consultation | null>(null);
  const [consultationType, setConsultationType] = useState<ConsultationType | null>(null);

  // ── Data
  const [clients, setClients] = useState<Client[]>([]);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [loadingConsults, setLoadingConsults] = useState(false);

  // ── Add-client form
  const [newName, setNewName] = useState('');
  const [newVillage, setNewVillage] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newActivities, setNewActivities] = useState<ActivityType[]>([]);
  const [newWaterways, setNewWaterways] = useState<string[]>([]);
  const [newNotes, setNewNotes] = useState('');
  const [savingClient, setSavingClient] = useState(false);

  // ── Chat
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [savingConsult, setSavingConsult] = useState(false);
  const [consultSaved, setConsultSaved] = useState(false);
  const [detectedUrgency, setDetectedUrgency] = useState<UrgencyLevel | null>(null);

  // ── Post-chat fields
  const [youthActions, setYouthActions] = useState('');
  const [followUpNeeded, setFollowUpNeeded] = useState(false);
  const [followUpDate, setFollowUpDate] = useState('');
  const [followUpNotes, setFollowUpNotes] = useState('');

  // ── Voice
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceMode, setVoiceMode] = useState<'english' | 'pidgin'>('pidgin');
  const [speechOn, setSpeechOn] = useState(false);
  const [isListening, setIsListening] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);

  // ─── Voice setup ─────────────────────────────────────────────────────────
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

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, isSending]);

  // ─── Load clients ─────────────────────────────────────────────────────────
  const loadClients = useCallback(async () => {
    if (!user) return;
    setLoadingClients(true);
    try {
      const { data, error } = await supabase
        .from('fishing_client_summary')
        .select('*')
        .eq('youth_user_id', user.id)
        .order('client_name');
      if (!error && data) setClients(data as Client[]);
    } finally { setLoadingClients(false); }
  }, [user]);

  useEffect(() => { loadClients(); }, [loadClients]);

  // ─── Load consultations ───────────────────────────────────────────────────
  const loadConsultations = useCallback(async (clientId: string) => {
    setLoadingConsults(true);
    try {
      const { data, error } = await supabase
        .from('fishing_consultations')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });
      if (!error && data) setConsultations(data as Consultation[]);
    } finally { setLoadingConsults(false); }
  }, []);

  // ─── Urgency detection ────────────────────────────────────────────────────
  const extractUrgency = (text: string): UrgencyLevel | null => {
    const lower = text.toLowerCase();
    if (lower.includes('🚨') || lower.includes('urgent')) return 'urgent';
    if (lower.includes('urgency: high') || lower.includes('**high**')) return 'high';
    if (lower.includes('urgency: medium') || lower.includes('**medium**')) return 'medium';
    if (lower.includes('urgency: low') || lower.includes('**low**')) return 'low';
    return null;
  };

  // ─── Send message ─────────────────────────────────────────────────────────
  const sendMessage = useCallback(async () => {
    if (!inputText.trim() || isSending || !selectedClient || !consultationType) return;
    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: inputText.trim(), timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsSending(true);
    try {
      const history = [...messages, userMsg];
      const systemPrompt = buildSystemPrompt(consultationType, selectedClient);
      const apiMessages = history.map(m => ({ role: m.role, content: m.content }));
      const reply = await chatText(systemPrompt, apiMessages);
      const aiMsg: ChatMessage = { id: crypto.randomUUID(), role: 'assistant', content: reply, timestamp: new Date() };
      setMessages(prev => [...prev, aiMsg]);
      speak(reply);
      const urgency = extractUrgency(reply);
      const urgencyOrder: UrgencyLevel[] = ['low', 'medium', 'high', 'urgent'];
      if (urgency && (!detectedUrgency || urgencyOrder.indexOf(urgency) > urgencyOrder.indexOf(detectedUrgency))) {
        setDetectedUrgency(urgency);
      }
    } catch { setMessages(p => [...p, { id: crypto.randomUUID(), role: 'assistant', content: 'Technical issue — please try again.', timestamp: new Date() }]); }
    finally { setIsSending(false); setTimeout(() => inputRef.current?.focus(), 100); }
  }, [inputText, isSending, messages, selectedClient, consultationType, speak, detectedUrgency]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  // ─── Voice input ──────────────────────────────────────────────────────────
  const toggleListening = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    if (isListening) { recognitionRef.current?.stop(); setIsListening(false); return; }
    const rec = new SR(); recognitionRef.current = rec;
    rec.lang = 'en-NG'; rec.continuous = false; rec.interimResults = false;
    rec.onresult = (e: any) => setInputText(p => p ? `${p} ${e.results[0][0].transcript}` : e.results[0][0].transcript);
    rec.onend = () => setIsListening(false); rec.onerror = () => setIsListening(false);
    rec.start(); setIsListening(true);
  };

  // ─── Start consultation ───────────────────────────────────────────────────
  const startConsultation = (client: Client, type: ConsultationType) => {
    setSelectedClient(client);
    setConsultationType(type);
    setMessages([]);
    setInputText('');
    setDetectedUrgency(null);
    setYouthActions('');
    setFollowUpNeeded(false);
    setFollowUpDate('');
    setFollowUpNotes('');
    setConsultSaved(false);
    setMode('new-consultation');
    const ct = CONSULT_TYPES[type];
    const activityList = client.activities.map(a => ACTIVITY_OPTIONS.find(o => o.value === a)?.label ?? a).join(', ') || 'fishing';
    const opener: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: `Ready to assist with **${ct.emoji} ${ct.label}** for **${client.client_name}** (${client.village} · ${activityList}).\n\n${ct.description}.\n\nDescribe what you and ${client.client_name} are experiencing — I will ask the right questions and guide you to a clear recommendation.`,
      timestamp: new Date(),
    };
    setMessages([opener]);
  };

  // ─── Save consultation ────────────────────────────────────────────────────
  const saveConsultation = async () => {
    if (!user || !selectedClient || !consultationType || messages.length < 2) return;
    setSavingConsult(true);
    const lastAI = [...messages].reverse().find(m => m.role === 'assistant');
    const problemSummary = messages.find(m => m.role === 'user')?.content ?? '';
    try {
      const { error } = await supabase
        .from('fishing_consultations')
        .insert({
          youth_user_id: user.id,
          client_id: selectedClient.id,
          consultation_type: consultationType,
          problem_summary: problemSummary,
          ai_advice: lastAI?.content ?? null,
          urgency_level: detectedUrgency,
          youth_actions_taken: youthActions || null,
          conversation_history: messages,
          follow_up_needed: followUpNeeded,
          follow_up_date: followUpDate || null,
          follow_up_notes: followUpNotes || null,
          resolved: false,
        });
      if (!error) { setConsultSaved(true); await loadClients(); }
    } finally { setSavingConsult(false); }
  };

  // ─── Save client ──────────────────────────────────────────────────────────
  const saveClient = async () => {
    if (!user || !newName.trim() || !newVillage) return;
    setSavingClient(true);
    try {
      const { error } = await supabase
        .from('fishing_clients')
        .insert({ youth_user_id: user.id, client_name: newName.trim(), village: newVillage, phone: newPhone || null, activities: newActivities, waterways: newWaterways, notes: newNotes || null });
      if (!error) { await loadClients(); resetAddClient(); setMode('dashboard'); }
    } finally { setSavingClient(false); }
  };

  const resetAddClient = () => { setNewName(''); setNewVillage(''); setNewPhone(''); setNewActivities([]); setNewWaterways([]); setNewNotes(''); };

  const toggleActivity = (a: ActivityType) =>
    setNewActivities(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a]);

  const toggleWaterway = (w: string) =>
    setNewWaterways(prev => prev.includes(w) ? prev.filter(x => x !== w) : [...prev, w]);

  // ─── Helpers ──────────────────────────────────────────────────────────────
  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });

  const urgencyBadge = (level: UrgencyLevel | null) => {
    if (!level) return null;
    const cfg = URGENCY_CONFIG[level];
    return (
      <span className={classNames('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border', cfg.colour, cfg.bg, cfg.border)}>
        {cfg.icon} {cfg.label}
      </span>
    );
  };

  const markResolved = async (consultId: string) => {
    await supabase.from('fishing_consultations').update({ resolved: true }).eq('id', consultId);
    if (selectedClient) loadConsultations(selectedClient.id);
    await loadClients();
  };

  // ════════════════════════════════════════════════════════════════════════════
  // RENDER: DASHBOARD
  // ════════════════════════════════════════════════════════════════════════════

  if (mode === 'dashboard') {
    return (
      <AppLayout>
        <FishingBackground />
        <div className="relative z-10 max-w-2xl mx-auto px-4 py-6">

          <div className="bg-black/40 backdrop-blur-sm rounded-2xl p-5 mb-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-teal-600 flex items-center justify-center text-2xl">🎣</div>
                <div>
                  <h1 className="text-xl font-bold text-white">Fishing Advisor</h1>
                  <p className="text-sm text-cyan-200">Your client casebook · Oloibiri & Niger Delta</p>
                </div>
              </div>
              <button
                onClick={() => { resetAddClient(); setMode('add-client'); }}
                className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-teal-600 text-white rounded-xl font-semibold text-sm hover:opacity-90"
              >
                <Plus size={16}/> Add Client
              </button>
            </div>
          </div>

          {clients.length > 0 && (
            <div className="grid grid-cols-3 gap-3 mb-5">
              {[
                { label: 'Clients', value: clients.length, icon: '🎣' },
                { label: 'Open Cases', value: clients.reduce((s, c) => s + (c.open_cases ?? 0), 0), icon: '📋' },
                { label: 'This Month', value: clients.filter(c => c.last_consultation_at && new Date(c.last_consultation_at) > new Date(Date.now() - 30*24*60*60*1000)).length, icon: '📅' },
              ].map(stat => (
                <div key={stat.label} className="bg-white/90 backdrop-blur-sm rounded-xl p-4 text-center">
                  <div className="text-2xl mb-1">{stat.icon}</div>
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                  <p className="text-xs text-gray-500">{stat.label}</p>
                </div>
              ))}
            </div>
          )}

          {loadingClients ? (
            <div className="flex justify-center py-12"><Loader2 size={28} className="animate-spin text-cyan-300"/></div>
          ) : clients.length === 0 ? (
            <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-10 text-center">
              <div className="text-5xl mb-4">🎣</div>
              <h2 className="text-lg font-bold text-gray-800 mb-2">No clients registered yet</h2>
              <p className="text-sm text-gray-500 mb-5">Add your first fishing client to start building your casebook.</p>
              <button onClick={() => { resetAddClient(); setMode('add-client'); }}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-cyan-600 to-teal-600 text-white rounded-xl font-semibold hover:opacity-90">
                <Plus size={16}/> Register First Client
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {clients.map(client => (
                <button key={client.id}
                  onClick={() => { setSelectedClient(client); loadConsultations(client.id); setMode('client-detail'); }}
                  className="w-full bg-white/90 backdrop-blur-sm rounded-2xl p-4 text-left hover:bg-white transition-colors border border-transparent hover:border-cyan-300">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-100 to-teal-100 flex items-center justify-center text-lg">🎣</div>
                      <div>
                        <p className="font-bold text-gray-900">{client.client_name}</p>
                        <p className="text-sm text-gray-500">{client.village}</p>
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {client.activities.map(a => {
                            const opt = ACTIVITY_OPTIONS.find(o => o.value === a);
                            return opt ? (
                              <span key={a} className="text-xs bg-cyan-100 text-cyan-700 rounded-full px-2 py-0.5">{opt.emoji} {opt.label}</span>
                            ) : null;
                          })}
                        </div>
                        {client.waterways.length > 0 && (
                          <p className="text-xs text-gray-400 mt-1">{client.waterways.join(', ')}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <ChevronRight size={17} className="text-gray-400"/>
                      {(client.open_cases ?? 0) > 0 && (
                        <span className="text-xs bg-orange-100 text-orange-700 rounded-full px-2 py-0.5 font-semibold">{client.open_cases} open</span>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-3 text-xs text-gray-400">
                    <span>{client.total_consultations ?? 0} consultation{client.total_consultations !== 1 ? 's' : ''}</span>
                    {client.last_consultation_at && <span>Last: {formatDate(client.last_consultation_at)}</span>}
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
  // RENDER: ADD CLIENT
  // ════════════════════════════════════════════════════════════════════════════

  if (mode === 'add-client') {
    return (
      <AppLayout>
        <FishingBackground />
        <div className="relative z-10 max-w-2xl mx-auto px-4 py-6">
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-md p-5">
            <div className="flex items-center gap-3 mb-5">
              <button onClick={() => setMode('dashboard')} className="text-gray-400 hover:text-gray-700 p-1"><ArrowLeft size={20}/></button>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Register Client</h2>
                <p className="text-sm text-gray-500">Add to your casebook</p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Client Name *</label>
                <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Papa Charles"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-400 text-base"/>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Village *</label>
                <select value={newVillage} onChange={e => setNewVillage(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-400 text-base bg-white">
                  <option value="">Select village…</option>
                  {VILLAGES.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Phone (optional)</label>
                <input value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder="+234 801 234 5678"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-400 text-base"/>
              </div>

              {/* Activities */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Activities (select all that apply)</label>
                <div className="space-y-2">
                  {ACTIVITY_OPTIONS.map(opt => (
                    <label key={opt.value} className={classNames('flex items-center gap-3 px-3 py-2.5 rounded-xl border cursor-pointer transition-colors',
                      newActivities.includes(opt.value) ? 'bg-cyan-50 border-cyan-400' : 'border-gray-200 hover:border-gray-300')}>
                      <input type="checkbox" checked={newActivities.includes(opt.value)} onChange={() => toggleActivity(opt.value)} className="accent-cyan-600"/>
                      <span className="text-lg">{opt.emoji}</span>
                      <span className="text-sm font-medium text-gray-800">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Waterways */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Waterways used (select all that apply)</label>
                <div className="flex flex-wrap gap-2">
                  {WATERWAY_OPTIONS.map(w => (
                    <button key={w} onClick={() => toggleWaterway(w)}
                      className={classNames('px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors',
                        newWaterways.includes(w) ? 'bg-cyan-600 text-white border-cyan-600' : 'bg-white text-gray-600 border-gray-300 hover:border-cyan-400')}>
                      {w}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Notes (optional)</label>
                <textarea value={newNotes} onChange={e => setNewNotes(e.target.value)} rows={2}
                  placeholder="Past problems, specific concerns, gear owned…"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-400 text-sm resize-none"/>
              </div>

              <button onClick={saveClient} disabled={!newName.trim() || !newVillage || savingClient}
                className={classNames('w-full py-3.5 rounded-xl font-bold text-white text-base transition-opacity',
                  newName.trim() && newVillage && !savingClient ? 'bg-gradient-to-r from-cyan-600 to-teal-600 hover:opacity-90' : 'bg-gray-300 cursor-not-allowed')}>
                {savingClient ? <span className="flex items-center justify-center gap-2"><Loader2 size={16} className="animate-spin"/>Saving…</span> : 'Register Client'}
              </button>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // RENDER: CLIENT DETAIL
  // ════════════════════════════════════════════════════════════════════════════

  if (mode === 'client-detail' && selectedClient) {
    const client = selectedClient;
    return (
      <AppLayout>
        <FishingBackground />
        <div className="relative z-10 max-w-2xl mx-auto px-4 py-6 space-y-4">
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-md p-5">
            <div className="flex items-center gap-3 mb-4">
              <button onClick={() => setMode('dashboard')} className="text-gray-400 hover:text-gray-700 p-1"><ArrowLeft size={20}/></button>
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-100 to-teal-100 flex items-center justify-center text-2xl">🎣</div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-gray-900">{client.client_name}</h2>
                <p className="text-sm text-gray-500">{client.village}{client.phone ? ` · ${client.phone}` : ''}</p>
              </div>
            </div>

            {client.activities.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {client.activities.map(a => {
                  const opt = ACTIVITY_OPTIONS.find(o => o.value === a);
                  return opt ? (
                    <div key={a} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold border bg-cyan-50 border-cyan-300 text-cyan-700">
                      {opt.emoji} {opt.label}
                    </div>
                  ) : null;
                })}
              </div>
            )}

            {client.waterways.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {client.waterways.map(w => (
                  <span key={w} className="text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-2.5 py-1 font-medium">🌊 {w}</span>
                ))}
              </div>
            )}

            {client.notes && <p className="text-sm text-gray-600 italic bg-gray-50 rounded-lg px-3 py-2 mb-4">{client.notes}</p>}

            <p className="text-sm font-bold text-gray-700 mb-3">Start new consultation:</p>
            <div className="grid grid-cols-1 gap-2">
              {(Object.entries(CONSULT_TYPES) as [ConsultationType, typeof CONSULT_TYPES[ConsultationType]][]).map(([key, ct]) => (
                <button key={key} onClick={() => startConsultation(client, key)}
                  className={classNames('flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-white text-sm bg-gradient-to-r hover:opacity-90 transition-opacity text-left', ct.colour)}>
                  <span className="text-xl flex-shrink-0">{ct.emoji}</span>
                  <div>
                    <div>{ct.label}</div>
                    <div className="text-xs font-normal opacity-80">{ct.description}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Case history */}
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-md p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <ClipboardList size={16} className="text-cyan-600"/> Case History
              </h3>
              <button onClick={() => loadConsultations(client.id)} className="text-gray-400 hover:text-gray-700"><RefreshCw size={14}/></button>
            </div>
            {loadingConsults ? (
              <div className="flex justify-center py-6"><Loader2 size={20} className="animate-spin text-cyan-600"/></div>
            ) : consultations.length === 0 ? (
              <p className="text-sm text-gray-400 italic text-center py-4">No consultations yet.</p>
            ) : (
              <div className="space-y-3">
                {consultations.map(c => {
                  const ct = CONSULT_TYPES[c.consultation_type];
                  return (
                    <div key={c.id} onClick={() => { setSelectedConsultation(c); setMode('case-detail'); }}
                      className="border border-gray-200 rounded-xl p-4 hover:border-cyan-300 transition-colors cursor-pointer">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{ct.emoji}</span>
                          <div>
                            <p className="font-semibold text-gray-900 text-sm">{ct.label}</p>
                            <p className="text-xs text-gray-500">{formatDate(c.created_at)}</p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          {c.urgency_level && urgencyBadge(c.urgency_level)}
                          {c.resolved
                            ? <span className="text-xs text-green-600 font-semibold flex items-center gap-1"><CheckCircle size={11}/> Resolved</span>
                            : <span className="text-xs text-orange-600 font-semibold">Open</span>}
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 mt-2 line-clamp-2">{c.problem_summary}</p>
                      {c.follow_up_needed && !c.resolved && c.follow_up_date && (
                        <p className="text-xs text-blue-600 mt-1.5 flex items-center gap-1">
                          <Calendar size={11}/> Follow-up: {formatDate(c.follow_up_date)}
                        </p>
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
  // RENDER: NEW CONSULTATION (AI CHAT)
  // ════════════════════════════════════════════════════════════════════════════

  if (mode === 'new-consultation' && selectedClient && consultationType) {
    const ct = CONSULT_TYPES[consultationType];
    const userTurns = messages.filter(m => m.role === 'user').length;

    return (
      <AppLayout>
        <FishingBackground />
        <div className="relative z-10 max-w-2xl mx-auto px-4 py-6">

          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-md p-4 mb-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <button onClick={() => { window.speechSynthesis.cancel(); setMode('client-detail'); loadConsultations(selectedClient.id); }} className="text-gray-400 hover:text-gray-700 p-1">
                  <ArrowLeft size={20}/>
                </button>
                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${ct.colour} flex items-center justify-center text-2xl`}>{ct.emoji}</div>
                <div>
                  <h2 className="text-base font-bold text-gray-900">{ct.label}</h2>
                  <p className="text-xs text-gray-500">{selectedClient.client_name} · {selectedClient.village}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {detectedUrgency && urgencyBadge(detectedUrgency)}
                <div className="flex rounded-lg overflow-hidden border border-gray-300">
                  {(['pidgin', 'english'] as const).map(m => (
                    <button key={m} onClick={() => setVoiceMode(m)}
                      className={`px-2.5 py-1.5 text-xs font-bold border-r border-gray-300 last:border-0 transition-all ${voiceMode===m?(m==='english'?'bg-blue-600 text-white':'bg-cyan-600 text-white'):'bg-white text-gray-500'}`}>
                      {m==='english'?'🇬🇧':'🇳🇬'}
                    </button>
                  ))}
                </div>
                <button onClick={() => { setSpeechOn(s => !s); if (speechOn) window.speechSynthesis.cancel(); }}
                  className={classNames('p-2 rounded-lg', speechOn ? 'bg-cyan-100 text-cyan-700' : 'bg-gray-100 text-gray-400')}>
                  {speechOn ? <Volume2 size={15}/> : <VolumeX size={15}/>}
                </button>
              </div>
            </div>
          </div>

          {detectedUrgency === 'urgent' && (
            <div className="bg-red-600 text-white rounded-xl p-4 mb-4 flex items-start gap-3 animate-pulse">
              <AlertTriangle size={20} className="flex-shrink-0 mt-0.5"/>
              <div>
                <p className="font-bold">URGENT SITUATION</p>
                <p className="text-sm opacity-90">
                  {consultationType === 'oil-contamination'
                    ? 'Stop eating fish from this area immediately. Follow the AI instructions carefully.'
                    : 'Follow the AI\'s immediate safety instructions without delay.'}
                </p>
              </div>
            </div>
          )}

          <div className="bg-white/80 backdrop-blur-sm rounded-xl px-4 py-2.5 mb-4 flex items-center gap-2">
            <Lightbulb size={14} className="text-cyan-700 flex-shrink-0"/>
            <p className="text-xs text-gray-700">Describe what you and {selectedClient.client_name} are experiencing. The AI will guide you to a clear recommendation.</p>
          </div>

          <div className="bg-white rounded-2xl shadow-lg mb-4 flex flex-col" style={{ height: '460px' }}>
            <div className="flex items-center justify-between px-5 py-3 border-b bg-gray-50 rounded-t-2xl text-xs text-gray-500">
              <span className="font-semibold text-gray-700 flex items-center gap-1.5">🎣 Fishing AI Advisor</span>
              <span>{userTurns} exchange{userTurns !== 1 ? 's' : ''}</span>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {messages.map(msg => (
                <div key={msg.id} className={classNames('flex items-start gap-3', msg.role==='user'?'justify-end':'justify-start')}>
                  {msg.role==='assistant' && (
                    <div className={`flex-shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br ${ct.colour} flex items-center justify-center text-lg`}>{ct.emoji}</div>
                  )}
                  <div className={classNames('max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed',
                    msg.role==='user'?'bg-cyan-600 text-white rounded-tr-sm':'bg-gray-100 text-gray-900 rounded-tl-sm')}>
                    {msg.role==='assistant' && <p className="text-xs font-bold mb-1 opacity-50">AI Advisor</p>}
                    {msg.role==='user' && <p className="text-xs font-bold mb-1 opacity-75">You (Advisor)</p>}
                    <MarkdownText text={msg.content}/>
                  </div>
                  {msg.role==='user' && (
                    <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-cyan-600 flex items-center justify-center">
                      <User size={15} className="text-white"/>
                    </div>
                  )}
                </div>
              ))}
              {isSending && (
                <div className="flex items-start gap-3">
                  <div className={`flex-shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br ${ct.colour} flex items-center justify-center text-lg`}>{ct.emoji}</div>
                  <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3">
                    <div className="flex gap-1.5 items-center h-4">{[0,150,300].map(d=><div key={d} className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{animationDelay:`${d}ms`}}/>)}</div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef}/>
            </div>

            <div className="border-t p-4 rounded-b-2xl">
              <div className="flex items-end gap-2">
                <textarea ref={inputRef} value={inputText} onChange={e=>setInputText(e.target.value)} onKeyDown={handleKeyDown} rows={2}
                  placeholder="Describe what the client is experiencing — catches, pond, contamination, market…"
                  disabled={isSending || consultSaved}
                  className="flex-1 px-4 py-3 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-400 resize-none leading-relaxed disabled:opacity-50"/>
                <div className="flex flex-col gap-2">
                  <button onClick={toggleListening} disabled={consultSaved}
                    className={classNames('p-2.5 rounded-xl transition-all', isListening?'bg-red-500 text-white animate-pulse':'bg-gray-100 text-gray-500 hover:bg-gray-200')}>
                    {isListening?<MicOff size={16}/>:<Mic size={16}/>}
                  </button>
                  <button onClick={sendMessage} disabled={!inputText.trim()||isSending||consultSaved}
                    className={classNames('p-2.5 rounded-xl transition-all',
                      inputText.trim()&&!isSending&&!consultSaved?`bg-gradient-to-br ${ct.colour} text-white hover:opacity-90`:'bg-gray-100 text-gray-400 cursor-not-allowed')}>
                    <Send size={16}/>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {userTurns >= 1 && (
            <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-md p-5 space-y-4">
              <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                <Save size={14} className="text-cyan-600"/> Save Case Record
              </h3>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">What did you advise / do on the ground?</label>
                <textarea value={youthActions} onChange={e => setYouthActions(e.target.value)} rows={2}
                  placeholder="e.g. Advised client to avoid fishing near the pipeline crossing. Referred to NOSDRA."
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-cyan-400"/>
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" id="followup" checked={followUpNeeded} onChange={e => setFollowUpNeeded(e.target.checked)} className="w-4 h-4 accent-cyan-600"/>
                <label htmlFor="followup" className="text-sm font-semibold text-gray-700">Follow-up visit needed</label>
              </div>
              {followUpNeeded && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Follow-up date</label>
                    <input type="date" value={followUpDate} onChange={e => setFollowUpDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400"/>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">What to check</label>
                    <input value={followUpNotes} onChange={e => setFollowUpNotes(e.target.value)} placeholder="e.g. Check pond water quality"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400"/>
                  </div>
                </div>
              )}
              {consultSaved ? (
                <div className="flex items-center gap-2 text-cyan-700 font-semibold text-sm bg-cyan-50 rounded-xl px-4 py-3">
                  <CheckCircle size={16}/> Case saved to {selectedClient.client_name}'s record.
                </div>
              ) : (
                <button onClick={saveConsultation} disabled={savingConsult}
                  className="w-full py-3 rounded-xl font-bold text-white bg-gradient-to-r from-cyan-600 to-teal-600 hover:opacity-90 disabled:opacity-50">
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

  if (mode === 'case-detail' && selectedConsultation && selectedClient) {
    const c = selectedConsultation;
    const ct = CONSULT_TYPES[c.consultation_type];
    return (
      <AppLayout>
        <FishingBackground />
        <div className="relative z-10 max-w-2xl mx-auto px-4 py-6 space-y-4">
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-md p-5">
            <div className="flex items-center gap-3 mb-4">
              <button onClick={() => setMode('client-detail')} className="text-gray-400 hover:text-gray-700 p-1"><ArrowLeft size={20}/></button>
              <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${ct.colour} flex items-center justify-center text-2xl`}>{ct.emoji}</div>
              <div className="flex-1">
                <h2 className="text-base font-bold text-gray-900">{ct.label} — {selectedClient.client_name}</h2>
                <p className="text-xs text-gray-500">{formatDate(c.created_at)}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                {c.urgency_level && urgencyBadge(c.urgency_level)}
                {c.resolved
                  ? <span className="text-xs text-green-600 font-semibold flex items-center gap-1"><CheckCircle size={11}/> Resolved</span>
                  : <span className="text-xs text-orange-600 font-semibold">Open</span>}
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Problem Described</p>
                <p className="text-sm text-gray-800 bg-gray-50 rounded-lg px-3 py-2">{c.problem_summary}</p>
              </div>
              {c.ai_advice && (
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">AI Recommendation</p>
                  <div className="text-sm text-gray-800 bg-gray-50 rounded-lg px-3 py-2"><MarkdownText text={c.ai_advice}/></div>
                </div>
              )}
              {c.youth_actions_taken && (
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Actions Taken</p>
                  <p className="text-sm text-gray-800 bg-cyan-50 rounded-lg px-3 py-2">{c.youth_actions_taken}</p>
                </div>
              )}
              {c.follow_up_needed && (
                <div className="flex items-start gap-2 text-blue-700 bg-blue-50 rounded-lg px-3 py-2">
                  <Calendar size={14} className="mt-0.5 flex-shrink-0"/>
                  <div>
                    <p className="text-sm font-semibold">Follow-up{c.follow_up_date ? `: ${formatDate(c.follow_up_date)}` : ' needed'}</p>
                    {c.follow_up_notes && <p className="text-xs mt-0.5">{c.follow_up_notes}</p>}
                  </div>
                </div>
              )}
              {!c.resolved && (
                <button onClick={async () => { await markResolved(c.id); setSelectedConsultation({...c, resolved: true}); }}
                  className="w-full py-3 rounded-xl font-bold text-white bg-gradient-to-r from-cyan-600 to-teal-600 hover:opacity-90">
                  Mark as Resolved ✓
                </button>
              )}
            </div>
          </div>

          {c.conversation_history?.length > 0 && (
            <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-md p-5">
              <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
                <FileText size={14} className="text-cyan-600"/> Full Consultation Transcript
              </h3>
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {c.conversation_history.map((msg, i) => (
                  <div key={i} className={classNames('flex items-start gap-2', msg.role==='user'?'justify-end':'justify-start')}>
                    {msg.role==='assistant' && (
                      <div className={`flex-shrink-0 w-7 h-7 rounded-lg bg-gradient-to-br ${ct.colour} flex items-center justify-center text-sm`}>{ct.emoji}</div>
                    )}
                    <div className={classNames('max-w-[80%] rounded-xl px-3 py-2 text-xs leading-relaxed',
                      msg.role==='user'?'bg-cyan-600 text-white':'bg-gray-100 text-gray-800')}>
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

export default FishingConsultantPage;