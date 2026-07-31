import React, { useState, useRef, useEffect } from 'react';
import { Box, Button, IconButton, Tab, Tabs, Typography } from '@mui/material';
import {
  ChevronLeft as ChevronLeftIcon,
  MoreHoriz as MoreHorizIcon,
  Dashboard as DashboardIcon,
  People as PeopleIcon,
  Folder as FolderIcon,
  Description as DescriptionIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';
import { tokens } from '../../../theme/tokens';
import { dsTabsSx } from '../../../components/ds';
import { MISSION_DETAIL_TABS, type MissionDetailTabId } from '../../../hooks/useMissionDetailTabs';
import { EtapeStatusPill, MissionStepperV2 } from '../../../components/ds/missionDetailsV2/MissionDetailsV2Primitives';
import { mdV2HeaderSx } from './missionDetailsV2Styles';
import type { MissionDetailHeaderV2Props } from './types';
import { MissionOverflowMenu } from './MissionOverflowMenu';

const TAB_ICONS: Record<MissionDetailTabId, React.ReactElement> = {
  overview: <DashboardIcon sx={{ fontSize: 18 }} />,
  candidates: <PeopleIcon sx={{ fontSize: 18 }} />,
  documents: <FolderIcon sx={{ fontSize: 18 }} />,
  notes: <DescriptionIcon sx={{ fontSize: 18 }} />,
  activity: <ScheduleIcon sx={{ fontSize: 18 }} />,
};

export const MissionDetailHeaderV2: React.FC<
  MissionDetailHeaderV2Props & {
    onArchive?: () => void;
    onDelete?: () => void;
    onDuplicate?: () => void;
  }
> = ({
  numeroMission,
  title,
  etape,
  isPublished,
  isArchived,
  activeTab,
  tabCounts,
  canWrite,
  accent = tokens.colors.brandTeal,
  onBack,
  onTabChange,
  onTitleSave,
  onEtapeChange,
  onShare,
  onGoDocuments,
  onNewDocument,
  overflowOpen,
  overflowAnchor,
  onOverflowToggle,
  onArchive,
  onDelete,
  onDuplicate,
}) => {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(title);
  const titleRef = useRef<HTMLInputElement>(null);
  const overflowBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setTitleDraft(title);
  }, [title]);

  useEffect(() => {
    if (editingTitle) titleRef.current?.focus();
  }, [editingTitle]);

  const commitTitle = () => {
    setEditingTitle(false);
    if (titleDraft.trim() && titleDraft !== title) onTitleSave(titleDraft.trim());
    else setTitleDraft(title);
  };

  return (
    <Box sx={{ ...mdV2HeaderSx, px: { xs: 2, md: 3 } }}>
      <Box sx={{ maxWidth: 1400, mx: 'auto' }}>
        {/* Breadcrumb */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
          <IconButton size="small" onClick={onBack} sx={{ color: tokens.colors.gray400, mr: 0.5 }}>
            <ChevronLeftIcon sx={{ fontSize: 18 }} />
          </IconButton>
          <Typography sx={{ fontSize: 11, color: tokens.colors.gray400 }}>CRM</Typography>
          <Typography sx={{ fontSize: 11, color: tokens.colors.gray300 }}>/</Typography>
          <Button
            onClick={onBack}
            sx={{ fontSize: 11, color: tokens.colors.gray500, textTransform: 'none', minWidth: 0, p: 0 }}
          >
            Missions
          </Button>
          <Typography sx={{ fontSize: 11, color: tokens.colors.gray300 }}>/</Typography>
          <Typography
            sx={{ fontSize: 11, color: tokens.colors.gray900, fontFamily: 'monospace', fontWeight: 500 }}
          >
            {numeroMission}
          </Typography>
        </Box>

        {/* Title row */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, mb: 1.5 }}>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 0.75 }}>
              <Typography sx={{ fontSize: 11, color: tokens.colors.gray400, fontFamily: 'monospace' }}>
                {numeroMission}
              </Typography>
              <EtapeStatusPill etape={etape} />
              {isPublished && (
                <Box
                  component="span"
                  sx={{
                    fontSize: 10,
                    fontWeight: 600,
                    px: 1,
                    py: '3px',
                    borderRadius: 999,
                    bgcolor: '#d1fae5',
                    color: '#065f46',
                  }}
                >
                  Publiée
                </Box>
              )}
              {isArchived && (
                <Box
                  component="span"
                  sx={{
                    fontSize: 10,
                    fontWeight: 600,
                    px: 1,
                    py: '3px',
                    borderRadius: 999,
                    bgcolor: tokens.colors.gray100,
                    color: tokens.colors.gray500,
                  }}
                >
                  Archivée
                </Box>
              )}
            </Box>

            {editingTitle && canWrite ? (
              <Box
                component="input"
                ref={titleRef}
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={commitTitle}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitTitle();
                  if (e.key === 'Escape') { setTitleDraft(title); setEditingTitle(false); }
                }}
                sx={{
                  fontSize: 20,
                  fontWeight: 600,
                  letterSpacing: '-0.02em',
                  color: tokens.colors.gray900,
                  border: `2px solid ${tokens.colors.brandNavy}`,
                  borderRadius: '6px',
                  px: 1,
                  py: 0.5,
                  width: '100%',
                  maxWidth: 560,
                  fontFamily: 'inherit',
                  outline: 'none',
                }}
              />
            ) : (
              <Typography
                component="h1"
                onClick={() => canWrite && !isArchived && setEditingTitle(true)}
                sx={{
                  fontSize: 20,
                  fontWeight: 600,
                  letterSpacing: '-0.02em',
                  color: tokens.colors.gray900,
                  cursor: canWrite && !isArchived ? 'text' : 'default',
                  m: 0,
                }}
              >
                {title || 'Sans titre'}
              </Typography>
            )}
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0, position: 'relative' }}>
            {canWrite && (
              <Button
                size="small"
                variant="outlined"
                onClick={onShare}
                sx={{ textTransform: 'none', borderRadius: '6px', borderColor: tokens.colors.gray200, color: tokens.colors.gray700, fontSize: 13 }}
              >
                Partager
              </Button>
            )}
            <Button
              size="small"
              variant="outlined"
              onClick={onGoDocuments}
              sx={{ textTransform: 'none', borderRadius: '6px', borderColor: tokens.colors.gray200, color: tokens.colors.gray700, fontSize: 13 }}
            >
              Documents
            </Button>
            {canWrite && (
              <Button
                size="small"
                variant="contained"
                onClick={onNewDocument}
                sx={{
                  textTransform: 'none',
                  borderRadius: '6px',
                  bgcolor: accent,
                  fontSize: 13,
                  boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
                  '&:hover': { bgcolor: accent, filter: 'brightness(0.95)' },
                }}
              >
                Nouveau document
              </Button>
            )}
            <IconButton
              ref={overflowBtnRef}
              size="small"
              onClick={(e) => onOverflowToggle(overflowOpen ? null : e.currentTarget)}
              sx={{ border: `1px solid ${tokens.colors.gray200}`, borderRadius: '6px' }}
            >
              <MoreHorizIcon sx={{ fontSize: 18 }} />
            </IconButton>
            <MissionOverflowMenu
              open={overflowOpen}
              anchorEl={overflowAnchor}
              isArchived={isArchived}
              onClose={() => onOverflowToggle(null)}
              onArchive={onArchive}
              onDelete={onDelete}
              onDuplicate={onDuplicate}
            />
          </Box>
        </Box>

        {/* Stepper */}
        <MissionStepperV2
          etape={etape}
          onChange={onEtapeChange}
          archived={isArchived}
          accent={accent}
        />

        {/* Tabs */}
        <Tabs
          value={activeTab}
          onChange={(_, value: MissionDetailTabId) => onTabChange(value)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            ...dsTabsSx,
            '& .MuiTabs-indicator': { bgcolor: accent },
            '& .MuiTab-root.Mui-selected': { color: tokens.colors.gray900 },
          }}
        >
          {MISSION_DETAIL_TABS.map((tab) => {
            const count =
              tab.id === 'candidates' ? tabCounts.candidates
                : tab.id === 'documents' ? tabCounts.documents
                  : tab.id === 'notes' ? tabCounts.notes
                    : null;
            return (
              <Tab
                key={tab.id}
                value={tab.id}
                icon={TAB_ICONS[tab.id]}
                iconPosition="start"
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    {tab.label}
                    {count != null && count > 0 && (
                      <Box
                        component="span"
                        sx={{
                          fontSize: 10,
                          fontWeight: 600,
                          px: 0.75,
                          py: '1px',
                          borderRadius: 999,
                          bgcolor: tokens.colors.gray100,
                          color: tokens.colors.gray500,
                        }}
                      >
                        {count}
                      </Box>
                    )}
                  </Box>
                }
                sx={{ textTransform: 'none', fontSize: 13, minHeight: 44 }}
              />
            );
          })}
        </Tabs>
      </Box>
    </Box>
  );
};
