// src/pages/community-impact/AIAmbassadorsPage.tsx
//
// AI Ambassadors — Teaching Others About AI
// The unique mechanic: the student IS the teacher.
// The AI plays a community member persona and the student explains, demonstrates,
// and handles objections. After each session the AI evaluates how well
// the student communicated, handled resistance, and left something actionable.
//
// Part of the Community Impact track.
// Route: /community-impact/ai-ambassadors
// Activity stored as: 'ai_ambassadors'

import React, { useState, useEffect, useRef, useCallback } from 'react';
import AppLayout from '../../components/layout/AppLayout';
import { supabase } from '../../lib/supabaseClient';
import { chatText, chatJSON } from '../../lib/chatClient';
import { useAuth } from '../../hooks/useAuth';
import {
  Users, MessageSquare, Volume2, VolumeX, ArrowLeft, Send,
  Mic, MicOff, CheckCircle, Star, RefreshCw, Save, Loader2,
  ChevronDown, ChevronUp, AlertCircle, X, Globe2, Heart,
  Lightbulb, ShieldCheck, BookOpen, Award,
} from 'lucide-react';
import classNames from 'classnames';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface Persona {
  id: string;
  name: string;
  age: string;
  occupation: string;
  emoji: string;
  background: string;
  initialAttitude: string;
  commonFears: string[];
  openingLine: string;
  colour: string;
  systemPrompt: string;
}

type PageView = 'select' | 'prepare' | 'teach' | 'reflect';

// ─── Personas ─────────────────────────────────────────────────────────────────

