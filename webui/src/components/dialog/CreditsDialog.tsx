import { useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import type { MdDialog } from '@material/web/dialog/dialog.js'
import { customizeDialogAnimation } from '../../hooks/useDialogAnimation'
import { useHistory } from '../../hooks/useHistory'
import { Cli } from '../../lib/Cli'
import { UAD_REPO } from '../../lib/uad'

const CREDITS = [
  { id: 'mountify', name: 'backslashxx/mountify', url: 'https://github.com/backslashxx/mountify' },
  { id: 'uad', name: 'Universal Android Debloater Next Generation', url: UAD_REPO },
  { id: 'tricky_addon', name: 'KOWX712/Tricky-Addon-Update-Target-List', url: 'https://github.com/KOWX712/Tricky-Addon-Update-Target-List' },
  { id: 'zygisk_detach', name: 'j-hc/zygisk-detach', url: 'https://github.com/j-hc/zygisk-detach' },
]

interface CreditsDialogProps {
  open: boolean
  onClose: () => void
}

export default function CreditsDialog({ open, onClose }: CreditsDialogProps) {
  const dialogRef = useRef<MdDialog>(null)
  const { t } = useTranslation()
  const { push, consume } = useHistory()

  useEffect(() => {
    if (!dialogRef.current) return
    customizeDialogAnimation(dialogRef.current)
    dialogRef.current.open = open
    if (open) push('credits', () => dialogRef.current?.close())
  }, [open, push])

  useEffect(() => {
    const el = dialogRef.current
    if (!el) return
    const onClosed = () => {
      consume('credits')
      onClose()
    }
    el.addEventListener('closed', onClosed)
    return () => el.removeEventListener('closed', onClosed)
  }, [consume, onClose])

  const dialog = (
    <md-dialog ref={dialogRef}>
      <span slot="headline">{t('credits.title')}</span>
      <div slot="content" className="flex flex-col gap-1">
        {CREDITS.map(credit => (
          <button
            key={credit.id}
            type="button"
            className="-mx-3 flex flex-col gap-0.5 rounded-2xl border-0 bg-transparent px-3 py-2 text-start font-sans hover:bg-surface-container-highest"
            onClick={() => Cli.openLink(credit.url)}
          >
            <span className="text-sm text-on-surface">{credit.name}</span>
            <span className="text-xs leading-relaxed text-on-surface-variant">{t(`credits.${credit.id}`)}</span>
          </button>
        ))}
        <p className="pt-2 text-xs leading-relaxed text-outline">{t('credits.everyone')}</p>
      </div>
      <div slot="actions">
        <md-text-button onClick={() => dialogRef.current?.close()}>{t('credits.close')}</md-text-button>
      </div>
    </md-dialog>
  )

  const target = document.getElementById('dialog-root')
  return target ? createPortal(dialog, target) : dialog
}
