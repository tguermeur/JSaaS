import React, { useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { tokens } from '../theme/tokens';

interface DocumentDisclaimerProps {
  retentionYears?: number;
}

const DocumentDisclaimer: React.FC<DocumentDisclaimerProps> = ({ retentionYears = 5 }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <Box sx={{ mb: 1.5 }}>
      <Accordion
        disableGutters
        elevation={0}
        expanded={expanded}
        onChange={(_, next) => setExpanded(next)}
        sx={{
          border: `1px solid ${tokens.colors.gray100}`,
          borderRadius: `${tokens.radius.sm} !important`,
          bgcolor: tokens.colors.gray50,
          '&:before': { display: 'none' },
        }}
      >
        <AccordionSummary
          expandIcon={<ExpandMoreIcon sx={{ fontSize: 16, color: tokens.colors.gray500 }} />}
          sx={{
            minHeight: 32,
            px: 1.25,
            py: 0,
            '& .MuiAccordionSummary-content': {
              my: 0.5,
              margin: '4px 0 !important',
            },
          }}
        >
          <Typography
            sx={{
              fontSize: 11,
              fontWeight: 500,
              color: tokens.colors.gray600,
              lineHeight: 1.3,
            }}
          >
            Clause de responsabilité — Conservation des documents
          </Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ px: 1.25, pt: 0, pb: 1.25 }}>
          <Typography
            component="div"
            sx={{ fontSize: 11, color: tokens.colors.gray600, lineHeight: 1.55 }}
          >
            <Box component="span" sx={{ fontWeight: 600 }}>
              Durée de conservation :
            </Box>{' '}
            La plateforme conserve vos documents administratifs (bulletins, contrats) pendant la
            durée de votre mission plus {retentionYears} années supplémentaires.
            <Box component="p" sx={{ m: '6px 0 0' }}>
              <Box component="span" sx={{ fontWeight: 600 }}>
                Responsabilité :
              </Box>{' '}
              Il est de votre responsabilité de télécharger et d&apos;archiver personnellement vos
              documents. La plateforme ne garantit pas la conservation permanente au-delà de cette
              période.
            </Box>
            <Box component="p" sx={{ m: '6px 0 0' }}>
              <Box component="span" sx={{ fontWeight: 600 }}>
                Intégrité :
              </Box>{' '}
              Les PDF générés ne sont pas modifiables ; les documents signés électroniquement sont
              verrouillés.
            </Box>
          </Typography>
        </AccordionDetails>
      </Accordion>
    </Box>
  );
};

export default DocumentDisclaimer;
