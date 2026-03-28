// src/App.tsx - Fixed with better profile completion handling

import React, { useEffect, useMemo } from 'react';
import EnglishSkillsPage from './pages/EnglishSkillsPage';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate
} from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import ProfileCompletionPopup from './components/profile/ProfileCompletionPopup';

// Auth Pages
import LoginPage from './pages/auth/LoginPage';
import SignupPage from './pages/auth/SignupPage';
import ConfirmationPage from './pages/auth/ConfirmationPage';
import AuthCallback from './pages/auth/AuthCallback';
import EmailConfirmationSuccess from './pages/auth/EmailConfirmationSuccess';

// Main Pages
import HomePage from './pages/HomePage';
import DashboardPage from './pages/DashboardPage';
import AboutPage from './pages/AboutPage';
import ProfilePage from './pages/ProfilePage';

// Learning Pages
import AILearningPage from './pages/AILearningPage';
import SkillsDevelopmentPage from './pages/SkillsDevelopmentPage';

// Certification Pages
import AIProficiencyPage from './pages/AIProficiencyPage';
import AIReadySkillsPage from './pages/AIReadySkillsPage';
import AIPlaygroundPage from './pages/AIPlaygroundPage';


// Tech Skills Pages
import WebDevelopmentPage from './pages/tech-skills/WebDevelopmentPage';
import VibeCodingPage from './pages/tech-skills/VibeCodingPage';
import FullStackDevelopmentPage from './pages/tech-skills/FullStackDevelopmentPage';
import ImageGenerationPage from './pages/ImageGenerationPage';
import VideoGenerationPage from './pages/VideoGenerationPage';
import VoiceCreationPage from './pages/VoiceCreationPage';
import AIContentCreationPage from './pages/AIContentCreationPage';
import AIWorkflowDevPage from './pages/tech-skills/AIWorkflowDevPage';
import AIForBusinessPage from './pages/tech-skills/AIForBusinessPage';
import VibeCodingCertificationPage from './pages/tech-skills/VibeCodingCertificationPage';
import WebDevCertificationPage from './pages/tech-skills/WebDevCertificationPage';
import AIVideoProductionCertificationPage from './pages/tech-skills/AIVideoProductionCertificationPage';
import AIImageCertificationPage from './pages/tech-skills/AIImageCertificationPage';
import AIVoiceCertificationPage from './pages/tech-skills/AIVoiceCertificationPage';
import FullStackCertificationPage from './pages/tech-skills/FullStackCertificationPage';
import AIWorkflowDevCertificationPage from './pages/tech-skills/AIWorkflowDevCertificationPage';
import AIForBusinessCertificationPage from './pages/tech-skills/AIForBusinessCertificationPage';
import AIContentCreationCertificationPage from './pages/tech-skills/AIContentCreationCertificationPage';

// Legacy pages - kept for backwards compatibility
import ProjectsListPage from './pages/ProjectsListPage';
import TeamPage from './pages/TeamPage';
import CodeAssistantPage from './pages/CodeAssistantPage';
import TutorAI from './pages/TutorAI';
import SkillsPage from './pages/SkillsPage';
import CreatePage from './pages/CreatePage';
import AdminStudentDashboard from './pages/admin/AdminStudentDashboard';

// Community Impact Pages
import AIAmbassadorsPage from './pages/community-impact/AIAmbassadorsPage';
import AIAmbassadorsCertificationPage from './pages/community-impact/AIAmbassadorsCertificationPage';
import AgricultureConsultantPage from './pages/community-impact/AgricultureConsultantPage';
import AgricultureConsultantCertificationPage from './pages/community-impact/AgricultureConsultantCertificationPage';
import FishingConsultantPage from './pages/community-impact/FishingConsultantPage';
import HealthcareNavigatorPage from './pages/community-impact/HealthcareNavigatorPage';

