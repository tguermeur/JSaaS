import React from 'react';
import {
  Box,
  Button,
  IconButton,
  TextField,
  Typography,
} from '@mui/material';
import { DeleteOutline as DeleteIcon, Receipt as ReceiptIcon } from '@mui/icons-material';
import { tokens } from '../../../theme/tokens';
import {
  CollapsiblePanel,
  InlineFieldRow,
  MissionKpiCard,
  MissionToggleRow,
  PriceSummaryRow,
} from '../../../components/ds/missionDetailsV2/MissionDetailsV2Primitives';
import { mdFieldSx, mdV2KpiGridSx } from './missionDetailsV2Styles';

interface MissionExpense {
  id: string;
  name: string;
  tva: number;
  priceHT: number;
  isSaved?: boolean;
}

interface MissionOverviewTabV2Props {
  canWrite: boolean;
  isArchived?: boolean;
  // KPIs
  totalHT: number;
  totalTTC: number;
  tvaPercent: number;
  studentCount: number;
  hoursPerStudent: string | number;
  applicationsCount: number;
  acceptedCount: number;
  hours: number;
  priceHT: number;
  formatCurrency: (v: number) => string;
  // Fields
  /** Identifiant affiché (numéro de mission). */
  title: string;
  missionTypeId?: string;
  missionTypeLabel?: string;
  missionTypeOptions: { value: string; label: string }[];
  companyId?: string;
  companyName?: string;
  companyOptions: { value: string; label: string }[];
  contactId?: string;
  contactLabel: string;
  contactOptions: { value: string; label: string }[];
  chargeId?: string;
  chargeName?: string;
  chargeOptions: { value: string; label: string }[];
  location: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  description: string;
  salary: string;
  // Flags
  isPublished: boolean;
  requiresCV: boolean;
  requiresMotivation: boolean;
  // Expenses
  expenses: MissionExpense[];
  // Handlers
  onFieldSave: (field: string, value: string | number | boolean) => void;
  onDateSave: (which: 'start' | 'end', date: string, time: string) => void;
  onDescriptionSave: (value: string) => void;
  onPriceHTChange: (value: number) => void;
  onPriceHTBlur: () => void;
  onSalarySave: (value: string) => void;
  onTvaSave: (value: number) => void;
  onAddExpense: () => void;
  onExpenseChange: (index: number, patch: Partial<MissionExpense>) => void;
  onExpenseSave: (index: number) => void;
  onExpenseDelete: (index: number) => void;
  onToggle: (field: string, value: boolean) => void;
}

