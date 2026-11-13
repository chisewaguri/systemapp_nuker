import { useRef, useEffect, useState, useId } from 'react'
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
  return text.split(URL_RE).map((part, i) => {
    if (i % 2 === 0) return part
    let label: string
    try {
      label = new URL(part).hostname.replace(/^www\./, '')
    } catch {
      return part
    }
    return <a
      key={i}
      href={part}
      title={part}
      className="inline-block max-w-full underline underline-offset-2 break-all"
      style={{ color: 'inherit' }}
      onClick={e => { e.preventDefault(); e.stopPropagation(); Cli.openLink(part) }}
    >
      {label}
    </a>
  })
}

type AppDetails = Pick<AppInfo, 'packageName' | 'appLabel'> & Partial<AppInfo>

function descriptionParts(text: string) {
  if (text.length <= 400) return [text, '']
  let end = text.lastIndexOf('\n', 280)
  if (end < 80) end = text.lastIndexOf(' ', 280)
  if (end <= 0) end = 280
  for (const match of text.matchAll(URL_RE)) {
    if (match.index < end && match.index + match[0].length > end) end = match.index + match[0].length
  }
  return [text.slice(0, end).trimEnd(), text.slice(end).trimStart()]
}

interface AppInfoDialogProps {
  app: AppDetails | null
  onClose: () => void
  navigation?: {onPrevious?: () => void, onNext?: () => void}
  selection?: {checked: boolean, disabled?: boolean, label: string, onChange: () => void}
}

