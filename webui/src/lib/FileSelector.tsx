import { useState, useRef, useEffect, useCallback, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { exec } from 'kernelsu-alt'
import type { MdDialog } from '@material/web/dialog/dialog.js'
import { customizeDialogAnimation } from '../hooks/useDialogAnimation'
import { useHistory } from '../hooks/useHistory'
import type { MdFilledTextField } from '@material/web/all'
import { shellFileFilter, shellQuote } from './shell'
import { useTranslation } from 'react-i18next'

interface FileItem {
  name: string
  path: string
  isDirectory: boolean
}

interface FileSelectorProps {
  open: boolean
  fileType: string
  mode?: 'path' | 'content'
  folder?: boolean
  onSelect: (value: string | null) => void
  root?: string
  title: string
}

const dir = (p: string) => p.replace(/\/+$/, '') + '/'

export function resolvePickerPath(value: string, root: string): string | null {
  let path = value.trim().replace(/\/+/g, '/')
  if (root === '/storage/emulated/0/') path = path.replace(/^\/sdcard(?=\/|$)/, '/storage/emulated/0')
  if (/[\r\n\0]/.test(path) || path.split('/').some(part => part === '.' || part === '..')) return null
  return path === root.replace(/\/$/, '') || path.startsWith(root) ? path : null
}

export default function FileSelector({ open, fileType, mode: rawMode = 'path', folder = false, onSelect, title, root = '/storage/emulated/0/' }: FileSelectorProps) {
  const { t } = useTranslation()
  const mode = folder ? 'path' : rawMode
  const dialogRef = useRef<MdDialog>(null)
  const pathFieldRef = useRef<HTMLElement>(null)
  const [currentPath, setCurrentPath] = useState(root)
  const [inputValue, setInputValue] = useState(root)
  const { push, consume } = useHistory()

  const [files, setFiles] = useState<FileItem[]>([])
  const [switching, setSwitching] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const requestId = useRef(0)
  const selection = useRef<string | null>(null)

  const choose = useCallback((value: string | null) => {
    selection.current = value
    dialogRef.current?.close()
  }, [])

  const listFiles = useCallback(async (path: string, skipAnimation = false) => {
    const request = ++requestId.current
    setLoading(true)
    setError('')
    try {
      if (!skipAnimation) {
        setSwitching(true)
        await new Promise(r => setTimeout(r, 150))
      }

      const dirPath = dir(path)
      const fileFilter = shellFileFilter(fileType)
      const result = await exec(`
        cd ${shellQuote(path)} || exit 1
        for f in *; do
          [ "$f" = "*" ] && [ ! -e "$f" ] && continue
          [ -d "$f" ] && echo "d|$f" || { ${fileFilter}; }
        done | sort
      `)

      if (request !== requestId.current) return
      if (result.errno !== 0) throw new Error('read_error')
      const items: FileItem[] = []
      if (dirPath !== root) {
        items.push({ name: '..', path: dir(dirPath.replace(/\/+$/, '').split('/').slice(0, -1).join('/') || root), isDirectory: true })
      }
      const parsed = result.stdout.split('\n')
        .filter(Boolean)
        .map(line => ({
          name: line.slice(2),
          path: `${dirPath}${line.slice(2)}`.replace(/\/+/g, '/'),
          isDirectory: line[0] === 'd',
        }))
      items.push(...parsed)
      setFiles(items)
    } catch {
      if (request === requestId.current) { setFiles([]); setError('read_error') }
    } finally {
      if (request === requestId.current) { setSwitching(false); setLoading(false) }
    }
  }, [fileType, root])

  useLayoutEffect(() => {
    const scroller = dialogRef.current?.shadowRoot?.querySelector('.scroller') as HTMLElement | null
    scroller?.scrollTo(0, 0)
  }, [files])

  useEffect(() => {
    if (!dialogRef.current) return
    customizeDialogAnimation(dialogRef.current)
    if (open) {
      setCurrentPath(root)
      setInputValue(root)
      setFiles([])
      selection.current = null
      dialogRef.current.show()
      requestAnimationFrame(() => listFiles(root, true))
      push('file-selector', () => dialogRef.current?.close())
    } else {
      dialogRef.current.close()
    }
  }, [open, push, root, listFiles])

  useEffect(() => {
    const el = dialogRef.current
    if (!el) return

    const onClosed = () => {
      const value = selection.current
      selection.current = null
      consume('file-selector', () => onSelect(value))
    }

    el.addEventListener('closed', onClosed)

    return () => {
      el.removeEventListener('closed', onClosed)
    }
  }, [onSelect, consume])

  useEffect(() => {
    setInputValue(currentPath)
    setTimeout(() => {
      const el = pathFieldRef.current?.shadowRoot?.querySelector('.input') as HTMLInputElement | null
      if (el) {
        el.style.overflowX = 'auto'
        el.scrollLeft = el.scrollWidth
      }
    }, 0)
  }, [currentPath])

  const navigateBack = useCallback(() => {
    const cur = dir(currentPath)
    if (cur === root) return
    const parent = dir(cur.replace(/\/+$/, '').split('/').slice(0, -1).join('/') || root)
    setCurrentPath(parent)
    listFiles(parent)
  }, [currentPath, listFiles, root])

  const navigateToInput = useCallback(async () => {
    const value = resolvePickerPath(inputValue, root)
    if (!value) {
      setError('invalid_path')
      return
    }
    if (value === currentPath) return
    const quoted = shellQuote(value)
    let result
    try { result = await exec(`[ -f ${quoted} ] && echo file || ([ -d ${quoted} ] && echo dir || echo none)`) }
    catch { setError('read_error'); return }
    if (result.errno !== 0) { setError('read_error'); return }
    const entryType = result.stdout?.trim()
    if (entryType === 'file') {
      const name = value.split('/').filter(Boolean).pop() || ''
      const pDir = dir(value.split('/').slice(0, -1).join('/') || root)
      const grandParent = dir(pDir.replace(/\/+$/, '').split('/').slice(0, -1).join('/') || root)
      const items: FileItem[] = []
      if (pDir !== root) {
        items.push({ name: '..', path: grandParent, isDirectory: true })
      }
      items.push({ name, path: value, isDirectory: false })
      setFiles(items)
      setCurrentPath(pDir)
    } else if (entryType === 'dir') {
      setCurrentPath(dir(value))
      listFiles(value)
    } else setError('invalid_path')
  }, [inputValue, currentPath, root, listFiles])

  const handlePathKeyDown = (event: React.KeyboardEvent<MdFilledTextField>) => {
    if (event.key !== 'Enter') return
    event.preventDefault()
    event.currentTarget.blur()
    navigateToInput()
  }

  const handleItemClick = useCallback(async (item: FileItem) => {
    if (item.isDirectory) {
      if (item.name === '..') {
        navigateBack()
      } else {
        const dirPath = dir(item.path)
        setCurrentPath(dirPath)
        listFiles(dirPath)
      }
    } else {
      if (mode === 'content') {
        try {
          const result = await exec(`cat ${shellQuote(item.path)}`)
          if (result.errno !== 0) throw new Error('file_error')
          choose(result.stdout)
        } catch { setError('file_error') }
      } else {
        choose(item.path)
      }
    }
  }, [mode, choose, navigateBack, listFiles])

  const openSystemFile = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = fileType === 'any' ? '*/*' : `.${fileType}`
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) return
      if (fileType !== 'any' && !file.name.endsWith(`.${fileType}`)) return
      if (mode === 'content') {
        const reader = new FileReader()
        reader.onload = () => choose(reader.result as string)
        reader.onerror = () => setError('file_error')
        reader.readAsText(file)
      } else {
        choose(file.name)
      }
    }
    input.click()
  }, [fileType, mode, choose])

  const close = useCallback(() => {
    choose(null)
  }, [choose])

  const dialog = (
    <md-dialog
      ref={dialogRef}
      aria-label={title}
      class="file-selector-dialog"
      style={{
        width: 'min(560px, 100% - 48px)',
        height: 'min(560px, 100% - 48px)',
      }}
    >
      <div slot="headline" className="flex flex-col gap-2">
        <span>{title}</span>
        <div className="flex items-center gap-2">
        <md-icon-button aria-label={t('file_selector.back')} disabled={currentPath === root} onClick={navigateBack}>
          <md-icon>arrow_back</md-icon>
        </md-icon-button>
        <md-filled-text-field
          ref={pathFieldRef as React.RefObject<HTMLElement>}
          className="min-w-0 flex-1"
          label={t('file_selector.path')}
          value={inputValue}
          onInput={(e: React.InputEvent<MdFilledTextField>) => {
            setInputValue(e.currentTarget.value)
            setError('')
          }}
          onKeyDown={handlePathKeyDown}
          style={{
            '--md-filled-text-field-container-color': 'var(--md-sys-color-surface-container-high)',
            '--_leading-space': '0',
            '--_trailing-space': '0',
            '--_top-space': '4px',
            '--_bottom-space': '4px'
          } as React.CSSProperties}
        />
        <md-text-button aria-label={t('file_selector.open_path')} disabled={loading || !inputValue.trim()} onClick={navigateToInput}>{t('global.go')}</md-text-button>
        </div>
      </div>
      <div slot="content" className={`transition-opacity duration-230 ease-out ${switching ? 'opacity-0' : 'opacity-100'}`} >
        {loading && <md-linear-progress indeterminate aria-label={t('global.loading')} class="w-full" />}
        {error && <div role="alert"><p>{t(`file_selector.${error}`, {root})}</p><md-text-button onClick={() => listFiles(currentPath, true)}>{t('global.retry')}</md-text-button></div>}
        {!loading && !error && files.every(item => item.name === '..') && <p>{t('file_selector.empty')}</p>}
        {files.map((item) => (
          <button
            key={item.path}
            type="button"
            disabled={loading}
            onClick={() => handleItemClick(item)}
            className="flex min-h-12 w-full items-center px-3 py-2.5 rounded-lg relative overflow-hidden select-none active:bg-surface-container-high text-on-surface border-0 bg-transparent text-start text-base font-[family-name:inherit]"
          >
            <md-icon class="mr-2.5 text-on-surface-variant">
              {item.isDirectory ? 'folder' : 'description'}
            </md-icon>
            <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
              {item.name}
            </span>
          </button>
        ))}
      </div>
      <div slot="actions" className="flex items-center gap-2">
        {mode === 'content' && (
          <md-text-button onClick={openSystemFile}>
            <md-icon slot="icon">folder_open</md-icon>
            {t('file_selector.system')}
          </md-text-button>
        )}
        {folder && (
          <md-text-button disabled={loading || !!error} onClick={() => choose(currentPath)}>{t('file_selector.select_folder')}</md-text-button>
        )}
        <div className="flex-1" />
        <md-text-button onClick={close}>{t('whiteout.cancel')}</md-text-button>
      </div>
    </md-dialog>
  )

  const target = document.getElementById('dialog-root')
  return target ? createPortal(dialog, target) : dialog
}
