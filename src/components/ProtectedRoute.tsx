import React, { useEffect, useState, useMemo } from 'react';
import { Box } from '@mui/material';
import AccessDenied from './common/AccessDenied';
import LoadingState from './common/LoadingState';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import { type UserStatus, canAccessStructureContent, canAccessStudentContent } from '../utils/permissions';
import { isDefaultMemberReadPage } from '../utils/defaultMemberPermissions';

const DEBUG_ROUTE = import.meta.env.VITE_DEBUG_AUTH === 'true';
const FIRESTORE_TIMEOUT_MS = 8000;

async function getDocWithTimeout(
  ref: ReturnType<typeof doc>,
  timeoutMs = FIRESTORE_TIMEOUT_MS
) {
  return Promise.race([
    getDoc(ref),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Firestore timeout')), timeoutMs)
    ),
  ]);
}

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermission?: {
    pageId: string;
    accessType: 'read' | 'write';
  };
  requiresStructureAccess?: boolean;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredPermission,
  requiresStructureAccess,
}) => {
  const { currentUser, userData: contextUserData, loading: authLoading, isContactWithAccess } =
    useAuth();
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);

  const userId = currentUser?.uid;
  const userStatus = contextUserData?.status as UserStatus | undefined;
  const structureId = contextUserData?.structureId as string | undefined;

  const permissionKey = useMemo(
    () =>
      requiredPermission
        ? `${requiredPermission.pageId}:${requiredPermission.accessType}`
        : '',
    [requiredPermission?.pageId, requiredPermission?.accessType]
  );

  useEffect(() => {
    let cancelled = false;

    const finish = (access: boolean) => {
      if (cancelled) return;
      setHasAccess(access);
      setLoading(false);
    };

    const checkAccess = async () => {
      if (authLoading) return;

      setLoading(true);

      if (!userId) {
        finish(false);
        return;
      }

      const logCtx = requiredPermission
        ? { pageId: requiredPermission.pageId, accessType: requiredPermission.accessType }
        : { requiresStructureAccess };

      try {
        let finalUserData = contextUserData as Record<string, unknown> | null | undefined;
        if (!finalUserData?.status) {
          try {
            const userDoc = await getDocWithTimeout(doc(db!, 'users', userId));
            finalUserData = userDoc.exists() ? userDoc.data() : undefined;
          } catch (err) {
            console.warn('[ProtectedRoute] Lecture profil timeout/erreur:', err);
          }
        }

        const finalUserStatus = (finalUserData?.status as UserStatus) || userStatus;

        if (
          (finalUserStatus === 'admin' || finalUserStatus === 'admin_structure') &&
          finalUserData?.structureId
        ) {
          finish(true);
          return;
        }

        if (finalUserStatus === 'superadmin') {
          if (DEBUG_ROUTE) console.log('[ProtectedRoute] Accès accordé (superadmin)', logCtx);
          finish(true);
          return;
        }

        if (requiresStructureAccess !== undefined) {
          const structureAccess = requiresStructureAccess
            ? canAccessStructureContent(finalUserStatus)
            : canAccessStudentContent(finalUserStatus) ||
              canAccessStructureContent(finalUserStatus);
          finish(structureAccess);
          return;
        }

        if (
          isContactWithAccess &&
          finalUserStatus === 'entreprise' &&
          finalUserData?.companyId
        ) {
          finish(true);
          return;
        }

        if (requiredPermission && finalUserStatus === 'etudiant') {
          finish(false);
          return;
        }

        if (requiredPermission && finalUserStatus === 'entreprise') {
          const allowed =
            requiredPermission.pageId === 'dashboard' ||
            (isContactWithAccess && !!finalUserData?.companyId);
          finish(allowed);
          return;
        }

        if (requiredPermission && finalUserData?.structureId) {
          const docId =
            requiredPermission.accessType === 'read'
              ? `${requiredPermission.pageId}_read`
              : requiredPermission.pageId;

          try {
            const permissionsDoc = await getDocWithTimeout(
              doc(
                db!,
                'structures',
                finalUserData.structureId as string,
                'permissions',
                docId
              )
            );

            if (!permissionsDoc.exists()) {
              // Comportement pré-audit : membres accès aux pages CRM de base si doc absent
              const fallback =
                finalUserStatus === 'membre' &&
                requiredPermission.accessType === 'read' &&
                isDefaultMemberReadPage(requiredPermission.pageId);
              finish(fallback);
              return;
            }

            const permissions = permissionsDoc.data();
            const hasRoleAccess = permissions?.allowedRoles?.includes(finalUserStatus);
            const hasPoleAccess = ((finalUserData.poles as { poleId: string }[]) ?? []).some(
              (pole) => permissions?.allowedPoles?.includes(pole.poleId)
            );
            const hasMemberAccess = permissions?.allowedMembers?.includes(userId);
            finish(Boolean(hasRoleAccess || hasPoleAccess || hasMemberAccess));
          } catch (permissionError) {
            console.warn('[ProtectedRoute] Permissions timeout/erreur — accès membre par défaut:', permissionError);
            finish(finalUserStatus === 'membre' || finalUserStatus === 'admin');
          }
          return;
        }

        finish(true);
      } catch (error) {
        console.error('[ProtectedRoute] Erreur vérification accès:', error);
        finish(false);
      }
    };

    void checkAccess();

    return () => {
      cancelled = true;
    };
  }, [
    authLoading,
    userId,
    userStatus,
    structureId,
    permissionKey,
    requiresStructureAccess,
    isContactWithAccess,
    contextUserData?.companyId,
    contextUserData?.status,
    contextUserData?.structureId,
  ]);

  if (authLoading || loading) {
    return <LoadingState message="Vérification des permissions…" fullHeight />;
  }

  if (!hasAccess) {
    return (
      <Box sx={{ width: '100%', px: { xs: 2, sm: 3, md: 4 } }}>
        <AccessDenied />
      </Box>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;
