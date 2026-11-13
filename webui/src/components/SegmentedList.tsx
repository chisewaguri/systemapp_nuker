import type { ReactNode } from 'react'

export interface SegmentedListItem {
  key: string | number
  leadingContent?: ReactNode
  content: ReactNode
  trailingContent?: ReactNode
  /** Extra class names applied to the item wrapper */
  className?: string
  /** Keep in DOM but visually hidden — prevents remounting children */
  hidden?: boolean
  noRipple?: boolean
  labelFor?: string
  onClick?: () => void
  onContextMenu?: (e: React.MouseEvent) => void
}

interface SegmentedListProps {
  items: SegmentedListItem[]
  className?: string
}

export default function SegmentedList({ items, className = '' }: SegmentedListProps) {
  const firstVisibleIdx = items.findIndex(item => !item.hidden)
  let lastVisibleIdx = items.length - 1
  while (lastVisibleIdx >= 0 && items[lastVisibleIdx].hidden) {
    lastVisibleIdx--
  }

  return (
    <ul className={`m-0 list-none flex flex-col gap-0.5 px-4 pb-4 ${className}`}>
      {items.map((item, i) => {
        const isFirst = i === firstVisibleIdx
        const isLast = i === lastVisibleIdx
        const corners = [
          isFirst ? 'rounded-t-[20px]' : 'rounded-sm',
          isLast ? 'rounded-b-[20px]' : 'rounded-sm',
        ].join(' ')

        const Wrapper = item.labelFor ? 'label' : item.noRipple ? 'div' : item.onClick ? 'button' : 'label'

        return (
          <li key={item.key} hidden={item.hidden}>
            <Wrapper
              type={Wrapper === 'button' ? 'button' : undefined}
              htmlFor={Wrapper === 'label' ? item.labelFor : undefined}
              className={`
                relative box-border w-full flex items-center gap-3 p-3 text-start border-0 text-base font-[family-name:inherit]
                bg-surface-container-high text-on-surface
                ${corners}
                active:rounded-[20px]
                active:bg-surface-container-high
                transition-all duration-200 ease-out
                ${item.className ?? ''}
              `}
              onClick={item.onClick}
              onContextMenu={item.onContextMenu}
            >
              {!item.noRipple && <md-ripple />}
              {item.leadingContent}
              <div className="flex flex-col min-w-0 flex-1">
                {item.content}
              </div>
              {item.trailingContent}
            </Wrapper>
          </li>
        )
      })}
    </ul>
  )
}
