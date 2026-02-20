import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../contexts/AuthContext';

/**
 * Garde pour la section Ambassadeurs : redirige vers le dashboard si la structure
 * est une Junior-Entreprise (les ambassadeurs sont réservés aux Job Services).
 * Les contacts entreprise (avec accès) conservent l'accès.
 */
const RequireJobServiceForAmbassadors: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, userData } = useAuth();
  const [structureType, setStructureType] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const check = async () => {
      if (!currentUser?.uid) {
        setLoading(false);
        return;
      }
      // Les contacts entreprise (accès ambassadeurs) ne sont pas rattachés à une structure JE/JS
      if (userData?.status === 'entreprise') {
        setStructureType('entreprise');
        setLoading(false);
        return;
      }
      try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        const structureId = userDoc.data()?.structureId;
        if (!structureId) {
          setLoading(false);
          return;
        }
        const structureDoc = await getDoc(doc(db, 'structures', structureId));
        setStructureType(structureDoc.exists() ? (structureDoc.data()?.structureType ?? 'jobservice') : 'jobservice');
      } catch {
        setStructureType('jobservice');
      } finally {
        setLoading(false);
      }
    };
    check();
  }, [currentUser?.uid, userData?.status]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (structureType === 'junior') {
    return <Navigate to="/app/dashboard" replace />;
  }

  return <>{children}</>;
};

export default RequireJobServiceForAmbassadors;
