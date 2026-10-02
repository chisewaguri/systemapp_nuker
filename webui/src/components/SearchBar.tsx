import type { MdFilledTextField } from '@material/web/all'
import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { removalLevels, type Removal } from '../lib/uad'
import { useHistory } from '../hooks/useHistory'

interface Filter {
  selected: string[]
  onToggle: (id: string) => void
  counts: Partial<Record<Removal, number>>
}

interface SearchBarProps {
  value: string
  onChange: (value: string) => void
  filter?: Filter
}

export default function SearchBar({ value, onChange, filter }: SearchBarProps) {
  const { t } = useTranslation()
  const [menuOpen, setMenuOpen] = useState(false)
  const anchor = useRef<HTMLElement>(null)
  const { push, consume } = useHistory()

  // back closes the menu instead of leaving the webui, like the dialogs
  const openMenu = useCallback(() => {
    setMenuOpen(true)
    push('removal-filter', () => setMenuOpen(false))
  }, [push])
  const closeMenu = useCallback(() => {
    setMenuOpen(false)
    consume('removal-filter')
  }, [consume])
  const active = filter ? removalLevels.filter(level => filter.selected.includes(level.id)) : []

  return (
    <div className="flex flex-col gap-2">
      <md-filled-text-field
        className="w-full"
        aria-label={t('global.search')}
        placeholder={t('global.search')}
        value={value}
        onInput={(e: React.InputEvent<MdFilledTextField>) => onChange(e.currentTarget.value)}
        style={{
          '--md-filled-text-field-container-shape': '9999px',
          '--md-filled-field-active-indicator-height': '0',
          '--md-filled-field-hover-active-indicator-height': '0',
          '--md-filled-field-focus-active-indicator-height': '0',
        } as React.CSSProperties}
      >
        <md-icon slot="leading-icon">search</md-icon>
        <span slot="trailing-icon" className="flex items-center">
          {value && (
            <md-icon-button aria-label={t('global.clear_search')} onClick={() => onChange('')}>
              <md-icon>clear</md-icon>
            </md-icon-button>
          )}
          {filter && (
            <span className="relative inline-flex">
              <md-icon-button
                id="removal-filter-anchor"
                ref={anchor}
                aria-label={t('removal.filter')}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                style={active.length > 0 ? { '--md-icon-button-icon-color': 'var(--md-sys-color-primary)' } as React.CSSProperties : undefined}
                onClick={() => (menuOpen ? closeMenu() : openMenu())}
              >
                <md-icon>filter_list</md-icon>
              </md-icon-button>
              {active.length > 0 && (
                <span className="pointer-events-none absolute start-6 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 font-sans text-[10px] font-medium leading-none text-on-primary ring-2 ring-surface-container-highest">
                  {active.length}
                </span>
              )}
            </span>
          )}
        </span>
      </md-filled-text-field>

      {filter && (
        <md-menu
          anchor="removal-filter-anchor"
          positioning="popover"
          anchor-corner="end-end"
          menu-corner="start-end"
          open={menuOpen}
          onClosed={closeMenu}
          style={{
            '--md-menu-container-shape': '20px',
            '--md-menu-container-color': 'var(--md-sys-color-surface-container-high)',
            '--md-menu-top-space': '8px',
            '--md-menu-bottom-space': '8px',
          } as React.CSSProperties}
        >
          {removalLevels.map(level => {
            const selected = filter.selected.includes(level.id)
            return (
              <md-menu-item
                key={level.id}
                keep-open
                aria-checked={selected}
                role="menuitemcheckbox"
                onClick={() => filter.onToggle(level.id)}
              >
                <span slot="start" className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: level.color }} />
                <span slot="headline">{t(`removal.${level.id}`)}</span>
                <span slot="end" className="flex items-center gap-2 text-sm tabular-nums text-on-surface-variant">
                  {filter.counts[level.id] ?? 0}
                  <md-icon style={{ visibility: selected ? 'visible' : 'hidden', fontSize: '20px', color: 'var(--md-sys-color-primary)' }}>check</md-icon>
                </span>
              </md-menu-item>
            )
          })}
          {active.length > 0 && (
            <>
              <md-divider role="separator" tabindex="-1" />
              <md-menu-item onClick={() => active.forEach(level => filter.onToggle(level.id))}>
                <md-icon slot="start" style={{ fontSize: '20px' }}>filter_list_off</md-icon>
                <span slot="headline">{t('removal.clear_all')}</span>
              </md-menu-item>
            </>
          )}
        </md-menu>
      )}

    </div>
  )
}
