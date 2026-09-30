import type { MdFilledTextField } from '@material/web/all'
import { useTranslation } from 'react-i18next'

interface SearchBarProps {
  value: string
  onChange: (value: string) => void
}

export default function SearchBar({ value, onChange }: SearchBarProps) {
  const { t } = useTranslation()

  return (
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
      {value && (
        <md-icon-button slot="trailing-icon" aria-label={t('global.clear_search')} onClick={() => onChange('')}>
          <md-icon>clear</md-icon>
        </md-icon-button>
      )}
    </md-filled-text-field>
  )
}
