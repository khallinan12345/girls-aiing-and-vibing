// src/pages/TechSkillsPage.tsx
// Route: /tech-skills
// Add to App.tsx:  <Route path="/tech-skills" element={<TechSkillsPage />} />
// Add to Sidebar: link to /tech-skills with Code2 icon under "Learning" section

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Code2, CheckCircle2, Circle, ChevronDown, ChevronUp,
  Terminal, GitBranch, FlaskConical, Layers, Trophy, Zap,
  ExternalLink, BookOpen
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Task {
  name: string;
  short: string;
  def: { label: string; text: string };
  how: string;
  platform: string;
}

interface Track {
  label: string;
  tasks: Task[];
}

interface Phase {
  id: string;
  label: string;
  title: string;
  subtitle: string;
  color: string;
  colorBg: string;
  colorBorder: string;
  milestone: string;
  tracks: Track[];
}

interface DiagItem {
  q: string;
  summary: string;
  def: string;
  detail: string;
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const DIAGNOSTICS: DiagItem[] = [
  {
    q: 'Auth test',
    summary: 'Explain the full auth flow end-to-end without looking at code — edge cases, not the happy path.',
    def: "Authentication verifies that a user is who they claim to be. The 'happy path' is what happens when everything works perfectly. Edge cases are everything else: what happens when a token expires mid-session? When a user tries to log in with the wrong password three times? When Supabase is temporarily unreachable? When a session cookie is present but the user was deleted from the database?",
    detail: 'On nextvillage.community, your auth is handled by Supabase Auth. Walk through: how a learner signs up, how their session token is stored, what happens when that token expires, what happens if they open two browser tabs, and what error your platform shows when auth fails. Do this out loud, from memory, before looking at any code. Write down where you got stuck — those are your gaps.',
  },
  {
    q: 'Debug test',
    summary: 'Walk through a recent bug: what was your hypothesis before you ran the fix?',
    def: "A hypothesis is a testable explanation for why something is broken, formed before you look at the solution. Most developers go straight from 'error message' to 'fix.' Hypothesis first: 'I think the problem is X because Y, and I can verify by doing Z.' This distinguishes a developer who owns a system from one who merely maintains it.",
    detail: 'Think of the last bug you fixed on nextvillage.community. Write: what did you think was wrong before you ran the fix? Was your guess right? If you cannot reconstruct a hypothesis, that is your baseline — and Phase 2 is designed to build this muscle deliberately.',
  },
  {
    q: 'Schema test',
    summary: 'Sketch the vAI data model on paper — tables, relationships, RLS intent. No IDE.',
    def: "A data model describes what data your application stores and how pieces relate to each other. RLS (Row Level Security) is Supabase's mechanism for controlling which users can read or write which rows — for example, a learner should only see their own assessment results, not another learner's.",
    detail: 'On paper, draw the main tables in nextvillage.community. Name the columns you remember. Draw lines between connected tables. Write one sentence per table describing who is allowed to read it and who is allowed to write it. Where you are unsure, mark it — those are the parts of your own platform you do not fully own yet.',
  },
];

const PHASES: Phase[] = [
  {
    id: 'p1',
    label: 'Phase 1 · Months 1–2',
    title: 'Foundations & Discipline',
    subtitle: 'Consolidate what you\'ve built — make it transferable',
    color: '#6c4fd4',
    colorBg: 'rgba(108,79,212,0.07)',
    colorBorder: 'rgba(108,79,212,0.22)',
    milestone: 'Submit a PR to the vAI repo that Kevin reviews. You can explain every line — and why it was written that way — without looking at notes.',
    tracks: [
      {
        label: 'Git & Collaboration',
        tasks: [
          {
            name: 'Adopt conventional commits',
            short: 'feat:, fix:, refactor: — every commit tells a story',
            def: { label: 'What are conventional commits?', text: "Conventional commits is a standard for writing Git commit messages so any developer — including you six months from now — can understand what changed and why. A message like 'fix stuff' tells no one anything. A message like 'fix(auth): handle expired Supabase token on session restore' tells a hiring manager reviewing your GitHub exactly what changed, where, and why. Format: type(scope): short description. Common types: feat (new feature), fix (bug fix), refactor (restructuring without behavior change), docs, test, chore." },
            how: 'Starting today, every commit to nextvillage.community must follow the convention. Install commitlint in the repo to enforce it automatically so it becomes habit, not a choice.',
            platform: 'Go back and look at your last 10 commits. How many tell a clear story? Rewrite them mentally using conventional format — this exercise reveals where your thinking about changes is vague.',
          },
          {
            name: 'Set up PR workflow on the vAI repo',
            short: 'Submit PRs to Kevin; he reviews before merge to main',
            def: { label: 'What is a Pull Request (PR)?', text: "A Pull Request is a formal request to merge code from one branch into another — typically from a feature branch into main. It is the standard collaboration mechanism in professional development. A PR includes: a description of what changed and why, a diff showing every line added or removed, and a review process where another developer reads your code and either approves it, requests changes, or asks questions. PRs create a permanent record of every decision made in a codebase." },
            how: 'On the nextvillage.community GitHub repo, enable branch protection on main: Settings → Branches → Add rule → require pull request review before merging. From now on, you never push directly to main. A good PR description answers: what does this change, why was it needed, and how did you test it?',
            platform: 'The next feature you build — even a small one — goes through a full PR. Write the description as if Kevin has never seen the code before. This is the single practice most likely to be evaluated in a technical hiring process.',
          },
          {
            name: 'Add branch protection + CI lint/build check',
            short: 'Nothing merges to main without passing a gate you set up',
            def: { label: 'What is CI (Continuous Integration)?', text: 'CI is a practice where every code change automatically triggers a set of checks — linting (does the code follow style rules?), building (does it compile without errors?), and optionally testing. CI catches problems before they reach production. GitHub Actions is the standard tool: you write a YAML file that describes what to run, and GitHub runs it on every push or PR. A branch protection rule can require CI to pass before a PR is mergeable.' },
            how: 'Create a .github/workflows/ci.yml file in nextvillage.community that runs npm run lint and npm run build on every PR. Then add a branch protection rule requiring this check to pass before merging.',
            platform: 'The Vite build already exists — hooking it into GitHub Actions takes about 20 lines of YAML. Once CI is running, you will never again accidentally merge code that breaks the build.',
          },
        ],
      },
      {
        label: 'System Design (Your Own Work)',
        tasks: [
          {
            name: 'Draw the vAI architecture you built',
            short: '1-page diagram: React → Vercel → Supabase → AI services',
            def: { label: 'What is a system architecture diagram?', text: 'An architecture diagram is a visual map of the components in a system and how they communicate. It answers: what are the major pieces, and what talks to what? For a web platform it typically shows: the frontend (React), the hosting layer (Vercel), the database and auth (Supabase), external AI services (Anthropic/Groq), and any edge functions or background jobs. Boxes represent components; arrows represent data flow.' },
            how: 'Include: the React frontend served from Vercel, Supabase (database, auth, storage, edge functions), AI service calls (which pages call which models), SSE streaming flows, and the two learner cohorts (Oloibiri and Ibiade) as distinct data contexts.',
            platform: 'Use Excalidraw or draw.io — both are free. Export as PNG and commit it to the repo under /docs/architecture.png. A hiring manager finding this document on your GitHub will immediately know they are looking at a serious developer.',
          },
          {
            name: 'Write 3 Architecture Decision Records (ADRs)',
            short: 'Context → options → decision → tradeoffs',
            def: { label: 'What is an ADR?', text: "An Architecture Decision Record captures a significant technical decision: the context that made a decision necessary, the options considered, the decision made, and the consequences — including what was gained and what was given up. ADRs are rare in junior portfolios and signal exactly the kind of thinking that engineering leads look for when hiring. They live in the codebase, typically in a /docs/decisions/ folder." },
            how: 'Three good candidates: (1) Why Supabase over a custom backend. (2) Why Vercel Edge Functions over standard serverless — SSE streaming requirement, latency to Nigeria. (3) Why Anthropic with Groq fallback — quality vs. speed tradeoff.',
            platform: 'Create /docs/decisions/001-supabase.md using the standard ADR template (search "MADR template" for a clean starting format). Three ADRs in a public repo is a stronger signal than most junior developers\' entire portfolios.',
          },
          {
            name: "Name 2 things you'd do differently now",
            short: 'Written reflection — honest critical thinking about your own code',
            def: { label: 'Why does this matter?', text: "The ability to critically evaluate your own past work — without defensiveness — is a mark of a maturing developer. In interviews you will often be asked: 'What would you do differently if you rebuilt this?' A vague answer ('I'd make it cleaner') signals inexperience. A specific answer ('I would have extracted the branding logic into a context provider earlier, because the useBranding refactor cost three days and touched 14 files') signals someone who learns from their decisions." },
            how: 'Prompts: What part of the codebase do you dread touching, and why? What took much longer than it should have — and what would have made it faster? What would you refactor first if you had a free week?',
            platform: "Write this as a short section in your README under 'Lessons learned.' It shows future collaborators — and employers — that you are honest and that you grow.",
          },
        ],
      },
    ],
  },
  {
    id: 'p2',
    label: 'Phase 2 · Months 2–4',
    title: 'Testing & Debugging Rigor',
    subtitle: '"It works" is not the same as "I know why it works"',
    color: '#0e8f62',
    colorBg: 'rgba(14,143,98,0.07)',
    colorBorder: 'rgba(14,143,98,0.22)',
    milestone: 'A working test suite with 10+ tests for nextvillage.community. At least one test catches a regression Kevin deliberately introduces into the codebase.',
    tracks: [
      {
        label: 'Testing Practice',
        tasks: [
          {
            name: 'Write unit tests for 3 existing utility functions',
            short: 'Vitest or Jest — small, fast, no network calls',
            def: { label: 'What is a unit test?', text: 'A unit test is a small piece of code that verifies a single function works correctly — in isolation, without a database, without a network, without a browser. You call the function with known inputs and assert that it returns expected outputs. If the function breaks later, the test fails immediately before the bug reaches a real user. Unit tests are the foundation of professional code quality.' },
            how: 'Since nextvillage.community uses Vite, use Vitest — it is built for Vite projects and nearly zero-config. Install with npm install -D vitest, add "test": "vitest" to your package.json scripts, and write test files ending in .test.ts.',
            platform: 'Good candidates: the proficiency scoring functions, cohort reporting calculations, and any date/time utility used in the monthly assessment logic. These are pure functions — ideal first tests.',
          },
          {
            name: 'Build an AI agent behavioral test harness',
            short: 'Agents simulate learner personas hitting real user flows',
            def: { label: 'What is an agentic simulation test suite?', text: 'Traditional automated tests verify code produces correct output. An agentic simulation test suite goes further: AI agents behave like different types of users — a confused first-time learner, an advanced learner, a user on a slow connection — and interact with your platform as those users would. The test suite observes what happens. This catches UX failures, edge cases in conversation flows, and AI response quality issues that unit tests cannot reach. Building one at your stage is genuinely rare.' },
            how: 'Define 4–5 learner personas (beginner, advanced, disengaged, non-English-first, mobile-only). Write a script for each: what they click, what they type, what responses they give. Use Playwright for browser automation and the Anthropic API to generate persona-appropriate responses dynamically.',
            platform: 'Start with the Oloibiri new-learner onboarding flow. A "confused beginner" agent attempting registration and first assessment will immediately surface friction that real Oloibiri learners face. Give this project its own repository and README — it is a portfolio centerpiece.',
          },
          {
            name: 'Write a manual test plan for one full user journey',
            short: 'Written before testing, not reconstructed after',
            def: { label: 'What is a manual test plan?', text: "A manual test plan describes step by step how a human tester should verify a feature works — including what to do, what to look for, and the expected result at each step. It is written before testing begins. It forces you to think clearly about what 'working correctly' actually means for a given feature, and creates a repeatable process." },
            how: 'Structure: Scope (what is being tested), Preconditions (what must be true before starting), Steps (numbered actions with expected results), Edge cases (what to test when things go wrong), Pass/Fail criteria.',
            platform: 'Write the test plan for the full new-learner journey: discovery → registration → first AI interaction → first assessment → certificate generation. This touches auth, the AI engine, the assessment logic, and the certification pipeline — every major system in the platform.',
          },
        ],
      },
      {
        label: 'Debugging Without the Fix First',
        tasks: [
          {
            name: 'Keep a hypothesis log for the next 5 bugs',
            short: 'Write your theory before opening AI — then check if you were right',
            def: { label: 'What is hypothesis-driven debugging?', text: "When something breaks, the instinct is to search the error message or paste it into AI. Hypothesis-driven debugging inserts one step first: form a specific, testable explanation for why the bug exists. Format: 'I believe the issue is X because Y evidence, and I can confirm by doing Z.' This trains you to reason about systems rather than pattern-match on symptoms." },
            how: 'For each bug write: (1) the observable symptom, (2) your hypothesis before looking at anything, (3) what you found, (4) whether your hypothesis was correct. Keep this in a debug-log.md. After 5 entries, review: how accurate were your hypotheses? Where were your mental models wrong?',
            platform: 'The next time an SSE stream drops, a Supabase query returns unexpected results, or a Vercel deployment fails — stop before reaching for AI. Write your hypothesis first. This habit, practiced consistently, is worth more than any certification.',
          },
          {
            name: 'Learn Supabase logs + Vercel function logs',
            short: 'Platform-level debugging, not just the browser console',
            def: { label: 'What are platform logs?', text: 'The browser console shows errors that happen in the browser. Platform logs show everything else: database queries that failed, edge functions that timed out, auth events that were rejected. These logs exist in Supabase (Logs → API, Auth, Database) and in Vercel (deployment → Functions → Logs). A developer who can only read browser errors is missing the majority of production failure information.' },
            how: 'Learn: how to filter Supabase logs by time, endpoint, and status code; how to read a slow query log; how to find Vercel function execution logs for a specific request; how to correlate a user-facing error with its server-side cause.',
            platform: 'Spend one hour exploring Supabase logs for the Oloibiri cohort. Look at the last 100 auth events. Are there unexpected failures? Repeated errors? This is what platform ownership looks like — knowing what your system is doing even when no one reports a problem.',
          },
          {
            name: 'Write one post-mortem on a past bug',
            short: 'Timeline, root cause, what signals were missed',
            def: { label: 'What is a post-mortem?', text: 'A post-mortem is a written analysis of a bug or outage conducted after it is resolved. It is not about blame — it is about learning. A good post-mortem describes: what happened and when, the impact, the root cause (not just the symptom), what fixed it, and what changes would prevent recurrence. Post-mortems are standard practice at every serious technology company.' },
            how: 'Standard format — Summary (one sentence), Timeline (noticed → diagnosed → resolved), Root cause (the underlying technical reason), Impact (users affected and duration), Resolution (what fixed it), Prevention (what would catch this earlier next time).',
            platform: 'Pick the most significant bug you have fixed — something that affected real learners in Oloibiri or Ibiade. Write the post-mortem in /docs/post-mortems/. The act of writing it will surface things you did not fully understand at the time, which is the point.',
          },
        ],
      },
    ],
  },
  {
    id: 'p3',
    label: 'Phase 3 · Months 4–6',
    title: 'Reading Code & System Design',
    subtitle: 'From owner of one codebase to developer anywhere',
    color: '#b07800',
    colorBg: 'rgba(176,120,0,0.07)',
    colorBorder: 'rgba(176,120,0,0.22)',
    milestone: 'A merged open-source contribution. You can talk about what reading unfamiliar code taught you — not just what you changed.',
    tracks: [
      {
        label: 'Code Reading',
        tasks: [
          {
            name: 'Contribute a fix to an open-source repo',
            short: 'Unfamiliar codebase, real review process',
            def: { label: 'What does open-source contribution prove?', text: "Contributing requires navigating a codebase you did not write, understanding its conventions, making a change that fits the existing style, writing a PR description that convinces strangers your change is correct, and responding to review feedback professionally. A merged PR in a public repository is verifiable by any hiring manager in 30 seconds. It proves you can work in code review culture — the default in every professional team." },
            how: "On GitHub, search for issues labeled 'good first issue' in repos you already use. A documentation fix or a small bug fix is better than a large feature — maintainers are more likely to review and merge small changes quickly.",
            platform: 'If you encounter a limitation in a library used on nextvillage.community — a missing feature in a Supabase helper, a bug in a UI component — that is the ideal contribution candidate. You understand the context, you have a real use case, and your PR description will be concrete and credible.',
          },
          {
            name: "Read and formally critique a peer's project",
            short: 'Structured written review: what works, what you\'d change, and why',
            def: { label: 'What is a code review?', text: "A code review is a systematic examination of someone else's code. Good reviewers look for: correctness (does it do what it claims?), clarity (can a future developer understand it?), edge cases (what happens with unexpected inputs?), and security (could this be exploited?). The ability to give precise, constructive code review distinguishes senior developers." },
            how: 'Your critique should include: what the code does well (be specific, not generic), at least two things you would change with clear reasons, and one question you would ask the author before merging. Share the written review with the author.',
            platform: 'This skill directly applies to leading future Oloibiri developers. The structured thinking you use to review a peer\'s code is what you will use to mentor the next person who builds on nextvillage.community.',
          },
          {
            name: 'Trace one library you use daily into its source',
            short: 'Read it. Understand what it actually does. Write a 1-paragraph summary.',
            def: { label: 'Why read library source code?', text: "Every developer uses libraries they treat as black boxes. Reading the source of a library you depend on builds three capabilities: you understand what it can and cannot do, you can debug it when it behaves unexpectedly, and you learn patterns from developers who are better than you. Most great developers became great partly by reading other people's excellent code." },
            how: 'Pick one function from a library used in nextvillage.community. Find the source on GitHub. Trace the function: what does it call internally? What errors can it throw? What assumptions does it make about inputs? Write a 1-paragraph plain-English summary.',
            platform: 'The Supabase JS client is open source on GitHub. Reading how signInWithPassword() works under the hood will deepen your understanding of the auth flow from the diagnostic section — and may answer questions you did not know you had.',
          },
        ],
      },
      {
        label: 'System Design + Credentials',
        tasks: [
          {
            name: "Design a system you haven't built",
            short: 'Diagram it, choose a stack, defend the tradeoffs',
            def: { label: 'What is a system design exercise?', text: "System design is the process of defining the architecture, components, and data flows of a system before writing any code. In interviews, you will often be given a prompt like 'design a notification system' and asked to think through it out loud. This tests whether you can reason about scale, tradeoffs, and technical decisions without being told what to build. It appears in virtually every mid-level and senior interview process." },
            how: 'Prompt: Design a push notification system for nextvillage.community that sends daily learning reminders to 10,000 learners across Oloibiri and Ibiade, with different message content per cohort and offline delivery queuing for intermittent connections. Produce: a component diagram, a data model, your stack choices, and a paragraph on what you would do differently at 100,000 learners.',
            platform: 'This is not hypothetical — a notification system is something the platform may actually need. Your design could become a real feature proposal, which gives you an authentic story to tell in interviews.',
          },
          {
            name: 'GitHub Foundations certification',
            short: 'Validates Git discipline with a portable credential',
            def: { label: 'What is the GitHub Foundations certification?', text: 'GitHub Foundations is an official certification from GitHub that validates knowledge of Git fundamentals, repositories, branching, PRs, issues, Actions, and collaboration workflows. It appears on your LinkedIn and GitHub profile as a verified credential — visible to any recruiter or hiring manager who looks you up. Cost: approximately $99 USD.' },
            how: 'GitHub provides a free study guide at gh.io/foundations-study-guide. After completing Phases 1 and 2, you will already know most of the material from practice. Budget 2–3 weeks of light study.',
            platform: 'The GitHub Foundations certification signals to Nigerian and international employers that your Git practices meet a verified standard — not just self-reported.',
          },
          {
            name: 'Microsoft AI-900 certification',
            short: 'AI vocabulary + third-party validation for the Nigerian market',
            def: { label: 'What is AI-900?', text: 'Microsoft AI-900 (Azure AI Fundamentals) covers core AI concepts: machine learning, computer vision, natural language processing, generative AI, and responsible AI principles. It validates that you understand the AI landscape and can speak intelligently about it professionally. In Nigeria and across Africa, Microsoft certifications carry significant weight with employers. Cost: approximately $165 USD with student discounts available.' },
            how: 'Microsoft offers free learning paths at learn.microsoft.com. Budget 3–4 weeks of study. After passing, update your platform documentation to use precise AI terminology — the vocabulary maps directly to what nextvillage.community does.',
            platform: 'The AI-900 also strengthens partnership conversations — including with Microsoft\'s Elevate Africa program. Being able to name what your platform does accurately is part of telling its story credibly.',
          },
        ],
      },
    ],
  },
  {
    id: 'p4',
    label: 'Phase 4 · Months 6–9',
    title: 'Platform Ownership & Portfolio',
    subtitle: 'Employable identity + full vAI stewardship',
    color: '#c24a20',
    colorBg: 'rgba(194,74,32,0.07)',
    colorBorder: 'rgba(194,74,32,0.22)',
    milestone: 'A live portfolio. A live platform you can say you own — and prove it. An interview you can walk into with stories, not just code.',
    tracks: [
      {
        label: 'vAI Platform Stewardship',
        tasks: [
          {
            name: 'Own one full feature solo: requirements → deploy',
            short: 'No review from Kevin until you request it',
            def: { label: 'What does full ownership of a feature mean?', text: 'Full ownership means you are responsible for every phase: writing the requirements, designing the solution, building and testing it, writing the PR, deploying it, and monitoring it for the first week after launch. You are not asking for direction — you are making the decisions and living with the outcomes. This is what all professional software development looks like.' },
            how: 'Suggested feature: a learner progress dashboard visible to Bennywhite Davidson and Solomon Mathias Solomon — showing weekly active learners, assessment completion rates, and proficiency trends for both Oloibiri and Ibiade cohorts. Write a one-page requirements document before writing any code.',
            platform: 'Share the requirements document with Kevin not for approval but for information — then proceed independently. The requirements document is part of the deliverable.',
          },
          {
            name: 'Own monitoring + incident log for 60 days',
            short: 'You are the on-call person — document every anomaly',
            def: { label: 'What is platform monitoring?', text: 'Monitoring is the practice of actively watching a live system to detect problems — ideally before users report them. An incident log is a running record of every anomaly observed: what happened, when, what the likely cause was, and whether action was taken. It is the difference between knowing your platform and just running it.' },
            how: 'Set up a Vercel status alert for deployment failures. In Supabase, enable email alerts for auth anomalies. Create an incident-log.md and update it weekly. After 60 days, write a 1-page summary: what patterns did you see, and what would you add to the monitoring setup?',
            platform: 'The Oloibiri cohort operates in an environment with intermittent connectivity. Monitoring over 60 days will give you real data on how offline conditions affect your platform — both operationally important and a compelling story for funders and potential employers.',
          },
          {
            name: 'Write the vAI onboarding doc for a future developer',
            short: 'If you left, could someone else take over? Write that guide.',
            def: { label: 'What is a developer onboarding document?', text: "A developer onboarding document allows a new developer to understand, run, and contribute to a codebase without asking questions. Writing one forces you to surface assumptions you have been carrying silently — things you 'just know' that no one else would. It is the truest test of ownership." },
            how: 'Cover: prerequisites (Node version, environment variables, Supabase project setup), architecture overview (link to your Phase 1 diagram), key flows (how a new learner is created, how assessments work, how certifications are generated), deployment process, and known gotchas.',
            platform: 'This document is also the foundation for training future Oloibiri developers. If your goal is a Nigerian tech hub, the onboarding doc is the first teaching material. Write it as if the next reader is a talented developer from Oloibiri who knows less about the platform than you — because they will be.',
          },
        ],
      },
      {
        label: 'Portfolio & Employability',
        tasks: [
          {
            name: 'Build one independent project (not vAI)',
            short: 'Your idea, your stack — demonstrates agency to hiring managers',
            def: { label: 'Why an independent project?', text: "nextvillage.community is genuinely impressive — but it was initiated and mentored by Kevin. Any hiring manager will ask, at least silently: 'Is this his work or his mentor's?' An independent project built from your own idea, on your own initiative, with no external prompting, answers that question definitively. It signals that you are a developer who creates, not just one who executes." },
            how: 'Criteria: your own idea, deployed and publicly accessible, with a README explaining what it does, why you built it, and what you would do differently. Should use at least one technology or pattern you learned during this roadmap that you did not already know.',
            platform: 'The vAI platform gives you a rich source of inspiration. What problem did you notice while building nextvillage.community that the platform itself does not solve? That gap is your independent project.',
          },
          {
            name: 'Launch a portfolio site: two projects with architecture notes',
            short: 'Not just screenshots — explain the decisions and tradeoffs',
            def: { label: 'What makes a developer portfolio effective?', text: "Most developer portfolios show screenshots and list technologies used. An effective portfolio shows thinking: why was this architecture chosen, what tradeoffs were made, what problems were harder than they looked. A hiring manager reviewing 20 candidates remembers the one who explained their decisions, not the one with the most features listed." },
            how: 'For each project include: a 2-sentence description of what it does and who it serves, the architecture diagram, one key technical decision and why you made it, one thing that was harder than expected and how you solved it, and a live link plus a GitHub link.',
            platform: 'The vAI platform entry should lead with the human impact — 79+ learners in off-grid Nigeria — before the technical details. That framing is what makes a hiring manager stop scrolling.',
          },
          {
            name: 'Complete a mock technical interview with Kevin',
            short: 'Architecture, live debugging, tradeoff discussion — treat it as real',
            def: { label: 'What does a technical interview look like?', text: "A technical interview typically has three parts: (1) a conversation about your background and projects — where you explain what you built, why, and what you learned; (2) a live coding or debugging exercise solved in real time while thinking out loud; (3) a system design discussion where the interviewer wants to hear your reasoning process, not just a correct answer. Most developers perform poorly in interviews not because they lack skill, but because they have never practiced the format." },
            how: "The mock interview should cover: (1) Describe nextvillage.community in 90 seconds to someone who has never heard of it. (2) Kevin introduces a bug — you diagnose it while narrating your thinking out loud. (3) Tradeoff question: 'Why Supabase instead of building your own auth?' Kevin gives honest direct feedback afterward.",
            platform: "The 90-second platform description is the most important exercise. Practice it until it leads with impact (79 learners, off-grid Nigeria, AI-powered) before technology. That sequence is what makes a stranger care.",
          },
        ],
      },
    ],
  },
];

// ─── Sub-components ────────────────────────────────────────────────────────────

const TaskRow: React.FC<{ task: Task; phaseColor: string; phaseBg: string }> = ({
  task, phaseColor, phaseBg,
}) => {
  const [done, setDone] = useState(false);
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-gray-100 last:border-0">
      {/* Row */}
      <div className="flex items-start gap-3 py-3 px-1">
        <button
          onClick={() => setDone(d => !d)}
          className="mt-0.5 flex-shrink-0 focus:outline-none"
          aria-label={done ? 'Mark incomplete' : 'Mark complete'}
        >
          {done
            ? <CheckCircle2 size={18} style={{ color: phaseColor }} />
            : <Circle size={18} className="text-gray-300" />}
        </button>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium leading-snug ${done ? 'line-through text-gray-400' : 'text-gray-800'}`}>
            {task.name}
          </p>
          <p className="text-xs text-gray-400 mt-0.5 italic">{task.short}</p>
        </div>
        <button
          onClick={() => setOpen(o => !o)}
          className="flex-shrink-0 flex items-center gap-1 text-xs text-gray-400 border border-gray-200 rounded-md px-2 py-1 hover:bg-gray-50 transition-colors font-mono"
        >
          details {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
      </div>

      {/* Accordion */}
      {open && (
        <div className="ml-7 mb-3 rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-700 leading-relaxed space-y-3">
          {/* Definition */}
          <div className="rounded-md p-3" style={{ background: phaseBg, borderLeft: `3px solid ${phaseColor}` }}>
            <p className="text-xs font-mono uppercase tracking-wider mb-1.5" style={{ color: phaseColor }}>
              {task.def.label}
            </p>
            <p className="text-xs leading-relaxed text-gray-700">{task.def.text}</p>
          </div>

          {/* How to */}
          <div>
            <p className="text-xs font-mono uppercase tracking-wider text-gray-400 mb-1.5">How to practice</p>
            <p className="text-sm text-gray-700">{task.how}</p>
          </div>

          {/* Platform callout */}
          <div className="rounded-md p-3 bg-emerald-50 border border-emerald-200">
            <p className="text-xs font-mono uppercase tracking-wider text-emerald-700 mb-1.5">
              On nextvillage.community
            </p>
            <p className="text-xs leading-relaxed text-emerald-900">{task.platform}</p>
          </div>
        </div>
      )}
    </div>
  );
};

const DiagCard: React.FC<{ item: DiagItem }> = ({ item }) => {
  const [open, setOpen] = useState(false);
  return (
    <button
      onClick={() => setOpen(o => !o)}
      className="text-left w-full rounded-lg border border-purple-200 bg-white p-4 hover:shadow-sm transition-shadow"
    >
      <p className="text-xs font-mono uppercase tracking-wider text-purple-500 mb-1">{item.q}</p>
      <p className="text-sm text-gray-700 leading-snug">{item.summary}</p>
      {open && (
        <div className="mt-3 pt-3 border-t border-purple-100 text-left space-y-2">
          <div className="rounded bg-purple-50 p-2.5">
            <span className="font-medium text-purple-700">Definition: </span>
            <span className="text-xs text-gray-700">{item.def}</span>
          </div>
          <p className="text-xs text-gray-600 leading-relaxed">{item.detail}</p>
        </div>
      )}
      <p className="text-xs text-purple-300 font-mono mt-2 text-right">
        {open ? 'collapse ▴' : 'expand ▾'}
      </p>
    </button>
  );
};

const PhaseSection: React.FC<{ phase: Phase }> = ({ phase }) => {
  const [open, setOpen] = useState(phase.id === 'p1');
  const totalTasks = phase.tracks.reduce((s, t) => s + t.tasks.length, 0);

  const phaseIcon = {
    p1: <GitBranch size={16} />,
    p2: <FlaskConical size={16} />,
    p3: <Layers size={16} />,
    p4: <Trophy size={16} />,
  }[phase.id];

  return (
    <div className="mb-8">
      {/* Phase header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full text-left flex items-start gap-3 mb-4"
      >
        <span
          className="mt-1 flex-shrink-0 text-xs font-bold tracking-wide px-3 py-1 rounded-full"
          style={{ background: phase.colorBg, color: phase.color, border: `1px solid ${phase.colorBorder}` }}
        >
          {phase.label}
        </span>
        <div className="flex-1">
          <h2 className="text-lg font-bold text-gray-900 leading-tight flex items-center gap-2">
            <span style={{ color: phase.color }}>{phaseIcon}</span>
            {phase.title}
          </h2>
          <p className="text-xs text-gray-400 font-mono mt-0.5">{phase.subtitle}</p>
        </div>
        <span className="text-gray-300 mt-1 flex-shrink-0">
          {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </span>
      </button>

      {open && (
        <div className="space-y-3">
          {/* Tracks grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {phase.tracks.map((track, ti) => (
              <div key={ti} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                <p
                  className="text-xs font-mono uppercase tracking-wider mb-3"
                  style={{ color: phase.color }}
                >
                  {track.label}
                </p>
                {track.tasks.map((task, i) => (
                  <TaskRow
                    key={i}
                    task={task}
                    phaseColor={phase.color}
                    phaseBg={phase.colorBg}
                  />
                ))}
              </div>
            ))}
          </div>

          {/* Milestone */}
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 flex items-start gap-3">
            <span className="text-xl flex-shrink-0">{phase.id === 'p4' ? '🏁' : '🎯'}</span>
            <div>
              <p
                className="text-xs font-mono uppercase tracking-wider mb-1"
                style={{ color: phase.color }}
              >
                Phase milestone
              </p>
              <p className="text-sm text-gray-700 leading-relaxed">{phase.milestone}</p>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 border-t border-gray-100" />
    </div>
  );
};

// ─── Page ─────────────────────────────────────────────────────────────────────

const TechSkillsPage: React.FC = () => {
  const navigate = useNavigate();

  const totalTasks = PHASES.reduce(
    (sum, p) => sum + p.tracks.reduce((s, t) => s + t.tasks.length, 0),
    0,
  );

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-6 py-10 pb-20">

        {/* ── Header ── */}
        <div className="mb-10">
          <p className="text-xs font-mono uppercase tracking-widest text-gray-400 mb-3">
            vAI · nextvillage.community
          </p>
          <h1 className="text-4xl font-extrabold text-gray-900 leading-tight mb-3">
            Employable{' '}
            <span className="bg-gradient-to-r from-purple-600 via-blue-500 to-emerald-500 bg-clip-text text-transparent">
              Developer Roadmap
            </span>
          </h1>
          <p className="text-base text-gray-500 max-w-xl leading-relaxed mb-6">
            A 9-month plan from full-stack builder to platform owner and employable developer.
            Expand any task for definitions, context, and direction tied to nextvillage.community.
          </p>

          {/* AI Playground CTA */}
          <div className="inline-flex items-start gap-4 rounded-xl border border-blue-200 bg-blue-50 p-4">
            <Terminal size={22} className="text-blue-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-blue-800 mb-0.5">
                Use the AI Playground to do the work
              </p>
              <p className="text-xs text-blue-600 leading-relaxed mb-3">
                For each task, open the AI Playground and use it as your thinking partner —
                ask it to explain concepts deeper, generate starter code, review your ADRs,
                or challenge your design decisions.
              </p>
              <button
                onClick={() => window.open('/ai-playground', '_blank')}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 text-white text-xs font-semibold px-4 py-2 hover:bg-blue-700 transition-colors"
              >
                <Terminal size={13} />
                Open AI Playground
                <ExternalLink size={12} />
              </button>
            </div>
          </div>
        </div>

        {/* ── Progress summary ── */}
        <div className="mb-8 rounded-xl border border-gray-100 bg-gray-50 px-5 py-4 flex items-center gap-4">
          <BookOpen size={18} className="text-gray-400 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-xs font-mono text-gray-400 uppercase tracking-wider mb-1">
              Roadmap overview
            </p>
            <p className="text-sm text-gray-600">
              <span className="font-semibold text-gray-800">4 phases</span> ·{' '}
              <span className="font-semibold text-gray-800">{totalTasks} tasks</span> ·{' '}
              <span className="font-semibold text-gray-800">9 months</span> ·
              Check off tasks as you complete them. Phases collapse to keep your view clean.
            </p>
          </div>
        </div>

        {/* ── Diagnostic ── */}
        <div className="mb-10 rounded-xl border border-purple-200 bg-purple-50 p-5">
          <div className="flex items-center gap-2 mb-1">
            <Zap size={14} className="text-purple-500" />
            <p className="text-xs font-mono uppercase tracking-wider text-purple-600">
              Start here — diagnostic before month 1
            </p>
          </div>
          <p className="text-xs text-purple-500 mb-4">
            Click each card to expand. Do these before beginning Phase 1 — your answers reveal where to push hardest.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {DIAGNOSTICS.map((d, i) => <DiagCard key={i} item={d} />)}
          </div>
        </div>

        {/* ── Phases ── */}
        {PHASES.map(phase => (
          <PhaseSection key={phase.id} phase={phase} />
        ))}

        {/* ── Footer ── */}
        <p className="text-center text-xs font-mono text-gray-300 pt-6 border-t border-gray-100">
          vAI · nextvillage.community · May 2026
        </p>
      </div>
    </div>
  );
};

export default TechSkillsPage;
