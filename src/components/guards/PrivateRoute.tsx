import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import LoadingState from '../common/LoadingState';

const PrivateRoute = () => {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return <LoadingState message="Connexion…" fullHeight />;
  }

  return currentUser ? <Outlet /> : <Navigate to="/login" replace />;
};

export default PrivateRoute; 