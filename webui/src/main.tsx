import { StrictMode, useState, useEffect, useCallback } from 'react'
import { t } from 'i18next'
import { createRoot } from 'react-dom/client'
import './lib/i18n'
import './index.css'
import '@material/web/all.js'
import Layout from './components/Layout'
import Home from './pages/Home'
import Restore from './pages/Restore'
import Whiteout from './pages/Whiteout'
import Settings from './pages/Settings'
import BackupRestoreDialog from './components/dialog/BackupRestoreDialog'
import SnackBar, { useSnackBar } from './components/SnackBar'
import { Cli } from './lib/Cli'
import { AppListProvider, useAppList } from './lib/AppListContext'
import { whiteoutManager } from './lib/Whiteout'
import { runMutation } from './lib/mutationLock'
import { pageHash, readPagePath, type PagePath } from './lib/navigation'

const pages: Record<PagePath, React.FC> = {
  '/': Home,
  '/restore': Restore,
  '/whiteout': Whiteout,
  '/settings': Settings,
}

function App() {
  const [activeTab, setActiveTab] = useState<PagePath>(() => readPagePath(location.hash))
  const [showBackupRestoreDialog, setShowBackupRestoreDialog] = useState(false)
  const [pageKey, setPageKey] = useState(0)
  const appList = useAppList()
  const { state: snackBarState, show: showSnackBar, hide: hideSnackBar } = useSnackBar()

  useEffect(() => {
    Cli.needRestore().then(status => {
      if (status === 'available') setShowBackupRestoreDialog(true)
      if (status === 'error') showSnackBar(t('backup.check_error'), false)
    })
  }, [showSnackBar])

  useEffect(() => {
    const syncTab = () => setActiveTab(readPagePath(location.hash))
    if (location.hash !== pageHash(activeTab)) {
      history.replaceState(history.state, '', pageHash(activeTab))
    }
    window.addEventListener('popstate', syncTab)
    return () => window.removeEventListener('popstate', syncTab)
  }, [activeTab])

  const handleTabChange = useCallback((tab: string) => {
    const nextTab = readPagePath(tab)
    if (nextTab === activeTab) return
    history.pushState({}, '', pageHash(nextTab))
    setActiveTab(nextTab)
  }, [activeTab])

  const handleDismiss = useCallback(() => {
    setShowBackupRestoreDialog(false)
  }, [])

  const handleDontRestore = useCallback(async () => {
    setShowBackupRestoreDialog(false)
    const started = await runMutation(async () => {
      const ok = await Cli.restore(false)
      if (ok) {
        location.reload()
      } else {
        showSnackBar(t('backup.error'), false)
      }
    })
    if (!started) {
      setShowBackupRestoreDialog(true)
      showSnackBar(t('global.processing'), true, 3000)
    }
  }, [showSnackBar])

  const handleRestore = useCallback(async () => {
    setShowBackupRestoreDialog(false)
    const started = await runMutation(async () => {
      const ok = await Cli.restore(true)
      if (!ok) {
        showSnackBar(t('backup.error'), false)
        return
      }
      if (await Cli.nuke(showSnackBar) && !await Cli.restore(false)) {
        showSnackBar(t('backup.error'), false)
      }
      // The managers still hold the lists from before the backup was restored.
      await Promise.all([appList.refresh(), whiteoutManager.refresh()])
        .catch(() => showSnackBar(t('global.read_error'), false))
      setPageKey(key => key + 1)
    })
    if (!started) {
      setShowBackupRestoreDialog(true)
      showSnackBar(t('global.processing'), true, 3000)
    }
  }, [appList, showSnackBar])

  const Page = pages[activeTab]

  return (
    <>
      <Layout activeTab={activeTab} onTabChange={handleTabChange}>
        <Page key={pageKey} />
      </Layout>
      <BackupRestoreDialog
        open={showBackupRestoreDialog}
        onDismiss={handleDismiss}
        onDontRestore={handleDontRestore}
        onRestore={handleRestore}
      />
      <SnackBar state={snackBarState} onHide={hideSnackBar} />
    </>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppListProvider>
      <App />
    </AppListProvider>
  </StrictMode>,
)
