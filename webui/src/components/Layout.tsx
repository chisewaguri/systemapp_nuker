import { useRef, useLayoutEffect } from 'react'
import BottomBar from './BottomBar'

interface LayoutProps {
  activeTab: string
  onTabChange: (tab: string) => void
  children: React.ReactNode
}

export default function Layout({ activeTab, onTabChange, children }: LayoutProps) {
  const mainRef = useRef<HTMLElement>(null)
  const scrollPositions = useRef<Record<string, number>>({})
  const prevTabRef = useRef(activeTab)

  useLayoutEffect(() => {
    const main = mainRef.current
    if (!main) return

    scrollPositions.current[prevTabRef.current] = main.scrollTop

    const saved = scrollPositions.current[activeTab]
    if (saved !== undefined) {
      main.scrollTop = saved
    }

    prevTabRef.current = activeTab
  }, [activeTab])

  return (
    <>
      <main
        ref={mainRef}
        className="
          fixed top-0 bottom-before-bottombar
          bg-surface-container-low
          inset-s-0 inset-e-0
          md:inset-s-18
          overflow-y-auto
        "
        style={{ viewTransitionName: 'page-content' }}
      >
        {children}
        <div className="h-18" />
      </main>
      <BottomBar activeTab={activeTab} onTabChange={onTabChange} />
      <div id="dialog-root" />
    </>
  )
}
