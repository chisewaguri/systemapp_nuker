import { useRef, useLayoutEffect } from 'react'
import BottomBar from './BottomBar'
import PendingChanges from './PendingChanges'
import type { PendingChange } from '../lib/PendingChanges'

interface LayoutProps {
  activeTab: string
  onTabChange: (tab: string) => void
  children: React.ReactNode
  onReboot: () => void
  onCancelPending: (change: PendingChange) => Promise<boolean>
  onCancelAllPending: (changes: PendingChange[]) => Promise<boolean>
}

export default function Layout({ activeTab, onTabChange, children, onReboot, onCancelPending, onCancelAllPending }: LayoutProps) {
  const mainRef = useRef<HTMLElement>(null)
  const scrollPositions = useRef<Record<string, number>>({})
  const restoring = useRef(false)

  useLayoutEffect(() => {
    const main = mainRef.current
    if (!main) return

    restoring.current = true
    let frame: number | undefined
    const restore = () => {
      if (main.querySelector('[data-page-loading]')) return
      observer.disconnect()
      frame = requestAnimationFrame(() => {
        main.scrollTop = scrollPositions.current[activeTab] ?? 0
        restoring.current = false
      })
    }
    const observer = new MutationObserver(restore)
    observer.observe(main, { childList: true, subtree: true })
    restore()
    return () => {
      observer.disconnect()
      if (frame !== undefined) cancelAnimationFrame(frame)
    }
  }, [activeTab])

  return (
    <>
      <div className="fixed top-0 bottom-before-bottombar inset-s-0 inset-e-0 md:inset-s-32 pt-safe box-border flex flex-col bg-surface-container-low">
        <PendingChanges onReboot={onReboot} onCancel={onCancelPending} onCancelAll={onCancelAllPending} />
        <main
          ref={mainRef}
          onScroll={event => {
            if (!restoring.current) scrollPositions.current[activeTab] = event.currentTarget.scrollTop
          }}
          className="
            min-h-0 flex-1 w-full max-w-2xl self-center
            bg-surface-container-low
            inset-s-0 inset-e-0
            overflow-y-auto
          "
          style={{ viewTransitionName: 'page-content' }}
        >
          {children}
        </main>
        <div id="notice-root" className="shrink-0 w-full max-w-2xl self-center" />
        <div id="page-action-root" className="shrink-0 w-full max-w-2xl self-center" />
      </div>
      <BottomBar activeTab={activeTab} onTabChange={onTabChange} />
      <div id="dialog-root" />
    </>
  )
}
