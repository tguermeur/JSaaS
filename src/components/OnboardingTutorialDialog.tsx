import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  alpha,
  styled,
  Slide,
  useTheme,
  IconButton,
  LinearProgress
} from '@mui/material';
import { TransitionProps } from '@mui/material/transitions';
import {
  Close as CloseIcon,
  School as SchoolIcon,
  Security as SecurityIcon,
  Dashboard as DashboardIcon,
  BusinessCenter as BusinessCenterIcon,
  Work as WorkIcon,
  Business as BusinessIcon,
  Folder as FolderIcon,
  BarChart as BarChartIcon,
  Settings as SettingsIcon,
  NavigateNext as NextIcon,
  NavigateBefore as PrevIcon,
  Check as CheckIcon,
  OpenInNew as OpenInNewIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useChangelog } from '../contexts/ChangelogContext';
import { useAuth } from '../contexts/AuthContext';

import { tokens } from '../theme/tokens';

const LOGO_BLUE = tokens.colors.primary;
const LOGO_TEAL = tokens.colors.primaryLight;

const Transition = React.forwardRef(function Transition(
  props: TransitionProps & { children: React.ReactElement<any, any> },
  ref: React.Ref<unknown>
) {
  return <Slide direction="up" ref={ref} {...props} />;
});

const StyledDialog = styled(Dialog)(({ theme }) => ({
  '& .MuiDialog-paper': {
    borderRadius: 20,
    maxWidth: 560,
    width: '95%',
    maxHeight: '90vh',
    background: theme.palette.background.paper,
    overflow: 'hidden',
    border: `2px solid ${LOGO_BLUE}`,
    boxShadow: `0 12px 40px ${alpha(LOGO_BLUE, 0.2)}`
  }
}));

const StepIconBox = styled(Box)(() => ({
  width: 56,
  height: 56,
  borderRadius: 16,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: `linear-gradient(135deg, ${LOGO_BLUE}, ${LOGO_TEAL})`,
  color: '#fff',
  boxShadow: `0 8px 24px ${alpha(LOGO_BLUE, 0.35)}`,
  '& .MuiSvgIcon-root': { fontSize: 28 }
}));

const SlideCard = styled(Box)(({ theme }) => ({
  borderRadius: 16,
  padding: theme.spacing(3),
  background: theme.palette.mode === 'dark' ? theme.palette.grey[900] : theme.palette.grey[50],
  border: `1px solid ${theme.palette.divider}`,
  minHeight: 280
}));

interface OnboardingStep {
  id: string;
  label: string;
  title: string;
  icon: React.ReactNode;
  content: React.ReactNode;
  path?: string;
  route?: string;
}

interface OnboardingTutorialDialogProps {
  open: boolean;
  onClose: (completed: boolean, step?: number) => void;
}

