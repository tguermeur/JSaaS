import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import GroupOutlinedIcon from '@mui/icons-material/GroupOutlined';
import { useAuth } from '../../contexts/AuthContext';
import {
  getAmbassadorUsers,
  getAmbassadorInvites,
  getExistingUserEmails,
  deleteAmbassadorInvite,
  removeAmbassadorFromUser,
  getAmbassadorPositionedDays,
} from '../../services/ambassadorService';
import { decryptUsersList, isEncryptedField } from '../../utils/decryptUserUtils';
import { useDecryptedUserName } from '../../hooks/useDecryptedUserName';
import { useDecryptedUserContactFields } from '../../hooks/useDecryptedUserContactFields';
import { formatPhoneDisplay } from '../../utils/formatPhone';
import LoadingState from '../common/LoadingState';
import EmptyState from '../common/EmptyState';
import {
  AmbassadorCampusFilterBar,
  AmbassadorCardsGrid,
  AmbassadorProfileCard,
  ambassadorAvatarColor,
} from '../ds';
import { tokens } from '../../theme/tokens';

interface AmbassadorUser {
  id: string;
  email?: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  structureId?: string;
  isAmbassador?: boolean;
  program?: string;
  campus?: string;
  studyLevel?: string;
  graduationYear?: string;
  city?: string;
  address?: string;
  photoURL?: string;
  phone?: string;
  studentId?: string;
  [k: string]: unknown;
}

interface AmbassadorInvite {
  id: string;
  email: string;
  invitedBy: string;
  structureId?: string | null;
  createdAt: unknown;
  status: string;
}

const ALL_CAMPUS_ID = 'all';
const UNSET_CAMPUS_KEY = 'non-renseigne';

function getCampusKey(user: AmbassadorUser): string {
  const campus = user.campus?.trim();
  if (!campus) return UNSET_CAMPUS_KEY;
  return campus.toLowerCase();
}

function getCampusLabel(key: string): string {
  if (key === UNSET_CAMPUS_KEY) return 'Non renseigné';
  return key.charAt(0).toUpperCase() + key.slice(1);
}

function getCampusDisplay(user: AmbassadorUser): string {
  const campus = user.campus?.trim();
  if (!campus) return 'Campus non renseigné';
  return campus;
}

function getStudyYearLabel(user: AmbassadorUser): string {
  if (user.studyLevel?.trim() && !isEncryptedField(user.studyLevel)) return user.studyLevel.trim();
  if (user.graduationYear?.trim() && !isEncryptedField(user.graduationYear)) {
    return `Promo ${user.graduationYear.trim()}`;
  }
  return 'Année non renseignée';
}

function getProgramLabel(user: AmbassadorUser): string {
  const program = user.program?.trim();
  if (program && !isEncryptedField(program)) return program;
  return 'Programme non renseigné';
}

const AmbassadorUserCard: React.FC<{
  user: AmbassadorUser;
  positionedDays: number;
  onRemove?: () => void;
  removing: boolean;
}> = ({ user, positionedDays, onRemove, removing }) => {
  const { fullName, initials, loading: nameLoading } = useDecryptedUserName(user);
  const { phone, loading: phoneLoading } = useDecryptedUserContactFields(user.id, user.phone, user.studentId);

  return (
    <AmbassadorProfileCard
      initials={initials || '?'}
      avatarColor={ambassadorAvatarColor(user.id)}
      photoUrl={user.photoURL}
      name={fullName || user.email || 'Sans nom'}
      nameLoading={nameLoading}
      program={getProgramLabel(user)}
      studyYear={getStudyYearLabel(user)}
      campus={getCampusDisplay(user)}
      phone={formatPhoneDisplay(phone) || 'Non renseigné'}
      phoneLoading={phoneLoading}
      positionedDays={positionedDays}
      onRemove={onRemove}
      removing={removing}
    />
  );
};

export interface AmbassadorListTabProps {
  onInvite?: () => void;
  showInvite?: boolean;
}

