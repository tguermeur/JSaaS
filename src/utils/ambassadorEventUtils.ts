import { MissionSlot } from '../types/mission';

export interface AmbassadorEventView {
  id: string;
  title?: string;
  numeroMission: string;
  location: string;
  publishedAt: Date | string;
  announcement?: string;
  description?: string;
  hoursPerStudent?: number;
  hours?: number;
  studentCount: number;
  startDate?: string;
  convertedMissionId?: string;
  slots: MissionSlot[];
  requiresCV?: boolean;
  requiresMotivation?: boolean;
  type: 'ambassadeur_event';
  locationCoordinates?: { lat: number; lng: number };
}

export function mapFirestoreToAmbassadorEvent(
  docId: string,
  d: Record<string, unknown>
): AmbassadorEventView {
  const slots = (d.slots as MissionSlot[]) || [];
  const capacity = slots.reduce((acc, s) => acc + (s.capacity || 0), 0);
  return {
    id: docId,
    title: (d.title as string) || (d.campaignName as string) || (d.description as string),
    numeroMission: `AMB-${docId.slice(-6)}`,
    location: (d.location as string) || 'À définir',
    publishedAt: d.startDate
      ? typeof d.startDate === 'string'
        ? d.startDate
        : (d.startDate as { toDate?: () => Date })?.toDate?.() || d.startDate
      : new Date(),
    announcement: d.description as string,
    description: d.description as string,
    hoursPerStudent: 0,
    hours: 0,
    studentCount: capacity || 1,
    startDate: d.startDate as string | undefined,
    convertedMissionId: d.convertedMissionId as string | undefined,
    slots,
    requiresCV: false,
    requiresMotivation: false,
    type: 'ambassadeur_event',
    locationCoordinates: d.locationCoordinates as { lat: number; lng: number } | undefined,
  };
}

export function parseSlotTime(value: unknown): Date {
  if (value instanceof Date) return value;
  if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate();
  }
  return new Date(value as string);
}

export function getSlotAvailableSpots(slot: MissionSlot): number {
  return Math.max(0, slot.capacity - (slot.assignedStudentIds?.length || 0));
}

export function isSlotAvailableForUser(slot: MissionSlot, userId: string): boolean {
  if (slot.assignedStudentIds?.includes(userId)) return false;
  return getSlotAvailableSpots(slot) > 0;
}

export function getUserRegisteredSlotIds(slots: MissionSlot[], userId: string): string[] {
  return slots.filter((s) => s.assignedStudentIds?.includes(userId)).map((s) => s.id);
}

export function sortSlotsByDate(slots: MissionSlot[]): MissionSlot[] {
  return [...slots].sort(
    (a, b) => parseSlotTime(a.startTime).getTime() - parseSlotTime(b.startTime).getTime()
  );
}
