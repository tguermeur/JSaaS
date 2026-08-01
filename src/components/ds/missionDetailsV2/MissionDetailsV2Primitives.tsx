import React, { useState, useMemo, useEffect } from 'react';
import {
  Box,
  Typography,
  IconButton,
  TextField,
  MenuItem,
  Collapse,
  Button,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Check as CheckIcon,
} from '@mui/icons-material';
import { tokens } from '../../../theme/tokens';
import { DsToggle } from '../SettingsPrimitives';
import { mdFieldSx } from '../../../pages/missionDetails/v2/missionDetailsV2Styles';
import { CAND_PILL, STATUS_PILL } from '../../../pages/missionDetails/v2/constants';

/* ─── Pills & KPIs ─── */

export const EtapeStatusPill: React.FC<{ etape: string }> = ({ etape }) => {
  const style = STATUS_PILL[etape] || STATUS_PILL.Négociation;
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.625,
        fontSize: 10,
        fontWeight: 600,
        px: 1,
        py: '3px',
        borderRadius: 999,
        bgcolor: style.background,
        color: style.color,
        whiteSpace: 'nowrap',
      }}
    >
      <Box sx={{ width: 6, height: 6, borderRadius: 999, bgcolor: style.dot }} />
      {etape}
    </Box>
  );
};

export const CandidateStatusPill: React.FC<{ status: string }> = ({ status }) => {
  const style = CAND_PILL[status] || CAND_PILL['En attente'];
  return (
    <Box
      component="span"
      sx={{
        fontSize: 10,
        fontWeight: 600,
        px: 1,
        py: '3px',
        borderRadius: 999,
        bgcolor: style.background,
        color: style.color,
      }}
    >
      {status}
    </Box>
  );
};

