import React from 'react';
import { Typography, TypographyProps } from '@mui/material';
import { useDecryptedUserName, type UseDecryptedUserNameInput } from '../../hooks/useDecryptedUserName';
import UserNameSkeleton from './UserNameSkeleton';

type UserNameTextProps = TypographyProps & {
  user: UseDecryptedUserNameInput | null | undefined;
  fallback?: string;
  /** Afficher prénom + nom séparés par un espace (défaut) ou displayName seul */
  mode?: 'full' | 'displayName';
  skeletonWidth?: number | string;
};

/**
 * Affiche le nom d'un utilisateur (déchiffré automatiquement) ou un skeleton pendant le chargement.
 */
const UserNameText: React.FC<UserNameTextProps> = ({
  user,
  fallback = '',
  mode = 'full',
  skeletonWidth = 140,
  sx,
  ...typographyProps
}) => {
  const { fullName, displayName, loading } = useDecryptedUserName(user, fallback);

  if (loading) {
    return (
      <UserNameSkeleton
        width={skeletonWidth}
        sx={{
          ...(typeof sx === 'object' && !Array.isArray(sx) ? sx : {}),
          fontSize: (sx as { fontSize?: string | number })?.fontSize ?? '0.9375rem',
        }}
      />
    );
  }

  const label = mode === 'displayName' ? displayName || fullName : fullName;
  const text = label || fallback;
  if (!text) return null;

  return (
    <Typography sx={sx} {...typographyProps}>
      {text}
    </Typography>
  );
};

export default UserNameText;
