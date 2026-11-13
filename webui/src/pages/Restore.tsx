import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import Header from '../components/Header'
import SelectAll from '../components/SelectAll'
import SearchBar from '../components/SearchBar'
import { removalCounts } from '../lib/uad'
import AppList, { type AppListHandle } from '../components/AppList'
import { type AppInfo } from '../lib/AppList'
import { useAppList } from '../lib/AppListContext'
import { refreshLists } from '../lib/refreshLists'
import { Cli } from '../lib/Cli'
import SnackBar, { useSnackBar } from '../components/SnackBar'
import Fab from '../components/Fab'
import { runMutation } from '../lib/mutationLock'
import LoadError from '../components/LoadError'
import AppReviewDialog from '../components/dialog/AppReviewDialog'
import { useMutationBusy } from '../hooks/useMutationBusy'

export default function Restore() {
  const { t } = useTranslation()
  const { state: snackBarState, show: showSnackBar, hide: hideSnackBar } = useSnackBar()
  const appListManager = useAppList()
  const appListVersion = appListManager.getVersion()
  const [apps, setApps] = useState<AppInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [fabVisible, setFabVisible] = useState(true)
  const [searchQuery, setSearchQuery] = useState(() => appListManager.getView('restore').query)
  const [selectedCategories, setSelectedCategories] = useState<string[]>(() => appListManager.getView('restore').categories)
  const appListRef = useRef<AppListHandle>(null)
  const [selectedPackages, setSelectedPackages] = useState<string[]>([])
  const [hiddenSelectedCount, setHiddenSelectedCount] = useState(0)
  const [visibleCount, setVisibleCount] = useState(0)
  const selectedCount = selectedPackages.length
  const visibleSelectedCount = selectedCount - hiddenSelectedCount
  const allVisibleSelected = visibleCount > 0 && visibleSelectedCount === visibleCount
  const [reviewOpen, setReviewOpen] = useState(false)
  const [reviewApps, setReviewApps] = useState<AppInfo[]>([])
  const busy = useMutationBusy()

  useEffect(() => {
    appListManager.setView('restore', {query: searchQuery, categories: selectedCategories})
  }, [appListManager, searchQuery, selectedCategories])

  const handleSelectionChange = useCallback((packages: string[], hidden: number, visible: number) => {
    setSelectedPackages(packages)
    setHiddenSelectedCount(hidden)
    setVisibleCount(visible)
  }, [])

  useEffect(() => {
    if (busy) return
    let active = true
    appListManager.waitForReady().then(() => {
      if (!active) return
      setApps(appListManager.nukedAppList.filter(app => !app.pending).map(app => ({...app})))
      setLoading(false)
    }).catch(() => {
      if (!active) return
      setLoadFailed(true)
      setLoading(false)
    })
    return () => { active = false }
  }, [appListManager, appListVersion, busy])

  const handleFabVisibilityChange = useCallback((visible: boolean) => {
    setFabVisible(visible)
  }, [])

  const handleFabClick = useCallback(async () => {
    const started = await runMutation(async () => {
      const selected = appListRef.current?.getSelectedPackages() ?? []
      const currentApps = appListManager.nukedAppList
      const submitted: string[] = []

      for (const app of currentApps) {
        const isSelected = selected.includes(app.packageName)

        if (isSelected) {
          appListManager.setRestore(app.packageName, true)
          submitted.push(app.packageName)
        }
      }

      if (submitted.length === 0) return
      showSnackBar(t('global.processing'), true, 60000)

      const ok = await appListManager.write()
      if (!ok) {
        showSnackBar(t('global.write_error'), false)
      } else {
        // A failed nuke rolls the lists back on disk, so reload either way.
        if (await Cli.nuke(showSnackBar)) {
          appListManager.setSelection('restore', appListManager.getSelection('restore').filter(pkg => !submitted.includes(pkg)))
        }
        await refreshLists(appListManager)
          .catch(() => {
            setLoadFailed(true)
            showSnackBar(t('global.read_error'), false)
          })
      }
    })
    if (!started) showSnackBar(t('global.processing'), true, 3000)
  }, [appListManager, showSnackBar, t])

  const toggleCategory = (categoryId: string) => {
    setSelectedCategories(prev =>
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    )
  }

  if (loading) {
    return (
      <div data-page-loading className="flex items-center justify-center h-full">
        <md-circular-progress indeterminate aria-label={t('global.loading')} />
      </div>
    )
  }

  if (loadFailed) {
    return <LoadError message={t('restore.load_error')} />
  }

  return (
    <>
      <Header
        title={selectedCount ? t('review.selection_title', {operation: t('restore.title'), count: selectedCount}) : t('restore.title')}
        action={visibleCount > 0 ? <SelectAll count={visibleCount} label={t(allVisibleSelected ? 'review.deselect_visible' : 'review.select_visible')} disabled={busy} checked={allVisibleSelected} indeterminate={visibleSelectedCount > 0 && !allVisibleSelected}
          onChange={() => allVisibleSelected ? appListRef.current?.deselectAllVisible() : appListRef.current?.selectAllVisible()} /> : undefined}
        bottomContent={
          <>
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              filter={{ selected: selectedCategories, onToggle: toggleCategory, counts: removalCounts(apps, searchQuery), pendingCounts: removalCounts(appListManager.pendingApps, searchQuery) }}
            />
            {hiddenSelectedCount > 0 && <span role="status" className="text-sm text-on-surface-variant">{t('review.selected_hidden', {count: selectedCount, hidden: hiddenSelectedCount})}</span>}
          </>
        }
      />
      <AppList
        ref={appListRef}
        selectionKey="restore"
        disabled={busy}
        onSelectionChange={handleSelectionChange}
        apps={apps}
        searchQuery={searchQuery}
        selectedCategories={selectedCategories}
        emptyMessage={apps.length === 0 && !searchQuery ? t('restore.empty') : t('global.no_results')}
      />
      <Fab
        secondaryAction={<md-icon-button class="size-12 shrink-0" aria-label={t('review.clear')} disabled={busy} onClick={() => appListRef.current?.clearSelection()}><md-icon>close</md-icon></md-icon-button>}
        onClick={() => {
          setReviewApps(apps.filter(app => selectedPackages.includes(app.packageName)))
          setReviewOpen(true)
        }}
        icon="restore"
        label={t('review.restore_action', {count: selectedCount})}
        open={selectedCount > 0}
        disabled={selectedCount === 0 || busy}
        onVisibilityChange={handleFabVisibilityChange}
      />
      <AppReviewDialog open={reviewOpen} apps={reviewApps} operation="restore" selectedPackages={selectedPackages}
        onToggle={pkg => appListRef.current?.toggleSelection(pkg)}
        onClose={() => setReviewOpen(false)} onConfirm={() => { setReviewOpen(false); handleFabClick() }} />
      <SnackBar state={snackBarState} onHide={hideSnackBar} fabVisible={fabVisible} />
    </>
  )
}