export const MissionKpiCard: React.FC<{
  label: string;
  value: string | number;
  hint?: string;
  accent?: boolean;
}> = ({ label, value, hint, accent }) => (
  <Box
    sx={{
      p: 2.25,
      borderRadius: tokens.radius.lg,
      border: `1px solid ${accent ? tokens.colors.brandTeal : tokens.colors.gray100}`,
      bgcolor: accent ? `${tokens.colors.brandTeal}08` : tokens.colors.bgPaper,
    }}
  >
    <Typography sx={{ fontSize: 11, color: tokens.colors.gray500, mb: 0.5 }}>{label}</Typography>
    <Typography
      sx={{
        fontSize: 20,
        fontWeight: 600,
        color: tokens.colors.gray900,
        letterSpacing: '-0.02em',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {value}
    </Typography>
    {hint && <Typography sx={{ fontSize: 11, color: tokens.colors.gray400, mt: 0.25 }}>{hint}</Typography>}
  </Box>
);

/* ─── Collapsible panel ─── */

export const CollapsiblePanel: React.FC<{
  title: string;
  action?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}> = ({ title, action, defaultOpen = true, children }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Box
      sx={{
        bgcolor: tokens.colors.bgPaper,
        border: `1px solid ${tokens.colors.gray100}`,
        borderRadius: tokens.radius.lg,
        overflow: 'hidden',
      }}
    >
      <Box
        onClick={() => setOpen((o) => !o)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2.25,
          py: 1.75,
          cursor: 'pointer',
          userSelect: 'none',
          borderBottom: open ? `1px solid ${tokens.colors.gray100}` : 'none',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton size="small" sx={{ p: 0, transform: open ? 'rotate(180deg)' : 'none', transition: '0.15s' }}>
            <ExpandMoreIcon sx={{ fontSize: 18, color: tokens.colors.gray400 }} />
          </IconButton>
          <Typography sx={{ fontSize: 13, fontWeight: 600, color: tokens.colors.gray900 }}>{title}</Typography>
        </Box>
        {action && <Box onClick={(e) => e.stopPropagation()}>{action}</Box>}
      </Box>
      <Collapse in={open}>
        <Box sx={{ p: 2.25 }}>{children}</Box>
      </Collapse>
    </Box>
  );
};

/* ─── Inline field row ─── */

export const InlineFieldRow: React.FC<{
  label: string;
  value: string | number;
  onSave: (value: string) => void;
  type?: 'text' | 'number' | 'date' | 'time' | 'select';
  options?: { value: string; label: string }[];
  suffix?: string;
  readOnly?: boolean;
  /** Libellé affiché si la valeur courante n'est pas encore dans les options (chargement async). */
  fallbackLabel?: string;
}> = ({ label, value, onSave, type = 'text', options, suffix, readOnly, fallbackLabel }) => {
  const strValue = String(value ?? '');
  const [draft, setDraft] = useState(strValue);

  useEffect(() => {
    setDraft(strValue);
  }, [strValue]);

  const selectOptions = useMemo(() => {
    const opts = options ?? [];
    if (strValue && !opts.some((o) => o.value === strValue)) {
      return [{ value: strValue, label: fallbackLabel || strValue }, ...opts];
    }
    return opts;
  }, [options, strValue, fallbackLabel]);

  const selectValue = selectOptions.some((o) => o.value === strValue) ? strValue : '';

  return (
  <Box
    sx={{
      display: 'grid',
      gridTemplateColumns: { xs: '1fr', sm: '160px 1fr' },
      gap: 1.5,
      py: 1.25,
      borderBottom: `1px solid ${tokens.colors.gray100}`,
      '&:last-child': { borderBottom: 'none' },
    }}
  >
    <Typography sx={{ fontSize: 12, fontWeight: 500, color: tokens.colors.gray500, pt: 1 }}>{label}</Typography>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
      {readOnly ? (
        <Typography sx={{ fontSize: 13, color: tokens.colors.gray700, py: 1 }}>
          {type === 'select' ? (selectOptions.find((o) => o.value === strValue)?.label || strValue) : value}
        </Typography>
      ) : type === 'select' ? (
        <TextField
          select
          size="small"
          fullWidth
          value={selectValue}
          onChange={(e) => {
            const next = e.target.value;
            setDraft(next);
            if (next !== strValue) onSave(next);
          }}
          sx={mdFieldSx}
        >
          {selectOptions.map((o) => (
            <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
          ))}
        </TextField>
      ) : (
        <TextField
          size="small"
          fullWidth
          type={type === 'number' ? 'number' : type === 'date' ? 'date' : type === 'time' ? 'time' : 'text'}
          value={draft}
          onChange={(e) => {
            const next = e.target.value;
            setDraft(next);
            onSave(next);
          }}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
          InputLabelProps={type === 'date' || type === 'time' ? { shrink: true } : undefined}
          sx={mdFieldSx}
        />
      )}
      {suffix && <Typography sx={{ fontSize: 12, color: tokens.colors.gray400, flexShrink: 0 }}>{suffix}</Typography>}
    </Box>
  </Box>
  );
};

/* ─── Filter chips ─── */

export const FilterChipRow: React.FC<{
  items: { id: string; label: string; count: number }[];
  value: string;
  onChange: (id: string) => void;
}> = ({ items, value, onChange }) => (
  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
    {items.map((item) => {
      const active = value === item.id;
      return (
        <Button
          key={item.id}
          size="small"
          onClick={() => onChange(item.id)}
          sx={{
            textTransform: 'none',
            fontSize: 12,
            fontWeight: 500,
            borderRadius: 999,
            px: 1.5,
            py: 0.5,
            minWidth: 0,
            border: `1px solid ${active ? tokens.colors.gray900 : tokens.colors.gray200}`,
            bgcolor: active ? tokens.colors.gray900 : tokens.colors.bgPaper,
            color: active ? '#fff' : tokens.colors.gray700,
            '&:hover': { bgcolor: active ? tokens.colors.gray900 : tokens.colors.gray50 },
          }}
        >
          {item.label}
          <Box component="span" sx={{ opacity: 0.6, ml: 0.5 }}>{item.count}</Box>
        </Button>
      );
    })}
  </Box>
);

/* ─── Candidate row (expandable) ─── */

export const CandidateRowV2: React.FC<{
  initials: React.ReactNode;
  avatarBg?: string;
  name: React.ReactNode;
  school?: string;
  meta: string;
  status: string;
  hasCv?: boolean;
  hasMotivation?: boolean;
  expandedContent: React.ReactNode;
  actions?: React.ReactNode;
}> = ({ initials, avatarBg = tokens.colors.brandNavy, name, school, meta, status, hasCv, hasMotivation, expandedContent, actions }) => {
  const [open, setOpen] = useState(false);
  return (
    <Box sx={{ border: `1px solid ${tokens.colors.gray100}`, borderRadius: tokens.radius.md, overflow: 'hidden', mb: 1 }}>
      <Box
        onClick={() => setOpen((o) => !o)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1.5,
          p: 1.5,
          cursor: 'pointer',
          '&:hover': { bgcolor: tokens.colors.gray50 },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0, flex: 1 }}>
          <Box
            sx={{
              width: 32,
              height: 32,
              borderRadius: 999,
              bgcolor: avatarBg,
              color: '#fff',
              fontSize: 12,
              fontWeight: 700,
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
            }}
          >
            {initials}
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Typography sx={{ fontSize: 13, fontWeight: 600, color: tokens.colors.gray900 }}>{name}</Typography>
              {school && <Typography sx={{ fontSize: 11, color: tokens.colors.gray400 }}>{school}</Typography>}
            </Box>
            <Typography sx={{ fontSize: 11, color: tokens.colors.gray500, mt: 0.25 }}>{meta}</Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
          {hasCv && <TagMini>CV</TagMini>}
          {hasMotivation && <TagMini>LM</TagMini>}
          <CandidateStatusPill status={status} />
          <ExpandMoreIcon sx={{ fontSize: 16, color: tokens.colors.gray400, transform: open ? 'rotate(180deg)' : 'none', transition: '0.15s' }} />
        </Box>
      </Box>
      <Collapse in={open}>
        <Box sx={{ px: 2, pb: 2, pt: 0, borderTop: `1px solid ${tokens.colors.gray100}` }}>
          {expandedContent}
          {actions && (
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 1.75, flexWrap: 'wrap' }}>
              {actions}
            </Box>
          )}
        </Box>
      </Collapse>
    </Box>
  );
};

