import { useTranslation } from 'react-i18next'
import type { PendingChange } from '../lib/PendingChanges'

interface PendingMatchesProps {
  changes: PendingChange[]
  label?: string
}

export default function PendingMatches({changes, label}: PendingMatchesProps) {
  const {t} = useTranslation()
  if (changes.length === 0) return null
  return <div className="mx-6 mb-3">
    <md-text-button trailing-icon onClick={() => window.dispatchEvent(new CustomEvent('san-review-pending', {detail: changes}))}>
      {label ?? t('review.pending_matches', {count: changes.length})}
      <md-icon slot="icon">chevron_right</md-icon>
    </md-text-button>
  </div>
}
