import React, { useState, useEffect, useMemo, useRef } from 'react';
import { format, addMinutes, differenceInMinutes, isSameDay, addDays, startOfDay, setHours, setMinutes, isWithinInterval, isValid } from 'date-fns';
import { fr } from 'date-fns/locale';
import { v4 as uuidv4 } from 'uuid';
import { MissionSlot } from '../../types/mission';
import { Delete as DeleteIcon, Add as AddIcon, ArrowBackIos as ArrowBackIcon, ArrowForwardIos as ArrowForwardIcon, AccessTime as AccessTimeIcon, Person as PersonIcon } from '@mui/icons-material';

const appleFont = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

interface StaffingPlannerProps {
  startDateTime: string;
  endDateTime: string;
  slots: MissionSlot[];
  onSlotsChange: (slots: MissionSlot[]) => void;
  defaultCapacity?: number;
}

export const StaffingPlanner: React.FC<StaffingPlannerProps> = ({
  startDateTime,
  endDateTime,
  slots,
  onSlotsChange,
  defaultCapacity = 1
}) => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date(startDateTime));
  const [hoveredTime, setHoveredTime] = useState<Date | null>(null);
  
  // Configuration de la grille
  const START_HOUR = 6; // 6h du matin
  const END_HOUR = 23; // 23h
  const QUARTER_HEIGHT = 16; // Hauteur d'un quart d'heure en pixels
  const HOUR_HEIGHT = QUARTER_HEIGHT * 4;

  // Initialisation de la date sélectionnée
  useEffect(() => {
    if (startDateTime) {
      const start = new Date(startDateTime);
      // Si la date sélectionnée est hors limites, on remet au début
      if (selectedDate < start || (endDateTime && selectedDate > new Date(endDateTime))) {
        setSelectedDate(start);
      }
    }
  }, [startDateTime, endDateTime]);

  // Calcul des jours de l'événement
  const eventDays = useMemo(() => {
    if (!startDateTime || !endDateTime) return [];
    const start = new Date(startDateTime);
    const end = new Date(endDateTime);
    const days: Date[] = [];
    let current = startOfDay(start);
    const lastDay = startOfDay(end);

    while (current <= lastDay) {
      days.push(new Date(current));
      current = addDays(current, 1);
    }
    return days;
  }, [startDateTime, endDateTime]);

  // Filtrer les slots du jour sélectionné
  const daySlots = useMemo(() => {
    return slots.filter(slot => {
      const slotStart = slot.startTime instanceof Date ? slot.startTime : new Date(slot.startTime);
      return isSameDay(slotStart, selectedDate);
    });
  }, [slots, selectedDate]);

  // Gestion de la navigation entre les jours
  const handlePrevDay = () => {
    const currentIndex = eventDays.findIndex(d => isSameDay(d, selectedDate));
    if (currentIndex > 0) {
      setSelectedDate(eventDays[currentIndex - 1]);
    }
  };

  const handleNextDay = () => {
    const currentIndex = eventDays.findIndex(d => isSameDay(d, selectedDate));
    if (currentIndex < eventDays.length - 1) {
      setSelectedDate(eventDays[currentIndex + 1]);
    }
  };

  // Création d'un slot
  const handleCreateSlot = (hour: number, minute: number) => {
    const newStart = setMinutes(setHours(new Date(selectedDate), hour), minute);
    // Par défaut, durée de 4 heures ou jusqu'à la fin de la journée
    let newEnd = addMinutes(newStart, 4 * 60);
    
    // Si ça dépasse END_HOUR, on coupe
    const maxEnd = setMinutes(setHours(new Date(selectedDate), END_HOUR), 0);
    if (newEnd > maxEnd) newEnd = maxEnd;

    const newSlot: MissionSlot = {
      id: uuidv4(),
      startTime: newStart,
      endTime: newEnd,
      capacity: defaultCapacity,
      assignedStudentIds: [],
      contractStatus: 'pending',
      billingStatus: 'pending',
      details: 'Nouveau créneau'
    };

    onSlotsChange([...slots, newSlot]);
  };

  // Suppression d'un slot
  const handleDeleteSlot = (slotId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onSlotsChange(slots.filter(s => s.id !== slotId));
  };

  // Mise à jour d'un slot (ex: capacité)
  const handleUpdateSlot = (slotId: string, updates: Partial<MissionSlot>) => {
    onSlotsChange(slots.map(s => s.id === slotId ? { ...s, ...updates } : s));
  };

  // Helpers pour l'affichage
  const getSlotStyle = (slot: MissionSlot) => {
    const start = slot.startTime instanceof Date ? slot.startTime : new Date(slot.startTime);
    const end = slot.endTime instanceof Date ? slot.endTime : new Date(slot.endTime);
    
    // Calcul de la position et hauteur
    const startMinutes = start.getHours() * 60 + start.getMinutes();
    const endMinutes = end.getHours() * 60 + end.getMinutes();
    const gridStartMinutes = START_HOUR * 60;

    const top = ((startMinutes - gridStartMinutes) / 15) * QUARTER_HEIGHT;
    const height = ((endMinutes - startMinutes) / 15) * QUARTER_HEIGHT;

    return {
      top: `${top}px`,
      height: `${Math.max(height, QUARTER_HEIGHT)}px`,
    };
  };

  // Génération des marqueurs d'heures
  const hours = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);

  if (!isValid(selectedDate) || eventDays.length === 0) {
    return (
      <div style={{
        padding: '32px',
        textAlign: 'center',
        color: '#6b7280',
        backgroundColor: '#f9fafb',
        borderRadius: '24px',
        border: '1px solid #e5e7eb',
        fontFamily: appleFont
      }}>
        Veuillez définir les dates de début et de fin de l'événement pour accéder au planning.
      </div>
    );
  }

  return (
    <div style={{
      backgroundColor: 'white',
      borderRadius: '24px',
      border: '1px solid #f3f4f6',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Header Navigation Jours */}
      <div style={{
        padding: '16px 24px',
        borderBottom: '1px solid #e5e7eb',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#f9fafb'
      }}>
        <button
          type="button"
          onClick={handlePrevDay}
          disabled={eventDays.findIndex(d => isSameDay(d, selectedDate)) <= 0}
          style={{
            padding: '8px 12px',
            border: 'none',
            background: 'transparent',
            cursor: eventDays.findIndex(d => isSameDay(d, selectedDate)) <= 0 ? 'not-allowed' : 'pointer',
            opacity: eventDays.findIndex(d => isSameDay(d, selectedDate)) <= 0 ? 0.3 : 1,
            color: '#2563eb'
          }}
        >
          <ArrowBackIcon sx={{ fontSize: 20 }} />
        </button>

        <div style={{ textAlign: 'center' }}>
          <h3 style={{
            margin: 0,
            fontSize: '16px',
            fontWeight: 600,
            color: '#111827',
            fontFamily: appleFont
          }}>
            {format(selectedDate, 'EEEE d MMMM yyyy', { locale: fr })}
          </h3>
          <p style={{
            margin: '4px 0 0',
            fontSize: '13px',
            color: '#6b7280',
            fontFamily: appleFont
          }}>
            Jour {eventDays.findIndex(d => isSameDay(d, selectedDate)) + 1} sur {eventDays.length}
          </p>
        </div>

        <button
          type="button"
          onClick={handleNextDay}
          disabled={eventDays.findIndex(d => isSameDay(d, selectedDate)) >= eventDays.length - 1}
          style={{
            padding: '8px 12px',
            border: 'none',
            background: 'transparent',
            cursor: eventDays.findIndex(d => isSameDay(d, selectedDate)) >= eventDays.length - 1 ? 'not-allowed' : 'pointer',
            opacity: eventDays.findIndex(d => isSameDay(d, selectedDate)) >= eventDays.length - 1 ? 0.3 : 1,
            color: '#2563eb'
          }}
        >
          <ArrowForwardIcon sx={{ fontSize: 20 }} />
        </button>
      </div>

      {/* Corps du Planning */}
      <div style={{ 
        display: 'flex', 
        height: '600px', // Hauteur fixe avec scroll
        overflowY: 'auto',
        position: 'relative',
        backgroundColor: '#fff'
      }}>
        {/* Colonne des heures */}
        <div style={{
          width: '60px',
          flexShrink: 0,
          borderRight: '1px solid #e5e7eb',
          backgroundColor: '#fafafa',
          position: 'sticky',
          left: 0,
          zIndex: 10
        }}>
          {hours.map(hour => (
            <div key={hour} style={{
              height: `${HOUR_HEIGHT}px`,
              borderBottom: '1px solid #f3f4f6',
              position: 'relative'
            }}>
              <span style={{
                position: 'absolute',
                top: '-10px',
                right: '8px',
                fontSize: '11px',
                color: '#9ca3af',
                fontFamily: appleFont,
                fontWeight: 500,
                backgroundColor: '#fafafa',
                padding: '0 4px'
              }}>
                {hour}:00
              </span>
            </div>
          ))}
        </div>

        {/* Grille principale */}
        <div style={{
          flex: 1,
          position: 'relative',
          minWidth: '300px'
        }}>
          {/* Lignes de grille (quarts d'heure) */}
          {hours.map(hour => (
            <div key={hour} style={{ height: `${HOUR_HEIGHT}px`, position: 'relative' }}>
              {/* Ligne de l'heure pile */}
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '1px',
                backgroundColor: '#e5e7eb',
                zIndex: 1
              }} />
              {/* Quarts d'heure (lignes légères) */}
              {[15, 30, 45].map((min, idx) => (
                <div key={min} 
                  onClick={() => handleCreateSlot(hour, min)}
                  style={{
                    position: 'absolute',
                    top: `${(idx + 1) * QUARTER_HEIGHT}px`,
                    left: 0,
                    right: 0,
                    height: '1px',
                    backgroundColor: min === 30 ? '#f3f4f6' : 'transparent', // Demi-heure un peu plus visible
                    borderTop: '1px dotted #f3f4f6',
                    zIndex: 0,
                    cursor: 'pointer'
                  }} 
                  title={`Ajouter un créneau à ${hour}:${min}`}
                />
              ))}
              {/* Zone clickable pour l'heure pile */}
              <div 
                onClick={() => handleCreateSlot(hour, 0)}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: `${QUARTER_HEIGHT}px`,
                  zIndex: 2,
                  cursor: 'pointer'
                }}
                title={`Ajouter un créneau à ${hour}:00`}
              />
            </div>
          ))}

          {/* Slots existants */}
          {daySlots.map(slot => {
            const style = getSlotStyle(slot);
            return (
              <div
                key={slot.id}
                style={{
                  position: 'absolute',
                  left: '10px',
                  right: '10px',
                  backgroundColor: 'rgba(37, 99, 235, 0.1)',
                  borderLeft: '4px solid #2563eb',
                  borderRadius: '4px',
                  padding: '4px 8px',
                  zIndex: 20,
                  cursor: 'pointer',
                  overflow: 'hidden',
                  transition: 'all 0.2s',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  ...style
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(37, 99, 235, 0.15)';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(37, 99, 235, 0.1)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '6px',
                    marginBottom: '2px'
                  }}>
                    <span style={{
                      fontSize: '12px',
                      fontWeight: 700,
                      color: '#1e40af',
                      fontFamily: appleFont
                    }}>
                      {format(slot.startTime instanceof Date ? slot.startTime : new Date(slot.startTime), 'HH:mm')} - {format(slot.endTime instanceof Date ? slot.endTime : new Date(slot.endTime), 'HH:mm')}
                    </span>
                  </div>
                  
                  {/* Édition rapide du nombre de personnes */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }} onClick={e => e.stopPropagation()}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      backgroundColor: 'white',
                      borderRadius: '12px',
                      padding: '2px 8px',
                      border: '1px solid #bfdbfe'
                    }}>
                      <PersonIcon sx={{ fontSize: 14, color: '#2563eb', marginRight: '4px' }} />
                      <input
                        type="number"
                        min="1"
                        value={slot.capacity}
                        onChange={(e) => handleUpdateSlot(slot.id, { capacity: parseInt(e.target.value) || 1 })}
                        style={{
                          width: '40px',
                          border: 'none',
                          fontSize: '12px',
                          fontWeight: 600,
                          color: '#1e3a8a',
                          outline: 'none',
                          background: 'transparent'
                        }}
                      />
                      <span style={{ fontSize: '11px', color: '#60a5fa' }}>pers.</span>
                    </div>

                    {/* Édition rapide de l'heure de fin */}
                     <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      backgroundColor: 'white',
                      borderRadius: '12px',
                      padding: '2px 8px',
                      border: '1px solid #e5e7eb'
                    }}>
                      <AccessTimeIcon sx={{ fontSize: 14, color: '#6b7280', marginRight: '4px' }} />
                      <select 
                        value={format(slot.endTime instanceof Date ? slot.endTime : new Date(slot.endTime), 'HH:mm')}
                        onChange={(e) => {
                          const [hours, mins] = e.target.value.split(':').map(Number);
                          const newEnd = setMinutes(setHours(slot.endTime instanceof Date ? slot.endTime : new Date(slot.endTime), hours), mins);
                          handleUpdateSlot(slot.id, { endTime: newEnd });
                        }}
                        style={{
                          border: 'none',
                          fontSize: '11px',
                          color: '#4b5563',
                          outline: 'none',
                          background: 'transparent',
                          cursor: 'pointer'
                        }}
                      >
                         {/* Générer les options de fin possibles */}
                         {Array.from({ length: (END_HOUR - START_HOUR) * 4 }).map((_, i) => {
                            const minutes = i * 15;
                            const h = START_HOUR + Math.floor(minutes / 60);
                            const m = minutes % 60;
                            const timeStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
                            // On ne peut finir qu'après le début
                            const start = slot.startTime instanceof Date ? slot.startTime : new Date(slot.startTime);
                            const current = setMinutes(setHours(start, h), m);
                            if (current > start) {
                                return <option key={timeStr} value={timeStr}>{timeStr}</option>;
                            }
                            return null;
                         })}
                      </select>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(e) => handleDeleteSlot(slot.id, e)}
                  style={{
                    padding: '4px',
                    borderRadius: '50%',
                    backgroundColor: 'white',
                    border: '1px solid #fecaca',
                    color: '#ef4444',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#fee2e2';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'white';
                  }}
                >
                  <DeleteIcon sx={{ fontSize: 14 }} />
                </button>
              </div>
            );
          })}
        </div>
      </div>
      
      <div style={{ 
        padding: '12px 24px', 
        backgroundColor: '#f9fafb', 
        borderTop: '1px solid #e5e7eb',
        fontSize: '12px',
        color: '#6b7280',
        fontFamily: appleFont,
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#2563eb' }}></div>
        Cliquez sur une ligne horaire pour ajouter un créneau. Ajustez ensuite la durée et le nombre de personnes.
      </div>
    </div>
  );
};
