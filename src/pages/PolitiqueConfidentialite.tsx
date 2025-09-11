import React from 'react';
import { Box, Container, Typography, Paper, Divider, AppBar, Toolbar, Button } from '@mui/material';
import { Link } from 'react-router-dom';
import Footer from '../components/Footer';

const PolitiqueConfidentialite: React.FC = () => {
  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: '#fff' }}>
      {/* Navigation Bar */}
      <AppBar 
        position="fixed" 
        elevation={0} 
        sx={{ 
          bgcolor: 'rgba(255, 255, 255, 0.8)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(0, 0, 0, 0.1)',
          transition: 'all 0.3s ease-in-out',
          '&:hover': {
            bgcolor: 'rgba(255, 255, 255, 0.95)',
          }
        }}
      >
        <Toolbar sx={{ minHeight: '56px !important', py: 1.2, pl: 4 }}>
          <Box
            component="img"
            src="/images/logo.png"
            alt="JS Connect Logo"
            sx={{
              height: 24,
              mr: 4,
              transition: 'transform 0.3s ease',
              '&:hover': {
                transform: 'scale(1.05)'
              }
            }}
          />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, ml: 8 }}>
            <Button
              component={Link}
              to="/"
              sx={{
                color: '#1d1d1f',
                fontWeight: 400,
                fontSize: '0.95rem',
                textTransform: 'none',
                px: 1.5,
                transition: 'font-weight 0.2s',
                '&:hover': {
                  color: '#1d1d1f',
                  fontWeight: 600,
                  opacity: 0.8
                }
              }}
            >
              Accueil
            </Button>
            <Button
              component={Link}
              to="/features"
              sx={{
                color: '#1d1d1f',
                fontWeight: 400,
                fontSize: '0.95rem',
                textTransform: 'none',
                px: 1.5,
                transition: 'font-weight 0.2s',
                '&:hover': {
                  color: '#1d1d1f',
                  fontWeight: 600,
                  opacity: 0.8
                }
              }}
            >
              Fonctionnalités
            </Button>
          </Box>
          <Box sx={{ flexGrow: 1 }} />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Button
              component={Link}
              to="/login"
              variant="outlined"
              sx={{
                color: '#000',
                borderColor: '#000',
                fontWeight: 400,
                fontSize: '0.85rem',
                textTransform: 'none',
                borderRadius: '20px',
                px: 3,
                '&:hover': {
                  borderColor: '#000',
                  bgcolor: '#000',
                  color: '#fff'
                }
              }}
            >
              Connexion
            </Button>
            <Button
              component={Link}
              to="/register"
              variant="contained"
              sx={{
                bgcolor: '#000',
                color: '#fff',
                fontWeight: 400,
                fontSize: '0.85rem',
                textTransform: 'none',
                borderRadius: '20px',
                px: 3,
                '&:hover': {
                  bgcolor: '#000',
                  opacity: 0.9
                }
              }}
            >
              Inscription
            </Button>
          </Box>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ py: 8, flex: 1, mt: 8 }}>
        <Typography
          variant="h3"
          sx={{
            color: '#1d1d1f',
            fontWeight: 600,
            mb: 6,
            textAlign: 'center'
          }}
        >
          Politique de confidentialité
        </Typography>

        <Paper
          elevation={0}
          sx={{
            p: 4,
            borderRadius: '1.2rem',
            border: '1px solid #e5e5e7',
            bgcolor: '#ffffff'
          }}
        >
          <Box sx={{ mb: 4 }}>
            <Typography
              variant="h5"
              sx={{
                color: '#1d1d1f',
                fontWeight: 600,
                mb: 2
              }}
            >
              1. Introduction
            </Typography>
            <Typography
              variant="body1"
              sx={{
                color: '#1d1d1f',
                mb: 2
              }}
            >
              La présente politique de confidentialité a pour objectif d'informer les utilisateurs du site JS Connect sur la manière dont leurs données personnelles sont collectées, utilisées, stockées et protégées, conformément au Règlement Général sur la Protection des Données (RGPD) – Règlement (UE) 2016/679.
            </Typography>
            <Typography
              variant="body1"
              sx={{
                color: '#1d1d1f'
              }}
            >
              En naviguant sur le site ou en utilisant nos services, vous acceptez les conditions de la présente politique.
            </Typography>
          </Box>

          <Box sx={{ mb: 4 }}>
            <Typography
              variant="h5"
              sx={{
                color: '#1d1d1f',
                fontWeight: 600,
                mb: 2
              }}
            >
              2. Identité du responsable du traitement
            </Typography>
            <Typography
              variant="body1"
              sx={{
                color: '#1d1d1f',
                mb: 1
              }}
            >
              Le responsable du traitement des données est :
            </Typography>
            <Typography
              variant="body1"
              sx={{
                color: '#1d1d1f',
                mb: 1
              }}
            >
              JS Connect
              <br />
              Forme juridique : Entreprise individuelle
              <br />
              SIRET : 952 160 422 00012
              <br />
              Siège social : 160 CHEMIN DE KERASTEL MONTAGNE, 29200 BREST
              <br />
              Email de contact : contact@jsconnect.fr
            </Typography>
          </Box>

          <Box sx={{ mb: 4 }}>
            <Typography
              variant="h5"
              sx={{
                color: '#1d1d1f',
                fontWeight: 600,
                mb: 2
              }}
            >
              3. Données collectées
            </Typography>
            <Typography
              variant="body1"
              sx={{
                color: '#1d1d1f',
                mb: 2
              }}
            >
              Dans le cadre de ses activités, JS Connect peut être amené à collecter et traiter les données personnelles suivantes :
            </Typography>
            <Typography
              variant="body1"
              sx={{
                color: '#1d1d1f',
                mb: 1
              }}
            >
              Données d'identification :
              <br />
              • Nom, prénom
              <br />
              • Adresse e-mail
              <br />
              • Numéro de téléphone
              <br />
              • Adresse postale
              <br />
              <br />
              Données administratives :
              <br />
              • Numéro de sécurité sociale (uniquement en cas de contractualisation pour une mission)
              <br />
              <br />
              Données professionnelles :
              <br />
              • CV
              <br />
              • Compétences
              <br />
              • Expériences
              <br />
              <br />
              Données de navigation (via cookies) :
              <br />
              • Adresse IP
              <br />
              • Type de navigateur
              <br />
              • Pages consultées
            </Typography>
          </Box>

          <Box sx={{ mb: 4 }}>
            <Typography
              variant="h5"
              sx={{
                color: '#1d1d1f',
                fontWeight: 600,
                mb: 2
              }}
            >
              4. Finalités de la collecte
            </Typography>
            <Typography
              variant="body1"
              sx={{
                color: '#1d1d1f',
                mb: 2
              }}
            >
              Les données sont collectées pour les finalités suivantes :
            </Typography>
            <Typography
              variant="body1"
              sx={{
                color: '#1d1d1f',
                mb: 1
              }}
            >
              • Gestion des inscriptions et des profils utilisateurs
              <br />
              • Mise en relation avec des missions étudiantes proposées par des Junior-Entreprises ou Job Services
              <br />
              • Suivi administratif et contractuel des missions (contrats, facturation, déclarations)
              <br />
              • Communication avec les utilisateurs (notifications, informations sur les missions, actualités)
              <br />
              • Utilisation, avec consentement explicite, de certaines données (nom, prénom, CV, témoignage, photo) à des fins de communication ou valorisation professionnelle
              <br />
              <br />
              ⚠️ Le numéro de sécurité sociale n'est utilisé que pour la gestion administrative des missions, et jamais à des fins de communication ou de marketing.
            </Typography>
          </Box>

          <Box sx={{ mb: 4 }}>
            <Typography
              variant="h5"
              sx={{
                color: '#1d1d1f',
                fontWeight: 600,
                mb: 2
              }}
            >
              5. Base légale du traitement
            </Typography>
            <Typography
              variant="body1"
              sx={{
                color: '#1d1d1f',
                mb: 1
              }}
            >
              Les traitements réalisés sont fondés sur :
              <br />
              <br />
              • L'exécution d'un contrat (inscription, réalisation de missions)
              <br />
              • L'intérêt légitime (fonctionnement du site, amélioration de l'expérience utilisateur)
              <br />
              • Le consentement (utilisation des données à des fins de communication, marketing ou témoignage)
              <br />
              • Les obligations légales (conservation des données pour des raisons fiscales ou sociales)
            </Typography>
          </Box>

          <Box sx={{ mb: 4 }}>
            <Typography
              variant="h5"
              sx={{
                color: '#1d1d1f',
                fontWeight: 600,
                mb: 2
              }}
            >
              6. Destinataires des données
            </Typography>
            <Typography
              variant="body1"
              sx={{
                color: '#1d1d1f',
                mb: 1
              }}
            >
              Les données personnelles sont strictement destinées à :
              <br />
              <br />
              • JS Connect et ses représentants autorisés
              <br />
              • Les Junior-Entreprises ou Job Services partenaires dans le cadre des missions
              <br />
              • Les prestataires techniques assurant l'hébergement et la maintenance du site (ex. : Firebase – Google Cloud Platform)
              <br />
              <br />
              Ces tiers sont soumis à des engagements stricts de confidentialité et de conformité au RGPD.
            </Typography>
          </Box>

          <Box sx={{ mb: 4 }}>
            <Typography
              variant="h5"
              sx={{
                color: '#1d1d1f',
                fontWeight: 600,
                mb: 2
              }}
            >
              7. Durée de conservation
            </Typography>
            <Typography
              variant="body1"
              sx={{
                color: '#1d1d1f',
                mb: 1
              }}
            >
              Les données personnelles sont conservées :
              <br />
              <br />
              • Pendant toute la durée de la relation contractuelle ou de l'inscription sur la plateforme
              <br />
              • Jusqu'à 3 ans après la dernière activité en cas d'inactivité
              <br />
              • Jusqu'à 6 ans pour les données contractuelles et de facturation (obligations légales)
              <br />
              • Les données liées au consentement marketing sont conservées jusqu'au retrait de ce consentement
            </Typography>
          </Box>

          <Box sx={{ mb: 4 }}>
            <Typography
              variant="h5"
              sx={{
                color: '#1d1d1f',
                fontWeight: 600,
                mb: 2
              }}
            >
              8. Droits des utilisateurs
            </Typography>
            <Typography
              variant="body1"
              sx={{
                color: '#1d1d1f',
                mb: 1
              }}
            >
              Conformément au RGPD, vous disposez des droits suivants :
              <br />
              <br />
              • Droit d'accès à vos données personnelles
              <br />
              • Droit de rectification en cas d'erreurs ou d'inexactitudes
              <br />
              • Droit d'effacement (« droit à l'oubli »)
              <br />
              • Droit d'opposition au traitement pour motifs légitimes
              <br />
              • Droit à la portabilité des données
              <br />
              • Droit au retrait du consentement à tout moment
              <br />
              • Droit d'introduire une réclamation auprès de la CNIL : www.cnil.fr
              <br />
              <br />
              Pour exercer vos droits, contactez :
              <br />
              📧 privacy@jsconnect.fr
            </Typography>
          </Box>

          <Box sx={{ mb: 4 }}>
            <Typography
              variant="h5"
              sx={{
                color: '#1d1d1f',
                fontWeight: 600,
                mb: 2
              }}
            >
              9. Sécurité des données
            </Typography>
            <Typography
              variant="body1"
              sx={{
                color: '#1d1d1f',
                mb: 1
              }}
            >
              JS Connect met en œuvre toutes les mesures techniques et organisationnelles nécessaires pour garantir la sécurité et la confidentialité de vos données, notamment contre la perte, l'altération, l'accès non autorisé ou la divulgation.
              <br />
              <br />
              L'hébergement est assuré par Firebase (Google Cloud Platform), conforme aux standards internationaux de sécurité.
            </Typography>
          </Box>

          <Box sx={{ mb: 4 }}>
            <Typography
              variant="h5"
              sx={{
                color: '#1d1d1f',
                fontWeight: 600,
                mb: 2
              }}
            >
              10. Cookies
            </Typography>
            <Typography
              variant="body1"
              sx={{
                color: '#1d1d1f',
                mb: 1
              }}
            >
              Le site peut utiliser des cookies à des fins de fonctionnement, d'analyse de navigation ou de mesure d'audience. Lors de votre première visite, vous êtes informé de leur présence et avez la possibilité de les refuser ou les paramétrer.
            </Typography>
          </Box>

          <Box sx={{ mb: 4 }}>
            <Typography
              variant="h5"
              sx={{
                color: '#1d1d1f',
                fontWeight: 600,
                mb: 2
              }}
            >
              11. Mise à jour de la politique
            </Typography>
            <Typography
              variant="body1"
              sx={{
                color: '#1d1d1f',
                mb: 1
              }}
            >
              JS Connect se réserve le droit de modifier la présente politique de confidentialité à tout moment. Toute modification substantielle sera signalée aux utilisateurs par email ou notification sur la plateforme.
              <br />
              <br />
              Dernière mise à jour : 11 avril 2025
            </Typography>
          </Box>
        </Paper>
      </Container>
      <Footer />
    </Box>
  );
};

export default PolitiqueConfidentialite; 