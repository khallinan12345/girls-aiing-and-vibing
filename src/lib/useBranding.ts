/**
 * useBranding — shared branding hook for all certification pages.
 *
 * Resolves the correct organisation name, logo path, and PDF helpers
 * based on the signed-in user's profiles.organization_id and profiles.continent.
 *
 * Priority:
 *   1. NPower org                  → NPower branding
 *   2. 100 Black Girls in STEM org → Girls AI-ing branding
 *   3. Africa continent            → vAI branding
 *   4. Everyone else               → AIing & Vibing branding (default)
 *
 * Usage (in any certification page):
 *
 *   import { useBranding, addBrandingToPDF } from '../../lib/useBranding';
 *
 *   const { institutionName, logoPath, isReady } = useBranding();
 *
 *   // Inside generateCertificate():
 *   await addBrandingToPDF(doc, { pageWidth, pageHeight, footerY, branding });
 */

import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { useAuth } from '../hooks/useAuth';

// ─── Organisation constants ────────────────────────────────────────────────────

export const NPOWER_ORG_ID  = 'cd0fc311-2194-485f-b8f4-e3d69022fcde';
export const BGS100_ORG_ID  = 'c0b48eae-67af-449d-8c04-cc6950bf0982';

// ─── Branding types ────────────────────────────────────────────────────────────

export type BrandingVariant = 'npower' | 'girls-ai-ing' | 'vai' | 'default';

export interface Branding {
  /** Which variant is active — useful for conditional UI */
  variant: BrandingVariant;

  /** Human-readable organisation name for text on certificates and UI */
  institutionName: string;

  /**
   * Path to the organisation logo SVG served from /public.
   * Null for text-only variants (girls-ai-ing and default).
   */
  logoPath: string | null;

  /**
   * Tailwind colour for the brand name text (used in UI, e.g. Navbar).
   * e.g. 'text-purple-700', 'text-pink-600'
   */
  textColor: string;

  /** Whether the branding data has finished loading from Supabase */
  isReady: boolean;
}

// ─── Branding map ──────────────────────────────────────────────────────────────

const BRANDING_MAP: Record<BrandingVariant, Omit<Branding, 'isReady'>> = {
  npower: {
    variant: 'npower',
    institutionName: 'NPower',
    logoPath: '/npower-logo.svg',
    textColor: 'text-blue-700',
  },
  'girls-ai-ing': {
    variant: 'girls-ai-ing',
    institutionName: 'Girls AI-ing',
    logoPath: null,
    textColor: 'text-pink-600',
  },
  vai: {
    variant: 'vai',
    institutionName: 'vAI — Davidson AI Innovation Center',
    logoPath: '/vai-logo.svg',
    textColor: 'text-teal-600',
  },
  default: {
    variant: 'default',
    institutionName: 'AIing & Vibing',
    logoPath: null,
    textColor: 'text-purple-700',
  },
};

// ─── Resolve variant from profile data ────────────────────────────────────────

export const resolveVariant = (
  organizationId: string | null,
  continent: string | null,
): BrandingVariant => {
  if (organizationId === NPOWER_ORG_ID)  return 'npower';
  if (organizationId === BGS100_ORG_ID)  return 'girls-ai-ing';
  if (continent === 'Africa')            return 'vai';
  return 'default';
};

// ─── React hook ───────────────────────────────────────────────────────────────

export const useBranding = (): Branding => {
  const { user } = useAuth();
  const [variant, setVariant] = useState<BrandingVariant>('default');
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!user?.id) { setIsReady(true); return; }

    supabase
      .from('profiles')
      .select('organization_id, continent')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        setVariant(resolveVariant(
          data?.organization_id ?? null,
          data?.continent ?? null,
        ));
        setIsReady(true);
      })
      .catch(() => setIsReady(true)); // fall back to default on error
  }, [user?.id]);

  return { ...BRANDING_MAP[variant], isReady };
};

// ─── PDF helper ───────────────────────────────────────────────────────────────

interface PDFBrandingOptions {
  /** jsPDF doc instance */
  doc: any;
  /** Page width in mm */
  pageWidth: number;
  /** Page height in mm */
  pageHeight: number;
  /**
   * Y position for the institution name line in mm.
   * Typically pageHeight - 34.35 for landscape A4 certs.
   */
  footerY: number;
  /** Branding object from useBranding() */
  branding: Branding;
  /**
   * Font size for the institution name text.
   * Defaults to 28.
   */
  fontSize?: number;
  /**
   * RGB colour for the institution name text.
   * Defaults to [138, 43, 226] (purple).
   */
  textColor?: [number, number, number];
}

/**
 * Adds the organisation logo (if any) and institution name to a jsPDF document.
 * Call this inside generateCertificate() in place of the hardcoded Davidson text.
 *
 * Example:
 *   await addBrandingToPDF(doc, {
 *     pageWidth, pageHeight,
 *     footerY: pageHeight - 34.35,
 *     branding,
 *   });
 */
export const addBrandingToPDF = async (options: PDFBrandingOptions): Promise<void> => {
  const {
    doc,
    pageWidth,
    footerY,
    branding,
    fontSize = 28,
    textColor = [138, 43, 226],
  } = options;

  // ── Attempt to load and render the logo ──────────────────────────────────
  if (branding.logoPath) {
    try {
      const resp = await fetch(branding.logoPath);
      if (resp.ok) {
        const blob = await resp.blob();
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });

        // Logo dimensions: 50 mm wide, 17 mm tall — centred horizontally
        const logoW = 50;
        const logoH = 17;
        const logoX = (pageWidth - logoW) / 2;
        const logoY = footerY - logoH - 2; // 2 mm gap above text

        const ext = branding.logoPath.endsWith('.svg') ? 'SVG' : 'PNG';
        doc.addImage(base64, ext, logoX, logoY, logoW, logoH);
      }
    } catch (err) {
      // Logo load failure is non-fatal — institution text still renders below
      console.warn('[Certificate] Logo failed to load:', err);
    }
  }

  // ── Render institution name text ─────────────────────────────────────────
  doc.setFontSize(fontSize);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...textColor);
  doc.text(branding.institutionName, pageWidth / 2, footerY, { align: 'center' });
};
