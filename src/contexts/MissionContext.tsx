import React, { createContext, useContext, useState } from 'react';

interface MissionData {
  titre: string;
  client: string;
  dateDebut: string;
  dateFin: string;
  description: string;
  objectifs: string[];
  livrables: Array<{ nom: string; description: string }>;
  budget: Array<{ description: string; quantite: number; prixUnitaire: number }>;
}

interface MissionContextType {
  missionData: MissionData;
  setMissionData: React.Dispatch<React.SetStateAction<MissionData>>;
}

const MissionContext = createContext<MissionContextType | undefined>(undefined);

export const useMission = () => {
  const context = useContext(MissionContext);
  if (!context) {
    throw new Error('useMission must be used within a MissionProvider');
  }
  return context;
};

export const MissionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [missionData, setMissionData] = useState<MissionData>({
    titre: '',
    client: '',
    dateDebut: '',
    dateFin: '',
    description: '',
    objectifs: [],
    livrables: [],
    budget: []
  });

  return (
    <MissionContext.Provider value={{ missionData, setMissionData }}>
      {children}
    </MissionContext.Provider>
  );
}; 