const TagMini: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Box
    component="span"
    sx={{
      fontSize: 9,
      fontWeight: 600,
      px: 0.75,
      py: '2px',
      borderRadius: 4,
      bgcolor: tokens.colors.gray100,
      color: tokens.colors.gray600,
    }}
  >
    {children}
  </Box>
);

export const KvCell: React.FC<{ label: string; value?: string }> = ({ label, value }) => (
  <Box>
    <Typography sx={{ fontSize: 10, fontWeight: 600, color: tokens.colors.gray400, textTransform: 'uppercase', letterSpacing: '0.04em', mb: 0.5 }}>
      {label}
    </Typography>
    <Typography sx={{ fontSize: 13, color: tokens.colors.gray900 }}>{value || '—'}</Typography>
  </Box>
);

/* ─── Document row ─── */

export const DocRowV2: React.FC<{
  iconBg: string;
  iconColor: string;
  name: React.ReactNode;
  meta: React.ReactNode;
  tags?: React.ReactNode;
  size?: string;
  actions?: React.ReactNode;
  onClick?: () => void;
}> = ({ iconBg, iconColor, name, meta, tags, size, actions, onClick }) => (
  <Box
    onClick={onClick}
    sx={{
      display: 'flex',
      alignItems: 'center',
      gap: 1.5,
      py: 1.25,
      borderBottom: `1px solid ${tokens.colors.gray100}`,
      cursor: onClick ? 'pointer' : 'default',
      '&:last-child': { borderBottom: 'none' },
      '&:hover': onClick ? { bgcolor: tokens.colors.gray50 } : undefined,
    }}
  >
    <Box
      sx={{
        width: 36,
        height: 36,
        borderRadius: tokens.radius.md,
        bgcolor: iconBg,
        color: iconColor,
        display: 'grid',
        placeItems: 'center',
        flexShrink: 0,
        fontSize: 11,
        fontWeight: 700,
      }}
    >
      PDF
    </Box>
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
        <Typography
          sx={{
            fontSize: 13,
            fontWeight: 600,
            color: tokens.colors.gray900,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            minWidth: 0,
          }}
        >
          {name}
        </Typography>
        {tags}
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap', mt: 0.25 }}>
        <Typography sx={{ fontSize: 11, color: tokens.colors.gray400 }}>{meta}</Typography>
      </Box>
    </Box>
    {size && (
      <Typography sx={{ fontSize: 11, color: tokens.colors.gray400, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
        {size}
      </Typography>
    )}
    {actions}
  </Box>
);

/* ─── Template action card ─── */

export const TemplateActionCard: React.FC<{
  label: string;
  hint: string;
  color: string;
  onClick?: () => void;
}> = ({ label, hint, color, onClick }) => (
  <Box
    component="button"
    onClick={onClick}
    sx={{
      display: 'flex',
      alignItems: 'center',
      gap: 1.5,
      p: 1.5,
      border: `1px solid ${tokens.colors.gray100}`,
      borderRadius: tokens.radius.md,
      bgcolor: tokens.colors.bgPaper,
      cursor: 'pointer',
      textAlign: 'left',
      fontFamily: 'inherit',
      width: '100%',
      '&:hover': { bgcolor: tokens.colors.gray50, borderColor: tokens.colors.gray200 },
    }}
  >
    <Box
      sx={{
        width: 32,
        height: 32,
        borderRadius: tokens.radius.md,
        bgcolor: `${color}1f`,
        color,
        display: 'grid',
        placeItems: 'center',
        flexShrink: 0,
        fontSize: 14,
        fontWeight: 700,
      }}
    >
      +
    </Box>
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Typography sx={{ fontSize: 13, fontWeight: 600, color: tokens.colors.gray900 }}>{label}</Typography>
      <Typography sx={{ fontSize: 11, color: tokens.colors.gray500, mt: 0.25 }}>{hint}</Typography>
    </Box>
  </Box>
);

/* ─── Dropzone ─── */

export const DocumentDropzone: React.FC<{
  onFiles: (files: FileList) => void;
  accent?: string;
}> = ({ onFiles, accent = tokens.colors.brandTeal }) => {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple
        hidden
        onChange={(e) => e.target.files && onFiles(e.target.files)}
      />
      <Box
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files.length) onFiles(e.dataTransfer.files);
        }}
        sx={{
          border: `2px dashed ${dragOver ? accent : tokens.colors.gray200}`,
          borderRadius: '10px',
          p: 4,
          textAlign: 'center',
          cursor: 'pointer',
          bgcolor: dragOver ? `${accent}0d` : tokens.colors.bgPaper,
          transition: '0.15s',
        }}
      >
        <Box
          sx={{
            width: 44,
            height: 44,
            borderRadius: 999,
            bgcolor: `${accent}1f`,
            color: accent,
            display: 'inline-grid',
            placeItems: 'center',
            mb: 1.25,
            fontSize: 20,
          }}
        >
          ↑
        </Box>
        <Typography sx={{ fontSize: 14, fontWeight: 600, color: tokens.colors.gray900 }}>
          Glissez-déposez un fichier ici
        </Typography>
        <Typography sx={{ fontSize: 12, color: tokens.colors.gray500, mt: 0.5 }}>
          ou <Box component="span" sx={{ color: accent, fontWeight: 600 }}>parcourez votre ordinateur</Box>
        </Typography>
      </Box>
    </>
  );
};

