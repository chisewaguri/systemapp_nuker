import { useRef, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import type { MdDialog } from '@material/web/dialog/dialog.js'
import { customizeDialogAnimation } from '../../hooks/useDialogAnimation'
import { useHistory } from '../../hooks/useHistory'
import { File } from '../../lib/File'
import { PERSIST_DIR } from '../../constant'
import { parseNukeLine } from '../../lib/nukeList'
import type { RecoveryExclusions } from '../../lib/Cli'
import AppInfoDialog from './AppInfoDialog'
import { getUad } from '../../lib/uad'

interface RecoveryEntry {
  kind: 'app' | 'path'
  key: string
  label: string
  appLabel?: string
}

interface BackupRestoreDialogProps {
  open: boolean
  onDismiss: () => void
  onDontRestore: () => void
  onRestore: (excluded: RecoveryExclusions) => void
}

export default function BackupRestoreDialog({ open, onDismiss, onDontRestore, onRestore }: BackupRestoreDialogProps) {
  const dialogRef = useRef<MdDialog>(null)
  const { t } = useTranslation()
  const { push, consume } = useHistory()
  const [entries, setEntries] = useState<RecoveryEntry[] | null>(null)
  const [excluded, setExcluded] = useState<Set<string>>(new Set())
  const [readAttempt, setReadAttempt] = useState(0)
  const [failed, setFailed] = useState(false)
  const [acknowledged, setAcknowledged] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [detailsApp, setDetailsApp] = useState<{packageName: string, appLabel: string} | null>(null)

  useEffect(() => {
    if (!open) return
    let active = true
    setEntries(null)
    setFailed(false)
    setAcknowledged(false)
    setDeleting(false)
    setExcluded(new Set())
    Promise.all([
      File.readIfExists(`${PERSIST_DIR}/nuke_list.txt.bak`),
      File.readIfExists(`${PERSIST_DIR}/raw_whiteouts.txt.bak`),
    ]).then(([apps, paths]) => {
      if (active) setEntries([
        ...apps.split('\n').filter(line => line.trim() && !line.startsWith('#')).map(line => {
          const app = parseNukeLine(line)
          return {kind: 'app' as const, key: app.packageName, label: `${app.appLabel} (${app.packageName})`, appLabel: app.appLabel}
        }),
        ...paths.split('\n').filter(line => line.trim() && !line.startsWith('#')).map(path => ({kind: 'path' as const, key: path, label: path})),
      ])
    }).catch(() => { if (active) setFailed(true) })
    return () => { active = false }
  }, [open, readAttempt])

  useEffect(() => {
    if (!dialogRef.current) return
    customizeDialogAnimation(dialogRef.current)
    dialogRef.current.open = open
    if (open) {
      push('backup-restore', () => {
        dialogRef.current?.close()
        onDismiss()
      })
    }
  }, [open, push, onDismiss])

  useEffect(() => {
    const el = dialogRef.current
    if (!el) return

    const onClosed = () => {
      consume('backup-restore')
      onDismiss()
    }

    el.addEventListener('closed', onClosed)
    return () => el.removeEventListener('closed', onClosed)
  }, [consume, onDismiss])

  const selectedCount = entries?.filter(entry => !excluded.has(`${entry.kind}:${entry.key}`)).length ?? 0
  const toggleEntry = (entry: RecoveryEntry) => {
    const key = `${entry.kind}:${entry.key}`
    setExcluded(previous => {
      const next = new Set(previous)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
    setAcknowledged(false)
  }

  const dialog = (
    <md-dialog ref={dialogRef}>
      <div slot="headline" className="flex flex-col items-center gap-2">
        <md-icon class="text-on-error-container">warning</md-icon>
        <span className="text-lg font-medium text-on-surface">
          {t('backup.title')}
        </span>
      </div>

      <div slot="content" className="pt-2">
        <p className="text-sm text-on-surface-variant leading-relaxed">
          {t('backup.message')}
        </p>
        {failed ? <><p role="alert">{t('backup.read_error')}</p><md-text-button onClick={() => setReadAttempt(value => value + 1)}>{t('global.retry')}</md-text-button></> : entries === null ? <md-circular-progress indeterminate aria-label={t('global.loading')} /> : <>
          <p className="text-sm text-on-surface-variant">{t('backup.selection_hint')}</p>
          <p role="status" className="text-sm">{t('review.selected', {count: selectedCount})}</p>
          <label className="flex items-start gap-2 text-error">
            <md-checkbox class="shrink-0" aria-label={t('backup.acknowledge')} checked={acknowledged} onChange={() => setAcknowledged(value => !value)} />
            <span className="pt-2">{t('backup.acknowledge')}</span>
          </label>
          <ul className="list-none p-0 text-sm break-all">{entries.map(entry => <li key={`${entry.kind}:${entry.key}`}>
            <label className="flex min-h-12 items-start gap-2 py-1">
              <md-checkbox class="shrink-0" aria-label={t('backup.include', {entry: entry.label})} checked={!excluded.has(`${entry.kind}:${entry.key}`)} onChange={() => toggleEntry(entry)} />
              <span className="min-w-0 pt-3">{entry.label}</span>
            </label>
            {entry.kind === 'app' && <div className="ms-12 mb-3 flex flex-wrap items-center gap-2">
              <span className="rounded-full px-2 py-1" style={{
                backgroundColor: `var(--removal-${getUad(entry.key).removal}-container)`,
                color: `var(--removal-on-${getUad(entry.key).removal}-container)`,
              }}>{t(`removal.${getUad(entry.key).removal}`)}</span>
              <md-text-button aria-label={t('app_info.open', {app: entry.label})} onClick={() => setDetailsApp({packageName: entry.key, appLabel: entry.appLabel ?? entry.key})}>{t('global.details')}</md-text-button>
            </div>}
          </li>)}</ul>
        </>}
        {deleting && <p role="alert">{t('backup.delete_message')}</p>}
      </div>

      <div slot="actions" className="flex flex-col">
        <md-filled-button onClick={onDismiss} class="w-full">
          {t('backup.dismiss')}
        </md-filled-button>
        <md-outlined-button disabled={failed || selectedCount === 0 || !acknowledged} onClick={() => {
          if (!acknowledged || selectedCount === 0 || failed || !entries) return
          const omitted = entries.filter(entry => excluded.has(`${entry.kind}:${entry.key}`))
          onRestore({packages: omitted.filter(entry => entry.kind === 'app').map(entry => entry.key), paths: omitted.filter(entry => entry.kind === 'path').map(entry => entry.key)})
        }} class="w-full">
          {t('backup.restore_selected', {count: selectedCount})}
        </md-outlined-button>
        <md-outlined-button onClick={() => { if (deleting) onDontRestore(); else setDeleting(true) }} class="w-full">
          {t('backup.delete_backup')}
        </md-outlined-button>
      </div>
    </md-dialog>
  )

  const target = document.getElementById('dialog-root')
  return <>{target ? createPortal(dialog, target) : dialog}<AppInfoDialog app={detailsApp} onClose={() => setDetailsApp(null)} /></>
}
