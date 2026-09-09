



   // A child-friendly guide for the Oloibiri AI Camp (ages 8–10).
// Walks children through five camp days of AI creation:
// Robot design → Character creation → Storytelling → Game design → Choice project.
//
// Same progress-tracking and step-unlock pattern as AddNewGuidePage,
// but written for children with simple language, celebrations, and a guide character.

import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabaseClient';
import {
  
  Check,
  ChevronDown,
  ChevronRight,
  Compass,
  Lock,
  Loader2,
  Sparkles,
} from 'lucide-react';

const TRACK = 'oloibiri-ai-camp';

interface CampStep {
  id: string;
  day: string;
  title: string;
  emoji: string;
  blurb: string;
  body: string[];
  checkpoint: string;
}

const STEPS: CampStep[] = [
  {
    id: 'day1',
    day: 'Day 1',
    title: 'I Can Give AI Good Instructions 🤖',
    emoji: '🤖',
    blurb: 'Give AI instructions, create a robot, and make it better.',
    body: [
      "⭐ Aha! Activity — Can AI Guess Your Robot? (15 minutes). Think of a robot in your head. What does it look like? What can it do? What does it help people with? Tell a partner your ideas. Now imagine what would happen if you gave those instructions to AI. The more details you give, the better AI can understand your idea.",

"🤖 AI Activity 1 — Describe Your Robot. Invent your own robot. Give it a name, choose its colors and shape, decide what special powers it has, and think about who it helps. Then describe your robot to AI and ask AI to create a picture of it.",

"🤖 AI Activity 2 — Make Your Robot Better. Look carefully at the picture AI created. Is anything different from your idea? Tell AI what you want to change. You might say, 'Make the arms bigger,' 'Give it three eyes,' 'Change the color to blue,' or 'Add wheels.' Ask AI to improve your robot at least once.",

"✏️ Hands-on Activity — Draw Your Robot. Now draw your robot on paper. Give it a name and label its special parts. Show what makes your robot different from every other robot.",

"Remember: YOU are the boss. AI is your helper. You give the instructions, you check the result, and you decide what should change.",
    ],
    checkpoint: 'You have an AI picture of your robot, an improved version, and a paper drawing with labels. You gave AI instructions, checked its picture, and asked AI to make at least one change.',
  },
  {
    id: 'day2',
    day: 'Day 2',
    title: 'I Can Create With AI ✨',
    emoji: '✨',
    blurb: 'Invent a character, create with AI, and make it better.',
    body: [
      
  "⭐ Aha! Activity — Who Is This Character? (15 minutes). Think of a character without telling anyone who it is. Give three clues about the character — what they look like, something they can do, and something they love. Let a partner guess your character. Now think: if three clues can help a person imagine your character, what happens when we give AI lots of good details?",

  "🤖 AI Activity 1 — Create Your Character. Invent a brand-new character. Give your character a name, choose their appearance, decide their special power or talent, and think about what they love. Draw your character on paper first. Then describe your character to AI and ask AI to create a picture of them.",

  "🤖 AI Activity 2 — Make Your Character Better. Look at the picture AI created and compare it with your paper drawing. Did AI get everything right? Tell AI what you want to change. You might say, 'Give my character curly hair,' 'Change the shirt to yellow,' or 'Add a backpack.' Ask AI to improve your character at least once.",

  "✏️ Hands-on Activity — Create a Character Card. On paper, draw your character and write their name, special power, favorite thing, and one interesting fact about them. Compare your paper character with the AI picture and decide what you like best.",

  "Remember: YOU are the creator. AI can help bring your idea to life, but you decide what your character looks like and what makes them special.",
],
    
    checkpoint: 'You have a paper character card and an AI picture of your character. You checked the picture and asked AI to make at least one change.',
  },
  {
  id: 'day3',
  day: 'Day 3',
  title: 'I Can Tell Stories With AI 🎬',
  emoji: '🎬',
  blurb: 'Create a story, bring it to life with AI, and make it better.',
  body: [
    "⭐ Aha! Activity — What Happens Next? (15 minutes). Start a story with one sentence: 'Mia opened the mysterious box and...' Take turns with a partner adding one sentence at a time. Keep going until you have a fun ending. Now think: if people can build a story one idea at a time, how can we give AI the right instructions to help us tell a story?",

    "🤖 AI Activity 1 — Create Your Story. Invent a short story with a beginning, a problem, a solution, and an ending. Choose your main character, where the story happens, and what exciting thing happens. Then tell AI your ideas and ask it to help you create your story.",

    "🤖 AI Activity 2 — Bring Your Story to Life. Use AI to turn your story into pictures or scenes for your movie. Look carefully at what AI creates. Does it match your character and story? Tell AI what to change and improve at least one part.",

    "✏️ Hands-on Activity — Make a Storyboard. Draw four boxes on paper. In each box, draw one part of your story: beginning, problem, solution, and ending. Add a few words under each picture to explain what is happening.",

    "Remember: YOU are the director. AI can help create your story, but you choose the characters, the ideas, and what happens next.",
  ],
  checkpoint: 'You have a four-part storyboard and AI-created pictures or scenes for your story. You checked the result and asked AI to improve at least one part.',
},
  {
    id: 'day4',
    day: 'Day 4',
    title: 'I Can Solve Problems With AI 🎮',
    emoji: '🎮',
    blurb: 'Design a game, build it with AI, and make it better.',
    body: [
      
  "⭐ Aha! Activity — How Does a Game Work? (15 minutes). Think about a game you enjoy playing. What is the goal? What are the rules? How does a player win? Share your ideas with a partner. Now think: if you can explain a game to a person, how can you give AI clear instructions to help you build one?",

  "🤖 AI Activity 1 — Design Your Game. Invent a simple game. Decide the goal, the rules, the characters or objects, and how the player wins. Draw your game on paper first. Then describe your game to AI and ask AI to help you create it.",

  "🤖 AI Activity 2 — Test and Improve Your Game. Play the game AI created. Look for anything that does not work or could be more fun. Tell AI what you want to change. You might say, 'Make the game easier,' 'Add more stars,' or 'Give the player more time.' Test the game again after AI makes the change.",

  "✏️ Hands-on Activity — Game Designer Challenge. Draw your game board or game screen on paper. Show the goal, rules, characters, and how the player wins. Test your paper game with a partner and ask them what they would change.",

  "Remember: YOU are the game designer. AI can help build your idea, but you decide the rules, test the game, and choose what should change.",
],
    checkpoint: 'You have a paper game design and an AI-created game. You played and tested the game, then asked AI to improve at least one part.',
    },
  {
  id: 'day5',
  day: 'Day 5',
  title: 'I Am an AI Creator 🌟',
  emoji: '🌟',
  blurb: 'Choose your favorite project, improve it, and show what you can create.',
  body: [
    "⭐ Aha! Activity — Show and Tell (15 minutes). Pick something you made this week and tell a partner about it without showing them the project. Give three clues: what you made, what it does, and why you like it. Let your partner guess. Then think: what makes your creation special to YOU?",

    "🤖 AI Activity 1 — Choose and Improve. Pick your favorite project from this week — your robot, character, story, movie, or game. Look at it carefully and decide what you would like to make better. Tell AI what you want to change and ask AI to help you improve your project.",

    "🤖 AI Activity 2 — Create Your Final Version. Make your final version with AI. Check your project carefully. Does it match your idea? Is there anything you want to fix? Ask AI to make one more improvement if needed, then choose the version you are most proud of.",

    "✏️ Hands-on Activity — Make a Showcase Card. On paper, make a card for your project. Write: What did I make? Why did I choose it? What did AI help me do? What did I change or fix? What would I like to create next?",

    "Remember: YOU are the AI creator. AI can help you create and improve your idea, but you make the choices. Be proud of what YOU created and what YOU learned this week.",
  ],
  checkpoint: 'You have a finished project, a showcase card, and a final version that you checked and improved with AI.',
},


];

