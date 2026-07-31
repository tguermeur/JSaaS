import re

path = '/Users/teoguermeur/JSaaS/src/pages/MissionDetails.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add v2 imports after missionDetails index import
old_import = "} from './missionDetails/index';\nimport { renderDetailPanels }"
new_import = "} from './missionDetails/index';\nimport {\n  MissionDetailHeaderV2,\n  MissionSaveBar,\n  MissionOverviewTabV2,\n  MissionCandidatesTabV2,\n  MissionDocumentsTabV2,\n  MissionNotesTabV2,\n  mdV2RootSx,\n} from './missionDetails/v2';\nimport { renderDetailPanels }"
if old_import not in content:
    raise SystemExit('import anchor not found')
content = content.replace(old_import, new_import, 1)

# 2. Add overflow state after activeTab
old_state = "const [activeTab, setActiveTab] = useState<MissionDetailTabId>('overview');"
new_state = """const [activeTab, setActiveTab] = useState<MissionDetailTabId>('overview');
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [overflowAnchor, setOverflowAnchor] = useState<HTMLElement | null>(null);"""
if old_state not in content:
    raise SystemExit('state anchor not found')
content = content.replace(old_state, new_state, 1)

# 3. Replace renderMissionDetailBody function
pattern = r'  const renderMissionDetailBody = \(\): React\.ReactNode => \{.*?\n  \};\n\n  return \('
new_body = r'''  const acceptedCount = applications.filter((a) => a.status === 'Acceptée').length;
  const contactLabel = mission?.contact
    ? `${mission.contact.firstName || ''} ${mission.contact.lastName || ''}`.trim()
    : '';

  const handleOverviewFieldSave = (field: string, value: string | number | boolean) => {
    if (!mission?.id) return;
    if (field === 'companyId') {
      const company = companies.find((c) => c.id === value);
      handleFieldChange('companyId', value as string);
      void handleUpdateMission(mission.id, { companyId: value as string, company: company?.name || '' });
      return;
    }
    if (field === 'missionTypeId') {
      handleFieldChange('missionTypeId', value as string);
      void handleUpdateMission(mission.id, { missionTypeId: value as string });
      return;
    }
    if (field === 'chargeId') {
      handleFieldChange('chargeId', value as string);
      void handleUpdateMission(mission.id, { chargeId: value as string });
      return;
    }
    handleFieldChange(field as keyof Mission, value);
    void handleUpdateMission(mission.id, { [field]: value });
  };

  const handleOverviewDateSave = (which: 'start' | 'end', date: string, time: string) => {
    if (!mission?.id || !date) return;
    const iso = new Date(`${date}T${time || '00:00'}`).toISOString();
    if (which === 'start') {
      setStartDateDate(date);
      setStartDateTime(time);
      void handleUpdateMission(mission.id, { startDate: iso });
    } else {
      setEndDateDate(date);
      setEndDateTime(time);
      void handleUpdateMission(mission.id, { endDate: iso });
    }
  };

  const handleOverviewToggle = (field: string, value: boolean) => {
    if (!mission?.id) return;
    if (field === 'isPublished') {
      if (value !== isPublished) void handlePublishMission();
      return;
    }
    handleFieldChange(field as keyof Mission, value);
    void handleUpdateMission(mission.id, { [field]: value });
  };

  const handleAddExpenseRow = () => {
    if (expenses.length >= 4) return;
    const newExpense: MissionExpense = {
      id: `expense-new-${Date.now()}`,
      name: '',
      tva: 20,
      priceHT: 0,
    };
    setExpenses([...expenses, newExpense]);
    setIsPriceSaved(false);
  };

  const dirtyFields = !isPriceSaved ? ['priceHT'] : [];
  const dirtyCount = dirtyFields.length;

  const renderMissionDetailBody = (): React.ReactNode => {
    if (!mission) return null;

    switch (activeTab) {
      case 'overview':
        return (
          <MissionOverviewTabV2
            canWrite={canWrite}
            isArchived={mission.isArchived}
            totalHT={totalHT}
            totalTTC={totalTTC}
            tvaPercent={20}
            studentCount={mission.studentCount || 0}
            hoursPerStudent={mission.hoursPerStudent || 0}
            applicationsCount={applications.length}
            acceptedCount={acceptedCount}
            hours={mission.hours || 0}
            priceHT={priceHT}
            formatCurrency={formatCurrency}
            title={mission.title || ''}
            missionTypeId={mission.missionTypeId}
            missionTypeOptions={missionTypes.map((t) => ({ value: t.id, label: t.title }))}
            companyId={mission.companyId}
            companyOptions={companies.map((c) => ({ value: c.id, label: c.name }))}
            contactLabel={contactLabel}
            chargeId={mission.chargeId}
            chargeOptions={structureMembers.map((m) => ({ value: m.id, label: m.displayName }))}
            location={mission.location || ''}
            startDate={startDateDate}
            startTime={startDateTime}
            endDate={endDateDate}
            endTime={endDateTime}
            description={mission.description || ''}
            salary={mission.salary || ''}
            isPublished={isPublished}
            isPublic={mission.isPublic ?? false}
            requiresCV={mission.requiresCV}
            requiresMotivation={mission.requiresMotivation}
            expenses={expenses}
            onFieldSave={handleOverviewFieldSave}
            onDateSave={handleOverviewDateSave}
            onDescriptionSave={(v) => {
              handleFieldChange('description', v);
              void handleUpdateMission(mission.id, { description: v });
            }}
            onPriceHTChange={(v) => {
              setPriceHT(v);
              setIsPriceSaved(false);
              const { totalHT: th, totalTTC: tt } = calculatePrices(v, mission.hours, expenses);
              setTotalHT(th);
              setTotalTTC(tt);
            }}
            onPriceHTBlur={() => void handleSavePrice()}
            onSalarySave={(v) => handleOverviewFieldSave('salary', v)}
            onTvaSave={() => {}}
            onAddExpense={handleAddExpenseRow}
            onExpenseChange={(index, patch) => {
              const updated = [...expenses];
              updated[index] = { ...updated[index], ...patch };
              setExpenses(updated);
              setIsPriceSaved(false);
              const { totalHT: th, totalTTC: tt } = calculatePrices(priceHT, mission.hours, updated);
              setTotalHT(th);
              setTotalTTC(tt);
            }}
            onExpenseSave={(index) => void handleSaveExpense(index)}
            onExpenseDelete={(index) => void handleDeleteExpense(index)}
            onToggle={handleOverviewToggle}
          />
        );
      case 'candidates':
        return (
          <MissionCandidatesTabV2
            applications={applications}
            canWrite={canWrite}
            loading={loadingApplications}
            onAddCandidate={() => setOpenAddCandidateDialog(true)}
            onAccept={(id) => void handleUpdateApplicationStatus(id, 'Acceptée')}
            onReject={(id) => void handleUpdateApplicationStatus(id, 'Refusée')}
            onWorkingHours={(app) => setWorkingHoursDialog({ open: true, application: app })}
            onDownloadCv={(url) => window.open(url, '_blank')}
          />
        );
      case 'documents':
        return (
          <MissionDocumentsTabV2
            documents={generatedDocuments}
            canWrite={canWrite}
            generating={generatingDoc}
            onGenerate={(type) => void generateDocument(type)}
            onUpload={(files, category) => {
              Array.from(files).forEach((file) => handleOpenUploadDialog(category, file));
            }}
            onOpenDocument={(doc) => {
              if (currentUser) {
                trackUserActivity(currentUser.uid, 'document', {
                  id: doc.id,
                  title: doc.fileName || 'Document',
                  subtitle: `Mission ${mission.numeroMission}`,
                  url: doc.fileUrl,
                });
              }
              window.open(doc.fileUrl, '_blank');
            }}
            onDocumentMenu={(e, doc) => handleDocumentMenuOpen(e, doc)}
          />
        );
      case 'notes':
        return (
          <MissionNotesTabV2
            notes={notes}
            loading={loadingNotes}
            canWrite={canWrite}
            newNote={newNote}
            onNewNoteChange={setNewNote}
            onAddNote={() => void handleAddNote()}
            composerSlot={
              <TaggingInput
                value={newNote}
                onChange={setNewNote}
                placeholder="Ajouter une note… utilisez @ pour mentionner un membre"
                multiline
                rows={3}
                availableUsers={availableUsersForTagging}
                onTaggedUsersChange={handleTaggedUsersChange}
              />
            }
            editingNoteId={editingNoteId}
            editedContent={editedNoteContent}
            onEditContentChange={setEditedNoteContent}
            onEditNote={handleEditNote}
            onSaveNote={(id) => void handleSaveNote(id)}
            onCancelEdit={() => { setEditingNoteId(null); setEditedNoteContent(''); }}
            onDeleteNote={(id) => void handleDeleteNote(id)}
            currentUserInitials={
              (currentUser?.displayName || currentUser?.email || 'MO').slice(0, 2).toUpperCase()
            }
          />
        );
      case 'activity':
        return <ActivityTab entries={activityEntries} />;
      default:
        return null;
    }
  };

  return ('''

