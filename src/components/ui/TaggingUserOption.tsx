import React from 'react';
import { Avatar, Box, Chip, Typography } from '@mui/material';
import UserNameText from '../common/UserNameText';
import UserAvatarInitials from '../common/UserAvatarInitials';

interface TaggingUserOptionProps {
  user: {
    id: string;
    displayName: string;
    email: string;
    photoURL?: string;
    firstName?: string;
    lastName?: string;
    role?: string;
  };
  selected?: boolean;
  onClick: () => void;
}

export const TaggingUserOption: React.FC<TaggingUserOptionProps> = ({ user, selected, onClick }) => (
  <Box
    onClick={onClick}
    sx={{
      display: 'flex',
      alignItems: 'center',
      padding: '8px 16px',
      cursor: 'pointer',
      bgcolor: selected ? '#e3f2fd' : 'transparent',
      '&:hover': { bgcolor: '#f5f5f5' },
    }}
  >
    <Avatar src={user.photoURL} sx={{ width: 32, height: 32, mr: 2, fontSize: '0.875rem' }}>
      <UserAvatarInitials user={user} />
    </Avatar>
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <UserNameText
        user={user}
        fallback={user.email}
        sx={{ fontSize: 14, fontWeight: 500, display: 'block' }}
      />
      <Typography variant="caption" color="text.secondary">
        {user.email}
      </Typography>
    </Box>
    {user.role && (
      <Chip label={user.role} size="small" sx={{ fontSize: '0.75rem', height: 20, ml: 1 }} />
    )}
  </Box>
);
