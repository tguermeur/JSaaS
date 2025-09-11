import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { CircularProgress } from '@mui/material';
import { useAuth } from '../../contexts/AuthContext';

// Pas besoin de Props car nous utilisons Outlet
const PrivateRoute = () => {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return <CircularProgress />;
  }

  return currentUser ? <Outlet /> : <Navigate to="/login" />;
};

export default PrivateRoute; 