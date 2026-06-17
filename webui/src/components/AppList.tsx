import { useState, useCallback, useImperativeHandle, forwardRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import type { AppInfo } from '../lib/AppList'
import { categories, essential, caution, safe, google } from '../data/category'
import { useIconObserver } from '../hooks/useIconObserver'
import AndroidSvg from '../assets/android.svg?react'
import AppInfoDialog from './dialog/AppInfoDialog'
import SegmentedList, { type SegmentedListItem } from './SegmentedList'

const categoryMap: Record<string, string[]> = {
  essential,
  caution,
  safe,
  google,
}

const categoryColorMap: Record<string, string> = Object.fromEntries(
  categories.map(c => [c.id, c.color])
)

function getAppCategory(packageName: string): string | null {
  for (const [catId, pkgs] of Object.entries(categoryMap)) {
    if (pkgs.includes(packageName)) {
      return catId
    }
  }
  return null
}

interface AppListProps {
  apps: AppInfo[]
  searchQuery: string
  selectedCategories: string[]
}

export interface AppListHandle {
  getSelectedPackages: () => string[]
  clearSelection: () => void
}

function AppIcon({ packageName }: { packageName: string }) {
  return (
    <div className="icon-container relative w-10 h-10 shrink-0">
      <div className="icon-loader absolute inset-0 flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-on-surface-variant border-t-transparent rounded-full animate-spin" />
      </div>
      <img
        className="app-icon w-10 h-10 rounded-lg object-cover opacity-0 transition-opacity"
        data-package={packageName}
        alt=""
        draggable={false}
      />
      <div className="icon-fallback w-10 h-10 items-center justify-center bg-secondary-container rounded-lg" style={{ display: 'none' }}>
        <AndroidSvg className="w-6 h-6 fill-on-secondary-container" />
      </div>
    </div>
  )
}

const AppList = forwardRef<AppListHandle, AppListProps>(function AppList({ apps, searchQuery, selectedCategories }, ref) {
  const [selectedApp, setSelectedApp] = useState<AppInfo | null>(null)
  const [selectedPackages, setSelectedPackages] = useState<Set<string>>(new Set())
  const containerRef = useIconObserver()
  const { t } = useTranslation()

  useEffect(() => {
    setSelectedPackages(prev => {
      const next = new Set(prev)
      for (const app of apps) {
        if (app.pending) {
          next.add(app.packageName)
        } else {
          next.delete(app.packageName)
        }
      }
      return next
    })
  }, [apps])

  useImperativeHandle(ref, () => ({
    getSelectedPackages: () => Array.from(selectedPackages),
    clearSelection: () => setSelectedPackages(new Set()),
  }))

  const handleContextMenu = useCallback((app: AppInfo, e: React.MouseEvent) => {
    e.preventDefault()
    setSelectedApp(app)
  }, [])

  const handleDialogClose = useCallback(() => {
    setSelectedApp(null)
  }, [])

  const togglePackage = (packageName: string) => {
    setSelectedPackages(prev => {
      const next = new Set(prev)
      if (next.has(packageName)) {
        next.delete(packageName)
      } else {
        next.add(packageName)
      }
      return next
    })
  }

  const listItems: SegmentedListItem[] = apps.map(app => {
    const matchesSearch =
      searchQuery === '' ||
      app.appLabel.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.packageName.toLowerCase().includes(searchQuery.toLowerCase())

    const appCategories = Object.entries(categoryMap)
      .filter(([, pkgs]) => pkgs.includes(app.packageName))
      .map(([id]) => id)

    const matchesCategory =
      selectedCategories.length === 0 ||
      appCategories.some(cat => selectedCategories.includes(cat))

    const cat = getAppCategory(app.packageName)
    return {
      key: app.packageName,
      hidden: !(matchesSearch && matchesCategory),
      className: app.pending ? '!bg-surface-container-highest' : undefined,
      leadingContent: <AppIcon packageName={app.packageName} />,
      content: (
        <>
          <span className="text-on-surface truncate select-none">
            {app.appLabel}
          </span>
          <span className="text-outline text-sm truncate select-none">
            {app.packageName}
          </span>
          {cat && (
            <span className="flex items-center gap-1.5 text-xs text-on-surface-variant select-none">
              <span className="inline-block w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: categoryColorMap[cat] }} />
              {t(`category.${cat}`)}
            </span>
          )}
        </>
      ),
      trailingContent: (
        <md-checkbox
          touch-target="wrapper"
          checked={selectedPackages.has(app.packageName)}
          onChange={() => togglePackage(app.packageName)}
        />
      ),
      onContextMenu: (e: React.MouseEvent) => handleContextMenu(app, e),
    }
  })

  return (
    <div ref={containerRef}>
      <SegmentedList items={listItems} />
      <AppInfoDialog app={selectedApp} onClose={handleDialogClose} />
    </div>
  )
})

export default AppList
