import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import Header from '../components/Header'
import SearchBar from '../components/SearchBar'
import Fab from '../components/Fab'
import WhiteoutList, { type WhiteoutListHandle } from '../components/WhiteoutList'
import SnackBar, { useSnackBar } from '../components/SnackBar'
import FileSelector from '../lib/FileSelector'
import { whiteoutManager } from '../lib/Whiteout'
import { useAppList } from '../lib/AppListContext'
import { Cli } from '../lib/Cli'
import { useHistory } from '../hooks/useHistory'
import { runMutation } from '../lib/mutationLock'
import LoadError from '../components/LoadError'

export default function WhiteoutPage() {
  const { t } = useTranslation()
  const snackBar = useSnackBar()
  const appList = useAppList()
  const [whiteouts, setWhiteouts] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [editMode, setEditMode] = useState(false)
  const [allSelected, setAllSelected] = useState(false)
  const [fileSelectorOpen, setFileSelectorOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedCount, setSelectedCount] = useState(0)
  const whiteoutListRef = useRef<WhiteoutListHandle>(null)
  const { push, consume } = useHistory()

  useEffect(() => {
    whiteoutManager.waitForReady().then(() => {
      setWhiteouts(whiteoutManager.whiteouts)
      setLoading(false)
    }).catch(() => {
      setLoadFailed(true)
      setLoading(false)
    })
  }, [])

  const handleSelectionChange = useCallback(() => {
    const selected = whiteoutListRef.current?.getSelectedWhiteouts() ?? []
    const query = searchQuery.toLowerCase()
    const visibleCount = whiteouts.filter(whiteout => query === '' || whiteout.toLowerCase().includes(query)).length
    setSelectedCount(selected.length)
    setAllSelected(selected.length === visibleCount && visibleCount > 0)
  }, [searchQuery, whiteouts])

  const handleEditModeChange = useCallback((isEditing: boolean) => {
    setEditMode(isEditing)
    if (!isEditing) {
      setAllSelected(false)
    }
  }, [])

  const handleClose = useCallback(() => {
    consume('whiteout-edit')
    whiteoutListRef.current?.hideCheckboxes()
    setEditMode(false)
    setAllSelected(false)
    setDeleteDialogOpen(false)
  }, [consume])

  useEffect(() => {
    if (editMode) {
      push('whiteout-edit', handleClose)
    }
  }, [editMode, push, handleClose])

  const handleSelectAll = () => {
    if (allSelected) {
      whiteoutListRef.current?.deselectAll()
      setAllSelected(false)
    } else {
      whiteoutListRef.current?.selectAll()
      setAllSelected(true)
    }
  }

  const saveWhiteouts = async (next: string[]) => {
    const started = await runMutation(async () => {
      whiteoutManager.whiteouts = next
      const ok = await whiteoutManager.write()
      if (!ok) {
        snackBar.show(t('global.write_error'), false)
      } else {
        // A failed nuke rolls the lists back on disk, so reload either way.
        await Cli.nuke(snackBar.show)
        await Promise.all([whiteoutManager.refresh(), appList.refresh()]).catch(() => {
          setLoadFailed(true)
          snackBar.show(t('global.read_error'), false)
        })
      }
      setWhiteouts([...whiteoutManager.whiteouts])
    })
    if (!started) snackBar.show(t('global.processing'), true, 3000)
  }

  const handleDelete = () => {
    if (selectedCount > 0) setDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    setDeleteDialogOpen(false)
    const selected = whiteoutListRef.current?.getSelectedWhiteouts() ?? []
    await saveWhiteouts(whiteouts.filter(w => !selected.includes(w)))
    handleClose()
  }

  const handleAdd = async (value: string | null) => {
    setFileSelectorOpen(false)
    if (!value) return
    if (/^\/(?:system\/)?data(?:\/|$)/.test(value)) {
      snackBar.show(t('whiteout.data_not_supported'), false)
      return
    }
    const finalPath = (value.startsWith('/system/') ? value : `/system${value}`).replace(/\/+$/, '')
    await saveWhiteouts([...whiteoutManager.whiteouts, finalPath])
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <md-circular-progress indeterminate />
      </div>
    )
  }

  if (loadFailed) {
    return <LoadError />
  }

  return (
    <>
      <Header
        title={editMode && selectedCount > 0 ? t('whiteout.selected', { count: selectedCount }) : t('whiteout.title')}
        navigationIcon={
          editMode ? (
            <md-icon-button aria-label={t('whiteout.close_edit')} onClick={handleClose}>
              <md-icon>close</md-icon>
            </md-icon-button>
          ) : undefined
        }
        action={
          editMode ? (
            <div className="flex items-center gap-2">
              <md-icon-button aria-label={t(allSelected ? 'whiteout.deselect_all' : 'whiteout.select_all')} onClick={handleSelectAll}>
                <md-icon>{allSelected ? 'deselect' : 'select_all'}</md-icon>
              </md-icon-button>
              <md-icon-button aria-label={t('whiteout.delete')} disabled={selectedCount === 0} onClick={handleDelete}>
                <md-icon>delete</md-icon>
              </md-icon-button>
            </div>
          ) : (
            <md-icon-button aria-label={t('whiteout.edit')} onClick={() => whiteoutListRef.current?.showCheckboxes()}>
              <md-icon>edit</md-icon>
            </md-icon-button>
          )
        }
        bottomContent={
          <SearchBar value={searchQuery} onChange={setSearchQuery} />
        }
      />
      <WhiteoutList
        ref={whiteoutListRef}
        whiteouts={whiteouts}
        searchQuery={searchQuery}
        emptyMessage={whiteouts.length === 0 ? t('whiteout.empty') : t('global.no_results')}
        onSelectionChange={handleSelectionChange}
        onEditModeChange={handleEditModeChange}
      />
      <Fab
        onClick={() => setFileSelectorOpen(true)}
        icon="add"
        label={t('whiteout.add')}
        variant="primary"
        open={!editMode}
      />
      <FileSelector open={fileSelectorOpen} fileType="any" mode="path" folder={true} onSelect={handleAdd} root="/" />
      <md-dialog open={deleteDialogOpen} onClosed={() => setDeleteDialogOpen(false)}>
        <div slot="headline">{t('whiteout.delete_title')}</div>
        <div slot="content">{t('whiteout.delete_message', { count: selectedCount })}</div>
        <div slot="actions">
          <md-text-button onClick={() => setDeleteDialogOpen(false)}>{t('whiteout.cancel')}</md-text-button>
          <md-filled-button onClick={confirmDelete}>{t('whiteout.delete')}</md-filled-button>
        </div>
      </md-dialog>
      <SnackBar state={snackBar.state} onHide={snackBar.hide} />
    </>
  )
}