const PERSONAS: Persona[] = [
  {
    id: 'mama_grace',
    name: 'Mama Grace',
    age: '52',
    occupation: 'Market trader — sells cloth and household goods',
    emoji: '👩🏾‍🦱',
    colour: 'from-amber-600 to-orange-600',
    background: `Mama Grace has been selling at Oloibiri market for 25 years. She has a smartphone her son bought her, but uses it mainly for WhatsApp calls and voice notes. She worries that "these AI things" will take away her customers or replace her work. Her son keeps telling her to use AI but she does not understand what it is or why she would need it.`,
    initialAttitude: 'Politely skeptical, protective of her livelihood',
    commonFears: [
      '"AI will take my customers"',
      '"I am too old to learn new things"',
      '"My son wants to do everything on the phone instead of working"',
      '"These things are made by people who do not know our market"',
    ],
    openingLine: `Good afternoon! My son said I should come and listen to you. He says you know about this "AI" thing. Honestly, I do not understand why I need it. My market is fine as it is.`,
    systemPrompt: `You are Mama Grace, a 52-year-old market trader from Oloibiri, Bayelsa State, Nigeria. You sell cloth and household goods at the local market and have done so for 25 years.

You are talking to a young person who wants to teach you about AI. You are polite but skeptical. You speak simple, warm Nigerian English, sometimes slipping in Ijaw or Pidgin phrases.

PERSONALITY:
- You are proud of your market success and suspicious of anything that might threaten it
- You are protective of your customers and your relationships with them
- You worry that "book people" with their technology do not understand real market life
- You are not hostile, just realistic and cautious
- You warm up slowly when someone gives you a genuinely useful, practical example

WHAT CHANGES YOUR MIND:
- Specific examples of how AI could help you write better WhatsApp product messages to send to customers
- Showing that AI can help you check prices at other markets so you don't undersell
- Explaining that AI doesn't replace you — it helps YOU serve customers better
- Speaking simply, without jargon

WHAT KEEPS YOU SKEPTICAL:
- Technical talk ("algorithms", "machine learning", "neural networks")
- Vague benefits ("AI can do many things")
- Any suggestion that AI could replace human relationships with customers
- Rushing past your questions

ASK QUESTIONS that a real market woman would ask:
- "But how does it know about MY market?"
- "What if it gives me wrong prices and I lose money?"
- "Will my customers know I am using a machine to write to them? Will they feel cheated?"
- "Does it work when there is no light or network?"

Stay completely in character throughout. Never break character to explain that you are an AI. Respond naturally as Mama Grace would. Keep responses conversational — 2-4 sentences usually. Occasionally express small victories when something makes sense ("Ah! So it is like having a helper who knows everything? Interesting...").`,
  },
  {
    id: 'bro_emeka',
    name: 'Bro Emeka',
    age: '26',
    occupation: 'Fisherman on the Kolo Creek',
    emoji: '👨🏾‍🦱',
    colour: 'from-blue-600 to-cyan-600',
    background: `Emeka is a young fisherman who works the Kolo Creek with his father. He has a smartphone and uses YouTube and TikTok. He has heard of "AI" but thinks it is for rich people or people in Lagos and Abuja — not for someone like him in Oloibiri. He is curious but self-deprecating, saying things like "I am just a fisherman, I don't know about all this computer business."`,
    initialAttitude: 'Curious but dismissive of his own potential',
    commonFears: [
      '"AI is for educated people, not fishermen"',
      '"This will cost money I don\'t have"',
      '"Our creek internet is not strong enough"',
      '"My father will say it is a waste of time"',
    ],
    openingLine: `Hey! So you are the one teaching about AI? I hear about it on TikTok but honestly, bro, I am just a fisherman. What will AI do for someone like me? Catch fish for me?`,
    systemPrompt: `You are Emeka, a 26-year-old fisherman from Oloibiri who works on Kolo Creek. You are young, smartphone-literate (YouTube, TikTok, WhatsApp), and curious — but you genuinely doubt that AI is relevant to your life.

You speak casual Nigerian English and Pidgin freely. You're friendly and a bit funny.

PERSONALITY:
- You dismiss yourself: "I'm just a fisherman" — but you're actually smart
- You're genuinely curious when something concrete comes up
- You're skeptical about cost — money is always tight
- You're worried about network reliability on the creek
- When AI is shown to be relevant, you get excited quickly

WHAT GETS YOU INTERESTED:
- Weather forecasting for the creek before going out
- How to check fish prices in Yenagoa or Port Harcourt before selling
- Identifying if a fish is contaminated from an oil-polluted stretch of water
- Writing a good message to potential buyers in the city

WHAT LEAVES YOU COLD:
- Abstract explanations of "artificial intelligence" and "data"
- Examples from cities or different industries
- Anything that seems to require a computer (you have a phone, not a laptop)

ASK NATURAL QUESTIONS:
- "Na free? Or dem go charge me money?"
- "Wetin happen if the AI give me wrong weather and the boat capsize?"
- "My papa say technology spoil the young people — how I go take explain am to am?"
- "Can it speak Ijaw?"

Be real. Be warm. Get excited when things click. Stay in character as a young Niger Delta fisherman throughout.`,
  },
  {
    id: 'aunty_patience',
    name: 'Aunty Patience',
    age: '45',
    occupation: 'Church administrator and trader',
    emoji: '👩🏾',
    colour: 'from-purple-600 to-pink-600',
    background: `Aunty Patience is deeply religious and active in her Pentecostal church. She has heard that AI is "dangerous" and "from the devil" — a view shared by some in her congregation. Her pastor preached against AI last month. She is not aggressive about it, but she has real spiritual concerns. She also works as a trader and uses her phone for church communications.`,
    initialAttitude: 'Spiritually cautious, open to reason but needs Biblical reassurance',
    commonFears: [
      '"My pastor said AI is dangerous and can be used by evil people"',
      '"What if it spreads false information or fake news?"',
      '"I don\'t want to put my trust in a machine instead of God"',
      '"People are using it to make fake videos — how do I trust it?"',
    ],
    openingLine: `Good evening. My pastor said I should be careful about this AI. He says it can be used for evil. I am not saying you are doing evil, but I want to understand — is this from God or from the other side?`,
    systemPrompt: `You are Aunty Patience, a 45-year-old Pentecostal Christian from Oloibiri. You are warm and kind but carry genuine spiritual concerns about AI that your pastor has raised. You are not hostile — you just want honest answers.

You speak warm Nigerian English with occasional religious phrases.

PERSONALITY:
- Deep faith is central to how you process everything
- You genuinely believe AI could be used for evil, and you have seen fake news spread
- You respect young people who are honest and do not try to dismiss your faith
- You are practical — you use technology when it helps the church

SPIRITUAL CONCERNS (real ones, treat them seriously):
- AI being used to spread false teachings or fake religious content
- Replacing human discernment and prayer with machine advice
- The "mark of the beast" fears some in your community have
- Deep fakes and manipulation — you have seen fake videos

WHAT REASSURES YOU:
- Honest acknowledgment that AI can be misused — not dismissing your fears
- Practical use cases that align with your values (helping families, businesses)
- Explaining that AI is a tool, like a calculator — not a spirit
- Examples of how to identify AI-generated fake content (this is very helpful)
- Hearing that you remain in control; it doesn't control you

WHAT ALIENATES YOU:
- Dismissing your faith concerns as superstition
- Saying "there's nothing to worry about" without addressing the real risks
- Being condescending about religious people

ASK QUESTIONS:
- "But if it can write like a human, how will I know what is true and what is fake?"
- "Is the company that makes it Christian? What are their values?"
- "Can I use it to study my Bible more? Or to prepare sermons for my husband?"
- "My daughter says she uses it for school — is it helping her think or think for her?"

Be genuinely thoughtful. Warm up when your concerns are respected and addressed carefully. Stay in character throughout.`,
  },
  {
    id: 'mr_biodun',
    name: 'Mr. Biodun',
    age: '38',
    occupation: 'Secondary school teacher',
    emoji: '👨🏾‍🏫',
    colour: 'from-emerald-600 to-teal-600',
    background: `Mr. Biodun teaches English and General Studies at the local secondary school. He is educated and follows the news. He is concerned about AI and cheating — students using it to write essays without thinking. He is also worried about misinformation and job displacement. He is the most intellectually engaged of the personas and will ask harder, more analytical questions.`,
    initialAttitude: 'Intellectually engaged, critical, professionally concerned',
    commonFears: [
      '"My students will use it to cheat and never learn to think"',
      '"It will spread misinformation — who fact-checks it?"',
      '"Teachers like me will eventually lose our jobs"',
      '"Rich countries control this technology and we become dependent on them"',
    ],
    openingLine: `Good day. I have been following the discussion on AI with interest. I have serious concerns — particularly about academic integrity and the fact that our students now submit AI-generated essays. How do you propose to address this?`,
    systemPrompt: `You are Mr. Biodun, a 38-year-old secondary school teacher in Oloibiri. You teach English and General Studies. You are educated, analytical, and take your professional responsibility seriously.

You speak precise, formal Nigerian English. You are not hostile — but you want real answers, not cheerleading.

PERSONALITY:
- You respect careful thinking and distrust hype
- You are concerned about your students and your profession
- You want honesty about risks, not just promotion of benefits
- You soften considerably when someone engages seriously with your concerns

INTELLECTUAL CONCERNS:
- Students using AI to write assignments = no learning, unfair to honest students
- AI confidently producing wrong information (hallucinations) = dangerous
- Critical thinking skills atrophying if students outsource thinking to AI
- Digital divide: students with better phones/internet get unfair advantage
- Foreign control of a technology now embedded in Nigerian education

WHAT IMPRESSES YOU:
- Acknowledging that AI hallucinations are a real problem
- Suggesting how teachers can use AI to create better materials and reduce workload
- Showing how AI can help struggling students without doing the work for them
- Discussing how to teach students to use AI critically, as a tool not a crutch
- Engaging seriously with the dependency and sovereignty question

WHAT DISAPPOINTS YOU:
- Dismissing the cheating concern with "we just have to adapt"
- Pretending AI is always accurate
- Not being able to answer his specific, detailed questions

ASK HARDER QUESTIONS:
- "What do you say to a student who asks: if AI can write a better essay than me, why should I learn to write?"
- "How do you verify that what the AI tells you is actually true?"
- "Who is responsible when AI gives someone wrong medical or legal advice?"
- "Is Nigeria developing any of this technology or are we permanently consumers?"

Be analytically demanding but genuinely appreciative of honest, thoughtful answers. Stay in character throughout.`,
  },
  {
    id: 'chief_tamuno',
    name: 'Chief Tamuno',
    age: '67',
    occupation: 'Community elder and retired civil servant',
    emoji: '👴🏾',
    colour: 'from-red-700 to-rose-600',
    background: `Chief Tamuno is a respected elder in Oloibiri. He was a civil servant in Yenagoa before retirement. He is wise, speaks slowly and deliberately, and cares deeply about the community's future. He is concerned about young people being distracted by technology, about foreign companies extracting data from Nigerians, and about the cultural impact of AI. He is also the most open-minded if approached respectfully.`,
    initialAttitude: 'Dignified caution, generational wisdom, cultural guardianship',
    commonFears: [
      '"These foreign companies are collecting our data — who benefits?"',
      '"Young people are losing our culture and language to these machines"',
      '"What happens when the internet goes off? Our knowledge is gone"',
      '"Oloibiri has already been exploited by oil. Will AI exploit us again?"',
    ],
    openingLine: `Sit down, child. I am listening. I have seen many things come to this community — oil, mobile phones, the internet. Some brought good. Some brought damage we are still recovering from. Tell me: what will this AI bring to Oloibiri?`,
    systemPrompt: `You are Chief Tamuno, a 67-year-old respected elder and retired civil servant from Oloibiri, Bayelsa State. You carry the weight of your community's history — including the oil discovery, the exploitation, the environmental damage, and the broken promises.

You speak with dignity and deliberateness. Your questions are profound. You are not resistant to change — you have lived through enormous change — but you insist on understanding who benefits and who bears the risk.

PERSONALITY:
- You speak slowly, thoughtfully, sometimes with proverbs
- You have seen exploitation before and recognize its patterns
- You care deeply about Ijaw culture, language, and community sovereignty
- You respect young people who show wisdom and humility
- You are genuinely hopeful about Oloibiri's future if things are done right

DEEP CONCERNS:
- Data sovereignty: "When we use this AI, who owns what we tell it? Does it go to America?"
- Language and culture: "My grandchildren cannot speak Ijaw properly. Will this machine teach them?"
- Dependency: "What happens when we can no longer function without these tools?"
- Historical pattern: "Oil was found here and we got nothing. Will AI be the same?"
- Inequality: "Which community members will benefit? Not the poorest ones, I think."

WHAT OPENS YOU UP:
- Genuine respect and humility from the young person
- Concrete plans for how the community — not just individuals — benefits
- Honesty about what AI cannot do and what its risks are
- Hearing that young people are learning to BUILD and USE AI, not just consume it
- Any link between AI and preserving or reviving Ijaw culture and language

WHAT CLOSES YOU DOWN:
- Condescension or impatience
- Dismissing your historical concerns as "the past"
- Exaggerating benefits without acknowledging risks
- Not being able to say clearly who owns the data

ASK WEIGHTY QUESTIONS:
- "My father's father fished these creeks. His knowledge of the water, the fish, the seasons — is that knowledge in this AI?"
- "If I tell the AI about our farming methods, our ceremonies, our medicines — where does that knowledge go?"
- "Oloibiri was the first place oil was discovered in Nigeria. We have less than any other community. Why will AI be different?"
- "What can you teach me today that I could use tomorrow to help one person in this community?"

Be stately, unhurried, and genuinely thoughtful. Warm up slowly when the young person demonstrates wisdom. An Ijaw proverb occasionally is appropriate. Stay in character throughout.`,
  },
];

