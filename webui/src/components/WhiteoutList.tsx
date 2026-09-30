import { useState, useImperativeHandle, forwardRef, useCallback } from 'react'
import SegmentedList, { type SegmentedListItem } from './SegmentedList'

interface WhiteoutListProps {
  whiteouts: string[]
  searchQuery: string
  emptyMessage: string
  onSelectionChange?: (hasSelection: boolean) => void
  onEditModeChange?: (isEditing: boolean) => void
}

export interface WhiteoutListHandle {
  getSelectedWhiteouts: () => string[]
  clearSelection: () => void
  showCheckboxes: () => void
  hideCheckboxes: () => void
  isCheckboxVisible: () => boolean
  selectAll: () => void
  deselectAll: () => void
}

const WhiteoutList = forwardRef<WhiteoutListHandle, WhiteoutListProps>(function WhiteoutList({ whiteouts, searchQuery, emptyMessage, onSelectionChange, onEditModeChange }, ref) {
  const [selectedWhiteouts, setSelectedWhiteouts] = useState<Set<string>>(new Set())
  const [checkboxVisible, setCheckboxVisible] = useState(false)
  const filteredWhiteouts = whiteouts.filter(whiteout =>
    searchQuery === '' ||
    whiteout.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleSelectionChange = useCallback((newSelection: Set<string>) => {
    queueMicrotask(() => onSelectionChange?.(newSelection.size > 0))
  }, [onSelectionChange])

  const setCheckboxVisibleWithCallback = useCallback((visible: boolean) => {
    setCheckboxVisible(visible)
    onEditModeChange?.(visible)
  }, [onEditModeChange])

  useImperativeHandle(ref, () => ({
    getSelectedWhiteouts: () => Array.from(selectedWhiteouts),
    clearSelection: () => {
      setSelectedWhiteouts(new Set())
      handleSelectionChange(new Set())
    },
    showCheckboxes: () => setCheckboxVisibleWithCallback(true),
    hideCheckboxes: () => {
      setCheckboxVisibleWithCallback(false)
      setSelectedWhiteouts(new Set())
      handleSelectionChange(new Set())
    },
    isCheckboxVisible: () => checkboxVisible,
    selectAll: () => {
      const all = new Set(filteredWhiteouts)
      setSelectedWhiteouts(all)
      handleSelectionChange(all)
    },
    deselectAll: () => {
      setSelectedWhiteouts(new Set())
      handleSelectionChange(new Set())
    },
  }))

  const toggleWhiteout = (whiteout: string) => {
    setSelectedWhiteouts(prev => {
      const next = new Set(prev)
      if (next.has(whiteout)) {
        next.delete(whiteout)
      } else {
        next.add(whiteout)
      }
      handleSelectionChange(next)
      return next
    })
  }

  const handleContextMenu = (e: React.MouseEvent, whiteout: string) => {
    e.preventDefault()
    if (!checkboxVisible) {
      setCheckboxVisibleWithCallback(true)
    }
    setSelectedWhiteouts(prev => {
      const next = new Set(prev)
      next.add(whiteout)
      handleSelectionChange(next)
      return next
    })
  }

  const listItems: SegmentedListItem[] = filteredWhiteouts.map(whiteout => ({
    key: whiteout,
    leadingContent: (
      <div className="w-10 h-10 shrink-0 flex items-center justify-center bg-secondary-container rounded-lg my-1">
        <md-icon>description</md-icon>
      </div>
    ),
    content: (
      <span className="text-on-surface font-medium whitespace-normal wrap-break-word text-sm font-mono">
        {whiteout}
      </span>
    ),
    trailingContent: checkboxVisible ? (
      <div>
        <md-checkbox
          aria-label={whiteout}
          touch-target="wrapper"
          checked={selectedWhiteouts.has(whiteout)}
          onChange={() => toggleWhiteout(whiteout)}
        />
      </div>
    ) : undefined,
    onContextMenu: (e: React.MouseEvent) => handleContextMenu(e, whiteout),
  }))

  return filteredWhiteouts.length > 0
    ? <SegmentedList items={listItems} />
    : <div className="flex items-center justify-center px-6 py-12 text-sm text-on-surface-variant text-center">{emptyMessage}</div>
})

export default WhiteoutList
