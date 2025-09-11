import React, { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { CircularProgress } from '@mui/material';
import { useAuth } from '../../contexts/AuthContext';
import { getDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase/config';

const SuperAdminRoute = () => {
  const { currentUser, loading } = useAuth();
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    const checkAuthorization = async () => {
      if (!currentUser) {
        setIsAuthorized(false);
        return;
      }

      try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setIsAuthorized(
            userData?.status === 'superadmin' || 
            userData?.role === 'superadmin'
          );
        } else {
          setIsAuthorized(false);
        }
      } catch (error) {
        console.error('Erreur vérification superadmin:', error);
        setIsAuthorized(false);
      }
    };

    checkAuthorization();
  }, [currentUser]);

  if (loading || isAuthorized === null) {
    return <CircularProgress />;
  }

  return isAuthorized ? <Outlet /> : <Navigate to="/app/dashboard" />;
};

export default SuperAdminRoute; 