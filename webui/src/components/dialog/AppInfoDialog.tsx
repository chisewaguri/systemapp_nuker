import { useRef, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import type { MdDialog } from '@material/web/dialog/dialog.js'
import type { AppInfo } from '../../lib/AppList'
import { customizeDialogAnimation } from '../../hooks/useDialogAnimation'
import { useHistory } from '../../hooks/useHistory'
import AndroidSvg from '../../assets/android.svg?react'
import { toast } from 'kernelsu-alt'
import { getUad } from '../../lib/uad'
import { savedIcon } from '../../lib/iconCache'
import { Cli } from '../../lib/Cli'

function copyText(text: string, t: (key: string) => string) {
  const copy = navigator.clipboard?.writeText(text)
  if (!copy) {
    toast(t('global.copy_error'))
    return
  }
  copy.then(() => toast(t('global.copied')))
    .catch(() => toast(t('global.copy_error')))
}

// uad-ng descriptions carry bare urls, often wrapped in parens or ending a sentence.
// balanced parens stay in the url (wikipedia uses them), trailing punctuation stays out.
const URL_RE = /(https?:\/\/(?:\([^\s()]*\)|[^\s()[\]])*(?:\([^\s()]*\)|[^\s()[\].,;:!?'"]))/g

function linkify(text: string) {
  return text.split(URL_RE).map((part, i) => i % 2 === 0 ? part : (
    <a
      key={i}
      href={part}
      className="underline underline-offset-2 break-all"
      style={{ color: 'inherit' }}
      onClick={e => { e.preventDefault(); e.stopPropagation(); Cli.openLink(part) }}
    >
      {part.replace(/^https?:\/\//, '')}
    </a>
  ))
}

interface AppInfoDialogProps {
  app: AppInfo | null
  onClose: () => void
}

export default function AppInfoDialog({ app, onClose }: AppInfoDialogProps) {
  const dialogRef = useRef<MdDialog>(null)
  const { t } = useTranslation()
  const [displayApp, setDisplayApp] = useState<AppInfo | null>(null)
  const [iconLoaded, setIconLoaded] = useState(false)
  const [iconError, setIconError] = useState(false)
  const [iconSrc, setIconSrc] = useState('')
  const [imgKey, setImgKey] = useState(0)
  const { push, consume } = useHistory()

  useEffect(() => {
    if (!dialogRef.current) return
    customizeDialogAnimation(dialogRef.current)
    dialogRef.current.open = !!app
    if (app) {
      setDisplayApp(app)
      setImgKey(k => k + 1)
      setIconLoaded(false)
      setIconError(false)
      setIconSrc(`ksu://icon/${app.packageName}`)
      push('app-info', () => dialogRef.current?.close())
    }
  }, [app, push])

  useEffect(() => {
    const el = dialogRef.current
    if (!el) return

    const onClosed = () => {
      consume('app-info')
      onClose()
    }

    el.addEventListener('closed', onClosed)

    return () => {
      el.removeEventListener('closed', onClosed)
    }
  }, [onClose, consume])

  const version = displayApp?.versionName && displayApp?.versionCode
    ? `${displayApp.versionName} (${displayApp.versionCode})`
    : displayApp?.versionName ?? displayApp?.versionCode?.toString() ?? null

  const status = displayApp?.pending
    ? t(displayApp.nuked ? 'app_info.pending_restore' : 'app_info.pending_removal')
    : displayApp?.nuked ? t('app_info.nuked')
    : t('app_info.installed')

  const fields = displayApp ? [
    { label: t('app_info.version'), value: version, icon: 'history' },
    { label: t('app_info.uid'), value: displayApp.uid?.toString(), icon: 'person' },
    { label: t('app_info.status'), value: status, icon: 'circle' },
  ].filter(f => f.value != null && f.value !== '') : []

  const uad = displayApp ? getUad(displayApp.packageName) : null
  const uadText = uad ? uad.description ?? t('removal_desc.none') : ''

  const dialog = (
    <md-dialog ref={dialogRef}>
      <div slot="headline" className="flex flex-col items-center gap-0">
        <div className="icon-container relative w-16 h-16 shrink-0">
          {!iconLoaded && !iconError && (
            <div className="icon-loader absolute inset-0 flex items-center justify-center">
              <div className="w-10 h-10 border-2 border-on-surface-variant border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {iconError ? (
            <div className="w-16 h-16 flex items-center justify-center bg-secondary-container rounded-xl">
              <AndroidSvg className="w-10 h-10 fill-on-secondary-container" />
            </div>
          ) : (
            <img
              key={imgKey}
              src={iconSrc}
              alt=""
              className={`w-16 h-16 rounded-xl object-cover bg-surface-container-low transition-opacity ${iconLoaded ? 'opacity-100' : 'opacity-0'}`}
              onLoad={() => setIconLoaded(true)}
              onError={() => {
                if (!displayApp || iconSrc.startsWith('data:')) return setIconError(true)
                savedIcon(displayApp.packageName).then(icon => icon ? setIconSrc(icon) : setIconError(true))
              }}
            />
          )}
        </div>
        <span className="text-lg font-medium text-on-surface truncate pt-1">
          {displayApp?.appLabel}
        </span>
        <span className="text-sm text-on-surface-variant truncate">
          {displayApp?.packageName}
        </span>
      </div>

      <div slot="content" className="flex flex-col gap-3 pt-2 pb-2">
        {fields.map(({ label, value, icon }) => (
          <button
            key={label}
            type="button"
            aria-label={t('app_info.copy', { label })}
            className="flex w-full items-center gap-3 rounded-lg border-0 bg-transparent p-0 text-start hover:bg-surface-container-high transition-colors"
            onClick={() => value && copyText(value, t)}
          >
            <md-icon class="text-on-surface-variant">{icon}</md-icon>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-xs text-on-surface-variant">{label}</span>
              <span className="text-sm text-on-surface truncate">{value}</span>
            </div>
            <md-icon class="text-on-surface-variant">content_copy</md-icon>
          </button>
        ))}
        {uad && (
          <div
            className="-mx-2 mt-1 box-border flex flex-col gap-1 rounded-2xl py-2 ps-4 pe-0 font-sans"
            style={{
              backgroundColor: `var(--removal-${uad.removal}-container)`,
              color: `var(--removal-on-${uad.removal}-container)`,
            }}
          >
            <div className="flex min-h-10 items-center gap-2 text-sm font-medium">
              <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: `var(--removal-${uad.removal})` }} />
              <span className="flex-1">{t(`removal.${uad.removal}`)}</span>
              <md-icon-button
                aria-label={t('app_info.copy', { label: t('app_info.description') })}
                style={{ '--md-icon-button-icon-color': 'currentColor' } as React.CSSProperties}
                onClick={() => copyText(uadText, t)}
              >
                <md-icon>content_copy</md-icon>
              </md-icon-button>
            </div>
            <span className="pe-4 text-sm leading-normal whitespace-pre-line wrap-break-word">{linkify(uadText)}</span>
            {uad.description && <span className="pe-4 pt-1 pb-1 text-xs opacity-85">{t('app_info.uad_source')}</span>}
          </div>
        )}
      </div>

      <div slot="actions">
        <md-text-button onClick={onClose}>{t('global.close')}</md-text-button>
      </div>
    </md-dialog>
  )

  const target = document.getElementById('dialog-root')
  return target ? createPortal(dialog, target) : dialog
}
