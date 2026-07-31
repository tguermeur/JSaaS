import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

export const DEFAULT_STRUCTURE_PROGRAMS = ['Programme Grande École', 'Bachelor'] as const;

export interface StructureAcademicConfig {
  schoolName?: string;
  programs: string[];
  campuses: string[];
}

const normalizeStringList = (items: unknown): string[] => {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => {
      if (typeof item === 'string') return item.trim();
      if (item && typeof item === 'object' && 'name' in item) {
        return String((item as { name?: unknown }).name ?? '').trim();
      }
      return String(item ?? '').trim();
    })
    .filter(Boolean);
};

function programsRef(structureId: string) {
  return doc(db, 'programs', structureId);
}

export async function getStructureAcademicConfig(
  structureId: string
): Promise<StructureAcademicConfig> {
  const snap = await getDoc(programsRef(structureId));
  if (!snap.exists()) {
    return { programs: [], campuses: [] };
  }
  const data = snap.data();
  return {
    schoolName: typeof data.schoolName === 'string' ? data.schoolName : undefined,
    programs: normalizeStringList(data.programs),
    campuses: normalizeStringList(data.campuses),
  };
}

export async function ensureDefaultPrograms(
  structureId: string,
  schoolName?: string
): Promise<StructureAcademicConfig> {
  const snap = await getDoc(programsRef(structureId));
  if (!snap.exists()) {
    const payload: StructureAcademicConfig = {
      schoolName,
      programs: [...DEFAULT_STRUCTURE_PROGRAMS],
      campuses: [],
    };
    await setDoc(programsRef(structureId), payload);
    return payload;
  }

  const data = snap.data();
  const programs = normalizeStringList(data.programs);
  const campuses = normalizeStringList(data.campuses);

  if (programs.length === 0) {
    const updated: StructureAcademicConfig = {
      schoolName: typeof data.schoolName === 'string' ? data.schoolName : schoolName,
      programs: [...DEFAULT_STRUCTURE_PROGRAMS],
      campuses,
    };
    await updateDoc(programsRef(structureId), {
      programs: updated.programs,
      ...(updated.schoolName ? { schoolName: updated.schoolName } : {}),
    });
    return updated;
  }

  return {
    schoolName: typeof data.schoolName === 'string' ? data.schoolName : schoolName,
    programs,
    campuses,
  };
}

async function upsertListItem(
  structureId: string,
  field: 'programs' | 'campuses',
  value: string,
  schoolName?: string
): Promise<string[]> {
  const trimmed = value.trim();
  if (!trimmed) throw new Error('Le nom ne peut pas être vide');

  const snap = await getDoc(programsRef(structureId));
  if (!snap.exists()) {
    const base: StructureAcademicConfig = {
      schoolName,
      programs: field === 'programs' ? [...DEFAULT_STRUCTURE_PROGRAMS] : [],
      campuses: [],
    };
    if (field === 'programs' && !base.programs.includes(trimmed)) {
      base.programs = [...base.programs, trimmed];
    } else if (field === 'campuses') {
      base.campuses = [trimmed];
    }
    await setDoc(programsRef(structureId), base);
    return field === 'programs' ? base.programs : base.campuses;
  }

  const existing = normalizeStringList(snap.data()[field]);
  if (existing.some((item) => item.toLowerCase() === trimmed.toLowerCase())) {
    return existing;
  }

  const updated = [...existing, trimmed];
  await updateDoc(programsRef(structureId), { [field]: updated });
  return updated;
}

async function removeListItem(
  structureId: string,
  field: 'programs' | 'campuses',
  index: number
): Promise<string[]> {
  const snap = await getDoc(programsRef(structureId));
  if (!snap.exists()) return [];

  const existing = normalizeStringList(snap.data()[field]);
  const updated = existing.filter((_, i) => i !== index);
  await updateDoc(programsRef(structureId), { [field]: updated });
  return updated;
}

export async function addProgram(
  structureId: string,
  program: string,
  schoolName?: string
): Promise<string[]> {
  return upsertListItem(structureId, 'programs', program, schoolName);
}

export async function removeProgram(structureId: string, index: number): Promise<string[]> {
  return removeListItem(structureId, 'programs', index);
}

export async function addCampus(
  structureId: string,
  campus: string,
  schoolName?: string
): Promise<string[]> {
  return upsertListItem(structureId, 'campuses', campus, schoolName);
}

export async function removeCampus(structureId: string, index: number): Promise<string[]> {
  return removeListItem(structureId, 'campuses', index);
}
