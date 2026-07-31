import React, { useState, useEffect, useCallback } from 'react';
import { addMission } from '../../services/missionService';
import { updateDoc, doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { GooglePlacesAutocomplete } from './GooglePlacesAutocomplete';
import { CalendarToday as CalendarIcon, AccessTime as AccessTimeIcon, Add as AddIcon, Delete as DeleteIcon, ExpandMore as ExpandMoreIcon, ExpandLess as ExpandLessIcon } from '@mui/icons-material';
import { Mission } from '../../types/mission';

const appleFont = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

interface LocationData {
  address: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
}

interface DayBreak {
  start: string;
  end: string;
}

interface DaySchedule {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  breaks: DayBreak[];
}

interface AmbassadorEventFormProps {
  initialEvent?: Mission;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export const AmbassadorEventForm: React.FC<AmbassadorEventFormProps> = ({
  initialEvent,
  onSuccess,
  onCancel
}) => {
  const { currentUser, userData, isContactWithAccess, contactPermissions } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  
  // Form fields
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState<LocationData>({ address: '' });
  const [requiredPeople, setRequiredPeople] = useState(1);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [daySchedules, setDaySchedules] = useState<DaySchedule[]>([]);
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  const [isInitializing, setIsInitializing] = useState(true);

  // Générer automatiquement les jours à partir de la période
  useEffect(() => {
    // Ne pas générer pendant l'initialisation
    if (isInitializing) return;
    
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      if (start > end) {
        // Date de fin avant date de début, ne rien faire
        return;
      }
      
      // Générer tous les jours entre startDate et endDate
      setDaySchedules(prevSchedules => {
        const days: DaySchedule[] = [];
        const currentDate = new Date(start);
        const expandedIds = new Set<string>();
        
        while (currentDate <= end) {
          const dateStr = currentDate.toISOString().split('T')[0];
          
          // Vérifier si un jour existe déjà pour cette date
          const existingDay = prevSchedules.find(d => d.date === dateStr);
          
          if (existingDay) {
            // Garder le jour existant avec ses horaires
            days.push(existingDay);
          } else {
            // Créer un nouveau jour avec des horaires par défaut
            const newDayId = crypto.randomUUID();
            days.push({
              id: newDayId,
              date: dateStr,
              startTime: '09:00',
              endTime: '17:00',
              breaks: []
            });
            // Dérouler le premier jour créé seulement si on crée de nouveaux jours
            if (days.length === 1 && prevSchedules.length === 0) {
              expandedIds.add(newDayId);
            }
          }
          
          currentDate.setDate(currentDate.getDate() + 1);
        }
        
        // Mettre à jour les jours déroulés
        setExpandedDays(prev => {
          const newSet = new Set<string>();
          // Préserver les jours déroulés existants qui sont toujours dans la liste
          days.forEach(day => {
            if (prev.has(day.id)) {
              newSet.add(day.id);
            }
          });
          // Ajouter les nouveaux jours à dérouler
          expandedIds.forEach(id => newSet.add(id));
          return newSet;
        });
        
        return days;
      });
    } else if (!startDate && !endDate) {
      // Si on supprime les dates, vider les jours seulement si on n'est pas en train d'initialiser
      setDaySchedules(prev => {
        // Ne vider que si on a déjà des jours (évite de vider lors de l'initialisation)
        if (prev.length > 0) {
          return [];
        }
        return prev;
      });
      setExpandedDays(new Set());
    }
  }, [startDate, endDate]);

  // Générer automatiquement les jours à partir de la période
  useEffect(() => {
    // Ne pas générer pendant l'initialisation
    if (isInitializing) return;
    
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      if (start > end) {
        // Date de fin avant date de début, ne rien faire
        return;
      }
      
      // Générer tous les jours entre startDate et endDate
      setDaySchedules(prevSchedules => {
        const days: DaySchedule[] = [];
        const currentDate = new Date(start);
        const expandedIds = new Set<string>();
        
        while (currentDate <= end) {
          const dateStr = currentDate.toISOString().split('T')[0];
          
          // Vérifier si un jour existe déjà pour cette date
          const existingDay = prevSchedules.find(d => d.date === dateStr);
          
          if (existingDay) {
            // Garder le jour existant avec ses horaires
            days.push(existingDay);
          } else {
            // Créer un nouveau jour avec des horaires par défaut
            const newDayId = crypto.randomUUID();
            days.push({
              id: newDayId,
              date: dateStr,
              startTime: '09:00',
              endTime: '17:00',
              breaks: []
            });
            // Dérouler le premier jour créé seulement si on crée de nouveaux jours
            if (days.length === 1 && prevSchedules.length === 0) {
              expandedIds.add(newDayId);
            }
          }
          
          currentDate.setDate(currentDate.getDate() + 1);
        }
        
        // Supprimer les jours qui ne sont plus dans la période
        const validDates = new Set(days.map(d => d.date));
        const filteredDays = days.filter(day => validDates.has(day.date));
        
        // Mettre à jour les jours déroulés pour les nouveaux jours
        if (expandedIds.size > 0) {
          setExpandedDays(prev => {
            const newSet = new Set(prev);
            expandedIds.forEach(id => newSet.add(id));
            return newSet;
          });
        }
        
        return filteredDays;
      });
    } else if (!startDate && !endDate) {
      // Si on supprime les dates, vider les jours
      setDaySchedules([]);
      setExpandedDays(new Set());
    }
  }, [startDate, endDate, isInitializing]);

  // Initialiser les champs si on édite un événement
  useEffect(() => {
    if (initialEvent) {
      setTitle(initialEvent.title || initialEvent.description || '');
      setLocation({
        address: initialEvent.location || '',
        coordinates: initialEvent.locationCoordinates
      });
      setRequiredPeople(initialEvent.studentCount || 1);
      
      // Convertir les slots existants en horaires quotidiens
      if (initialEvent.slots && initialEvent.slots.length > 0) {
        const schedules: DaySchedule[] = initialEvent.slots
          .map((slot, index) => {
            try {
              // Gérer les différents formats de dates Firestore
              let startDate: Date;
              if (slot.startTime instanceof Date) {
                startDate = slot.startTime;
              } else if (slot.startTime && typeof (slot.startTime as any).toDate === 'function') {
                startDate = (slot.startTime as any).toDate();
              } else if (slot.startTime) {
                startDate = new Date(slot.startTime as any);
              } else {
                return null; // Ignorer les slots sans date de début
              }

              let endDate: Date;
              if (slot.endTime instanceof Date) {
                endDate = slot.endTime;
              } else if (slot.endTime && typeof (slot.endTime as any).toDate === 'function') {
                endDate = (slot.endTime as any).toDate();
              } else if (slot.endTime) {
                endDate = new Date(slot.endTime as any);
              } else {
                // Si pas de date de fin, utiliser la date de début + 1 heure
                endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
              }

              // Vérifier que les dates sont valides
              if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                console.warn(`Slot ${index} a des dates invalides, ignoré`);
                return null;
              }

              // Convertir les pauses au bon format
              const breaks: DayBreak[] = (slot.breaks || []).map((b: any) => ({
                start: typeof b.start === 'string' ? b.start : String(b.start),
                end: typeof b.end === 'string' ? b.end : String(b.end)
              }));

              return {
                id: slot.id || `day-${index}`,
                date: startDate.toISOString().split('T')[0],
                startTime: startDate.toTimeString().slice(0, 5),
                endTime: endDate.toTimeString().slice(0, 5),
                breaks: breaks
              };
            } catch (error) {
              console.error(`Erreur lors de la conversion du slot ${index}:`, error);
              return null;
            }
          })
          .filter((schedule): schedule is DaySchedule => schedule !== null);
        
        if (schedules.length > 0) {
          setDaySchedules(schedules);
          // Dérouler le premier jour par défaut
          if (schedules.length > 0) {
            setExpandedDays(new Set([schedules[0].id]));
          }
          
          // Définir les dates de début et fin à partir des slots
          const dates = schedules.map(s => new Date(s.date)).sort((a, b) => a.getTime() - b.getTime());
          if (dates.length > 0) {
            setStartDate(dates[0].toISOString().split('T')[0]);
            setEndDate(dates[dates.length - 1].toISOString().split('T')[0]);
          }
          // Dérouler le premier jour par défaut
          if (schedules.length > 0) {
            setExpandedDays(new Set([schedules[0].id]));
          }
        } else {
          // Si aucun slot valide, ne pas définir de dates
          setDaySchedules([]);
        }
      } else if (initialEvent.startDate && initialEvent.endDate) {
        // Fallback: utiliser startDate/endDate
        try {
          let startDateObj: Date;
          if (initialEvent.startDate instanceof Date) {
            startDateObj = initialEvent.startDate;
          } else if (initialEvent.startDate && typeof (initialEvent.startDate as any).toDate === 'function') {
            startDateObj = (initialEvent.startDate as any).toDate();
          } else {
            startDateObj = new Date(initialEvent.startDate);
          }

          let endDateObj: Date;
          if (initialEvent.endDate instanceof Date) {
            endDateObj = initialEvent.endDate;
          } else if (initialEvent.endDate && typeof (initialEvent.endDate as any).toDate === 'function') {
            endDateObj = (initialEvent.endDate as any).toDate();
          } else {
            endDateObj = new Date(initialEvent.endDate);
          }

          if (!isNaN(startDateObj.getTime()) && !isNaN(endDateObj.getTime())) {
            setStartDate(startDateObj.toISOString().split('T')[0]);
            setEndDate(endDateObj.toISOString().split('T')[0]);
            // Les jours seront générés automatiquement par l'effet
          }
        } catch (error) {
          console.error('Erreur lors de la conversion des dates:', error);
        }
      }
      setIsInitializing(false);
    } else {
      // Pour un nouvel événement, on ne définit pas de dates par défaut
      setIsInitializing(false);
    }
  }, [initialEvent]);

  const handleLocationChange = useCallback((address: string, coordinates?: { lat: number; lng: number }) => {
    setLocation({ address, coordinates });
  }, []);

  // Calculer les heures travaillées pour un jour (en heures)
  const calculateWorkingHours = (startTime: string, endTime: string, breaks: DayBreak[] = []): number => {
    const start = new Date(`1970-01-01T${startTime}`);
    const end = new Date(`1970-01-01T${endTime}`);
    
    let totalMinutes = (end.getTime() - start.getTime()) / 1000 / 60;
    
    // Soustraire les pauses
    breaks.forEach(breakTime => {
      const breakStart = new Date(`1970-01-01T${breakTime.start}`);
      const breakEnd = new Date(`1970-01-01T${breakTime.end}`);
      const breakMinutes = (breakEnd.getTime() - breakStart.getTime()) / 1000 / 60;
      totalMinutes -= breakMinutes;
    });
    
    return totalMinutes / 60; // Convertir en heures
  };

  // Calculer le total d'heures pour tous les jours
  const calculateTotalHours = (): number => {
    return daySchedules.reduce((total, day) => {
      return total + calculateWorkingHours(day.startTime, day.endTime, day.breaks);
    }, 0);
  };

  // Calculer les dates min et max
  const getDateRange = () => {
    if (daySchedules.length === 0) return { min: null, max: null };
    
    const dates = daySchedules
      .map(day => new Date(day.date))
      .filter(date => !isNaN(date.getTime()))
      .sort((a, b) => a.getTime() - b.getTime());
    
    if (dates.length === 0) return { min: null, max: null };
    
    return {
      min: dates[0],
      max: dates[dates.length - 1]
    };
  };

  // Étendre la période (ajouter un jour à la fin)
  const handleExtendPeriod = () => {
    if (endDate) {
      const newEndDate = new Date(endDate);
      newEndDate.setDate(newEndDate.getDate() + 1);
      setEndDate(newEndDate.toISOString().split('T')[0]);
    } else if (startDate) {
      setEndDate(startDate);
    }
  };

  // Supprimer un jour
  const handleDeleteDay = (dayId: string) => {
    if (daySchedules.length > 1) {
      setDaySchedules(daySchedules.filter(day => day.id !== dayId));
    } else {
      alert('Vous devez avoir au moins un jour d\'horaires.');
    }
  };

  // Mettre à jour un champ d'un jour
  const handleUpdateDay = (dayId: string, field: keyof DaySchedule, value: string) => {
    const updatedSchedules = daySchedules.map(day => {
      if (day.id === dayId) {
        const updated = { ...day, [field]: value };
        
        // Si on modifie la date, vérifier qu'elle n'est pas déjà utilisée par un autre jour
        if (field === 'date') {
          const isDuplicate = daySchedules.some(d => d.id !== dayId && d.date === value);
          if (isDuplicate) {
            alert(`Cette date est déjà utilisée par un autre jour. Veuillez choisir une date différente.`);
            return day; // Ne pas mettre à jour
          }
        }
        
        return updated;
      }
      return day;
    });
    
    setDaySchedules(updatedSchedules);
  };

  // Basculer l'expansion d'un jour
  const toggleDayExpansion = (dayId: string) => {
    setExpandedDays(prev => {
      const newSet = new Set(prev);
      if (newSet.has(dayId)) {
        newSet.delete(dayId);
      } else {
        newSet.add(dayId);
      }
      return newSet;
    });
  };

  // Ajouter une pause à un jour
  const handleAddBreak = (dayId: string) => {
    setDaySchedules(daySchedules.map(day => 
      day.id === dayId 
        ? { ...day, breaks: [...day.breaks, { start: '12:00', end: '13:00' }] }
        : day
    ));
  };

  // Mettre à jour une pause
  const handleUpdateBreak = (dayId: string, breakIndex: number, field: 'start' | 'end', value: string) => {
    setDaySchedules(daySchedules.map(day => 
      day.id === dayId 
        ? {
            ...day,
            breaks: day.breaks.map((breakItem, idx) =>
              idx === breakIndex ? { ...breakItem, [field]: value } : breakItem
            )
          }
        : day
    ));
  };

  // Supprimer une pause
  const handleDeleteBreak = (dayId: string, breakIndex: number) => {
    setDaySchedules(daySchedules.map(day => 
      day.id === dayId 
        ? { ...day, breaks: day.breaks.filter((_, idx) => idx !== breakIndex) }
        : day
    ));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const isEditing = !!initialEvent;
    const creatorName =
      userData?.companyName || userData?.structureName || '';
    
    // Vérifier les droits : admins/membres OU contacts avec accès ayant canViewEvents
    const isStructureAdmin = ['admin', 'admin_structure', 'membre', 'superadmin'].includes(userData?.status || '');
    const canCreateContact = isContactWithAccess && contactPermissions?.canViewEvents && userData?.status === 'entreprise';
    const canCreate = !!userData?.companyName || !!userData?.structureName || !!userData?.structureId || isStructureAdmin || canCreateContact;

    if (!canCreate) {
      alert(`Erreur: Vous n'avez pas les droits pour ${isEditing ? 'modifier' : 'créer'} un événement.`);
      return;
    }

    if (!title || !location.address || !requiredPeople || !startDate || !endDate || daySchedules.length === 0) {
      alert("Veuillez remplir tous les champs obligatoires, notamment la période du salon.");
      return;
    }

    // Vérifier que la date de fin est après la date de début
    if (new Date(endDate) < new Date(startDate)) {
      alert("La date de fin doit être après ou égale à la date de début.");
      return;
    }

    // Vérifier que tous les jours ont des horaires valides
    for (const day of daySchedules) {
      if (!day.date || !day.startTime || !day.endTime) {
        alert("Veuillez remplir tous les horaires pour chaque jour.");
        return;
      }
      if (day.endTime <= day.startTime) {
        alert(`L'heure de fin doit être après l'heure de début pour le ${new Date(day.date).toLocaleDateString('fr-FR')}.`);
        return;
      }
    }

    setLoading(true);
    try {
      // Convertir les horaires quotidiens en slots
      const slots = daySchedules.map(day => {
        const startDateTime = new Date(`${day.date}T${day.startTime}`);
        const endDateTime = new Date(`${day.date}T${day.endTime}`);
        
        return {
          id: day.id,
          startTime: startDateTime,
          endTime: endDateTime,
          capacity: requiredPeople,
          assignedStudentIds: initialEvent?.slots?.find(s => s.id === day.id)?.assignedStudentIds || [],
          contractStatus: initialEvent?.slots?.find(s => s.id === day.id)?.contractStatus || 'pending',
          billingStatus: initialEvent?.slots?.find(s => s.id === day.id)?.billingStatus || 'pending',
          breaks: day.breaks // Ajouter les pauses au slot
        };
      });

      // Calculer les dates min/max pour startDate et endDate
      const allDates = slots.flatMap(slot => [
        slot.startTime instanceof Date ? slot.startTime : new Date(slot.startTime),
        slot.endTime instanceof Date ? slot.endTime : new Date(slot.endTime)
      ]);
      const minDate = new Date(Math.min(...allDates.map(d => d.getTime())));
      const maxDate = new Date(Math.max(...allDates.map(d => d.getTime())));

      if (isEditing && initialEvent) {
        // Mode édition - mettre à jour l'événement existant
        // Récupérer le companyId si l'événement n'en a pas encore
        let companyId: string | undefined = initialEvent.companyId;
        
        if (!companyId) {
          if (userData?.status === 'entreprise' && userData?.companyId) {
            companyId = userData.companyId;
          } else if (userData?.structureId) {
            try {
              const settingsRef = doc(db, 'ambassadorSettings', userData.structureId);
              const settingsDoc = await getDoc(settingsRef);
              if (settingsDoc.exists()) {
                const settings = settingsDoc.data();
                companyId = settings.companyId;
              }
            } catch (error) {
              console.warn('Erreur lors de la récupération du companyId depuis ambassadorSettings:', error);
            }
          }
        }
        
        const updateData: any = {
          title: title,
          campaignName: title,
          description: `Événement ambassadeur: ${title}`,
          location: location.address,
          startDate: minDate.toISOString(),
          endDate: maxDate.toISOString(),
          studentCount: requiredPeople,
          date: minDate.toISOString(),
          slots: slots,
          updatedAt: new Date(),
          type: 'ambassadeur_event' // CRITIQUE: Doit être présent pour que les règles Firestore fonctionnent
        };

        // Ajouter le companyId si disponible et si l'événement n'en a pas encore
        if (companyId && !initialEvent.companyId) {
          updateData.companyId = companyId;
        }

        // Ajouter les coordonnées seulement si elles sont disponibles et valides
        if (location.coordinates &&
            typeof location.coordinates.lat === 'number' &&
            typeof location.coordinates.lng === 'number') {
          updateData.locationCoordinates = location.coordinates;
        }

        await updateDoc(doc(db, 'missions', initialEvent.id), updateData);

        if (onSuccess) {
          onSuccess();
        } else {
          navigate('/app/ambassadeurs');
        }
      } else {
        // Mode création - créer un nouvel événement
        // Récupérer le companyId : pour les contacts avec accès, utiliser leur companyId, sinon récupérer depuis ambassadorSettings
        let companyId: string | undefined = undefined;
        
        if (userData?.status === 'entreprise' && userData?.companyId) {
          // Contact avec accès : utiliser son companyId
          companyId = userData.companyId;
        } else if (userData?.structureId) {
          // Admin/membre : récupérer depuis ambassadorSettings
          try {
            const settingsRef = doc(db, 'ambassadorSettings', userData.structureId);
            const settingsDoc = await getDoc(settingsRef);
            if (settingsDoc.exists()) {
              const settings = settingsDoc.data();
              companyId = settings.companyId;
            }
          } catch (error) {
            console.warn('Erreur lors de la récupération du companyId depuis ambassadorSettings:', error);
          }
        }
        
        let displayCompanyName = creatorName;
        if (companyId) {
          try {
            const companySnap = await getDoc(doc(db, 'companies', companyId));
            if (companySnap.exists()) {
              const name = (companySnap.data()?.name as string | undefined)?.trim();
              if (name) displayCompanyName = name;
            }
          } catch (error) {
            console.warn('Erreur lors de la récupération du nom entreprise:', error);
          }
        } else if (userData?.structureId) {
          try {
            const structureSnap = await getDoc(doc(db, 'structures', userData.structureId));
            if (structureSnap.exists()) {
              const structureName = ((structureSnap.data()?.nom || structureSnap.data()?.name) as string | undefined)?.trim();
              if (structureName) displayCompanyName = structureName;
            }
          } catch (error) {
            console.warn('Erreur lors de la récupération du nom structure:', error);
          }
        }
        if (!displayCompanyName.trim()) {
          displayCompanyName = 'Entreprise';
        }

        const missionData: any = {
          number: `AMB-${Date.now()}`,
          company: displayCompanyName,
          status: 'En attente',
          assignees: [],
          date: minDate.toISOString(),
          studentCount: requiredPeople,
          description: `Événement ambassadeur: ${title}`,
          type: 'ambassadeur_event',
          campaignName: title,
          title: title,
          location: location.address,
          startDate: minDate.toISOString(),
          endDate: maxDate.toISOString(),
          visibleForAmbassadors: false,
          slots: slots
        };
        
        // structureId requis par les règles Firestore pour les admins/membres
        if (userData?.structureId) {
          missionData.structureId = userData.structureId;
        }
        
        // Ajouter le companyId si disponible
        if (companyId) {
          missionData.companyId = companyId;
        }

        // Ajouter les coordonnées seulement si elles sont disponibles et valides
        if (location.coordinates &&
            typeof location.coordinates.lat === 'number' &&
            typeof location.coordinates.lng === 'number') {
          missionData.locationCoordinates = location.coordinates;
        }

        await addMission(missionData);

        if (onSuccess) {
          onSuccess();
        } else {
          navigate('/app/ambassadeurs');
        }
      }
    } catch (error: any) {
      console.error(`Erreur ${isEditing ? 'modification' : 'création'} événement:`, error);
      alert(`Erreur lors de ${isEditing ? 'la modification' : 'la création'} de l'événement.`);
    } finally {
      setLoading(false);
    }
  };


  return (
    <div style={{ maxWidth: '700px', margin: '0 auto' }}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        {/* Form Card - Design Apple */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '24px',
          padding: '32px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
          border: '1px solid #f3f4f6'
        }}>
          <h2 style={{
            fontSize: '24px',
            fontWeight: 600,
            color: '#111827',
            marginBottom: '24px',
            letterSpacing: '-0.02em',
            fontFamily: appleFont
          }}>
            {initialEvent ? 'Modifier l\'événement' : 'Créer un événement ambassadeur'}
          </h2>
          
          {/* Nom de l'événement */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: 500,
              color: '#374151',
              marginBottom: '8px',
              fontFamily: appleFont
            }}>
              Nom de l'événement <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              type="text"
              required
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: '12px',
                border: '1px solid #e5e7eb',
                backgroundColor: '#fafafa',
                fontSize: '15px',
                fontFamily: appleFont,
                outline: 'none',
                transition: 'all 0.2s',
                boxSizing: 'border-box'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#2563eb';
                e.target.style.backgroundColor = 'white';
                e.target.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.1)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#e5e7eb';
                e.target.style.backgroundColor = '#fafafa';
                e.target.style.boxShadow = 'none';
              }}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Salon de l'Étudiant 2024"
            />
          </div>

          {/* Période du salon */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '14px',
              fontWeight: 500,
              color: '#374151',
              marginBottom: '16px',
              fontFamily: appleFont
            }}>
              <CalendarIcon sx={{ fontSize: 18, color: '#6b7280' }} />
              Période du salon <span style={{ color: '#ef4444' }}>*</span>
            </label>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              {/* Date de début */}
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: '#374151',
                  marginBottom: '6px',
                  fontFamily: appleFont
                }}>
                  Date de début
                </label>
                <input
                  type="date"
                  required
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: '12px',
                    border: '1px solid #e5e7eb',
                    backgroundColor: '#fafafa',
                    fontSize: '15px',
                    fontFamily: appleFont,
                    outline: 'none',
                    transition: 'all 0.2s',
                    boxSizing: 'border-box'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#2563eb';
                    e.target.style.backgroundColor = 'white';
                    e.target.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#e5e7eb';
                    e.target.style.backgroundColor = '#fafafa';
                    e.target.style.boxShadow = 'none';
                  }}
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    // Si la date de fin est avant la nouvelle date de début, ajuster
                    if (endDate && e.target.value > endDate) {
                      setEndDate(e.target.value);
                    }
                  }}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>

              {/* Date de fin */}
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: '#374151',
                  marginBottom: '6px',
                  fontFamily: appleFont
                }}>
                  Date de fin
                </label>
                <input
                  type="date"
                  required
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: '12px',
                    border: '1px solid #e5e7eb',
                    backgroundColor: '#fafafa',
                    fontSize: '15px',
                    fontFamily: appleFont,
                    outline: 'none',
                    transition: 'all 0.2s',
                    boxSizing: 'border-box'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#2563eb';
                    e.target.style.backgroundColor = 'white';
                    e.target.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#e5e7eb';
                    e.target.style.backgroundColor = '#fafafa';
                    e.target.style.boxShadow = 'none';
                  }}
                  value={endDate}
                  onChange={(e) => {
                    if (!startDate || e.target.value >= startDate) {
                      setEndDate(e.target.value);
                    } else {
                      alert('La date de fin doit être après ou égale à la date de début.');
                    }
                  }}
                  min={startDate || new Date().toISOString().split('T')[0]}
                />
              </div>
            </div>
            
            {startDate && endDate && startDate > endDate && (
              <p style={{
                fontSize: '12px',
                color: '#ef4444',
                marginTop: '6px',
                fontFamily: appleFont,
                margin: '6px 0 0 0'
              }}>
                ⚠️ La date de fin doit être après ou égale à la date de début
              </p>
            )}
            
            {startDate && endDate && startDate <= endDate && (
              <p style={{
                fontSize: '12px',
                color: '#10b981',
                marginTop: '6px',
                fontFamily: appleFont,
                margin: '6px 0 0 0'
              }}>
                ✓ {daySchedules.length} jour{daySchedules.length > 1 ? 's' : ''} généré{daySchedules.length > 1 ? 's' : ''} automatiquement
              </p>
            )}
          </div>

          {/* Horaires au jour le jour */}
          {daySchedules.length > 0 && (
            <div style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '14px',
                  fontWeight: 500,
                  color: '#374151',
                  fontFamily: appleFont
                }}>
                  <AccessTimeIcon sx={{ fontSize: 16, color: '#6b7280' }} />
                  Horaires par jour <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <button
                  type="button"
                  onClick={handleExtendPeriod}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 16px',
                    borderRadius: '10px',
                    border: '1px solid #2563eb',
                    backgroundColor: 'transparent',
                    color: '#2563eb',
                    fontSize: '14px',
                    fontWeight: 500,
                    fontFamily: appleFont,
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#eff6ff';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <AddIcon sx={{ fontSize: 18 }} />
                  Ajouter un jour
                </button>
              </div>

            {/* Résumé compact : Date de début et fin */}
            {daySchedules.length > 0 && (() => {
              const dateRange = getDateRange();
              const formatDate = (date: Date | null) => {
                if (!date) return '—';
                return date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
              };
              
              // Trouver les heures min et max
              const allTimes = daySchedules.flatMap(day => [day.startTime, day.endTime]).sort();
              const minTime = allTimes[0] || '—';
              const maxTime = allTimes[allTimes.length - 1] || '—';
              
              return (
                <div style={{
                  border: '1px solid #e5e7eb',
                  borderRadius: '12px',
                  padding: '16px',
                  marginBottom: '16px',
                  backgroundColor: '#fafafa'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px', fontFamily: appleFont }}>
                        Période du salon
                      </div>
                      <div style={{ fontSize: '15px', fontWeight: 600, color: '#111827', fontFamily: appleFont }}>
                        {formatDate(dateRange.min)} {minTime !== '—' && `à ${minTime}`} 
                        {dateRange.min && dateRange.max && dateRange.min.getTime() !== dateRange.max.getTime() && (
                          <> — {formatDate(dateRange.max)} {maxTime !== '—' && `à ${maxTime}`}</>
                        )}
                      </div>
                      <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px', fontFamily: appleFont }}>
                        {daySchedules.length} jour{daySchedules.length > 1 ? 's' : ''} • {calculateTotalHours().toFixed(2)}h total
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        // Toggle tous les jours
                        if (expandedDays.size === daySchedules.length) {
                          setExpandedDays(new Set());
                        } else {
                          setExpandedDays(new Set(daySchedules.map(d => d.id)));
                        }
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: '1px solid #d1d5db',
                        backgroundColor: 'white',
                        color: '#374151',
                        fontSize: '13px',
                        fontWeight: 500,
                        fontFamily: appleFont,
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#2563eb';
                        e.currentTarget.style.color = '#2563eb';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = '#d1d5db';
                        e.currentTarget.style.color = '#374151';
                      }}
                    >
                      {expandedDays.size === daySchedules.length ? (
                        <>
                          <ExpandLessIcon sx={{ fontSize: 18 }} />
                          Masquer les détails
                        </>
                      ) : (
                        <>
                          <ExpandMoreIcon sx={{ fontSize: 18 }} />
                          Voir les détails
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* Détails des jours (déroulables) */}
            {daySchedules.map((day, dayIndex) => {
              const dayHours = calculateWorkingHours(day.startTime, day.endTime, day.breaks);
              const isExpanded = expandedDays.has(day.id);
              
              return (
                <div
                  key={day.id}
                  style={{
                    border: '1px solid #e5e7eb',
                    borderRadius: '12px',
                    marginBottom: '12px',
                    backgroundColor: '#fafafa',
                    overflow: 'hidden',
                    transition: 'all 0.3s ease'
                  }}
                >
                  {/* En-tête du jour (toujours visible) */}
                  <div 
                    style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center', 
                      padding: '16px 20px',
                      cursor: 'pointer',
                      backgroundColor: isExpanded ? '#f0f9ff' : 'transparent',
                      transition: 'background-color 0.2s'
                    }}
                    onClick={() => toggleDayExpansion(day.id)}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#111827', margin: 0, fontFamily: appleFont }}>
                          Jour {dayIndex + 1}
                        </h3>
                        <span style={{ fontSize: '13px', color: '#6b7280', fontFamily: appleFont }}>
                          {new Date(day.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
                        </span>
                        <span style={{ fontSize: '13px', color: '#2563eb', fontWeight: 500, fontFamily: appleFont }}>
                          {day.startTime} - {day.endTime}
                        </span>
                        {day.breaks.length > 0 && (
                          <span style={{ fontSize: '12px', color: '#6b7280', fontFamily: appleFont }}>
                            ({day.breaks.length} pause{day.breaks.length > 1 ? 's' : ''})
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px', fontFamily: appleFont }}>
                        Total: {dayHours.toFixed(2)}h
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {isExpanded ? (
                        <ExpandLessIcon sx={{ fontSize: 20, color: '#6b7280' }} />
                      ) : (
                        <ExpandMoreIcon sx={{ fontSize: 20, color: '#6b7280' }} />
                      )}
                      {daySchedules.length > 1 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteDay(day.id);
                          }}
                          style={{
                            padding: '6px 10px',
                            borderRadius: '6px',
                            border: 'none',
                            backgroundColor: '#fee2e2',
                            color: '#dc2626',
                            fontSize: '12px',
                            fontWeight: 500,
                            fontFamily: appleFont,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <DeleteIcon sx={{ fontSize: 14 }} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Contenu déroulable */}
                  {isExpanded && (
                    <div style={{ padding: '20px', borderTop: '1px solid #e5e7eb', backgroundColor: 'white' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                        {/* Date */}
                        <div>
                          <label style={{
                            display: 'block',
                            fontSize: '13px',
                            fontWeight: 500,
                            color: '#374151',
                            marginBottom: '6px',
                            fontFamily: appleFont
                          }}>
                            Date
                          </label>
                          <input
                            type="date"
                            required
                            style={{
                              width: '100%',
                              padding: '10px 12px',
                              borderRadius: '8px',
                              border: '1px solid #e5e7eb',
                              backgroundColor: '#fafafa',
                              fontSize: '14px',
                              fontFamily: appleFont,
                              outline: 'none',
                              transition: 'all 0.2s',
                              boxSizing: 'border-box'
                            }}
                            value={day.date}
                            onChange={(e) => handleUpdateDay(day.id, 'date', e.target.value)}
                            min={new Date().toISOString().split('T')[0]}
                          />
                        </div>

                        {/* Heure de début */}
                        <div>
                          <label style={{
                            display: 'block',
                            fontSize: '13px',
                            fontWeight: 500,
                            color: '#374151',
                            marginBottom: '6px',
                            fontFamily: appleFont
                          }}>
                            Début
                          </label>
                          <input
                            type="time"
                            required
                            style={{
                              width: '100%',
                              padding: '10px 12px',
                              borderRadius: '8px',
                              border: '1px solid #e5e7eb',
                              backgroundColor: '#fafafa',
                              fontSize: '14px',
                              fontFamily: appleFont,
                              outline: 'none',
                              transition: 'all 0.2s',
                              boxSizing: 'border-box'
                            }}
                            value={day.startTime}
                            onChange={(e) => handleUpdateDay(day.id, 'startTime', e.target.value)}
                          />
                        </div>

                        {/* Heure de fin */}
                        <div>
                          <label style={{
                            display: 'block',
                            fontSize: '13px',
                            fontWeight: 500,
                            color: '#374151',
                            marginBottom: '6px',
                            fontFamily: appleFont
                          }}>
                            Fin
                          </label>
                          <input
                            type="time"
                            required
                            style={{
                              width: '100%',
                              padding: '10px 12px',
                              borderRadius: '8px',
                              border: '1px solid #e5e7eb',
                              backgroundColor: '#fafafa',
                              fontSize: '14px',
                              fontFamily: appleFont,
                              outline: 'none',
                              transition: 'all 0.2s',
                              boxSizing: 'border-box'
                            }}
                            value={day.endTime}
                            onChange={(e) => handleUpdateDay(day.id, 'endTime', e.target.value)}
                            min={day.startTime}
                          />
                        </div>
                      </div>

                      {/* Pauses */}
                      <div style={{ marginBottom: '12px' }}>
                        <label style={{
                          display: 'block',
                          fontSize: '13px',
                          fontWeight: 500,
                          color: '#374151',
                          marginBottom: '8px',
                          fontFamily: appleFont
                        }}>
                          Pauses
                        </label>
                        {day.breaks.map((breakItem, breakIndex) => (
                          <div
                            key={breakIndex}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              marginBottom: '8px',
                              padding: '8px 12px',
                              backgroundColor: '#fafafa',
                              borderRadius: '8px',
                              border: '1px solid #e5e7eb'
                            }}
                          >
                            <input
                              type="time"
                              style={{
                                padding: '6px 10px',
                                borderRadius: '6px',
                                border: '1px solid #d1d5db',
                                fontSize: '13px',
                                fontFamily: appleFont,
                                outline: 'none',
                                width: '90px',
                                backgroundColor: 'white'
                              }}
                              value={breakItem.start}
                              onChange={(e) => handleUpdateBreak(day.id, breakIndex, 'start', e.target.value)}
                            />
                            <span style={{ color: '#6b7280', fontSize: '14px' }}>-</span>
                            <input
                              type="time"
                              style={{
                                padding: '6px 10px',
                                borderRadius: '6px',
                                border: '1px solid #d1d5db',
                                fontSize: '13px',
                                fontFamily: appleFont,
                                outline: 'none',
                                width: '90px',
                                backgroundColor: 'white'
                              }}
                              value={breakItem.end}
                              onChange={(e) => handleUpdateBreak(day.id, breakIndex, 'end', e.target.value)}
                              min={breakItem.start}
                            />
                            <button
                              type="button"
                              onClick={() => handleDeleteBreak(day.id, breakIndex)}
                              style={{
                                padding: '4px 8px',
                                borderRadius: '6px',
                                border: 'none',
                                backgroundColor: '#fee2e2',
                                color: '#dc2626',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center'
                              }}
                            >
                              <DeleteIcon sx={{ fontSize: 16 }} />
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => handleAddBreak(day.id)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '8px 12px',
                            borderRadius: '8px',
                            border: '1px solid #2563eb',
                            backgroundColor: 'transparent',
                            color: '#2563eb',
                            fontSize: '13px',
                            fontWeight: 500,
                            fontFamily: appleFont,
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#eff6ff';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                        >
                          <AddIcon sx={{ fontSize: 16 }} />
                          Ajouter une pause
                        </button>
                      </div>

                      {/* Total heures pour ce jour */}
                      <div style={{
                        padding: '10px 12px',
                        backgroundColor: '#eff6ff',
                        borderRadius: '8px',
                        marginTop: '12px'
                      }}>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: '#1e40af', fontFamily: appleFont }}>
                          Total pour ce jour: {dayHours.toFixed(2)}h
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Total global */}
            <div style={{
              padding: '16px',
              backgroundColor: '#dbeafe',
              borderRadius: '12px',
              marginTop: '16px',
              border: '2px solid #2563eb'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '15px', fontWeight: 600, color: '#1e40af', fontFamily: appleFont }}>
                  Total global (tous les jours):
                </span>
                <span style={{ fontSize: '18px', fontWeight: 700, color: '#1e40af', fontFamily: appleFont }}>
                  {calculateTotalHours().toFixed(2)}h
                </span>
              </div>
              <p style={{ fontSize: '12px', color: '#3b82f6', margin: '8px 0 0 0', fontFamily: appleFont }}>
                Heures totales par étudiant: {calculateTotalHours().toFixed(2)}h | 
                Heures totales globales: {(calculateTotalHours() * requiredPeople).toFixed(2)}h
              </p>
            </div>
          </div>
          )}

          {/* Lieu avec Google Maps Autocomplete */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: 500,
              color: '#374151',
              marginBottom: '8px',
              fontFamily: appleFont
            }}>
              Lieu <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <GooglePlacesAutocomplete
              value={location.address}
              onChange={handleLocationChange}
              placeholder="Rechercher une adresse..."
              required
            />
            {location.coordinates && (
              <p style={{
                fontSize: '12px',
                color: '#10b981',
                marginTop: '6px',
                fontFamily: appleFont,
                margin: '6px 0 0 0'
              }}>
                ✓ Coordonnées: {location.coordinates.lat.toFixed(6)}, {location.coordinates.lng.toFixed(6)}
              </p>
            )}
          </div>

          {/* Nombre de personnes requises */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: 500,
              color: '#374151',
              marginBottom: '8px',
              fontFamily: appleFont
            }}>
              Nombre de personnes requises <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              type="number"
              required
              min="1"
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: '12px',
                border: '1px solid #e5e7eb',
                backgroundColor: '#fafafa',
                fontSize: '15px',
                fontFamily: appleFont,
                outline: 'none',
                transition: 'all 0.2s',
                boxSizing: 'border-box'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#2563eb';
                e.target.style.backgroundColor = 'white';
                e.target.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.1)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#e5e7eb';
                e.target.style.backgroundColor = '#fafafa';
                e.target.style.boxShadow = 'none';
              }}
              value={requiredPeople}
              onChange={(e) => setRequiredPeople(parseInt(e.target.value) || 1)}
            />
            <p style={{
              fontSize: '12px',
              color: '#6b7280',
              marginTop: '6px',
              fontFamily: appleFont,
              margin: '6px 0 0 0'
            }}>
              Nombre d'ambassadeurs nécessaires pour cet événement
            </p>
          </div>
        </div>

        {/* Submit and Cancel Buttons */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '16px' }}>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              style={{
                padding: '16px 32px',
                backgroundColor: 'transparent',
                color: '#6b7280',
                borderRadius: '16px',
                fontWeight: 500,
                fontSize: '15px',
                border: '1px solid #d1d5db',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontFamily: appleFont,
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.currentTarget.style.borderColor = '#9ca3af';
                  e.currentTarget.style.color = '#374151';
                }
              }}
              onMouseLeave={(e) => {
                if (!loading) {
                  e.currentTarget.style.borderColor = '#d1d5db';
                  e.currentTarget.style.color = '#6b7280';
                }
              }}
            >
              Annuler
            </button>
          )}
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '16px 32px',
              backgroundColor: loading ? '#9ca3af' : '#2563eb',
              color: 'white',
              borderRadius: '16px',
              fontWeight: 500,
              fontSize: '15px',
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: appleFont,
              boxShadow: loading ? 'none' : '0 10px 25px -5px rgba(37, 99, 235, 0.3)',
              transition: 'all 0.2s',
              opacity: loading ? 0.5 : 1,
              marginLeft: onCancel ? '16px' : '0'
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.backgroundColor = '#1d4ed8';
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 12px 30px -5px rgba(37, 99, 235, 0.4)';
              }
            }}
            onMouseLeave={(e) => {
              if (!loading) {
                e.currentTarget.style.backgroundColor = '#2563eb';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 10px 25px -5px rgba(37, 99, 235, 0.3)';
              }
            }}
          >
            {loading ? (initialEvent ? 'Modification en cours...' : 'Création en cours...') : (initialEvent ? 'Modifier l\'événement' : 'Créer l\'événement')}
          </button>
        </div>
      </form>
    </div>
  );
};
