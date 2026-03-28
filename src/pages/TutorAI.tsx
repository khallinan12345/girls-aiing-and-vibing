import React, {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback
} from 'react';

// Supabase Auth helper (gives you the current session/user)
import { useAuth } from '../hooks/useAuth';   
import { supabase } from '../lib/supabaseClient';
import SpellCheckTextarea from '../components/ui/SpellCheckTextarea';

import Navbar from '../components/layout/Navbar';
import { Bot, User, Send, BookOpen, Scissors, Lightbulb, CheckCircle, AlertCircle, Code, List, Hash, Plus, Users, Star, Mic, Eye, Edit, Download, FileText, Target, Award, Brain } from 'lucide-react';
import classNames from 'classnames';

// Enhanced markdown renderer with icons and rich formatting
const MarkdownText: React.FC<{ text: string }> = ({ text }) => {
  const processInlineFormatting = (text: string) => {
    const elements: (string | JSX.Element)[] = [];
    let keyCounter = 0;

    // Process **bold**, *italic*, and `code` formatting
    const formatRegex = /(\*\*.*?\*\*|\*.*?\*|`.*?`)/g;
    let lastIndex = 0;
    let match;

    while ((match = formatRegex.exec(text)) !== null) {
      // Add text before match
      if (match.index > lastIndex) {
        elements.push(text.slice(lastIndex, match.index));
      }

      const matchText = match[1];
      if (matchText.startsWith('**') && matchText.endsWith('**')) {
        // Bold text
        elements.push(
          <strong key={`bold-${keyCounter++}`} className="font-bold text-gray-900">
            {matchText.slice(2, -2)}
          </strong>
        );
      } else if (matchText.startsWith('*') && matchText.endsWith('*')) {
        // Italic text
        elements.push(
          <em key={`italic-${keyCounter++}`} className="italic text-gray-800">
            {matchText.slice(1, -1)}
          </em>
        );
      } else if (matchText.startsWith('`') && matchText.endsWith('`')) {
        // Inline code
        elements.push(
          <code key={`code-${keyCounter++}`} className="bg-gray-200 text-gray-800 px-1 py-0.5 rounded text-sm font-mono">
            {matchText.slice(1, -1)}
          </code>
        );
      }

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      elements.push(text.slice(lastIndex));
    }

    return elements.length > 0 ? elements : [text];
  };

  const renderMarkdown = (text: string) => {
    const lines = text.split('\n');
    const elements: JSX.Element[] = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];
      const trimmedLine = line.trim();

      if (!trimmedLine) {
        i++;
        continue;
      }

      // Headers
      if (trimmedLine.startsWith('#')) {
        const headerLevel = trimmedLine.match(/^#+/)?.[0].length || 1;
        const headerText = trimmedLine.replace(/^#+\s*/, '');
        const HeaderTag = `h${Math.min(headerLevel, 6)}` as keyof JSX.IntrinsicElements;
        
        let icon;
        let headerClass = '';
        
        if (headerLevel === 1) {
          icon = <Hash className="w-6 h-6 text-blue-600" />;
          headerClass = 'text-2xl font-bold text-gray-900 flex items-center gap-2 mb-4 mt-6 border-b border-gray-200 pb-2';
        } else if (headerLevel === 2) {
          icon = <BookOpen className="w-5 h-5 text-blue-500" />;
          headerClass = 'text-xl font-semibold text-gray-800 flex items-center gap-2 mb-3 mt-5';
        } else {
          icon = <Lightbulb className="w-4 h-4 text-yellow-500" />;
          headerClass = 'text-lg font-medium text-gray-700 flex items-center gap-2 mb-2 mt-4';
        }

        elements.push(
          <HeaderTag key={`header-${i}`} className={headerClass}>
            {icon}
            {headerText}
          </HeaderTag>
        );
      }
      // Code blocks
      else if (trimmedLine.startsWith('```')) {
        const codeLines: string[] = [];
        i++; // Skip the opening ```
        
        while (i < lines.length && !lines[i].trim().startsWith('```')) {
          codeLines.push(lines[i]);
          i++;
        }
        
        elements.push(
          <div key={`codeblock-${i}`} className="my-4">
            <div className="flex items-center gap-2 bg-gray-800 text-white px-3 py-2 rounded-t-lg text-sm">
              <Code className="w-4 h-4" />
              Code
            </div>
            <pre className="bg-gray-100 border border-gray-300 rounded-b-lg p-4 overflow-x-auto">
              <code className="text-sm font-mono text-gray-800">
                {codeLines.join('\n')}
              </code>
            </pre>
          </div>
        );
      }
      // Unordered lists
      else if (trimmedLine.match(/^[-*+]\s/)) {
        const listItems: string[] = [];
        
        while (i < lines.length && lines[i].trim().match(/^[-*+]\s/)) {
          listItems.push(lines[i].trim().replace(/^[-*+]\s/, ''));
          i++;
        }
        i--; // Back up one since we'll increment at the end
        
        elements.push(
          <div key={`list-${i}`} className="my-4">
            <div className="flex items-center gap-2 text-gray-700 mb-2">
              <List className="w-4 h-4 text-green-600" />
              <span className="font-medium text-sm">Key Points</span>
            </div>
            <ul className="ml-6 space-y-1">
              {listItems.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">
                    {processInlineFormatting(item).map((element, eIdx) => (
                      <React.Fragment key={eIdx}>{element}</React.Fragment>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        );
      }
      // Numbered lists
      else if (trimmedLine.match(/^\d+\.\s/)) {
        const listItems: string[] = [];
        
        while (i < lines.length && lines[i].trim().match(/^\d+\.\s/)) {
          listItems.push(lines[i].trim().replace(/^\d+\.\s/, ''));
          i++;
        }
        i--; // Back up one since we'll increment at the end
        
        elements.push(
          <div key={`orderedlist-${i}`} className="my-4">
            <div className="flex items-center gap-2 text-gray-700 mb-2">
              <Hash className="w-4 h-4 text-blue-600" />
              <span className="font-medium text-sm">Steps</span>
            </div>
            <ol className="ml-6 space-y-2">
              {listItems.map((item, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-800 rounded-full flex items-center justify-center text-sm font-semibold">
                    {idx + 1}
                  </span>
                  <span className="text-gray-700 pt-0.5">
                    {processInlineFormatting(item).map((element, eIdx) => (
                      <React.Fragment key={eIdx}>{element}</React.Fragment>
                    ))}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        );
      }
      // Important callouts (lines starting with "**Important:**", "**Note:**", etc.)
      else if (trimmedLine.match(/^\*\*(Important|Note|Warning|Tip|Remember):\*\*/i)) {
        const type = trimmedLine.match(/^\*\*(Important|Note|Warning|Tip|Remember):\*\*/i)?.[1].toLowerCase();
        const content = trimmedLine.replace(/^\*\*(Important|Note|Warning|Tip|Remember):\*\*\s*/i, '');
        
        let icon;
        let bgColor = '';
        let borderColor = '';
        let textColor = '';
        
        switch (type) {
          case 'important':
          case 'warning':
            icon = <AlertCircle className="w-5 h-5 text-red-600" />;
            bgColor = 'bg-red-50';
            borderColor = 'border-red-200';
            textColor = 'text-red-800';
            break;
          case 'tip':
            icon = <Lightbulb className="w-5 h-5 text-yellow-600" />;
            bgColor = 'bg-yellow-50';
            borderColor = 'border-yellow-200';
            textColor = 'text-yellow-800';
            break;
          default:
            icon = <AlertCircle className="w-5 h-5 text-blue-600" />;
            bgColor = 'bg-blue-50';
            borderColor = 'border-blue-200';
            textColor = 'text-blue-800';
        }
        
        elements.push(
          <div key={`callout-${i}`} className={`my-4 p-4 rounded-lg border ${bgColor} ${borderColor}`}>
            <div className={`flex items-start gap-3 ${textColor}`}>
              {icon}
              <div>
                <div className="font-semibold capitalize mb-1">{type}:</div>
                <div>
                  {processInlineFormatting(content).map((element, eIdx) => (
                    <React.Fragment key={eIdx}>{element}</React.Fragment>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      }
      // Topic headings (Topic:, Final Prompt to Tutor Agent:, etc.)
      else if (trimmedLine.match(/^(Topic:|Final Prompt to Tutor Agent:|Chat History:|INPUT:|OUTPUT:)/i)) {
        elements.push(
          <div key={`topic-heading-${i}`} className="font-bold text-purple-800 text-lg mb-2 mt-4">
            {trimmedLine}
          </div>
        );
      }
      // Regular paragraphs
      else {
        // Collect consecutive non-special lines into a paragraph
        const paragraphLines: string[] = [];
        
        while (i < lines.length && 
               lines[i].trim() && 
               !lines[i].trim().startsWith('#') && 
               !lines[i].trim().startsWith('```') &&
               !lines[i].trim().match(/^[-*+]\s/) &&
               !lines[i].trim().match(/^\d+\.\s/) &&
               !lines[i].trim().match(/^\*\*(Important|Note|Warning|Tip|Remember):\*\*/i) &&
               !lines[i].trim().match(/^(Topic:|Final Prompt to Tutor Agent:|Chat History:|INPUT:|OUTPUT:)/i)) {
          paragraphLines.push(lines[i]);
          i++;
        }
        i--; // Back up one since we'll increment at the end
        
        if (paragraphLines.length > 0) {
          elements.push(
            <p key={`paragraph-${i}`} className="text-gray-700 leading-relaxed my-3">
              {processInlineFormatting(paragraphLines.join(' ')).map((element, eIdx) => (
                <React.Fragment key={eIdx}>{element}</React.Fragment>
              ))}
            </p>
          );
        }
      }
      
      i++;
    }

    return elements;
  };

  return <div className="markdown-content">{renderMarkdown(text)}</div>;
};

// Confetti Animation Component
const ConfettiAnimation: React.FC = () => {
  const colors = ['#ff1493', '#9932cc', '#ffd700', '#ff69b4', '#8a2be2', '#ffd700']; // Pink, purple, yellow
  
  return (
    <>
      <style>{`
        @keyframes confetti-fall {
          0% {
            transform: translateY(-100vh) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }
        .confetti-piece {
          animation: confetti-fall 4s linear forwards;
        }
      `}</style>
      <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
        {Array.from({ length: 100 }).map((_, i) => (
          <div
            key={i}
            className="absolute w-3 h-3 opacity-90 confetti-piece"
            style={{
              backgroundColor: colors[i % colors.length],
              left: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 3}s`,
              animationDuration: `${3 + Math.random() * 2}s`,
              transform: `rotate(${Math.random() * 360}deg)`,
              borderRadius: Math.random() > 0.5 ? '50%' : '0%',
            }}
          />
        ))}
      </div>
    </>
  );
};

interface ChatMessage {
  role: 'assistant' | 'user';
  content: string;
  timestamp: Date;
}

interface AvailableTutor {
  learning_module_id: string;
  title: string;
  description: string;
  sub_category: string;
  outcomes: string;
  metrics_for_success: string;
  ai_facilitator_instructions: string;
  ai_assessment_instructions: string;
}

interface TutorSession {
  id: string;
  title: string;
  activity: string;
  sub_category: string;
  learning_module_id: string;
  progress: string;
  evaluation_score?: number;
  evaluation_evidence?: string;
  chat_history?: string;
  created_at: string;
}

interface LearningModule {
  learning_module_id: string;
  title: string;
  description: string;
  category: string;
  sub_category: string;
  outcomes: string;
  metrics_for_success: string;
  ai_facilitator_instructions: string;
  ai_assessment_instructions: string;
  user_id: string;
  public: number;
  grade_level: number;
  country: string;
}

const TutorAI = () => {
  /* ------------------------------------------------------------------ *
   * Authenticated user
   * ------------------------------------------------------------------ */
  const { user: authUser, loading: authLoading } = useAuth();

  // While the auth hook is still fetching the profile, keep the spinner.
  if (authLoading) {
    return <p className="p-4 text-center">Loading …</p>;
  }

  // Safety net: should never happen because pages are gated,
  // but avoids undefined crashes if someone lands here unauthenticated.
  if (!authUser?.id) {
    return <p className="p-4 text-center text-red-600">
      No signed-in user – please log in again.
    </p>;
  }

  // Stable ref so downstream hooks don't re-fire every render
  const user = useMemo(() => ({ id: authUser.id }), [authUser.id]);

  // Voice functionality state
  const [voiceInputEnabled, setVoiceInputEnabled] = useState(false);
  const [voiceOutputEnabled, setVoiceOutputEnabled] = useState(true);
  const [designIsListening, setDesignIsListening] = useState(false);
  const [tutorIsListening, setTutorIsListening] = useState(false);
  const [editIsListening, setEditIsListening] = useState(false);
  const [designSpeechRecognition, setDesignSpeechRecognition] = useState<any>(null);
  const [tutorSpeechRecognition, setTutorSpeechRecognition] = useState<any>(null);
  const [editSpeechRecognition, setEditSpeechRecognition] = useState<any>(null);
  const [designWasListeningBeforeSubmit, setDesignWasListeningBeforeSubmit] = useState(false);
  const [tutorWasListeningBeforeSubmit, setTutorWasListeningBeforeSubmit] = useState(false);
  const [editWasListeningBeforeSubmit, setEditWasListeningBeforeSubmit] = useState(false);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [userContinent, setUserContinent] = useState<string | null>(null);

  // Available tutors and selection state
  const [availableTutors, setAvailableTutors] = useState<AvailableTutor[]>([]);
  const [selectedTutor, setSelectedTutor] = useState<AvailableTutor | null>(null);
  const [selectedLearningModule, setSelectedLearningModule] = useState<LearningModule | null>(null);
  const [currentSession, setCurrentSession] = useState<TutorSession | null>(null);
  const [showCreateNew, setShowCreateNew] = useState(false);
  
  // Design Your Tutor section state
  const [designChatHistory, setDesignChatHistory] = useState<ChatMessage[]>([]);
  const [designUserInput, setDesignUserInput] = useState<string>('');
  const [designLoading, setDesignLoading] = useState(false);
  const [tutorInstructions, setTutorInstructions] = useState<string>('');
  const [finalizingTutor, setFinalizingTutor] = useState(false);
  
  // Use Your Tutor section state
  const [tutorChatHistory, setTutorChatHistory] = useState<ChatMessage[]>([]);
  const [tutorUserInput, setTutorUserInput] = useState<string>('');
  const [tutorLoading, setTutorLoading] = useState(false);

  // New modal states
  const [showTutorDetailsModal, setShowTutorDetailsModal] = useState(false);
  const [showEditTutorModal, setShowEditTutorModal] = useState(false);
  const [showFinalizedTutorModal, setShowFinalizedTutorModal] = useState(false);
  const [editingTutor, setEditingTutor] = useState<AvailableTutor | null>(null);
  const [viewingTutor, setViewingTutor] = useState<AvailableTutor | null>(null);
  const [finalizedTutorData, setFinalizedTutorData] = useState<any>(null);
  
  // Edit tutor state
  const [editChatHistory, setEditChatHistory] = useState<ChatMessage[]>([]);
  const [editUserInput, setEditUserInput] = useState<string>('');
  const [editLoading, setEditLoading] = useState(false);
  const [editTutorInstructions, setEditTutorInstructions] = useState<string>('');
  const [updatingTutor, setUpdatingTutor] = useState(false);
  
  // New state for enhanced features
  const [userGradeLevel, setUserGradeLevel] = useState<number | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  const [showEvaluationModal, setShowEvaluationModal] = useState(false);
  const [evaluationResult, setEvaluationResult] = useState<{score: number, evidence: string} | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  
  const designChatRef = useRef<HTMLDivElement>(null);
  const tutorChatRef = useRef<HTMLDivElement>(null);
  const editChatRef = useRef<HTMLDivElement>(null);

  // Initialize speech recognition and voices
  useEffect(() => {
    // Initialize speech recognition for design chat
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      
      // Design chat speech recognition
      const designRecognition = new SpeechRecognition();
      designRecognition.continuous = true;
      designRecognition.interimResults = true;
      designRecognition.lang = 'en-US';
      
      designRecognition.onstart = () => setDesignIsListening(true);
      designRecognition.onend = () => setDesignIsListening(false);
      
      designRecognition.onresult = (event: any) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          }
        }
        if (finalTranscript) {
          setDesignUserInput(prev => prev + finalTranscript);
        }
      };
      
      designRecognition.onerror = (event: any) => {
        console.error('Design speech recognition error:', event.error);
        if (event.error !== 'no-speech' && event.error !== 'audio-capture') {
          setDesignIsListening(false);
          alert('Voice input error: ' + event.error);
        }
      };
      
      setDesignSpeechRecognition(designRecognition);

      // Tutor chat speech recognition
      const tutorRecognition = new SpeechRecognition();
      tutorRecognition.continuous = true;
      tutorRecognition.interimResults = true;
      tutorRecognition.lang = 'en-US';
      
      tutorRecognition.onstart = () => setTutorIsListening(true);
      tutorRecognition.onend = () => setTutorIsListening(false);
      
      tutorRecognition.onresult = (event: any) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          }
        }
        if (finalTranscript) {
          setTutorUserInput(prev => prev + finalTranscript);
        }
      };
      
      tutorRecognition.onerror = (event: any) => {
        console.error('Tutor speech recognition error:', event.error);
        if (event.error !== 'no-speech' && event.error !== 'audio-capture') {
          setTutorIsListening(false);
          alert('Voice input error: ' + event.error);
        }
      };
      
      setTutorSpeechRecognition(tutorRecognition);

      // Edit chat speech recognition
      const editRecognition = new SpeechRecognition();
      editRecognition.continuous = true;
      editRecognition.interimResults = true;
      editRecognition.lang = 'en-US';
      
      editRecognition.onstart = () => setEditIsListening(true);
      editRecognition.onend = () => setEditIsListening(false);
      
      editRecognition.onresult = (event: any) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          }
        }
        if (finalTranscript) {
          setEditUserInput(prev => prev + finalTranscript);
        }
      };
      
      editRecognition.onerror = (event: any) => {
        console.error('Edit speech recognition error:', event.error);
        if (event.error !== 'no-speech' && event.error !== 'audio-capture') {
          setEditIsListening(false);
          alert('Voice input error: ' + event.error);
        }
      };
      
      setEditSpeechRecognition(editRecognition);
    }

    // Initialize speech synthesis voices
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      console.log('[Voice] Available voices:', voices.map(v => `${v.name} (${v.lang})`));
      setAvailableVoices(voices);
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  // Select appropriate voice based on user's continent and grade level
  useEffect(() => {
    if (availableVoices.length > 0 && userContinent) {
      const voice = selectCulturallyAppropriateVoice(userContinent, userGradeLevel);
      setSelectedVoice(voice);
      console.log('[Voice] Selected voice:', voice?.name, voice?.lang);
    }
  }, [availableVoices, userContinent, userGradeLevel]);

  // Function to select culturally appropriate voice
  const selectCulturallyAppropriateVoice = (continent: string, gradeLevel: number | null): SpeechSynthesisVoice | null => {
    if (availableVoices.length === 0) return null;

    // FORCE GOOGLE US ENGLISH FEMALE 4 VOICE
    const googleFemale4 = availableVoices.find(v => 
      v.name === 'Google US English Female 4' ||
      v.name.toLowerCase().includes('google us english female 4')
    );
    if (googleFemale4) {
      console.log('[Voice] Found and using Google US English Female 4:', googleFemale4.name);
      return googleFemale4;
    }

    let preferredVoices: string[] = [];
    let preferredLangs: string[] = [];

    if (continent === 'North America') {
      preferredVoices = [
        'Google US English Female 6', 
        'Google US English Female 2',
        'Google US English Female 3',
        'Google US English Female 5',
        'Google US English Female', 
        'Microsoft Jenny Online (Natural)', 
        'Microsoft Aria Online (Natural)',
      ];
      preferredLangs = ['en-US', 'en-CA'];
    } else if (continent === 'Africa') {
      preferredVoices = [
        'Microsoft Abeo Online (Natural)',
        'Microsoft Aditi Desktop',
        'Google UK English Female',
        'Microsoft Hazel Desktop',
        'Kate',
        'Daniel',
        'Serena',
        'Moira',
        'Karen',
        'Veena'
      ];
      preferredLangs = ['en-NG', 'en-GB', 'en-AU', 'en-IN', 'en-ZA', 'en-US'];
    } else {
      preferredVoices = [
        'Microsoft Aria Online (Natural)',
        'Google US English Female',
      ];
      preferredLangs = ['en-US', 'en-GB'];
    }

    // Try to find exact voice name matches
    for (const voiceName of preferredVoices) {
      const voice = availableVoices.find(v => 
        v.name.toLowerCase().includes(voiceName.toLowerCase())
      );
      if (voice) return voice;
    }

    // Try to find voices by language preference and female gender
    for (const lang of preferredLangs) {
      const voice = availableVoices.find(v => 
        v.lang.startsWith(lang) && 
        (v.name.toLowerCase().includes('female') || 
         v.name.toLowerCase().includes('woman') ||
         /samantha|victoria|zira|aria|ava|serena|allison|erin|fiona|kate|hazel|moira|karen|veena/i.test(v.name))
      );
      if (voice) return voice;
    }

    // Fallback to any voice in preferred languages
    for (const lang of preferredLangs) {
      const voice = availableVoices.find(v => v.lang.startsWith(lang));
      if (voice) return voice;
    }

    return availableVoices[0] || null;
  };

  // Voice input functions
  const startDesignVoiceInput = () => {
    if (!designSpeechRecognition) {
      alert('Voice input is not supported in your browser. Please use Chrome, Edge, or Safari.');
      return;
    }
    
    if (designIsListening) {
      designSpeechRecognition.stop();
      setDesignWasListeningBeforeSubmit(false);
      return;
    }
    
    try {
      designSpeechRecognition.start();
    } catch (error) {
      console.error('Error starting design voice input:', error);
      alert('Could not start voice input. Please try again.');
    }
  };

  const startTutorVoiceInput = () => {
    if (!tutorSpeechRecognition) {
      alert('Voice input is not supported in your browser. Please use Chrome, Edge, or Safari.');
      return;
    }
    
    if (tutorIsListening) {
      tutorSpeechRecognition.stop();
      setTutorWasListeningBeforeSubmit(false);
      return;
    }
    
    try {
      tutorSpeechRecognition.start();
    } catch (error) {
      console.error('Error starting tutor voice input:', error);
      alert('Could not start voice input. Please try again.');
    }
  };

  const startEditVoiceInput = () => {
    if (!editSpeechRecognition) {
      alert('Voice input is not supported in your browser. Please use Chrome, Edge, or Safari.');
      return;
    }
    
    if (editIsListening) {
      editSpeechRecognition.stop();
      setEditWasListeningBeforeSubmit(false);
      return;
    }
    
    try {
      editSpeechRecognition.start();
    } catch (error) {
      console.error('Error starting edit voice input:', error);
      alert('Could not start voice input. Please try again.');
    }
  };

  // Function to speak AI response
  const speakAIResponse = (text: string, wasListeningBefore: boolean, speechRecognition: any, setListening: (value: boolean) => void) => {
    if (voiceOutputEnabled && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      
      if (selectedVoice) {
        utterance.voice = selectedVoice;
        utterance.lang = selectedVoice.lang;
        console.log('[Voice] Using voice:', selectedVoice.name, selectedVoice.lang);
      } else {
        utterance.lang = 'en-US';
      }

      utterance.rate = 0.85;
      utterance.pitch = 1.1;
      utterance.volume = 0.9;

      if (userContinent === 'North America') {
        utterance.rate = 0.9;
        utterance.pitch = 1.15;
      } else if (userContinent === 'Africa') {
        utterance.rate = 0.8;
        utterance.pitch = 1.0;
      }

      if (userGradeLevel === 1) {
        utterance.rate = 0.75;
        utterance.pitch = 1.2;
      } else if (userGradeLevel === 2) {
        utterance.rate = 0.8;
        utterance.pitch = 1.1;
      }

      utterance.onend = () => {
        console.log('[Voice] Speech synthesis ended');
        if (wasListeningBefore && voiceInputEnabled && speechRecognition) {
          setTimeout(() => {
            try {
              speechRecognition.start();
              setListening(true);
              console.log('[Voice] Restarted speech recognition');
            } catch (error) {
              console.error('Error restarting voice input:', error);
            }
          }, 500);
        }
      };

      utterance.onerror = (event) => {
        console.error('[Voice] Speech synthesis error:', event.error);
        if (wasListeningBefore && voiceInputEnabled && speechRecognition) {
          setTimeout(() => {
            try {
              speechRecognition.start();
              setListening(true);
            } catch (error) {
              console.error('Error restarting voice input after speech error:', error);
            }
          }, 500);
        }
      };

      console.log('[Voice] Starting speech synthesis with voice:', utterance.voice?.name || 'default');
      window.speechSynthesis.speak(utterance);
    } else {
      if (wasListeningBefore && voiceInputEnabled && speechRecognition) {
        setTimeout(() => {
          try {
            speechRecognition.start();
            setListening(true);
          } catch (error) {
            console.error('Error restarting voice input:', error);
          }
        }, 100);
      }
    }
  };

  // Function to fetch user's grade level and continent
  const fetchUserProfile = async (userId: string) => {
    try {
      console.log('[Profile] Fetching profile for user:', userId);
      
      const { data, error } = await supabase
        .from('profiles')
        .select('grade_level, continent')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('[Profile] Error fetching profile:', error);
        return { gradeLevel: null, continent: null };
      }

      console.log('[Profile] Profile fetched:', data);
      return {
        gradeLevel: data?.grade_level || null,
        continent: data?.continent || null
      };
    } catch (err) {
      console.error('[Profile] Error fetching user profile:', err);
      return { gradeLevel: null, continent: null };
    }
  };

  // Function to get grade-appropriate instructions
  const getGradeAppropriateInstructions = (gradeLevel: number | null): string => {
    const commonGuidance = `CRITICAL: Your role is to GUIDE learning, not give direct answers. Always use the Socratic method - ask questions that lead students to discover answers themselves. When students ask questions, respond with guiding questions that help them think through the problem. Provide hints and encouragement, but let them do the thinking and discovery.

RESPONSE LENGTH: Keep responses to 75 words maximum unless it's absolutely essential to provide more information for understanding. Be concise while maintaining effectiveness.`;
    
    if (gradeLevel === 1) {
      // Grades 3-5 (Elementary)
      return `${commonGuidance}

Important: This student is in elementary school (grades 3-5). Use simple, clear language that a 8-11 year old can understand. Use shorter sentences, avoid complex vocabulary, and be extra encouraging and patient. 

TEACHING APPROACH: Ask simple guiding questions like "What do you think might happen if...?" or "Can you tell me what you notice about...?" Break complex ideas into smaller steps. Use examples from their daily life like family, pets, games, or school activities. Celebrate their thinking process, not just correct answers. Make learning feel like a fun puzzle to solve together!`;
    } else if (gradeLevel === 2) {
      // Grades 6-8 (Middle School)
      return `${commonGuidance}

Important: This student is in middle school (grades 6-8). Use age-appropriate language for a 11-14 year old. You can use slightly more complex vocabulary but still keep explanations clear and relatable.

TEACHING APPROACH: Ask thought-provoking questions that build on their developing critical thinking skills. Use questions like "Why do you think that happened?" or "What evidence supports that idea?" Help them make connections between concepts. Use examples from school life, friends, technology, and current events they might relate to. Encourage them to explain their reasoning and challenge them to think deeper.`;
    } else if (gradeLevel === 3) {
      // Grades 9-12 (High School)
      return `${commonGuidance}

Important: This student is in high school (grades 9-12). You can use more sophisticated language and concepts appropriate for a 14-18 year old. They can handle complex ideas and abstract thinking.

TEACHING APPROACH: Use advanced questioning techniques that promote analytical and critical thinking. Ask questions like "How would you analyze this situation?" or "What are the implications of this concept?" Encourage them to evaluate different perspectives, make predictions, and synthesize information. Connect learning to their future goals, college prep, career interests, and real-world applications. Challenge them to defend their reasoning and consider alternative viewpoints.`;
    } else {
      // Default/Unknown grade level
      return `${commonGuidance}

Important: Adapt your communication style to be clear and age-appropriate. Use encouraging language and check for understanding frequently. Focus on guiding the student to discover answers through thoughtful questioning rather than providing direct solutions.`;
    }
  };

  // Load available tutors from learning_modules
  const loadAvailableTutors = useCallback(async () => {
    try {
      console.log('Loading available tutors for user:', user.id);
  
      const { data, error } = await supabase
        .from('learning_modules')
        .select(
          'learning_module_id, title, description, sub_category, outcomes, metrics_for_success, ai_facilitator_instructions, ai_assessment_instructions'
        )
        .eq('user_id', user.id)
        .eq('category', 'Tutor')
        .order('created_at', { ascending: false });
  
      if (error) throw error;
  
      setAvailableTutors(data ?? []);
    } catch (err) {
      console.error('Error loading available tutors:', err);
    }
  }, [user.id]);

  // View tutor details
  const handleViewTutor = (tutor: AvailableTutor) => {
    setViewingTutor(tutor);
    setShowTutorDetailsModal(true);
  };

  // Start editing tutor
  const handleEditTutor = (tutor: AvailableTutor) => {
    setEditingTutor(tutor);
    setEditTutorInstructions(tutor.ai_facilitator_instructions);
    
    // Initialize edit chat with current tutor prompt
    const initialMessage: ChatMessage = {
      role: 'assistant',
      content: `Here's your current tutor prompt:\n\n---\n\n${tutor.ai_facilitator_instructions}\n\n---\n\nHow would you like to change or improve this tutor prompt?`,
      timestamp: new Date()
    };
    
    setEditChatHistory([initialMessage]);
    setEditUserInput('');
    setShowEditTutorModal(true);
  };

  // Download PDF function
  const downloadTutorPDF = async (tutorData: any) => {
    try {
      // Import jsPDF dynamically
      const { jsPDF } = await import('jspdf');
      
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 20;
      const lineHeight = 7;
      let yPosition = margin;

      // Helper function to add text with word wrap
      const addWrappedText = (text: string, fontSize: number = 12, fontStyle: string = 'normal') => {
        doc.setFontSize(fontSize);
        doc.setFont('helvetica', fontStyle);
        
        const maxWidth = pageWidth - (margin * 2);
        const lines = doc.splitTextToSize(text, maxWidth);
        
        for (const line of lines) {
          if (yPosition + lineHeight > pageHeight - margin) {
            doc.addPage();
            yPosition = margin;
          }
          doc.text(line, margin, yPosition);
          yPosition += lineHeight;
        }
      };

      // Add header with gradient effect simulation
      doc.setFillColor(59, 130, 246); // Blue
      doc.rect(0, 0, pageWidth, 40, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(24);
      doc.setFont('helvetica', 'bold');
      doc.text('AI Tutor Configuration', margin, 25);
      
      yPosition = 60;
      doc.setTextColor(0, 0, 0);

      // Title Section
      doc.setFillColor(243, 244, 246);
      doc.rect(margin - 5, yPosition - 10, pageWidth - (margin * 2) + 10, 25, 'F');
      doc.setTextColor(59, 130, 246);
      addWrappedText('📚 TITLE', 16, 'bold');
      yPosition += 5;
      doc.setTextColor(0, 0, 0);
      addWrappedText(tutorData.title || 'Custom AI Tutor', 14, 'normal');
      yPosition += 15;

      // Description Section
      doc.setFillColor(243, 244, 246);
      doc.rect(margin - 5, yPosition - 10, pageWidth - (margin * 2) + 10, 25, 'F');
      doc.setTextColor(34, 197, 94);
      addWrappedText('📝 DESCRIPTION', 16, 'bold');
      yPosition += 5;
      doc.setTextColor(0, 0, 0);
      addWrappedText(tutorData.description || 'A personalized AI tutor designed to guide students through their learning journey.', 12, 'normal');
      yPosition += 15;

      // Outcomes Section
      doc.setFillColor(243, 244, 246);
      doc.rect(margin - 5, yPosition - 10, pageWidth - (margin * 2) + 10, 25, 'F');
      doc.setTextColor(168, 85, 247);
      addWrappedText('🎯 LEARNING OUTCOMES', 16, 'bold');
      yPosition += 5;
      doc.setTextColor(0, 0, 0);
      addWrappedText(tutorData.outcomes || 'Students will gain understanding and mastery of the subject matter.', 12, 'normal');
      yPosition += 15;

      // Success Metrics Section
      doc.setFillColor(243, 244, 246);
      doc.rect(margin - 5, yPosition - 10, pageWidth - (margin * 2) + 10, 25, 'F');
      doc.setTextColor(245, 158, 11);
      addWrappedText('🏆 SUCCESS METRICS', 16, 'bold');
      yPosition += 5;
      doc.setTextColor(0, 0, 0);
      addWrappedText(tutorData.metrics_for_success || 'Completion of exercises, comprehension demonstrated through Q&A, and practical application.', 12, 'normal');
      yPosition += 15;

      // Tutor Instructions Section
      doc.setFillColor(243, 244, 246);
      doc.rect(margin - 5, yPosition - 10, pageWidth - (margin * 2) + 10, 25, 'F');
      doc.setTextColor(239, 68, 68);
      addWrappedText('🤖 AI TUTOR INSTRUCTIONS', 16, 'bold');
      yPosition += 5;
      doc.setTextColor(0, 0, 0);
      addWrappedText(tutorData.ai_facilitator_instructions || tutorData.instructions || 'Guide students through their learning journey using the Socratic method.', 10, 'normal');

      // Add footer
      const currentDate = new Date().toLocaleDateString();
      doc.setFontSize(8);
      doc.setTextColor(128, 128, 128);
      doc.text(`Generated on ${currentDate} | AI Tutor Platform`, margin, pageHeight - 10);

      // Save the PDF
      const fileName = `${(tutorData.title || 'Custom AI Tutor').replace(/[^a-z0-9]/gi, '_').toLowerCase()}_tutor_config.pdf`;
      doc.save(fileName);
      
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Could not generate PDF. Please try again.');
    }
  };

    /** Delete a saved Tutor + its dashboard entry */
    const handleDeleteTutor = async (learningModuleId: string) => {
      if (!confirm('Are you sure you want to delete this tutor?  This cannot be undone.')) return;
  
      try {
        // 1. Remove any dashboard rows for this tutor
        const { error: dashError } = await supabase
          .from('dashboard')
          .delete()
          .eq('learning_module_id', learningModuleId)
          .eq('user_id', user.id);
  
        if (dashError) throw dashError;
  
        // 2. Remove the tutor's learning_module record
        const { error: moduleError } = await supabase
          .from('learning_modules')
          .delete()
          .eq('learning_module_id', learningModuleId)
          .eq('user_id', user.id);
  
        if (moduleError) throw moduleError;
  
        // 3. Refresh local list
        await loadAvailableTutors();
  
        // 4. Clear selection if we just deleted it
        if (selectedTutor?.learning_module_id === learningModuleId) {
          setSelectedTutor(null);
          setCurrentSession(null);
          setTutorChatHistory([]);
        }
  
        alert('Tutor deleted successfully!');
      } catch (err) {
        console.error('Failed to delete tutor:', err);
        alert('Could not delete tutor. Please try again.');
      }
    };

  // Load available tutors and user profile on component mount
  useEffect(() => {
    if (user?.id) {
      loadAvailableTutors();
      
      // Fetch user's profile if not already loaded
      if (userGradeLevel === null || userContinent === null) {
        fetchUserProfile(user.id).then(profile => {
          setUserGradeLevel(profile.gradeLevel);
          setUserContinent(profile.continent);
        });
      }
    }
  }, [loadAvailableTutors, user?.id, userGradeLevel, userContinent]);

  // Auto-scroll chat boxes to bottom when content changes
  useEffect(() => {
    if (designChatRef.current) {
      designChatRef.current.scrollTop = designChatRef.current.scrollHeight;
    }
  }, [designChatHistory]);

  useEffect(() => {
    if (tutorChatRef.current) {
      tutorChatRef.current.scrollTop = tutorChatRef.current.scrollHeight;
    }
  }, [tutorChatHistory]);

  useEffect(() => {
    if (editChatRef.current) {
      editChatRef.current.scrollTop = editChatRef.current.scrollHeight;
    }
  }, [editChatHistory]);

  const loadLearningModule = async (learningModuleId: string) => {
    try {
      const { data, error } = await supabase
        .from('learning_modules')
        .select('*')
        .eq('learning_module_id', learningModuleId)
        .single();

      if (error) throw error;
      setSelectedLearningModule(data);
      setTutorInstructions(data.ai_facilitator_instructions || '');
    } catch (error) {
      console.error('Error loading learning module:', error);
    }
  };

  const callOpenAI = async (messages: any[], model: string = 'gpt-4.1') => {
    try {
      const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
      if (!apiKey || apiKey === 'undefined' || apiKey.trim() === '') {
        throw new Error('OpenAI API key not found. Please check your environment variables.');
      }

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model,
          messages: messages,
          max_tokens: model === 'gpt-4.1' ? 500 : 1000,
          temperature: 0.7
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`OpenAI API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();
      return data.choices[0]?.message?.content || 'AI failed to respond.';
    } catch (error) {
      console.error('AI Error:', error);
      return 'An error occurred. Please try again.';
    }
  };

  // Assessment API call
  const callAssessmentAI = async (chatHistory: ChatMessage[], assessmentInstructions: string, outcomes: string, successMetrics: string) => {
    try {
      console.log('[Assessment] Making assessment API call');
      
      const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
      
      if (!apiKey || apiKey === 'undefined' || apiKey.trim() === '') {
        throw new Error('OpenAI API key not found. Please check your environment variables.');
      }

      const chatHistoryText = chatHistory.slice(1).map(msg => 
        `${msg.role === 'assistant' ? 'AI Tutor' : 'Student'}: ${msg.content}`
      ).join('\n\n');

      const assessmentPrompt = `Assessment Instructions:
${assessmentInstructions}

Learning Outcomes:
${outcomes}

Success Metrics for Evaluation:
${successMetrics}

Please evaluate the student's performance based on the above assessment instructions, learning outcomes, and success metrics. Use the conversation history below to make your evaluation.

Conversation History:
${chatHistoryText}

CRITICAL: You must respond with ONLY valid JSON in exactly this format:
{
  "evaluation_score": [number from 0-100],
  "evaluation_evidence": "[detailed explanation of the score]"
}
If the ${assessmentInstructions} ask for an evaluation score in the range of 0-1, scale appropriately from 0 to 100. 
The assessment MUST be an integer. 

Remember:
- 0-30: Poor performance, minimal engagement or understanding
- 31-60: Below average, some understanding but significant gaps
- 61-80: Good performance, solid understanding with minor gaps
- 81-95: Excellent performance, strong understanding and engagement
- 96-100: Outstanding performance, exceptional understanding and insight

Provide your assessment now:`;

      const messages = [
        {
          role: 'system',
          content: 'You are an AI assessment evaluator for tutoring sessions. Respond only with valid JSON containing evaluation_score and evaluation_evidence.'
        },
        {
          role: 'user',
          content: assessmentPrompt
        }
      ];

      console.log('[Assessment] Sending assessment request');

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4.1',
          messages: messages,
          max_tokens: 300,
          temperature: 0.3,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('[Assessment] API error:', response.status, errorData);
        throw new Error(`Assessment API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();
      const assessmentText = data.choices[0]?.message?.content;
      
      console.log('[Assessment] Raw response:', assessmentText);
      
      try {
        const assessment = JSON.parse(assessmentText);
        
        if (typeof assessment.evaluation_score !== 'number' || typeof assessment.evaluation_evidence !== 'string') {
          throw new Error('Invalid assessment format');
        }
        
        assessment.evaluation_score = Math.max(0, Math.min(100, assessment.evaluation_score));
        
        return assessment;
      } catch (parseError) {
        console.error('[Assessment] Error parsing JSON:', parseError);
        
        const scoreMatch = assessmentText.match(/(\d+)/);
        const score = scoreMatch ? parseInt(scoreMatch[1]) : 75;
        
        return {
          evaluation_score: Math.max(0, Math.min(100, score)),
          evaluation_evidence: 'Assessment completed based on conversation analysis and success metrics.'
        };
      }
    } catch (error) {
      console.error('[Assessment] Error:', error);
      
      return {
        evaluation_score: 0,
        evaluation_evidence: 'Assessment could not be completed due to technical issues.'
      };
    }
  };

  // Update session evaluation in database
  const updateSessionEvaluation = async (sessionId: string, evaluationScore: number, evaluationEvidence: string, chatHistory: ChatMessage[]) => {
    try {
      const shouldComplete = evaluationScore > 84.95;
      const newProgress = shouldComplete ? 'completed' : 'started';
      
      const { error } = await supabase
        .from('dashboard')
        .update({ 
          evaluation_score: evaluationScore,
          evaluation_evidence: evaluationEvidence,
          chat_history: JSON.stringify(chatHistory),
          progress: newProgress,
          updated_at: new Date().toISOString()
        })
        .eq('id', sessionId);

      if (error) throw error;
      
      // Update current session state
      if (currentSession && currentSession.id === sessionId) {
        setCurrentSession(prev => prev ? {
          ...prev,
          evaluation_score: evaluationScore,
          evaluation_evidence: evaluationEvidence,
          progress: newProgress,
          chat_history: JSON.stringify(chatHistory)
        } : null);
      }
      
      // Show confetti if completed
      if (shouldComplete) {
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 10000); // 10 seconds
      }
      
    } catch (err) {
      console.error('Error updating session evaluation:', err);
      throw err;
    }
  };

  // Handle evaluation
  const handleEvaluateSession = async () => {
    if (!currentSession || tutorChatHistory.length <= 1) {
      alert('No conversation history available for evaluation.');
      return;
    }

    if (!selectedLearningModule) {
      alert('Learning module information not available for evaluation.');
      return;
    }

    setEvaluating(true);
    
    try {
      const assessment = await callAssessmentAI(
        tutorChatHistory, 
        selectedLearningModule.ai_assessment_instructions || 'Evaluate the student\'s learning progress and engagement.',
        selectedLearningModule.outcomes || 'General learning progress',
        selectedLearningModule.metrics_for_success || 'Student engagement and understanding'
      );
      
      await updateSessionEvaluation(
        currentSession.id, 
        assessment.evaluation_score, 
        assessment.evaluation_evidence,
        tutorChatHistory
      );
      
      setEvaluationResult({
        score: assessment.evaluation_score,
        evidence: assessment.evaluation_evidence
      });
      setShowEvaluationModal(true);
      
    } catch (error) {
      console.error('Error during evaluation:', error);
      alert('Failed to complete evaluation. Please try again.');
    } finally {
      setEvaluating(false);
    }
  };

  // Create new tutoring session
// Create new tutoring session
const createTutoringSession = async (tutor: AvailableTutor) => {
  try {
    console.log('Creating new tutoring session for:', tutor.title);
    console.log('User ID:', user.id);
    console.log('Tutor data:', tutor);
    
    // First, check if there's an existing dashboard entry for this user and learning module
    const { data: existingEntries, error: checkError } = await supabase
      .from('dashboard')
      .select('*')
      .eq('user_id', user.id)
      .eq('learning_module_id', tutor.learning_module_id);

    if (checkError) {
      console.error('Error checking existing entries:', checkError);
      throw checkError;
    }

    // If there are existing entries, delete them first
    if (existingEntries && existingEntries.length > 0) {
      console.log('Found existing dashboard entries, deleting them first...');
      const { error: deleteError } = await supabase
        .from('dashboard')
        .delete()
        .eq('user_id', user.id)
        .eq('learning_module_id', tutor.learning_module_id);

      if (deleteError) {
        console.error('Error deleting existing entries:', deleteError);
        throw deleteError;
      }
    }
    
    // Create a unique session identifier and timestamp
    const sessionId = generateUUID().slice(0, 8);
    const timestamp = new Date().toLocaleString();
    const sessionTitle = `${tutor.title} - Session ${timestamp}`;
    
    // Create dashboard entry using the EXISTING learning_module_id from the tutor
    const insertData = {
      user_id: user.id,
      category_activity: 'Tutor',
      title: sessionTitle,
      learning_module_id: tutor.learning_module_id,
      sub_category: `${tutor.sub_category} - Session ${sessionId}`,
      activity: `${sessionTitle} - ${sessionId}`,
      progress: 'started'
    };
    
    console.log('Inserting dashboard data:', insertData);
    
    const { data, error } = await supabase
      .from('dashboard')
      .insert([insertData])
      .select()
      .single();

    if (error) {
      console.error('Supabase error details:', error);
      throw error;
    }
    
    console.log('Session created successfully:', data);
    setCurrentSession(data);
    return data;
  } catch (err) {
    console.error('Error creating tutoring session:', err);
    throw err;
  }
};

  // Update chat history in database
  const updateChatHistory = async (sessionId: string, chatHistory: ChatMessage[]) => {
    try {
      const { error } = await supabase
        .from('dashboard')
        .update({ 
          chat_history: JSON.stringify(chatHistory),
          updated_at: new Date().toISOString()
        })
        .eq('id', sessionId);

      if (error) throw error;
    } catch (err) {
      console.error('Error updating chat history:', err);
    }
  };

  const generateTutorMetadata = async (instructions: string) => {
    const systemPrompt = `Based on the provided AI tutor instructions ${instructions}, generate the following fields in JSON format:

{
  "title": "A succinct title for the tutor topic",
  "description": "A detailed 2-3 sentence description of the tutoring activity that is user-facing, such as 'The tutor will guide the student in...'",
  "sub_category": "Set this equal to the title",
  "outcomes": "Define ideal general outcomes for the tutor",
  "metrics_for_success": "Define specific metrics for success based on the outcomes and instructions",
  "ai_assessment_instructions": "Develop instructions for an AI assessment at the end of the session. The assessment should score learning on a scale of 0-100 and provide evidence for the score."
}

AI Tutor Instructions: ${instructions}`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: 'Generate the metadata fields based on the provided tutor instructions.' }
    ];
  
    const response = await callOpenAI(messages, 'gpt-4.1');
    console.log('Console generateTutorMetadata: ', response);
    
    try {
      // Helper function to extract field values using regex
      const extractField = (text: string, fieldName: string): string => {
        const regex = new RegExp(`"${fieldName}":\\s*"([^"]*)"`, 'i');
        const match = text.match(regex);
        return match ? match[1] : '';
      };

      // Extract each field using regex
      const title = extractField(response, 'title') || 'Custom AI Tutor';
      const description = extractField(response, 'description') || 'A personalized AI tutor designed to guide students through their learning journey.';
      const sub_category = extractField(response, 'sub_category') || 'Custom AI Tutor';
      const outcomes = extractField(response, 'outcomes') || 'Students will gain understanding and mastery of the subject matter.';
      const metrics_for_success = extractField(response, 'metrics_for_success') || 'Completion of exercises, comprehension demonstrated through Q&A, and practical application.';
      const ai_assessment_instructions = extractField(response, 'ai_assessment_instructions') || 'Assess the student\'s learning on a scale of 0-100 based on their responses and engagement. Provide specific evidence for the score.';

      console.log('Extracted metadata:', {
        title,
        description,
        sub_category,
        outcomes,
        metrics_for_success,
        ai_assessment_instructions
      });

      return {
        title,
        description,
        sub_category,
        outcomes,
        metrics_for_success,
        ai_assessment_instructions
      };
    } catch (error) {
      console.error('Error extracting metadata from response:', error);
      // Return default values if extraction fails
      return {
        title: 'Custom AI Tutor',
        description: 'A personalized AI tutor designed to guide students through their learning journey.',
        sub_category: 'Custom AI Tutor',
        outcomes: 'Students will gain understanding and mastery of the subject matter.',
        metrics_for_success: 'Completion of exercises, comprehension demonstrated through Q&A, and practical application.',
        ai_assessment_instructions: 'Assess the student\'s learning on a scale of 0-100 based on their responses and engagement. Provide specific evidence for the score.'
      };
    }
  };

  const generateUUID = () => {
    return crypto.randomUUID();
  };

  const finalizeTutor = async () => {
    try {
      setFinalizingTutor(true);
      
      // Generate metadata for the tutor
      const metadata = await generateTutorMetadata(tutorInstructions);
      const tutorId = generateUUID();
      
      // Create learning module only
      const { data: learningModuleData, error: learningModuleError } = await supabase
        .from('learning_modules')
        .insert([
          {
            learning_module_id: tutorId,
            title: metadata.title,
            description: metadata.description,
            category: 'Tutor',
            sub_category: metadata.sub_category,
            outcomes: metadata.outcomes,
            metrics_for_success: metadata.metrics_for_success,
            ai_facilitator_instructions: tutorInstructions,
            ai_assessment_instructions: metadata.ai_assessment_instructions,
            user_id: user.id,
            public: 0,
            grade_level: 0,
            continent: 'North America'
          }
        ])
        .select()
        .single();

      if (learningModuleError) throw learningModuleError;

      // Set the finalized tutor data for the modal
      setFinalizedTutorData({
        title: metadata.title,
        description: metadata.description,
        outcomes: metadata.outcomes,
        metrics_for_success: metadata.metrics_for_success,
        ai_facilitator_instructions: tutorInstructions
      });

      // Show the finalized tutor modal
      setShowFinalizedTutorModal(true);

      await loadAvailableTutors();
      setShowCreateNew(false);
      setDesignChatHistory([]);
      setTutorInstructions('');
      setDesignUserInput('');
    } catch (err: any) {
      console.error('Error finalizing tutor:', err);
      alert(`Could not save tutor:\n${err.message ?? err}`);
    } finally {
      setFinalizingTutor(false);
    }
  };

  // Update tutor after editing
  const updateTutor = async () => {
    if (!editingTutor || !editTutorInstructions.trim()) return;

    try {
      setUpdatingTutor(true);
      
      // Generate new metadata for the updated tutor
      const metadata = await generateTutorMetadata(editTutorInstructions);
      
      // Update the learning module
      const { error } = await supabase
        .from('learning_modules')
        .update({
          title: metadata.title,
          description: metadata.description,
          sub_category: metadata.sub_category,
          outcomes: metadata.outcomes,
          metrics_for_success: metadata.metrics_for_success,
          ai_facilitator_instructions: editTutorInstructions,
          ai_assessment_instructions: metadata.ai_assessment_instructions,
          updated_at: new Date().toISOString()
        })
        .eq('learning_module_id', editingTutor.learning_module_id)
        .eq('user_id', user.id);

      if (error) throw error;

      // Refresh the tutors list
      await loadAvailableTutors();
      
      // Close the edit modal
      setShowEditTutorModal(false);
      setEditingTutor(null);
      setEditChatHistory([]);
      setEditTutorInstructions('');
      setEditUserInput('');
      
      alert('Tutor updated successfully!');
      
    } catch (err: any) {
      console.error('Error updating tutor:', err);
      alert(`Could not update tutor:\n${err.message ?? err}`);
    } finally {
      setUpdatingTutor(false);
    }
  };

  const handleSelectTutor = async (tutor: AvailableTutor) => {
    setSelectedTutor(tutor);
    await loadLearningModule(tutor.learning_module_id);
    setShowCreateNew(false);
    
    // Clear any existing session and chat history
    setCurrentSession(null);
    setTutorChatHistory([]);
  };

  const handleUseSelectedTutor = async () => {
    if (!selectedTutor) return;

    try {
      // Create new tutoring session (dashboard entry only, using existing learning module)
      const session = await createTutoringSession(selectedTutor);
      
      // The learning module is already loaded when tutor was selected, no need to reload
      
      // Initialize chat with welcome message
      const hasApiKey = !!import.meta.env.VITE_OPENAI_API_KEY;
      const welcomeMessage: ChatMessage = {
        role: 'assistant',
        content: hasApiKey 
          ? `Hello! I'm your AI tutor for ${selectedTutor.title}. Are you ready to start learning?`
          : `Hello! I'm your learning assistant for ${selectedTutor.title}. Note: AI responses are currently unavailable due to configuration.`,
        timestamp: new Date()
      };
      
      setTutorChatHistory([welcomeMessage]);
      
      // Save initial chat history to database
      await updateChatHistory(session.id, [welcomeMessage]);
      
    } catch (error) {
      console.error('Error starting tutor session:', error);
      alert('Failed to start tutoring session. Please try again.');
    }
  };

  const handleDesignSubmit = async () => {
    if (!designUserInput.trim()) return;

    // Handle voice input stopping
    if (designIsListening && designSpeechRecognition) {
      setDesignWasListeningBeforeSubmit(true);
      designSpeechRecognition.stop();
      setDesignIsListening(false);
    } else {
      setDesignWasListeningBeforeSubmit(false);
    }

    const userMessage: ChatMessage = {
      role: 'user',
      content: designUserInput.trim(),
      timestamp: new Date()
    };

    setDesignChatHistory(prev => [...prev, userMessage]);
    setDesignLoading(true);
    
    const currentInput = designUserInput;
    setDesignUserInput('');

    const systemPrompt = `You are an AI tutor designer. Your task is to generate personalized instructions for a second AI agent, the "Tutor Agent," that will guide a student through a complete tutoring experience.

You will be given:
- A learner-selected topic
- A chat history that reflects the learner's prior interaction, learning goals, preferences, or cognitive/emotional profile

Your job is to:
1. Analyze the topic and chat history to understand the learner's level, preferences, and context.
2. Generate an instructional prompt that defines the tutor agent's behavior, tone, learning strategy, and structure.
3. Include session setup instructions: engagement strategy, questioning approach, pacing, and feedback method.
4. Specify content scaffolding: concepts to introduce first, examples to use, misconceptions to watch for.
5. When mathemical equations are being used, please use text representations of equations. Instead of \v = d\s \ov d\t, use: v(t) = ds/dt. The equations must be formatted for readibility.
Additionally, instead of \int f(x) dx, please write ∫f(x)dx; instead of \sum_{i=1}^{n} i^2, please use the sigma symbol: ∑i².

Return only the final API prompt to be sent to the Tutor Agent.

### INPUT:
Topic: {{learner_selected_topic}}
Chat History: ${designChatHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n')}

### OUTPUT:
Final Prompt to Tutor Agent`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: currentInput }
    ];

    const reply = await callOpenAI(messages, 'gpt-4.1');
    
    const aiMessage: ChatMessage = {
      role: 'assistant',
      content: reply,
      timestamp: new Date()
    };
    
    setDesignChatHistory(prev => [...prev, aiMessage]);
    setTutorInstructions(reply);
    setDesignLoading(false);

    // Speak AI response
    speakAIResponse(reply, designWasListeningBeforeSubmit, designSpeechRecognition, setDesignIsListening);
  };

  const handleEditSubmit = async () => {
    if (!editUserInput.trim()) return;

    // Handle voice input stopping
    if (editIsListening && editSpeechRecognition) {
      setEditWasListeningBeforeSubmit(true);
      editSpeechRecognition.stop();
      setEditIsListening(false);
    } else {
      setEditWasListeningBeforeSubmit(false);
    }

    const userMessage: ChatMessage = {
      role: 'user',
      content: editUserInput.trim(),
      timestamp: new Date()
    };

    setEditChatHistory(prev => [...prev, userMessage]);
    setEditLoading(true);
    
    const currentInput = editUserInput;
    setEditUserInput('');

    const systemPrompt = `You are an AI tutor editing assistant. Your task is to help the user modify and improve their existing AI tutor instructions.

You will be given:
- The current tutor instructions
- The user's request for modifications

Your job is to:
1. Understand what the user wants to change or improve
2. Provide guidance on the modifications
3. Generate updated tutor instructions when ready
4. Maintain the core teaching methodology while incorporating requested changes

When the user is ready for the final updated instructions, provide them clearly marked as the new tutor prompt.

Current conversation context: User wants to edit their existing AI tutor.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...editChatHistory.map(msg => ({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content
      })),
      { role: 'user', content: currentInput }
    ];

    const reply = await callOpenAI(messages, 'gpt-4.1');
    
    const aiMessage: ChatMessage = {
      role: 'assistant',
      content: reply,
      timestamp: new Date()
    };
    
    setEditChatHistory(prev => [...prev, aiMessage]);
    
    // Check if the reply contains updated instructions
    if (reply.toLowerCase().includes('final') && reply.toLowerCase().includes('prompt')) {
      setEditTutorInstructions(reply);
    }
    
    setEditLoading(false);

    // Speak AI response
    speakAIResponse(reply, editWasListeningBeforeSubmit, editSpeechRecognition, setEditIsListening);
  };

  const handleTutorSubmit = async () => {
    if (!tutorUserInput.trim()) return;
    
    if (!tutorInstructions.trim() || !currentSession) {
      alert('Please select a tutor and start a session first.');
      return;
    }

    // Handle voice input stopping
    if (tutorIsListening && tutorSpeechRecognition) {
      setTutorWasListeningBeforeSubmit(true);
      tutorSpeechRecognition.stop();
      setTutorIsListening(false);
    } else {
      setTutorWasListeningBeforeSubmit(false);
    }

    const userMessage: ChatMessage = {
      role: 'user',
      content: tutorUserInput.trim(),
      timestamp: new Date()
    };

    const updatedChatHistory = [...tutorChatHistory, userMessage];
    setTutorChatHistory(updatedChatHistory);
    setTutorLoading(true);
    
    const currentInput = tutorUserInput;
    setTutorUserInput('');

    // Update chat history in database after user message
    await updateChatHistory(currentSession.id, updatedChatHistory);

    // Get grade-appropriate instructions
    const gradeInstructions = getGradeAppropriateInstructions(userGradeLevel);
    
    // Enhanced AI instructions that include outcomes and success metrics
    const enhancedInstructions = `${gradeInstructions}

LEARNING MODULE CONTEXT:
${tutorInstructions}

LEARNING OUTCOMES TO GUIDE TOWARDS:
${selectedLearningModule?.outcomes || 'Guide the student through the learning objectives of this session.'}

SUCCESS METRICS TO CONSIDER:
${selectedLearningModule?.metrics_for_success || 'Evaluate based on student engagement, understanding of concepts, quality of responses, and overall learning progress.'}

Remember: Use the Socratic method, ask guiding questions, keep responses under 75 words, and help students discover answers themselves rather than giving direct answers.`;

    const messages = [
      { role: 'system', content: enhancedInstructions },
      ...tutorChatHistory.map(msg => ({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content
      })),
      { role: 'user', content: currentInput }
    ];

    const reply = await callOpenAI(messages, 'gpt-4.1');
    
    const aiMessage: ChatMessage = {
      role: 'assistant',
      content: reply,
      timestamp: new Date()
    };
    
    const finalChatHistory = [...updatedChatHistory, aiMessage];
    setTutorChatHistory(finalChatHistory);
    
    // Update chat history in database after AI response
    await updateChatHistory(currentSession.id, finalChatHistory);
    
    setTutorLoading(false);

    // Speak AI response
    speakAIResponse(reply, tutorWasListeningBeforeSubmit, tutorSpeechRecognition, setTutorIsListening);
  };

  // Render chat messages
  const renderChatMessages = (chatHistory: ChatMessage[], loading: boolean) => {
    return (
      <div className="p-4 space-y-4 overflow-y-auto">
        {chatHistory.map((message, index) => (
          <div
            key={index}
            className={classNames(
              'flex flex-col space-y-2',
              message.role === 'user' ? 'items-end' : 'items-start'
            )}
          >
            <div className={classNames(
              'flex items-start space-x-3 max-w-2xl',
              message.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''
            )}>
              <div className={classNames(
                'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
                message.role === 'assistant' ? 'bg-blue-100' : 'bg-green-100'
              )}>
                {message.role === 'assistant' ? (
                  <Bot className="w-4 h-4 text-blue-600" />
                ) : (
                  <User className="w-4 h-4 text-green-600" />
                )}
              </div>
              <div className="flex-1">
                <div className={classNames(
                  'text-sm font-semibold mb-1',
                  message.role === 'assistant' ? 'text-blue-600' : 'text-green-600'
                )}>
                  {message.role === 'assistant' ? (
                    <span><strong>AI Assistant:</strong></span>
                  ) : (
                    <span><strong>You:</strong></span>
                  )}
                </div>
                <div className={classNames(
                  'p-3 rounded-lg',
                  message.role === 'assistant' 
                    ? 'bg-gray-100 text-gray-900' 
                    : 'bg-blue-500 text-white'
                )}>
                  <div className="text-sm">
                    {message.role === 'assistant' ? (
                      <MarkdownText text={message.content} />
                    ) : (
                      <p>{message.content}</p>
                    )}
                  </div>
                  <p className={classNames(
                    'text-xs mt-1',
                    message.role === 'assistant' ? 'text-gray-500' : 'text-blue-100'
                  )}>
                    {message.timestamp.toLocaleTimeString()}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
              <Bot className="w-4 h-4 text-blue-600" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold mb-1 text-blue-600">
                <strong>AI Assistant:</strong>
              </div>
              <div className="bg-gray-100 text-gray-900 p-3 rounded-lg">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Handle Enter key in input
  const handleKeyPress = (e: React.KeyboardEvent, submitFunction: () => void) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submitFunction();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      {/* Confetti Animation */}
      {showConfetti && <ConfettiAnimation />}
      
      {/* Background with tutor image */}
      <div 
        className="min-h-screen bg-cover bg-center bg-no-repeat relative"
        style={{
          backgroundImage: `linear-gradient(rgba(255, 255, 255, 0.2), rgba(255, 255, 255, 0.2)), url('https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1974&q=80')`,
          backgroundBlendMode: 'overlay'
        }}
      >
        <div className="max-w-4xl mx-auto py-10 px-4 relative z-10">
          


          {/* Available Tutors Section */}
          <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-lg p-8 mb-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Create a New Tutor or Use an Existing Tutor</h2>
              <p className="text-xl text-gray-800 mb-2">Create a new tutor for you by selecting the 'Create New Tutor' button or select the tutor you have already created that you want to use; and then select the 'Use Selected Tutor' button. Then scroll down the page to use your tutor.</p>
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Your Available AI Tutors</h2>
            {availableTutors.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                {availableTutors.map(tutor => (
                  <div
                    key={tutor.learning_module_id}
                    className={classNames(
                      'relative p-4 rounded-lg border-2 transition-all hover:shadow-md',
                      selectedTutor?.learning_module_id === tutor.learning_module_id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    )}
                  >
                    {/* Action buttons */}
                    <div className="absolute top-2 right-2 flex flex-col gap-1">
                      {/* View button */}
                      <button
                        type="button"
                        title="View tutor details"
                        onClick={() => handleViewTutor(tutor)}
                        className="text-blue-500 hover:text-blue-700 p-1 bg-white rounded shadow-sm hover:shadow-md transition-all"
                      >
                        <Eye size={16} />
                      </button>
                      
                      {/* Edit button */}
                      <button
                        type="button"
                        title="Edit tutor"
                        onClick={() => handleEditTutor(tutor)}
                        className="text-green-500 hover:text-green-700 p-1 bg-white rounded shadow-sm hover:shadow-md transition-all"
                      >
                        <Edit size={16} />
                      </button>
                      
                      {/* Delete button */}
                      <button
                        type="button"
                        title="Delete this tutor"
                        onClick={() => handleDeleteTutor(tutor.learning_module_id)}
                        className="text-red-500 hover:text-red-700 p-1 bg-white rounded shadow-sm hover:shadow-md transition-all"
                      >
                        <Scissors size={16} />
                      </button>
                    </div>

                    {/* Clickable content area */}
                    <div onClick={() => handleSelectTutor(tutor)} className="cursor-pointer pr-12">
                      <h3 className="font-semibold text-gray-900 mb-2">{tutor.title}</h3>
                      <p className="text-sm text-gray-600 mb-2">{tutor.sub_category}</p>
                      <p className="text-xs text-gray-500">{tutor.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-600 mb-6">No available tutors found. Create your first AI tutor below!</p>
            )}

            {/* Action Buttons */}
            <div className="flex gap-4">
              <button
                className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center gap-2"
                onClick={() => {
                  setShowCreateNew(true);
                  setSelectedTutor(null);
                  setSelectedLearningModule(null);
                  setCurrentSession(null);
                  setTutorInstructions('');
                  setTutorChatHistory([]);
                }}
              >
                <Plus size={16} />
                Create New Tutor
              </button>
              {selectedTutor && (
                <button
                  className="bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors flex items-center gap-2"
                  onClick={handleUseSelectedTutor}
                >
                  <Users size={16} />
                  Use Selected Tutor
                </button>
              )}
            </div>
          </div>

          {/* Design Your Tutor Section - Only show if creating new */}
          {showCreateNew && (
            <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-lg p-8 mb-8">
              <h1 className="text-3xl font-bold text-gray-800 mb-4">Design your Tutor</h1>
              <p className="text-gray-600 mb-6">
                The AI Tutor Design assistant will help you create a personalized tutor for any topic you'd like to learn. 
                Tell the assistant about your learning goals, preferred style, current knowledge level, and the specific topic 
                you want to study. The assistant will then generate customized instructions for your personal AI tutor.
              </p>
              
              {/* Design Chat Bot */}
              <div className="bg-white rounded-lg shadow-md mb-4">
                <div className="p-4 border-b">
                  <h3 className="text-lg font-semibold text-gray-900">Design Conversation</h3>
                </div>
                <div 
                  ref={designChatRef}
                  className="border rounded-lg overflow-y-auto bg-white"
                  style={{ width: '100%', height: '250px' }}
                >
                  {designChatHistory.length > 0 ? (
                    renderChatMessages(designChatHistory, designLoading)
                  ) : (
                    <div className="p-4 text-gray-500 italic">
                      Start by telling me what topic you'd like to learn and your learning preferences...
                    </div>
                  )}
                </div>
              </div>
              
                            {/* Voice Controls - MOVED HERE */}
                            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
                <h4 className="text-md font-semibold text-gray-800 mb-3">Voice Settings</h4>
                <div className="flex items-center space-x-4 flex-wrap gap-y-2">
                  <label className="flex items-center space-x-2 bg-purple-100 border border-black px-3 py-2 rounded-md cursor-pointer">
                    <input
                      type="checkbox"
                      checked={voiceInputEnabled}
                      onChange={(e) => {
                        setVoiceInputEnabled(e.target.checked);
                        if (!e.target.checked) {
                          // Stop all speech recognition if disabling
                          if (designIsListening && designSpeechRecognition) {
                            designSpeechRecognition.stop();
                            setDesignIsListening(false);
                            setDesignWasListeningBeforeSubmit(false);
                          }
                          if (tutorIsListening && tutorSpeechRecognition) {
                            tutorSpeechRecognition.stop();
                            setTutorIsListening(false);
                            setTutorWasListeningBeforeSubmit(false);
                          }
                          if (editIsListening && editSpeechRecognition) {
                            editSpeechRecognition.stop();
                            setEditIsListening(false);
                            setEditWasListeningBeforeSubmit(false);
                          }
                        }
                      }}
                      className="accent-purple-600 w-4 h-4"
                    />
                    <span className="text-black font-medium text-sm">Enable Voice Input</span>
                  </label>

                  <label className="flex items-center space-x-2 bg-purple-100 border border-black px-3 py-2 rounded-md cursor-pointer">
                    <input
                      type="checkbox"
                      checked={voiceOutputEnabled}
                      onChange={() => setVoiceOutputEnabled(!voiceOutputEnabled)}
                      className="accent-purple-600 w-4 h-4"
                    />
                    <span className="text-black font-medium text-sm">Enable Voice Output</span>
                  </label>

                  {selectedVoice && voiceOutputEnabled && (
                    <div className="flex items-center space-x-2 bg-blue-50 border border-blue-200 px-3 py-2 rounded-md text-sm">
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                      <span className="text-blue-800 font-medium">
                        Voice: {selectedVoice.name.split(' ')[0]} 
                        {userContinent && (
                          <span className="text-blue-600 ml-1">
                            ({userContinent === 'North America' ? '🇺🇸 US' : '🇳🇬 NG'})
                          </span>
                        )}
                      </span>
                    </div>
                  )}

                  {/* Manual Voice Selector */}
                  {voiceOutputEnabled && availableVoices.length > 0 && (
                    <div className="flex items-center space-x-2">
                      <label className="text-sm font-medium bg-purple-900 text-pink-200 px-3 py-1 rounded">Select Voice</label>
                      <select 
                        value={selectedVoice?.name || ''} 
                        onChange={(e) => {
                          const voice = availableVoices.find(v => v.name === e.target.value);
                          setSelectedVoice(voice || null);
                          console.log('[AI Voice] Manually selected:', voice?.name);
                        }}
                        className="text-sm border border-gray-300 rounded px-2 py-1 bg-white max-w-48 truncate"
                      >
                        {availableVoices
                          .filter(v => v.lang.startsWith('en'))
                          .map(voice => (
                            <option key={voice.name} value={voice.name}>
                              {voice.name} ({voice.lang})
                            </option>
                          ))
                        }
                      </select>
                    </div>
                  )}
                </div>
                            </div>

              {/* Design User Input */}
              <div className="flex gap-2 mb-4">
                <SpellCheckTextarea
                  value={designUserInput}
                  onChange={setDesignUserInput}
                  onKeyDown={(e) => handleKeyPress(e, handleDesignSubmit)}
                  placeholder="Tell me what you'd like to learn..."
                  className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 h-18"
                  disabled={designLoading}  // ✅ Use designLoading
                />
                
                {/* Voice Input Button for Design Chat */}
                {voiceInputEnabled && (
                  <button
                    onClick={startDesignVoiceInput}
                    className={classNames(
                      "px-4 py-3 rounded-lg font-semibold transition-colors flex items-center gap-2",
                      designIsListening 
                        ? "bg-red-100 hover:bg-red-200 text-red-800" 
                        : "bg-blue-100 hover:bg-blue-200 text-blue-800"
                    )}
                    disabled={!designSpeechRecognition}
                    style={{ height: 'fit-content' }}
                  >
                    <Mic size={16} />
                    {designIsListening ? 'Stop' : 'Speak'}
                  </button>
                )}
                
                <button
                  className="bg-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-purple-700 transition-colors disabled:bg-gray-400 flex items-center gap-2"
                  onClick={handleDesignSubmit}
                  disabled={designLoading || !designUserInput.trim()}
                  style={{ height: 'fit-content' }}
                >
                  <Send size={16} />
                  Design Tutor
                </button>
              </div>

              {/* Finalize Tutor Button */}
              {tutorInstructions && (
                <div className="border-t pt-4">
                  <button
                    className="bg-green-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:bg-gray-400 flex items-center gap-2"
                    onClick={finalizeTutor}
                    disabled={finalizingTutor || !tutorInstructions.trim()}
                  >
                    {finalizingTutor ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Finalizing Tutor...
                      </>
                    ) : (
                      <>
                        <CheckCircle size={16} />
                        Finalize Tutor
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Use Your Tutor Section */}
          <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-lg p-8  w-[900px]">
            <h1 className="text-3xl font-bold text-gray-800 mb-4">Use Your Tutor to Learn</h1>
            <p className="text-gray-600 mb-6">
              {currentSession ? 
                `Learning session active for: ${selectedTutor?.title}` :
                selectedTutor ?
                  `Selected tutor: ${selectedTutor.title}. Click "Use Selected Tutor" to start a new learning session.` :
                  showCreateNew ?
                    "Once you've designed your tutor above, this AI learning assistant will use those customized instructions to guide you through your learning journey." :
                    "Select an available tutor above or create a new one to begin your learning journey."
              }
            </p>
            
            {/* Current Session Info */}
            {currentSession && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                <h3 className="text-lg font-semibold text-green-800 mb-2">Active Learning Session</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><strong>Tutor:</strong> {selectedTutor?.title}</div>
                  <div><strong>Status:</strong> {currentSession.progress}</div>
                  <div><strong>Session ID:</strong> {currentSession.id.slice(0, 8)}...</div>
                  <div><strong>Started:</strong> {new Date(currentSession.created_at).toLocaleString()}</div>
                </div>
                {currentSession.evaluation_score && (
                  <div className="mt-2">
                    <strong>Last Score:</strong> <span className="text-green-600 font-semibold">{currentSession.evaluation_score}%</span>
                  </div>
                )}
              </div>
            )}
            
            {/* Tutor Chat Bot */}
            <div className="bg-white rounded-lg shadow-md mb-4">
              <div className="p-4 border-b">
                <h3 className="text-lg font-semibold text-gray-900">Learning Conversation</h3>
                {selectedLearningModule && (
                  <p className="text-sm text-gray-600 mt-1">{selectedLearningModule.description}</p>
                )}
              </div>
              <div 
                ref={tutorChatRef}
                className="border rounded-lg overflow-y-auto bg-white"
                style={{ width: '100%', height: '250px' }}
              >
                {tutorChatHistory.length > 0 ? (
                  renderChatMessages(tutorChatHistory, tutorLoading)
                ) : (
                  <div className="p-4 text-gray-500 italic">
                    {currentSession ? 
                      "Session is ready! Start your conversation below..." :
                      "Please select a tutor and start a session to begin learning."
                    }
                  </div>
                )}
              </div>
            </div>
            
              {/* Voice Controls - MOVED HERE */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
                <h4 className="text-md font-semibold text-gray-800 mb-3">Voice Settings</h4>
                <div className="flex items-center space-x-4 flex-wrap gap-y-2">
                  <label className="flex items-center space-x-2 bg-purple-100 border border-black px-3 py-2 rounded-md cursor-pointer">
                    <input
                      type="checkbox"
                      checked={voiceInputEnabled}
                      onChange={(e) => {
                        setVoiceInputEnabled(e.target.checked);
                        if (!e.target.checked) {
                          // Stop all speech recognition if disabling
                          if (designIsListening && designSpeechRecognition) {
                            designSpeechRecognition.stop();
                            setDesignIsListening(false);
                            setDesignWasListeningBeforeSubmit(false);
                          }
                          if (tutorIsListening && tutorSpeechRecognition) {
                            tutorSpeechRecognition.stop();
                            setTutorIsListening(false);
                            setTutorWasListeningBeforeSubmit(false);
                          }
                          if (editIsListening && editSpeechRecognition) {
                            editSpeechRecognition.stop();
                            setEditIsListening(false);
                            setEditWasListeningBeforeSubmit(false);
                          }
                        }
                      }}
                      className="accent-purple-600 w-4 h-4"
                    />
                    <span className="text-black font-medium text-sm">Enable Voice Input</span>
                  </label>

                  <label className="flex items-center space-x-2 bg-purple-100 border border-black px-3 py-2 rounded-md cursor-pointer">
                    <input
                      type="checkbox"
                      checked={voiceOutputEnabled}
                      onChange={() => setVoiceOutputEnabled(!voiceOutputEnabled)}
                      className="accent-purple-600 w-4 h-4"
                    />
                    <span className="text-black font-medium text-sm">Enable Voice Output</span>
                  </label>

                  {selectedVoice && voiceOutputEnabled && (
                    <div className="flex items-center space-x-2 bg-blue-50 border border-blue-200 px-3 py-2 rounded-md text-sm">
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                      <span className="text-blue-800 font-medium">
                        Voice: {selectedVoice.name.split(' ')[0]} 
                        {userContinent && (
                          <span className="text-blue-600 ml-1">
                            ({userContinent === 'North America' ? '🇺🇸 US' : '🇳🇬 NG'})
                          </span>
                        )}
                      </span>
                    </div>
                  )}

                  {/* Manual Voice Selector */}
                  {voiceOutputEnabled && availableVoices.length > 0 && (
                    <div className="flex items-center space-x-2">
                      <label className="text-sm font-medium bg-purple-900 text-pink-200 px-3 py-1 rounded">Select Voice</label>
                      <select 
                        value={selectedVoice?.name || ''} 
                        onChange={(e) => {
                          const voice = availableVoices.find(v => v.name === e.target.value);
                          setSelectedVoice(voice || null);
                          console.log('[AI Voice] Manually selected:', voice?.name);
                        }}
                        className="text-sm border border-gray-300 rounded px-2 py-1 bg-white max-w-48 truncate"
                      >
                        {availableVoices
                          .filter(v => v.lang.startsWith('en'))
                          .map(voice => (
                            <option key={voice.name} value={voice.name}>
                              {voice.name} ({voice.lang})
                            </option>
                          ))
                        }
                      </select>
                    </div>
                  )}
                </div>
              </div>

            {/* Tutor User Input */}
            <div className="flex gap-2 mb-6">
              <SpellCheckTextarea
                value={tutorUserInput}
                onChange={setTutorUserInput}
                onKeyDown={(e) => handleKeyPress(e, handleTutorSubmit)}
                placeholder="Type your response here..."
                className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 h-18"
                disabled={tutorLoading}  // ✅ Use tutorLoading
              />
              
              {/* Voice Input Button for Tutor Chat */}
              {voiceInputEnabled && (
                <button
                  onClick={startTutorVoiceInput}
                  className={classNames(
                    "px-4 py-3 rounded-lg font-semibold transition-colors flex items-center gap-2",
                    tutorIsListening 
                      ? "bg-red-100 hover:bg-red-200 text-red-800" 
                      : "bg-blue-100 hover:bg-blue-200 text-blue-800"
                  )}
                  disabled={!tutorSpeechRecognition || !currentSession}
                  style={{ height: 'fit-content' }}
                >
                  <Mic size={16} />
                  {tutorIsListening ? 'Stop' : 'Speak'}
                </button>
              )}
              
              <button
                className="bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:bg-gray-400 flex items-center gap-2"
                onClick={handleTutorSubmit}
                disabled={tutorLoading || !tutorUserInput.trim() || !currentSession}
                style={{ height: 'fit-content' }}
              >
                <Send size={16} />
                Submit Response
              </button>
            </div>

            {/* Evaluate and Save Session Button */}
            {currentSession && tutorChatHistory.length > 1 && (
              <div className="bg-gray-50 rounded-lg p-6 mt-6">
                <div className="text-center">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Session Evaluation</h3>
                  <p className="text-gray-600 mb-4">
                    Ready to evaluate your learning session? Get feedback on your progress and save your conversation.
                  </p>
                  <button
                    onClick={handleEvaluateSession}
                    disabled={evaluating}
                    className="bg-purple-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-purple-700 transition-colors disabled:bg-gray-400 flex items-center gap-2 mx-auto"
                  >
                    {evaluating ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Evaluating Session...
                      </>
                    ) : (
                      <>
                        <Star size={16} />
                        Evaluate and Save Session
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Tutor Details Modal */}
      {showTutorDetailsModal && viewingTutor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b p-6 flex items-center justify-between">
              <h3 className="text-2xl font-bold text-gray-900 flex items-center">
                <FileText className="h-6 w-6 mr-2 text-blue-600" />
                Tutor Details
              </h3>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => downloadTutorPDF(viewingTutor)}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-semibold transition-colors flex items-center gap-2"
                >
                  <Download size={16} />
                  Download PDF
                </button>
                <button
                  onClick={() => setShowTutorDetailsModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Title Section */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center mb-3">
                  <BookOpen className="h-5 w-5 text-blue-600 mr-2" />
                  <h4 className="text-lg font-semibold text-blue-900">Title</h4>
                </div>
                <p className="text-gray-800 text-lg font-medium">{viewingTutor.title}</p>
              </div>

              {/* Description Section */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center mb-3">
                  <FileText className="h-5 w-5 text-green-600 mr-2" />
                  <h4 className="text-lg font-semibold text-green-900">Description</h4>
                </div>
                <p className="text-gray-700 leading-relaxed">{viewingTutor.description}</p>
              </div>

              {/* Learning Outcomes Section */}
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <div className="flex items-center mb-3">
                  <Target className="h-5 w-5 text-purple-600 mr-2" />
                  <h4 className="text-lg font-semibold text-purple-900">Learning Outcomes</h4>
                </div>
                <p className="text-gray-700 leading-relaxed">{viewingTutor.outcomes}</p>
              </div>

              {/* Success Metrics Section */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-center mb-3">
                  <Award className="h-5 w-5 text-yellow-600 mr-2" />
                  <h4 className="text-lg font-semibold text-yellow-900">Success Metrics</h4>
                </div>
                <p className="text-gray-700 leading-relaxed">{viewingTutor.metrics_for_success}</p>
              </div>

              {/* AI Tutor Instructions Section */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="flex items-center mb-3">
                  <Brain className="h-5 w-5 text-gray-600 mr-2" />
                  <h4 className="text-lg font-semibold text-gray-900">AI Tutor Instructions</h4>
                </div>
                <div className="bg-white border rounded-lg p-4 max-h-60 overflow-y-auto">
                  <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono leading-relaxed">
                    {viewingTutor.ai_facilitator_instructions}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Tutor Modal */}
      {showEditTutorModal && editingTutor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b p-6 flex items-center justify-between">
              <h3 className="text-2xl font-bold text-gray-900 flex items-center">
                <Edit className="h-6 w-6 mr-2 text-green-600" />
                Edit Tutor: {editingTutor.title}
              </h3>
              <button
                onClick={() => setShowEditTutorModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-6">
              {/* Edit Chat Bot */}
              <div className="bg-white rounded-lg shadow-md mb-4">
                <div className="p-4 border-b">
                  <h3 className="text-lg font-semibold text-gray-900">Edit Conversation</h3>
                </div>
                <div 
                  ref={editChatRef}
                  className="border rounded-lg overflow-y-auto bg-white"
                  style={{ width: '100%', height: '300px' }}
                >
                  {renderChatMessages(editChatHistory, editLoading)}
                </div>
              </div>

              {/* Voice Controls for Edit */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
                <h4 className="text-md font-semibold text-gray-800 mb-3">Voice Settings</h4>
                <div className="flex items-center space-x-4 flex-wrap gap-y-2">
                  <label className="flex items-center space-x-2 bg-purple-100 border border-black px-3 py-2 rounded-md cursor-pointer">
                    <input
                      type="checkbox"
                      checked={voiceInputEnabled}
                      onChange={(e) => setVoiceInputEnabled(e.target.checked)}
                      className="accent-purple-600 w-4 h-4"
                    />
                    <span className="text-black font-medium text-sm">Enable Voice Input</span>
                  </label>

                  <label className="flex items-center space-x-2 bg-purple-100 border border-black px-3 py-2 rounded-md cursor-pointer">
                    <input
                      type="checkbox"
                      checked={voiceOutputEnabled}
                      onChange={() => setVoiceOutputEnabled(!voiceOutputEnabled)}
                      className="accent-purple-600 w-4 h-4"
                    />
                    <span className="text-black font-medium text-sm">Enable Voice Output</span>
                  </label>

                  {selectedVoice && voiceOutputEnabled && (
                    <div className="flex items-center space-x-2 bg-blue-50 border border-blue-200 px-3 py-2 rounded-md text-sm">
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                      <span className="text-blue-800 font-medium">
                        Voice: {selectedVoice.name.split(' ')[0]}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Edit User Input */}
              <div className="flex gap-2 mb-4">
                <SpellCheckTextarea
                  value={editUserInput}
                  onChange={setEditUserInput}
                  onKeyDown={(e) => handleKeyPress(e, handleEditSubmit)}
                  placeholder="Tell me how to improve the tutor..."
                  className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 h-18"
                  disabled={editLoading}  // ✅ Use editLoading
                />
                
                {/* Voice Input Button for Edit Chat */}
                {voiceInputEnabled && (
                  <button
                    onClick={startEditVoiceInput}
                    className={classNames(
                      "px-4 py-3 rounded-lg font-semibold transition-colors flex items-center gap-2",
                      editIsListening 
                        ? "bg-red-100 hover:bg-red-200 text-red-800" 
                        : "bg-blue-100 hover:bg-blue-200 text-blue-800"
                    )}
                    disabled={!editSpeechRecognition}
                    style={{ height: 'fit-content' }}
                  >
                    <Mic size={16} />
                    {editIsListening ? 'Stop' : 'Speak'}
                  </button>
                )}
                
                <button
                  className="bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:bg-gray-400 flex items-center gap-2"
                  onClick={handleEditSubmit}
                  disabled={editLoading || !editUserInput.trim()}
                  style={{ height: 'fit-content' }}
                >
                  <Send size={16} />
                  Continue Edit
                </button>
              </div>

              {/* Finalize Updated Tutor Button */}
              {editTutorInstructions && editTutorInstructions !== editingTutor.ai_facilitator_instructions && (
                <div className="border-t pt-4">
                  <button
                    className="bg-purple-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-purple-700 transition-colors disabled:bg-gray-400 flex items-center gap-2"
                    onClick={updateTutor}
                    disabled={updatingTutor}
                  >
                    {updatingTutor ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Updating Tutor...
                      </>
                    ) : (
                      <>
                        <CheckCircle size={16} />
                        Finalize Updated Tutor
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Finalized Tutor Modal */}
      {showFinalizedTutorModal && finalizedTutorData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b p-6 flex items-center justify-between">
              <h3 className="text-2xl font-bold text-gray-900 flex items-center">
                <CheckCircle className="h-6 w-6 mr-2 text-green-600" />
                Tutor Created Successfully!
              </h3>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => downloadTutorPDF(finalizedTutorData)}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-semibold transition-colors flex items-center gap-2"
                >
                  <Download size={16} />
                  Download PDF
                </button>
                <button
                  onClick={() => setShowFinalizedTutorModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Success Message */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                <h4 className="text-lg font-semibold text-green-900 mb-2">🎉 Your AI Tutor is Ready!</h4>
                <p className="text-green-700">Your personalized tutor has been created and saved. You can now select it from your available tutors and start learning!</p>
              </div>

              {/* Title Section */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center mb-3">
                  <BookOpen className="h-5 w-5 text-blue-600 mr-2" />
                  <h4 className="text-lg font-semibold text-blue-900">Title</h4>
                </div>
                <p className="text-gray-800 text-lg font-medium">{finalizedTutorData.title}</p>
              </div>

              {/* Description Section */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center mb-3">
                  <FileText className="h-5 w-5 text-green-600 mr-2" />
                  <h4 className="text-lg font-semibold text-green-900">Description</h4>
                </div>
                <p className="text-gray-700 leading-relaxed">{finalizedTutorData.description}</p>
              </div>

              {/* Learning Outcomes Section */}
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <div className="flex items-center mb-3">
                  <Target className="h-5 w-5 text-purple-600 mr-2" />
                  <h4 className="text-lg font-semibold text-purple-900">Learning Outcomes</h4>
                </div>
                <p className="text-gray-700 leading-relaxed">{finalizedTutorData.outcomes}</p>
              </div>

              {/* Success Metrics Section */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-center mb-3">
                  <Award className="h-5 w-5 text-yellow-600 mr-2" />
                  <h4 className="text-lg font-semibold text-yellow-900">Success Metrics</h4>
                </div>
                <p className="text-gray-700 leading-relaxed">{finalizedTutorData.metrics_for_success}</p>
              </div>

              {/* AI Tutor Instructions Section */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="flex items-center mb-3">
                  <Brain className="h-5 w-5 text-gray-600 mr-2" />
                  <h4 className="text-lg font-semibold text-gray-900">AI Tutor Instructions</h4>
                </div>
                <div className="bg-white border rounded-lg p-4 max-h-60 overflow-y-auto">
                  <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono leading-relaxed">
                    {finalizedTutorData.ai_facilitator_instructions}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Evaluation Results Modal */}
      {showEvaluationModal && evaluationResult && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className={classNames(
                "text-xl font-bold flex items-center",
                evaluationResult.score > 84.95 ? "text-green-600" : "text-gray-900"
              )}>
                <Star className="h-6 w-6 mr-2 text-yellow-500" />
                {evaluationResult.score > 84.95 ? "🎉 Session Mastered!" : "Session Complete"}
              </h3>
              <button
                onClick={() => setShowEvaluationModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="text-center">
                <div className={classNames(
                  "text-3xl font-bold mb-2",
                  evaluationResult.score > 84.95 ? "text-green-600" : "text-blue-600"
                )}>
                  {evaluationResult.score}/100
                </div>
                <div className="text-sm text-gray-600">
                  {evaluationResult.score > 84.95 ? "Outstanding Learning!" : "Your Learning Score"}
                </div>
                {evaluationResult.score > 84.95 && (
                  <div className="mt-2 text-sm text-green-600 font-semibold">
                    You've mastered this topic!
                  </div>
                )}
              </div>
              
              <div className="border-t pt-4">
                <h4 className="font-semibold text-gray-900 mb-2">Tutor Assessment:</h4>
                <p className="text-gray-700 text-sm leading-relaxed">
                  {evaluationResult.evidence}
                </p>
              </div>
              
              <div className="flex justify-end pt-4 space-x-3">
                {evaluationResult.score > 84.95 && (
                  <button
                    onClick={() => {
                      setShowConfetti(true);
                      setTimeout(() => setShowConfetti(false), 10000);
                    }}
                    className="bg-gradient-to-r from-pink-500 to-purple-600 text-white px-6 py-2 rounded-lg font-semibold hover:from-pink-600 hover:to-purple-700 transition-all transform hover:scale-105"
                  >
                    🎉 Celebrate!
                  </button>
                )}
                <button
                  onClick={() => setShowEvaluationModal(false)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-semibold transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TutorAI;