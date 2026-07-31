import { useEffect, useState } from 'react';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';

interface AmbassadorBranding {
  logoUrl: string | null;
  logoLargeUrl: string | null;
  loading: boolean;
}

async function loadCompanyLogos(companyId: string): Promise<{ logo: string | null; logoLarge: string | null }> {
  const companyDoc = await getDoc(doc(db, 'companies', companyId));
  if (!companyDoc.exists()) {
    return { logo: null, logoLarge: null };
  }
  const data = companyDoc.data();
  return {
    logo: (data.logo as string | undefined) || null,
    logoLarge: (data.logoLarge as string | undefined) || null,
  };
}

export function useAmbassadorBranding(
  structureId: string | undefined,
  companyId?: string | undefined
): AmbassadorBranding {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoLargeUrl, setLogoLargeUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!structureId && !companyId) {
      setLogoUrl(null);
      setLogoLargeUrl(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    if (companyId) {
      setLoading(true);
      const unsubscribe = onSnapshot(
        doc(db, 'companies', companyId),
        (companyDoc) => {
          if (cancelled) return;
          if (!companyDoc.exists()) {
            setLogoUrl(null);
            setLogoLargeUrl(null);
          } else {
            const data = companyDoc.data();
            setLogoUrl((data.logo as string | undefined) || null);
            setLogoLargeUrl((data.logoLarge as string | undefined) || null);
          }
          setLoading(false);
        },
        (err) => {
          console.error('Erreur chargement branding entreprise:', err);
          if (!cancelled) {
            setLogoUrl(null);
            setLogoLargeUrl(null);
            setLoading(false);
          }
        }
      );
      return () => {
        cancelled = true;
        unsubscribe();
      };
    }

    const load = async () => {
      try {
        setLoading(true);

        const structureDoc = await getDoc(doc(db, 'structures', structureId!));
        const structureLogo = structureDoc.exists() ? (structureDoc.data().logo as string | undefined) : undefined;

        if (structureLogo) {
          if (!cancelled) {
            setLogoUrl(structureLogo);
            setLogoLargeUrl(null);
          }
          return;
        }

        const settingsDoc = await getDoc(doc(db, 'ambassadorSettings', structureId!));
        const settingsCompanyId = settingsDoc.exists()
          ? (settingsDoc.data().companyId as string | undefined)
          : undefined;

        if (settingsCompanyId) {
          const { logo, logoLarge } = await loadCompanyLogos(settingsCompanyId);
          if (!cancelled) {
            setLogoUrl(logo);
            setLogoLargeUrl(logoLarge);
          }
        } else if (!cancelled) {
          setLogoUrl(null);
          setLogoLargeUrl(null);
        }
      } catch (err) {
        console.error('Erreur chargement branding ambassadeur:', err);
        if (!cancelled) {
          setLogoUrl(null);
          setLogoLargeUrl(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [structureId, companyId]);

  return { logoUrl, logoLargeUrl, loading };
}
