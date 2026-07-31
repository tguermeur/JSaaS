import React, { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  Paper,
  Typography,
} from '@mui/material';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import { tokens } from '../theme/tokens';
import { SIGNATURE_CONSENT_WORDING } from '../types/signature';
import { openSignSession, submitSignature } from '../services/signatureService';
import SignatureCapture, {
  type SignatureCaptureHandle,
} from '../components/signatures/SignatureCapture';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

type Step = 'loading' | 'ready' | 'submitting' | 'done' | 'error';

type FieldBox = {
  id: string;
  pageIndex: number;
  xPct: number;
  yPct: number;
  widthPct: number;
  heightPct: number;
  label?: string | null;
};

const SignDocument: React.FC = () => {
  const { requestId } = useParams<{ requestId: string }>();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('t') || '';

  const [step, setStep] = useState<Step>('loading');
  const [error, setError] = useState<string | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [documentTitle, setDocumentTitle] = useState('');
  const [consentWording, setConsentWording] = useState(SIGNATURE_CONSENT_WORDING);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [signerName, setSignerName] = useState('');
  const [fields, setFields] = useState<FieldBox[]>([]);
  const [numPages, setNumPages] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);
  const [consent, setConsent] = useState(false);
  const [completedAll, setCompletedAll] = useState(false);
  const [pageWidth, setPageWidth] = useState(640);

  const captureRef = useRef<SignatureCaptureHandle | null>(null);
  const pdfHostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = pdfHostRef.current;
    if (!el) return;
    const update = () => {
      const w = Math.max(280, Math.min(760, el.clientWidth - 16));
      setPageWidth(w);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [step]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!requestId || !token) {
        setError('Lien de signature invalide (identifiant ou jeton manquant).');
        setStep('error');
        return;
      }
      try {
        const session = await openSignSession(requestId, token);
        if (cancelled) return;
        const pdfSrc = session.pdfUrl
          ? session.pdfUrl
          : session.pdfBase64
            ? `data:application/pdf;base64,${session.pdfBase64}`
            : null;
        if (!pdfSrc) {
          throw new Error('PDF indisponible pour cette session.');
        }
        setSessionToken(session.sessionToken);
        setPdfUrl(pdfSrc);
        setSignerName(session.signer.name);
        setDocumentTitle(session.documentTitle);
        setConsentWording(session.consentWording || SIGNATURE_CONSENT_WORDING);
        setFields(session.signatureFields || []);
        const firstPage = (session.signatureFields || [])[0]?.pageIndex ?? 0;
        setPageIndex(firstPage);
        setStep('ready');
      } catch (e: unknown) {
        if (cancelled) return;
        const msg =
          e && typeof e === 'object' && 'message' in e
            ? String((e as { message: string }).message)
            : 'Impossible d’ouvrir le lien de signature.';
        setError(msg);
        setStep('error');
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [requestId, token]);

  const handleSubmit = async () => {
    if (!requestId || !sessionToken) return;
    if (!consent) {
      setError('Vous devez cocher la case de consentement.');
      return;
    }
    const capture = captureRef.current;
    if (!capture?.hasContent()) {
      setError('Veuillez dessiner, importer ou choisir une police pour votre signature.');
      return;
    }
    const signatureImageBase64 = capture.toPngDataUrl();
    if (!signatureImageBase64) {
      setError('Impossible de générer l’image de signature.');
      return;
    }
    setError(null);
    setStep('submitting');
    try {
      const res = await submitSignature({
        requestId,
        sessionToken,
        consentAccepted: true,
        consentWording,
        signatureImageBase64,
      });
      setCompletedAll(!!res.completed);
      setStep('done');
    } catch (e: unknown) {
      const msg =
        e && typeof e === 'object' && 'message' in e
          ? String((e as { message: string }).message)
          : 'Échec de la signature.';
      setError(msg);
      setStep('ready');
    }
  };

  const pageFields = fields.filter((f) => f.pageIndex === pageIndex);

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: tokens.colors.appBg,
        backgroundImage: `linear-gradient(160deg, ${tokens.colors.brandNavy}12 0%, ${tokens.colors.brandTeal}10 45%, ${tokens.colors.appBg} 100%)`,
        py: { xs: 3, md: 5 },
        px: 2,
      }}
    >
      <Box sx={{ maxWidth: 880, mx: 'auto' }}>
        <Typography
          variant="h4"
          sx={{
            fontWeight: 700,
            color: tokens.colors.brandNavy,
            mb: 0.5,
            fontFamily: '"DM Sans", system-ui, sans-serif',
          }}
        >
          JS Connect
        </Typography>
        <Typography sx={{ color: tokens.colors.textSecondary, mb: 3 }}>
          Signature électronique
        </Typography>

        {step === 'loading' && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        )}

        {step === 'error' && (
          <Alert severity="error" sx={{ borderRadius: tokens.radius.lg }}>
            {error}
          </Alert>
        )}

        {step === 'done' && (
          <Paper
            elevation={0}
            sx={{
              p: 4,
              borderRadius: tokens.radius.lg,
              border: `1px solid ${tokens.colors.divider}`,
              textAlign: 'center',
            }}
          >
            <Typography variant="h5" sx={{ fontWeight: 700, mb: 1, color: tokens.colors.brandNavy }}>
              Signature enregistrée
            </Typography>
            <Typography color="text.secondary">
              {completedAll
                ? 'Tous les signataires ont signé. Le document a été scellé.'
                : 'Merci. Votre signature a bien été prise en compte.'}
            </Typography>
          </Paper>
        )}

        {(step === 'ready' || step === 'submitting') && (
          <Paper
            elevation={0}
            sx={{
              p: { xs: 2, md: 3 },
              borderRadius: tokens.radius.lg,
              border: `1px solid ${tokens.colors.divider}`,
            }}
          >
            <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
              {documentTitle}
            </Typography>
            <Typography sx={{ color: tokens.colors.textSecondary, mb: 2 }}>
              Signataire : {signerName}
              {fields.length > 0
                ? ` — ${fields.length} zone${fields.length > 1 ? 's' : ''} à signer`
                : ''}
            </Typography>

            {error && (
              <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                {error}
              </Alert>
            )}

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Button size="small" disabled={pageIndex <= 0} onClick={() => setPageIndex((p) => p - 1)}>
                ←
              </Button>
              <Typography variant="body2">
                Page {pageIndex + 1}/{numPages || '…'}
              </Typography>
              <Button
                size="small"
                disabled={pageIndex >= numPages - 1}
                onClick={() => setPageIndex((p) => p + 1)}
              >
                →
              </Button>
            </Box>

            <Box
              ref={pdfHostRef}
              sx={{
                border: `1px solid ${tokens.colors.borderDefault}`,
                borderRadius: tokens.radius.md,
                overflow: 'auto',
                mb: 3,
                bgcolor: tokens.colors.gray100,
                display: 'flex',
                justifyContent: 'center',
                p: 1,
                maxHeight: 520,
              }}
            >
              {pdfUrl ? (
                <Document
                  file={pdfUrl}
                  onLoadSuccess={({ numPages: n }) => setNumPages(n)}
                  loading={<CircularProgress size={28} sx={{ m: 4 }} />}
                >
                  <Box sx={{ position: 'relative', lineHeight: 0, bgcolor: '#fff' }}>
                    <Page
                      pageNumber={pageIndex + 1}
                      width={pageWidth}
                      renderTextLayer={false}
                      renderAnnotationLayer={false}
                    />
                    {pageFields.map((f) => (
                      <Box
                        key={f.id}
                        sx={{
                          position: 'absolute',
                          left: `${f.xPct}%`,
                          top: `${f.yPct}%`,
                          width: `${f.widthPct}%`,
                          height: `${f.heightPct}%`,
                          border: `2px dashed ${tokens.colors.brandTeal}`,
                          bgcolor: 'rgba(33, 189, 163, 0.12)',
                          borderRadius: 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          pointerEvents: 'none',
                          zIndex: 2,
                        }}
                      >
                        <Typography
                          sx={{ fontSize: 11, fontWeight: 700, color: tokens.colors.brandTeal }}
                        >
                          Votre signature
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </Document>
              ) : (
                <CircularProgress size={28} sx={{ m: 4 }} />
              )}
            </Box>

            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
              Votre signature
            </Typography>
            <Typography variant="body2" sx={{ mb: 1.5, color: tokens.colors.textSecondary }}>
              Dessinez, importez une image, ou choisissez une police manuscrite. Elle sera appliquée
              dans {fields.length > 0 ? 'vos zones marquées' : 'le document'}.
            </Typography>

            <SignatureCapture
              ref={captureRef}
              signerName={signerName}
              disabled={step === 'submitting'}
            />

            <FormControlLabel
              control={
                <Checkbox checked={consent} onChange={(_, v) => setConsent(v)} color="primary" />
              }
              label={
                <Typography sx={{ fontSize: 14, lineHeight: 1.5 }}>{consentWording}</Typography>
              }
              sx={{ alignItems: 'flex-start', mb: 2, mr: 0, mt: 1 }}
            />

            <Button
              variant="contained"
              fullWidth
              disabled={step === 'submitting' || !consent}
              onClick={() => void handleSubmit()}
              sx={{
                bgcolor: tokens.colors.brandTeal,
                '&:hover': { bgcolor: tokens.colors.brandTeal700 },
                py: 1.25,
                fontWeight: 700,
              }}
            >
              {step === 'submitting' ? (
                <CircularProgress size={22} color="inherit" />
              ) : (
                'Je signe ce document'
              )}
            </Button>
          </Paper>
        )}
      </Box>
    </Box>
  );
};

export default SignDocument;
