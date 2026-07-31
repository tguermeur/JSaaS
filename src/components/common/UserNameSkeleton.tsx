import React from 'react';
import { Skeleton, SkeletonProps } from '@mui/material';

type UserNameSkeletonProps = Omit<SkeletonProps, 'variant'> & {
  /** Largeur du placeholder (nom complet) */
  width?: number | string;
};

/**
 * Placeholder pendant le déchiffrement automatique du prénom / nom.
 */
const UserNameSkeleton: React.FC<UserNameSkeletonProps> = ({
  width = 140,
  height,
  sx,
  ...rest
}) => (
  <Skeleton
    variant="text"
    width={width}
    height={height}
    animation="wave"
    sx={{
      display: 'inline-block',
      verticalAlign: 'middle',
      borderRadius: '6px',
      transform: 'none',
      ...sx,
    }}
    {...rest}
  />
);

export default UserNameSkeleton;
