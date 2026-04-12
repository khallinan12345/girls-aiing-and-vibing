// Updated DashboardPage.tsx with reorganized layout
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { Project, Team, UserProfile } from '../types/supabase';
import {
  Plus,
  Clock,
  CheckCircle,
  Briefcase,
  Users,
  Book,
  Code as CodeIcon,
  Award,
  AlertCircle,
  Target,
  Star,
  RefreshCw,
  Trophy,
  GraduationCap,
  ArrowRight,
  Download,
  Globe2,
  TrendingUp,
} from 'lucide-react';
import AppLayout from '../components/layout/AppLayout';
import Button from '../components/ui/Button';
import { useAuth } from '../hooks/useAuth';
import classNames from 'classnames';

// Add interface for dashboard activities with sub_category
interface DashboardActivity {
  id: string;
  user_id: string;
  learning_module_id: string;
  activity: string;
  title: string;
  category_activity: string;
  sub_category?: string;
  progress: 'not started' | 'started' | 'completed';
  evaluation_score?: number;
  evaluation_evidence?: string;
  created_at: string;
  updated_at: string;
  certificate_pdf_url?: string | null;  // URL to certificate PDF in Supabase Storage
  
  // Certification final assessment scores (certification_* columns)
  certification_evaluation_score?: number | null;
  certification_evaluation_evidence?: string | null;
  
  // AI Proficiency - UNESCO Competencies (for learning: certification_evaluation_UNESCO_*)
  certification_evaluation_UNESCO_1_score?: number | null;
  certification_evaluation_UNESCO_1_evidence?: string | null;
  certification_evaluation_UNESCO_2_score?: number | null;
  certification_evaluation_UNESCO_2_evidence?: string | null;
  certification_evaluation_UNESCO_3_score?: number | null;
  certification_evaluation_UNESCO_3_evidence?: string | null;
  certification_evaluation_UNESCO_4_score?: number | null;
  certification_evaluation_UNESCO_4_evidence?: string | null;
  
  // AI Proficiency Certification columns
  certification_ai_proficiency_understanding_ai_score?: number | null;
  certification_ai_proficiency_understanding_ai_evidence?: string | null;
  certification_ai_proficiency_application_of_ai_score?: number | null;
  certification_ai_proficiency_application_of_ai_evidence?: string | null;
  certification_ai_proficiency_ethics_responsibility_score?: number | null;
  certification_ai_proficiency_ethics_responsibility_evidence?: string | null;
  certification_ai_proficiency_verification_bias_score?: number | null;
  certification_ai_proficiency_verification_bias_evidence?: string | null;
  
  // Skills - Vibe Coding (certification_vibe_coding_* for certification, certification_evaluation_vibe_coding_* for learning)
  certification_vibe_coding_problem_decomposition_score?: number | null;
  certification_vibe_coding_problem_decomposition_evidence?: string | null;
  certification_vibe_coding_prompt_engineering_score?: number | null;
  certification_vibe_coding_prompt_engineering_evidence?: string | null;
  certification_vibe_coding_ai_output_evaluation_score?: number | null;
  certification_vibe_coding_ai_output_evaluation_evidence?: string | null;
  certification_evaluation_vibe_coding_problem_decomposition_scor?: number | null;
  certification_evaluation_vibe_coding_problem_decomposition_evid?: string | null;
  certification_evaluation_vibe_coding_prompt_engineering_score?: number | null;
  certification_evaluation_vibe_coding_prompt_engineering_evidenc?: string | null;
  certification_evaluation_vibe_coding_ai_output_evaluation_score?: number | null;
  certification_evaluation_vibe_coding_ai_output_evaluation_evide?: string | null;
  certification_evaluation_vibe_coding_metacognitive_control_scor?: number | null;
  certification_evaluation_vibe_coding_metacognitive_control_evid?: string | null;
  
  // Skills - Critical Thinking
  certification_critical_thinking_claim_evaluation_score?: number | null;
  certification_critical_thinking_claim_evaluation_evidence?: string | null;
  certification_critical_thinking_reasoning_trace_score?: number | null;
  certification_critical_thinking_reasoning_trace_evidence?: string | null;
  certification_critical_thinking_logical_reasoning_score?: number | null;
  certification_critical_thinking_logical_reasoning_evidence?: string | null;
  certification_critical_thinking_reflection_score?: number | null;
  certification_critical_thinking_reflection_evidence?: string | null;
  certification_evaluation_critical_thinking_logical_reasoning_sc?: number | null;
  certification_evaluation_critical_thinking_logical_reasoning_ev?: string | null;
  certification_evaluation_critical_thinking_reflection_score?: number | null;
  certification_evaluation_critical_thinking_reflection_evidence?: string | null;
  
  // Skills - Problem Solving
  certification_problem_solving_problem_definition_score?: number | null;
  certification_problem_solving_problem_definition_evidence?: string | null;
  certification_problem_solving_iteration_score?: number | null;
  certification_problem_solving_iteration_evidence?: string | null;
  certification_problem_solving_outcome_measurement_score?: number | null;
  certification_problem_solving_outcome_measurement_evidence?: string | null;
  certification_evaluation_problem_solving_problem_definition_sco?: number | null;
  certification_evaluation_problem_solving_problem_definition_evi?: string | null;
  certification_evaluation_problem_solving_iteration_score?: number | null;
  certification_evaluation_problem_solving_iteration_evidence?: string | null;
  
  // Skills - Creativity
  certification_creativity_creative_iteration_score?: number | null;
  certification_creativity_creative_iteration_evidence?: string | null;
  certification_creativity_originality_score?: number | null;
  certification_creativity_originality_evidence?: string | null;
  certification_creativity_exploration_score?: number | null;
  certification_creativity_exploration_evidence?: string | null;
  certification_evaluation_creativity_originality_score?: number | null;
  certification_evaluation_creativity_originality_evidence?: string | null;
  certification_evaluation_creativity_risk_and_exploration_score?: number | null;
  certification_evaluation_creativity_risk_and_exploration_eviden?: string | null;
  
  // Skills - Communication
  certification_communication_clarity_score?: number | null;
  certification_communication_clarity_evidence?: string | null;
  certification_communication_listening_response_score?: number | null;
  certification_communication_listening_response_evidence?: string | null;
  certification_communication_synthesis_score?: number | null;
  certification_communication_synthesis_evidence?: string | null;
  certification_evaluation_communication_clarity_score?: number | null;
  certification_evaluation_communication_clarity_evidence?: string | null;
  certification_evaluation_communication_listening_and_response_s?: number | null;
  certification_evaluation_communication_listening_and_response_e?: string | null;
  
  // Skills - Digital Fluency (7 dimensions)
  certification_digital_fluency_device_file_control_score?: number | null;
  certification_digital_fluency_device_file_control_evidence?: string | null;
  certification_digital_fluency_internet_navigation_score?: number | null;
  certification_digital_fluency_internet_navigation_evidence?: string | null;
  certification_digital_fluency_troubleshooting_score?: number | null;
  certification_digital_fluency_troubleshooting_evidence?: string | null;
  certification_evaluation_device_familiarity_and_control_score?: number | null;
  certification_evaluation_device_familiarity_and_control_evidenc?: string | null;
  certification_evaluation_typing_and_text_entry_score?: number | null;
  certification_evaluation_typing_and_text_entry_evidence?: string | null;
  certification_evaluation_file_and_application_management_score?: number | null;
  certification_evaluation_file_and_application_management_eviden?: string | null;
  certification_evaluation_internet_navigation_score?: number | null;
  certification_evaluation_internet_navigation_evidence?: string | null;
  certification_evaluation_online_research_and_information_use_sc?: number | null;
  certification_evaluation_online_research_and_information_use_ev?: string | null;
  certification_evaluation_digital_safety_and_responsibility_scor?: number | null;
  certification_evaluation_digital_safety_and_responsibility_evid?: string | null;
  certification_evaluation_basic_troubleshooting_and_resilience_s?: number | null;
  certification_evaluation_basic_troubleshooting_and_resilience_e?: string | null;
  
  [key: string]: any; // Allow dynamic access
}

// Interface for certification progress
interface CertificationProgress {
  certificationName: string;
  displayName: string;
  totalAssessments: number;
  completedAssessments: number;
  progress: 'not started' | 'started' | 'completed';
  route: string; // Route to certification page
  updated_at?: string;
}

interface DashboardData {
  projects: Project[];
  team?: Team & { profiles: UserProfile[] };
  dashboardActivities: DashboardActivity[];
  certifications: CertificationProgress[];
  dashboardSummary?: {
    total_activities: number;
    completed: number;
    started: number;
  };
  certificationSummary?: {
    total_certifications: number;
    completed_certifications: number;
    started_certifications: number;
  };
}

// ── Leaderboard ────────────────────────────────────────────────────────────
type LeaderboardMetric =
  | 'sessions_alltime'
  | 'sessions_thismonth'
  | 'certs_achieved'
  | 'certs_attempted';

interface LeaderboardEntry {
  rank: number;
  user_id: string;
  name: string;
  value: number;
}

