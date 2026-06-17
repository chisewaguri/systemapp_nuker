import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import Header from '../components/Header'
import SearchBar from '../components/SearchBar'
import Fab from '../components/Fab'
import WhiteoutList, { type WhiteoutListHandle } from '../components/WhiteoutList'
import SnackBar, { useSnackBar } from '../components/SnackBar'
import FileSelector from '../lib/FileSelector'
import { Whiteout as WhiteoutManager } from '../lib/Whiteout'
import { Cli } from '../lib/Cli'
import { useHistory } from '../hooks/useHistory'

const whiteoutManager = new WhiteoutManager()

export default function WhiteoutPage() {
  const { t } = useTranslation()
  const snackBar = useSnackBar()
  const [whiteouts, setWhiteouts] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [editMode, setEditMode] = useState(false)
  const [allSelected, setAllSelected] = useState(false)
  const [fileSelectorOpen, setFileSelectorOpen] = useState(false)
  const whiteoutListRef = useRef<WhiteoutListHandle>(null)
  const { push, consume } = useHistory()

  useEffect(() => {
    whiteoutManager.waitForReady().then(() => {
      setWhiteouts(whiteoutManager.whiteouts)
      setLoading(false)
    })
  }, [])

  const handleSelectionChange = useCallback(() => {
    const selected = whiteoutListRef.current?.getSelectedWhiteouts() ?? []
    setAllSelected(selected.length === whiteouts.length && whiteouts.length > 0)
  }, [whiteouts.length])

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

  const handleDelete = async () => {
    const selected = whiteoutListRef.current?.getSelectedWhiteouts() ?? []
    const remaining = whiteouts.filter(w => !selected.includes(w))
    whiteoutManager.whiteouts = remaining
    const ok = await whiteoutManager.write()
    if (!ok) {
      snackBar.show(t('global.write_error'), false)
    } else {
      Cli.nuke(snackBar.show)
    }
    setWhiteouts(remaining)
    handleClose()
  }

  const handleAdd = async (value: string | null) => {
    setFileSelectorOpen(false)
    if (!value) return
    const finalPath = (value.startsWith('/system/') ? value : `/system${value}`).replace(/\/+$/, '')
    whiteoutManager.whiteouts = [...whiteoutManager.whiteouts, finalPath]
    const ok = await whiteoutManager.write()
    if (!ok) {
      snackBar.show(t('global.write_error'), false)
    } else {
      Cli.nuke(snackBar.show)
    }
    setWhiteouts(whiteoutManager.whiteouts)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <md-circular-progress indeterminate />
      </div>
    )
  }

  return (
    <>
      <Header
        title={t('whiteout.title')}
        navigationIcon={
          editMode ? (
            <md-icon-button onClick={handleClose}>
              <md-icon>close</md-icon>
            </md-icon-button>
          ) : undefined
        }
        action={
          editMode ? (
            <div className="flex items-center gap-2">
              <md-icon-button onClick={handleSelectAll}>
                <md-icon>{allSelected ? 'deselect' : 'select_all'}</md-icon>
              </md-icon-button>
              <md-icon-button onClick={handleDelete}>
                <md-icon>delete</md-icon>
              </md-icon-button>
            </div>
          ) : undefined
        }
        bottomContent={
          <SearchBar value={searchQuery} onChange={setSearchQuery} />
        }
      />
      <WhiteoutList
        ref={whiteoutListRef}
        whiteouts={whiteouts}
        searchQuery={searchQuery}
        onSelectionChange={handleSelectionChange}
        onEditModeChange={handleEditModeChange}
      />
      <Fab
        onClick={() => setFileSelectorOpen(true)}
        icon="add"
        variant="primary"
        open={!editMode}
      />
      <FileSelector open={fileSelectorOpen} fileType="any" mode="path" folder={true} onSelect={handleAdd} root="/" />
      <SnackBar state={snackBar.state} onHide={snackBar.hide} />
    </>
  )
}
