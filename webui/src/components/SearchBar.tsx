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
        <md-icon slot="trailing-icon" onClick={() => onChange('')}>
          clear
        </md-icon>
      )}
    </md-filled-text-field>
  )
}
