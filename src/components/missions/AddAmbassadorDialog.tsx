import React, { useState, useCallback } from 'react';
import { inviteAmbassador } from '../../services/ambassadorService';
import { useAuth } from '../../contexts/AuthContext';

interface AddAmbassadorDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const appleFont = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

function isValidEmail(s: string): boolean {
  const t = (s || '').trim();
  return t.length > 0 && t.includes('@');
}

function normalizeEmail(s: string): string {
  return (s || '').trim().toLowerCase();
}

type ResultKind = 'updated' | 'invited' | 'invitedNoEmail' | 'error';

interface ResultItem {
  email: string;
  kind: ResultKind;
  message?: string;
}

export const AddAmbassadorDialog: React.FC<AddAmbassadorDialogProps> = ({
  open,
  onClose,
  onSuccess,
}) => {
  const { currentUser, userData, isContactWithAccess } = useAuth();
  const [emails, setEmails] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<ResultItem[] | null>(null);
  const [emailFailed, setEmailFailed] = useState(false);

  const addEmail = useCallback(() => {
    const v = normalizeEmail(inputValue);
    if (!isValidEmail(v)) return;
    setEmails((prev) => (prev.includes(v) ? prev : [...prev, v]));
    setInputValue('');
    setError(null);
  }, [inputValue]);

  const removeEmail = useCallback((email: string) => {
    setEmails((prev) => prev.filter((e) => e !== email));
    setError(null);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addEmail();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResults(null);
    setEmailFailed(false);

    // Vérifier si c'est un contact avec accès (version d'essai)
    if (isContactWithAccess && userData?.status === 'entreprise') {
      setError('Version d\'essai : L\'ajout d\'ambassadeurs n\'est pas disponible pour les contacts avec accès.');
      return;
    }

    // Si aucun email dans la liste mais l'input contient un email valide, l'ajouter automatiquement
    let emailsToProcess = [...emails];
    if (emailsToProcess.length === 0) {
      const v = normalizeEmail(inputValue);
      if (isValidEmail(v)) {
        emailsToProcess = [v];
        setInputValue('');
      } else {
        setError('Ajoutez au moins une adresse email (saisir puis Entrée, ou saisir et cliquer Inviter).');
        return;
      }
    }

    setLoading(true);
    const items: ResultItem[] = [];
    let anyEmailFailed = false;

    try {
      for (const email of emailsToProcess) {
        try {
          const res = await inviteAmbassador(email, {
            invitedBy: currentUser?.uid ?? undefined,
            structureId: userData?.structureId ?? null,
          });
          const r = res as { action?: string; emailSent?: boolean; message?: string };
          if (r.action === 'updated') {
            items.push({ email, kind: 'updated' });
          } else if (r.emailSent === true) {
            items.push({ email, kind: 'invited' });
          } else {
            anyEmailFailed = true;
            items.push({ email, kind: 'invitedNoEmail', message: r.message });
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          items.push({ email, kind: 'error', message: msg });
        }
      }

      setResults(items);
      setEmailFailed(anyEmailFailed);
      setEmails([]);

      const hasError = items.some((x) => x.kind === 'error');
      if (hasError) {
        setError(`${items.filter((x) => x.kind === 'error').length} erreur(s). Voir le détail ci‑dessous.`);
      }

      const allOk = !hasError;
      if (allOk && (items.some((x) => x.kind === 'invited') || items.some((x) => x.kind === 'updated')) && !anyEmailFailed) {
        if (onSuccess) setTimeout(() => { onSuccess(); handleClose(); }, 2500);
        else setTimeout(handleClose, 2500);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur lors des invitations.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setEmails([]);
    setInputValue('');
    setError(null);
    setResults(null);
    setEmailFailed(false);
    onClose();
  };

  if (!open) return null;

  const updated = (results || []).filter((x) => x.kind === 'updated');
  const invited = (results || []).filter((x) => x.kind === 'invited');
  const invitedNoEmail = (results || []).filter((x) => x.kind === 'invitedNoEmail');
  const errors = (results || []).filter((x) => x.kind === 'error');

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        backdropFilter: 'blur(8px)',
      }}
      onClick={handleClose}
    >
      <div
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.98)',
          borderRadius: '24px',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
          maxWidth: '520px',
          width: '100%',
          padding: '32px',
          backdropFilter: 'blur(20px)',
          maxHeight: '90vh',
          overflow: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ marginBottom: '24px' }}>
          <h2
            style={{
              fontSize: '28px',
              fontWeight: 600,
              color: '#111827',
              marginBottom: '8px',
              letterSpacing: '-0.02em',
              fontFamily: appleFont,
              margin: 0,
              padding: 0,
            }}
          >
            Ajouter des Ambassadeurs
          </h2>
          <p
            style={{
              fontSize: '14px',
              color: '#6b7280',
              lineHeight: 1.6,
              margin: 0,
              fontFamily: appleFont,
            }}
          >
            Saisissez un email puis <strong>Entrée</strong> pour l’ajouter, ou cliquez directement <strong>Inviter</strong> pour le premier. Comptes existants → statut ajouté. Sinon → invitation envoyée.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: 500,
                color: '#374151',
                marginBottom: '8px',
                fontFamily: appleFont,
              }}
            >
              Adresses email
            </label>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '8px',
                padding: '10px 14px',
                borderRadius: '12px',
                border: '1px solid #e5e7eb',
                backgroundColor: '#fafafa',
                minHeight: '48px',
                alignItems: 'center',
              }}
            >
              {emails.map((email) => (
                <span
                  key={email}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 10px',
                    borderRadius: '8px',
                    backgroundColor: '#e0e7ff',
                    color: '#3730a3',
                    fontSize: '14px',
                    fontFamily: appleFont,
                  }}
                >
                  {email}
                  <button
                    type="button"
                    onClick={() => removeEmail(email)}
                    disabled={loading}
                    aria-label={`Retirer ${email}`}
                    style={{
                      padding: 0,
                      margin: 0,
                      border: 'none',
                      background: 'none',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      color: '#6366f1',
                      fontSize: '16px',
                      lineHeight: 1,
                      opacity: loading ? 0.5 : 1,
                    }}
                  >
                    ×
                  </button>
                </span>
              ))}
              <input
                type="email"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={emails.length === 0 ? 'email@exemple.com puis Entrée ou Inviter' : 'Ajouter un autre…'}
                disabled={loading}
                style={{
                  flex: 1,
                  minWidth: '160px',
                  padding: '6px 0',
                  border: 'none',
                  backgroundColor: 'transparent',
                  fontSize: '15px',
                  fontFamily: appleFont,
                  outline: 'none',
                }}
              />
            </div>
          </div>

          {error && (
            <div
              style={{
                padding: '12px',
                borderRadius: '12px',
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
              }}
            >
              <p style={{ fontSize: '14px', color: '#dc2626', margin: 0, fontFamily: appleFont }}>
                {error}
              </p>
            </div>
          )}

          {results && results.length > 0 && (
            <div
              style={{
                padding: '14px 16px',
                borderRadius: '12px',
                backgroundColor: emailFailed ? '#fffbeb' : '#f0fdf4',
                border: `1px solid ${emailFailed ? '#fcd34d' : '#bbf7d0'}`,
              }}
            >
              <p
                style={{
                  fontSize: '13px',
                  color: '#166534',
                  margin: '0 0 10px 0',
                  fontFamily: appleFont,
                  fontWeight: 600,
                }}
              >
                Comptes existants (statut ajouté) : {updated.length}
              </p>
              {updated.length > 0 && (
                <p style={{ fontSize: '13px', color: '#15803d', margin: 0, fontFamily: appleFont, wordBreak: 'break-all' }}>
                  {updated.map((x) => x.email).join(', ')}
                </p>
              )}

              <p
                style={{
                  fontSize: '13px',
                  color: '#166534',
                  margin: '16px 0 6px 0',
                  fontFamily: appleFont,
                  fontWeight: 600,
                }}
              >
                Invitations envoyées : {invited.length}
              </p>
              {invited.length > 0 && (
                <p style={{ fontSize: '13px', color: '#15803d', margin: 0, fontFamily: appleFont, wordBreak: 'break-all' }}>
                  {invited.map((x) => x.email).join(', ')}
                </p>
              )}

              {invitedNoEmail.length > 0 && (
                <>
                  <p
                    style={{
                      fontSize: '13px',
                      color: '#92400e',
                      margin: '16px 0 6px 0',
                      fontFamily: appleFont,
                      fontWeight: 600,
                    }}
                  >
                    Invitations enregistrées (email non envoyé) : {invitedNoEmail.length}
                  </p>
                  <p style={{ fontSize: '13px', color: '#b45309', margin: 0, fontFamily: appleFont, wordBreak: 'break-all' }}>
                    {invitedNoEmail.map((x) => x.email).join(', ')}
                  </p>
                </>
              )}

              {errors.length > 0 && (
                <>
                  <p
                    style={{
                      fontSize: '13px',
                      color: '#b91c1c',
                      margin: '16px 0 6px 0',
                      fontFamily: appleFont,
                      fontWeight: 600,
                    }}
                  >
                    Erreurs : {errors.length}
                  </p>
                  <ul style={{ fontSize: '13px', color: '#dc2626', margin: 0, paddingLeft: '20px', fontFamily: appleFont }}>
                    {errors.map((x) => (
                      <li key={x.email}>
                        {x.email} : {x.message || 'Erreur'}
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {emailFailed && (
                <p style={{ fontSize: '13px', color: '#92400e', margin: '12px 0 0 0', fontFamily: appleFont }}>
                  Fermez cette fenêtre quand vous avez fini de lire.
                </p>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: '12px', paddingTop: '4px' }}>
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              style={{
                flex: 1,
                padding: '12px 24px',
                borderRadius: '12px',
                fontWeight: 500,
                fontSize: '15px',
                color: '#374151',
                backgroundColor: '#f3f4f6',
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontFamily: appleFont,
                transition: 'all 0.2s',
                opacity: loading ? 0.5 : 1,
              }}
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading || (emails.length === 0 && !isValidEmail(normalizeEmail(inputValue)))}
              style={{
                flex: 1,
                padding: '12px 24px',
                borderRadius: '12px',
                fontWeight: 500,
                fontSize: '15px',
                color: 'white',
                backgroundColor: loading || (emails.length === 0 && !isValidEmail(normalizeEmail(inputValue))) ? '#9ca3af' : '#2563eb',
                border: 'none',
                cursor: loading || (emails.length === 0 && !isValidEmail(normalizeEmail(inputValue))) ? 'not-allowed' : 'pointer',
                fontFamily: appleFont,
                transition: 'all 0.2s',
                boxShadow: loading || (emails.length === 0 && !isValidEmail(normalizeEmail(inputValue))) ? 'none' : '0 4px 12px rgba(37, 99, 235, 0.3)',
                opacity: loading || (emails.length === 0 && !isValidEmail(normalizeEmail(inputValue))) ? 0.5 : 1,
              }}
            >
              {loading ? 'Envoi…' : `Inviter (${emails.length > 0 ? emails.length : (isValidEmail(normalizeEmail(inputValue)) ? 1 : 0)})`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