export const MissionEmptyState: React.FC<{
  text: string;
  actionLabel?: string;
  onAction?: () => void;
}> = ({ text, actionLabel, onAction }) => (
  <Box sx={{ textAlign: 'center', py: 4 }}>
    <Typography sx={{ fontSize: 12, color: tokens.colors.gray400 }}>{text}</Typography>
    {actionLabel && onAction && (
      <Button size="small" variant="outlined" onClick={onAction} sx={{ mt: 1.5, textTransform: 'none', borderRadius: tokens.radius.md }}>
        {actionLabel}
      </Button>
    )}
  </Box>
);

export const PriceSummaryRow: React.FC<{
  label: string;
  value: string;
  strong?: boolean;
  muted?: boolean;
  accent?: boolean;
}> = ({ label, value, strong, muted, accent }) => (
  <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
    <Typography sx={{ fontSize: 12, color: muted ? tokens.colors.gray400 : tokens.colors.gray600 }}>{label}</Typography>
    <Typography
      sx={{
        fontSize: strong ? 13 : 12,
        fontWeight: strong ? 600 : 500,
        color: accent ? tokens.colors.brandTeal : tokens.colors.gray900,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {value}
    </Typography>
  </Box>
);

export const MissionToggleRow: React.FC<{
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}> = ({ label, hint, checked, onChange, disabled }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 0.5 }}>
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Typography sx={{ fontSize: 13, fontWeight: 500, color: tokens.colors.gray900 }}>{label}</Typography>
      {hint && <Typography sx={{ fontSize: 11, color: tokens.colors.gray400, mt: 0.25 }}>{hint}</Typography>}
    </Box>
    <DsToggle checked={checked} onChange={onChange} disabled={disabled} />
  </Box>
);

