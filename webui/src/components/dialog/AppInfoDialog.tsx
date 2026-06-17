import { useRef, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import type { MdDialog } from '@material/web/dialog/dialog.js'
import type { AppInfo } from '../../lib/AppList'
import { useDialogAnimation } from '../../hooks/useDialogAnimation'
import { useHistory } from '../../hooks/useHistory'
import { essential, caution, safe, google, categories } from '../../data/category'
import AndroidSvg from '../../assets/android.svg?react'
import GoogleSvg from '../../assets/google.svg?react'

const categoryMap: Record<string, string[]> = {
  essential,
  caution,
  safe,
  google,
}

const categoryIconMap: Record<string, string> = Object.fromEntries(
  categories.map(c => [c.id, c.icon ?? 'help'])
)

const categorySvgIcons: Record<string, React.FC<{ className?: string }>> = {
  google: GoogleSvg,
}

function getAppCategory(packageName: string): string {
  for (const [catId, pkgs] of Object.entries(categoryMap)) {
    if (pkgs.includes(packageName)) return catId
  }
  return 'unknown'
}

interface AppInfoDialogProps {
  app: AppInfo | null
  onClose: () => void
}

export default function AppInfoDialog({ app, onClose }: AppInfoDialogProps) {
  const dialogRef = useRef<MdDialog>(null)
  const { t } = useTranslation()
  const [displayApp, setDisplayApp] = useState<AppInfo | null>(null)
  const { push, consume } = useHistory()

  useEffect(() => {
    if (!dialogRef.current) return
    useDialogAnimation(dialogRef.current)
    dialogRef.current.open = !!app
    if (app) {
      setDisplayApp(app)
      setImgKey(k => k + 1)
      setIconLoaded(false)
      setIconError(false)
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

  const [iconLoaded, setIconLoaded] = useState(false)
  const [iconError, setIconError] = useState(false)
  const [imgKey, setImgKey] = useState(0)

  const version = displayApp?.versionName && displayApp?.versionCode
    ? `${displayApp.versionName} (${displayApp.versionCode})`
    : displayApp?.versionName ?? displayApp?.versionCode?.toString() ?? null

  const status = displayApp?.nuked ? t('app_info.nuked')
    : displayApp?.pending ? t('app_info.pending')
    : t('app_info.installed')

  const fields = displayApp ? (() => {
    const cat = getAppCategory(displayApp.packageName)
    return [
      { label: t('app_info.version'), value: version, icon: 'history' },
      { label: t('app_info.uid'), value: displayApp.uid?.toString(), icon: 'person' },
      { label: t('app_info.status'), value: status, icon: 'circle' },
      { label: t('app_info.category'), value: t(`category.${cat}`), icon: 'label_important' },
      { label: '', value: t(`category_desc.${cat}`), icon: cat },
    ].filter(f => f.value != null && f.value !== '')
  })() : []

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
              src={`ksu://icon/${displayApp?.packageName}`}
              alt=""
              className={`w-16 h-16 rounded-xl object-cover bg-surface-container-low transition-opacity ${iconLoaded ? 'opacity-100' : 'opacity-0'}`}
              onLoad={() => setIconLoaded(true)}
              onError={() => setIconError(true)}
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

      <div slot="content" className="flex flex-col gap-3 pt-6">
        {fields.map(({ label, value, icon }) => {
          const SvgIcon = categorySvgIcons[icon]
          return (
            <div
              key={label}
              className="flex items-center gap-3 rounded-lg hover:bg-surface-container-high transition-colors"
              onClick={() => {
                if (value) {
                  navigator.clipboard.writeText(value)
                }
              }}
            >
              {SvgIcon ? (
                <span className="flex items-center justify-center w-6 h-6 text-on-surface-variant"><SvgIcon className="w-5 h-5" /></span>
              ) : (
                <md-icon style={{ color: categories.find(c => c.id === icon)?.color || 'var(--md-sys-color-on-surface-variant)' }}>
                  {categoryIconMap[icon] ?? icon}
                </md-icon>
              )}
              <div className="flex flex-col min-w-0 flex-1">
                {label && <span className="text-xs text-on-surface-variant">{label}</span>}
                <span className={`text-sm text-on-surface ${label ? 'truncate' : 'whitespace-normal wrap-break-word'}`}>{value}</span>
              </div>
            </div>
          )
        })}
      </div>

      <div slot="actions">
        <md-text-button onClick={onClose}>{t('global.close')}</md-text-button>
      </div>
    </md-dialog>
  )

  const target = document.getElementById('dialog-root')
  return target ? createPortal(dialog, target) : dialog
}
