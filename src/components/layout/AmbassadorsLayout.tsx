import React from 'react';
import { Outlet } from 'react-router-dom';

/**
 * Layout minimal pour les routes /app/ambassadeurs et /app/ambassadeurs/event/:eventId.
 * Ne fait que rendre l’Outlet (pas de header/tabs partagé).
 */
export const AmbassadorsLayout: React.FC = () => <Outlet />;
