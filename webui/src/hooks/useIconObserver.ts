import { useEffect, useRef, useCallback } from 'react'
import { savedIcon } from '../lib/iconCache'

export function useIconObserver() {
  const containerRef = useRef<HTMLDivElement>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)

  const loadIcon = useCallback((img: HTMLImageElement) => {
    if (img.classList.contains('loaded')) return

    img.onload = () => {
      img.classList.add('loaded')
      img.style.opacity = '1'
      const loader = img.parentElement?.querySelector<HTMLElement>('.icon-loader')
      if (loader) loader.style.display = 'none'
    }
    const showFallback = () => {
      img.style.display = 'none'
      const fallback = img.parentElement?.querySelector<HTMLElement>('.icon-fallback')
      if (fallback) fallback.style.display = 'flex'
      const loader = img.parentElement?.querySelector<HTMLElement>('.icon-loader')
      if (loader) loader.style.display = 'none'
    }
    img.onerror = () => {
      img.onerror = showFallback
      savedIcon(img.dataset.package ?? '').then(icon => {
        if (icon) img.src = icon
        else showFallback()
      })
    }
    img.src = `ksu://icon/${img.dataset.package}`
  }, [])

  const observeElements = useCallback(() => {
    if (!containerRef.current || !observerRef.current) return

    containerRef.current.querySelectorAll<HTMLElement>('.icon-container').forEach(el => {
      const img = el.querySelector<HTMLImageElement>('.app-icon')
      if (img && !img.classList.contains('loaded')) {
        observerRef.current?.observe(el)
      }
    })
  }, [])

  useEffect(() => {
    if (!containerRef.current) return

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const el = entry.target as HTMLElement
            const img = el.querySelector<HTMLImageElement>('.app-icon')
            if (img) {
              loadIcon(img)
              observerRef.current?.unobserve(el)
            }
          }
        })
      },
      { rootMargin: '100px', threshold: 0.1 }
    )

    observeElements()

    return () => {
      observerRef.current?.disconnect()
      observerRef.current = null
    }
  }, [loadIcon, observeElements])

  // Rows are recreated after a search or refresh, so look for new ones on every render.
  useEffect(() => {
    observeElements()
  })

  return containerRef
}
