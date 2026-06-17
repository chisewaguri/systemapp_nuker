import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import Header from '../components/Header'
import SearchBar from '../components/SearchBar'
import FilterGroup from '../components/FilterGroup'
import AppList, { type AppListHandle } from '../components/AppList'
import { type AppInfo } from '../lib/AppList'
import { useAppList } from '../lib/AppListContext'
import { NukeConfig } from '../lib/NukeConfig'
import { Cli } from '../lib/Cli'
import SnackBar, { useSnackBar } from '../components/SnackBar'
import FileSelector from '../lib/FileSelector'
import Fab from '../components/Fab'
import { categories } from '../data/category'

export default function Home() {
  const { t } = useTranslation()
  const snackBar = useSnackBar()
  const appListManager = useAppList()
  const [apps, setApps] = useState<AppInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [fileSelectorOpen, setFileSelectorOpen] = useState(false)
  const [fabVisible, setFabVisible] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const appListRef = useRef<AppListHandle>(null)
  const processingRef = useRef(false)

  useEffect(() => {
    appListManager.waitForReady().then(() => {
      setApps(appListManager.systemAppList)
      setLoading(false)
    })
  }, [])

  const handleImport = async (content: string | null) => {
    setFileSelectorOpen(false)
    await NukeConfig.handleImport(content, appListManager, snackBar.show)
    setApps(appListManager.systemAppList)
  }

  const handleFabVisibilityChange = useCallback((visible: boolean) => {
    setFabVisible(visible)
  }, [])

  const handleFabClick = useCallback(async () => {
    if (processingRef.current) return
    processingRef.current = true

    try {
      const selected = appListRef.current?.getSelectedPackages() ?? []
      const currentApps = appListManager.systemAppList
      let count = 0

      for (const app of currentApps) {
        const isSelected = selected.includes(app.packageName)

        if (app.pending && !isSelected) {
          appListManager.setNuke(app.packageName, false)
          count++
        } else if (!app.pending && isSelected) {
          appListManager.setNuke(app.packageName, true)
          count++
        }
      }

      if (count === 0) return
      snackBar.show(t('global.processing'), true, 60000)

      const ok = await appListManager.write()
      if (!ok) {
        snackBar.show(t('global.write_error'), false)
      } else {
        await Cli.nuke(snackBar.show)
        await appListManager.refresh()
        setApps(appListManager.systemAppList)
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

  return (
    <>
      <Header
        title={t('home.title')}
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
        icon="remove_selection"
        variant="primary"
        onVisibilityChange={handleFabVisibilityChange}
      />
      <FileSelector open={fileSelectorOpen} fileType="json" mode="content" onSelect={handleImport} />
      <SnackBar state={snackBar.state} onHide={snackBar.hide} fabVisible={fabVisible} />
    </>
  )
}