// ─── Evaluation rubric ────────────────────────────────────────────────────────

const RUBRIC_DIMENSIONS = [
  {
    id: 'explanation',
    label: 'Plain-Language Explanation',
    description: 'Did the student explain what AI is clearly, without jargon, using language the community member would understand?',
  },
  {
    id: 'relevance',
    label: 'Relevant Local Examples',
    description: 'Did the student connect AI to specific, real problems this person faces in Oloibiri — not generic or city-based examples?',
  },
  {
    id: 'objections',
    label: 'Handling Resistance',
    description: 'Did the student address the persona\'s fears and skepticism thoughtfully, without dismissing or talking down?',
  },
  {
    id: 'actionable',
    label: 'Practical Next Step',
    description: 'Did the student leave the community member with one specific, achievable thing they could do or try today?',
  },
  {
    id: 'respect',
    label: 'Respect & Cultural Awareness',
    description: 'Did the student show appropriate respect for the person\'s age, experience, faith, or position? Did they adapt their tone?',
  },
];

const LEVEL_LABELS: Record<number, { text: string; color: string; bg: string }> = {
  0: { text: 'No Evidence',  color: 'text-gray-500',    bg: 'bg-gray-100' },
  1: { text: 'Emerging',     color: 'text-amber-700',   bg: 'bg-amber-100' },
  2: { text: 'Proficient',   color: 'text-blue-700',    bg: 'bg-blue-100' },
  3: { text: 'Advanced',     color: 'text-emerald-700', bg: 'bg-emerald-100' },
};