new_content, n = re.subn(pattern, new_body, content, count=1, flags=re.DOTALL)
if n != 1:
    raise SystemExit(f'renderMissionDetailBody replace failed: {n}')

# 4. Replace return layout header section
old_return_start = """  return (
    <Box sx={dsPageCanvasSx}>"""
new_return_start = """  return (
    <Box sx={{ ...dsPageCanvasSx, ...mdV2RootSx }}>"""
new_content = new_content.replace(old_return_start, new_return_start, 1)

old_header = """      <Box sx={{ ...dsDetailHeaderSx, px: { xs: 2, md: 4 }, pt: 2, pb: 0 }}>
        <Box sx={{ maxWidth: 1400, mx: 'auto' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Button
              startIcon={<ChevronLeftIcon />}
              onClick={() => navigate('/app/mission')}
              sx={{ color: tokens.colors.textSecondary, textTransform: 'none' }}
            >
              Retour aux missions
            </Button>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              {canWrite && (
                <Tooltip title="Partager">
                  <IconButton
                    onClick={() => setIsPermissionsDialogOpen(true)}
                    sx={{ color: tokens.colors.textSecondary }}
                  >
                    <ShareIcon />
                  </IconButton>
                </Tooltip>
              )}
              {mission && canWrite && (
                <Box sx={{ display: 'flex', gap: 1 }}>
                  {!isEditing ? (
                    <>
                      <Tooltip title="Modifier">
                        <IconButton
                          onClick={handleEdit}
                          sx={{
                            color: 'text.secondary',
                            '&:hover': {
                              color: '#007AFF',
                              backgroundColor: 'rgba(0, 122, 255, 0.04)'
                            }
                          }}
                        >
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Supprimer">
                        <IconButton
                          onClick={() => setDeleteDialogOpen(true)}
                          sx={{
                            color: 'text.secondary',
                            '&:hover': {
                              color: '#FF3B30',
                              backgroundColor: 'rgba(255, 59, 48, 0.04)'
                            }
                          }}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </>
                  ) : (
                    <Tooltip title="Enregistrer">
                      <IconButton
                        onClick={handleSave}
                        sx={{
                          color: '#007AFF',
                          '&:hover': {
                            backgroundColor: 'rgba(0, 122, 255, 0.04)'
                          }
                        }}
                      >
                        <SaveIcon />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>
              )}
            </Box>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            {mission && (
              <>
                <Typography component="h1" sx={{ fontSize: '1.25rem', fontWeight: 600, color: tokens.colors.gray900 }}>
                  Mission #{mission?.numeroMission}
                </Typography>
                {mission?.isArchived && (
                  <Chip
                    label="Archivée"
                    size="small"
                    sx={{
                      backgroundColor: 'rgba(0, 122, 255, 0.1)',
                      color: '#007AFF',
                      fontWeight: 500,
                      borderRadius: '6px'
                    }}
                  />
                )}
              </>
            )}
          </Box>

          {mission && (
            <Box sx={{ mb: 1.5 }}>
              <MissionEtape
                etape={mission.etape}
                onEtapeChange={handleEtapeChange}
                isEditing={isEditing}
                isArchived={mission.isArchived}
              />
            </Box>
          )}

          <Tabs
            value={activeTab}
            onChange={(_, value: MissionDetailTabId) => setActiveTab(value)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{ mt: 1, ...dsTabsSx }}
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
                  icon={missionTabIcons[tab.id]}
                  iconPosition="start"
                  label={count != null && count > 0 ? `${tab.label} (${count})` : tab.label}
                />
              );
            })}
          </Tabs>
        </Box>
      </Box>"""

