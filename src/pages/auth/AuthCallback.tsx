import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { Loader2, AlertCircle } from 'lucide-react';

const AuthCallback: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        console.log('Processing auth callback...');
        
        // Get the hash and search parameters
        const hash = window.location.hash;
        const urlParams = new URLSearchParams(window.location.search);
        
        console.log('Hash:', hash);
        console.log('Search params:', Object.fromEntries(urlParams));

        // Check for error in URL params
        const error = urlParams.get('error');
        const errorDescription = urlParams.get('error_description');
        
        if (error) {
          console.error('Auth callback error:', error, errorDescription);
          setErrorMessage(errorDescription || error);
          setStatus('error');
          return;
        }

        // Handle the session from URL (for email confirmations)
        const { data, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('Session error:', sessionError);
          setErrorMessage(sessionError.message);
          setStatus('error');
          return;
        }

        console.log('Session data:', data);

        // Helper: ensure a profiles row exists for this auth user
        const ensureProfile = async (authUser: { id: string; email?: string }) => {
          const { data: existing } = await supabase
            .from('profiles')
            .select('id')
            .eq('id', authUser.id)
            .maybeSingle();

          if (existing) {
            console.log('[AuthCallback] profiles row already exists');
            return;
          }

          console.log('[AuthCallback] No profiles row — creating minimal profile');
          const now = new Date().toISOString();
          const { error: insertError } = await supabase
            .from('profiles')
            .insert({
              id: authUser.id,
              email: authUser.email ?? '',
              name: '',
              role: 'student',          // default; user sets real role in ProfilePage
              profile_completed: false,
              created_at: now,
              updated_at: now,
            });

          if (insertError) {
            console.warn('[AuthCallback] Could not create profiles row:', insertError.message);
          } else {
            console.log('[AuthCallback] ✅ Minimal profiles row created');
          }
        };

        // If we have a session, the email was confirmed successfully
        if (data.session) {
          console.log('Email confirmation successful!');

          // Ensure profiles row exists before redirecting
          await ensureProfile(data.session.user);

          setStatus('success');
          
          // For email confirmations, show success page instead of redirecting
          // Check if this is an email confirmation (vs OAuth)
          const isEmailConfirmation = urlParams.get('type') === 'signup' || hash.includes('type=signup');
          
          if (isEmailConfirmation) {
            navigate('/auth/confirmation-success', { replace: true });
          } else {
            // For OAuth, redirect to home
            setTimeout(() => {
              navigate('/home', { replace: true });
            }, 2000);
          }
        } else {
          // Try to exchange the code for a session
          const code = urlParams.get('code');
          if (code) {
            const { data: exchangeData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
            
            if (exchangeError) {
              console.error('Code exchange error:', exchangeError);
              setErrorMessage(exchangeError.message);
              setStatus('error');
              return;
            }
            
            if (exchangeData.session) {
              // Ensure profiles row exists for code-exchange flow too
              await ensureProfile(exchangeData.session.user);
              setStatus('success');
              setTimeout(() => {
                navigate('/home', { replace: true });
              }, 2000);
            }
          } else {
            setErrorMessage('No session or authorization code found');
            setStatus('error');
          }
        }
      } catch (error) {
        console.error('Auth callback error:', error);
        setErrorMessage(error instanceof Error ? error.message : 'An unexpected error occurred');
        setStatus('error');
      }
    };

    handleAuthCallback();
  }, [navigate]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Processing Authentication...
          </h2>
          <p className="text-gray-600">Please wait while we confirm your account.</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-6">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Authentication Error
          </h1>
          <p className="text-gray-600 mb-6">
            {errorMessage || 'There was an error processing your authentication.'}
          </p>
          <button
            onClick={() => navigate('/login')}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
          >
            Return to Login
          </button>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 bg-green-600 rounded-full mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Authentication Successful!
          </h2>
          <p className="text-gray-600">Redirecting you now...</p>
        </div>
      </div>
    );
  }

  return null;
};

export default AuthCallback;