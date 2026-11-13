import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { MdDialog } from '@material/web/dialog/dialog.js'
import { useHistory } from '../../hooks/useHistory'
import { customizeDialogAnimation } from '../../hooks/useDialogAnimation'

interface ReviewDialogProps {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  actions: ReactNode
  beforeActions?: ReactNode
}

export default function ReviewDialog({ open, title, onClose, children, actions, beforeActions }: ReviewDialogProps) {
  const ref = useRef<MdDialog>(null)
  const { push, consume } = useHistory()
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    customizeDialogAnimation(dialog)
    if (open) {
      dialog.show()
      push('review-dialog', () => dialog.close())
    } else dialog.close()
  }, [open, push])
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    const close = () => { consume('review-dialog'); onClose() }
    dialog.addEventListener('closed', close)
    return () => dialog.removeEventListener('closed', close)
  }, [onClose, consume])
  const dialog = (
    <md-dialog ref={ref} class="review-dialog" aria-label={title}>
      <div slot="headline">{title}</div>
      <div slot="content">{children}</div>
      {beforeActions ? <div slot="actions" className="review-actions">
        {beforeActions}
        <div className="flex items-center justify-end gap-2">{actions}</div>
      </div> : <div slot="actions">{actions}</div>}
    </md-dialog>
  )
  const target = document.getElementById('dialog-root')
  return target ? createPortal(dialog, target) : dialog
}
