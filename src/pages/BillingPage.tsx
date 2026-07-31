import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { 
  Typography, 
  Box, 
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  Link as MuiLink
} from '@mui/material';
import { Download as DownloadIcon } from '@mui/icons-material';
import SubscriptionForm from '../components/SubscriptionForm';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import { tokens } from '../theme/tokens';
import { SettingsPanel } from '../components/ds';

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
      <Box sx={{ p: 3, bgcolor: tokens.colors.appBg, minHeight: '100vh' }}>
        <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
          <Typography
            component="h1"
            sx={{
              ...tokens.typography.pageTitle,
              color: tokens.colors.gray900,
              mb: 4,
            }}
          >
            Mes factures
          </Typography>

          {message && (
            <Alert severity={message.type} sx={{ mb: 3, borderRadius: tokens.radius.lg }}>
              {message.text}
            </Alert>
          )}

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
              <CircularProgress sx={{ color: tokens.colors.brandTeal }} />
            </Box>
          ) : invoices.length === 0 ? (
            <SettingsPanel title="Factures" desc="Aucune facture disponible pour le moment.">
              <Typography sx={{ fontSize: 14, color: tokens.colors.textSecondary }}>
                Vos factures apparaîtront ici dès qu&apos;elles seront émises.
              </Typography>
            </SettingsPanel>
          ) : (
            <SettingsPanel title="Historique des factures" desc={`${invoices.length} facture${invoices.length > 1 ? 's' : ''}`}>
            <TableContainer sx={{ mx: -2.25, mb: -2.25 }}>
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: tokens.colors.gray50 }}>
                    <TableCell sx={{ fontWeight: 600, color: tokens.colors.textSecondary, fontSize: '0.75rem', textTransform: 'uppercase' }}>Date</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: tokens.colors.textSecondary, fontSize: '0.75rem', textTransform: 'uppercase' }}>Numéro de facture</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: tokens.colors.textSecondary, fontSize: '0.75rem', textTransform: 'uppercase' }}>Mission</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600, color: tokens.colors.textSecondary, fontSize: '0.75rem', textTransform: 'uppercase' }}>Montant TTC</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 600, color: tokens.colors.textSecondary, fontSize: '0.75rem', textTransform: 'uppercase' }}>Statut</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 600, color: tokens.colors.textSecondary, fontSize: '0.75rem', textTransform: 'uppercase' }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {invoices.map((invoice) => (
                    <TableRow
                      key={invoice.id}
                      hover
                      sx={{ '& td': { borderBottom: `1px solid ${tokens.colors.gray100}`, color: tokens.colors.gray900 } }}
                    >
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
                            color: tokens.colors.brandTeal,
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
            </SettingsPanel>
          )}
        </Box>
      </Box>
    );
  }

  // Vue par défaut pour les autres utilisateurs (abonnements)
  return (
    <Box sx={{ p: 3, bgcolor: tokens.colors.appBg, minHeight: '100vh' }}>
      <Box sx={{ maxWidth: 720, mx: 'auto' }}>
        <Typography
          component="h1"
          sx={{ ...tokens.typography.pageTitle, color: tokens.colors.gray900, mb: 4 }}
        >
          Gestion de l&apos;abonnement
        </Typography>

        {message && (
          <Alert severity={message.type} sx={{ mb: 3, borderRadius: tokens.radius.lg }}>
            {message.text}
          </Alert>
        )}

        {currentUser?.subscriptionStatus === 'active' ? (
          <SettingsPanel title="Statut de votre abonnement">
            <Typography sx={{ fontSize: 14, color: tokens.colors.textSecondary }}>
              Votre abonnement est actif jusqu&apos;au{' '}
              {currentUser.currentPeriodEnd?.toLocaleDateString()}
            </Typography>
          </SettingsPanel>
        ) : (
          <SettingsPanel title="Abonnement" desc="Configurez votre formule JS Connect">
            <SubscriptionForm />
          </SettingsPanel>
        )}
      </Box>
    </Box>
  );
};

export default BillingPage; 