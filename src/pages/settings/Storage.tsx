import React, { useEffect, useState } from 'react';
import { Box, LinearProgress, Grid, Typography } from '@mui/material';
import { ref, listAll, getMetadata } from 'firebase/storage';
import { useAuth } from '../../contexts/AuthContext';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { storage } from '../../firebase/config';
import SettingsPageHeader from '../../components/settings/SettingsPageHeader';
import SettingsCard from '../../components/settings/SettingsCard';
import { Storage as StorageIcon } from '@mui/icons-material';

const Storage: React.FC = () => {
  const [storageInfo, setStorageInfo] = useState({
    used: 0,
    total: 10, // Limite par défaut en GB
    percentage: 0,
    fileCount: 0
  });
  const { currentUser } = useAuth();

  useEffect(() => {
    const fetchStorageInfo = async () => {
      try {
        if (!currentUser) return;

        // Récupérer l'ID de la structure de l'utilisateur
        const db = getFirestore();
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        const userData = userDoc.data();
        
        if (!userData?.structureId) {
          console.error('Aucune structure associée à cet utilisateur');
          return;
        }

        // Accéder au stockage de la structure spécifique
        const storageRef = ref(storage, `structures/${userData.structureId}`);
        
        // Récupérer tous les fichiers et dossiers
        const result = await listAll(storageRef);
        
        let totalSize = 0;
        const filePromises = result.items.map(async (item) => {
          try {
            const metadata = await getMetadata(item);
            return metadata.size;
          } catch (error) {
            console.error('Erreur lors de la récupération des métadonnées:', error);
            return 0;
          }
        });

        // Attendre que toutes les métadonnées soient récupérées
        const sizes = await Promise.all(filePromises);
        totalSize = sizes.reduce((acc, size) => acc + size, 0);
        
        // Convertir en MB
        const usedSpace = totalSize / (1024 * 1024);
        
        setStorageInfo({
          used: Number(usedSpace.toFixed(2)),
          total: 10 * 1024, // Convertir 10 GB en MB
          percentage: (usedSpace / (10 * 1024)) * 100,
          fileCount: result.items.length
        });

      } catch (error) {
        console.error('Erreur lors de la récupération des informations de stockage:', error);
      }
    };

    fetchStorageInfo();
  }, [currentUser]);

  return (
    <Box sx={{ 
      p: 3, 
      minHeight: '100vh'
    }}>
      <SettingsPageHeader 
        title="Gestion du stockage"
        subtitle="Surveillez l'utilisation de votre espace de stockage"
        icon={<StorageIcon />}
      />

      <Grid container spacing={3}>
        <Grid item xs={12}>
          <SettingsCard title="Utilisation du stockage Firestore">
            <Box sx={{ width: '100%', mb: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body1">
                  {storageInfo.used} MB / {storageInfo.total} MB
                </Typography>
                <Typography variant="body1" color="text.secondary">
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
                    backgroundColor: storageInfo.percentage > 80 ? 'error.main' : 'primary.main'
                  }
                }}
              />
            </Box>

            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              Nombre total de fichiers : {storageInfo.fileCount}
            </Typography>

            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Cette section affiche l'utilisation de votre espace de stockage Firestore. 
              Une alerte visuelle apparaîtra lorsque l'utilisation dépassera 80%.
            </Typography>
          </SettingsCard>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Storage;