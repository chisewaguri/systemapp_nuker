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
      className={`
        ${bottomContent ? 'sticky -top-8 [@media(min-height:700px)]:top-0' : 'top-0 [@media(min-height:700px)]:sticky'} inset-s-0 w-full z-50
        bg-surface-container-low text-on-surface
      `}
    >
      <header
        className={`
          w-full ${bottomContent ? 'h-8' : 'h-12'} [@media(min-height:700px)]:h-16 px-4
          flex items-center
          box-border select-none
        `}
      >
        <div className={`${bottomContent ? 'hidden [@media(min-height:700px)]:block' : ''} overflow-hidden transition-all duration-200 ${navigationIcon ? 'opacity-100 max-w-96 mr-2' : 'opacity-0 max-w-0 pointer-events-none'}`}>
          {navigationIcon}
        </div>
        <h1 className={`${bottomContent ? 'text-base [@media(min-height:700px)]:text-xl' : 'text-xl'} font-normal m-0 flex-1`}>{title}</h1>
        <div className={`${bottomContent ? 'hidden [@media(min-height:700px)]:flex' : 'flex'} items-center transition-opacity duration-200 ${action ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          {action}
        </div>
      </header>
      {bottomContent && (
        <div className="px-4 py-1 [@media(min-height:700px)]:pb-4 flex items-start gap-2">
          <div className="min-w-0 flex-1 flex flex-col gap-2">{bottomContent}</div>
          {action && <div className="shrink-0 [@media(min-height:700px)]:hidden">{action}</div>}
        </div>
      )}
    </div>
  )
}
