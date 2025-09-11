import React from 'react';
import { Box, Container, Typography, Paper, Divider, AppBar, Toolbar, Button } from '@mui/material';
import { Link } from 'react-router-dom';
import Footer from '../components/Footer';

const MentionsLegales: React.FC = () => {
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
          Mentions légales, CGU et Politique de confidentialité
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
          <Typography
            variant="h5"
            sx={{
              color: '#1d1d1f',
              fontWeight: 600,
              mb: 4
            }}
          >
            1. Mentions légales
          </Typography>

          <Box sx={{ mb: 6 }}>
            <Typography
              variant="h6"
              sx={{
                color: '#1d1d1f',
                fontWeight: 600,
                mb: 2
              }}
            >
              Éditeur du site
            </Typography>
            <Typography
              variant="body1"
              sx={{
                color: '#1d1d1f',
                mb: 1
              }}
            >
              Le site JS Connect est édité par :
            </Typography>
            <Typography
              variant="body1"
              sx={{
                color: '#1d1d1f',
                mb: 1
              }}
            >
              Nom de la structure : JS Connect
              <br />
              Forme juridique : Entreprise individuelle
              <br />
              SIRET : 952 160 422 00012
              <br />
              Siège social : 160 CHEMIN DE KERASTEL MONTAGNE, 29200 BREST
              <br />
              Email de contact : contact@jsconnect.fr
              <br />
            </Typography>
          </Box>

          <Box sx={{ mb: 6 }}>
            <Typography
              variant="h6"
              sx={{
                color: '#1d1d1f',
                fontWeight: 600,
                mb: 2
              }}
            >
              Hébergement du site
            </Typography>
            <Typography
              variant="body1"
              sx={{
                color: '#1d1d1f',
                mb: 1
              }}
            >
              Le site est hébergé par :
              <br />
              Firebase (Google Cloud Platform)
              <br />
              Google Ireland Limited
              <br />
              Gordon House, Barrow Street
              <br />
              Dublin 4, Irlande
              <br />
              https://firebase.google.com
              <br />
              Téléphone : +353 1 436 1000
            </Typography>
          </Box>

          <Divider sx={{ my: 6, borderColor: '#e5e5e7' }} />

          <Typography
            variant="h5"
            sx={{
              color: '#1d1d1f',
              fontWeight: 600,
              mb: 4
            }}
          >
            2. Conditions Générales d'Utilisation (CGU)
          </Typography>

          <Box sx={{ mb: 4 }}>
            <Typography
              variant="h6"
              sx={{
                color: '#1d1d1f',
                fontWeight: 600,
                mb: 2
              }}
            >
              Article 1 – Objet
            </Typography>
            <Typography
              variant="body1"
              sx={{
                color: '#1d1d1f',
                mb: 1
              }}
            >
              Les présentes Conditions Générales d'Utilisation ont pour objet de définir les modalités d'accès et d'utilisation de la plateforme JS Connect. Toute navigation ou inscription sur le site implique l'acceptation sans réserve des présentes CGU.
            </Typography>
          </Box>

          <Box sx={{ mb: 4 }}>
            <Typography
              variant="h6"
              sx={{
                color: '#1d1d1f',
                fontWeight: 600,
                mb: 2
              }}
            >
              Article 2 – Accès au service
            </Typography>
            <Typography
              variant="body1"
              sx={{
                color: '#1d1d1f',
                mb: 1
              }}
            >
              JS Connect permet à des étudiants de s'inscrire et de postuler à des missions ponctuelles rémunérées proposées par une Junior-Entreprise ou une Job Service. L'accès est réservé aux personnes majeures et inscrites dans un établissement d'enseignement supérieur.
            </Typography>
          </Box>

          <Box sx={{ mb: 4 }}>
            <Typography
              variant="h6"
              sx={{
                color: '#1d1d1f',
                fontWeight: 600,
                mb: 2
              }}
            >
              Article 3 – Inscription
            </Typography>
            <Typography
              variant="body1"
              sx={{
                color: '#1d1d1f',
                mb: 1
              }}
            >
              L'inscription nécessite la création d'un compte personnel avec les informations suivantes :
              <br />
              • Nom, prénom
              <br />
              • Adresse e-mail
              <br />
              • Numéro de téléphone
              <br />
              • Adresse postale
              <br />
              • Numéro de sécurité sociale (uniquement en cas de contractualisation pour mission)
              <br />
              • Curriculum Vitae (CV)
              <br />
              L'utilisateur garantit l'exactitude de ces informations et s'engage à les mettre à jour.
            </Typography>
          </Box>

          <Box sx={{ mb: 4 }}>
            <Typography
              variant="h6"
              sx={{
                color: '#1d1d1f',
                fontWeight: 600,
                mb: 2
              }}
            >
              Article 4 – Engagements de l'utilisateur
            </Typography>
            <Typography
              variant="body1"
              sx={{
                color: '#1d1d1f',
                mb: 1
              }}
            >
              L'utilisateur s'engage à :
              <br />
              • Ne pas usurper l'identité d'un tiers
              <br />
              • Respecter les règles de bonne conduite, de confidentialité et les conditions d'éligibilité aux missions
              <br />
              • Ne pas publier de contenu inapproprié ou frauduleux
            </Typography>
          </Box>

          <Box sx={{ mb: 4 }}>
            <Typography
              variant="h6"
              sx={{
                color: '#1d1d1f',
                fontWeight: 600,
                mb: 2
              }}
            >
              Article 5 – Responsabilités
            </Typography>
            <Typography
              variant="body1"
              sx={{
                color: '#1d1d1f',
                mb: 1
              }}
            >
              JS Connect ne saurait être tenu responsable en cas d'inexactitude des informations fournies par les utilisateurs ou d'interruption de service liée à des incidents techniques indépendants de sa volonté.
            </Typography>
          </Box>

          <Box sx={{ mb: 4 }}>
            <Typography
              variant="h6"
              sx={{
                color: '#1d1d1f',
                fontWeight: 600,
                mb: 2
              }}
            >
              Article 6 – Suspension ou suppression de compte
            </Typography>
            <Typography
              variant="body1"
              sx={{
                color: '#1d1d1f',
                mb: 1
              }}
            >
              JS Connect se réserve le droit de suspendre ou de supprimer un compte utilisateur en cas de non-respect des présentes CGU ou de comportement inapproprié.
            </Typography>
          </Box>

          <Box sx={{ mb: 4 }}>
            <Typography
              variant="h6"
              sx={{
                color: '#1d1d1f',
                fontWeight: 600,
                mb: 2
              }}
            >
              Article 7 – Propriété intellectuelle
            </Typography>
            <Typography
              variant="body1"
              sx={{
                color: '#1d1d1f',
                mb: 1
              }}
            >
              L'ensemble des éléments de la plateforme (textes, graphismes, logo, code, bases de données) est protégé par les lois en vigueur sur la propriété intellectuelle. Toute reproduction non autorisée est interdite.
            </Typography>
          </Box>

          <Divider sx={{ my: 6, borderColor: '#e5e5e7' }} />

          <Typography
            variant="h5"
            sx={{
              color: '#1d1d1f',
              fontWeight: 600,
              mb: 4
            }}
          >
            3. Politique de confidentialité (extrait essentiel)
          </Typography>

          <Box sx={{ mb: 4 }}>
            <Typography
              variant="h6"
              sx={{
                color: '#1d1d1f',
                fontWeight: 600,
                mb: 2
              }}
            >
              Données collectées
            </Typography>
            <Typography
              variant="body1"
              sx={{
                color: '#1d1d1f',
                mb: 1
              }}
            >
              JS Connect collecte les données suivantes :
              <br />
              • Identité : nom, prénom, adresse e-mail, téléphone, adresse postale
              <br />
              • Données administratives : numéro de sécurité sociale (uniquement pour les missions)
              <br />
              • Données professionnelles : CV, compétences, expériences
            </Typography>
          </Box>

          <Box sx={{ mb: 4 }}>
            <Typography
              variant="h6"
              sx={{
                color: '#1d1d1f',
                fontWeight: 600,
                mb: 2
              }}
            >
              Finalités
            </Typography>
            <Typography
              variant="body1"
              sx={{
                color: '#1d1d1f',
                mb: 1
              }}
            >
              Les données sont utilisées pour :
              <br />
              • Permettre l'inscription et la mise en relation avec des missions étudiantes
              <br />
              • Gérer les aspects contractuels et administratifs (facturation, déclarations)
              <br />
              • Communiquer avec les utilisateurs (notifications, actualités)
              <br />
              • Utiliser certaines données (prénom, nom, CV, témoignage, photo) à des fins de valorisation professionnelle, témoignage, ou communication marketing, uniquement avec le consentement explicite de l'utilisateur.
              <br />
              Le numéro de sécurité sociale n'est jamais utilisé à des fins de communication ou marketing.
            </Typography>
          </Box>

          <Box sx={{ mb: 4 }}>
            <Typography
              variant="h6"
              sx={{
                color: '#1d1d1f',
                fontWeight: 600,
                mb: 2
              }}
            >
              Droits des utilisateurs
            </Typography>
            <Typography
              variant="body1"
              sx={{
                color: '#1d1d1f',
                mb: 1
              }}
            >
              Conformément au RGPD, vous disposez :
              <br />
              • D'un droit d'accès, de rectification, de suppression et d'opposition
              <br />
              • D'un droit de retrait du consentement à tout moment
              <br />
              • D'un droit de réclamation auprès de la CNIL
              <br />
              Pour exercer vos droits : [email RGPD dédié, ex : privacy@jsconnect.fr]
            </Typography>
          </Box>
        </Paper>
      </Container>
      <Footer />
    </Box>
  );
};

export default MentionsLegales; 