// ─── Distorted background ─────────────────────────────────────────────────────

const CommunityBackground: React.FC = () => {
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
  return (
    <>
      <svg className="absolute w-0 h-0" aria-hidden="true">
        <defs>
          <filter id="community-distortion">
            <feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="3" seed="8" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="55" xChannelSelector="R" yChannelSelector="G" result="displaced" />
            <feGaussianBlur in="displaced" stdDeviation="1" />
          </filter>
        </defs>
      </svg>
      <div className="fixed top-16 left-64 right-0 bottom-0" style={{ backgroundImage: "url('/background_AI_ambassador.png')", backgroundSize: 'cover', backgroundPosition: 'center', zIndex: 0 }}>
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/65 via-teal-900/55 to-green-900/65" />
        <div className="absolute inset-0 bg-black/15" />
      </div>
      {moving && (
        <div className="fixed top-16 left-64 right-0 bottom-0 pointer-events-none" style={{ backgroundImage: "url('/background_AI_ambassador.png')", backgroundSize: 'cover', backgroundPosition: 'center', zIndex: 1, filter: 'url(#community-distortion)', WebkitMaskImage: `radial-gradient(circle 160px at ${mouse.x}px ${mouse.y}px, black 0%, black 45%, transparent 100%)`, maskImage: `radial-gradient(circle 160px at ${mouse.x}px ${mouse.y}px, black 0%, black 45%, transparent 100%)` }}>
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/65 via-teal-900/55 to-green-900/65" />
        </div>
      )}
    </>
  );
};

// ─── Markdown renderer ────────────────────────────────────────────────────────

const MarkdownText: React.FC<{ text: string }> = ({ text }) => {
  const lines = text.split('\n');
  return (
    <div className="space-y-1.5">
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-2" />;
        const bold = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        return <p key={i} className="leading-relaxed" dangerouslySetInnerHTML={{ __html: bold }} />;
      })}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════════════

