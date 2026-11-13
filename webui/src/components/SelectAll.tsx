import { useId } from 'react'
import { useTranslation } from 'react-i18next'

interface SelectAllProps {
  count: number
  checked: boolean
  indeterminate: boolean
  disabled?: boolean
  label: string
  onChange: () => void
}

export default function SelectAll({ count, checked, indeterminate, disabled, label, onChange }: SelectAllProps) {
  const id = useId()
  const { t } = useTranslation()
  return <label htmlFor={id} className="inline-flex h-16 min-w-12 shrink-0 cursor-pointer flex-col items-center justify-center">
    <md-checkbox id={id} class="shrink-0" touch-target="wrapper" aria-label={`${label} (${count})`}
      checked={checked} indeterminate={indeterminate} disabled={disabled} onChange={onChange} />
    <span className="whitespace-nowrap text-xs leading-4 text-on-surface-variant">{t(checked ? 'review.deselect_all' : 'review.select_all')}</span>
  </label>
}
