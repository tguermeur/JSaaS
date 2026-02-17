import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
  getAmbassadorUsers,
  getAmbassadorInvites,
  getExistingUserEmails,
  deleteAmbassadorInvite,
  removeAmbassadorFromUser,
} from '../../services/ambassadorService';
import { decryptUsersList } from '../../utils/decryptUserUtils';
import {
  Person as PersonIcon,
  Mail as MailIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';

const appleFont = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

interface AmbassadorUser {
  id: string;
  email?: string;
  displayName?: string;
  structureId?: string;
  isAmbassador?: boolean;
  [k: string]: any;
}

interface AmbassadorInvite {
  id: string;
  email: string;
  invitedBy: string;
  structureId?: string | null;
  createdAt: any;
  status: string;
}

export const AmbassadorListTab: React.FC = () => {
  const { userData, currentUser } = useAuth();
  const [users, setUsers] = useState<AmbassadorUser[]>([]);
  const [invites, setInvites] = useState<AmbassadorInvite[]>([]);
  const [pendingInvites, setPendingInvites] = useState<AmbassadorInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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

  const load = useCallback(async () => {
      setLoading(true);
      setError(null);
      try {
        const [usersList, invitesList] = await Promise.all([
          getAmbassadorUsers(structureId),
          getAmbassadorInvites(structureId, structureId ? undefined : invitedBy),
        ]);
        const usersDecrypted = await decryptUsersList(usersList as Array<{ id: string; displayName?: string; firstName?: string; lastName?: string }>);
        setUsers(usersDecrypted as AmbassadorUser[]);

        const emails = invitesList.map((i) => i.email);
        const existing = await getExistingUserEmails(emails);
        const pending = invitesList.filter((i) => !existing.has(i.email.toLowerCase().trim()));
        setInvites(invitesList);
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

  const handleDeleteUser = async () => {
    if (!confirmDelete || confirmDelete.type !== 'user') return;
    const id = confirmDelete.id;
    setConfirmDelete(null);
    setDeletingUserId(id);
    setDeleteError(null);
    try {
      await removeAmbassadorFromUser(id);
      await load();
    } catch (e: any) {
      setDeleteError(e?.message || 'Erreur lors du retrait.');
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
    } catch (e: any) {
      setDeleteError(e?.message || 'Erreur lors de la suppression.');
    } finally {
      setDeletingInviteId(null);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '96px 0' }}>
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              display: 'inline-block',
              width: 48,
              height: 48,
              border: '4px solid #f3f4f6',
              borderTopColor: '#2563eb',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              marginBottom: 16,
            }}
          />
          <p style={{ color: '#6b7280', fontSize: 16, fontFamily: appleFont, margin: 0 }}>
            Chargement des ambassadeurs...
          </p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 32, textAlign: 'center' }}>
        <div
          style={{
            display: 'inline-block',
            padding: 16,
            backgroundColor: '#fef2f2',
            borderRadius: 16,
            border: '1px solid #fecaca',
          }}
        >
          <p style={{ color: '#dc2626', margin: 0, fontFamily: appleFont }}>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      {deleteError && (
        <div
          style={{
            padding: '12px 16px',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: 12,
            color: '#dc2626',
            fontSize: 14,
            fontFamily: appleFont,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <span>{deleteError}</span>
          <button
            type="button"
            onClick={() => setDeleteError(null)}
            style={{
              padding: '4px 8px',
              border: 'none',
              background: 'transparent',
              color: '#dc2626',
              cursor: 'pointer',
              fontSize: 13,
              fontFamily: appleFont,
            }}
          >
            Fermer
          </button>
        </div>
      )}
      {/* Ambassadeurs (users avec tag) */}
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: 20,
          padding: 24,
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          border: '1px solid #f3f4f6',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <CheckCircleIcon sx={{ fontSize: 24, color: '#10b981' }} />
          <h3 style={{ fontSize: 20, fontWeight: 600, color: '#111827', fontFamily: appleFont, margin: 0 }}>
            Ambassadeurs ({users.length})
          </h3>
        </div>
        <p style={{ fontSize: 14, color: '#6b7280', fontFamily: appleFont, margin: '0 0 20px 0' }}>
          Utilisateurs avec le tag Ambassadeur.
        </p>
        {users.length === 0 ? (
          <p style={{ color: '#9ca3af', fontSize: 14, fontFamily: appleFont, margin: 0 }}>
            Aucun ambassadeur pour le moment.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {users.map((u) => (
              <div
                key={u.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '14px 16px',
                  backgroundColor: '#f9fafb',
                  borderRadius: 12,
                  border: '1px solid #f3f4f6',
                }}
              >
                <PersonIcon sx={{ fontSize: 20, color: '#6b7280' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 500, color: '#111827', fontFamily: appleFont }}>
                    {u.displayName || 'Sans nom'}
                  </div>
                  <div style={{ fontSize: 13, color: '#6b7280', fontFamily: appleFont }}>
                    {u.email || '—'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setConfirmDelete({
                      type: 'user',
                      id: u.id,
                      label: u.displayName || u.email || 'Cet ambassadeur',
                    })
                  }
                  disabled={deletingUserId === u.id}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 10,
                    border: '1px solid #fecaca',
                    background: deletingUserId === u.id ? '#fef2f2' : '#fff',
                    color: '#dc2626',
                    cursor: deletingUserId === u.id ? 'not-allowed' : 'pointer',
                    fontSize: 13,
                    fontFamily: appleFont,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                  title="Retirer le statut ambassadeur"
                >
                  <DeleteIcon sx={{ fontSize: 18 }} />
                  Retirer
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Invités (emails sans compte) */}
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: 20,
          padding: 24,
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          border: '1px solid #f3f4f6',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <ScheduleIcon sx={{ fontSize: 24, color: '#f59e0b' }} />
          <h3 style={{ fontSize: 20, fontWeight: 600, color: '#111827', fontFamily: appleFont, margin: 0 }}>
            Invités en attente ({pendingInvites.length})
          </h3>
        </div>
        <p style={{ fontSize: 14, color: '#6b7280', fontFamily: appleFont, margin: '0 0 20px 0' }}>
          Personnes invitées par email qui n&apos;ont pas encore créé de compte.
        </p>
        {pendingInvites.length === 0 ? (
          <p style={{ color: '#9ca3af', fontSize: 14, fontFamily: appleFont, margin: 0 }}>
            Aucune invitation en attente.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {pendingInvites.map((i) => (
              <div
                key={i.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '14px 16px',
                  backgroundColor: '#fffbeb',
                  borderRadius: 12,
                  border: '1px solid #fde68a',
                }}
              >
                <MailIcon sx={{ fontSize: 20, color: '#d97706' }} />
                <div style={{ flex: 1, fontSize: 15, color: '#111827', fontFamily: appleFont }}>
                  {i.email}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setConfirmDelete({
                      type: 'invite',
                      id: i.id,
                      label: i.email,
                    })
                  }
                  disabled={deletingInviteId === i.id}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 10,
                    border: '1px solid #fecaca',
                    background: deletingInviteId === i.id ? '#fef2f2' : '#fff',
                    color: '#dc2626',
                    cursor: deletingInviteId === i.id ? 'not-allowed' : 'pointer',
                    fontSize: 13,
                    fontFamily: appleFont,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                  title="Supprimer l'invitation"
                >
                  <DeleteIcon sx={{ fontSize: 18 }} />
                  Supprimer
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Confirmation suppression */}
      {confirmDelete && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
          onClick={() => setConfirmDelete(null)}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 16,
              padding: 24,
              maxWidth: 400,
              width: '90%',
              boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <p style={{ fontFamily: appleFont, fontSize: 16, color: '#111827', margin: '0 0 20px 0' }}>
              {confirmDelete.type === 'user'
                ? `Retirer le statut ambassadeur de "${confirmDelete.label}" ?`
                : `Supprimer l'invitation pour "${confirmDelete.label}" ?`}
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                style={{
                  padding: '10px 18px',
                  borderRadius: 10,
                  border: '1px solid #e5e7eb',
                  background: '#fff',
                  color: '#374151',
                  cursor: 'pointer',
                  fontSize: 14,
                  fontFamily: appleFont,
                }}
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={confirmDelete.type === 'user' ? handleDeleteUser : handleDeleteInvite}
                style={{
                  padding: '10px 18px',
                  borderRadius: 10,
                  border: 'none',
                  background: '#dc2626',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: 14,
                  fontFamily: appleFont,
                }}
              >
                {confirmDelete.type === 'user' ? 'Retirer' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
