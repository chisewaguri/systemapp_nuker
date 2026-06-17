import { useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import type { MdDialog } from '@material/web/dialog/dialog.js'
import { useDialogAnimation } from '../../hooks/useDialogAnimation'
import { useHistory } from '../../hooks/useHistory'

interface BackupRestoreDialogProps {
  open: boolean
  onDismiss: () => void
  onDontRestore: () => void
  onRestore: () => void
}

export default function BackupRestoreDialog({ open, onDismiss, onDontRestore, onRestore }: BackupRestoreDialogProps) {
  const dialogRef = useRef<MdDialog>(null)
  const { t } = useTranslation()
  const { push, consume } = useHistory()

  useEffect(() => {
    if (!dialogRef.current) return
    useDialogAnimation(dialogRef.current)
    dialogRef.current.open = open
    if (open) {
      push('backup-restore', () => {
        dialogRef.current?.close()
        onDismiss()
      })
    }
  }, [open, push])

  useEffect(() => {
    const el = dialogRef.current
    if (!el) return

    const onClosed = () => {
      consume('backup-restore')
    }

    el.addEventListener('closed', onClosed)
    return () => el.removeEventListener('closed', onClosed)
  }, [consume])

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
      </div>

      <div slot="actions" className="flex flex-col">
        <md-filled-button onClick={onRestore} class="w-full">
          {t('backup.restore')}
        </md-filled-button>
        <md-outlined-button onClick={onDontRestore} class="w-full">
          {t('backup.delete_backup')}
        </md-outlined-button>
        <md-outlined-button onClick={onDismiss} class="w-full">
          {t('backup.dismiss')}
        </md-outlined-button>
      </div>
    </md-dialog>
  )

  const target = document.getElementById('dialog-root')
  return target ? createPortal(dialog, target) : dialog
}