const TOTAL_STEPS = STEPS.length;

const OloibiriAICampGuidePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [done, setDone] = useState<Set<string>>(new Set());
  const [openStep, setOpenStep] = useState<string>(STEPS[0].id);
  const [loaded, setLoaded] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const lsKey = `tutorial:${TRACK}`;

  useEffect(() => {
  try {
    const saved = localStorage.getItem(lsKey);

    if (saved) {
      const parsed = JSON.parse(saved);
      setDone(new Set(parsed.completed ?? []));
    }
  } catch {
    setDone(new Set());
  }

  setLoaded(true);
}, [lsKey]);

  

  const persist = useCallback((nextDone: Set<string>) => {
    try {
      localStorage.setItem(lsKey, JSON.stringify({ completed: [...nextDone], updated: Date.now() }));
    } catch { /* private browsing */ }
    if (!userId) return;
    setSyncing(true)
    supabase
      .from('tutorial_progress')
      .upsert({
        user_id: userId,
        track: TRACK,
        completed_steps: [...nextDone],
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,track' })
      .then(() => setSyncing(false), () => setSyncing(false));
  }, [lsKey, userId]);

  const firstIncompleteIndex = useCallback((): number => {
    const idx = STEPS.findIndex(s => !done.has(s.id));
    return idx === -1 ? STEPS.length : idx;
  }, [done]);

  const isUnlocked = (_index: number) => true;
  const doneCount = STEPS.filter(s => done.has(s.id)).length;
  const pct = Math.round((doneCount / TOTAL_STEPS) * 100);

  const markDone = (stepId: string) => {
    const next = new Set(done);
    next.add(stepId);
    setDone(next);
    persist(next);
    };

  if (!loaded) {
    return (
      <AppLayout>
        <div className="flex h-64 items-center justify-center text-gray-400">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-4xl px-4 pb-24 pt-6">

        {/* header */}
        <div className="mb-6 rounded-2xl bg-gradient-to-br from-purple-600 to-blue-600 p-6 text-white">
          <p className="text-xs font-bold uppercase tracking-widest text-purple-200">Oloibiri AI Camp</p>
          <h1 className="mt-2 text-4xl font-extrabold">Five Days, Infinite Futures 🚀</h1>
          <p className="mt-3 max-w-xl text-base leading-relaxed text-purple-100">
            Welcome, creator! Over five days, you're going to build amazing things with AI. You'll design robots, create characters, tell stories, make games, and show the world what you made.
          </p>
          <p className="mt-2 text-sm text-purple-200">
            <b>Remember:</b> You describe → AI makes → You check → You decide. You're always in charge.
          </p>

          <div className="mt-5">
            <div className="mb-1.5 flex items-center justify-between text-xs text-purple-200">
              <span>Days complete: {doneCount} of {TOTAL_STEPS}</span>{' '}
              <span className="flex items-center gap-1.5">
                {syncing && <Loader2 className="h-3 w-3 animate-spin" />}
                {pct ?? 0}%
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-purple-800">
              <div className="h-full rounded-full bg-gradient-to-r from-yellow-300 to-pink-400 transition-all duration-500" style={{ width: `${pct}%` }} />
            </div>
          </div>
        </div>

        {/* steps */}
        {STEPS.map((step, idx) => {
          const unlocked = isUnlocked(idx);
          const isDone = done.has(step.id);
          const open = unlocked && openStep === step.id;

          return (
            <div key={step.id} className="mb-4 overflow-hidden rounded-2xl border-2 border-purple-200 bg-white shadow-sm">
              <button
                onClick={() => unlocked && setOpenStep(open ? '' : step.id)}
                disabled={!unlocked}
                className={`flex w-full items-center gap-4 p-5 text-left transition-colors ${unlocked ? 'hover:bg-purple-50' : 'cursor-not-allowed opacity-50'}`}
              >
                <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-2xl font-extrabold ${
                  isDone ? 'bg-green-500 text-white' : unlocked ? 'bg-purple-200 text-purple-700' : 'bg-gray-200 text-gray-400'}`}>
                  {isDone ? <Check className="h-7 w-7" /> : unlocked ? idx + 1 : <Lock className="h-6 w-6" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wide text-purple-600">{step.day}</span>
                    <span className="text-2xl">{step.emoji}</span>
                  </div>
                  <h2 className="text-lg font-bold text-gray-900">{step.title}</h2>
                  <p className="truncate text-sm text-gray-600">{step.blurb}</p>
                  {!unlocked && <p className="mt-1 text-xs font-semibold text-purple-600">Finish the previous day first!</p>}
                </div>
                {unlocked && (open ? <ChevronDown className="h-5 w-5 text-purple-400" /> : <ChevronRight className="h-5 w-5 text-purple-400" />)}
              </button>

              {open && (
                <div className="border-t-2 border-purple-100 bg-purple-50 p-5">
                  <div className="mb-5 space-y-3 text-sm leading-relaxed text-gray-800">
                    {step.body.map((p, i) => (
                      <p key={i} className="text-base">
                        {i === 0 && <span className="text-lg">👉 </span>}
                        {p}
                      </p>
                    ))}
                  </div>

                  <div className="flex items-start gap-3 rounded-lg bg-green-100 p-4 text-sm text-green-900">
                    <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
                    <div>
                      <p className="font-bold">You'll know it worked when:</p>
                      <p className="mt-1">{step.checkpoint}</p>
                    </div>
                  </div>

                  {!isDone && (
                    <button
                      onClick={() => markDone(step.id)}
                      className="mt-5 w-full rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 px-4 py-3 text-base font-bold text-white hover:from-purple-700 hover:to-blue-700 transition-all"
                    >
                      ✅ I finished this day!
                    </button>
                  )}

                  {isDone && (
                    <div className="mt-4 rounded-lg bg-green-200 p-3 text-center font-bold text-green-800">
                      🎉 Amazing work! You finished this day.
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {doneCount === TOTAL_STEPS && (
          <div className="mt-6 rounded-2xl border-2 border-yellow-300 bg-gradient-to-r from-yellow-100 to-pink-100 p-6 text-center">
            <p className="text-3xl">🌟🚀🎉</p>
            <p className="mt-2 text-xl font-extrabold text-gray-900">You're an AI Creator!</p>
            <p className="mt-2 text-base text-gray-800">
              You learned to describe, check, fix, and decide. You built robots, characters, stories, games, and more. You showed the world what you can create.
            </p>
            <p className="mt-3 text-sm font-semibold text-gray-700">
              What will you create next?
            </p>
          </div>
        )}

        <div className="mt-8">
          <button onClick={() => navigate('/tutorials')} className="flex items-center gap-2 text-sm font-semibold text-purple-600 hover:text-purple-800">
            <Compass className="h-4 w-4" /> Back to all guides
          </button>
        </div>
      </div>
    </AppLayout>
  );
};

export default OloibiriAICampGuidePage;
 
  
 