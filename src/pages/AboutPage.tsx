// src/pages/AboutPage.tsx

import React from 'react';
import AppLayout from '../components/layout/AppLayout';
import { Award, Globe, Code, Brain, Lightbulb, Puzzle, Monitor, MessageSquare, Shield, CheckCircle } from 'lucide-react';

const AboutPage: React.FC = () => {
  const certifications = [
    {
      name: 'AI Proficiency',
      icon: <Award className="h-8 w-8" />,
      color: 'from-purple-600 to-pink-600',
      measures: 'Your ability to use AI tools to solve problems, reason about when and how to use AI, and reflect on its limitations.',
      frameworks: 'UNESCO AI Competency Framework, ISTE Standards for Students',
      matters: "Employers are looking for people who can work with AI, not just around it.",
    },
    {
      name: 'Vibe Coding',
      icon: <Code className="h-8 w-8" />,
      color: 'from-blue-600 to-cyan-600',
      measures: 'Your ability to design algorithms, write logic, use prompts to generate code, and debug effectively with AI assistance.',
      frameworks: 'CSTA K–12 Computer Science Standards, ISTE Computational Thinker',
      matters: "Shows you're ready for tech-related roles — even if you're just starting out.",
    },
    {
      name: 'Critical Thinking',
      icon: <Brain className="h-8 w-8" />,
      color: 'from-purple-600 to-indigo-600',
      measures: 'How you evaluate claims, spot weak arguments, and make sound decisions based on evidence.',
      frameworks: 'UNESCO Transversal Competencies, Partnership for 21st Century Skills',
      matters: 'Critical thinkers make better decisions — in life, in learning, and on the job.',
    },
    {
      name: 'Problem-Solving',
      icon: <Puzzle className="h-8 w-8" />,
      color: 'from-green-600 to-teal-600',
      measures: 'Your ability to define challenges, brainstorm solutions, test and improve ideas.',
      frameworks: 'ISTE Innovative Designer, Design Thinking models',
      matters: "Employers need people who don't give up when the first idea doesn't work.",
    },
    {
      name: 'Creativity',
      icon: <Lightbulb className="h-8 w-8" />,
      color: 'from-yellow-500 to-orange-600',
      measures: 'Your ability to generate original ideas, shift perspectives, and refine your work over time.',
      frameworks: 'Torrance & Guilford Creativity Dimensions; UNESCO Creative Competency',
      matters: 'Creative minds stand out — not just in art, but in business, innovation, and leadership.',
    },
    {
      name: 'Digital Fluency',
      icon: <Monitor className="h-8 w-8" />,
      color: 'from-indigo-600 to-purple-600',
      measures: 'Your confidence navigating apps, tools, systems — especially AI tools — safely and effectively.',
      frameworks: 'UNESCO Digital Literacy Global Framework, DigComp 2.2',
      matters: 'Digital skills are now basic job skills — and fluency beats familiarity.',
    },
    {
      name: 'Communication',
      icon: <MessageSquare className="h-8 w-8" />,
      color: 'from-pink-600 to-red-600',
      measures: 'How clearly you explain, adapt to your audience, and revise your message using feedback.',
      frameworks: 'Classical Rhetoric (ethos/pathos/logos), ISTE Creative Communicator',
      matters: 'Clear communicators lead, teach, and get hired.',
    },
  ];

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto">
        {/* Hero Section */}
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl p-12 mb-8 text-white shadow-xl">
          <Globe className="h-16 w-16 mx-auto mb-4" />
          <h1 className="text-5xl font-bold mb-6 text-center">About This Certification Program</h1>
          <div className="max-w-4xl mx-auto text-lg space-y-4">
            <p className="text-purple-100">
              AI is changing everything — how we learn, work, and solve problems. But using AI isn't enough. 
              To stand out, you need to prove what you can do with it.
            </p>
            <p className="text-purple-100">
              This platform gives learners a chance to do exactly that. Every certification offered here is:
            </p>
          </div>
        </div>

        {/* Key Features */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-xl p-6 shadow-lg">
            <div className="flex items-start gap-3">
              <CheckCircle className="h-6 w-6 text-green-500 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-bold text-lg text-gray-800 mb-2">Skill-based</h3>
                <p className="text-gray-600">Built to measure what you can actually do</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-lg">
            <div className="flex items-start gap-3">
              <CheckCircle className="h-6 w-6 text-green-500 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-bold text-lg text-gray-800 mb-2">Globally grounded</h3>
                <p className="text-gray-600">Aligned to standards from UNESCO, ISTE, CSTA, and other leading frameworks</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-lg">
            <div className="flex items-start gap-3">
              <CheckCircle className="h-6 w-6 text-green-500 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-bold text-lg text-gray-800 mb-2">Resume-ready</h3>
                <p className="text-gray-600">Designed to showcase real-world readiness for school, work, or entrepreneurship</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-lg">
            <div className="flex items-start gap-3">
              <CheckCircle className="h-6 w-6 text-green-500 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-bold text-lg text-gray-800 mb-2">Built for your context</h3>
                <p className="text-gray-600">Designed to work on mobile or laptop, with or without stable internet</p>
              </div>
            </div>
          </div>
        </div>

        {/* Certifications We Offer */}
        <div className="mb-8">
          <h2 className="text-4xl font-bold text-gray-800 mb-6 flex items-center gap-3">
            <Award className="h-10 w-10 text-purple-600" />
            Certifications We Offer
          </h2>

          <div className="space-y-6">
            {certifications.map((cert) => (
              <div
                key={cert.name}
                className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow"
              >
                <div className="flex items-start gap-4 mb-4">
                  <div className={`bg-gradient-to-r ${cert.color} text-white rounded-lg p-3`}>
                    {cert.icon}
                  </div>
                  <h3 className="text-2xl font-bold text-gray-800 mt-2">{cert.name}</h3>
                </div>

                <div className="space-y-3 ml-16">
                  <div>
                    <p className="text-sm font-semibold text-gray-500 mb-1">What it measures:</p>
                    <p className="text-gray-700">{cert.measures}</p>
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-gray-500 mb-1">Frameworks:</p>
                    <p className="text-gray-700 italic">{cert.frameworks}</p>
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-gray-500 mb-1">Why it matters:</p>
                    <p className="text-gray-700">{cert.matters}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Certification You Can Trust */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-8 text-white shadow-xl">
          <div className="flex items-center gap-3 mb-6">
            <Shield className="h-10 w-10" />
            <h2 className="text-3xl font-bold">Certification You Can Trust</h2>
          </div>

          <p className="text-lg text-blue-100 mb-6">
            Our certification program is built from the ground up to be:
          </p>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
              <h4 className="font-bold text-lg mb-2">Meaningful</h4>
              <p className="text-sm text-blue-100">Tied to real-world expectations</p>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
              <h4 className="font-bold text-lg mb-2">Portable</h4>
              <p className="text-sm text-blue-100">Ready for your CV, resume, LinkedIn, or scholarship application</p>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
              <h4 className="font-bold text-lg mb-2">Defensible</h4>
              <p className="text-sm text-blue-100">Scored based on performance and verified criteria</p>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
              <h4 className="font-bold text-lg mb-2">Inclusive</h4>
              <p className="text-sm text-blue-100">Usable on mobile or desktop, even with limited access</p>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default AboutPage;