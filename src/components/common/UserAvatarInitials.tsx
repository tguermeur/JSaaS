import React from 'react';
import { Skeleton } from '@mui/material';
import { useDecryptedUserName, type UseDecryptedUserNameInput } from '../../hooks/useDecryptedUserName';

type UserAvatarInitialsProps = {
  user: UseDecryptedUserNameInput | null | undefined;
  fontSize?: string;
};

/**
 * Initiales pour Avatar — skeleton circulaire pendant le déchiffrement du nom.
 */
const UserAvatarInitials: React.FC<UserAvatarInitialsProps> = ({ user, fontSize = '0.875rem' }) => {
  const { initials, loading } = useDecryptedUserName(user);

  if (loading) {
    return (
      <Skeleton
        variant="circular"
        width={fontSize === '0.7rem' ? 20 : 28}
        height={fontSize === '0.7rem' ? 20 : 28}
        animation="wave"
        sx={{ bgcolor: 'rgba(255,255,255,0.35)' }}
      />
    );
  }

  if (!initials) return null;

  return <>{initials}</>;
};

export default UserAvatarInitials;
