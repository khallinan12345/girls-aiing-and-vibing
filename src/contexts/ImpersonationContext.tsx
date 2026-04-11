// src/contexts/ImpersonationContext.tsx
//
// Allows a platform_administrator to "act as" any learner without
// creating a new auth session. The impersonated user's ID and profile
// are stored here and can be read by any page via useImpersonation().
//
// When active:
//   - A red banner is shown at the top of every page
//   - useImpersonation().effectiveUserId returns the impersonated user's ID
//   - useImpersonation().effectiveProfile returns their profile
//   - Pages that fetch data by user ID should use effectiveUserId

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

interface ImpersonatedProfile {
  id: string;
  name: string | null;
  email: string | null;
  role: string | null;
  city: string | null;
  continent: string | null;
  country: string | null;
  grade_level: number | null;
  organization_id: string | null;
  ai_playground_model: string | null;
}

interface ImpersonationContextValue {
  isImpersonating: boolean;
  impersonatedProfile: ImpersonatedProfile | null;
  startImpersonation: (userId: string) => Promise<void>;
  stopImpersonation: () => void;
  // Convenience: returns impersonated id when active, otherwise the real userId
  effectiveUserId: (realUserId: string) => string;
  effectiveProfile: <T>(realProfile: T) => T | ImpersonatedProfile;
}

const ImpersonationContext = createContext<ImpersonationContextValue>({
  isImpersonating: false,
  impersonatedProfile: null,
  startImpersonation: async () => {},
  stopImpersonation: () => {},
  effectiveUserId: (id) => id,
  effectiveProfile: (p) => p,
});

const STORAGE_KEY = 'impersonated_user_id';

export const ImpersonationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [impersonatedProfile, setImpersonatedProfile] = useState<ImpersonatedProfile | null>(null);

  // Restore from sessionStorage on mount (survives page refresh within session)
  useEffect(() => {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) {
      supabase
        .from('profiles')
        .select('id, name, email, role, city, continent, country, grade_level, organization_id, ai_playground_model')
        .eq('id', stored)
        .single()
        .then(({ data }) => {
          if (data) setImpersonatedProfile(data as ImpersonatedProfile);
          else sessionStorage.removeItem(STORAGE_KEY);
        });
    }
  }, []);

  const startImpersonation = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, email, role, city, continent, country, grade_level, organization_id, ai_playground_model')
      .eq('id', userId)
      .single();
    if (error || !data) throw new Error('Could not load learner profile');
    setImpersonatedProfile(data as ImpersonatedProfile);
    sessionStorage.setItem(STORAGE_KEY, userId);
  }, []);

  const stopImpersonation = useCallback(() => {
    setImpersonatedProfile(null);
    sessionStorage.removeItem(STORAGE_KEY);
  }, []);

  const effectiveUserId = useCallback((realUserId: string) => {
    return impersonatedProfile ? impersonatedProfile.id : realUserId;
  }, [impersonatedProfile]);

  const effectiveProfile = useCallback(<T,>(realProfile: T) => {
    return impersonatedProfile ? impersonatedProfile as unknown as T : realProfile;
  }, [impersonatedProfile]);

  return (
    <ImpersonationContext.Provider value={{
      isImpersonating: !!impersonatedProfile,
      impersonatedProfile,
      startImpersonation,
      stopImpersonation,
      effectiveUserId,
      effectiveProfile,
    }}>
      {children}
    </ImpersonationContext.Provider>
  );
};

export const useImpersonation = () => useContext(ImpersonationContext);

// ─── ImpersonationBanner ──────────────────────────────────────────────────────
// Renders a sticky red banner at the top when impersonating.
// Drop this inside AppLayout so it appears on every page.

export const ImpersonationBanner: React.FC = () => {
  const { isImpersonating, impersonatedProfile, stopImpersonation } = useImpersonation();
  if (!isImpersonating || !impersonatedProfile) return null;

  return (
    <div style={{
      position: 'fixed',
      top: '12px',
      right: '16px',
      zIndex: 9999,
      background: '#dc2626',
      color: '#fff',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      padding: '6px 10px 6px 14px',
      fontSize: '12px',
      fontWeight: 600,
      borderRadius: '999px',
      boxShadow: '0 2px 12px rgba(0,0,0,0.35)',
      maxWidth: '320px',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
    }}>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
        👁 {impersonatedProfile.name || impersonatedProfile.email || impersonatedProfile.id}
      </span>
      <button
        onClick={stopImpersonation}
        title="Exit impersonation"
        style={{
          flexShrink: 0,
          background: 'rgba(255,255,255,0.25)',
          border: 'none',
          borderRadius: '999px',
          color: '#fff',
          width: '22px',
          height: '22px',
          cursor: 'pointer',
          fontSize: '11px',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          lineHeight: 1,
        }}
      >
        ✕
      </button>
    </div>
  );
};