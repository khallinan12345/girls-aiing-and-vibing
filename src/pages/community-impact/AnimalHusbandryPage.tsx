// src/pages/community-impact/AnimalHusbandryPage.tsx
//
// Animal Husbandry Advisory — Community Impact Track
// A professional casebook tool for youth animal-health advisors
// serving rural Nigerian farmers in Oloibiri (Bayelsa) and
// Ibiade (Ogun) communities.
//
// The youth advisor registers farmers, runs AI-assisted livestock
// diagnostic consultations with the farmer present, and maintains
// a case history per farmer — building both livelihood and trust.
//
// DB tables: animal_husbandry_farmers
//            animal_husbandry_consultations
//
// Route: /community-impact/animal-husbandry
// Activity stored as: animal_husbandry_advisor

import React, { useState, useEffect, useRef, useCallback } from 'react';
import AppLayout from '../../components/layout/AppLayout';
import { supabase } from '../../lib/supabaseClient';
import { chatText } from '../../lib/chatClient';
import { useAuth } from '../../hooks/useAuth';
import {
  ArrowLeft, Send, Save, Loader2, Plus, User, FileText,
  AlertTriangle, CheckCircle, Clock, ChevronRight, X,
  Stethoscope, ClipboardList, Users, RefreshCw, Calendar,
  Mic, MicOff, Volume2, VolumeX, Bird, Beef, Rabbit,
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
  | 'dashboard'          // farmer list + open follow-ups
  | 'add-farmer'         // register new farmer
  | 'farmer-detail'      // farmer card + case history
  | 'new-consultation'   // AI triage chat
  | 'case-detail';       // view a saved case

interface AnimalEntry {
  species: 'poultry' | 'goats_sheep' | 'cattle' | 'pigs';
  count: number;
}

interface Farmer {
  id: string;
  youth_user_id: string;
  farmer_name: string;
  village: string;
  phone: string | null;
  animals: AnimalEntry[];
  notes: string | null;
  created_at: string;
  // from view
  total_consultations?: number;
  open_cases?: number;
  emergency_count?: number;
  last_consultation_at?: string | null;
}

interface Consultation {
  id: string;
  farmer_id: string;
  species: 'poultry' | 'goats_sheep' | 'cattle' | 'pigs';
  symptom_summary: string;
  animals_affected: number | null;
  animals_total: number | null;
  ai_diagnosis: string | null;
  urgency_level: 'low' | 'medium' | 'high' | 'emergency' | null;
  farmer_actions_recommended: string | null;
  youth_actions_taken: string | null;
  conversation_history: ChatMessage[];
  follow_up_needed: boolean;
  follow_up_date: string | null;
  follow_up_notes: string | null;
  resolved: boolean;
  resolved_at: string | null;
  created_at: string;
}

type Species = 'poultry' | 'goats_sheep' | 'cattle' | 'pigs';
type UrgencyLevel = 'low' | 'medium' | 'high' | 'emergency';

// ─── Nigeria Livestock Knowledge Base ────────────────────────────────────────
// Injected into every AI system prompt. Derived from the two reference
// documents: Nigeria livestock overview + AI field-triage guide.

const NIGERIA_LIVESTOCK_CONTEXT = `
NIGERIA RURAL LIVESTOCK ADVISORY CONTEXT:

COMMUNITIES SERVED:
- Oloibiri, Ogbia LGA, Bayelsa State (Niger Delta)
- Ibiade, Ogun State
- Smallholder farmers; most households depend directly on animal income
- Veterinary services are costly and often far away — this advisory fills that gap

COMMON ANIMALS AND WHY THEY MATTER:
- Poultry (chickens especially): fastest turnover, eggs + meat, women/youth participation, low entry cost but very disease-sensitive
- Goats/Sheep: hardy, low feed cost, high market demand, savings asset; goats most common backyard animal
- Cattle: wealth + status + traction, more capital-intensive; important in some Ogun farming systems
- Pigs: fast growth, good feed conversion; regional variation (less common in Muslim areas)

NIGERIA-PRIORITY DISEASES BY SPECIES:
POULTRY: Newcastle disease (most feared, rapid mortality), Gumboro/IBD (young birds, immune suppression), Coccidiosis (bloody droppings, wet litter), Fowl pox (scabs on comb/wattle), Fowl typhoid, Avian influenza (emergency/report)
GOATS & SHEEP: PPR - Peste des Petits Ruminants (most feared; highly contagious; emergency), Internal parasites/worms (most common chronic problem), Coccidiosis in kids/lambs, Pneumonia, Mange, Foot rot
CATTLE: CBPP - Contagious Bovine Pleuropneumonia (respiratory emergency), Foot-and-mouth disease (mouth + feet blisters; report), Trypanosomiasis (tsetse areas; chronic weight loss/anemia), Tick-borne diseases, Mastitis, Dry-season nutrition deficit
PIGS: African Swine Fever (catastrophic; no cure; emergency/report), Respiratory disease, Piglet scours, Mange, Feed/mycotoxin poisoning

INCOME IMPACT — WHY THIS MATTERS:
- Disease and mortality: single biggest income killer; one Newcastle outbreak can wipe an entire flock
- Poor feed/seasonal gaps: slow growth, low milk/egg yield, poor fertility
- Limited vet access: farmers recognize disease but lack timely support or affordable drugs
- Housing/biosecurity failures: disease spreads unchecked in backyard systems
- Market constraints: even surviving animals may sell at poor prices without advisor support

HIGHEST-IMPACT INTERVENTIONS (practical, low-cost):
1. Vaccination: prevents catastrophic losses (Newcastle, PPR, Gumboro)
2. Deworming: improves growth, fertility, survival; often neglected
3. Clean water: simple but critical for all species
4. Improved housing: dry, ventilated, predator-protected
5. Quarantine new animals: biggest biosecurity error is mixing new/existing stock immediately
6. Isolate sick animals: prevents outbreak spread
7. Better dry-season feeding: crop residues, mineral blocks, legume fodder
8. Record keeping: which animals are profitable, vaccination dates, costs

TRIAGE LOGIC — URGENCY LEVELS:
LOW: One animal, mild signs, still eating/drinking → monitor, isolate, improve feed/water/housing
MEDIUM: Several animals sick, no deaths, moderate signs → isolate, clean, check vaccination/deworming, contact animal-health worker
HIGH: Deaths, rapid spread, bloody diarrhea, severe weakness → urgent veterinary contact
EMERGENCY: Sudden multiple deaths, suspected ASF/HPAI/FMD/PPR/CBPP/anthrax → STOP all animal movement, isolate, report to authority immediately

ABSOLUTE GUARDRAILS (always enforce):
- Do NOT sell or move sick animals
- Isolate sick animals immediately
- Do NOT mix newly purchased animals with existing herd — quarantine first
- Do NOT give random antibiotics or human medicines
- Do NOT open carcasses after sudden unexplained deaths
- Vaccination prevents disease; vaccines do not cure already sick animals
- Fix water, feed, housing, and hygiene BEFORE assuming every problem needs medicine
- Call a trained animal-health worker when disease spreads, deaths occur, or signs are severe

TALKING WITH FARMERS:
- Use simple, plain language — no jargon
- Connect advice to what the farmer already has available
- Always give at least one free or low-cost action the farmer can take today
- Acknowledge the real financial pain of losing animals — it is a livelihood crisis
- Be honest: if a situation is an emergency, say so clearly and urgently
`;

// ─── Species config ───────────────────────────────────────────────────────────

const SPECIES_CONFIG: Record<Species, {
  label: string;
  emoji: string;
  colour: string;
  bgLight: string;
  border: string;
  textColour: string;
}> = {
  poultry:    { label: 'Poultry',      emoji: '🐔', colour: 'from-amber-500 to-orange-500',   bgLight: 'bg-amber-50',  border: 'border-amber-300',  textColour: 'text-amber-700' },
  goats_sheep:{ label: 'Goats/Sheep',  emoji: '🐐', colour: 'from-green-600 to-teal-600',    bgLight: 'bg-green-50',  border: 'border-green-300',  textColour: 'text-green-700' },
  cattle:     { label: 'Cattle',       emoji: '🐄', colour: 'from-brown-600 to-amber-700',   bgLight: 'bg-orange-50', border: 'border-orange-300', textColour: 'text-orange-700'},
  pigs:       { label: 'Pigs',         emoji: '🐖', colour: 'from-pink-500 to-rose-500',     bgLight: 'bg-pink-50',   border: 'border-pink-300',   textColour: 'text-pink-700'  },
};

const URGENCY_CONFIG: Record<UrgencyLevel, {
  label: string;
  colour: string;
  bg: string;
  border: string;
  icon: React.ReactNode;
}> = {
  low:       { label: 'Low',       colour: 'text-green-700',  bg: 'bg-green-50',   border: 'border-green-300',  icon: <CheckCircle size={14}/> },
  medium:    { label: 'Medium',    colour: 'text-yellow-700', bg: 'bg-yellow-50',  border: 'border-yellow-300', icon: <Clock size={14}/> },
  high:      { label: 'High',      colour: 'text-orange-700', bg: 'bg-orange-50',  border: 'border-orange-300', icon: <AlertTriangle size={14}/> },
  emergency: { label: 'EMERGENCY', colour: 'text-red-700',    bg: 'bg-red-50',     border: 'border-red-400',    icon: <AlertTriangle size={14}/> },
};

const VILLAGES = ['Oloibiri', 'Ibiade', 'Nembe', 'Brass', 'Yenagoa', 'Other'];
const SPECIES_OPTIONS: { value: Species; label: string; emoji: string }[] = [
  { value: 'poultry',     label: 'Poultry (chickens, ducks, guinea fowl)', emoji: '🐔' },
  { value: 'goats_sheep', label: 'Goats / Sheep',                          emoji: '🐐' },
  { value: 'cattle',      label: 'Cattle',                                 emoji: '🐄' },
  { value: 'pigs',        label: 'Pigs',                                   emoji: '🐖' },
];

// ─── Markdown renderer (reuse platform pattern) ───────────────────────────────
const MarkdownText: React.FC<{ text: string }> = ({ text }) => {
  const lines = text.split('\n');
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        if (line.startsWith('### ')) return <p key={i} className="font-bold text-base mt-2">{line.slice(4)}</p>;
        if (line.startsWith('## '))  return <p key={i} className="font-bold text-lg mt-2">{line.slice(3)}</p>;
        if (line.startsWith('# '))   return <p key={i} className="font-bold text-xl mt-2">{line.slice(2)}</p>;
        if (line.startsWith('- ') || line.startsWith('• ')) {
          return <p key={i} className="pl-3 before:content-['•'] before:mr-2 before:text-current">{line.slice(2)}</p>;
        }
        if (line.startsWith('**') && line.endsWith('**')) {
          return <p key={i} className="font-bold">{line.slice(2, -2)}</p>;
        }
        if (line.trim() === '') return <div key={i} className="h-1" />;
        // inline bold
        const parts = line.split(/(\*\*[^*]+\*\*)/g);
        return (
          <p key={i}>
            {parts.map((p, j) =>
              p.startsWith('**') && p.endsWith('**')
                ? <strong key={j}>{p.slice(2, -2)}</strong>
                : p
            )}
          </p>
        );
      })}
    </div>
  );
};

