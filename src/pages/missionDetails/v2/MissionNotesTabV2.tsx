import React from 'react';
import { Box, Button, CircularProgress, IconButton, TextField, Typography } from '@mui/material';
import { MoreHoriz as MoreIcon } from '@mui/icons-material';
import { tokens } from '../../../theme/tokens';
import { CollapsiblePanel } from '../../../components/ds/missionDetailsV2/MissionDetailsV2Primitives';
import UserReferenceText from '../../../components/common/UserReferenceText';
import { useDecryptedUserName } from '../../../hooks/useDecryptedUserName';

interface MissionNote {
  id: string;
  content: string;
  createdAt: Date;
  createdBy?: string;
  createdByName: string;
  createdByPhotoURL?: string;
}

interface MissionNotesTabV2Props {
  notes: MissionNote[];
  loading?: boolean;
  canWrite: boolean;
  newNote: string;
  onNewNoteChange: (v: string) => void;
  onAddNote: () => void;
  composerSlot?: React.ReactNode;
  editingNoteId: string | null;
  editedContent: string;
  onEditContentChange: (v: string) => void;
  onEditNote: (note: MissionNote) => void;
  onSaveNote: (id: string) => void;
  onCancelEdit: () => void;
  onDeleteNote: (id: string) => void;
  currentUserInitials?: string;
}

const NoteAuthorInitials: React.FC<{ note: MissionNote }> = ({ note }) => {
  const { initials } = useDecryptedUserName(
    note.createdBy ? { id: note.createdBy, displayName: note.createdByName } : { displayName: note.createdByName },
    note.createdByName.slice(0, 2).toUpperCase()
  );
  return <>{initials || note.createdByName.slice(0, 2).toUpperCase()}</>;
};

export const MissionNotesTabV2: React.FC<MissionNotesTabV2Props> = ({
  notes,
  loading,
  canWrite,
  newNote,
  onNewNoteChange,
  onAddNote,
  composerSlot,
  editingNoteId,
  editedContent,
  onEditContentChange,
  onEditNote,
  onSaveNote,
  onCancelEdit,
  onDeleteNote,
  currentUserInitials = 'MO',
}) => (
  <CollapsiblePanel title={`Notes (${notes.length})`}>
    {canWrite && (
      <Box sx={{ display: 'flex', gap: 1.5, mb: 2 }}>
        <Box
          sx={{
            width: 32,
            height: 32,
            borderRadius: 999,
            bgcolor: tokens.colors.brandNavy,
            color: '#fff',
            fontSize: 11,
            fontWeight: 700,
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
            mt: 0.5,
          }}
        >
          {currentUserInitials}
        </Box>
        <Box sx={{ flex: 1 }}>
          {composerSlot || (
            <TextField
              multiline
              minRows={3}
              fullWidth
              value={newNote}
              onChange={(e) => onNewNoteChange(e.target.value)}
              placeholder="Ajouter une note… utilisez @ pour mentionner un membre"
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: tokens.radius.md,
                  fontSize: 13,
                },
              }}
            />
          )}
          <Button
            size="small"
            variant="contained"
            disabled={!newNote.trim()}
            onClick={onAddNote}
            sx={{
              mt: 1,
              textTransform: 'none',
              bgcolor: tokens.colors.brandTeal,
              borderRadius: '6px',
              '&:hover': { bgcolor: tokens.colors.brandTeal, filter: 'brightness(0.95)' },
            }}
          >
            Publier
          </Button>
        </Box>
      </Box>
    )}

    {loading ? (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress size={24} />
      </Box>
    ) : notes.length === 0 ? (
      <Typography sx={{ fontSize: 13, color: tokens.colors.gray400, textAlign: 'center', py: 4 }}>
        Aucune note pour le moment
      </Typography>
    ) : (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {notes.map((note) => (
          <Box key={note.id} sx={{ display: 'flex', gap: 1.5 }}>
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: 999,
                bgcolor: tokens.colors.gray200,
                color: tokens.colors.gray700,
                fontSize: 11,
                fontWeight: 700,
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
              }}
            >
              <NoteAuthorInitials note={note} />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                <UserReferenceText
                  userId={note.createdBy}
                  name={note.createdByName}
                  fallback="Utilisateur"
                  sx={{ fontSize: 13, fontWeight: 600, color: tokens.colors.gray900 }}
                />
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Typography sx={{ fontSize: 11, color: tokens.colors.gray400 }}>
                    {note.createdAt.toLocaleDateString('fr-FR')}
                  </Typography>
                  {canWrite && (
                    <IconButton size="small" onClick={() => onEditNote(note)}>
                      <MoreIcon sx={{ fontSize: 16, color: tokens.colors.gray400 }} />
                    </IconButton>
                  )}
                </Box>
              </Box>
              {editingNoteId === note.id ? (
                <Box>
                  <TextField
                    multiline
                    minRows={3}
                    fullWidth
                    value={editedContent}
                    onChange={(e) => onEditContentChange(e.target.value)}
                    sx={{ mb: 1 }}
                  />
                  <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                    <Button size="small" onClick={onCancelEdit} sx={{ textTransform: 'none' }}>Annuler</Button>
                    <Button size="small" variant="contained" onClick={() => onSaveNote(note.id)} sx={{ textTransform: 'none' }}>
                      Enregistrer
                    </Button>
                    <Button size="small" color="error" onClick={() => onDeleteNote(note.id)} sx={{ textTransform: 'none' }}>
                      Supprimer
                    </Button>
                  </Box>
                </Box>
              ) : (
                <Typography sx={{ fontSize: 13, color: tokens.colors.gray700, whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>
                  {note.content}
                </Typography>
              )}
            </Box>
          </Box>
        ))}
      </Box>
    )}
  </CollapsiblePanel>
);