export const MissionStepperV2: React.FC<{
  etape: string;
  onChange: (etape: string) => void;
  archived?: boolean;
  accent?: string;
}> = ({ etape, onChange, archived, accent = tokens.colors.brandTeal }) => {
  const stages = ['Négociation', 'Recrutement', 'Date de mission', 'Facturation', 'Audit'];
  if (archived) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1.25, px: 1.5, bgcolor: tokens.colors.gray100, borderRadius: tokens.radius.md, mb: 1.5 }}>
        <Typography sx={{ fontSize: 12, color: tokens.colors.gray600 }}>Cette mission est archivée</Typography>
      </Box>
    );
  }
  const idx = stages.indexOf(etape);
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1.5, overflowX: 'auto', pb: 0.5 }}>
      {stages.map((s, i) => {
        const done = i < idx;
        const active = i === idx;
        return (
          <React.Fragment key={s}>
            <Box
              component="button"
              onClick={() => onChange(s)}
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.75,
                border: 'none',
                bgcolor: 'transparent',
                cursor: 'pointer',
                fontFamily: 'inherit',
                color: done ? tokens.colors.success : active ? tokens.colors.gray900 : tokens.colors.gray400,
                p: 0,
                whiteSpace: 'nowrap',
              }}
            >
              <Box
                sx={{
                  width: 22,
                  height: 22,
                  borderRadius: 999,
                  bgcolor: done ? tokens.colors.success : active ? accent : tokens.colors.gray100,
                  color: done || active ? '#fff' : tokens.colors.gray400,
                  display: 'inline-grid',
                  placeItems: 'center',
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                {done ? <CheckIcon sx={{ fontSize: 12 }} /> : i + 1}
              </Box>
              <Typography sx={{ fontSize: 12, fontWeight: active ? 600 : 500 }}>{s}</Typography>
            </Box>
            {i < stages.length - 1 && (
              <Box
                sx={{
                  flex: 1,
                  minWidth: 16,
                  height: 2,
                  borderRadius: 1,
                  bgcolor: i < idx ? tokens.colors.success : tokens.colors.gray100,
                }}
              />
            )}
          </React.Fragment>
        );
      })}
    </Box>
  );
};