export default function AppInfoDialog({ app, onClose, navigation, selection }: AppInfoDialogProps) {
  const dialogRef = useRef<MdDialog>(null)
  const selectionId = useId()
  const iconRequest = useRef(0)
  const { t } = useTranslation()
  const [displayApp, setDisplayApp] = useState<AppDetails | null>(null)
  const [iconLoaded, setIconLoaded] = useState(false)
  const [iconError, setIconError] = useState(false)
  const [iconSrc, setIconSrc] = useState('')
  const [imgKey, setImgKey] = useState(0)
  const { push, consume } = useHistory()
  const open = app !== null

  useEffect(() => {
    if (!dialogRef.current) return
    customizeDialogAnimation(dialogRef.current)
    dialogRef.current.open = open
    if (open) push('app-info', () => dialogRef.current?.close())
  }, [open, push])

  useEffect(() => {
    iconRequest.current++
    if (app) {
      setDisplayApp(app)
      setImgKey(k => k + 1)
      setIconLoaded(false)
      setIconError(false)
      setIconSrc(`ksu://icon/${app.packageName}`)
      const scroller = dialogRef.current?.shadowRoot?.querySelector<HTMLElement>('.scroller')
      if (scroller) scroller.scrollTop = 0
    }
  }, [app])

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

  const status = displayApp?.nuked === undefined ? null : displayApp.pending
    ? t(displayApp.nuked ? 'app_info.pending_restore' : 'app_info.pending_removal')
    : displayApp?.nuked ? t('app_info.nuked')
    : t('app_info.installed')

  const fields = displayApp ? [
    { label: t('app_info.version'), value: version, icon: 'history' },
    { label: t('app_info.uid'), value: displayApp.uid?.toString(), icon: 'person' },
  ].filter(f => f.value != null && f.value !== '') : []

  const uad = displayApp ? getUad(displayApp.packageName) : null
  const uadText = uad ? uad.description ?? t('removal_desc.none') : ''
  const [descriptionPreview, descriptionRest] = descriptionParts(uadText)

  const dialog = (
    <md-dialog ref={dialogRef} style={{width: 'min(560px, calc(100vw - 40px))'}} aria-label={displayApp ? `${displayApp.appLabel} (${displayApp.packageName})` : undefined}>
      <div slot="content" className="flex flex-col gap-3 pt-2 pb-2">
        <div className={`grid ${selection ? 'grid-cols-[minmax(0,1fr)_3rem]' : 'grid-cols-[minmax(0,1fr)_2rem]'} items-start gap-x-3`}>
          <div className="min-w-0 flex flex-col">
            <h2 className="m-0 text-lg font-medium text-on-surface wrap-break-word">{displayApp?.appLabel}</h2>
            <span className="text-sm text-on-surface-variant break-all select-text">{displayApp?.packageName}</span>
          </div>
          <div className="icon-container relative w-8 h-8 shrink-0 justify-self-end">
            {!iconLoaded && !iconError && (
              <div className="icon-loader absolute inset-0 flex items-center justify-center">
                <div className="w-5 h-5 border-2 border-on-surface-variant border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            {iconError ? (
              <div className="w-8 h-8 flex items-center justify-center bg-secondary-container rounded-lg">
                <AndroidSvg className="w-6 h-6 fill-on-secondary-container" />
              </div>
            ) : (
              <img
                key={imgKey}
                src={iconSrc || undefined}
                alt=""
                className={`w-8 h-8 rounded-lg object-cover bg-surface-container-low transition-opacity ${iconLoaded ? 'opacity-100' : 'opacity-0'}`}
                onLoad={() => setIconLoaded(true)}
                onError={() => {
                  if (!displayApp || iconSrc.startsWith('data:')) return setIconError(true)
                  const request = iconRequest.current
                  savedIcon(displayApp.packageName).then(icon => {
                    if (request === iconRequest.current) {
                      if (icon) setIconSrc(icon)
                      else setIconError(true)
                    }
                  })
                }}
              />
            )}
          </div>
          {status && <span className={`${selection ? '' : 'col-span-2'} self-center text-sm text-on-surface-variant`}>{status}</span>}
          {selection && <label htmlFor={selectionId} className="col-start-2 inline-flex h-16 min-w-12 flex-col items-center justify-center cursor-pointer">
            <md-checkbox id={selectionId} class="shrink-0" touch-target="wrapper" aria-label={selection.label}
              checked={selection.checked} disabled={selection.disabled} onChange={selection.onChange} />
            <span className="text-xs leading-4 text-on-surface-variant">{t(selection.checked ? 'app_info.selected' : 'app_info.select')}</span>
          </label>}
        </div>

        {uad && (
          <div
            className="-mx-2 mt-1 box-border flex flex-col gap-1 rounded-2xl py-2 ps-4 pe-0 font-sans"
            style={{
              backgroundColor: `var(--removal-${uad.removal}-container)`,
              color: `var(--removal-on-${uad.removal}-container)`,
            }}
          >
            <div className="flex items-center gap-2 pe-4 text-sm font-medium">
              <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: `var(--removal-${uad.removal})` }} />
              <span>{t(`removal.${uad.removal}`)}</span>
            </div>
            <span className="pe-4 text-sm leading-normal whitespace-pre-line wrap-break-word">{linkify(descriptionPreview)}</span>
            {descriptionRest && <details key={displayApp?.packageName} className="pe-4 text-sm leading-normal">
              <summary className="min-h-11 py-3 box-border cursor-pointer">{t('app_info.full_description')}</summary>
              <div className="whitespace-pre-line wrap-break-word">{linkify(descriptionRest)}</div>
            </details>}
            {uad.removal === 'unsafe' && <span className="pe-4 text-sm leading-normal">{t('removal_desc.unsafe')}</span>}
          </div>
        )}
        {fields.length > 0 && <details key={displayApp?.packageName}>
          <summary className="min-h-12 py-3 box-border cursor-pointer text-sm text-on-surface-variant">{t('app_info.technical')}</summary>
          {fields.map(({ label, value, icon }) => (
            <button
              key={label}
              type="button"
              aria-label={[t('app_info.copy', { label }), value].filter(Boolean).join(': ')}
              className="flex min-h-12 w-full items-center gap-3 rounded-lg border-0 bg-transparent p-0 text-start hover:bg-surface-container-high transition-colors"
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
        </details>}
      </div>

      <div slot="actions" className="flex items-center gap-2">
        {navigation && <>
          <md-icon-button class="size-12" disabled={!navigation.onPrevious} aria-label={t('app_info.previous')} onClick={navigation.onPrevious}><md-icon>chevron_left</md-icon></md-icon-button>
          <md-icon-button class="size-12" disabled={!navigation.onNext} aria-label={t('app_info.next')} onClick={navigation.onNext}><md-icon>chevron_right</md-icon></md-icon-button>
          <span className="flex-1" />
        </>}
        <md-text-button onClick={onClose}>{t('global.close')}</md-text-button>
      </div>
    </md-dialog>
  )

  const target = document.getElementById('dialog-root')
  return target ? createPortal(dialog, target) : dialog
}
