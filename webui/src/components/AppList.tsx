import { useState, useCallback, useImperativeHandle, forwardRef, useEffect, useLayoutEffect } from 'react'
import { useTranslation } from 'react-i18next'
import type { AppInfo } from '../lib/AppList'
import { getUad, removalLevels } from '../lib/uad'
import { useIconObserver } from '../hooks/useIconObserver'
import AndroidSvg from '../assets/android.svg?react'
import AppInfoDialog from './dialog/AppInfoDialog'
import SegmentedList, { type SegmentedListItem } from './SegmentedList'
import { useAppList } from '../lib/AppListContext'
import PendingMatches from './PendingMatches'

const removalColor = Object.fromEntries(removalLevels.map(level => [level.id, level.color]))

interface AppListProps {
  apps: AppInfo[]
  searchQuery: string
  selectedCategories: string[]
  emptyMessage: string
  selectionKey: 'remove' | 'restore'
  onSelectionChange: (packages: string[], hiddenCount: number, visibleCount: number) => void
  disabled?: boolean
}

export interface AppListHandle {
  getSelectedPackages: () => string[]
  clearSelection: () => void
  toggleSelection: (packageName: string) => void
  selectAllVisible: () => void
  deselectAllVisible: () => void
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

const AppList = forwardRef<AppListHandle, AppListProps>(function AppList({ apps, searchQuery, selectedCategories, emptyMessage, selectionKey, onSelectionChange, disabled = false }, ref) {
  const manager = useAppList()
  const [selectedApp, setSelectedApp] = useState<AppInfo | null>(null)
  const [selectedPackages, setSelectedPackages] = useState<Set<string>>(() => new Set(manager.getSelection(selectionKey)))
  const containerRef = useIconObserver()
  const { t } = useTranslation()

  useEffect(() => {
    setSelectedPackages(previous => new Set([...previous].filter(pkg => apps.some(app => app.packageName === pkg))))
  }, [apps])

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

  const labelCounts = new Map<string, number>()
  for (const app of [...apps, ...manager.pendingApps]) {
    const label = app.appLabel.toLowerCase()
    labelCounts.set(label, (labelCounts.get(label) ?? 0) + 1)
  }
  const listItems: SegmentedListItem[] = apps.map(app => {
    const showPackage = (labelCounts.get(app.appLabel.toLowerCase()) ?? 0) > 1 ||
      (searchQuery !== '' && !app.appLabel.toLowerCase().includes(searchQuery.toLowerCase()))
    const matchesSearch =
      searchQuery === '' ||
      app.appLabel.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.packageName.toLowerCase().includes(searchQuery.toLowerCase())

    const { removal } = getUad(app.packageName)
    const matchesCategory = selectedCategories.length === 0 || selectedCategories.includes(removal)
    const openDetails = (event: React.MouseEvent) => { event.preventDefault(); event.stopPropagation(); setSelectedApp(app) }

    return {
      key: app.packageName,
      hidden: !(matchesSearch && matchesCategory),
      className: `!py-1 !gap-2 ${app.pending ? '!bg-surface-container-highest' : ''}`,
      noRipple: true,
      content: (
        <button type="button" className="flex min-h-12 w-full min-w-0 items-center gap-2 border-0 bg-transparent p-0 text-start text-base text-on-surface font-[family-name:inherit] cursor-pointer"
          aria-label={t('app_info.open', {app: `${app.appLabel} (${app.packageName})`})} onClick={openDetails}>
          <span className="relative flex size-12 shrink-0 items-center justify-center">
            <AppIcon packageName={app.packageName} />
            <md-icon aria-hidden="true" class="absolute bottom-0 end-0 rounded-full bg-surface-container-high" style={{'--md-icon-size': '18px'} as React.CSSProperties}>info</md-icon>
          </span>
          <div className="app-details flex-1">
            <span className="text-on-surface wrap-break-word">{app.appLabel}</span>
            {showPackage && <span className="text-sm text-on-surface-variant break-all">{app.packageName}</span>}
            <span className="inline-flex items-center gap-1.5 text-sm text-on-surface-variant">
              <span className="inline-block w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: removalColor[removal] }} />
              {t(`removal.${removal}`)}
            </span>
            {app.pending && (
              <span className="text-sm font-medium text-primary select-none">
                {t(app.nuked ? 'app_info.pending_restore' : 'app_info.pending_removal')}
              </span>
            )}
          </div>
        </button>
      ),
      trailingContent: <md-checkbox
        class="shrink-0"
        id={`app-select-${app.packageName}`}
        aria-label={[
          `${app.appLabel} (${app.packageName})`,
          t(`removal.${removal}`),
          app.pending ? t(app.nuked ? 'app_info.pending_restore' : 'app_info.pending_removal') : '',
        ].filter(Boolean).join(', ')}
        touch-target="wrapper"
        disabled={disabled}
        checked={selectedPackages.has(app.packageName)}
        onChange={() => togglePackage(app.packageName)}
      />,
      onContextMenu: (e: React.MouseEvent) => handleContextMenu(app, e),
    }
  })

  useImperativeHandle(ref, () => ({
    getSelectedPackages: () => Array.from(selectedPackages),
    clearSelection: () => setSelectedPackages(new Set()),
    toggleSelection: togglePackage,
    selectAllVisible: () => setSelectedPackages(previous => new Set([...previous, ...listItems.filter(item => !item.hidden).map(item => String(item.key))])),
    deselectAllVisible: () => {
      const visible = new Set(listItems.filter(item => !item.hidden).map(item => String(item.key)))
      setSelectedPackages(previous => new Set([...previous].filter(pkg => !visible.has(pkg))))
    },
  }))

  const hiddenCount = listItems.filter(item => item.hidden && selectedPackages.has(String(item.key))).length
  const visibleCount = listItems.filter(item => !item.hidden).length
  const emptyRestore = selectionKey === 'restore' && apps.length === 0 && searchQuery === '' && selectedCategories.length === 0
  const pendingMatches = manager.pendingApps.filter(app => {
    if (emptyRestore && !app.nuked) return false
    const query = searchQuery.toLowerCase()
    return (app.appLabel.toLowerCase().includes(query) || app.packageName.toLowerCase().includes(query)) &&
      (selectedCategories.length === 0 || selectedCategories.includes(getUad(app.packageName).removal))
  }).map(app => ({kind: 'app' as const, packageName: app.packageName}))
  useLayoutEffect(() => {
    manager.setSelection(selectionKey, [...selectedPackages])
    onSelectionChange([...selectedPackages], hiddenCount, visibleCount)
  }, [manager, selectionKey, selectedPackages, hiddenCount, visibleCount, onSelectionChange])

  const detailsApps = apps.filter((_, index) => !listItems[index].hidden)
  const detailsIndex = detailsApps.findIndex(app => app.packageName === selectedApp?.packageName)
  const showPending = emptyRestore || searchQuery !== '' || selectedCategories.length > 0
  const navigation = detailsIndex >= 0 && detailsApps.length > 1 ? {
    onPrevious: detailsIndex > 0 ? () => setSelectedApp(detailsApps[detailsIndex - 1]) : undefined,
    onNext: detailsIndex < detailsApps.length - 1 ? () => setSelectedApp(detailsApps[detailsIndex + 1]) : undefined,
  } : undefined

  return (
    <div ref={containerRef}>
      {visibleCount === 0 && (!showPending || pendingMatches.length === 0) && <div className="px-6 py-4 text-sm text-on-surface-variant text-center">
        <p className="m-0">{emptyMessage}</p>
      </div>}
      <p className="sr-only" role="status" aria-live="polite">{[
        t(`review.results_${selectionKey}`, {count: visibleCount}),
        showPending && pendingMatches.length > 0 ? t('review.pending_matches', {count: pendingMatches.length}) : '',
      ].filter(Boolean).join('. ')}</p>
      {visibleCount > 0 && <SegmentedList items={listItems} />}
      {showPending && <PendingMatches changes={pendingMatches} label={emptyRestore ? t('restore.pending', {count: pendingMatches.length}) : undefined} />}
      <AppInfoDialog app={selectedApp} onClose={handleDialogClose} navigation={navigation} selection={selectedApp && !selectedApp.pending ? {
        checked: selectedPackages.has(selectedApp.packageName), disabled,
        label: t(selectionKey === 'remove' ? 'review.include' : 'review.include_restore', {app: `${selectedApp.appLabel} (${selectedApp.packageName})`}),
        onChange: () => togglePackage(selectedApp.packageName),
      } : undefined} />
    </div>
  )
})

export default AppList
