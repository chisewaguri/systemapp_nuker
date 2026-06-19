import { useTranslation } from 'react-i18next'
import type { ConfigItem } from '../data/config'
import SegmentedList, { type SegmentedListItem } from './SegmentedList'
import type { MdOutlinedSelect, MdOutlinedTextField } from '@material/web/all'

interface ConfigProps {
  items: ConfigItem[]
  onSave: (key: string, value: string | boolean | number) => void
}

export default function Config({ items, onSave }: ConfigProps) {
  const { t } = useTranslation()
  const visibleItems = items.filter(item => !item.readonly)

  const listItems: SegmentedListItem[] = visibleItems.map(item => {
    const label = item.label ? t(item.label) : item.key
    const description = item.description ? t(item.description) : ''

    if (item.options) {
      return {
        key: item.key,
        className: '!p-3',
        noRipple: true,
        content: (
          <md-outlined-select
            label={label}
            supporting-text={description}
            value={String(item.value)}
            style={{ '--md-outlined-field-supporting-text-color': 'var(--md-sys-color-outline)' } as React.CSSProperties}
            onChange={(e: React.ChangeEvent<MdOutlinedSelect>) => {
              const target = e.target
              const newValue = item.options!.find(o => String(o) === target.value)
              if (newValue !== undefined) onSave(item.key, newValue)
            }}
          >
            {item.options.map(opt => (
              <md-select-option key={String(opt)} value={String(opt)}>
                <div slot="headline">{t(`config.${item.key}_${opt}`)}</div>
              </md-select-option>
            ))}
          </md-outlined-select>
        ),
      }
    }

    if (typeof item.value === 'boolean') {
      return {
        key: item.key,
        className: '!p-4 !justify-between',
        content: (
          <>
            <span className="text-on-surface">{label}</span>
            {description && (
              <span className="text-outline text-xs">{description}</span>
            )}
          </>
        ),
        trailingContent: (
          <md-switch
            icons
            selected={item.value}
            onChange={() => onSave(item.key, !item.value)}
          />
        ),
      }
    }

    return {
      key: item.key,
      className: '!p-3',
      noRipple: true,
      content: (
        <md-outlined-text-field
          label={label}
          supporting-text={description}
          value={String(item.value)}
          type={typeof item.value === 'number' ? 'number' : 'text'}
          style={{ '--md-outlined-field-supporting-text-color': 'var(--md-sys-color-outline)' } as React.CSSProperties}
          onBlur={(e: React.FocusEvent<MdOutlinedTextField>) => {
            const target = e.target
            const newValue = typeof item.value === 'number'
              ? Number(target.value)
              : target.value
            onSave(item.key, newValue)
          }}
        />
      ),
    }
  })

  return <SegmentedList items={listItems} />
}
