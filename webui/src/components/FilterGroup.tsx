import { useTranslation } from 'react-i18next'
import type { Category } from '../data/category'
import GoogleSvg from '../assets/google.svg?react'

const categoryIcons: Record<string, React.FC<{ className?: string }>> = {
  google: GoogleSvg,
}

interface FilterGroupProps {
  categories: Category[]
  selectedCategories: string[]
  onToggle: (categoryId: string) => void
}

export default function FilterGroup({ categories, selectedCategories, onToggle }: FilterGroupProps) {
  const { t } = useTranslation()

  return (
    <md-chip-set>
      {categories.map(category => {
        const SvgIcon = categoryIcons[category.id]
        return (
          <md-filter-chip
            key={category.id}
            selected={selectedCategories.includes(category.id)}
            onClick={() => onToggle(category.id)}
            style={{ '--md-filter-chip-outline-color': category.color } as React.CSSProperties}
          >
            {SvgIcon ? (
              <span slot="icon" className="flex items-center justify-center"><SvgIcon className="w-4 h-4" /></span>
            ) : category.icon ? (
              <md-icon slot="icon" style={{ fontSize: '18px', color: category.color } as React.CSSProperties}>{category.icon}</md-icon>
            ) : null}
            {t(`category.${category.id}`)}
          </md-filter-chip>
        )
      })}
    </md-chip-set>
  )
}
