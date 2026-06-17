import { useState, useCallback, useRef, useEffect } from 'react'

export interface SnackBarAction {
  text: string
  callback: () => void
}

interface SnackBarState {
  message: string
  success: boolean
  visible: boolean
  action?: SnackBarAction
}

export function useSnackBar() {
  const [state, setState] = useState<SnackBarState>({
    message: '',
    success: true,
    visible: false,
  })
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const show = useCallback((message: string, success = true, duration = 3000, action?: SnackBarAction) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }

    setState({ message, success, visible: true, action })

    timerRef.current = setTimeout(() => {
      setState(prev => ({ ...prev, visible: false }))
    }, duration)
  }, [])

  const hide = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }
    setState(prev => ({ ...prev, visible: false }))
  }, [])

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [])

  return { state, show, hide }
}

interface SnackBarProps {
  state: SnackBarState
  onHide: () => void
  fabVisible?: boolean
}

export default function SnackBar({ state, onHide, fabVisible = true }: SnackBarProps) {
  const elementRef = useRef<HTMLDivElement>(null)
  const swipeStartX = useRef(0)
  const swipeStartY = useRef(0)
  const swiping = useRef(false)
  const currentX = useRef(0)
  const [mounted, setMounted] = useState(false)
  const [animate, setAnimate] = useState<'hide' | 'show' | null>(null)

  useEffect(() => {
    if (state.visible) {
      setMounted(true)
      setAnimate('hide')
      const raf = requestAnimationFrame(() => {
        setAnimate('show')
      })
      return () => cancelAnimationFrame(raf)
    } else if (mounted) {
      setAnimate('hide')
      const timer = setTimeout(() => {
        setMounted(false)
        setAnimate(null)
        onHide()
      }, 200)
      return () => clearTimeout(timer)
    }
  }, [state.visible, mounted, onHide])

  const resetInlineStyles = useCallback(() => {
    if (!elementRef.current) return
    elementRef.current.style.transition = ''
    elementRef.current.style.transform = ''
    elementRef.current.style.opacity = ''
    swiping.current = false
    currentX.current = 0
  }, [])

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (!elementRef.current || !state.visible || swiping.current) return

    swipeStartX.current = e.clientX
    swipeStartY.current = e.clientY
    currentX.current = 0

    const handlePointerMove = (e: PointerEvent) => {
      if (!elementRef.current) return

      const deltaX = e.clientX - swipeStartX.current
      const deltaY = e.clientY - swipeStartY.current

      if (!swiping.current && Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 5) {
        cleanupSwipeListeners()
        return
      }

      if (!swiping.current && Math.abs(deltaX) > 5) {
        swiping.current = true
      }

      if (!swiping.current) return

      currentX.current = deltaX
      elementRef.current.style.transition = 'none'
      elementRef.current.style.transform = `translateX(${deltaX}px)`

      const maxDistance = elementRef.current.offsetWidth * 0.5
      elementRef.current.style.opacity = String(Math.max(0, 1 - Math.abs(deltaX) / maxDistance))
    }

    const handlePointerUp = () => {
      cleanupSwipeListeners()
      if (!elementRef.current || !swiping.current) return

      const threshold = elementRef.current.offsetWidth * 0.3

      if (Math.abs(currentX.current) > threshold) {
        const sign = Math.sign(currentX.current)
        elementRef.current.style.transition = 'transform 0.3s ease, opacity 0.3s ease'
        elementRef.current.style.transform = `translateX(${sign * elementRef.current.offsetWidth}px)`
        elementRef.current.style.opacity = '0'

        setTimeout(() => {
          resetInlineStyles()
          onHide()
        }, 300)
      } else {
        elementRef.current.style.transition = 'transform 0.3s ease, opacity 0.2s ease'
        elementRef.current.style.transform = ''
        elementRef.current.style.opacity = ''
        swiping.current = false
        currentX.current = 0
      }
    }

    const cleanupSwipeListeners = () => {
      document.removeEventListener('pointermove', handlePointerMove)
      document.removeEventListener('pointerup', handlePointerUp)
      document.removeEventListener('pointercancel', handlePointerUp)
    }

    document.addEventListener('pointermove', handlePointerMove)
    document.addEventListener('pointerup', handlePointerUp)
    document.addEventListener('pointercancel', handlePointerUp)
  }, [state.visible, onHide, resetInlineStyles])

  if (!mounted) return null

  return (
    <div
      ref={elementRef}
      className={`
        fixed left-4 right-4 mx-auto bottom-before-bottombar mb-4
        max-w-150 px-1 flex items-center gap-2
        rounded text-sm select-none touch-none
        transition-all duration-200 ease-out
        ${state.success ? 'bg-inverse-surface text-inverse-on-surface' : 'bg-error-container text-on-error-container'}
        ${animate === 'hide' ? 'scale-90 opacity-0 pointer-events-none' : ''}
      `}
      style={fabVisible ? { marginBottom: 'calc(16px + 56px + 8px)' } : undefined}
      onPointerDown={handlePointerDown}
    >
      <span className="flex-1 py-4 ps-2">{state.message}</span>
      {state.action && (
        <md-text-button
          slot="action"
          className="shrink-0"
          style={{ '--md-sys-color-primary': 'var(--md-sys-color-inverse-primary)' } as React.CSSProperties}
          onClick={() => {
            state.action!.callback()
            onHide()
          }}
        >
          {state.action.text}
        </md-text-button>
      )}
    </div>
  )
}
