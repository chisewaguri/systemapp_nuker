import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { AppInfo } from '../../lib/AppList'
import { getUad } from '../../lib/uad'
import ReviewDialog from './ReviewDialog'
import AppInfoDialog from './AppInfoDialog'
import Config from '../../lib/Config'

interface AppReviewDialogProps {
  open: boolean
  apps: AppInfo[]
  operation: 'remove' | 'restore'
  onClose: () => void
  onConfirm: () => void
  note?: string
  selectedPackages?: string[]
  onToggle?: (packageName: string) => void
}

export default function AppReviewDialog({ open, apps, operation, onClose, onConfirm, note, selectedPackages, onToggle }: AppReviewDialogProps) {
  const { t } = useTranslation()
  const [acknowledgedPackages, setAcknowledgedPackages] = useState<string[] | null>(null)
  const [detailsApp, setDetailsApp] = useState<AppInfo | null>(null)
  const [mode, setMode] = useState<'whiteout_only' | 'whiteout_uninstall' | 'uninstall_only' | 'loading' | 'error'>('loading')
  const [modeAttempt, setModeAttempt] = useState(0)
  const included = selectedPackages ? apps.filter(app => selectedPackages.includes(app.packageName)) : apps
  const acknowledged = acknowledgedPackages !== null && included.every(app => acknowledgedPackages.includes(app.packageName))
  const cancellations = included.filter(app => app.pending).length
  const changes = included.length - cancellations
  const cancelAction = operation === 'remove' ? 'cancel_restore' : 'cancel_remove'
  const action = cancellations === 0 ? operation : changes === 0 ? cancelAction : 'changes'
  const needsMode = operation === 'remove' && changes > 0
  const hasPending = apps.some(app => app.pending)
  const labelCounts = new Map<string, number>()
  for (const app of apps) {
    const label = app.appLabel.toLowerCase()
    labelCounts.set(label, (labelCounts.get(label) ?? 0) + 1)
  }
  const detailsIndex = apps.findIndex(app => app.packageName === detailsApp?.packageName)
  const navigation = detailsIndex >= 0 && apps.length > 1 ? {
    onPrevious: detailsIndex > 0 ? () => setDetailsApp(apps[detailsIndex - 1]) : undefined,
    onNext: detailsIndex < apps.length - 1 ? () => setDetailsApp(apps[detailsIndex + 1]) : undefined,
  } : undefined
  const EntryWrapper = onToggle ? 'label' : 'div'
  useEffect(() => {
    const packages = (selectedPackages ? apps.filter(app => selectedPackages.includes(app.packageName)) : apps).map(app => app.packageName)
    setAcknowledgedPackages(previous => {
      if (!open || previous === null) return null
      const retained = previous.filter(pkg => packages.includes(pkg))
      return retained.length === previous.length ? previous : retained
    })
  }, [open, selectedPackages, apps])
  useEffect(() => {
    if (!open || !needsMode) return
    let active = true
    setMode('loading')
    const config = new Config()
    config.read().then(() => {
      const value = config.config.find(item => item.key === 'nuke_mode')?.value
      if (value !== 'whiteout_only' && value !== 'whiteout_uninstall' && value !== 'uninstall_only') throw new Error('Invalid removal mode')
      if (active) setMode(value)
    }).catch(() => { if (active) setMode('error') })
    return () => { active = false }
  }, [open, needsMode, modeAttempt])
  const risky = operation === 'remove' && included.some(app => ['expert', 'unsafe'].includes(getUad(app.packageName).removal))
  const modeReady = mode !== 'loading' && mode !== 'error'
  return (
    <ReviewDialog open={open} title={included.length ? t(`review.${action}_title`, { count: included.length }) : t('review.none_selected')} onClose={onClose} actions={<>
      <md-text-button onClick={onClose}>{t(cancellations > 0 ? 'review.back' : 'whiteout.cancel')}</md-text-button>
      <md-filled-button disabled={included.length === 0 || (risky && !acknowledged) || (needsMode && !modeReady)} onClick={onConfirm}>
        {t(`review.${action}_confirm`, { count: included.length })}
      </md-filled-button>
    </>} beforeActions={risky && <label className="flex items-start gap-2 text-error">
      <md-checkbox class="shrink-0" touch-target="wrapper" aria-label={t('review.risk_acknowledge')} checked={acknowledged} onChange={() => setAcknowledgedPackages(acknowledged ? null : included.map(app => app.packageName))} />
      <span className="pt-2">{t('review.risk_acknowledge')}</span>
    </label>}>
      {needsMode ? modeReady ? <p className="mt-0 text-on-surface-variant">{t(mode === 'whiteout_only' ? 'review.mode_whiteout_summary' : mode === 'uninstall_only' ? 'review.mode_uninstall_summary' : 'review.mode_hide_summary')}</p> : <div role={mode === 'error' ? 'alert' : 'status'}>
        <p className="mt-0">{t(mode === 'error' ? 'review.mode_error' : 'review.mode_loading')}</p>
        {mode === 'error' && <md-text-button onClick={() => setModeAttempt(value => value + 1)}>{t('global.retry')}</md-text-button>}
      </div> : changes > 0 ? <p className="mt-0 text-on-surface-variant">{t('review.restore_message')}</p> : null}
      {cancellations > 0 && <p className="text-on-surface-variant">{t(`review.${cancelAction}_message`, {count: cancellations})}</p>}
      {note && <p className="text-on-surface-variant">{note}</p>}
      <ul className="m-0 list-none p-0 flex flex-col gap-1">
        {apps.map(app => {
          const {removal} = getUad(app.packageName)
          const showPackage = app.appLabel !== app.packageName && ((labelCounts.get(app.appLabel.toLowerCase()) ?? 0) > 1 || !['recommended', 'advanced'].includes(removal))
          return <li key={app.packageName}>
          <EntryWrapper htmlFor={onToggle ? `review-select-${app.packageName}` : undefined} className="flex w-full min-w-0 flex-wrap items-center gap-x-2">
            {onToggle && <md-checkbox id={`review-select-${app.packageName}`} class="shrink-0" aria-label={t(app.pending ? 'review.include_change' : operation === 'remove' ? 'review.include' : 'review.include_restore', {app: `${app.appLabel} (${app.packageName})`})} checked={selectedPackages?.includes(app.packageName)} onChange={() => onToggle(app.packageName)} />}
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="wrap-break-word text-base leading-5 font-medium">{app.appLabel}</span>
              {operation === 'remove' && <span className="self-start rounded-full px-2 text-sm" style={{
                backgroundColor: `var(--removal-${removal}-container)`,
                color: `var(--removal-on-${removal}-container)`,
              }}>{t(`removal.${removal}`)}</span>}
            </div>
            <md-icon-button class="shrink-0 size-12" aria-label={t('app_info.open', {app: `${app.appLabel} (${app.packageName})`})} onClick={event => { event.preventDefault(); event.stopPropagation(); setDetailsApp(app) }}><md-icon>info</md-icon></md-icon-button>
            {showPackage && <span className="w-full text-sm text-on-surface-variant break-all">{app.packageName}</span>}
            {hasPending && <span className="w-full text-sm font-medium">{t(app.pending ? `review.${cancelAction}_item` : `review.${operation}_item`)}</span>}
          </EntryWrapper>
        </li>
        })}
      </ul>
      {operation === 'remove' && <p className="text-sm text-on-surface-variant">{t('review.ratings_hint')}</p>}
      <AppInfoDialog app={detailsApp} onClose={() => setDetailsApp(null)} navigation={navigation} selection={detailsApp && onToggle ? {
        checked: selectedPackages?.includes(detailsApp.packageName) ?? true,
        label: t(detailsApp.pending ? 'review.include_change' : operation === 'remove' ? 'review.include' : 'review.include_restore', {app: `${detailsApp.appLabel} (${detailsApp.packageName})`}),
        onChange: () => onToggle(detailsApp.packageName),
      } : undefined} />
    </ReviewDialog>
  )
}
