import React, { useEffect, useState } from 'react';
import { Box, LinearProgress, Grid, Typography, CircularProgress } from '@mui/material';
import { ref, listAll, getMetadata } from 'firebase/storage';
import { useAuth } from '../../contexts/AuthContext';
import { getFirestore, doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { storage } from '../../firebase/config';
import { settingsPageStyles, SettingsPanel } from '../../components/ds';
import { tokens } from '../../theme/tokens';
import { Storage as StorageIcon } from '@mui/icons-material';

const Storage: React.FC = () => {
  const [storageInfo, setStorageInfo] = useState({
    used: 0, // en Go
    total: 10, // Limite en Go
    percentage: 0,
    fileCount: 0
  });
  const [loading, setLoading] = useState(true);
  const { currentUser } = useAuth();

  // Fonction récursive pour lister tous les fichiers dans un répertoire
  const listAllFilesRecursive = async (storageRef: any): Promise<{ size: number; count: number }> => {
    let totalSize = 0;
    let fileCount = 0;

    try {
      const result = await listAll(storageRef);
      
      // Compter les fichiers directs
      const filePromises = result.items.map(async (item) => {
        try {
          const metadata = await getMetadata(item);
          fileCount++;
          return metadata.size;
        } catch (error) {
          console.error('Erreur lors de la récupération des métadonnées:', error);
          return 0;
        }
      });

      const sizes = await Promise.all(filePromises);
      totalSize += sizes.reduce((acc, size) => acc + size, 0);

      // Parcourir récursivement les sous-dossiers
      const folderPromises = result.prefixes.map(async (prefix) => {
        const subResult = await listAllFilesRecursive(prefix);
        return subResult;
      });

      const subResults = await Promise.all(folderPromises);
      subResults.forEach((subResult) => {
        totalSize += subResult.size;
        fileCount += subResult.count;
      });
    } catch (error) {
      console.error('Erreur lors du listage récursif:', error);
    }

    return { size: totalSize, count: fileCount };
  };

  useEffect(() => {
    const fetchStorageInfo = async () => {
      try {
        if (!currentUser || !storage) {
          setLoading(false);
          return;
        }

        setLoading(true);

        // Récupérer l'ID de la structure de l'utilisateur
        const db = getFirestore();
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        const userData = userDoc.data();
        
        if (!userData?.structureId) {
          console.error('Aucune structure associée à cet utilisateur');
          setLoading(false);
          return;
        }

        const structureId = userData.structureId;
        let totalSize = 0;
        let totalFileCount = 0;
        const countedFiles = new Set<string>(); // Pour éviter les doublons

        // 1. Parcourir récursivement tous les fichiers dans structures/{structureId}
        try {
          const structuresRef = ref(storage, `structures/${structureId}`);
          const structuresResult = await listAllFilesRecursive(structuresRef);
          totalSize += structuresResult.size;
          totalFileCount += structuresResult.count;
          console.log(`📁 Structures (Storage): ${structuresResult.count} fichiers, ${(structuresResult.size / (1024 * 1024 * 1024)).toFixed(4)} Go`);
        } catch (error: any) {
          if (error?.code !== 'storage/object-not-found' && error?.code !== 'storage/unauthorized') {
            console.error('Erreur lors du scan des structures:', error);
          }
        }

        // 2. Récupérer toutes les missions de la structure
        try {
          const missionsRef = collection(db, 'missions');
          const missionsQuery = query(
            missionsRef,
            where('structureId', '==', structureId)
          );
          const missionsSnapshot = await getDocs(missionsQuery);
          
          console.log(`📋 ${missionsSnapshot.docs.length} missions trouvées pour la structure ${structureId}`);
          
          // 3. Parcourir récursivement tous les fichiers dans missions/{missionId} pour chaque mission
          const missionPromises = missionsSnapshot.docs.map(async (missionDoc) => {
            const missionId = missionDoc.id;
            try {
              const missionsStorageRef = ref(storage, `missions/${missionId}`);
              const missionResult = await listAllFilesRecursive(missionsStorageRef);
              console.log(`📋 Mission ${missionId}: ${missionResult.count} fichiers, ${(missionResult.size / (1024 * 1024 * 1024)).toFixed(4)} Go`);
              return missionResult;
            } catch (error: any) {
              // Si le dossier n'existe pas, ce n'est pas une erreur grave
              if (error?.code === 'storage/object-not-found' || error?.code === 'storage/unauthorized') {
                console.log(`⚠️ Mission ${missionId}: aucun fichier dans Storage`);
                return { size: 0, count: 0 };
              }
              console.error(`Erreur lors du scan de la mission ${missionId}:`, error);
              return { size: 0, count: 0 };
            }
          });

          const missionResults = await Promise.all(missionPromises);
          missionResults.forEach((result) => {
            totalSize += result.size;
            totalFileCount += result.count;
          });
        } catch (error) {
          console.error('Erreur lors de la récupération des missions:', error);
        }

        // 4. Récupérer tous les documents générés depuis Firestore (generatedDocuments)
        // Ces documents sont stockés dans missions/{missionId}/documents/ dans Storage
        // mais référencés dans generatedDocuments dans Firestore
        try {
          const generatedDocsRef = collection(db, 'generatedDocuments');
          const generatedDocsQuery = query(
            generatedDocsRef,
            where('structureId', '==', structureId)
          );
          const generatedDocsSnapshot = await getDocs(generatedDocsQuery);
          
          console.log(`📄 ${generatedDocsSnapshot.docs.length} documents générés trouvés dans Firestore`);
          
          let generatedDocsSize = 0;
          let generatedDocsCount = 0;
          
          generatedDocsSnapshot.docs.forEach((docSnap) => {
            const data = docSnap.data();
            if (data.fileSize && data.fileSize > 0) {
              // Extraire le chemin du fileUrl pour éviter les doublons
              const fileUrl = data.fileUrl || '';
              const urlKey = fileUrl.split('?')[0]; // Enlever les paramètres de requête
              
              if (!countedFiles.has(urlKey)) {
                generatedDocsSize += data.fileSize;
                generatedDocsCount++;
                countedFiles.add(urlKey);
                console.log(`  - ${data.fileName}: ${(data.fileSize / (1024 * 1024)).toFixed(2)} MB`);
              }
            }
          });
          
          totalSize += generatedDocsSize;
          totalFileCount += generatedDocsCount;
          console.log(`📄 Documents générés (Firestore): ${generatedDocsCount} fichiers, ${(generatedDocsSize / (1024 * 1024 * 1024)).toFixed(4)} Go`);
        } catch (error) {
          console.error('Erreur lors de la récupération des documents générés:', error);
        }

        // 5. Récupérer tous les documents de structure depuis Firestore
        // Ces documents sont stockés dans structures/{structureId}/documents/ dans Storage
        try {
          const structureDocsRef = collection(db, 'structures', structureId, 'documents');
          const structureDocsSnapshot = await getDocs(structureDocsRef);
          
          console.log(`📁 ${structureDocsSnapshot.docs.length} documents de structure trouvés dans Firestore`);
          
          let structureDocsSize = 0;
          let structureDocsCount = 0;
          
          structureDocsSnapshot.docs.forEach((docSnap) => {
            const data = docSnap.data();
            if (data.size && data.size > 0) {
              // Utiliser storagePath ou construire le chemin
              const storagePath = data.storagePath || `structures/${structureId}/documents/${data.name}`;
              const urlKey = data.url ? data.url.split('?')[0] : storagePath;
              
              if (!countedFiles.has(urlKey)) {
                structureDocsSize += data.size;
                structureDocsCount++;
                countedFiles.add(urlKey);
                console.log(`  - ${data.name}: ${(data.size / (1024 * 1024)).toFixed(2)} MB`);
              }
            }
          });
          
          totalSize += structureDocsSize;
          totalFileCount += structureDocsCount;
          console.log(`📁 Documents de structure (Firestore): ${structureDocsCount} fichiers, ${(structureDocsSize / (1024 * 1024 * 1024)).toFixed(4)} Go`);
        } catch (error) {
          console.error('Erreur lors de la récupération des documents de structure:', error);
        }
        
        // Convertir en Go
        const usedSpaceGB = totalSize / (1024 * 1024 * 1024);
        const totalGB = 10; // Limite de 10 Go
        
        setStorageInfo({
          used: Number(usedSpaceGB.toFixed(2)),
          total: totalGB,
          percentage: Math.min((usedSpaceGB / totalGB) * 100, 100),
          fileCount: totalFileCount
        });

        console.log(`✅ Total: ${totalFileCount} fichiers, ${usedSpaceGB.toFixed(2)} Go / ${totalGB} Go`);

      } catch (error) {
        console.error('Erreur lors de la récupération des informations de stockage:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStorageInfo();
  }, [currentUser]);

  return (
    <Box>
      <Box component="header" sx={{ ...settingsPageStyles.header, px: 0, py: 0, bgcolor: 'transparent', borderBottom: 'none', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: tokens.radius.md,
              background: tokens.gradients.brand,
              display: 'grid',
              placeItems: 'center',
              color: '#fff',
              flexShrink: 0,
            }}
          >
            <StorageIcon sx={{ fontSize: 20 }} />
          </Box>
          <Box>
            <Typography sx={settingsPageStyles.eyebrow}>Paramètres</Typography>
            <Typography component="h1" sx={settingsPageStyles.title}>Gestion du stockage</Typography>
            <Typography sx={settingsPageStyles.sub}>
              Surveillez l&apos;utilisation de votre espace de stockage
            </Typography>
          </Box>
        </Box>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12}>
          <SettingsPanel title="Utilisation du stockage Firebase Storage">
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : (
              <>
                <Box sx={{ width: '100%', mb: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body1" fontWeight={500}>
                      {storageInfo.used.toFixed(2)} Go / {storageInfo.total} Go
                    </Typography>
                    <Typography variant="body1" color="text.secondary" fontWeight={500}>
                      {storageInfo.percentage.toFixed(1)}%
                    </Typography>
                  </Box>
                  
                  <LinearProgress 
                    variant="determinate" 
                    value={storageInfo.percentage}
                    sx={{ 
                      height: 10, 
                      borderRadius: 5,
                      backgroundColor: 'grey.200',
                      '& .MuiLinearProgress-bar': {
                        backgroundColor: storageInfo.percentage > 80 ? tokens.colors.error : tokens.colors.brandTeal,
                      }
                    }}
                  />
                </Box>

                <Box sx={{ mt: 3, p: 2, bgcolor: tokens.colors.gray50, borderRadius: tokens.radius.md }}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    <strong>Nombre total de fichiers :</strong> {storageInfo.fileCount.toLocaleString('fr-FR')}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    <strong>Espace utilisé :</strong> {storageInfo.used.toFixed(2)} Go
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    <strong>Espace disponible :</strong> {(storageInfo.total - storageInfo.used).toFixed(2)} Go
                  </Typography>
                </Box>

                <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                  Cette section affiche l'utilisation exacte de votre espace de stockage Firebase Storage, 
                  incluant tous les fichiers des structures et des missions. 
                  Une alerte visuelle apparaîtra lorsque l'utilisation dépassera 80%.
                </Typography>
              </>
            )}
          </SettingsPanel>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Storage;