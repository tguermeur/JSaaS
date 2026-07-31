import React from 'react';
import UserReferenceText from './UserReferenceText';

interface ChargeNameTextProps {
  chargeId?: string | null;
  chargeName?: string | null;
  fallback?: string;
}

/** Affiche le nom déchiffré d'un chargé de mission (chargeId + chargeName dénormalisé). */
export const ChargeNameText: React.FC<ChargeNameTextProps & React.ComponentProps<typeof UserReferenceText>> = ({
  chargeId,
  chargeName,
  fallback = 'Non assigné',
  ...props
}) => (
  <UserReferenceText userId={chargeId} name={chargeName} fallback={fallback} {...props} />
);

export default ChargeNameText;