export const AmbassadorListTab: React.FC<AmbassadorListTabProps> = ({
  onInvite,
  showInvite = true,
}) => {
  const { userData, currentUser, isContactWithAccess, contactPermissions } = useAuth();
  const [users, setUsers] = useState<AmbassadorUser[]>([]);
  const [pendingInvites, setPendingInvites] = useState<AmbassadorInvite[]>([]);
  const [positionedDays, setPositionedDays] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [campusFilter, setCampusFilter] = useState(ALL_CAMPUS_ID);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [deletingInviteId, setDeletingInviteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<
    | { type: 'user'; id: string; label: string }
    | { type: 'invite'; id: string; label: string }
    | null
  >(null);

  const structureId = userData?.structureId ?? null;
  const invitedBy = currentUser?.uid ?? null;
  const canManage =
    !isContactWithAccess ||
    Boolean(contactPermissions?.canManageAmbassadors);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [usersList, invitesList] = await Promise.all([
        getAmbassadorUsers(structureId),
        getAmbassadorInvites(structureId, structureId ? undefined : invitedBy),
      ]);
      const usersDecrypted = await decryptUsersList(
        usersList as Array<{
          id: string;
          displayName?: string;
          firstName?: string;
          lastName?: string;
          graduationYear?: string;
          program?: string;
        }>
      );
      const ambassadorUsers = usersDecrypted as AmbassadorUser[];
      setUsers(ambassadorUsers);

      const daysMap = await getAmbassadorPositionedDays(structureId, ambassadorUsers.map((u) => u.id));
      setPositionedDays(daysMap);

      const emails = invitesList.map((i) => i.email);
      const existing = await getExistingUserEmails(emails);
      const pending = invitesList.filter((i) => !existing.has(i.email.toLowerCase().trim()));
      setPendingInvites(pending);
      setDeleteError(null);
    } catch (err) {
      console.error('Erreur chargement ambassadeurs:', err);
      setError('Impossible de charger les ambassadeurs.');
    } finally {
      setLoading(false);
    }
  }, [structureId, invitedBy]);

  useEffect(() => {
    load();
  }, [load]);

  const campusOptions = useMemo(() => {
    const counts = new Map<string, number>();
    users.forEach((user) => {
      const key = getCampusKey(user);
      counts.set(key, (counts.get(key) || 0) + 1);
    });

    const sortedKeys = [...counts.keys()].sort((a, b) => {
      if (a === UNSET_CAMPUS_KEY) return 1;
      if (b === UNSET_CAMPUS_KEY) return -1;
      return getCampusLabel(a).localeCompare(getCampusLabel(b), 'fr');
    });

    return [
      { id: ALL_CAMPUS_ID, label: 'Tous les campus', count: users.length },
      ...sortedKeys.map((key) => ({
        id: key,
        label: getCampusLabel(key),
        count: counts.get(key) || 0,
      })),
    ];
  }, [users]);

  const filteredUsers = useMemo(() => {
    if (campusFilter === ALL_CAMPUS_ID) return users;
    return users.filter((user) => getCampusKey(user) === campusFilter);
  }, [users, campusFilter]);

  const handleDeleteUser = async () => {
    if (!confirmDelete || confirmDelete.type !== 'user') return;
    const id = confirmDelete.id;
    setConfirmDelete(null);
    setDeletingUserId(id);
    setDeleteError(null);
    try {
      await removeAmbassadorFromUser(id);
      await load();
    } catch (e: unknown) {
      setDeleteError(e instanceof Error ? e.message : 'Erreur lors du retrait.');
    } finally {
      setDeletingUserId(null);
    }
  };

  const handleDeleteInvite = async () => {
    if (!confirmDelete || confirmDelete.type !== 'invite') return;
    const id = confirmDelete.id;
    setConfirmDelete(null);
    setDeletingInviteId(id);
    setDeleteError(null);
    try {
      await deleteAmbassadorInvite(id);
      await load();
    } catch (e: unknown) {
      setDeleteError(e instanceof Error ? e.message : 'Erreur lors de la suppression.');
    } finally {
      setDeletingInviteId(null);
    }
  };

  if (loading) {
    return <LoadingState message="Chargement des ambassadeurs..." />;
  }

  if (error) {
    return (
      <Box sx={{ py: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <Box>
      {deleteError && (
        <Alert severity="error" onClose={() => setDeleteError(null)} sx={{ mb: 2 }}>
          {deleteError}
        </Alert>
      )}

      <AmbassadorCampusFilterBar
        options={campusOptions}
        value={campusFilter}
        onChange={setCampusFilter}
      />

      {filteredUsers.length === 0 ? (
        <EmptyState
          icon={<GroupOutlinedIcon />}
          title="Aucun ambassadeur"
          description={
            campusFilter === ALL_CAMPUS_ID
              ? 'Invitez des membres à rejoindre le programme ambassadeur.'
              : 'Aucun ambassadeur pour ce campus.'
          }
          action={
            showInvite && canManage && onInvite
              ? { label: 'Inviter un ambassadeur', onClick: onInvite }
              : undefined
          }
        />
      ) : (
        <AmbassadorCardsGrid>
          {filteredUsers.map((user) => (
            <AmbassadorUserCard
              key={user.id}
              user={user}
              positionedDays={positionedDays.get(user.id) || 0}
              onRemove={
                canManage
                  ? () =>
                      setConfirmDelete({
                        type: 'user',
                        id: user.id,
                        label: user.displayName || user.email || 'Cet ambassadeur',
                      })
                  : undefined
              }
              removing={deletingUserId === user.id}
            />
          ))}
        </AmbassadorCardsGrid>
      )}

      {pendingInvites.length > 0 && (
        <Box sx={{ mt: 4 }}>
          <Typography sx={{ fontSize: 15, fontWeight: 600, color: tokens.colors.gray900, mb: 0.5 }}>
            Invités en attente ({pendingInvites.length})
          </Typography>
          <Typography sx={{ fontSize: 13, color: tokens.colors.gray500, mb: 1.5 }}>
            Personnes invitées par email qui n&apos;ont pas encore créé de compte.
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {pendingInvites.map((invite) => (
              <Box
                key={invite.id}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  px: 2,
                  py: 1.25,
                  bgcolor: tokens.colors.warningLight,
                  border: `1px solid ${tokens.colors.warning}44`,
                  borderRadius: tokens.radius.lg,
                }}
              >
                <MailOutlineIcon sx={{ fontSize: 18, color: tokens.colors.warning, flexShrink: 0 }} />
                <Typography sx={{ flex: 1, fontSize: 14, color: tokens.colors.gray900 }}>
                  {invite.email}
                </Typography>
                {canManage && (
                  <Button
                    size="small"
                    color="error"
                    startIcon={<DeleteOutlineIcon />}
                    onClick={() =>
                      setConfirmDelete({
                        type: 'invite',
                        id: invite.id,
                        label: invite.email,
                      })
                    }
                    disabled={deletingInviteId === invite.id}
                    sx={{ textTransform: 'none', fontWeight: 500, fontSize: 13 }}
                  >
                    Supprimer
                  </Button>
                )}
              </Box>
            ))}
          </Box>
        </Box>
      )}

      <Dialog open={Boolean(confirmDelete)} onClose={() => setConfirmDelete(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontSize: 16, fontWeight: 600 }}>
          {confirmDelete?.type === 'user' ? 'Retirer l\'ambassadeur' : 'Supprimer l\'invitation'}
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 14, color: tokens.colors.gray600 }}>
            {confirmDelete?.type === 'user'
              ? `Retirer le statut ambassadeur de « ${confirmDelete.label} » ?`
              : `Supprimer l'invitation pour « ${confirmDelete?.label} » ?`}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmDelete(null)} sx={{ textTransform: 'none' }}>
            Annuler
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={confirmDelete?.type === 'user' ? handleDeleteUser : handleDeleteInvite}
            sx={{ textTransform: 'none' }}
          >
            {confirmDelete?.type === 'user' ? 'Retirer' : 'Supprimer'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