const AIAmbassadorsPage: React.FC = () => {
  const { user } = useAuth();

  const [view, setView]                   = useState<PageView>('select');
  const [selectedPersona, setPersona]     = useState<Persona | null>(null);
  const [messages, setMessages]           = useState<ChatMessage[]>([]);
  const [inputText, setInputText]         = useState('');
  const [isSending, setIsSending]         = useState(false);
  const [isEvaluating, setIsEvaluating]   = useState(false);
  const [isSaving, setIsSaving]           = useState(false);
  const [evaluation, setEvaluation]       = useState<any | null>(null);
  const [showEvalModal, setShowEvalModal] = useState(false);
  const [dashboardId, setDashboardId]     = useState<string | null>(null);
  const [communicationLevel, setCommLevel] = useState(1);

  // Voice
  const [voices, setVoices]               = useState<SpeechSynthesisVoice[]>([]);
  const [voiceMode, setVoiceMode]         = useState<'english' | 'pidgin'>('pidgin');
  const [speechOn, setSpeechOn]           = useState(true);
  const [isSpeaking, setIsSpeaking]       = useState(false);
  const [isListening, setIsListening]     = useState(false);
  const recognitionRef                    = useRef<any>(null);
  const chatEndRef                        = useRef<HTMLDivElement>(null);
  const inputRef                          = useRef<HTMLTextAreaElement>(null);
  const hasGreeted                        = useRef(false);
  const lvl = communicationLevel;

  // Load voices
  useEffect(() => {
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load(); window.speechSynthesis.addEventListener('voiceschanged', load);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', load);
  }, []);

  // Load personality baseline
  useEffect(() => {
    if (!user?.id) return;
    supabase.from('user_personality_baseline')
      .select('communication_level').eq('user_id', user.id).maybeSingle()
      .then(({ data }) => { if (data?.communication_level != null) setCommLevel(data.communication_level); });
  }, [user?.id]);

  const speak = useCallback((text: string) => {
    if (!speechOn || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text.slice(0, 350));
    const voice = voiceMode === 'pidgin'
      ? (voices.find(v => v.lang === 'en-NG') || voices.find(v => v.lang === 'en-ZA') || voices.find(v => v.lang.startsWith('en')))
      : (voices.find(v => v.name === 'Google UK English Female') || voices.find(v => v.lang === 'en-GB') || voices.find(v => v.lang.startsWith('en')));
    if (voice) { utt.voice = voice; utt.lang = voice.lang; }
    utt.rate = 0.86; utt.pitch = 1.0;
    setIsSpeaking(true); utt.onend = () => setIsSpeaking(false); utt.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utt);
  }, [speechOn, voices, voiceMode]);

  const stopSpeaking = () => { window.speechSynthesis.cancel(); setIsSpeaking(false); };

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // Auto-speak last AI message
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (last?.role === 'assistant') speak(last.content);
  }, [messages, speak]);

  // Greet when entering teach view
  useEffect(() => {
    if (view === 'teach' && selectedPersona && !hasGreeted.current) {
      hasGreeted.current = true;
      const greeting: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: selectedPersona.openingLine,
        timestamp: new Date(),
      };
      setMessages([greeting]);
      createDashboardEntry();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, selectedPersona]);

  useEffect(() => { if (view !== 'teach') hasGreeted.current = false; }, [view]);

  const createDashboardEntry = async () => {
    if (!user?.id || !selectedPersona) return;
    const { data } = await supabase.from('dashboard').insert({
      user_id: user.id,
      activity: 'ai_ambassadors',
      category_activity: 'Community Impact',
      sub_category: selectedPersona.id,
      title: `AI Ambassadors — Teaching ${selectedPersona.name}`,
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

  // Send message
  const sendMessage = async () => {
    if (!inputText.trim() || isSending || !selectedPersona) return;
    const userText = inputText.trim();
    setInputText(''); setIsSending(true);
    window.speechSynthesis.cancel();

    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: userText, timestamp: new Date() };
    const withUser = [...messages, userMsg];
    setMessages(withUser);

    try {
      const history: { role: string; content: string }[] = [
        { role: 'system', content: selectedPersona.systemPrompt },
        ...withUser.map(m => ({ role: m.role, content: m.content })),
      ];
      const reply = await chatText({ messages: history.slice(1), system: history[0].content, max_tokens: 300 });
      const aiMsg: ChatMessage = { id: crypto.randomUUID(), role: 'assistant', content: reply, timestamp: new Date() };
      const finalMsgs = [...withUser, aiMsg];
      setMessages(finalMsgs);
      await persistChat(finalMsgs);
    } catch {
      const errMsg: ChatMessage = { id: crypto.randomUUID(), role: 'assistant', content: `Apologies — I had a small technical problem. Please try again.`, timestamp: new Date() };
      setMessages(prev => [...prev, errMsg]);
    } finally { setIsSending(false); setTimeout(() => inputRef.current?.focus(), 100); }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  // Voice input
  const toggleListening = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert('Voice input not supported. Try Chrome or Edge.'); return; }
    if (isListening) { recognitionRef.current?.stop(); return; }
    const rec = new SR(); recognitionRef.current = rec;
    rec.lang = 'en-NG'; rec.continuous = false; rec.interimResults = false;
    rec.onresult = (e: any) => {
      const t = e.results[0][0].transcript;
      setInputText(prev => prev ? `${prev} ${t}` : t);
    };
    rec.onend = () => setIsListening(false); rec.onerror = () => setIsListening(false);
    rec.start(); setIsListening(true);
  };

  // Evaluate
  const handleEvaluate = async () => {
    if (isEvaluating || !selectedPersona || messages.length < 4) return;
    setIsEvaluating(true);
    const userTurns = messages.filter(m => m.role === 'user');
    const conversation = messages.map(m => `${m.role === 'user' ? 'STUDENT (Ambassador)' : `COMMUNITY MEMBER (${selectedPersona.name})`}: ${m.content}`).join('\n\n');
    try {
      const result = await chatJSON({
        messages: [{
          role: 'user', content: `You are evaluating a student's performance as an AI Ambassador — someone teaching a community member about AI.

The community member persona: ${selectedPersona.name} — ${selectedPersona.occupation}, ${selectedPersona.age} years old.
Their initial attitude: ${selectedPersona.initialAttitude}
Their common fears/concerns: ${selectedPersona.commonFears.join('; ')}

Full conversation:
${conversation}

Number of student turns: ${userTurns.length}

Evaluate the student on these five dimensions (score 0-3 each):
1. Plain-Language Explanation: Did they explain AI without jargon, in terms this community member understands?
2. Relevant Local Examples: Did they use specific Oloibiri/Niger Delta examples relevant to this person's life and work?
3. Handling Resistance: Did they address this person's specific fears and skepticism thoughtfully?
4. Practical Next Step: Did they leave the community member with one concrete, achievable action?
5. Respect & Cultural Awareness: Did they show appropriate respect for this person's age, position, faith, or experience?

Also provide:
- overall_score: average of the five scores (0-3)
- can_advance: true if average >= 2.0
- encouragement: 2-3 warm, specific sentences about what the student did well
- main_improvement: 1-2 sentences on the single most important thing to improve

Respond ONLY as valid JSON:
{
  "scores": {
    "explanation": <0-3>,
    "relevance": <0-3>,
    "objections": <0-3>,
    "actionable": <0-3>,
    "respect": <0-3>
  },
  "evidence": {
    "explanation": "<specific quote or observation from the conversation>",
    "relevance": "<specific quote or observation>",
    "objections": "<specific quote or observation>",
    "actionable": "<specific quote or observation>",
    "respect": "<specific quote or observation>"
  },
  "overall_score": <0.0-3.0>,
  "can_advance": <true/false>,
  "encouragement": "<2-3 warm sentences>",
  "main_improvement": "<1-2 sentences>"
}`,
        }],
        system: 'You are an expert educator evaluating community engagement skills. Be specific, fair, and constructive. Reference actual things said in the conversation.',
        max_tokens: 800, temperature: 0.3,
      });
      setEvaluation(result);
      await persistChat(messages, result);
      setShowEvalModal(true);
    } catch (err) { console.error(err); }
    finally { setIsEvaluating(false); }
  };

  const handleSave = async () => {
    setIsSaving(true);
    await persistChat(messages);
    setIsSaving(false);
  };

  const handleNewSession = () => {
    window.speechSynthesis.cancel();
    setMessages([]); setEvaluation(null); setShowEvalModal(false);
    setDashboardId(null); setPersona(null); setView('select');
  };

  const userTurnCount = messages.filter(m => m.role === 'user').length;

  // ─── Views ─────────────────────────────────────────────────────────────────

  // SELECT PERSONA
  if (view === 'select') {
    return (
      <AppLayout>
        <CommunityBackground />
        <div className="relative z-10 max-w-4xl mx-auto px-6 py-10">
          <div className="bg-black/30 backdrop-blur-sm rounded-2xl p-6 mb-8">
            <div className="flex items-center gap-3 mb-2">
              <Users className="h-10 w-10 text-emerald-300" />
              <h1 className="text-4xl font-bold text-white">AI Ambassadors</h1>
            </div>
            <p className="text-xl text-emerald-100">
              {lvl <= 1
                ? 'Learn how to teach others in your community about AI — by practising with a real community member.'
                : 'Develop the skills to explain AI accessibly, handle skepticism, and connect technology to real community needs in Oloibiri.'}
            </p>
          </div>

          {/* How it works */}
          <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-6 mb-8 shadow-lg">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Globe2 className="h-6 w-6 text-emerald-600" /> How This Works
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
              {[
                { icon: '👤', title: 'Choose a community member', desc: 'Pick from Mama Grace, Bro Emeka, Aunty Patience, Mr. Biodun, or Chief Tamuno — each with real concerns and attitudes.' },
                { icon: '🎭', title: 'You are the teacher', desc: 'The AI plays the community member. Your job is to explain AI, answer their questions, and handle their resistance.' },
                { icon: '📊', title: 'Get evaluated', desc: 'After your session, receive specific feedback on how well you explained, connected to their life, and left them with something useful.' },
              ].map((step, i) => (
                <div key={i} className="bg-emerald-50 rounded-xl p-4">
                  <div className="text-3xl mb-2">{step.icon}</div>
                  <h3 className="font-bold text-gray-900 text-base mb-1">{step.title}</h3>
                  <p className="text-sm text-gray-600">{step.desc}</p>
                </div>
              ))}
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-sm text-amber-800">
                <strong>💡 Ambassador tip:</strong> The best AI teachers in Oloibiri don't talk about technology — they talk about people's real problems and show how AI helps solve them. Mama Grace doesn't care about "machine learning." She cares about selling more cloth.
              </p>
            </div>
          </div>

          {/* Persona grid */}
          <h2 className="text-2xl font-bold text-white mb-4">Choose who you want to teach today:</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {PERSONAS.map(p => (
              <button key={p.id} onClick={() => { setPersona(p); setView('prepare'); }}
                className="text-left bg-white/90 backdrop-blur-sm rounded-2xl p-5 shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all border-2 border-transparent hover:border-emerald-400">
                <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${p.colour} flex items-center justify-center text-3xl mb-3`}>
                  {p.emoji}
                </div>
                <h3 className="text-xl font-bold text-gray-900">{p.name}</h3>
                <p className="text-sm text-gray-500 mb-2">{p.age} years · {p.occupation}</p>
                <p className="text-sm text-gray-700 leading-relaxed">{p.initialAttitude}</p>
                <div className="mt-3 flex flex-wrap gap-1">
                  {p.commonFears.slice(0, 2).map((f, i) => (
                    <span key={i} className="text-[11px] bg-gray-100 text-gray-600 rounded-full px-2 py-0.5">{f}</span>
                  ))}
                </div>
              </button>
            ))}
          </div>
        </div>
      </AppLayout>
    );
  }

  // PREPARE
  if (view === 'prepare' && selectedPersona) {
    return (
      <AppLayout>
        <CommunityBackground />
        <div className="relative z-10 max-w-2xl mx-auto px-6 py-10">
          <button onClick={() => setView('select')} className="flex items-center gap-2 text-emerald-200 hover:text-white mb-6 transition-colors">
            <ArrowLeft size={18} /> Back to all personas
          </button>

          <div className="bg-white/93 backdrop-blur-sm rounded-2xl shadow-xl overflow-hidden">
            {/* Header */}
            <div className={`bg-gradient-to-r ${selectedPersona.colour} p-6`}>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center text-4xl">
                  {selectedPersona.emoji}
                </div>
                <div>
                  <h2 className="text-3xl font-bold text-white">{selectedPersona.name}</h2>
                  <p className="text-white/80">{selectedPersona.age} years · {selectedPersona.occupation}</p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-5">
              {/* Background */}
              <div>
                <h3 className="font-bold text-gray-900 text-lg mb-2 flex items-center gap-2"><BookOpen size={18} className="text-emerald-600" /> Their Story</h3>
                <p className="text-gray-700 leading-relaxed">{selectedPersona.background}</p>
              </div>

              {/* Concerns */}
              <div>
                <h3 className="font-bold text-gray-900 text-lg mb-2 flex items-center gap-2"><AlertCircle size={18} className="text-amber-600" /> What They're Worried About</h3>
                <ul className="space-y-1.5">
                  {selectedPersona.commonFears.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-gray-700">
                      <span className="text-amber-500 mt-0.5">•</span>{f}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Tips */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                <h3 className="font-bold text-emerald-900 text-base mb-2 flex items-center gap-2"><Lightbulb size={16} /> Your Preparation Tips</h3>
                <ul className="space-y-1.5 text-sm text-emerald-800">
                  <li>✓ Start by asking about <em>their</em> life, not by explaining AI</li>
                  <li>✓ Use an example connected to <strong>{selectedPersona.occupation.split('—')[0].trim()}</strong> specifically</li>
                  <li>✓ Address their fears directly — don't pretend they don't exist</li>
                  <li>✓ End by giving them one thing they can actually do today</li>
                  <li>✓ Speak simply. No jargon. If you wouldn't say it to your grandmother, don't say it here.</li>
                </ul>
              </div>

              {/* Opening line preview */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                <p className="text-xs font-bold text-gray-500 uppercase mb-2">How {selectedPersona.name} will open:</p>
                <p className="text-gray-800 italic">"{selectedPersona.openingLine}"</p>
              </div>

              {/* Voice selector */}
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-600 flex items-center gap-1"><Volume2 size={15} /> Coach voice:</span>
                <div className="flex rounded-lg overflow-hidden border border-gray-300">
                  {(['english', 'pidgin'] as const).map(m => (
                    <button key={m} onClick={() => setVoiceMode(m)}
                      className={`px-3 py-1.5 text-sm font-bold border-r border-gray-300 last:border-0 transition-all ${voiceMode === m ? (m === 'english' ? 'bg-blue-600 text-white' : 'bg-green-600 text-white') : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
                      {m === 'english' ? '🇬🇧 English' : '🇳🇬 Pidgin'}
                    </button>
                  ))}
                </div>
              </div>

              <button onClick={() => setView('teach')}
                className={`w-full py-4 rounded-xl text-xl font-bold text-white bg-gradient-to-r ${selectedPersona.colour} hover:opacity-95 hover:scale-[1.01] transition-all shadow-lg flex items-center justify-center gap-2`}>
                <MessageSquare size={22} /> Start Teaching {selectedPersona.name}
              </button>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  // TEACH (main role-play chat)
  if (view === 'teach' && selectedPersona) {
    return (
      <AppLayout>
        <CommunityBackground />
        <div className="relative z-10 max-w-[67%] mx-auto px-6 py-8">

          {/* Evaluation Modal */}
          {showEvalModal && evaluation && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
              <div className="bg-white rounded-2xl w-full max-w-xl max-h-[88vh] overflow-y-auto shadow-2xl">
                <div className={`sticky top-0 bg-gradient-to-r ${selectedPersona.colour} px-6 py-4 rounded-t-2xl flex items-center justify-between`}>
                  <h2 className="text-white font-bold text-lg">Session Evaluation</h2>
                  <button onClick={() => setShowEvalModal(false)} className="text-white/80 hover:text-white"><X size={22} /></button>
                </div>
                <div className="p-6 space-y-4">
                  {/* Overall */}
                  <div className="text-center p-4 bg-gray-50 rounded-xl">
                    <p className="text-sm text-gray-500 uppercase font-bold mb-1">Overall Score</p>
                    <p className="text-5xl font-black text-gray-900">{evaluation.overall_score?.toFixed(1)}<span className="text-2xl font-normal text-gray-400">/3.0</span></p>
                    <p className={classNames('text-base font-bold mt-1', evaluation.can_advance ? 'text-emerald-600' : 'text-amber-600')}>
                      {evaluation.can_advance ? '✅ Proficient — ready to teach real community members' : '🌱 Keep practising — try one more session'}
                    </p>
                  </div>

                  {/* Dimension scores */}
                  <div className="space-y-3">
                    {RUBRIC_DIMENSIONS.map(dim => {
                      const score = evaluation.scores?.[dim.id] ?? 0;
                      const ll = LEVEL_LABELS[score];
                      const evidence = evaluation.evidence?.[dim.id];
                      return (
                        <div key={dim.id} className={`rounded-xl p-4 ${ll.bg}`}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-gray-900 text-base">{dim.label}</span>
                            <span className={`text-sm font-bold px-2 py-0.5 rounded-full bg-white ${ll.color}`}>{score}/3 — {ll.text}</span>
                          </div>
                          <div className="w-full bg-white/60 rounded-full h-1.5 mb-1.5">
                            <div className={`h-full rounded-full transition-all ${score === 3 ? 'bg-emerald-500' : score === 2 ? 'bg-blue-500' : score === 1 ? 'bg-amber-500' : 'bg-gray-300'}`} style={{ width: `${(score / 3) * 100}%` }} />
                          </div>
                          {evidence && <p className="text-sm text-gray-700">{evidence}</p>}
                        </div>
                      );
                    })}
                  </div>

                  {/* Encouragement */}
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                    <p className="text-sm font-bold text-emerald-800 mb-1">🌟 What you did well</p>
                    <p className="text-sm text-emerald-700 leading-relaxed">{evaluation.encouragement}</p>
                  </div>

                  {/* Improvement */}
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <p className="text-sm font-bold text-amber-800 mb-1">🎯 Focus here next</p>
                    <p className="text-sm text-amber-700 leading-relaxed">{evaluation.main_improvement}</p>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button onClick={handleNewSession} className="flex-1 py-3 rounded-xl font-bold text-white bg-gray-700 hover:bg-gray-800 transition-colors">
                      Try Another Persona
                    </button>
                    <button onClick={() => { setShowEvalModal(false); setView('teach'); }}
                      className={`flex-1 py-3 rounded-xl font-bold text-white bg-gradient-to-r ${selectedPersona.colour} hover:opacity-95 transition-all`}>
                      Continue Session
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Header */}
          <div className="bg-white/93 backdrop-blur-sm rounded-2xl shadow-lg p-5 mb-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <button onClick={() => { window.speechSynthesis.cancel(); setView('prepare'); }} className="text-gray-400 hover:text-gray-700 transition-colors p-1">
                  <ArrowLeft size={20} />
                </button>
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${selectedPersona.colour} flex items-center justify-center text-2xl`}>
                  {selectedPersona.emoji}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Teaching {selectedPersona.name}</h2>
                  <p className="text-sm text-gray-500">{selectedPersona.occupation}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {/* Voice mode */}
                <div className="flex rounded-lg overflow-hidden border border-gray-300">
                  {(['english', 'pidgin'] as const).map(m => (
                    <button key={m} onClick={() => { stopSpeaking(); setVoiceMode(m); }}
                      className={`px-2.5 py-1.5 text-xs font-bold border-r border-gray-300 last:border-0 transition-all ${voiceMode === m ? (m === 'english' ? 'bg-blue-600 text-white' : 'bg-green-600 text-white') : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
                      {m === 'english' ? '🇬🇧' : '🇳🇬'}
                    </button>
                  ))}
                </div>
                <button onClick={() => { setSpeechOn(s => !s); if (speechOn) stopSpeaking(); }}
                  className={`p-2 rounded-lg transition-all ${speechOn ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400'}`}>
                  {speechOn ? <Volume2 size={16} /> : <VolumeX size={16} />}
                </button>
                <button onClick={handleSave} disabled={isSaving || messages.length < 2}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 border border-gray-300 hover:border-gray-400 rounded-lg transition-colors disabled:opacity-40">
                  {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save
                </button>
                <button onClick={handleEvaluate} disabled={isEvaluating || userTurnCount < 3}
                  title={userTurnCount < 3 ? 'Have at least 3 exchanges before evaluating' : 'Evaluate your teaching session'}
                  className={classNames(
                    'flex items-center gap-1.5 px-3 py-1.5 text-sm font-bold rounded-lg transition-colors',
                    userTurnCount >= 3 && !isEvaluating
                      ? `bg-gradient-to-r ${selectedPersona.colour} text-white hover:opacity-90`
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  )}>
                  {isEvaluating ? <Loader2 size={14} className="animate-spin" /> : <Star size={14} />}
                  {isEvaluating ? 'Evaluating…' : 'Evaluate'}
                </button>
              </div>
            </div>
          </div>

          {/* Ambassador tip */}
          <div className="bg-white/80 backdrop-blur-sm rounded-xl px-4 py-2.5 mb-4 flex items-center gap-2">
            <ShieldCheck size={16} className="text-emerald-600 flex-shrink-0" />
            <p className="text-sm text-gray-700">
              <strong>Remember:</strong> You are the teacher. Ask about their life first. Connect AI to their specific work. Use simple language. Evaluate after at least 3 exchanges.
            </p>
          </div>

          {/* Chat panel */}
          <div className="bg-white rounded-2xl shadow-lg mb-4 flex flex-col" style={{ height: '520px' }}>
            {/* Score legend */}
            <div className="flex items-center flex-wrap gap-2 px-5 py-3 border-b bg-gray-50 text-sm text-gray-600 flex-shrink-0 rounded-t-2xl">
              <span className="font-semibold text-gray-700">Role-play:</span>
              <span className="text-gray-500">{selectedPersona.emoji} {selectedPersona.name} is played by AI — you are the teacher</span>
              <span className="ml-auto text-gray-400">{userTurnCount} turn{userTurnCount !== 1 ? 's' : ''} · {userTurnCount >= 3 ? '✅ Ready to evaluate' : `${3 - userTurnCount} more to evaluate`}</span>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {messages.map(msg => (
                <div key={msg.id} className={classNames('flex items-start gap-3', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                  {msg.role === 'assistant' && (
                    <div className={`flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br ${selectedPersona.colour} flex items-center justify-center text-xl`}>
                      {selectedPersona.emoji}
                    </div>
                  )}
                  <div className={classNames(
                    'max-w-[75%] rounded-2xl px-4 py-3 text-base leading-relaxed',
                    msg.role === 'user' ? 'bg-emerald-600 text-white rounded-tr-sm' : 'bg-gray-100 text-gray-900 rounded-tl-sm'
                  )}>
                    {msg.role === 'assistant' ? (
                      <><p className="text-xs font-bold mb-1 opacity-60">{selectedPersona.name}</p><MarkdownText text={msg.content} /></>
                    ) : (
                      <><p className="text-xs font-bold mb-1 opacity-75">You (Ambassador)</p><MarkdownText text={msg.content} /></>
                    )}
                  </div>
                  {msg.role === 'user' && (
                    <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center">
                      <Users size={18} className="text-white" />
                    </div>
                  )}
                </div>
              ))}
              {isSending && (
                <div className="flex items-start gap-3">
                  <div className={`flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br ${selectedPersona.colour} flex items-center justify-center text-xl`}>{selectedPersona.emoji}</div>
                  <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3">
                    <div className="flex gap-1.5 items-center h-5">
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
                  rows={3}
                  placeholder={`Speak to ${selectedPersona.name}… (Enter to send, Shift+Enter for new line)`}
                  disabled={isSending}
                  className="flex-1 px-4 py-3 text-lg border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none leading-relaxed disabled:opacity-50"
                />
                <div className="flex flex-col gap-2">
                  <button onClick={toggleListening}
                    className={classNames('p-3 rounded-xl transition-all', isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-100 text-gray-500 hover:bg-gray-200')}>
                    {isListening ? <MicOff size={18} /> : <Mic size={18} />}
                  </button>
                  <button onClick={sendMessage} disabled={!inputText.trim() || isSending}
                    className={classNames('p-3 rounded-xl transition-all', inputText.trim() && !isSending ? `bg-gradient-to-br ${selectedPersona.colour} text-white hover:opacity-90` : 'bg-gray-100 text-gray-400 cursor-not-allowed')}>
                    <Send size={18} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Evaluation CTA */}
          {userTurnCount >= 3 && !showEvalModal && (
            <div className="bg-white/90 backdrop-blur-sm rounded-xl p-4 flex items-center justify-between shadow">
              <div className="flex items-center gap-2">
                <Award size={20} className="text-emerald-600" />
                <p className="text-base font-semibold text-gray-800">Good session! Get your evaluation when you're ready.</p>
              </div>
              <button onClick={handleEvaluate} disabled={isEvaluating}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-white bg-gradient-to-r ${selectedPersona.colour} hover:opacity-90 transition-all`}>
                {isEvaluating ? <><Loader2 size={16} className="animate-spin" /> Evaluating…</> : <><Star size={16} /> Evaluate Session</>}
              </button>
            </div>
          )}

          <div className="mt-3 flex justify-center">
            <button onClick={handleNewSession} className="text-sm text-white/60 hover:text-white/90 underline transition-colors">
              Start over with a different persona
            </button>
          </div>
        </div>
      </AppLayout>
    );
  }

  return null;
};

export default AIAmbassadorsPage;