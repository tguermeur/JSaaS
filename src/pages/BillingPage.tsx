import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { 
  Container, 
  Typography, 
  Box, 
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  CircularProgress,
  Link as MuiLink
} from '@mui/material';
import { Download as DownloadIcon } from '@mui/icons-material';
import SubscriptionForm from '../components/SubscriptionForm';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';

interface Invoice {
  id: string;
  numeroMission: string;
  date: Date;
  amount: number;
  status: 'to_send' | 'sent' | 'paid';
  invoiceNumber?: string;
}

const BillingPage: React.FC = () => {
  const location = useLocation();
  const { currentUser, userData } = useAuth();
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const isEntreprise = userData?.status === 'entreprise';

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('success')) {
      setMessage({
        type: 'success',
        text: 'Votre abonnement a été créé avec succès !'
      });
    } else if (params.get('canceled')) {
      setMessage({
        type: 'error',
        text: 'Le processus de paiement a été annulé.'
      });
    }
  }, [location]);

  useEffect(() => {
    const fetchInvoices = async () => {
      if (!isEntreprise || !currentUser) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        // Récupérer les missions de l'entreprise qui ont une facture
        const missionsRef = collection(db, 'missions');
        const missionsQuery = query(
          missionsRef,
          where('companyId', '==', currentUser.uid),
          where('invoiceStatus', 'in', ['sent', 'paid'])
        );
        const missionsSnapshot = await getDocs(missionsQuery);

        const invoicesList: Invoice[] = missionsSnapshot.docs
          .filter(doc => {
            const data = doc.data();
            return data.invoiceStatus && data.invoiceStatus !== 'to_send';
          })
          .map(doc => {
            const data = doc.data();
            const date = data.updatedAt?.toDate?.() || data.createdAt?.toDate?.() || new Date();
            const priceHT = data.prixHT || 0;
            const tva = data.tva || 0.20; // TVA par défaut 20%
            const totalTTC = priceHT * (1 + tva);

            return {
              id: doc.id,
              numeroMission: data.numeroMission || '',
              date: date,
              amount: totalTTC,
              status: data.invoiceStatus || 'sent',
              invoiceNumber: data.invoiceNumber || data.numeroMission
            };
          });

        // Trier par date (plus récentes en premier)
        invoicesList.sort((a, b) => b.date.getTime() - a.date.getTime());
        setInvoices(invoicesList);
      } catch (error) {
        console.error('Erreur lors de la récupération des factures:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchInvoices();
  }, [currentUser, isEntreprise]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'success';
      case 'sent':
        return 'warning';
      default:
        return 'default';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'paid':
        return 'Payée';
      case 'sent':
        return 'En attente';
      default:
        return 'Inconnu';
    }
  };

  // Vue pour les entreprises
  if (isEntreprise) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ py: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 600, mb: 4 }}>
            Mes factures
          </Typography>

          {message && (
            <Alert severity={message.type} sx={{ mb: 3 }}>
              {message.text}
            </Alert>
          )}

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
              <CircularProgress />
            </Box>
          ) : invoices.length === 0 ? (
            <Alert severity="info" sx={{ mt: 3 }}>
              Aucune facture disponible pour le moment.
            </Alert>
          ) : (
            <TableContainer component={Paper} elevation={0} sx={{ borderRadius: '12px', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)' }}>
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: '#f5f5f7' }}>
                    <TableCell sx={{ fontWeight: 600 }}>Date</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Numéro de facture</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Mission</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>Montant TTC</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 600 }}>Statut</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 600 }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {invoices.map((invoice) => (
                    <TableRow key={invoice.id} hover>
                      <TableCell>
                        {invoice.date.toLocaleDateString('fr-FR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric'
                        })}
                      </TableCell>
                      <TableCell>
                        {invoice.invoiceNumber || invoice.numeroMission}
                      </TableCell>
                      <TableCell>
                        {invoice.numeroMission}
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {invoice.amount.toFixed(2)} €
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={getStatusLabel(invoice.status)}
                          color={getStatusColor(invoice.status) as any}
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="center">
                        <MuiLink
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            // TODO: Implémenter le téléchargement du PDF
                            console.log('Télécharger la facture:', invoice.id);
                          }}
                          sx={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 0.5,
                            cursor: 'pointer',
                            color: '#0071e3',
                            '&:hover': {
                              textDecoration: 'underline'
                            }
                          }}
                        >
                          <DownloadIcon fontSize="small" />
                          PDF
                        </MuiLink>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
      </Container>
    );
  }

  // Vue par défaut pour les autres utilisateurs (abonnements)
  return (
    <Container maxWidth="md">
      <Box sx={{ py: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Gestion de l'abonnement
        </Typography>

        {message && (
          <Alert severity={message.type} sx={{ mb: 3 }}>
            {message.text}
          </Alert>
        )}

        {currentUser?.subscriptionStatus === 'active' ? (
          <Box sx={{ mt: 3 }}>
            <Typography variant="h6" gutterBottom>
              Statut de votre abonnement
            </Typography>
            <Typography>
              Votre abonnement est actif jusqu'au{' '}
              {currentUser.currentPeriodEnd?.toLocaleDateString()}
            </Typography>
          </Box>
        ) : (
          <SubscriptionForm />
        )}
      </Box>
    </Container>
  );
};

export default BillingPage; 