new_header = """      {mission && (
        <MissionDetailHeaderV2
          numeroMission={mission.numeroMission}
          title={mission.title || ''}
          etape={mission.etape}
          isPublished={isPublished}
          isArchived={mission.isArchived}
          activeTab={activeTab}
          tabCounts={tabCounts}
          canWrite={canWrite}
          onBack={() => navigate('/app/mission')}
          onTabChange={setActiveTab}
          onTitleSave={(t) => {
            handleFieldChange('title', t);
            void handleUpdateMission(mission.id, { title: t });
          }}
          onEtapeChange={(e) => void handleEtapeChange(e as MissionEtape)}
          onShare={() => setIsPermissionsDialogOpen(true)}
          onGoDocuments={() => setActiveTab('documents')}
          onNewDocument={() => setActiveTab('documents')}
          overflowOpen={overflowOpen}
          overflowAnchor={overflowAnchor}
          onOverflowToggle={(el) => {
            setOverflowAnchor(el);
            setOverflowOpen(!!el);
          }}
          onDelete={() => setDeleteDialogOpen(true)}
          onArchive={() => {
            void handleUpdateMission(mission.id, { isArchived: !mission.isArchived });
          }}
        />
      )}"""

if old_header not in new_content:
    raise SystemExit('header block not found')
new_content = new_content.replace(old_header, new_header, 1)

# 5. Add save bar before closing main Box - find MissionDetailShell closing
old_shell_end = """      </MissionDetailShell>

      <Dialog"""
new_shell_end = """      </MissionDetailShell>

      <MissionSaveBar
        dirtyCount={dirtyCount}
        dirtyFields={dirtyFields}
        onSave={() => void handleSavePrice()}
        onDiscard={() => {
          if (mission) {
            setPriceHT(mission.priceHT || 0);
            const { totalHT: th, totalTTC: tt } = calculatePrices(mission.priceHT || 0, mission.hours, expenses);
            setTotalHT(th);
            setTotalTTC(tt);
            setIsPriceSaved(true);
          }
        }}
      />

      <Dialog"""
if old_shell_end not in new_content:
    raise SystemExit('shell end not found')
new_content = new_content.replace(old_shell_end, new_shell_end, 1)

with open(path, 'w', encoding='utf-8') as f:
    f.write(new_content)

print('OK - MissionDetails.tsx updated')
