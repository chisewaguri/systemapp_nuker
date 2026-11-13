import type { MdFilledTextField, MdMenu } from '@material/web/all'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { removalLevels, type Removal } from '../lib/uad'
import { useHistory } from '../hooks/useHistory'

interface Filter {
  selected: string[]
  onToggle: (id: string) => void
  counts: Partial<Record<Removal, number>>
  pendingCounts?: Partial<Record<Removal, number>>
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
  const menu = useRef<MdMenu>(null)
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
  useEffect(() => {
    const element = menu.current
    if (!element) return
    const reposition = () => element.reposition()
    element.addEventListener('opened', reposition)
    element.addEventListener('closed', closeMenu)
    return () => {
      element.removeEventListener('opened', reposition)
      element.removeEventListener('closed', closeMenu)
    }
  }, [closeMenu, filter])
  const active = filter ? removalLevels.filter(level => filter.selected.includes(level.id)) : []
  const activeNames = active.map(level => t(`removal.${level.id}`)).join(', ')

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <md-filled-text-field
          className="min-w-0 flex-1"
          aria-label={t(filter ? 'global.search_apps' : 'global.search_paths')}
          placeholder={t(filter ? 'global.search_app_or_package' : 'global.search_paths')}
          value={value}
          onInput={(e: React.InputEvent<MdFilledTextField>) => onChange(e.currentTarget.value)}
          style={{
            '--md-filled-text-field-container-shape': '9999px',
            '--md-filled-field-active-indicator-height': '0',
            '--md-filled-field-hover-active-indicator-height': '0',
            '--md-filled-field-focus-active-indicator-height': '0',
          } as React.CSSProperties}
        >
          {value && (
            <md-icon-button slot="trailing-icon" aria-label={t('global.clear_search')} onClick={() => onChange('')}>
              <md-icon>clear</md-icon>
            </md-icon-button>
          )}
        </md-filled-text-field>
        {filter && (
          <span className="relative inline-flex shrink-0">
            <md-icon-button
              id="removal-filter-anchor"
              ref={anchor}
              aria-label={menuOpen ? t('removal.close_filter') : active.length ? t('removal.filter_active', {filters: activeNames}) : t('removal.filter')}
              aria-haspopup="listbox"
              aria-expanded={menuOpen ? 'true' : 'false'}
              style={active.length > 0 ? { '--md-icon-button-icon-color': 'var(--md-sys-color-primary)' } as React.CSSProperties : undefined}
              onClick={() => (menuOpen ? closeMenu() : openMenu())}
            >
              <md-icon>{menuOpen ? 'close' : 'filter_list'}</md-icon>
            </md-icon-button>
          </span>
        )}
      </div>

      {filter && (
        <md-menu
          ref={menu}
          role="listbox"
          aria-label={t('removal.filter')}
          aria-multiselectable="true"
          anchor="removal-filter-anchor"
          positioning="popover"
          anchor-corner="end-end"
          menu-corner="start-end"
          open={menuOpen}
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
                type="option"
                aria-selected={selected ? 'true' : 'false'}
                onClick={() => filter.onToggle(level.id)}
              >
                <span slot="start" className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: level.color }} />
                <span slot="headline">{t(`removal.${level.id}`)}</span>
                <span slot="supporting-text" className="whitespace-normal text-on-surface-variant">
                  {t('removal.available_count', {count: filter.counts[level.id] ?? 0})}
                  {(filter.pendingCounts?.[level.id] ?? 0) > 0 && <> · {t('removal.pending_count', {count: filter.pendingCounts?.[level.id]})}</>}
                </span>
                <span slot="end">
                  <md-icon style={{ visibility: selected ? 'visible' : 'hidden', fontSize: '20px', color: 'var(--md-sys-color-primary)' }}>check</md-icon>
                </span>
              </md-menu-item>
            )
          })}
        </md-menu>
      )}
      {filter && active.length > 0 && <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-sm text-on-surface-variant">{t('removal.active', {filters: activeNames})}</span>
        <md-text-button class="shrink-0" onClick={() => { active.forEach(level => filter.onToggle(level.id)); closeMenu() }}>
          {t('removal.clear_all')}
        </md-text-button>
      </div>}

    </div>
  )
}
