import React from 'react';
import { TypographyProps } from '@mui/material';
import UserNameText from './UserNameText';
import type { UseDecryptedUserNameInput } from '../../hooks/useDecryptedUserName';
import { isEncryptedField } from '../../utils/decryptUserUtils';

export type UserReferenceTextProps = TypographyProps & {
  userId?: string | null;
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  fallback?: string;
  mode?: 'full' | 'displayName';
  skeletonWidth?: number | string;
};

/**
 * Affiche un nom utilisateur déchiffré à partir d'un userId et/ou champs dénormalisés (createdByName, chargeName…).
 * Ignore les valeurs ENC: dénormalisées et résout via userId.
 */
const UserReferenceText: React.FC<UserReferenceTextProps> = ({
  userId,
  name,
  firstName,
  lastName,
  fallback = '',
  mode = 'full',
  skeletonWidth,
  ...typographyProps
}) => {
  const safeName = name && !isEncryptedField(name) ? name : undefined;
  const safeFirst = firstName && !isEncryptedField(firstName) ? firstName : undefined;
  const safeLast = lastName && !isEncryptedField(lastName) ? lastName : undefined;
  // Si seul un ENC: dénormalisé est fourni avec un userId, forcer le decrypt via id
  const forceDecrypt = Boolean(userId && name && isEncryptedField(name));

  const user: UseDecryptedUserNameInput | null =
    userId || safeName || safeFirst || safeLast || forceDecrypt
      ? {
          id: userId || undefined,
          displayName: forceDecrypt ? 'ENC:' : safeName,
          firstName: safeFirst,
          lastName: safeLast,
        }
      : null;

  return (
    <UserNameText
      user={user}
      fallback={fallback}
      mode={mode}
      skeletonWidth={skeletonWidth}
      {...typographyProps}
    />
  );
};

export default UserReferenceText;