const AppContent: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    user,
    session,
    loading,
    needsProfileCompletion,
    markProfileCompleted
  } = useAuth();

  // Log page navigations
  useEffect(() => {
    console.log('[AppContent] location change:', location.pathname);
  }, [location.pathname]);

  // Show the profile-completion popup when appropriate
  const showPopup = useMemo(
    () =>
      session !== null &&
      user !== null &&
      needsProfileCompletion === true,
    [session, user, needsProfileCompletion]
  );

  // Log auth state changes
  useEffect(() => {
    console.log('[AppContent] auth state →', {
      loading,
      hasSession: !!session,
      hasUser: !!user,
      needsProfileCompletion,
      userEmail: user?.email,
      showPopup
    });
  }, [loading, session, user, needsProfileCompletion, showPopup]);

  const handleProfileCompletion = async () => {
    console.log('[AppContent] profile completion triggered');
    if (user?.id) {
      try {
        await markProfileCompleted(user.id);
        console.log('[AppContent] profile marked as completed');
        setTimeout(() => {
          console.log('[AppContent] navigating to /dashboard');
          navigate('/dashboard', { replace: true });
        }, 100);
      } catch (error) {
        console.error('[AppContent] error in profile completion:', error);
      }
    }
  };

  // Loading state
  if (loading) {
    console.log('[AppContent] loading, showing spinner');
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12
                          border-t-2 border-b-2 border-blue-500
                          mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Routes>
        {/* Auth Routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/auth/confirmation" element={<ConfirmationPage />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route
          path="/auth/confirmation-success"
          element={<EmailConfirmationSuccess />}
        />

        {/* Main App Routes */}
        <Route path="/home" element={<HomePage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/profile" element={<ProfilePage />} />

        {/* Learning Routes */}
        <Route path="/english-skills" element={<EnglishSkillsPage />} />
        <Route path="/learning/ai" element={<AILearningPage />} />
        <Route path="/learning/skills" element={<SkillsDevelopmentPage />} />

        {/* Certification Routes */}
        <Route path="/certifications/ai-proficiency" element={<AIProficiencyPage />} />
        <Route path="/certifications/ai-ready-skills" element={<AIReadySkillsPage />} />
        <Route path="/certifications/vibe-coding" element={<VibeCodingCertificationPage />} />
        <Route path="/certifications/web-dev-certification" element={<WebDevCertificationPage />} />
        <Route path="/certifications/full-stack-certification" element={<FullStackCertificationPage />} />
        <Route path="/certifications/ai-video-production" element={<AIVideoProductionCertificationPage />} />
        <Route path="/certifications/ai-image-creation-cert" element={<AIImageCertificationPage />} />
        <Route path="/certifications/ai-voice-creation" element={<AIVoiceCertificationPage />} />
        <Route path="/certifications/ai-content-creation" element={<AIContentCreationCertificationPage />} />
        <Route path="/certifications/ai-workflow-dev" element={<AIWorkflowDevCertificationPage />} />
        <Route path="/certifications/ai-for-business" element={<AIForBusinessCertificationPage />} />
        <Route path="/playground" element={<AIPlaygroundPage />} />

        {/* Tech Skills Routes */}
        <Route path="/tech-skills/vibe-coding" element={<VibeCodingPage />} />
        <Route path="/tech-skills/web-development" element={<WebDevelopmentPage />} />
        <Route path="/tech-skills/full-stack-development" element={<FullStackDevelopmentPage />} />
        <Route path="/tech-skills/ai-image-creation" element={<ImageGenerationPage />} />
        <Route path="/tech-skills/ai-video-creation" element={<VideoGenerationPage />} />
        <Route path="/tech-skills/ai-voice-creation" element={<VoiceCreationPage />} />
        <Route path="/tech-skills/ai-content-creation" element={<AIContentCreationPage />} />
        <Route path="/tech-skills/ai-workflow-development" element={<AIWorkflowDevPage />} />
        <Route path="/tech-skills/ai-for-business" element={<AIForBusinessPage />} />

        {/* Community Impact Routes */}
        <Route path="/community-impact/ai-ambassadors" element={<AIAmbassadorsPage />} />
        <Route path="/community-impact/ai-ambassadors/certification" element={<AIAmbassadorsCertificationPage />} />
        <Route path="/community-impact/agriculture" element={<AgricultureConsultantPage />} />
        <Route path="/community-impact/agriculture/certification" element={<AgricultureConsultantCertificationPage />} />
        <Route path="/community-impact/fishing" element={<FishingConsultantPage />} />
        <Route path="/community-impact/healthcare" element={<HealthcareNavigatorPage />} />

        {/* Legacy Route Redirects */}
        <Route path="/ai-proficiency" element={<Navigate to="/certifications/ai-proficiency" replace />} />
        <Route path="/ai-ready-skills" element={<Navigate to="/certifications/ai-ready-skills" replace />} />
        <Route path="/skills" element={<Navigate to="/learning/skills" replace />} />
        <Route path="/ai-learning" element={<Navigate to="/learning/ai" replace />} />
        <Route path="/tutor-ai" element={<Navigate to="/learning/ai" replace />} />
        <Route path="/code-assistant" element={<CodeAssistantPage />} />
        <Route path="/create" element={<Navigate to="/learning/skills" replace />} />
        <Route path="/teams" element={<Navigate to="/dashboard" replace />} />
        <Route path="/team/:teamId" element={<Navigate to="/dashboard" replace />} />
        <Route path="/projects" element={<Navigate to="/dashboard" replace />} />
        <Route path="/projects/new" element={<Navigate to="/dashboard" replace />} />

        {/* Admin */}
        <Route path="/admin" element={<DashboardPage />} />
        <Route path="/admin/analytics" element={<DashboardPage />} />
        <Route path="/admin/teams/new" element={<DashboardPage />} />
        <Route path="/admin/projects" element={<DashboardPage />} />
        <Route path="/admin/education" element={<DashboardPage />} />
        <Route path="/admin/student-dashboard" element={<AdminStudentDashboard />} />

        {/* Fallback */}
        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>

      {/* Profile Completion Modal */}
      {showPopup && (
        <ProfileCompletionPopup
          userId={user!.id}
          email={user!.email}
          onComplete={handleProfileCompletion}
        />
      )}
    </>
  );
};

function App() {
  // DEV-only: clearly label your local build in the browser tab
  useEffect(() => {
    if (import.meta.env.DEV) {
      document.title = 'AI-ing and Vibing [DEV]';
    }
  }, []);

  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

export default App;