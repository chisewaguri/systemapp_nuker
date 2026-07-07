import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import Header from '../components/Header'
import SearchBar from '../components/SearchBar'
import FilterGroup from '../components/FilterGroup'
import AppList, { type AppListHandle } from '../components/AppList'
import { type AppInfo } from '../lib/AppList'
import { useAppList } from '../lib/AppListContext'
import { Cli } from '../lib/Cli'
import SnackBar, { useSnackBar } from '../components/SnackBar'
import Fab from '../components/Fab'
import { categories } from '../data/category'

export default function Restore() {
  const { t } = useTranslation()
  const snackBar = useSnackBar()
  const appListManager = useAppList()
  const [apps, setApps] = useState<AppInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [fabVisible, setFabVisible] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const appListRef = useRef<AppListHandle>(null)
  const processingRef = useRef(false)

  useEffect(() => {
    appListManager.waitForReady().then(() => {
      setApps(appListManager.nukedAppList)
      setLoading(false)
    })
  }, [])

  const handleFabVisibilityChange = useCallback((visible: boolean) => {
    setFabVisible(visible)
  }, [])

  const handleFabClick = useCallback(async () => {
    if (processingRef.current) return
    processingRef.current = true

    try {
      const selected = appListRef.current?.getSelectedPackages() ?? []
      const currentApps = appListManager.nukedAppList
      let count = 0

      for (const app of currentApps) {
        const isSelected = selected.includes(app.packageName)

        if (app.pending && !isSelected) {
          appListManager.setRestore(app.packageName, false)
          count++
        } else if (!app.pending && isSelected) {
          appListManager.setRestore(app.packageName, true)
          count++
        }
      }

      if (count === 0) return
      snackBar.show(t('global.processing'), true, 60000)

      const ok = await appListManager.write()
      if (!ok) {
        snackBar.show(t('global.write_error'), false)
      } else {
        const pendingCount = appListManager.nukingAppList.length
        await Cli.nuke(snackBar.show, pendingCount)
        await appListManager.refresh()
        setApps(appListManager.nukedAppList)
      }
    } finally {
      processingRef.current = false
    }
  }, [])

  const toggleCategory = (categoryId: string) => {
    setSelectedCategories(prev =>
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <md-circular-progress indeterminate />
      </div>
    )
  }

  if (apps.length === 0) {
    return (
      <div className="flex flex-col h-full -mb-18">
        <Header title={t('restore.title')} />
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <md-icon class="text-on-surface-variant">
              delete_sweep
            </md-icon>
            <span className="text-on-surface-variant text-sm">{t('restore.empty')}</span>
          </div>
        </div>
        <SnackBar state={snackBar.state} onHide={snackBar.hide} fabVisible={fabVisible} />
      </div>
    )
  }

  return (
    <>
      <Header
        title={t('restore.title')}
        bottomContent={
          <>
            <SearchBar value={searchQuery} onChange={setSearchQuery} />
            <FilterGroup
              categories={categories}
              selectedCategories={selectedCategories}
              onToggle={toggleCategory}
            />
          </>
        }
      />
      <AppList
        ref={appListRef}
        apps={apps}
        searchQuery={searchQuery}
        selectedCategories={selectedCategories}
      />
      <Fab
        onClick={handleFabClick}
        icon="restore"
        variant="primary"
        onVisibilityChange={handleFabVisibilityChange}
      />
      <SnackBar state={snackBar.state} onHide={snackBar.hide} fabVisible={fabVisible} />
    </>
  )
}
