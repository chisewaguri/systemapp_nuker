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
import { AppListProvider } from './lib/AppListContext'

const pages: Record<string, React.FC> = {
  '/': Home,
  '/restore': Restore,
  '/whiteout': Whiteout,
  '/settings': Settings,
}

function App() {
  const [activeTab, setActiveTab] = useState('/')
  const [showBackupRestoreDialog, setShowBackupRestoreDialog] = useState(false)
  const snackBar = useSnackBar()

  useEffect(() => {
    Cli.needRestore().then(needRestore => {
      if (needRestore) setShowBackupRestoreDialog(true)
    })
  }, [])

  const handleDismiss = useCallback(() => {
    setShowBackupRestoreDialog(false)
  }, [])

  const handleDontRestore = useCallback(async () => {
    setShowBackupRestoreDialog(false)
    const ok = await Cli.restore(false)
    if (ok) {
      location.reload()
    } else {
      snackBar.show(t('backup.error'), false)
    }
  }, [snackBar.show])

  const handleRestore = useCallback(async () => {
    setShowBackupRestoreDialog(false)
    const ok = await Cli.restore(true)
    if (ok) {
      Cli.nuke(snackBar.show)
    } else {
      snackBar.show(t('backup.error'), false)
    }
  }, [snackBar.show])

  const Page = pages[activeTab] ?? Home

  return (
    <>
      <Layout activeTab={activeTab} onTabChange={setActiveTab}>
        <Page />
      </Layout>
      <BackupRestoreDialog
        open={showBackupRestoreDialog}
        onDismiss={handleDismiss}
        onDontRestore={handleDontRestore}
        onRestore={handleRestore}
      />
      <SnackBar state={snackBar.state} onHide={snackBar.hide} />
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