// ─── Build system prompt for the AI triage assistant ─────────────────────────
function buildSystemPrompt(species: Species, farmer: Farmer): string {
  const sc = SPECIES_CONFIG[species];
  const animalCount = farmer.animals.find(a => a.species === species)?.count ?? 'unknown';

  return `You are an expert animal health advisor assisting a trained youth agricultural advisor in rural Nigeria. The youth advisor is conducting a livestock health consultation with a farmer, using you as a diagnostic support tool.

${NIGERIA_LIVESTOCK_CONTEXT}

CURRENT CONSULTATION:
- Farmer: ${farmer.farmer_name}, ${farmer.village}
- Animal type: ${sc.label} (${sc.emoji})
- Farmer's ${sc.label.toLowerCase()} count: ${animalCount}

YOUR ROLE IN THIS CONSULTATION:
You are the AI diagnostic engine behind the youth advisor. The youth types observations from the farmer to you. You respond with:
1. Clarifying questions (follow the triage intake flow — ask one or two focused questions at a time)
2. Probable diagnoses with confidence level and distinguishing clues
3. Urgency classification: LOW / MEDIUM / HIGH / EMERGENCY
4. Specific farmer actions (what the farmer can do today, including free actions)
5. When to call a vet or report to authorities

CONSULTATION FLOW:
Step 1 — Establish outbreak scale: how many animals affected vs. total; how many deaths; when did it start
Step 2 — Main symptom cluster: ask the youth to describe what they and the farmer can observe
Step 3 — Species-specific diagnostic questions (follow the ${sc.label} checklist)
Step 4 — Probable diagnosis + urgency + farmer action plan

FORMAT YOUR RESPONSES CLEARLY:
- Use short paragraphs and bullet points
- When you give a diagnosis, always label urgency explicitly: "**Urgency: HIGH**"
- Always end with at least one action the farmer can take TODAY at zero cost
- If emergency signs are present, lead with "🚨 EMERGENCY:" and state clearly what must happen immediately

Remember: the farmer is present. The advice must be practical, local, and actionable. Never prescribe specific drug doses — recommend the farmer seek a trained animal-health worker for medication decisions.`;
}

