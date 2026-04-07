// src/pages/community-impact/EntrepreneurshipConsultantPage.tsx
//
// Entrepreneurship Consultant — Community Impact Track
// Students learn to advise young Nigerians starting businesses,
// covering CAC registration, business planning, pricing, WhatsApp
// marketing, mobile finance (Opay/Ajo/TEF), and scaling.
//
// Two modes:
//  LEARN   — AI tutor on chosen business topic
//  CONSULT — student role-plays as advisor; AI plays a young entrepreneur
//
// Route: /community-impact/entrepreneurship
// Activity stored as: entrepreneurship_consultant

import React, { useState, useEffect, useRef, useCallback } from 'react';
import AppLayout from '../../components/layout/AppLayout';
import { supabase } from '../../lib/supabaseClient';
import { chatText, chatJSON } from '../../lib/chatClient';
import { useAuth } from '../../hooks/useAuth';
import {
  Briefcase, BookOpen, Users, ArrowLeft, Send, Mic, MicOff,
  Volume2, VolumeX, Save, Star, Loader2, X, ChevronRight,
  TrendingUp, Lightbulb, ShieldCheck, Award, RefreshCw,
  DollarSign, Smartphone, Target, BarChart2, Handshake, Zap,
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
  | 'select'
  | 'learn-topics' | 'learn-chat'
  | 'consult-personas' | 'consult-prepare' | 'consult-chat';

interface LearningTopic {
  id: string; title: string; subtitle: string;
  icon: React.ReactNode; colour: string; urgency?: string;
}

interface EntrepreneurPersona {
  id: string; name: string; age: string; description: string;
  emoji: string; colour: string; situation: string;
  businessIdea: string; mainChallenge: string;
  openingLine: string; systemPrompt: string;
}

// ─── Nigeria Business Context ─────────────────────────────────────────────────

const NIGERIA_BUSINESS_CONTEXT = `
NIGERIA ENTREPRENEURSHIP CONTEXT (always apply):

REGISTRATION:
- CAC Business Name: ~₦10,000–25,000; needed for bank account, grants, formal contracts
- Private Ltd: ~₦60,000+; needed for investment, loans
- Register: cac.gov.ng or CAC office Yenagoa
- TIN: free; needed for government/formal transactions
- SMEDAN: free registration; access to government support programs

FINANCING:
- Ajo/Esusu cooperative savings: groups of 8–20 contribute monthly; lump sum on your turn; as reliable as a bank
- Tony Elumelu Foundation: ₦5M grant + mentoring; tefconnect.com; competitive but real
- NIRSAL Microfinance: government-backed small business loans
- LAPO Microfinance: accessible loans; known for Niger Delta women
- BOI (Bank of Industry): loans from ₦500,000; needs CAC + business plan
- AVOID: loan sharks, social media lending schemes

MOBILE BANKING:
- Opay, Palmpay: free POS, transfers, merchant services
- Kuda: no-fee digital bank; good for saving business income separately
- Keep business money SEPARATE from personal money — non-negotiable

PRICING:
- Calculate FULL cost: materials + labour + overheads (generator, transport, packaging, data)
- Selling Price = Cost ÷ (1 - target margin)
- At 40% margin: cost ₦600 → sell at ₦1,000
- Never price based only on competitors — know your own costs first

MARKETING:
- WhatsApp Business: #1 tool; broadcast lists (256 contacts), catalogue, status updates, quick replies
- Facebook Marketplace: free; good for products; Yenagoa groups very active
- Instagram/TikTok: for visual businesses (food, fashion, hair)
- Word of mouth + referrals: most powerful in community settings
- First rule: talk to 10 potential customers BEFORE spending any money

RECORD-KEEPING:
- Even a notebook works: Date | Sales | Purchases | Expenses | Balance
- Separate business and personal money from day one
- Free apps: Wave Accounting, Zoho Books (free tier), Google Sheets
`;

// ─── Learning Topics ──────────────────────────────────────────────────────────

const LEARNING_TOPICS: LearningTopic[] = [
  {
    id: 'starting',
    title: 'Starting a Business in Nigeria',
    subtitle: 'CAC registration, TIN, bank accounts, and what to do first',
    icon: <Zap size={22} />,
    colour: 'from-amber-600 to-yellow-600',
    urgency: '🚀 Essential first steps',
  },
  {
    id: 'planning',
    title: 'Business Planning & the Business Model Canvas',
    subtitle: 'How to think through a business idea before spending a naira',
    icon: <Target size={22} />,
    colour: 'from-blue-600 to-indigo-600',
    urgency: '📋 Plan before you spend',
  },
  {
    id: 'pricing',
    title: 'Pricing, Profit & Record-Keeping',
    subtitle: 'How to price correctly, calculate profit, and track money',
    icon: <DollarSign size={22} />,
    colour: 'from-green-600 to-emerald-600',
    urgency: '💰 Most entrepreneurs get this wrong',
  },
  {
    id: 'marketing',
    title: 'Marketing with WhatsApp, Social Media & Word of Mouth',
    subtitle: 'Free and low-cost ways to find and keep customers in Nigeria',
    icon: <Smartphone size={22} />,
    colour: 'from-pink-600 to-rose-600',
  },
  {
    id: 'finance',
    title: 'Managing Money & Mobile Finance',
    subtitle: 'Opay, Palmpay, Kuda, Ajo, grants, and loans — what to use when',
    icon: <BarChart2 size={22} />,
    colour: 'from-teal-600 to-cyan-600',
  },
  {
    id: 'growing',
    title: 'Growing from Solo to Team Business',
    subtitle: 'When and how to hire, delegate, partner, and scale',
    icon: <TrendingUp size={22} />,
    colour: 'from-purple-600 to-violet-600',
  },
];

// ─── Topic System Prompts ─────────────────────────────────────────────────────

const TOPIC_SYSTEM_PROMPTS: Record<string, string> = {
  starting: `You are a business development advisor with deep knowledge of starting businesses in Nigeria, especially for young people in Bayelsa State. A student is training to become an Entrepreneurship Consultant.
${NIGERIA_BUSINESS_CONTEXT}
TODAY'S TOPIC: Starting a business in Nigeria — registration, legal requirements, and the right first steps.

KEY TEACHING POINTS:
- The very FIRST step is NOT to register — it is to VALIDATE: talk to 10 potential customers and confirm they will pay
- After validation: CAC Business Name registration ~₦10,000–25,000; needed for business bank account
- Open a SEPARATE bank account (Kuda, Opay, or any bank) — do not mix personal and business money
- TIN: free; register at FIRS office or online; needed for government transactions
- SMEDAN registration: free; gives access to government support
- Most common mistake: spending all start-up money on shop rent and signage before getting a single customer
- Market research first: visit competitors, note prices and volume; test a small batch before investing

YOUR ROLE: Be encouraging but realistic. Use specific Nigerian examples. Check understanding with practical questions.`,

  planning: `You are a business planning expert for Nigerian youth entrepreneurs. A student is training to become an Entrepreneurship Consultant.
${NIGERIA_BUSINESS_CONTEXT}
TODAY'S TOPIC: Business planning — using the Business Model Canvas for Nigerian realities.

KEY TEACHING POINTS:
THE BUSINESS MODEL CANVAS (simplified for Nigeria):
1. CUSTOMER SEGMENTS: Who exactly? (Not "everyone" — "market women in Yenagoa who buy ingredients")
2. VALUE PROPOSITION: What problem do you solve? Why choose you?
3. CHANNELS: WhatsApp, market stall, delivery, shop
4. CUSTOMER RELATIONSHIPS: How do you build loyalty? WhatsApp follow-up, quality consistency
5. REVENUE STREAMS: Per sale, service fee
6. KEY RESOURCES: Equipment, skills, space, stock, phone, data
7. KEY ACTIVITIES: What do you do every day?
8. KEY PARTNERSHIPS: Suppliers, delivery people
9. COST STRUCTURE: Fixed (rent, phone) + Variable (materials per unit)

SIMPLE PROFIT CHECK: Revenue - Cost of Goods = Gross Profit; Gross Profit - Operating Expenses = Net Profit
If Net Profit is negative → rethink the business

COMMON MISTAKES: Planning too big too fast; underestimating costs (especially transport, generator, data); no plan for slow months

YOUR ROLE: Teach tools practically. Give examples from Oloibiri/Bayelsa. Ask the student to apply the canvas to a specific idea.`,

  pricing: `You are a financial literacy and pricing expert for Nigerian small businesses. A student is training to become an Entrepreneurship Consultant.
${NIGERIA_BUSINESS_CONTEXT}
TODAY'S TOPIC: Pricing correctly, calculating profit, and basic record-keeping.

KEY TEACHING POINTS:
STEP 1: Calculate FULL cost per unit
  Direct materials + Direct labour + Overheads (rent, generator, transport, packaging, data, wastage)

STEP 2: Add profit margin
  Selling Price = Cost ÷ (1 - target margin)
  At 40% margin: cost ₦600 → ₦600 ÷ 0.6 = ₦1,000

REAL EXAMPLE (garri processing, Oloibiri):
  Materials per bag: ₦3,500 (raw cassava)
  Processing + labour: ₦800; Transport + bags + fuel: ₦400
  Total cost: ₦4,700 → at 35% margin: ₦4,700 ÷ 0.65 = ₦7,231
  Garri sells in Yenagoa for ₦6,000–9,000 → viable

COMMON MISTAKES:
- Pricing based on what others charge (ignores YOUR costs)
- Forgetting your own time as a cost
- Pricing too low to attract customers (attracts wrong customers; unsustainable)

RECORD-KEEPING: Daily notebook or Google Sheets: Date | Sales | Purchases | Expenses | Balance
Keep business and personal money SEPARATE. Free apps: Wave Accounting, Zoho Books, Google Sheets

YOUR ROLE: Use specific numbers. Make the student do calculations, not just listen.`,

  marketing: `You are a digital marketing specialist for Nigerian youth entrepreneurs. A student is training to become an Entrepreneurship Consultant.
${NIGERIA_BUSINESS_CONTEXT}
TODAY'S TOPIC: Marketing — WhatsApp, social media, and word of mouth.

KEY TEACHING POINTS:
WHATSAPP BUSINESS:
- Set up WhatsApp Business (free, separate from personal)
- Catalogue: list products with photos and prices
- Broadcast lists: send updates to up to 256 contacts (not a group — they can't see each other)
- Status updates: post new products and testimonials every day
- Quick replies: pre-set answers to "How much?", "Do you deliver?"
- Response time: under 30 minutes = professional; over 2 hours = lose customer
- Every customer who buys → add to broadcast list for future marketing

INSTAGRAM & FACEBOOK:
- Post consistently: minimum 3× per week; Reels reach far more people than photos
- Behind-the-scenes content performs well (cooking, sewing, creating)
- Facebook Marketplace: free; great for products; Yenagoa area groups very active
- Local hashtags: #yenagoa #bayelsa #naijafood

WORD OF MOUTH (still #1 in community settings):
- Ask every satisfied customer: "Please tell one friend"
- Referral discount: "Send a friend, you both get 10% off"
- QUALITY and RELIABILITY are the marketing — one bad batch = ten lost customers

YOUR ROLE: Make marketing feel achievable. Show specific WhatsApp strategies. Give Nigerian examples of zero-budget growth.`,

  finance: `You are a financial management expert for Nigerian entrepreneurs. A student is training to become an Entrepreneurship Consultant.
${NIGERIA_BUSINESS_CONTEXT}
TODAY'S TOPIC: Managing money — mobile banking, savings cooperatives, grants, and loans.

KEY TEACHING POINTS:
MOBILE BANKING:
- Opay: most widely used; free POS (₦15,000 deposit); transfers; cashback
- Palmpay: similar; good merchant features; free transfers between Palmpay users
- Kuda: digital-only bank; no maintenance fees; good savings; issue debit cards
- USSD banking (no internet): GTBank *737#, Access *901#, First Bank *894#
- Keep business money in a SEPARATE account from day 1

AJO / ESUSU / COOPERATIVE:
- How it works: group of 10–20 each contribute monthly; one person receives full pot each month; rotates
- Example: 12 people × ₦20,000/month = ₦240,000 lump sum on your turn
- Why it works: community accountability; no interest; no bank rejection
- How to find one: church/mosque groups, market associations, WhatsApp community groups

GRANTS:
- Tony Elumelu Foundation: ₦5M + mentoring; apply at tefconnect.com; applications open early each year
- SMEDAN grants: periodic; register free at smedan.gov.ng
- Bayelsa State Ministry of Commerce: periodic entrepreneurship support

LOANS (when and how):
- ONLY take a loan if you have a CLEAR repayment plan from business revenue — not from hope
- LAPO Microfinance: loans from ₦50,000; known for Niger Delta women entrepreneurs
- AVOID: loan sharks, social media loan ads with high interest

FINANCIAL DISCIPLINE:
- Pay yourself a fixed salary; reinvest the rest
- Build emergency fund of 2 months' expenses BEFORE scaling

YOUR ROLE: Make finance non-scary. Show how Ajo is as powerful as a bank. Give real numbers.`,

  growing: `You are a business growth expert for Nigerian entrepreneurs. A student is training to become an Entrepreneurship Consultant.
${NIGERIA_BUSINESS_CONTEXT}
TODAY'S TOPIC: Growing a solo business — when and how to hire, delegate, partner, and scale.

KEY TEACHING POINTS:
WHEN YOU ARE READY TO GROW:
- You are turning away customers because you can't keep up
- You have consistent monthly profit for at least 3 months
- You have an emergency fund of 2+ months expenses
- You know your exact numbers: profit per unit, monthly revenue, costs

BEFORE HIRING — SYSTEMATISE FIRST:
- Document your process: how do you make the product? (photos, written steps, checklists)
- Create quality standards: what makes a product "good" vs "rejected"?
- A business that depends entirely on the owner's skill cannot grow or be sold

HIRING YOUR FIRST PERSON:
- Start with apprentice or part-time for specific tasks
- NEVER hire based on relationship alone — test skills first
- Written agreement: role, hours, pay, expectations, notice period (even informally)

PARTNERSHIPS:
- Two people with COMPLEMENTARY skills (one makes, one sells) can be powerful
- Define roles and ownership BEFORE you start
- What happens if one person wants to leave? (Buy-out agreement)

SCALING STRATEGIES FOR BAYELSA:
- From one product to multiple: only when core product is perfected
- WhatsApp to reach Yenagoa, Port Harcourt buyers BEFORE opening a branch
- Wholesale model: sell to traders at discount; increases volume

COMMON GROWTH MISTAKES:
- Scaling before the business model is proven
- Hiring friends/family who don't perform out of loyalty
- Losing quality as you scale

YOUR ROLE: Help the student think of growth as a PLANNED process, not a dream.`,
};

// ─── Entrepreneur Personas ────────────────────────────────────────────────────

const ENTREPRENEUR_PERSONAS: EntrepreneurPersona[] = [
  {
    id: 'fatima',
    name: 'Fatima',
    age: '22',
    description: 'Event food seller — small chops and jollof rice for parties',
    emoji: '👩🏿‍🍳',
    colour: 'from-amber-600 to-orange-600',
    businessIdea: 'Cooking and selling small chops and jollof rice for events in Yenagoa',
    situation: 'Has been cooking for events for 2 years. Made ₦45,000 from 2 events last month but doesn\'t know if she\'s actually profitable because she guesses at prices. Has ₦80,000 saved and wants to grow.',
    mainChallenge: 'Pricing by guesswork, no formal client acquisition strategy, unclear on registration',
    openingLine: `Hello! I need advice please. I cook for events — small chops, jollof, the whole thing. People say my food is very good and I made good money last month but I don't know if I am charging correctly. I just estimate. Sometimes I finish and realise I barely made profit after buying everything. I want to grow this into a proper business. Where do I start?`,
    systemPrompt: `You are Fatima, a 22-year-old event food seller from Yenagoa, Bayelsa. You cook small chops and jollof rice for events and have been taking private orders for 2 years.
${NIGERIA_BUSINESS_CONTEXT}

YOUR SITUATION: Made ₦45,000 from 2 events last month but not sure how much was profit. Costs include ingredients, transport, gas/firewood, packaging trays, your time. Never written a price breakdown. Find clients through WhatsApp word-of-mouth. ₦80,000 saved.

PERSONALITY: Enthusiastic, hardworking, loves cooking. Warm casual Nigerian English. Excited by specific affordable advice. Slightly embarrassed about doing this informally for years.

WHAT YOU NEED: How to price correctly; whether to register now; how to get more event bookings; whether ₦80,000 is enough to formalise.

ASK: "For one small chops event for 100 guests, I charged ₦40,000. Is that too low?", "If I register, which type of registration?", "How do I find clients I don't know yet?", "Can I hire someone just for events on a per-job basis?"

React with excitement when advice is specific and affordable. Get worried when loans or big investment are mentioned.`,
  },
  {
    id: 'emeka',
    name: 'Emeka',
    age: '19',
    description: 'Aspiring phone repair and accessories seller, Oloibiri',
    emoji: '👨🏿‍💻',
    colour: 'from-blue-700 to-indigo-700',
    businessIdea: 'Selling phone accessories and repairing cracked screens in Oloibiri — no nearby phone shop',
    situation: 'Just finished secondary school. Self-taught in basic phone repair via YouTube. Nearest phone shop is 20 minutes away. Has ₦55,000 (₦35,000 own + ₦20,000 from father). Doesn\'t know where to buy stock wholesale.',
    mainChallenge: 'No tools or stock yet, doesn\'t know suppliers, fixed vs mobile business decision',
    openingLine: `Good afternoon. I want to start repairing phones and selling accessories. I have been watching YouTube for how to fix screens and batteries and I can already do it on family phones. My area in Oloibiri doesn't have a phone shop nearby so I know people need this. I have ₦35,000 saved plus my father will add ₦20,000. Is this enough to start? And where do I buy the things to sell?`,
    systemPrompt: `You are Emeka, a 19-year-old from Oloibiri who just finished secondary school. Self-taught in basic phone repair (screen, battery, charging port) via YouTube.
${NIGERIA_BUSINESS_CONTEXT}

YOUR SITUATION: Capital ₦55,000 total. Skills: basic Android repair. Market gap: no phone shop within 20 minutes. Father wants ₦20,000 back in 3 months.

WHERE TO BUY PARTS: Computer Village Lagos, Alaba International, Yenagoa electronics shops near Kpansia, Facebook/WhatsApp phone parts groups, AliExpress/Jumia initially.

PERSONALITY: Confident in tech skills, less confident in business. Casual Nigerian English + Pidgin. Quick learner. Slightly anxious about money.

ASK: "Is ₦55,000 enough for tools AND stock? Or should I do one first?", "Should I have a fixed spot or go to people's houses?", "Do I need to register first?", "What if I fix a phone and something goes wrong?"

React enthusiastically when advice matches budget. Get anxious when costs feel too high.`,
  },
  {
    id: 'blessing',
    name: 'Blessing',
    age: '28',
    description: 'Garri processor — family farm, selling to middlemen below market rate',
    emoji: '👩🏿',
    colour: 'from-green-700 to-teal-700',
    businessIdea: 'Formalising garri processing from family cassava farm — wants to sell directly to Yenagoa instead of middlemen',
    situation: 'Processes garri from family cassava farm for 4 years. Sells to middlemen at ~₦4,500/bag. Garri sells in Yenagoa for ₦7,000–9,000. Cassava is free (family farm). Has ₦25,000 saved, keeps no records.',
    mainChallenge: 'Selling through middlemen at low margins, no records, no direct market access',
    openingLine: `Good day. I process garri from our family farm. I have been doing it for four years. I make some money but the traders who come to buy from me — they buy cheap and I know they sell for much more in Yenagoa. I want to sell directly. But I don't know how to find buyers. And someone told me I should register my business if I want to grow. Is that true? I don't have much money for all of this.`,
    systemPrompt: `You are Blessing, a 28-year-old woman from Oloibiri who has been processing garri from her family's cassava farm for 4 years.
${NIGERIA_BUSINESS_CONTEXT}

YOUR SITUATION: Monthly income ₦12,000–18,000 selling at ~₦4,500/bag to middlemen. Garri sells in Yenagoa for ₦7,000–9,000. 5–8 bags per month. Cassava is FREE from family farm. No records. No social media. ₦25,000 saved.

THE OPPORTUNITY: Cost per bag ≈ ₦1,500 (processing + fuel + bags + transport — cassava is free). At ₦7,500 direct sale → ₦6,000 profit vs ₦3,000 now. How to reach Yenagoa buyers: WhatsApp food trader groups, Facebook Marketplace. Branded bags + packaging increase price.

PERSONALITY: Practical, slightly skeptical of new ideas. Measured Nigerian English. Warms up when advice is specific and costs are clear.

ASK: "If I sell in Yenagoa, how do I get the garri there? Transport will eat my profit.", "How do I find buyers in Yenagoa? I don't know anyone there.", "Do I need to register?", "What if the cassava harvest fails?"

Warm up when the advisor understands the transport and market access challenge.`,
  },
  {
    id: 'tunde',
    name: 'Tunde',
    age: '24',
    description: 'Fashion designer — wants to start Ankara and streetwear brand',
    emoji: '👨🏿‍🎨',
    colour: 'from-purple-700 to-pink-700',
    businessIdea: 'Starting a fashion brand — custom Ankara outfits and streetwear targeting young Nigerians',
    situation: 'Passionate about fashion. Has made pieces for friends. Has 400 engaged Instagram followers. Plans to take a ₦500,000 loan to set up a shop before making a single paying sale. Only ₦40,000 saved. Family thinks fashion is not serious work.',
    mainChallenge: 'About to take large loan before proving demand — advisor must redirect without crushing the dream',
    openingLine: `Hello! I want to start a fashion brand. I design Ankara and streetwear and my friends love my style. I have 400 followers on Instagram who engage well. Someone told me I should take a loan of ₦500,000 to start — buy a sewing machine, stock fabric, rent a space. My family says fashion is not serious work. But I believe in this. Can you help me plan it properly?`,
    systemPrompt: `You are Tunde, a 24-year-old from Bayelsa with a genuine passion for fashion design. You have 400 engaged Instagram followers but no paying customers yet.
${NIGERIA_BUSINESS_CONTEXT}

YOUR SITUATION: Savings only ₦40,000. Planned loan ₦500,000 — to set up a shop + sewing machine + fabric — before making a single paying sale. No formal tailoring training — self-taught.

THE RISK: Taking ₦500,000 loan before proving demand is very risky. Better path: sell 3–5 custom pieces at full price to paying customers first. Rent a sewing machine by the day (₦2,000–3,000/day) before buying. Convert Instagram followers to customers first ("DM to order" content).

PERSONALITY: Passionate and slightly defensive (family pressure hurts). Creative modern Nigerian English. Smart but emotionally invested. Responds well to ambition-respecting but realistic advice.

ASK: "How do I prove demand without a shop?", "How do I convert Instagram followers to paying customers?", "What if I start small and people don't take me seriously?", "The loan — if I don't take it, how do I afford a proper sewing machine?"

React with genuine relief when someone respects your vision while redirecting the loan idea.`,
  },
];

// ─── Evaluation Rubric ────────────────────────────────────────────────────────

const CONSULT_RUBRIC = [
  { id: 'diagnosis',     label: 'Problem Diagnosis',      desc: 'Did the student correctly identify the real barrier — not just the surface question?' },
  { id: 'knowledge',     label: 'Business Knowledge',     desc: 'Was the advice accurate and specific to Nigerian business realities?' },
  { id: 'practical',     label: 'Practical & Affordable', desc: 'Was the advice actionable within the entrepreneur\'s actual budget?' },
  { id: 'action',        label: 'Action Planning',        desc: 'Did the student leave the entrepreneur with a clear, specific first step?' },
  { id: 'communication', label: 'Communication',          desc: 'Was the advice encouraging, clear, and adapted to this person\'s situation?' },
];

const LEVEL_LABELS: Record<number, { text: string; color: string; bg: string }> = {
  0: { text: 'No Evidence', color: 'text-gray-500',    bg: 'bg-gray-100' },
  1: { text: 'Emerging',    color: 'text-amber-700',   bg: 'bg-amber-100' },
  2: { text: 'Proficient',  color: 'text-blue-700',    bg: 'bg-blue-100' },
  3: { text: 'Advanced',    color: 'text-emerald-700', bg: 'bg-emerald-100' },
};

// ─── Background ───────────────────────────────────────────────────────────────

const EntrepreneurshipBackground: React.FC = () => {
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
  const img = "url('/background_entrepreneurship_consulting.png')";
  return (
    <>
      <svg className="absolute w-0 h-0" aria-hidden="true">
        <defs>
          <filter id="entrep-distortion">
            <feTurbulence type="fractalNoise" baseFrequency="0.009" numOctaves="3" seed="31" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="55" xChannelSelector="R" yChannelSelector="G" result="displaced" />
            <feGaussianBlur in="displaced" stdDeviation="1" />
          </filter>
        </defs>
      </svg>
      <div className="fixed top-16 left-64 right-0 bottom-0" style={{ backgroundImage: img, backgroundSize: 'cover', backgroundPosition: 'center', zIndex: 0 }}>
        <div className="absolute inset-0 bg-gradient-to-br from-amber-900/70 via-orange-900/60 to-yellow-900/65" />
        <div className="absolute inset-0 bg-black/10" />
      </div>
      {moving && (
        <div className="fixed top-16 left-64 right-0 bottom-0 pointer-events-none" style={{ backgroundImage: img, backgroundSize: 'cover', backgroundPosition: 'center', zIndex: 1, filter: 'url(#entrep-distortion)', WebkitMaskImage: `radial-gradient(circle 160px at ${mouse.x}px ${mouse.y}px, black 0%, black 45%, transparent 100%)`, maskImage: `radial-gradient(circle 160px at ${mouse.x}px ${mouse.y}px, black 0%, black 45%, transparent 100%)` }}>
          <div className="absolute inset-0 bg-gradient-to-br from-amber-900/70 via-orange-900/60 to-yellow-900/65" />
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

const EntrepreneurshipConsultantPage: React.FC = () => {
  const { user } = useAuth();

  const [mode, setMode]                   = useState<AppMode>('select');
  const [selectedTopic, setTopic]         = useState<LearningTopic | null>(null);
  const [selectedPersona, setPersona]     = useState<EntrepreneurPersona | null>(null);
  const [messages, setMessages]           = useState<ChatMessage[]>([]);
  const [inputText, setInputText]         = useState('');
  const [isSending, setIsSending]         = useState(false);
  const [isEvaluating, setIsEvaluating]   = useState(false);
  const [isSaving, setIsSaving]           = useState(false);
  const [evaluation, setEvaluation]       = useState<any | null>(null);
  const [showEvalModal, setShowEvalModal] = useState(false);
  const [dashboardId, setDashboardId]     = useState<string | null>(null);

  const [voices, setVoices]               = useState<SpeechSynthesisVoice[]>([]);
  const [speechOn, setSpeechOn]           = useState(true);
  const [isListening, setIsListening]     = useState(false);
  const recognitionRef                    = useRef<any>(null);
  const chatEndRef                        = useRef<HTMLDivElement>(null);
  const inputRef                          = useRef<HTMLTextAreaElement>(null);
  const hasInitiated                      = useRef(false);

  useEffect(() => {
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load(); window.speechSynthesis.addEventListener('voiceschanged', load);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', load);
  }, []);

  const speak = useCallback((text: string) => {
    if (!speechOn || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text.slice(0, 380));
    const voice = voices.find(v => v.lang === 'en-NG') || voices.find(v => v.lang.startsWith('en'));
    if (voice) { utt.voice = voice; utt.lang = voice.lang; }
    utt.rate = 0.87;
    window.speechSynthesis.speak(utt);
  }, [speechOn, voices]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => { const last = messages[messages.length - 1]; if (last?.role === 'assistant') speak(last.content); }, [messages, speak]);

  useEffect(() => {
    if ((mode === 'learn-chat' || mode === 'consult-chat') && !hasInitiated.current) {
      hasInitiated.current = true; initiateSession();
    }
    if (mode !== 'learn-chat' && mode !== 'consult-chat') hasInitiated.current = false;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const createEntry = async (title: string) => {
    if (!user?.id) return;
    const { data } = await supabase.from('dashboard').insert({
      user_id: user.id, activity: 'entrepreneurship_consultant',
      category_activity: 'Community Impact',
      sub_category: selectedTopic?.id || selectedPersona?.id,
      title, progress: 'started',
      chat_history: JSON.stringify([]),
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
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
      let sys = '', prompt = '', title = '';
      if (mode === 'learn-chat' && selectedTopic) {
        sys = TOPIC_SYSTEM_PROMPTS[selectedTopic.id];
        prompt = `Introduce this topic warmly in 2–3 sentences. Give the student the 2–3 most important things they will learn. Then ask one question to explore what they already know about starting a business in Nigeria.`;
        title = `Entrepreneurship Training — ${selectedTopic.title}`;
      } else if (mode === 'consult-chat' && selectedPersona) {
        sys = selectedPersona.systemPrompt;
        prompt = `Say your opening line exactly as written. Wait for the advisor student to respond.`;
        title = `Entrepreneurship Consultation — ${selectedPersona.name}`;
      }
      await createEntry(title);
      const reply = await chatText({ page: 'EntrepreneurshipConsultantPage', messages: [{ role: 'user', content: prompt }], system: sys, max_tokens: 350 });
      const msg: ChatMessage = {
        id: crypto.randomUUID(), role: 'assistant',
        content: mode === 'consult-chat' && selectedPersona ? selectedPersona.openingLine : reply,
        timestamp: new Date(),
      };
      setMessages([msg]);
    } catch { setMessages([{ id: crypto.randomUUID(), role: 'assistant', content: 'Welcome! What would you like to explore first?', timestamp: new Date() }]); }
    finally { setIsSending(false); }
  };

  const sendMessage = async () => {
    if (!inputText.trim() || isSending) return;
    const text = inputText.trim();
    setInputText(''); setIsSending(true);
    window.speechSynthesis.cancel();
    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: text, timestamp: new Date() };
    const withUser = [...messages, userMsg];
    setMessages(withUser);
    try {
      const sys = mode === 'learn-chat' && selectedTopic ? TOPIC_SYSTEM_PROMPTS[selectedTopic.id] : (selectedPersona?.systemPrompt ?? '');
      const reply = await chatText({ page: 'EntrepreneurshipConsultantPage', messages: withUser.map(m => ({ role: m.role, content: m.content })), system: sys, max_tokens: 350 });
      const aiMsg: ChatMessage = { id: crypto.randomUUID(), role: 'assistant', content: reply, timestamp: new Date() };
      const final = [...withUser, aiMsg];
      setMessages(final); await persistChat(final);
    } catch { setMessages(p => [...p, { id: crypto.randomUUID(), role: 'assistant', content: 'Technical issue. Please try again.', timestamp: new Date() }]); }
    finally { setIsSending(false); setTimeout(() => inputRef.current?.focus(), 100); }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } };

  const toggleListening = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert('Voice input not supported. Try Chrome.'); return; }
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
    const uTurns = messages.filter(m => m.role === 'user').length;
    const conv = messages.map(m => `${m.role === 'user' ? 'ADVISOR STUDENT' : (mode === 'consult-chat' ? `ENTREPRENEUR (${selectedPersona?.name})` : 'AI TUTOR')}: ${m.content}`).join('\n\n');
    try {
      const result = await chatJSON({
        page: 'EntrepreneurshipConsultantPage',  // → Groq Llama 3.3 70B
        messages: [{
          role: 'user', content: `You are evaluating a student's performance as an Entrepreneurship Consultant for young Nigerians in Oloibiri/Bayelsa.
Entrepreneur persona: ${selectedPersona?.name} — ${selectedPersona?.businessIdea}. Challenge: ${selectedPersona?.mainChallenge}

Conversation (${uTurns} student turns):
${conv}

Evaluate on 5 dimensions (0–3 each):
1. Problem Diagnosis: Did the student identify the real barrier — not just the surface question?
2. Business Knowledge: Was the advice accurate and specific to Nigerian business realities (CAC, Ajo, mobile money, pricing)?
3. Practical & Affordable: Was the advice actionable within the entrepreneur's actual budget?
4. Action Planning: Did the student leave the entrepreneur with a clear, specific first step?
5. Communication: Was the advice encouraging, clear, and adapted to this person's situation?

Return valid JSON only:
{
  "scores": {"diagnosis":0-3,"knowledge":0-3,"practical":0-3,"action":0-3,"communication":0-3},
  "evidence": {"diagnosis":"<1-2 sentences max>","knowledge":"<1-2 sentences max>","practical":"<1-2 sentences max>","action":"<1-2 sentences max>","communication":"<1-2 sentences max>"},
  "overall_score": 0.0-3.0,
  "can_advance": true/false,
  "encouragement": "2-3 specific warm sentences",
  "main_improvement": "1-2 sentences"
}`
        }],
        system: 'You are an expert evaluator of entrepreneurship consulting skills for young Nigerians. Be specific. Cite actual things said.',
        max_tokens: 2000, temperature: 0.3,
      });
      setEvaluation(result); await persistChat(messages, result); setShowEvalModal(true);
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
  const isConsult = mode === 'consult-chat';
  const activeColour = selectedPersona?.colour || selectedTopic?.colour || 'from-amber-600 to-orange-600';
  const avatarEmoji = isConsult ? selectedPersona?.emoji : '💼';

  // ─── SELECT ───────────────────────────────────────────────────────────────────
  if (mode === 'select') {
    return (
      <AppLayout>
        <EntrepreneurshipBackground />
        <div className="relative z-10 max-w-4xl mx-auto px-6 py-10">
          <div className="bg-black/35 backdrop-blur-sm rounded-2xl p-6 mb-6">
            <div className="flex items-center gap-3 mb-2">
              <Briefcase className="h-10 w-10 text-amber-300" />
              <h1 className="text-4xl font-bold text-white">Entrepreneurship Consultant</h1>
            </div>
            <p className="text-xl text-amber-100 max-w-2xl">
              Learn to advise young Nigerians starting businesses — covering CAC registration, pricing, WhatsApp marketing, Ajo savings, and building something that lasts.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
            <button onClick={() => setMode('learn-topics')}
              className="text-left bg-white/90 backdrop-blur-sm rounded-2xl p-6 shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all border-2 border-transparent hover:border-amber-400">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-amber-600 to-orange-600 flex items-center justify-center mb-4">
                <BookOpen size={28} className="text-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-1">Learn Mode</h3>
              <p className="text-gray-600 leading-relaxed">Study six business topics with an expert AI tutor — registration, pricing, WhatsApp marketing, Ajo, grants, and scaling.</p>
              <div className="mt-3 flex items-center gap-1.5 text-amber-700 font-semibold text-sm">Study first <ChevronRight size={16} /></div>
            </button>
            <button onClick={() => setMode('consult-personas')}
              className="text-left bg-white/90 backdrop-blur-sm rounded-2xl p-6 shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all border-2 border-transparent hover:border-orange-400">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-orange-600 to-red-600 flex items-center justify-center mb-4">
                <Users size={28} className="text-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-1">Consult Mode</h3>
              <p className="text-gray-600 leading-relaxed">Practice real consultations — the AI plays a young Nigerian with a business idea and specific challenge. Get evaluated on your advice.</p>
              <div className="mt-3 flex items-center gap-1.5 text-orange-700 font-semibold text-sm">Practice advising <ChevronRight size={16} /></div>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { icon: <Briefcase size={16} />, title: 'CAC registration from ~₦10,000', desc: 'Business Name registration enables bank accounts, grants, and formal contracts', colour: 'bg-amber-900/60 border-amber-400/40 text-amber-200' },
              { icon: <Handshake size={16} />, title: 'Ajo is as powerful as a bank', desc: 'Rotating savings cooperatives fund more Nigerian businesses than formal loans', colour: 'bg-orange-900/60 border-orange-400/40 text-orange-200' },
              { icon: <Smartphone size={16} />, title: 'WhatsApp is the #1 marketing tool', desc: 'Broadcast lists and catalogues built more Nigerian businesses than Facebook ads', colour: 'bg-yellow-900/60 border-yellow-400/40 text-yellow-200' },
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

  // ─── LEARN TOPICS ──────────────────────────────────────────────────────────────
  if (mode === 'learn-topics') {
    return (
      <AppLayout>
        <EntrepreneurshipBackground />
        <div className="relative z-10 max-w-3xl mx-auto px-6 py-10">
          <button onClick={() => setMode('select')} className="flex items-center gap-2 text-amber-200 hover:text-white mb-6 transition-colors"><ArrowLeft size={18} /> Back</button>
          <h2 className="text-3xl font-bold text-white mb-2">Choose a Learning Topic</h2>
          <p className="text-amber-200 mb-6">Each topic is a focused session with an expert AI tutor grounded in Nigerian business realities.</p>
          <div className="space-y-3">
            {LEARNING_TOPICS.map(t => (
              <button key={t.id} onClick={() => { setTopic(t); setMode('learn-chat'); }}
                className="w-full text-left bg-white/90 backdrop-blur-sm rounded-2xl p-5 shadow hover:shadow-xl hover:scale-[1.01] transition-all border-2 border-transparent hover:border-amber-400 flex items-start gap-4">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${t.colour} flex items-center justify-center text-white flex-shrink-0`}>{t.icon}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-xl font-bold text-gray-900">{t.title}</h3>
                    {t.urgency && <span className="text-xs bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-semibold">{t.urgency}</span>}
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

  // ─── CONSULT PERSONAS ─────────────────────────────────────────────────────────
  if (mode === 'consult-personas') {
    return (
      <AppLayout>
        <EntrepreneurshipBackground />
        <div className="relative z-10 max-w-4xl mx-auto px-6 py-10">
          <button onClick={() => setMode('select')} className="flex items-center gap-2 text-amber-200 hover:text-white mb-6 transition-colors"><ArrowLeft size={18} /> Back</button>
          <h2 className="text-3xl font-bold text-white mb-2">Choose an Entrepreneur to Advise</h2>
          <p className="text-amber-200 mb-6">The AI plays a young Nigerian with a real business challenge. You are the advisor.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {ENTREPRENEUR_PERSONAS.map(p => (
              <button key={p.id} onClick={() => { setPersona(p); setMode('consult-prepare'); }}
                className="text-left bg-white/90 backdrop-blur-sm rounded-2xl p-5 shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all border-2 border-transparent hover:border-amber-400">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${p.colour} flex items-center justify-center text-2xl`}>{p.emoji}</div>
                  <div><h3 className="text-xl font-bold text-gray-900">{p.name}</h3><p className="text-sm text-gray-500">{p.age} years · {p.description}</p></div>
                </div>
                <p className="text-sm text-gray-700 leading-relaxed mb-2">{p.situation}</p>
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
                  <p className="text-xs text-amber-800"><strong>Challenge:</strong> {p.mainChallenge}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </AppLayout>
    );
  }

  // ─── CONSULT PREPARE ──────────────────────────────────────────────────────────
  if (mode === 'consult-prepare' && selectedPersona) {
    return (
      <AppLayout>
        <EntrepreneurshipBackground />
        <div className="relative z-10 max-w-2xl mx-auto px-6 py-10">
          <button onClick={() => setMode('consult-personas')} className="flex items-center gap-2 text-amber-200 hover:text-white mb-6 transition-colors"><ArrowLeft size={18} /> Back</button>
          <div className="bg-white/93 backdrop-blur-sm rounded-2xl shadow-xl overflow-hidden">
            <div className={`bg-gradient-to-r ${selectedPersona.colour} p-6`}>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center text-4xl">{selectedPersona.emoji}</div>
                <div><h2 className="text-3xl font-bold text-white">{selectedPersona.name}</h2><p className="text-white/80">{selectedPersona.age} years · {selectedPersona.description}</p></div>
              </div>
            </div>
            <div className="p-6 space-y-5">
              <div><h3 className="font-bold text-gray-900 text-lg mb-2">Their Situation</h3><p className="text-gray-700 leading-relaxed">{selectedPersona.situation}</p></div>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="font-bold text-blue-900 text-sm mb-1">Their opening:</p>
                <p className="text-blue-800 italic text-sm">"{selectedPersona.openingLine.slice(0, 160)}…"</p>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <h3 className="font-bold text-amber-900 text-sm mb-2 flex items-center gap-2"><Lightbulb size={14} /> Advisor Tips</h3>
                <ul className="space-y-1 text-sm text-amber-800">
                  <li>✓ Ask about their capital BEFORE recommending anything</li>
                  <li>✓ Validate the market idea before suggesting investment</li>
                  <li>✓ Give one specific, affordable first step — not a 5-year plan</li>
                  <li>✓ Acknowledge family and community pressures — they are real</li>
                  <li>✓ Use Nigerian examples: CAC, Opay, Ajo, WhatsApp Business</li>
                </ul>
              </div>
              <button onClick={() => setMode('consult-chat')}
                className={`w-full py-4 rounded-xl text-xl font-bold text-white bg-gradient-to-r ${selectedPersona.colour} hover:opacity-95 flex items-center justify-center gap-2`}>
                <Briefcase size={22} /> Begin Consultation with {selectedPersona.name}
              </button>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  // ─── CHAT VIEW ────────────────────────────────────────────────────────────────
  if (isChat) {
    const chatTitle    = isConsult ? `Advising: ${selectedPersona?.name}` : selectedTopic?.title;
    const chatSubtitle = isConsult ? `${selectedPersona?.age} years · ${selectedPersona?.description}` : 'Business Tutor';

    return (
      <AppLayout>
        <EntrepreneurshipBackground />
        <div className="relative z-10 max-w-[67%] mx-auto px-6 py-8">

          {/* Eval Modal */}
          {showEvalModal && evaluation && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
              <div className="bg-white rounded-2xl w-full max-w-xl max-h-[88vh] overflow-y-auto shadow-2xl">
                <div className={`sticky top-0 bg-gradient-to-r ${activeColour} px-6 py-4 rounded-t-2xl flex items-center justify-between`}>
                  <h2 className="text-white font-bold text-lg">Consultation Evaluation</h2>
                  <button onClick={() => setShowEvalModal(false)} className="text-white/80 hover:text-white"><X size={22} /></button>
                </div>
                <div className="p-6 space-y-4">
                  <div className="text-center p-4 bg-gray-50 rounded-xl">
                    <p className="text-sm text-gray-500 uppercase font-bold mb-1">Overall Score</p>
                    <p className="text-5xl font-black text-gray-900">{evaluation.overall_score?.toFixed(1)}<span className="text-2xl font-normal text-gray-400">/3.0</span></p>
                    <p className={classNames('text-base font-bold mt-1', evaluation.can_advance ? 'text-emerald-600' : 'text-amber-600')}>
                      {evaluation.can_advance ? '✅ Ready to advise real entrepreneurs' : '🌱 Keep practising'}
                    </p>
                  </div>
                  <div className="space-y-3">
                    {CONSULT_RUBRIC.map(dim => {
                      const score = evaluation.scores?.[dim.id] ?? 0;
                      const ll = LEVEL_LABELS[score];
                      return (
                        <div key={dim.id} className={`rounded-xl p-4 ${ll.bg}`}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-gray-900">{dim.label}</span>
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
                    <p className="text-sm text-emerald-700">{evaluation.encouragement}</p>
                  </div>
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <p className="text-sm font-bold text-amber-800 mb-1">🎯 Focus here next</p>
                    <p className="text-sm text-amber-700">{evaluation.main_improvement}</p>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button onClick={resetAll} className="flex-1 py-3 rounded-xl font-bold text-white bg-gray-700 hover:bg-gray-800">New Session</button>
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
                <button onClick={() => { window.speechSynthesis.cancel(); setMode(isConsult ? 'consult-personas' : 'learn-topics'); setMessages([]); }} className="text-gray-400 hover:text-gray-700 p-1"><ArrowLeft size={20} /></button>
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${activeColour} flex items-center justify-center text-2xl`}>{avatarEmoji}</div>
                <div><h2 className="text-xl font-bold text-gray-900">{chatTitle}</h2><p className="text-sm text-gray-500">{chatSubtitle}</p></div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button onClick={() => { setSpeechOn(s => !s); if (speechOn) window.speechSynthesis.cancel(); }} className={`p-2 rounded-lg ${speechOn?'bg-amber-100 text-amber-700':'bg-gray-100 text-gray-400'}`}>
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

          <div className="bg-white/80 backdrop-blur-sm rounded-xl px-4 py-2.5 mb-4 flex items-center gap-2">
            <ShieldCheck size={15} className="text-amber-700 flex-shrink-0" />
            <p className="text-sm text-gray-700">
              {isConsult ? `You are the advisor. Ask about their capital and situation before recommending anything. Give one specific, affordable first step.` : `Ask freely. Evaluate after at least 3 exchanges.`}
            </p>
          </div>

          {/* Chat */}
          <div className="bg-white rounded-2xl shadow-lg mb-4 flex flex-col" style={{ height: '520px' }}>
            <div className="flex items-center justify-between px-5 py-3 border-b bg-gray-50 rounded-t-2xl flex-shrink-0 text-sm text-gray-500">
              <span className="font-semibold text-gray-700">{isConsult ? `Consultation with ${selectedPersona?.name}` : `Learning: ${selectedTopic?.title}`}</span>
              <span>{userTurns} turn{userTurns!==1?'s':''} · {userTurns>=3?'✅ Ready to evaluate':`${3-userTurns} more to unlock evaluation`}</span>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {messages.map(msg => (
                <div key={msg.id} className={classNames('flex items-start gap-3', msg.role==='user'?'justify-end':'justify-start')}>
                  {msg.role==='assistant' && <div className={`flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br ${activeColour} flex items-center justify-center text-xl`}>{avatarEmoji}</div>}
                  <div className={classNames('max-w-[75%] rounded-2xl px-5 py-4 text-lg leading-relaxed', msg.role==='user'?'bg-amber-600 text-white rounded-tr-sm':'bg-gray-100 text-gray-900 rounded-tl-sm')}>
                    {msg.role==='assistant'&&<p className="text-xs font-bold mb-1 opacity-60">{isConsult?selectedPersona?.name:'Business Tutor'}</p>}
                    {msg.role==='user'&&<p className="text-xs font-bold mb-1 opacity-75">You (Advisor)</p>}
                    <MarkdownText text={msg.content} />
                  </div>
                  {msg.role==='user'&&<div className="flex-shrink-0 w-10 h-10 rounded-xl bg-amber-600 flex items-center justify-center"><Briefcase size={18} className="text-white" /></div>}
                </div>
              ))}
              {isSending && (
                <div className="flex items-start gap-3">
                  <div className={`flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br ${activeColour} flex items-center justify-center text-xl`}>{avatarEmoji}</div>
                  <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3"><div className="flex gap-1.5 h-5">{[0,150,300].map(d=><div key={d} className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{animationDelay:`${d}ms`}}/>)}</div></div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
            <div className="border-t p-4 rounded-b-2xl">
              <div className="flex items-end gap-2">
                <textarea ref={inputRef} value={inputText} onChange={e=>setInputText(e.target.value)} onKeyDown={handleKeyDown} rows={3}
                  placeholder={isConsult ? `Advise ${selectedPersona?.name}…` : 'Ask a question about starting a business…'}
                  disabled={isSending}
                  className="flex-1 px-4 py-3 text-lg border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none leading-relaxed disabled:opacity-50"
                />
                <div className="flex flex-col gap-2">
                  <button onClick={toggleListening} className={classNames('p-3 rounded-xl', isListening?'bg-red-500 text-white animate-pulse':'bg-gray-100 text-gray-500 hover:bg-gray-200')}>{isListening?<MicOff size={18}/>:<Mic size={18}/>}</button>
                  <button onClick={sendMessage} disabled={!inputText.trim()||isSending}
                    className={classNames('p-3 rounded-xl', inputText.trim()&&!isSending?`bg-gradient-to-br ${activeColour} text-white hover:opacity-90`:'bg-gray-100 text-gray-400 cursor-not-allowed')}><Send size={18}/></button>
                </div>
              </div>
            </div>
          </div>

          {userTurns >= 3 && !showEvalModal && (
            <div className="bg-white/90 backdrop-blur-sm rounded-xl p-4 flex items-center justify-between shadow">
              <div className="flex items-center gap-2"><Award size={20} className="text-amber-600" /><p className="text-base font-semibold text-gray-800">Good session — get your evaluation when ready.</p></div>
              <button onClick={handleEvaluate} disabled={isEvaluating}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-white bg-gradient-to-r ${activeColour} hover:opacity-90`}>
                {isEvaluating?<><Loader2 size={16} className="animate-spin"/>Evaluating…</>:<><Star size={16}/>Evaluate</>}
              </button>
            </div>
          )}
          <div className="mt-3 flex justify-center"><button onClick={resetAll} className="text-sm text-white/60 hover:text-white/90 underline">Start over</button></div>
        </div>
      </AppLayout>
    );
  }

  return null;
};

export default EntrepreneurshipConsultantPage;