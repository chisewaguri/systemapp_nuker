import { useState, useEffect, useRef, useCallback, useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'
import Header from '../components/Header'
import { refreshLists } from '../lib/refreshLists'
import SelectAll from '../components/SelectAll'
import SearchBar from '../components/SearchBar'
import Fab from '../components/Fab'
import WhiteoutList, { type WhiteoutListHandle } from '../components/WhiteoutList'
import SnackBar, { useSnackBar } from '../components/SnackBar'
import FileSelector from '../lib/FileSelector'
import { whiteoutManager, normalizeWhiteoutPath } from '../lib/Whiteout'
import { useAppList } from '../lib/AppListContext'
import { Cli } from '../lib/Cli'
import { runMutation } from '../lib/mutationLock'
import LoadError from '../components/LoadError'
import ReviewDialog from '../components/dialog/ReviewDialog'
import { useMutationBusy } from '../hooks/useMutationBusy'

export default function WhiteoutPage() {
  const { t } = useTranslation()
  const snackBar = useSnackBar()
  const appList = useAppList()
  const [whiteouts, setWhiteouts] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [searchQuery, setSearchQuery] = useState(() => whiteoutManager.getView().query)
  const [pendingChanges, setPendingChanges] = useState<{path: string, hiding: boolean}[]>([])
  const [fileSelectorOpen, setFileSelectorOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletePaths, setDeletePaths] = useState<string[]>([])
  const [restorePaths, setRestorePaths] = useState<string[]>([])
  const [selectedCount, setSelectedCount] = useState(0)
  const [hiddenSelectedCount, setHiddenSelectedCount] = useState(0)
  const [visibleCount, setVisibleCount] = useState(0)
  const visibleSelectedCount = selectedCount - hiddenSelectedCount
  const allVisibleSelected = visibleCount > 0 && visibleSelectedCount === visibleCount
  const whiteoutListRef = useRef<WhiteoutListHandle>(null)
  const [pendingPath, setPendingPath] = useState<string | null>(null)
  const [pathAccepted, setPathAccepted] = useState(false)
  const busy = useMutationBusy()
  const whiteoutVersion = useSyncExternalStore(whiteoutManager.subscribe, whiteoutManager.getVersion)

  useEffect(() => {
    whiteoutManager.setView({query: searchQuery})
  }, [searchQuery])

  useEffect(() => {
    if (busy) return
    let active = true
    whiteoutManager.waitForReady().then(() => {
      if (!active) return
      setWhiteouts([...whiteoutManager.whiteouts])
      setPendingChanges(whiteoutManager.pendingChanges)
      setLoading(false)
    }).catch(() => {
      if (!active) return
      setLoadFailed(true)
      setLoading(false)
    })
    return () => { active = false }
  }, [whiteoutVersion, busy])

  const handleSelectionChange = useCallback((selected: string[], hidden: number, visible: number) => {
    whiteoutManager.setView({selection: selected})
    setSelectedCount(selected.length)
    setHiddenSelectedCount(hidden)
    setVisibleCount(visible)
  }, [])

  const saveWhiteouts = async (next: string[]) => {
    let applied = false
    const started = await runMutation(async () => {
      whiteoutManager.whiteouts = next
      const ok = await whiteoutManager.write()
      if (!ok) {
        snackBar.show(t('global.write_error'), false)
      } else {
        // A failed nuke rolls the lists back on disk, so reload either way.
        applied = await Cli.nuke(snackBar.show)
        await refreshLists(appList).catch(() => {
          setLoadFailed(true)
          snackBar.show(t('global.read_error'), false)
        })
      }
    })
    if (!started) snackBar.show(t('global.processing'), true, 3000)
    return applied
  }

  const handleDelete = () => {
    const selected = whiteoutListRef.current?.getSelectedWhiteouts() ?? []
    if (selected.length === 0) return
    setDeletePaths(selected)
    setRestorePaths(selected)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (restorePaths.length === 0) return
    setDeleteDialogOpen(false)
    if (await saveWhiteouts(whiteouts.filter(w => !restorePaths.includes(w)))) {
      whiteoutManager.setView({selection: whiteoutManager.getView().selection.filter(path => !restorePaths.includes(path))})
    }
  }

  const handleAdd = async (value: string | null) => {
    setFileSelectorOpen(false)
    if (!value) return
    try {
      const finalPath = normalizeWhiteoutPath(value)
      if (whiteoutManager.whiteouts.includes(finalPath)) {
        snackBar.show(t('whiteout.duplicate'), false)
        return
      }
      setPathAccepted(false)
      setPendingPath(finalPath)
    } catch (error) {
      snackBar.show(t(`whiteout.${error instanceof Error ? error.message : 'invalid_path'}`), false)
    }
  }

  if (loading) {
    return (
      <div data-page-loading className="flex items-center justify-center h-full">
        <md-circular-progress indeterminate aria-label={t('global.loading')} />
      </div>
    )
  }

  if (loadFailed) {
    return <LoadError message={t('whiteout.load_error')} />
  }

  return (
    <>
      <Header
        title={selectedCount > 0 ? t('review.selection_title', {operation: t('whiteout.title'), count: selectedCount}) : t('whiteout.title')}
        action={visibleCount > 0 ? <SelectAll count={visibleCount} label={t(allVisibleSelected ? 'whiteout.deselect_all' : 'whiteout.select_all')} disabled={busy} checked={allVisibleSelected} indeterminate={visibleSelectedCount > 0 && !allVisibleSelected}
          onChange={() => allVisibleSelected ? whiteoutListRef.current?.deselectAllVisible() : whiteoutListRef.current?.selectAll()} /> : undefined}
        bottomContent={
          <>
            <SearchBar value={searchQuery} onChange={setSearchQuery} />
            {hiddenSelectedCount > 0 && <span role="status" className="text-sm text-on-surface-variant">{t('review.selected_hidden', {count: selectedCount, hidden: hiddenSelectedCount})}</span>}
          </>
        }
      />
      <WhiteoutList
        ref={whiteoutListRef}
        whiteouts={whiteouts}
        pendingChanges={pendingChanges}
        initialSelection={whiteoutManager.getView().selection}
        disabled={busy}
        searchQuery={searchQuery}
        emptyMessage={searchQuery ? t('global.no_results') : t('whiteout.empty')}
        onSelectionChange={handleSelectionChange}
      />
      <p className="px-6 text-sm text-on-surface-variant">{t('whiteout.hint')}</p>
      <Fab
        secondaryAction={selectedCount > 0 ? <md-icon-button class="size-12 shrink-0" aria-label={t('review.clear')} disabled={busy} onClick={() => whiteoutListRef.current?.clearSelection()}><md-icon>close</md-icon></md-icon-button> : undefined}
        onClick={selectedCount > 0 ? handleDelete : () => setFileSelectorOpen(true)}
        icon={selectedCount > 0 ? 'restore' : 'add'}
        label={selectedCount > 0 ? t('whiteout.review_restore', {count: selectedCount}) : t('whiteout.add')}
        disabled={busy}
      />
      <FileSelector open={fileSelectorOpen} title={t('whiteout.add')} fileType="any" mode="path" folder={true} onSelect={handleAdd} root="/" />
      <ReviewDialog open={pendingPath !== null} title={t('whiteout.confirm_title')} onClose={() => setPendingPath(null)} actions={<>
        <md-text-button onClick={() => setPendingPath(null)}>{t('whiteout.cancel')}</md-text-button>
        <md-filled-button disabled={!pathAccepted || busy} onClick={() => {
          if (!pendingPath || !pathAccepted) return
          const path = pendingPath
          setPendingPath(null)
          saveWhiteouts([...whiteoutManager.whiteouts, path])
        }}>{t('whiteout.confirm')}</md-filled-button>
      </>}>
        <p className="mt-0">{t('whiteout.confirm_message')}</p>
        <p className="font-mono text-sm break-all">{pendingPath}</p>
        <label className="flex items-start gap-2"><md-checkbox class="shrink-0" aria-label={t('whiteout.acknowledge')} checked={pathAccepted} onChange={() => setPathAccepted(value => !value)} /><span className="pt-2">{t('whiteout.acknowledge')}</span></label>
      </ReviewDialog>
      <ReviewDialog open={deleteDialogOpen} title={restorePaths.length ? t('whiteout.delete_title', {count: restorePaths.length}) : t('whiteout.none_selected')} onClose={() => setDeleteDialogOpen(false)} actions={<>
        <md-text-button onClick={() => setDeleteDialogOpen(false)}>{t('whiteout.cancel')}</md-text-button>
        <md-filled-button disabled={busy || restorePaths.length === 0} onClick={confirmDelete}>{t('whiteout.restore_confirm', {count: restorePaths.length})}</md-filled-button>
      </>}>
        {restorePaths.length > 0 && <p className="mt-0">{t('whiteout.delete_message', { count: restorePaths.length })}</p>}
        <ul className="m-0 list-none p-0 flex flex-col gap-2">{deletePaths.map(path => <li key={path}>
          <label className="flex min-h-12 min-w-0 items-center gap-2">
            <md-checkbox class="shrink-0" touch-target="wrapper" aria-label={t('whiteout.include_restore', {path})} checked={restorePaths.includes(path)}
              onChange={() => setRestorePaths(previous => previous.includes(path) ? previous.filter(value => value !== path) : [...previous, path])} />
            <span className="font-mono text-sm break-all">{path}</span>
          </label>
        </li>)}</ul>
      </ReviewDialog>
      <SnackBar state={snackBar.state} onHide={snackBar.hide} />
    </>
  )
}