// ─── Component ────────────────────────────────────────────────────────────────

const AnimalHusbandryPage: React.FC = () => {
  const { user } = useAuth();

  // ── Navigation state
  const [mode, setMode] = useState<AppMode>('dashboard');
  const [selectedFarmer, setSelectedFarmer] = useState<Farmer | null>(null);
  const [selectedConsultation, setSelectedConsultation] = useState<Consultation | null>(null);
  const [consultationSpecies, setConsultationSpecies] = useState<Species | null>(null);

  // ── Data
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [loadingFarmers, setLoadingFarmers] = useState(true);
  const [loadingConsults, setLoadingConsults] = useState(false);

  // ── Add-farmer form
  const [newFarmerName, setNewFarmerName] = useState('');
  const [newFarmerVillage, setNewFarmerVillage] = useState('');
  const [newFarmerPhone, setNewFarmerPhone] = useState('');
  const [newFarmerAnimals, setNewFarmerAnimals] = useState<AnimalEntry[]>([]);
  const [newFarmerNotes, setNewFarmerNotes] = useState('');
  const [savingFarmer, setSavingFarmer] = useState(false);

  // ── Consultation chat
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [savingConsult, setSavingConsult] = useState(false);
  const [consultSaved, setConsultSaved] = useState(false);

  // ── Post-chat fields
  const [youthActionsTaken, setYouthActionsTaken] = useState('');
  const [followUpNeeded, setFollowUpNeeded] = useState(false);
  const [followUpDate, setFollowUpDate] = useState('');
  const [followUpNotes, setFollowUpNotes] = useState('');
  const [detectedUrgency, setDetectedUrgency] = useState<UrgencyLevel | null>(null);

  // ── Voice
  const [isListening, setIsListening] = useState(false);
  const [speechOn, setSpeechOn] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // ─── Load farmers ────────────────────────────────────────────────────────────
  const loadFarmers = useCallback(async () => {
    if (!user) return;
    setLoadingFarmers(true);
    try {
      const { data, error } = await supabase
        .from('animal_husbandry_farmer_summary')
        .select('*')
        .eq('youth_user_id', user.id)
        .order('farmer_name');
      if (!error && data) setFarmers(data as Farmer[]);
    } finally {
      setLoadingFarmers(false);
    }
  }, [user]);

  useEffect(() => { loadFarmers(); }, [loadFarmers]);

  // ─── Load consultations for selected farmer ───────────────────────────────
  const loadConsultations = useCallback(async (farmerId: string) => {
    setLoadingConsults(true);
    try {
      const { data, error } = await supabase
        .from('animal_husbandry_consultations')
        .select('*')
        .eq('farmer_id', farmerId)
        .order('created_at', { ascending: false });
      if (!error && data) setConsultations(data as Consultation[]);
    } finally {
      setLoadingConsults(false);
    }
  }, []);

  // ─── Scroll chat ──────────────────────────────────────────────────────────
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  // ─── Speech synthesis ────────────────────────────────────────────────────
  const speak = useCallback((text: string) => {
    if (!speechOn) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text.slice(0, 300));
    utt.rate = 0.9;
    window.speechSynthesis.speak(utt);
  }, [speechOn]);

  // ─── Voice input ──────────────────────────────────────────────────────────
  const toggleListening = useCallback(() => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = 'en-NG';
    rec.onresult = (e: SpeechRecognitionEvent) => {
      setInputText(prev => prev + ' ' + e.results[0][0].transcript);
      setIsListening(false);
    };
    rec.onerror = () => setIsListening(false);
    rec.onend = () => setIsListening(false);
    recognitionRef.current = rec;
    rec.start();
    setIsListening(true);
  }, [isListening]);

  // ─── Extract urgency from AI response ────────────────────────────────────
  const extractUrgency = (text: string): UrgencyLevel | null => {
    const lower = text.toLowerCase();
    if (lower.includes('emergency') || lower.includes('🚨')) return 'emergency';
    if (lower.includes('urgency: high') || lower.includes('urgency:**  high') || lower.includes('**high**')) return 'high';
    if (lower.includes('urgency: medium') || lower.includes('**medium**')) return 'medium';
    if (lower.includes('urgency: low') || lower.includes('**low**')) return 'low';
    return null;
  };

  // ─── Send message ─────────────────────────────────────────────────────────
  const sendMessage = useCallback(async () => {
    if (!inputText.trim() || isSending || !selectedFarmer || !consultationSpecies) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: inputText.trim(),
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsSending(true);

    try {
      const history = [...messages, userMsg];
      const systemPrompt = buildSystemPrompt(consultationSpecies, selectedFarmer);
      const apiMessages = history.map(m => ({ role: m.role, content: m.content }));

      const reply = await chatText({ page: 'AnimalHusbandryPage', messages: apiMessages, system: systemPrompt, max_tokens: 800 });

      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: reply,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMsg]);
      speak(reply);

      // Detect urgency
      const urgency = extractUrgency(reply);
      if (urgency && (
        !detectedUrgency ||
        ['low','medium','high','emergency'].indexOf(urgency) >
        ['low','medium','high','emergency'].indexOf(detectedUrgency)
      )) {
        setDetectedUrgency(urgency);
      }
    } catch (err) {
      console.error('Chat error:', err);
    } finally {
      setIsSending(false);
      inputRef.current?.focus();
    }
  }, [inputText, isSending, messages, selectedFarmer, consultationSpecies, speak, detectedUrgency]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // ─── Start consultation ───────────────────────────────────────────────────
  const startConsultation = (farmer: Farmer, species: Species) => {
    setSelectedFarmer(farmer);
    setConsultationSpecies(species);
    setMessages([]);
    setInputText('');
    setDetectedUrgency(null);
    setYouthActionsTaken('');
    setFollowUpNeeded(false);
    setFollowUpDate('');
    setFollowUpNotes('');
    setConsultSaved(false);
    setMode('new-consultation');

    // Opening message from AI
    const sc = SPECIES_CONFIG[species];
    const count = farmer.animals.find(a => a.species === species)?.count;
    const opener: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: `Ready to assist with ${sc.emoji} **${sc.label}** for **${farmer.farmer_name}** (${farmer.village}${count ? ` · ${count} ${sc.label.toLowerCase()}` : ''}).\n\nLet's start with the basics:\n\n- **How many animals are sick?**\n- **How many have died, if any?**\n- **When did you first notice something was wrong?**\n\nDescribe what you and the farmer are observing — I will guide you through the triage from there.`,
      timestamp: new Date(),
    };
    setMessages([opener]);
  };

  // ─── Save consultation ────────────────────────────────────────────────────
  const saveConsultation = async () => {
    if (!user || !selectedFarmer || !consultationSpecies || messages.length < 2) return;
    setSavingConsult(true);

    // Extract AI diagnosis (last assistant message)
    const lastAI = [...messages].reverse().find(m => m.role === 'assistant');
    const symptomSummary = messages.find(m => m.role === 'user')?.content ?? '';

    // Extract farmer_actions from AI (look for bullet action blocks)
    const actionsText = lastAI?.content ?? null;

    try {
      const { error } = await supabase
        .from('animal_husbandry_consultations')
        .insert({
          youth_user_id: user.id,
          farmer_id: selectedFarmer.id,
          species: consultationSpecies,
          symptom_summary: symptomSummary,
          ai_diagnosis: lastAI?.content ?? null,
          urgency_level: detectedUrgency,
          farmer_actions_recommended: actionsText,
          youth_actions_taken: youthActionsTaken || null,
          conversation_history: messages,
          follow_up_needed: followUpNeeded,
          follow_up_date: followUpDate || null,
          follow_up_notes: followUpNotes || null,
          resolved: false,
        });

      if (!error) {
        setConsultSaved(true);
        await loadFarmers(); // refresh dashboard counts
      }
    } finally {
      setSavingConsult(false);
    }
  };

  // ─── Save farmer ──────────────────────────────────────────────────────────
  const saveFarmer = async () => {
    if (!user || !newFarmerName.trim() || !newFarmerVillage) return;
    setSavingFarmer(true);
    try {
      const { error } = await supabase
        .from('animal_husbandry_farmers')
        .insert({
          youth_user_id: user.id,
          farmer_name: newFarmerName.trim(),
          village: newFarmerVillage,
          phone: newFarmerPhone || null,
          animals: newFarmerAnimals,
          notes: newFarmerNotes || null,
        });
      if (!error) {
        await loadFarmers();
        resetAddFarmer();
        setMode('dashboard');
      }
    } finally {
      setSavingFarmer(false);
    }
  };

  const resetAddFarmer = () => {
    setNewFarmerName('');
    setNewFarmerVillage('');
    setNewFarmerPhone('');
    setNewFarmerAnimals([]);
    setNewFarmerNotes('');
  };

  const addAnimalEntry = () => {
    // Add first species not yet in list
    const used = new Set(newFarmerAnimals.map(a => a.species));
    const next = SPECIES_OPTIONS.find(s => !used.has(s.value));
    if (next) setNewFarmerAnimals(prev => [...prev, { species: next.value, count: 0 }]);
  };

  const updateAnimalEntry = (idx: number, field: 'species' | 'count', value: string | number) => {
    setNewFarmerAnimals(prev => prev.map((a, i) =>
      i === idx ? { ...a, [field]: field === 'count' ? Number(value) : value } : a
    ));
  };

  const removeAnimalEntry = (idx: number) => {
    setNewFarmerAnimals(prev => prev.filter((_, i) => i !== idx));
  };

  // ─── Mark resolved ────────────────────────────────────────────────────────
  const markResolved = async (consultId: string) => {
    await supabase
      .from('animal_husbandry_consultations')
      .update({ resolved: true })
      .eq('id', consultId);
    if (selectedFarmer) loadConsultations(selectedFarmer.id);
    await loadFarmers();
  };

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

  // ════════════════════════════════════════════════════════════════════════════
  // RENDER: DASHBOARD
  // ════════════════════════════════════════════════════════════════════════════

  if (mode === 'dashboard') {
    return (
      <AppLayout>
        <div className="max-w-2xl mx-auto px-4 py-6">
          {/* Header */}
          <div className="bg-white rounded-2xl shadow-md p-5 mb-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-600 to-teal-600 flex items-center justify-center text-2xl">🐾</div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">Animal Health Advisor</h1>
                  <p className="text-sm text-gray-500">Your farmer casebook · Nigeria</p>
                </div>
              </div>
              <button
                onClick={() => { resetAddFarmer(); setMode('add-farmer'); }}
                className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-green-600 to-teal-600 text-white rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity"
              >
                <Plus size={16} /> Add Farmer
              </button>
            </div>
          </div>

          {/* Summary strip */}
          {farmers.length > 0 && (
            <div className="grid grid-cols-3 gap-3 mb-5">
              {[
                { label: 'Farmers', value: farmers.length, icon: <Users size={18} className="text-green-600" /> },
                { label: 'Open Cases', value: farmers.reduce((s, f) => s + (f.open_cases ?? 0), 0), icon: <FileText size={18} className="text-orange-500" /> },
                { label: 'Emergencies', value: farmers.reduce((s, f) => s + (f.emergency_count ?? 0), 0), icon: <AlertTriangle size={18} className="text-red-600" /> },
              ].map(stat => (
                <div key={stat.label} className="bg-white rounded-xl shadow-sm p-4 text-center">
                  <div className="flex justify-center mb-1">{stat.icon}</div>
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                  <p className="text-xs text-gray-500">{stat.label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Farmer list */}
          {loadingFarmers ? (
            <div className="flex justify-center py-12">
              <Loader2 size={28} className="animate-spin text-green-600" />
            </div>
          ) : farmers.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm p-10 text-center">
              <div className="text-5xl mb-4">🐾</div>
              <h2 className="text-lg font-bold text-gray-800 mb-2">No farmers registered yet</h2>
              <p className="text-sm text-gray-500 mb-5">Add your first farmer to start building your casebook.</p>
              <button
                onClick={() => { resetAddFarmer(); setMode('add-farmer'); }}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-green-600 to-teal-600 text-white rounded-xl font-semibold hover:opacity-90"
              >
                <Plus size={16} /> Register First Farmer
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {farmers.map(farmer => (
                <button
                  key={farmer.id}
                  onClick={() => {
                    setSelectedFarmer(farmer);
                    loadConsultations(farmer.id);
                    setMode('farmer-detail');
                  }}
                  className="w-full bg-white rounded-2xl shadow-sm p-4 text-left hover:shadow-md transition-shadow border border-transparent hover:border-green-200"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-100 to-teal-100 flex items-center justify-center text-lg">👨🏿‍🌾</div>
                      <div>
                        <p className="font-bold text-gray-900">{farmer.farmer_name}</p>
                        <p className="text-sm text-gray-500">{farmer.village}</p>
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {(farmer.animals as AnimalEntry[]).map(a => (
                            <span key={a.species} className="text-xs bg-gray-100 rounded-full px-2 py-0.5 text-gray-600">
                              {SPECIES_CONFIG[a.species]?.emoji} {a.count} {SPECIES_CONFIG[a.species]?.label}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <ChevronRight size={18} className="text-gray-400" />
                      {(farmer.open_cases ?? 0) > 0 && (
                        <span className="text-xs bg-orange-100 text-orange-700 rounded-full px-2 py-0.5 font-semibold">
                          {farmer.open_cases} open
                        </span>
                      )}
                      {(farmer.emergency_count ?? 0) > 0 && (
                        <span className="text-xs bg-red-100 text-red-700 rounded-full px-2 py-0.5 font-bold">
                          ⚠️ Emergency
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-3 text-xs text-gray-400">
                    <span>{farmer.total_consultations ?? 0} consultation{farmer.total_consultations !== 1 ? 's' : ''}</span>
                    {farmer.last_consultation_at && (
                      <span>Last: {formatDate(farmer.last_consultation_at)}</span>
                    )}
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
        <div className="max-w-2xl mx-auto px-4 py-6">
          <div className="bg-white rounded-2xl shadow-md p-5 mb-4">
            <div className="flex items-center gap-3 mb-5">
              <button onClick={() => setMode('dashboard')} className="text-gray-400 hover:text-gray-700 p-1">
                <ArrowLeft size={20} />
              </button>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Register Farmer</h2>
                <p className="text-sm text-gray-500">Add to your casebook</p>
              </div>
            </div>

            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Farmer Name *</label>
                <input
                  value={newFarmerName}
                  onChange={e => setNewFarmerName(e.target.value)}
                  placeholder="e.g. Mama Bello"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-400 text-base"
                />
              </div>

              {/* Village */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Village *</label>
                <select
                  value={newFarmerVillage}
                  onChange={e => setNewFarmerVillage(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-400 text-base bg-white"
                >
                  <option value="">Select village…</option>
                  {VILLAGES.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Phone (optional)</label>
                <input
                  value={newFarmerPhone}
                  onChange={e => setNewFarmerPhone(e.target.value)}
                  placeholder="+234 801 234 5678"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-400 text-base"
                />
              </div>

              {/* Animals */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-semibold text-gray-700">Animals</label>
                  <button
                    onClick={addAnimalEntry}
                    disabled={newFarmerAnimals.length >= 4}
                    className="text-xs text-green-700 font-semibold hover:underline disabled:opacity-40"
                  >
                    + Add species
                  </button>
                </div>
                {newFarmerAnimals.length === 0 && (
                  <p className="text-sm text-gray-400 italic">No animals added yet.</p>
                )}
                <div className="space-y-2">
                  {newFarmerAnimals.map((a, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <select
                        value={a.species}
                        onChange={e => updateAnimalEntry(idx, 'species', e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-400"
                      >
                        {SPECIES_OPTIONS.map(s => (
                          <option key={s.value} value={s.value}>{s.emoji} {s.label}</option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min="0"
                        value={a.count}
                        onChange={e => updateAnimalEntry(idx, 'count', e.target.value)}
                        className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-green-400"
                        placeholder="0"
                      />
                      <button onClick={() => removeAnimalEntry(idx)} className="text-gray-400 hover:text-red-500 p-1">
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Notes (optional)</label>
                <textarea
                  value={newFarmerNotes}
                  onChange={e => setNewFarmerNotes(e.target.value)}
                  rows={2}
                  placeholder="Any relevant background — past diseases, special concerns…"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-400 text-sm resize-none"
                />
              </div>

              <button
                onClick={saveFarmer}
                disabled={!newFarmerName.trim() || !newFarmerVillage || savingFarmer}
                className={classNames(
                  'w-full py-3.5 rounded-xl font-bold text-white text-base transition-opacity',
                  newFarmerName.trim() && newFarmerVillage && !savingFarmer
                    ? 'bg-gradient-to-r from-green-600 to-teal-600 hover:opacity-90'
                    : 'bg-gray-300 cursor-not-allowed'
                )}
              >
                {savingFarmer
                  ? <span className="flex items-center justify-center gap-2"><Loader2 size={16} className="animate-spin" /> Saving…</span>
                  : 'Register Farmer'}
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
        <div className="max-w-2xl mx-auto px-4 py-6">
          {/* Farmer card */}
          <div className="bg-white rounded-2xl shadow-md p-5 mb-4">
            <div className="flex items-center gap-3 mb-4">
              <button onClick={() => setMode('dashboard')} className="text-gray-400 hover:text-gray-700 p-1">
                <ArrowLeft size={20} />
              </button>
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-100 to-teal-100 flex items-center justify-center text-2xl">👨🏿‍🌾</div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-gray-900">{farmer.farmer_name}</h2>
                <p className="text-sm text-gray-500">{farmer.village}{farmer.phone ? ` · ${farmer.phone}` : ''}</p>
              </div>
            </div>

            {/* Herd */}
            {(farmer.animals as AnimalEntry[]).length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {(farmer.animals as AnimalEntry[]).map(a => {
                  const cfg = SPECIES_CONFIG[a.species];
                  return (
                    <div key={a.species} className={classNames('flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold border', cfg.bgLight, cfg.border, cfg.textColour)}>
                      {cfg.emoji} {a.count} {cfg.label}
                    </div>
                  );
                })}
              </div>
            )}

            {farmer.notes && (
              <p className="text-sm text-gray-600 italic bg-gray-50 rounded-lg px-3 py-2 mb-4">{farmer.notes}</p>
            )}

            {/* Start consultation */}
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">Start new consultation for:</p>
              <div className="grid grid-cols-2 gap-2">
                {(farmer.animals as AnimalEntry[]).length > 0
                  ? (farmer.animals as AnimalEntry[]).map(a => {
                      const cfg = SPECIES_CONFIG[a.species];
                      return (
                        <button
                          key={a.species}
                          onClick={() => startConsultation(farmer, a.species)}
                          className={classNames('flex items-center gap-2 px-4 py-3 rounded-xl font-semibold text-white text-sm bg-gradient-to-r hover:opacity-90 transition-opacity', cfg.colour)}
                        >
                          <span className="text-lg">{cfg.emoji}</span> {cfg.label}
                        </button>
                      );
                    })
                  : SPECIES_OPTIONS.map(s => {
                      const cfg = SPECIES_CONFIG[s.value];
                      return (
                        <button
                          key={s.value}
                          onClick={() => startConsultation(farmer, s.value)}
                          className={classNames('flex items-center gap-2 px-4 py-3 rounded-xl font-semibold text-white text-sm bg-gradient-to-r hover:opacity-90 transition-opacity', cfg.colour)}
                        >
                          <span className="text-lg">{cfg.emoji}</span> {cfg.label}
                        </button>
                      );
                    })
                }
              </div>
            </div>
          </div>

          {/* Case history */}
          <div className="bg-white rounded-2xl shadow-md p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <ClipboardList size={17} className="text-green-600" /> Case History
              </h3>
              <button onClick={() => loadConsultations(farmer.id)} className="text-gray-400 hover:text-gray-700">
                <RefreshCw size={15} />
              </button>
            </div>

            {loadingConsults ? (
              <div className="flex justify-center py-6"><Loader2 size={22} className="animate-spin text-green-600" /></div>
            ) : consultations.length === 0 ? (
              <p className="text-sm text-gray-400 italic text-center py-4">No consultations yet.</p>
            ) : (
              <div className="space-y-3">
                {consultations.map(c => {
                  const sc = SPECIES_CONFIG[c.species];
                  return (
                    <div
                      key={c.id}
                      className="border border-gray-200 rounded-xl p-4 hover:border-green-300 transition-colors cursor-pointer"
                      onClick={() => { setSelectedConsultation(c); setMode('case-detail'); }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{sc.emoji}</span>
                          <div>
                            <p className="font-semibold text-gray-900 text-sm">{sc.label}</p>
                            <p className="text-xs text-gray-500">{formatDate(c.created_at)}</p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          {c.urgency_level && urgencyBadge(c.urgency_level)}
                          {c.resolved
                            ? <span className="text-xs text-green-600 font-semibold flex items-center gap-1"><CheckCircle size={11} /> Resolved</span>
                            : <span className="text-xs text-orange-600 font-semibold">Open</span>}
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 mt-2 line-clamp-2">{c.symptom_summary}</p>
                      {c.follow_up_needed && !c.resolved && c.follow_up_date && (
                        <p className="text-xs text-blue-600 mt-1.5 flex items-center gap-1">
                          <Calendar size={11} /> Follow-up: {formatDate(c.follow_up_date)}
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

  if (mode === 'new-consultation' && selectedFarmer && consultationSpecies) {
    const sc = SPECIES_CONFIG[consultationSpecies];
    const userTurns = messages.filter(m => m.role === 'user').length;

    return (
      <AppLayout>
        <div className="max-w-2xl mx-auto px-4 py-6">
          {/* Header */}
          <div className="bg-white rounded-2xl shadow-md p-4 mb-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    window.speechSynthesis.cancel();
                    setMode('farmer-detail');
                    loadConsultations(selectedFarmer.id);
                  }}
                  className="text-gray-400 hover:text-gray-700 p-1"
                >
                  <ArrowLeft size={20} />
                </button>
                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${sc.colour} flex items-center justify-center text-2xl`}>{sc.emoji}</div>
                <div>
                  <h2 className="text-base font-bold text-gray-900">{sc.label} Consultation</h2>
                  <p className="text-xs text-gray-500">{selectedFarmer.farmer_name} · {selectedFarmer.village}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {detectedUrgency && urgencyBadge(detectedUrgency)}
                <button
                  onClick={() => { setSpeechOn(s => !s); if (speechOn) window.speechSynthesis.cancel(); }}
                  className={classNames('p-2 rounded-lg', speechOn ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400')}
                >
                  {speechOn ? <Volume2 size={15}/> : <VolumeX size={15}/>}
                </button>
              </div>
            </div>
          </div>

          {/* Emergency banner */}
          {detectedUrgency === 'emergency' && (
            <div className="bg-red-600 text-white rounded-xl p-4 mb-4 flex items-start gap-3 animate-pulse">
              <AlertTriangle size={22} className="flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-base">EMERGENCY SITUATION DETECTED</p>
                <p className="text-sm opacity-90">Stop all animal movement. Isolate sick animals. Contact a veterinary authority immediately. Do not sell or slaughter sick animals.</p>
              </div>
            </div>
          )}

          {/* Chat */}
          <div className="bg-white rounded-2xl shadow-md mb-4 flex flex-col" style={{ height: '460px' }}>
            <div className="flex items-center justify-between px-5 py-3 border-b bg-gray-50 rounded-t-2xl text-xs text-gray-500">
              <span className="font-semibold text-gray-700 flex items-center gap-1.5">
                <Stethoscope size={13} /> AI Triage Assistant
              </span>
              <span>{userTurns} exchange{userTurns !== 1 ? 's' : ''}</span>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {messages.map(msg => (
                <div key={msg.id} className={classNames('flex items-start gap-3', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                  {msg.role === 'assistant' && (
                    <div className={`flex-shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br ${sc.colour} flex items-center justify-center text-lg`}>{sc.emoji}</div>
                  )}
                  <div className={classNames(
                    'max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed',
                    msg.role === 'user'
                      ? 'bg-green-600 text-white rounded-tr-sm'
                      : 'bg-gray-100 text-gray-900 rounded-tl-sm'
                  )}>
                    {msg.role === 'assistant' && <p className="text-xs font-bold mb-1 opacity-50">AI Advisor</p>}
                    {msg.role === 'user' && <p className="text-xs font-bold mb-1 opacity-75">You (Advisor)</p>}
                    <MarkdownText text={msg.content} />
                  </div>
                  {msg.role === 'user' && (
                    <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-green-600 flex items-center justify-center">
                      <User size={16} className="text-white" />
                    </div>
                  )}
                </div>
              ))}
              {isSending && (
                <div className="flex items-start gap-3">
                  <div className={`flex-shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br ${sc.colour} flex items-center justify-center text-lg`}>{sc.emoji}</div>
                  <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3">
                    <div className="flex gap-1.5 items-center h-4">
                      {[0, 150, 300].map(d => <div key={d} className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: `${d}ms` }} />)}
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div className="border-t p-4 rounded-b-2xl">
              <div className="flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={2}
                  placeholder="Describe what the farmer is seeing — symptoms, how many animals, when it started…"
                  disabled={isSending || consultSaved}
                  className="flex-1 px-4 py-3 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-400 resize-none leading-relaxed disabled:opacity-50"
                />
                <div className="flex flex-col gap-2">
                  <button
                    onClick={toggleListening}
                    disabled={consultSaved}
                    className={classNames('p-2.5 rounded-xl transition-all', isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-100 text-gray-500 hover:bg-gray-200')}
                  >
                    {isListening ? <MicOff size={16}/> : <Mic size={16}/>}
                  </button>
                  <button
                    onClick={sendMessage}
                    disabled={!inputText.trim() || isSending || consultSaved}
                    className={classNames('p-2.5 rounded-xl transition-all', inputText.trim() && !isSending && !consultSaved ? `bg-gradient-to-br ${sc.colour} text-white hover:opacity-90` : 'bg-gray-100 text-gray-400 cursor-not-allowed')}
                  >
                    <Send size={16}/>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Save panel — appears after first exchange */}
          {userTurns >= 1 && (
            <div className="bg-white rounded-2xl shadow-md p-5 space-y-4">
              <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                <Save size={15} className="text-green-600" /> Save Case Record
              </h3>

              {/* Youth actions */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">What did you advise / do on the ground?</label>
                <textarea
                  value={youthActionsTaken}
                  onChange={e => setYouthActionsTaken(e.target.value)}
                  rows={2}
                  placeholder="e.g. Told farmer to isolate the sick birds. Recommended Newcastle vaccination next market day."
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-400"
                />
              </div>

              {/* Follow-up */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="followup"
                  checked={followUpNeeded}
                  onChange={e => setFollowUpNeeded(e.target.checked)}
                  className="w-4 h-4 accent-green-600"
                />
                <label htmlFor="followup" className="text-sm font-semibold text-gray-700">Follow-up visit needed</label>
              </div>

              {followUpNeeded && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Follow-up date</label>
                    <input
                      type="date"
                      value={followUpDate}
                      onChange={e => setFollowUpDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Follow-up notes</label>
                    <input
                      value={followUpNotes}
                      onChange={e => setFollowUpNotes(e.target.value)}
                      placeholder="What to check…"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                    />
                  </div>
                </div>
              )}

              {consultSaved ? (
                <div className="flex items-center gap-2 text-green-700 font-semibold text-sm bg-green-50 rounded-xl px-4 py-3">
                  <CheckCircle size={16} /> Case saved to {selectedFarmer.farmer_name}'s record.
                </div>
              ) : (
                <button
                  onClick={saveConsultation}
                  disabled={savingConsult}
                  className="w-full py-3 rounded-xl font-bold text-white bg-gradient-to-r from-green-600 to-teal-600 hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {savingConsult
                    ? <span className="flex items-center justify-center gap-2"><Loader2 size={15} className="animate-spin"/> Saving…</span>
                    : 'Save Case Record'}
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
    const sc = SPECIES_CONFIG[c.species];
    return (
      <AppLayout>
        <div className="max-w-2xl mx-auto px-4 py-6">
          <div className="bg-white rounded-2xl shadow-md p-5 mb-4">
            <div className="flex items-center gap-3 mb-4">
              <button onClick={() => setMode('farmer-detail')} className="text-gray-400 hover:text-gray-700 p-1">
                <ArrowLeft size={20} />
              </button>
              <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${sc.colour} flex items-center justify-center text-2xl`}>{sc.emoji}</div>
              <div className="flex-1">
                <h2 className="text-base font-bold text-gray-900">{sc.label} Case — {selectedFarmer.farmer_name}</h2>
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
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Symptoms Reported</p>
                <p className="text-sm text-gray-800 bg-gray-50 rounded-lg px-3 py-2">{c.symptom_summary}</p>
              </div>

              {c.ai_diagnosis && (
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">AI Diagnosis</p>
                  <div className="text-sm text-gray-800 bg-gray-50 rounded-lg px-3 py-2">
                    <MarkdownText text={c.ai_diagnosis} />
                  </div>
                </div>
              )}

              {c.youth_actions_taken && (
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Actions Taken</p>
                  <p className="text-sm text-gray-800 bg-green-50 rounded-lg px-3 py-2">{c.youth_actions_taken}</p>
                </div>
              )}

              {c.follow_up_needed && (
                <div className="flex items-start gap-2 text-blue-700 bg-blue-50 rounded-lg px-3 py-2">
                  <Calendar size={14} className="mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold">Follow-up scheduled{c.follow_up_date ? `: ${formatDate(c.follow_up_date)}` : ''}</p>
                    {c.follow_up_notes && <p className="text-xs mt-0.5">{c.follow_up_notes}</p>}
                  </div>
                </div>
              )}

              {!c.resolved && (
                <button
                  onClick={async () => {
                    await markResolved(c.id);
                    setSelectedConsultation({ ...c, resolved: true });
                  }}
                  className="w-full py-3 rounded-xl font-bold text-white bg-gradient-to-r from-green-600 to-teal-600 hover:opacity-90"
                >
                  Mark as Resolved ✓
                </button>
              )}
            </div>
          </div>

          {/* Conversation replay */}
          {c.conversation_history && c.conversation_history.length > 0 && (
            <div className="bg-white rounded-2xl shadow-md p-5">
              <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
                <FileText size={14} className="text-green-600" /> Full Consultation Transcript
              </h3>
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {c.conversation_history.map((msg, i) => (
                  <div key={i} className={classNames('flex items-start gap-2', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                    {msg.role === 'assistant' && (
                      <div className={`flex-shrink-0 w-7 h-7 rounded-lg bg-gradient-to-br ${sc.colour} flex items-center justify-center text-sm`}>{sc.emoji}</div>
                    )}
                    <div className={classNames('max-w-[80%] rounded-xl px-3 py-2 text-xs leading-relaxed', msg.role === 'user' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-800')}>
                      <MarkdownText text={msg.content} />
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

export default AnimalHusbandryPage;