export const MissionOverviewTabV2: React.FC<MissionOverviewTabV2Props> = ({
  canWrite,
  isArchived,
  totalHT,
  totalTTC,
  tvaPercent,
  studentCount,
  hoursPerStudent,
  applicationsCount,
  acceptedCount,
  hours,
  priceHT,
  formatCurrency,
  title,
  missionTypeId,
  missionTypeLabel,
  missionTypeOptions,
  companyId,
  companyName,
  companyOptions,
  contactId,
  contactLabel,
  contactOptions,
  chargeId,
  chargeName,
  chargeOptions,
  location,
  startDate,
  startTime,
  endDate,
  endTime,
  description,
  salary,
  isPublished,
  requiresCV,
  requiresMotivation,
  expenses,
  onFieldSave,
  onDateSave,
  onDescriptionSave,
  onPriceHTChange,
  onPriceHTBlur,
  onSalarySave,
  onTvaSave,
  onAddExpense,
  onExpenseChange,
  onExpenseSave,
  onExpenseDelete,
  onToggle,
}) => {
  const readOnly = !canWrite || isArchived;
  const expensesTotalHT = expenses.reduce((s, e) => s + (e.priceHT || 0), 0);
  const honorairesHT = priceHT * hours;
  const tvaAmount = totalTTC - totalHT;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.75 }}>
      <Box sx={mdV2KpiGridSx}>
        <MissionKpiCard
          label="Total HT"
          value={formatCurrency(totalHT)}
          hint={`${priceHT} €/h × ${hours}h`}
        />
        <MissionKpiCard
          label="Total TTC"
          value={formatCurrency(totalTTC)}
          hint={`TVA ${tvaPercent}%`}
          accent
        />
        <MissionKpiCard
          label="Étudiants"
          value={studentCount}
          hint={`${hoursPerStudent}h chacun`}
        />
        <MissionKpiCard
          label="Candidatures"
          value={applicationsCount}
          hint={`${acceptedCount} acceptée${acceptedCount > 1 ? 's' : ''}`}
        />
      </Box>

      <CollapsiblePanel title="Informations générales">
        <InlineFieldRow
          label="Numéro de mission"
          value={title}
          onSave={(v) => onFieldSave('numeroMission', v)}
          readOnly={readOnly}
        />
        <InlineFieldRow
          label="Type de mission"
          value={missionTypeId || ''}
          type="select"
          options={missionTypeOptions}
          fallbackLabel={missionTypeLabel}
          onSave={(v) => onFieldSave('missionTypeId', v)}
          readOnly={readOnly}
        />
        <InlineFieldRow
          label="Entreprise"
          value={companyId || ''}
          type="select"
          options={companyOptions}
          fallbackLabel={companyName}
          onSave={(v) => onFieldSave('companyId', v)}
          readOnly={readOnly}
        />
        <InlineFieldRow
          label="Contact"
          value={contactId || ''}
          type="select"
          options={contactOptions}
          fallbackLabel={contactLabel}
          onSave={(v) => onFieldSave('contactId', v)}
          readOnly={readOnly}
        />
        <InlineFieldRow
          label="Chargé de mission"
          value={chargeId || ''}
          type="select"
          options={chargeOptions}
          fallbackLabel={chargeName}
          onSave={(v) => onFieldSave('chargeId', v)}
          readOnly={readOnly}
        />
        <InlineFieldRow label="Lieu" value={location} onSave={(v) => onFieldSave('location', v)} readOnly={readOnly} />
        <DateTimeRow label="Date de début" date={startDate} time={startTime} readOnly={readOnly} onSave={(d, t) => onDateSave('start', d, t)} />
        <DateTimeRow label="Date de fin" date={endDate} time={endTime} readOnly={readOnly} onSave={(d, t) => onDateSave('end', d, t)} />
        <InlineFieldRow
          label="Nombre d'étudiants"
          value={studentCount}
          type="number"
          onSave={(v) => onFieldSave('studentCount', parseInt(v, 10) || 0)}
          readOnly={readOnly}
        />
        <InlineFieldRow
          label="Heures / étudiant"
          value={hoursPerStudent}
          type="number"
          suffix="h"
          onSave={(v) => onFieldSave('hoursPerStudent', v)}
          readOnly={readOnly}
        />
        <InlineFieldRow
          label="Total heures"
          value={hours}
          type="number"
          suffix="h"
          onSave={(v) => onFieldSave('hours', parseInt(v, 10) || 0)}
          readOnly={readOnly}
        />
      </CollapsiblePanel>

      <CollapsiblePanel title="Description">
        <TextField
          multiline
          minRows={4}
          fullWidth
          value={description}
          disabled={readOnly}
          onChange={(e) => onDescriptionSave(e.target.value)}
          placeholder="Description de la mission…"
          sx={{
            ...mdFieldSx,
            '& .MuiOutlinedInput-root': {
              ...(mdFieldSx as Record<string, unknown>)['& .MuiOutlinedInput-root'],
              alignItems: 'flex-start',
            },
          }}
        />
      </CollapsiblePanel>

      <CollapsiblePanel
        title="Tarification"
        action={
          <Typography sx={{ fontSize: 11, color: tokens.colors.gray400, fontStyle: 'italic' }}>
            auto-calculée
          </Typography>
        }
      >
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 0 }}>
          <Box>
            <InlineFieldRow
              label="Prix horaire HT"
              value={priceHT}
              type="number"
              suffix="€/h"
              readOnly={readOnly}
              onSave={(v) => {
                onPriceHTChange(parseFloat(v) || 0);
                onPriceHTBlur();
              }}
            />
            <InlineFieldRow
              label="Salaire étudiant"
              value={salary}
              suffix="€"
              readOnly={readOnly}
              onSave={onSalarySave}
            />
          </Box>
          <Box>
            <InlineFieldRow
              label="TVA"
              value={tvaPercent}
              type="number"
              suffix="%"
              readOnly={readOnly}
              onSave={(v) => onTvaSave(parseFloat(v) || 0)}
            />
            <InlineFieldRow
              label="Total TTC (auto)"
              value={formatCurrency(totalTTC)}
              readOnly
              onSave={() => {}}
            />
          </Box>
        </Box>

        <Box sx={{ mt: 2, p: 1.5, bgcolor: '#fafafa', borderRadius: '6px' }}>
          <PriceSummaryRow label={`Honoraires (${hours}h × ${priceHT}€)`} value={formatCurrency(honorairesHT)} />
          {expenses.map((exp) => (
            <PriceSummaryRow key={exp.id} label={`+ ${exp.name || 'Dépense'}`} value={formatCurrency(exp.priceHT)} muted />
          ))}
          <Box sx={{ borderTop: `1px solid ${tokens.colors.gray200}`, my: 0.75 }} />
          <PriceSummaryRow label="Total HT" value={formatCurrency(totalHT)} strong />
          <PriceSummaryRow label={`TVA ${tvaPercent}%`} value={formatCurrency(tvaAmount)} muted />
          <PriceSummaryRow label="Total TTC" value={formatCurrency(totalTTC)} strong accent />
        </Box>

        <Box sx={{ mt: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography sx={{ fontSize: 12, fontWeight: 600, color: tokens.colors.gray700 }}>
              Dépenses ({expenses.length}/4)
            </Typography>
            {!readOnly && (
              <Button
                size="small"
                onClick={onAddExpense}
                disabled={expenses.length >= 4}
                sx={{ textTransform: 'none', fontSize: 12, color: tokens.colors.brandTeal }}
              >
                + Ajouter une dépense
              </Button>
            )}
          </Box>
          {expenses.length === 0 ? (
            <Typography sx={{ fontSize: 11, color: tokens.colors.gray400, fontStyle: 'italic' }}>
              Aucune dépense ajoutée
            </Typography>
          ) : (
            expenses.map((exp, index) => (
              <Box
                key={exp.id}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  py: 1,
                  borderBottom: `1px solid ${tokens.colors.gray100}`,
                }}
              >
                <ReceiptIcon sx={{ fontSize: 16, color: tokens.colors.gray400 }} />
                <TextField
                  size="small"
                  placeholder="Nom"
                  value={exp.name}
                  disabled={readOnly}
                  onChange={(e) => onExpenseChange(index, { name: e.target.value })}
                  sx={{ ...mdFieldSx, flex: 1 }}
                />
                <Typography sx={{ fontSize: 11, color: tokens.colors.gray400, flexShrink: 0 }}>
                  TVA {exp.tva}%
                </Typography>
                <TextField
                  size="small"
                  type="number"
                  value={exp.priceHT}
                  disabled={readOnly}
                  onChange={(e) => onExpenseChange(index, { priceHT: parseFloat(e.target.value) || 0 })}
                  sx={{ ...mdFieldSx, width: 90 }}
                />
                {!readOnly && (
                  <IconButton size="small" onClick={() => onExpenseDelete(index)}>
                    <DeleteIcon sx={{ fontSize: 16, color: tokens.colors.gray400 }} />
                  </IconButton>
                )}
              </Box>
            ))
          )}
        </Box>
      </CollapsiblePanel>

      <CollapsiblePanel title="Publication & candidatures" defaultOpen={false}>
        <MissionToggleRow
          label="Mission publiée"
          hint="Visible sur le portail étudiants"
          checked={isPublished}
          onChange={(v) => onToggle('isPublished', v)}
          disabled={readOnly}
        />
        <MissionToggleRow
          label="CV requis pour candidater"
          checked={requiresCV}
          onChange={(v) => onToggle('requiresCV', v)}
          disabled={readOnly}
        />
        <MissionToggleRow
          label="Lettre de motivation requise"
          checked={requiresMotivation}
          onChange={(v) => onToggle('requiresMotivation', v)}
          disabled={readOnly}
        />
        <MissionToggleRow
          label="Mission archivée"
          hint="Lecture seule"
          checked={!!isArchived}
          onChange={(v) => onToggle('isArchived', v)}
          disabled={readOnly}
        />
      </CollapsiblePanel>
    </Box>
  );
};

const DateTimeRow: React.FC<{
  label: string;
  date: string;
  time: string;
  readOnly?: boolean;
  onSave: (date: string, time: string) => void;
}> = ({ label, date, time, readOnly, onSave }) => (
  <Box
    sx={{
      display: 'grid',
      gridTemplateColumns: { xs: '1fr', sm: '160px 1fr' },
      gap: 1.5,
      py: 1.25,
      borderBottom: `1px solid ${tokens.colors.gray100}`,
    }}
  >
    <Typography sx={{ fontSize: 12, fontWeight: 500, color: tokens.colors.gray500, pt: 1 }}>{label}</Typography>
    <Box sx={{ display: 'flex', gap: 1 }}>
      <TextField
        size="small"
        type="date"
        value={date}
        disabled={readOnly}
        onChange={(e) => onSave(e.target.value, time)}
        InputLabelProps={{ shrink: true }}
        sx={{ ...mdFieldSx, flex: 1 }}
      />
      <TextField
        size="small"
        type="time"
        value={time}
        disabled={readOnly}
        onChange={(e) => onSave(date, e.target.value)}
        InputLabelProps={{ shrink: true }}
        sx={{ ...mdFieldSx, width: 120 }}
      />
    </Box>
  </Box>
);
