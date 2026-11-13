import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Cli } from '../../lib/Cli'
import { File } from '../../lib/File'
import ReviewDialog from './ReviewDialog'

export default function OperationLogDialog({ open, onClose }: { open: boolean, onClose: () => void }) {
  const { t } = useTranslation()
  const [log, setLog] = useState('')
  const [status, setStatus] = useState('')
  const [readFailed, setReadFailed] = useState(false)
  const [readAttempt, setReadAttempt] = useState(0)
  useEffect(() => {
    if (!open) return
    let active = true
    setLog('')
    setReadFailed(false)
    setStatus(t('global.loading'))
    Cli.readOperationLog().then(value => {
      if (active) { setLog(value); setStatus(value ? '' : t('diagnostics.empty')) }
    }).catch(() => { if (active) { setStatus(t('diagnostics.read_error')); setReadFailed(true) } })
    return () => { active = false }
  }, [open, t, readAttempt])
  const copy = async () => {
    try { await navigator.clipboard.writeText(log); setStatus(t('global.copied')) }
    catch { setStatus(t('global.copy_error')) }
  }
  const save = async () => {
    const path = '/sdcard/Download/san-operation-log.txt'
    try { await File.write(path, log); setStatus(t('diagnostics.saved', {path})) }
    catch { setStatus(t('diagnostics.save_error')) }
  }
  return <ReviewDialog open={open} title={t('diagnostics.title')} onClose={onClose} actions={<>
    <md-text-button disabled={!log} aria-label={t('diagnostics.copy')} onClick={copy}>{t('diagnostics.copy_short')}</md-text-button>
    <md-text-button disabled={!log} aria-label={t('diagnostics.save')} onClick={save}>{t('diagnostics.save_short')}</md-text-button>
    <md-filled-button onClick={onClose}>{t('global.close')}</md-filled-button>
  </>}>
    {log && <p className="mt-0 text-sm text-on-surface-variant">{t('diagnostics.message')}</p>}
    {status && <p role="status" className="break-all">{status}</p>}
    {readFailed && <md-text-button onClick={() => setReadAttempt(value => value + 1)}>{t('global.retry')}</md-text-button>}
    {log && <pre className="text-xs whitespace-pre-wrap break-all select-text">{log}</pre>}
  </ReviewDialog>
}
