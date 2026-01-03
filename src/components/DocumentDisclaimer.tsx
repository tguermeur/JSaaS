import React from 'react';
import {
  Box,
  Paper,
  Typography,
  Alert,
  AlertTitle
} from '@mui/material';
import {
  Info as InfoIcon
} from '@mui/icons-material';

interface DocumentDisclaimerProps {
  retentionYears?: number; // Nombre d'années de conservation après la fin de la mission
}

const DocumentDisclaimer: React.FC<DocumentDisclaimerProps> = ({ retentionYears = 5 }) => {
  return (
    <Box sx={{ mb: 3 }}>
      <Alert 
        severity="info" 
        icon={<InfoIcon />}
        sx={{
          borderRadius: '8px',
          '& .MuiAlert-message': {
            width: '100%'
          }
        }}
      >
        <AlertTitle sx={{ fontWeight: 600, mb: 1 }}>
          Clause de responsabilité - Conservation des documents
        </AlertTitle>
        <Typography variant="body2" component="div" sx={{ lineHeight: 1.8 }}>
          <strong>Durée de conservation :</strong> La plateforme conserve vos documents administratifs 
          (bulletins, contrats) pendant la durée de votre mission plus {retentionYears} années supplémentaires.
          <br /><br />
          <strong>Responsabilité de l'utilisateur :</strong> Il est de votre responsabilité de télécharger 
          et d'archiver personnellement vos documents sur un support durable. La plateforme ne garantit 
          pas la conservation permanente de vos documents au-delà de la période mentionnée ci-dessus.
          <br /><br />
          <strong>Intégrité des documents :</strong> Les documents PDF générés par la plateforme sont 
          au format standard et ne sont pas modifiables. Les documents signés électroniquement sont 
          verrouillés et garantissent l'intégrité du contenu.
        </Typography>
      </Alert>
    </Box>
  );
};

export default DocumentDisclaimer;


