import React from 'react';
import { Box, Typography } from '@mui/material';
import { tokens } from '../../theme/tokens';

interface LifecycleStep {
  id: string;
  label: string;
  done: boolean;
  active: boolean;
}

interface LifecycleTrackerProps {
  steps: LifecycleStep[];
  accent?: string;
}

export const LifecycleTracker: React.FC<LifecycleTrackerProps> = ({
  steps,
  accent = tokens.colors.brandTeal,
}) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0 }}>
    {steps.map((step, i) => (
      <React.Fragment key={step.id}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.75, minWidth: 72 }}>
          <Box
            sx={{
              width: 28,
              height: 28,
              borderRadius: tokens.radius.pill,
              display: 'grid',
              placeItems: 'center',
              bgcolor: step.done ? accent : step.active ? `${accent}22` : tokens.colors.gray100,
              color: step.done ? '#fff' : step.active ? accent : tokens.colors.gray400,
              fontSize: 12,
              fontWeight: 700,
              border: step.active && !step.done ? `2px solid ${accent}` : 'none',
            }}
          >
            {step.done ? '✓' : i + 1}
          </Box>
          <Typography sx={{ fontSize: 10, color: step.active ? tokens.colors.gray900 : tokens.colors.gray400, fontWeight: step.active ? 600 : 400, textAlign: 'center' }}>
            {step.label}
          </Typography>
        </Box>
        {i < steps.length - 1 && (
          <Box
            sx={{
              flex: 1,
              height: 2,
              bgcolor: step.done ? accent : tokens.colors.gray200,
              minWidth: 24,
              mb: 2.5,
            }}
          />
        )}
      </React.Fragment>
    ))}
  </Box>
);

interface ProfileCompletionMeterProps {
  pct: number;
  accent?: string;
}

const SS_MISSION_STAGES = ['Sélectionné', 'En cours', 'Livrée', 'Payée'] as const;

export const SSTracker: React.FC<{
  stage: string;
  accent?: string;
  compact?: boolean;
}> = ({ stage, accent = tokens.colors.brandTeal, compact }) => {
  const idx = SS_MISSION_STAGES.indexOf(stage as (typeof SS_MISSION_STAGES)[number]);
  const activeIdx = idx >= 0 ? idx : 0;

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: compact ? 0.5 : 0.75 }}>
      {SS_MISSION_STAGES.map((label, i) => {
        const done = i < activeIdx;
        const active = i === activeIdx;
        return (
          <React.Fragment key={label}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <Box
                sx={{
                  width: compact ? 18 : 20,
                  height: compact ? 18 : 20,
                  borderRadius: tokens.radius.pill,
                  bgcolor: done ? tokens.colors.success : active ? accent : tokens.colors.gray100,
                  color: done || active ? '#fff' : tokens.colors.gray400,
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: 10,
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {done ? '✓' : i + 1}
              </Box>
              {!compact && (
                <Typography
                  sx={{
                    fontSize: 11,
                    fontWeight: active ? 600 : 500,
                    color: active ? tokens.colors.gray900 : done ? tokens.colors.success : tokens.colors.gray400,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {label}
                </Typography>
              )}
            </Box>
            {i < SS_MISSION_STAGES.length - 1 && (
              <Box
                sx={{
                  flex: 1,
                  height: 2,
                  borderRadius: 1,
                  bgcolor: i < activeIdx ? tokens.colors.success : tokens.colors.gray100,
                  minWidth: compact ? 10 : 16,
                }}
              />
            )}
          </React.Fragment>
        );
      })}
    </Box>
  );
};

export const ProfileCompletionMeter: React.FC<ProfileCompletionMeterProps> = ({
  pct,
  accent = tokens.colors.brandTeal,
}) => (
  <Box>
    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
      <Typography sx={{ fontSize: 12, color: tokens.colors.gray500, fontWeight: 500 }}>Profil complété</Typography>
      <Typography sx={{ fontSize: 12, color: tokens.colors.gray900, fontWeight: 600 }}>{pct}%</Typography>
    </Box>
    <Box sx={{ height: 6, bgcolor: tokens.colors.gray100, borderRadius: tokens.radius.pill, overflow: 'hidden' }}>
      <Box
        sx={{
          width: `${pct}%`,
          height: '100%',
          bgcolor: accent,
          borderRadius: tokens.radius.pill,
          transition: 'width 0.5s ease',
        }}
      />
    </Box>
  </Box>
);
