// src/pages/tech-skills/AIImageCreationPage.tsx

import React, { useState } from 'react';
import AppLayout from '../../components/layout/AppLayout';
import {
  ImagePlus,
  Construction,
  Wand2,
  Palette,
  Sparkles,
  Layers,
  ZoomIn,
  Download,
  ArrowRight,
} from 'lucide-react';

const toolCards = [
  {
    name: 'DALL·E',
    description: 'OpenAI\'s image generator — great for creative, artistic images from text prompts.',
    color: 'from-emerald-500 to-teal-600',
    icon: <Sparkles size={28} />,
  },
  {
    name: 'Midjourney',
    description: 'Stunning, high-quality art generation with deep control over style and composition.',
    color: 'from-indigo-500 to-purple-600',
    icon: <Palette size={28} />,
  },
  {
    name: 'Stable Diffusion',
    description: 'Open-source image generation — run it locally or customize models for your needs.',
    color: 'from-orange-500 to-red-600',
    icon: <Layers size={28} />,
  },
  {
    name: 'Adobe Firefly',
    description: 'Commercially-safe AI image generation integrated with the Adobe Creative Suite.',
    color: 'from-blue-500 to-cyan-600',
    icon: <Wand2 size={28} />,
  },
];

const skillTopics = [
  'Writing effective image prompts',
  'Understanding style parameters & modifiers',
  'Aspect ratios, resolution, and output quality',
  'Inpainting and outpainting techniques',
  'Image-to-image transformation',
  'Creating consistent characters across images',
  'Ethical use & attribution of AI-generated art',
  'Building an AI art portfolio',
];

const AIImageCreationPage: React.FC = () => {
  const [hoveredCard, setHoveredCard] = useState<number | null>(null);

  return (
    <div className="flex min-h-screen">
      <AppLayout>
        <main className="flex-1 relative overflow-y-auto">
          {/* Background */}
          <div className="fixed top-16 left-64 right-0 bottom-0 bg-gradient-to-br from-fuchsia-950 via-violet-950 to-slate-950 -z-10" />

          <div className="relative z-10 max-w-6xl mx-auto px-6 py-12">
            {/* Header */}
            <div className="text-center mb-10">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-fuchsia-500 to-pink-600 shadow-lg shadow-fuchsia-500/30 mb-4">
                <ImagePlus className="h-8 w-8 text-white" />
              </div>
              <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-fuchsia-300 via-pink-300 to-violet-300 bg-clip-text text-transparent mb-3">
                AI Image Creation
              </h1>
              <p className="text-lg text-fuchsia-200/80 max-w-2xl mx-auto">
                Learn to generate stunning images using AI tools — from crafting the perfect prompt
                to refining outputs for professional-quality results.
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
                  Interactive prompt builder, live generation playground, and guided lessons coming soon!
                </span>
              </div>
              <Construction className="h-6 w-6 text-amber-400 flex-shrink-0" />
            </div>

            {/* Tools Grid */}
            <h2 className="text-2xl font-bold text-white mb-6">
              Tools You'll Learn
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-12">
              {toolCards.map((tool, idx) => (
                <div
                  key={tool.name}
                  className="group relative bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-all duration-300 cursor-default"
                  onMouseEnter={() => setHoveredCard(idx)}
                  onMouseLeave={() => setHoveredCard(null)}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={`flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br ${tool.color} flex items-center justify-center text-white shadow-lg`}
                    >
                      {tool.icon}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white mb-1">
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
                    <ArrowRight size={16} className="text-fuchsia-400 flex-shrink-0" />
                    <span className="text-sm text-gray-300 font-medium">
                      {topic}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Placeholder Gallery */}
            <h2 className="text-2xl font-bold text-white mb-6">
              Example Gallery
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {[...Array(8)].map((_, idx) => (
                <div
                  key={idx}
                  className="aspect-square rounded-2xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 flex items-center justify-center"
                >
                  <div className="text-center">
                    <ImagePlus className="h-8 w-8 text-white/20 mx-auto mb-2" />
                    <p className="text-xs text-white/20 font-medium">Coming Soon</p>
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

export default AIImageCreationPage;
