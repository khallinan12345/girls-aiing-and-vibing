// src/pages/tech-skills/AIVideoCreationPage.tsx

import React, { useState } from 'react';
import AppLayout from '../../components/layout/AppLayout';
import {
  Video,
  Construction,
  Clapperboard,
  Film,
  Mic,
  Music,
  Sparkles,
  MonitorPlay,
  ArrowRight,
} from 'lucide-react';

const toolCards = [
  {
    name: 'Sora',
    description: 'OpenAI\'s text-to-video model — generate realistic and imaginative video scenes from prompts.',
    color: 'from-sky-500 to-blue-600',
    icon: <Sparkles size={28} />,
  },
  {
    name: 'Runway Gen-3',
    description: 'Professional AI video generation with motion brush, camera controls, and style transfer.',
    color: 'from-violet-500 to-purple-600',
    icon: <Film size={28} />,
  },
  {
    name: 'Pika',
    description: 'Quick, creative video generation and editing — turn ideas into animated clips in seconds.',
    color: 'from-rose-500 to-pink-600',
    icon: <Clapperboard size={28} />,
  },
  {
    name: 'CapCut AI',
    description: 'AI-powered video editing with auto-captions, background removal, and smart effects.',
    color: 'from-teal-500 to-emerald-600',
    icon: <MonitorPlay size={28} />,
  },
  {
    name: 'ElevenLabs',
    description: 'AI voice generation and cloning for narration, dubbing, and voiceovers.',
    color: 'from-amber-500 to-orange-600',
    icon: <Mic size={28} />,
  },
  {
    name: 'Suno / Udio',
    description: 'AI music generation — create custom soundtracks and background music for your videos.',
    color: 'from-fuchsia-500 to-pink-600',
    icon: <Music size={28} />,
  },
];

const skillTopics = [
  'Writing effective video prompts & storyboards',
  'Text-to-video generation techniques',
  'Image-to-video animation workflows',
  'Camera movement & scene composition controls',
  'AI voiceover & narration generation',
  'Adding AI-generated music & sound effects',
  'Video upscaling & quality enhancement',
  'Multi-clip editing & scene transitions',
  'Creating consistent characters in video',
  'Ethical considerations & content attribution',
];

const projectIdeas = [
  {
    title: 'Explainer Video',
    description: 'Create a 60-second explainer for a concept you\'re learning',
    difficulty: 'Beginner',
    diffColor: 'text-green-400 bg-green-400/10',
  },
  {
    title: 'Short Film',
    description: 'Produce a narrative short with AI-generated scenes and voiceover',
    difficulty: 'Intermediate',
    diffColor: 'text-yellow-400 bg-yellow-400/10',
  },
  {
    title: 'Music Video',
    description: 'Combine AI video generation with AI music for a complete music video',
    difficulty: 'Intermediate',
    diffColor: 'text-yellow-400 bg-yellow-400/10',
  },
  {
    title: 'Documentary Segment',
    description: 'Research a topic and produce a mini-documentary with AI visuals & narration',
    difficulty: 'Advanced',
    diffColor: 'text-red-400 bg-red-400/10',
  },
];

const AIVideoCreationPage: React.FC = () => {
  return (
    <div className="flex min-h-screen">
      <AppLayout>
        <main className="flex-1 relative overflow-y-auto">
          {/* Background */}
          <div className="fixed top-16 left-64 right-0 bottom-0 bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950 -z-10" />

          <div className="relative z-10 max-w-6xl mx-auto px-6 py-12">
            {/* Header */}
            <div className="text-center mb-10">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 shadow-lg shadow-sky-500/30 mb-4">
                <Video className="h-8 w-8 text-white" />
              </div>
              <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-sky-300 via-blue-300 to-indigo-300 bg-clip-text text-transparent mb-3">
                AI Video Creation
              </h1>
              <p className="text-lg text-sky-200/80 max-w-2xl mx-auto">
                From text-to-video generation to AI editing and voiceovers — learn the complete
                workflow for producing videos with artificial intelligence.
              </p>
            </div>

            {/* Under Construction Banner */}
            <div className="flex items-center justify-center gap-3 px-6 py-4 mb-10 bg-amber-500/15 border-2 border-dashed border-amber-500/40 rounded-2xl">
              <Construction className="h-6 w-6 text-amber-400 flex-shrink-0" />
              <div className="text-center">
                <span className="text-base font-bold text-amber-300 block">
                  🚧 Under Construction
                </span>
                <span className="text-sm text-amber-300/70">
                  Video generation playground, storyboard builder, and step-by-step tutorials coming soon!
                </span>
              </div>
              <Construction className="h-6 w-6 text-amber-400 flex-shrink-0" />
            </div>

            {/* Tools Grid */}
            <h2 className="text-2xl font-bold text-white mb-6">
              Tools You'll Learn
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
              {toolCards.map((tool) => (
                <div
                  key={tool.name}
                  className="group bg-white/5 border border-white/10 rounded-2xl p-5 hover:bg-white/10 transition-all duration-300 cursor-default"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`flex-shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br ${tool.color} flex items-center justify-center text-white shadow-lg`}
                    >
                      {tool.icon}
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white mb-1">
                        {tool.name}
                      </h3>
                      <p className="text-sm text-gray-400 leading-relaxed">
                        {tool.description}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* What You'll Learn */}
            <h2 className="text-2xl font-bold text-white mb-6">
              What You'll Learn
            </h2>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-12">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {skillTopics.map((topic, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-3 px-4 py-3 bg-white/5 rounded-xl hover:bg-white/10 transition-colors"
                  >
                    <ArrowRight size={16} className="text-sky-400 flex-shrink-0" />
                    <span className="text-sm text-gray-300 font-medium">
                      {topic}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Project Ideas */}
            <h2 className="text-2xl font-bold text-white mb-6">
              Project Ideas
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-12">
              {projectIdeas.map((project) => (
                <div
                  key={project.title}
                  className="bg-white/5 border border-white/10 rounded-2xl p-5 hover:bg-white/10 transition-all duration-300"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-bold text-white">
                      {project.title}
                    </h3>
                    <span
                      className={`text-xs font-bold px-2.5 py-1 rounded-full ${project.diffColor}`}
                    >
                      {project.difficulty}
                    </span>
                  </div>
                  <p className="text-sm text-gray-400">{project.description}</p>
                </div>
              ))}
            </div>

            {/* Video Placeholder */}
            <h2 className="text-2xl font-bold text-white mb-6">
              Example Showcase
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              {[...Array(3)].map((_, idx) => (
                <div
                  key={idx}
                  className="aspect-video rounded-2xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 flex items-center justify-center"
                >
                  <div className="text-center">
                    <Video className="h-10 w-10 text-white/20 mx-auto mb-2" />
                    <p className="text-xs text-white/20 font-medium">
                      Coming Soon
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Under Construction Footer */}
            <div className="text-center py-8">
              <Construction className="h-10 w-10 text-amber-400/40 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">
                Full interactive experience launching soon — check back for updates!
              </p>
            </div>
          </div>
        </main>
      </AppLayout>
    </div>
  );
};

export default AIVideoCreationPage;
