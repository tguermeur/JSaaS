import { describe, it, expect } from 'vitest';
import { canAccessStructureContent, canAccessStudentContent } from './permissions';

describe('permissions', () => {
  it('autorise les membres structure sur le contenu structure', () => {
    expect(canAccessStructureContent('membre')).toBe(true);
    expect(canAccessStructureContent('admin_structure')).toBe(true);
    expect(canAccessStructureContent('etudiant')).toBe(false);
  });

  it('autorise les étudiants sur le contenu étudiant', () => {
    expect(canAccessStudentContent('etudiant')).toBe(true);
    expect(canAccessStudentContent('entreprise')).toBe(false);
  });
});
