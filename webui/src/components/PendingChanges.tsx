import { useEffect, useState, useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppList } from '../lib/AppListContext'
import { useMutationBusy } from '../hooks/useMutationBusy'
import ReviewDialog from './dialog/ReviewDialog'
import { whiteoutManager } from '../lib/Whiteout'
import { File } from '../lib/File'
import { PERSIST_DIR } from '../constant'
import type { PendingChange } from '../lib/PendingChanges'
import type { AppInfo } from '../lib/AppList'
import AppInfoDialog from './dialog/AppInfoDialog'
import SelectAll from './SelectAll'
import { getUad } from '../lib/uad'

export default function PendingChanges({ onReboot, onCancel, onCancelAll }: { onReboot: () => void, onCancel: (change: PendingChange) => Promise<boolean>, onCancelAll: (changes: PendingChange[]) => Promise<boolean> }) {
  const { t } = useTranslation()
  const manager = useAppList()
  const busy = useMutationBusy()
  const [open, setOpen] = useState(false)
  const [needsReboot, setNeedsReboot] = useState(false)
  const [detailsApp, setDetailsApp] = useState<AppInfo | null>(null)
  const [undoBatch, setUndoBatch] = useState<PendingChange[] | null>(null)
  const [undoSelection, setUndoSelection] = useState<string[]>([])
  const [reviewScope, setReviewScope] = useState<PendingChange[] | null>(null)
  useEffect(() => {
    const reviewFromPage = (event: Event) => {
      const changes = (event as CustomEvent<PendingChange[]>).detail
      if (!Array.isArray(changes) || changes.length === 0) return
      setUndoSelection([])
      setUndoBatch(null)
      setReviewScope(changes)
      setOpen(true)
    }
    window.addEventListener('san-review-pending', reviewFromPage)
    return () => {
      window.removeEventListener('san-review-pending', reviewFromPage)
    }
  }, [])
  useSyncExternalStore(whiteoutManager.subscribe, whiteoutManager.getVersion)
  useEffect(() => {
    let active = true
    File.exist(`${PERSIST_DIR}/reboot_required`).then(value => { if (active) setNeedsReboot(value) }).catch(() => {})
    return () => { active = false }
  }, [busy])
  const pending = manager.pendingApps
  const paths = whiteoutManager.pendingChanges
  const labelCounts = new Map<string, number>()
  for (const app of pending) {
    const label = app.appLabel.toLowerCase()
    labelCounts.set(label, (labelCounts.get(label) ?? 0) + 1)
  }
  const showPackage = (app: AppInfo) => app.appLabel !== app.packageName && ((labelCounts.get(app.appLabel.toLowerCase()) ?? 0) > 1 || !['recommended', 'advanced'].includes(getUad(app.packageName).removal))
  const count = pending.length + paths.length
  const statusText = busy ? t('global.processing') : count > 0 ? t('review.pending', {count}) : needsReboot ? t('nuke.success') : t('review.pending_empty')
  const scope = undoBatch ?? reviewScope
  const shownPending = scope ? pending.filter(app => scope.some(change => change.kind === 'app' && change.packageName === app.packageName)) : pending
  const shownPaths = scope ? paths.filter(item => scope.some(change => change.kind === 'path' && change.path === item.path)) : paths
  const available = [...shownPending.map(app => app.packageName), ...shownPaths.map(item => item.path)]
  const selected = [
    ...shownPending.filter(app => undoSelection.includes(app.packageName)).map(app => ({kind: 'app' as const, packageName: app.packageName})),
    ...shownPaths.filter(item => undoSelection.includes(item.path)).map(item => ({kind: 'path' as const, path: item.path})),
  ]
  const allSelected = available.length > 0 && selected.length === available.length
  const toggleSelection = (id: string) => setUndoSelection(previous => previous.includes(id) ? previous.filter(value => value !== id) : [...previous, id])
  const stopSelecting = () => { setUndoBatch(null); setUndoSelection([]) }
  const close = () => { stopSelecting(); setReviewScope(null); setOpen(false) }
  const cancel = async (change: PendingChange) => {
    if (!await onCancel(change) || (reviewScope && available.length === 1)) close()
  }
  const cancelAll = async () => {
    if (!undoBatch || selected.length === 0) return
    const applied = await onCancelAll(selected)
    stopSelecting()
    if (!applied || (reviewScope && selected.length === available.length)) close()
  }
  if (!busy && count === 0 && !needsReboot && !open) return null
  return (
    <aside className="px-4 py-1 bg-secondary-container text-on-secondary-container">
      <div className="mx-auto max-w-2xl flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        {count > 0 ? <md-text-button trailing-icon aria-label={`${t('review.open_pending')}: ${statusText}`} onClick={() => { setReviewScope(null); setOpen(true) }}>
          <span className="text-sm" role="status" aria-live="polite">{statusText}</span>
          <md-icon slot="icon" aria-hidden="true">chevron_right</md-icon>
        </md-text-button> : <span className="text-sm" role="status" aria-live="polite">{statusText}</span>}
        {(count > 0 || needsReboot) && <md-text-button disabled={busy} onClick={onReboot}>{t('nuke.reboot')}</md-text-button>}
      </div>
      {busy && <md-linear-progress indeterminate aria-label={t('global.processing')} class="w-full" />}
      <ReviewDialog open={open} title={t(undoBatch ? 'review.select_undo_title' : 'review.pending_title')} onClose={close} actions={undoBatch ? <>
        <md-icon-button class="size-12" aria-label={t('review.back')} onClick={stopSelecting}><md-icon>arrow_back</md-icon></md-icon-button>
        <md-filled-button disabled={busy || selected.length === 0} onClick={cancelAll}>{t('review.undo_selected', {count: selected.length})}</md-filled-button>
      </> : <>
        <md-text-button onClick={close}>{t('global.close')}</md-text-button>
        <md-filled-button disabled={busy || (count === 0 && !needsReboot)} onClick={() => { close(); onReboot() }}>{t('nuke.reboot')}</md-filled-button>
      </>}>
        <div className={`flex items-start ${undoBatch ? 'justify-end' : 'justify-between'} gap-2`}>
          {!undoBatch && <p className="mt-0 mb-3">{t(count > 0 ? 'review.pending_message' : needsReboot ? 'nuke.success' : 'review.pending_empty')}</p>}
          {undoBatch ? <SelectAll count={available.length} label={t('review.select_all_undo')} checked={allSelected} indeterminate={selected.length > 0 && !allSelected} disabled={busy || available.length === 0}
            onChange={() => setUndoSelection(allSelected ? [] : available)} /> : available.length > 1 && <md-text-button class="shrink-0" disabled={busy} onClick={() => {
            setUndoSelection([])
            setUndoBatch([
              ...shownPending.map(app => ({kind: 'app' as const, packageName: app.packageName})),
              ...shownPaths.map(item => ({kind: 'path' as const, path: item.path})),
            ])
          }}>{t('review.select_undo')}</md-text-button>}
        </div>
        {[true, false].filter(nuked => shownPending.some(app => app.nuked === nuked)).map(nuked => <section key={String(nuked)}>
          <h2 className="mt-3 mb-1 text-sm font-medium text-on-surface-variant">{t(nuked ? 'app_info.pending_restore' : 'app_info.pending_removal')}</h2>
          <ul className="m-0 list-none p-0 flex flex-col gap-2">{shownPending.filter(app => app.nuked === nuked).map(app => <li key={app.packageName} className="flex min-w-0 items-center gap-2">
            <button type="button" className="flex min-h-12 min-w-0 flex-1 flex-col justify-center border-0 bg-transparent p-0 text-start text-on-surface text-base font-[family-name:inherit]"
              aria-label={t('app_info.open', {app: `${app.appLabel} (${app.packageName})`})} onClick={() => setDetailsApp(app)}>
              <span className="flex items-center gap-1"><span className="wrap-break-word">{app.appLabel}</span><md-icon aria-hidden="true" style={{'--md-icon-size': '16px'} as React.CSSProperties}>info</md-icon></span>
              {showPackage(app) && <span className="text-sm text-on-surface-variant break-all">{app.packageName}</span>}
            </button>
            {undoBatch ? <md-checkbox class="shrink-0" touch-target="wrapper" disabled={busy} checked={undoSelection.includes(app.packageName)} aria-label={`${t(nuked ? 'review.cancel_restore' : 'review.cancel_remove')}: ${app.appLabel} (${app.packageName})`}
              onChange={() => toggleSelection(app.packageName)} /> : <md-text-button class="pending-action" disabled={busy} aria-label={`${t(nuked ? 'review.cancel_restore' : 'review.cancel_remove')}: ${app.appLabel} (${app.packageName})`}
              onClick={() => cancel({kind: 'app', packageName: app.packageName})}><span className="pending-action-label">{t(nuked ? 'review.cancel_restore' : 'review.cancel_remove')}</span></md-text-button>}
          </li>)}</ul>
        </section>)}
        {[true, false].filter(hiding => shownPaths.some(item => item.hiding === hiding)).map(hiding => <section key={String(hiding)}>
          <h2 className="mt-3 mb-1 text-sm font-medium text-on-surface-variant">{t(hiding ? 'whiteout.pending_hide' : 'whiteout.pending_show')}</h2>
          <ul className="m-0 list-none p-0 flex flex-col gap-2">{shownPaths.filter(item => item.hiding === hiding).map(item => <li key={item.path} className="flex min-h-12 min-w-0 items-center gap-2">
            <span className="min-w-0 flex-1 font-mono text-sm break-all">{item.path}</span>
            {undoBatch ? <md-checkbox class="shrink-0" touch-target="wrapper" disabled={busy} checked={undoSelection.includes(item.path)} aria-label={`${t(hiding ? 'review.cancel_hide' : 'review.cancel_restore')}: ${item.path}`}
              onChange={() => toggleSelection(item.path)} /> : <md-text-button class="pending-action" disabled={busy} aria-label={`${t(hiding ? 'review.cancel_hide' : 'review.cancel_restore')}: ${item.path}`}
              onClick={() => cancel({kind: 'path', path: item.path})}><span className="pending-action-label">{t(hiding ? 'review.cancel_hide' : 'review.cancel_restore')}</span></md-text-button>}
          </li>)}</ul>
        </section>)}
        <AppInfoDialog app={detailsApp} onClose={() => setDetailsApp(null)} />
      </ReviewDialog>
    </aside>
  )
}
