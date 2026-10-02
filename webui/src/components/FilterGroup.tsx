import { useTranslation } from 'react-i18next'
import { removalLevels } from '../lib/uad'

interface FilterGroupProps {
  selectedCategories: string[]
  onToggle: (categoryId: string) => void
}

export default function FilterGroup({ selectedCategories, onToggle }: FilterGroupProps) {
  const { t } = useTranslation()

  return (
    <md-chip-set>
      {removalLevels.map(level => (
        <md-filter-chip
          key={level.id}
          selected={selectedCategories.includes(level.id)}
          onClick={() => onToggle(level.id)}
          style={{ '--md-filter-chip-outline-color': level.color } as React.CSSProperties}
        >
          <md-icon slot="icon" style={{ fontSize: '18px', color: level.color } as React.CSSProperties}>{level.icon}</md-icon>
          {t(`removal.${level.id}`)}
        </md-filter-chip>
      ))}
    </md-chip-set>
  )
}
