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
import { Cli, type RecoveryExclusions } from './lib/Cli'
import { AppListProvider, useAppList } from './lib/AppListContext'
import { runMutation } from './lib/mutationLock'
import { pageHash, readPagePath, type PagePath } from './lib/navigation'
import OperationLogDialog from './components/dialog/OperationLogDialog'
import { cancelPendingChange, cancelPendingChanges } from './lib/PendingChanges'
import ReviewDialog from './components/dialog/ReviewDialog'
import { useMutationBusy } from './hooks/useMutationBusy'
import { refreshLists } from './lib/refreshLists'

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
  const [logOpen, setLogOpen] = useState(false)
  const [rebootOpen, setRebootOpen] = useState(false)
  const [recoveryCheckOpen, setRecoveryCheckOpen] = useState(false)
  const busy = useMutationBusy()
  const appList = useAppList()
  const { state: snackBarState, show: showSnackBar, hide: hideSnackBar } = useSnackBar()

  useEffect(() => {
    const openLog = () => setLogOpen(true)
    const openReboot = () => setRebootOpen(true)
    window.addEventListener('san-operation-log', openLog)
    window.addEventListener('san-reboot', openReboot)
    return () => {
      window.removeEventListener('san-operation-log', openLog)
      window.removeEventListener('san-reboot', openReboot)
    }
  }, [])

  const checkRecovery = useCallback((manual = false) => {
    Cli.needRestore().then(status => {
      if (status === 'available') {
        if (manual) hideSnackBar()
        setShowBackupRestoreDialog(true)
      }
      if (status === 'error') showSnackBar(t('backup.check_error'), false, 0, {text: t('global.details'), callback: () => setRecoveryCheckOpen(true)})
      if (status === 'absent' && manual) showSnackBar(t('backup.none'))
    })
  }, [showSnackBar, hideSnackBar])

  useEffect(() => {
    const check = () => checkRecovery(true)
    checkRecovery()
    window.addEventListener('san-recovery', check)
    return () => window.removeEventListener('san-recovery', check)
  }, [checkRecovery])

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

  const handleRestore = useCallback(async (excluded: RecoveryExclusions) => {
    setShowBackupRestoreDialog(false)
    const started = await runMutation(async () => {
      const ok = await Cli.restore(true, excluded)
      if (!ok) {
        showSnackBar(t('backup.error'), false)
        return
      }
      if (await Cli.nuke(showSnackBar) && !await Cli.restore(false)) {
        showSnackBar(t('backup.error'), false)
      }
      // The managers still hold the lists from before the backup was restored.
      await refreshLists(appList)
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
      <Layout activeTab={activeTab} onTabChange={handleTabChange} onReboot={() => setRebootOpen(true)}
        onCancelPending={change => cancelPendingChange(change, appList, showSnackBar)}
        onCancelAllPending={changes => cancelPendingChanges(changes, appList, showSnackBar)}>
        <Page key={pageKey} />
      </Layout>
      <OperationLogDialog open={logOpen} onClose={() => setLogOpen(false)} />
      <ReviewDialog open={recoveryCheckOpen} title={t('backup.check_error')} onClose={() => setRecoveryCheckOpen(false)} actions={<>
        <md-text-button onClick={() => setRecoveryCheckOpen(false)}>{t('global.close')}</md-text-button>
        <md-filled-button disabled={busy} onClick={() => { setRecoveryCheckOpen(false); checkRecovery(true) }}>{t('global.retry')}</md-filled-button>
      </>}>
        <p className="mt-0">{t('backup.check_message')}</p>
      </ReviewDialog>
      <ReviewDialog open={rebootOpen} title={t('nuke.reboot_title')} onClose={() => setRebootOpen(false)} actions={<>
        <md-text-button onClick={() => setRebootOpen(false)}>{t('whiteout.cancel')}</md-text-button>
        <md-filled-button disabled={busy} onClick={() => { setRebootOpen(false); Cli.reboot(showSnackBar) }}>{t('nuke.reboot')}</md-filled-button>
      </>}>
        <p className="mt-0">{t('nuke.reboot_message')}</p>
      </ReviewDialog>
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
