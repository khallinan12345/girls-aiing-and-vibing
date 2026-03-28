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

        // If we have a session, the email was confirmed successfully
        if (data.session) {
          console.log('Email confirmation successful!');
          setStatus('success');
          
          // For email confirmations, show success page instead of redirecting
          // Check if this is an email confirmation (vs OAuth)
          const isEmailConfirmation = urlParams.get('type') === 'signup' || hash.includes('type=signup');
          
          if (isEmailConfirmation) {
            // Redirect to success page
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