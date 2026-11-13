import { useState, useImperativeHandle, forwardRef, useEffect, useMemo, useLayoutEffect } from 'react'
import { useTranslation } from 'react-i18next'
import SegmentedList, { type SegmentedListItem } from './SegmentedList'
import PendingMatches from './PendingMatches'

interface WhiteoutListProps {
  whiteouts: string[]
  pendingChanges: {path: string, hiding: boolean}[]
  searchQuery: string
  emptyMessage: string
  initialSelection?: string[]
  disabled?: boolean
  onSelectionChange?: (paths: string[], hiddenCount: number, visibleCount: number) => void
}

export interface WhiteoutListHandle {
  getSelectedWhiteouts: () => string[]
  clearSelection: () => void
  selectAll: () => void
  deselectAllVisible: () => void
}

const WhiteoutList = forwardRef<WhiteoutListHandle, WhiteoutListProps>(function WhiteoutList({ whiteouts, pendingChanges, searchQuery, emptyMessage, initialSelection = [], disabled = false, onSelectionChange }, ref) {
  const { t } = useTranslation()
  const [selectedWhiteouts, setSelectedWhiteouts] = useState<Set<string>>(() => new Set(initialSelection))
  const restorablePaths = useMemo(() => whiteouts.filter(path => !pendingChanges.some(change => change.path === path)), [whiteouts, pendingChanges])
  const filteredWhiteouts = restorablePaths.filter(whiteout =>
    searchQuery === '' ||
    whiteout.toLowerCase().includes(searchQuery.toLowerCase())
  )

  useEffect(() => {
    setSelectedWhiteouts(previous => {
      const next = new Set([...previous].filter(path => restorablePaths.includes(path)))
      if (next.size === previous.size) return previous
      return next
    })
  }, [restorablePaths])

  const visiblePaths = filteredWhiteouts
  const hiddenCount = [...selectedWhiteouts].filter(path => !visiblePaths.includes(path)).length
  const visibleCount = visiblePaths.length
  useLayoutEffect(() => {
    onSelectionChange?.([...selectedWhiteouts], hiddenCount, visibleCount)
  }, [selectedWhiteouts, hiddenCount, visibleCount, onSelectionChange])

  useImperativeHandle(ref, () => ({
    getSelectedWhiteouts: () => Array.from(selectedWhiteouts),
    clearSelection: () => {
      setSelectedWhiteouts(new Set())
    },
    selectAll: () => {
      setSelectedWhiteouts(previous => new Set([...previous, ...visiblePaths]))
    },
    deselectAllVisible: () => {
      const visible = new Set(visiblePaths)
      setSelectedWhiteouts(previous => new Set([...previous].filter(path => !visible.has(path))))
    },
  }))

  const toggleWhiteout = (whiteout: string) => {
    if (!restorablePaths.includes(whiteout)) return
    setSelectedWhiteouts(prev => {
      const next = new Set(prev)
      if (next.has(whiteout)) {
        next.delete(whiteout)
      } else {
        next.add(whiteout)
      }
      return next
    })
  }

  const listItems: SegmentedListItem[] = filteredWhiteouts.map(whiteout => {
    const status = t('whiteout.hidden')
    return {
      key: whiteout,
      leadingContent: (
        <div className="w-10 h-10 shrink-0 flex items-center justify-center bg-secondary-container rounded-lg my-1">
          <md-icon>description</md-icon>
        </div>
      ),
      content: (
        <>
          <span className="text-on-surface font-medium whitespace-normal wrap-break-word text-sm font-mono">{whiteout}</span>
          <span className="text-sm text-on-surface-variant">{status}</span>
        </>
      ),
      trailingContent: (
        <div>
          <md-checkbox
            aria-label={`${whiteout}, ${status}`}
            disabled={disabled}
            touch-target="wrapper"
            checked={selectedWhiteouts.has(whiteout)}
            onChange={() => toggleWhiteout(whiteout)}
          />
        </div>
      ),
    }
  })

  const pendingMatches = pendingChanges.filter(change => change.path.toLowerCase().includes(searchQuery.toLowerCase()))
    .map(change => ({kind: 'path' as const, path: change.path}))

  return <>
    {searchQuery !== '' && <PendingMatches changes={pendingMatches} />}
    {filteredWhiteouts.length > 0
    ? <SegmentedList items={listItems} />
    : (!searchQuery || pendingMatches.length === 0) && <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-sm text-on-surface-variant text-center">
      <span>{emptyMessage}</span>
    </div>}
  </>
})

export default WhiteoutList
