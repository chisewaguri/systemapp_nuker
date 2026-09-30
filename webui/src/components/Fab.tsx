import { useState, useEffect, useRef, useCallback } from 'react'

interface FabProps {
  onClick: () => void
  icon: string
  label: string
  variant?: 'primary' | 'secondary' | 'tertiary'
  open?: boolean
  onVisibilityChange?: (visible: boolean) => void
}

export default function Fab({ onClick, icon, label, variant, open = true, onVisibilityChange }: FabProps) {
  const [scrollVisible, setScrollVisible] = useState(true)
  const lastScrollTop = useRef(0)
  const ticking = useRef(false)

  const handleScroll = useCallback((container: HTMLElement) => {
    if (ticking.current) return

    ticking.current = true
    requestAnimationFrame(() => {
      const scrollTop = container.scrollTop
      const delta = scrollTop - lastScrollTop.current

      if (delta > 10) {
        setScrollVisible(false)
      } else if (delta < -10) {
        setScrollVisible(true)
      }

      lastScrollTop.current = scrollTop
      ticking.current = false
    })
  }, [])

  useEffect(() => {
    const container = document.querySelector<HTMLElement>('main.overflow-y-auto')
    if (!container) return

    const onScroll = () => handleScroll(container)
    container.addEventListener('scroll', onScroll, { passive: true })
    return () => container.removeEventListener('scroll', onScroll)
  }, [handleScroll])

  const visible = open && scrollVisible

  useEffect(() => {
    onVisibilityChange?.(visible)
  }, [visible, onVisibilityChange])

  if (!visible) return null

  return (
    <div
      className={`
        fixed inset-e-4 z-30 bottom-before-bottombar mb-4
        transition-all duration-300 ease-out
        translate-y-0 opacity-100 scale-100
      `}
    >
      <md-fab aria-label={label} onClick={onClick} {...(variant && { variant })}>
        <md-icon slot="icon">{icon}</md-icon>
      </md-fab>
    </div>
  )
}
