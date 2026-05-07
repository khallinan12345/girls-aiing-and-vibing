// src/pages/community-impact/HealthcareNavigatorPage.tsx
//
// Healthcare Navigator — Community Impact Track
// A professional casebook tool for youth Community Health Navigators
// (modelled on Nigeria's CHIPS Agents) serving patients in Oloibiri
// (Bayelsa State) and Ibiade (Ogun State).
//
// The navigator registers community members, runs structured clinical
// assessments using WHO IMCI protocols (vitals, danger signs, triage),
// gets AI-assisted RED/YELLOW/GREEN classification, and maintains a
// case history per patient — with follow-up tracking and referral notes.
//
// DB tables: health_patients
//            health_assessments
//
// Route: /community-impact/healthcare
// Activity: healthcare_navigator
//
// CLINICAL BASIS: WHO IMCI thresholds, Nigeria CHIPS programme,
// Nigeria Malaria Treatment Guidelines. All advice is framed as
// clinical decision SUPPORT for a trained human navigator —
// NOT diagnosis or prescription.

import React, { useState, useEffect, useRef, useCallback } from 'react';
import AppLayout from '../../components/layout/AppLayout';
import { supabase } from '../../lib/supabaseClient';
import { chatText } from '../../lib/chatClient';
import { useAuth } from '../../hooks/useAuth';
import {
  Heart, ArrowLeft, Send, Save, Loader2, Plus, User,
  FileText, AlertTriangle, CheckCircle, Clock, ChevronRight,
  ClipboardList, RefreshCw, Calendar, Mic, MicOff,
  Volume2, VolumeX, X, Lightbulb, Thermometer, Activity,
  Baby, Stethoscope, ShieldCheck, AlertCircle, XCircle,
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
  | 'add-patient'
  | 'patient-detail'
  | 'new-assessment'
  | 'followup-chat'
  | 'case-detail';

type TriageLevel = 'red' | 'yellow' | 'green' | 'pending';
type PatientGroup = 'child-under-5' | 'child-5-14' | 'adult' | 'pregnant' | 'elderly';

interface Patient {
  id: string;
  youth_user_id: string;
  patient_name: string;
  village: string;
  phone: string | null;
  age_years: number | null;
  age_months: number | null;
  sex: 'male' | 'female' | '';
  patient_group: PatientGroup;
  notes: string | null;
  created_at: string;
  // from summary view
  total_assessments?: number;
  open_cases?: number;
  last_assessment_at?: string | null;
}

interface AssessmentData {
  // Vitals
  tempC: string;
  tempMethod: 'axillary' | 'oral' | 'rectal';
  respiratoryRate: string;
  pulseRate: string;
  bpSystolic: string;
  bpDiastolic: string;
  // Anthropometry
  weightKg: string;
  heightCm: string;
  muacCm: string;
  // Chief complaint
  chiefComplaint: string;
  // General danger signs (IMCI)
  convulsions: boolean;
  unconscious: boolean;
  unableToFeed: boolean;
  vomitsEverything: boolean;
  // Main symptoms
  fever: boolean; feverDays: string;
  cough: boolean; coughDays: string;
  chestIndrawing: boolean;
  diarrhoea: boolean; diarrhoeaDays: string;
  bloodInStool: boolean;
  vomiting: boolean;
  // Signs
  palmarPallor: boolean;
  stiffNeck: boolean;
  eyeJaundice: boolean;
  oedema: boolean;
  // Malaria
  malariaSuspected: boolean;
  rdt: 'positive' | 'negative' | 'not_done';
  recentBednetUse: boolean;
  // Notes
  additionalNotes: string;
}

const BLANK_ASSESSMENT: AssessmentData = {
  tempC: '', tempMethod: 'axillary',
  respiratoryRate: '', pulseRate: '',
  bpSystolic: '', bpDiastolic: '',
  weightKg: '', heightCm: '', muacCm: '',
  chiefComplaint: '',
  convulsions: false, unconscious: false, unableToFeed: false, vomitsEverything: false,
  fever: false, feverDays: '',
  cough: false, coughDays: '', chestIndrawing: false,
  diarrhoea: false, diarrhoeaDays: '', bloodInStool: false,
  vomiting: false,
  palmarPallor: false, stiffNeck: false, eyeJaundice: false, oedema: false,
  malariaSuspected: false, rdt: 'not_done', recentBednetUse: false,
  additionalNotes: '',
};

interface Assessment {
  id: string;
  patient_id: string;
  youth_user_id: string;
  assessment_data: AssessmentData;
  triage_level: TriageLevel;
  ai_triage_summary: string | null;
  referral_note: string | null;
  navigator_actions: string | null;
  conversation_history: ChatMessage[];
  follow_up_needed: boolean;
  follow_up_date: string | null;
  follow_up_notes: string | null;
  resolved: boolean;
  resolved_at: string | null;
  created_at: string;
}

// ─── Clinical Knowledge Base ──────────────────────────────────────────────────

const CLINICAL_CONTEXT = `
OLOIBIRI / BAYELSA COMMUNITY HEALTH NAVIGATOR CONTEXT:

YOUR ROLE — COMMUNITY HEALTH NAVIGATOR (not a doctor):
You are a trained Community Health Navigator, similar to a Nigerian CHIPS Agent.
You ASSESS, TRIAGE, and REFER. You do NOT diagnose or prescribe.
Your job: collect measurements, identify danger signs, classify urgency using the
WHO IMCI colour system, and prepare a clear referral note for the clinic.
You are trained, supervised by health professionals, and working to improve access
for people who cannot afford to travel to a clinic for every concern.

DISEASE BURDEN IN BAYELSA / OLOIBIRI (always apply this context):
- MALARIA: #1 killer; 56–70% prevalence in Bayelsa (highest in Nigeria); Plasmodium falciparum;
  affects ALL ages; worst in children under 5 and pregnant women;
  fever in Bayelsa = malaria until proven otherwise in high-transmission areas
- TYPHOID FEVER: Common; often confused with malaria; sustained high fever, headache, abdominal pain;
  needs laboratory confirmation ideally; treat empirically with cotrimoxazole or ciprofloxacin
- ACUTE RESPIRATORY INFECTIONS: pneumonia = #1 cause of child death under 5;
  presents as cough + fast breathing + chest indrawing; bacterial; needs antibiotics urgently
- DIARRHOEAL DISEASE: Cholera possible during floods; dehydration kills children fast;
  ORS (Oral Rehydration Solution) saves lives; assess dehydration before everything else
- MALNUTRITION: high burden; MUAC <11.5cm in child 6–59 months = SAM; urgent referral needed
- HYPERTENSION: increasingly common in adults; often silent; first presentation can be stroke;
  BP ≥140/90 needs medical review; ≥180/120 = hypertensive crisis, immediate referral
- MATERNAL COMPLICATIONS: eclampsia (seizures + high BP in pregnancy) = emergency;
  haemorrhage; prolonged labour; fever in pregnancy = malaria, needs urgent treatment
- OIL-RELATED ILLNESS: Skin conditions, respiratory symptoms, eye irritation near
  contaminated waterways; benzene exposure risk from oil infrastructure

WHO IMCI COLOUR CLASSIFICATION:
🔴 RED — URGENT REFERRAL IMMEDIATELY (do not delay):
  DANGER SIGNS: convulsions, loss of consciousness, very lethargic/cannot wake,
  unable to drink/breastfeed, vomits everything, severe respiratory distress
  ALSO RED: chest indrawing + fever; MUAC <11.5cm; severe dehydration;
  stiff neck + fever (meningitis); BP ≥180/120; any BP ≥140/90 in pregnancy

🟡 YELLOW — TREAT AND MONITOR (refer if no improvement in 2 days):
  Fever without danger signs; fast breathing without chest indrawing;
  some dehydration; moderate pallor; MUAC 11.5–12.4cm; BP 140–179/90–119 in non-pregnant adults

🟢 GREEN — HOME CARE (educate caregiver; follow-up instructions):
  Normal vital signs; no danger signs; mild symptoms manageable at home; good nutrition

VITAL SIGNS REFERENCE:
TEMPERATURE (axillary):
  Normal: 36.0–37.4°C | Low-grade fever: 37.5–37.9°C | Fever: 38.0–38.9°C
  High fever ≥39.0°C: urgent assessment | ≥39.5°C with danger signs = RED

RESPIRATORY RATE:
  0–2 months: Normal <60; Fast ≥60 = refer urgently
  2–12 months: Normal <50; Fast ≥50 = YELLOW; with indrawing = RED
  1–5 years: Normal <40; Fast ≥40 = YELLOW; with indrawing = RED
  5+ years/adults: Normal <25; ≥30 = concerning; laboured = urgent

PULSE:
  Infants: 100–160 normal | Children 1–5: 80–130 | Adults: 60–100; >120 at rest = investigate

BLOOD PRESSURE (adults):
  Normal: <120/80 | Stage 1 hypertension: 130–139/80–89 → refer
  Stage 2: ≥140/90 → refer for treatment | Crisis ≥180/120 = RED EMERGENCY
  Pregnancy: ANY BP ≥140/90 = URGENT referral (pre-eclampsia)

MUAC (children 6–59 months, left arm):
  GREEN ≥12.5cm = Normal | YELLOW 11.5–12.4cm = Moderate Acute Malnutrition → refer
  RED <11.5cm = Severe Acute Malnutrition = URGENT referral + therapeutic feeding
  Pregnant women: MUAC <23cm = nutritional risk

DEHYDRATION (for diarrhoea cases):
  🟢 No dehydration: Alert; drinks normally; normal skin turgor; no sunken eyes
  🟡 Some dehydration: Restless/irritable; drinks eagerly; sunken eyes; slow skin turgor
  🔴 Severe dehydration: Lethargic; unable to drink; very sunken eyes; very slow turgor = EMERGENCY

MALARIA RDT:
  Positive = malaria confirmed → treat with ACT
  Negative = malaria unlikely BUT if high fever + danger signs in Bayelsa, still discuss with supervising health worker
  Always test before treating — overuse causes resistance

KEY REFERRAL FACILITIES FROM OLOIBIRI:
  Oloibiri Primary Health Centre (on-site basic care)
  Ogbia LGA Hospital, Ogbia town (~20 min drive)
  Federal Medical Centre, Yenagoa (full hospital; ~1.5–2 hours)
  Niger Delta University Teaching Hospital, Amassoma (~1 hour)
  For obstetric emergencies: FMC Yenagoa has maternity and NICU

REFERRAL NOTE — ALWAYS INCLUDE:
  Patient name, age, sex | Vital signs with time | Main complaint + duration
  Key findings (danger signs, abnormal vitals) | Assessment/impression (not diagnosis)
  Treatment given before referral | Navigator name + contact | Date and time
`;

// ─── Clinical tooltips for navigator education ───────────────────────────────

const VITAL_TOOLTIPS: Record<string, string> = {
  tempC: 'Normal axillary temp is 36.0–37.4°C. Fever ≥38°C needs investigation. In Bayelsa, fever = malaria until proven otherwise.',
  respiratoryRate: 'Count breaths for a full 60 seconds watching the chest rise. Fast breathing in adults (≥25/min) or children may mean pneumonia.',
  pulseRate: 'Normal adult pulse is 60–100 bpm. Above 100 at rest (tachycardia) can mean infection, dehydration, or pain.',
  bpSystolic: 'Top number. ≥140 in adults = hypertension needing referral. ≥180 = emergency. In pregnancy, ≥140 = urgent.',
  bpDiastolic: 'Bottom number. ≥90 in adults = hypertension. ≥120 = hypertensive crisis.',
  weightKg: 'Weight is essential for calculating drug doses and detecting malnutrition. Weigh without shoes if possible.',
  heightCm: 'Used with weight to assess growth in children. Measure without shoes, standing straight.',
  muacCm: 'Mid-Upper Arm Circumference — fastest way to screen for malnutrition in children 6–59 months. <11.5cm = severe (RED). 11.5–12.4cm = moderate (YELLOW).',
};

const SYMPTOM_TOOLTIPS: Record<string, string> = {
  fever: 'Fever in Bayelsa is malaria until an RDT proves otherwise. Ask how many days, whether it comes and goes, and if there are chills or sweating.',
  cough: 'Cough + fast breathing + chest indrawing = pneumonia in children. For adults, ask about duration, sputum colour, and whether it is worse at night.',
  chestIndrawing: 'Watch the lower chest during breathing. If it pulls INWARD when the child breathes IN — that is chest indrawing, a danger sign. Not the same as normal chest movement.',
  diarrhoea: 'Ask how many stools per day and whether there is blood. Assess dehydration: sunken eyes, skin turgor (pinch belly skin — does it spring back?), can they drink?',
  vomiting: 'Ask how many times, whether they can keep any fluid down, and if there is blood. Vomiting everything = danger sign.',
  palmarPallor: 'Look at the palms in good light. Pale or white palms suggest anaemia, which can be caused by malaria, malnutrition, or bleeding.',
  stiffNeck: 'Ask patient to touch chin to chest. If they cannot or it causes pain, this is a danger sign for meningitis — refer immediately.',
  eyeJaundice: 'Look at the whites of the eyes in natural light. Yellow colouration (jaundice) indicates liver involvement — possible severe malaria, hepatitis, or sickle cell crisis.',
  oedema: 'Press the top of the foot with your thumb for 3 seconds. If a pit (dent) remains, that is pitting oedema — sign of severe malnutrition, heart or kidney problems.',
  malariaSuspected: 'In Oloibiri, suspect malaria for any fever, headache, body aches, or child with poor feeding. Always test with RDT before treating.',
};

// ─── Symptom probe system prompt ─────────────────────────────────────────────

function buildProbePrompt(symptom: string, patient: Patient, currentAssessment: AssessmentData): string {
  const pg = PATIENT_GROUPS[patient.patient_group];
  const ageStr = patient.age_years != null ? `${patient.age_years} years` : patient.age_months != null ? `${patient.age_months} months` : 'age unknown';
  return `You are coaching a Community Health Navigator in Oloibiri, Bayelsa State, Nigeria, during a live patient assessment. The navigator is sitting with the patient RIGHT NOW and needs you to guide the clinical interview.

PATIENT: ${patient.patient_name}, ${pg.label} (${ageStr}), ${patient.sex || 'sex unknown'}, ${patient.village}
CHIEF COMPLAINT: ${currentAssessment.chiefComplaint || 'not yet recorded'}
SYMPTOM BEING PROBED: ${symptom}
OTHER SYMPTOMS NOTED SO FAR: ${[
    currentAssessment.fever && 'fever',
    currentAssessment.cough && 'cough',
    currentAssessment.diarrhoea && 'diarrhoea',
    currentAssessment.vomiting && 'vomiting',
    currentAssessment.chestIndrawing && 'chest indrawing',
    currentAssessment.palmarPallor && 'palmar pallor',
    currentAssessment.stiffNeck && 'stiff neck',
    currentAssessment.oedema && 'oedema',
  ].filter(Boolean).join(', ') || 'none yet'}

YOUR ROLE:
- Ask ONE focused clinical question at a time that the navigator can read directly to the patient or caregiver
- Keep language very simple — the navigator may translate to Ijaw or Yoruba
- After each answer, decide: do you need more information, or is this symptom fully characterised?
- When the symptom is fully characterised, end your message with the exact phrase: "✅ This symptom is well characterised. You can move on."
- Never ask more than 6 questions for any symptom
- Draw on Bayelsa disease context: malaria, typhoid, pneumonia, cholera, malnutrition, oil-related illness

FORMAT: One short question. After the navigator gives you the patient's answer, probe deeper or confirm characterisation. Be direct, be brief, speak as if coaching the navigator in real time.

Start now with your FIRST question about: ${symptom}`;
}

// ─── Patient group config ─────────────────────────────────────────────────────

const PATIENT_GROUPS: Record<PatientGroup, {
  label: string; emoji: string; colour: string;
  bgLight: string; border: string; textColour: string;
}> = {
  'child-under-5': { label: 'Child under 5',  emoji: '👶🏿', colour: 'from-amber-500 to-orange-500', bgLight: 'bg-amber-50',  border: 'border-amber-300',  textColour: 'text-amber-700'  },
  'child-5-14':    { label: 'Child 5–14',     emoji: '👧🏿', colour: 'from-teal-500 to-green-500',  bgLight: 'bg-teal-50',   border: 'border-teal-300',   textColour: 'text-teal-700'   },
  'adult':         { label: 'Adult',           emoji: '🧑🏿', colour: 'from-blue-500 to-indigo-500', bgLight: 'bg-blue-50',   border: 'border-blue-300',   textColour: 'text-blue-700'   },
  'pregnant':      { label: 'Pregnant woman',  emoji: '🤰🏿', colour: 'from-rose-500 to-pink-500',  bgLight: 'bg-rose-50',   border: 'border-rose-300',   textColour: 'text-rose-700'   },
  'elderly':       { label: 'Elderly (60+)',   emoji: '👴🏿', colour: 'from-purple-500 to-violet-500', bgLight: 'bg-purple-50', border: 'border-purple-300', textColour: 'text-purple-700' },
};

const TRIAGE_CONFIG: Record<TriageLevel, {
  label: string; colour: string; bg: string; border: string;
  textDark: string; icon: React.ReactNode; description: string;
}> = {
  red:     { label: 'RED — Urgent Referral', colour: 'text-red-700',    bg: 'bg-red-50',    border: 'border-red-400',    textDark: 'text-red-800',    icon: <AlertTriangle size={14}/>, description: 'Refer immediately. Do not delay.' },
  yellow:  { label: 'YELLOW — Treat & Monitor', colour: 'text-yellow-700', bg: 'bg-yellow-50', border: 'border-yellow-400', textDark: 'text-yellow-800', icon: <AlertCircle size={14}/>,  description: 'Treat and monitor. Refer if no improvement in 2 days.' },
  green:   { label: 'GREEN — Home Care', colour: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-400',  textDark: 'text-green-800',  icon: <CheckCircle size={14}/>,  description: 'Home care with education and follow-up instructions.' },
  pending: { label: 'Pending Assessment',  colour: 'text-gray-500',   bg: 'bg-gray-50',   border: 'border-gray-300',   textDark: 'text-gray-700',   icon: <Clock size={14}/>,        description: 'Assessment in progress.' },
};

const VILLAGES = ['Oloibiri', 'Ibiade', 'Otuabagi', 'Nembe', 'Ogbia', 'Yenagoa', 'Ikebiri', 'Other'];

// ─── Build AI triage system prompt ───────────────────────────────────────────

function buildTriagePrompt(patient: Patient, assessment: AssessmentData): string {
  const pg = PATIENT_GROUPS[patient.patient_group];
  const ageStr = patient.age_years != null
    ? `${patient.age_years} years${patient.age_months ? ` ${patient.age_months} months` : ''}`
    : patient.age_months != null ? `${patient.age_months} months` : 'age not specified';

  return `You are a clinical decision support system for a trained Community Health Navigator in Oloibiri, Bayelsa State, Nigeria. The navigator has completed a structured patient assessment and needs your AI-assisted triage classification.

${CLINICAL_CONTEXT}

PATIENT: ${patient.patient_name}, ${pg.label} (${ageStr}), ${patient.sex || 'sex not recorded'}, ${patient.village}

ASSESSMENT DATA COLLECTED:
Chief complaint: ${assessment.chiefComplaint || 'not recorded'}

VITALS:
- Temperature: ${assessment.tempC ? `${assessment.tempC}°C (${assessment.tempMethod})` : 'not measured'}
- Respiratory rate: ${assessment.respiratoryRate ? `${assessment.respiratoryRate} breaths/min` : 'not measured'}
- Pulse: ${assessment.pulseRate ? `${assessment.pulseRate} bpm` : 'not measured'}
- Blood pressure: ${assessment.bpSystolic && assessment.bpDiastolic ? `${assessment.bpSystolic}/${assessment.bpDiastolic} mmHg` : 'not measured'}

ANTHROPOMETRY:
- Weight: ${assessment.weightKg ? `${assessment.weightKg} kg` : 'not measured'}
- Height: ${assessment.heightCm ? `${assessment.heightCm} cm` : 'not measured'}
- MUAC: ${assessment.muacCm ? `${assessment.muacCm} cm` : 'not measured'}

GENERAL DANGER SIGNS:
- Convulsions: ${assessment.convulsions ? '✅ YES' : 'No'}
- Unconscious/cannot wake: ${assessment.unconscious ? '✅ YES' : 'No'}
- Unable to feed/drink: ${assessment.unableToFeed ? '✅ YES' : 'No'}
- Vomits everything: ${assessment.vomitsEverything ? '✅ YES' : 'No'}

SYMPTOMS:
- Fever: ${assessment.fever ? `Yes (${assessment.feverDays || '?'} days)` : 'No'}
- Cough: ${assessment.cough ? `Yes (${assessment.coughDays || '?'} days)` : 'No'}
- Chest indrawing: ${assessment.chestIndrawing ? '✅ YES' : 'No'}
- Diarrhoea: ${assessment.diarrhoea ? `Yes (${assessment.diarrhoeaDays || '?'} days)${assessment.bloodInStool ? ' + blood in stool' : ''}` : 'No'}
- Vomiting: ${assessment.vomiting ? 'Yes' : 'No'}

SIGNS:
- Palmar pallor: ${assessment.palmarPallor ? 'Yes' : 'No'}
- Stiff neck: ${assessment.stiffNeck ? '✅ YES' : 'No'}
- Eye jaundice: ${assessment.eyeJaundice ? 'Yes' : 'No'}
- Oedema: ${assessment.oedema ? 'Yes' : 'No'}

MALARIA:
- RDT result: ${assessment.rdt}
- Recent bednet use: ${assessment.recentBednetUse ? 'Yes' : 'No'}

ADDITIONAL NOTES: ${assessment.additionalNotes || 'None'}

YOUR TASK — provide a structured triage response:

1. **TRIAGE CLASSIFICATION**: State clearly — RED / YELLOW / GREEN — and the single most important reason
2. **KEY FINDINGS**: List the 2–4 most clinically significant findings from this assessment
3. **IMMEDIATE ACTIONS**: What the navigator must do RIGHT NOW (step by step)
4. **REFERRAL GUIDANCE** (if RED or YELLOW): Where to go, what to say, what pre-referral actions to take
5. **REFERRAL NOTE DRAFT**: Write a ready-to-use referral note the navigator can copy or read aloud
6. **HOME CARE PLAN** (ALWAYS include this section even for RED cases — for what to do while waiting or if referral is not possible):
   - Safe, specific actions the patient/caregiver can take at home
   - ORS preparation if dehydration risk; paracetamol for fever (state adult dose: 500mg–1g every 6–8 hours)
   - Positioning, fluids, rest, nutrition advice appropriate to this case
   - Clear warning signs: "Go to hospital immediately if…" (list 2–3 specific signs)
   - What NOT to do (e.g. do not give aspirin to children, do not stop ORS if vomiting)
7. **FOLLOW-UP**: When to reassess and what warning signs to watch for

IMPORTANT CONSTRAINTS:
- You are supporting a trained navigator, NOT replacing clinical judgement
- Use clear, plain language — the navigator may read this aloud to a supervisor
- If any danger sign is present: classify RED regardless of other findings
- Always err on the side of caution in this resource-limited high-risk context
- Note any measurements that were NOT taken that should have been for this patient type
- End with one sentence the navigator can say directly to the patient/caregiver

⚠️ DISCLAIMER: This is clinical decision SUPPORT only. The navigator must follow their training and supervision protocols. This does not replace a doctor's assessment.`;
}

// ─── Build follow-up chat prompt ──────────────────────────────────────────────

function buildFollowupPrompt(patient: Patient, assessment: Assessment): string {
  const pg = PATIENT_GROUPS[patient.patient_group];
  const tc = TRIAGE_CONFIG[assessment.triage_level];
  return `You are a clinical decision support advisor for a Community Health Navigator in Oloibiri, Bayelsa State, Nigeria. The navigator has completed an assessment and has follow-up questions.

${CLINICAL_CONTEXT}

PATIENT ON FILE: ${patient.patient_name}, ${pg.label}, ${patient.village}
TRIAGE CLASSIFICATION: ${tc.label}
CHIEF COMPLAINT: ${assessment.assessment_data.chiefComplaint || 'not recorded'}
AI TRIAGE SUMMARY: ${assessment.ai_triage_summary || 'see assessment'}

The navigator may ask follow-up clinical questions, ask for clarification on the triage, ask how to explain something to the patient/caregiver, or ask about referral logistics.

Respond with practical, specific advice appropriate to this community health navigator role. Keep answers concise and actionable. Never prescribe specific drug doses unless part of approved IMCI/CHIPS protocols. Remind the navigator to consult their supervising health worker for anything outside their scope.`;
}

// ─── Healthcare background (preserved from original) ─────────────────────────

const HealthBackground: React.FC = () => {
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
  const img = "url('/background_healthcare_navigator.png')";
  return (
    <>
      <svg className="absolute w-0 h-0" aria-hidden="true">
        <defs>
          <filter id="health-distortion">
            <feTurbulence type="fractalNoise" baseFrequency="0.007" numOctaves="3" seed="22" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="55" xChannelSelector="R" yChannelSelector="G" result="displaced" />
            <feGaussianBlur in="displaced" stdDeviation="1" />
          </filter>
        </defs>
      </svg>
      <div className="fixed top-16 left-64 right-0 bottom-0" style={{ backgroundImage: img, backgroundSize: 'cover', backgroundPosition: 'center', zIndex: 0 }}>
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/70 via-indigo-900/60 to-teal-900/65" />
        <div className="absolute inset-0 bg-black/10" />
      </div>
      {moving && (
        <div className="fixed top-16 left-64 right-0 bottom-0 pointer-events-none" style={{ backgroundImage: img, backgroundSize: 'cover', backgroundPosition: 'center', zIndex: 1, filter: 'url(#health-distortion)', WebkitMaskImage: `radial-gradient(circle 160px at ${mouse.x}px ${mouse.y}px, black 0%, black 45%, transparent 100%)`, maskImage: `radial-gradient(circle 160px at ${mouse.x}px ${mouse.y}px, black 0%, black 45%, transparent 100%)` }}>
          <div className="absolute inset-0 bg-gradient-to-br from-blue-900/70 via-indigo-900/60 to-teal-900/65" />
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
      const html = line
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>');
      return <p key={i} className="leading-relaxed" dangerouslySetInnerHTML={{ __html: html }} />;
    })}
  </div>
);

// ─── Info tooltip ─────────────────────────────────────────────────────────────

const InfoTooltip: React.FC<{ id: string; text: string; open: boolean; onToggle: () => void }> = ({ id, text, open, onToggle }) => (
  <div className="relative inline-block">
    <button onClick={onToggle} className="ml-1.5 text-blue-400 hover:text-blue-600 focus:outline-none" aria-label="More info">
      <Lightbulb size={13}/>
    </button>
    {open && (
      <div className="absolute z-50 left-0 top-6 w-64 bg-blue-900 text-blue-50 text-xs rounded-xl px-3 py-2.5 shadow-xl leading-relaxed">
        {text}
        <button onClick={onToggle} className="absolute top-1.5 right-2 text-blue-300 hover:text-white"><X size={11}/></button>
      </div>
    )}
  </div>
);

// ─── Checkbox row helper ──────────────────────────────────────────────────────

const CheckRow: React.FC<{
  label: string; checked: boolean; onChange: (v: boolean) => void;
  danger?: boolean; subField?: React.ReactNode;
  tooltip?: string; tooltipOpen?: boolean; onTooltipToggle?: () => void;
  onProbe?: () => void; probeActive?: boolean;
}> = ({ label, checked, onChange, danger, subField, tooltip, tooltipOpen, onTooltipToggle, onProbe, probeActive }) => (
  <div>
    <div className={classNames('flex items-center gap-3 px-3 py-2.5 rounded-xl border cursor-pointer transition-colors',
      checked
        ? danger ? 'bg-red-50 border-red-400' : 'bg-blue-50 border-blue-400'
        : 'border-gray-200 hover:border-gray-300')}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
        className={classNames('w-4 h-4 flex-shrink-0', danger ? 'accent-red-600' : 'accent-blue-600')} />
      <span className={classNames('text-sm font-medium flex-1', checked && danger ? 'text-red-700 font-bold' : 'text-gray-800')}
        onClick={() => onChange(!checked)}>
        {danger && checked && '⚠️ '}{label}
      </span>
      {tooltip && onTooltipToggle && (
        <InfoTooltip id={label} text={tooltip} open={!!tooltipOpen} onToggle={onTooltipToggle}/>
      )}
      {checked && onProbe && (
        <button onClick={e => { e.stopPropagation(); onProbe(); }}
          className={classNames('ml-1 px-2 py-0.5 rounded-lg text-xs font-bold border transition-colors flex-shrink-0',
            probeActive ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-indigo-50 text-indigo-700 border-indigo-300 hover:bg-indigo-100')}>
          {probeActive ? '🔍 Probing…' : '🔍 Probe'}
        </button>
      )}
    </div>
    {checked && subField && <div className="mt-1 ml-10">{subField}</div>}
  </div>
);

// ─── Symptom Probe Panel (modal sheet) ───────────────────────────────────────

interface ProbePanelProps {
  symptom: string;
  messages: ChatMessage[];
  loading: boolean;
  done: boolean;
  input: string;
  onInputChange: (v: string) => void;
  onSend: () => void;
  onClose: () => void;
  chatEndRef: React.RefObject<HTMLDivElement>;
}

const ProbePanel: React.FC<ProbePanelProps> = ({
  symptom, messages, loading, done, input, onInputChange, onSend, onClose, chatEndRef
}) => (
  <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm px-2 pb-2">
    <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl flex flex-col" style={{ maxHeight: '85vh' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-indigo-50 rounded-t-2xl">
        <div>
          <p className="text-xs font-bold text-indigo-500 uppercase tracking-wide">Clinical Interview Coach</p>
          <p className="text-sm font-bold text-indigo-900">Probing: {symptom}</p>
        </div>
        <button onClick={onClose} className="p-2 rounded-xl text-indigo-400 hover:text-indigo-700 hover:bg-indigo-100">
          <X size={18}/>
        </button>
      </div>

      {/* Instruction bar */}
      <div className="px-4 py-2 bg-indigo-900 text-indigo-100 text-xs flex items-start gap-2">
        <span className="text-base">💬</span>
        <span>Read each question aloud to the patient. Type or speak their answer, then tap Send.</span>
      </div>

      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.map(msg => (
          <div key={msg.id} className={classNames('flex items-start gap-2', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
            {msg.role === 'assistant' && (
              <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-xs flex-shrink-0">🏥</div>
            )}
            <div className={classNames('max-w-[85%] rounded-2xl px-3 py-2.5 text-sm leading-relaxed',
              msg.role === 'user' ? 'bg-blue-600 text-white rounded-tr-sm' : 'bg-indigo-50 text-indigo-900 rounded-tl-sm border border-indigo-100')}>
              {msg.role === 'assistant' && <p className="text-xs font-bold text-indigo-400 mb-1">AI Coach</p>}
              {msg.role === 'user' && <p className="text-xs font-bold text-blue-200 mb-1">Navigator answer</p>}
              <MarkdownText text={msg.content}/>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex items-start gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-xs">🏥</div>
            <div className="bg-indigo-50 rounded-2xl rounded-tl-sm px-3 py-2.5">
              <div className="flex gap-1 items-center h-4">{[0,150,300].map(d => <div key={d} className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: `${d}ms` }}/>)}</div>
            </div>
          </div>
        )}
        <div ref={chatEndRef}/>
      </div>

      {/* Done banner */}
      {done && (
        <div className="mx-4 mb-2 bg-green-50 border border-green-300 rounded-xl px-3 py-2.5 flex items-center gap-2 text-green-800 text-sm font-semibold">
          <CheckCircle size={16} className="text-green-600 flex-shrink-0"/>
          Symptom fully characterised. Tap "Move On" when ready.
        </div>
      )}

      {/* Input */}
      <div className="border-t px-3 py-3 rounded-b-2xl">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={e => onInputChange(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onSend(); } }}
            placeholder="Type patient's answer…"
            disabled={loading}
            className="flex-1 px-3 py-2.5 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-50"
          />
          <button onClick={onSend} disabled={!input.trim() || loading}
            className="px-3 py-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40">
            <Send size={15}/>
          </button>
          <button onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-green-600 text-white text-sm font-bold hover:bg-green-700 whitespace-nowrap">
            Move On ✓
          </button>
        </div>
      </div>
    </div>
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════════════════

const HealthcareNavigatorPage: React.FC = () => {
  const { user } = useAuth();

  // ── Navigation
  const [mode, setMode] = useState<AppMode>('dashboard');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [selectedAssessment, setSelectedAssessment] = useState<Assessment | null>(null);

  // ── Data
  const [patients, setPatients] = useState<Patient[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loadingPatients, setLoadingPatients] = useState(true);
  const [loadingAssessments, setLoadingAssessments] = useState(false);

  // ── Add-patient form
  const [newName, setNewName] = useState('');
  const [newVillage, setNewVillage] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newAgeYears, setNewAgeYears] = useState('');
  const [newAgeMonths, setNewAgeMonths] = useState('');
  const [newSex, setNewSex] = useState<'male' | 'female' | ''>('');
  const [newGroup, setNewGroup] = useState<PatientGroup>('adult');
  const [newNotes, setNewNotes] = useState('');
  const [savingPatient, setSavingPatient] = useState(false);

  // ── Assessment form
  const [assessment, setAssessment] = useState<AssessmentData>({ ...BLANK_ASSESSMENT });
  const [isTriaging, setIsTriaging] = useState(false);
  const [triageResult, setTriageResult] = useState<{ level: TriageLevel; summary: string } | null>(null);
  const [navigatorActions, setNavigatorActions] = useState('');
  const [followUpNeeded, setFollowUpNeeded] = useState(false);
  const [followUpDate, setFollowUpDate] = useState('');
  const [followUpNotes, setFollowUpNotes] = useState('');
  const [savingAssessment, setSavingAssessment] = useState(false);
  const [assessmentSaved, setAssessmentSaved] = useState(false);

  // ── Symptom probe panel
  const [probeSymptom, setProbeSymptom] = useState<string | null>(null);
  const [probeMessages, setProbeMessages] = useState<ChatMessage[]>([]);
  const [probeInput, setProbeInput] = useState('');
  const [probeLoading, setProbeLoading] = useState(false);
  const [probeDone, setProbeDone] = useState(false);
  const [probeNotes, setProbeNotes] = useState<Record<string, string>>({});
  const probeChatEndRef = useRef<HTMLDivElement>(null);

  // ── Tooltip visibility
  const [openTooltip, setOpenTooltip] = useState<string | null>(null);

  // ── Follow-up chat
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [speechOn, setSpeechOn] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);

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
    const voice = voices.find(v => v.lang === 'en-NG') || voices.find(v => v.lang.startsWith('en'));
    if (voice) { utt.voice = voice; utt.lang = voice.lang; }
    utt.rate = 0.87;
    window.speechSynthesis.speak(utt);
  }, [speechOn, voices]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, isSending]);

  // ─── Load patients ────────────────────────────────────────────────────────
  const loadPatients = useCallback(async () => {
    if (!user) return;
    setLoadingPatients(true);
    try {
      const { data, error } = await supabase
        .from('health_patient_summary')
        .select('*')
        .eq('youth_user_id', user.id)
        .order('patient_name');
      if (!error && data) setPatients(data as Patient[]);
    } finally { setLoadingPatients(false); }
  }, [user]);

  useEffect(() => { loadPatients(); }, [loadPatients]);

  // ─── Load assessments ─────────────────────────────────────────────────────
  const loadAssessments = useCallback(async (patientId: string) => {

    if (!patientId) return;
    setLoadingAssessments(true);
    try {
      const { data, error } = await supabase
        .from('health_assessments')
        .select('*')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false });
      if (!error && data) setAssessments(data as Assessment[]);
    } finally { setLoadingAssessments(false); }
  }, []);

  // ─── Open symptom probe panel ─────────────────────────────────────────────
  const openProbe = useCallback(async (symptomKey: string, symptomLabel: string) => {
    if (!selectedPatient) return;
    setProbeSymptom(symptomLabel);
    setProbeMessages([]);
    setProbeInput('');
    setProbeDone(false);
    setProbeLoading(true);
    try {
      const systemPrompt = buildProbePrompt(symptomLabel, selectedPatient, assessment);
      const reply = await chatText({
        page: 'HealthcareNavigatorPage',
        messages: [{ role: 'user', content: `Start probing: ${symptomLabel}` }],
        system: systemPrompt,
        max_tokens: 300,
      });
      const isDone = reply.includes('✅ This symptom is well characterised');
      setProbeDone(isDone);
      setProbeMessages([{ id: crypto.randomUUID(), role: 'assistant', content: reply, timestamp: new Date() }]);
    } finally { setProbeLoading(false); }
  }, [selectedPatient, assessment]);

  // ─── Send probe reply ─────────────────────────────────────────────────────
  const sendProbeMessage = useCallback(async () => {
    if (!probeInput.trim() || probeLoading || !selectedPatient || !probeSymptom) return;
    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: probeInput.trim(), timestamp: new Date() };
    const updated = [...probeMessages, userMsg];
    setProbeMessages(updated);
    setProbeInput('');
    setProbeLoading(true);
    try {
      const systemPrompt = buildProbePrompt(probeSymptom, selectedPatient, assessment);
      const reply = await chatText({
        page: 'HealthcareNavigatorPage',
        messages: updated.map(m => ({ role: m.role, content: m.content })),
        system: systemPrompt,
        max_tokens: 300,
      });
      const isDone = reply.includes('✅ This symptom is well characterised');
      setProbeDone(isDone);
      const aiMsg: ChatMessage = { id: crypto.randomUUID(), role: 'assistant', content: reply, timestamp: new Date() };
      setProbeMessages(prev => [...prev, aiMsg]);
    } finally { setProbeLoading(false); }
  }, [probeInput, probeLoading, probeMessages, selectedPatient, probeSymptom, assessment]);

  // ─── Close probe panel and save notes ────────────────────────────────────
  const closeProbe = useCallback(() => {
    if (probeSymptom && probeMessages.length > 0) {
      const summary = probeMessages.map(m => `${m.role === 'assistant' ? 'AI' : 'Navigator'}: ${m.content}`).join('\n');
      setProbeNotes(prev => ({ ...prev, [probeSymptom]: summary }));
      // Append to additionalNotes
      setAssessment(prev => ({
        ...prev,
        additionalNotes: prev.additionalNotes
          ? `${prev.additionalNotes}\n\n[${probeSymptom} probe]\n${summary}`
          : `[${probeSymptom} probe]\n${summary}`,
      }));
    }
    setProbeSymptom(null);
    setProbeMessages([]);
    setProbeDone(false);
  }, [probeSymptom, probeMessages]);

  useEffect(() => { probeChatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [probeMessages, probeLoading]);

  // ─── Field updater ────────────────────────────────────────────────────────
  const setField = <K extends keyof AssessmentData>(key: K, value: AssessmentData[K]) =>
    setAssessment(prev => ({ ...prev, [key]: value }));

  // ─── Detect triage from AI text ───────────────────────────────────────────
  const detectTriage = (text: string): TriageLevel => {
    const upper = text.toUpperCase();
    if (upper.includes('RED')) return 'red';
    if (upper.includes('YELLOW')) return 'yellow';
    if (upper.includes('GREEN')) return 'green';
    return 'yellow'; // default to caution
  };

  // ─── Run AI triage ────────────────────────────────────────────────────────
  const runTriage = async () => {
    if (!selectedPatient || isTriaging) return;
    setIsTriaging(true);
    try {
      const systemPrompt = buildTriagePrompt(selectedPatient, assessment);
      const reply = await chatText({ page: 'HealthcareNavigatorPage', messages: [{ role: 'user', content: 'Please analyse this patient assessment and provide your triage classification.' }], system: systemPrompt, max_tokens: 800 });
      const level = detectTriage(reply);
      setTriageResult({ level, summary: reply });
      speak(reply.slice(0, 200));
    } catch { setTriageResult({ level: 'yellow', summary: 'Unable to complete AI triage. Please use your clinical training and contact your supervising health worker.' }); }
    finally { setIsTriaging(false); }
  };

  // ─── Save assessment ──────────────────────────────────────────────────────
  const saveAssessment = async () => {
    if (!user || !selectedPatient || !triageResult) return;
    setSavingAssessment(true);
    try {
      const { data, error } = await supabase
        .from('health_assessments')
        .insert({
          youth_user_id: user.id,
          patient_id: (selectedPatient as any).patient_id ?? selectedPatient.id,
          assessment_data: assessment,
          triage_level: triageResult.level,
          ai_triage_summary: triageResult.summary,
          navigator_actions: navigatorActions || null,
          conversation_history: [],
          follow_up_needed: followUpNeeded,
          follow_up_date: followUpDate || null,
          follow_up_notes: followUpNotes || null,
          resolved: false,
        })
        .select('id')
        .single();
      if (!error && data) {
        setAssessmentSaved(true);
        await loadPatients();
        await loadAssessments((selectedPatient as any).patient_id ?? selectedPatient.id);
      }
    } finally { setSavingAssessment(false); }
  };

  // ─── Send follow-up message ───────────────────────────────────────────────
  const sendMessage = useCallback(async () => {
    if (!inputText.trim() || isSending || !selectedPatient || !selectedAssessment) return;
    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: inputText.trim(), timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsSending(true);
    try {
      const history = [...messages, userMsg];
      const systemPrompt = buildFollowupPrompt(selectedPatient, selectedAssessment);
      const reply = await chatText({ page: 'HealthcareNavigatorPage', messages: history.map(m => ({ role: m.role, content: m.content })), system: systemPrompt, max_tokens: 800 });
      const aiMsg: ChatMessage = { id: crypto.randomUUID(), role: 'assistant', content: reply, timestamp: new Date() };
      const updated = [...history, aiMsg];
      setMessages(updated);
      speak(reply);
      // Persist updated conversation to the assessment record
      await supabase.from('health_assessments').update({ conversation_history: updated }).eq('id', selectedAssessment.id);
    } catch { setMessages(p => [...p, { id: crypto.randomUUID(), role: 'assistant', content: 'Technical issue — please try again.', timestamp: new Date() }]); }
    finally { setIsSending(false); setTimeout(() => inputRef.current?.focus(), 100); }
  }, [inputText, isSending, messages, selectedPatient, selectedAssessment, speak]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

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

  // ─── Save patient ─────────────────────────────────────────────────────────
  const savePatient = async () => {
    if (!user || !newName.trim() || !newVillage) return;
    setSavingPatient(true);
    try {
      const { error } = await supabase.from('health_patients').insert({
        youth_user_id: user.id,
        patient_name: newName.trim(),
        village: newVillage,
        phone: newPhone || null,
        age_years: newAgeYears ? Number(newAgeYears) : null,
        age_months: newAgeMonths ? Number(newAgeMonths) : null,
        sex: newSex || null,
        patient_group: newGroup,
        notes: newNotes || null,
      });
      if (!error) { await loadPatients(); resetAddPatient(); setMode('dashboard'); }
    } finally { setSavingPatient(false); }
  };

  const resetAddPatient = () => { setNewName(''); setNewVillage(''); setNewPhone(''); setNewAgeYears(''); setNewAgeMonths(''); setNewSex(''); setNewGroup('adult'); setNewNotes(''); };

  // ─── Start new assessment ─────────────────────────────────────────────────
  const startAssessment = (patient: Patient) => {
    setSelectedPatient(patient);
    setAssessment({ ...BLANK_ASSESSMENT });
    setTriageResult(null);
    setNavigatorActions('');
    setFollowUpNeeded(false);
    setFollowUpDate('');
    setFollowUpNotes('');
    setAssessmentSaved(false);
    setMode('new-assessment');
  };

  // ─── Open follow-up chat ──────────────────────────────────────────────────
  const openFollowupChat = (patient: Patient, assess: Assessment) => {
    setSelectedPatient(patient);
    setSelectedAssessment(assess);
    setMessages(assess.conversation_history || []);
    setInputText('');
    setMode('followup-chat');
    if ((assess.conversation_history || []).length === 0) {
      const tc = TRIAGE_CONFIG[assess.triage_level];
      const opener: ChatMessage = {
        id: crypto.randomUUID(), role: 'assistant',
        content: `Ready to help with follow-up questions for **${patient.patient_name}** (classified **${tc.label}**).\n\nYou can ask about the triage, how to explain the situation to the patient/caregiver, referral logistics, or any clinical questions within your navigator scope.`,
        timestamp: new Date(),
      };
      setMessages([opener]);
    }
  };

  // ─── Helpers ──────────────────────────────────────────────────────────────
  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });

  const triageBadge = (level: TriageLevel) => {
    const cfg = TRIAGE_CONFIG[level];
    return (
      <span className={classNames('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border', cfg.colour, cfg.bg, cfg.border)}>
        {cfg.icon} {level.toUpperCase()}
      </span>
    );
  };

  const markResolved = async (assessId: string) => {
    await supabase.from('health_assessments').update({ resolved: true }).eq('id', assessId);
    if (selectedPatient) loadAssessments((selectedPatient as any).patient_id ?? selectedPatient.id);
    await loadPatients();
  };

  const hasDangerSign = () =>
    assessment.convulsions || assessment.unconscious ||
    assessment.unableToFeed || assessment.vomitsEverything ||
    assessment.chestIndrawing || assessment.stiffNeck;

  // ════════════════════════════════════════════════════════════════════════════
  // RENDER: DASHBOARD
  // ════════════════════════════════════════════════════════════════════════════

  if (mode === 'dashboard') {
    return (
      <AppLayout>
        <HealthBackground />
        <div className="relative z-10 max-w-2xl mx-auto px-4 py-6">
          <div className="bg-black/40 backdrop-blur-sm rounded-2xl p-5 mb-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-2xl">🏥</div>
                <div>
                  <h1 className="text-xl font-bold text-white">Health Navigator</h1>
                  <p className="text-sm text-blue-200">Your patient casebook · Oloibiri & Ibiade</p>
                </div>
              </div>
              <button onClick={() => { resetAddPatient(); setMode('add-patient'); }}
                className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-semibold text-sm hover:opacity-90">
                <Plus size={16}/> Add Patient
              </button>
            </div>
          </div>

          {patients.length > 0 && (
            <div className="grid grid-cols-3 gap-3 mb-5">
              {[
                { label: 'Patients', value: patients.length, icon: '👥' },
                { label: 'Open Cases', value: patients.reduce((s, p) => s + (p.open_cases ?? 0), 0), icon: '📋' },
                { label: 'This Month', value: patients.filter(p => p.last_assessment_at && new Date(p.last_assessment_at) > new Date(Date.now() - 30*24*60*60*1000)).length, icon: '📅' },
              ].map(stat => (
                <div key={stat.label} className="bg-white/90 backdrop-blur-sm rounded-xl p-4 text-center">
                  <div className="text-2xl mb-1">{stat.icon}</div>
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                  <p className="text-xs text-gray-500">{stat.label}</p>
                </div>
              ))}
            </div>
          )}

          {loadingPatients ? (
            <div className="flex justify-center py-12"><Loader2 size={28} className="animate-spin text-blue-300"/></div>
          ) : patients.length === 0 ? (
            <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-10 text-center">
              <div className="text-5xl mb-4">🏥</div>
              <h2 className="text-lg font-bold text-gray-800 mb-2">No patients registered yet</h2>
              <p className="text-sm text-gray-500 mb-5">Register your first community patient to start your casebook.</p>
              <button onClick={() => { resetAddPatient(); setMode('add-patient'); }}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold hover:opacity-90">
                <Plus size={16}/> Register First Patient
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {patients.map(patient => {
                const pg = PATIENT_GROUPS[patient.patient_group];
                return (
                  <button key={patient.id}
                    onClick={() => { setSelectedPatient(patient); loadAssessments(patient.id); setMode('patient-detail'); }}
                    className="w-full bg-white/90 backdrop-blur-sm rounded-2xl p-4 text-left hover:bg-white transition-colors border border-transparent hover:border-blue-300">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center text-lg">{pg.emoji}</div>
                        <div>
                          <p className="font-bold text-gray-900">{patient.patient_name}</p>
                          <p className="text-sm text-gray-500">{patient.village}</p>
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            <span className={classNames('text-xs rounded-full px-2 py-0.5 font-medium border', pg.bgLight, pg.border, pg.textColour)}>
                              {pg.emoji} {pg.label}
                            </span>
                            {(patient.age_years != null || patient.age_months != null) && (
                              <span className="text-xs bg-gray-100 text-gray-600 rounded-full px-2 py-0.5">
                                {patient.age_years != null ? `${patient.age_years}y` : ''}{patient.age_months != null ? ` ${patient.age_months}m` : ''}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        <ChevronRight size={17} className="text-gray-400"/>
                        {(patient.open_cases ?? 0) > 0 && (
                          <span className="text-xs bg-orange-100 text-orange-700 rounded-full px-2 py-0.5 font-semibold">{patient.open_cases} open</span>
                        )}
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-3 text-xs text-gray-400">
                      <span>{patient.total_assessments ?? 0} assessment{patient.total_assessments !== 1 ? 's' : ''}</span>
                      {patient.last_assessment_at && <span>Last: {formatDate(patient.last_assessment_at)}</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </AppLayout>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // RENDER: ADD PATIENT
  // ════════════════════════════════════════════════════════════════════════════

  if (mode === 'add-patient') {
    return (
      <AppLayout>
        <HealthBackground />
        <div className="relative z-10 max-w-2xl mx-auto px-4 py-6">
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-md p-5">
            <div className="flex items-center gap-3 mb-5">
              <button onClick={() => setMode('dashboard')} className="text-gray-400 hover:text-gray-700 p-1"><ArrowLeft size={20}/></button>
              <div><h2 className="text-xl font-bold text-gray-900">Register Patient</h2><p className="text-sm text-gray-500">Add to your casebook</p></div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Full Name *</label>
                <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Adaeze Okafor"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 text-base"/>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Village *</label>
                <select value={newVillage} onChange={e => setNewVillage(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 text-base bg-white">
                  <option value="">Select village…</option>
                  {VILLAGES.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Age (years)</label>
                  <input type="number" min="0" value={newAgeYears} onChange={e => setNewAgeYears(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 text-base"/>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Age (months)</label>
                  <input type="number" min="0" max="11" value={newAgeMonths} onChange={e => setNewAgeMonths(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 text-base"/>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Sex</label>
                  <select value={newSex} onChange={e => setNewSex(e.target.value as 'male' | 'female' | '')}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 text-base bg-white">
                    <option value="">Not specified</option>
                    <option value="female">Female</option>
                    <option value="male">Male</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Patient Group *</label>
                  <select value={newGroup} onChange={e => setNewGroup(e.target.value as PatientGroup)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 text-base bg-white">
                    {(Object.entries(PATIENT_GROUPS) as [PatientGroup, typeof PATIENT_GROUPS[PatientGroup]][]).map(([k, v]) => (
                      <option key={k} value={k}>{v.emoji} {v.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Phone (optional)</label>
                <input value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder="+234 801 234 5678"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 text-base"/>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Notes (optional)</label>
                <textarea value={newNotes} onChange={e => setNewNotes(e.target.value)} rows={2}
                  placeholder="Chronic conditions, allergies, previous serious illness…"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm resize-none"/>
              </div>
              <button onClick={savePatient} disabled={!newName.trim() || !newVillage || savingPatient}
                className={classNames('w-full py-3.5 rounded-xl font-bold text-white text-base transition-opacity',
                  newName.trim() && newVillage && !savingPatient ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-90' : 'bg-gray-300 cursor-not-allowed')}>
                {savingPatient ? <span className="flex items-center justify-center gap-2"><Loader2 size={16} className="animate-spin"/>Saving…</span> : 'Register Patient'}
              </button>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // RENDER: PATIENT DETAIL
  // ════════════════════════════════════════════════════════════════════════════

  if (mode === 'patient-detail' && selectedPatient) {
    const patient = selectedPatient;
    const pg = PATIENT_GROUPS[patient.patient_group];
    return (
      <AppLayout>
        <HealthBackground />
        <div className="relative z-10 max-w-2xl mx-auto px-4 py-6 space-y-4">
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-md p-5">
            <div className="flex items-center gap-3 mb-4">
              <button onClick={() => setMode('dashboard')} className="text-gray-400 hover:text-gray-700 p-1"><ArrowLeft size={20}/></button>
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center text-2xl">{pg.emoji}</div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-gray-900">{patient.patient_name}</h2>
                <p className="text-sm text-gray-500">{patient.village}{patient.phone ? ` · ${patient.phone}` : ''}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mb-4">
              <span className={classNames('px-3 py-1.5 rounded-xl text-sm font-semibold border', pg.bgLight, pg.border, pg.textColour)}>
                {pg.emoji} {pg.label}
              </span>
              {(patient.age_years != null || patient.age_months != null) && (
                <span className="px-3 py-1.5 rounded-xl text-sm font-semibold border bg-gray-50 border-gray-200 text-gray-700">
                  Age: {patient.age_years != null ? `${patient.age_years}y` : ''}{patient.age_months != null ? ` ${patient.age_months}m` : ''}
                </span>
              )}
              {patient.sex && (
                <span className="px-3 py-1.5 rounded-xl text-sm font-semibold border bg-gray-50 border-gray-200 text-gray-700">
                  {patient.sex === 'female' ? '♀' : '♂'} {patient.sex}
                </span>
              )}
            </div>
            {patient.notes && <p className="text-sm text-gray-600 italic bg-gray-50 rounded-lg px-3 py-2 mb-4">{patient.notes}</p>}
            <button onClick={() => startAssessment(patient)}
              className="w-full py-3.5 rounded-xl font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-90 flex items-center justify-center gap-2">
              <Stethoscope size={18}/> Start New Assessment
            </button>
          </div>

          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-md p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <ClipboardList size={16} className="text-blue-600"/> Assessment History
              </h3>
              <button onClick={() => loadAssessments(patient.id)} className="text-gray-400 hover:text-gray-700"><RefreshCw size={14}/></button>
            </div>
            {loadingAssessments ? (
              <div className="flex justify-center py-6"><Loader2 size={20} className="animate-spin text-blue-600"/></div>
            ) : assessments.length === 0 ? (
              <p className="text-sm text-gray-400 italic text-center py-4">No assessments yet.</p>
            ) : (
              <div className="space-y-3">
                {assessments.map(a => (
                  <div key={a.id} className="border border-gray-200 rounded-xl p-4 hover:border-blue-300 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">{a.assessment_data.chiefComplaint || 'Assessment'}</p>
                        <p className="text-xs text-gray-500">{formatDate(a.created_at)}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {triageBadge(a.triage_level)}
                        {a.resolved
                          ? <span className="text-xs text-green-600 font-semibold flex items-center gap-1"><CheckCircle size={11}/> Resolved</span>
                          : <span className="text-xs text-orange-600 font-semibold">Open</span>}
                      </div>
                    </div>
                    {a.follow_up_date && !a.resolved && (
                      <p className="text-xs text-blue-600 mt-1.5 flex items-center gap-1">
                        <Calendar size={11}/> Follow-up: {formatDate(a.follow_up_date)}
                      </p>
                    )}
                    <div className="flex gap-2 mt-3">
                      <button onClick={() => { setSelectedAssessment(a); setMode('case-detail'); }}
                        className="flex-1 py-2 text-xs font-semibold rounded-lg border border-gray-200 text-gray-700 hover:border-blue-300 hover:text-blue-700">
                        View Case
                      </button>
                      <button onClick={() => openFollowupChat(patient, a)}
                        className="flex-1 py-2 text-xs font-semibold rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100">
                        Ask AI Follow-up
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </AppLayout>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // RENDER: NEW ASSESSMENT (structured form + AI triage)
  // ════════════════════════════════════════════════════════════════════════════

  if (mode === 'new-assessment' && selectedPatient) {
    const patient = selectedPatient;
    const pg = PATIENT_GROUPS[patient.patient_group];
    const isChild = patient.patient_group === 'child-under-5' || patient.patient_group === 'child-5-14';
    const isPregnant = patient.patient_group === 'pregnant';

    return (
      <AppLayout>
        <HealthBackground />

        {/* Symptom Probe Panel Modal */}
        {probeSymptom && (
          <ProbePanel
            symptom={probeSymptom}
            messages={probeMessages}
            loading={probeLoading}
            done={probeDone}
            input={probeInput}
            onInputChange={setProbeInput}
            onSend={sendProbeMessage}
            onClose={closeProbe}
            chatEndRef={probeChatEndRef}
          />
        )}

        <div className="relative z-10 max-w-2xl mx-auto px-4 py-6 space-y-4">

          {/* Header */}
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-md p-4">
            <div className="flex items-center gap-3">
              <button onClick={() => { setMode('patient-detail'); }} className="text-gray-400 hover:text-gray-700 p-1"><ArrowLeft size={20}/></button>
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${pg.colour} flex items-center justify-center text-xl`}>{pg.emoji}</div>
              <div>
                <h2 className="text-base font-bold text-gray-900">Assessment — {patient.patient_name}</h2>
                <p className="text-xs text-gray-500">{patient.village} · {pg.label}</p>
              </div>
            </div>
          </div>

          {/* Danger sign banner */}
          {hasDangerSign() && (
            <div className="bg-red-600 text-white rounded-xl p-4 flex items-start gap-3 animate-pulse">
              <AlertTriangle size={20} className="flex-shrink-0 mt-0.5"/>
              <div>
                <p className="font-bold">⚠️ DANGER SIGN DETECTED</p>
                <p className="text-sm opacity-90">At least one IMCI danger sign is present. This patient likely requires IMMEDIATE RED referral. Run AI triage and contact your supervising health worker now.</p>
              </div>
            </div>
          )}

          {/* Chief complaint */}
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-md p-5">
            <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2"><FileText size={15} className="text-blue-600"/> Chief Complaint</h3>
            <textarea value={assessment.chiefComplaint} onChange={e => setField('chiefComplaint', e.target.value)} rows={2}
              placeholder="Main reason for this visit — what the patient/caregiver says in their own words…"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"/>
          </div>

          {/* Vitals */}
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-md p-5">
            <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2"><Thermometer size={15} className="text-blue-600"/> Vital Signs</h3>
            <div className="space-y-3">
              {/* Temp */}
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <label className="text-xs font-semibold text-gray-600 flex items-center mb-1">
                    Temperature (°C)
                    <InfoTooltip id="tempC" text={VITAL_TOOLTIPS.tempC} open={openTooltip === 'tempC'} onToggle={() => setOpenTooltip(openTooltip === 'tempC' ? null : 'tempC')}/>
                  </label>
                  <input type="number" step="0.1" value={assessment.tempC} onChange={e => setField('tempC', e.target.value)} placeholder="e.g. 38.2"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"/>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">Method</label>
                  <select value={assessment.tempMethod} onChange={e => setField('tempMethod', e.target.value as AssessmentData['tempMethod'])}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400">
                    <option value="axillary">Axillary</option>
                    <option value="oral">Oral</option>
                    <option value="rectal">Rectal</option>
                  </select>
                </div>
                {assessment.tempC && (
                  <div className="text-xs font-bold mt-4 px-2 py-1 rounded-lg">
                    {Number(assessment.tempC) >= 39.0 ? <span className="text-red-600">🔴 High</span>
                      : Number(assessment.tempC) >= 37.5 ? <span className="text-yellow-600">🟡 Fever</span>
                      : <span className="text-green-600">🟢 Normal</span>}
                  </div>
                )}
              </div>
              {/* RR */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600 flex items-center mb-1">
                    Respiratory Rate (breaths/min)
                    <InfoTooltip id="rr" text={VITAL_TOOLTIPS.respiratoryRate} open={openTooltip === 'rr'} onToggle={() => setOpenTooltip(openTooltip === 'rr' ? null : 'rr')}/>
                  </label>
                  <input type="number" value={assessment.respiratoryRate} onChange={e => setField('respiratoryRate', e.target.value)} placeholder="Count 60 sec"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"/>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 flex items-center mb-1">
                    Pulse (bpm)
                    <InfoTooltip id="pulse" text={VITAL_TOOLTIPS.pulseRate} open={openTooltip === 'pulse'} onToggle={() => setOpenTooltip(openTooltip === 'pulse' ? null : 'pulse')}/>
                  </label>
                  <input type="number" value={assessment.pulseRate} onChange={e => setField('pulseRate', e.target.value)} placeholder="e.g. 96"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"/>
                </div>
              </div>
              {/* BP */}
              {!isChild && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-600 flex items-center mb-1">
                      BP Systolic (mmHg)
                      <InfoTooltip id="bpSys" text={VITAL_TOOLTIPS.bpSystolic} open={openTooltip === 'bpSys'} onToggle={() => setOpenTooltip(openTooltip === 'bpSys' ? null : 'bpSys')}/>
                    </label>
                    <input type="number" value={assessment.bpSystolic} onChange={e => setField('bpSystolic', e.target.value)} placeholder="e.g. 130"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"/>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 flex items-center mb-1">
                      BP Diastolic (mmHg)
                      <InfoTooltip id="bpDia" text={VITAL_TOOLTIPS.bpDiastolic} open={openTooltip === 'bpDia'} onToggle={() => setOpenTooltip(openTooltip === 'bpDia' ? null : 'bpDia')}/>
                    </label>
                    <input type="number" value={assessment.bpDiastolic} onChange={e => setField('bpDiastolic', e.target.value)} placeholder="e.g. 85"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"/>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Anthropometry */}
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-md p-5">
            <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2"><Activity size={15} className="text-blue-600"/> Measurements</h3>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Weight (kg)</label>
                <input type="number" step="0.1" value={assessment.weightKg} onChange={e => setField('weightKg', e.target.value)} placeholder="e.g. 12.5"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"/>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Height (cm)</label>
                <input type="number" step="0.1" value={assessment.heightCm} onChange={e => setField('heightCm', e.target.value)} placeholder="e.g. 95"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"/>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">MUAC (cm)</label>
                <div className="relative">
                  <input type="number" step="0.1" value={assessment.muacCm} onChange={e => setField('muacCm', e.target.value)} placeholder="e.g. 13.0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"/>
                  {assessment.muacCm && isChild && (
                    <div className="text-xs font-bold mt-1 text-center">
                      {Number(assessment.muacCm) < 11.5 ? <span className="text-red-600">🔴 SAM</span>
                        : Number(assessment.muacCm) < 12.5 ? <span className="text-yellow-600">🟡 MAM</span>
                        : <span className="text-green-600">🟢 OK</span>}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Danger signs */}
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-md p-5">
            <h3 className="text-sm font-bold text-red-700 mb-3 flex items-center gap-2"><AlertTriangle size={15}/> General Danger Signs (IMCI)</h3>
            <p className="text-xs text-gray-500 mb-3">ANY one = potential RED classification</p>
            <div className="space-y-2">
              <CheckRow label="Convulsions (now or in this illness)" checked={assessment.convulsions} onChange={v => setField('convulsions', v)} danger/>
              <CheckRow label="Unconscious / cannot be woken" checked={assessment.unconscious} onChange={v => setField('unconscious', v)} danger/>
              <CheckRow label="Unable to drink or feed" checked={assessment.unableToFeed} onChange={v => setField('unableToFeed', v)} danger/>
              <CheckRow label="Vomits everything" checked={assessment.vomitsEverything} onChange={v => setField('vomitsEverything', v)} danger/>
            </div>
          </div>

          {/* Symptoms */}
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-md p-5">
            <h3 className="text-sm font-bold text-gray-800 mb-1 flex items-center gap-2"><Stethoscope size={15} className="text-blue-600"/> Symptoms & Signs</h3>
            <p className="text-xs text-gray-400 mb-3 flex items-center gap-1"><span className="text-indigo-500 font-bold">🔍 Probe</span> — tap after checking a symptom to interview the patient in depth</p>
            <div className="space-y-2">
              <CheckRow label="Fever" checked={assessment.fever} onChange={v => setField('fever', v)}
                tooltip={SYMPTOM_TOOLTIPS.fever} tooltipOpen={openTooltip === 'fever'} onTooltipToggle={() => setOpenTooltip(openTooltip === 'fever' ? null : 'fever')}
                onProbe={() => openProbe('fever', 'Fever')} probeActive={probeSymptom === 'Fever'}
                subField={<input type="text" value={assessment.feverDays} onChange={e => setField('feverDays', e.target.value)} placeholder="Days of fever" className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"/>}/>
              <CheckRow label="Cough" checked={assessment.cough} onChange={v => setField('cough', v)}
                tooltip={SYMPTOM_TOOLTIPS.cough} tooltipOpen={openTooltip === 'cough'} onTooltipToggle={() => setOpenTooltip(openTooltip === 'cough' ? null : 'cough')}
                onProbe={() => openProbe('cough', 'Cough')} probeActive={probeSymptom === 'Cough'}
                subField={<input type="text" value={assessment.coughDays} onChange={e => setField('coughDays', e.target.value)} placeholder="Days of cough" className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"/>}/>
              <CheckRow label="Chest indrawing (lower chest pulls in when breathing)" checked={assessment.chestIndrawing} onChange={v => setField('chestIndrawing', v)} danger
                tooltip={SYMPTOM_TOOLTIPS.chestIndrawing} tooltipOpen={openTooltip === 'chestIndrawing'} onTooltipToggle={() => setOpenTooltip(openTooltip === 'chestIndrawing' ? null : 'chestIndrawing')}
                onProbe={() => openProbe('chestIndrawing', 'Chest Indrawing')} probeActive={probeSymptom === 'Chest Indrawing'}/>
              <CheckRow label="Diarrhoea" checked={assessment.diarrhoea} onChange={v => setField('diarrhoea', v)}
                tooltip={SYMPTOM_TOOLTIPS.diarrhoea} tooltipOpen={openTooltip === 'diarrhoea'} onTooltipToggle={() => setOpenTooltip(openTooltip === 'diarrhoea' ? null : 'diarrhoea')}
                onProbe={() => openProbe('diarrhoea', 'Diarrhoea')} probeActive={probeSymptom === 'Diarrhoea'}
                subField={
                  <div className="space-y-1">
                    <input type="text" value={assessment.diarrhoeaDays} onChange={e => setField('diarrhoeaDays', e.target.value)} placeholder="Days of diarrhoea" className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"/>
                    <label className="flex items-center gap-2 text-xs text-gray-700">
                      <input type="checkbox" checked={assessment.bloodInStool} onChange={e => setField('bloodInStool', e.target.checked)} className="accent-blue-600"/>
                      Blood in stool
                    </label>
                  </div>
                }/>
              <CheckRow label="Vomiting" checked={assessment.vomiting} onChange={v => setField('vomiting', v)}
                tooltip={SYMPTOM_TOOLTIPS.vomiting} tooltipOpen={openTooltip === 'vomiting'} onTooltipToggle={() => setOpenTooltip(openTooltip === 'vomiting' ? null : 'vomiting')}
                onProbe={() => openProbe('vomiting', 'Vomiting')} probeActive={probeSymptom === 'Vomiting'}/>
              <CheckRow label="Palmar pallor (pale palms)" checked={assessment.palmarPallor} onChange={v => setField('palmarPallor', v)}
                tooltip={SYMPTOM_TOOLTIPS.palmarPallor} tooltipOpen={openTooltip === 'palmarPallor'} onTooltipToggle={() => setOpenTooltip(openTooltip === 'palmarPallor' ? null : 'palmarPallor')}
                onProbe={() => openProbe('palmarPallor', 'Palmar Pallor')} probeActive={probeSymptom === 'Palmar Pallor'}/>
              <CheckRow label="Stiff neck" checked={assessment.stiffNeck} onChange={v => setField('stiffNeck', v)} danger
                tooltip={SYMPTOM_TOOLTIPS.stiffNeck} tooltipOpen={openTooltip === 'stiffNeck'} onTooltipToggle={() => setOpenTooltip(openTooltip === 'stiffNeck' ? null : 'stiffNeck')}
                onProbe={() => openProbe('stiffNeck', 'Stiff Neck')} probeActive={probeSymptom === 'Stiff Neck'}/>
              <CheckRow label="Jaundice (yellow eyes)" checked={assessment.eyeJaundice} onChange={v => setField('eyeJaundice', v)}
                tooltip={SYMPTOM_TOOLTIPS.eyeJaundice} tooltipOpen={openTooltip === 'eyeJaundice'} onTooltipToggle={() => setOpenTooltip(openTooltip === 'eyeJaundice' ? null : 'eyeJaundice')}
                onProbe={() => openProbe('eyeJaundice', 'Jaundice')} probeActive={probeSymptom === 'Jaundice'}/>
              <CheckRow label="Oedema (swelling — feet, legs, face)" checked={assessment.oedema} onChange={v => setField('oedema', v)}
                tooltip={SYMPTOM_TOOLTIPS.oedema} tooltipOpen={openTooltip === 'oedema'} onTooltipToggle={() => setOpenTooltip(openTooltip === 'oedema' ? null : 'oedema')}
                onProbe={() => openProbe('oedema', 'Oedema')} probeActive={probeSymptom === 'Oedema'}/>
            </div>
          </div>

          {/* Physical Observation */}
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-md p-5">
            <h3 className="text-sm font-bold text-gray-800 mb-1 flex items-center gap-2">👁️ Physical Observation</h3>
            <p className="text-xs text-gray-400 mb-3">Look at the patient carefully. These observations do not require equipment.</p>
            <div className="space-y-3">
              {[
                { key: 'obs_appearance', label: 'General appearance', prompt: 'Does the patient look well, unwell, or very sick? Are they alert, drowsy, or difficult to wake?' },
                { key: 'obs_breathing', label: 'Breathing pattern', prompt: 'Is breathing fast, laboured, or noisy? Can you hear wheezing or grunting? Any nasal flaring?' },
                { key: 'obs_skin', label: 'Skin & eyes', prompt: 'Is the skin pale, yellow, or grey? Are the eyes sunken or yellow? Any rashes or wounds?' },
                { key: 'obs_hydration', label: 'Hydration signs', prompt: 'Pinch the skin on the belly — does it spring back immediately? Are the lips dry? Is the child crying without tears?' },
              ].map(obs => (
                <div key={obs.key}>
                  <label className="text-xs font-semibold text-gray-600 flex items-center gap-1 mb-1">
                    {obs.label}
                    <InfoTooltip id={obs.key} text={obs.prompt} open={openTooltip === obs.key} onToggle={() => setOpenTooltip(openTooltip === obs.key ? null : obs.key)}/>
                  </label>
                  <input
                    type="text"
                    placeholder={obs.prompt}
                    value={(assessment as any)[obs.key] || ''}
                    onChange={e => setField(obs.key as any, e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Malaria */}
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-md p-5">
            <h3 className="text-sm font-bold text-amber-700 mb-3 flex items-center gap-2">🦟 Malaria Assessment</h3>
            <div className="space-y-2">
              <CheckRow label="Malaria suspected" checked={assessment.malariaSuspected} onChange={v => setField('malariaSuspected', v)}/>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">RDT Result</label>
                <div className="flex gap-2">
                  {(['positive', 'negative', 'not_done'] as const).map(val => (
                    <button key={val} onClick={() => setField('rdt', val)}
                      className={classNames('flex-1 py-2 text-xs font-bold rounded-lg border transition-colors', assessment.rdt === val
                        ? val === 'positive' ? 'bg-red-600 text-white border-red-600'
                          : val === 'negative' ? 'bg-green-600 text-white border-green-600'
                          : 'bg-gray-600 text-white border-gray-600'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400')}>
                      {val === 'positive' ? '+ Positive' : val === 'negative' ? '– Negative' : 'Not done'}
                    </button>
                  ))}
                </div>
              </div>
              <CheckRow label="Patient uses bednet regularly" checked={assessment.recentBednetUse} onChange={v => setField('recentBednetUse', v)}/>
            </div>
          </div>

          {/* Additional notes */}
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-md p-5">
            <h3 className="text-sm font-bold text-gray-800 mb-2">Additional Notes</h3>
            <textarea value={assessment.additionalNotes} onChange={e => setField('additionalNotes', e.target.value)} rows={3}
              placeholder="Any other observations, caregiver history, context…"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"/>
          </div>

          {/* AI Triage */}
          {!triageResult ? (
            <button onClick={runTriage} disabled={isTriaging || !assessment.chiefComplaint.trim()}
              className={classNames('w-full py-4 rounded-xl font-bold text-white text-base transition-opacity flex items-center justify-center gap-2',
                !isTriaging && assessment.chiefComplaint.trim() ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-90' : 'bg-gray-300 cursor-not-allowed')}>
              {isTriaging ? <><Loader2 size={18} className="animate-spin"/>Running AI Triage…</> : <><Stethoscope size={18}/>Run AI Triage Classification</>}
            </button>
          ) : (
            <div className={classNames('bg-white/95 backdrop-blur-sm rounded-2xl shadow-md p-5 border-2', TRIAGE_CONFIG[triageResult.level].border)}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">AI Triage Result</p>
                  <div className="text-2xl font-black">{triageBadge(triageResult.level)}</div>
                  <p className="text-xs text-gray-500 mt-1">{TRIAGE_CONFIG[triageResult.level].description}</p>
                </div>
                <button onClick={() => { setTriageResult(null); runTriage(); }} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                  <RefreshCw size={12}/> Re-run
                </button>
              </div>
              <div className="text-sm text-gray-800 bg-gray-50 rounded-xl px-4 py-3 max-h-64 overflow-y-auto">
                <MarkdownText text={triageResult.summary}/>
              </div>

              {/* Save section */}
              <div className="mt-4 space-y-3 border-t pt-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Actions taken by navigator</label>
                  <textarea value={navigatorActions} onChange={e => setNavigatorActions(e.target.value)} rows={2}
                    placeholder="e.g. Gave ORS, explained referral plan to caregiver, wrote referral note…"
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"/>
                </div>
                <div className="flex items-center gap-3">
                  <input type="checkbox" id="followup" checked={followUpNeeded} onChange={e => setFollowUpNeeded(e.target.checked)} className="w-4 h-4 accent-blue-600"/>
                  <label htmlFor="followup" className="text-sm font-semibold text-gray-700">Follow-up needed</label>
                </div>
                {followUpNeeded && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Follow-up date</label>
                      <input type="date" value={followUpDate} onChange={e => setFollowUpDate(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"/>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">What to check</label>
                      <input value={followUpNotes} onChange={e => setFollowUpNotes(e.target.value)} placeholder="e.g. Check fever resolved"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"/>
                    </div>
                  </div>
                )}
                {assessmentSaved ? (
                  <div className="flex items-center gap-2 text-blue-700 font-semibold text-sm bg-blue-50 rounded-xl px-4 py-3">
                    <CheckCircle size={16}/> Assessment saved to {patient.patient_name}'s record.
                  </div>
                ) : (
                  <button onClick={saveAssessment} disabled={savingAssessment}
                    className="w-full py-3 rounded-xl font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-90 disabled:opacity-50">
                    {savingAssessment ? <span className="flex items-center justify-center gap-2"><Loader2 size={15} className="animate-spin"/>Saving…</span> : 'Save Assessment Record'}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Clinical disclaimer */}
          <div className="bg-white/70 backdrop-blur-sm rounded-xl px-4 py-3 flex items-start gap-2">
            <ShieldCheck size={14} className="text-blue-700 flex-shrink-0 mt-0.5"/>
            <p className="text-xs text-gray-600">This AI triage is clinical decision <strong>support only</strong>. Always follow your training and supervision protocols. Contact your supervising health worker for any RED or uncertain case.</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // RENDER: FOLLOW-UP CHAT
  // ════════════════════════════════════════════════════════════════════════════

  if (mode === 'followup-chat' && selectedPatient && selectedAssessment) {
    const patient = selectedPatient;
    const assess = selectedAssessment;
    const tc = TRIAGE_CONFIG[assess.triage_level];
    const userTurns = messages.filter(m => m.role === 'user').length;

    return (
      <AppLayout>
        <HealthBackground />
        <div className="relative z-10 max-w-2xl mx-auto px-4 py-6">
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-md p-4 mb-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <button onClick={() => { window.speechSynthesis.cancel(); setMode('patient-detail'); }} className="text-gray-400 hover:text-gray-700 p-1"><ArrowLeft size={20}/></button>
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-lg">🏥</div>
                <div>
                  <h2 className="text-base font-bold text-gray-900">Follow-up Questions</h2>
                  <p className="text-xs text-gray-500">{patient.patient_name} · {triageBadge(assess.triage_level)}</p>
                </div>
              </div>
              <button onClick={() => { setSpeechOn(s => !s); if (speechOn) window.speechSynthesis.cancel(); }}
                className={classNames('p-2 rounded-lg', speechOn ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-400')}>
                {speechOn ? <Volume2 size={15}/> : <VolumeX size={15}/>}
              </button>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-sm rounded-xl px-4 py-2.5 mb-4 flex items-center gap-2">
            <Lightbulb size={14} className="text-blue-700 flex-shrink-0"/>
            <p className="text-xs text-gray-700">Ask about the triage, how to explain it to the patient, referral logistics, or any clinical question within your navigator scope.</p>
          </div>

          <div className="bg-white rounded-2xl shadow-lg mb-4 flex flex-col" style={{ height: '460px' }}>
            <div className="flex items-center justify-between px-5 py-3 border-b bg-gray-50 rounded-t-2xl text-xs text-gray-500">
              <span className="font-semibold text-gray-700 flex items-center gap-1.5">🏥 Clinical AI Advisor</span>
              <span>{userTurns} exchange{userTurns !== 1 ? 's' : ''}</span>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {messages.map(msg => (
                <div key={msg.id} className={classNames('flex items-start gap-3', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                  {msg.role === 'assistant' && (
                    <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-lg">🏥</div>
                  )}
                  <div className={classNames('max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed',
                    msg.role === 'user' ? 'bg-blue-600 text-white rounded-tr-sm' : 'bg-gray-100 text-gray-900 rounded-tl-sm')}>
                    {msg.role === 'assistant' && <p className="text-xs font-bold mb-1 opacity-50">AI Clinical Advisor</p>}
                    {msg.role === 'user' && <p className="text-xs font-bold mb-1 opacity-75">You (Navigator)</p>}
                    <MarkdownText text={msg.content}/>
                  </div>
                  {msg.role === 'user' && (
                    <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center">
                      <User size={15} className="text-white"/>
                    </div>
                  )}
                </div>
              ))}
              {isSending && (
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-lg">🏥</div>
                  <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3">
                    <div className="flex gap-1.5 items-center h-4">{[0, 150, 300].map(d => <div key={d} className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: `${d}ms` }}/>)}</div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef}/>
            </div>
            <div className="border-t p-4 rounded-b-2xl">
              <div className="flex items-end gap-2">
                <textarea ref={inputRef} value={inputText} onChange={e => setInputText(e.target.value)} onKeyDown={handleKeyDown} rows={2}
                  placeholder="Ask a follow-up clinical question…"
                  disabled={isSending}
                  className="flex-1 px-4 py-3 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none leading-relaxed disabled:opacity-50"/>
                <div className="flex flex-col gap-2">
                  <button onClick={toggleListening}
                    className={classNames('p-2.5 rounded-xl transition-all', isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-100 text-gray-500 hover:bg-gray-200')}>
                    {isListening ? <MicOff size={16}/> : <Mic size={16}/>}
                  </button>
                  <button onClick={sendMessage} disabled={!inputText.trim() || isSending}
                    className={classNames('p-2.5 rounded-xl transition-all',
                      inputText.trim() && !isSending ? 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white hover:opacity-90' : 'bg-gray-100 text-gray-400 cursor-not-allowed')}>
                    <Send size={16}/>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // RENDER: CASE DETAIL
  // ════════════════════════════════════════════════════════════════════════════

  if (mode === 'case-detail' && selectedAssessment && selectedPatient) {
    const a = selectedAssessment;
    const tc = TRIAGE_CONFIG[a.triage_level];
    return (
      <AppLayout>
        <HealthBackground />
        <div className="relative z-10 max-w-2xl mx-auto px-4 py-6 space-y-4">
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-md p-5">
            <div className="flex items-center gap-3 mb-4">
              <button onClick={() => setMode('patient-detail')} className="text-gray-400 hover:text-gray-700 p-1"><ArrowLeft size={20}/></button>
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-2xl">🏥</div>
              <div className="flex-1">
                <h2 className="text-base font-bold text-gray-900">Assessment — {selectedPatient.patient_name}</h2>
                <p className="text-xs text-gray-500">{formatDate(a.created_at)}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                {triageBadge(a.triage_level)}
                {a.resolved
                  ? <span className="text-xs text-green-600 font-semibold flex items-center gap-1"><CheckCircle size={11}/> Resolved</span>
                  : <span className="text-xs text-orange-600 font-semibold">Open</span>}
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Chief Complaint</p>
                <p className="text-sm text-gray-800 bg-gray-50 rounded-lg px-3 py-2">{a.assessment_data.chiefComplaint || 'Not recorded'}</p>
              </div>

              {/* Key vitals summary */}
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Vitals Recorded</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Temp', value: a.assessment_data.tempC ? `${a.assessment_data.tempC}°C` : '—' },
                    { label: 'RR', value: a.assessment_data.respiratoryRate ? `${a.assessment_data.respiratoryRate}/min` : '—' },
                    { label: 'Pulse', value: a.assessment_data.pulseRate ? `${a.assessment_data.pulseRate} bpm` : '—' },
                    { label: 'BP', value: a.assessment_data.bpSystolic ? `${a.assessment_data.bpSystolic}/${a.assessment_data.bpDiastolic}` : '—' },
                    { label: 'Weight', value: a.assessment_data.weightKg ? `${a.assessment_data.weightKg} kg` : '—' },
                    { label: 'MUAC', value: a.assessment_data.muacCm ? `${a.assessment_data.muacCm} cm` : '—' },
                  ].map(v => (
                    <div key={v.label} className="flex justify-between bg-gray-50 rounded-lg px-3 py-1.5 text-sm">
                      <span className="text-gray-500 font-medium">{v.label}</span>
                      <span className="font-bold text-gray-900">{v.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {a.ai_triage_summary && (
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">AI Triage Summary</p>
                  <div className={classNames('text-sm text-gray-800 rounded-lg px-3 py-2 max-h-48 overflow-y-auto border', tc.bg, tc.border)}>
                    <MarkdownText text={a.ai_triage_summary}/>
                  </div>
                </div>
              )}
              {a.navigator_actions && (
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Actions Taken</p>
                  <p className="text-sm text-gray-800 bg-blue-50 rounded-lg px-3 py-2">{a.navigator_actions}</p>
                </div>
              )}
              {a.follow_up_needed && (
                <div className="flex items-start gap-2 text-blue-700 bg-blue-50 rounded-lg px-3 py-2">
                  <Calendar size={14} className="mt-0.5 flex-shrink-0"/>
                  <div>
                    <p className="text-sm font-semibold">Follow-up{a.follow_up_date ? `: ${formatDate(a.follow_up_date)}` : ' needed'}</p>
                    {a.follow_up_notes && <p className="text-xs mt-0.5">{a.follow_up_notes}</p>}
                  </div>
                </div>
              )}
              <div className="flex gap-2">
                <button onClick={() => openFollowupChat(selectedPatient, a)}
                  className="flex-1 py-2.5 text-sm font-bold rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100">
                  Ask AI Follow-up
                </button>
                {!a.resolved && (
                  <button onClick={async () => { await markResolved(a.id); setSelectedAssessment({ ...a, resolved: true }); }}
                    className="flex-1 py-2.5 text-sm font-bold rounded-xl text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-90">
                    Mark Resolved ✓
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  return null;
};

// RefreshCw alias (was inline in original)
const RefreshCw: React.FC<{ size?: number; className?: string }> = ({ size = 16, className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
  </svg>
);

export default HealthcareNavigatorPage;