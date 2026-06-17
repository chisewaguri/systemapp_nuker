import type { ReactNode } from 'react'

interface HeaderProps {
  title: string
  action?: ReactNode
  navigationIcon?: ReactNode
  bottomContent?: ReactNode
}

export default function Header({ title, action, navigationIcon, bottomContent }: HeaderProps) {
  return (
    <div
      className="
        pt-safe top-0 sticky inset-s-0 w-full z-50
        bg-surface-container-low text-on-surface
      "
    >
      <header
        className="
          w-full h-16 px-4
          flex items-center
          box-border select-none
        "
      >
        <div className={`overflow-hidden transition-all duration-200 ${navigationIcon ? 'opacity-100 max-w-96 mr-2' : 'opacity-0 max-w-0 pointer-events-none'}`}>
          {navigationIcon}
        </div>
        <div className="text-xl m-0 flex-1">{title}</div>
        <div className={`flex items-center transition-opacity duration-200 ${action ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          {action}
        </div>
      </header>
      {bottomContent && (
        <div className="px-4 pb-4 flex flex-col gap-4">
          {bottomContent}
        </div>
      )}
    </div>
  )
}
