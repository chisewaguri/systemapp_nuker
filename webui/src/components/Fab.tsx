import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface FabProps {
  onClick: () => void
  icon: string
  label: string
  open?: boolean
  onVisibilityChange?: (visible: boolean) => void
  disabled?: boolean
  secondaryAction?: ReactNode
}

export default function Fab({ onClick, icon, label, open = true, onVisibilityChange, disabled = false, secondaryAction }: FabProps) {

  useEffect(() => {
    onVisibilityChange?.(open)
  }, [open, onVisibilityChange])

  if (!open) return null

  const action = (
    <div className="flex items-center justify-end gap-2 bg-surface-container-low px-4 py-1">
      {secondaryAction}
      <md-filled-button class="flex-1 sm:flex-none" aria-label={label} disabled={disabled} onClick={onClick} style={{'--md-filled-button-container-height': '48px', '--md-filled-button-container-shape': '16px'} as React.CSSProperties}>
        <md-icon slot="icon">{icon}</md-icon>
        {label}
      </md-filled-button>
    </div>
  )
  const target = document.getElementById('page-action-root')
  return target ? createPortal(action, target) : action
}
