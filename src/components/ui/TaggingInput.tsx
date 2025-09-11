import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  TextField,
  Autocomplete,
  Chip,
  Box,
  Avatar,
  Typography,
  Popper,
  Paper
} from '@mui/material';
import { styled } from '@mui/material';

interface TaggedUser {
  id: string;
  displayName: string;
  email: string;
  photoURL?: string;
  firstName?: string;
  lastName?: string;
  role?: string;
}

interface TaggingInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
  availableUsers: TaggedUser[];
  onTaggedUsersChange?: (taggedUsers: TaggedUser[]) => void;
}

const StyledPopper = styled(Popper)(({ theme }) => ({
  '& .MuiAutocomplete-paper': {
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
    borderRadius: '12px',
    border: '1px solid #e0e0e0'
  },
  '& .MuiAutocomplete-listbox': {
    padding: '8px 0'
  }
}));

const UserOption = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  padding: '8px 16px',
  cursor: 'pointer',
  '&:hover': {
    backgroundColor: '#f5f5f7'
  },
  '&.selected': {
    backgroundColor: '#e3f2fd'
  }
}));

const TaggingInput: React.FC<TaggingInputProps> = ({
  value,
  onChange,
  placeholder = "Tapez votre message...",
  multiline = true,
  rows = 3,
  availableUsers,
  onTaggedUsersChange
}) => {
  const [taggedUsers, setTaggedUsers] = useState<TaggedUser[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<TaggedUser[]>([]);
  const [cursorPosition, setCursorPosition] = useState(0);
  const textFieldRef = useRef<HTMLInputElement>(null);
  const lastValueRef = useRef(value);

  // Fonction pour détecter les tags dans le texte
  const extractTags = useCallback((text: string): string[] => {
    const tagRegex = /@(\w+)/g;
    const matches = text.match(tagRegex);
    return matches ? matches.map(tag => tag.substring(1)) : [];
  }, []);

  // Fonction pour trouver les utilisateurs correspondants
  const findMatchingUsers = useCallback((searchTerm: string): TaggedUser[] => {
    if (!searchTerm) return [];
    
    const term = searchTerm.toLowerCase();
    return availableUsers.filter(user => {
      const fullName = `${user.firstName || ''} ${user.lastName || ''}`.toLowerCase().trim();
      const displayName = user.displayName.toLowerCase();
      const email = user.email.toLowerCase();
      
      return fullName.includes(term) || 
             displayName.includes(term) || 
             email.includes(term) ||
             (user.firstName && user.firstName.toLowerCase().includes(term)) ||
             (user.lastName && user.lastName.toLowerCase().includes(term));
    });
  }, [availableUsers]);

  // Fonction pour gérer les changements dans le champ de texte
  const handleTextChange = useCallback((newValue: string) => {
    // Éviter les appels inutiles si la valeur n'a pas changé
    if (newValue === lastValueRef.current) return;
    
    lastValueRef.current = newValue;
    onChange(newValue);
    
    // Détecter si on tape @
    const lastAtSymbol = newValue.lastIndexOf('@');
    if (lastAtSymbol !== -1) {
      const textAfterAt = newValue.substring(lastAtSymbol + 1);
      const spaceIndex = textAfterAt.indexOf(' ');
      
      if (spaceIndex === -1) {
        // Pas d'espace après @, on peut suggérer
        const searchTerm = textAfterAt;
        const matches = findMatchingUsers(searchTerm);
        setSuggestions(matches);
        setShowSuggestions(matches.length > 0);
        setCursorPosition(lastAtSymbol);
      } else {
        setShowSuggestions(false);
      }
    } else {
      setShowSuggestions(false);
    }
  }, [onChange, findMatchingUsers]);

  // Fonction pour sélectionner un utilisateur
  const handleUserSelect = useCallback((user: TaggedUser) => {
    // Trouver le dernier @ avant le curseur
    const beforeCursor = value.substring(0, cursorPosition);
    const lastAtIndex = beforeCursor.lastIndexOf('@');
    if (lastAtIndex === -1) return;

    // Chercher la fin du mot en cours (jusqu'à espace ou fin)
    const afterAt = value.substring(lastAtIndex + 1, cursorPosition);
    const afterCursor = value.substring(cursorPosition);
    let endOfMention = cursorPosition;
    const mentionMatch = afterCursor.match(/^[^\s]*/);
    if (mentionMatch) {
      endOfMention += mentionMatch[0].length;
    }

    // Reconstruire la valeur : avant le @, puis le tag, puis le reste
    const beforeAt = value.substring(0, lastAtIndex);
    const afterMention = value.substring(endOfMention);
    const tagText = `@${user.firstName || user.displayName} ${user.lastName || ''}`.trim() + ' ';
    const newValue = beforeAt + tagText + afterMention;
    onChange(newValue);

    // Ajouter l'utilisateur à la liste des utilisateurs taggés
    if (!taggedUsers.find(u => u.id === user.id)) {
      const newTaggedUsers = [...taggedUsers, user];
      setTaggedUsers(newTaggedUsers);
      onTaggedUsersChange?.(newTaggedUsers);
    }

    setShowSuggestions(false);
    // Placer le curseur juste après le tag inséré
    setTimeout(() => {
      if (textFieldRef.current) {
        // Accéder à l'élément natif input ou textarea
        const input = textFieldRef.current.querySelector('textarea, input');
        if (input && typeof (input as HTMLInputElement).setSelectionRange === 'function') {
          const nativeInput = input as HTMLInputElement | HTMLTextAreaElement;
          const pos = beforeAt.length + tagText.length;
          nativeInput.setSelectionRange(pos, pos);
          nativeInput.focus();
        }
      }
    }, 0);
  }, [value, cursorPosition, onChange, taggedUsers, onTaggedUsersChange]);

  // Fonction utilitaire pour détecter si le curseur est dans un tag @nom
  const getMentionBoundsAtCursor = useCallback((text: string, cursorPos: number) => {
    // Cherche tous les tags @nom dans le texte
    const mentionRegex = /@([\wÀ-ÿ'\- ]+)/g;
    let match;
    while ((match = mentionRegex.exec(text)) !== null) {
      const start = match.index;
      const end = start + match[0].length;
      if (cursorPos > start && cursorPos <= end) {
        return { start, end, mention: match[0] };
      }
    }
    return null;
  }, []);

  // Fonction pour gérer les touches du clavier
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (showSuggestions && suggestions.length > 0) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        // Logique pour naviguer dans les suggestions
      } else if ((event.key === 'Enter' || event.key === 'Tab') && suggestions.length > 0) {
        event.preventDefault();
        handleUserSelect(suggestions[0]);
      } else if (event.key === 'Escape') {
        setShowSuggestions(false);
      }
    }
    
    // Gérer la suppression de backspace ou delete pour supprimer le bloc entier @nom
    if (event.key === 'Backspace' || event.key === 'Delete') {
      const target = event.target as HTMLInputElement;
      const cursorPos = target.selectionStart || 0;
      const mentionBounds = getMentionBoundsAtCursor(value, cursorPos);
      if (mentionBounds) {
        event.preventDefault();
        // Supprimer tout le bloc @nom
        const before = value.substring(0, mentionBounds.start);
        const after = value.substring(mentionBounds.end);
        const newValue = before + after;
        onChange(newValue);
        // Retirer le tag de taggedUsers si présent
        const mentionName = mentionBounds.mention.replace(/^@/, '').trim();
        const newTaggedUsers = taggedUsers.filter(u => {
          const fullName = `${u.firstName || ''} ${u.lastName || ''}`.trim();
          return fullName !== mentionName && u.displayName !== mentionName;
        });
        setTaggedUsers(newTaggedUsers);
        onTaggedUsersChange?.(newTaggedUsers);
        // Placer le curseur à la bonne position
        setTimeout(() => {
          if (textFieldRef.current) {
            textFieldRef.current.setSelectionRange(mentionBounds.start, mentionBounds.start);
            textFieldRef.current.focus();
          }
        }, 0);
      }
    }
  }, [showSuggestions, suggestions, handleUserSelect, getMentionBoundsAtCursor, value, onChange, taggedUsers, onTaggedUsersChange]);

  // Fonction pour gérer le focus et la position du curseur
  const handleInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const target = event.target;
    const newCursorPosition = target.selectionStart || 0;
    setCursorPosition(newCursorPosition);
    handleTextChange(target.value);
  }, [handleTextChange]);

  // Fonction pour gérer le clic sur le champ
  const handleClick = useCallback((event: React.MouseEvent<HTMLInputElement>) => {
    const target = event.target as HTMLInputElement;
    setCursorPosition(target.selectionStart || 0);
  }, []);

  // Fonction pour gérer la sélection dans le champ
  const handleSelect = useCallback((event: React.SyntheticEvent<HTMLInputElement>) => {
    const target = event.target as HTMLInputElement;
    setCursorPosition(target.selectionStart || 0);
  }, []);

  // Fonction pour styliser le texte avec les tags @nom en gras
  const renderStyledValue = useCallback((text: string) => {
    const mentionRegex = /@[A-Za-zÀ-ÿ'\- ]+/g;
    const parts = [];
    let lastIndex = 0;
    let match;
    let key = 0;
    while ((match = mentionRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(
          <span key={key++}>{text.substring(lastIndex, match.index)}</span>
        );
      }
      parts.push(
        <span
          key={key++}
          style={{
            fontWeight: 'bold',
            color: '#007AFF',
            background: '#e3f2fd',
            borderRadius: 4,
            padding: '0 2px',
            margin: '0 1px'
          }}
        >
          {match[0]}
        </span>
      );
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < text.length) {
      parts.push(
        <span key={key++}>{text.substring(lastIndex)}</span>
      );
    }
    return parts;
  }, []);

  // Mettre à jour la référence de la valeur quand elle change
  useEffect(() => {
    lastValueRef.current = value;
  }, [value]);

  return (
    <Box sx={{ position: 'relative' }}>
      {/* Texte stylisé en dessous */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          pointerEvents: 'none',
          color: 'transparent',
          whiteSpace: 'pre-wrap',
          fontFamily: 'inherit',
          fontSize: '1rem',
          zIndex: 1,
          p: '14.5px 14px',
          minHeight: multiline ? `${rows * 24}px` : 'auto',
        }}
        aria-hidden
      >
        {renderStyledValue(value)}
      </Box>
      {/* Champ de saisie réel par-dessus */}
      <TextField
        ref={textFieldRef}
        fullWidth
        multiline={multiline}
        rows={rows}
        value={value}
        onChange={handleInputChange}
        onClick={handleClick}
        onSelect={handleSelect}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        variant="outlined"
        sx={{
          '& .MuiOutlinedInput-root': {
            borderRadius: '12px',
            backgroundColor: '#f5f5f7',
            '& fieldset': { border: 'none' }
          },
          position: 'relative',
          zIndex: 2,
          background: 'transparent',
        }}
        inputProps={{
          style: {
            background: 'transparent',
            position: 'relative',
            color: '#222',
          }
        }}
      />
      
      {/* Suggestions d'utilisateurs */}
      {showSuggestions && suggestions.length > 0 && (
        <Paper
          sx={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 1000,
            mt: 1,
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
            borderRadius: '12px',
            border: '1px solid #e0e0e0',
            maxHeight: 200,
            overflow: 'auto'
          }}
        >
          {suggestions.map((user, index) => (
            <UserOption
              key={user.id}
              onClick={() => handleUserSelect(user)}
              className={index === 0 ? 'selected' : ''}
            >
              <Avatar
                src={user.photoURL}
                sx={{ width: 32, height: 32, mr: 2, fontSize: '0.875rem' }}
              >
                {(user.firstName || user.displayName).charAt(0)}
              </Avatar>
              <Box sx={{ flex: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {user.firstName && user.lastName 
                    ? `${user.firstName} ${user.lastName}`
                    : user.displayName
                  }
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {user.email}
                </Typography>
              </Box>
              {user.role && (
                <Chip
                  label={user.role}
                  size="small"
                  sx={{
                    fontSize: '0.75rem',
                    height: 20,
                    backgroundColor: user.role === 'admin' ? '#ff9800' : 
                                   user.role === 'superadmin' ? '#f44336' : '#e0e0e0'
                  }}
                />
              )}
            </UserOption>
          ))}
        </Paper>
      )}
      
      {/* Affichage des utilisateurs taggés */}
      {taggedUsers.length > 0 && (
        <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {taggedUsers.map((user) => (
            <Chip
              key={user.id}
              avatar={
                <Avatar src={user.photoURL} sx={{ width: 20, height: 20, fontSize: '0.75rem' }}>
                  {(user.firstName || user.displayName).charAt(0)}
                </Avatar>
              }
              label={user.firstName && user.lastName 
                ? `${user.firstName} ${user.lastName}`
                : user.displayName
              }
              size="small"
              onDelete={() => {
                const newTaggedUsers = taggedUsers.filter(u => u.id !== user.id);
                setTaggedUsers(newTaggedUsers);
                onTaggedUsersChange?.(newTaggedUsers);
              }}
              sx={{
                backgroundColor: '#e3f2fd',
                '& .MuiChip-deleteIcon': {
                  color: '#1976d2'
                }
              }}
            />
          ))}
        </Box>
      )}
    </Box>
  );
};

export default TaggingInput; 