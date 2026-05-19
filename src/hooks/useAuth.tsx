// src/hooks/useAuth.tsx - Fixed version that prevents profile completion loop
import React, { useState, useEffect, createContext, useContext, useCallback, useRef } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';

interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  grade_level?: number;
  country?: string;
  school_name?: string;
  avatar_url?: string;
  team_id?: string;
  profile_completed?: boolean;
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  user: UserProfile | null;
  session: Session | null;
  loading: boolean;
  needsProfileCompletion: boolean;
  markProfileCompleted: (userId: string) => Promise<void>;
  refreshUserProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsProfileCompletion, setNeedsProfileCompletion] = useState(false);
  
  // Add protection against race conditions
  const initializedRef = useRef(false);
  const fetchingRef = useRef(false);
  const profileConfirmedRef = useRef(false); // NEW: Track if profile was confirmed to exist

  const fetchUserProfile = async (userId: string) => {
    // Prevent multiple simultaneous fetches
    if (fetchingRef.current) {
      console.log('[Auth] Profile fetch already in progress, skipping');
      return null;
    }

    // If profile was already confirmed and user exists, don't re-fetch
    if (profileConfirmedRef.current && user?.id === userId) {
      console.log('[Auth] Profile already confirmed for this user, skipping fetch');
      return user;
    }

    try {
      fetchingRef.current = true;
      console.log('[Auth] fetchUserProfile for', userId);
      
      console.log('[Auth] Starting profile query with 5s timeout...');
      
      // Create timeout promise (5 seconds)
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Profile fetch timeout')), 12000)
      );
  
      // Create profile fetch promise
      const profilePromise = supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
  
      // Race them - whichever completes first wins
      const result = await Promise.race([profilePromise, timeoutPromise]);
      
      console.log('[Auth] Profile query completed:', result);
  
      if (result.error) {
        if (result.error.code === 'PGRST116' || result.error.message?.includes('No rows returned')) {
          console.log('[Auth] No profile found in database');
          profileConfirmedRef.current = false;
          return null;
        }
        console.error('[Auth] Error fetching profile:', result.error);
        return null;
      }
  
      console.log('[Auth] fetched profile:', result.data);
      profileConfirmedRef.current = true; // Mark profile as confirmed
      return result.data;
      
    } catch (error) {
      console.error('[Auth] Profile fetch failed:', error);
      
      // On timeout: never force popup — return a safe placeholder that marks profile_completed=true
      if (error.message === 'Profile fetch timeout') {
        console.warn('[Auth] Profile fetch timed out');
        
        if (user?.id === userId) {
          console.log('[Auth] Timeout but user exists in state — keeping existing state');
          return user;
        }
        
        // Return a safe placeholder so popup is never shown on timeout
        console.warn('[Auth] Timeout with no existing user — returning safe placeholder');
        return {
          id: userId,
          name: '',
          email: '',
          role: 'student',
          profile_completed: true, // Prevent popup on timeout
          created_at: '',
          updated_at: '',
        } as UserProfile;
      }
      
      return null;
    } finally {
      fetchingRef.current = false;
    }
  };

  const refreshUserProfile = useCallback(async () => {
    console.log('[Auth] refreshUserProfile start');
    if (!session?.user) {
      console.log('[Auth] no session user, skipping refresh');
      return;
    }
    
    try {
      // Direct fetch — bypass fetchUserProfile caching so we always get fresh DB state
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (error) {
        console.warn('[Auth] refreshUserProfile fetch error:', error.message);
        return;
      }

      if (profile) {
        setUser(profile);
        profileConfirmedRef.current = true;
        // Trust the DB value unconditionally
        const needsCompletion = profile.profile_completed === false;
        console.log('[Auth] refreshUserProfile — profile_completed:', profile.profile_completed, '→ needsCompletion:', needsCompletion);
        setNeedsProfileCompletion(needsCompletion);
      }
      console.log('[Auth] refreshUserProfile done');
    } catch (error) {
      console.error('[Auth] refreshUserProfile error:', error);
    }
  }, [session?.user?.id]);

  const markProfileCompleted = useCallback(async (userId: string) => {
    console.log('[Auth] markProfileCompleted for', userId);
    try {
      // Mark locally — do NOT call refreshUserProfile here.
      // refreshUserProfile causes a re-render that unmounts the popup
      // before the join-code modal or "Got it" button can be shown.
      // App.tsx's handleProfileCompletion will navigate after onComplete fires.
      setNeedsProfileCompletion(false);
      profileConfirmedRef.current = true;
      console.log('[Auth] profile completion marked locally');

      // Refresh in background without awaiting — state will update after navigation
      refreshUserProfile().catch(err =>
        console.warn('[Auth] background refresh after markProfileCompleted failed:', err)
      );
    } catch (error) {
      console.error('[Auth] markProfileCompleted exception:', error);
      throw error;
    }
  }, [refreshUserProfile]);

  // Main initialization effect - runs once
  useEffect(() => {
    if (initializedRef.current) {
      console.log('[Auth] Already initialized, skipping');
      return;
    }

    initializedRef.current = true;
    console.log('[Auth] initAuth start');

    // Set a maximum timeout to ensure loading always resolves
    const timeoutId = setTimeout(() => {
      console.log('[Auth] TIMEOUT - forcing loading to false');
      setLoading(false);
    }, 8000); // Increased timeout

    const initAuth = async () => {
      try {
        console.log('[Auth] Getting session...');
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        console.log('[Auth] got session:', !!currentSession);
        
        setSession(currentSession);
        
        if (currentSession?.user) {
          console.log('[Auth] Session user found, checking for profile...');
          
          try {
            const profile = await fetchUserProfile(currentSession.user.id);
            
            if (profile) {
              console.log('[Auth] Profile found, setting user state');
              setUser(profile);
              // Only show popup if profile_completed is explicitly false
              setNeedsProfileCompletion(profile.profile_completed === false);
              profileConfirmedRef.current = true;
            } else {
              console.log('[Auth] No profile row found — new user, show completion popup');
              const minimalUser: UserProfile = {
                id: currentSession.user.id,
                name: '',
                email: currentSession.user.email || '',
                role: 'student',
                created_at: currentSession.user.created_at || '',
                updated_at: currentSession.user.created_at || '',
              };
              setUser(minimalUser);
              setNeedsProfileCompletion(true);
              profileConfirmedRef.current = false;
            }
          } catch (profileError) {
            console.error('[Auth] Error fetching profile — NOT showing popup to avoid false positive:', profileError);
            // Fetch error ≠ missing profile. Don't show popup — wait for next refresh.
            setUser(null);
            setNeedsProfileCompletion(false);
            profileConfirmedRef.current = false;
          }
        } else {
          console.log('[Auth] no session, user not logged in');
          setUser(null);
          setNeedsProfileCompletion(false);
          profileConfirmedRef.current = false;
        }
        
      } catch (error) {
        console.error('[Auth] initAuth error:', error);
        // Even on error, clear user state
        setUser(null);
        setNeedsProfileCompletion(false);
        profileConfirmedRef.current = false;
      } finally {
        // ALWAYS clear timeout and set loading to false
        clearTimeout(timeoutId);
        console.log('[Auth] Setting loading to false...');
        setLoading(false);
        console.log('[Auth] initAuth done - loading set to false');
      }
    };

    initAuth();

    return () => {
      clearTimeout(timeoutId);
    };
  }, []); // Remove fetchUserProfile dependency to prevent loops

  // Auth state change listener
  useEffect(() => {
    if (!initializedRef.current) return;

    console.log('[Auth] Setting up auth state listener');
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      console.log('[Auth] onAuthStateChange:', event, !!newSession);
      
      if (event === 'INITIAL_SESSION') {
        console.log('[Auth] skipping INITIAL_SESSION');
        return;
      }
      
      setSession(newSession);
      
      if (event === 'SIGNED_IN' && newSession?.user) {
        console.log('[Auth] user signed in, checking for profile');
        
        // CRITICAL FIX: Don't re-fetch if profile already confirmed for this user
        if (profileConfirmedRef.current && user?.id === newSession.user.id) {
          console.log('[Auth] Profile already confirmed for this user, skipping fetch');
          return;
        }
        
        const profile = await fetchUserProfile(newSession.user.id);
        
        if (profile) {
          setUser(profile);
          // Only show popup if profile_completed is explicitly false
          setNeedsProfileCompletion(profile.profile_completed === false);
          profileConfirmedRef.current = true;
        } else if (!profileConfirmedRef.current) {
          // Only set needs completion if profile was never confirmed
          console.log('[Auth] Signed in user has no profile - needs completion');
          const minimalUser: UserProfile = {
            id: newSession.user.id,
            name: '',
            email: newSession.user.email || '',
            role: 'student',
            created_at: newSession.user.created_at || '',
            updated_at: newSession.user.created_at || '',
          };
          setUser(minimalUser);
          setNeedsProfileCompletion(true);
        }
      } else if (event === 'SIGNED_OUT') {
        console.log('[Auth] user signed out');
        setUser(null);
        setNeedsProfileCompletion(false);
        profileConfirmedRef.current = false; // Reset on sign out
      }
    });

    return () => {
      console.log('[Auth] Cleaning up auth listener');
      subscription.unsubscribe();
    };
  }, [user?.id]); // Only depend on user.id to prevent unnecessary re-runs

  return (
    <AuthContext.Provider value={{
      user,
      session,
      loading,
      needsProfileCompletion,
      markProfileCompleted,
      refreshUserProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;