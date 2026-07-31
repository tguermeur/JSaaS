import React, { useCallback, useEffect, useImperativeHandle, useRef, useState, forwardRef } from 'react';
import {
  Box,
  Button,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { tokens } from '../../theme/tokens';

export type SignatureMode = 'draw' | 'upload' | 'type';

export type SignatureFontId = 'dancing' | 'great-vibes' | 'allura';

const FONTS: Array<{ id: SignatureFontId; label: string; family: string; google: string }> = [
  { id: 'dancing', label: 'Dancing Script', family: '"Dancing Script", cursive', google: 'Dancing+Script:wght@400;700' },
  { id: 'great-vibes', label: 'Great Vibes', family: '"Great Vibes", cursive', google: 'Great+Vibes' },
  { id: 'allura', label: 'Allura', family: '"Allura", cursive', google: 'Allura' },
];

export type SignatureCaptureHandle = {
  /** Returns PNG data URL or null if empty / invalid */
  toPngDataUrl: () => string | null;
  hasContent: () => boolean;
};

type Props = {
  signerName: string;
  disabled?: boolean;
};

function loadGoogleFonts(families: string[]) {
  const id = 'js-connect-signature-fonts';
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?${families.map((f) => `family=${f}`).join('&')}&display=swap`;
  document.head.appendChild(link);
}

function fitImageToCanvas(
  img: HTMLImageElement,
  canvas: HTMLCanvasElement,
  transparentBg: boolean
) {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth || 600;
  const h = canvas.clientHeight || 160;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (transparentBg) {
    ctx.clearRect(0, 0, w, h);
  } else {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
  }
  const pad = 12;
  const scale = Math.min((w - pad * 2) / img.width, (h - pad * 2) / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

function renderTypedName(
  canvas: HTMLCanvasElement,
  name: string,
  fontFamily: string
) {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth || 600;
  const h = canvas.clientHeight || 160;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  let fontSize = 56;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#111827';
  while (fontSize > 18) {
    ctx.font = `400 ${fontSize}px ${fontFamily}`;
    if (ctx.measureText(name).width <= w - 24) break;
    fontSize -= 2;
  }
  ctx.font = `400 ${fontSize}px ${fontFamily}`;
  ctx.fillText(name || ' ', w / 2, h / 2);
}

const SignatureCapture = forwardRef<SignatureCaptureHandle, Props>(
  ({ signerName, disabled }, ref) => {
    const [mode, setMode] = useState<SignatureMode>('type');
    const [fontId, setFontId] = useState<SignatureFontId>('dancing');
    const [hasInk, setHasInk] = useState(false);
    const [hasUpload, setHasUpload] = useState(false);
    const [fontsReady, setFontsReady] = useState(false);

    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const drawing = useRef(false);
    const fileRef = useRef<HTMLInputElement | null>(null);

    const initDrawCanvas = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth || 600;
      const h = 160;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#111827';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      setHasInk(false);
    }, []);

    const paintTyped = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const font = FONTS.find((f) => f.id === fontId)!;
      renderTypedName(canvas, signerName.trim() || 'Signature', font.family);
      setHasInk(true);
    }, [fontId, signerName]);

    useEffect(() => {
      if (mode === 'draw') {
        requestAnimationFrame(() => initDrawCanvas());
      } else if (mode === 'type') {
        loadGoogleFonts(FONTS.map((f) => f.google));
        const t = window.setTimeout(() => {
          setFontsReady(true);
          paintTyped();
        }, 350);
        return () => window.clearTimeout(t);
      } else if (mode === 'upload') {
        const canvas = canvasRef.current;
        if (canvas && !hasUpload) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            const dpr = window.devicePixelRatio || 1;
            const w = canvas.clientWidth || 600;
            canvas.width = w * dpr;
            canvas.height = 160 * dpr;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.fillStyle = '#f8fafc';
            ctx.fillRect(0, 0, w, 160);
          }
        }
      }
    }, [mode, initDrawCanvas, paintTyped, hasUpload]);

    useEffect(() => {
      if (mode === 'type' && fontsReady) paintTyped();
    }, [mode, fontsReady, paintTyped]);

    useImperativeHandle(
      ref,
      () => ({
        hasContent: () => {
          if (mode === 'draw' || mode === 'type') return hasInk;
          return hasUpload;
        },
        toPngDataUrl: () => {
          const canvas = canvasRef.current;
          if (!canvas) return null;
          if (mode === 'draw' && !hasInk) return null;
          if (mode === 'upload' && !hasUpload) return null;
          if (mode === 'type') {
            // Re-render transparent PNG for sealing quality
            const font = FONTS.find((f) => f.id === fontId)!;
            const off = document.createElement('canvas');
            off.width = 800;
            off.height = 240;
            const ctx = off.getContext('2d');
            if (!ctx) return null;
            ctx.clearRect(0, 0, off.width, off.height);
            let fontSize = 96;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#111827';
            const name = signerName.trim() || 'Signature';
            while (fontSize > 28) {
              ctx.font = `400 ${fontSize}px ${font.family}`;
              if (ctx.measureText(name).width <= off.width - 40) break;
              fontSize -= 4;
            }
            ctx.font = `400 ${fontSize}px ${font.family}`;
            ctx.fillText(name, off.width / 2, off.height / 2);
            return off.toDataURL('image/png');
          }
          return canvas.toDataURL('image/png');
        },
      }),
      [mode, hasInk, hasUpload, fontId, signerName]
    );

    const pointerPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (mode !== 'draw' || disabled) return;
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) return;
      drawing.current = true;
      canvas.setPointerCapture(e.pointerId);
      const { x, y } = pointerPos(e);
      ctx.beginPath();
      ctx.moveTo(x, y);
    };

    const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!drawing.current || mode !== 'draw') return;
      const ctx = canvasRef.current?.getContext('2d');
      if (!ctx) return;
      const { x, y } = pointerPos(e);
      ctx.lineTo(x, y);
      ctx.stroke();
      setHasInk(true);
    };

    const onPointerUp = () => {
      drawing.current = false;
    };

    const onFile = (file: File | null) => {
      if (!file || !file.type.startsWith('image/')) return;
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        if (canvas) {
          fitImageToCanvas(img, canvas, false);
          setHasUpload(true);
          setHasInk(true);
        }
        URL.revokeObjectURL(url);
      };
      img.onerror = () => URL.revokeObjectURL(url);
      img.src = url;
    };

    return (
      <Box>
        <ToggleButtonGroup
          exclusive
          size="small"
          value={mode}
          disabled={disabled}
          onChange={(_, v: SignatureMode | null) => {
            if (!v) return;
            setHasUpload(false);
            setHasInk(false);
            setMode(v);
          }}
          sx={{ mb: 1.5, flexWrap: 'wrap' }}
        >
          <ToggleButton value="type" sx={{ textTransform: 'none', px: 1.5 }}>
            Écrire
          </ToggleButton>
          <ToggleButton value="draw" sx={{ textTransform: 'none', px: 1.5 }}>
            Dessiner
          </ToggleButton>
          <ToggleButton value="upload" sx={{ textTransform: 'none', px: 1.5 }}>
            Importer
          </ToggleButton>
        </ToggleButtonGroup>

        {mode === 'upload' && (
          <Box sx={{ mb: 1, display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              hidden
              onChange={(e) => onFile(e.target.files?.[0] || null)}
            />
            <Button
              size="small"
              variant="outlined"
              disabled={disabled}
              onClick={() => fileRef.current?.click()}
              sx={{ textTransform: 'none' }}
            >
              Choisir une image
            </Button>
            <Typography variant="caption" color="text.secondary">
              PNG, JPG ou WebP
            </Typography>
          </Box>
        )}

        {mode === 'type' && (
          <Box sx={{ mb: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Aperçu avec votre nom : <strong>{signerName || '—'}</strong>
            </Typography>
            <ToggleButtonGroup
              exclusive
              size="small"
              value={fontId}
              disabled={disabled}
              onChange={(_, v: SignatureFontId | null) => {
                if (v) setFontId(v);
              }}
              sx={{ flexWrap: 'wrap' }}
            >
              {FONTS.map((f) => (
                <ToggleButton
                  key={f.id}
                  value={f.id}
                  sx={{
                    textTransform: 'none',
                    fontFamily: f.family,
                    fontSize: 18,
                    px: 1.5,
                    minWidth: 120,
                  }}
                >
                  {f.label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>
        )}

        <Box
          sx={{
            border: `1px dashed ${tokens.colors.gray300}`,
            borderRadius: tokens.radius.md,
            bgcolor: '#fff',
            mb: 1,
            touchAction: mode === 'draw' ? 'none' : 'auto',
            overflow: 'hidden',
          }}
        >
          <canvas
            ref={canvasRef}
            style={{
              width: '100%',
              height: 160,
              display: 'block',
              cursor: mode === 'draw' ? 'crosshair' : 'default',
            }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
          />
        </Box>

        {mode === 'draw' && (
          <Button size="small" disabled={disabled} onClick={() => initDrawCanvas()} sx={{ mb: 1 }}>
            Effacer
          </Button>
        )}
        {mode === 'upload' && hasUpload && (
          <Button
            size="small"
            disabled={disabled}
            onClick={() => {
              setHasUpload(false);
              setHasInk(false);
              if (fileRef.current) fileRef.current.value = '';
              requestAnimationFrame(() => {
                const canvas = canvasRef.current;
                if (!canvas) return;
                const ctx = canvas.getContext('2d');
                if (!ctx) return;
                const dpr = window.devicePixelRatio || 1;
                const w = canvas.clientWidth || 600;
                canvas.width = w * dpr;
                canvas.height = 160 * dpr;
                ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
                ctx.fillStyle = '#f8fafc';
                ctx.fillRect(0, 0, w, 160);
              });
            }}
            sx={{ mb: 1 }}
          >
            Effacer
          </Button>
        )}
      </Box>
    );
  }
);

SignatureCapture.displayName = 'SignatureCapture';

export default SignatureCapture;
