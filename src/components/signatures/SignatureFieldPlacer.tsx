import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  IconButton,
  MenuItem,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  DeleteOutline as DeleteIcon,
  DragIndicator as DragIcon,
} from '@mui/icons-material';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import { tokens } from '../../theme/tokens';
import type { SignatureField } from '../../types/signature';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

const COLORS = ['#21BDA3', '#173B6C', '#f59e0b', '#ec4899', '#8b5cf6', '#ef4444'];
const ZOOM_LEVELS = [75, 100, 125, 150] as const;
const BASE_PAGE_WIDTH = 560;
const MIN_W = 8;
const MIN_H = 4;
const DEFAULT_W = 28;
const DEFAULT_H = 8;

const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const;
type Handle = (typeof HANDLES)[number];

export type DraftSigner = { name: string; email: string };

type Props = {
  pdfUrl: string;
  signers: DraftSigner[];
  fields: SignatureField[];
  onChange: (fields: SignatureField[]) => void;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function newFieldId() {
  return `field_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

const SignatureFieldPlacer: React.FC<Props> = ({ pdfUrl, signers, fields, onChange }) => {
  const [numPages, setNumPages] = useState(0);
  const [activeSignerOrder, setActiveSignerOrder] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number>(100);
  const [draggingPalette, setDraggingPalette] = useState(false);
  const [ghost, setGhost] = useState<{ x: number; y: number } | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const fieldsRef = useRef(fields);
  fieldsRef.current = fields;

  const pageWidth = Math.round((BASE_PAGE_WIDTH * zoom) / 100);

  const selected = useMemo(
    () => fields.find((f) => f.id === selectedId) || null,
    [fields, selectedId]
  );

  const updateField = useCallback(
    (id: string, patch: Partial<SignatureField>) => {
      onChange(fieldsRef.current.map((f) => (f.id === id ? { ...f, ...patch } : f)));
    },
    [onChange]
  );

  const removeField = useCallback(
    (id: string) => {
      onChange(fieldsRef.current.filter((f) => f.id !== id));
      setSelectedId((cur) => (cur === id ? null : cur));
    },
    [onChange]
  );

  const clientToPagePct = useCallback((clientX: number, clientY: number) => {
    const el = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
    const pageEl = el?.closest('[data-page-index]') as HTMLElement | null;
    if (!pageEl) return null;
    const pageIndex = Number(pageEl.dataset.pageIndex);
    if (!Number.isFinite(pageIndex)) return null;
    const rect = pageEl.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const xPct = ((clientX - rect.left) / rect.width) * 100;
    const yPct = ((clientY - rect.top) / rect.height) * 100;
    return {
      pageIndex,
      xPct: clamp(xPct, 0, 100),
      yPct: clamp(yPct, 0, 100),
    };
  }, []);

  const placeAt = useCallback(
    (pageIndex: number, centerXPct: number, centerYPct: number) => {
      const order = Math.min(activeSignerOrder, Math.max(0, signers.length - 1));
      const id = newFieldId();
      const field: SignatureField = {
        id,
        signerOrder: order,
        pageIndex,
        xPct: clamp(centerXPct - DEFAULT_W / 2, 0, 100 - DEFAULT_W),
        yPct: clamp(centerYPct - DEFAULT_H / 2, 0, 100 - DEFAULT_H),
        widthPct: DEFAULT_W,
        heightPct: DEFAULT_H,
        label: signers[order]?.name || `Signataire ${order + 1}`,
      };
      onChange([...fieldsRef.current, field]);
      setSelectedId(id);
    },
    [activeSignerOrder, onChange, signers]
  );

  const addInViewportCenter = () => {
    const container = scrollRef.current;
    if (!container || numPages === 0) {
      placeAt(0, 50, 50);
      return;
    }
    const rect = container.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const hit = clientToPagePct(cx, cy);
    if (hit) {
      placeAt(hit.pageIndex, hit.xPct, hit.yPct);
    } else {
      placeAt(0, 50, 50);
    }
  };

  // Palette pointer-drag (works for mouse + touch, unlike HTML5 DnD on mobile)
  const onPalettePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDraggingPalette(true);
    setGhost({ x: e.clientX, y: e.clientY });

    const move = (ev: PointerEvent) => {
      setGhost({ x: ev.clientX, y: ev.clientY });
    };
    const up = (ev: PointerEvent) => {
      setDraggingPalette(false);
      setGhost(null);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      const hit = clientToPagePct(ev.clientX, ev.clientY);
      if (hit) placeAt(hit.pageIndex, hit.xPct, hit.yPct);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const onBoxPointerDown = (e: React.PointerEvent, id: string) => {
    e.stopPropagation();
    e.preventDefault();
    setSelectedId(id);
    const field = fieldsRef.current.find((f) => f.id === id);
    if (!field) return;

    const pageEl = (e.currentTarget as HTMLElement).closest(
      '[data-page-index]'
    ) as HTMLElement | null;
    if (!pageEl) return;
    const pageRect = pageEl.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const orig = { ...field };

    const move = (ev: PointerEvent) => {
      const dxPct = ((ev.clientX - startX) / pageRect.width) * 100;
      const dyPct = ((ev.clientY - startY) / pageRect.height) * 100;
      updateField(id, {
        xPct: clamp(orig.xPct + dxPct, 0, 100 - orig.widthPct),
        yPct: clamp(orig.yPct + dyPct, 0, 100 - orig.heightPct),
      });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const onHandlePointerDown = (e: React.PointerEvent, id: string, handle: Handle) => {
    e.stopPropagation();
    e.preventDefault();
    setSelectedId(id);
    const field = fieldsRef.current.find((f) => f.id === id);
    if (!field) return;
    const pageEl = (e.currentTarget as HTMLElement).closest(
      '[data-page-index]'
    ) as HTMLElement | null;
    if (!pageEl) return;
    const pageRect = pageEl.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const orig = { ...field };

    const move = (ev: PointerEvent) => {
      const dxPct = ((ev.clientX - startX) / pageRect.width) * 100;
      const dyPct = ((ev.clientY - startY) / pageRect.height) * 100;
      let { xPct, yPct, widthPct, heightPct } = orig;

      if (handle.includes('e')) {
        widthPct = clamp(orig.widthPct + dxPct, MIN_W, 100 - orig.xPct);
      }
      if (handle.includes('s')) {
        heightPct = clamp(orig.heightPct + dyPct, MIN_H, 100 - orig.yPct);
      }
      if (handle.includes('w')) {
        const newX = clamp(orig.xPct + dxPct, 0, orig.xPct + orig.widthPct - MIN_W);
        widthPct = orig.widthPct + (orig.xPct - newX);
        xPct = newX;
      }
      if (handle.includes('n')) {
        const newY = clamp(orig.yPct + dyPct, 0, orig.yPct + orig.heightPct - MIN_H);
        heightPct = orig.heightPct + (orig.yPct - newY);
        yPct = newY;
      }

      updateField(id, {
        xPct,
        yPct,
        widthPct: clamp(widthPct, MIN_W, 100),
        heightPct: clamp(heightPct, MIN_H, 100),
      });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        e.preventDefault();
        removeField(selectedId);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [removeField, selectedId]);

  const activeColor = COLORS[activeSignerOrder % COLORS.length];

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' },
        gap: 2,
        minHeight: 0,
        height: { xs: 'auto', md: 'min(70vh, 640px)' },
      }}
    >
      {/* Palette */}
      <Box
        sx={{
          width: { xs: '100%', md: 200 },
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 1.5,
        }}
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          Champs
        </Typography>
        <TextField
          select
          size="small"
          label="Signataire"
          value={activeSignerOrder}
          onChange={(e) => setActiveSignerOrder(Number(e.target.value))}
          fullWidth
        >
          {signers.map((s, i) => (
            <MenuItem key={i} value={i}>
              {s.name || s.email || `Signataire ${i + 1}`}
            </MenuItem>
          ))}
        </TextField>

        <Box
          onPointerDown={onPalettePointerDown}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            px: 1.5,
            py: 1.25,
            borderRadius: tokens.radius.md,
            border: `2px dashed ${activeColor}`,
            bgcolor: `${activeColor}14`,
            cursor: 'grab',
            userSelect: 'none',
            touchAction: 'none',
            '&:active': { cursor: 'grabbing' },
          }}
        >
          <DragIcon sx={{ color: activeColor, fontSize: 20 }} />
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: activeColor }}>
              Signature
            </Typography>
            <Typography sx={{ fontSize: 11, color: tokens.colors.textSecondary }} noWrap>
              Glisser sur le PDF
            </Typography>
          </Box>
        </Box>

        <Button
          size="small"
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={addInViewportCenter}
          fullWidth
        >
          Ajouter au centre
        </Button>

        <Typography variant="caption" color="text.secondary">
          Scroll libre sur le document. Glissez une case pour la déplacer, utilisez les poignées
          pour redimensionner.
        </Typography>

        <Typography variant="caption" sx={{ fontWeight: 600, mt: 1 }}>
          {fields.length} case{fields.length !== 1 ? 's' : ''}
        </Typography>
      </Box>

      {/* Viewer */}
      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Typography variant="body2" sx={{ color: tokens.colors.textSecondary }}>
            Zoom
          </Typography>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={zoom}
            onChange={(_, v) => v && setZoom(v)}
          >
            {ZOOM_LEVELS.map((z) => (
              <ToggleButton key={z} value={z} sx={{ px: 1.25, py: 0.25, fontSize: 12 }}>
                {z}%
              </ToggleButton>
            ))}
          </ToggleButtonGroup>

          {selected && (
            <>
              <Chip
                size="small"
                label={`Page ${(selected.pageIndex ?? 0) + 1}`}
                sx={{ ml: { md: 1 } }}
              />
              <TextField
                select
                size="small"
                label="Assigné à"
                value={selected.signerOrder}
                onChange={(e) => {
                  const order = Number(e.target.value);
                  updateField(selected.id, {
                    signerOrder: order,
                    label: signers[order]?.name || `Signataire ${order + 1}`,
                  });
                }}
                sx={{ minWidth: 140 }}
              >
                {signers.map((s, i) => (
                  <MenuItem key={i} value={i}>
                    {s.name || s.email || `#${i + 1}`}
                  </MenuItem>
                ))}
              </TextField>
              <IconButton
                size="small"
                color="error"
                aria-label="Supprimer la case"
                onClick={() => removeField(selected.id)}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </>
          )}
        </Box>

        <Box
          ref={scrollRef}
          onPointerDown={() => setSelectedId(null)}
          sx={{
            flex: 1,
            minHeight: 360,
            overflow: 'auto',
            border: `1px solid ${tokens.colors.borderDefault}`,
            borderRadius: tokens.radius.md,
            bgcolor: tokens.colors.gray100,
            touchAction: draggingPalette ? 'none' : 'pan-y',
            WebkitOverflowScrolling: 'touch',
            p: 2,
          }}
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <Document
              file={pdfUrl}
              onLoadSuccess={({ numPages: n }) => setNumPages(n)}
              loading={
                <Typography sx={{ p: 4, color: tokens.colors.textSecondary }}>
                  Chargement du PDF…
                </Typography>
              }
            >
              {Array.from({ length: numPages }, (_, i) => {
                const pageFields = fields.filter((f) => f.pageIndex === i);
                return (
                  <Box
                    key={i}
                    data-page-index={i}
                    sx={{
                      position: 'relative',
                      lineHeight: 0,
                      boxShadow: '0 2px 12px rgba(0,0,0,0.12)',
                      bgcolor: '#fff',
                    }}
                  >
                    <Page
                      pageNumber={i + 1}
                      width={pageWidth}
                      renderTextLayer={false}
                      renderAnnotationLayer={false}
                    />
                    {pageFields.map((f) => {
                      const color = COLORS[f.signerOrder % COLORS.length];
                      const isSelected = f.id === selectedId;
                      return (
                        <Box
                          key={f.id}
                          data-sig-box
                          onPointerDown={(e) => onBoxPointerDown(e, f.id)}
                          sx={{
                            position: 'absolute',
                            left: `${f.xPct}%`,
                            top: `${f.yPct}%`,
                            width: `${f.widthPct}%`,
                            height: `${f.heightPct}%`,
                            border: `${isSelected ? 2 : 1.5}px solid ${color}`,
                            bgcolor: `${color}28`,
                            borderRadius: '2px',
                            cursor: 'move',
                            touchAction: 'none',
                            userSelect: 'none',
                            zIndex: isSelected ? 5 : 2,
                            boxShadow: isSelected ? `0 0 0 1px ${color}` : 'none',
                            display: 'flex',
                            alignItems: 'flex-start',
                            p: 0.5,
                          }}
                        >
                          <Typography
                            sx={{
                              fontSize: 10,
                              fontWeight: 700,
                              color,
                              lineHeight: 1.2,
                              pointerEvents: 'none',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              maxWidth: '100%',
                            }}
                          >
                            {signers[f.signerOrder]?.name || `S${f.signerOrder + 1}`}
                          </Typography>

                          {isSelected &&
                            HANDLES.map((h) => (
                              <Box
                                key={h}
                                onPointerDown={(e) => onHandlePointerDown(e, f.id, h)}
                                sx={{
                                  position: 'absolute',
                                  width: 10,
                                  height: 10,
                                  bgcolor: '#fff',
                                  border: `2px solid ${color}`,
                                  borderRadius: '2px',
                                  zIndex: 6,
                                  touchAction: 'none',
                                  ...handlePosition(h),
                                  cursor: handleCursor(h),
                                }}
                              />
                            ))}
                        </Box>
                      );
                    })}
                  </Box>
                );
              })}
            </Document>
          </Box>
        </Box>
      </Box>

      {/* Ghost while dragging palette */}
      {ghost && (
        <Box
          sx={{
            position: 'fixed',
            left: ghost.x + 8,
            top: ghost.y + 8,
            width: 140,
            height: 40,
            border: `2px solid ${activeColor}`,
            bgcolor: `${activeColor}33`,
            borderRadius: 1,
            pointerEvents: 'none',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            fontWeight: 700,
            color: activeColor,
          }}
        >
          Signature
        </Box>
      )}
    </Box>
  );
};

function handlePosition(h: Handle): Record<string, string | number> {
  const mid = { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
  switch (h) {
    case 'nw':
      return { top: -5, left: -5 };
    case 'n':
      return { top: -5, left: '50%', transform: 'translateX(-50%)' };
    case 'ne':
      return { top: -5, right: -5 };
    case 'e':
      return { top: '50%', right: -5, transform: 'translateY(-50%)' };
    case 'se':
      return { bottom: -5, right: -5 };
    case 's':
      return { bottom: -5, left: '50%', transform: 'translateX(-50%)' };
    case 'sw':
      return { bottom: -5, left: -5 };
    case 'w':
      return { top: '50%', left: -5, transform: 'translateY(-50%)' };
    default:
      return mid;
  }
}

function handleCursor(h: Handle): string {
  switch (h) {
    case 'n':
    case 's':
      return 'ns-resize';
    case 'e':
    case 'w':
      return 'ew-resize';
    case 'ne':
    case 'sw':
      return 'nesw-resize';
    case 'nw':
    case 'se':
      return 'nwse-resize';
    default:
      return 'default';
  }
}

export default SignatureFieldPlacer;
