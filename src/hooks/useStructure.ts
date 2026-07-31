import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { getDownloadURL, ref } from 'firebase/storage';
import { db, storage } from '../firebase/config';
import type { Structure } from '../types/structure';

type StructureCacheEntry = {
  data: Structure;
  expiresAt: number;
};

const STRUCTURE_CACHE_TTL_MS = 5 * 60 * 1000;
const structureCache = new Map<string, StructureCacheEntry>();
const structureInFlight = new Map<string, Promise<Structure | null>>();

async function resolveLogoUrl(logo: unknown): Promise<string | null> {
  if (!logo || typeof logo !== 'string') return null;
  if (logo.startsWith('http://') || logo.startsWith('https://')) return logo;
  if (!storage) return logo;
  try {
    return await getDownloadURL(ref(storage, logo));
  } catch {
    return null;
  }
}

export async function fetchStructureCached(structureId: string): Promise<Structure | null> {
  if (!structureId) return null;

  const cached = structureCache.get(structureId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const existing = structureInFlight.get(structureId);
  if (existing) return existing;

  const request = (async () => {
    const snap = await getDoc(doc(db, 'structures', structureId));
    if (!snap.exists()) return null;
    const raw = snap.data();
    const logoUrl = await resolveLogoUrl(raw.logo);
    const data: Structure = {
      id: snap.id,
      ...(raw as Omit<Structure, 'id'>),
      logo: logoUrl || (typeof raw.logo === 'string' ? raw.logo : undefined),
    };
    structureCache.set(structureId, {
      data,
      expiresAt: Date.now() + STRUCTURE_CACHE_TTL_MS,
    });
    return data;
  })();

  structureInFlight.set(structureId, request);
  try {
    return await request;
  } finally {
    structureInFlight.delete(structureId);
  }
}

export function invalidateStructureCache(structureId?: string): void {
  if (structureId) {
    structureCache.delete(structureId);
    return;
  }
  structureCache.clear();
}

/**
 * Cache partagé pour la structure courante (Sidebar / Navbar / pages).
 * Évite 2–3 getDoc(structures) redondants au mount de l'app.
 */
export function useStructure(structureId: string | null | undefined) {
  const [structure, setStructure] = useState<Structure | null>(() => {
    if (!structureId) return null;
    const cached = structureCache.get(structureId);
    return cached && cached.expiresAt > Date.now() ? cached.data : null;
  });
  const [loading, setLoading] = useState(Boolean(structureId) && !structure);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!structureId) {
      setStructure(null);
      setLoading(false);
      setError(null);
      return undefined;
    }

    const cached = structureCache.get(structureId);
    if (cached && cached.expiresAt > Date.now()) {
      setStructure(cached.data);
      setLoading(false);
      setError(null);
      return undefined;
    }

    setLoading(true);
    void fetchStructureCached(structureId)
      .then((data) => {
        if (cancelled) return;
        setStructure(data);
        setError(data ? null : 'Structure introuvable');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        console.error('Erreur useStructure:', err);
        setError(err instanceof Error ? err.message : 'Erreur de chargement');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [structureId]);

  return { structure, loading, error };
}
