import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { Github, Mail } from 'lucide-react';

interface AuthFormProps {
  mode: 'login' | 'signup';
}

const AuthForm: React.FC<AuthFormProps> = ({ mode }) => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (mode === 'signup') {
        console.log('Attempting signup with:', { email, username });
        
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              username,
              role: 'student', // Default role for new users
            }
          }
        });

        console.log('Signup response:', { data, error: signUpError });

        if (signUpError) {
          console.error('Signup error:', signUpError);
          throw signUpError;
        }
        
        // Don't create profile immediately - wait for email confirmation
        // The profile will be created via a database trigger or in the confirmation flow
        console.log('User signed up successfully, awaiting email confirmation');
        
        // Navigate to confirmation page
        navigate('/auth/confirmation');
      } else {
        // Login
        console.log('Attempting login with:', { email });
        
        const { data: loginData, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        
        console.log('Login result:', { data: loginData, error: signInError });
        
        if (signInError) {
          console.error('Login error:', signInError);
          throw signInError;
        }

        console.log('Login successful, navigating to home...');
        
        // Navigate to home on successful login
        navigate('/home');
      }
    } catch (error: any) {
      console.error('Authentication error:', error);
      
      // Better error handling
      let errorMessage = 'An unexpected error occurred';
      
      if (error?.message) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error?.error_description) {
        errorMessage = error.error_description;
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthLogin = async (provider: 'google' | 'github') => {
    try {
      setError('');
      console.log('Attempting OAuth login with:', provider);
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`
        }
      });
      
      if (error) {
        console.error('OAuth error:', error);
        throw error;
      }
    } catch (error: any) {
      console.error('OAuth error:', error);
      setError(error?.message || 'OAuth login failed');
    }
  };

  const handleMagicLink = async () => {
    try {
      setLoading(true);
      setError('');
      
      console.log('Sending magic link to:', email);
      
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`
        }
      });
      
      if (error) {
        console.error('Magic link error:', error);
        throw error;
      }
      
      setMagicLinkSent(true);
    } catch (error: any) {
      console.error('Magic link error:', error);
      setError(error?.message || 'Failed to send magic link');
    } finally {
      setLoading(false);
    }
  };

  if (magicLinkSent) {
    return (
      <div className="text-center">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Check your email</h3>
        <p className="text-gray-600 mb-4">
          We've sent you a magic link to {email}.<br />
          Click the link in the email to sign in.
        </p>
        <Button
          variant="outline"
          onClick={() => setMagicLinkSent(false)}
        >
          Try another method
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-md w-full space-y-8">
      <div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          {mode === 'login' ? 'Sign in to your account' : 'Create a new account'}
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          {mode === 'login' ? (
            <>
              Or{' '}
              <a 
                href="/signup" 
                className="font-medium text-blue-600 hover:text-blue-500"
                onClick={(e) => {
                  e.preventDefault();
                  navigate('/signup');
                }}
              >
                create a new account
              </a>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <a 
                href="/login" 
                className="font-medium text-blue-600 hover:text-blue-500"
                onClick={(e) => {
                  e.preventDefault();
                  navigate('/login');
                }}
              >
                Sign in
              </a>
            </>
          )}
        </p>
      </div>
      
      {error && (
        <div className="bg-red-50 text-red-800 p-4 rounded-md text-sm">
          <strong>Error:</strong> {error}
        </div>
      )}
      
      <form className="mt-8 space-y-6" onSubmit={handleAuth}>
        {mode === 'signup' && (
          <Input
            label="Username"
            id="username"
            name="username"
            type="text"
            autoComplete="username"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            fullWidth
          />
        )}
        
        <Input
          label="Email address"
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          fullWidth
        />
        
        <Input
          label="Password"
          id="password"
          name="password"
          type="password"
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          fullWidth
        />
        
        <div>
          <Button
            type="submit"
            fullWidth
            isLoading={loading}
            size="lg"
          >
            {mode === 'login' ? 'Sign in' : 'Sign up'}
          </Button>
        </div>
      </form>

      <div className="mt-6">
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-gray-500">Or continue with</span>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOAuthLogin('google')}
            fullWidth
          >
            Google
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOAuthLogin('github')}
            icon={<Github size={16} />}
            fullWidth
          >
            GitHub
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleMagicLink}
            icon={<Mail size={16} />}
            fullWidth
          >
            Email Link
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AuthForm;