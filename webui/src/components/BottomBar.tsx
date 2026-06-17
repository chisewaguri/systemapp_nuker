import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { LOCAL_STORAGE_KEY } from '../constant'
import HomeIcon from '../assets/home.svg?react'
import HomeFilledIcon from '../assets/home-filled.svg?react'
import RestoreIcon from '../assets/auto_delete.svg?react'
import RestoreFilledIcon from '../assets/auto_delete-filled.svg?react'
import WhiteoutIcon from '../assets/folder_off.svg?react'
import WhiteoutFilledIcon from '../assets/folder_off-filled.svg?react'
import SettingsIcon from '../assets/settings.svg?react'
import SettingsFilledIcon from '../assets/settings-filled.svg?react'

const tabs = [
  { key: '/', labelKey: 'nav.home' as const, icon: HomeIcon, iconFilled: HomeFilledIcon },
  { key: '/restore', labelKey: 'nav.restore' as const, icon: RestoreIcon, iconFilled: RestoreFilledIcon },
  { key: '/whiteout', labelKey: 'nav.whiteout' as const, icon: WhiteoutIcon, iconFilled: WhiteoutFilledIcon },
  { key: '/settings', labelKey: 'nav.settings' as const, icon: SettingsIcon, iconFilled: SettingsFilledIcon },
]

interface BottomBarProps {
  activeTab: string
  onTabChange: (tab: string) => void
}

export default function BottomBar({ activeTab, onTabChange }: BottomBarProps) {
  const { t } = useTranslation()
  const [whiteoutEnabled, setWhiteoutEnabled] = useState(() => {
    return localStorage.getItem(LOCAL_STORAGE_KEY + 'use-whiteout') === 'true'
  })

  useEffect(() => {
    const handler = (e: Event) => {
      setWhiteoutEnabled((e as CustomEvent<boolean>).detail)
    }
    window.addEventListener('whiteout-toggled', handler)
    return () => window.removeEventListener('whiteout-toggled', handler)
  }, [])

  const visibleTabs = tabs.filter(tab => {
    if (tab.key === '/whiteout') return whiteoutEnabled
    return true
  })

  return (
    <nav
      className="
        fixed bottom-0 inset-s-0 w-full
        md:w-20 md:h-full md:flex-col md:justify-center md:gap-4
        z-40
        flex items-center
        h-bottombar
        box-border
        bg-surface-container-low
        text-on-surface
        select-none
      "
    >
      {visibleTabs.map((tab) => {
        const active = activeTab === tab.key
        const Icon = active ? tab.iconFilled : tab.icon
        return (
          <button
            key={tab.key}
            onClick={() => {
              if (activeTab === tab.key) return
              if (document.startViewTransition) {
                document.startViewTransition(() => onTabChange(tab.key))
              } else {
                onTabChange(tab.key)
              }
            }}
            className={`
              relative flex flex-col items-center justify-start gap-1
              md:flex-none md:max-h-min md:px-4
              flex-1
              box-border select-none
              border-none bg-transparent p-0 pb-safe
              text-on-surface-variant
              ${active ? 'text-on-secondary-container' : ''}
            `}
          >
            <span
              className={`
                absolute top-0 inset-s-1/2 -translate-x-1/2
                w-14 h-8 rounded-full
                bg-secondary-container
                transition-all duration-200 ease-out
                ${active ? 'opacity-100 scale-100' : 'opacity-0 scale-x-50'}
              `}
            />
            <Icon className="relative" style={{ height: '32px', width: '24px' }} />
            <span className="text-xs leading-none relative">
              {t(tab.labelKey)}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
