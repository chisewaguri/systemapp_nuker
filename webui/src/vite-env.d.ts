/// <reference types="vite/client" />

declare module '*.svg?react' {
  import type { FC, SVGProps } from 'react'
  const component: FC<SVGProps<SVGSVGElement>>
  export default component
}