const LEADERBOARD_OPTIONS: { value: LeaderboardMetric; label: string }[] = [
  { value: 'sessions_alltime',   label: '💬 Most Sessions — All Time' },
  { value: 'sessions_thismonth', label: '📅 Most Sessions — This Month' },
  { value: 'certs_achieved',     label: '🏆 Certifications Achieved' },
  { value: 'certs_attempted',    label: '🎯 Certifications Attempted' },
];

const MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

// ───────────────────────────────────────────────────────────────────────────

const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData>({
    projects: [],
    dashboardActivities: [],
    certifications: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [downloadingCert, setDownloadingCert] = useState<string | null>(null);
  const [selectedActivityForDetails, setSelectedActivityForDetails] = useState<DashboardActivity | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  // Leaderboard
  const [leaderboardMetric, setLeaderboardMetric] = useState<LeaderboardMetric>('sessions_alltime');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  
  // Use refs to prevent multiple simultaneous fetches
  const fetchingRef = useRef(false);
  const lastUserIdRef = useRef<string | null>(null);

  // Map certification names to routes
  const getCertificationRoute = (certName: string): string => {
    const routeMap: Record<string, string> = {
      'ai_proficiency': '/certifications/ai-proficiency',
      'vibe_coding': '/certifications/ai-ready-skills',
      'critical_thinking': '/certifications/ai-ready-skills',
      'creativity': '/certifications/ai-ready-skills',
      'communication': '/certifications/ai-ready-skills',
      'problem_solving': '/certifications/ai-ready-skills',
      'digital_fluency': '/certifications/ai-ready-skills'
    };
    return routeMap[certName] || '/certifications/ai-ready-skills';
  };

  // Helper: Get score label based on scale
  const getScoreLabel = (score: number | null, isCertification: boolean): string => {
    if (score == null) return 'Not Assessed';
    if (isCertification) {
      // Certification uses 0-3 scale
      const labels = ['No Evidence', 'Emerging', 'Proficient ✓', 'Advanced ✓'];
      return labels[score] || 'Unknown';
    } else {
      // Learning uses 1-4 scale for UNESCO
      const labels = ['', 'Emerging', 'Developing', 'Competent', 'Advanced'];
      return labels[score] || 'Unknown';
    }
  };

  // Helper: Extract scores for an activity based on category/subcategory and progress
  const getActivityScores = (activity: DashboardActivity): { dimension: string; score: number | null; evidence: string | null; maxScore: number }[] => {
    const isCertification = activity.category_activity === 'Certification';
    let subCat = activity.sub_category;
    const cat = activity.category_activity;
    
    // For certifications, if sub_category is null, infer from activity name
    if (isCertification && !subCat && activity.activity) {
      const activityName = activity.activity.toLowerCase();
      if (activityName.includes('critical thinking')) subCat = 'Critical Thinking';
      else if (activityName.includes('vibe coding')) subCat = 'Vibe Coding';
      else if (activityName.includes('creativity')) subCat = 'Creativity';
      else if (activityName.includes('communication')) subCat = 'Communication';
      else if (activityName.includes('problem solving') || activityName.includes('problem-solving')) subCat = 'Problem Solving';
      else if (activityName.includes('digital fluency')) subCat = 'Digital Fluency';
      else if (activityName.includes('ai proficiency')) subCat = 'AI Proficiency';
    }
    
    console.log('[getActivityScores] Called for:', activity.activity);
    console.log('[getActivityScores] Category:', cat, 'SubCat:', subCat, 'IsCert:', isCertification);
    
    // AI Learning - UNESCO Competencies (1-4 scale)
    if (cat === 'AI Learning') {
      return [
        { dimension: 'Understanding of AI', score: activity.certification_evaluation_UNESCO_1_score ?? null, evidence: activity.certification_evaluation_UNESCO_1_evidence ?? null, maxScore: 4 },
        { dimension: 'Human-Centred Mindset', score: activity.certification_evaluation_UNESCO_2_score ?? null, evidence: activity.certification_evaluation_UNESCO_2_evidence ?? null, maxScore: 4 },
        { dimension: 'Application of AI Tools', score: activity.certification_evaluation_UNESCO_3_score ?? null, evidence: activity.certification_evaluation_UNESCO_3_evidence ?? null, maxScore: 4 },
        { dimension: 'Critical Evaluation', score: activity.certification_evaluation_UNESCO_4_score ?? null, evidence: activity.certification_evaluation_UNESCO_4_evidence ?? null, maxScore: 4 },
      ];
    }
    
    // Skills - check BOTH category_activity and sub_category (handles both canned and user-created activities)
    // Vibe Coding
    if (subCat === 'Vibe Coding' || cat === 'Vibe Coding') {
      if (isCertification) {
        return [
          { dimension: 'Problem Decomposition', score: activity.certification_vibe_coding_problem_decomposition_score ?? null, evidence: activity.certification_vibe_coding_problem_decomposition_evidence ?? null, maxScore: 3 },
          { dimension: 'Prompt Engineering', score: activity.certification_vibe_coding_prompt_engineering_score ?? null, evidence: activity.certification_vibe_coding_prompt_engineering_evidence ?? null, maxScore: 3 },
          { dimension: 'AI Output Evaluation', score: activity.certification_vibe_coding_ai_output_evaluation_score ?? null, evidence: activity.certification_vibe_coding_ai_output_evaluation_evidence ?? null, maxScore: 3 },
        ];
      } else {
        return [
          { dimension: 'Problem Decomposition', score: activity.certification_evaluation_vibe_coding_problem_decomposition_scor ?? null, evidence: activity.certification_evaluation_vibe_coding_problem_decomposition_evid ?? null, maxScore: 3 },
          { dimension: 'Prompt Engineering', score: activity.certification_evaluation_vibe_coding_prompt_engineering_score ?? null, evidence: activity.certification_evaluation_vibe_coding_prompt_engineering_evidenc ?? null, maxScore: 3 },
          { dimension: 'AI Output Evaluation', score: activity.certification_evaluation_vibe_coding_ai_output_evaluation_score ?? null, evidence: activity.certification_evaluation_vibe_coding_ai_output_evaluation_evide ?? null, maxScore: 3 },
          { dimension: 'Metacognitive Control', score: activity.certification_evaluation_vibe_coding_metacognitive_control_scor ?? null, evidence: activity.certification_evaluation_vibe_coding_metacognitive_control_evid ?? null, maxScore: 3 },
        ];
      }
    } 
    // Critical Thinking
    else if (subCat === 'Critical Thinking' || cat === 'Critical Thinking') {
      if (isCertification) {
        const scores = [
          { dimension: 'Claim Evaluation', score: activity.certification_critical_thinking_claim_evaluation_score ?? null, evidence: activity.certification_critical_thinking_claim_evaluation_evidence ?? null, maxScore: 3 },
          { dimension: 'Reasoning Trace', score: activity.certification_critical_thinking_reasoning_trace_score ?? null, evidence: activity.certification_critical_thinking_reasoning_trace_evidence ?? null, maxScore: 3 },
          { dimension: 'Reflection', score: activity.certification_critical_thinking_reflection_score ?? null, evidence: activity.certification_critical_thinking_reflection_evidence ?? null, maxScore: 3 },
        ];
        console.log('[getActivityScores] Returning Critical Thinking cert scores:', scores.map(s => `${s.dimension}=${s.score}`));
        return scores;
      } else {
        return [
          { dimension: 'Logical Reasoning', score: activity.certification_evaluation_critical_thinking_logical_reasoning_sc ?? null, evidence: activity.certification_evaluation_critical_thinking_logical_reasoning_ev ?? null, maxScore: 3 },
          { dimension: 'Reflection', score: activity.certification_evaluation_critical_thinking_reflection_score ?? null, evidence: activity.certification_evaluation_critical_thinking_reflection_evidence ?? null, maxScore: 3 },
        ];
      }
    } 
    // Problem Solving
    else if (subCat === 'Problem-Solving' || cat === 'Problem-Solving' || cat === 'Problem Solving') {
      if (isCertification) {
        return [
          { dimension: 'Problem Definition', score: activity.certification_problem_solving_problem_definition_score ?? null, evidence: activity.certification_problem_solving_problem_definition_evidence ?? null, maxScore: 3 },
          { dimension: 'Iteration', score: activity.certification_problem_solving_iteration_score ?? null, evidence: activity.certification_problem_solving_iteration_evidence ?? null, maxScore: 3 },
          { dimension: 'Outcome Measurement', score: activity.certification_problem_solving_outcome_measurement_score ?? null, evidence: activity.certification_problem_solving_outcome_measurement_evidence ?? null, maxScore: 3 },
        ];
      } else {
        return [
          { dimension: 'Problem Definition', score: activity.certification_evaluation_problem_solving_problem_definition_sco ?? null, evidence: activity.certification_evaluation_problem_solving_problem_definition_evi ?? null, maxScore: 3 },
          { dimension: 'Iteration', score: activity.certification_evaluation_problem_solving_iteration_score ?? null, evidence: activity.certification_evaluation_problem_solving_iteration_evidence ?? null, maxScore: 3 },
        ];
      }
    } 
    // Creativity
    else if (subCat === 'Creativity' || cat === 'Creativity') {
      if (isCertification) {
        return [
          { dimension: 'Creative Iteration', score: activity.certification_creativity_creative_iteration_score ?? null, evidence: activity.certification_creativity_creative_iteration_evidence ?? null, maxScore: 3 },
          { dimension: 'Exploration', score: activity.certification_creativity_exploration_score ?? null, evidence: activity.certification_creativity_exploration_evidence ?? null, maxScore: 3 },
          { dimension: 'Originality', score: activity.certification_creativity_originality_score ?? null, evidence: activity.certification_creativity_originality_evidence ?? null, maxScore: 3 },
        ];
      } else {
        return [
          { dimension: 'Originality', score: activity.certification_evaluation_creativity_originality_score ?? null, evidence: activity.certification_evaluation_creativity_originality_evidence ?? null, maxScore: 3 },
          { dimension: 'Risk & Exploration', score: activity.certification_evaluation_creativity_risk_and_exploration_score ?? null, evidence: activity.certification_evaluation_creativity_risk_and_exploration_eviden ?? null, maxScore: 3 },
        ];
      }
    } 
    // Communication
    else if (subCat === 'Communication' || cat === 'Communication') {
      if (isCertification) {
        return [
          { dimension: 'Clarity', score: activity.certification_communication_clarity_score ?? null, evidence: activity.certification_communication_clarity_evidence ?? null, maxScore: 3 },
          { dimension: 'Listening & Response', score: activity.certification_communication_listening_response_score ?? null, evidence: activity.certification_communication_listening_response_evidence ?? null, maxScore: 3 },
          { dimension: 'Synthesis', score: activity.certification_communication_synthesis_score ?? null, evidence: activity.certification_communication_synthesis_evidence ?? null, maxScore: 3 },
        ];
      } else {
        return [
          { dimension: 'Clarity', score: activity.certification_evaluation_communication_clarity_score ?? null, evidence: activity.certification_evaluation_communication_clarity_evidence ?? null, maxScore: 3 },
          { dimension: 'Listening & Response', score: activity.certification_evaluation_communication_listening_and_response_s ?? null, evidence: activity.certification_evaluation_communication_listening_and_response_e ?? null, maxScore: 3 },
        ];
      }
    } 
    // Digital Fluency
    else if (subCat === 'Digital Fluency' || cat === 'Digital Fluency') {
      if (isCertification) {
        return [
          { dimension: 'Device & File Control', score: activity.certification_digital_fluency_device_file_control_score ?? null, evidence: activity.certification_digital_fluency_device_file_control_evidence ?? null, maxScore: 3 },
          { dimension: 'Internet Navigation', score: activity.certification_digital_fluency_internet_navigation_score ?? null, evidence: activity.certification_digital_fluency_internet_navigation_evidence ?? null, maxScore: 3 },
          { dimension: 'Troubleshooting', score: activity.certification_digital_fluency_troubleshooting_score ?? null, evidence: activity.certification_digital_fluency_troubleshooting_evidence ?? null, maxScore: 3 },
        ];
      } else {
        return [
          { dimension: 'Device Familiarity', score: activity.certification_evaluation_device_familiarity_and_control_score ?? null, evidence: activity.certification_evaluation_device_familiarity_and_control_evidenc ?? null, maxScore: 3 },
          { dimension: 'Typing & Text Entry', score: activity.certification_evaluation_typing_and_text_entry_score ?? null, evidence: activity.certification_evaluation_typing_and_text_entry_evidence ?? null, maxScore: 3 },
          { dimension: 'File & App Management', score: activity.certification_evaluation_file_and_application_management_score ?? null, evidence: activity.certification_evaluation_file_and_application_management_eviden ?? null, maxScore: 3 },
          { dimension: 'Internet Navigation', score: activity.certification_evaluation_internet_navigation_score ?? null, evidence: activity.certification_evaluation_internet_navigation_evidence ?? null, maxScore: 3 },
          { dimension: 'Online Research', score: activity.certification_evaluation_online_research_and_information_use_sc ?? null, evidence: activity.certification_evaluation_online_research_and_information_use_ev ?? null, maxScore: 3 },
          { dimension: 'Digital Safety', score: activity.certification_evaluation_digital_safety_and_responsibility_scor ?? null, evidence: activity.certification_evaluation_digital_safety_and_responsibility_evid ?? null, maxScore: 3 },
          { dimension: 'Troubleshooting', score: activity.certification_evaluation_basic_troubleshooting_and_resilience_s ?? null, evidence: activity.certification_evaluation_basic_troubleshooting_and_resilience_e ?? null, maxScore: 3 },
        ];
      }
    }
    // AI Proficiency
    else if (subCat === 'AI Proficiency' || cat === 'AI Proficiency') {
      if (isCertification) {
        return [
          { dimension: 'Understanding AI', score: activity.certification_ai_proficiency_understanding_ai_score ?? null, evidence: activity.certification_ai_proficiency_understanding_ai_evidence ?? null, maxScore: 3 },
          { dimension: 'Application of AI', score: activity.certification_ai_proficiency_application_of_ai_score ?? null, evidence: activity.certification_ai_proficiency_application_of_ai_evidence ?? null, maxScore: 3 },
          { dimension: 'Ethics & Responsibility', score: activity.certification_ai_proficiency_ethics_responsibility_score ?? null, evidence: activity.certification_ai_proficiency_ethics_responsibility_evidence ?? null, maxScore: 3 },
          { dimension: 'Verification & Bias', score: activity.certification_ai_proficiency_verification_bias_score ?? null, evidence: activity.certification_ai_proficiency_verification_bias_evidence ?? null, maxScore: 3 },
        ];
      } else {
        // AI Learning uses UNESCO scores
        return [
          { dimension: 'Understanding of AI', score: activity.certification_evaluation_UNESCO_1_score ?? null, evidence: activity.certification_evaluation_UNESCO_1_evidence ?? null, maxScore: 4 },
          { dimension: 'Human-Centred Mindset', score: activity.certification_evaluation_UNESCO_2_score ?? null, evidence: activity.certification_evaluation_UNESCO_2_evidence ?? null, maxScore: 4 },
          { dimension: 'Application of AI Tools', score: activity.certification_evaluation_UNESCO_3_score ?? null, evidence: activity.certification_evaluation_UNESCO_3_evidence ?? null, maxScore: 4 },
          { dimension: 'Critical Evaluation', score: activity.certification_evaluation_UNESCO_4_score ?? null, evidence: activity.certification_evaluation_UNESCO_4_evidence ?? null, maxScore: 4 },
        ];
      }
    }
    
    console.log('[getActivityScores] No matching category found, returning empty array');
    return [];
  };

  // Helper: Check if activity has any scores
  const hasScores = (activity: DashboardActivity): boolean => {
    if (activity.progress === 'not started') return false;
    const scores = getActivityScores(activity);
    return scores.some(s => s.score != null);
  };

  // Extract certification progress from dashboard row
  const extractCertificationProgress = (dashboardRows: any[]): CertificationProgress[] => {
    const certMap = new Map<string, { scores: (number | null)[], updated: string }>();
    
    // Known certification patterns with expected assessment counts
    const knownCerts = [
      'ai_proficiency',
      'vibe_coding',
      'critical_thinking',
      'creativity',
      'communication',
      'problem_solving',
      'digital_fluency'
    ];

    // Expected total assessments per certification (based on certification_assessments table)
    const expectedAssessments: Record<string, number> = {
      'ai_proficiency': 4,      // 4 UNESCO competencies
      'vibe_coding': 3,          // 3 assessments
      'critical_thinking': 3,    // Claim Evaluation, Reasoning Trace, Reflection
      'creativity': 3,           // Creative Iteration, Exploration, Originality
      'communication': 3,        // 3 assessments
      'problem_solving': 3,      // 3 assessments
      'digital_fluency': 3       // 3 assessments
    };

    // ONLY scan certification rows (category_activity === 'Certification')
    // Each certification has its own dedicated row
    const certificationRows = dashboardRows.filter(row => row.category_activity === 'Certification');
    
    console.log('[Dashboard] Found', certificationRows.length, 'certification rows out of', dashboardRows.length, 'total rows');

    // Scan certification rows for certification score columns
    // EXCLUDE learning module columns (pattern: certification_evaluation_*)
    // INCLUDE certification columns even if "evaluation" appears in the assessment name
    certificationRows.forEach(row => {
      console.log('[Dashboard] Scanning row:', row.activity);
      
      const foundColumns: string[] = [];
      
      for (const [key, value] of Object.entries(row)) {
        if (!key.startsWith('certification_') || !key.endsWith('_score')) {
          continue;
        }
        
        // EXPLICIT CHECK: Is this a learning module column?
        // Learning modules have pattern: certification_evaluation_{something}
        // Certifications have pattern: certification_{category}_{assessment}_score
        const parts = key.split('_');
        
        // If the second part is "evaluation", it's a learning module
        // e.g., certification_evaluation_critical_thinking_* 
        if (parts.length >= 2 && parts[1] === 'evaluation') {
          console.log(`[Dashboard] ✗ Excluded (learning module):`, key);
          continue;
        }
        
        // Extract certification name - check if it matches a known cert
        for (const certName of knownCerts) {
          if (key.startsWith(`certification_${certName}_`)) {
            foundColumns.push(`${key} = ${value}`);
            console.log(`[Dashboard] ✓ Found ${certName} column:`, key, '=', value);
            
            if (!certMap.has(certName)) {
              certMap.set(certName, { scores: [], updated: row.updated_at || '' });
            }
            // Include all scores, even null ones (not yet taken)
            certMap.get(certName)!.scores.push(value as number | null);
            break;
          }
        }
      }
      
      console.log(`[Dashboard] Row ${row.activity} - Found ${foundColumns.length} certification columns:`, foundColumns);
    });

    // Log what was found for each certification
    console.log('[Dashboard] Certification scores found:');
    certMap.forEach((data, certName) => {
      console.log(`  ${certName}: ${data.scores.length} scores =`, data.scores);
    });

    // Convert to CertificationProgress array
    const certifications: CertificationProgress[] = [];
    
    certMap.forEach((data, certName) => {
      // Use expected total, or fallback to scores length
      const totalAssessments = expectedAssessments[certName] || data.scores.length;
      
      // Count only scores >= 2 (Proficient or Advanced) as completed
      const completedAssessments = data.scores.filter(s => s !== null && s >= 2).length;
      
      // Count assessments that have been attempted (not null)
      const attemptedAssessments = data.scores.filter(s => s !== null).length;
      
      let progress: 'not started' | 'started' | 'completed' = 'not started';
      if (completedAssessments === totalAssessments && completedAssessments > 0) {
        progress = 'completed';
      } else if (attemptedAssessments > 0) {
        progress = 'started';
      }

      // Format display name
      const formatName = (str: string) => {
        return str
          .split('_')
          .map(word => {
            // Special case for AI acronym
            if (word.toLowerCase() === 'ai') return 'AI';
            return word.charAt(0).toUpperCase() + word.slice(1);
          })
          .join(' ');
      };

      certifications.push({
        certificationName: certName,
        displayName: formatName(certName) + ' Certification',
        totalAssessments,
        completedAssessments,
        progress,
        route: getCertificationRoute(certName),
        updated_at: data.updated
      });
    });

    return certifications.sort((a, b) => a.displayName.localeCompare(b.displayName));
  };

  const getProgressColor = (progress: string) => {
    switch (progress) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'started':
        return 'bg-yellow-100 text-yellow-800';
      case 'not started':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getCategoryIcon = (category: string) => {
    const iconProps = {
      size: 16,
      className: "text-blue-600"
    };
  
    switch (category?.toLowerCase()) {
      case 'coding':
      case 'programming':
      case 'digital-fluency':
        return <CodeIcon {...iconProps} className="text-blue-600" />;
      case 'vibe coding':
      case 'tech workshop':
        return <CodeIcon {...iconProps} className="text-pink-600" />;
      case 'entrepreneurship':
        return <Briefcase {...iconProps} className="text-green-600" />;
      case 'teamwork':
      case 'communication':
        return <Users {...iconProps} className="text-purple-600" />;
      case 'learning':
      case 'education':
      case 'critical-thinking':
        return <Book {...iconProps} className="text-orange-600" />;
      case 'creative-expression':
        return <Award {...iconProps} className="text-pink-600" />;
      case 'problem-solving':
        return <Target {...iconProps} className="text-red-600" />;
      case 'logical-reasoning':
        return <Star {...iconProps} className="text-indigo-600" />;
      case 'certification':
        return <Trophy {...iconProps} className="text-purple-600" />;
      default:
        return <Target {...iconProps} className="text-gray-600" />;
    }
  };

  // Get unique categories from dashboard activities (exclude Certification)
  const getUniqueCategories = (): string[] => {
    const categories = new Set<string>();
    data.dashboardActivities.forEach(activity => {
      if (
        activity.category_activity &&
        activity.category_activity !== 'Certification' &&
        activity.activity !== 'english_skills'
      ) {
        categories.add(activity.category_activity);
      }
    });
    return Array.from(categories).sort();
  };

  // Filter activities by selected category (exclude Certification category)
  const getFilteredActivities = (): DashboardActivity[] => {
    const nonCertActivities = data.dashboardActivities.filter(
      activity =>
        activity.category_activity !== 'Certification' &&
        activity.activity !== 'english_skills'
    );
    
    if (selectedCategory === 'all') {
      return nonCertActivities;
    }
    return nonCertActivities.filter(activity => 
      activity.category_activity === selectedCategory
    );
  };

  // ── Leaderboard fetch ────────────────────────────────────────────────────
  const fetchLeaderboard = useCallback(async (metric: LeaderboardMetric) => {
    if (!userProfile?.join_code_used) return;
    setLeaderboardLoading(true);
    try {
      const joinCode = userProfile.join_code_used;

      if (metric === 'sessions_alltime' || metric === 'sessions_thismonth') {
        // Mirror AdminStudentDashboard exactly:
        //   count dashboard rows where progress is 'started' or 'completed'.
        //   For monthly view, filter on created_at (NOT updated_at — updated_at is
        //   bumped on every chat message; created_at records when the activity was
        //   first engaged and never changes).
        const { data: cohortProfiles, error: cpErr } = await supabase
          .from('profiles')
          .select('id, name')
          .eq('join_code_used', joinCode)
          .eq('role', 'student');

        if (cpErr || !cohortProfiles) { setLeaderboardLoading(false); return; }

        const cohortIds = cohortProfiles.map(p => p.id);
        const nameMap: Record<string, string> = {};
        cohortProfiles.forEach(p => { nameMap[p.id] = p.name; });

        const { data: rows, error: rowErr } = await supabase
          .from('dashboard')
          .select('user_id, progress, created_at')
          .in('user_id', cohortIds)
          .in('progress', ['started', 'completed']);

        if (rowErr || !rows) { setLeaderboardLoading(false); return; }

        // For monthly: filter client-side on created_at >= UTC start of current month
        const now = new Date();
        const monthStartMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);

        const filtered = metric === 'sessions_thismonth'
          ? rows.filter(r => {
              const ts = Date.parse(r.created_at || '');
              return !isNaN(ts) && ts >= monthStartMs;
            })
          : rows;

        // Count engaged rows per user
        const counts: Record<string, number> = {};
        filtered.forEach(r => {
          counts[r.user_id] = (counts[r.user_id] || 0) + 1;
        });

        const entries: LeaderboardEntry[] = Object.entries(counts)
          .map(([uid, count]) => ({ user_id: uid, name: nameMap[uid] || 'Unknown', value: count, rank: 0 }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 10)
          .map((e, i) => ({ ...e, rank: i + 1 }));

        setLeaderboard(entries);

      } else {
        // Certification metrics — scan dashboard rows with category_activity = 'Certification'
        const { data: cohortProfiles, error: cpErr } = await supabase
          .from('profiles')
          .select('id, name')
          .eq('join_code_used', joinCode)
          .eq('role', 'student');

        if (cpErr || !cohortProfiles) { setLeaderboardLoading(false); return; }

        const cohortIds = cohortProfiles.map(p => p.id);
        const nameMap: Record<string, string> = {};
        cohortProfiles.forEach(p => { nameMap[p.id] = p.name; });

        const { data: certRows, error: certErr } = await supabase
          .from('dashboard')
          .select('user_id, progress')
          .in('user_id', cohortIds)
          .eq('category_activity', 'Certification');

        if (certErr || !certRows) { setLeaderboardLoading(false); return; }

        const counts: Record<string, number> = {};
        certRows.forEach(r => {
          if (metric === 'certs_achieved' && r.progress !== 'completed') return;
          // certs_attempted: any progress that isn't 'not started'
          if (metric === 'certs_attempted' && r.progress === 'not started') return;
          counts[r.user_id] = (counts[r.user_id] || 0) + 1;
        });

        const entries: LeaderboardEntry[] = Object.entries(counts)
          .map(([uid, count]) => ({ user_id: uid, name: nameMap[uid] || 'Unknown', value: count, rank: 0 }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 10)
          .map((e, i) => ({ ...e, rank: i + 1 }));

        setLeaderboard(entries);
      }
    } catch (e) {
      console.error('[Leaderboard] fetch error:', e);
    } finally {
      setLeaderboardLoading(false);
    }
  }, [userProfile?.join_code_used]);

  // Refetch leaderboard whenever metric or join_code changes
  useEffect(() => {
    if (userProfile?.join_code_used) {
      fetchLeaderboard(leaderboardMetric);
    }
  }, [leaderboardMetric, fetchLeaderboard, userProfile?.join_code_used]);

  // ─────────────────────────────────────────────────────────────────────────

  const fetchDashboardData = useCallback(async (force = false) => {
    if (!user) {
      console.log('[Dashboard] No user, skipping fetch');
      return;
    }

    if (fetchingRef.current && !force) {
      console.log('[Dashboard] Already fetching, skipping');
      return;
    }

    if (!force && lastUserIdRef.current === user.id) {
      console.log('[Dashboard] Same user as last fetch, skipping');
      return;
    }

    try {
      fetchingRef.current = true;
      lastUserIdRef.current = user.id;
      setLoading(true);
      setError(null);

      console.log('Fetching dashboard data for user:', user.id, 'Role:', user.role, 'Grade:', user.grade_level);
      
      if (user.role === 'facilitator') {
        setData({
          projects: [],
          dashboardActivities: [],
          certifications: []
        });
      } else {
        // Student dashboard
        
        // Fetch student's projects
        let projects = [];
        try {
          const projectQuery = supabase
            .from('projects')
            .select('*')
            .eq('user_id', user.id);
          
          if (user.team_id) {
            projectQuery.or(`user_id.eq.${user.id},team_id.eq.${user.team_id}`);
          }
          
          const { data: projectsData, error: projectsError } = await projectQuery
            .order('updated_at', { ascending: false });

          if (projectsError) {
            console.warn('Projects fetch error:', projectsError.message, projectsError);
          } else {
            projects = projectsData || [];
          }
        } catch (error) {
          console.warn('Projects table may not exist:', error);
        }

        // Fetch team info
        let team = null;
        if (user.team_id) {
          const { data: teamData, error: teamError } = await supabase
            .from('teams')
            .select(`
              *,
              profiles!profiles_team_id_fkey(
                id,
                name,
                email,
                avatar_url,
                role
              )
            `)
            .eq('id', user.team_id)
            .single();

          if (teamError) {
            console.warn('Team fetch error:', teamError.message, teamError);
          } else {
            team = teamData;
          }
        }

        // Fetch dashboard activities
        let dashboardActivities: DashboardActivity[] = [];
        let certifications: CertificationProgress[] = [];
        
        console.log('Attempting to fetch dashboard data for user:', user.id);
        const { data: dashboardData, error: dashboardError } = await supabase
          .from<'dashboard'>( 'dashboard' )
          .select('*')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false });
      
        console.log('Dashboard query result:', { dashboardData, dashboardError });

        if (dashboardError || !dashboardData || dashboardData.length === 0) {
          console.log('No existing dashboard rows; running RPC seed…');
        
          const { data: rpcCount, error: rpcError } = await supabase.rpc(
            'create_grade_appropriate_dashboard_activities_by_continent',
            {
              user_id_param: user.id,
              continent_param: userProfile!.continent
            }
          );
          if (rpcError) {
            console.warn('RPC failed:', rpcError);
            throw rpcError;
          }
          console.log('RPC inserted rows:', rpcCount);
        
          const { data: retry, error: retryError } = await supabase
            .from<'dashboard'>('dashboard')
            .select('*')
            .eq('user_id', user.id)
            .order('updated_at', { ascending: false });
        
          if (retryError) {
            console.error('Refetch after RPC failed:', retryError);
            throw retryError;
          }
          dashboardActivities = retry || [];
          certifications = extractCertificationProgress(retry || []);
        }
        else {
          dashboardActivities = dashboardData;
          certifications = extractCertificationProgress(dashboardData);
        }

        // Create dashboard summary for learning activities (exclude Certification category)
        let dashboardSummary = null;
        const learningActivities = dashboardActivities.filter(
          a => a.category_activity !== 'Certification'
        );
        
        if (learningActivities && learningActivities.length > 0) {
          const completed = learningActivities.filter(a => a.progress === 'completed').length;
          const started = learningActivities.filter(a => a.progress === 'started').length;

          dashboardSummary = {
            total_activities: learningActivities.length,
            completed,
            started
          };
        }

        // Create certification summary
        let certificationSummary = null;
        if (certifications.length > 0) {
          const completedCerts = certifications.filter(c => c.progress === 'completed').length;
          const startedCerts = certifications.filter(c => c.progress === 'started').length;

          certificationSummary = {
            total_certifications: certifications.length,
            completed_certifications: completedCerts,
            started_certifications: startedCerts
          };
        }

        setData({
          projects: projects || [],
          team: team as DashboardData['team'],
          dashboardActivities: dashboardActivities,
          certifications: certifications,
          dashboardSummary: dashboardSummary || undefined,
          certificationSummary: certificationSummary || undefined
        });

      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, [user, userProfile?.continent]);
  
  // Refresh dashboard data
  const refreshDashboard = useCallback(async () => {
    if (!user || user.role !== 'student') return;
    if (!userProfile?.continent) {
      console.warn('[Dashboard] Cannot refresh: no continent yet');
      return;
    }

    try {
      setRefreshing(true);
      setError(null);

      const { error: rpcError } = await supabase.rpc('create_grade_appropriate_dashboard_activities_by_continent',
        {
          user_id_param: user.id,
          continent_param: userProfile.continent
        }
      );
      if (rpcError) throw rpcError;

      await fetchDashboardData(true);
    } catch (err) {
      console.error('Error refreshing dashboard:', err);
      setError('Failed to refresh dashboard: ' + (err as Error).message);
    } finally {
      setRefreshing(false);
    }
  }, [user, userProfile, fetchDashboardData]);

  // Function to download certificate
  const downloadCertificate = async (certificationName: string, displayName: string) => {
    try {
      setDownloadingCert(certificationName);
      
      // Find the certification activity
      const certActivity = data.dashboardActivities.find(
        a => a.activity.toLowerCase() === displayName.toLowerCase() && 
             a.category_activity === 'Certification'
      );
      
      if (!certActivity) {
        alert('Certification activity not found.');
        setDownloadingCert(null);
        return;
      }
      
      // Check if certificate PDF exists
      if (!certActivity.certificate_pdf_url) {
        alert('Certificate not yet generated. Please complete the certification first from the certification page.');
        setDownloadingCert(null);
        return;
      }
      
      // Download the certificate from storage
      console.log('[Dashboard] Downloading certificate from:', certActivity.certificate_pdf_url);
      window.open(certActivity.certificate_pdf_url, '_blank');
      
      setDownloadingCert(null);
    } catch (error) {
      console.error('Error downloading certificate:', error);
      alert('Could not download certificate. Please try again.');
      setDownloadingCert(null);
    }
  };

  useEffect(() => {
    if (user?.id) {
      supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
        .then(({ data, error }) => {
          if (!error && data) setUserProfile(data);
        });
    }
  }, [user?.id]);

  useEffect(() => {
    if (user?.id && userProfile?.continent) {
      fetchingRef.current = false;
      lastUserIdRef.current = null;
      fetchDashboardData();
    }
  }, [user?.id, userProfile?.continent, fetchDashboardData]);

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex">
              <AlertCircle className="h-5 w-5 text-red-400" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <p className="mt-2 text-sm text-red-700">{error}</p>
                {user?.role === 'student' && (
                  <div className="mt-4">
                    <Button 
                      onClick={refreshDashboard}
                      variant="outline"
                      size="sm"
                      icon={<RefreshCw size={16} />}
                      isLoading={refreshing}
                    >
                      Try to Fix Dashboard
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  const filteredActivities = getFilteredActivities();
  const uniqueCategories = getUniqueCategories();

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Welcome, {user?.name || 'User'}!
            </h1>
            <p className="text-gray-600">
            {user?.role === 'facilitator'
              ? 'Manage your teams and monitor student progress'
              : 'Track your certifications, projects and learning progress'}
            </p>
          </div>
          
          {user?.role === 'student' && (
            <div className="flex items-center space-x-2">
              <Button
                onClick={refreshDashboard}
                variant="outline"
                size="sm"
                icon={<RefreshCw size={16} />}
                isLoading={refreshing}
              >
                Refresh Activities
              </Button>
            </div>
          )}
        </div>

        {user?.role === 'facilitator' ? (
          // Facilitator Dashboard
          <div className="text-center py-12">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Facilitator Dashboard</h2>
            <p className="text-gray-600">Facilitator features coming soon!</p>
          </div>
        ) : (
          // Student Dashboard
          <div className="space-y-8">

            {/* ── Cohort Leaderboard ──────────────────────────────────────── */}
            {userProfile?.join_code_used && (
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="px-6 py-4 border-b bg-gradient-to-r from-amber-50 to-yellow-50 flex items-center justify-between flex-wrap gap-3">
                  <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    <Trophy className="h-6 w-6 text-amber-500" />
                    Cohort Leaderboard
                    <span className="text-sm font-normal text-gray-500 ml-1">
                      ({userProfile.join_code_used})
                    </span>
                  </h2>
                  <select
                    value={leaderboardMetric}
                    onChange={e => setLeaderboardMetric(e.target.value as LeaderboardMetric)}
                    className="text-sm border border-gray-300 rounded-md px-3 py-1.5 bg-white text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  >
                    {LEADERBOARD_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                {leaderboardLoading ? (
                  <div className="flex items-center justify-center py-10">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-amber-400" />
                  </div>
                ) : leaderboard.length === 0 ? (
                  <div className="py-8 text-center text-gray-400 text-sm">
                    No data yet for this metric.
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {leaderboard.map(entry => {
                      const isMe = entry.user_id === user?.id;
                      const medal = MEDAL[entry.rank];
                      const metricLabel =
                        leaderboardMetric === 'sessions_alltime' || leaderboardMetric === 'sessions_thismonth'
                          ? entry.value === 1 ? 'session' : 'sessions'
                          : entry.value === 1 ? 'certification' : 'certifications';

                      return (
                        <div
                          key={entry.user_id}
                          className={classNames(
                            'flex items-center px-6 py-3 gap-4 transition-colors',
                            isMe ? 'bg-amber-50 border-l-4 border-amber-400' : 'hover:bg-gray-50'
                          )}
                        >
                          {/* Rank */}
                          <div className="w-10 text-center flex-shrink-0">
                            {medal ? (
                              <span className="text-2xl leading-none">{medal}</span>
                            ) : (
                              <span className="text-base font-bold text-gray-400">#{entry.rank}</span>
                            )}
                          </div>

                          {/* Name */}
                          <div className="flex-1 min-w-0">
                            <span className={classNames(
                              'text-sm font-semibold truncate block',
                              isMe ? 'text-amber-800' : 'text-gray-800'
                            )}>
                              {entry.name}
                              {isMe && (
                                <span className="ml-2 text-xs font-normal text-amber-600">(you)</span>
                              )}
                            </span>
                          </div>

                          {/* Value */}
                          <div className="flex-shrink-0 text-right">
                            <span className={classNames(
                              'text-base font-bold',
                              entry.rank === 1 ? 'text-amber-600' :
                              entry.rank === 2 ? 'text-gray-500' :
                              entry.rank === 3 ? 'text-orange-700' :
                              'text-gray-700'
                            )}>
                              {entry.value}
                            </span>
                            <span className="ml-1 text-xs text-gray-400">{metricLabel}</span>
                          </div>

                          {/* Bar */}
                          <div className="hidden sm:block w-28 flex-shrink-0">
                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className={classNames(
                                  'h-2 rounded-full',
                                  entry.rank === 1 ? 'bg-amber-400' :
                                  entry.rank === 2 ? 'bg-gray-400' :
                                  entry.rank === 3 ? 'bg-orange-500' :
                                  'bg-blue-300'
                                )}
                                style={{
                                  width: `${Math.round((entry.value / leaderboard[0].value) * 100)}%`
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
            {/* ─────────────────────────────────────────────────────────── */}

            {/* Combined Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Certifications */}
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg shadow p-6 border-2 border-purple-200">
                <div className="flex items-center">
                  <div className="p-3 rounded-full bg-purple-600 text-white mr-4">
                    <Trophy size={24} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-purple-900">Certifications</p>
                    <p className="text-2xl font-semibold text-purple-900">
                      {data.certificationSummary?.completed_certifications || 0} / {data.certificationSummary?.total_certifications || 0}
                    </p>
                    <p className="text-xs text-purple-700">Completed</p>
                  </div>
                </div>
              </div>

              {/* Learning Activities */}
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg shadow p-6 border-2 border-blue-200">
                <div className="flex items-center">
                  <div className="p-3 rounded-full bg-blue-600 text-white mr-4">
                    <Book size={24} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-blue-900">Learning Activities</p>
                    <p className="text-2xl font-semibold text-blue-900">
                      {data.dashboardSummary?.total_activities || 0}
                    </p>
                    <p className="text-xs text-blue-700">Total Activities</p>
                  </div>
                </div>
              </div>

              {/* In Progress */}
              <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg shadow p-6 border-2 border-yellow-200">
                <div className="flex items-center">
                  <div className="p-3 rounded-full bg-yellow-600 text-white mr-4">
                    <Clock size={24} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-yellow-900">In Progress</p>
                    <p className="text-2xl font-semibold text-yellow-900">
                      {(data.certificationSummary?.started_certifications || 0) + (data.dashboardSummary?.started || 0)}
                    </p>
                    <p className="text-xs text-yellow-700">
                      {data.certificationSummary?.started_certifications || 0} Certs • {data.dashboardSummary?.started || 0} Activities
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Certifications Section */}
            {data.certifications.length > 0 && (
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="px-6 py-4 border-b bg-gradient-to-r from-purple-50 to-pink-50">
                  <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <Trophy className="h-7 w-7 text-purple-600" />
                    Certifications
                  </h1>
                </div>

                <div className="divide-y divide-gray-200">
                  {data.certifications.map((cert) => (
                    <div
                      key={cert.certificationName}
                      className="block p-6 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <Link
                          to={cert.route}
                          className="flex items-center space-x-4 flex-1"
                        >
                          <div className="p-3 bg-purple-100 rounded-lg">
                            <GraduationCap className="h-6 w-6 text-purple-600" />
                          </div>
                          <div className="flex-1">
                            <h3 className="text-lg font-semibold text-gray-900">
                              {cert.displayName}
                            </h3>
                            <p className="text-sm text-gray-600 mt-1">
                              {cert.completedAssessments} / {cert.totalAssessments} assessments completed
                            </p>
                            {cert.updated_at && (
                              <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                Updated {new Date(cert.updated_at).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                        </Link>
                        <div className="flex items-center space-x-4">
                          <span
                            className={classNames(
                              'inline-flex items-center px-3 py-1 rounded-full text-sm font-medium',
                              getProgressColor(cert.progress)
                            )}
                          >
                            {cert.progress}
                          </span>
                          {cert.progress === 'completed' && (
                            <>
                              <CheckCircle className="h-6 w-6 text-green-600" />
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  downloadCertificate(cert.certificationName, cert.displayName);
                                }}
                                disabled={downloadingCert === cert.certificationName}
                                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-medium hover:from-purple-700 hover:to-pink-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Download Certificate"
                              >
                                {downloadingCert === cert.certificationName ? (
                                  <RefreshCw className="h-5 w-5 animate-spin" />
                                ) : (
                                  <Download className="h-5 w-5" />
                                )}
                                <span className="hidden sm:inline">Download Certificate</span>
                              </button>
                            </>
                          )}
                          {cert.progress !== 'completed' && (
                            <Link to={cert.route}>
                              <ArrowRight className="h-5 w-5 text-gray-400" />
                            </Link>
                          )}
                        </div>
                      </div>
                      
                      {/* Certification Assessment Scores Summary */}
                      {cert.progress !== 'not started' && (() => {
                        // Find the certification activity in dashboard to get scores
                        console.log('[Dashboard] Looking for certification activity:', cert.displayName);
                        console.log('[Dashboard] Available activities:', data.dashboardActivities.map(a => ({ 
                          activity: a.activity, 
                          category: a.category_activity 
                        })));
                        
                        // Case-insensitive search for certification activity
                        const certActivity = data.dashboardActivities.find(
                          a => a.activity.toLowerCase() === cert.displayName.toLowerCase() && 
                               a.category_activity === 'Certification'
                        );
                        
                        console.log('[Dashboard] Found certActivity:', certActivity ? certActivity.activity : 'NOT FOUND');
                        
                        if (!certActivity) {
                          console.log('[Dashboard] No certification activity found for:', cert.displayName);
                          return null;
                        }
                        
                        // Debug: Log what columns this activity has
                        console.log('[Dashboard] Activity category:', certActivity.category_activity);
                        console.log('[Dashboard] Activity sub_category:', certActivity.sub_category);
                        
                        // Debug: Check if certification columns exist
                        const certColumns = Object.keys(certActivity).filter(k => 
                          k.startsWith(`certification_${cert.certificationName}_`) && k.endsWith('_score')
                        );
                        console.log('[Dashboard] Found certification columns in activity:', certColumns);
                        console.log('[Dashboard] Sample values:', certColumns.map(k => `${k}=${certActivity[k]}`));
                        
                        const hasScoresResult = hasScores(certActivity);
                        console.log('[Dashboard] hasScores result:', hasScoresResult);
                        
                        if (!hasScoresResult) {
                          console.log('[Dashboard] No scores detected, but expected columns:', certColumns.length);
                          return null;
                        }
                        
                        const allScores = getActivityScores(certActivity);
                        console.log('[Dashboard] All scores for', cert.certificationName, ':', allScores);
                        
                        const scores = allScores.filter(s => s.score != null);
                        console.log('[Dashboard] Filtered scores (non-null):', scores.length, scores);
                        
                        if (scores.length === 0) return null;
                        
                        return (
                          <div className="mt-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-4 border-2 border-purple-200">
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="text-sm font-semibold text-purple-900 flex items-center gap-2">
                                <Trophy className="h-4 w-4" />
                                Assessment Scores
                              </h4>
                              <div className="text-xs text-purple-700 font-medium">
                                {scores.length} of {cert.totalAssessments} completed
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                              {scores.map(({ dimension, score, maxScore }) => {
                                const scoreLabel = getScoreLabel(score, true); // true = isCertification
                                
                                // Certification scoring: 0 = No Evidence, 1 = Emerging, 2 = Proficient, 3 = Advanced
                                const colorClass = 
                                  score === 3 ? 'bg-green-50 border-green-400 text-green-900' :
                                  score === 2 ? 'bg-blue-50 border-blue-400 text-blue-900' :
                                  score === 1 ? 'bg-yellow-50 border-yellow-400 text-yellow-900' :
                                  'bg-gray-50 border-gray-400 text-gray-900';
                                
                                const badgeColor =
                                  score === 3 ? 'bg-green-600 text-white' :
                                  score === 2 ? 'bg-blue-600 text-white' :
                                  score === 1 ? 'bg-yellow-600 text-white' :
                                  'bg-gray-600 text-white';
                                
                                const icon = 
                                  score === 3 ? <Star className="h-3 w-3 fill-current" /> :
                                  score === 2 ? <CheckCircle className="h-3 w-3" /> :
                                  null;
                                
                                return (
                                  <div
                                    key={dimension}
                                    className={classNames('px-3 py-2.5 rounded-md border-2', colorClass)}
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="flex-1 min-w-0">
                                        <div className="text-sm font-semibold truncate" title={dimension}>
                                          {dimension}
                                        </div>
                                        <div className="text-xs mt-1 font-medium flex items-center gap-1">
                                          {icon}
                                          {scoreLabel}
                                        </div>
                                      </div>
                                      <div className="flex-shrink-0">
                                        <span className={classNames('inline-flex items-center px-2 py-1 rounded text-xs font-bold', badgeColor)}>
                                          {score}/{maxScore}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                            
                            {/* Overall Achievement Level */}
                            {cert.progress === 'completed' && scores.length > 0 && (
                              <div className="mt-4 pt-3 border-t-2 border-purple-300">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-semibold text-purple-900">
                                    Achievement Level:
                                  </span>
                                  <span className={classNames(
                                    'text-base font-bold px-3 py-1 rounded-full',
                                    scores.every(s => s.score === 3) 
                                      ? 'bg-green-600 text-white' 
                                      : 'bg-blue-600 text-white'
                                  )}>
                                    {scores.every(s => s.score === 3) ? 'Advanced ⭐' : 'Proficient ✓'}
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── English Skills Section (only if user has started) ─────── */}
            {(() => {
              const englishRows = data.dashboardActivities.filter(
                a => a.activity === 'english_skills'
              );
              if (englishRows.length === 0) return null;

              // Group by stage (category_activity)
              const stageMap = new Map<string, DashboardActivity[]>();
              englishRows.forEach(row => {
                const stage = row.category_activity || 'English Skills';
                if (!stageMap.has(stage)) stageMap.set(stage, []);
                stageMap.get(stage)!.push(row);
              });

              const levelColor = (level: string) => {
                switch (level) {
                  case 'Advanced':   return 'bg-green-100 text-green-800 border-green-300';
                  case 'Proficient': return 'bg-blue-100 text-blue-800 border-blue-300';
                  case 'Developing': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
                  default:           return 'bg-gray-100 text-gray-700 border-gray-300';
                }
              };

              return (
                <div className="bg-white rounded-lg shadow overflow-hidden">
                  <div className="px-6 py-4 border-b bg-gradient-to-r from-cyan-50 to-blue-50">
                    <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                      <Globe2 className="h-7 w-7 text-cyan-600" />
                      English Skills
                    </h2>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {englishRows.filter(r => r.progress === 'completed').length} sessions completed · {englishRows.length} total
                    </p>
                  </div>

                  <div className="divide-y divide-gray-100">
                    {Array.from(stageMap.entries()).map(([stageName, rows]) => {
                      const bestRow = rows.find(r => r.progress === 'completed') ?? rows[0];
                      const ev = bestRow?.english_skills_evaluation as any;
                      const overallLevel: string = ev?.overall_level ?? null;
                      const subCats: any[] = ev?.sub_categories ?? [];
                      const sessionCount = rows.length;
                      const completedCount = rows.filter(r => r.progress === 'completed').length;

                      return (
                        <Link
                          key={stageName}
                          to="/english-skills"
                          className="block p-5 hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-start gap-3 flex-1 min-w-0">
                              <div className="p-2 bg-cyan-100 rounded-lg flex-shrink-0 mt-0.5">
                                <Globe2 className="h-5 w-5 text-cyan-600" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h3 className="text-base font-semibold text-gray-900">{stageName}</h3>
                                <p className="text-sm text-gray-500 mt-0.5">
                                  {sessionCount} session{sessionCount !== 1 ? 's' : ''} · {completedCount} completed
                                </p>
                                {bestRow?.title && (
                                  <p className="text-xs text-gray-400 mt-0.5 truncate">
                                    Latest topic: <span className="italic">{bestRow.title}</span>
                                  </p>
                                )}

                                {/* Sub-category scores */}
                                {subCats.length > 0 && (
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    {subCats.map((sc: any) => (
                                      <span
                                        key={sc.name}
                                        className={classNames(
                                          'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border',
                                          levelColor(sc.level)
                                        )}
                                      >
                                        {sc.name}: {sc.level}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="flex flex-col items-end gap-2 flex-shrink-0">
                              {overallLevel && (
                                <span className={classNames(
                                  'inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold border',
                                  levelColor(overallLevel)
                                )}>
                                  <TrendingUp className="h-3.5 w-3.5 mr-1" />
                                  {overallLevel}
                                </span>
                              )}
                              <span className={classNames(
                                'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                                getProgressColor(bestRow?.progress ?? 'not started')
                              )}>
                                {bestRow?.progress ?? 'not started'}
                              </span>
                              <ArrowRight className="h-4 w-4 text-gray-400 mt-1" />
                            </div>
                          </div>

                          <div className="mt-2 flex items-center text-xs text-gray-400">
                            <Clock size={13} className="mr-1" />
                            Updated {new Date(bestRow.updated_at).toLocaleDateString()}
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* Category Filter */}
            {uniqueCategories.length > 1 && (
              <div className="bg-white rounded-lg shadow p-4">
                <div className="flex items-center space-x-4">
                  <span className="text-sm font-medium text-gray-700">Filter by category:</span>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setSelectedCategory('all')}
                      className={classNames(
                        'px-3 py-1 rounded-full text-sm font-medium transition-colors',
                        selectedCategory === 'all'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      )}
                    >
                      All ({filteredActivities.length})
                    </button>
                    {uniqueCategories.map((category) => {
                      const count = data.dashboardActivities.filter(
                        a => a.category_activity === category && a.category_activity !== 'Certification'
                      ).length;
                      return (
                        <button
                          key={category}
                          onClick={() => setSelectedCategory(category)}
                          className={classNames(
                            'px-3 py-1 rounded-full text-sm font-medium transition-colors',
                            selectedCategory === category
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          )}
                        >
                          {category} ({count})
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Learning Activities */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b">
                <h2 className="text-lg font-medium text-gray-900">
                  My Learning Activities
                  {selectedCategory !== 'all' && (
                    <span className="text-sm font-normal text-gray-500 ml-2">
                      - {selectedCategory} ({filteredActivities.length})
                    </span>
                  )}
                </h2>
              </div>

              <div className="divide-y divide-gray-200">
                {filteredActivities.length > 0 ? (
                  filteredActivities.map((activity) => {
                    // Determine if we should show a link and where it should go
                    const isLinkable = activity.progress === 'started' && activity.learning_module_id;
                    
                    // Route based on activity type
                    let activityLink: string | null = null;
                    if (isLinkable) {
                      const cat = activity.category_activity;
                      const subCat = activity.sub_category;
                      
                      // AI Learning activities
                      if (cat === 'AI Learning') {
                        activityLink = `/learning/ai/${activity.learning_module_id}`;
                      }
                      // Vibe Coding → Tech Workshop route
                      else if (subCat === 'Vibe Coding' || cat === 'Vibe Coding' || cat === 'Tech Workshop') {
                        activityLink = '/tech-skills/vibe-coding';
                      }
                      // Skills activities
                      else if (
                        cat === 'Skills' ||
                        cat === 'Critical Thinking' || subCat === 'Critical Thinking' ||
                        cat === 'Problem-Solving' || cat === 'Problem Solving' || subCat === 'Problem-Solving' ||
                        cat === 'Creativity' || subCat === 'Creativity' ||
                        cat === 'Communication' || subCat === 'Communication' ||
                        cat === 'Digital Fluency' || subCat === 'Digital Fluency'
                      ) {
                        activityLink = '/learning/skills';
                      }
                      // Default fallback
                      else {
                        activityLink = `/learning/ai/${activity.learning_module_id}`;
                      }
                    }
                    
                    const content = (
                      <div className="p-6">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4 flex-1">
                            <div className="p-2 bg-gray-100 rounded-lg">
                              {getCategoryIcon(activity.category_activity)}
                            </div>
                            <div className="flex-1">
                              <h3 className="text-base font-medium text-gray-900">
                                {activity.activity}
                              </h3>
                              <p className="text-sm text-gray-500">
                                {activity.category_activity}
                                {activity.sub_category && (
                                  <span className="text-gray-400"> • {activity.sub_category}</span>
                                )}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-4">
                            <span
                              className={classNames(
                                'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                                getProgressColor(activity.progress)
                              )}
                            >
                              {activity.progress}
                            </span>
                            {(activity.evaluation_score != null || activity.certification_evaluation_score != null) && (
                              <div className="text-lg font-semibold text-green-600">
                                {activity.certification_evaluation_score ?? activity.evaluation_score}%
                              </div>
                            )}
                            {isLinkable && (
                              <ArrowRight className="h-5 w-5 text-blue-600" />
                            )}
                          </div>
                        </div>
                        
                        {/* Comprehensive Score Summary */}
                        {hasScores(activity) && (
                          <div className="mt-4 bg-gray-50 rounded-lg p-4 border border-gray-200">
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="text-sm font-semibold text-gray-700">
                                Evaluation Scores
                              </h4>
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setSelectedActivityForDetails(activity);
                                  setShowDetailsModal(true);
                                }}
                                className="text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline"
                              >
                                View Full Details →
                              </button>
                            </div>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {getActivityScores(activity)
                                .filter(s => s.score != null)
                                .map(({ dimension, score, maxScore, evidence }) => {
                                  const isCert = activity.category_activity === 'Certification';
                                  const scoreLabel = getScoreLabel(score, isCert);
                                  
                                  // Color based on score level
                                  const colorClass = 
                                    score === maxScore ? 'bg-green-50 border-green-300 text-green-900' :
                                    score === maxScore - 1 ? 'bg-blue-50 border-blue-300 text-blue-900' :
                                    score === maxScore - 2 ? 'bg-yellow-50 border-yellow-300 text-yellow-900' :
                                    'bg-red-50 border-red-300 text-red-900';
                                  
                                  const badgeColor =
                                    score === maxScore ? 'bg-green-600 text-white' :
                                    score === maxScore - 1 ? 'bg-blue-600 text-white' :
                                    score === maxScore - 2 ? 'bg-yellow-600 text-white' :
                                    'bg-red-600 text-white';
                                  
                                  return (
                                    <div
                                      key={dimension}
                                      className={classNames('px-3 py-2 rounded-md border-2', colorClass)}
                                      title={evidence || 'No evidence recorded'}
                                    >
                                      <div className="flex items-start justify-between gap-2">
                                        <div className="flex-1 min-w-0">
                                          <div className="text-sm font-medium truncate" title={dimension}>
                                            {dimension}
                                          </div>
                                          <div className="text-xs mt-0.5 opacity-75">
                                            {scoreLabel}
                                          </div>
                                        </div>
                                        <div className="flex-shrink-0">
                                          <span className={classNames('inline-flex items-center px-2 py-0.5 rounded text-xs font-bold', badgeColor)}>
                                            {score}/{maxScore}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                            </div>
                            
                            {/* Overall Score if available */}
                            {(activity.certification_evaluation_score != null || activity.evaluation_score != null) && (
                              <div className="mt-3 pt-3 border-t border-gray-300">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-semibold text-gray-700">
                                    Overall Score:
                                  </span>
                                  <span className="text-lg font-bold text-green-600">
                                    {activity.certification_evaluation_score ?? activity.evaluation_score}%
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                        
                        <div className="mt-2 flex items-center text-sm text-gray-500">
                          <Clock size={16} className="mr-1.5" />
                          <span>
                            Updated {new Date(activity.updated_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    );

                    return activityLink ? (
                      <Link
                        key={activity.id}
                        to={activityLink}
                        state={{ activityId: activity.id, learningModuleId: activity.learning_module_id }}
                        className="block hover:bg-gray-50 transition-colors"
                      >
                        {content}
                      </Link>
                    ) : (
                      <div key={activity.id}>
                        {content}
                      </div>
                    );
                  })
                ) : (
                  <div className="p-6 text-center">
                    <p className="text-gray-500">
                      {selectedCategory === 'all' 
                        ? 'No learning activities found.' 
                        : `No activities found for ${selectedCategory}.`}
                    </p>
                    <p className="text-sm text-gray-400 mt-2">
                      Activities should be automatically created based on your grade level.
                    </p>
                    <div className="mt-4">
                      <Button
                        onClick={refreshDashboard}
                        icon={<RefreshCw size={16} />}
                        isLoading={refreshing}
                      >
                        Load My Activities
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Projects Section */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b">
                <h2 className="text-lg font-medium text-gray-900">My Projects</h2>
                <Link to="/projects/new">
                  <Button icon={<Plus size={16} />} size="sm">
                    New Project
                  </Button>
                </Link>
              </div>

              <div className="divide-y divide-gray-200">
                {data.projects.length > 0 ? (
                  data.projects.slice(0, 5).map((project) => (
                    <div key={project.id} className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-base font-medium text-gray-900">
                            <Link 
                              to={`/project/${project.id}`}
                              className="hover:text-blue-600 transition-colors"
                            >
                              {project.title}
                            </Link>
                          </h3>
                          <p className="text-sm text-gray-500 mt-1">
                            {project.description}
                          </p>
                        </div>
                        <div className="text-right">
                          <span
                            className={classNames(
                              'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                              {
                                'bg-gray-100 text-gray-800': project.status === 'draft',
                                'bg-blue-100 text-blue-800': project.status === 'in_progress',
                                'bg-green-100 text-green-800': project.status === 'completed',
                                'bg-red-100 text-red-800': project.status === 'archived',
                              }
                            )}
                          >
                            {project.status.replace('_', ' ')}
                          </span>
                          <p className="text-xs text-gray-500 mt-1">
                            Updated {new Date(project.updated_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-6 text-center">
                    <p className="text-gray-500">No projects yet.</p>
                    <p className="text-sm text-gray-400 mt-2">
                      Create your first project to get started!
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Activity Score Details Modal */}
      {showDetailsModal && selectedActivityForDetails && (
        <div className="fixed inset-0 z-50 overflow-y-auto" onClick={() => setShowDetailsModal(false)}>
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50 transition-opacity" />
            
            <div 
              className="relative bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-10">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{selectedActivityForDetails.activity}</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    {selectedActivityForDetails.category_activity}
                    {selectedActivityForDetails.sub_category && (
                      <span className="text-gray-400"> • {selectedActivityForDetails.sub_category}</span>
                    )}
                  </p>
                </div>
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Overall Score */}
              <div className="px-6 py-4 bg-gradient-to-r from-indigo-50 to-purple-50 border-b">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Overall Score</span>
                  <span className={classNames(
                    'text-3xl font-bold',
                    (selectedActivityForDetails.certification_evaluation_score ?? selectedActivityForDetails.evaluation_score) === 100 
                      ? 'text-green-600' 
                      : 'text-indigo-600'
                  )}>
                    {selectedActivityForDetails.certification_evaluation_score ?? selectedActivityForDetails.evaluation_score ?? 0}%
                  </span>
                </div>
                <div className="mt-3">
                  <div className="w-full bg-white rounded-full h-3 shadow-inner">
                    <div 
                      className={classNames(
                        'h-3 rounded-full transition-all',
                        (selectedActivityForDetails.certification_evaluation_score ?? selectedActivityForDetails.evaluation_score) === 100 
                          ? 'bg-gradient-to-r from-green-500 to-green-600' 
                          : 'bg-gradient-to-r from-indigo-500 to-purple-600'
                      )}
                      style={{ width: `${selectedActivityForDetails.certification_evaluation_score ?? selectedActivityForDetails.evaluation_score ?? 0}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Score Breakdown */}
              <div className="px-6 py-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <Trophy className="w-5 h-5 text-yellow-500 mr-2" />
                  Score Breakdown
                </h3>
                
                {(() => {
                  const scores = getActivityScores(selectedActivityForDetails);
                  const isCertification = selectedActivityForDetails.category_activity === 'Certification';
                  
                  return (
                    <div className="space-y-4">
                      {scores.map(({ dimension, score, evidence, maxScore }) => {
                        const colorClass = 
                          score === maxScore ? 'bg-green-100 text-green-800 border-green-300' :
                          score === maxScore - 1 ? 'bg-blue-100 text-blue-800 border-blue-300' :
                          score === maxScore - 2 ? 'bg-yellow-100 text-yellow-800 border-yellow-300' :
                          'bg-red-100 text-red-800 border-red-300';
                        
                        const barColor =
                          score === maxScore ? 'bg-green-500' :
                          score === maxScore - 1 ? 'bg-blue-500' :
                          score === maxScore - 2 ? 'bg-yellow-500' :
                          'bg-red-500';
                        
                        return (
                          <div key={dimension} className="border-l-4 border-indigo-500 pl-4 py-2 bg-gray-50 rounded-r-lg">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="font-medium text-gray-900">{dimension}</h4>
                              <span className={classNames('px-3 py-1 rounded-full text-sm font-bold border shadow-sm', colorClass)}>
                                {score ?? 0}/{maxScore} — {getScoreLabel(score, isCertification)}
                              </span>
                            </div>
                            
                            {/* Progress bar */}
                            <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                              <div 
                                className={classNames('h-2 rounded-full transition-all', barColor)}
                                style={{ width: `${((score ?? 0) / maxScore) * 100}%` }}
                              />
                            </div>
                            
                            {evidence && evidence.trim() && (
                              <div className="text-sm text-gray-700 bg-white rounded-lg p-3 mt-2 border border-gray-200">
                                <strong className="text-indigo-700">Evidence:</strong> {evidence}
                              </div>
                            )}
                            {(!evidence || !evidence.trim()) && score != null && (
                              <p className="text-sm text-gray-400 italic mt-2">No evidence recorded</p>
                            )}
                          </div>
                        );
                      })}
                      
                      {scores.length === 0 && (
                        <div className="text-center py-8 text-gray-500">
                          <AlertCircle className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                          <p>No detailed scores available for this activity.</p>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Footer */}
              <div className="sticky bottom-0 bg-gray-50 px-6 py-4 border-t flex justify-between items-center">
                <span className="text-sm text-gray-500 flex items-center">
                  <Clock className="w-4 h-4 mr-1.5" />
                  Updated: {new Date(selectedActivityForDetails.updated_at).toLocaleDateString()}
                </span>
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium shadow-sm"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
};

export default DashboardPage;