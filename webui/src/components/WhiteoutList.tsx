import { useState, useImperativeHandle, forwardRef, useCallback } from 'react'
import SegmentedList, { type SegmentedListItem } from './SegmentedList'

interface WhiteoutListProps {
  whiteouts: string[]
  searchQuery: string
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

const WhiteoutList = forwardRef<WhiteoutListHandle, WhiteoutListProps>(function WhiteoutList({ whiteouts, searchQuery, onSelectionChange, onEditModeChange }, ref) {
  const [selectedWhiteouts, setSelectedWhiteouts] = useState<Set<string>>(new Set())
  const [checkboxVisible, setCheckboxVisible] = useState(false)

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
      const all = new Set(whiteouts)
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

  const filteredWhiteouts = whiteouts.filter(whiteout =>
    searchQuery === '' ||
    whiteout.toLowerCase().includes(searchQuery.toLowerCase())
  )

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
    trailingContent: (
      <div className={`transition-all duration-200 ease-out ${checkboxVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-50 pointer-events-none'}`}>
        <md-checkbox
          touch-target="wrapper"
          checked={selectedWhiteouts.has(whiteout)}
          onChange={() => toggleWhiteout(whiteout)}
        />
      </div>
    ),
    onContextMenu: (e: React.MouseEvent) => handleContextMenu(e, whiteout),
  }))

  return <SegmentedList items={listItems} />
})

export default WhiteoutList