export default function OnboardingTutorialDialog({ open, onClose }: OnboardingTutorialDialogProps): React.ReactElement {
  const theme = useTheme();
  const navigate = useNavigate();
  const { onboardingStep } = useChangelog();
  const [activeStep, setActiveStep] = useState(0);

  React.useEffect(() => {
    if (open) setActiveStep(onboardingStep);
  }, [open, onboardingStep]);

  const steps: OnboardingStep[] = [
    {
      id: 'welcome',
      label: 'Bienvenue',
      title: 'Bienvenue sur votre plateforme',
      icon: <SchoolIcon />,
      content: (
        <>
          <Typography variant="body1" sx={{ mb: 2 }}>
            Ce tutoriel vous présente les fonctionnalités de la plateforme pour gérer votre Junior Entreprise ou Job Service.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Vous pourrez revenir à tout moment via le bouton <strong>?</strong> en haut à droite. Commençons par le plus important : les accès.
          </Typography>
        </>
      )
    },
    {
      id: 'acces',
      label: 'Gestion des accès',
      title: 'Les accès : qui voit quoi',
      icon: <SecurityIcon />,
      path: 'Réglages → Gestion des accès',
      route: '/app/settings/authorizations',
      content: (
        <>
          <Typography variant="body1" sx={{ mb: 1.5 }} fontWeight={600}>
            C’est le cœur de la configuration de votre structure.
          </Typography>
          <Typography variant="body2" sx={{ mb: 1.5 }}>
            Pour chaque page (Tableau de bord, Missions, Entreprises, Documents, Commercial, Audit, Trésorerie, RH, Ambassadeurs, etc.), vous définissez :
          </Typography>
          <Box component="ul" sx={{ m: 0, pl: 2.5, '& li': { mb: 0.5 } }}>
            <li><Typography variant="body2"><strong>Qui peut modifier</strong> (écriture) : rôles (admin, membre), pôles et/ou personnes précises.</Typography></li>
            <li><Typography variant="body2"><strong>Qui peut consulter</strong> (lecture) : même principe, souvent plus large que l’écriture.</Typography></li>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
            Par défaut, les admins ont tous les droits. Vous pouvez restreindre par pôle (ex. Trésorerie en lecture pour le président, en écriture pour le pôle Trésorerie).
          </Typography>
          <Typography variant="body2" sx={{ mt: 1.5 }} color="primary.main">
            📍 <strong>Où ?</strong> Menu de gauche → Réglages (engrenage) → Gestion des accès
          </Typography>
        </>
      )
    },
    {
      id: 'dashboard',
      label: 'Tableau de bord',
      title: 'Tableau de bord',
      icon: <DashboardIcon />,
      path: 'Menu principal',
      route: '/app/dashboard',
      content: (
        <>
          <Typography variant="body2" sx={{ mb: 1.5 }}>
            Vue d’ensemble de l’activité : missions en cours, chiffres clés, alertes. Idéal pour suivre l’activité au quotidien.
          </Typography>
          <Typography variant="body2" color="primary.main">📍 Menu → Tableau de bord</Typography>
        </>
      )
    },
    {
      id: 'organization',
      label: 'Organisation',
      title: 'Organisation',
      icon: <BusinessCenterIcon />,
      path: 'Menu principal',
      route: '/app/organization',
      content: (
        <>
          <Typography variant="body2" sx={{ mb: 1.5 }}>
            Structure de la JE : pôles, organigramme, rôles. Utile pour garder une vision claire des responsabilités.
          </Typography>
          <Typography variant="body2" color="primary.main">📍 Menu → Organisation</Typography>
        </>
      )
    },
    {
      id: 'missions',
      label: 'Missions / Études',
      title: 'Missions (ou Études)',
      icon: <WorkIcon />,
      path: 'Menu → Études ou Missions',
      route: '/app/mission',
      content: (
        <>
          <Typography variant="body2" sx={{ mb: 1.5 }}>
            Liste et suivi de toutes les missions. Création, suivi du statut, devis, facturation, documents générés. C’est le centre de la gestion opérationnelle.
          </Typography>
          <Typography variant="body2" color="primary.main">📍 Menu → Études (JE) ou Missions</Typography>
        </>
      )
    },
    {
      id: 'entreprises',
      label: 'Entreprises',
      title: 'Entreprises',
      icon: <BusinessIcon />,
      path: 'Menu principal',
      route: '/app/entreprises',
      content: (
        <>
          <Typography variant="body2" sx={{ mb: 1.5 }}>
            Annuaire des entreprises clientes : coordonnées, contacts, historique des missions. Les contacts entreprise peuvent avoir un accès limité (voir missions, candidatures).
          </Typography>
          <Typography variant="body2" color="primary.main">📍 Menu → Entreprises</Typography>
        </>
      )
    },
    {
      id: 'documents',
      label: 'Documents',
      title: 'Documents',
      icon: <FolderIcon />,
      path: 'Menu principal',
      route: '/app/documents',
      content: (
        <>
          <Typography variant="body2" sx={{ mb: 1.5 }}>
            Espace de stockage des documents de la structure (dossiers, fichiers). Les accès à cette page se gèrent comme les autres dans Réglages → Gestion des accès.
          </Typography>
          <Typography variant="body2" color="primary.main">📍 Menu → Documents</Typography>
        </>
      )
    },
    {
      id: 'poles',
      label: 'Pôles',
      title: 'Commercial, Audit, Trésorerie, RH, Ambassadeurs',
      icon: <BarChartIcon />,
      path: 'Menu principal',
      route: '/app/commercial',
      content: (
        <>
          <Typography variant="body2" sx={{ mb: 1.5 }}>
            <strong>Commercial</strong> : suivi commercial, pipeline. <strong>Audit</strong> : suivi des audits et qualité. <strong>Trésorerie</strong> : encaissements, facturation. <strong>Ressources Humaines</strong> : recrutement, profils, cotisations. <strong>Ambassadeurs</strong> : événements, créneaux, candidatures. Chaque pôle peut être restreint en lecture/écriture dans les accès.
          </Typography>
          <Typography variant="body2" color="primary.main">📍 Menu → Commercial / Audit / Trésorerie / RH / Ambassadeurs</Typography>
        </>
      )
    },
    {
      id: 'settings',
      label: 'Paramètres',
      title: 'Réglages',
      icon: <SettingsIcon />,
      path: 'Réglages (engrenage)',
      route: '/app/settings/structure',
      content: (
        <>
          <Typography variant="body2" sx={{ mb: 1 }}>
            <strong>Templates PDF</strong> : modèles de documents (contrats, factures…). <strong>Assignation des templates</strong> : lien type de mission → template. <strong>Configuration structure</strong> : nom, école, domaines email. <strong>Gestion des accès</strong> : les permissions détaillées ci-dessus. <strong>Plans d’abonnement / Facturation</strong> : abonnement et facturation. <strong>Types de mission</strong> : libellés et descriptions. <strong>Notifications</strong> : préférences.
          </Typography>
          <Typography variant="body2" color="primary.main">📍 Menu → Réglages (icône engrenage) → chaque sous-page</Typography>
        </>
      )
    },
    {
      id: 'end',
      label: 'C’est parti',
      title: 'Vous êtes prêt',
      icon: <CheckIcon />,
      content: (
        <>
          <Typography variant="body1" sx={{ mb: 1.5 }}>
            Vous avez une vue complète des fonctionnalités. Pensez à configurer les accès en priorité pour que chaque membre voie uniquement ce dont il a besoin.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Bonne découverte de la plateforme.
          </Typography>
        </>
      )
    }
  ];

  const handleNext = () => {
    if (activeStep < steps.length - 1) setActiveStep((s) => s + 1);
    else onClose(true);
  };

  const handleBack = () => {
    if (activeStep > 0) setActiveStep((s) => s - 1);
  };

  const handleClose = () => {
    onClose(false, activeStep);
  };

  const currentStep = steps[activeStep];
  const progress = ((activeStep + 1) / steps.length) * 100;

  const handleGoToPage = () => {
    if (currentStep?.route) {
      navigate(currentStep.route);
      onClose(false, activeStep);
    }
  };

  return (
    <StyledDialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      TransitionComponent={Transition}
      transitionDuration={{ enter: 350, exit: 250 }}
    >
      {/* En-tête type tutoriel : titre + progression + fermer */}
      <Box
        sx={{
          px: 3,
          pt: 2,
          pb: 1.5,
          borderBottom: 1,
          borderColor: 'divider',
          position: 'relative'
        }}
      >
        <IconButton
          onClick={handleClose}
          sx={{ position: 'absolute', right: 8, top: 8, color: 'text.secondary' }}
          size="small"
        >
          <CloseIcon />
        </IconButton>
        <Typography variant="overline" fontWeight={600} sx={{ letterSpacing: 1, color: LOGO_BLUE }}>
          Tutoriel
        </Typography>
        <Typography variant="h6" fontWeight={700} sx={{ mt: 0.25 }}>
          Utiliser la plateforme
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1.5 }}>
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{
              flex: 1,
              height: 6,
              borderRadius: 3,
              bgcolor: 'action.hover',
              '& .MuiLinearProgress-bar': {
                borderRadius: 3,
                background: `linear-gradient(90deg, ${LOGO_BLUE}, ${LOGO_TEAL})`
              }
            }}
          />
          <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ minWidth: 48 }}>
            {activeStep + 1} / {steps.length}
          </Typography>
        </Box>
      </Box>

      <DialogContent sx={{ py: 3, px: 3 }}>
        <SlideCard>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 2 }}>
            <StepIconBox>{currentStep.icon}</StepIconBox>
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle1" color="text.secondary" fontWeight={600}>
                Étape {activeStep + 1}
              </Typography>
              <Typography variant="h6" fontWeight={700}>
                {currentStep.title}
              </Typography>
              {currentStep.path && (
                <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: LOGO_TEAL }}>
                  📍 {currentStep.path}
                </Typography>
              )}
            </Box>
          </Box>
          <Box sx={{ pl: 0 }}>{currentStep.content}</Box>
          {currentStep.route && (
            <Button
              fullWidth
              variant="outlined"
              startIcon={<OpenInNewIcon />}
              onClick={handleGoToPage}
              sx={{ mt: 2, borderColor: LOGO_TEAL, color: LOGO_TEAL, '&:hover': { borderColor: LOGO_BLUE, bgcolor: alpha(LOGO_TEAL, 0.08) } }}
            >
              Accéder à la page
            </Button>
          )}
        </SlideCard>

        {/* Points de navigation */}
        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.5, mt: 2 }}>
          {steps.map((_, index) => (
            <Box
              key={index}
              onClick={() => setActiveStep(index)}
              sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                bgcolor: index === activeStep ? LOGO_BLUE : index < activeStep ? LOGO_TEAL : 'action.hover',
                cursor: 'pointer',
                transition: 'transform 0.2s',
                '&:hover': { transform: 'scale(1.2)' }
              }}
            />
          ))}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5, pt: 0, gap: 1 }}>
        <Button
          startIcon={<PrevIcon />}
          onClick={handleBack}
          disabled={activeStep === 0}
          size="medium"
          color="inherit"
        >
          Précédent
        </Button>
        <Box sx={{ flex: 1 }} />
        <Button
          endIcon={activeStep === steps.length - 1 ? <CheckIcon /> : <NextIcon />}
          onClick={handleNext}
          variant="contained"
          size="medium"
          sx={{
            background: `linear-gradient(135deg, ${LOGO_BLUE}, ${LOGO_TEAL})`,
            color: '#fff',
            px: 3,
            '&:hover': { background: `linear-gradient(135deg, ${LOGO_BLUE}, #189999)` }
          }}
        >
          {activeStep === steps.length - 1 ? 'Terminer' : 'Suivant'}
        </Button>
      </DialogActions>
    </StyledDialog>
  );
}
